import { MongoServerError, type Collection, type Db } from "mongodb";

export class SelfFollow extends Error {}
export class AlreadyFollowing extends Error {}
export class NotFollowing extends Error {}

interface Follow {
  _id: string;
  follower: string;
  followee: string;
}

const indexed = new WeakSet<Collection<Follow>>();

async function ensureIndex(follows: Collection<Follow>) {
  if (indexed.has(follows)) return;
  await follows.createIndex({ follower: 1, followee: 1 }, { unique: true });
  indexed.add(follows);
}

export class FollowingConcept {
  private readonly follows: Collection<Follow>;

  constructor(db: Db) {
    this.follows = db.collection<Follow>("following.follows");
  }

  async follow({ follower, followee }: { follower: string; followee: string }) {
    if (follower === followee) throw new SelfFollow("You can't follow yourself.");
    await ensureIndex(this.follows);
    try {
      await this.follows.insertOne({ _id: crypto.randomUUID(), follower, followee });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000)
        throw new AlreadyFollowing("You already follow this reader.");
      throw error;
    }
    return { followee };
  }

  async unfollow({ follower, followee }: { follower: string; followee: string }) {
    const result = await this.follows.deleteOne({ follower, followee });
    if (result.deletedCount === 0)
      throw new NotFollowing("You don't follow this reader.");
    return { followee };
  }

  async _following({ user }: { user: string }) {
    const rows = await this.follows.find({ follower: user }).sort({ followee: 1 }).toArray();
    return rows.map(({ followee }) => ({ followee }));
  }

  async _followers({ user }: { user: string }) {
    const rows = await this.follows.find({ followee: user }).sort({ follower: 1 }).toArray();
    return rows.map(({ follower }) => ({ follower }));
  }

  async _isFollowing({ follower, followee }: { follower: string; followee: string }) {
    return { following: (await this.follows.countDocuments({ follower, followee })) > 0 };
  }
}
