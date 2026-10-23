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

// The reader's weight on each criterion, by criterion id. Above 0 means it's on their radar.
let weights = new Map<string, number>();

function el(tag: string, text?: string) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
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

// Shows a book's scores on the criteria this reader weighted above 0. A radar needs at least
// three axes, so one or two chosen criteria are listed instead.
function criteriaView(scores: Card["scores"]) {
  const chosen = scores.filter((s) => (weights.get(s.criterion) ?? 0) > 0);
  if (chosen.length === 0)
    return el("p", "Weight the criteria you care about below to see them here.");
  if (chosen.length < 3) {
    const list = el("ul");
    list.className = "scores";
    for (const s of chosen)
      list.append(el("li", `${s.criterionName}: ${s.value} / 10`));
    return list;
  }
  return radar(chosen);
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
  cover.src = d.coverUrl;
  cover.alt = `Cover of ${d.title}`;
  cover.draggable = false;
  const characterList = el("ul");
  for (const ch of characters) {
    characterList.append(
      el(
        "li",
        `${ch.name} (${ch.role.toLowerCase()}, ages ${ch.minAge}–${ch.maxAge})`,
      ),
    );
  }
  const node = el("article");
  node.className = "card";
  node.append(
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

function render() {
  const leaving = [...deckEl.querySelectorAll(".leaving")];
  const top = deck[0];
  if (top) deckEl.replaceChildren(top.node, ...leaving);
  else
    deckEl.replaceChildren(
      el(
        "p",
        filling || upcoming.length > 0 || growing
          ? "Finding your next book…"
          : "You've seen every book in the catalog.",
      ),
      ...leaving,
    );
  showDebug();
}

async function loadFeed({ reset = false } = {}) {
  if (reset) {
    generation++;
    deck = [];
    upcoming = [];
    building.clear();
    skipped.clear();
    deckEl.replaceChildren(el("p", "Finding your next book…"));
  }
  const gen = generation;
  const list = await client.catalog.list({});
  if (!("error" in list)) books = list.catalog.books;
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
    statusEl.textContent = `Could not save that swipe: ${result.error}`;
    return;
  }
  statusEl.textContent =
    direction === "like"
      ? `Added ${top.book.title} to Up Next.`
      : `Passed on ${top.book.title}.`;
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

type ShelfName = "UP_NEXT" | "FAVORITES";
type Tab = ShelfName | "PASSED";
let currentShelf: Tab = "UP_NEXT";

const shelfEl = document.querySelector<HTMLUListElement>("#shelf")!;
const statusEl = document.querySelector<HTMLParagraphElement>("#status")!;


async function showShelf() {
    if (currentShelf === "PASSED") {
    const history = await client.feed.history({ session });
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
            await client.feed.reconsider({ session, item });
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
        session,
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
            await client.shelves.add({ session, item, shelf: "FAVORITES" });
            await client.shelves.remove({ session, item, shelf: "UP_NEXT" });
            await showShelf();
            });
            li.append(finished);
        }

        const remove = el("button", "Remove");
        remove.addEventListener("click", async () => {
            await client.shelves.remove({
            session,
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


const authForm = document.querySelector<HTMLFormElement>("#auth")!;
const authStatus = document.querySelector<HTMLParagraphElement>("#auth-status")!;
const appEl = document.querySelector<HTMLElement>("#app")!;
const criteriaEl = document.querySelector<HTMLUListElement>("#criteria")!;
const profileStatus = document.querySelector<HTMLParagraphElement>("#profile-status")!;
const navIcons = document.querySelectorAll<HTMLElement>("#topbar .icon");

// The feed is the main page; the shelf and profile icons switch to their own views by hash,
// so the back button and reloads keep the reader where they were.
type View = "feed" | "shelves" | "profile";
function currentView(): View {
  const hash = location.hash.slice(1);
  return hash === "shelves" || hash === "profile" ? hash : "feed";
}

async function route() {
  const view = currentView();
  for (const section of appEl.querySelectorAll<HTMLElement>(":scope > section"))
    section.hidden = section.dataset.view !== view;
  for (const link of document.querySelectorAll<HTMLElement>("#topbar [data-view]")) {
    if (link.dataset.view === view) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  if (signedIn() && view === "shelves") await showShelf();
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
  remember(token);
  document.querySelector("#who")!.textContent = account;
  authForm.hidden = true;
  for (const icon of navIcons) icon.hidden = false;
  appEl.hidden = false;
  await route();
  await loadProfile();
  await loadFeed({ reset: true });
}

function leave(message = "") {
  session = "";
  remember("");
  generation++; // drop any cards still being built for the old session
  deck = [];
  upcoming = [];
  weights = new Map();
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
  weights = new Map(result.weights.weights.map((w) => [w.criterion, w.weight]));
  criteriaEl.replaceChildren(
    ...result.criteria.criteria.map(({ criterion, name, description }) => {
      const li = el("li");
      const label = el("label");
      const select = el("select") as HTMLSelectElement;
      for (let w = 0; w <= 5; w++) select.append(new Option(String(w), String(w)));
      select.value = String(weights.get(criterion) ?? 0);
      select.addEventListener("change", async () => {
        const weight = Number(select.value);
        const saved = await client.profile.weigh({ session, criterion, weight });
        if ("error" in saved) {
          profileStatus.textContent = `Could not save that weight: ${saved.error}`;
          select.value = String(weights.get(criterion) ?? 0);
          return;
        }
        weights.set(criterion, weight);
        profileStatus.textContent = `Saved: ${name} is now ${weight}.`;
        // Cards already built carry the old radar, so rebuild the deck.
        await loadFeed({ reset: true });
      });
      label.append(el("strong", name), " ", select);
      li.append(label, el("p", description));
      return li;
    }),
  );
}

// Resume a remembered session, or ask the reader to sign in.
const stored = recalled();
const current = stored ? await client.auth.current({ session: stored }) : undefined;
if (current && !("error" in current)) await enter(stored, current.account);
else leave(stored ? "Your session ended. Please sign in again." : "");
