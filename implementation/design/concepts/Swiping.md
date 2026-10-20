# Swiping

## Purpose

Let a reader give each item a quick yes-or-no first impression, so they never see the same
item twice or stall deciding.

## Principle

Jane swipes right on Brave New World and left on a fantasy adventure. Neither is shown to her
again, and her swipes record that she liked one and passed on the other. When she reconsiders
the fantasy adventure, it is no longer swiped and can be shown to her again.

## Types

```types
external User
  The reader who swipes.

external Item
  The thing being swiped on, such as a book.

Direction is RIGHT or LEFT
```

## State

```state
a set of Swipes with
  a User
  an Item
  a direction Direction
  a swipedAt DateTime
  unique user and item
```

## Actions

```actions
swipeRight(user: User, item: Item) : returns (item: Item)
  where user has already swiped on item
  then
    refuses ALREADY_SWIPED "You've already swiped on this book."
  where user has not swiped on item
  then
    add a new swipe by user on item, direction RIGHT, at the current time
    returns item

swipeLeft(user: User, item: Item) : returns (item: Item)
  where user has already swiped on item
  then
    refuses ALREADY_SWIPED "You've already swiped on this book."
  where user has not swiped on item
  then
    add a new swipe by user on item, direction LEFT, at the current time
    returns item

reconsider(user: User, item: Item) : returns (item: Item)
  where user has not swiped on item
  then
    refuses NOT_SWIPED "You haven't swiped on this book."
  where user has swiped on item
  then
    remove that swipe
    returns item
```

## Queries

```queries
_swipes(user: User) : many (item: Item, direction: Direction)
  Answers each of the user's swipes, newest first, and no rows when there are none.
```