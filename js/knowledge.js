/* What one player knows, as solver facts.
 * Used three ways: the computers' brains, your own Play notepad, and the
 * real-table notepad. Same record shape everywhere:
 *   suggestion: { t:"suggest", by, cards:[s,w,r], passes:[seats], shower: seat|null, shown?: card }
 *     (shown is filled only when the viewer is the one who asked and saw it)
 *   accusation: { t:"accuse", by, cards, correct }
 */

export function factsFor(viewer, n, hand, records, extra = []) {
  const facts = [];
  const mine = new Set(hand);
  for (let c = 0; c < 21; c++) facts.push(mine.has(c) ? { t: "has", p: viewer, c } : { t: "not", p: viewer, c });
  for (const r of records) {
    if (r.t === "suggest") {
      for (const p of r.passes || []) for (const c of r.cards) if (p !== viewer) facts.push({ t: "not", p, c });
      if (r.shower != null && r.shower !== viewer) {
        if (r.shown != null) facts.push({ t: "has", p: r.shower, c: r.shown });
        else facts.push({ t: "some", p: r.shower, cards: r.cards.slice() });
      }
    } else if (r.t === "accuse" && !r.correct) {
      facts.push({ t: "notEnv", cards: r.cards.slice() });
    }
  }
  return facts.concat(extra);
}

/** Hand sizes when 18 cards are dealt one at a time starting with seat `first`. */
export function handSizes(n, first = 0) {
  const s = new Array(n).fill(0);
  for (let i = 0; i < 18; i++) s[(first + i) % n]++;
  return s;
}

/** Records with "shown" filled in from this seat's private notes. */
export function recordsFor(pub, mine) {
  const shown = new Map((mine.seen || []).filter((x) => x.i >= 0).map((x) => [x.i, x.card]));
  return pub.log.map((r, i) => (r.t === "suggest" && shown.has(i) ? Object.assign({}, r, { shown: shown.get(i) }) : r));
}

/**
 * What one seat knows, ready for the solver. Cards that are in no hand (the face-up leftovers, or the
 * 2-player room cards) form one extra pile, owner n; the case file is then owner n + 1.
 *   { n: owners for the solver, sizes, facts, pile: n or -1, players: pub.n }
 * Use toTable() on the solver's prob so the case file is always column pub.n (and the pile pub.n + 1).
 */
export function seatView(pub, mine, seat) {
  const n = pub.n, up = pub.faceUp || [], hid = pub.hiddenRooms || [];
  const facts = factsFor(seat, n, mine.hand, recordsFor(pub, mine));
  const pileSize = up.length + hid.length;
  if (!pileSize) return { n, sizes: pub.sizes, facts, pile: -1, players: n };
  for (const c of up) facts.push({ t: "has", p: n, c });
  for (const x of mine.seen || []) if (x.i < 0) facts.push({ t: "has", p: n, c: x.card });
  return { n: n + 1, sizes: pub.sizes.concat([pileSize]), facts, pile: n, players: n };
}

/** Solver columns [hands..., pile, file] → table columns [hands..., file, pile]. */
export function toTable(prob, pile) {
  if (pile == null || pile < 0) return prob;
  return prob.map((r) => r.slice(0, pile).concat([r[pile + 1], r[pile]]));
}
