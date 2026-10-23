# Application types

Readers sign in with an account, and the account reference (its username) is the reader
wherever another concept needs one: as a session's subject, a shelf's owner, a swiper, and the
user whose tastes are ranked.

```instances
instantiate Authenticating

instantiate Sessioning with
  Subject is Authenticating.Account

instantiate BookCataloging

instantiate Shelving with
  User is Authenticating.Account
  Item is BookCataloging.Book

instantiate Swiping with
  User is Authenticating.Account
  Item is BookCataloging.Book

instantiate Recommending with
  User is Authenticating.Account
  Item is BookCataloging.Book
  Feature is BookCataloging.Criterion

instantiate Harvesting

instantiate Drafting with
  Item is BookCataloging.Book
```
