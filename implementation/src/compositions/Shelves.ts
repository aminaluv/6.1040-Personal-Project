import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { each, form, former } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";

const { Shelving, Sessioning } = concepts;

const ShelfView = former("the shelf view", ({ user, shelf }, { item }) =>
  form({
    items: each(Shelving._shelf({ user, shelf }).is({ item })).form({ item }),
  }),
);

const View = endpoint(
  "/shelves/view",
  ({ session, user, shelf }) =>
    receive({ session, shelf })
      .then(Sessioning.current({ session }).responds({ subject: user }))
      .then(respond({ shelf: ShelfView({ user, shelf }) })),
  { input: { required: ["session", "shelf"] } },
);

const Add = endpoint(
  "/shelves/add",
  ({ session, user, item, shelf }) =>
    receive({ session, item, shelf })
      .then(Sessioning.current({ session }).responds({ subject: user }))
      .then(Shelving.add({ user, item, shelf }).responds({ item }))
      .then(respond({ item })),
  { input: { required: ["session", "item", "shelf"] } },
);

const Remove = endpoint(
  "/shelves/remove",
  ({ session, user, item, shelf }) =>
    receive({ session, item, shelf })
      .then(Sessioning.current({ session }).responds({ subject: user }))
      .then(Shelving.remove({ user, item, shelf }).responds({ item }))
      .then(respond({ item })),
  { input: { required: ["session", "item", "shelf"] } },
);

export const composition = { ShelfView, View, Add, Remove };
