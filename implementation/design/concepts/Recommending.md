# Recommending

## Purpose

Rank items for each user by how well they fit the user's tastes, learned from what they say
and how they react, so users see what suits them first instead of wading through everything.

## Principle

Brave New World scores 10 on social-commentary and 2 on pacing; The Hobbit scores 2 and 7.
Jane likes Brave New World, which raises her learned weight on social-commentary and lowers
it on pacing. Afterward, among books she hasn't seen, ones strong on social commentary rank
above The Hobbit. Each further reaction keeps sharpening her ranking.

## Types

```types
external User
  The person items are ranked for.

external Item
  The thing being ranked, such as a book.

external Feature
  A quality items are scored on, such as social commentary.
```

## State

```state
a set of ItemFeatures with
  an Item
  a Feature
  a value Number
  unique item and feature

a set of Preferences with
  a User
  a Feature
  a declared Number
  a learned Number
  unique user and feature
  Rule: declared is from 0 to 5, and learned is from -5 to 5.
```

## Actions

```actions
setFeature(item: Item, feature: Feature, value: Number) : returns (item: Item)
  where value is outside 0 to 10
  then
    refuses INVALID_VALUE "A feature value must be between 0 and 10."
  where value is from 0 to 10
  then
    set the value of item on feature to value, replacing any earlier value
    returns item

clearItem(item: Item) : returns (item: Item)
  where item has no feature values
  then
    refuses UNKNOWN_ITEM "That item has no feature values."
  where item has feature values
  then
    remove every feature value of item
    returns item

declare(user: User, feature: Feature, weight: Number) : returns (feature: Feature)
  where weight is outside 0 to 5
  then
    refuses INVALID_WEIGHT "A declared weight must be between 0 and 5."
  where weight is from 0 to 5
  then
    set the declared weight of user on feature to weight, keeping any learned weight
    returns feature

reinforce(user: User, item: Item) : returns (item: Item)
  where item has no feature values
  then
    refuses UNKNOWN_ITEM "That item has no feature values."
  where item has feature values
  then
    for each feature of item, raise the learned weight of user on feature by half of
    (value - 5) / 5, keeping it between -5 and 5
    returns item

weaken(user: User, item: Item) : returns (item: Item)
  where item has no feature values
  then
    refuses UNKNOWN_ITEM "That item has no feature values."
  where item has feature values
  then
    for each feature of item, lower the learned weight of user on feature by half of
    (value - 5) / 5, keeping it between -5 and 5
    returns item
```

## Queries

```queries
_ranked(user: User) : many (item: Item, fit: Number)
  Answers every item that has feature values, with its fit for the user: the sum over its
  features of (declared + learned) times value / 10. Ordered by fit, highest first, then by
  item. A user with no preferences gets a fit of 0 for every item.

_preferences(user: User) : many (feature: Feature, declared: Number, learned: Number)
  Answers each of the user's preferences, and no rows when there are none.
```