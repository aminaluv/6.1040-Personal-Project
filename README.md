# 6.1040-Personal-Project

## What is Novelty? 
Novelty is a book discovery app that helps readers or non-readers find their next read using spoiler-free First Impression cards, which show each book's summary, character, themes and tones, and how closely the book matches what the reader likes. Readers can swipe right to save a book to the Up Next shelf or left to pass on a book; every swipe sharpens the recommendations.

## P4 Complete Code
Link to Novelty: 

[Final Demo Video](https://drive.google.com/file/d/1aaQcFe6PjZgbM7pMkZlYRnW2UwvrumbB/view?usp=sharing)

## Design for Novelty

**[Final design document](./design/p4/design_document.md)**: how the final design differs from P1
and the P3 visual design.

[Problem Framing and Stakeholders](./design/p1/problem_framing.md)

[Application Pitch](./design/p1/pitch.md)

[Concept Specification](./design/p1/concepts.md)

[UI Sketches](./design/p1/ui_sketches.md)

[User Journey](./design/p1/user_journey.md)

## P3 Beta

**App:** [novelty.mit-sdg.dev](https://novelty.mit-sdg.dev/#)

**Demo videos**

- [Beta demo](https://drive.google.com/file/d/159K7dYt9HVSnyecuN_gS0mkIZ4EngeV1/view?usp=sharing)
- [Alpha demo](https://drive.google.com/file/d/18VW0wxWdoDxm2khsY1ZidhexZvLRYbQi/view?usp=sharing)

**Deliverables**

- [Code](./implementation)
- Specifications: [concepts](./implementation/design/concepts), [compositions](./implementation/design/compositions), [types](./implementation/design/types.md)
- [Tests](./implementation/tests) and [saved test output](./implementation/tests/test-output.txt) (see [Running the tests](#running-the-tests))
- [Visual design study](./design/p3/visual_design.pdf)
- [Updated user journey](./design/p3/user_journey_p3.md)

## Running the tests

The app and its tests live in [`implementation/`](./implementation). Run every command below from
that folder.

### What you need

- [Bun](https://bun.sh) 1.3 or later.
- MongoDB 8. The project's [`compose.yaml`](./implementation/compose.yaml) runs it in a container
  with [Podman](https://podman.io); `docker compose` works the same way. Any other MongoDB works too
  (see [Using a different MongoDB](#using-a-different-mongodb)).

You don't need a Gemini API key or an internet connection: the tests replace Open Library and
Gemini with fakes, so they never use your quota.

### 1. Set up the database

```sh
cd implementation
bun install
bun run db:up      # starts MongoDB on 127.0.0.1:27017 (user dev, password dev)
```

Create `implementation/.env` with the connection string, if you don't already have one:

```sh
MONGODB_URL=mongodb://dev:dev@127.0.0.1:27017/novelty?authSource=admin
```

The tests don't use the `novelty` database in that URL. Before any test runs,
[`tests/setup.ts`](./implementation/tests/setup.ts) switches to a separate database named
`novelty_test` on the same server, which the tests create and empty as they go. Your app's data is
never touched. As a safeguard, the tests refuse to run against any database whose name doesn't
end in `_test`.

### 2. Run the tests

```sh
bun run test         # runs all tests; exits non-zero if any fail
bun run test:save    # runs them and also saves the output to tests/test-output.txt
```

To run one file or one group: `bun test tests/concepts/Drafting.test.ts`, or
`bun test --test-name-pattern "Growing"`.

The last saved run is in [`tests/test-output.txt`](./implementation/tests/test-output.txt):
74 tests across 14 files, all passing, in about 5.4 seconds. Use `bun run test` (not `test:save`)
when you need the pass/fail exit status, since saving pipes the output through `tee`.

### What the tests cover

| Folder | Tests | What they check |
| --- | --- | --- |
| [`tests/concepts/`](./implementation/tests/concepts) | 48 | Each concept on its own, called directly against MongoDB: its principle from the design spec, then every refusal case. |
| [`tests/compositions/`](./implementation/tests/compositions) | 26 | The assembled app over real HTTP, as the browser uses it: signing up and in, sessions, the feed and shelves, profile weights reordering the feed, following friends and seeing their shelves, and catalog growth end to end. |

**Concept tests**

| File | Tests | What it checks |
| --- | --- | --- |
| [`Authenticating`](./implementation/tests/concepts/Authenticating.test.ts) | 4 | Only the right password authenticates; an unknown username is refused the same way as a wrong password; malformed usernames and weak passwords are refused; only a salted verifier is stored. |
| [`Sessioning`](./implementation/tests/concepts/Sessioning.test.ts) | 4 | A session resolves to its reader until it ends; invented and expired sessions are refused; sessions are independent and unguessable. |
| [`BookCataloging`](./implementation/tests/concepts/BookCataloging.test.ts) | 6 | A described, scored book; details only while pending, scores only once described; duplicates and invalid values; resetting a description; removing a criterion removes its scores; listing criteria. |
| [`Harvesting`](./implementation/tests/concepts/Harvesting.test.ts) | 7 | Each harvest brings new usable works and never repeats one; English ISBNs are the key; a topic runs out; batch size; one batch at a time (unless the running one is over 30 minutes old); finished batches; an unreachable source. |
| [`Drafting`](./implementation/tests/concepts/Drafting.test.ts) | 10 | Complete drafts; incomplete answers and invalid characters; falling back to the other model when one is overloaded; failing at once when the daily quota is used up; rerating, removing aspects, discarding drafts. |
| [`Swiping`](./implementation/tests/concepts/Swiping.test.ts) | 3 | Each swipe is recorded once; reconsidering frees a book; every reader's swipes are separate. |
| [`Recommending`](./implementation/tests/concepts/Recommending.test.ts) | 8 | Stated preferences rank by closeness, not by highest score; likes and passes move the lean toward or away from a book; stated preferences outweigh swipes; values stay in range; clearing a feature. |
| [`Shelving`](./implementation/tests/concepts/Shelving.test.ts) | 3 | Finished books leave Up Next and loved ones become favorites too; no duplicates on a shelf; removing a missing book is refused. |
| [`Following`](./implementation/tests/concepts/Following.test.ts) | 3 | A follow shows on both sides until undone; self-follows, repeat follows and stranger unfollows are refused; lists are alphabetical and following is one-way. |

**Composition tests**

| File | Tests | What it checks |
| --- | --- | --- |
| [`Sessions`](./implementation/tests/compositions/Sessions.test.ts) | 4 | Registering and signing in, error responses for bad input, signed-out or invented sessions blocked. |
| [`Feed`](./implementation/tests/compositions/Feed.test.ts) | 6 | A like shelves the book and steers the ranking, a pass steers away; no double swipes; every reader's data is separate; moving books between shelves; catalog and card. |
| [`Profile`](./implementation/tests/compositions/Profile.test.ts) | 5 | Criteria with both scale ends; saving position and importance; opposite feeds for opposite readers; an importance of 0; out-of-range values refused. |
| [`Friends`](./implementation/tests/compositions/Friends.test.ts) | 7 | Shelves are shared only after following, and following is one-way; adding a friend's book to Up Next; unfollowing; error cases; sign-in required. |
| [`Growing`](./implementation/tests/compositions/Growing.test.ts) | 4 | A full batch end to end; a failed draft is hidden and retried; a second batch request while one runs is refused; sign-in required. |

The growth tests run a whole batch: harvesting a liked genre from (fake) Open Library, drafting
each book with (fake) Gemini, then checking the new books come out described, scored and ranked.
They also check that a book whose draft fails stays hidden and is drafted again by the next batch.

### Expected log lines

A passing run prints a few lines that aren't failures:

- `Reaction "DeliverRefusalToAsker" answered a request … after it stopped pending` comes from the
  growth tests. Inside a batch, some steps are refused on purpose (the batch is full, or a genre has
  run out), and the engine notes that the request had already been answered.
- `Drafting The Hobbit failed: Gemini quota exhausted` comes from the test that checks drafting
  gives up at once when Gemini's daily quota is used up.

### Using a different MongoDB

To point the tests at another server, set `TEST_MONGODB_URL` to a full connection string whose
database name ends in `_test`, for example:

```sh
TEST_MONGODB_URL="mongodb://localhost:27017/novelty_test" bun run test
```

When you're done, `bun run db:down` stops the container, and `bun run db:reset` deletes all local
data, including the app's.