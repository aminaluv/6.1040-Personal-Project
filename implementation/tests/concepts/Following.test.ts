import { beforeEach, describe, expect, test } from "bun:test";
import {
  AlreadyFollowing,
  FollowingConcept,
  NotFollowing,
  SelfFollow,
} from "../../src/concepts/Following.ts";
import { db, resetDb } from "../helpers.ts";

let following: FollowingConcept;

beforeEach(async () => {
  await resetDb();
  following = new FollowingConcept(db);
});

describe("Following", () => {
  test("principle: a follow shows on both sides until it's undone", async () => {
    expect(await following.follow({ follower: "jane", followee: "maya" })).toEqual({
      followee: "maya",
    });
    expect(await following._following({ user: "jane" })).toEqual([{ followee: "maya" }]);
    expect(await following._followers({ user: "maya" })).toEqual([{ follower: "jane" }]);
    expect(await following._isFollowing({ follower: "jane", followee: "maya" })).toEqual({
      following: true,
    });
    expect(await following._isFollowing({ follower: "maya", followee: "jane" })).toEqual({
      following: false,
    });

    await following.unfollow({ follower: "jane", followee: "maya" });
    expect(await following._following({ user: "jane" })).toEqual([]);
    expect(await following._followers({ user: "maya" })).toEqual([]);
  });

  test("refuses following yourself, following twice, and unfollowing a stranger", async () => {
    await expect(following.follow({ follower: "jane", followee: "jane" })).rejects.toThrow(
      SelfFollow,
    );
    await following.follow({ follower: "jane", followee: "maya" });
    await expect(following.follow({ follower: "jane", followee: "maya" })).rejects.toThrow(
      AlreadyFollowing,
    );
    await expect(following.unfollow({ follower: "jane", followee: "omar" })).rejects.toThrow(
      NotFollowing,
    );
  });

  test("lists are alphabetical, and following is one-way", async () => {
    await following.follow({ follower: "jane", followee: "omar" });
    await following.follow({ follower: "jane", followee: "maya" });
    await following.follow({ follower: "omar", followee: "jane" });
    expect(await following._following({ user: "jane" })).toEqual([
      { followee: "maya" },
      { followee: "omar" },
    ]);
    expect(await following._followers({ user: "jane" })).toEqual([{ follower: "omar" }]);
    expect(await following._followers({ user: "maya" })).toEqual([{ follower: "jane" }]);
  });
});
