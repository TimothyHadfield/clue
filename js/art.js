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
/** A pawn: head + shoulders, in the suspect's colour. */
export function pawnShape(color, x = 0, y = 0, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-.36 .42 C-.36 .05 -.22 -.02 -.16 -.08 A.2 .2 0 1 1 .16 -.08 C.22 -.02 .36 .05 .36 .42 Z" fill="${color}" stroke="rgba(0,0,0,.55)" stroke-width=".07"/></g>`;
}
export function pawnSvg(sus, size = 28) {
  return `<svg viewBox="-.5 -.5 1 1" width="${size}" height="${size}">${pawnShape(SUSPECT_COLORS[sus], 0, 0.02, 1.05)}</svg>`;
}

const CAT_TINT = ["#3a1f2a", "#1f2c3a", "#24301f"];
const CAT_EDGE = ["#a35a6e", "#5a86b3", "#7fa35a"];
const CAT_WORD = ["SUSPECT", "WEAPON", "ROOM"];

/** Card face, 100 x 140 viewBox. */
export function cardSvg(ed, c) {
  const cat = c < 6 ? 0 : c < 12 ? 1 : 2;
  const name = cardName(ed, c);
  let art;
  if (cat === 0) {
    const col = SUSPECT_COLORS[c];
    art = `<circle cx="50" cy="58" r="30" fill="${col}" opacity=".18"/>
      <path d="M26 92c0-16 10-24 16-27a14 14 0 1 1 16 0c6 3 16 11 16 27z" fill="${col}" stroke="rgba(0,0,0,.5)" stroke-width="2"/>`;
  } else if (cat === 1) {
    art = `<circle cx="50" cy="58" r="30" fill="#5a86b3" opacity=".16"/><g transform="translate(26 34) scale(2)" fill="none" stroke="#dfe7f3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${WEAPON_ICON[c - 6]}</g>`;
  } else {
    art = `<circle cx="50" cy="58" r="30" fill="#7fa35a" opacity=".16"/><g transform="translate(26 34) scale(2)" fill="none" stroke="#e6efd9" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ROOM_ICON[c - 12]}</g>`;
  }
  const fs = name.length > 13 ? 10.5 : name.length > 10 ? 12 : 13.5;
  return `<svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="98" height="138" rx="9" fill="${CAT_TINT[cat]}" stroke="${CAT_EDGE[cat]}" stroke-width="2"/>
    <rect x="6" y="6" width="88" height="128" rx="6" fill="none" stroke="${CAT_EDGE[cat]}" stroke-opacity=".45"/>
    <text x="50" y="21" text-anchor="middle" font-size="9" font-weight="700" letter-spacing="2" fill="${CAT_EDGE[cat]}">${CAT_WORD[cat]}</text>
    ${art}
    <text x="50" y="117" text-anchor="middle" font-size="${fs}" font-weight="800" fill="#f1f2f6">${name}</text>
  </svg>`;
}
export function cardBackSvg() {
  return `<svg viewBox="0 0 100 140"><rect x="1" y="1" width="98" height="138" rx="9" fill="#232a3e" stroke="#3a4560" stroke-width="2"/>
    <g fill="none" stroke="#f0b354" stroke-width="3" opacity=".85"><circle cx="46" cy="64" r="16"/><path d="m58 76 14 14"/></g>
    <text x="46" y="70" text-anchor="middle" font-size="18" font-weight="800" fill="#f0b354">?</text></svg>`;
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
