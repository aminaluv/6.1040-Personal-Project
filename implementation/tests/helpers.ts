import { db } from "../src/db.ts";

export { db };

/** Empties the test database. Create fresh concept instances afterwards so their indexes are rebuilt. */
export const resetDb = () => db.dropDatabase();

/** An English-language ISBN-13 that Harvesting accepts. */
export const isbn = (n: number) => `9780${String(n).padStart(9, "0")}`;

export interface FakeWork {
  title: string;
  author?: string;
  isbn?: string;
  cover?: boolean;
}

interface DraftAnswer {
  summary?: string;
  setting?: string;
  characters?: { name: string; role: string; minAge: number; maxAge: number }[];
  themes?: string[];
  tones?: string[];
  ratings?: { aspect: string; value: number }[];
}

/** A complete answer: one character, one theme, one tone, and a rating for every aspect. */
export function completeAnswer(title: string, aspects: string[]): DraftAnswer {
  return {
    summary: `A spoiler-free summary of ${title}.`,
    setting: "A city by the sea",
    characters: [{ name: `${title} Hero`, role: "MAIN", minAge: 20, maxAge: 25 }],
    themes: ["Courage", "home"],
    tones: ["hopeful"],
    ratings: aspects.map((aspect, i) => ({ aspect, value: (title.length + i * 3) % 11 })),
  };
}

interface FakeWebOptions {
  /** Open Library's works for each subject, best rated first. */
  topics?: Record<string, FakeWork[]>;
  /** Makes Open Library's search answer with this HTTP status instead. */
  openLibraryStatus?: number;
  /** Gemini's answer for a book; the default is complete. */
  answer?: (title: string, aspects: string[]) => DraftAnswer;
  /** An HTTP status for Gemini to answer with instead, by model, and the body to send with it. */
  geminiError?: (model: string) => { status: number; body?: string } | undefined;
}

/**
 * Replaces fetch so Open Library and Gemini answer from fixtures. Every other request, such as
 * the tests' own HTTP calls to the app, goes through to the real fetch. Call restore() after.
 */
export function fakeWeb(options: FakeWebOptions = {}) {
  const real = globalThis.fetch;
  const geminiModels: string[] = [];
  const fake = async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));

    if (url.hostname === "openlibrary.org") {
      if (url.pathname === "/search.json") {
        if (options.openLibraryStatus)
          return new Response("unavailable", { status: options.openLibraryStatus });
        const topic = /subject:"([^"]+)"/.exec(url.searchParams.get("q") ?? "")?.[1] ?? "";
        const offset = Number(url.searchParams.get("offset") ?? 0);
        const limit = Number(url.searchParams.get("limit") ?? 25);
        const docs = (options.topics?.[topic] ?? [])
          .slice(offset, offset + limit)
          .map((w, i) => ({
            key: `/works/OL${offset + i}W`,
            title: w.title,
            author_name: [w.author ?? "A. Writer"],
            isbn: w.isbn ? [w.isbn] : [],
            cover_i: w.cover === false ? undefined : 1000 + offset + i,
            first_publish_year: 2001,
            number_of_pages_median: 320,
            subject: [topic],
          }));
        return Response.json({ docs });
      }
      return Response.json({ description: "A description from Open Library." });
    }

    if (url.hostname === "generativelanguage.googleapis.com") {
      const model = /models\/([^:]+):/.exec(url.pathname)?.[1] ?? "";
      geminiModels.push(model);
      const error = options.geminiError?.(model);
      if (error) return new Response(error.body ?? "{}", { status: error.status });
      const prompt: string = JSON.parse(String(init?.body)).contents[0].parts[0].text;
      const title = /Book: "(.+)" by/.exec(prompt)?.[1] ?? "";
      const aspects = [...prompt.split("Aspects:")[1]!.matchAll(/^- ([^:]+):/gm)].map(
        (m) => m[1]!,
      );
      const answer = (options.answer ?? completeAnswer)(title, aspects);
      return Response.json({
        candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }],
      });
    }

    return real(input, init);
  };
  globalThis.fetch = fake as typeof fetch;
  return { geminiModels, restore: () => void (globalThis.fetch = real) };
}

/** Polls until check() holds, for work that carries on after a request answers. */
export async function eventually(check: () => Promise<boolean>, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error("Timed out waiting for the condition.");
    await Bun.sleep(100);
  }
}
