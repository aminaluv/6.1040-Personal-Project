import { randomBytes } from "node:crypto";
import { type Collection, type Db } from "mongodb";

export class UnknownSession extends Error {}

// The session token is the _id, so it must be unguessable.
interface SessionDoc {
  _id: string;
  subject: string;
  expiresAt: Date;
}

const LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

async function active(sessions: Collection<SessionDoc>, session: string) {
  const found = await sessions.findOne({
    _id: session,
    expiresAt: { $gt: new Date() },
  });
  if (!found) throw new UnknownSession("This session is not active.");
  return found;
}

export class SessioningConcept {
  private readonly sessions: Collection<SessionDoc>;

  constructor(db: Db) {
    this.sessions = db.collection<SessionDoc>("sessioning.sessions");
  }

  async start({ subject }: { subject: string }) {
    const now = new Date();
    await this.sessions.deleteMany({ expiresAt: { $lte: now } });
    const session = randomBytes(32).toString("base64url");
    const expiresAt = new Date(now.getTime() + LIFETIME_MS);
    await this.sessions.insertOne({ _id: session, subject, expiresAt });
    return { session, expiresAt };
  }

  async current({ session }: { session: string }) {
    return { subject: (await active(this.sessions, session)).subject };
  }

  async end({ session }: { session: string }) {
    await active(this.sessions, session);
    await this.sessions.deleteOne({ _id: session });
    return { ended: true };
  }

  async _active({ session }: { session: string }) {
    const found = await this.sessions.findOne({
      _id: session,
      expiresAt: { $gt: new Date() },
    });
    return found ? [{ subject: found.subject, expiresAt: found.expiresAt }] : [];
  }
}
