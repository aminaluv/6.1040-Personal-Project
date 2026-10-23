import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { concepts } from "../concepts.ts";

const { Authenticating, Sessioning } = concepts;

const Register = endpoint(
  "/auth/register",
  ({ username, password, account, session, expiresAt }) =>
    receive({ username, password })
      .then(Authenticating.register({ username, password }).responds({ account }))
      .then(Sessioning.start({ subject: account }).responds({ session, expiresAt }))
      .then(respond({ account, session, expiresAt })),
  { input: { required: ["username", "password"] } },
);

const SignIn = endpoint(
  "/auth/sign-in",
  ({ username, password, account, session, expiresAt }) =>
    receive({ username, password })
      .then(Authenticating.authenticate({ username, password }).responds({ account }))
      .then(Sessioning.start({ subject: account }).responds({ session, expiresAt }))
      .then(respond({ account, session, expiresAt })),
  { input: { required: ["username", "password"] } },
);

const Current = endpoint(
  "/auth/current",
  ({ session, account }) =>
    receive({ session })
      .then(Sessioning.current({ session }).responds({ subject: account }))
      .then(respond({ account })),
  { input: { required: ["session"] } },
);

const SignOut = endpoint(
  "/auth/sign-out",
  ({ session, ended }) =>
    receive({ session })
      .then(Sessioning.end({ session }).responds({ ended }))
      .then(respond({ ended })),
  { input: { required: ["session"] } },
);

export const composition = { Register, SignIn, Current, SignOut };
