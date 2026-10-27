import { test } from "node:test";
import assert from "node:assert/strict";
import { result, achievements, LEVELS, DAILY } from "../js/clue-profile.js";

test("a game with Undo or a hint is recorded with help, unrated", () => {
  const r = result({ won: true, level: 2, helped: true, players: 4, myTurns: 9 });
  assert.equal(r.mode, "help");
  assert.equal(r.level, null);
  assert.equal(r.won, true);
});

test("a clean game against the computers is rated at their level", () => {
  assert.deepEqual([0, 1, 2].map((l) => result({ won: false, level: l }).level), ["easy", "medium", "hard"]);
  assert.equal(result({ won: true, level: 2 }).mode, "computer");
});

test("the Daily is a rated Hard game, and the level ratings climb", () => {
  assert.equal(DAILY.level, 2);
  assert.ok(LEVELS[0].rating < LEVELS[1].rating && LEVELS[1].rating < LEVELS[2].rating);
});

test("achievements read the game's extra facts", () => {
  const list = achievements();
  assert.equal(new Set(list.map((a) => a.id)).size, list.length);
  const ctx = (last) => ({ stats: { wins: 1, bestStreak: 1 }, daily: { streak: 0 }, last });
  const got = (last) => list.filter((a) => a.test(ctx(last))).map((a) => a.id);
  assert.deepEqual(got({ won: true, level: "hard", extra: { players: 6, myTurns: 5, quality: 0.95, oddsOff: true, hunch: true } }),
    ["first", "medium", "hard", "full", "quick", "sharp", "pencil", "hunch"]);
  assert.deepEqual(got({ won: false, level: "hard", extra: { players: 6, myTurns: 5 } }), ["first"]);
});
