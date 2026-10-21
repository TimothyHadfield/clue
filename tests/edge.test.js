// Odd situations a real table runs into (2026-10-20 edge pass).
import test from "node:test";
import assert from "node:assert/strict";
import { idx } from "../js/board.js";
import * as G from "../js/game.js";
const { game, setup, apply, publicView, privateView, toAct } = G;
const safeAction = (s, seat) => G.safeAction(s, seat);
import { mulberry32 } from "../js/solver.js";

const clone = (x) => JSON.parse(JSON.stringify(x));
const botStep = (s, rng) => {
  const seat = toAct(s)[0];
  const a = game.bot({ pub: publicView(s), mine: privateView(s, seat), state: s }, seat, rng);
  return apply(clone(s), seat, a, rng);
};
const wrongOf = (s) => [0, 6, 12].map((c, i) => (c === s.env[i] ? c + 1 : c));

test("you go out on turn 1 and five Easy computers still finish the game", () => {
  for (let g = 0; g < 12; g++) {
    const rng = mulberry32(100 + g);
    let s = setup(6, { levels: [0, 0, 0, 0, 0, 0] }, rng, []);
    const w = wrongOf(s);
    s = apply(s, 0, { type: "accuse", suspect: w[0], weapon: w[1], room: w[2] - 12 });
    assert.equal(s.out[0], true);
    let steps = 0;
    while (!s.over && steps++ < 20000) s = botStep(s, rng);
    assert.ok(s.over, "game " + g + " never ended");
    assert.ok(s.turnNo < 1500, "game " + g + " took " + s.turnNo + " turns");
  }
});

test("last player standing keeps playing and must still accuse correctly", () => {
  const s0 = setup(3, {}, mulberry32(7), []);
  const w = wrongOf(s0);
  let s = apply(s0, 0, { type: "accuse", suspect: w[0], weapon: w[1], room: w[2] - 12 });
  s = apply(s, 1, { type: "accuse", suspect: w[0], weapon: w[1], room: w[2] - 12 });
  assert.equal(s.over, false, "no automatic win");
  assert.deepEqual(toAct(s), [2]);
  s = apply(s, 2, { type: "roll" });
  // ending the turn comes straight back to the same player
  if (s.phase === "move") { const m = game.bot({ pub: publicView(s), mine: privateView(s, 2), state: s }, 2, mulberry32(1)); s = apply(s, 2, m); }
  if (s.phase === "suggest") s = apply(s, 2, { type: "end" });
  if (s.phase === "post") s = apply(s, 2, { type: "end" });
  assert.equal(s.turn, 2);
  s = apply(s, 2, { type: "accuse", suspect: s.env[0], weapon: s.env[1], room: s.env[2] - 12 });
  assert.equal(s.winner, 2);
});

test("boxed in: a roll with every exit blocked spends the turn, and the token stays put", () => {
  const s = setup(3, {}, mulberry32(3), []);
  s.pos[0] = { room: 0 };              // Scarlet in the Kitchen (one door)
  s.pos[1] = { sq: idx(7, 4) };        // Mustard standing on the Kitchen's doorway square
  s.startRoom = 0;
  const t = apply(clone(s), 0, { type: "roll" });
  assert.equal(t.phase, "post");
  assert.deepEqual(t.pos[0], { room: 0 });
  assert.equal(t.last.t, "roll");
  // the secret passage is still open before rolling
  const u = apply(clone(s), 0, { type: "passage" });
  assert.deepEqual(u.pos[0], { room: 8 });
});

test("pulled into the room you're already in is not a move: no free suggestion (Clue rules)", () => {
  const s = setup(3, {}, mulberry32(9), []);
  s.pos[0] = { room: 6 }; s.phase = "suggest"; s.entered = true;
  s.pos[1] = { room: 6 };
  const t = apply(clone(s), 0, { type: "suggest", suspect: 1, weapon: 6 });
  assert.equal(t.summoned[1], false);
  // but pulled in from another room it is
  s.pos[1] = { room: 2 };
  const u = apply(clone(s), 0, { type: "suggest", suspect: 1, weapon: 6 });
  assert.equal(u.summoned[1], true);
});

test("odd actions from a peer are refused and never change the table", () => {
  const s = setup(3, {}, mulberry32(2), []);
  s.pos[0] = { room: 6 }; s.phase = "suggest"; s.entered = true;
  const before = JSON.stringify(s);
  const bad = [
    { type: "suggest", suspect: 2.5, weapon: 7 },
    { type: "suggest", suspect: "1", weapon: 7 },
    { type: "suggest", suspect: 1, weapon: "7" },
    { type: "suggest", suspect: 1, weapon: 7.5 },
    { type: "accuse", suspect: 1.5, weapon: 7, room: 3 },
    { type: "accuse", suspect: 1, weapon: 7, room: "3" },
    { type: "accuse", suspect: 1, weapon: 7, room: 3.2 },
    { type: "move", sq: "100" },
    { type: "show", card: 3 },
    { type: "dance" },
    null,
  ];
  for (const a of bad) {
    const c = clone(s);
    assert.throws(() => apply(c, 0, a), JSON.stringify(a));
  }
  assert.equal(JSON.stringify(s), before);
});

test("a computer whose brain fails still makes a legal move (the table never freezes)", () => {
  const rng = mulberry32(21);
  let s = setup(4, { levels: [1, 1, 1, 1] }, rng, []);
  for (let k = 0; k < 300 && !s.over; k++) {
    const seat = toAct(s)[0];
    // a broken context (no private view) must still give a move the rules accept
    const a = game.bot({ pub: publicView(s), mine: null, state: s }, seat, rng);
    s = apply(clone(s), seat, a, rng);
  }
  assert.ok(s.turnNo > 5);
});

test("safeAction is legal in every phase", () => {
  const rng = mulberry32(31);
  let s = setup(5, { levels: [0, 1, 0, 1, 0] }, rng, []);
  const phases = new Set();
  for (let k = 0; k < 2000 && !s.over; k++) {
    const seat = toAct(s)[0];
    phases.add(s.phase);
    const a = safeAction(s, seat);
    apply(clone(s), seat, a, rng);           // must not throw
    s = botStep(s, rng);
  }
  for (const p of ["start", "move", "suggest", "post", "disprove"]) assert.ok(phases.has(p), "saw phase " + p);
});

test("every rule set and 3 to 6 players play to the end with computers", () => {
  const sets = [{}, { dice: 2, stay: true }, { dice: 2, stay: true, upTo: true }];
  for (const [k, o] of sets.entries()) for (let n = 3; n <= 6; n++) {
    const rng = mulberry32(k * 10 + n);
    let s = setup(n, Object.assign({ levels: Array(n).fill(1) }, o), rng, []);
    let steps = 0;
    while (!s.over && steps++ < 20000) s = botStep(s, rng);
    assert.ok(s.over, `rules ${k} n ${n}`);
  }
});

test("accusing after rolling, before moving, is allowed", () => {
  const s = setup(3, {}, mulberry32(5), []);
  let t = apply(s, 0, { type: "roll" });
  assert.equal(t.phase, "move");
  t = apply(t, 0, { type: "accuse", suspect: t.env[0], weapon: t.env[1], room: t.env[2] - 12 });
  assert.equal(t.winner, 0);
});
