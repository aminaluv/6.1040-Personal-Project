import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { seedCatalog, signUp, startApp, type Client } from "../app.ts";
import { isbn, resetDb } from "../helpers.ts";

let app: ReturnType<typeof startApp>;
let client: Client;
let criteria: Record<string, string>;
let books: Record<string, string>;

beforeAll(async () => {
  await resetDb();
  // Scores are pacing, social-commentary, whimsy.
  ({ criteria, books } = await seedCatalog([
    { title: "Brave New World", isbn: isbn(1), genre: "science fiction", scores: [2, 10, 1] },
    { title: "The Hobbit", isbn: isbn(2), genre: "fantasy", scores: [7, 2, 9] },
  ]));
  app = startApp();
  client = app.client;
});
afterAll(() => app.stop());

describe("Profile", () => {
  test("a new reader sees every criterion and no weights yet", async () => {
    const session = await signUp(client, "jane");
    const profile = await client.profile.view({ session });
    if ("error" in profile) throw new Error(profile.error);
    expect(profile.criteria.criteria.map((c) => c.name)).toEqual([
      "pacing",
      "social-commentary",
      "whimsy",
    ]);
    expect(profile.weights.weights).toEqual([]);
  });

  test("weighting criteria saves them and reorders the reader's feed", async () => {
    const session = await signUp(client, "omar");
    expect(
      await client.profile.weigh({ session, criterion: criteria.whimsy!, weight: 5 }),
    ).toEqual({ criterion: criteria.whimsy!, weight: 5 });
    await client.profile.weigh({ session, criterion: criteria.pacing!, weight: 2 });
    const profile = await client.profile.view({ session });
    if ("error" in profile) throw new Error(profile.error);
    expect(new Map(profile.weights.weights.map((w) => [w.criterion, w.weight]))).toEqual(
      new Map([
        [criteria.whimsy!, 5],
        [criteria.pacing!, 2],
      ]),
    );
    const ranked = await client.feed.ranked({ session });
    if ("error" in ranked) throw new Error(ranked.error);
    expect(ranked.ranking.items[0]!.item).toBe(books["The Hobbit"]!);

    await client.profile.weigh({ session, criterion: criteria.whimsy!, weight: 0 });
    await client.profile.weigh({ session, criterion: criteria["social-commentary"]!, weight: 5 });
    const reranked = await client.feed.ranked({ session });
    if ("error" in reranked) throw new Error(reranked.error);
    expect(reranked.ranking.items[0]!.item).toBe(books["Brave New World"]!);
  });

  test("weights outside 0 to 5 are refused", async () => {
    const session = await signUp(client, "pia");
    for (const weight of [6, -1])
      expect(await client.profile.weigh({ session, criterion: criteria.pacing!, weight })).toEqual(
        { error: "INVALID_REQUEST" },
      );
  });

  test("one reader's weights don't affect another's", async () => {
    const quinn = await signUp(client, "quinn");
    const ravi = await signUp(client, "ravi");
    await client.profile.weigh({ session: quinn, criterion: criteria.whimsy!, weight: 4 });
    const profile = await client.profile.view({ session: ravi });
    if ("error" in profile) throw new Error(profile.error);
    expect(profile.weights.weights).toEqual([]);
  });
});
