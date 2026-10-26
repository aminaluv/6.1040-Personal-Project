# Friends

Readers can follow each other to see what their friends are reading. Every endpoint here
resolves the reader from their session first.

A reader can [see their network](reaction:Friends.Network): the
[people they follow](former:Friends.FollowingList) and the
[people who follow them](former:Friends.FollowerList).

```endpoints
Friends.Network at /friends/mine
```

A reader can [follow another reader](reaction:Friends.Follow) by username. Following needs no
approval, but the username must belong to a registered account; an unknown username is refused
with `NO_SUCH_READER` rather than creating a follow of nobody. A reader can
[unfollow](reaction:Friends.Unfollow) someone they follow.

```endpoints
Friends.Follow at /friends/follow
Friends.Unfollow at /friends/unfollow
```

A reader can [view another reader](reaction:Friends.Reader): their followers and the people they
follow, which anyone signed in can see. A reader's shelves are shared only with the people who
follow them, so their Up Next, Finished and Favorites [shelves](former:Friends.FriendShelf) are included
only when the viewer follows them. Viewing an unknown username is refused with `NO_SUCH_READER`.

```endpoints
Friends.Reader at /friends/reader
```

Following is open, as in the original design, rather than needing the other reader's approval.
That keeps finding friends quick, at the cost that following someone is enough to see their
shelves. A follow-request step would be the next refinement if shelves should be more private.
