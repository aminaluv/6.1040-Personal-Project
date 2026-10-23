import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { seedCatalog, signUp, startApp, type Client } from "../app.ts";
import { isbn, resetDb } from "../helpers.ts";

let app: ReturnType<typeof startApp>;
let client: Client;
let books: Record<string, string>;

const ranking = async (session: string) => {
  const result = await client.feed.ranked({ session });
  if ("error" in result) throw new Error(result.error);
  return result.ranking.items.map((r) => r.item);
};

beforeAll(async () => {
  await resetDb();
  // Scores are pacing, social-commentary, whimsy.
  ({ books } = await seedCatalog([
    { title: "Brave New World", isbn: isbn(1), genre: "science fiction", scores: [2, 10, 1] },
    { title: "Fahrenheit 451", isbn: isbn(2), genre: "science fiction", scores: [5, 9, 1] },
    { title: "The Hobbit", isbn: isbn(3), genre: "fantasy", scores: [7, 2, 9] },
  ]));
  app = startApp();
  client = app.client;
});
afterAll(() => app.stop());

describe("Feed", () => {
  test("liking a book records it, shelves it in Up Next, and steers the ranking", async () => {
    const session = await signUp(client, "jane");
    expect(await client.feed.like({ session, item: books["Brave New World"]! })).toEqual({
      item: books["Brave New World"],
    });
    const history = await client.feed.history({ session });
    expect(history).toEqual({
      history: { swipes: [{ item: books["Brave New World"]!, direction: "RIGHT" }] },
    });
    expect(await client.shelves.view({ session, shelf: "UP_NEXT" })).toEqual({
      shelf: { items: [{ item: books["Brave New World"]! }] },
    });
    const ranked = await ranking(session);
    expect(ranked.indexOf(books["Fahrenheit 451"]!)).toBeLessThan(
      ranked.indexOf(books["The Hobbit"]!),
    );
  });

  test("passing records the swipe without shelving, and steers away", async () => {
    const session = await signUp(client, "omar");
    await client.feed.pass({ session, item: books["Brave New World"]! });
    expect(await client.shelves.view({ session, shelf: "UP_NEXT" })).toEqual({
      shelf: { items: [] },
    });
    expect((await ranking(session))[0]).toBe(books["The Hobbit"]!);
  });

  test("a book can't be swiped twice until it's reconsidered", async () => {
    const session = await signUp(client, "pia");
    const item = books["The Hobbit"]!;
    await client.feed.pass({ session, item });
    expect(await client.feed.like({ session, item })).toEqual({ error: "CONFLICT" });
    expect(await client.feed.reconsider({ session, item })).toEqual({ item });
    expect(await client.feed.like({ session, item })).toEqual({ item });
  });

  test("each reader's swipes and shelves are their own", async () => {
    const quinn = await signUp(client, "quinn");
    const ravi = await signUp(client, "ravi");
    await client.feed.like({ session: quinn, item: books["The Hobbit"]! });
    expect(await client.feed.history({ session: ravi })).toEqual({ history: { swipes: [] } });
    expect(await client.shelves.view({ session: ravi, shelf: "UP_NEXT" })).toEqual({
      shelf: { items: [] },
    });
  });

  test("shelves move books from Up Next to Favorites", async () => {
    const session = await signUp(client, "sam");
    const item = books["Fahrenheit 451"]!;
    await client.feed.like({ session, item });
    await client.shelves.add({ session, item, shelf: "FAVORITES" });
    await client.shelves.remove({ session, item, shelf: "UP_NEXT" });
    expect(await client.shelves.view({ session, shelf: "FAVORITES" })).toEqual({
      shelf: { items: [{ item }] },
    });
    expect(await client.shelves.remove({ session, item, shelf: "UP_NEXT" })).toEqual({
      error: "NOT_FOUND",
    });
  });

  test("the catalog lists described books and opens a complete card", async () => {
    const list = await client.catalog.list({});
    if ("error" in list) throw new Error(list.error);
    expect(list.catalog.books.map((b) => b.title)).toEqual([
      "Brave New World",
      "Fahrenheit 451",
      "The Hobbit",
    ]);
    const card = await client.catalog.card({ book: books["The Hobbit"]! });
    if ("error" in card) throw new Error(card.error);
    expect(card.card.details[0]?.title).toBe("The Hobbit");
    expect(card.card.scores).toHaveLength(3);
    expect(card.card.characters).toHaveLength(1);
  });
});
