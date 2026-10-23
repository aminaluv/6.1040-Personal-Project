# Harvesting

## Purpose

Keep new candidate items arriving from an outside source a batch at a time, so a collection
that people work through doesn't run dry, without pulling in everything at once or fetching the
same item twice.

## Principle

A batch of 20 is started. Harvesting 5 from "science fiction" brings the source's first five
science-fiction works into the batch as finds, each with its key, title, author, cover and
source notes, and moves the topic's place past them. Once the batch finishes, a later batch
that harvests "science fiction" again brings in the next five, never one already found. When
the source has nothing more on a topic, the topic is exhausted and further harvests of it are
refused.

## Types

```types
BatchStatus is RUNNING or FINISHED
```

## State

```state
a set of Topics with
  a unique name String
  a position Number
  an exhausted Flag

a set of Batches with
  a size Number
  a startedAt DateTime
  a status BatchStatus

a set of Finds with
  a Batch
  a topic String
  a unique key String
  a title String
  an author String
  a published Date
  a pageCount Number
  a coverUrl String
  a source String
  Rule: a batch never has more finds than its size.
```

## Actions

```actions
start(size: Number, now: DateTime) : returns (batch: Batch)
  where size is less than 1
  then
    refuses INVALID_SIZE "A batch must have room for at least one find."
  where size is at least 1 and some RUNNING batch started less than 30 minutes before now
  then
    refuses BATCH_RUNNING "A batch is already running."
  where size is at least 1 and every RUNNING batch started at least 30 minutes before now
  then
    add a new batch with size, startedAt now and status RUNNING
    returns batch

harvest(batch: Batch, topic: String, count: Number) : returns (batch: Batch)
  where batch is not a RUNNING batch
  then
    refuses BATCH_NOT_RUNNING "That batch is not running."
  where batch is RUNNING and topic is exhausted
  then
    refuses TOPIC_EXHAUSTED "The source has nothing more on that topic."
  where batch is RUNNING, topic is not exhausted, and batch already has as many finds as its size
  then
    refuses BATCH_FULL "That batch is already full."
  where batch is RUNNING, topic is not exhausted, batch has room, and the source can't be reached
  then
    refuses SOURCE_UNAVAILABLE "The source could not be reached."
  where batch is RUNNING, topic is not exhausted, batch has room, and the source answers
  then
    ask the source for works on topic after the topic's position, starting at 0 for a new topic
    go through the answered works in order, adding as finds in batch, with topic, each usable
    work whose key is not already found, until count are added or batch has no more room
    move the topic's position past the works gone through
    mark topic exhausted when the source answered fewer works than were asked for and all were gone through
    returns batch

finish(batch: Batch) : returns (batch: Batch)
  where batch is not a RUNNING batch
  then
    refuses BATCH_NOT_RUNNING "That batch is not running."
  where batch is a RUNNING batch
  then
    set the status of batch to FINISHED
    returns batch
```

## Queries

```queries
_finds(batch: Batch, topic: String) : many (key: String, title: String, author: String, published: Date, pageCount: Number, coverUrl: String)
  Answers each find of the batch on that topic, in the order the source gave them, and no rows
  when there are none.

_find(key: String) : optional (topic: String, title: String, author: String, source: String)
  Answers the find with that key, and no row when there is none.
```
