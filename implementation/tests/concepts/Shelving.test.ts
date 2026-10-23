import { beforeEach, describe, expect, test } from "bun:test";
import { AlreadyShelved, NotShelved, ShelvingConcept } from "../../src/concepts/Shelving.ts";
import { db, resetDb } from "../helpers.ts";

let shelving: ShelvingConcept;

beforeEach(async () => {
  await resetDb();
  shelving = new ShelvingConcept(db);
});

describe("Shelving", () => {
  test("principle: books move from Up Next to Favorites, and each shelf shows its own", async () => {
    await shelving.add({ user: "jane", item: "brave-new-world", shelf: "UP_NEXT" });
    await Bun.sleep(5);
    await shelving.add({ user: "jane", item: "klara-and-the-sun", shelf: "UP_NEXT" });
    expect(await shelving._shelf({ user: "jane", shelf: "UP_NEXT" })).toEqual([
      { item: "brave-new-world" },
      { item: "klara-and-the-sun" },
    ]);
    await shelving.remove({ user: "jane", item: "brave-new-world", shelf: "UP_NEXT" });
    await shelving.add({ user: "jane", item: "brave-new-world", shelf: "FAVORITES" });
    expect(await shelving._shelf({ user: "jane", shelf: "UP_NEXT" })).toEqual([
      { item: "klara-and-the-sun" },
    ]);
    expect(await shelving._shelf({ user: "jane", shelf: "FAVORITES" })).toEqual([
      { item: "brave-new-world" },
    ]);
  });

  test("a book can't be on the same shelf twice, but can be on two shelves", async () => {
    await shelving.add({ user: "jane", item: "dune", shelf: "UP_NEXT" });
    await expect(shelving.add({ user: "jane", item: "dune", shelf: "UP_NEXT" })).rejects.toThrow(
      AlreadyShelved,
    );
    await shelving.add({ user: "jane", item: "dune", shelf: "FAVORITES" });
  });

  test("removing a book that isn't there is refused", async () => {
    await expect(shelving.remove({ user: "jane", item: "dune", shelf: "UP_NEXT" })).rejects.toThrow(
      NotShelved,
    );
  });
});
