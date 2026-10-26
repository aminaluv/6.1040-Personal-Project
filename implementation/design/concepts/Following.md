# Following

## Purpose

Let a user keep up with the people whose activity interests them, so they can discover things
through people they know instead of only through what is recommended to them.

## Principle

Jane follows Maya. Maya then appears in the list of people Jane follows, and Jane appears in
Maya's followers, without Maya having to do anything. Jane can't follow Maya a second time, and
she can't follow herself. Once Jane unfollows Maya, Maya is gone from Jane's list and Jane is
gone from Maya's followers.

## Types

```types
external User
  The person who follows, or is followed.
```

## State

```state
a set of Follows with
  a follower User
  a followee User
  unique follower and followee
  Rule: no follow has the same user as follower and followee.
```

## Actions

```actions
follow(follower: User, followee: User) : returns (followee: User)
  where follower is followee
  then
    refuses SELF_FOLLOW "You can't follow yourself."
  where follower is not followee and follower already follows followee
  then
    refuses ALREADY_FOLLOWING "You already follow this reader."
  where follower is not followee and follower doesn't follow followee yet
  then
    add a new follow from follower to followee
    returns followee

unfollow(follower: User, followee: User) : returns (followee: User)
  where follower doesn't follow followee
  then
    refuses NOT_FOLLOWING "You don't follow this reader."
  where follower follows followee
  then
    remove the follow from follower to followee
    returns followee
```

## Queries

```queries
_following(user: User) : many (followee: User)
  Answers each user that user follows, in alphabetical order, and no rows when there are none.

_followers(user: User) : many (follower: User)
  Answers each user who follows user, in alphabetical order, and no rows when there are none.

_isFollowing(follower: User, followee: User) : one (following: Flag)
  Answers whether follower follows followee.
```
