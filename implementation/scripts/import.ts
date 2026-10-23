import { client, db } from "../src/db.ts";
import {
  BookCatalogingConcept,
  DuplicateIsbn,
} from "../src/concepts/BookCataloging.ts";

interface OpenLibraryBook {
  title: string;
  subtitle?: string;
  authors?: { name: string }[];
  publish_date?: string;
  number_of_pages?: number;
  subjects?: { name: string }[];
  subject_places?: { name: string }[];
  subject_people?: { name: string }[];
  subject_times?: { name: string }[];
}

const isbns = process.argv.slice(2);
if (isbns.length === 0) {
  console.error("Usage: bun run import <isbn> [<isbn> ...]");
  process.exit(1);
}

async function lookup(isbn: string): Promise<OpenLibraryBook | undefined> {
  const url = new URL("https://openlibrary.org/api/books");
  url.searchParams.set("bibkeys", `ISBN:${isbn}`);
  url.searchParams.set("format", "json");
  url.searchParams.set("jscmd", "data");
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await fetch(url);
    if (response.ok) {
      const data = (await response.json()) as Record<string, OpenLibraryBook>;
      return data[`ISBN:${isbn}`];
    }
    if (attempt === 3) {
      throw new Error(
        `Open Library answered ${response.status} for ${isbn}: ${await response.text()}`,
      );
    }
    await Bun.sleep(attempt * 2000);
  }
}

function toDate(published?: string) {
  if (!published) return new Date(0);
  const date = new Date(
    /^\d{4}$/.test(published) ? `${published}-01-01` : published,
  );
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

async function fetchWork(
  isbn: string,
): Promise<{ description?: string; firstPublished?: string }> {
  // The edition record (found by ISBN) points to its work.
  const edition = await fetch(`https://openlibrary.org/isbn/${isbn}.json`);
  if (!edition.ok) return {};
  const { works } = (await edition.json()) as { works?: { key: string }[] };
  const workKey = works?.[0]?.key;
  if (!workKey) return {};

  const work = await fetch(`https://openlibrary.org${workKey}.json`);
  if (!work.ok) return {};
  const data = (await work.json()) as {
    description?: string | { value: string };
    first_publish_date?: string;
  };
  const description =
    typeof data.description === "string"
      ? data.description
      : data.description?.value;
  return { description, firstPublished: data.first_publish_date };
}

const IGNORED_SUBJECTS = new Set([
  "fiction",
  "general",
  "literature",
  "novels",
  "large type books",
]);

function toGenres(subjects: { name: string }[] = []) {
  const names = subjects.map((s) => s.name.trim().toLowerCase());
  return [...new Set(names.filter((n) => n && !IGNORED_SUBJECTS.has(n)))].slice(
    0,
    5,
  );
}

await client.connect();
const catalog = new BookCatalogingConcept(db);

for (const isbn of isbns) {
    let info: OpenLibraryBook | undefined;
    try {
        info = await lookup(isbn);
    } catch (error) {
        console.warn(`Skipping ${isbn}: ${(error as Error).message}`);
        continue;
    }
    if (!info) {
        console.warn(`Not found in Open Library: ${isbn}`);
        continue;
    }
    if (!info.number_of_pages)
        console.warn(`No page count for ${info.title}; recording 0.`);

    let book: string;
    try {
        ({ book } = await catalog.addBook({
        isbn,
        title: info.subtitle ? `${info.title}: ${info.subtitle}` : info.title,
        author: (info.authors?.map((a) => a.name) ?? ["Unknown"]).join(", "),
        published: toDate(info.publish_date),
        pageCount: info.number_of_pages ?? 0,
        coverUrl: `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`,
        }));
    } catch (error) {
        if (error instanceof DuplicateIsbn) {
        console.log(`Already in catalog: ${info.title}`);
        continue;
        }
        throw error;
    }
    for (const genre of toGenres(info.subjects))
        await catalog.addGenre({ book, genre });
    const work = await fetchWork(isbn);
    const names = (list?: { name: string }[]) => list?.map((x) => x.name) ?? [];
    await Bun.write(
        `sources/${isbn}.json`,
        JSON.stringify(
        {
            isbn,
            title: info.title,
            authors: names(info.authors),
            firstPublished: work.firstPublished ?? info.publish_date,
            description: work.description ?? null,
            subjects: names(info.subjects),
            places: names(info.subject_places),
            people: names(info.subject_people),
            times: names(info.subject_times),
        },
        null,
        2,
        ),
    );
    if (!work.description) console.warn(`No description for ${info.title}; the model will rely on its own knowledge.`);
    console.log(`Imported ${info.title} (PENDING)`);
    await Bun.sleep(500);
}

await client.close();
