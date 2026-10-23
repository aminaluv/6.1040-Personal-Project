# Sessioning

## Purpose

Keep an opaque, expiring session for an external subject, so a person stays signed in between
visits without resending their password, and access can end without changing who they are.

## Principle

Ari starts a session for subject `ari`. Before the session expires, `_active` returns a row
whose subject is `ari`, and `current` resolves the session to `ari`. Ending the session makes it
unknown, so another `current` call is refused. An invented or expired session is refused in the
same way, and `_active` returns no row for it.

## Types

```types
external Subject
  The external identity represented by a session.
```

## State

```state
a set of Sessions with
  a subject Subject
  an expiresAt DateTime
```

## Actions

```actions
start(subject: Subject) : returns (session: Session, expiresAt: DateTime)
  where true
  then
    delete every expired session
    add a new opaque session for subject expiring 7 days from now
    returns session, expiresAt

current(session: Session) : returns (subject: Subject)
  where session is unknown, ended, or expired
  then
    refuses UNKNOWN_SESSION "This session is not active."
  where session is active
  then
    bind subject to the session's subject
    returns subject

end(session: Session) : returns (ended: Flag)
  where session is unknown, ended, or expired
  then
    refuses UNKNOWN_SESSION "This session is not active."
  where session is active
  then
    delete session
    set ended to true
    returns ended
```

## Queries

```queries
_active(session: Session) : optional (subject: Subject, expiresAt: DateTime)
  Answers the session's subject and expiry, and no row for an unknown, ended, or expired
  session.
```
