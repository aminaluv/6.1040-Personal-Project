import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { each, form, former } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";

const { Shelving, BookCataloging } = concepts;

const ShelfView = former("the shelf view", ({ user, shelf }, { item }) =>
  form({
    items: each(Shelving._shelf({ user, shelf }).is({ item })).form({ item }),
  }),
);

const View = endpoint(
  "/shelves/view",
  ({ user, shelf }) =>
    receive({ user, shelf }).then(
      respond({ shelf: ShelfView({ user, shelf }) }),
    ),
  { input: { required: ["user", "shelf"] } },
);

const Add = endpoint(
  "/shelves/add",
  ({ user, item, shelf }) =>
    receive({ user, item, shelf })
      .then(Shelving.add({ user, item, shelf }).responds({ item }))
      .then(respond({ item })),
  { input: { required: ["user", "item", "shelf"] } },
);

const Remove = endpoint(
  "/shelves/remove",
  ({ user, item, shelf }) =>
    receive({ user, item, shelf })
      .then(Shelving.remove({ user, item, shelf }).responds({ item }))
      .then(respond({ item })),
  { input: { required: ["user", "item", "shelf"] } },
);

export const composition = { ShelfView, View, Add, Remove };
