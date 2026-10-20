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
