# Sessions

Novelty requires an account. Registering
[creates the account and starts a session](reaction:Sessions.Register) for it, and
[signing in](reaction:Sessions.SignIn) proves an existing account's password and starts a new
session. In both cases the session's subject is the account that was proven, so a caller can't
choose someone else.

```endpoints
Sessions.Register at /auth/register
Sessions.SignIn at /auth/sign-in
```

An active session [resolves to its account](reaction:Sessions.Current), which the app uses to
show who is signed in. Every reader-specific endpoint resolves the session the same way and acts
for that account, never for a name the caller supplies.
[Signing out](reaction:Sessions.SignOut) ends the presented session.

```endpoints
Sessions.Current at /auth/current
Sessions.SignOut at /auth/sign-out
```

The browser keeps the session token and sends it with each request, rather than in a cookie,
because the app is reached at more than one local origin during development. A session lasts
a week.
