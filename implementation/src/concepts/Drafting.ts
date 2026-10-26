import { MongoServerError, type Collection, type Db } from "mongodb";

export class AspectExists extends Error {}
export class AlreadyDrafted extends Error {}
export class NoAspects extends Error {}
export class DraftFailed extends Error {}
export class NoDraft extends Error {}
export class NoSuchAspect extends Error {}

type Role = "MAIN" | "SUPPORTING";

interface AspectDoc {
  _id: string;
  name: string;
  description: string;
}
interface DraftDoc {
  _id: string;
  item: string;
  summary: string;
  setting?: string;
  themes: string[];
  tones: string[];
}
interface FigureDoc {
  _id: string;
  draft: string;
  name: string;
  role: Role;
  minAge: number;
  maxAge: number;
}
interface RatingDoc {
  _id: string;
  draft: string;
  aspect: string;
  value: number;
}
interface Collections {
  aspects: Collection<AspectDoc>;
  drafts: Collection<DraftDoc>;
  figures: Collection<FigureDoc>;
  ratings: Collection<RatingDoc>;
}

// The agent: Gemini, asked for JSON matching a schema.
// Flash-Lite, because the free tier allows only 20 requests a day on full Flash.
const MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-lite-latest";
const FALLBACK_MODEL = "gemini-flash-latest"; // used when MODEL is overloaded
const MIN_INTERVAL_MS = Number(process.env.GEMINI_MIN_INTERVAL_MS ?? 7000); // stays under the free tier's requests per minute
let nextCallAt = 0;

const indexed = new WeakSet<Collections>();

async function ensureIndexes(c: Collections) {
  if (indexed.has(c)) return;
  await Promise.all([
    c.aspects.createIndex({ name: 1 }, { unique: true }),
    c.drafts.createIndex({ item: 1 }, { unique: true }),
    c.ratings.createIndex({ draft: 1, aspect: 1 }, { unique: true }),
  ]);
  indexed.add(c);
}

interface Answer {
  summary: string;
  setting: string;
  characters: { name: string; role: Role; minAge: number; maxAge: number }[];
  themes: string[];
  tones: string[];
  ratings: { aspect: string; value: number }[];
}

const SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    setting: { type: "STRING" },
    characters: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          role: { type: "STRING", enum: ["MAIN", "SUPPORTING"] },
          minAge: { type: "INTEGER" },
          maxAge: { type: "INTEGER" },
        },
        required: ["name", "role", "minAge", "maxAge"],
      },
    },
    themes: { type: "ARRAY", items: { type: "STRING" } },
    tones: { type: "ARRAY", items: { type: "STRING" } },
    ratings: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          aspect: { type: "STRING" },
          value: { type: "INTEGER" },
        },
        required: ["aspect", "value"],
      },
    },
  },
  required: ["summary", "setting", "characters", "themes", "tones", "ratings"],
};

function prompt(
  title: string,
  author: string,
  source: string,
  aspects: AspectDoc[],
) {
  return `You are writing a first-impression card for a book recommendation app.

Book: "${title}" by ${author}
Source notes (from Open Library, may be thin or empty): ${source}

Write, without spoilers past the first act:
- summary: 2 to 3 sentences on the premise and what makes the book distinctive.
- setting: a short phrase for where and when it takes place.
- characters: the 2 to 4 most important characters. role is MAIN or SUPPORTING. minAge and maxAge
  are the character's age range over the book, in years (equal if it doesn't change).
- themes: 3 short lowercase phrases.
- tones: 2 short lowercase words or phrases.
- ratings: a whole number from 0 to 10 for EVERY aspect below, using the aspect's exact name.
  Each aspect is a scale between two ends, described below; rate where the book falls on it.

Aspects:
${aspects.map((a) => `- ${a.name}: ${a.description}`).join("\n")}

Use your own knowledge of the book where the notes are thin. If you don't recognize the book,
base everything on the notes rather than inventing a different book.`;
}

// Rating a book on the aspects alone, for rerating a book that's already drafted.
const RATINGS_SCHEMA = {
  type: "OBJECT",
  properties: { ratings: SCHEMA.properties.ratings },
  required: ["ratings"],
};

function ratingsPrompt(title: string, author: string, source: string, aspects: AspectDoc[]) {
  return `You are rating a book for a book recommendation app.

Book: "${title}" by ${author}
Source notes (from Open Library, may be thin or empty): ${source}

For EVERY aspect below, give a whole number from 0 to 10 for where the book falls on that
aspect's scale, using the aspect's exact name. Use your own knowledge of the book where the
notes are thin.

Aspects:
${aspects.map((a) => `- ${a.name}: ${a.description}`).join("\n")}`;
}

// Keeps the valid ratings, and says nothing unless every aspect has one.
function ratingsFor(answer: Pick<Answer, "ratings">, aspects: AspectDoc[]) {
  const value = new Map(
    (answer.ratings ?? [])
      .filter((r) => Number.isInteger(r.value) && r.value >= 0 && r.value <= 10)
      .map((r) => [r.aspect?.trim(), r.value]),
  );
  if (aspects.some((a) => !value.has(a.name))) return undefined;
  return aspects.map((a) => ({ aspect: a._id, value: value.get(a.name)! }));
}

async function ask<T = Answer>(text: string, schema: object = SCHEMA): Promise<T> {
  const key = process.env.GOOGLE_GEMINI_API;
  if (!key) throw new Error("GOOGLE_GEMINI_API is not set.");
  let model = MODEL;
  for (let attempt = 1; ; attempt++) {
    const wait = nextCallAt - Date.now();
    if (wait > 0) await Bun.sleep(wait);
    nextCallAt = Date.now() + MIN_INTERVAL_MS;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: schema,
            temperature: 0.4,
          },
        }),
      },
    );
    if (response.ok) {
      const data = (await response.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!reply) throw new Error("Gemini gave an empty answer.");
      return JSON.parse(reply) as T;
    }
    // Rate limits and overloads are worth waiting out; anything else isn't.
    if (attempt === 4 || ![429, 500, 503].includes(response.status))
      throw new Error(
        `Gemini answered ${response.status}: ${await response.text()}`,
      );
    if (response.status === 503) {
      model = FALLBACK_MODEL;
      continue;
    }
    // A long retry delay means a daily quota ran out; waiting would stall the whole batch.
    const body = await response.text();
    const delay = Number(/"retryDelay":\s*"(\d+)s"/.exec(body)?.[1] ?? 0);
    if (delay > 60)
      throw new Error(`Gemini quota exhausted, retry in ${delay}s.`);
    await Bun.sleep(Math.max(delay * 1000, attempt * 15_000));
  }
}

const clean = (list: string[]) =>
  [...new Set(list.map((s) => s.trim().toLowerCase()).filter(Boolean))].slice(
    0,
    5,
  );

// Keeps only the valid parts of an answer, and says nothing if a required part is left empty.
function complete(answer: Answer, aspects: AspectDoc[]) {
  const characters = (answer.characters ?? []).filter(
    (ch) =>
      ch.name?.trim() &&
      (ch.role === "MAIN" || ch.role === "SUPPORTING") &&
      Number.isInteger(ch.minAge) &&
      Number.isInteger(ch.maxAge) &&
      ch.minAge >= 0 &&
      ch.minAge <= ch.maxAge,
  );
  const ratings = ratingsFor(answer, aspects);
  const themes = clean(answer.themes ?? []);
  const tones = clean(answer.tones ?? []);
  const summary = answer.summary?.trim();
  if (
    !summary ||
    characters.length === 0 ||
    themes.length === 0 ||
    tones.length === 0 ||
    !ratings
  )
    return undefined;
  return {
    summary,
    setting: answer.setting?.trim() || undefined,
    characters,
    themes,
    tones,
    ratings,
  };
}

export class DraftingConcept {
  private readonly c: Collections;

  constructor(db: Db) {
    this.c = {
      aspects: db.collection<AspectDoc>("drafting.aspects"),
      drafts: db.collection<DraftDoc>("drafting.drafts"),
      figures: db.collection<FigureDoc>("drafting.figures"),
      ratings: db.collection<RatingDoc>("drafting.ratings"),
    };
  }

  async defineAspect({
    name,
    description,
  }: {
    name: string;
    description: string;
  }) {
    await ensureIndexes(this.c);
    const aspect = crypto.randomUUID();
    try {
      await this.c.aspects.insertOne({ _id: aspect, name, description });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000)
        throw new AspectExists("An aspect with that name already exists.");
      throw error;
    }
    return { aspect };
  }

  async draft({
    item,
    title,
    author,
    source,
  }: {
    item: string;
    title: string;
    author: string;
    source: string;
  }) {
    await ensureIndexes(this.c);
    if (await this.c.drafts.findOne({ item }))
      throw new AlreadyDrafted("That item already has a draft.");
    const aspects = await this.c.aspects.find().sort({ name: 1 }).toArray();
    if (aspects.length === 0)
      throw new NoAspects("Define at least one aspect before drafting.");

    let result: ReturnType<typeof complete>;
    try {
      result = complete(
        await ask(prompt(title, author, source, aspects)),
        aspects,
      );
    } catch (error) {
      console.warn(`Drafting ${title} failed:`, (error as Error).message);
    }
    if (!result)
      throw new DraftFailed("The agent couldn't produce a complete draft.");

    const draft = crypto.randomUUID();
    await this.c.drafts.insertOne({
      _id: draft,
      item,
      summary: result.summary,
      ...(result.setting ? { setting: result.setting } : {}),
      themes: result.themes,
      tones: result.tones,
    });
    await this.c.figures.insertMany(
      result.characters.map((ch) => ({
        _id: crypto.randomUUID(),
        draft,
        name: ch.name.trim(),
        role: ch.role,
        minAge: ch.minAge,
        maxAge: ch.maxAge,
      })),
    );
    await this.c.ratings.insertMany(
      result.ratings.map(({ aspect, value }) => ({
        _id: crypto.randomUUID(),
        draft,
        aspect,
        value,
      })),
    );
    return { draft };
  }

  async rerate({
    item,
    title,
    author,
    source,
  }: {
    item: string;
    title: string;
    author: string;
    source: string;
  }) {
    const d = await this.c.drafts.findOne({ item });
    if (!d) throw new NoDraft("That item has no draft.");
    const aspects = await this.c.aspects.find().sort({ name: 1 }).toArray();
    let ratings: ReturnType<typeof ratingsFor>;
    try {
      ratings = ratingsFor(
        await ask<Pick<Answer, "ratings">>(ratingsPrompt(title, author, source, aspects), RATINGS_SCHEMA),
        aspects,
      );
    } catch (error) {
      console.warn(`Rerating ${title} failed:`, (error as Error).message);
    }
    if (!ratings) throw new DraftFailed("The agent couldn't rate every aspect.");
    await this.c.ratings.deleteMany({ draft: d._id });
    await this.c.ratings.insertMany(
      ratings.map(({ aspect, value }) => ({ _id: crypto.randomUUID(), draft: d._id, aspect, value })),
    );
    return { draft: d._id };
  }

  async removeAspect({ name }: { name: string }) {
    const aspect = await this.c.aspects.findOne({ name });
    if (!aspect) throw new NoSuchAspect("There is no aspect with that name.");
    await this.c.ratings.deleteMany({ aspect: aspect._id });
    await this.c.aspects.deleteOne({ _id: aspect._id });
    return { name };
  }

  async discard({ item }: { item: string }) {
    const d = await this.c.drafts.findOne({ item });
    if (!d) throw new NoDraft("That item has no draft.");
    await Promise.all([
      this.c.figures.deleteMany({ draft: d._id }),
      this.c.ratings.deleteMany({ draft: d._id }),
      this.c.drafts.deleteOne({ _id: d._id }),
    ]);
    return { item };
  }

  async _draft({ item }: { item: string }) {
    const d = await this.c.drafts.findOne({ item });
    return d
      ? [{ draft: d._id, summary: d.summary, setting: d.setting ?? "" }]
      : [];
  }

  async _figures({ draft }: { draft: string }) {
    const rows = await this.c.figures
      .find({ draft })
      .sort({ role: 1, name: 1 })
      .toArray();
    return rows.map(({ name, role, minAge, maxAge }) => ({
      name,
      role,
      minAge,
      maxAge,
    }));
  }

  async _themes({ draft }: { draft: string }) {
    const d = await this.c.drafts.findOne({ _id: draft });
    return (d?.themes ?? []).toSorted().map((theme) => ({ theme }));
  }

  async _tones({ draft }: { draft: string }) {
    const d = await this.c.drafts.findOne({ _id: draft });
    return (d?.tones ?? []).toSorted().map((tone) => ({ tone }));
  }

  async _ratings({ draft }: { draft: string }) {
    const [ratings, aspects] = await Promise.all([
      this.c.ratings.find({ draft }).toArray(),
      this.c.aspects.find().toArray(),
    ]);
    const name = new Map(aspects.map((a) => [a._id, a.name]));
    return ratings
      .map(({ aspect, value }) => ({ aspectName: name.get(aspect) ?? "", value }))
      .filter((r) => r.aspectName)
      .sort((a, b) => a.aspectName.localeCompare(b.aspectName));
  }
}
