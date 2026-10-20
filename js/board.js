/* The classic board: 24 squares wide, 25 tall.
 * Legend: '.' hallway square, '#' or ' ' off the board, room letters,
 * 'X' the middle (not enterable), digits 1-6 = start squares (hallway) for
 * Scarlet, Mustard, White, Green, Peacock, Plum.
 * Doors are listed separately: [room, room cell r,c, hallway cell r,c].  */

import { BOARD_TEXT, DOORS, PASSAGES } from "./board-data.js";

export const W = 24, H = 25;
export const ROOM_LETTERS = "KBCDILOHS"; // same order as the room cards
const rows = BOARD_TEXT.trim().split("\n").map((r) => r.replace(/\r/g, "").padEnd(W, "#"));

export const cell = (r, c) => (r < 0 || c < 0 || r >= H || c >= W ? "#" : rows[r][c]);
export const idx = (r, c) => r * W + c;
export const rc = (i) => [Math.floor(i / W), i % W];
export const isHall = (r, c) => { const ch = cell(r, c); return ch === "." || (ch >= "1" && ch <= "6"); };
export const roomAt = (r, c) => ROOM_LETTERS.indexOf(cell(r, c));

export const STARTS = [];
for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) { const ch = cell(r, c); if (ch >= "1" && ch <= "6") STARTS[+ch - 1] = idx(r, c); }

// doors: for each room, the hallway squares you step from/to
export const ROOM_DOORS = Array.from({ length: 9 }, () => []);
export const DOOR_LIST = DOORS.map(([room, rr, rcol, hr, hc]) => {
  const r = ROOM_LETTERS.indexOf(room);
  ROOM_DOORS[r].push(idx(hr, hc));
  return { room: r, roomCell: idx(rr, rcol), hall: idx(hr, hc) };
});
export const PASSAGE = new Array(9).fill(-1);
for (const [a, b] of PASSAGES) { const x = ROOM_LETTERS.indexOf(a), y = ROOM_LETTERS.indexOf(b); PASSAGE[x] = y; PASSAGE[y] = x; }

// hallway graph
export const NEIGH = [];
for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
  const i = idx(r, c);
  NEIGH[i] = [];
  if (!isHall(r, c)) continue;
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) if (isHall(r + dr, c + dc)) NEIGH[i].push(idx(r + dr, c + dc));
}
// hallway square -> rooms it has a door into
export const DOOR_ROOMS = {};
for (const d of DOOR_LIST) (DOOR_ROOMS[d.hall] = DOOR_ROOMS[d.hall] || []).push(d.room);

/**
 * Where can a token go this turn?
 * from: { sq } or { room }; steps: the roll; blocked: Set of hallway squares with a token on them.
 * Rules: up/down/left/right only, never the same square twice in one turn, no
 * square with another token on it, a room may be entered with any steps to
 * spare (that ends the move), a hallway stop must use the whole roll, and you
 * may not go back into the room you started the turn in.
 * Returns { squares: [idx...], rooms: [{room, steps}] }.
 */
export function reach(from, steps, blocked, opts = {}) {
  const squares = new Set();
  const rooms = new Map();
  const startRoom = from.room != null ? from.room : -1;
  const visited = new Set();
  const minMoves = new Map(); // square -> fewest steps used to stand on it with these steps left (pruning)
  function dfs(sq, left) {
    if (DOOR_ROOMS[sq]) for (const r of DOOR_ROOMS[sq]) if (r !== startRoom && left >= 1) {
      const used = steps - left + 1;
      if (!rooms.has(r) || rooms.get(r) > used) rooms.set(r, used);
    }
    if (left === 0 || (opts.upTo && sq !== from.sq)) squares.add(sq);
    if (left === 0) return;
    for (const nx of NEIGH[sq]) {
      if (visited.has(nx) || blocked.has(nx)) continue;
      visited.add(nx);
      dfs(nx, left - 1);
      visited.delete(nx);
    }
  }
  const starts = [];
  if (from.room != null) {
    for (const h of ROOM_DOORS[from.room]) if (!blocked.has(h)) starts.push(h);
    for (const h of new Set(starts)) { visited.clear(); visited.add(h); dfs(h, steps - 1); }
  } else {
    visited.add(from.sq); dfs(from.sq, steps);
  }
  return { squares: [...squares], rooms: [...rooms].map(([room, s]) => ({ room, steps: s })) };
}

/** STEPS_TO_ROOM[room][square]: fewest steps from a hallway square into that room (no tokens counted). */
export const STEPS_TO_ROOM = Array.from({ length: 9 }, (_, r) => {
  const d = new Array(W * H).fill(Infinity);
  const q = [];
  for (const h of ROOM_DOORS[r]) if (d[h] !== 1) { d[h] = 1; q.push(h); }
  while (q.length) { const s = q.shift(); for (const nx of NEIGH[s]) if (d[nx] === Infinity) { d[nx] = d[s] + 1; q.push(nx); } }
  return d;
});
/** Fewest steps from one room to another (through the hallways, or 0-cost secret passage handled by callers). */
export const ROOM_TO_ROOM = Array.from({ length: 9 }, (_, a) => Array.from({ length: 9 }, (_, b) => {
  if (a === b) return 0;
  let best = Infinity;
  for (const h of ROOM_DOORS[a]) best = Math.min(best, 1 + STEPS_TO_ROOM[b][h]);
  return best;
}));

/** Fewest steps from a place to every room (ignoring other tokens). For computers' route planning. */
export function distancesFrom(from, blocked = new Set()) {
  const dist = new Map();
  const q = [];
  if (from.room != null) { for (const h of ROOM_DOORS[from.room]) if (!blocked.has(h)) { dist.set(h, 1); q.push(h); } }
  else { dist.set(from.sq, 0); q.push(from.sq); }
  const roomD = new Array(9).fill(Infinity);
  if (from.room != null) roomD[from.room] = 0;
  while (q.length) {
    const s = q.shift();
    const d = dist.get(s);
    if (DOOR_ROOMS[s]) for (const r of DOOR_ROOMS[s]) roomD[r] = Math.min(roomD[r], d + 1);
    for (const nx of NEIGH[s]) if (!dist.has(nx) && !blocked.has(nx)) { dist.set(nx, d + 1); q.push(nx); }
  }
  return { roomD, dist };
}
