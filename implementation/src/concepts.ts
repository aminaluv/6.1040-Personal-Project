import { conceptSet, registerConcept } from "@mit-sdg/sync-engine/assembly";
import shelvingSpec from "@design/concepts/Shelving.md" with { type: "text" };
import {
  AlreadyShelved,
  NotShelved,
  ShelvingConcept,
} from "./concepts/Shelving.ts";
import catalogSpec from "@design/concepts/BookCataloging.md" with { type: "text" };

import {
  BookCatalogingConcept,
  BookNotDescribed,
  BookNotPending,
  CriterionExists,
  DuplicateIsbn,
  InvalidAgeRange,
  InvalidScore,
  NoSuchCriterion,
  NoSuchBook
} from "./concepts/BookCataloging.ts";

import swipingSpec from "@design/concepts/Swiping.md" with { type: "text" };

import {
  SwipingConcept,
  AlreadySwiped,
  NotSwiped
} from "./concepts/Swiping.ts";

const bookCataloging = registerConcept({
  class: BookCatalogingConcept,
  spec: catalogSpec,
  refusals: {
    CRITERION_EXISTS: CriterionExists,
    DUPLICATE_ISBN: DuplicateIsbn,
    BOOK_NOT_PENDING: BookNotPending,
    BOOK_NOT_DESCRIBED: BookNotDescribed,
    INVALID_AGE_RANGE: InvalidAgeRange,
    NO_SUCH_CRITERION: NoSuchCriterion,
    INVALID_SCORE: InvalidScore,
    NO_SUCH_BOOK: NoSuchBook
  },
});

const shelving = registerConcept({
  class: ShelvingConcept,
  spec: shelvingSpec,
  refusals: { ALREADY_SHELVED: AlreadyShelved, NOT_SHELVED: NotShelved },
});

const swiping = registerConcept({
  class: SwipingConcept,
  spec: swipingSpec,
  refusals: {
    ALREADY_SWIPED: AlreadySwiped,
    NOT_SWIPED: NotSwiped,
  },
});

export const applicationConceptSet = conceptSet({
  Shelving: shelving,
  BookCataloging: bookCataloging,
  Swiping: swiping,
});

export const { concepts } = applicationConceptSet;
