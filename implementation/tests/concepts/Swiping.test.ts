import { beforeEach, describe, expect, test } from "bun:test";
import { AlreadySwiped, NotSwiped, SwipingConcept } from "../../src/concepts/Swiping.ts";
import { db, resetDb } from "../helpers.ts";

let swiping: SwipingConcept;

beforeEach(async () => {
  await resetDb();
  swiping = new SwipingConcept(db);
});

describe("Swiping", () => {
  test("principle: swipes are recorded once each, and reconsidering frees a book", async () => {
    await swiping.swipeRight({ user: "jane", item: "brave-new-world" });
    await Bun.sleep(5);
    await swiping.swipeLeft({ user: "jane", item: "the-hobbit" });
    expect(await swiping._swipes({ user: "jane" })).toEqual([
      { item: "the-hobbit", direction: "LEFT" },
      { item: "brave-new-world", direction: "RIGHT" },
    ]);
    await expect(swiping.swipeRight({ user: "jane", item: "the-hobbit" })).rejects.toThrow(
      AlreadySwiped,
    );
    expect(await swiping.reconsider({ user: "jane", item: "the-hobbit" })).toEqual({
      item: "the-hobbit",
    });
    expect(await swiping._swipes({ user: "jane" })).toEqual([
      { item: "brave-new-world", direction: "RIGHT" },
    ]);
    await swiping.swipeRight({ user: "jane", item: "the-hobbit" });
  });

  test("reconsidering an unswiped book is refused", async () => {
    await expect(swiping.reconsider({ user: "jane", item: "dune" })).rejects.toThrow(NotSwiped);
  });

  test("each reader's swipes are separate", async () => {
    await swiping.swipeRight({ user: "jane", item: "dune" });
    await swiping.swipeLeft({ user: "omar", item: "dune" });
    expect(await swiping._swipes({ user: "omar" })).toEqual([{ item: "dune", direction: "LEFT" }]);
    expect(await swiping._swipes({ user: "nobody" })).toEqual([]);
  });
});
