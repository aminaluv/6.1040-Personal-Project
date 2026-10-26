import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { each, form, former, where } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";

const { Authenticating, Following, Sessioning, Shelving } = concepts;

const FollowingList = former("the people a reader follows", ({ user }, { followee }) =>
  form({
    people: each(Following._following({ user }).is({ followee })).form({
      username: followee,
    }),
  }),
);

const FollowerList = former("the people who follow a reader", ({ user }, { follower }) =>
  form({
    people: each(Following._followers({ user }).is({ follower })).form({
      username: follower,
    }),
  }),
);

const FriendShelf = former("a friend's shelf", ({ user, shelf }, { item }) =>
  form({
    items: each(Shelving._shelf({ user, shelf }).is({ item })).form({ item }),
  }),
);

const Network = endpoint(
  "/friends/mine",
  ({ session, user }) =>
    receive({ session })
      .then(Sessioning.current({ session }).responds({ subject: user }))
      .then(
        respond({
          following: FollowingList({ user }),
          followers: FollowerList({ user }),
        }),
      ),
  { input: { required: ["session"] } },
);

// The username must belong to an account; otherwise a follow of nobody would be recorded.
const Follow = endpoint(
  "/friends/follow",
  ({ session, user, username }) =>
    receive({ session, username })
      .then(Sessioning.current({ session }).responds({ subject: user }))
      .then(
        where(Authenticating._registered({ username }).is({ registered: true }))
          .then(Following.follow({ follower: user, followee: username }).responds({ followee: username }))
          .then(respond({ username }))
          .named("registered"),
        where(Authenticating._registered({ username }).is({ registered: false }))
          .then(respond({ error: "NO_SUCH_READER" }))
          .named("unknown"),
      ),
  { input: { required: ["session", "username"] } },
);

const Unfollow = endpoint(
  "/friends/unfollow",
  ({ session, user, username }) =>
    receive({ session, username })
      .then(Sessioning.current({ session }).responds({ subject: user }))
      .then(Following.unfollow({ follower: user, followee: username }).responds({ followee: username }))
      .then(respond({ username })),
  { input: { required: ["session", "username"] } },
);

// Anyone signed in sees who a reader follows and is followed by; only followers see the shelves.
const Reader = endpoint(
  "/friends/reader",
  ({ session, user, username }) =>
    receive({ session, username })
      .then(Sessioning.current({ session }).responds({ subject: user }))
      .then(
        where(
          Authenticating._registered({ username }).is({ registered: true }),
          Following._isFollowing({ follower: user, followee: username }).is({ following: true }),
        )
          .then(
            respond({
              username,
              followedByYou: true,
              following: FollowingList({ user: username }),
              followers: FollowerList({ user: username }),
              upNext: FriendShelf({ user: username, shelf: "UP_NEXT" }),
              finished: FriendShelf({ user: username, shelf: "FINISHED" }),
              favorites: FriendShelf({ user: username, shelf: "FAVORITES" }),
            }),
          )
          .named("followed"),
        where(
          Authenticating._registered({ username }).is({ registered: true }),
          Following._isFollowing({ follower: user, followee: username }).is({ following: false }),
        )
          .then(
            respond({
              username,
              followedByYou: false,
              following: FollowingList({ user: username }),
              followers: FollowerList({ user: username }),
            }),
          )
          .named("not-followed"),
        where(Authenticating._registered({ username }).is({ registered: false }))
          .then(respond({ error: "NO_SUCH_READER" }))
          .named("unknown"),
      ),
  { input: { required: ["session", "username"] } },
);

export const composition = {
  FollowingList,
  FollowerList,
  FriendShelf,
  Network,
  Follow,
  Unfollow,
  Reader,
};
