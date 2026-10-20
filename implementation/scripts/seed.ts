import { client, db } from "../src/db.ts";
import {
  BookCatalogingConcept,
  CriterionExists,
  DuplicateIsbn,
} from "../src/concepts/BookCataloging.ts";
import { books, criteria } from "./books.ts";

const catalog = new BookCatalogingConcept(db);
const criterionIds = new Map<string, string>();

for (const { name, description } of criteria) {
  try {
    const { criterion } = await catalog.defineCriterion({ name, description });
    criterionIds.set(name, criterion);
  } catch (error) {
    if (!(error instanceof CriterionExists)) throw error;
    const [row] = await catalog._criterionByName({ name });
    criterionIds.set(name, row!.criterion);
  }
}

for (const b of books) {
  let book: string;
  try {
    ({ book } = await catalog.addBook({
      isbn: b.isbn,
      title: b.title,
      author: b.author,
      published: b.published,
      pageCount: b.pageCount,
      coverUrl: b.coverUrl,
    }));
  } catch (error) {
    if (error instanceof DuplicateIsbn) {
      console.log(`Already in catalog: ${b.title}`);
      continue;
    }
    throw error;
  }
  for (const character of b.characters)
    await catalog.addCharacter({ book, ...character });
  await catalog.describe({
    book,
    summary: b.summary,
    setting: b.setting,
  });
  for (const [name, value] of Object.entries(b.scores)) {
    const criterion = criterionIds.get(name);
    if (!criterion)
      throw new Error(`Unknown criterion "${name}" for ${b.title}`);
    await catalog.scoreBook({ book, criterion, value });
  }
  console.log(`Added ${b.title}`);
}

await client.close();
