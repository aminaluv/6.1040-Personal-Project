import { client, db } from "../src/db.ts";
import { BookCatalogingConcept } from "../src/concepts/BookCataloging.ts";
import { RecommendingConcept } from "../src/concepts/Recommending.ts";

await client.connect();
const catalog = new BookCatalogingConcept(db);
const recommending = new RecommendingConcept(db);

for (const { book, title } of await catalog._described({})) {
  const scores = await catalog._scores({ book });
  for (const { criterion, value } of scores) {
    await recommending.setFeature({ item: book, feature: criterion, value });
  }
  console.log(`${title}: ${scores.length} features`);
}

await client.close();
