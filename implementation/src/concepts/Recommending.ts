import { type Collection, type Db } from "mongodb";

export class InvalidValue extends Error {}
export class InvalidTarget extends Error {}
export class InvalidImportance extends Error {}
export class UnknownItem extends Error {}
export class UnknownFeature extends Error {}

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
  importance: number; // how much the feature matters, 0 to 5
  target?: number; // where the user said they like it, 0 to 10
  lean: number; // where their swipes suggest they like it, 0 to 10
  evidence: number; // how many swipes have moved the lean
}
interface Collections {
  itemFeatures: Collection<ItemFeature>;
  preferences: Collection<Preference>;
}

// A like moves the lean 1 / (evidence + 2) of the way toward the item, so the lean is a running
// average of the liked values, starting from the middle. A pass nudges it a fixed step away.
const AWAY = 0.15;
const LEARNED_PER_SWIPE = 0.25; // weight each swipe adds to a feature
const MAX_LEARNED = 1.5; // so stated importance always outweighs swipes alone

const indexed = new WeakSet<Collections>();

async function ensureIndexes(c: Collections) {
  if (indexed.has(c)) return;
  await Promise.all([
    c.itemFeatures.createIndex({ item: 1, feature: 1 }, { unique: true }),
    c.preferences.createIndex({ user: 1, feature: 1 }, { unique: true }),
  ]);
  indexed.add(c);
}

const clamp = (n: number) => Math.max(0, Math.min(10, n));
const fresh = () => ({ _id: crypto.randomUUID(), importance: 0, lean: 5, evidence: 0 });

async function react(c: Collections, user: string, item: string, direction: 1 | -1) {
  await ensureIndexes(c);
  const features = await c.itemFeatures.find({ item }).toArray();
  if (features.length === 0) throw new UnknownItem("That item has no feature values.");
  for (const { feature, value } of features) {
    const current = (await c.preferences.findOne({ user, feature })) ?? fresh();
    const step = direction === 1 ? 1 / (current.evidence + 2) : -AWAY;
    const lean = clamp(current.lean + step * (value - current.lean));
    await c.preferences.updateOne(
      { user, feature },
      {
        $set: { lean, evidence: current.evidence + 1 },
        $setOnInsert: { _id: current._id, importance: current.importance },
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

  async setFeature({ item, feature, value }: { item: string; feature: string; value: number }) {
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
    if (result.deletedCount === 0) throw new UnknownItem("That item has no feature values.");
    return { item };
  }

  async clearFeature({ feature }: { feature: string }) {
    const [values, preferences] = await Promise.all([
      this.c.itemFeatures.deleteMany({ feature }),
      this.c.preferences.deleteMany({ feature }),
    ]);
    if (values.deletedCount === 0 && preferences.deletedCount === 0)
      throw new UnknownFeature("Nothing is scored or preferred on that feature.");
    return { feature };
  }

  async prefer({
    user,
    feature,
    target,
    importance,
  }: {
    user: string;
    feature: string;
    target: number;
    importance: number;
  }) {
    if (!(target >= 0 && target <= 10))
      throw new InvalidTarget("A preferred value must be between 0 and 10.");
    if (!(importance >= 0 && importance <= 5))
      throw new InvalidImportance("Importance must be between 0 and 5.");
    await ensureIndexes(this.c);
    await this.c.preferences.updateOne(
      { user, feature },
      {
        $set: { target, importance },
        $setOnInsert: { _id: crypto.randomUUID(), lean: 5, evidence: 0 },
      },
      { upsert: true },
    );
    return { feature };
  }

  async reinforce({ user, item }: { user: string; item: string }) {
    return react(this.c, user, item, 1);
  }

  async weaken({ user, item }: { user: string; item: string }) {
    return react(this.c, user, item, -1);
  }

  async _ranked({ user }: { user: string }) {
    const prefs = await this.c.preferences.find({ user }).toArray();
    const byFeature = new Map(
      prefs.map((p) => [
        p.feature,
        {
          preferred: p.target ?? p.lean,
          weight: p.importance + Math.min(MAX_LEARNED, LEARNED_PER_SWIPE * p.evidence),
        },
      ]),
    );
    const fits = new Map<string, number>();
    for (const { item, feature, value } of await this.c.itemFeatures.find().toArray()) {
      const p = byFeature.get(feature);
      const contribution = p ? p.weight * (1 - Math.abs(value - p.preferred) / 10) : 0;
      fits.set(item, (fits.get(item) ?? 0) + contribution);
    }
    return [...fits]
      .map(([item, fit]) => ({ item, fit: Math.round(fit * 100) / 100 }))
      .sort((a, b) => b.fit - a.fit || a.item.localeCompare(b.item));
  }

  async _preferences({ user }: { user: string }) {
    const rows = await this.c.preferences.find({ user }).toArray();
    return rows.map(({ feature, importance, target, lean }) => ({
      feature,
      importance,
      target: target ?? Math.round(lean),
      lean,
    }));
  }
}
