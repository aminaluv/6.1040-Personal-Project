# Growing

The catalog grows in batches when readers are close to running out of books, not on a timer.
When a reader has 10 or fewer unseen books left, the feed asks to
[grow the catalog](reaction:Growing.Request) with the reader's session. This starts a batch of
20 and harvests 5 books from each genre of the books that reader liked, or from the whole
catalog's genres when they haven't liked any yet, then answers, while the rest of
the batch carries on in the background. Only one batch runs at a time, so readers who run low
together share one batch.

```endpoints
Growing.Request at /catalog/grow
```

Each harvested work [is added to the catalog](reaction:Growing.AddHarvestedBook) as a PENDING
book, [filed under the genre it was harvested from](reaction:Growing.GenreFromTopic), and
[sent to be drafted](reaction:Growing.DraftAddedBook) from its source notes. A draft can fail
when the agent is down or rate-limited, leaving its book PENDING, so once a new batch's own
work has settled, every harvested book still PENDING without a draft is
[sent to be drafted again](reaction:Growing.RetryPendingDrafts).

A finished draft [fills in the book](reaction:Growing.FillFromDraft) with its characters,
themes and tones. Once the batch's work has settled, the book is
[described](reaction:Growing.DescribeDrafted) with the draft's summary and setting, and then
[scored](reaction:Growing.ScoreDescribed) on each criterion from the draft's ratings. A book
whose draft was refused stays PENDING, so readers never see it.

Every score [becomes a feature for ranking](reaction:Growing.ScoreBecomesFeature), so new books
take their place in each reader's ranked feed without a separate sync.

When the batch's work has settled, the batch [is finished](reaction:Growing.FinishBatch), so a
later request can start the next one.

Defining a criterion [also defines a matching aspect](reaction:Growing.CriterionBecomesAspect),
so the agent rates new books on every criterion readers see.

## Notes on the concepts

**The source.** In Novelty the source is Open Library's subject listings, a find's key is its
ISBN, and its source notes are the work's description, subjects, places and people. The concept
only assumes the source can list works on a topic in a stable order.

**Stale batches.** A batch is meant to be finished once its work settles. If the host stops
mid-batch, the batch would stay RUNNING forever, so `start` ignores a RUNNING batch after 30
minutes instead of blocking all future batches.

**Aspects and criteria.** In Novelty, aspects carry the same names as BookCataloging's criteria.
The copies play different roles: an aspect is the rubric the agent reads, while a criterion is
what readers see on a card. Keeping them separate means Drafting doesn't depend on the catalog,
at the cost of a reaction that copies each new criterion into an aspect.

**The agent.** The agent is a language model given the aspects with their descriptions, the
item's title and author, and its source notes. When the notes are thin it may draw on its own
knowledge of the work. Which model is used is an implementation choice.

**All or nothing.** `draft` either records a complete draft or refuses. That keeps "every draft
is complete" true of the state, so whatever reads a draft never has to check for missing parts.
