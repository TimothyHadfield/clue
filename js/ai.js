/* ============================================================================
 * ai.js — the computer players. Three strengths, all playing fair: they see
 * only what a human in their seat would see (public table + their own cards).
 *   Easy   (0): ticks off only the cards it is shown. Asks at random.
 *   Medium (1): full pencil-and-paper logic (who passed, who showed, hand
 *               sizes), asks about cards it hasn't ruled out.
 *   Hard   (2): the exact deal-counting solver; asks the question worth the
 *               most information; plans routes to useful rooms; shows cards
 *               it has already shown.
 * ==========================================================================*/

import { propagate, solve, rankSuggestions, CAT_CARDS } from "./solver.js";
import { seatView, recordsFor } from "./knowledge.js";
export { recordsFor };
import { reach, PASSAGE, STEPS_TO_ROOM, ROOM_TO_ROOM } from "./board.js";

export const LEVELS = ["Easy", "Medium", "Hard"];
const cache = new Map();
// Hard accuses once the most likely answer is at least this likely (a measured gamble; see tools/sim.js).
// sim-only knobs (tools/sim.js sets them through the environment); the page always uses the defaults
const ENV = (k, d) => (typeof process !== "undefined" && process.env && process.env[k] != null ? +process.env[k] : d);
const HARD_SURE = ENV("CLUE_SURE", 0.7);
// Hard reads an Easy or Medium computer's early questions (up to this turn) as naming cards it doesn't hold
const K_MODEL = ENV("CLUE_MODEL", 24);


/**
 * What this seat believes. Returns
 *   pEnv[c]: chance card c is in the envelope (0..1)
 *   answer: [s,w,r] if the seat is sure, else null
 */
export function beliefs(level, pub, mine, seat) {
  const key = level + "|" + seat + "|" + pub.log.length + "|" + (mine.seen || []).length + "|" + pub.n + "|" + mine.hand.join(",");
  if (cache.has(key)) return cache.get(key);
  if (cache.size > 300) cache.clear();
  const n = pub.n;
  let out;
  if (mine.env) {
    out = { pEnv: Array.from({ length: 21 }, (_, c) => (mine.env.includes(c) ? 1 : 0)), answer: mine.env.slice() };
  } else if (level === 0) {
    // only cards in hand or seen
    const known = new Set(mine.hand.concat((mine.seen || []).map((x) => x.card), pub.faceUp || []));
    // the one trick a beginner knows: if nobody could answer my question, the cards I don't hold are the answer
    const sure = new Set();
    for (const r of pub.log) if (r.t === "suggest" && r.by === seat && r.shower == null) for (const c of r.cards) if (!mine.hand.includes(c)) sure.add(c);
    const pEnv = new Array(21).fill(0);
    let answer = [];
    for (const cat of CAT_CARDS) {
      const s = cat.find((c) => sure.has(c));
      const un = s != null ? [s] : cat.filter((c) => !known.has(c));
      for (const c of un) pEnv[c] = 1 / un.length;
      answer.push(un.length === 1 ? un[0] : -1);
    }
    out = { pEnv, answer: answer.every((c) => c >= 0) ? answer : null };
  } else {
    // face-up leftovers / 2-player room cards are one more pile (owner K.n - 1); the case file is owner K.n
    const K = seatView(pub, mine, seat), facts = K.facts, EN = K.n;
    if (level === 1) {
      const pr = propagate(EN, K.sizes, facts);
      const pEnv = new Array(21).fill(0);
      let answer = [];
      for (const cat of CAT_CARDS) {
        const poss = cat.filter((c) => pr && (pr.allowed[c] & (1 << EN)));
        for (const c of poss) pEnv[c] = 1 / poss.length;
        answer.push(poss.length === 1 ? poss[0] : -1);
      }
      out = { pEnv, answer: answer.every((c) => c >= 0) ? answer : null, allowed: pr && pr.allowed };
    } else {
      // the Easy and Medium computers only name suspects and weapons they don't hold (until they've solved that
      // kind of card), so Hard reads their questions that way too; it drops the idea if it contradicts what it has seen
      let sol = null;
      if (K_MODEL) {
        const extra = [];
        for (const r of pub.log) if (r.t === "suggest" && r.by !== seat && pub.kinds && pub.kinds[r.by] === "computer" && pub.opts.levels && pub.opts.levels[r.by] < 2 && r.turnNo <= K_MODEL)
          for (const c of r.cards.slice(0, 2)) extra.push({ t: "not", p: r.by, c });
        if (extra.length) { const s2 = solve(EN, K.sizes, facts.concat(extra), { budget: 150000, samples: 1200, thin: 30 }); if (s2.ok) sol = s2; }
      }
      if (!sol) sol = solve(EN, K.sizes, facts, { budget: 150000, samples: 1200, thin: 30 });
      sol.players = n;   // the pile never answers a question
      const pEnv = sol.ok ? sol.prob.map((r) => r[EN]) : new Array(21).fill(1 / 6);
      const top = sol.ok && sol.env[0];
      out = { pEnv, answer: top && top.p > HARD_SURE ? top.cards.slice() : null, sol };
    }
  }
  cache.set(key, out);
  return out;
}

const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];

function roomValue(level, B, mine, room, pub) {
  // 2 players: a room whose face-down card you haven't looked at yet is worth a visit
  const peekable = pub && pub.hiddenRooms && pub.hiddenRooms.includes(room) && !(mine.seen || []).some((x) => x.i < 0 && x.room === room);
  return roomValue0(level, B, mine, room) + (peekable ? (level === 0 ? 0.5 : PEEK) : 0);
}
const SUMMON_BITS = ENV("CLUE_SUMMON", 0.15);   // 2 players: bits Hard gives up to drag its rival's pawn
const STALL = 400;   // turns
const PEEK = ENV("CLUE_PEEK", 2);
function roomValue0(level, B, mine, room) {
  const rc = 12 + room;
  const roomSolved = CAT_CARDS[2].some((c) => B.pEnv[c] > 0.999);
  if (roomSolved) return 1;                       // any room works for asking about people and weapons
  if (level === 0) return B.pEnv[rc] > 0 ? 1 : 0.15;
  if (B.pEnv[rc] > 0) return 0.5 + B.pEnv[rc];    // still a candidate: worth checking
  return mine.hand.includes(rc) ? 0.45 : 0.15;    // own room card: a clean question about the other two
}

function chooseSuggestion(level, B, pub, mine, seat, room, rng) {
  const sus = CAT_CARDS[0], wep = CAT_CARDS[1];
  if (level === 0) {
    const s = sus.filter((c) => B.pEnv[c] > 0), w = wep.filter((c) => B.pEnv[c] > 0);
    return { suspect: pick(s.length ? s : sus, rng), weapon: pick(w.length ? w : wep, rng) };
  }
  if (level === 1) {
    // a card not ruled out; once a category is solved, ask a card of its own to learn about the others
    const choose = (cat) => {
      const open = cat.filter((c) => B.pEnv[c] > 0);
      if (open.length === 1) { const own = cat.filter((c) => mine.hand.includes(c)); return own.length ? pick(own, rng) : open[0]; }
      return pick(open.length ? open : cat, rng);
    };
    return { suspect: choose(sus), weapon: choose(wep) };
  }
  if (!B.sol || !B.sol.ok) return { suspect: pick(sus, rng), weapon: pick(wep, rng) };
  const cands = [];
  for (const s of sus) for (const w of wep) cands.push([s, w, 12 + room]);
  const ranked = rankSuggestions(B.sol, seat, cands, rng, 250);
  const best = ranked[0].bits;
  // 2 players: naming your rival's own suspect drags their pawn away from where they were heading.
  // Measured (2-player, 1000 games): Hard vs Medium 49.8% → 68% when it does so within 0.15 bits of the best question.
  // With 3+ players it made no difference, so the base game is unchanged.
  let pool = ranked;
  if (pub.n === 2) {
    const rival = pub.chars[1 - seat];
    const drag = pub.out[1 - seat] ? [] : ranked.filter((x) => x.cards[0] === rival && x.bits >= best - SUMMON_BITS);
    if (drag.length) pool = drag;
  }
  const top = pool.filter((x) => x.bits >= pool[0].bits - 1e-9);
  const c = pick(top, rng).cards;
  return { suspect: c[0], weapon: c[1] };
}

function chooseShow(level, pub, mine, rng) {
  const opts = mine.mustShow || [];
  if (opts.length <= 1 || level === 0) return pick(opts, rng);
  const asker = pub.sugg.by;
  // show something this player has already seen from us; else something we've shown anybody
  const toAsker = opts.filter((c) => (mine.showed || []).some((x) => x.to === asker && x.card === c));
  if (toAsker.length) return pick(toAsker, rng);
  const anyone = opts.filter((c) => (mine.showed || []).some((x) => x.card === c));
  if (anyone.length && level === 2) return pick(anyone, rng);
  // a room card says less about the murder than a person or weapon? keep it simple: random
  return pick(opts, rng);
}

export function botAction(ctx, seat, rng = Math.random) {
  const { pub, mine } = ctx;
  const level = pub.opts.levels && pub.opts.levels[seat] != null ? pub.opts.levels[seat] : 1;
  if (pub.phase === "disprove") return { type: "show", card: chooseShow(level, pub, mine, rng) };
  const B = beliefs(level, pub, mine, seat);
  // a game that has gone on far too long: name the likeliest answer rather than wander for ever
  if (!B.answer && pub.turnNo > STALL) {
    const best = CAT_CARDS.map((cat) => cat.reduce((x, c) => (B.pEnv[c] > B.pEnv[x] ? c : x), cat[0]));
    return { type: "accuse", suspect: best[0], weapon: best[1], room: best[2] - 12 };
  }
  if (B.answer) return { type: "accuse", suspect: B.answer[0], weapon: B.answer[1], room: B.answer[2] - 12 };
  const me = pub.chars[seat];
  const place = pub.pos[me];
  const value = (r) => roomValue(level, B, mine, r, pub);
  const quick = !!pub.opts.quick;

  if (pub.phase === "start") {
    if (pub.summoned[seat] && place.room != null && value(place.room) >= 0.5) {
      return Object.assign({ type: "suggest" }, chooseSuggestion(level, B, pub, mine, seat, place.room, rng));
    }
    if (place.room != null && PASSAGE[place.room] >= 0 && level > 0 && !quick) {
      // take the passage when that room is worth at least as much as what a roll is likely to reach
      const other = PASSAGE[place.room];
      let bestRoll = 0;
      for (let r = 0; r < 9; r++) if (r !== place.room) bestRoll = Math.max(bestRoll, value(r) - 0.06 * ROOM_TO_ROOM[place.room][r]);
      if (value(other) >= bestRoll) return { type: "passage" };
    }
    if (!quick) return { type: "roll" };
  }
  if (pub.phase === "move" || (quick && pub.phase === "start")) {
    const blocked = new Set(); pub.pos.forEach((p, i) => { if (i !== me && p.sq != null) blocked.add(p.sq); });
    // quick moves: no dice, any room but this one
    const m = quick ? { squares: [], rooms: [...Array(9).keys()].filter((r) => r !== place.room).map((room) => ({ room })) } : reach(place, pub.roll.total, blocked, { upTo: !!pub.opts.upTo });
    let best = null, bestScore = -Infinity;
    for (const x of m.rooms) {
      const sc = value(x.room) + (level === 0 ? rng() * 0.3 : 0);
      if (sc > bestScore) { bestScore = sc; best = { type: "move", room: x.room }; }
    }
    if (best && bestScore >= 0.45) return best;
    for (const sq of m.squares) {
      let sc = -Infinity;
      for (let r = 0; r < 9; r++) if (r !== pub.startRoom) sc = Math.max(sc, value(r) - 0.06 * STEPS_TO_ROOM[r][sq]);
      if (level === 0) sc += rng() * 0.2;
      if (sc > bestScore) { bestScore = sc; best = { type: "move", sq }; }
    }
    if (best) return best;
    return { type: "end" };
  }
  if (pub.phase === "suggest") {
    return Object.assign({ type: "suggest" }, chooseSuggestion(level, B, pub, mine, seat, place.room, rng));
  }
  return { type: "end" };
}
