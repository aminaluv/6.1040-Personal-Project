// Novelty frontend: feed and shelf views come next.
import { createHttpClient } from "@mit-sdg/sync-engine-http/client";
import type { NoveltyWireHttp } from "../generated/wire.ts";

const client = createHttpClient<NoveltyWireHttp>({ baseUrl: "/api" });
const cardEl = document.querySelector<HTMLElement>("#card")!;
let books: { book: string; title: string; author: string; coverUrl: string }[] = [];

function el(tag: string, text?: string) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

function radar(scores: { criterionName: string; value: number }[]) {
  const ns = "http://www.w3.org/2000/svg";
  const size = 280,
    c = size / 2,
    r = 90,
    n = scores.length;
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return [c + (Math.cos(a) * (r * v)) / 10, c + (Math.sin(a) * (r * v)) / 10];
  };
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  svg.setAttribute("width", String(size));
  const poly = (values: number[], cls: string) => {
    const p = document.createElementNS(ns, "polygon");
    p.setAttribute(
      "points",
      values.map((v, i) => pt(i, v).join(",")).join(" "),
    );
    p.setAttribute("class", cls);
    svg.append(p);
  };
  for (const ring of [2.5, 5, 7.5, 10])
    poly(
      scores.map(() => ring),
      "ring",
    );
  poly(
    scores.map((s) => s.value),
    "shape",
  );
  scores.forEach((s, i) => {
    const [x, y] = pt(i, 12.5);
    const t = document.createElementNS(ns, "text");
    t.setAttribute("x", String(x));
    t.setAttribute("y", String(y));
    t.setAttribute("text-anchor", "middle");
    t.textContent = s.criterionName;
    svg.append(t);
  });
  return svg;
}

async function showCard() {
    const current = feed[0];
    if (!current) {
    cardEl.replaceChildren(el("p", "You've seen every book in the catalog."));
    return;
  }
  const result = await client.catalog.card({ book: current.book });
  if ("error" in result) {
    cardEl.replaceChildren(
      el("p", `Could not load this book: ${result.error}`),
    );
    return;
  }
  const { details, characters, scores, genres, themes, tones } = result.card;
  const d = details[0];
  if (!d) {
    cardEl.replaceChildren(el("p", "Book not found."));
    return;
  }
  const cover = el("img") as HTMLImageElement;
  cover.src = d.coverUrl;
  cover.alt = `Cover of ${d.title}`;
  const characterList = el("ul");
  for (const ch of characters) {
    characterList.append(
      el(
        "li",
        `${ch.name} (${ch.role.toLowerCase()}, ages ${ch.minAge}–${ch.maxAge})`,
      ),
    );
  }
  cardEl.replaceChildren(
    cover,
    el("h2", d.title),
    el(
      "p",
      `${d.author} · ${d.pageCount} pages · ${genres.map((g) => g.genre).join(", ")}`,
    ),
    el("p", d.summary),
    el("p", `Setting: ${d.setting || "—"}`),
    el("p", `Themes: ${themes.map((t) => t.theme).join(", ")}`),
    el("p", `Tones: ${tones.map((t) => t.tone).join(", ")}`),
    el("h3", "Characters"),
    characterList,
    scores.length >= 3
      ? radar(scores)
      : el("p", "Not enough scores for a chart yet."),
  );
}

let feed: typeof books = [];

async function loadFeed() {
  const history = user() ? await client.feed.history({ user: user() }) : null;
  const swiped = new Set(
    history && !("error" in history)
      ? history.history.swipes.map((s) => s.item)
      : [],
  );
  feed = books.filter((b) => !swiped.has(b.book));
  await showCard();
}

async function swipe(direction: "like" | "pass") {
  const current = feed[0];
  if (!current) return;
  if (!user()) {
    statusEl.textContent = "Enter your name first.";
    return;
  }
  const input = { user: user(), item: current.book };
  const result =
    direction === "like"
      ? await client.feed.like(input)
      : await client.feed.pass(input);
  if ("error" in result) {
    statusEl.textContent = `Could not save that swipe: ${result.error}`;
    return;
  }
  statusEl.textContent =
    direction === "like"
      ? `Added ${current.title} to Up Next.`
      : `Passed on ${current.title}.`;
  feed.shift();
  await showCard();
  await showShelf();
}

document.querySelector("#like")!.addEventListener("click", () => swipe("like"));
document.querySelector("#pass")!.addEventListener("click", () => swipe("pass"));
document.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement) return;
  if (event.key === "ArrowRight") swipe("like");
  if (event.key === "ArrowLeft") swipe("pass");
});

type ShelfName = "UP_NEXT" | "FAVORITES";
type Tab = ShelfName | "PASSED";
let currentShelf: Tab = "UP_NEXT";

const userInput = document.querySelector<HTMLInputElement>("#user")!;
const shelfEl = document.querySelector<HTMLUListElement>("#shelf")!;
const statusEl = document.querySelector<HTMLParagraphElement>("#status")!;

const user = () => userInput.value.trim();

async function showShelf() {
    if (!user()) {
        shelfEl.replaceChildren(el("li", "Enter your name to see your shelves."));
        return;
    }
    if (currentShelf === "PASSED") {
    const history = await client.feed.history({ user: user() });
    if ("error" in history) {
        shelfEl.replaceChildren(
        el("li", `Could not load passed books: ${history.error}`),
        );
        return;
    }
    const passed = history.history.swipes.filter(
        (s) => s.direction === "LEFT",
    );
    if (passed.length === 0) {
        shelfEl.replaceChildren(el("li", "Nothing passed yet."));
        return;
    }
    const byId = new Map(books.map((b) => [b.book, b]));
    shelfEl.replaceChildren(
        ...passed.map(({ item }) => {
        const b = byId.get(item);
        const li = el(
            "li",
            b ? `${b.title} by ${b.author} ` : "(not in catalog) ",
        );
        const again = el("button", "Reconsider");
        again.addEventListener("click", async () => {
            await client.feed.reconsider({ user: user(), item });
            await loadFeed();
            await showShelf();
        });
        li.append(again);
        return li;
        }),
    );
    return;
    }

    const shelf: ShelfName = currentShelf;
    const result = await client.shelves.view({
        user: user(),
        shelf: shelf,
    });
    if ("error" in result) {
        shelfEl.replaceChildren(
        el("li", `Could not load your shelf: ${result.error}`),
        );
        return;
    }
    if (result.shelf.items.length === 0) {
        shelfEl.replaceChildren(el("li", "Nothing here yet."));
        return;
    }
    const byId = new Map(books.map((b) => [b.book, b]));
    shelfEl.replaceChildren(
        ...result.shelf.items.map(({ item }) => {
        const b = byId.get(item);
        const li = el(
            "li",
            b ? `${b.title} by ${b.author} ` : "(not in catalog) ",
        );

        if (shelf === "UP_NEXT") {
            const finished = el("button", "Finished: add to Favorites");
            finished.addEventListener("click", async () => {
            await client.shelves.add({ user: user(), item, shelf: "FAVORITES" });
            await client.shelves.remove({ user: user(), item, shelf: "UP_NEXT" });
            await showShelf();
            });
            li.append(finished);
        }

        const remove = el("button", "Remove");
        remove.addEventListener("click", async () => {
            await client.shelves.remove({
            user: user(),
            item,
            shelf: shelf,
            });
            await showShelf();
        });
        li.append(remove);
        return li;
        }),
    );
}

for (const tab of document.querySelectorAll<HTMLButtonElement>(
  "#tabs button",
)) {
  tab.addEventListener("click", async () => {
    currentShelf = tab.dataset.shelf as ShelfName;
    for (const t of document.querySelectorAll("#tabs button")) {
      t.setAttribute("aria-pressed", String(t === tab));
    }
    await showShelf();
  });
}

userInput.addEventListener("change", async () => {
    await loadFeed();
    await showShelf();
});

const list = await client.catalog.list({});
if ("error" in list)
  cardEl.replaceChildren(el("p", `Could not load the catalog: ${list.error}`));
else {
   books = list.catalog.books;
   await loadFeed();
   await showShelf();
}