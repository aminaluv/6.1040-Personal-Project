# BookCataloging

## Purpose

Give readers a clear, consistent, and rich description of every book (who it's about, where it happens, and how it matches the user's criteria), so readers can make an informed decision about each book and whether they will like the book. 

## Principle

A reader defines the criterion social-commentary and adds brave_new_world with its title,
author and cover. Once it's described with a spoiler-free summary, setting, characters,
themes and tones, and scored 9 on social-commentary, a reader looking at it can see what the
book is about and how strongly it delivers social commentary.

## Types

```types
Status is PENDING or DESCRIBED

Role is MAIN or SUPPORTING
```

## State

```state
a set of Criteria with
  a unique name String
  a description String

a set of Books with
  a unique isbn String
  a title String
  an author String
  a published Date
  a pageCount Number
  a coverUrl String
  a genres set of String
  a status Status
  a summary String
  an optional setting String
  a themes set of String
  a tones set of String

a set of Characters with
  a Book
  a name String
  a role Role
  a minAge Number
  a maxAge Number

a set of Scores with
  a Book
  a Criterion
  a value Number
  unique book and criterion
```

## Actions

```actions
defineCriterion(name: String, description: String) : returns (criterion: Criterion)
  where a criterion already has name
  then
    refuses CRITERION_EXISTS "A criterion with that name already exists."
  where no criterion has name
  then
    add a new criterion with name and description
    returns criterion

addBook(isbn: String, title: String, author: String, published: Date, pageCount: Number, coverUrl: String) : returns (book: Book)
  where a book already has isbn
  then
    refuses DUPLICATE_ISBN "A book with that ISBN is already in the catalog."
  where no book has isbn
  then
    add a new book with these details, status PENDING, no summary or setting, and no genres, themes or tones
    returns book

addCharacter(book: Book, name: String, role: Role, minAge: Number, maxAge: Number) : returns (character: Character)
  where book is not a PENDING book
  then
    refuses BOOK_NOT_PENDING "Characters can only be added before a book is described."
  where book is a PENDING book and minAge is greater than maxAge
  then
    refuses INVALID_AGE_RANGE "The minimum age must not exceed the maximum age."
  where book is a PENDING book and minAge is at most maxAge
  then
    add a new character for book with name, role, minAge and maxAge
    returns character

addGenre(book: Book, genre: String) : returns (book: Book)
  where book is not in Books
  then
    refuses NO_SUCH_BOOK "There is no such book."
  where book is in Books
  then
    add genre to the genres of book
    returns book

addTheme(book: Book, theme: String) : returns (book: Book)
  where book is not a PENDING book
  then
    refuses BOOK_NOT_PENDING "Themes can only be added before a book is described."
  where book is a PENDING book
  then
    add theme to the themes of book
    returns book

addTone(book: Book, tone: String) : returns (book: Book)
  where book is not a PENDING book
  then
    refuses BOOK_NOT_PENDING "Tones can only be added before a book is described."
  where book is a PENDING book
  then
    add tone to the tones of book
    returns book

describe(book: Book, summary: String, setting?: String) : returns (book: Book)
  where book is not a PENDING book
  then
    refuses BOOK_NOT_PENDING "Only a book that hasn't been described yet can be described."
  where book is a PENDING book
  then
    set the summary of book, and its setting if one is given
    set the status of book to DESCRIBED
    returns book

scoreBook(book: Book, criterion: Criterion, value: Number) : returns (book: Book)
  where book is not a DESCRIBED book
  then
    refuses BOOK_NOT_DESCRIBED "Only a described book can be scored."
  where book is a DESCRIBED book and criterion is not in Criteria
  then
    refuses NO_SUCH_CRITERION "There is no such criterion."
  where book is a DESCRIBED book, criterion is in Criteria, and value is outside 0 to 10
  then
    refuses INVALID_SCORE "A score must be between 0 and 10."
  where book is a DESCRIBED book, criterion is in Criteria, and value is from 0 to 10
  then
    set the score of book on criterion to value, replacing any earlier score
    returns book

resetDescription(book: Book) : returns (book: Book)
  where book is not a DESCRIBED book
  then
    refuses BOOK_NOT_DESCRIBED "Only a described book can be reset."
  where book is a DESCRIBED book
  then
    remove the characters and scores of book
    remove the summary and setting of book, and empty its themes and tones
    set the status of book to PENDING
    returns book
```

## Queries

```queries
_described() : many (book: Book, title: String, author: String, coverUrl: String)
  Answers every DESCRIBED book, ordered by title, and no rows when there are none.

_book(book: Book) : optional (title: String, author: String, published: Date, pageCount: Number, coverUrl: String, summary: String, setting: String)
  Answers the book's details, with empty text for a missing summary or setting, and no row
  when the book is unknown.

_genres(book: Book) : many (genre: String)
  Answers each genre of the book, in alphabetical order.

_themes(book: Book) : many (theme: String)
  Answers each theme of the book, in alphabetical order.

_tones(book: Book) : many (tone: String)
  Answers each tone of the book, in alphabetical order.

_characters(book: Book) : many (name: String, role: Role, minAge: Number, maxAge: Number)
  Answers each character of the book, MAIN characters first, then by name.

_scores(book: Book) : many (criterion: Criterion, criterionName: String, value: Number)
  Answers each score of the book with its criterion's name, ordered by that name.

_criteria() : many (criterion: Criterion, name: String, description: String)
  Answers every criterion, ordered by name, and no rows when there are none.

_criterionByName(name: String) : optional (criterion: Criterion)
  Answers the criterion with that name, and no row when there is none.

_pending() : many (book: Book, isbn: String, title: String, author: String)
  Answers every PENDING book, ordered by title, and no rows when there are none.
```