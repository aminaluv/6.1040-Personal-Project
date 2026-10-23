import { beforeEach, describe, expect, test } from "bun:test";
import {
  InvalidValue,
  InvalidWeight,
  RecommendingConcept,
  UnknownItem,
} from "../../src/concepts/Recommending.ts";
import { db, resetDb } from "../helpers.ts";

let rec: RecommendingConcept;

// Brave New World is strong on social commentary and slow; The Hobbit is the reverse.
async function seed() {
  await rec.setFeature({ item: "brave-new-world", feature: "social-commentary", value: 10 });
  await rec.setFeature({ item: "brave-new-world", feature: "pacing", value: 2 });
  await rec.setFeature({ item: "the-hobbit", feature: "social-commentary", value: 2 });
  await rec.setFeature({ item: "the-hobbit", feature: "pacing", value: 7 });
  await rec.setFeature({ item: "fahrenheit-451", feature: "social-commentary", value: 9 });
  await rec.setFeature({ item: "fahrenheit-451", feature: "pacing", value: 5 });
}

beforeEach(async () => {
  await resetDb();
  rec = new RecommendingConcept(db);
  await seed();
});

describe("Recommending", () => {
  test("principle: liking a book ranks similar books above dissimilar ones", async () => {
    expect((await rec._ranked({ user: "jane" })).every((r) => r.fit === 0)).toBe(true);
    await rec.reinforce({ user: "jane", item: "brave-new-world" });
    const ranked = (await rec._ranked({ user: "jane" })).map((r) => r.item);
    expect(ranked.indexOf("fahrenheit-451")).toBeLessThan(ranked.indexOf("the-hobbit"));
    const learned = new Map(
      (await rec._preferences({ user: "jane" })).map((p) => [p.feature, p.learned]),
    );
    expect(learned.get("social-commentary")).toBeGreaterThan(0);
    expect(learned.get("pacing")).toBeLessThan(0);
  });

  test("passing on a book pushes the ranking away from it", async () => {
    await rec.weaken({ user: "jane", item: "brave-new-world" });
    const ranked = (await rec._ranked({ user: "jane" })).map((r) => r.item);
    expect(ranked[0]).toBe("the-hobbit");
  });

  test("declared weights rank books strong on that criterion first, and keep learned weights", async () => {
    await rec.reinforce({ user: "jane", item: "the-hobbit" });
    await rec.declare({ user: "jane", feature: "social-commentary", weight: 5 });
    expect((await rec._ranked({ user: "jane" }))[0]!.item).toBe("brave-new-world");
    const pref = (await rec._preferences({ user: "jane" })).find(
      (p) => p.feature === "social-commentary",
    )!;
    expect(pref.declared).toBe(5);
    expect(pref.learned).toBeLessThan(0);
  });

  test("learned weights stay between -5 and 5", async () => {
    for (let i = 0; i < 20; i++) await rec.reinforce({ user: "jane", item: "brave-new-world" });
    for (const p of await rec._preferences({ user: "jane" })) {
      expect(p.learned).toBeGreaterThanOrEqual(-5);
      expect(p.learned).toBeLessThanOrEqual(5);
    }
  });

  test("refuses out-of-range values and items without features", async () => {
    await expect(rec.setFeature({ item: "x", feature: "pacing", value: 11 })).rejects.toThrow(
      InvalidValue,
    );
    await expect(rec.declare({ user: "jane", feature: "pacing", weight: 6 })).rejects.toThrow(
      InvalidWeight,
    );
    await expect(rec.declare({ user: "jane", feature: "pacing", weight: -1 })).rejects.toThrow(
      InvalidWeight,
    );
    await expect(rec.reinforce({ user: "jane", item: "unknown" })).rejects.toThrow(UnknownItem);
    await expect(rec.clearItem({ item: "unknown" })).rejects.toThrow(UnknownItem);
  });
});
