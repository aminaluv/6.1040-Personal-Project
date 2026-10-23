import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  BatchFull,
  BatchNotRunning,
  BatchRunning,
  HarvestingConcept,
  InvalidSize,
  SourceUnavailable,
  TopicExhausted,
} from "../../src/concepts/Harvesting.ts";
import { db, fakeWeb, isbn, resetDb } from "../helpers.ts";

let harvesting: HarvestingConcept;
let web: ReturnType<typeof fakeWeb>;
const now = new Date("2026-10-01T12:00:00Z");

// Seven works, two of which aren't usable: one has no cover, one only a non-English ISBN.
const scienceFiction = [
  { title: "Dune", isbn: isbn(1) },
  { title: "No Cover", isbn: isbn(2), cover: false },
  { title: "Foundation", isbn: isbn(3) },
  { title: "Solaris (French edition)", isbn: "9782070000000" },
  { title: "Hyperion", isbn: isbn(5) },
  { title: "Neuromancer", isbn: isbn(6) },
  { title: "Ubik", isbn: isbn(7) },
];

beforeEach(async () => {
  await resetDb();
  harvesting = new HarvestingConcept(db);
  web = fakeWeb({ topics: { "science fiction": scienceFiction } });
});
afterEach(() => web.restore());

describe("Harvesting", () => {
  test("principle: each harvest brings the next usable works and never repeats one", async () => {
    const { batch } = await harvesting.start({ size: 20, now });
    await harvesting.harvest({ batch, topic: "science fiction", count: 2 });
    expect((await harvesting._finds({ batch, topic: "science fiction" })).map((f) => f.title)).toEqual(
      ["Dune", "Foundation"],
    );
    await harvesting.finish({ batch });

    const next = await harvesting.start({ size: 20, now });
    await harvesting.harvest({ batch: next.batch, topic: "science fiction", count: 2 });
    expect(
      (await harvesting._finds({ batch: next.batch, topic: "science fiction" })).map((f) => f.title),
    ).toEqual(["Hyperion", "Neuromancer"]);
  });

  test("a find keeps its source notes and English ISBN as its key", async () => {
    const { batch } = await harvesting.start({ size: 20, now });
    await harvesting.harvest({ batch, topic: "science fiction", count: 1 });
    const [find] = await harvesting._find({ key: isbn(1) });
    expect(find).toMatchObject({ topic: "science fiction", title: "Dune", author: "A. Writer" });
    expect(JSON.parse(find!.source).description).toBe("A description from Open Library.");
    expect(await harvesting._find({ key: isbn(2) })).toEqual([]);
  });

  test("a topic is exhausted once the source runs out, and further harvests are refused", async () => {
    const { batch } = await harvesting.start({ size: 20, now });
    await harvesting.harvest({ batch, topic: "science fiction", count: 10 });
    expect(await harvesting._finds({ batch, topic: "science fiction" })).toHaveLength(5);
    await expect(
      harvesting.harvest({ batch, topic: "science fiction", count: 1 }),
    ).rejects.toThrow(TopicExhausted);
  });

  test("a batch never holds more finds than its size", async () => {
    const { batch } = await harvesting.start({ size: 3, now });
    await harvesting.harvest({ batch, topic: "science fiction", count: 5 });
    expect(await harvesting._finds({ batch, topic: "science fiction" })).toHaveLength(3);
    await expect(harvesting.harvest({ batch, topic: "science fiction", count: 1 })).rejects.toThrow(
      BatchFull,
    );
  });

  test("only one batch runs at a time, unless the running one is over 30 minutes old", async () => {
    await expect(harvesting.start({ size: 0, now })).rejects.toThrow(InvalidSize);
    await harvesting.start({ size: 20, now });
    await expect(
      harvesting.start({ size: 20, now: new Date(now.getTime() + 10 * 60_000) }),
    ).rejects.toThrow(BatchRunning);
    await harvesting.start({ size: 20, now: new Date(now.getTime() + 31 * 60_000) });
  });

  test("a finished batch can't be harvested or finished again", async () => {
    const { batch } = await harvesting.start({ size: 20, now });
    await harvesting.finish({ batch });
    await expect(harvesting.finish({ batch })).rejects.toThrow(BatchNotRunning);
    await expect(harvesting.harvest({ batch, topic: "science fiction", count: 1 })).rejects.toThrow(
      BatchNotRunning,
    );
  });

  test("refuses when the source can't be reached", async () => {
    web.restore();
    web = fakeWeb({ openLibraryStatus: 503 });
    const { batch } = await harvesting.start({ size: 20, now });
    await expect(harvesting.harvest({ batch, topic: "science fiction", count: 1 })).rejects.toThrow(
      SourceUnavailable,
    );
  }, 10_000);
});
