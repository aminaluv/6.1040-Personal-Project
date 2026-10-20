import { MongoServerError, type Collection, type Db } from "mongodb";

export class CriterionExists extends Error {}
export class DuplicateIsbn extends Error {}
export class BookNotPending extends Error {}
export class BookNotDescribed extends Error {}
export class InvalidAgeRange extends Error {}
export class NoSuchCriterion extends Error {}
export class InvalidScore extends Error { }
export class NoSuchBook extends Error {}

type Status = "PENDING" | "DESCRIBED";
type Role = "MAIN" | "SUPPORTING";

interface CriterionDoc {
  _id: string;
  name: string;
  description: string;
}
interface BookDoc {
  _id: string;
  isbn: string;
  title: string;
  author: string;
  published: Date;
  pageCount: number;
  coverUrl: string;
  genres: string[];
  status: Status;
  summary?: string;
  setting?: string;
  themes: string[];
  tones: string[];
}
interface CharacterDoc {
  _id: string;
  book: string;
  name: string;
  role: Role;
  minAge: number;
  maxAge: number;
}
interface ScoreDoc {
  _id: string;
  book: string;
  criterion: string;
  value: number;
}

interface Collections {
  criteria: Collection<CriterionDoc>;
  books: Collection<BookDoc>;
  characters: Collection<CharacterDoc>;
  scores: Collection<ScoreDoc>;
}

const indexed = new WeakSet<Collections>();

async function ensureIndexes(c: Collections) {
  if (indexed.has(c)) return;
  await Promise.all([
    c.criteria.createIndex({ name: 1 }, { unique: true }),
    c.books.createIndex({ isbn: 1 }, { unique: true }),
    c.characters.createIndex({ book: 1 }),
    c.scores.createIndex({ book: 1, criterion: 1 }, { unique: true }),
  ]);
  indexed.add(c);
}

function isDuplicateKey(error: unknown) {
  return error instanceof MongoServerError && error.code === 11000;
}

export class BookCatalogingConcept {
  private readonly c: Collections;

  constructor(db: Db) {
    this.c = {
      criteria: db.collection<CriterionDoc>("bookCataloging.criteria"),
      books: db.collection<BookDoc>("bookCataloging.books"),
      characters: db.collection<CharacterDoc>("bookCataloging.characters"),
      scores: db.collection<ScoreDoc>("bookCataloging.scores"),
    };
  }

  async defineCriterion({
    name,
    description,
  }: {
    name: string;
    description: string;
  }) {
    await ensureIndexes(this.c);
    const criterion = crypto.randomUUID();
    try {
      await this.c.criteria.insertOne({ _id: criterion, name, description });
    } catch (error) {
      if (isDuplicateKey(error))
        throw new CriterionExists("A criterion with that name already exists.");
      throw error;
    }
    return { criterion };
  }

  async addBook(input: {
    isbn: string;
    title: string;
    author: string;
    published: Date;
    pageCount: number;
    coverUrl: string;
  }) {
    await ensureIndexes(this.c);
    const book = crypto.randomUUID();
    try {
      await this.c.books.insertOne({
        _id: book,
        ...input,
        published: new Date(input.published),
        genres: [],
        status: "PENDING",
        themes: [],
        tones: [],
      });
    } catch (error) {
      if (isDuplicateKey(error))
        throw new DuplicateIsbn(
          "A book with that ISBN is already in the catalog.",
        );
      throw error;
    }
    return { book };
  }

  async addGenre({ book, genre }: { book: string; genre: string }) {
    const result = await this.c.books.updateOne(
      { _id: book },
      { $addToSet: { genres: genre } },
    );
    if (result.matchedCount === 0)
      throw new NoSuchBook("There is no such book.");
    return { book };
  }

  async addTheme({ book, theme }: { book: string; theme: string }) {
    const result = await this.c.books.updateOne(
      { _id: book, status: "PENDING" },
      { $addToSet: { themes: theme } },
    );
    if (result.matchedCount === 0)
      throw new BookNotPending(
        "Themes can only be added before a book is described.",
      );
    return { book };
  }

  async addTone({ book, tone }: { book: string; tone: string }) {
    const result = await this.c.books.updateOne(
      { _id: book, status: "PENDING" },
      { $addToSet: { tones: tone } },
    );
    if (result.matchedCount === 0)
      throw new BookNotPending(
        "Tones can only be added before a book is described.",
      );
    return { book };
  }

  async describe({
    book,
    summary,
    setting,
  }: {
    book: string;
    summary: string;
    setting?: string;
  }) {
    const update =
      setting === undefined
        ? {
            $set: { summary, status: "DESCRIBED" as const },
            $unset: { setting: "" as const },
          }
        : { $set: { summary, setting, status: "DESCRIBED" as const } };
    const result = await this.c.books.updateOne(
      { _id: book, status: "PENDING" },
      update,
    );
    if (result.matchedCount === 0) {
      throw new BookNotPending(
        "Only a book that hasn't been described yet can be described.",
      );
    }
    return { book };
  }

  async addCharacter({
    book,
    name,
    role,
    minAge,
    maxAge,
  }: {
    book: string;
    name: string;
    role: Role;
    minAge: number;
    maxAge: number;
  }) {
    await ensureIndexes(this.c);
    if (!(await this.c.books.findOne({ _id: book, status: "PENDING" }))) {
      throw new BookNotPending(
        "Characters can only be added before a book is described.",
      );
    }
    if (minAge > maxAge)
      throw new InvalidAgeRange(
        "The minimum age must not exceed the maximum age.",
      );
    const character = crypto.randomUUID();
    await this.c.characters.insertOne({
      _id: character,
      book,
      name,
      role,
      minAge,
      maxAge,
    });
    return { character };
  }

  async scoreBook({
    book,
    criterion,
    value,
  }: {
    book: string;
    criterion: string;
    value: number;
  }) {
    await ensureIndexes(this.c);
    if (!(await this.c.books.findOne({ _id: book, status: "DESCRIBED" }))) {
      throw new BookNotDescribed("Only a described book can be scored.");
    }
    if (!(await this.c.criteria.findOne({ _id: criterion })))
      throw new NoSuchCriterion("There is no such criterion.");
    if (!(value >= 0 && value <= 10))
      throw new InvalidScore("A score must be between 0 and 10.");
    await this.c.scores.updateOne(
      { book, criterion },
      { $set: { value }, $setOnInsert: { _id: crypto.randomUUID() } },
      { upsert: true },
    );
    return { book };
  }

  async resetDescription({ book }: { book: string }) {
    const result = await this.c.books.updateOne(
      { _id: book, status: "DESCRIBED" },
      {
        $set: { status: "PENDING", themes: [], tones: [] },
        $unset: { summary: "", setting: "" },
      },
    );
    if (result.matchedCount === 0)
      throw new BookNotDescribed("Only a described book can be reset.");
    await this.c.characters.deleteMany({ book });
    await this.c.scores.deleteMany({ book });
    return { book };
  }

  async _described(_input: Record<string, never>) {
    const rows = await this.c.books
      .find({ status: "DESCRIBED" })
      .sort({ title: 1 })
      .toArray();
    return rows.map(({ _id, title, author, coverUrl }) => ({
      book: _id,
      title,
      author,
      coverUrl,
    }));
  }

  async _book({ book }: { book: string }) {
    const b = await this.c.books.findOne({ _id: book });
    if (!b) return [];
    const { title, author, published, pageCount, coverUrl } = b;
    return [
      {
        title,
        author,
        published,
        pageCount,
        coverUrl,
        summary: b.summary ?? "",
        setting: b.setting ?? "",
      },
    ];
  }

  async _genres({ book }: { book: string }) {
    const b = await this.c.books.findOne({ _id: book });
    return (b?.genres ?? []).toSorted().map((genre) => ({ genre }));
  }

  async _themes({ book }: { book: string }) {
    const b = await this.c.books.findOne({ _id: book });
    return (b?.themes ?? []).toSorted().map((theme) => ({ theme }));
  }

  async _tones({ book }: { book: string }) {
    const b = await this.c.books.findOne({ _id: book });
    return (b?.tones ?? []).toSorted().map((tone) => ({ tone }));
  }

  async _characters({ book }: { book: string }) {
    const rows = await this.c.characters
      .find({ book })
      .sort({ role: 1, name: 1 })
      .toArray();
    return rows.map(({ name, role, minAge, maxAge }) => ({
      name,
      role,
      minAge,
      maxAge,
    }));
  }

  async _scores({ book }: { book: string }) {
    const scores = await this.c.scores.find({ book }).toArray();
    const criteria = await this.c.criteria
      .find({ _id: { $in: scores.map((s) => s.criterion) } })
      .toArray();
    const names = new Map(criteria.map((c) => [c._id, c.name]));
    return scores
      .map(({ criterion, value }) => ({
        criterion,
        criterionName: names.get(criterion) ?? "",
        value,
      }))
      .sort((a, b) => a.criterionName.localeCompare(b.criterionName));
  }

  async _criterionByName({ name }: { name: string }) {
    const c = await this.c.criteria.findOne({ name });
    return c ? [{ criterion: c._id }] : [];
  }
}
