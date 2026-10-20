import { assemble } from "@mit-sdg/sync-engine/assembly";
import { composition as shelves } from "./compositions/Shelves.ts";
import { ShelvingConcept } from "./concepts/Shelving.ts";
import { BookCatalogingConcept } from "./concepts/BookCataloging.ts";
import { SwipingConcept } from "./concepts/Swiping.ts";
import { composition as feed } from "./compositions/Feed.ts";
import { applicationConceptSet } from "./concepts.ts";
import { composition as catalog } from "./compositions/Catalog.ts";
import { db } from "./db.ts";

export function assembleApplication() {
  return assemble({
    conceptSet: applicationConceptSet,
    instances: {
      Shelving: new ShelvingConcept(db),
      BookCataloging: new BookCatalogingConcept(db),
      Swiping: new SwipingConcept(db),
    },
    composition: { Shelves: shelves, Catalog: catalog, Feed: feed },
    rawFaultReporter: ({ error }) => console.error(error),
  });
}
