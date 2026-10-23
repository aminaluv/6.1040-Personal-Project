# Drafting

## Purpose

Produce a complete, consistent description of an item from its source notes without a person
writing each one, so a collection can grow faster than people can describe it and no item is
ever left half-described.

## Principle

The aspects social-commentary and pacing are defined. A draft is requested for The Hobbit with
its title, author and source notes. The agent writes a spoiler-free summary, a setting, the
main and supporting characters with their age ranges, the themes and tones, and a rating from
0 to 10 on social-commentary and on pacing. Reading the draft gives everything needed to
describe the book. A request the agent can't answer completely is refused, so a partial draft
never exists.

## Types

```types
external Item
  The thing being drafted, such as a book.

Role is MAIN or SUPPORTING
```

## State

```state
a set of Aspects with
  a unique name String
  a description String

a set of Drafts with
  a unique Item
  a summary String
  an optional setting String
  a themes set of String
  a tones set of String

a set of Figures with
  a Draft
  a name String
  a role Role
  a minAge Number
  a maxAge Number

a set of Ratings with
  a Draft
  an Aspect
  a value Number
  unique draft and aspect
  Rule: value is from 0 to 10, and every figure's minAge is at most its maxAge.
```

## Actions

```actions
defineAspect(name: String, description: String) : returns (aspect: Aspect)
  where an aspect already has name
  then
    refuses ASPECT_EXISTS "An aspect with that name already exists."
  where no aspect has name
  then
    add a new aspect with name and description
    returns aspect

draft(item: Item, title: String, author: String, source: String) : returns (draft: Draft)
  where item already has a draft
  then
    refuses ALREADY_DRAFTED "That item already has a draft."
  where item has no draft and there are no aspects
  then
    refuses NO_ASPECTS "Define at least one aspect before drafting."
  where item has no draft, there are aspects, and the agent can't be reached or its answer lacks a summary, a character, a theme, a tone, or a valid rating for some aspect
  then
    refuses DRAFT_FAILED "The agent couldn't produce a complete draft."
  where item has no draft, there are aspects, and the agent's answer is complete
  then
    add a new draft for item with the agent's summary, setting, themes and tones
    add a figure of the draft for each character, and a rating of the draft for each aspect
    returns draft

discard(item: Item) : returns (item: Item)
  where item has no draft
  then
    refuses NO_DRAFT "That item has no draft."
  where item has a draft
  then
    remove the draft of item with its figures and ratings
    returns item
```

## Queries

```queries
_draft(item: Item) : optional (draft: Draft, summary: String, setting: String)
  Answers the item's draft, with empty text when it has no setting, and no row when the item
  has no draft.

_figures(draft: Draft) : many (name: String, role: Role, minAge: Number, maxAge: Number)
  Answers each figure of the draft, MAIN figures first, then by name.

_themes(draft: Draft) : many (theme: String)
  Answers each theme of the draft, in alphabetical order.

_tones(draft: Draft) : many (tone: String)
  Answers each tone of the draft, in alphabetical order.

_ratings(draft: Draft) : many (aspectName: String, value: Number)
  Answers each rating of the draft with its aspect's name, ordered by that name.
```
