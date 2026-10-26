# Recommending

## Purpose

Rank items for each user by how close they come to what the user likes, learned from what they
say and how they react, so users see what suits them first instead of wading through everything.

## Principle

Items are scored on features that run between two ends, such as pace from a slow burn (0) to a
page-turner (10). Brave New World scores 5 on pace and The Remains of the Day scores 1. Jane says
she prefers a slow burn, putting her preference for pace at 1, and that pace matters a lot to
her. Among books she hasn't seen, the slower ones now rank above the faster ones. Ben says
nothing, but likes two fast books in a row; his learned preference for pace moves toward the
fast end, so fast books start ranking first for him too.

## Types

```types
external User
  The person items are ranked for.

external Item
  The thing being ranked, such as a book.

external Feature
  A quality items are scored on, such as pace, running from 0 at one end to 10 at the other.
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
  an importance Number
  an optional target Number
  a lean Number
  an evidence Number
  unique user and feature
  Rule: importance is from 0 to 5; target and lean are from 0 to 10; evidence is a count of reactions.
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

clearFeature(feature: Feature) : returns (feature: Feature)
  where no item has a value on feature and no user has a preference on it
  then
    refuses UNKNOWN_FEATURE "Nothing is scored or preferred on that feature."
  where some item has a value on feature or some user has a preference on it
  then
    remove every item's value on feature and every user's preference on it
    returns feature

prefer(user: User, feature: Feature, target: Number, importance: Number) : returns (feature: Feature)
  where target is outside 0 to 10
  then
    refuses INVALID_TARGET "A preferred value must be between 0 and 10."
  where target is from 0 to 10 and importance is outside 0 to 5
  then
    refuses INVALID_IMPORTANCE "Importance must be between 0 and 5."
  where target is from 0 to 10 and importance is from 0 to 5
  then
    set the target of user on feature to target and its importance to importance, keeping its lean and evidence, and starting a new preference at lean 5 and evidence 0
    returns feature

reinforce(user: User, item: Item) : returns (item: Item)
  where item has no feature values
  then
    refuses UNKNOWN_ITEM "That item has no feature values."
  where item has feature values
  then
    for each feature of item, move the lean of user on feature toward the item's value by 1 / (evidence + 2) of the distance, so the lean averages the values of what they like, and add 1 to its evidence, starting a new preference at importance 0, lean 5 and evidence 0
    returns item

weaken(user: User, item: Item) : returns (item: Item)
  where item has no feature values
  then
    refuses UNKNOWN_ITEM "That item has no feature values."
  where item has feature values
  then
    for each feature of item, move the lean of user on feature 15% of the way away from the item's value, keeping it between 0 and 10, and add 1 to its evidence, starting a new preference at importance 0, lean 5 and evidence 0
    returns item
```

## Queries

```queries
_ranked(user: User) : many (item: Item, fit: Number)
  Answers every item that has feature values, with its fit for the user, ordered by fit, highest
  first, then by item. Each of the item's features contributes its closeness, 1 minus the
  distance between the item's value and the user's preferred value divided by 10, times its
  weight. The preferred value is the target when the user has set one, and the lean otherwise.
  The weight is the importance plus a learned weight of a quarter of the evidence, at most 1.5.
  A user with no preferences gets a fit of 0 for every item.

_preferences(user: User) : many (feature: Feature, importance: Number, target: Number, lean: Number)
  Answers each of the user's preferences, with the target when one is set and the lean
  otherwise, and no rows when there are none.
```
