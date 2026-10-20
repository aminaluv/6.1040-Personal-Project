import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { each, form, former } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";

const { Swiping, Shelving } = concepts;

const SwipeHistory = former(
  "the swipe history",
  ({ user }, { item, direction }) =>
    form({
      swipes: each(Swiping._swipes({ user }).is({ item, direction })).form({
        item,
        direction,
      }),
    }),
);

const History = endpoint(
  "/feed/history",
  ({ user }) =>
    receive({ user }).then(respond({ history: SwipeHistory({ user }) })),
  { input: { required: ["user"] } },
);

const Like = endpoint(
  "/feed/like",
  ({ user, item }) =>
    receive({ user, item })
      .then(Swiping.swipeRight({ user, item }).responds({ item }))
      .then(Shelving.add({ user, item, shelf: "UP_NEXT" }).responds({ item }))
      .then(respond({ item })),
  { input: { required: ["user", "item"] } },
);

const Pass = endpoint(
  "/feed/pass",
  ({ user, item }) =>
    receive({ user, item })
      .then(Swiping.swipeLeft({ user, item }).responds({ item }))
      .then(respond({ item })),
  { input: { required: ["user", "item"] } },
);

const Reconsider = endpoint(
  "/feed/reconsider",
  ({ user, item }) =>
    receive({ user, item })
      .then(Swiping.reconsider({ user, item }).responds({ item }))
      .then(respond({ item })),
  { input: { required: ["user", "item"] } },
);

export const composition = { SwipeHistory, History, Like, Pass, Reconsider };
