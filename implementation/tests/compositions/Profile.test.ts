import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { seedCatalog, signUp, startApp, type Client } from "../app.ts";
import { isbn, resetDb } from "../helpers.ts";

let app: ReturnType<typeof startApp>;
let client: Client;
let criteria: Record<string, string>;
let books: Record<string, string>;

const ranking = async (session: string) => {
  const result = await client.feed.ranked({ session });
  if ("error" in result) throw new Error(result.error);
  return result.ranking.items.map((r) => r.item);
};

beforeAll(async () => {
  await resetDb();
  // Scores are pace (slow burn to page-turner), tone (light to dark), humor (serious to funny).
  ({ criteria, books } = await seedCatalog([
    { title: "Brave New World", isbn: isbn(1), genre: "science fiction", scores: [5, 7, 4] },
    { title: "The Hobbit", isbn: isbn(2), genre: "fantasy", scores: [6, 3, 6] },
    { title: "The Remains of the Day", isbn: isbn(3), genre: "literary fiction", scores: [1, 4, 3] },
  ]));
  app = startApp();
  client = app.client;
});
afterAll(() => app.stop());

describe("Profile", () => {
  test("a new reader sees every criterion with both ends of its scale, and no preferences", async () => {
    const session = await signUp(client, "jane");
    const profile = await client.profile.view({ session });
    if ("error" in profile) throw new Error(profile.error);
    expect(profile.criteria.criteria.map(({ name, low, high }) => [name, low, high])).toEqual([
      ["humor", "serious", "funny"],
      ["pace", "slow burn", "page-turner"],
      ["tone", "light and cozy", "dark and intense"],
    ]);
    expect(profile.preferences.preferences).toEqual([]);
  });

  test("a preference saves where the reader likes a criterion and how much it matters", async () => {
    const session = await signUp(client, "omar");
    expect(
      await client.profile.weigh({ session, criterion: criteria.pace!, target: 1, importance: 5 }),
    ).toEqual({ criterion: criteria.pace!, target: 1, importance: 5 });
    const profile = await client.profile.view({ session });
    if ("error" in profile) throw new Error(profile.error);
    expect(profile.preferences.preferences).toEqual([
      { criterion: criteria.pace!, target: 1, importance: 5 },
    ]);
  });

  test("a slow-burn reader and a page-turner reader get opposite feeds", async () => {
    const slow = await signUp(client, "pia");
    const fast = await signUp(client, "quinn");
    await client.profile.weigh({ session: slow, criterion: criteria.pace!, target: 0, importance: 5 });
    await client.profile.weigh({ session: fast, criterion: criteria.pace!, target: 10, importance: 5 });
    expect((await ranking(slow))[0]).toBe(books["The Remains of the Day"]!);
    expect((await ranking(fast))[0]).toBe(books["The Hobbit"]!);
  });

  test("an importance of 0 stops a criterion from steering the feed", async () => {
    const session = await signUp(client, "ravi");
    await client.profile.weigh({ session, criterion: criteria.tone!, target: 10, importance: 5 });
    expect((await ranking(session))[0]).toBe(books["Brave New World"]!);
    await client.profile.weigh({ session, criterion: criteria.tone!, target: 10, importance: 0 });
    await client.profile.weigh({ session, criterion: criteria.humor!, target: 10, importance: 5 });
    expect((await ranking(session))[0]).toBe(books["The Hobbit"]!);
  });

  test("positions outside 0 to 10 and importance outside 0 to 5 are refused", async () => {
    const session = await signUp(client, "sam");
    for (const [target, importance] of [[11, 3], [-1, 3], [5, 6], [5, -1]])
      expect(
        await client.profile.weigh({ session, criterion: criteria.pace!, target: target!, importance: importance! }),
      ).toEqual({ error: "INVALID_REQUEST" });
  });
});
