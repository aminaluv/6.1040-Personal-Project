import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { no, now, reaction, when, where } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";

const {
  BookCataloging,
  Drafting,
  Harvesting,
  Recommending,
  Sessioning,
  Swiping,
} = concepts;

const BATCH_SIZE = 20;
const PER_GENRE = 5;

// Answers as soon as the batch starts; harvesting and drafting carry on in the same flow. The
// boundary still holds the HTTP reply until that flow drains or its 30-second deadline passes,
// so callers shouldn't wait on it.
const Request = endpoint(
  "/catalog/grow",
  ({ session, user, instant, batch, item, book, genre }) =>
    receive({ session })
      .where(now(instant))
      .then(Sessioning.current({ session }).responds({ subject: user }))
      .then(
        Harvesting.start({ size: BATCH_SIZE, now: instant }).responds({ batch }),
      )
      .then(respond({ batch }))
      .then(
        where(
          Swiping._swipes({ user }).is({ item, direction: "RIGHT" }),
          BookCataloging._genres({ book: item }).is({ genre }),
        )
          .then(Harvesting.harvest({ batch, topic: genre, count: PER_GENRE }))
          .named("liked-genres"),
        where(
          no(Swiping._swipes({ user }).is({ direction: "RIGHT" })),
          BookCataloging._described({}).is({ book }),
          BookCataloging._genres({ book }).is({ genre }),
        )
          .then(Harvesting.harvest({ batch, topic: genre, count: PER_GENRE }))
          .named("catalog-genres"),
      ),
  { input: { required: ["session"] } },
);

const AddHarvestedBook = reaction(
  ({ batch, topic, key, title, author, published, pageCount, coverUrl }) =>
    when(Harvesting.harvest({ batch, topic }).responds({ batch }))
      .where(
        Harvesting._finds({ batch, topic }).is({
          key,
          title,
          author,
          published,
          pageCount,
          coverUrl,
        }),
      )
      .then(
        BookCataloging.addBook({
          isbn: key,
          title,
          author,
          published,
          pageCount,
          coverUrl,
        }),
      ),
);

const GenreFromTopic = reaction(({ isbn, book, topic }) =>
  when(BookCataloging.addBook({ isbn }).responds({ book }))
    .where(Harvesting._find({ key: isbn }).is({ topic }))
    .then(BookCataloging.addGenre({ book, genre: topic })),
);

const DraftAddedBook = reaction(({ isbn, book, title, author, source }) =>
  when(BookCataloging.addBook({ isbn }).responds({ book }))
    .where(Harvesting._find({ key: isbn }).is({ title, author, source }))
    .then(Drafting.draft({ item: book, title, author, source })),
);

// A draft that failed (the agent was down or rate-limited) leaves its book PENDING; each new
// batch tries those books again once its own work has settled.
const RetryPendingDrafts = reaction(
  ({ batch, book, isbn, title, author, source }) =>
    when(Harvesting.start({}).responds({ batch }))
      .afterFlowSettles()
      .where(
        BookCataloging._pending({}).is({ book, isbn }),
        no(Drafting._draft({ item: book })),
        Harvesting._find({ key: isbn }).is({ title, author, source }),
      )
      .then(Drafting.draft({ item: book, title, author, source })),
);

const FillFromDraft = reaction(
  ({ book, draft, name, role, minAge, maxAge, theme, tone }) =>
    when(Drafting.draft({ item: book }).responds({ draft })).then(
      where(Drafting._figures({ draft }).is({ name, role, minAge, maxAge }))
        .then(BookCataloging.addCharacter({ book, name, role, minAge, maxAge }))
        .named("characters"),
      where(Drafting._themes({ draft }).is({ theme }))
        .then(BookCataloging.addTheme({ book, theme }))
        .named("themes"),
      where(Drafting._tones({ draft }).is({ tone }))
        .then(BookCataloging.addTone({ book, tone }))
        .named("tones"),
    ),
);

// Waits for the flow to settle so every character, theme and tone is in before describing.
const DescribeDrafted = reaction(({ book, draft, summary, setting }) =>
  when(Drafting.draft({ item: book }).responds({ draft }))
    .afterFlowSettles()
    .where(Drafting._draft({ item: book }).is({ summary, setting }))
    .then(BookCataloging.describe({ book, summary, setting })),
);

const ScoreDescribed = reaction(
  ({ book, draft, aspectName, value, criterion }) =>
    when(BookCataloging.describe({ book }).responds({ book }))
      .where(
        Drafting._draft({ item: book }).is({ draft }),
        Drafting._ratings({ draft }).is({ aspectName, value }),
        BookCataloging._criterionByName({ name: aspectName }).is({ criterion }),
      )
      .then(BookCataloging.scoreBook({ book, criterion, value })),
);

const ScoreBecomesFeature = reaction(({ book, criterion, value }) =>
  when(BookCataloging.scoreBook({ book, criterion, value }).responds({ book }))
    .then(Recommending.setFeature({ item: book, feature: criterion, value })),
);

const FinishBatch = reaction(({ batch }) =>
  when(Harvesting.start({}).responds({ batch }))
    .afterFlowSettles()
    .then(Harvesting.finish({ batch })),
);

const CriterionBecomesAspect = reaction(({ name, description }) =>
  when(BookCataloging.defineCriterion({ name, description }).responds({}))
    .then(Drafting.defineAspect({ name, description })),
);

export const composition = {
  Request,
  AddHarvestedBook,
  GenreFromTopic,
  DraftAddedBook,
  RetryPendingDrafts,
  FillFromDraft,
  DescribeDrafted,
  ScoreDescribed,
  ScoreBecomesFeature,
  FinishBatch,
  CriterionBecomesAspect,
};
