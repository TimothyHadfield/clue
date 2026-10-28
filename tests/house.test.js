// House rules (wave 3): leftover cards face up, quick moves (no dice), the official 2-player game.
import test from "node:test";
import assert from "node:assert/strict";
import { game, setup, apply, publicView, privateView, toAct, movesFor } from "../js/game.js";
import { seatView, toTable } from "../js/knowledge.js";
import { solve, mulberry32 } from "../js/solver.js";
import { STARTS } from "../js/board.js";

const everyCardOnce = (s) => {
  const all = s.env.concat(...s.hands, s.faceUp || [], (s.hidden || []).map((h) => h.card)).sort((a, b) => a - b);
  assert.deepEqual(all, [...Array(21).keys()]);
};

test("face up: 4 players get 4 each with 2 face up, 5 get 3 each with 3 face up, 3 and 6 deal everything", () => {
  for (const [n, each, up] of [[3, 6, 0], [4, 4, 2], [5, 3, 3], [6, 3, 0]]) {
    const s = setup(n, { faceUp: true }, mulberry32(7 + n));
    assert.deepEqual(s.hands.map((h) => h.length), new Array(n).fill(each), "hands " + n);
    assert.equal(s.faceUp.length, up, "face up " + n);
    assert.deepEqual(publicView(s).faceUp, s.faceUp, "everyone sees them");
    everyCardOnce(s);
  }
  // off: the deal is exactly the base game's
  const a = setup(4, {}, mulberry32(3)), b = setup(4, { faceUp: false }, mulberry32(3));
  assert.deepEqual(a.hands, b.hands);
  assert.deepEqual(a.hands.map((h) => h.length), [5, 5, 4, 4]);
  assert.ok(!a.faceUp || a.faceUp.length === 0);
});

test("face up: the notes rule face-up cards out of the case file and out of every hand", () => {
  const s = setup(4, { faceUp: true, levels: [1, 1, 1, 1] }, mulberry32(11));
  const pub = publicView(s), mine = privateView(s, 0);
  const K = seatView(pub, mine, 0);
  const sol = solve(K.n, K.sizes, K.facts);
  assert.ok(sol.ok);
  const prob = toTable(sol.prob, K.pile);
  for (const c of s.faceUp) {
    assert.equal(prob[c][pub.n], 0, "not in the file");
    for (let p = 0; p < pub.n; p++) assert.equal(prob[c][p], 0, "not in a hand");
    assert.equal(prob[c][pub.n + 1], 1, "on the table");
  }
  // the envelope column still sums to 1 per category
  const sum = (a, b) => prob.slice(a, b).reduce((x, r) => x + r[pub.n], 0);
  assert.ok(Math.abs(sum(0, 6) - 1) < 1e-9 && Math.abs(sum(6, 12) - 1) < 1e-9 && Math.abs(sum(12, 21) - 1) < 1e-9);
});

test("quick moves: no dice, go straight to any other room; never back into the room you're in", () => {
  const s = setup(3, { quick: true, stay: false }, mulberry32(5));
  const m = movesFor(s);
  assert.equal(m.squares.length, 0);
  assert.equal(m.rooms.length, 9, "from a start square every room is open");
  let t = apply(s, 0, { type: "move", room: 4 }, mulberry32(1));   // no roll first
  assert.deepEqual(t.pos[t.chars[0]], { room: 4 });
  assert.equal(t.phase, "suggest");
  t = apply(t, 0, { type: "suggest", suspect: 1, weapon: 6 });
  while (t.phase === "disprove") t = apply(t, t.sugg.asking, { type: "show", card: privateView(t, t.sugg.asking).mustShow[0] });
  t = apply(t, 0, { type: "end" });
  // round to seat 0 again: the Billiard Room is not on offer, the eight others are
  while (t.turn !== 0) { t = apply(t, t.turn, { type: "move", room: t.turn }); t = apply(t, t.turn, { type: "end" }); }
  const m2 = movesFor(t);
  assert.equal(m2.rooms.length, 8);
  assert.ok(!m2.rooms.some((x) => x.room === 4));
  assert.throws(() => apply(t, 0, { type: "move", room: 4 }));
  assert.throws(() => apply(t, 0, { type: "move", sq: STARTS[0] }));
  // rolling still works (computers / old saves) and also leads to any room
  const r = apply(JSON.parse(JSON.stringify(t)), 0, { type: "roll" }, mulberry32(2));
  assert.equal(r.phase, "move");
  assert.equal(movesFor(r).rooms.length, 8);
  // off: no move without a roll
  const base = setup(3, {}, mulberry32(5));
  assert.throws(() => apply(base, 0, { type: "move", room: 4 }));
});

test("2 players: 4 cards face down in 4 rooms, 7 each; you see a room's card when you walk in, nobody else does", () => {
  const s = setup(2, { quick: true }, mulberry32(9));
  assert.equal(s.n, 2);
  assert.deepEqual(s.hands.map((h) => h.length), [7, 7]);
  assert.equal(s.hidden.length, 4);
  assert.equal(new Set(s.hidden.map((h) => h.room)).size, 4, "four different rooms");
  everyCardOnce(s);
  const pub = publicView(s);
  assert.deepEqual(pub.hiddenRooms.slice().sort(), s.hidden.map((h) => h.room).sort());
  assert.ok(!JSON.stringify(pub).includes('"hidden"'), "the cards themselves stay secret");
  const h = s.hidden[0];
  let t = apply(s, 0, { type: "move", room: h.room });
  const me = privateView(t, 0), them = privateView(t, 1);
  assert.ok(me.seen.some((x) => x.i < 0 && x.card === h.card && x.room === h.room), "you looked");
  assert.ok(!them.seen.some((x) => x.card === h.card), "they didn't");
  assert.equal(publicView(t).last.peek, true, "the table knows you looked, not what");
  // the notes now know where that card is
  const K = seatView(publicView(t), me, 0);
  const prob = toTable(solve(K.n, K.sizes, K.facts).prob, K.pile);
  assert.equal(prob[h.card][2], 0);
  assert.equal(prob[h.card][3], 1);
  // a suggestion only asks the other player
  t = apply(t, 0, { type: "suggest", suspect: 0, weapon: 6 });
  assert.ok(["post", "disprove"].includes(t.phase));
  // the end reveals the room cards too
  const env = t.env;
  if (t.phase === "disprove") t = apply(t, 1, { type: "show", card: privateView(t, 1).mustShow[0] });
  t = apply(t, 0, { type: "accuse", suspect: env[0], weapon: env[1], room: env[2] - 12 });
  assert.equal(publicView(t).reveal.hidden.length, 4);
  // 2 players needs the room cards: plain 2-player setups still refused for 1 and 7
  assert.throws(() => setup(1, {}));
  assert.throws(() => setup(7, {}));
});

test("computers finish whole games under every house rule, legally, without falling back", () => {
  const warn = console.warn; let fallbacks = 0;
  console.warn = (...a) => { if (String(a[0]).includes("computer fallback")) fallbacks++; else warn(...a); };
  try {
    const cases = [[4, { faceUp: true }], [5, { faceUp: true, dice: 2, stay: true }], [3, { quick: true }], [6, { quick: true, faceUp: true, stay: true }], [2, {}], [2, { quick: true }]];
    let g = 0;
    for (const [n, o] of cases) for (let k = 0; k < 4; k++) {
      const rng = mulberry32(100 + g++);
      const levels = Array.from({ length: n }, (_, i) => (i + k) % 3);
      let s = setup(n, Object.assign({ levels }, o), rng, levels.map(() => ({ kind: "computer" })));
      let steps = 0;
      while (!s.over && steps++ < 5000) {
        const who = toAct(s)[0];
        const a = game.bot({ pub: publicView(s), mine: privateView(s, who), state: s }, who, rng);
        s = apply(s, who, a, rng);
        JSON.parse(JSON.stringify(s));
      }
      assert.ok(s.over, `game ends: ${n} players ${JSON.stringify(o)}`);
    }
  } finally { console.warn = warn; }
  assert.equal(fallbacks, 0, "no computer move was refused");
});
