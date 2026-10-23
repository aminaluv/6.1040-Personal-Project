import { type Collection, type Db } from "mongodb";

export class InvalidSize extends Error {}
export class BatchRunning extends Error {}
export class BatchNotRunning extends Error {}
export class TopicExhausted extends Error {}
export class BatchFull extends Error {}
export class SourceUnavailable extends Error {}

type BatchStatus = "RUNNING" | "FINISHED";

interface TopicDoc {
  _id: string;
  name: string;
  position: number;
  exhausted: boolean;
}
interface BatchDoc {
  _id: string;
  size: number;
  startedAt: Date;
  status: BatchStatus;
}
interface FindDoc {
  _id: string;
  batch: string;
  topic: string;
  order: number;
  key: string;
  title: string;
  author: string;
  published: Date;
  pageCount: number;
  coverUrl: string;
  source: string;
}
interface Collections {
  topics: Collection<TopicDoc>;
  batches: Collection<BatchDoc>;
  finds: Collection<FindDoc>;
}

const STALE_MS = 30 * 60 * 1000; // a RUNNING batch older than this no longer blocks start
const PAGE = 25; // works asked of the source per harvest
const HEADERS = { "User-Agent": "Novelty (6.1040 student project)" };

const indexed = new WeakSet<Collections>();

async function ensureIndexes(c: Collections) {
  if (indexed.has(c)) return;
  await Promise.all([
    c.topics.createIndex({ name: 1 }, { unique: true }),
    c.finds.createIndex({ key: 1 }, { unique: true }),
    c.finds.createIndex({ batch: 1, topic: 1, order: 1 }),
  ]);
  indexed.add(c);
}

// The source: Open Library's search, one subject at a time, most highly rated first.
interface SourceWork {
  key: string;
  title: string;
  author_name?: string[];
  isbn?: string[];
  cover_i?: number;
  first_publish_year?: number;
  number_of_pages_median?: number;
  subject?: string[];
}

async function getJson<T>(url: URL | string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { headers: HEADERS });
      if (response.ok) return (await response.json()) as T;
      if (attempt === 3 || response.status < 500)
        throw new Error(`Open Library answered ${response.status}`);
    } catch (error) {
      if (attempt === 3) throw error;
    }
    await Bun.sleep(attempt * 1000);
  }
}

async function listWorks(topic: string, offset: number) {
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("q", `subject:"${topic}" language:eng`);
  url.searchParams.set(
    "fields",
    "key,title,author_name,isbn,cover_i,first_publish_year,number_of_pages_median,subject",
  );
  url.searchParams.set("sort", "rating");
  url.searchParams.set("limit", String(PAGE));
  url.searchParams.set("offset", String(offset));
  const { docs } = await getJson<{ docs: SourceWork[] }>(url);
  return docs;
}

// English-language ISBN-13s start 9780 or 9781; a work without one, or without a cover, isn't usable.
const englishIsbn = (isbns: string[] = []) =>
  isbns.find((i) => /^978[01]\d{9}$/.test(i));

async function describeWork(work: SourceWork) {
  const data = await getJson<{ description?: string | { value: string } }>(
    `https://openlibrary.org${work.key}.json`,
  ).catch(() => ({ description: undefined }));
  const description =
    typeof data.description === "string"
      ? data.description
      : data.description?.value;
  return JSON.stringify({
    description: description ?? null,
    firstPublished: work.first_publish_year ?? null,
    subjects: (work.subject ?? []).slice(0, 15),
  });
}

export class HarvestingConcept {
  private readonly c: Collections;

  constructor(db: Db) {
    this.c = {
      topics: db.collection<TopicDoc>("harvesting.topics"),
      batches: db.collection<BatchDoc>("harvesting.batches"),
      finds: db.collection<FindDoc>("harvesting.finds"),
    };
  }

  async start({ size, now }: { size: number; now: Date }) {
    if (!(size >= 1))
      throw new InvalidSize("A batch must have room for at least one find.");
    const running = await this.c.batches.findOne({
      status: "RUNNING",
      startedAt: { $gt: new Date(now.getTime() - STALE_MS) },
    });
    if (running) throw new BatchRunning("A batch is already running.");
    const batch = crypto.randomUUID();
    await this.c.batches.insertOne({
      _id: batch,
      size,
      startedAt: now,
      status: "RUNNING",
    });
    return { batch };
  }

  async harvest({
    batch,
    topic,
    count,
  }: {
    batch: string;
    topic: string;
    count: number;
  }) {
    await ensureIndexes(this.c);
    const b = await this.c.batches.findOne({ _id: batch, status: "RUNNING" });
    if (!b) throw new BatchNotRunning("That batch is not running.");
    const t = await this.c.topics.findOne({ name: topic });
    if (t?.exhausted)
      throw new TopicExhausted("The source has nothing more on that topic.");
    let room = b.size - (await this.c.finds.countDocuments({ batch }));
    if (room <= 0) throw new BatchFull("That batch is already full.");

    const position = t?.position ?? 0;
    let works: SourceWork[];
    try {
      works = await listWorks(topic, position);
    } catch {
      throw new SourceUnavailable("The source could not be reached.");
    }

    let added = 0;
    let goneThrough = 0;
    for (const work of works) {
      if (added >= count || room <= 0) break;
      goneThrough++;
      const isbn = englishIsbn(work.isbn);
      if (!isbn || !work.cover_i || !work.author_name?.length) continue;
      if (await this.c.finds.findOne({ key: isbn })) continue;
      await this.c.finds.insertOne({
        _id: crypto.randomUUID(),
        batch,
        topic,
        order: position + goneThrough,
        key: isbn,
        title: work.title,
        author: work.author_name.join(", "),
        published: work.first_publish_year
          ? new Date(`${work.first_publish_year}-01-01`)
          : new Date(0),
        pageCount: work.number_of_pages_median ?? 0,
        coverUrl: `https://covers.openlibrary.org/b/id/${work.cover_i}-L.jpg`,
        source: await describeWork(work),
      });
      added++;
      room--;
    }

    await this.c.topics.updateOne(
      { name: topic },
      {
        $set: {
          position: position + goneThrough,
          exhausted: works.length < PAGE && goneThrough === works.length,
        },
        $setOnInsert: { _id: crypto.randomUUID() },
      },
      { upsert: true },
    );
    return { batch };
  }

  async finish({ batch }: { batch: string }) {
    const result = await this.c.batches.updateOne(
      { _id: batch, status: "RUNNING" },
      { $set: { status: "FINISHED" } },
    );
    if (result.matchedCount === 0)
      throw new BatchNotRunning("That batch is not running.");
    return { batch };
  }

  async _finds({ batch, topic }: { batch: string; topic: string }) {
    const rows = await this.c.finds
      .find({ batch, topic })
      .sort({ order: 1 })
      .toArray();
    return rows.map(
      ({ key, title, author, published, pageCount, coverUrl }) => ({
        key,
        title,
        author,
        published,
        pageCount,
        coverUrl,
      }),
    );
  }

  async _find({ key }: { key: string }) {
    const f = await this.c.finds.findOne({ key });
    return f
      ? [{ topic: f.topic, title: f.title, author: f.author, source: f.source }]
      : [];
  }
}
