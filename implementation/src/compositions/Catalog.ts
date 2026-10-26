import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { each, form, former } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";

const { BookCataloging } = concepts;

const BookList = former(
  "the book list",
  (_input, { book, title, author, coverUrl }) =>
    form({
      books: each(
        BookCataloging._described({}).is({ book, title, author, coverUrl }),
      ).form({
        book,
        title,
        author,
        coverUrl,
      }),
    }),
);

const FirstImpression = former(
  "the first impression card",
  (
    { book },
    {
      title,
      author,
      published,
      pageCount,
      coverUrl,
      genre,
      summary,
      setting,
      theme,
      tone,
      name,
      role,
      minAge,
      maxAge,
      criterion,
      criterionName,
      low,
      high,
      value,
    },
  ) =>
    form({
      details: each(
        BookCataloging._book({ book }).is({
          title,
          author,
          published,
          pageCount,
          coverUrl,
          summary,
          setting,
        }),
      ).form({
        title,
        author,
        published,
        pageCount,
        coverUrl,
        summary,
        setting,
      }),
      characters: each(
        BookCataloging._characters({ book }).is({ name, role, minAge, maxAge }),
      ).form({
        name,
        role,
        minAge,
        maxAge,
      }),
      scores: each(
        BookCataloging._scores({ book }).is({
          criterion,
          criterionName,
          low,
          high,
          value,
        }),
      ).form({
        criterion,
        criterionName,
        low,
        high,
        value,
      }),
      genres: each(BookCataloging._genres({ book }).is({ genre })).form({
        genre,
      }),
      themes: each(BookCataloging._themes({ book }).is({ theme })).form({
        theme,
      }),
      tones: each(BookCataloging._tones({ book }).is({ tone })).form({ tone }),
    }),
);

const List = endpoint("/catalog/list", () =>
  receive({}).then(respond({ catalog: BookList({}) })),
);

const Card = endpoint(
  "/catalog/card",
  ({ book }) =>
    receive({ book }).then(respond({ card: FirstImpression({ book }) })),
  { input: { required: ["book"] } },
);

export const composition = { BookList, FirstImpression, List, Card };
