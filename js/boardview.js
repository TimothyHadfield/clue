/* Draws the board as one SVG (1 unit = 1 square) and moves the pieces on it. */
import { W, H, cell, isHall, idx, rc, ROOM_LETTERS, DOOR_LIST, PASSAGE, NEIGH } from "./board.js";
import { SUSPECT_COLORS, EDITIONS } from "./cards.js";
import { WEAPON_ICON, ROOM_ICON, pawnShape } from "./art.js";

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

// each room's printed floor, drawn top-down like the real board (1 unit = 1 square)
const FLOOR_DEFS = `
  <pattern id="f0" width="1" height="1" patternUnits="userSpaceOnUse"><rect width="1" height="1" fill="#d9d6cc"/><path d="M0 0h.5v.5H0zM.5 .5h.5v.5H.5z" fill="#9fb0b6"/></pattern>
  <pattern id="f1" width="2" height="2" patternUnits="userSpaceOnUse"><rect width="2" height="2" fill="#b27a46"/><path d="M0 .33h1M0 .66h1M1.33 0v1M1.66 0v1M.33 1v1M.66 1v1M1 1.33h1M1 1.66h1M1 0v2M0 1h2" stroke="#7f5229" stroke-width=".035"/><path d="M0 0h1v1H0zM1 1h1v1H1z" fill="#fff" opacity=".05"/></pattern>
  <pattern id="f2" width=".75" height=".75" patternUnits="userSpaceOnUse"><rect width=".75" height=".75" fill="#c47a52"/><path d="M0 0h.75M0 0v.75" stroke="#8d4f33" stroke-width=".05"/></pattern>
  <pattern id="f3" width="3" height=".5" patternUnits="userSpaceOnUse"><rect width="3" height=".5" fill="#8b5a35"/><path d="M0 0h3M1.2 0v.5M2.6 0v.5" stroke="#5f3b20" stroke-width=".035"/></pattern>
  <pattern id="f4" width="3" height=".5" patternUnits="userSpaceOnUse"><rect width="3" height=".5" fill="#6e4c33"/><path d="M0 0h3M.7 0v.5M2.1 0v.5" stroke="#4a311f" stroke-width=".035"/></pattern>
  <pattern id="f5" width=".5" height=".5" patternUnits="userSpaceOnUse"><rect width=".5" height=".5" fill="#7b2f2f"/><circle cx=".25" cy=".25" r=".06" fill="#a5523f" opacity=".6"/></pattern>
  <pattern id="f6" width=".6" height=".6" patternUnits="userSpaceOnUse"><rect width=".6" height=".6" fill="#6d3b55"/><path d="M0 .3L.3 0 .6 .3 .3 .6z" fill="none" stroke="#8d5672" stroke-width=".04"/></pattern>
  <pattern id="f7" width="1.414" height="1.414" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.414" height="1.414" fill="#cfc8b8"/><path d="M0 0h.707v.707H0zM.707 .707h.707v.707H.707z" fill="#8f877a"/></pattern>
  <pattern id="f8" width="3" height=".5" patternUnits="userSpaceOnUse"><rect width="3" height=".5" fill="#5e3d26"/><path d="M0 0h3M1.6 0v.5" stroke="#3e2615" stroke-width=".035"/></pattern>`;

/** Simple furniture drawn on each room floor, kept low so pieces stand out on top. */
function furniture(k, R) {
  const x0 = R.c0, y0 = R.r0, w = R.c1 - R.c0 + 1, h = R.r1 - R.r0 + 1;
  const ink = 'stroke="#2a1d14" stroke-width=".06"';
  switch (k) {
    case 0: // kitchen: worktop down the left wall, range in the corner
      return `<rect x="${x0 + .15}" y="${y0 + 2.2}" width=".7" height="3" fill="#ece6d6" ${ink} opacity=".75"/><rect x="${x0 + w - 1.6}" y="${y0 + h - 1.2}" width="1.3" height=".8" rx=".1" fill="#3a3a3a" opacity=".6"/>`;
    case 1: // ballroom: a round rug
      return `<ellipse cx="${R.cx}" cy="${y0 + h - 2.6}" rx="2.9" ry="1.7" fill="none" stroke="#e9cf8f" stroke-width=".12" opacity=".55"/>`;
    case 2: // conservatory: potted plants
      return [[x0 + w - .6, y0 + h - .6], [x0 + .6, y0 + 1.6]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".42" fill="#3f7d3f" ${ink}/><circle cx="${x - .12}" cy="${y - .1}" r=".2" fill="#62a35a"/>`).join("");
    case 3: // dining room: long table
      return `<rect x="${x0 + 1.6}" y="${y0 + 2.4}" width="${w - 3.4}" height="2.2" rx=".2" fill="#5c3a1f" ${ink} opacity=".7"/>`;
    case 4: // billiard room: green table with pockets
      return `<rect x="${x0 + 1.1}" y="${y0 + 1.9}" width="${w - 2.2}" height="2.4" rx=".2" fill="#3a2414" opacity=".85"/><rect x="${x0 + 1.3}" y="${y0 + 2.1}" width="${w - 2.6}" height="2" rx=".1" fill="#2f7d4a"/>` +
        [[0, 0], [1, 0], [0, 1], [1, 1]].map(([a, b]) => `<circle cx="${x0 + 1.35 + a * (w - 2.7)}" cy="${y0 + 2.15 + b * 1.9}" r=".13" fill="#111"/>`).join("");
    case 5: // library: shelves along the bottom wall
      return `<rect x="${x0 + .9}" y="${y0 + h - .55}" width="${w - 1.6}" height=".42" fill="#3b2414"/>` + Array.from({ length: Math.floor((w - 1.8) / .3) }, (_, i) => `<rect x="${x0 + 1 + i * .3}" y="${y0 + h - .5}" width=".22" height=".3" fill="${["#9c3b30", "#2d5a7b", "#c9a24a", "#3f6b3a"][i % 4]}"/>`).join("");
    case 6: // lounge: rug
      return `<rect x="${x0 + 1}" y="${y0 + 2.3}" width="${w - 2.2}" height="${h - 2.8}" rx=".15" fill="none" stroke="#d8a7bd" stroke-width=".1" opacity=".5"/>`;
    case 7: // hall: runner carpet up to the doors
      return `<rect x="${R.cx - 1}" y="${y0 + 1.6}" width="2" height="${h - 1.6}" fill="#8a2a2a" opacity=".55"/>`;
    case 8: // study: desk
      return `<rect x="${x0 + 1.2}" y="${y0 + 1.6}" width="1.8" height=".9" rx=".1" fill="#3b2414" ${ink} opacity=".8"/>`;
  }
  return "";
}

export function boardSvg(edition) {
  const E = EDITIONS[edition] || EDITIONS.classic;
  const out = [];
  out.push(`<svg class="board" viewBox="-0.8 -0.7 ${W + 1.6} ${H + 1.7}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">`);
  // its shadow on the table and the cardboard edge (drawn, not filtered: an SVG filter repaints the whole board every frame)
  out.push(`<g fill="#000">${[0.75, 0.55, 0.38, 0.22].map((d, i) => `<rect x="${-0.6 - d * 0.25}" y="${-0.6 + d * 0.5}" width="${W + 1.2 + d * 0.5}" height="${H + 1.2 + d * 0.3}" rx="${0.35 + d}" opacity="${0.12 + i * 0.05}"/>`).join("")}</g><rect x="-0.6" y="-0.45" width="${W + 1.2}" height="${H + 1.2}" rx=".35" fill="#0b0f0b"/>`);
  out.push(`<defs><pattern id="tile" width="1" height="1" patternUnits="userSpaceOnUse"><rect width="1" height="1" fill="#b89a5c"/><rect x=".035" y=".035" width=".93" height=".93" fill="#ead69c"/></pattern>${FLOOR_DEFS}</defs>`);
  // the printed board: dark margin with a gold rule (the cardboard edge and shadow come from CSS)
  out.push(`<rect x="-0.6" y="-0.6" width="${W + 1.2}" height="${H + 1.2}" rx=".35" fill="#1f2a22"/><rect x="-0.32" y="-0.32" width="${W + 0.64}" height="${H + 0.64}" rx=".2" fill="none" stroke="#c9a85a" stroke-width=".05"/>`);
  // hallway
  let hall = "";
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (isHall(r, c)) hall += `M${c} ${r}h1v1h-1z`;
  out.push(`<path d="${hall}" fill="url(#tile)"/>`);
  // start squares
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const ch = cell(r, c);
    if (ch >= "1" && ch <= "6") out.push(`<rect x="${c + 0.06}" y="${r + 0.06}" width=".88" height=".88" rx=".08" fill="${SUSPECT_COLORS[+ch - 1]}" stroke="rgba(0,0,0,.45)" stroke-width=".05"/>`);
  }
  // rooms: printed floors + furniture
  ROOMS.forEach((R, k) => {
    let d = ""; for (const [r, c] of R.cells) d += `M${c} ${r}h1v1h-1z`;
    out.push(`<path d="${d}" fill="url(#f${k})"/><path d="${d}" fill="#000" opacity=".08"/>${furniture(k, R)}`);
  });
  // middle block
  let mid = ""; for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (cell(r, c) === "X") mid += `M${c} ${r}h1v1h-1z`;
  out.push(`<path d="${mid}" fill="#2a3a2e"/>`);
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
  out.push(`<path d="${walls}" stroke="#2b1d12" stroke-width=".2" stroke-linecap="square" fill="none"/><path d="${walls}" stroke="#7a5a3a" stroke-width=".06" stroke-linecap="square" fill="none"/>`);
  for (const m of doorMarks) {
    // an open door: the leaf swung out into the hallway, and a dotted swing arc
    const ox = m.dc * 0.8, oy = m.dr * 0.8;
    const ex = m.x2 + ox, ey = m.y2 + oy;
    out.push(`<path d="M${m.x2} ${m.y2}L${ex} ${ey}" stroke="#5a3d22" stroke-width=".08" stroke-linecap="round"/><path d="M${m.x1} ${m.y1}Q${m.x1 + ox} ${m.y1 + oy} ${ex} ${ey}" fill="none" stroke="#5a3d22" stroke-width=".035" stroke-dasharray=".09 .07" opacity=".8"/>`);
  }
  // middle: stairs going down, and the case-file envelope lying on them with a card peeking out
  const mc = []; for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (cell(r, c) === "X") mc.push([r, c]);
  if (mc.length) {
    const r0 = Math.min(...mc.map((x) => x[0])), r1 = Math.max(...mc.map((x) => x[0])) + 1, c0 = Math.min(...mc.map((x) => x[1])), c1 = Math.max(...mc.map((x) => x[1])) + 1;
    const cx = (c0 + c1) / 2, cy = (r0 + r1) / 2;
    const STEP = ["#5a4632", "#54412e", "#4e3c2a", "#483726", "#423222", "#3c2d1e", "#36281a", "#302316", "#2a1e12"];
    const sh = (r1 - r0 - 0.7) / 9;
    const steps = STEP.map((f, i) => `<rect x="${c0 + .35 + i * .1}" y="${r0 + .35 + i * sh}" width="${c1 - c0 - .7 - i * .2}" height="${sh - .05}" fill="${f}"/>`).join("");
    out.push(`<rect x="${c0 + .25}" y="${r0 + .25}" width="${c1 - c0 - .5}" height="${r1 - r0 - .5}" fill="#1a130d"/>${steps}
      <g class="envelope" transform="translate(${cx} ${cy}) rotate(-6)">
        <rect x="-1.57" y="-.95" width="3.3" height="2.1" rx=".08" fill="#000" opacity=".4"/>
        <g transform="rotate(-12)"><rect x="-1.35" y="-1.45" width="1.05" height="1.6" rx=".08" fill="#7a1f2b" stroke="#f3ead6" stroke-width=".06"/></g>
        <rect x="-1.65" y="-1.05" width="3.3" height="2.1" rx=".08" fill="#e3cf9a" stroke="#9c8250" stroke-width=".05"/>
        <path d="M-1.65 -1.05 0 .1 1.65 -1.05" fill="#d6bf86" stroke="#9c8250" stroke-width=".05"/>
        <circle cy=".1" r=".26" fill="#a3262e"/><circle cy=".1" r=".15" fill="none" stroke="#7a1a20" stroke-width=".04"/>
        <text y=".8" text-anchor="middle" font-size=".34" font-weight="700" letter-spacing=".05" fill="#7a1a20" font-family="Georgia, 'Times New Roman', serif">CASE FILE</text>
      </g>`);
  }
  // room names printed on the floor on a small plaque, and passages
  ROOMS.forEach((R, k) => {
    const name = E.rooms[k].toUpperCase();
    // as large as the room's widest row allows (tools/vis.mjs checks every name stays on its plaque)
    const fs = Math.min(0.74, (R.lw - 0.7) / (name.length * 0.76));
    const tw = Math.min(R.lw - 0.15, name.length * fs * 0.76 + 0.5);
    out.push(`<rect x="${R.lx - tw / 2}" y="${R.ly + 0.18}" width="${tw}" height="${fs + 0.42}" rx=".12" fill="#f3ead2" stroke="#2b1d12" stroke-width=".05" opacity=".94"/>`);
    out.push(`<text x="${R.lx}" y="${R.ly + 0.39 + fs * 0.8}" text-anchor="middle" font-size="${fs.toFixed(3)}" font-weight="700" letter-spacing=".03" fill="#2b1d12" font-family="Georgia, 'Times New Roman', serif">${name}</text>`);
    if (PASSAGE[k] >= 0) {
      // a little staircase in the room's outer corner
      const atTop = R.r0 < H / 2, atLeft = R.c0 < W / 2;
      const x = atLeft ? R.c0 + 0.15 : R.c1 + 0.15, y = atTop ? R.r1 + 0.15 : R.r0 + 0.15;
      out.push(`<g class="passage" data-room="${k}" transform="translate(${x} ${y})"><rect width=".7" height=".7" rx=".06" fill="#1a130d" stroke="#e9cf8f" stroke-width=".05"/><path d="M.08 .62h.18v-.16h.16v-.16h.16v-.16h.14" fill="none" stroke="#e9cf8f" stroke-width=".07"/></g>`);
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
  // soft floor shadow under each pawn so it stands off the cream hallway
  return `<g class="tok" data-s="${sus}"><ellipse cx=".07" cy=".36" rx=".36" ry=".13" fill="#000" opacity=".42"/>${pawnShape(SUSPECT_COLORS[sus], 0, -0.04, 1.05)}</g>`;
}
export function weaponPieceSvg(w) {
  // a pewter miniature lying on the floor: dark edge, metal body, a bright glint where the light hits
  // drawn as large as its square (0.92 of it), so it can be told apart on a phone
  const g = (st, sw, dx = 0) => `<g transform="translate(${-0.46 + dx} ${-0.46 + dx}) scale(.0383)" fill="none" stroke="${st}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${WEAPON_ICON[w]}</g>`;
  return `<g class="wep" data-w="${w}"><g opacity=".45">${g("#000", 4.6, 0.07)}</g>${g("#1b1e24", 4.2)}${g("#9aa2ad", 2.4)}${g("#f1f3f6", 0.8, -0.02)}</g>`;
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
