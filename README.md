# 6.1040-Personal-Project

## Design for Novelty

[Problem Framing and Stakeholders](./design/problem_framing.md)

[Application Pitch](./design/pitch.md)

[Concept Specification](./design/concepts.md)

[UI Sketches](./design/ui_sketches.md)

[User Journey](./design/user_journey.md)

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
56 tests across 12 files, all passing, in about 4.5 seconds. Use `bun run test` (not `test:save`)
when you need the pass/fail exit status, since saving pipes the output through `tee`.

### What the tests cover

| Folder | Tests | What they check |
| --- | --- | --- |
| [`tests/concepts/`](./implementation/tests/concepts) | 38 | Each concept on its own, called directly against MongoDB: its principle from the design spec, then every refusal case. |
| [`tests/compositions/`](./implementation/tests/compositions) | 18 | The assembled app over real HTTP, as the browser uses it: signing up and in, sessions, the feed and shelves, profile weights reordering the feed, and catalog growth end to end. |

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