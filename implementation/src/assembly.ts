import { assemble } from "@mit-sdg/sync-engine/assembly";
import { composition as shelves } from "./compositions/Shelves.ts";
import { ShelvingConcept } from "./concepts/Shelving.ts";
import { BookCatalogingConcept } from "./concepts/BookCataloging.ts";
import { SwipingConcept } from "./concepts/Swiping.ts";
import { RecommendingConcept } from "./concepts/Recommending.ts";
import { composition as feed } from "./compositions/Feed.ts";
import { applicationConceptSet } from "./concepts.ts";
import { composition as catalog } from "./compositions/Catalog.ts";
import { composition as growing } from "./compositions/Growing.ts";
import { composition as sessions } from "./compositions/Sessions.ts";
import { composition as profile } from "./compositions/Profile.ts";
import { AuthenticatingConcept } from "./concepts/Authenticating.ts";
import { SessioningConcept } from "./concepts/Sessioning.ts";
import { HarvestingConcept } from "./concepts/Harvesting.ts";
import { DraftingConcept } from "./concepts/Drafting.ts";
import { db } from "./db.ts";

export function assembleApplication() {
  return assemble({
    conceptSet: applicationConceptSet,
    instances: {
      Authenticating: new AuthenticatingConcept(db),
      Sessioning: new SessioningConcept(db),
      Shelving: new ShelvingConcept(db),
      BookCataloging: new BookCatalogingConcept(db),
      Swiping: new SwipingConcept(db),
      Recommending: new RecommendingConcept(db),
      Harvesting: new HarvestingConcept(db),
      Drafting: new DraftingConcept(db),
    },
    composition: {
      Shelves: shelves,
      Catalog: catalog,
      Feed: feed,
      Growing: growing,
      Sessions: sessions,
      Profile: profile,
    },
    rawFaultReporter: ({ error }) => console.error(error),
  });
}
