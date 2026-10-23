import { pbkdf2Sync, timingSafeEqual } from "node:crypto";
import { MongoServerError, type Collection, type Db } from "mongodb";

export class InvalidUsername extends Error {}
export class WeakPassword extends Error {}
export class UsernameTaken extends Error {}
export class InvalidCredentials extends Error {}

// The account reference is the username itself, so _id is the username.
interface AccountDoc {
  _id: string;
  salt: string;
  verifier: string;
}

const USERNAME = /^[A-Za-z0-9_-]{3,32}$/;

const verifier = (password: string, salt: string) =>
  pbkdf2Sync(password, salt, 100_000, 32, "sha256");

export class AuthenticatingConcept {
  private readonly accounts: Collection<AccountDoc>;

  constructor(db: Db) {
    this.accounts = db.collection<AccountDoc>("authenticating.accounts");
  }

  async register({ username, password }: { username: string; password: string }) {
    if (!USERNAME.test(username))
      throw new InvalidUsername(
        "A username must contain 3 to 32 letters, numbers, underscores, or hyphens.",
      );
    if (password.length < 8 || password.length > 128)
      throw new WeakPassword("A password must contain 8 to 128 characters.");
    const salt = crypto.randomUUID();
    try {
      await this.accounts.insertOne({
        _id: username,
        salt,
        verifier: verifier(password, salt).toString("base64"),
      });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000)
        throw new UsernameTaken("That username is already registered.");
      throw error;
    }
    return { account: username };
  }

  async authenticate({ username, password }: { username: string; password: string }) {
    const account = await this.accounts.findOne({ _id: username });
    if (
      !account ||
      !timingSafeEqual(
        Buffer.from(account.verifier, "base64"),
        verifier(password, account.salt),
      )
    )
      throw new InvalidCredentials("The username or password is incorrect.");
    return { account: username };
  }

  async _registered({ username }: { username: string }) {
    return { registered: (await this.accounts.countDocuments({ _id: username })) > 0 };
  }
}
