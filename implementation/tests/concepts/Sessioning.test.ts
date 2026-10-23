import { beforeEach, describe, expect, test } from "bun:test";
import { SessioningConcept, UnknownSession } from "../../src/concepts/Sessioning.ts";
import { db, resetDb } from "../helpers.ts";

let sessions: SessioningConcept;
const expire = (session: string) =>
  db
    .collection("sessioning.sessions")
    .updateOne({ _id: session as never }, { $set: { expiresAt: new Date(Date.now() - 1000) } });

beforeEach(async () => {
  await resetDb();
  sessions = new SessioningConcept(db);
});

describe("Sessioning", () => {
  test("principle: a session resolves to its subject until it is ended", async () => {
    const { session, expiresAt } = await sessions.start({ subject: "ari" });
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);
    expect(await sessions.current({ session })).toEqual({ subject: "ari" });
    expect((await sessions._active({ session }))[0]?.subject).toBe("ari");
    expect(await sessions.end({ session })).toEqual({ ended: true });
    await expect(sessions.current({ session })).rejects.toThrow(UnknownSession);
    await expect(sessions.end({ session })).rejects.toThrow(UnknownSession);
  });

  test("an invented session is refused", async () => {
    await expect(sessions.current({ session: "made-up" })).rejects.toThrow(UnknownSession);
    expect(await sessions._active({ session: "made-up" })).toEqual([]);
  });

  test("an expired session is refused, and the next start clears it away", async () => {
    const { session } = await sessions.start({ subject: "ari" });
    await expire(session);
    await expect(sessions.current({ session })).rejects.toThrow(UnknownSession);
    expect(await sessions._active({ session })).toEqual([]);
    await sessions.start({ subject: "bea" });
    expect(await db.collection("sessioning.sessions").countDocuments({ subject: "ari" })).toBe(0);
  });

  test("sessions are independent and unguessable", async () => {
    const a = await sessions.start({ subject: "ari" });
    const b = await sessions.start({ subject: "ari" });
    expect(a.session).not.toBe(b.session);
    expect(a.session.length).toBeGreaterThanOrEqual(40);
    await sessions.end({ session: a.session });
    expect(await sessions.current({ session: b.session })).toEqual({ subject: "ari" });
  });
});
