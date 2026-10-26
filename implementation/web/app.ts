// Novelty frontend: a swipeable deck of first-impression cards, plus the reader's shelves.
import { createHttpClient } from "@mit-sdg/sync-engine-http/client";
import type { NoveltyWireHttp } from "../generated/wire.ts";

const client = createHttpClient<NoveltyWireHttp>({ baseUrl: "/api" });
const deckEl = document.querySelector<HTMLElement>("#deck")!;

type Book = { book: string; title: string; author: string; coverUrl: string };
type Card = Extract<
  Awaited<ReturnType<typeof client.catalog.card>>,
  { card: unknown }
>["card"];

let books: Book[] = [];

// The deck holds only cards that are fully built: every required part is present and the
// cover has decoded. Up to DECK_SIZE of them wait in order, so a swipe never shows a card
// still loading.
const DECK_SIZE = 3;
let deck: { book: Book; node: HTMLElement }[] = [];
let upcoming: Book[] = []; // ranked books not yet built, best first
const building = new Set<string>();
const skipped = new Set<string>(); // books whose cards came back incomplete
let filling: Promise<void> | undefined;
let generation = 0; // bumped when the reader changes, so stale builds are dropped

// When few unseen books remain, ask the backend for a batch, then check back until it lands.
const GROW_AT = 10;
const POLL_MS = 15_000;
const POLL_LIMIT_MS = 5 * 60_000;
let growing = false;

// The signed-in reader's session token, kept across visits.
const SESSION_KEY = "novelty.session";
let session = "";
const signedIn = () => session !== "";
let me = ""; // the signed-in reader's username

// The reader's preference on each criterion, by criterion id: where on its scale they like books
// (0 to 10) and how much it matters (0 to 5). Importance above 0 puts it on their radar.
let prefs = new Map<string, { target: number; importance: number }>();

function el(tag: string, text?: string) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

// An element with a class, and optionally text or children.
function part(tag: string, className: string, ...content: (string | Node)[]) {
  const node = el(tag);
  node.className = className;
  node.append(...content);
  return node;
}

function chip(text: string, kind: string) {
  return part("li", `chip ${kind}`, text);
}

function avatar(username: string, size = "") {
  return part("span", `avatar ${size}`.trim(), username.slice(0, 1));
}

// A short message that slides up from the bottom and fades away.
const toastEl = document.querySelector<HTMLElement>("#toast")!;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
// With undo, it stays a little longer and offers an Undo button.
function toast(message: string, tone: "ok" | "warn" = "ok", undo?: () => Promise<unknown>) {
  toastEl.replaceChildren(el("span", message));
  if (undo) {
    const button = part("button", "toast-action", "Undo") as HTMLButtonElement;
    button.type = "button";
    button.addEventListener(
      "click",
      async () => {
        toastEl.classList.remove("show");
        await undo();
      },
      { once: true },
    );
    toastEl.append(button);
  }
  toastEl.classList.toggle("warn", tone === "warn");
  toastEl.classList.toggle("actionable", undo !== undefined);
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), undo ? 5000 : 2600);
}

// Small round icon buttons for shelf actions; each carries its full meaning as a label.
const ICONS = {
  check: '<path d="M5 12.5l4.5 4.5L19 7" />',
  heart:
    '<path d="M12 20s-7-4.4-9.2-8.6C1.3 8.5 3 5 6.4 5c2 0 3.6 1.2 4.4 2.6h2.4C14 6.2 15.6 5 17.6 5 21 5 22.7 8.5 21.2 11.4 19 15.6 12 20 12 20z" />',
  x: '<path d="M7 7l10 10M17 7L7 17" />',
  undo: '<path d="M4 9h11a5 5 0 0 1 0 10H9" /><path d="M8 5L4 9l4 4" />',
  plus: '<path d="M12 5v14M5 12h14" />',
};

function iconButton(
  icon: keyof typeof ICONS,
  label: string,
  run: () => Promise<unknown>,
  pressed?: boolean,
) {
  const button = part("button", `icon-btn ${icon}`) as HTMLButtonElement;
  button.type = "button";
  button.title = label;
  button.setAttribute("aria-label", label);
  if (pressed !== undefined) button.setAttribute("aria-pressed", String(pressed));
  button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[icon]}</svg>`;
  button.addEventListener("click", async () => {
    button.disabled = true;
    await run();
    // A button whose job is done (dataset.done) stays disabled.
    if (!button.dataset.done) button.disabled = false;
  });
  return button;
}

const debug = new URLSearchParams(location.search).has("debug");
const debugSection = document.querySelector<HTMLElement>("#debug")!;
const debugList = document.querySelector<HTMLOListElement>("#debug-list")!;
debugSection.hidden = !debug;
let fits = new Map<string, number>();

function showDebug() {
  if (!debug) return;
  debugList.replaceChildren(
    ...deck.map(({ book: b }) =>
      el("li", `${b.title}: fit ${fits.get(b.book) ?? "unranked"} (ready)`),
    ),
    ...upcoming.map((b) =>
      el("li", `${b.title}: fit ${fits.get(b.book) ?? "unranked"}`),
    ),
  );
}

// One axis per criterion, labelled by its high end, so "further out" always reads the same way.
type Axis = { name: string; high: string; value: number; ideal: number };

function radar(axes: Axis[]) {
  const ns = "http://www.w3.org/2000/svg";
  // Wider than tall, so labels on the left and right have room beside the chart.
  const width = 440,
    height = 300,
    cx = width / 2,
    cy = height / 2,
    r = 100,
    n = axes.length;
  const angle = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / n;
  const pt = (i: number, v: number) => [
    cx + (Math.cos(angle(i)) * (r * v)) / 10,
    cy + (Math.sin(angle(i)) * (r * v)) / 10,
  ];
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute(
    "aria-label",
    axes.map((a) => `${a.name}: this book ${a.value}, your ideal ${a.ideal}, toward ${a.high} at 10`).join("; "),
  );
  const poly = (values: number[], cls: string) => {
    const p = document.createElementNS(ns, "polygon");
    p.setAttribute("points", values.map((v, i) => pt(i, v).join(",")).join(" "));
    p.setAttribute("class", cls);
    svg.append(p);
  };
  for (const ring of [2.5, 5, 7.5, 10]) poly(axes.map(() => ring), "ring");
  axes.forEach((_, i) => {
    const [x, y] = pt(i, 10);
    const spoke = document.createElementNS(ns, "line");
    spoke.setAttribute("x1", String(cx));
    spoke.setAttribute("y1", String(cy));
    spoke.setAttribute("x2", String(x));
    spoke.setAttribute("y2", String(y));
    spoke.setAttribute("class", "ring");
    svg.append(spoke);
  });
  poly(axes.map((a) => a.ideal), "ideal");
  poly(axes.map((a) => a.value), "shape");
  axes.forEach((a, i) => {
    const [x, y] = pt(i, a.value);
    const dot = document.createElementNS(ns, "circle");
    dot.setAttribute("cx", String(x));
    dot.setAttribute("cy", String(y));
    dot.setAttribute("r", "3.5");
    dot.setAttribute("class", "dot");
    svg.append(dot);
  });
  // Labels sit just outside the outer ring, anchored away from the chart so they never overlap it.
  axes.forEach((a, i) => {
    const [x, y] = pt(i, 11.3);
    const cos = Math.cos(angle(i));
    const sin = Math.sin(angle(i));
    const t = document.createElementNS(ns, "text");
    t.setAttribute("x", String(x));
    t.setAttribute("y", String(y + (sin > 0.5 ? 10 : sin < -0.5 ? -2 : 4)));
    t.setAttribute("text-anchor", cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle");
    t.textContent = a.high;
    svg.append(t);
  });
  return svg;
}

// One scale with both ends named, the book's spot, and the reader's ideal.
function scaleRow(name: string, low: string, high: string, value: number, ideal?: number) {
  const book = part("span", "book-mark");
  book.style.left = `${value * 10}%`;
  book.title = `This book: ${value} of 10`;
  const track = part("div", "scale-track", book);
  if (ideal !== undefined) {
    const you = part("span", "ideal-mark");
    you.style.left = `${ideal * 10}%`;
    you.title = `Your ideal: ${ideal} of 10`;
    track.prepend(you);
  }
  return part(
    "li",
    "scale-row",
    part("div", "scale-name", name),
    track,
    part("div", "scale-ends", el("span", low), el("span", high)),
  );
}

// How close a book is to the reader's ideals, weighted by how much each matters.
function matchPercent(chosen: Card["scores"]) {
  let total = 0;
  let close = 0;
  for (const s of chosen) {
    const p = prefs.get(s.criterion)!;
    total += p.importance;
    close += p.importance * (1 - Math.abs(s.value - p.target) / 10);
  }
  return total === 0 ? 0 : Math.round((100 * close) / total);
}

// Shows a book against the criteria this reader cares about (importance above 0). A radar needs at
// least three axes, so one or two criteria are shown as scales instead.
function criteriaView(scores: Card["scores"]) {
  const chosen = scores.filter((s) => (prefs.get(s.criterion)?.importance ?? 0) > 0);
  const head = part("div", "fit-head", el("h3", "How it fits you"));
  const section = part("section", "fit", head);
  if (chosen.length === 0) {
    const prompt = el("p");
    const link = el("a", "Set what you like in a book") as HTMLAnchorElement;
    link.href = "#profile/criteria";
    prompt.append(link, " to see how each book measures up.");
    section.append(prompt);
    return section;
  }
  head.append(part("span", "match", `${matchPercent(chosen)}% match`));
  if (chosen.length < 3)
    section.append(
      part(
        "ul",
        "scales",
        ...chosen.map((s) => scaleRow(s.criterionName, s.low, s.high, s.value, prefs.get(s.criterion)!.target)),
      ),
    );
  else
    section.append(
      radar(
        chosen.map((s) => ({
          name: s.criterionName,
          high: s.high,
          value: s.value,
          ideal: prefs.get(s.criterion)!.target,
        })),
      ),
      part(
        "div",
        "legend",
        part("span", "key book", "This book"),
        part("span", "key ideal", "Your ideal"),
      ),
    );
  return section;
}

// What a card must have before a reader sees it.
function missing({ details, characters, scores, genres, themes, tones }: Card) {
  const d = details[0];
  if (!d) return ["details"];
  const gaps: string[] = [];
  if (!d.title) gaps.push("title");
  if (!d.author) gaps.push("author");
  if (!d.summary) gaps.push("summary");
  if (!d.coverUrl) gaps.push("cover");
  if (genres.length === 0) gaps.push("genres");
  if (themes.length === 0) gaps.push("themes");
  if (tones.length === 0) gaps.push("tones");
  if (characters.length === 0) gaps.push("characters");
  if (scores.length < 3) gaps.push("scores");
  return gaps;
}

function renderCard({ details, characters, scores, genres, themes, tones }: Card) {
  const d = details[0]!;
  const cover = el("img") as HTMLImageElement;
  cover.className = "cover";
  cover.src = d.coverUrl;
  cover.alt = `Cover of ${d.title}`;
  cover.draggable = false;

  // An unknown publication date is stored as the epoch, so it isn't shown.
  const published = new Date(d.published);
  const year = published.getTime() === 0 ? "" : String(published.getUTCFullYear());
  const meta = [d.pageCount ? `${d.pageCount} pages` : "", year]
    .filter(Boolean)
    .join(" · ");
  const head = part(
    "div",
    "card-head",
    cover,
    part(
      "div",
      "",
      el("h2", d.title),
      part("p", "byline", d.author),
      ...(meta ? [part("p", "meta", meta)] : []),
      part("ul", "chips", ...genres.map((g) => chip(g.genre, "genre"))),
    ),
  );

  const characterList = part(
    "ul",
    "characters",
    ...characters.map((ch) =>
      part(
        "li",
        "",
        el("strong", ch.name),
        chip(ch.role.toLowerCase(), "role"),
        part("span", "ages", ch.minAge === ch.maxAge ? `age ${ch.minAge}` : `ages ${ch.minAge}–${ch.maxAge}`),
      ),
    ),
  );

  const node = part(
    "article",
    "card",
    part("div", "stamp like", "UP NEXT"),
    part("div", "stamp pass", "PASS"),
    head,
    part("p", "summary", d.summary),
    ...(d.setting ? [part("p", "setting", el("strong", "Setting"), d.setting)] : []),
    el("h3", "Themes & tones"),
    part(
      "ul",
      "chips",
      ...themes.map((t) => chip(t.theme, "theme")),
      ...tones.map((t) => chip(t.tone, "tone")),
    ),
    el("h3", "Characters"),
    characterList,
    criteriaView(scores),
  );
  enableDrag(node);
  return { node, cover };
}

// Builds a book's card off-screen, or answers nothing if it isn't complete.
async function build(book: Book) {
  const skip = (reason: string) => {
    if (debug) console.warn(`Skipping ${book.title}: ${reason}`);
  };
  const result = await client.catalog.card({ book: book.book });
  if ("error" in result) return skip(result.error);
  const gaps = missing(result.card);
  if (gaps.length > 0) return skip(`missing ${gaps.join(", ")}`);
  const { node, cover } = renderCard(result.card);
  try {
    await cover.decode();
  } catch {
    return skip("cover failed to load");
  }
  return node;
}

function fill() {
  filling ??= (async () => {
    const gen = generation;
    while (deck.length < DECK_SIZE && upcoming.length > 0) {
      const batch = upcoming.splice(0, DECK_SIZE - deck.length);
      for (const b of batch) building.add(b.book);
      const nodes = await Promise.all(batch.map(build));
      if (gen !== generation) return;
      batch.forEach((b, i) => {
        building.delete(b.book);
        const node = nodes[i];
        if (node) deck.push({ book: b, node });
        else skipped.add(b.book);
      });
      render();
    }
  })().finally(() => {
    filling = undefined;
    if (deck.length < DECK_SIZE && upcoming.length > 0) fill();
    render();
  });
}

// A placeholder card that shimmers while the next books are found and prepared.
function skeletonCard() {
  return part(
    "article",
    "card skeleton",
    part(
      "div",
      "card-head",
      part("div", "block"),
      part("div", "", part("div", "bar"), part("div", "bar"), part("div", "bar")),
    ),
    part("div", "bar"),
    part("div", "bar"),
    el("p", "Finding your next book…"),
  );
}

function render() {
  const leaving = [...deckEl.querySelectorAll(".leaving")];
  const top = deck[0];
  if (top) {
    // Ease each card in the first time it reaches the top.
    if (!top.node.dataset.shown) {
      top.node.dataset.shown = "1";
      top.node.classList.add("arrive");
      const node = top.node;
      node.addEventListener("animationend", () => node.classList.remove("arrive"), { once: true });
    }
    deckEl.replaceChildren(top.node, ...leaving);
  } else if (filling || upcoming.length > 0 || growing)
    deckEl.replaceChildren(skeletonCard(), ...leaving);
  else
    deckEl.replaceChildren(
      part(
        "div",
        "empty",
        el("h3", "You're all caught up"),
        el("p", "You've seen every book for now. New ones are added as the catalog grows."),
      ),
      ...leaving,
    );
  showDebug();
}

// The catalog's titles, authors and covers, which every list of books draws from.
async function refreshCatalog() {
  const list = await client.catalog.list({});
  if (!("error" in list)) books = list.catalog.books;
}

// Shelves and friend profiles can open before the feed has loaded the catalog.
async function ensureCatalog() {
  if (books.length === 0) await refreshCatalog();
}

async function loadFeed({ reset = false } = {}) {
  if (reset) {
    generation++;
    deck = [];
    upcoming = [];
    building.clear();
    skipped.clear();
    deckEl.replaceChildren(skeletonCard());
  }
  const gen = generation;
  await refreshCatalog();
  let order = [...books];
  if (signedIn()) {
    const [history, ranked] = await Promise.all([
      client.feed.history({ session }),
      client.feed.ranked({ session }),
    ]);
    const swiped = new Set(
      "error" in history ? [] : history.history.swipes.map((s) => s.item),
    );
    const rank = new Map(
      "error" in ranked ? [] : ranked.ranking.items.map((r, i) => [r.item, i]),
    );
    fits = new Map(
      "error" in ranked ? [] : ranked.ranking.items.map((r) => [r.item, r.fit]),
    );
    const unranked = rank.size;
    order = order
      .filter((b) => !swiped.has(b.book))
      .sort(
        (a, b) =>
          (rank.get(a.book) ?? unranked) - (rank.get(b.book) ?? unranked),
      );
  }
  if (gen !== generation) return;
  const held = new Set([
    ...deck.map((c) => c.book.book),
    ...building,
    ...skipped,
  ]);
  upcoming = order.filter((b) => !held.has(b.book));
  fill();
  render();
  growIfLow();
}

async function growIfLow() {
  const unseen = deck.length + building.size + upcoming.length;
  if (growing || !signedIn() || unseen > GROW_AT) return;
  growing = true;
  const before = books.length;
  // Not awaited: the engine holds the answer until the batch's work drains or the request's
  // 30-second deadline passes, and the batch carries on either way. A BATCH_RUNNING refusal is
  // fine too, since someone else's batch will add books.
  void client.catalog.grow({ session });
  const started = Date.now();
  const timer = setInterval(async () => {
    await loadFeed();
    if (books.length > before || Date.now() - started > POLL_LIMIT_MS) {
      clearInterval(timer);
      growing = false;
      render();
    }
  }, POLL_MS);
}

const SWIPE_DISTANCE = 100; // px a card must be dragged to count as a swipe

function enableDrag(node: HTMLElement) {
  let startX: number | undefined;
  node.addEventListener("pointerdown", (event) => {
    if (deck[0]?.node !== node) return;
    // Capturing the pointer would retarget clicks to the card, so links and buttons inside it
    // never activate. Presses on them don't start a drag.
    if ((event.target as Element).closest("a, button")) return;
    startX = event.clientX;
    node.setPointerCapture(event.pointerId);
    node.classList.add("dragging");
  });
  node.addEventListener("pointermove", (event) => {
    if (startX === undefined) return;
    const dx = event.clientX - startX;
    node.style.transform = `translateX(${dx}px) rotate(${dx / 20}deg)`;
    node.dataset.hint =
      dx > SWIPE_DISTANCE ? "like" : dx < -SWIPE_DISTANCE ? "pass" : "";
  });
  const release = (dx: number) => {
    startX = undefined;
    node.classList.remove("dragging");
    delete node.dataset.hint;
    if (Math.abs(dx) > SWIPE_DISTANCE) swipe(dx > 0 ? "like" : "pass");
    else node.style.transform = "";
  };
  node.addEventListener("pointerup", (event) => {
    if (startX !== undefined) release(event.clientX - startX);
  });
  node.addEventListener("pointercancel", () => {
    if (startX !== undefined) release(0);
  });
}

async function swipe(direction: "like" | "pass") {
  const top = deck[0];
  if (!top) return;
  // Move on right away; the next card is already built.
  deck.shift();
  const sign = direction === "like" ? 1 : -1;
  top.node.classList.add("leaving");
  top.node.style.transform = `translateX(${sign * 120}vw) rotate(${sign * 30}deg)`;
  setTimeout(() => {
    if (top.node.classList.contains("leaving")) top.node.remove();
  }, 300);
  render();
  fill();

  const input = { session, item: top.book.book };
  const result =
    direction === "like"
      ? await client.feed.like(input)
      : await client.feed.pass(input);
  if ("error" in result) {
    top.node.classList.remove("leaving");
    top.node.style.transform = "";
    deck.unshift(top);
    render();
    toast("Couldn't save that swipe. Try again.", "warn");
    return;
  }
  toast(
    direction === "like" ? `Added ${top.book.title} to Up Next` : `Passed on ${top.book.title}`,
  );
  await Promise.all([loadFeed(), showShelf()]);
}

document.querySelector("#like")!.addEventListener("click", () => swipe("like"));
document.querySelector("#pass")!.addEventListener("click", () => swipe("pass"));
document.addEventListener("keydown", (event) => {
  if (
    !signedIn() ||
    currentView() !== "feed" ||
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLSelectElement
  )
    return;
  if (event.key === "ArrowRight") swipe("like");
  if (event.key === "ArrowLeft") swipe("pass");
});

type ShelfName = "UP_NEXT" | "FINISHED" | "FAVORITES";
type Tab = ShelfName | "PASSED";
let currentShelf: Tab = "UP_NEXT";

const shelfEl = document.querySelector<HTMLUListElement>("#shelf")!;

// A book as a row: its cover, title and author, with its actions on the right.
function bookRow(item: string, actions: HTMLElement[] = []) {
  const b = books.find((x) => x.book === item);
  const thumb = el("img") as HTMLImageElement;
  thumb.className = "thumb";
  thumb.alt = "";
  thumb.loading = "lazy";
  if (b) thumb.src = b.coverUrl;
  return part(
    "li",
    "book-row",
    thumb,
    part(
      "div",
      "info",
      part("span", "title", b?.title ?? "A book no longer in the catalog"),
      part("span", "author", b?.author ?? ""),
    ),
    part("div", "row-actions", ...actions),
  );
}

function emptyShelf(title: string, text: string) {
  return part("li", "empty", el("h3", title), el("p", text));
}

const EMPTY: Record<Tab, [string, string]> = {
  UP_NEXT: ["Your Up Next is empty", "Swipe right on a book in your feed to save it here."],
  FINISHED: ["No finished books yet", "Tick off a book on Up Next once you've read it."],
  FAVORITES: ["No favorites yet", "Heart a finished book you loved to keep it here."],
  PASSED: ["Nothing passed yet", "Books you swipe left on wait here in case you change your mind."],
};

// Every shelf at once, so the tabs can show counts and a finished book knows if it's a favorite.
async function loadShelves(): Promise<Record<Tab, string[]> | undefined> {
  const [upNext, finished, favorites, history] = await Promise.all([
    ensureCatalog().then(() => client.shelves.view({ session, shelf: "UP_NEXT" })),
    client.shelves.view({ session, shelf: "FINISHED" }),
    client.shelves.view({ session, shelf: "FAVORITES" }),
    client.feed.history({ session }),
  ]);
  if ("error" in upNext || "error" in finished || "error" in favorites || "error" in history)
    return undefined;
  return {
    UP_NEXT: upNext.shelf.items.map((i) => i.item),
    // Most recently finished or loved first.
    FINISHED: finished.shelf.items.map((i) => i.item).reverse(),
    FAVORITES: favorites.shelf.items.map((i) => i.item).reverse(),
    PASSED: history.history.swipes.filter((s) => s.direction === "LEFT").map((s) => s.item),
  };
}

const succeeded = (result: object) => !("error" in result);
const shelve = (item: string, shelf: ShelfName) =>
  client.shelves.add({ session, item, shelf }).then(succeeded);
const unshelve = (item: string, shelf: ShelfName) =>
  client.shelves.remove({ session, item, shelf }).then(succeeded);
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// A row that leaves its shelf slides away at once; the toast then offers Undo.
async function moveOff(
  row: HTMLElement,
  work: () => Promise<boolean>,
  message: string,
  undo?: () => Promise<unknown>,
) {
  row.classList.add("removing");
  const [done] = await Promise.all([work(), pause(220)]);
  if (!done) {
    row.classList.remove("removing");
    toast("Couldn't update your shelf. Try again.", "warn");
    return;
  }
  toast(
    message,
    "ok",
    undo &&
      (async () => {
        await undo();
        await showShelf();
      }),
  );
  await showShelf();
}

function shelfRow(tab: Tab, item: string, favorite: boolean) {
  const row = bookRow(item);
  const title = books.find((b) => b.book === item)?.title ?? "That book";
  const actions: HTMLElement[] = [];
  if (tab === "UP_NEXT")
    actions.push(
      iconButton("check", "Mark as finished", () =>
        moveOff(
          row,
          async () => (await unshelve(item, "UP_NEXT")) && shelve(item, "FINISHED"),
          `Moved ${title} to Finished`,
          async () => {
            await unshelve(item, "FINISHED");
            await shelve(item, "UP_NEXT");
          },
        ),
      ),
      iconButton("x", "Remove from Up Next", () =>
        moveOff(row, () => unshelve(item, "UP_NEXT"), `Removed ${title}`, () =>
          shelve(item, "UP_NEXT"),
        ),
      ),
    );
  if (tab === "FINISHED")
    actions.push(
      iconButton(
        "heart",
        favorite ? "Remove from Favorites" : "Add to Favorites",
        async () => {
          const done = favorite ? await unshelve(item, "FAVORITES") : await shelve(item, "FAVORITES");
          if (!done) return toast("Couldn't update your favorites. Try again.", "warn");
          toast(favorite ? `Removed ${title} from Favorites` : `Added ${title} to Favorites`);
          await showShelf();
        },
        favorite,
      ),
      iconButton("x", "Remove from Finished", () =>
        moveOff(row, () => unshelve(item, "FINISHED"), `Removed ${title} from Finished`, () =>
          shelve(item, "FINISHED"),
        ),
      ),
    );
  if (tab === "FAVORITES")
    actions.push(
      iconButton(
        "heart",
        "Remove from Favorites",
        () =>
          moveOff(row, () => unshelve(item, "FAVORITES"), `Removed ${title} from Favorites`, () =>
            shelve(item, "FAVORITES"),
          ),
        true,
      ),
    );
  if (tab === "PASSED")
    actions.push(
      iconButton("undo", "Reconsider: show it in my feed again", async () => {
        await moveOff(
          row,
          () => client.feed.reconsider({ session, item }).then(succeeded),
          `${title} is back in your feed`,
        );
        await loadFeed();
      }),
    );
  row.querySelector(".row-actions")!.append(...actions);
  return row;
}

async function showShelf() {
  const shelves = await loadShelves();
  if (!shelves) {
    shelfEl.replaceChildren(emptyShelf("Couldn't load your shelves", "Please try again."));
    return;
  }
  for (const count of document.querySelectorAll<HTMLElement>("#tabs [data-count]"))
    count.textContent = String(shelves[count.dataset.count as Tab].length);
  const items = shelves[currentShelf];
  if (items.length === 0) {
    const [title, text] = EMPTY[currentShelf];
    shelfEl.replaceChildren(emptyShelf(title, text));
    return;
  }
  const favorites = new Set(shelves.FAVORITES);
  shelfEl.replaceChildren(
    ...items.map((item) => shelfRow(currentShelf, item, favorites.has(item))),
  );
}

for (const tab of document.querySelectorAll<HTMLButtonElement>("#tabs button")) {
  tab.addEventListener("click", async () => {
    currentShelf = tab.dataset.shelf as Tab;
    for (const t of document.querySelectorAll("#tabs button"))
      t.setAttribute("aria-pressed", String(t === tab));
    await showShelf();
  });
}

const authForm = document.querySelector<HTMLFormElement>("#auth")!;
const authStatus = document.querySelector<HTMLParagraphElement>("#auth-status")!;
const appEl = document.querySelector<HTMLElement>("#app")!;
const criteriaEl = document.querySelector<HTMLUListElement>("#criteria")!;
const profileStatus = document.querySelector<HTMLParagraphElement>("#profile-status")!;
const navIcons = document.querySelectorAll<HTMLElement>("#topbar .icon");

// The feed is the main page; the shelf and profile icons switch to their own views by hash,
// so the back button and reloads keep the reader where they were.
type View = "feed" | "shelves" | "profile" | "reader";
function currentView(): View {
  const hash = location.hash.slice(1);
  if (hash.startsWith("reader/")) return "reader";
  if (hash.startsWith("profile")) return "profile";
  return hash === "shelves" ? hash : "feed";
}
// The username in a #reader/<username> address.
const readerInHash = () => decodeURIComponent(location.hash.slice("#reader/".length));

async function route() {
  const view = currentView();
  for (const section of appEl.querySelectorAll<HTMLElement>(":scope > section"))
    section.hidden = section.dataset.view !== view;
  for (const link of document.querySelectorAll<HTMLElement>("#topbar [data-view]")) {
    if (link.dataset.view === view) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  if (!signedIn()) return;
  if (view === "shelves") await showShelf();
  if (view === "profile") {
    await loadFriends();
    // #profile/criteria opens the profile at the criteria, which sit below the Friends panel.
    if (location.hash === "#profile/criteria") {
      const panel = document.querySelector<HTMLElement>("#criteria-panel")!;
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
      panel.classList.remove("spotlight");
      void panel.offsetWidth; // restart the highlight if it's already playing
      panel.classList.add("spotlight");
    }
  }
  if (view === "reader") await showReader(readerInHash());
}
window.addEventListener("hashchange", route);

// Browser storage can be unavailable (private windows, blocked site data); signing in still works.
function remember(value: string) {
  try {
    if (value) localStorage.setItem(SESSION_KEY, value);
    else localStorage.removeItem(SESSION_KEY);
  } catch {}
}
function recalled() {
  try {
    return localStorage.getItem(SESSION_KEY) ?? "";
  } catch {
    return "";
  }
}

async function enter(token: string, account: string) {
  session = token;
  me = account;
  remember(token);
  document.querySelector("#who")!.textContent = account;
  document.querySelector("#my-avatar")!.textContent = account.slice(0, 1);
  authForm.hidden = true;
  for (const icon of navIcons) icon.hidden = false;
  appEl.hidden = false;
  await route();
  await loadProfile();
  await loadFeed({ reset: true });
}

function leave(message = "") {
  session = "";
  me = "";
  remember("");
  generation++; // drop any cards still being built for the old session
  deck = [];
  upcoming = [];
  prefs = new Map();
  appEl.hidden = true;
  for (const icon of navIcons) icon.hidden = true;
  authForm.hidden = false;
  authStatus.textContent = message;
  if (location.hash) history.replaceState(null, "", location.pathname); // sign-in lands on the feed
}

const AUTH_ERRORS: Record<string, string> = {
  UNAUTHORIZED: "That username and password don't match.",
  CONFLICT: "That username is taken. Try signing in instead.",
  INVALID_REQUEST:
    "Usernames are 3 to 32 letters, numbers, - or _, and passwords at least 8 characters.",
};

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const mode = (event.submitter as HTMLButtonElement | null)?.dataset.mode;
  const credentials = {
    username: document.querySelector<HTMLInputElement>("#username")!.value.trim(),
    password: document.querySelector<HTMLInputElement>("#password")!.value,
  };
  authStatus.textContent = "";
  const result =
    mode === "register"
      ? await client.auth.register(credentials)
      : await client.auth["sign-in"](credentials);
  if ("error" in result) {
    authStatus.textContent = AUTH_ERRORS[result.error] ?? `Could not sign in: ${result.error}`;
    return;
  }
  document.querySelector<HTMLInputElement>("#password")!.value = "";
  await enter(result.session, result.account);
});

document.querySelector("#sign-out")!.addEventListener("click", async () => {
  await client.auth["sign-out"]({ session });
  leave();
});

async function loadProfile() {
  const result = await client.profile.view({ session });
  if ("error" in result) {
    if (result.error === "UNAUTHORIZED") leave("Your session ended. Please sign in again.");
    else criteriaEl.replaceChildren(el("li", `Could not load your criteria: ${result.error}`));
    return;
  }
  prefs = new Map(
    result.preferences.preferences.map((p) => [p.criterion, { target: p.target, importance: p.importance }]),
  );
  criteriaEl.replaceChildren(
    ...result.criteria.criteria.map(({ criterion, name, description, low, high }) => {
      const pref = () => prefs.get(criterion) ?? { target: 5, importance: 0 };
      const item = part("li", "criterion");

      // Saves both parts together, and puts the controls back if it fails.
      const save = async (next: { target: number; importance: number }, message: string) => {
        const previous = pref();
        prefs.set(criterion, next);
        show();
        const saved = await client.profile.weigh({ session, criterion, ...next });
        if ("error" in saved) {
          prefs.set(criterion, previous);
          show();
          toast("Couldn't save that. Try again.", "warn");
          return;
        }
        profileStatus.textContent = message;
        toast(message);
        // Cards already built carry the old radar and match, so rebuild the deck.
        await loadFeed({ reset: true });
      };

      // Where on the scale they like books.
      const slider = el("input") as HTMLInputElement;
      slider.type = "range";
      slider.min = "0";
      slider.max = "10";
      slider.step = "1";
      slider.setAttribute("aria-label", `${name}: from ${low} at 0 to ${high} at 10`);
      const reading = part("span", "reading");
      const describe = (t: number) =>
        t <= 2 ? low : t >= 8 ? high : t === 5 ? "right in the middle" : `leaning ${t < 5 ? low : high}`;
      slider.addEventListener("input", () => (reading.textContent = describe(Number(slider.value))));
      slider.addEventListener("change", () => {
        const target = Number(slider.value);
        void save({ ...pref(), target }, `You like ${name}: ${describe(target)}`);
      });

      // How much it matters.
      const pills: HTMLButtonElement[] = [];
      for (let w = 0; w <= 5; w++) {
        const pill = part("button", w === 0 ? "zero" : "", String(w)) as HTMLButtonElement;
        pill.type = "button";
        pill.title = w === 0 ? "Doesn't matter" : w === 5 ? "Matters most" : `Matters ${w} of 5`;
        pill.addEventListener("click", () => {
          if (w === pref().importance) return;
          void save(
            { ...pref(), importance: w },
            w === 0 ? `${name} won't shape your feed` : `${name} matters ${w} of 5`,
          );
        });
        pills.push(pill);
      }
      const weightsRow = part("div", "weights", ...pills);
      weightsRow.setAttribute("role", "group");
      weightsRow.setAttribute("aria-label", `How much ${name} matters`);

      const scale = part(
        "div",
        "scale-input",
        slider,
        part("div", "scale-ends", el("span", low), el("span", high)),
      );
      // Every pill up to the chosen importance fills in, so the row reads like a meter.
      const show = () => {
        const { target, importance } = pref();
        slider.value = String(target);
        reading.textContent = describe(target);
        pills.forEach((pill, w) => {
          pill.setAttribute("aria-pressed", String(w === importance));
          pill.classList.toggle("on", w > 0 && w < importance);
        });
        item.classList.toggle("off", importance === 0);
      };
      show();

      item.append(
        part("div", "criterion-head", part("span", "name", name), reading),
        part("p", "desc", description),
        scale,
        part("div", "importance", part("span", "label", "How much it matters"), weightsRow),
      );
      return item;
    }),
  );
}

const friendsStatus = document.querySelector<HTMLParagraphElement>("#friends-status")!;
const readerStatus = document.querySelector<HTMLParagraphElement>("#reader-status")!;
const readerFollow = document.querySelector<HTMLButtonElement>("#reader-follow")!;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// A username that opens that reader's profile, or your own shelves for your own name.
function personLink(username: string) {
  const link = el("a") as HTMLAnchorElement;
  link.append(avatar(username), username);
  link.href = username === me ? "#shelves" : `#reader/${encodeURIComponent(username)}`;
  return link;
}

function peopleList(people: { username: string }[]) {
  if (people.length === 0) return [part("li", "none", "No one yet.")];
  return people.map(({ username }) => {
    const li = el("li");
    li.append(personLink(username));
    return li;
  });
}

async function loadFriends() {
  const result = await client.friends.mine({ session });
  if ("error" in result) {
    if (result.error === "UNAUTHORIZED") leave("Your session ended. Please sign in again.");
    else friendsStatus.textContent = `Could not load your friends: ${result.error}`;
    return;
  }
  document.querySelector("#following-count")!.textContent = String(result.following.people.length);
  document.querySelector("#followers-count")!.textContent = String(result.followers.people.length);
  document.querySelector("#following-list")!.replaceChildren(...peopleList(result.following.people));
  document.querySelector("#followers-list")!.replaceChildren(...peopleList(result.followers.people));
}

const FOLLOW_ERRORS: Record<string, (name: string) => string> = {
  NOT_FOUND: (name) => `There's no reader called ${name}.`,
  INVALID_REQUEST: () => "You can't follow yourself.",
  CONFLICT: (name) => `You already follow ${name}.`,
};

document.querySelector<HTMLFormElement>("#follow-form")!.addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.querySelector<HTMLInputElement>("#follow-username")!;
  const username = input.value.trim();
  const result = await client.friends.follow({ session, username });
  if ("error" in result) {
    friendsStatus.textContent =
      FOLLOW_ERRORS[result.error]?.(username) ?? `Could not follow ${username}: ${result.error}`;
    return;
  }
  input.value = "";
  friendsStatus.textContent = "";
  toast(`You're now following ${username}`);
  await loadFriends();
});

// One of a friend's shelves, with a way to put each book on your own Up Next.
function friendShelf(title: string, items: { item: string }[]) {
  const section = part("section", "", el("h3", title));
  if (items.length === 0) {
    section.append(part("ul", "book-list", emptyShelf("Nothing here yet", "Check back later.")));
    return section;
  }
  section.append(
    part(
      "ul",
      "book-list",
      ...items.map(({ item }) => {
        const add = iconButton("plus", "Add to my Up Next", async () => {
          const result = await client.shelves.add({ session, item, shelf: "UP_NEXT" });
          const saved = !("error" in result);
          if (saved) toast("Added to your Up Next");
          else toast(result.error === "CONFLICT" ? "Already on your Up Next" : "Couldn't add it", "warn");
          if (saved || result.error === "CONFLICT") {
            const onShelf = iconButton("check", "On your Up Next", async () => {}, true);
            onShelf.disabled = true;
            add.replaceWith(onShelf);
          }
        });
        return bookRow(item, [add]);
      }),
    ),
  );
  return section;
}

// The network lists, collapsed under their counts as in the friend-profile sketch.
function networkSummary(label: string, people: { username: string }[]) {
  return part(
    "details",
    "",
    el("summary", label),
    part("ul", "person-list", ...peopleList(people)),
  );
}

async function showReader(username: string) {
  if (username === me) {
    location.hash = "#shelves";
    return;
  }
  const network = document.querySelector("#reader-network")!;
  const shelves = document.querySelector("#reader-shelves")!;
  document.querySelector("#reader-name")!.textContent = username;
  document.querySelector("#reader-avatar")!.textContent = username.slice(0, 1);
  readerStatus.textContent = "";
  const [result] = await Promise.all([client.friends.reader({ session, username }), ensureCatalog()]);
  if ("error" in result) {
    if (result.error === "UNAUTHORIZED") return leave("Your session ended. Please sign in again.");
    network.replaceChildren();
    shelves.replaceChildren();
    readerFollow.hidden = true;
    readerStatus.textContent =
      result.error === "NOT_FOUND"
        ? `There's no reader called ${username}.`
        : `Couldn't load ${username}. Please try again.`;
    return;
  }
  network.replaceChildren(
    networkSummary(plural(result.followers.people.length, "follower"), result.followers.people),
    networkSummary(`${result.following.people.length} following`, result.following.people),
  );

  readerFollow.hidden = false;
  readerFollow.disabled = false;
  readerFollow.textContent = result.followedByYou ? "Unfollow" : "Follow";
  readerFollow.className = `btn small ${result.followedByYou ? "ghost" : "primary"}`;
  readerFollow.onclick = async () => {
    readerFollow.disabled = true;
    const change = result.followedByYou
      ? await client.friends.unfollow({ session, username })
      : await client.friends.follow({ session, username });
    if ("error" in change) {
      readerFollow.disabled = false;
      toast("Couldn't update. Try again.", "warn");
      return;
    }
    toast(result.followedByYou ? `Unfollowed ${username}` : `You're now following ${username}`);
    await showReader(username);
  };

  if ("upNext" in result)
    shelves.replaceChildren(
      friendShelf("Up Next", result.upNext.items),
      friendShelf("Finished", result.finished.items),
      friendShelf("Favorites", result.favorites.items),
    );
  else
    shelves.replaceChildren(
      part(
        "div",
        "empty locked",
        el("h3", `${username}'s shelves are shared with followers`),
        el("p", `Follow ${username} to see what they're reading next and what they loved.`),
      ),
    );
}

// Resume a remembered session, or ask the reader to sign in.
const stored = recalled();
const current = stored ? await client.auth.current({ session: stored }) : undefined;
if (current && !("error" in current)) await enter(stored, current.account);
else leave(stored ? "Your session ended. Please sign in again." : "");
