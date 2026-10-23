import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { each, form, former } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";

const { BookCataloging, Recommending, Sessioning } = concepts;

const CriteriaList = former(
  "every criterion",
  (_input, { criterion, name, description }) =>
    form({
      criteria: each(
        BookCataloging._criteria({}).is({ criterion, name, description }),
      ).form({ criterion, name, description }),
    }),
);

const WeightList = former(
  "the reader's weights",
  ({ user }, { feature, declared }) =>
    form({
      weights: each(
        Recommending._preferences({ user }).is({ feature, declared }),
      ).form({ criterion: feature, weight: declared }),
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
          weights: WeightList({ user }),
        }),
      ),
  { input: { required: ["session"] } },
);

const Weigh = endpoint(
  "/profile/weigh",
  ({ session, user, criterion, weight }) =>
    receive({ session, criterion, weight })
      .then(Sessioning.current({ session }).responds({ subject: user }))
      .then(
        Recommending.declare({ user, feature: criterion, weight }).responds({
          feature: criterion,
        }),
      )
      .then(respond({ criterion, weight })),
  { input: { required: ["session", "criterion", "weight"] } },
);

export const composition = { CriteriaList, WeightList, View, Weigh };
