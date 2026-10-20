import { MongoServerError, type Collection, type Db } from "mongodb";

export class AlreadyShelved extends Error {}
export class NotShelved extends Error {}

type ShelfName = "UP_NEXT" | "FAVORITES";

interface Placement {
  _id: string;
  user: string;
  item: string;
  shelf: ShelfName;
  addedAt: Date;
}

const indexed = new WeakSet<Collection<Placement>>();

async function ensureIndex(placements: Collection<Placement>) {
  if (indexed.has(placements)) return;
  await placements.createIndex(
    { user: 1, item: 1, shelf: 1 },
    { unique: true },
  );
  indexed.add(placements);
}

export class ShelvingConcept {
  private readonly placements: Collection<Placement>;
//   private indexed = false;

  constructor(db: Db) {
    this.placements = db.collection<Placement>("shelving.placements");
  }

  async add({
    user,
    item,
    shelf,
  }: {
    user: string;
    item: string;
    shelf: ShelfName;
  }) {
    await ensureIndex(this.placements);
    try {
      await this.placements.insertOne({
        _id: crypto.randomUUID(),
        user,
        item,
        shelf,
        addedAt: new Date(),
      });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw new AlreadyShelved("That book is already on this shelf.");
      }
      throw error;
    }
    return { item };
  }

  async remove({
    user,
    item,
    shelf,
  }: {
    user: string;
    item: string;
    shelf: ShelfName;
  }) {
    const result = await this.placements.deleteOne({ user, item, shelf });
    if (result.deletedCount === 0)
      throw new NotShelved("That book is not on this shelf.");
    return { item };
  }

  async _shelf({ user, shelf }: { user: string; shelf: ShelfName }) {
    const rows = await this.placements
      .find({ user, shelf })
      .sort({ addedAt: 1 })
      .toArray();
    return rows.map(({ item }) => ({ item }));
  }
}
