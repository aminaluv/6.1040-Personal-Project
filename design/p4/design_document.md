# Novelty: Final Design Document

Novelty helps lapsed readers find their next book using **First Impression cards**: a
spoiler-free summary, characters, themes and tones, and a radar map of how the book fits what the
reader likes. Readers swipe right to save a book to Up Next, or left to pass. This document
summarizes how the final design differs from the [P1 concept design](./p1/) and the
[P3 visual design](https://github.com/aminaluv/6.1040-Personal-Project/blob/59b7bb1/design/p3/visual_design.pdf).
P1 defined the app before any code was written: the [problem framing](./p1/problem_framing.md),
[pitch](./p1/pitch.md), [concept specs](./p1/concepts.md), [user journey](./p1/user_journey.md)
and [UI sketches](./p1/ui_sketches.md).

<table><tr>
<td><img src="./imgs/final/card-fit.png" width="210" alt="A book card's How it fits you section: 92% match, with a radar comparing the book to the reader's ideal"></td>
<td><img src="./imgs/final/profile-scales.png" width="210" alt="The profile: each quality has a slider between two ends and a 0 to 5 importance row"></td>
<td><img src="./imgs/final/shelves.png" width="210" alt="Shelves with Up Next, Finished, Favorites and Passed tabs, and round icon buttons"></td>
</tr></table>

## Concepts: how they changed from P1

The final design has more, smaller concepts than P1, and they work together through reactions
rather than by calling each other. When they swipe, the swipe is recorded by Swiping, which in turn updates Recommending and, for a like, adds the book to Shelving. New books arrive through Harvesting, which hands them to BookCataloging. Each pending book is then drafted by Drafting, and the finished draft goes back to
BookCataloging, whose scores feed Recommending. Following decides who can see a reader's shelves.

**Authentication became Authenticating and Sessioning.** P1 had a single Authentication concept.
It was split to follow the engine's familiar pattern, so that a session (lasting 7 days) stands in
for the reader on every request.

**BookCataloging was divided into BookCataloging, Harvesting and Drafting.** In P1, cataloging
also held reader-defined criteria and Reports. Importing books from a book API and generating
cards with an LLM were reactions that called external services directly. Importing from Open Library and writing cards with Gemini became concepts of their own, linked by reactions, so that cataloging now only records facts
about books.

**Recommending was divided into Swiping and Recommending.** P1's Recommending held the reader's
preferences, swipes, favorites and feed, and every book's features were its genres. Now Swiping records a reader's first impressions and Recommending does
the ranking, with a reaction connecting the two. The features Recommending uses are the criteria
scores rather than genres.

**Shelving was simplified.** P1 had Up Next, Reading, Read and Didn't Finish shelves, with a
favorite flag on each entry. The final
version keeps only the shelves the flow actually uses: Up Next, Finished and Favorites. Having
_Finished_ separate from _Favorites_ distinguishes books a reader has read from books they loved.
Passed books come from Swiping rather than from a shelf.

**Following is unchanged.** It is kept as specified in P1, including the rule from P1's notes
that shelves are shown only to followers, which is enforced in the composition.

The final specs are in [concepts](../implementation/design/concepts) and
[compositions](../implementation/design/compositions). Earlier versions can be found in the
[P2 specs](https://github.com/aminaluv/6.1040-Personal-Project/tree/eb32ab1/implementation/design/concepts)
and the [beta specs](https://github.com/aminaluv/6.1040-Personal-Project/tree/ccc9973/implementation/design/concepts).

## Key design decisions

### Criteria became two-ended scales

In P1, readers defined their own criteria, and a higher score meant "more of it". That broke down
for qualities like pacing: does a high score mean fast, or good? The final design replaces this
with 13 fixed scales that have named ends, such as pace running from _slow burn_ (0) to
_page-turner_ (10), and tone from _light and cozy_ to _dark and intense_. Readers set **where**
they like books to fall on each scale and **how much** that scale matters to them, from 0 to 5.
Fit is measured by how close a book is to the reader's ideal, not by how high it scores, and each
card shows this as a **% match**.

The beta still ranked with only 5 criteria (see
[Recommending at `ccc9973`](https://github.com/aminaluv/6.1040-Personal-Project/blob/ccc9973/implementation/design/concepts/Recommending.md)),
while the [final Recommending](../implementation/design/concepts/Recommending.md) ranks by
closeness. Reader-written criteria were considered and reconsidered, because every new criterion
would mean re-scoring every book with Gemini, which the free tier cannot sustain.

### Swipes still teach the ranking

A like moves the reader's learned position toward the book, so that the position is a running
average of what they have liked, while a pass nudges it away. Anything the reader sets explicitly outweighs what their swipes alone suggest.

### The catalog grows itself, in batches

When a reader has 10 or fewer unseen books left, a batch of 20 new books is started: 5 for each
genre they liked, restricted to books with covers and English ISBNs. Gemini drafts every card on
an all-or-nothing basis. A failed draft stays hidden and is retried by the next batch, so a
half-written card can never appear.

The [final prompt](../implementation/src/concepts/Drafting.ts) differs from the
[beta Drafting prompt at `ccc9973`](https://github.com/aminaluv/6.1040-Personal-Project/blob/ccc9973/implementation/src/concepts/Drafting.ts)
mainly in that it also explains what each scale's ends mean. Testing revealed an important
constraint: the free tier allows only 20 full-Flash requests a day. Drafting therefore uses Flash-Lite, falls back to another model when it is overloaded, and stops immediately once the
quota is spent.

Up to 3 cards are prepared in the background and are shown only once they are complete, with the
cover already loaded. Readers can swipe by dragging, by using the buttons, or with the arrow keys.

### Deferred or dropped from P1

P1's _Reports_, which let readers correct a wrong card, were replaced by validating drafts up
front and re-rating books whenever the criteria change. A few other P1 features were not built due to the time limitation:
onboarding with past favorites (from the [user journey](./p1/user_journey.md)), the _Reading_ and
_Didn't Finish_ shelves, profile bios and feed stats (from the
[profile sketch](./p1/ui_sketches.md)), and preferences for genre and character age.

## Visual design: how it changed from the P3 study

The palette uses the swatches from the matcha-themed vision board throughout. Peach marks warm
accents such as setting, tones and the reader's ideal, and brown marks _Pass_.

Typography follows the study as specified, with _Slabo_ for titles and headers and _Sofia Sans_
for body text. The shape language (rounded cards with 20–28px corners, pill-shaped buttons and
chips, and soft shadows) show the elegant, rounded look the study aimed for.

The radar from the [P1 feed sketch](./p1/ui_sketches.md) now compares the book with the reader's ideal, which is drawn as a
dashed outline. Each axis is labelled by its high end, so further out always means more of that
quality.

Navigation follows the P1 sketches more closely than the alpha did: the feed is the home screen,
with shelves (top left) and the profile (top right) each one tap away.

## Final Demo Video

https://drive.google.com/file/d/1aaQcFe6PjZgbM7pMkZlYRnW2UwvrumbB/view?usp=sharing
