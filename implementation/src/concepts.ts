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

import recommendingSpec from "@design/concepts/Recommending.md" with {type: "text"};
import {
  RecommendingConcept,
  InvalidValue,
  InvalidTarget,
  InvalidImportance,
  UnknownItem,
  UnknownFeature,
} from "./concepts/Recommending.ts";

import harvestingSpec from "@design/concepts/Harvesting.md" with { type: "text" };
import {
  HarvestingConcept,
  InvalidSize,
  BatchRunning,
  BatchNotRunning,
  TopicExhausted,
  BatchFull,
  SourceUnavailable,
} from "./concepts/Harvesting.ts";

import draftingSpec from "@design/concepts/Drafting.md" with { type: "text" };
import {
  DraftingConcept,
  AspectExists,
  AlreadyDrafted,
  NoAspects,
  DraftFailed,
  NoDraft,
  NoSuchAspect,
} from "./concepts/Drafting.ts";

import authenticatingSpec from "@design/concepts/Authenticating.md" with { type: "text" };
import {
  AuthenticatingConcept,
  InvalidUsername,
  WeakPassword,
  UsernameTaken,
  InvalidCredentials,
} from "./concepts/Authenticating.ts";

import followingSpec from "@design/concepts/Following.md" with { type: "text" };
import {
  FollowingConcept,
  SelfFollow,
  AlreadyFollowing,
  NotFollowing,
} from "./concepts/Following.ts";

import sessioningSpec from "@design/concepts/Sessioning.md" with { type: "text" };
import { SessioningConcept, UnknownSession } from "./concepts/Sessioning.ts";

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

const recommending = registerConcept({
  class: RecommendingConcept,
  spec: recommendingSpec,
  refusals: {
    INVALID_VALUE: InvalidValue,
    INVALID_TARGET: InvalidTarget,
    INVALID_IMPORTANCE: InvalidImportance,
    UNKNOWN_ITEM: UnknownItem,
    UNKNOWN_FEATURE: UnknownFeature,
  },
});

const harvesting = registerConcept({
  class: HarvestingConcept,
  spec: harvestingSpec,
  refusals: {
    INVALID_SIZE: InvalidSize,
    BATCH_RUNNING: BatchRunning,
    BATCH_NOT_RUNNING: BatchNotRunning,
    TOPIC_EXHAUSTED: TopicExhausted,
    BATCH_FULL: BatchFull,
    SOURCE_UNAVAILABLE: SourceUnavailable,
  },
});

const drafting = registerConcept({
  class: DraftingConcept,
  spec: draftingSpec,
  refusals: {
    ASPECT_EXISTS: AspectExists,
    ALREADY_DRAFTED: AlreadyDrafted,
    NO_ASPECTS: NoAspects,
    DRAFT_FAILED: DraftFailed,
    NO_DRAFT: NoDraft,
    NO_SUCH_ASPECT: NoSuchAspect,
  },
});

const authenticating = registerConcept({
  class: AuthenticatingConcept,
  spec: authenticatingSpec,
  refusals: {
    INVALID_USERNAME: InvalidUsername,
    WEAK_PASSWORD: WeakPassword,
    USERNAME_TAKEN: UsernameTaken,
    INVALID_CREDENTIALS: InvalidCredentials,
  },
});

const sessioning = registerConcept({
  class: SessioningConcept,
  spec: sessioningSpec,
  refusals: { UNKNOWN_SESSION: UnknownSession },
});

const following = registerConcept({
  class: FollowingConcept,
  spec: followingSpec,
  refusals: {
    SELF_FOLLOW: SelfFollow,
    ALREADY_FOLLOWING: AlreadyFollowing,
    NOT_FOLLOWING: NotFollowing,
  },
});

export const applicationConceptSet = conceptSet({
  Authenticating: authenticating,
  Sessioning: sessioning,
  Following: following,
  Shelving: shelving,
  BookCataloging: bookCataloging,
  Swiping: swiping,
  Recommending: recommending,
  Harvesting: harvesting,
  Drafting: drafting,
});

export const { concepts } = applicationConceptSet;
