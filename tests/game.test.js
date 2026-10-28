import test from "node:test";
import assert from "node:assert/strict";
import { W, H, cell, isHall, idx, STARTS, ROOM_DOORS, DOOR_LIST, PASSAGE, reach, STEPS_TO_ROOM, ROOM_LETTERS } from "../js/board.js";
import { game, setup, apply, publicView, privateView, toAct, movesFor } from "../js/game.js";
import { EDITIONS } from "../js/cards.js";
import { handSizes } from "../js/knowledge.js";
import { mulberry32 } from "../js/solver.js";

test("card facts: 6 suspects, 6 weapons, 9 rooms = 21 cards", () => {
  const E = EDITIONS.classic;
  assert.equal(E.suspects.length, 6); assert.equal(E.weapons.length, 6); assert.equal(E.rooms.length, 9);
  assert.equal(E.suspects[0], "Miss Scarlet");
  assert.deepEqual(E.rooms, ["Kitchen", "Ballroom", "Conservatory", "Dining Room", "Billiard Room", "Library", "Lounge", "Hall", "Study"]);
  for (const k of Object.keys(EDITIONS)) {
    const e = EDITIONS[k];
    assert.equal(e.suspects.length + e.weapons.length + e.rooms.length, 21, k);
  }
});

test("board: 24 x 25, 188 hallway squares, 17 doors, 2 passages, 6 starts on the edge", () => {
  let hall = 0;
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (isHall(r, c)) hall++;
  assert.equal(hall, 188);
  assert.equal(DOOR_LIST.length, 17);
  assert.deepEqual(ROOM_DOORS.map((d) => d.length), [1, 4, 1, 2, 2, 2, 1, 3, 1]);
  assert.deepEqual(PASSAGE, [8, -1, 6, -1, -1, -1, 2, -1, 0]);
  assert.deepEqual(STARTS, [idx(24, 7), idx(17, 0), idx(0, 9), idx(0, 14), idx(6, 23), idx(19, 23)]);
  for (const d of DOOR_LIST) {
    const [hr, hc] = [Math.floor(d.hall / W), d.hall % W];
    assert.ok(isHall(hr, hc), "door opens onto a hallway square");
    const [rr, rcol] = [Math.floor(d.roomCell / W), d.roomCell % W];
    assert.equal(ROOM_LETTERS.indexOf(cell(rr, rcol)), d.room);
    assert.equal(Math.abs(hr - rr) + Math.abs(hc - rcol), 1, "door squares touch");
  }
});

test("board: Peacock is 10 steps from the Billiard Room (a known fact of the classic board)", () => {
  assert.equal(STEPS_TO_ROOM[4][STARTS[4]], 10);
  // and reach() agrees: 10 gets in, 9 does not
  assert.ok(reach({ sq: STARTS[4] }, 10, new Set()).rooms.some((x) => x.room === 4));
  assert.ok(!reach({ sq: STARTS[4] }, 9, new Set()).rooms.some((x) => x.room === 4));
});

test("movement: exact roll in the hallway, never through another token, rooms need no exact count", () => {
  // Scarlet (24,7): up is (23,7), the only way out
  const m1 = reach({ sq: STARTS[0] }, 1, new Set());
  assert.deepEqual(m1.squares, [idx(23, 7)]);
  const m2 = reach({ sq: STARTS[0] }, 2, new Set());
  assert.deepEqual(m2.squares.sort(), [idx(22, 7), idx(23, 8)].sort());
  // block (23,7): Scarlet can't move at all
  const m3 = reach({ sq: STARTS[0] }, 6, new Set([idx(23, 7)]));
  assert.equal(m3.squares.length + m3.rooms.length, 0);
  // Lounge door hallway square is (18,6). From (17,6) with a 6 you can still walk in.
  const m4 = reach({ sq: idx(17, 6) }, 6, new Set());
  assert.ok(m4.rooms.some((x) => x.room === 6 && x.steps === 2));
  // leaving a room through a door you can't come straight back in the same turn
  const m5 = reach({ room: 6 }, 2, new Set());
  assert.ok(!m5.rooms.some((x) => x.room === 6));
  assert.ok(m5.squares.includes(idx(17, 6)));
});

test("deal: 3 in the file, 18 dealt one at a time, uneven hands for 4 and 5", () => {
  assert.deepEqual(handSizes(3), [6, 6, 6]);
  assert.deepEqual(handSizes(4), [5, 5, 4, 4]);
  assert.deepEqual(handSizes(5), [4, 4, 4, 3, 3]);
  assert.deepEqual(handSizes(6), [3, 3, 3, 3, 3, 3]);
  const s = setup(4, {}, mulberry32(3), []);
  const all = s.hands.flat().concat(s.env);
  assert.equal(new Set(all).size, 21);
  assert.ok(s.env[0] < 6 && s.env[1] >= 6 && s.env[1] < 12 && s.env[2] >= 12);
  assert.deepEqual(s.hands.map((h) => h.length), [5, 5, 4, 4]);
  assert.equal(new Set(s.weaponRoom).size, 6, "each weapon starts in a different room");
});

test("setup: 2 to 6 players (2 only with the room cards, tests/house.test.js), all 6 tokens on their start squares, Scarlet's side starts", () => {
  assert.equal(game.minSeats, 2); assert.equal(game.maxSeats, 6);
  for (let n = 2; n <= 6; n++) {
    const s = setup(n, {}, mulberry32(n), []);
    assert.equal(s.pos.length, 6, "spare suspects stay on the board");
    s.pos.forEach((p, k) => assert.equal(p.sq, STARTS[k]));
    assert.equal(s.turn, 0);
    assert.deepEqual(s.chars, [...s.chars].sort((a, b) => a - b), "seats go round the board from Scarlet");
  }
});

function fixed(n, hands, env) {
  const s = setup(n, {}, mulberry32(1), []);
  s.hands = hands; s.env = env; s.sizes = hands.map((h) => h.length);
  return s;
}

test("suggestion: asked clockwise, first holder shows exactly one, passes recorded", () => {
  // 4 players; seat 0 in the Lounge (room 6)
  // file: Plum, Wrench, Lounge (card 18)
  const s = fixed(4, [[0, 6, 12, 13, 14], [1, 7, 15, 16, 17], [2, 4, 8, 19], [3, 9, 10, 20]], [5, 11, 18]);
  s.pos[0] = { room: 6 }; s.phase = "suggest"; s.entered = true;
  // ask: White (2), Lead Pipe (8), Lounge (18) -> seat 1 has none, seat 2 has White + Lead Pipe → must choose
  let t = apply(s, 0, { type: "suggest", suspect: 2, weapon: 8 });
  assert.equal(t.phase, "disprove");
  assert.deepEqual(toAct(t), [2]);
  assert.deepEqual(t.sugg.passes, [1]);
  assert.deepEqual(privateView(t, 2).mustShow.sort(), [2, 8]);
  assert.throws(() => apply(t, 2, { type: "show", card: 18 }));
  t = apply(t, 2, { type: "show", card: 8 });
  assert.equal(t.phase, "post");
  assert.deepEqual(t.seen[0], [{ i: 0, from: 2, card: 8 }]);
  // the public log never says which card
  assert.ok(!("shown" in t.log[0]));
  assert.equal(t.log[0].shower, 2);
  // White's token (seat 2's suspect) was brought into the Lounge and may suggest there next turn
  assert.deepEqual(t.pos[2], { room: 6 });
  assert.equal(t.summoned[2], true);
  assert.equal(t.weaponRoom[2], 6);
});

test("suggestion: nobody can show → everyone passes", () => {
  const s = fixed(3, [[0, 1, 6, 7, 12, 13], [2, 3, 8, 9, 14, 15], [4, 10, 16, 17, 19, 20]], [5, 11, 18]);
  s.pos[0] = { room: 6 }; s.phase = "suggest";
  const t = apply(s, 0, { type: "suggest", suspect: 5, weapon: 11 });
  assert.equal(t.phase, "post");
  assert.deepEqual(t.log[0].passes, [1, 2]);
  assert.equal(t.log[0].shower, null);
});

test("you may not suggest twice from the same room without being moved there", () => {
  const s = fixed(3, [[0, 1, 6, 7, 12, 13], [2, 3, 8, 9, 14, 15], [4, 10, 16, 17, 19, 20]], [5, 11, 18]);
  s.pos[0] = { room: 6 }; s.phase = "start"; s.startRoom = 6;
  assert.throws(() => apply(s, 0, { type: "suggest", suspect: 5, weapon: 11 }));
  s.summoned[0] = true;
  const t = apply(s, 0, { type: "suggest", suspect: 5, weapon: 11 });
  assert.equal(t.phase, "post");
});

test("secret passage: Lounge to Conservatory, then suggest", () => {
  const s = fixed(3, [[0, 1, 6, 7, 12, 13], [2, 3, 8, 9, 14, 15], [4, 10, 16, 17, 19, 20]], [5, 11, 18]);
  s.pos[0] = { room: 6 }; s.phase = "start";
  const t = apply(s, 0, { type: "passage" });
  assert.deepEqual(t.pos[0], { room: 2 });
  assert.equal(t.phase, "suggest");
});

test("accusations: wrong = out but still shows cards; all wrong = nobody wins", () => {
  const s = fixed(3, [[0, 1, 6, 7, 12, 13], [2, 3, 8, 9, 14, 15], [4, 10, 16, 17, 19, 20]], [5, 11, 18]);
  let t = apply(s, 0, { type: "accuse", suspect: 0, weapon: 6, room: 0 });
  assert.equal(t.out[0], true); assert.equal(t.turn, 1);
  assert.deepEqual(privateView(t, 0).env, [5, 11, 18], "the accuser looked in the file");
  // seat 0 is out but must still answer seat 1's suggestion
  t.pos[1] = { room: 6 }; t.phase = "suggest";
  t = apply(t, 1, { type: "suggest", suspect: 0, weapon: 11 });
  assert.equal(t.log[1].shower, 0, "out players still show");
  t = apply(t, 1, { type: "accuse", suspect: 0, weapon: 6, room: 0 });
  t = apply(t, 2, { type: "accuse", suspect: 5, weapon: 11, room: 6 });
  assert.equal(t.over, true); assert.equal(t.winner, 2);
  const u = fixed(3, [[0, 1, 6, 7, 12, 13], [2, 3, 8, 9, 14, 15], [4, 10, 16, 17, 19, 20]], [5, 11, 18]);
  let v = apply(u, 0, { type: "accuse", suspect: 0, weapon: 6, room: 0 });
  v = apply(v, 1, { type: "accuse", suspect: 0, weapon: 6, room: 0 });
  v = apply(v, 2, { type: "accuse", suspect: 0, weapon: 6, room: 0 });
  assert.equal(v.over, true); assert.equal(v.winner, -1);
});

test("secrecy: public view and other seats' private views never hold another player's hand", () => {
  const rng = mulberry32(5);
  for (let g = 0; g < 30; g++) {
    let s = game.setup(4, { levels: [1, 1, 1, 1] }, rng, []);
    for (let k = 0; k < 400 && !s.over; k++) {
      const pubS = JSON.stringify(publicView(s));
      assert.ok(!pubS.includes('"hands"') || s.over);
      assert.ok(!pubS.includes('"env"') || s.over);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (i !== j) {
        const pj = privateView(s, j);
        // j may know a card of i only if i showed it to j
        const shownToJ = new Set(pj.seen.filter((x) => x.from === i).map((x) => x.card));
        for (const c of s.hands[i]) if (!shownToJ.has(c) && !s.hands[j].includes(c)) {
          assert.ok(!pj.seen.some((x) => x.card === c && x.from === i));
        }
      }
      const seat = game.toAct(s)[0];
      const a = game.bot({ pub: publicView(s), mine: privateView(s, seat), state: s }, seat, rng);
      s = game.apply(JSON.parse(JSON.stringify(s)), seat, a, rng);
    }
  }
});

test("computers play whole games: no illegal moves, JSON-safe, always someone to act", () => {
  const rng = mulberry32(11);
  let finished = 0, winners = 0;
  for (let g = 0; g < 60; g++) {
    const n = 3 + (g % 4);
    const levels = Array.from({ length: n }, (_, i) => (g + i) % 2);  // Easy + Medium (fast)
    let s = game.setup(n, { levels, dice: g % 2 ? 1 : 2 }, rng, []);
    let steps = 0;
    while (!game.isOver(s) && steps++ < 5000) {
      const ta = game.toAct(s);
      assert.ok(ta.length === 1);
      const seat = ta[0];
      const a = game.bot({ pub: publicView(s), mine: privateView(s, seat), state: s }, seat, rng);
      s = game.apply(JSON.parse(JSON.stringify(s)), seat, a, rng);
      assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
    }
    if (s.over) finished++;
    if (s.winner >= 0) winners++;
  }
  assert.equal(finished, 60);
  assert.ok(winners >= 55, "almost every game is solved by someone, got " + winners);
});

test("rule sets: Cluedo/newer let you stay and suggest; newer lets you stop short of your roll", () => {
  const base = { dice: 2, stay: true, upTo: true };
  const s = setup(3, base, mulberry32(4), []);
  s.pos[0] = { room: 6 }; s.phase = "start"; s.startRoom = 6;
  const t = apply(JSON.parse(JSON.stringify(s)), 0, { type: "suggest", suspect: 5, weapon: 11 });
  assert.ok(t.suggested);
  const c = setup(3, {}, mulberry32(4), []);
  assert.equal(c.opts.dice, 1, "classic Clue rolls one die");
  // up to the roll: Scarlet with a 2 may stop after 1 step
  assert.ok(reach({ sq: STARTS[0] }, 2, new Set(), { upTo: true }).squares.includes(idx(23, 7)));
  assert.ok(!reach({ sq: STARTS[0] }, 2, new Set()).squares.includes(idx(23, 7)));
});

test("a wrong accuser standing in a doorway is moved into the room", () => {
  const s = setup(3, {}, mulberry32(4), []);
  s.pos[0] = { sq: idx(18, 6) };   // outside the Lounge door
  const wrong = [0, 6, 12].map((c, i) => (c === s.env[i] ? c + 1 : c));
  const t = apply(s, 0, { type: "accuse", suspect: wrong[0], weapon: wrong[1], room: wrong[2] - 12 });
  assert.deepEqual(t.pos[0], { room: 6 });
});
