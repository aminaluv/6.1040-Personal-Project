import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { BookCatalogingConcept } from "../../src/concepts/BookCataloging.ts";
import { seedCatalog, signUp, startApp, type Client } from "../app.ts";
import { completeAnswer, db, eventually, fakeWeb, isbn, resetDb } from "../helpers.ts";

let app: ReturnType<typeof startApp>;
let client: Client;
let books: Record<string, string>;
let web: ReturnType<typeof fakeWeb> | undefined;

const catalog = () => new BookCatalogingConcept(db);
const batches = () => db.collection("harvesting.batches");
const noBatchRunning = async () => (await batches().countDocuments({ status: "RUNNING" })) === 0;

// Open Library's science fiction, best rated first. "No Cover" isn't usable.
const scienceFiction = [
  { title: "Dune", isbn: isbn(101) },
  { title: "No Cover", isbn: isbn(102), cover: false },
  { title: "Foundation", isbn: isbn(103) },
  { title: "Hyperion", isbn: isbn(104) },
  { title: "Neuromancer", isbn: isbn(105) },
  { title: "Ubik", isbn: isbn(106) },
  { title: "Solaris", isbn: isbn(107) },
  { title: "Kindred", isbn: isbn(108) },
];

beforeAll(async () => {
  await resetDb();
  ({ books } = await seedCatalog([
    { title: "Brave New World", isbn: isbn(1), genre: "science fiction", scores: [2, 10, 1] },
    { title: "The Hobbit", isbn: isbn(2), genre: "fantasy", scores: [7, 2, 9] },
  ]));
  app = startApp();
  client = app.client;
});
afterEach(() => web?.restore());
afterAll(() => app.stop());

describe("Growing", () => {
  test(
    "a batch harvests the liked genre and adds complete, ranked books",
    async () => {
      web = fakeWeb({ topics: { "science fiction": scienceFiction } });
      const session = await signUp(client, "jane");
      await client.feed.like({ session, item: books["Brave New World"]! });

      const answer = await client.catalog.grow({ session });
      expect(answer).toHaveProperty("batch");
      await eventually(noBatchRunning);

      // 5 per liked genre: the first five usable science fiction works.
      const described = (await catalog()._described({})).map((b) => b.title);
      expect(described).toEqual([
        "Brave New World",
        "Dune",
        "Foundation",
        "Hyperion",
        "Neuromancer",
        "The Hobbit",
        "Ubik",
      ]);
      expect(await catalog()._pending({})).toEqual([]);

      const dune = (await catalog()._described({})).find((b) => b.title === "Dune")!.book;
      expect(await catalog()._genres({ book: dune })).toEqual([{ genre: "science fiction" }]);
      expect(await catalog()._characters({ book: dune })).toHaveLength(1);
      expect(await catalog()._themes({ book: dune })).toEqual([
        { theme: "courage" },
        { theme: "home" },
      ]);
      expect(await catalog()._scores({ book: dune })).toHaveLength(3);

      const ranked = await client.feed.ranked({ session });
      if ("error" in ranked) throw new Error(ranked.error);
      expect(ranked.ranking.items.map((r) => r.item)).toContain(dune);
    },
    30_000,
  );

  test(
    "a book whose draft failed stays hidden, and the next batch drafts it again",
    async () => {
      let failKindred = true;
      web = fakeWeb({
        topics: { "science fiction": scienceFiction },
        answer: (title, aspects) =>
          title === "Kindred" && failKindred
            ? { ...completeAnswer(title, aspects), ratings: [] }
            : completeAnswer(title, aspects),
      });
      const session = await signUp(client, "omar");
      await client.feed.like({ session, item: books["Brave New World"]! });

      await client.catalog.grow({ session });
      await eventually(noBatchRunning);
      expect((await catalog()._pending({})).map((b) => b.title)).toEqual(["Kindred"]);
      expect((await catalog()._described({})).map((b) => b.title)).not.toContain("Kindred");

      failKindred = false;
      await client.catalog.grow({ session });
      await eventually(noBatchRunning);
      expect(await catalog()._pending({})).toEqual([]);
      expect((await catalog()._described({})).map((b) => b.title)).toContain("Kindred");
    },
    30_000,
  );

  test("a second request while a batch is running is refused", async () => {
    web = fakeWeb();
    const session = await signUp(client, "pia");
    await batches().insertOne({
      _id: "running-batch" as never,
      size: 20,
      startedAt: new Date(),
      status: "RUNNING",
    });
    expect(await client.catalog.grow({ session })).toEqual({ error: "CONFLICT" });
    await batches().deleteOne({ _id: "running-batch" as never });
  });

  test("growing needs a signed-in reader", async () => {
    expect(await client.catalog.grow({ session: "invented-session" })).toEqual({
      error: "UNAUTHORIZED",
    });
  });
});
