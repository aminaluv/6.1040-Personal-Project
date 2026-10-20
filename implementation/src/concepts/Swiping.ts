import { MongoServerError, type Collection, type Db } from "mongodb";

export class AlreadySwiped extends Error {}
export class NotSwiped extends Error {}

type Direction = "RIGHT" | "LEFT";

interface Swipe {
  _id: string;
  user: string;
  item: string;
  direction: Direction;
  swipedAt: Date;
}

const indexed = new WeakSet<Collection<Swipe>>();

async function ensureIndex(swipes: Collection<Swipe>) {
  if (indexed.has(swipes)) return;
  await swipes.createIndex({ user: 1, item: 1 }, { unique: true });
  indexed.add(swipes);
}

async function record(
  swipes: Collection<Swipe>,
  user: string,
  item: string,
  direction: Direction,
) {
  await ensureIndex(swipes);
  try {
    await swipes.insertOne({
      _id: crypto.randomUUID(),
      user,
      item,
      direction,
      swipedAt: new Date(),
    });
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      throw new AlreadySwiped("You've already swiped on this book.");
    }
    throw error;
  }
  return { item };
}

export class SwipingConcept {
  private readonly swipes: Collection<Swipe>;

  constructor(db: Db) {
    this.swipes = db.collection<Swipe>("swiping.swipes");
  }

  async swipeRight({ user, item }: { user: string; item: string }) {
    return record(this.swipes, user, item, "RIGHT");
  }

  async swipeLeft({ user, item }: { user: string; item: string }) {
    return record(this.swipes, user, item, "LEFT");
  }

  async reconsider({ user, item }: { user: string; item: string }) {
    const result = await this.swipes.deleteOne({ user, item });
    if (result.deletedCount === 0)
      throw new NotSwiped("You haven't swiped on this book.");
    return { item };
  }

  async _swipes({ user }: { user: string }) {
    const rows = await this.swipes
      .find({ user })
      .sort({ swipedAt: -1 })
      .toArray();
    return rows.map(({ item, direction }) => ({ item, direction }));
  }
}
