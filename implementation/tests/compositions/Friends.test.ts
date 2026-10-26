import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { seedCatalog, signUp, startApp, type Client } from "../app.ts";
import { isbn, resetDb } from "../helpers.ts";

let app: ReturnType<typeof startApp>;
let client: Client;
let books: Record<string, string>;
let jane: string;
let maya: string;

beforeAll(async () => {
  await resetDb();
  ({ books } = await seedCatalog([
    { title: "Klara and the Sun", isbn: isbn(1), genre: "literary fiction", scores: [3, 6, 2] },
    { title: "Never Let Me Go", isbn: isbn(2), genre: "literary fiction", scores: [2, 7, 1] },
  ]));
  app = startApp();
  client = app.client;
  jane = await signUp(client, "jane");
  maya = await signUp(client, "maya");
  // Maya has a book on each shelf: she finished and loved Never Let Me Go.
  await client.feed.like({ session: maya, item: books["Klara and the Sun"]! });
  await client.shelves.add({ session: maya, item: books["Never Let Me Go"]!, shelf: "FINISHED" });
  await client.shelves.add({ session: maya, item: books["Never Let Me Go"]!, shelf: "FAVORITES" });
});
afterAll(() => app.stop());

describe("Friends", () => {
  test("before following, a reader's network is visible but their shelves aren't", async () => {
    const view = await client.friends.reader({ session: jane, username: "maya" });
    expect(view).toEqual({
      username: "maya",
      followedByYou: false,
      following: { people: [] },
      followers: { people: [] },
    });
  });

  test("after following, both networks update and the friend's shelves are shared", async () => {
    expect(await client.friends.follow({ session: jane, username: "maya" })).toEqual({
      username: "maya",
    });
    expect(await client.friends.mine({ session: jane })).toEqual({
      following: { people: [{ username: "maya" }] },
      followers: { people: [] },
    });
    expect(await client.friends.mine({ session: maya })).toEqual({
      following: { people: [] },
      followers: { people: [{ username: "jane" }] },
    });
    expect(await client.friends.reader({ session: jane, username: "maya" })).toEqual({
      username: "maya",
      followedByYou: true,
      following: { people: [] },
      followers: { people: [{ username: "jane" }] },
      upNext: { items: [{ item: books["Klara and the Sun"]! }] },
      finished: { items: [{ item: books["Never Let Me Go"]! }] },
      favorites: { items: [{ item: books["Never Let Me Go"]! }] },
    });
  });

  test("a reader can add a friend's book to their own Up Next", async () => {
    const item = books["Klara and the Sun"]!;
    expect(await client.shelves.add({ session: jane, item, shelf: "UP_NEXT" })).toEqual({ item });
    expect(await client.shelves.view({ session: jane, shelf: "UP_NEXT" })).toEqual({
      shelf: { items: [{ item }] },
    });
  });

  test("following is one-way: the friend doesn't see the follower's shelves", async () => {
    const view = await client.friends.reader({ session: maya, username: "jane" });
    expect(view).toMatchObject({ username: "jane", followedByYou: false });
    expect(view).not.toHaveProperty("upNext");
  });

  test("unfollowing stops sharing the friend's shelves", async () => {
    expect(await client.friends.unfollow({ session: jane, username: "maya" })).toEqual({
      username: "maya",
    });
    const view = await client.friends.reader({ session: jane, username: "maya" });
    expect(view).toMatchObject({ followedByYou: false });
    expect(view).not.toHaveProperty("favorites");
  });

  test("unknown readers, yourself, repeats and strangers get the right errors", async () => {
    expect(await client.friends.follow({ session: jane, username: "nobody" })).toEqual({
      error: "NOT_FOUND",
    });
    expect(await client.friends.reader({ session: jane, username: "nobody" })).toEqual({
      error: "NOT_FOUND",
    });
    expect(await client.friends.follow({ session: jane, username: "jane" })).toEqual({
      error: "INVALID_REQUEST",
    });
    await client.friends.follow({ session: jane, username: "maya" });
    expect(await client.friends.follow({ session: jane, username: "maya" })).toEqual({
      error: "CONFLICT",
    });
    expect(await client.friends.unfollow({ session: maya, username: "jane" })).toEqual({
      error: "NOT_FOUND",
    });
  });

  test("every friends endpoint needs a signed-in reader", async () => {
    const session = "invented-session";
    expect(await client.friends.mine({ session })).toEqual({ error: "UNAUTHORIZED" });
    expect(await client.friends.follow({ session, username: "maya" })).toEqual({
      error: "UNAUTHORIZED",
    });
    expect(await client.friends.reader({ session, username: "maya" })).toEqual({
      error: "UNAUTHORIZED",
    });
  });
});
