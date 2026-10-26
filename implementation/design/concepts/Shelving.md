# Shelving

## Purpose

Keep the books a reader means to read, has read, or loved in named shelves, so an interesting
book is never lost track of and a finished one is remembered.

## Principle

Jane puts brave-new-world on her UP_NEXT shelf, then klara-and-the-sun. Her UP_NEXT shelf
shows both. After she finishes brave-new-world, she removes it from UP_NEXT and adds it to
FINISHED. She loved it, so she also adds it to FAVORITES, while klara-and-the-sun, once
finished, goes only on FINISHED. Each shelf shows only what she put there.

## Types

```types
external User
  The reader who owns the shelves.

external Item
  The thing placed on a shelf, such as a book.

ShelfName is UP_NEXT or FINISHED or FAVORITES
```

## State

```state
a set of Placements with
  a User
  an Item
  a shelf ShelfName
  unique user and item and shelf
```

## Actions

```actions
add(user: User, item: Item, shelf: ShelfName) : returns (item: Item)
  where item is already on that shelf for user
  then
    refuses ALREADY_SHELVED "That book is already on this shelf."
  where item is not on that shelf for user
  then
    add a new placement with user, item and shelf
    returns item

remove(user: User, item: Item, shelf: ShelfName) : returns (item: Item)
  where item is on that shelf for user
  then
    remove that placement
    returns item
  where item is not on that shelf for user
  then
    refuses NOT_SHELVED "That book is not on this shelf."
```

## Queries

```queries
_shelf(user: User, shelf: ShelfName) : many (item: Item)
  Answers each item on the user's shelf, oldest first, and no rows when the shelf is empty.
```