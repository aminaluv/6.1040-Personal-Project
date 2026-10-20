# Concept Specifications

```pseudo
concept: Authentication

purpose: limit access to users 

principle: after a user registers with a username and password, they can authenticate with the same username and password and be treated as the same user each time.

state:
a set of Users with
    a username String
    a password String

actions:
    register (username: String, password: String): (user: User)
        where no User has this username
        then creates a new User with this username and password; returns it
    authenticate (username: String, password: String): (user: User)
        where a User exists with this username and password
        then returns the User associated with this username and password 
```
```pseudo
concept: BookCataloging [User]

purpose: give readers a clear, consistent, and rich description of every book (who it's about, where it happens, and how it matches the user's criteria)

principle: after a book is added with its basic information, then it is described with a spoiler-free summary, the book's setting, characters and their overall age ranges, book themes, and tones. The reader defines criteria for a good book in their profile (such as "pacing"), and the book is score on each criteria so a reader can view a radar chart of the book's scores on exactly the criteria that they chose. Readers with different criteria will see different radar maps corresponding to the criteria they inputted. If enough readers report that a detail is wrong, the book's generated description is cleared and updated to reflect accurate changes. 

state:
a set of Criteria with
    a name String
    a description String
a set of Books with 
    an isbn String
    a title String
    an author String
    a published Date
    a pageCount Number
    a cover Image
    a genre set of String
    a status of PENDING or GENERATED
    a summary String
    an optional setting String
    a set of Characters with 
        a name String
        a role of MAIN CHARACTER or SUPPORTING
        a minAge Number
        a maxAge Number
    a themes set of String
    a tones set of String
    a set of Scores with
        a criterion Criterion
        a value Number
    a set of Reports with
        a reported User
        a field String
        a comment String

actions:
    addBook (isbn: String, title: String, author: String, published: Date, pageCount: Number, cover: Image, summary: String, genres: set of String): (book: Book)
        where no Book has this isbn
        then creates a new Book with these fields, a status of PENDING, and empty summary, setting, set of characters, theme, tone, set of Scores, and set of Reports. Return the new Book. 
    generate (book: Book, summary: String, setting: String, characters: set of (name, role, minAge, maxAge), themes: set of String, tones: set of String)
        where book exists with status of PENDING, minAge <= maxAge for every character. 
        then set book's fields to these values and set status to GENERATED
    defineCriterion (name: String, description: String): (criterion: Criterion)
        where no Criterion has this name
        then create a new Criterion
    scoreBook (book: Book, criterion: Criterion, value: Number)
        where book has status GENERATED, criterion exists, and value is between 0 and 10 inclusive
        then set book's score for criterion, replace any existing score
    report (book: Book, user: User, field: String, comment: String)
        where book has status GENERATED, field is one of the field options, and user has not already reported this field for the book
        then add a Report from user about field with comment
    resetGeneratedOutput (book: Book)
        where book has status GENERATED
        then clear book's field, its scores, and its reports. Set the status to PENDING
```

```pseudo 
concept: Recommending [User, Item]

purpose: suggest item one at a time that a user is likely to enjoy, learning from the user's stated preferences and reactions to the suggestions

principle: after a user says which criteria they care about and marks some items as ones that they are interested in/like, their feed fills with items that share similar features as the items that they liked. Each item that they like or pass (swipe right or left) adjusts their preferences, so later feeds better match their preferences. 

state: 
a set of Items with
    a features map from String to number 
a set of Users with
    a preference map from String to number
    a itemsFilter set of String
    a favorites set of Items
    a liked set of Items
    a passed set of Items 
    an excluded set of Items
    a feed sequence of Items

actions: 
    registerItem (item: Item, features: map from String to Number)
        where item is not yet registered
        then add item with these features
    updateFeature (item: Item, feature: String, value: Number)
        where item is registered
        then set item's feature in features map to value
    setPreferences (user: User, preferences: map from String to Number, itemsFilter: set of String) 
        where add the user if new, with empty sets and feed. Replace their preferences and filters.
    setWeight (user: User, feature: String, weight: Number)
        where the user exists
        then set the user's preference weight for feature. Remove the feature from their preferences if the weight is 0. 
    addFavorite (user: User, item: Item)
        where user and item exists
        then add item to favorites and excluded, remove it from the feed, and raise the user's weight on each of the item's features by a large step amount
    refreshFeed (user: User)
        where user exists
        then set feed to up to 20 items not in liked, passed, excluded, or favorites that have every feature in filters. The items are ordered by similarity between their features and the user's preferences. 
    like (user: User, item: Item)
        where item is in the user's feed
        then remove the item from the feed, add it to the liked set, and raise the user's weight on each of the item's features by a small step.
    pass (user: User, item: Item)
        where item is in the user's feed
        then remove the item from the feed, add it to the passed set, and lower the user's weight on each of the item's features by a small step.
    exclude (user: User, item: Item)
        where user and the item exist
        then add the item to excluded and remove it from the feed
```

```pseudo
concept: Shelving [User, Item]

purpose: allow users to keep track of items that they plan to read, are reading, have read, or didn't finish. 

principle: after a user shelves an item as Up Next, then they can move it to Reading, and can later move it to Read. The item appears on their Read shelf and no longer on Up Next. If they marked the item as a favorite, the item would also appear in their favorite items. 

state: 
a set of Entries with
    an owner User
    an item Item
    a status of Up Next, Reading, Read, or Didn't Finish
    a favorite Flag


actions: 
shelve (user: User, item: Item, status: Status)
    where no Entry exists for user and item
    then create an Entry with this status and favorite as False

move (user: User, item: Item, status: Status)
    where an Entry exists for the user and item
    then set the Entry's status
favorite (user: User, item: Item)
    where an Entry exists for the user and item
    then set the Entry's favorite flag as True
unFavorite (user: User, item: Item)
    where an Entry exists for the user and item and the favorite flag for the Entry is True
    then set the Entry's favorite flag as False
remove (user: User, item: Item)
    where an Entry exists for user and item
    then delete the Entry
```


```pseudo 
concept: Following [User]

purpose: allow the user to keep up with the people whose activity interests the user

principle: when user A follows user B, B should appear in A's follow list and in B's followers list, this should be true until A unfollows B

state: 
a set of Follows with
    a follower User
    a followee User

actions: 
    follow (follower: User, followee: User)
        where follower is not followee and no Follow exists for them
        then create a Follow from follower to followee
    unfollow (follower: User, followee: User)
        where a Follow exists from follower to followee
        then delete that Follow
```

### Reactions

```pseudo
reaction importBooks
    where request is in BookAPI.search(query) and the ISBN of the request does not exist in the BookCataloging Books set
    then BookCataloging.addBook (request.isbn, request.title, request.author, request.published, request.pageCount, request.cover, request.summary, request.genres)

reaction generateBook
    where book exists in set of Books in BookCataloging and LLM generated summary and descriptive information for book (we can call this output d)
    then BookCataloging.generate(book, d.summary, d.place, d.era, d.characters, d.themes, d.tones)

reaction regenerateOnReports
    where BookCataloging has report count >= 3 for book
    then BookCataloging.resetGeneratedOutput(book)

// reader profile

reaction defineCriterion
    where user criterion, name, does not exist
    then BookCataloging.defineCriterion(name, description)


reaction removeCriterion 
    where Request.removeCriterion (user, name)
    then Recommending.setWeight(user, feature: name, weight: 0)

// feed

reaction registerBook
    where BookCataloging.addBook (genres): (book)
    then Recommending.registerItem(item: book, features: map from genre to weighting of 1 for each genre)

reaction likeToUpNext
    where no Shelving Entry exists for user and item
    then Shelving.shelve(user, item, "Up Next")

reaction shelvedRemoveFromFeed
    where Shelving.shelve(user, item)
    then Recommending.exclude(user, item)

reaction favoriteToFavorites
    where Shelving.favorite(user, item)
    then Recommending.addFavorite(user, item)

reaction keepFeedUpdated
    where feed for Recommending object has fewer than 5 items (check this whenever user likes or passes)
    then Recommending.refreshFeed(user)
```

### Note: 

The Authentication concept helps to ensure that each user sees only their reader profiles and feed. This prevents users from acting on someone else's behalf. Additionally, in order to view someone else's shelf, you must be following them.

BookCataloging provides everything that is on the First Impression book card that the user sees on their feed for each book. Published information comes from a public book database. The descriptive details for each book come from an LLM call, which returns a fixed and spoiler-free format and leaves field empty if it can't find the information, rather than guessing. This concept also focuses on scoring each book on the criteria that the reader defines in their reader profile. The radar chart shows the axes from their profile. All this information is correctable through reports, so readers stay in charge. 

Recommending stores the reader profile and the reader's swipe activity. A reader's criteria and how much each criterion matters, genre preferences, character age preferences all becomes weights on the features. Shelving holds the reader's Up Next, Reading, Read, and Didn't Finish lists. Following allows for shared shelves and adds a more social aspect of reading.


