// Runs the assembled application behind its real HTTP handler on a free port, so composition
// tests exercise the same path as the browser.
import { createGateway } from "@mit-sdg/sync-engine/boundary";
import { createHttpClient } from "@mit-sdg/sync-engine-http/client";
import { createHttpHandler } from "@mit-sdg/sync-engine-http/handler";
import type { NoveltyWireHttp } from "../generated/wire.ts";
import { assembleApplication } from "../src/assembly.ts";
import { BookCatalogingConcept } from "../src/concepts/BookCataloging.ts";
import { DraftingConcept } from "../src/concepts/Drafting.ts";
import { RecommendingConcept } from "../src/concepts/Recommending.ts";
import { policy } from "../src/http.ts";
import { db } from "./helpers.ts";

export function startApp() {
  const application = assembleApplication();
  const gateway = createGateway({ application });
  const api = createHttpHandler({ application, gateway, policy });
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, routes: { "/api/*": api } });
  const client = createHttpClient<NoveltyWireHttp>({ baseUrl: `${server.url.origin}/api` });
  return { client, stop: () => server.stop(true) };
}

export type Client = ReturnType<typeof startApp>["client"];

export const PASSWORD = "test-password-1";

/** Registers a reader and returns their session. */
export async function signUp(client: Client, username: string) {
  const result = await client.auth.register({ username, password: PASSWORD });
  if ("error" in result) throw new Error(`Could not register ${username}: ${result.error}`);
  return result.session;
}

// Each criterion is a scale between two ends, as in scripts/books.ts.
export const CRITERIA = ["pace", "tone", "humor"] as const;
const ENDS: Record<(typeof CRITERIA)[number], [string, string]> = {
  pace: ["slow burn", "page-turner"],
  tone: ["light and cozy", "dark and intense"],
  humor: ["serious", "funny"],
};

/**
 * Seeds a small described catalog the way scripts/seed.ts and sync-features.ts do: criteria
 * with matching aspects, then books described, scored and given ranking features.
 */
export async function seedCatalog(
  books: { title: string; isbn: string; genre: string; scores: number[] }[],
) {
  const catalog = new BookCatalogingConcept(db);
  const drafting = new DraftingConcept(db);
  const recommending = new RecommendingConcept(db);
  const criteria: Record<string, string> = {};
  for (const name of CRITERIA) {
    const [low, high] = ENDS[name];
    const description = `0 is ${low}, 10 is ${high}.`;
    ({ criterion: criteria[name] } = await catalog.defineCriterion({ name, description, low, high }));
    await drafting.defineAspect({ name, description });
  }
  const ids: Record<string, string> = {};
  for (const b of books) {
    const { book } = await catalog.addBook({
      isbn: b.isbn,
      title: b.title,
      author: "Seed Author",
      published: new Date("1990-01-01"),
      pageCount: 200,
      coverUrl: "https://covers.example/seed.jpg",
    });
    await catalog.addGenre({ book, genre: b.genre });
    await catalog.addCharacter({ book, name: "Lead", role: "MAIN", minAge: 30, maxAge: 31 });
    await catalog.addTheme({ book, theme: "identity" });
    await catalog.addTone({ book, tone: "wry" });
    await catalog.describe({ book, summary: `About ${b.title}.`, setting: "Earth" });
    for (const [i, name] of CRITERIA.entries()) {
      await catalog.scoreBook({ book, criterion: criteria[name]!, value: b.scores[i]! });
      await recommending.setFeature({ item: book, feature: criteria[name]!, value: b.scores[i]! });
    }
    ids[b.title] = book;
  }
  return { criteria, books: ids };
}
