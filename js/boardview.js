/* Draws the board as one SVG (1 unit = 1 square) and moves the pieces on it. */
import { W, H, cell, isHall, idx, rc, ROOM_LETTERS, DOOR_LIST, PASSAGE, NEIGH } from "./board.js";
import { SUSPECT_COLORS, EDITIONS } from "./cards.js";
import { WEAPON_ICON, ROOM_ICON, pawnShape } from "./art.js";

const ROOM_FILL = ["#3b2f28", "#33283f", "#25382c", "#3f2b2b", "#24353b", "#3a3324", "#3d2834", "#2b3040", "#2f2b3d"];

// room geometry
export const ROOMS = Array.from({ length: 9 }, () => ({ cells: [], r0: H, r1: 0, c0: W, c1: 0 }));
for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
  const k = ROOM_LETTERS.indexOf(cell(r, c));
  if (k < 0) continue;
  const R = ROOMS[k];
  R.cells.push([r, c]);
  R.r0 = Math.min(R.r0, r); R.r1 = Math.max(R.r1, r); R.c0 = Math.min(R.c0, c); R.c1 = Math.max(R.c1, c);
}
for (const R of ROOMS) {
  R.cx = (R.c0 + R.c1 + 1) / 2; R.cy = (R.r0 + R.r1 + 1) / 2;
  // the name goes on the first row that is as wide as the room gets
  const rowsW = new Map();
  for (const [r, c] of R.cells) { const x = rowsW.get(r) || { a: 99, b: -1 }; x.a = Math.min(x.a, c); x.b = Math.max(x.b, c); rowsW.set(r, x); }
  let best = null;
  for (const [r, x] of [...rowsW].sort((a, b) => a[0] - b[0])) { const w = x.b - x.a + 1; if (!best || w > best.w) best = { r, w, cx: (x.a + x.b + 1) / 2 }; }
  R.lx = best.cx; R.ly = best.r; R.lw = best.w;
  // places to stand pieces: room squares below the name, nearest the middle first
  // (the bottom-middle squares are kept clear for the room's odds label)
  const slots = R.cells.filter(([r, c]) => (r >= R.ly + 2 || R.r1 - R.ly < 3) && !(r === R.r1 && Math.abs(c + 0.5 - R.cx) < 1.6)).map(([r, c]) => ({ x: c + 0.5, y: r + 0.5 }));
  const ty = R.ly + 2 + (R.r1 - R.ly - 1) / 2;
  slots.sort((a, b) => Math.hypot(a.x - R.cx, (a.y - ty) * 1.3) - Math.hypot(b.x - R.cx, (b.y - ty) * 1.3));
  R.slots = slots;
}
const doorSet = new Set(DOOR_LIST.map((d) => d.roomCell + ":" + d.hall));

export function boardSvg(edition) {
  const E = EDITIONS[edition] || EDITIONS.classic;
  const out = [];
  out.push(`<svg class="board" viewBox="-0.3 -0.3 ${W + 0.6} ${H + 0.6}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">`);
  out.push(`<defs><pattern id="tile" width="1" height="1" patternUnits="userSpaceOnUse"><rect width="1" height="1" fill="#c9b78e"/><rect x=".04" y=".04" width=".92" height=".92" fill="#d6c59c"/></pattern>
    <pattern id="floor" width="2" height="2" patternUnits="userSpaceOnUse"><rect width="2" height="2" fill="none"/><path d="M0 0h1v1H0zM1 1h1v1H1z" fill="#fff" opacity=".035"/></pattern></defs>`);
  out.push(`<rect x="-0.3" y="-0.3" width="${W + 0.6}" height="${H + 0.6}" rx=".5" fill="#151924"/>`);
  // hallway
  let hall = "";
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (isHall(r, c)) hall += `M${c} ${r}h1v1h-1z`;
  out.push(`<path d="${hall}" fill="url(#tile)"/>`);
  // start squares
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const ch = cell(r, c);
    if (ch >= "1" && ch <= "6") out.push(`<rect x="${c + 0.08}" y="${r + 0.08}" width=".84" height=".84" rx=".15" fill="${SUSPECT_COLORS[+ch - 1]}" opacity=".75"/>`);
  }
  // rooms
  ROOMS.forEach((R, k) => {
    let d = ""; for (const [r, c] of R.cells) d += `M${c} ${r}h1v1h-1z`;
    out.push(`<path d="${d}" fill="${ROOM_FILL[k]}"/><path d="${d}" fill="url(#floor)"/>`);
  });
  // middle
  let mid = ""; for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (cell(r, c) === "X") mid += `M${c} ${r}h1v1h-1z`;
  out.push(`<path d="${mid}" fill="#1e2433"/>`);
  // walls: an edge between a room square and anything else, except at a door
  let walls = "";
  const doorMarks = [];
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const k = ROOM_LETTERS.indexOf(cell(r, c));
    if (k < 0) continue;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = r + dr, nc = c + dc;
      if (ROOM_LETTERS.indexOf(cell(nr, nc)) === k) continue;
      const isDoor = doorSet.has(idx(r, c) + ":" + idx(nr, nc));
      let x1, y1, x2, y2;
      if (dr === -1) { x1 = c; y1 = r; x2 = c + 1; y2 = r; }
      if (dr === 1) { x1 = c; y1 = r + 1; x2 = c + 1; y2 = r + 1; }
      if (dc === -1) { x1 = c; y1 = r; x2 = c; y2 = r + 1; }
      if (dc === 1) { x1 = c + 1; y1 = r; x2 = c + 1; y2 = r + 1; }
      if (isDoor) doorMarks.push({ x1, y1, x2, y2, dr, dc });
      else walls += `M${x1} ${y1}L${x2} ${y2}`;
    }
  }
  out.push(`<path d="${walls}" stroke="#efe3c4" stroke-width=".11" stroke-linecap="square" fill="none"/>`);
  for (const m of doorMarks) {
    // an open door: a short swing line into the hallway
    const ox = m.dc * 0.5, oy = m.dr * 0.5;
    out.push(`<path d="M${m.x1} ${m.y1}L${m.x1 + ox} ${m.y1 + oy}" stroke="#f0b354" stroke-width=".1" stroke-linecap="round"/><path d="M${m.x1 + (m.x2 - m.x1) * 0.15} ${m.y1 + (m.y2 - m.y1) * 0.15}L${m.x2 - (m.x2 - m.x1) * 0.15} ${m.y2 - (m.y2 - m.y1) * 0.15}" stroke="#f0b354" stroke-width=".06" stroke-dasharray=".12 .1" opacity=".8"/>`);
  }
  // middle: the case file
  const mc = []; for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (cell(r, c) === "X") mc.push([r, c]);
  if (mc.length) {
    const r0 = Math.min(...mc.map((x) => x[0])), r1 = Math.max(...mc.map((x) => x[0])) + 1, c0 = Math.min(...mc.map((x) => x[1])), c1 = Math.max(...mc.map((x) => x[1])) + 1;
    const cx = (c0 + c1) / 2, cy = (r0 + r1) / 2;
    out.push(`<rect x="${c0 + .25}" y="${r0 + .25}" width="${c1 - c0 - .5}" height="${r1 - r0 - .5}" rx=".4" fill="none" stroke="#3a4560" stroke-width=".08"/>
      <g transform="translate(${cx} ${cy - .3})"><rect x="-1.5" y="-1" width="3" height="2" rx=".2" fill="#e9dcb8"/><path d="M-1.5 -1 0 .2 1.5 -1" fill="none" stroke="#a8946a" stroke-width=".1"/><circle r=".32" cy=".2" fill="#b33c3c"/></g>
      <text x="${cx}" y="${cy + 1.75}" text-anchor="middle" font-size=".62" font-weight="800" letter-spacing=".08" fill="#8e97ad">CASE FILE</text>`);
  }
  // room names, icons, passages
  ROOMS.forEach((R, k) => {
    const name = E.rooms[k].toUpperCase();
    const fs = Math.min(0.78, (R.lw - 0.7) / (name.length * 0.74));
    out.push(`<text x="${R.lx}" y="${R.ly + 0.95}" text-anchor="middle" font-size="${fs.toFixed(3)}" font-weight="800" letter-spacing=".04" fill="#efe3c4" opacity=".92">${name}</text>`);
    out.push(`<g transform="translate(${R.lx - 0.6} ${R.ly + 1.3}) scale(.05)" fill="none" stroke="#efe3c4" stroke-width="1.6" opacity=".35" stroke-linecap="round" stroke-linejoin="round">${ROOM_ICON[k]}</g>`);
    if (PASSAGE[k] >= 0) {
      // in the room's outer corner
      const atTop = R.r0 < H / 2, atLeft = R.c0 < W / 2;
      const x = atLeft ? R.c0 + 0.15 : R.c1 + 0.15, y = atTop ? R.r1 + 0.15 : R.r0 + 0.15;
      out.push(`<g class="passage" data-room="${k}" transform="translate(${x} ${y})"><rect width=".7" height=".7" rx=".1" fill="#0f1117" stroke="#f0b354" stroke-width=".06"/><path d="M.12 .58h.15v-.15h.15v-.15h.15v-.15h.1" fill="none" stroke="#f0b354" stroke-width=".07"/></g>`);
    }
  });
  // interactive + pieces layers
  out.push(`<g class="hits"></g><g class="reachL"></g><g class="weps"></g><g class="toks"></g></svg>`);
  return out.join("");
}

/** Hit areas for each room (clicked to walk in). */
export function roomHitPaths() {
  return ROOMS.map((R, k) => { let d = ""; for (const [r, c] of R.cells) d += `M${c} ${r}h1v1h-1z`; return `<path class="room-hit" data-room="${k}" d="${d}"/>`; }).join("");
}

/** Centre of a place for a given piece. */
export function placeXY(place, slotIndex) {
  if (place.sq != null) { const [r, c] = rc(place.sq); return { x: c + 0.5, y: r + 0.5 }; }
  const R = ROOMS[place.room];
  return R.slots[slotIndex % R.slots.length];
}

export function tokenSvg(sus) {
  return `<g class="tok" data-s="${sus}">${pawnShape(SUSPECT_COLORS[sus], 0, 0.02, 0.92)}</g>`;
}
export function weaponPieceSvg(w) {
  return `<g class="wep" data-w="${w}"><circle r=".42" fill="#0f1117" opacity=".75"/><g transform="translate(-.33 -.33) scale(.0275)" fill="none" stroke="#e8eaf0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${WEAPON_ICON[w]}</g></g>`;
}

/** Shortest hallway path between two places, for walking a token square by square. */
export function walkPath(from, to, blocked) {
  const startSet = [];
  if (from.sq != null) startSet.push(from.sq);
  else for (const d of DOOR_LIST) if (d.room === from.room && !blocked.has(d.hall)) startSet.push(d.hall);
  const goal = (s) => (to.sq != null ? s === to.sq : DOOR_LIST.some((d) => d.room === to.room && d.hall === s));
  const prev = new Map(); const q = [];
  for (const s of startSet) { prev.set(s, -1); q.push(s); }
  while (q.length) {
    const s = q.shift();
    if (goal(s)) { const p = []; let x = s; while (x !== -1) { p.unshift(x); x = prev.get(x); } return p; }
    for (const nx of NEIGH[s]) if (!prev.has(nx) && !blocked.has(nx)) { prev.set(nx, s); q.push(nx); }
  }
  return [];
}
