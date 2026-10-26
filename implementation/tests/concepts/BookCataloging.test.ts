import { beforeEach, describe, expect, test } from "bun:test";
import {
  BookCatalogingConcept,
  BookNotDescribed,
  BookNotPending,
  CriterionExists,
  DuplicateIsbn,
  InvalidAgeRange,
  InvalidScore,
  NoSuchCriterion,
} from "../../src/concepts/BookCataloging.ts";
import { db, isbn, resetDb } from "../helpers.ts";

let catalog: BookCatalogingConcept;

const details = (n: number, title: string) => ({
  isbn: isbn(n),
  title,
  author: "Aldous Huxley",
  published: new Date("1932-01-01"),
  pageCount: 288,
  coverUrl: "https://covers.example/1.jpg",
});

beforeEach(async () => {
  await resetDb();
  catalog = new BookCatalogingConcept(db);
});

describe("BookCataloging", () => {
  test("principle: a described, scored book shows what it's about and where it sits on a scale", async () => {
    const { criterion } = await catalog.defineCriterion({
      name: "pace",
      description: "How quickly the story moves.",
      low: "slow burn",
      high: "page-turner",
    });
    const { book } = await catalog.addBook(details(1, "Brave New World"));
    await catalog.addGenre({ book, genre: "science fiction" });
    await catalog.addCharacter({ book, name: "Bernard Marx", role: "MAIN", minAge: 25, maxAge: 40 });
    await catalog.addTheme({ book, theme: "conformity" });
    await catalog.addTone({ book, tone: "satirical" });
    expect(await catalog._described({})).toEqual([]);

    await catalog.describe({ book, summary: "A World State keeps everyone content.", setting: "London" });
    await catalog.scoreBook({ book, criterion, value: 5 });

    expect((await catalog._described({})).map((b) => b.title)).toEqual(["Brave New World"]);
    expect((await catalog._book({ book }))[0]).toMatchObject({
      title: "Brave New World",
      summary: "A World State keeps everyone content.",
      setting: "London",
    });
    expect(await catalog._characters({ book })).toEqual([
      { name: "Bernard Marx", role: "MAIN", minAge: 25, maxAge: 40 },
    ]);
    expect(await catalog._scores({ book })).toEqual([
      { criterion, criterionName: "pace", low: "slow burn", high: "page-turner", value: 5 },
    ]);
  });

  test("details can only be added while a book is pending, and scores only once described", async () => {
    const { criterion } = await catalog.defineCriterion({ name: "pacing", description: "Speed.", low: "less", high: "more" });
    const { book } = await catalog.addBook(details(2, "The Hobbit"));
    await expect(catalog.scoreBook({ book, criterion, value: 5 })).rejects.toThrow(BookNotDescribed);
    await catalog.describe({ book, summary: "A hobbit's journey." });
    await expect(catalog.addTheme({ book, theme: "home" })).rejects.toThrow(BookNotPending);
    await expect(catalog.addTone({ book, tone: "cozy" })).rejects.toThrow(BookNotPending);
    await expect(
      catalog.addCharacter({ book, name: "Bilbo", role: "MAIN", minAge: 50, maxAge: 51 }),
    ).rejects.toThrow(BookNotPending);
    await expect(catalog.describe({ book, summary: "Again." })).rejects.toThrow(BookNotPending);
  });

  test("refuses duplicates and invalid values", async () => {
    await catalog.defineCriterion({ name: "pacing", description: "Speed.", low: "less", high: "more" });
    await expect(catalog.defineCriterion({ name: "pacing", description: "Again.", low: "less", high: "more" })).rejects.toThrow(
      CriterionExists,
    );
    const { book } = await catalog.addBook(details(3, "Dune"));
    await expect(catalog.addBook(details(3, "Dune again"))).rejects.toThrow(DuplicateIsbn);
    await expect(
      catalog.addCharacter({ book, name: "Paul", role: "MAIN", minAge: 18, maxAge: 15 }),
    ).rejects.toThrow(InvalidAgeRange);
    await catalog.describe({ book, summary: "Spice." });
    const [{ criterion }] = (await catalog._criterionByName({ name: "pacing" })) as [
      { criterion: string },
    ];
    await expect(catalog.scoreBook({ book, criterion, value: 11 })).rejects.toThrow(InvalidScore);
    await expect(catalog.scoreBook({ book, criterion: "nope", value: 5 })).rejects.toThrow(
      NoSuchCriterion,
    );
  });

  test("resetting a description sends a book back to pending without its details", async () => {
    const { criterion } = await catalog.defineCriterion({ name: "pacing", description: "Speed.", low: "less", high: "more" });
    const { book } = await catalog.addBook(details(4, "Station Eleven"));
    await catalog.addTheme({ book, theme: "art" });
    await catalog.describe({ book, summary: "After the flu." });
    await catalog.scoreBook({ book, criterion, value: 4 });
    await catalog.resetDescription({ book });
    expect((await catalog._pending({})).map((b) => b.book)).toEqual([book]);
    expect(await catalog._scores({ book })).toEqual([]);
    expect(await catalog._themes({ book })).toEqual([]);
  });

  test("removing a criterion removes its scores too", async () => {
    const { criterion } = await catalog.defineCriterion({
      name: "pace",
      description: "How fast it moves.",
      low: "slow burn",
      high: "page-turner",
    });
    const { book } = await catalog.addBook(details(5, "Dune"));
    await catalog.describe({ book, summary: "Spice." });
    await catalog.scoreBook({ book, criterion, value: 4 });
    expect(await catalog._scores({ book })).toEqual([
      { criterion, criterionName: "pace", low: "slow burn", high: "page-turner", value: 4 },
    ]);
    expect(await catalog.removeCriterion({ criterion })).toEqual({ name: "pace" });
    expect(await catalog._scores({ book })).toEqual([]);
    expect(await catalog._criteria({})).toEqual([]);
    await expect(catalog.removeCriterion({ criterion })).rejects.toThrow(NoSuchCriterion);
  });

  test("lists every criterion by name", async () => {
    await catalog.defineCriterion({ name: "whimsy", description: "Playfulness.", low: "less", high: "more" });
    await catalog.defineCriterion({ name: "pacing", description: "Speed.", low: "less", high: "more" });
    expect((await catalog._criteria({})).map((c) => c.name)).toEqual(["pacing", "whimsy"]);
  });
});
