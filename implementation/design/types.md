# Application types

Readers type their own name, and books are identified by a short id until the catalog exists.

```types
concrete Name
  The name a reader types in.
```

```instances
instantiate BookCataloging

instantiate Shelving with
  User is Name
  Item is BookCataloging.Book

instantiate Swiping with
  User is Name
  Item is BookCataloging.Book
```