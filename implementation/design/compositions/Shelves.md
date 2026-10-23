# Shelves

Every shelf endpoint resolves the reader from their session first, so a reader only ever sees
and changes their own shelves.

A reader can [view one of their shelves](reaction:Shelves.View). The
[shelf view](former:Shelves.ShelfView) lists its books, oldest first.

```endpoints
Shelves.View at /shelves/view
```

A reader can [add a book to a shelf](reaction:Shelves.Add) and
[remove a book from a shelf](reaction:Shelves.Remove).

```endpoints
Shelves.Add at /shelves/add
Shelves.Remove at /shelves/remove
```