import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { each, form, former } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";

const { BookCataloging, Recommending, Sessioning } = concepts;

const CriteriaList = former(
  "every criterion",
  (_input, { criterion, name, description, low, high }) =>
    form({
      criteria: each(
        BookCataloging._criteria({}).is({ criterion, name, description, low, high }),
      ).form({ criterion, name, description, low, high }),
    }),
);

const WeightList = former(
  "the reader's preferences",
  ({ user }, { feature, importance, target }) =>
    form({
      preferences: each(
        Recommending._preferences({ user }).is({ feature, importance, target }),
      ).form({ criterion: feature, importance, target }),
    }),
);

const View = endpoint(
  "/profile/view",
  ({ session, user }) =>
    receive({ session })
      .then(Sessioning.current({ session }).responds({ subject: user }))
      .then(
        respond({
          criteria: CriteriaList({}),
          preferences: WeightList({ user }),
        }),
      ),
  { input: { required: ["session"] } },
);

const Weigh = endpoint(
  "/profile/weigh",
  ({ session, user, criterion, target, importance }) =>
    receive({ session, criterion, target, importance })
      .then(Sessioning.current({ session }).responds({ subject: user }))
      .then(
        Recommending.prefer({ user, feature: criterion, target, importance }).responds({
          feature: criterion,
        }),
      )
      .then(respond({ criterion, target, importance })),
  { input: { required: ["session", "criterion", "target", "importance"] } },
);

export const composition = { CriteriaList, WeightList, View, Weigh };
