/* ============================================================================
 * game.js — the rules of Clue as pure functions (the online.js game shape).
 *   setup(n, options, rng, seats) → state
 *   toAct(state) → [seat]
 *   apply(state, seat, action, rng) → state   (throws on anything illegal)
 *   publicView(state) / privateView(state, seat)
 *   bot(ctx, seat, rng) → action
 * Seats sit in turn order (clockwise from Miss Scarlet). Seat i moves the
 * token of suspect chars[i]. All six tokens are on the board every game.
 * ==========================================================================*/

import { reach, STARTS, PASSAGE, DOOR_ROOMS } from "./board.js";
import { handSizes } from "./knowledge.js";
import { botAction } from "./ai.js";

export const MIN = 3, MAX = 6;

function shuffle(a, rng) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const inRange = (x, lo, hi) => Number.isInteger(x) && x >= lo && x < hi;
const roll = (rng) => 1 + Math.floor(rng() * 6);

export function setup(n, options = {}, rng = Math.random, seats = []) {
  if (n < MIN || n > MAX) throw new Error("Clue is for 3 to 6 players");
  const chars = (options.chars && options.chars.length === n ? options.chars.slice() : [...Array(n).keys()]).sort((a, b) => a - b);
  if (new Set(chars).size !== n || chars.some((c) => c < 0 || c > 5)) throw new Error("each player needs a different suspect");
  const env = [Math.floor(rng() * 6), 6 + Math.floor(rng() * 6), 12 + Math.floor(rng() * 9)];
  const rest = shuffle([...Array(21).keys()].filter((c) => !env.includes(c)), rng);
  const hands = Array.from({ length: n }, () => []);
  rest.forEach((c, i) => hands[i % n].push(c));           // dealt one at a time, first player first
  hands.forEach((h) => h.sort((a, b) => a - b));
  const weaponRoom = shuffle([...Array(9).keys()], rng).slice(0, 6); // each weapon in a different room
  return {
    v: 1, n,
    opts: {
      dice: options.dice === 2 ? 2 : 1,              // classic North American Clue: one die
      stay: !!options.stay,                          // UK / newer rules: may stay in a room and suggest again
      upTo: !!options.upTo,                          // newer rules: move up to the roll
      edition: options.edition || "classic", levels: options.levels || [],
    },
    names: seats.map((s, i) => (s && s.name) || "Player " + (i + 1)),
    kinds: seats.map((s) => (s && s.kind) || "human"),
    chars,
    pos: STARTS.map((sq) => ({ sq })),      // by suspect
    weaponRoom,                              // by weapon
    env, hands,
    sizes: hands.map((h) => h.length),
    turn: 0, turnNo: 1, phase: "start",
    roll: null, startRoom: -1, entered: false, suggested: false,
    summoned: new Array(n).fill(false),
    sugg: null,
    log: [],
    seen: Array.from({ length: n }, () => []),    // cards shown TO this seat: {i, from, card}
    showed: Array.from({ length: n }, () => []),  // cards this seat showed: {i, to, card}
    out: new Array(n).fill(false),
    envSeen: new Array(n).fill(false),
    winner: -1, over: false,
    last: null,                                    // last public event, for animation
  };
}

export const toAct = (s) => (s.over ? [] : s.phase === "disprove" ? [s.sugg.asking] : [s.turn]);
export const isOver = (s) => s.over;

const placeOf = (s, seat) => s.pos[s.chars[seat]];
const blockedSquares = (s, exceptSuspect) => {
  const b = new Set();
  s.pos.forEach((p, i) => { if (i !== exceptSuspect && p.sq != null) b.add(p.sq); });
  return b;
};
export function movesFor(s) {
  if (!s.roll) return { squares: [], rooms: [] };
  const me = s.chars[s.turn];
  return reach(s.pos[me], s.roll.total, blockedSquares(s, me), { upTo: s.opts.upTo });
}
export const canPassage = (s) => {
  const p = placeOf(s, s.turn);
  return s.phase === "start" && p.room != null && PASSAGE[p.room] >= 0;
};
export const canSuggestHere = (s) => {
  const p = placeOf(s, s.turn);
  if (p.room == null || s.suggested) return false;
  if (s.phase === "suggest") return true;
  return s.phase === "start" && (s.summoned[s.turn] || !!s.opts.stay);
};

function nextTurn(s) {
  s.summoned[s.turn] = false;
  let t = s.turn;
  for (let i = 0; i < s.n; i++) {
    t = (t + 1) % s.n;
    if (!s.out[t]) break;
  }
  s.turn = t; s.turnNo++;
  s.phase = "start"; s.roll = null; s.entered = false; s.suggested = false; s.sugg = null;
  const p = placeOf(s, t);
  s.startRoom = p.room != null ? p.room : -1;
}

function finishSuggestion(s) {
  const g = s.sugg;
  s.log.push({ t: "suggest", by: g.by, cards: g.cards.slice(), passes: g.passes.slice(), shower: g.shower, turnNo: s.turnNo });
  s.last = { t: "suggestDone", by: g.by, shower: g.shower, i: s.log.length - 1 };
  if (g.shower != null) {
    s.seen[g.by].push({ i: s.log.length - 1, from: g.shower, card: g.shown });
    s.showed[g.shower].push({ i: s.log.length - 1, to: g.by, card: g.shown });
  }
  s.sugg = null;
  s.phase = "post";
}

/** Ask players clockwise until someone must choose (2+ cards) or the circle closes. */
function advanceAsking(s) {
  const g = s.sugg;
  while (true) {
    const p = (g.by + g.k) % s.n;
    if (p === g.by) { finishSuggestion(s); return; }
    const held = s.hands[p].filter((c) => g.cards.includes(c));
    if (held.length === 0) { g.passes.push(p); g.k++; continue; }
    g.shower = p;
    if (held.length === 1) { g.shown = held[0]; finishSuggestion(s); return; }
    g.asking = p; s.phase = "disprove"; return;
  }
}

export function apply(s, seat, a, rng = Math.random) {
  if (s.over) throw new Error("game over");
  if (!a || typeof a.type !== "string") throw new Error("no action");
  if (s.phase === "disprove") {
    if (a.type !== "show" || seat !== s.sugg.asking) throw new Error("waiting for a card to be shown");
    const card = a.card;
    if (!s.sugg.cards.includes(card) || !s.hands[seat].includes(card)) throw new Error("you can't show that card");
    s.sugg.shown = card;
    finishSuggestion(s);
    return s;
  }
  if (seat !== s.turn) throw new Error("not your turn");
  const me = s.chars[seat];
  switch (a.type) {
    case "roll": {
      if (s.phase !== "start") throw new Error("you already moved");
      const dice = [roll(rng)]; if (s.opts.dice === 2) dice.push(roll(rng));
      s.roll = { dice, total: dice.reduce((x, y) => x + y, 0) };
      s.phase = "move";
      const m = movesFor(s);
      s.last = { t: "roll", by: seat, dice };
      if (!m.squares.length && !m.rooms.length) s.phase = "post"; // boxed in: the turn is spent
      return s;
    }
    case "passage": {
      if (!canPassage(s)) throw new Error("no secret passage here");
      const from = s.pos[me].room;
      s.pos[me] = { room: PASSAGE[from] };
      s.entered = true; s.phase = "suggest";
      s.last = { t: "passage", by: seat, from, to: PASSAGE[from] };
      return s;
    }
    case "move": {
      if (s.phase !== "move") throw new Error("roll first");
      const m = movesFor(s);
      const from = s.pos[me];
      if (a.room != null) {
        if (!m.rooms.some((x) => x.room === a.room)) throw new Error("you can't reach that room");
        s.pos[me] = { room: a.room }; s.entered = true; s.phase = "suggest";
      } else {
        if (!m.squares.includes(a.sq)) throw new Error("you can't reach that square");
        s.pos[me] = { sq: a.sq }; s.phase = "post";
      }
      s.last = { t: "move", by: seat, from, to: s.pos[me], path: a.path || null };
      return s;
    }
    case "suggest": {
      if (!canSuggestHere(s)) throw new Error("you can't make a suggestion now");
      const room = s.pos[me].room;
      const sus = a.suspect, wep = a.weapon;
      if (!inRange(sus, 0, 6) || !inRange(wep, 6, 12)) throw new Error("pick a suspect and a weapon");
      // the named suspect's token and the weapon are brought into the room
      const prevPlace = s.pos[sus];
      s.pos[sus] = { room };
      const owner = s.chars.indexOf(sus);
      if (owner >= 0 && owner !== seat && prevPlace.room !== room) s.summoned[owner] = true;
      s.weaponRoom[wep - 6] = room;
      s.suggested = true;
      s.sugg = { by: seat, cards: [sus, wep, 12 + room], k: 1, passes: [], shower: null, shown: null, asking: -1 };
      s.last = { t: "suggest", by: seat, cards: s.sugg.cards.slice(), moved: sus };
      advanceAsking(s);
      return s;
    }
    case "accuse": {
      if (!["start", "move", "suggest", "post"].includes(s.phase)) throw new Error("not now");
      if (!inRange(a.suspect, 0, 6) || !inRange(a.weapon, 6, 12) || !inRange(a.room, 0, 9)) throw new Error("name a suspect, a weapon and a room");
      const cards = [a.suspect, a.weapon, 12 + a.room];
      const correct = cards.every((c, i) => c === s.env[i]);
      s.log.push({ t: "accuse", by: seat, cards, correct, turnNo: s.turnNo });
      s.envSeen[seat] = true;
      s.last = { t: "accuse", by: seat, cards, correct };
      if (correct) { s.winner = seat; s.over = true; return s; }
      s.out[seat] = true;
      // a token left standing in a doorway is moved into that room so others can get in
      const p = s.pos[me];
      if (p.sq != null && DOOR_ROOMS[p.sq]) s.pos[me] = { room: DOOR_ROOMS[p.sq][0] };
      const left = s.out.map((o, i) => (o ? -1 : i)).filter((i) => i >= 0);
      if (left.length === 0) { s.over = true; s.winner = -1; return s; }
      nextTurn(s);
      return s;
    }
    case "end": {
      if (s.phase === "move") {
        const m = movesFor(s);
        if (m.squares.length || m.rooms.length) throw new Error("move your token first");
      }
      if (s.phase === "start") throw new Error("roll or take a secret passage first");
      nextTurn(s);
      return s;
    }
    default: throw new Error("unknown action");
  }
}

export function publicView(s) {
  return {
    n: s.n, opts: s.opts, names: s.names, kinds: s.kinds, chars: s.chars,
    pos: s.pos, weaponRoom: s.weaponRoom, sizes: s.sizes,
    turn: s.turn, turnNo: s.turnNo, phase: s.phase, roll: s.roll, startRoom: s.startRoom,
    entered: s.entered, suggested: s.suggested, summoned: s.summoned,
    sugg: s.sugg ? { by: s.sugg.by, cards: s.sugg.cards, passes: s.sugg.passes, asking: s.sugg.asking } : null,
    log: s.log, out: s.out, winner: s.winner, over: s.over, last: s.last,
    shownCount: s.seen.map((x) => x.length),
    // the envelope and every hand are turned face up only when the game ends
    reveal: s.over ? { env: s.env, hands: s.hands } : null,
  };
}

export function privateView(s, seat) {
  if (seat == null || seat < 0 || seat >= s.n) return null;
  const v = { hand: s.hands[seat], seen: s.seen[seat], showed: s.showed[seat] };
  if (s.phase === "disprove" && s.sugg.asking === seat) v.mustShow = s.hands[seat].filter((c) => s.sugg.cards.includes(c));
  if (s.envSeen[seat]) v.env = s.env;
  return v;
}

/** A plain legal move for any phase: used when a computer's own choice fails, so the table never freezes. */
export function safeAction(s, seat) {
  if (s.phase === "disprove") return { type: "show", card: s.hands[seat].find((c) => s.sugg.cards.includes(c)) };
  if (s.phase === "start") return canPassage(s) ? { type: "passage" } : { type: "roll" };
  if (s.phase === "move") {
    const m = movesFor(s);
    if (m.rooms.length) return { type: "move", room: m.rooms[0].room };
    if (m.squares.length) return { type: "move", sq: m.squares[0] };
  }
  return { type: "end" };
}

/** The computer's move, checked against the rules first; anything it can't do becomes safeAction. */
function bot(ctx, seat, rng) {
  const s = ctx && ctx.state;
  try {
    const a = botAction(ctx, seat, rng);
    if (s) apply(JSON.parse(JSON.stringify(s)), seat, a, () => 0.5);
    return a;
  } catch (e) {
    if (!s) throw e;
    if (typeof console !== "undefined") console.warn("computer fallback:", e && e.message);
    return safeAction(s, seat);
  }
}

export const game = {
  id: "clue", minSeats: MIN, maxSeats: MAX,
  setup, toAct, apply, publicView, privateView, isOver, bot,
};
