// Loaded before every test file (see bunfig.toml). The tests use their own database, so they can
// drop it freely, and they never call Open Library or Gemini: tests/helpers.ts fakes both.
import { afterAll } from "bun:test";

const explicit = process.env.TEST_MONGODB_URL;
const url = new URL(
  explicit ??
    process.env.MONGODB_URL ??
    "mongodb://dev:dev@127.0.0.1:27017/?authSource=admin",
);
if (!explicit) url.pathname = "/novelty_test";
if (!url.pathname.endsWith("_test"))
  throw new Error(
    `Refusing to run tests against database "${url.pathname.slice(1)}": its name must end in _test, because the tests delete everything in it.`,
  );

process.env.MONGODB_URL = url.toString();
process.env.GOOGLE_GEMINI_API = "test-key";
process.env.GEMINI_MIN_INTERVAL_MS = "0";

const { client } = await import("../src/db.ts");
afterAll(() => client.close());
