import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { each, form, former } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";

const { Swiping, Shelving, Recommending, Sessioning } = concepts;

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
  ({ session, user }) =>
    receive({ session })
      .then(Sessioning.current({ session }).responds({ subject: user }))
      .then(respond({ history: SwipeHistory({ user }) })),
  { input: { required: ["session"] } },
);

const Like = endpoint(
  "/feed/like",
  ({ session, user, item }) =>
    receive({ session, item })
      .then(Sessioning.current({ session }).responds({ subject: user }))
      .then(Swiping.swipeRight({ user, item }).responds({ item }))
      .then(Shelving.add({ user, item, shelf: "UP_NEXT" }).responds({ item }))
      .then(Recommending.reinforce({ user, item }).responds({ item }))
      .then(respond({ item })),
  { input: { required: ["session", "item"] } },
);

const Pass = endpoint(
  "/feed/pass",
  ({ session, user, item }) =>
    receive({ session, item })
      .then(Sessioning.current({ session }).responds({ subject: user }))
      .then(Swiping.swipeLeft({ user, item }).responds({ item }))
      .then(Recommending.weaken({ user, item }).responds({ item }))
      .then(respond({ item })),
  { input: { required: ["session", "item"] } },
);

const Reconsider = endpoint(
  "/feed/reconsider",
  ({ session, user, item }) =>
    receive({ session, item })
      .then(Sessioning.current({ session }).responds({ subject: user }))
      .then(Swiping.reconsider({ user, item }).responds({ item }))
      .then(respond({ item })),
  { input: { required: ["session", "item"] } },
);

const RankedFeed = former("the ranked feed", ({ user }, { item, fit }) =>
  form({
    items: each(Recommending._ranked({ user }).is({ item, fit })).form({
      item,
      fit,
    }),
  }),
);

const Ranked = endpoint(
  "/feed/ranked",
  ({ session, user }) =>
    receive({ session })
      .then(Sessioning.current({ session }).responds({ subject: user }))
      .then(respond({ ranking: RankedFeed({ user }) })),
  { input: { required: ["session"] } },
);

export const composition = {
  SwipeHistory,
  RankedFeed,
  History,
  Ranked,
  Like,
  Pass,
  Reconsider,
};
