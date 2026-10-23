import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  AlreadyDrafted,
  AspectExists,
  DraftFailed,
  DraftingConcept,
  NoAspects,
  NoDraft,
} from "../../src/concepts/Drafting.ts";
import { completeAnswer, db, fakeWeb, resetDb } from "../helpers.ts";

let drafting: DraftingConcept;
let web: ReturnType<typeof fakeWeb>;
const request = { item: "the-hobbit", title: "The Hobbit", author: "J. R. R. Tolkien", source: "{}" };

async function defineAspects() {
  await drafting.defineAspect({ name: "social-commentary", description: "Comments on society." });
  await drafting.defineAspect({ name: "pacing", description: "How fast it moves." });
}

beforeEach(async () => {
  await resetDb();
  drafting = new DraftingConcept(db);
  web = fakeWeb();
});
afterEach(() => web.restore());

describe("Drafting", () => {
  test("principle: a draft holds everything needed to describe the book", async () => {
    await defineAspects();
    const { draft } = await drafting.draft(request);
    expect(await drafting._draft({ item: "the-hobbit" })).toEqual([
      { draft, summary: "A spoiler-free summary of The Hobbit.", setting: "A city by the sea" },
    ]);
    expect(await drafting._figures({ draft })).toEqual([
      { name: "The Hobbit Hero", role: "MAIN", minAge: 20, maxAge: 25 },
    ]);
    expect(await drafting._themes({ draft })).toEqual([{ theme: "courage" }, { theme: "home" }]);
    expect(await drafting._tones({ draft })).toEqual([{ tone: "hopeful" }]);
    expect((await drafting._ratings({ draft })).map((r) => r.aspectName)).toEqual([
      "pacing",
      "social-commentary",
    ]);
  });

  test("refuses without aspects, and refuses a second draft of the same item", async () => {
    await expect(drafting.draft(request)).rejects.toThrow(NoAspects);
    await defineAspects();
    await drafting.draft(request);
    await expect(drafting.draft(request)).rejects.toThrow(AlreadyDrafted);
    await expect(
      drafting.defineAspect({ name: "pacing", description: "Again." }),
    ).rejects.toThrow(AspectExists);
  });

  test("an incomplete answer is refused and nothing is kept", async () => {
    await defineAspects();
    web.restore();
    web = fakeWeb({
      answer: (title, aspects) => ({ ...completeAnswer(title, aspects), ratings: [] }),
    });
    await expect(drafting.draft(request)).rejects.toThrow(DraftFailed);
    expect(await drafting._draft({ item: "the-hobbit" })).toEqual([]);
  });

  test("invalid characters are dropped, but at least one valid one is required", async () => {
    await defineAspects();
    web.restore();
    web = fakeWeb({
      answer: (title, aspects) => ({
        ...completeAnswer(title, aspects),
        characters: [
          { name: "Bilbo", role: "MAIN", minAge: 50, maxAge: 51 },
          { name: "Backwards", role: "MAIN", minAge: 40, maxAge: 30 },
          { name: "Nobody", role: "VILLAIN", minAge: 1, maxAge: 2 },
        ],
      }),
    });
    const { draft } = await drafting.draft(request);
    expect((await drafting._figures({ draft })).map((f) => f.name)).toEqual(["Bilbo"]);
  });

  test("an overloaded model falls back to the other one", async () => {
    await defineAspects();
    web.restore();
    web = fakeWeb({
      geminiError: (model) => (model === "gemini-flash-lite-latest" ? { status: 503 } : undefined),
    });
    await drafting.draft(request);
    expect(web.geminiModels).toEqual(["gemini-flash-lite-latest", "gemini-flash-latest"]);
  });

  test("an exhausted daily quota fails at once instead of waiting", async () => {
    await defineAspects();
    web.restore();
    web = fakeWeb({
      geminiError: () => ({ status: 429, body: '{"error":{"details":[{"retryDelay":"691s"}]}}' }),
    });
    const started = Date.now();
    await expect(drafting.draft(request)).rejects.toThrow(DraftFailed);
    expect(Date.now() - started).toBeLessThan(2000);
    expect(web.geminiModels).toHaveLength(1);
  });

  test("discarding a draft allows a new one", async () => {
    await defineAspects();
    await expect(drafting.discard({ item: "the-hobbit" })).rejects.toThrow(NoDraft);
    await drafting.draft(request);
    await drafting.discard({ item: "the-hobbit" });
    expect(await drafting._draft({ item: "the-hobbit" })).toEqual([]);
    await drafting.draft(request);
  });
});
