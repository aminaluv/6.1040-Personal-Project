import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { PASSWORD, signUp, startApp, type Client } from "../app.ts";
import { resetDb } from "../helpers.ts";

let app: ReturnType<typeof startApp>;
let client: Client;

beforeAll(async () => {
  await resetDb();
  app = startApp();
  client = app.client;
});
afterAll(() => app.stop());

describe("Sessions", () => {
  test("registering signs the reader in as the new account", async () => {
    const result = await client.auth.register({ username: "ari", password: PASSWORD });
    if ("error" in result) throw new Error(result.error);
    expect(result.account).toBe("ari");
    expect(await client.auth.current({ session: result.session })).toEqual({ account: "ari" });
  });

  test("signing in with the right password starts a new, independent session", async () => {
    const first = await signUp(client, "bea");
    const second = await client.auth["sign-in"]({ username: "bea", password: PASSWORD });
    if ("error" in second) throw new Error(second.error);
    expect(second.session).not.toBe(first);
    await client.auth["sign-out"]({ session: first });
    expect(await client.auth.current({ session: second.session })).toEqual({ account: "bea" });
  });

  test("bad credentials and taken or malformed usernames get the right errors", async () => {
    await signUp(client, "cal");
    expect(await client.auth["sign-in"]({ username: "cal", password: "wrong-pass" })).toEqual({
      error: "UNAUTHORIZED",
    });
    expect(await client.auth.register({ username: "cal", password: PASSWORD })).toEqual({
      error: "CONFLICT",
    });
    expect(await client.auth.register({ username: "x", password: PASSWORD })).toEqual({
      error: "INVALID_REQUEST",
    });
    expect(await client.auth.register({ username: "dee", password: "short" })).toEqual({
      error: "INVALID_REQUEST",
    });
  });

  test("a signed-out or invented session can't reach reader endpoints", async () => {
    const session = await signUp(client, "eve");
    expect(await client.auth["sign-out"]({ session })).toEqual({ ended: true });
    for (const s of [session, "invented-session"]) {
      expect(await client.auth.current({ session: s })).toEqual({ error: "UNAUTHORIZED" });
      expect(await client.feed.ranked({ session: s })).toEqual({ error: "UNAUTHORIZED" });
      expect(await client.shelves.view({ session: s, shelf: "UP_NEXT" })).toEqual({
        error: "UNAUTHORIZED",
      });
      expect(await client.profile.view({ session: s })).toEqual({ error: "UNAUTHORIZED" });
    }
  });
});
