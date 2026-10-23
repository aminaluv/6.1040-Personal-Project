# Feed

Every feed endpoint resolves the reader from their session first, and acts for that account.

A reader can [see their swipes](reaction:Feed.History). The
[swipe history](former:Feed.SwipeHistory) lists them, newest first.

A reader's [ranked feed](reaction:Feed.Ranked) comes from the [ranking](former:Feed.RankedFeed)
of books by fit, best first.

```endpoints
Feed.History at /feed/history

Feed.Ranked at /feed/ranked
```

When a reader [likes a book](reaction:Feed.Like), the swipe is recorded, the book goes on
their Up Next shelf, and their tastes are reinforced toward it. When they
[pass on a book](reaction:Feed.Pass), the swipe is recorded and their tastes are weakened
toward it. A reader can [reconsider a book](reaction:Feed.Reconsider) to see it in the feed
again.

```endpoints
Feed.Like at /feed/like
Feed.Pass at /feed/pass
Feed.Reconsider at /feed/reconsider
```
