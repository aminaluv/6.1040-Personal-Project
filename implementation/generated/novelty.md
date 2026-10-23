<!-- Generated from the Novelty assembly. Do not edit. -->
<!-- Manifest producer: @mit-sdg/sync-engine@1.1.0; concept specification: sync-engine.concept-specification@1; renderer: @mit-sdg/sync-engine@1.1.0. -->

# Novelty — assembled read-back

_Assembled by sync-engine from registered concepts and composition. Edit the concept_
_specifications and composition source, then regenerate this file._

## Concepts

### Authenticating

Defined in [Authenticating](../design/concepts/Authenticating.md), line 1.

#### Actions

- `register(username: String, password: String) : returns (account: Account)`
  - Refuses `INVALID_USERNAME`: A username must contain 3 to 32 letters, numbers, underscores, or hyphens.
  - Refuses `WEAK_PASSWORD`: A password must contain 8 to 128 characters.
  - Refuses `USERNAME_TAKEN`: That username is already registered.
- `authenticate(username: String, password: String) : returns (account: Account)`
  - Refuses `INVALID_CREDENTIALS`: The username or password is incorrect.

#### Queries

- `_registered(username: String) : one (registered: Flag)`

#### Instances

- `Authenticating` — instance of `Authenticating` — [Application types](../design/types.md), line 8.

### BookCataloging

Defined in [BookCataloging](../design/concepts/BookCataloging.md), line 1.

#### Actions

- `defineCriterion(name: String, description: String) : returns (criterion: Criterion)`
  - Refuses `CRITERION_EXISTS`: A criterion with that name already exists.
- `addBook(isbn: String, title: String, author: String, published: Date, pageCount: Number, coverUrl: String) : returns (book: Book)`
  - Refuses `DUPLICATE_ISBN`: A book with that ISBN is already in the catalog.
- `addCharacter(book: Book, name: String, role: Role, minAge: Number, maxAge: Number) : returns (character: Character)`
  - Refuses `BOOK_NOT_PENDING`: Characters can only be added before a book is described.
  - Refuses `INVALID_AGE_RANGE`: The minimum age must not exceed the maximum age.
- `addGenre(book: Book, genre: String) : returns (book: Book)`
  - Refuses `NO_SUCH_BOOK`: There is no such book.
- `addTheme(book: Book, theme: String) : returns (book: Book)`
  - Refuses `BOOK_NOT_PENDING`: Themes can only be added before a book is described.
- `addTone(book: Book, tone: String) : returns (book: Book)`
  - Refuses `BOOK_NOT_PENDING`: Tones can only be added before a book is described.
- `describe(book: Book, summary: String, setting?: String) : returns (book: Book)`
  - Refuses `BOOK_NOT_PENDING`: Only a book that hasn't been described yet can be described.
- `scoreBook(book: Book, criterion: Criterion, value: Number) : returns (book: Book)`
  - Refuses `BOOK_NOT_DESCRIBED`: Only a described book can be scored.
  - Refuses `NO_SUCH_CRITERION`: There is no such criterion.
  - Refuses `INVALID_SCORE`: A score must be between 0 and 10.
- `resetDescription(book: Book) : returns (book: Book)`
  - Refuses `BOOK_NOT_DESCRIBED`: Only a described book can be reset.

#### Queries

- `_described() : many (book: Book, title: String, author: String, coverUrl: String)`
- `_book(book: Book) : optional (title: String, author: String, published: Date, pageCount: Number, coverUrl: String, summary: String, setting: String)`
- `_genres(book: Book) : many (genre: String)`
- `_themes(book: Book) : many (theme: String)`
- `_tones(book: Book) : many (tone: String)`
- `_characters(book: Book) : many (name: String, role: Role, minAge: Number, maxAge: Number)`
- `_scores(book: Book) : many (criterion: Criterion, criterionName: String, value: Number)`
- `_criteria() : many (criterion: Criterion, name: String, description: String)`
- `_criterionByName(name: String) : optional (criterion: Criterion)`
- `_pending() : many (book: Book, isbn: String, title: String, author: String)`

#### Instances

- `BookCataloging` — instance of `BookCataloging` — [Application types](../design/types.md), line 13.

### Drafting

Defined in [Drafting](../design/concepts/Drafting.md), line 1.

#### Actions

- `defineAspect(name: String, description: String) : returns (aspect: Aspect)`
  - Refuses `ASPECT_EXISTS`: An aspect with that name already exists.
- `draft(item: Item, title: String, author: String, source: String) : returns (draft: Draft)`
  - Refuses `ALREADY_DRAFTED`: That item already has a draft.
  - Refuses `NO_ASPECTS`: Define at least one aspect before drafting.
  - Refuses `DRAFT_FAILED`: The agent couldn't produce a complete draft.
- `discard(item: Item) : returns (item: Item)`
  - Refuses `NO_DRAFT`: That item has no draft.

#### Queries

- `_draft(item: Item) : optional (draft: Draft, summary: String, setting: String)`
- `_figures(draft: Draft) : many (name: String, role: Role, minAge: Number, maxAge: Number)`
- `_themes(draft: Draft) : many (theme: String)`
- `_tones(draft: Draft) : many (tone: String)`
- `_ratings(draft: Draft) : many (aspectName: String, value: Number)`

#### Instances

- `Drafting` — instance of `Drafting` — [Application types](../design/types.md), line 30.
  - `Item` is `BookCataloging.Book` — [Application types](../design/types.md), line 31.

### Harvesting

Defined in [Harvesting](../design/concepts/Harvesting.md), line 1.

#### Actions

- `start(size: Number, now: DateTime) : returns (batch: Batch)`
  - Refuses `INVALID_SIZE`: A batch must have room for at least one find.
  - Refuses `BATCH_RUNNING`: A batch is already running.
- `harvest(batch: Batch, topic: String, count: Number) : returns (batch: Batch)`
  - Refuses `BATCH_NOT_RUNNING`: That batch is not running.
  - Refuses `TOPIC_EXHAUSTED`: The source has nothing more on that topic.
  - Refuses `BATCH_FULL`: That batch is already full.
  - Refuses `SOURCE_UNAVAILABLE`: The source could not be reached.
- `finish(batch: Batch) : returns (batch: Batch)`
  - Refuses `BATCH_NOT_RUNNING`: That batch is not running.

#### Queries

- `_finds(batch: Batch, topic: String) : many (key: String, title: String, author: String, published: Date, pageCount: Number, coverUrl: String)`
- `_find(key: String) : optional (topic: String, title: String, author: String, source: String)`

#### Instances

- `Harvesting` — instance of `Harvesting` — [Application types](../design/types.md), line 28.

### Recommending

Defined in [Recommending](../design/concepts/Recommending.md), line 1.

#### Actions

- `setFeature(item: Item, feature: Feature, value: Number) : returns (item: Item)`
  - Refuses `INVALID_VALUE`: A feature value must be between 0 and 10.
- `clearItem(item: Item) : returns (item: Item)`
  - Refuses `UNKNOWN_ITEM`: That item has no feature values.
- `declare(user: User, feature: Feature, weight: Number) : returns (feature: Feature)`
  - Refuses `INVALID_WEIGHT`: A declared weight must be between 0 and 5.
- `reinforce(user: User, item: Item) : returns (item: Item)`
  - Refuses `UNKNOWN_ITEM`: That item has no feature values.
- `weaken(user: User, item: Item) : returns (item: Item)`
  - Refuses `UNKNOWN_ITEM`: That item has no feature values.

#### Queries

- `_ranked(user: User) : many (item: Item, fit: Number)`
- `_preferences(user: User) : many (feature: Feature, declared: Number, learned: Number)`

#### Instances

- `Recommending` — instance of `Recommending` — [Application types](../design/types.md), line 23.
  - `Feature` is `BookCataloging.Criterion` — [Application types](../design/types.md), line 26.
  - `Item` is `BookCataloging.Book` — [Application types](../design/types.md), line 25.
  - `User` is `Authenticating.Account` — [Application types](../design/types.md), line 24.

### Sessioning

Defined in [Sessioning](../design/concepts/Sessioning.md), line 1.

#### Actions

- `start(subject: Subject) : returns (session: Session, expiresAt: DateTime)`
- `current(session: Session) : returns (subject: Subject)`
  - Refuses `UNKNOWN_SESSION`: This session is not active.
- `end(session: Session) : returns (ended: Flag)`
  - Refuses `UNKNOWN_SESSION`: This session is not active.

#### Queries

- `_active(session: Session) : optional (subject: Subject, expiresAt: DateTime)`

#### Instances

- `Sessioning` — instance of `Sessioning` — [Application types](../design/types.md), line 10.
  - `Subject` is `Authenticating.Account` — [Application types](../design/types.md), line 11.

### Shelving

Defined in [Shelving](../design/concepts/Shelving.md), line 1.

#### Actions

- `add(user: User, item: Item, shelf: ShelfName) : returns (item: Item)`
  - Refuses `ALREADY_SHELVED`: That book is already on this shelf.
- `remove(user: User, item: Item, shelf: ShelfName) : returns (item: Item)`
  - Refuses `NOT_SHELVED`: That book is not on this shelf.

#### Queries

- `_shelf(user: User, shelf: ShelfName) : many (item: Item)`

#### Instances

- `Shelving` — instance of `Shelving` — [Application types](../design/types.md), line 15.
  - `Item` is `BookCataloging.Book` — [Application types](../design/types.md), line 17.
  - `User` is `Authenticating.Account` — [Application types](../design/types.md), line 16.

### Swiping

Defined in [Swiping](../design/concepts/Swiping.md), line 1.

#### Actions

- `swipeRight(user: User, item: Item) : returns (item: Item)`
  - Refuses `ALREADY_SWIPED`: You've already swiped on this book.
- `swipeLeft(user: User, item: Item) : returns (item: Item)`
  - Refuses `ALREADY_SWIPED`: You've already swiped on this book.
- `reconsider(user: User, item: Item) : returns (item: Item)`
  - Refuses `NOT_SWIPED`: You haven't swiped on this book.

#### Queries

- `_swipes(user: User) : many (item: Item, direction: Direction)`

#### Instances

- `Swiping` — instance of `Swiping` — [Application types](../design/types.md), line 19.
  - `Item` is `BookCataloging.Book` — [Application types](../design/types.md), line 21.
  - `User` is `Authenticating.Account` — [Application types](../design/types.md), line 20.

## Formers

_Formers name result shapes evaluated when asked. The source former owns_
_the authored explanation; this section records the generated shape._

### every criterion

Authored path: `Profile.CriteriaList`.
- Covered by [Profile](../design/compositions/Profile.md), line 4.

```former
Former "every criterion" — inputs (); bindings (criterion, name, description); promises exactly one record — forms:
  a record of
    criteria: each BookCataloging._criteria () has (criterion, description, name)
      form a record of
        criterion
        description
        name
```

### the book list

Authored path: `Catalog.BookList`.
- Covered by [Catalog](../design/compositions/Catalog.md), line 3.

```former
Former "the book list" — inputs (); bindings (book, title, author, coverUrl); promises exactly one record — forms:
  a record of
    books: each BookCataloging._described () has (author, book, coverUrl, title)
      form a record of
        author
        book
        coverUrl
        title
```

### the first impression card

Authored path: `Catalog.FirstImpression`.
- Covered by [Catalog](../design/compositions/Catalog.md), line 11.

```former
Former "the first impression card" — inputs (book); bindings (title, author, published, pageCount, coverUrl, genre, summary, setting, theme, tone, name, role, minAge, maxAge, criterion, criterionName, value); promises exactly one record — forms:
  a record of
    characters: each BookCataloging._characters (book) has (maxAge, minAge, name, role)
      form a record of
        maxAge
        minAge
        name
        role
    details: each BookCataloging._book (book) has (author, coverUrl, pageCount, published, setting, summary, title)
      form a record of
        author
        coverUrl
        pageCount
        published
        setting
        summary
        title
    genres: each BookCataloging._genres (book) has (genre)
      form a record of
        genre
    scores: each BookCataloging._scores (book) has (criterion, criterionName, value)
      form a record of
        criterion
        criterionName
        value
    themes: each BookCataloging._themes (book) has (theme)
      form a record of
        theme
    tones: each BookCataloging._tones (book) has (tone)
      form a record of
        tone
```

### the ranked feed

Authored path: `Feed.RankedFeed`.
- Covered by [Feed](../design/compositions/Feed.md), line 8.

```former
Former "the ranked feed" — inputs (user); bindings (item, fit); promises exactly one record — forms:
  a record of
    items: each Recommending._ranked (user) has (fit, item)
      form a record of
        fit
        item
```

### the reader's weights

Authored path: `Profile.WeightList`.
- Covered by [Profile](../design/compositions/Profile.md), line 5.

```former
Former "the reader's weights" — inputs (user); bindings (feature, declared); promises exactly one record — forms:
  a record of
    weights: each Recommending._preferences (user) has (declared, feature)
      form a record of
        criterion: feature
        weight: declared
```

### the shelf view

Authored path: `Shelves.ShelfView`.
- Covered by [Shelves](../design/compositions/Shelves.md), line 7.

```former
Former "the shelf view" — inputs (user, shelf); bindings (item); promises exactly one record — forms:
  a record of
    items: each Shelving._shelf (shelf, user) has (item)
      form a record of
        item
```

### the swipe history

Authored path: `Feed.SwipeHistory`.
- Covered by [Feed](../design/compositions/Feed.md), line 6.

```former
Former "the swipe history" — inputs (user); bindings (item, direction); promises exactly one record — forms:
  a record of
    swipes: each Swiping._swipes (user) has (direction, item)
      form a record of
        direction
        item
```

## Reactions

### Catalog.Card

Authored path: `Catalog.Card`.
- Covered by [Catalog](../design/compositions/Catalog.md), line 10.
- Covered by [Catalog](../design/compositions/Catalog.md), line 15.

```reaction
when RequestBoundary.request (book, path: "/catalog/card", requestId)
then
  RequestBoundary.respond (card: former "the first impression card" with (book), requestId)
```

### Catalog.List

Authored path: `Catalog.List`.
- Covered by [Catalog](../design/compositions/Catalog.md), line 3.
- Covered by [Catalog](../design/compositions/Catalog.md), line 7.

```reaction
when RequestBoundary.request (path: "/catalog/list", requestId)
then
  RequestBoundary.respond (catalog: former "the book list", requestId)
```

### DeliverFaultToAsker

```reaction
when any action is faulted, not asked by DeliverFaultToAsker
where
  earlier, RequestBoundary.request (requestId)
then
  RequestBoundary.respondFramework (error: "INTERNAL_ERROR", requestId)
```

### DeliverRefusalToAsker

```reaction
when any action is refused (message), except RequestBoundary
where
  earlier, RequestBoundary.request (requestId)
then
  RequestBoundary.respond (error: message, requestId)
```

### Feed.History

Authored path: `Feed.History`.
- Covered by [Feed](../design/compositions/Feed.md), line 5.
- Covered by [Feed](../design/compositions/Feed.md), line 12.

```reaction
when RequestBoundary.request (path: "/feed/history", requestId, session)
then
  Sessioning.current (session)
```

### Feed.History#2

Authored path: `Feed.History`.
- Covered by [Feed](../design/compositions/Feed.md), line 5.
- Covered by [Feed](../design/compositions/Feed.md), line 12.

```reaction
when Sessioning.current (session, subject: user), asked by Feed.History
where
  earlier, RequestBoundary.request (path: "/feed/history", requestId, session)
then
  RequestBoundary.respond (history: former "the swipe history" with (user), requestId)
```

### Feed.Like

Authored path: `Feed.Like`.
- Covered by [Feed](../design/compositions/Feed.md), line 17.
- Covered by [Feed](../design/compositions/Feed.md), line 24.

```reaction
when RequestBoundary.request (item, path: "/feed/like", requestId, session)
then
  Sessioning.current (session)
```

### Feed.Like#2

Authored path: `Feed.Like`.
- Covered by [Feed](../design/compositions/Feed.md), line 17.
- Covered by [Feed](../design/compositions/Feed.md), line 24.

```reaction
when Sessioning.current (session, subject: user), asked by Feed.Like
where
  earlier, RequestBoundary.request (item, path: "/feed/like", requestId, session)
then
  Swiping.swipeRight (item, user)
```

### Feed.Like#3

Authored path: `Feed.Like`.
- Covered by [Feed](../design/compositions/Feed.md), line 17.
- Covered by [Feed](../design/compositions/Feed.md), line 24.

```reaction
when Swiping.swipeRight (item, user), asked by Feed.Like#2
then
  Shelving.add (item, shelf: "UP_NEXT", user)
```

### Feed.Like#4

Authored path: `Feed.Like`.
- Covered by [Feed](../design/compositions/Feed.md), line 17.
- Covered by [Feed](../design/compositions/Feed.md), line 24.

```reaction
when Shelving.add (item, shelf: "UP_NEXT", user), asked by Feed.Like#3
then
  Recommending.reinforce (item, user)
```

### Feed.Like#5

Authored path: `Feed.Like`.
- Covered by [Feed](../design/compositions/Feed.md), line 17.
- Covered by [Feed](../design/compositions/Feed.md), line 24.

```reaction
when Recommending.reinforce (item, user), asked by Feed.Like#4
where
  earlier, RequestBoundary.request (item, path: "/feed/like", requestId, session)
then
  RequestBoundary.respond (item, requestId)
```

### Feed.Pass

Authored path: `Feed.Pass`.
- Covered by [Feed](../design/compositions/Feed.md), line 19.
- Covered by [Feed](../design/compositions/Feed.md), line 25.

```reaction
when RequestBoundary.request (item, path: "/feed/pass", requestId, session)
then
  Sessioning.current (session)
```

### Feed.Pass#2

Authored path: `Feed.Pass`.
- Covered by [Feed](../design/compositions/Feed.md), line 19.
- Covered by [Feed](../design/compositions/Feed.md), line 25.

```reaction
when Sessioning.current (session, subject: user), asked by Feed.Pass
where
  earlier, RequestBoundary.request (item, path: "/feed/pass", requestId, session)
then
  Swiping.swipeLeft (item, user)
```

### Feed.Pass#3

Authored path: `Feed.Pass`.
- Covered by [Feed](../design/compositions/Feed.md), line 19.
- Covered by [Feed](../design/compositions/Feed.md), line 25.

```reaction
when Swiping.swipeLeft (item, user), asked by Feed.Pass#2
then
  Recommending.weaken (item, user)
```

### Feed.Pass#4

Authored path: `Feed.Pass`.
- Covered by [Feed](../design/compositions/Feed.md), line 19.
- Covered by [Feed](../design/compositions/Feed.md), line 25.

```reaction
when Recommending.weaken (item, user), asked by Feed.Pass#3
where
  earlier, RequestBoundary.request (item, path: "/feed/pass", requestId, session)
then
  RequestBoundary.respond (item, requestId)
```

### Feed.Ranked

Authored path: `Feed.Ranked`.
- Covered by [Feed](../design/compositions/Feed.md), line 8.
- Covered by [Feed](../design/compositions/Feed.md), line 14.

```reaction
when RequestBoundary.request (path: "/feed/ranked", requestId, session)
then
  Sessioning.current (session)
```

### Feed.Ranked#2

Authored path: `Feed.Ranked`.
- Covered by [Feed](../design/compositions/Feed.md), line 8.
- Covered by [Feed](../design/compositions/Feed.md), line 14.

```reaction
when Sessioning.current (session, subject: user), asked by Feed.Ranked
where
  earlier, RequestBoundary.request (path: "/feed/ranked", requestId, session)
then
  RequestBoundary.respond (ranking: former "the ranked feed" with (user), requestId)
```

### Feed.Reconsider

Authored path: `Feed.Reconsider`.
- Covered by [Feed](../design/compositions/Feed.md), line 20.
- Covered by [Feed](../design/compositions/Feed.md), line 26.

```reaction
when RequestBoundary.request (item, path: "/feed/reconsider", requestId, session)
then
  Sessioning.current (session)
```

### Feed.Reconsider#2

Authored path: `Feed.Reconsider`.
- Covered by [Feed](../design/compositions/Feed.md), line 20.
- Covered by [Feed](../design/compositions/Feed.md), line 26.

```reaction
when Sessioning.current (session, subject: user), asked by Feed.Reconsider
where
  earlier, RequestBoundary.request (item, path: "/feed/reconsider", requestId, session)
then
  Swiping.reconsider (item, user)
```

### Feed.Reconsider#3

Authored path: `Feed.Reconsider`.
- Covered by [Feed](../design/compositions/Feed.md), line 20.
- Covered by [Feed](../design/compositions/Feed.md), line 26.

```reaction
when Swiping.reconsider (item, user), asked by Feed.Reconsider#2
where
  earlier, RequestBoundary.request (item, path: "/feed/reconsider", requestId, session)
then
  RequestBoundary.respond (item, requestId)
```

### Growing.AddHarvestedBook

Authored path: `Growing.AddHarvestedBook`.
- Covered by [Growing](../design/compositions/Growing.md), line 15.

```reaction
when Harvesting.harvest (batch, topic)
where
  Harvesting._finds (batch, topic) has (author, coverUrl, key, pageCount, published, title)
then
  BookCataloging.addBook (author, coverUrl, isbn: key, pageCount, published, title)
```

### Growing.CriterionBecomesAspect

Authored path: `Growing.CriterionBecomesAspect`.
- Covered by [Growing](../design/compositions/Growing.md), line 34.

```reaction
when BookCataloging.defineCriterion (description, name)
then
  Drafting.defineAspect (description, name)
```

### Growing.DescribeDrafted

Authored path: `Growing.DescribeDrafted`.
- Covered by [Growing](../design/compositions/Growing.md), line 24.

```reaction
when Drafting.draft (item: book, draft)
at the flow's settlement frontier
where
  Drafting._draft (item: book) has (setting, summary)
then
  BookCataloging.describe (book, setting, summary)
```

### Growing.DraftAddedBook

Authored path: `Growing.DraftAddedBook`.
- Covered by [Growing](../design/compositions/Growing.md), line 17.

```reaction
when BookCataloging.addBook (isbn, book)
where
  Harvesting._find (key: isbn) has (author, source, title)
then
  Drafting.draft (author, item: book, source, title)
```

### Growing.FillFromDraft:characters

Authored path: `Growing.FillFromDraft`.
- Covered by [Growing](../design/compositions/Growing.md), line 22.

```reaction
when Drafting.draft (item: book, draft)
where
  Drafting._figures (draft) has (maxAge, minAge, name, role)
then
  BookCataloging.addCharacter (book, maxAge, minAge, name, role)
```

### Growing.FillFromDraft:themes

Authored path: `Growing.FillFromDraft`.
- Covered by [Growing](../design/compositions/Growing.md), line 22.

```reaction
when Drafting.draft (item: book, draft)
where
  Drafting._themes (draft) has (theme)
then
  BookCataloging.addTheme (book, theme)
```

### Growing.FillFromDraft:tones

Authored path: `Growing.FillFromDraft`.
- Covered by [Growing](../design/compositions/Growing.md), line 22.

```reaction
when Drafting.draft (item: book, draft)
where
  Drafting._tones (draft) has (tone)
then
  BookCataloging.addTone (book, tone)
```

### Growing.FinishBatch

Authored path: `Growing.FinishBatch`.
- Covered by [Growing](../design/compositions/Growing.md), line 31.

```reaction
when Harvesting.start (batch)
at the flow's settlement frontier
then
  Harvesting.finish (batch)
```

### Growing.GenreFromTopic

Authored path: `Growing.GenreFromTopic`.
- Covered by [Growing](../design/compositions/Growing.md), line 16.

```reaction
when BookCataloging.addBook (isbn, book)
where
  Harvesting._find (key: isbn) has (topic)
then
  BookCataloging.addGenre (book, genre: topic)
```

### Growing.Request

Authored path: `Growing.Request`.
- Covered by [Growing](../design/compositions/Growing.md), line 5.
- Covered by [Growing](../design/compositions/Growing.md), line 12.

```reaction
when RequestBoundary.request (path: "/catalog/grow", requestId, session)
where
  instant is the current flow's instant
then
  Sessioning.current (session)
```

### Growing.Request#2

Authored path: `Growing.Request`.
- Covered by [Growing](../design/compositions/Growing.md), line 5.
- Covered by [Growing](../design/compositions/Growing.md), line 12.

```reaction
when Sessioning.current (session, subject: user), asked by Growing.Request
where
  instant is the current flow's instant
then
  Harvesting.start (now: instant, size: 20)
```

### Growing.Request#3

Authored path: `Growing.Request`.
- Covered by [Growing](../design/compositions/Growing.md), line 5.
- Covered by [Growing](../design/compositions/Growing.md), line 12.

```reaction
when Harvesting.start (now: instant, size: 20, batch), asked by Growing.Request#2
where
  earlier, RequestBoundary.request (path: "/catalog/grow", requestId, session)
then
  RequestBoundary.respond (batch, requestId)
```

### Growing.Request:catalog-genres#4

Authored path: `Growing.Request`.
- Covered by [Growing](../design/compositions/Growing.md), line 5.
- Covered by [Growing](../design/compositions/Growing.md), line 12.

```reaction
when RequestBoundary.respond (batch, requestId), asked by Growing.Request#3
where
  BookCataloging._described () has (book)
  BookCataloging._genres (book) has (genre)
  earlier, Sessioning.current (session, subject: user), asked by Growing.Request
  no Swiping._swipes (user) has (direction: "RIGHT")
then
  Harvesting.harvest (batch, count: 5, topic: genre)
```

### Growing.Request:liked-genres#4

Authored path: `Growing.Request`.
- Covered by [Growing](../design/compositions/Growing.md), line 5.
- Covered by [Growing](../design/compositions/Growing.md), line 12.

```reaction
when RequestBoundary.respond (batch, requestId), asked by Growing.Request#3
where
  earlier, Sessioning.current (session, subject: user), asked by Growing.Request
  Swiping._swipes (user) has (direction: "RIGHT", item)
  BookCataloging._genres (book: item) has (genre)
then
  Harvesting.harvest (batch, count: 5, topic: genre)
```

### Growing.RetryPendingDrafts

Authored path: `Growing.RetryPendingDrafts`.
- Covered by [Growing](../design/compositions/Growing.md), line 20.

```reaction
when Harvesting.start (batch)
at the flow's settlement frontier
where
  BookCataloging._pending () has (book, isbn)
  no Drafting._draft (item: book)
  Harvesting._find (key: isbn) has (author, source, title)
then
  Drafting.draft (author, item: book, source, title)
```

### Growing.ScoreBecomesFeature

Authored path: `Growing.ScoreBecomesFeature`.
- Covered by [Growing](../design/compositions/Growing.md), line 28.

```reaction
when BookCataloging.scoreBook (book, criterion, value)
then
  Recommending.setFeature (feature: criterion, item: book, value)
```

### Growing.ScoreDescribed

Authored path: `Growing.ScoreDescribed`.
- Covered by [Growing](../design/compositions/Growing.md), line 25.

```reaction
when BookCataloging.describe (book)
where
  Drafting._draft (item: book) has (draft)
  Drafting._ratings (draft) has (aspectName, value)
  BookCataloging._criterionByName (name: aspectName) has (criterion)
then
  BookCataloging.scoreBook (book, criterion, value)
```

### Profile.View

Authored path: `Profile.View`.
- Covered by [Profile](../design/compositions/Profile.md), line 3.
- Covered by [Profile](../design/compositions/Profile.md), line 9.

```reaction
when RequestBoundary.request (path: "/profile/view", requestId, session)
then
  Sessioning.current (session)
```

### Profile.View#2

Authored path: `Profile.View`.
- Covered by [Profile](../design/compositions/Profile.md), line 3.
- Covered by [Profile](../design/compositions/Profile.md), line 9.

```reaction
when Sessioning.current (session, subject: user), asked by Profile.View
where
  earlier, RequestBoundary.request (path: "/profile/view", requestId, session)
then
  RequestBoundary.respond (criteria: former "every criterion", requestId, weights: former "the reader's weights" with (user))
```

### Profile.Weigh

Authored path: `Profile.Weigh`.
- Covered by [Profile](../design/compositions/Profile.md), line 12.
- Covered by [Profile](../design/compositions/Profile.md), line 20.

```reaction
when RequestBoundary.request (criterion, path: "/profile/weigh", requestId, session, weight)
then
  Sessioning.current (session)
```

### Profile.Weigh#2

Authored path: `Profile.Weigh`.
- Covered by [Profile](../design/compositions/Profile.md), line 12.
- Covered by [Profile](../design/compositions/Profile.md), line 20.

```reaction
when Sessioning.current (session, subject: user), asked by Profile.Weigh
where
  earlier, RequestBoundary.request (criterion, path: "/profile/weigh", requestId, session, weight)
then
  Recommending.declare (feature: criterion, user, weight)
```

### Profile.Weigh#3

Authored path: `Profile.Weigh`.
- Covered by [Profile](../design/compositions/Profile.md), line 12.
- Covered by [Profile](../design/compositions/Profile.md), line 20.

```reaction
when Recommending.declare (feature: criterion, user, weight), asked by Profile.Weigh#2
where
  earlier, RequestBoundary.request (criterion, path: "/profile/weigh", requestId, session, weight)
then
  RequestBoundary.respond (criterion, requestId, weight)
```

### Sessions.Current

Authored path: `Sessions.Current`.
- Covered by [Sessions](../design/compositions/Sessions.md), line 14.
- Covered by [Sessions](../design/compositions/Sessions.md), line 20.

```reaction
when RequestBoundary.request (path: "/auth/current", requestId, session)
then
  Sessioning.current (session)
```

### Sessions.Current#2

Authored path: `Sessions.Current`.
- Covered by [Sessions](../design/compositions/Sessions.md), line 14.
- Covered by [Sessions](../design/compositions/Sessions.md), line 20.

```reaction
when Sessioning.current (session, subject: account), asked by Sessions.Current
where
  earlier, RequestBoundary.request (path: "/auth/current", requestId, session)
then
  RequestBoundary.respond (account, requestId)
```

### Sessions.Register

Authored path: `Sessions.Register`.
- Covered by [Sessions](../design/compositions/Sessions.md), line 4.
- Covered by [Sessions](../design/compositions/Sessions.md), line 10.

```reaction
when RequestBoundary.request (password, path: "/auth/register", requestId, username)
then
  Authenticating.register (password, username)
```

### Sessions.Register#2

Authored path: `Sessions.Register`.
- Covered by [Sessions](../design/compositions/Sessions.md), line 4.
- Covered by [Sessions](../design/compositions/Sessions.md), line 10.

```reaction
when Authenticating.register (password, username, account), asked by Sessions.Register
then
  Sessioning.start (subject: account)
```

### Sessions.Register#3

Authored path: `Sessions.Register`.
- Covered by [Sessions](../design/compositions/Sessions.md), line 4.
- Covered by [Sessions](../design/compositions/Sessions.md), line 10.

```reaction
when Sessioning.start (subject: account, expiresAt, session), asked by Sessions.Register#2
where
  earlier, RequestBoundary.request (password, path: "/auth/register", requestId, username)
then
  RequestBoundary.respond (account, expiresAt, requestId, session)
```

### Sessions.SignIn

Authored path: `Sessions.SignIn`.
- Covered by [Sessions](../design/compositions/Sessions.md), line 5.
- Covered by [Sessions](../design/compositions/Sessions.md), line 11.

```reaction
when RequestBoundary.request (password, path: "/auth/sign-in", requestId, username)
then
  Authenticating.authenticate (password, username)
```

### Sessions.SignIn#2

Authored path: `Sessions.SignIn`.
- Covered by [Sessions](../design/compositions/Sessions.md), line 5.
- Covered by [Sessions](../design/compositions/Sessions.md), line 11.

```reaction
when Authenticating.authenticate (password, username, account), asked by Sessions.SignIn
then
  Sessioning.start (subject: account)
```

### Sessions.SignIn#3

Authored path: `Sessions.SignIn`.
- Covered by [Sessions](../design/compositions/Sessions.md), line 5.
- Covered by [Sessions](../design/compositions/Sessions.md), line 11.

```reaction
when Sessioning.start (subject: account, expiresAt, session), asked by Sessions.SignIn#2
where
  earlier, RequestBoundary.request (password, path: "/auth/sign-in", requestId, username)
then
  RequestBoundary.respond (account, expiresAt, requestId, session)
```

### Sessions.SignOut

Authored path: `Sessions.SignOut`.
- Covered by [Sessions](../design/compositions/Sessions.md), line 17.
- Covered by [Sessions](../design/compositions/Sessions.md), line 21.

```reaction
when RequestBoundary.request (path: "/auth/sign-out", requestId, session)
then
  Sessioning.end (session)
```

### Sessions.SignOut#2

Authored path: `Sessions.SignOut`.
- Covered by [Sessions](../design/compositions/Sessions.md), line 17.
- Covered by [Sessions](../design/compositions/Sessions.md), line 21.

```reaction
when Sessioning.end (session, ended), asked by Sessions.SignOut
where
  earlier, RequestBoundary.request (path: "/auth/sign-out", requestId, session)
then
  RequestBoundary.respond (ended, requestId)
```

### Shelves.Add

Authored path: `Shelves.Add`.
- Covered by [Shelves](../design/compositions/Shelves.md), line 13.
- Covered by [Shelves](../design/compositions/Shelves.md), line 17.

```reaction
when RequestBoundary.request (item, path: "/shelves/add", requestId, session, shelf)
then
  Sessioning.current (session)
```

### Shelves.Add#2

Authored path: `Shelves.Add`.
- Covered by [Shelves](../design/compositions/Shelves.md), line 13.
- Covered by [Shelves](../design/compositions/Shelves.md), line 17.

```reaction
when Sessioning.current (session, subject: user), asked by Shelves.Add
where
  earlier, RequestBoundary.request (item, path: "/shelves/add", requestId, session, shelf)
then
  Shelving.add (item, shelf, user)
```

### Shelves.Add#3

Authored path: `Shelves.Add`.
- Covered by [Shelves](../design/compositions/Shelves.md), line 13.
- Covered by [Shelves](../design/compositions/Shelves.md), line 17.

```reaction
when Shelving.add (item, shelf, user), asked by Shelves.Add#2
where
  earlier, RequestBoundary.request (item, path: "/shelves/add", requestId, session, shelf)
then
  RequestBoundary.respond (item, requestId)
```

### Shelves.Remove

Authored path: `Shelves.Remove`.
- Covered by [Shelves](../design/compositions/Shelves.md), line 14.
- Covered by [Shelves](../design/compositions/Shelves.md), line 18.

```reaction
when RequestBoundary.request (item, path: "/shelves/remove", requestId, session, shelf)
then
  Sessioning.current (session)
```

### Shelves.Remove#2

Authored path: `Shelves.Remove`.
- Covered by [Shelves](../design/compositions/Shelves.md), line 14.
- Covered by [Shelves](../design/compositions/Shelves.md), line 18.

```reaction
when Sessioning.current (session, subject: user), asked by Shelves.Remove
where
  earlier, RequestBoundary.request (item, path: "/shelves/remove", requestId, session, shelf)
then
  Shelving.remove (item, shelf, user)
```

### Shelves.Remove#3

Authored path: `Shelves.Remove`.
- Covered by [Shelves](../design/compositions/Shelves.md), line 14.
- Covered by [Shelves](../design/compositions/Shelves.md), line 18.

```reaction
when Shelving.remove (item, shelf, user), asked by Shelves.Remove#2
where
  earlier, RequestBoundary.request (item, path: "/shelves/remove", requestId, session, shelf)
then
  RequestBoundary.respond (item, requestId)
```

### Shelves.View

Authored path: `Shelves.View`.
- Covered by [Shelves](../design/compositions/Shelves.md), line 6.
- Covered by [Shelves](../design/compositions/Shelves.md), line 10.

```reaction
when RequestBoundary.request (path: "/shelves/view", requestId, session, shelf)
then
  Sessioning.current (session)
```

### Shelves.View#2

Authored path: `Shelves.View`.
- Covered by [Shelves](../design/compositions/Shelves.md), line 6.
- Covered by [Shelves](../design/compositions/Shelves.md), line 10.

```reaction
when Sessioning.current (session, subject: user), asked by Shelves.View
where
  earlier, RequestBoundary.request (path: "/shelves/view", requestId, session, shelf)
then
  RequestBoundary.respond (requestId, shelf: former "the shelf view" with (shelf, user))
```

## Endpoint input contracts

Before recording an action ask, the boundary rejects a body that is not an
object or lacks a required key. The response uses `INVALID_INPUT` and names
the path or missing key. A declared default fills an absent key. Endpoints
not listed here have no explicit input contract.

- `/auth/current` — requires `session`
- `/auth/register` — requires `username`, `password`
- `/auth/sign-in` — requires `username`, `password`
- `/auth/sign-out` — requires `session`
- `/catalog/card` — requires `book`
- `/catalog/grow` — requires `session`
- `/feed/history` — requires `session`
- `/feed/like` — requires `session`, `item`
- `/feed/pass` — requires `session`, `item`
- `/feed/ranked` — requires `session`
- `/feed/reconsider` — requires `session`, `item`
- `/profile/view` — requires `session`
- `/profile/weigh` — requires `session`, `criterion`, `weight`
- `/shelves/add` — requires `session`, `item`, `shelf`
- `/shelves/remove` — requires `session`, `item`, `shelf`
- `/shelves/view` — requires `session`, `shelf`
