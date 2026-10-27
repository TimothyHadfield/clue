/* Original SVG art: card faces, weapon and room icons, suspect pawns.
 * Drawn from scratch; nothing copied from any published edition. */

import { SUSPECT_COLORS, cardName } from "./cards.js";

// 24x24 icon paths (stroke drawings)
export const WEAPON_ICON = [
  // candlestick
  '<path d="M12 2.5c1.6 2 1.6 3.4 0 4.3-1.6-.9-1.6-2.3 0-4.3z" fill="#ffcf5a" stroke="none"/><rect x="10.3" y="7.5" width="3.4" height="6" rx=".6"/><path d="M8 13.5h8M12 13.5v5M8.5 21.5h7l-1.2-3h-4.6z"/>',
  // knife
  '<path d="M4 20l9.5-9.5 1.8 1.8L5.8 21.8z" /><path d="M13.5 10.5 19.5 3c1.3 3.2.4 6.6-2.5 9.2l-1.7 1.6"/>',
  // lead pipe
  '<path d="M5 19 17 7"/><path d="M4 21.2 2.8 20l2.8-2.8 1.2 1.2zM17.4 8.6l-2-2 2.8-2.8 2 2z"/><path d="M6.2 17.8 8 16M14 10l1.8-1.8" stroke-width="3.2"/>',
  // revolver
  '<path d="M3 8h15.5v3H11l-1 1.5H8.2L6.5 20H3.2l1.6-8.5H3z"/><circle cx="12.5" cy="12.6" r="1.9"/><path d="M18.5 8V6.6M10 14.8h2.6"/>',
  // rope
  '<path d="M11 10.5a1.6 1.6 0 1 1 3.2 0 3.6 3.6 0 1 1-7.2 0 5.6 5.6 0 1 1 11.2 0"/><path d="M18.2 10.5c0 4 .8 7.5 2.6 10.5M5.4 10.5c0 2.5-.6 4.8-2 6.8"/>',
  // wrench
  '<path d="M14.6 3.2a4.6 4.6 0 0 0-4.4 6.1L3.4 16.1a2 2 0 0 0 2.8 2.8L13 12.1a4.6 4.6 0 0 0 6.1-4.4l-2.7 2.7-2.6-.7-.7-2.6z"/>',
];
export const ROOM_ICON = [
  // kitchen: pot
  '<path d="M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M2 10h20M10 7h4M9 4c0 1 1 1 1 2M14 4c0 1 1 1 1 2"/>',
  // ballroom: chandelier
  '<path d="M12 2v5M5 10h14M5 10c0 3 3 4 7 4s7-1 7-4"/><path d="M5 10v-2M19 10v-2M12 14v3M9 21h6l-1-4h-4z"/>',
  // conservatory: plant
  '<path d="M7 15h10l-1.5 6h-7z"/><path d="M12 15V8M12 10c-3 0-5-2-5.5-5 3 0 5 2 5.5 5zM12 8c.5-3 2.5-5 5.5-5-.5 3-2.5 5-5.5 5z"/>',
  // dining room: plate + cutlery
  '<circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="2.6"/><path d="M3 4v6M4.5 4v16M3 10h3M6 4v6M20.5 4c-1.7 1-2 4-1 7h1v9"/>',
  // billiard room: ball + cue
  '<circle cx="9" cy="14" r="6"/><circle cx="9" cy="14" r="2.4"/><path d="M14 8 21 2"/>',
  // library: books
  '<path d="M4 20V5h3v15M7 20V3h3.5v17M10.5 20V6h3v14"/><path d="m14.5 7.5 3-.8 3.4 12.6-3 .8z"/><path d="M3 20.5h18"/>',
  // lounge: sofa
  '<path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"/><path d="M3 12a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v6H3z"/><path d="M5 18v2M19 18v2"/>',
  // hall: grandfather clock
  '<rect x="7" y="2" width="10" height="20" rx="1.5"/><circle cx="12" cy="8" r="3.2"/><path d="M12 8V6.3M12 8l1.3.8M10 14h4v5h-4z"/>',
  // study: desk lamp
  '<path d="M4 21h11M9 21v-5l-3-5 6-4"/><path d="m12 7 2.5-2.5 4.5 4.5L16.5 11.5z"/><path d="M17 12c1 1 1.2 2 .6 2.6"/>',
];

export function weaponSvg(w, size = 24, color = "currentColor") {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${WEAPON_ICON[w]}</svg>`;
}
export function roomSvg(r, size = 24, color = "currentColor") {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ROOM_ICON[r]}</svg>`;
}
/** A plastic pawn seen from the player's seat: round base, cone body, ball head, with a glossy highlight. */
export function pawnShape(color, x = 0, y = 0, s = 1) {
  const ink = "rgba(0,0,0,.6)";
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <ellipse cx="0" cy=".34" rx=".31" ry=".1" fill="${color}" stroke="${ink}" stroke-width=".045"/>
    <path d="M-.27 .34C-.22 .12-.13 .02-.09-.07h.18c.04 .09 .13 .19 .18 .41z" fill="${color}" stroke="${ink}" stroke-width=".045"/>
    <ellipse cx="0" cy="-.06" rx=".15" ry=".05" fill="${color}" stroke="${ink}" stroke-width=".04"/>
    <circle cy="-.22" r=".16" fill="${color}" stroke="${ink}" stroke-width=".045"/>
    <path d="M.27 .34C.22 .12 .13 .02 .09-.07h-.06c.05 .12 .1 .24 .12 .41z" fill="#000" opacity=".2"/>
    <path d="M-.2 .3C-.16 .14-.1 .05-.06-.04" stroke="#fff" stroke-width=".05" stroke-linecap="round" fill="none" opacity=".45"/>
    <circle cx="-.06" cy="-.28" r=".055" fill="#fff" opacity=".7"/>
  </g>`;
}
export function pawnSvg(sus, size = 28) {
  return `<svg viewBox="-.5 -.5 1 1" width="${size}" height="${size}">${pawnShape(SUSPECT_COLORS[sus], 0, 0.02, 1.05)}</svg>`;
}

// floor colour of each room on the board; the room cards use the same colour for their picture
export const ROOM_FLOOR = ["#d9d6cc", "#b27a46", "#c47a52", "#8b5a35", "#6e4c33", "#7b2f2f", "#6d3b55", "#cfc8b8", "#5e3d26"];
const CAT_INK = ["#7d2433", "#2c4a68", "#3f5a2a"];
// each suspect card's silhouette gets its own prop so the six read apart at a glance (our own drawings, no faces)
const INK = `fill="#1d1a17" stroke="#1d1a17" stroke-width="1.6" stroke-linejoin="round"`;
const LINE = `fill="none" stroke="#1d1a17" stroke-width="2.2" stroke-linecap="round"`;
const SUSPECT_PROP = [
  // a cloche hat with a long feather
  `<path d="M33 69q0-17 17-17t17 17q-17-5-34 0z" ${INK}/><path d="M30 70q20-4 40 0" ${LINE}/><path d="M63 57q11-8 15-23q-9 7-15 21z" fill="#f6efdc" stroke="#1d1a17" stroke-width="1.4"/><path d="M64 55q6-9 12-18" fill="none" stroke="#1d1a17" stroke-width="1"/>`,
  // a bowler hat and a moustache
  `<path d="M37 64q0-14 13-14t13 14z" ${INK}/><path d="M31 64.5h38" ${LINE}/><path d="M42 78q4-4 8-1q4-3 8 1q-4 3-8 1q-4 2-8-1z" ${INK}/>`,
  // a frilled cap and a string of pearls
  `<path d="M35 64q15-11 30 0q-3-6-6-6q-3-3-9-3t-9 3q-3 0-6 6z" fill="#d9d1bf" stroke="#1d1a17" stroke-width="1.6"/><path d="M36 63q14-7 28 0" fill="none" stroke="#1d1a17" stroke-width="1" stroke-dasharray="2 2"/>${[38, 42, 46, 50, 54, 58, 62].map((x, i) => `<circle cx="${x}" cy="${(88 + (3 - Math.abs(i - 3)) * 1.3).toFixed(1)}" r="2" fill="#f6efdc" stroke="#1d1a17" stroke-width=".9"/>`).join("")}`,
  // a top hat and a bow tie
  `<path d="M40 60V39h20v21z" ${INK}/><path d="M40 55h20" stroke="#f6efdc" stroke-width="2"/><path d="M33 60.5h34" ${LINE}/><path d="M41 86l9 5-9 5zM59 86l-9 5 9 5z" ${INK}/>`,
  // hair up in a bun, with a fan
  `<circle cx="50" cy="53" r="6.5" ${INK}/><path d="M35 70q0-13 15-14t15 14q-6-7-15-7t-15 7z" ${INK}/><path d="M64 112l14-22M64 112l17-17M64 112l18-11M64 112l10-25" stroke="#1d1a17" stroke-width="1.4"/><path d="M74 87q9 2 8 14l-18 11z" fill="#f6efdc" fill-opacity=".85" stroke="#1d1a17" stroke-width="1.4"/>`,
  // round spectacles and a scholar's scarf
  `<circle cx="44" cy="72" r="4.6" fill="#f6efdc" fill-opacity=".35" stroke="#1d1a17" stroke-width="2"/><circle cx="56" cy="72" r="4.6" fill="#f6efdc" fill-opacity=".35" stroke="#1d1a17" stroke-width="2"/><path d="M48.6 72h2.8" stroke="#1d1a17" stroke-width="2"/><path d="M38 86q12 7 24 0l-2 6q-10 5-20 0z" ${INK}/><path d="M55 90l4 20h-6z" ${INK}/>`,
];
const CAT_WORD = ["SUSPECT", "WEAPON", "ROOM"];

/** Card face, 100 x 156 viewBox (a real card's 57 x 89 shape): category word, a framed picture, the name below. */
export function cardSvg(ed, c) {
  const cat = c < 6 ? 0 : c < 12 ? 1 : 2;
  const name = cardName(ed, c);
  let panel, art;
  if (cat === 0) {
    const col = SUSPECT_COLORS[c];
    panel = `<rect x="7" y="22" width="86" height="94" rx="3" fill="${col}"/><ellipse cx="50" cy="50" rx="40" ry="26" fill="#fff" opacity=".1"/>`;
    art = `<ellipse cx="50" cy="69" rx="30" ry="34" fill="#f6efdc" opacity=".22"/>
      <path d="M20 116c0-20 12-29 19-32a16 16 0 1 1 22 0c7 3 19 12 19 32z" fill="${col}" stroke="#1d1a17" stroke-width="2.2"/>
      <path d="M40 84l10 12 10-12" fill="none" stroke="#1d1a17" stroke-width="2"/>
      ${SUSPECT_PROP[c]}`;
  } else if (cat === 1) {
    panel = `<rect x="7" y="22" width="86" height="94" rx="3" fill="#2f3b4c"/><ellipse cx="50" cy="50" rx="40" ry="26" fill="#fff" opacity=".1"/>`;
    art = `<g transform="translate(22 41) scale(2.35)" fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="#111722" stroke-width="3.4">${WEAPON_ICON[c - 6]}</g><g stroke="#d4d9e0" stroke-width="1.6">${WEAPON_ICON[c - 6]}</g></g>`;
  } else {
    panel = `<rect x="7" y="22" width="86" height="94" rx="3" fill="${ROOM_FLOOR[c - 12]}"/><ellipse cx="50" cy="50" rx="40" ry="26" fill="#fff" opacity=".1"/>`;
    art = `<g transform="translate(22 41) scale(2.35)" fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="#1d1a17" stroke-width="3.2" opacity=".55">${ROOM_ICON[c - 12]}</g><g stroke="#fbf3df" stroke-width="1.6">${ROOM_ICON[c - 12]}</g></g>`;
  }
  // long names go on two lines so the letters stay big enough to read on a small hand card
  let lines = [name];
  if (name.length > 10 && name.includes(" ")) {
    const sp = [...name].map((ch, i) => (ch === " " ? i : -1)).filter((i) => i > 0);
    const cut = sp.reduce((a, b) => (Math.abs(b - name.length / 2) < Math.abs(a - name.length / 2) ? b : a));
    lines = [name.slice(0, cut), name.slice(cut + 1)];
  }
  const longest = Math.max(...lines.map((l) => l.length));
  const fs = Math.min(17, 84 / (longest * 0.6)).toFixed(1);
  const font = `font-family="Georgia, 'Times New Roman', serif" font-weight="700" fill="#1d1a17" text-anchor="middle"`;
  const text = lines.length === 1
    ? `<text x="50" y="${140 + fs * 0.35}" font-size="${fs}" ${font}>${name}</text>`
    : `<text x="50" y="${137 - fs * 0.2}" font-size="${fs}" ${font}><tspan x="50">${lines[0]}</tspan><tspan x="50" dy="${(fs * 1.05).toFixed(1)}">${lines[1]}</tspan></text>`;
  return `<svg viewBox="0 0 100 156" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="100" height="156" rx="7" fill="#fbf7ec"/>
    <text x="50" y="16" text-anchor="middle" font-size="9" font-weight="800" letter-spacing="2" fill="${CAT_INK[cat]}" font-family="Georgia, 'Times New Roman', serif">${CAT_WORD[cat]}</text>
    ${panel}${art}
    <rect x="7" y="22" width="86" height="94" rx="3" fill="none" stroke="#1d1a17" stroke-opacity=".55" stroke-width="1.2"/>
    ${lines.length === 1 ? `<path d="M12 124h76" stroke="${CAT_INK[cat]}" stroke-opacity=".5" stroke-width="1"/>` : ""}
    ${text}
  </svg>`;
}
/** The back every card shares: a printed lattice with a magnifier and question mark (CSS draws it: .clue-back). */
export function cardBackHtml(cls = "") {
  return `<i class="clue-back ${cls}"></i>`;
}

/** Dice face pips. */
export function dieHtml(v) {
  const P = { 1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[25, 25], [50, 50], [75, 75]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]], 6: [[28, 22], [72, 22], [28, 50], [72, 50], [28, 78], [72, 78]] };
  return `<span class="die">${P[v].map(([x, y]) => `<b style="left:calc(${x}% - 2.5px);top:calc(${y}% - 2.5px)"></b>`).join("")}</span>`;
}

/** Title logo for the setup screen: a magnifying glass over a floor plan. */
export function logoSvg() {
  return `<svg viewBox="0 0 240 80" xmlns="http://www.w3.org/2000/svg">
    <g stroke="#3a4560" stroke-width="2" fill="#1a1e2b"><rect x="8" y="8" width="70" height="64" rx="4"/><path d="M8 34h28V8M50 8v26h28M8 52h22v20M54 72V52h24"/></g>
    <g fill="none" stroke="#f0b354" stroke-width="5"><circle cx="54" cy="38" r="17"/><path d="m66 50 14 14" stroke-linecap="round"/></g>
    <text x="96" y="55" font-size="44" font-weight="900" letter-spacing="4" fill="#e8eaf0" font-family="Georgia, 'Times New Roman', serif">CLUE</text>
  </svg>`;
}
