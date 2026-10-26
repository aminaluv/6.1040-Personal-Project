import { beforeEach, describe, expect, test } from "bun:test";
import {
  InvalidImportance,
  InvalidTarget,
  InvalidValue,
  RecommendingConcept,
  UnknownFeature,
  UnknownItem,
} from "../../src/concepts/Recommending.ts";
import { db, resetDb } from "../helpers.ts";

let rec: RecommendingConcept;
const order = async (user: string) => (await rec._ranked({ user })).map((r) => r.item);

// Pace runs from a slow burn (0) to a page-turner (10); tone from light (0) to dark (10).
async function seed() {
  await rec.setFeature({ item: "remains-of-the-day", feature: "pace", value: 1 });
  await rec.setFeature({ item: "remains-of-the-day", feature: "tone", value: 4 });
  await rec.setFeature({ item: "brave-new-world", feature: "pace", value: 5 });
  await rec.setFeature({ item: "brave-new-world", feature: "tone", value: 7 });
  await rec.setFeature({ item: "thriller", feature: "pace", value: 10 });
  await rec.setFeature({ item: "thriller", feature: "tone", value: 8 });
}

beforeEach(async () => {
  await resetDb();
  rec = new RecommendingConcept(db);
  await seed();
});

describe("Recommending", () => {
  test("principle: a stated preference for a slow burn ranks slow books first", async () => {
    expect((await rec._ranked({ user: "jane" })).every((r) => r.fit === 0)).toBe(true);
    await rec.prefer({ user: "jane", feature: "pace", target: 1, importance: 5 });
    expect(await order("jane")).toEqual(["remains-of-the-day", "brave-new-world", "thriller"]);
  });

  test("principle: liking fast books moves a quiet reader's lean toward fast", async () => {
    await rec.reinforce({ user: "ben", item: "thriller" });
    await rec.reinforce({ user: "ben", item: "thriller" });
    expect((await order("ben"))[0]).toBe("thriller");
    const pace = (await rec._preferences({ user: "ben" })).find((p) => p.feature === "pace")!;
    expect(pace.importance).toBe(0);
    expect(pace.lean).toBeGreaterThan(5);
  });

  test("high isn't better: preferring the middle ranks the middle first", async () => {
    await rec.prefer({ user: "jane", feature: "pace", target: 5, importance: 5 });
    expect((await order("jane"))[0]).toBe("brave-new-world");
  });

  test("passing moves the lean away from a book", async () => {
    await rec.weaken({ user: "jane", item: "thriller" });
    const pace = (await rec._preferences({ user: "jane" })).find((p) => p.feature === "pace")!;
    expect(pace.lean).toBeLessThan(5);
    expect((await order("jane"))[2]).toBe("thriller");
  });

  test("a stated preference outweighs what swipes alone suggest", async () => {
    for (let i = 0; i < 10; i++) await rec.reinforce({ user: "jane", item: "thriller" });
    await rec.prefer({ user: "jane", feature: "pace", target: 1, importance: 5 });
    expect((await order("jane"))[0]).toBe("remains-of-the-day");
  });

  test("setting a preference keeps what swipes taught, and leans stay within 0 to 10", async () => {
    for (let i = 0; i < 20; i++) await rec.reinforce({ user: "jane", item: "thriller" });
    await rec.prefer({ user: "jane", feature: "pace", target: 2, importance: 3 });
    const pace = (await rec._preferences({ user: "jane" })).find((p) => p.feature === "pace")!;
    expect(pace).toMatchObject({ importance: 3, target: 2 });
    expect(pace.lean).toBeGreaterThan(9);
    expect(pace.lean).toBeLessThanOrEqual(10);
  });

  test("clearing a feature removes its values and every preference on it", async () => {
    await rec.prefer({ user: "jane", feature: "tone", target: 8, importance: 4 });
    await rec.clearFeature({ feature: "tone" });
    expect((await rec._preferences({ user: "jane" })).map((p) => p.feature)).toEqual([]);
    await rec.prefer({ user: "jane", feature: "pace", target: 1, importance: 5 });
    expect((await order("jane"))[0]).toBe("remains-of-the-day");
    await expect(rec.clearFeature({ feature: "tone" })).rejects.toThrow(UnknownFeature);
  });

  test("refuses out-of-range values, targets and importance, and items without features", async () => {
    await expect(rec.setFeature({ item: "x", feature: "pace", value: 11 })).rejects.toThrow(
      InvalidValue,
    );
    await expect(
      rec.prefer({ user: "jane", feature: "pace", target: 11, importance: 3 }),
    ).rejects.toThrow(InvalidTarget);
    await expect(
      rec.prefer({ user: "jane", feature: "pace", target: 5, importance: 6 }),
    ).rejects.toThrow(InvalidImportance);
    await expect(rec.reinforce({ user: "jane", item: "unknown" })).rejects.toThrow(UnknownItem);
    await expect(rec.clearItem({ item: "unknown" })).rejects.toThrow(UnknownItem);
  });
});
