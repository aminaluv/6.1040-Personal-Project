// Moves the catalog onto the criteria listed in scripts/books.ts. Safe to rerun: each step skips
// what's already done.
//   1. Defines any new criterion, with the matching aspect the agent scores books on.
//   2. Removes criteria no longer listed, with their scores, ratings, ranking features and
//      readers' preferences on them.
//   3. Scores every described book on any criterion it lacks: seed books from books.ts, and
//      harvested books by asking the agent to rerate their draft.
//   4. Copies every score into Recommending, where it ranks the feed.
import { client, db } from "../src/db.ts";
import { BookCatalogingConcept, CriterionExists } from "../src/concepts/BookCataloging.ts";
import { AspectExists, DraftingConcept, NoSuchAspect } from "../src/concepts/Drafting.ts";
import { HarvestingConcept } from "../src/concepts/Harvesting.ts";
import { RecommendingConcept, UnknownFeature } from "../src/concepts/Recommending.ts";
import { books, criteria } from "./books.ts";

await client.connect();
const catalog = new BookCatalogingConcept(db);
const drafting = new DraftingConcept(db);
const harvesting = new HarvestingConcept(db);
const recommending = new RecommendingConcept(db);

const ignoring = (kind: new (...args: never[]) => Error) => (error: unknown) => {
  if (!(error instanceof kind)) throw error;
};

// 1. New criteria.
for (const { name, description, low, high } of criteria) {
  await catalog.defineCriterion({ name, description, low, high }).catch(ignoring(CriterionExists));
  await drafting.defineAspect({ name, description }).catch(ignoring(AspectExists));
}

// 2. Old criteria.
const wanted = new Set(criteria.map((c) => c.name));
for (const { criterion, name } of await catalog._criteria({})) {
  if (wanted.has(name)) continue;
  await catalog.removeCriterion({ criterion });
  await drafting.removeAspect({ name }).catch(ignoring(NoSuchAspect));
  await recommending.clearFeature({ feature: criterion }).catch(ignoring(UnknownFeature));
  console.log(`Removed criterion ${name}`);
}

// 3. Scores on the current criteria.
const current = await catalog._criteria({});
const seedScores = new Map(books.map((b) => [b.title, b.scores as Record<string, number>]));
const described = await catalog._described({});
let rescored = 0;
for (const { book, title, author } of described) {
  const have = new Set((await catalog._scores({ book })).map((s) => s.criterion));
  const missing = current.filter((c) => !have.has(c.criterion));
  if (missing.length === 0) continue;

  let values: Map<string, number>;
  const seeded = seedScores.get(title);
  if (seeded) values = new Map(Object.entries(seeded));
  else {
    if ((await drafting._draft({ item: book })).length === 0) {
      console.warn(`Skipping ${title}: it has no draft to rerate.`);
      continue;
    }
    const [details] = await catalog._book({ book });
    const [find] = details ? await harvesting._find({ key: details.isbn }) : [];
    try {
      const { draft } = await drafting.rerate({ item: book, title, author, source: find?.source ?? "{}" });
      values = new Map((await drafting._ratings({ draft })).map((r) => [r.aspectName, r.value]));
    } catch (error) {
      console.warn(`Skipping ${title} for now: ${(error as Error).message}`);
      continue;
    }
  }
  for (const c of missing) {
    const value = values.get(c.name);
    if (value !== undefined) await catalog.scoreBook({ book, criterion: c.criterion, value });
  }
  rescored++;
  console.log(`Scored ${title} on ${missing.length} criteria`);
}

// 4. Ranking features.
for (const { book } of described)
  for (const { criterion, value } of await catalog._scores({ book }))
    await recommending.setFeature({ item: book, feature: criterion, value });

console.log(`Criteria: ${current.length}. Books rescored: ${rescored} of ${described.length}.`);
await client.close();
