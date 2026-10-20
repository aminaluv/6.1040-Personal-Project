import { createHttpClient } from "@mit-sdg/sync-engine-http/client";
import type { NoveltyWireHttp } from "../generated/wire.ts";

const client = createHttpClient<NoveltyWireHttp>({
  baseUrl: "http://127.0.0.1:3000/api",
});

console.log(
  await client.shelves.add({
    user: "jane",
    item: "brave-new-world",
    shelf: "UP_NEXT",
  }),
);
console.log(
  await client.shelves.add({
    user: "jane",
    item: "klara-and-the-sun",
    shelf: "UP_NEXT",
  }),
);
console.log(
  await client.shelves.add({
    user: "jane",
    item: "brave-new-world",
    shelf: "UP_NEXT",
  }),
); // CONFLICT

const result = await client.shelves.view({ user: "jane", shelf: "UP_NEXT" });
if (!("error" in result)) {
  for (const { item } of result.shelf.items) console.log(`Up next: ${item}`);
}

const list = await client.catalog.list({});
if (!("error" in list)) {
  const first = list.catalog.books[0];
  console.log(list.catalog.books.map((b) => b.title));
  if (first)
    console.log(
      JSON.stringify(await client.catalog.card({ book: first.book }), null, 2),
    );
}

if ("error" in list) throw new Error(list.error);
const [first, second] = list.catalog.books;

console.log(
  await client.shelves.add({
    user: "jane",
    item: first!.book,
    shelf: "UP_NEXT",
  }),
);
console.log(
  await client.shelves.add({
    user: "jane",
    item: second!.book,
    shelf: "UP_NEXT",
  }),
);

const shelf = await client.shelves.view({ user: "jane", shelf: "UP_NEXT" });
if (!("error" in shelf)) {
  const byId = new Map(list.catalog.books.map((b) => [b.book, b]));
  for (const { item } of shelf.shelf.items) {
    console.log(`Up next: ${byId.get(item)?.title ?? "(not in catalog)"}`);
  }
}