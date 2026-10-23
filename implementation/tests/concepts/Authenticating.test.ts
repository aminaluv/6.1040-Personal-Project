import { beforeEach, describe, expect, test } from "bun:test";
import {
  AuthenticatingConcept,
  InvalidCredentials,
  InvalidUsername,
  UsernameTaken,
  WeakPassword,
} from "../../src/concepts/Authenticating.ts";
import { db, resetDb } from "../helpers.ts";

let auth: AuthenticatingConcept;

beforeEach(async () => {
  await resetDb();
  auth = new AuthenticatingConcept(db);
});

describe("Authenticating", () => {
  test("principle: a registered username authenticates only with its password", async () => {
    expect(await auth.register({ username: "ari", password: "correct-horse" })).toEqual({
      account: "ari",
    });
    expect(await auth._registered({ username: "ari" })).toEqual({ registered: true });
    await expect(auth.register({ username: "ari", password: "another-pass" })).rejects.toThrow(
      UsernameTaken,
    );
    await expect(auth.authenticate({ username: "ari", password: "wrong-pass" })).rejects.toThrow(
      InvalidCredentials,
    );
    expect(await auth.authenticate({ username: "ari", password: "correct-horse" })).toEqual({
      account: "ari",
    });
  });

  test("an unknown username is refused like a wrong password", async () => {
    await expect(auth.authenticate({ username: "nobody", password: "whatever1" })).rejects.toThrow(
      InvalidCredentials,
    );
    expect(await auth._registered({ username: "nobody" })).toEqual({ registered: false });
  });

  test("refuses malformed usernames and weak passwords", async () => {
    await expect(auth.register({ username: "ab", password: "long-enough" })).rejects.toThrow(
      InvalidUsername,
    );
    await expect(auth.register({ username: "has space", password: "long-enough" })).rejects.toThrow(
      InvalidUsername,
    );
    await expect(auth.register({ username: "ari", password: "short" })).rejects.toThrow(
      WeakPassword,
    );
    expect(await auth._registered({ username: "ari" })).toEqual({ registered: false });
  });

  test("stores a salted verifier, never the password", async () => {
    await auth.register({ username: "ari", password: "correct-horse" });
    await auth.register({ username: "bea", password: "correct-horse" });
    const stored = await db.collection("authenticating.accounts").find().toArray();
    expect(JSON.stringify(stored)).not.toContain("correct-horse");
    expect(stored[0]!.verifier).not.toEqual(stored[1]!.verifier);
  });
});
