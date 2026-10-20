<!-- Generated from the Novelty assembly. Do not edit. -->
<!-- Manifest producer: @mit-sdg/sync-engine@1.1.0; concept specification: sync-engine.concept-specification@1; renderer: @mit-sdg/sync-engine@1.1.0. -->

# Novelty — assembled read-back

_Assembled by sync-engine from registered concepts and composition. Edit the concept_
_specifications and composition source, then regenerate this file._

## Concepts

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
- `_criterionByName(name: String) : optional (criterion: Criterion)`

#### Instances

- `BookCataloging` — instance of `BookCataloging` — [Application types](../design/types.md), line 11.

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

- `Shelving` — instance of `Shelving` — [Application types](../design/types.md), line 13.
  - `Item` is `BookCataloging.Book` — [Application types](../design/types.md), line 15.
  - `User` is `Name` — [Application types](../design/types.md), line 14.

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

- `Swiping` — instance of `Swiping` — [Application types](../design/types.md), line 17.
  - `Item` is `BookCataloging.Book` — [Application types](../design/types.md), line 19.
  - `User` is `Name` — [Application types](../design/types.md), line 18.

## Application types

Concrete types:

- `Name` — [Application types](../design/types.md), line 6.

## Formers

_Formers name result shapes evaluated when asked. The source former owns_
_the authored explanation; this section records the generated shape._

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

### the shelf view

Authored path: `Shelves.ShelfView`.
- Covered by [Shelves](../design/compositions/Shelves.md), line 4.

```former
Former "the shelf view" — inputs (user, shelf); bindings (item); promises exactly one record — forms:
  a record of
    items: each Shelving._shelf (shelf, user) has (item)
      form a record of
        item
```

### the swipe history

Authored path: `Feed.SwipeHistory`.
- Covered by [Feed](../design/compositions/Feed.md), line 4.

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
- Covered by [Feed](../design/compositions/Feed.md), line 3.
- Covered by [Feed](../design/compositions/Feed.md), line 7.

```reaction
when RequestBoundary.request (path: "/feed/history", requestId, user)
then
  RequestBoundary.respond (history: former "the swipe history" with (user), requestId)
```

### Feed.Like

Authored path: `Feed.Like`.
- Covered by [Feed](../design/compositions/Feed.md), line 10.
- Covered by [Feed](../design/compositions/Feed.md), line 16.

```reaction
when RequestBoundary.request (item, path: "/feed/like", requestId, user)
then
  Swiping.swipeRight (item, user)
```

### Feed.Like#2

Authored path: `Feed.Like`.
- Covered by [Feed](../design/compositions/Feed.md), line 10.
- Covered by [Feed](../design/compositions/Feed.md), line 16.

```reaction
when Swiping.swipeRight (item, user), asked by Feed.Like
then
  Shelving.add (item, shelf: "UP_NEXT", user)
```

### Feed.Like#3

Authored path: `Feed.Like`.
- Covered by [Feed](../design/compositions/Feed.md), line 10.
- Covered by [Feed](../design/compositions/Feed.md), line 16.

```reaction
when Shelving.add (item, shelf: "UP_NEXT", user), asked by Feed.Like#2
where
  earlier, RequestBoundary.request (item, path: "/feed/like", requestId, user)
then
  RequestBoundary.respond (item, requestId)
```

### Feed.Pass

Authored path: `Feed.Pass`.
- Covered by [Feed](../design/compositions/Feed.md), line 11.
- Covered by [Feed](../design/compositions/Feed.md), line 17.

```reaction
when RequestBoundary.request (item, path: "/feed/pass", requestId, user)
then
  Swiping.swipeLeft (item, user)
```

### Feed.Pass#2

Authored path: `Feed.Pass`.
- Covered by [Feed](../design/compositions/Feed.md), line 11.
- Covered by [Feed](../design/compositions/Feed.md), line 17.

```reaction
when Swiping.swipeLeft (item, user), asked by Feed.Pass
where
  earlier, RequestBoundary.request (item, path: "/feed/pass", requestId, user)
then
  RequestBoundary.respond (item, requestId)
```

### Feed.Reconsider

Authored path: `Feed.Reconsider`.
- Covered by [Feed](../design/compositions/Feed.md), line 12.
- Covered by [Feed](../design/compositions/Feed.md), line 18.

```reaction
when RequestBoundary.request (item, path: "/feed/reconsider", requestId, user)
then
  Swiping.reconsider (item, user)
```

### Feed.Reconsider#2

Authored path: `Feed.Reconsider`.
- Covered by [Feed](../design/compositions/Feed.md), line 12.
- Covered by [Feed](../design/compositions/Feed.md), line 18.

```reaction
when Swiping.reconsider (item, user), asked by Feed.Reconsider
where
  earlier, RequestBoundary.request (item, path: "/feed/reconsider", requestId, user)
then
  RequestBoundary.respond (item, requestId)
```

### Shelves.Add

Authored path: `Shelves.Add`.
- Covered by [Shelves](../design/compositions/Shelves.md), line 10.
- Covered by [Shelves](../design/compositions/Shelves.md), line 14.

```reaction
when RequestBoundary.request (item, path: "/shelves/add", requestId, shelf, user)
then
  Shelving.add (item, shelf, user)
```

### Shelves.Add#2

Authored path: `Shelves.Add`.
- Covered by [Shelves](../design/compositions/Shelves.md), line 10.
- Covered by [Shelves](../design/compositions/Shelves.md), line 14.

```reaction
when Shelving.add (item, shelf, user), asked by Shelves.Add
where
  earlier, RequestBoundary.request (item, path: "/shelves/add", requestId, shelf, user)
then
  RequestBoundary.respond (item, requestId)
```

### Shelves.Remove

Authored path: `Shelves.Remove`.
- Covered by [Shelves](../design/compositions/Shelves.md), line 11.
- Covered by [Shelves](../design/compositions/Shelves.md), line 15.

```reaction
when RequestBoundary.request (item, path: "/shelves/remove", requestId, shelf, user)
then
  Shelving.remove (item, shelf, user)
```

### Shelves.Remove#2

Authored path: `Shelves.Remove`.
- Covered by [Shelves](../design/compositions/Shelves.md), line 11.
- Covered by [Shelves](../design/compositions/Shelves.md), line 15.

```reaction
when Shelving.remove (item, shelf, user), asked by Shelves.Remove
where
  earlier, RequestBoundary.request (item, path: "/shelves/remove", requestId, shelf, user)
then
  RequestBoundary.respond (item, requestId)
```

### Shelves.View

Authored path: `Shelves.View`.
- Covered by [Shelves](../design/compositions/Shelves.md), line 3.
- Covered by [Shelves](../design/compositions/Shelves.md), line 7.

```reaction
when RequestBoundary.request (path: "/shelves/view", requestId, shelf, user)
then
  RequestBoundary.respond (requestId, shelf: former "the shelf view" with (shelf, user))
```

## Endpoint input contracts

Before recording an action ask, the boundary rejects a body that is not an
object or lacks a required key. The response uses `INVALID_INPUT` and names
the path or missing key. A declared default fills an absent key. Endpoints
not listed here have no explicit input contract.

- `/catalog/card` — requires `book`
- `/feed/history` — requires `user`
- `/feed/like` — requires `user`, `item`
- `/feed/pass` — requires `user`, `item`
- `/feed/reconsider` — requires `user`, `item`
- `/shelves/add` — requires `user`, `item`, `shelf`
- `/shelves/remove` — requires `user`, `item`, `shelf`
- `/shelves/view` — requires `user`, `shelf`
