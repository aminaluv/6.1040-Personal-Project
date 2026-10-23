import { type Collection, type Db } from "mongodb";

export class InvalidValue extends Error {}
export class InvalidWeight extends Error {}
export class UnknownItem extends Error {}

interface ItemFeature {
  _id: string;
  item: string;
  feature: string;
  value: number;
}
interface Preference {
  _id: string;
  user: string;
  feature: string;
  declared: number;
  learned: number;
}
interface Collections {
  itemFeatures: Collection<ItemFeature>;
  preferences: Collection<Preference>;
}

const RATE = 0.5; // how far one reaction moves a learned weight, at most
const LIMIT = 5; // learned weights stay within -LIMIT to LIMIT

const indexed = new WeakSet<Collections>();

async function ensureIndexes(c: Collections) {
  if (indexed.has(c)) return;
  await Promise.all([
    c.itemFeatures.createIndex({ item: 1, feature: 1 }, { unique: true }),
    c.preferences.createIndex({ user: 1, feature: 1 }, { unique: true }),
  ]);
  indexed.add(c);
}

const clamp = (n: number) => Math.max(-LIMIT, Math.min(LIMIT, n));

async function adjust(
  c: Collections,
  user: string,
  item: string,
  direction: 1 | -1,
) {
  await ensureIndexes(c);
  const features = await c.itemFeatures.find({ item }).toArray();
  if (features.length === 0)
    throw new UnknownItem("That item has no feature values.");
  for (const { feature, value } of features) {
    const current = await c.preferences.findOne({ user, feature });
    const learned = clamp(
      (current?.learned ?? 0) + (direction * RATE * (value - 5)) / 5,
    );
    await c.preferences.updateOne(
      { user, feature },
      {
        $set: { learned },
        $setOnInsert: { _id: crypto.randomUUID(), declared: 0 },
      },
      { upsert: true },
    );
  }
  return { item };
}

export class RecommendingConcept {
  private readonly c: Collections;

  constructor(db: Db) {
    this.c = {
      itemFeatures: db.collection<ItemFeature>("recommending.itemFeatures"),
      preferences: db.collection<Preference>("recommending.preferences"),
    };
  }

  async setFeature({
    item,
    feature,
    value,
  }: {
    item: string;
    feature: string;
    value: number;
  }) {
    if (!(value >= 0 && value <= 10))
      throw new InvalidValue("A feature value must be between 0 and 10.");
    await ensureIndexes(this.c);
    await this.c.itemFeatures.updateOne(
      { item, feature },
      { $set: { value }, $setOnInsert: { _id: crypto.randomUUID() } },
      { upsert: true },
    );
    return { item };
  }

  async clearItem({ item }: { item: string }) {
    const result = await this.c.itemFeatures.deleteMany({ item });
    if (result.deletedCount === 0)
      throw new UnknownItem("That item has no feature values.");
    return { item };
  }

  async declare({
    user,
    feature,
    weight,
  }: {
    user: string;
    feature: string;
    weight: number;
  }) {
    if (!(weight >= 0 && weight <= 5))
      throw new InvalidWeight("A declared weight must be between 0 and 5.");
    await ensureIndexes(this.c);
    await this.c.preferences.updateOne(
      { user, feature },
      {
        $set: { declared: weight },
        $setOnInsert: { _id: crypto.randomUUID(), learned: 0 },
      },
      { upsert: true },
    );
    return { feature };
  }

  async reinforce({ user, item }: { user: string; item: string }) {
    return adjust(this.c, user, item, 1);
  }

  async weaken({ user, item }: { user: string; item: string }) {
    return adjust(this.c, user, item, -1);
  }

  async _ranked({ user }: { user: string }) {
    const prefs = await this.c.preferences.find({ user }).toArray();
    const weight = new Map(
      prefs.map((p) => [p.feature, p.declared + p.learned]),
    );
    const fits = new Map<string, number>();
    for (const { item, feature, value } of await this.c.itemFeatures
      .find()
      .toArray()) {
      fits.set(
        item,
        (fits.get(item) ?? 0) + ((weight.get(feature) ?? 0) * value) / 10,
      );
    }
    return [...fits]
      .map(([item, fit]) => ({ item, fit: Math.round(fit * 100) / 100 }))
      .sort((a, b) => b.fit - a.fit || a.item.localeCompare(b.item));
  }

  async _preferences({ user }: { user: string }) {
    const rows = await this.c.preferences.find({ user }).toArray();
    return rows.map(({ feature, declared, learned }) => ({
      feature,
      declared,
      learned,
    }));
  }
}
