# Feed

A reader can [see their swipes](reaction:Feed.History). The
[swipe history](former:Feed.SwipeHistory) lists them, newest first.

```endpoints
Feed.History at /feed/history
```

When a reader [likes a book](reaction:Feed.Like), the swipe is recorded and the book goes on
their Up Next shelf. When they [pass on a book](reaction:Feed.Pass), only the swipe is
recorded. A reader can [reconsider a book](reaction:Feed.Reconsider) to see it in the feed
again.

```endpoints
Feed.Like at /feed/like
Feed.Pass at /feed/pass
Feed.Reconsider at /feed/reconsider
```