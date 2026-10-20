// Exact solver vs brute force on small problems, plus speed on real-size ones.
import test from "node:test";
import assert from "node:assert/strict";
import { solve, propagate, rankSuggestions, CAT, NCARDS } from "../js/solver.js";

export function mulberry(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function randomDeal(n, rng) {
  const env = [Math.floor(rng() * 6), 6 + Math.floor(rng() * 6), 12 + Math.floor(rng() * 9)];
  const rest = []; for (let c = 0; c < NCARDS; c++) if (!env.includes(c)) rest.push(c);
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  const owner = new Array(NCARDS).fill(n); const sizes = new Array(n).fill(0);
  rest.forEach((c, i) => { owner[c] = i % n; sizes[i % n]++; });
  return { owner, sizes };
}
// facts a player could really have, generated from the true deal
function randomFacts(n, deal, rng, nHas) {
  const facts = [];
  const cards = [...Array(NCARDS).keys()];
  for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  for (const c of cards.slice(0, nHas)) if (deal.owner[c] < n) facts.push({ t: "has", p: deal.owner[c], c });
  for (let i = 0; i < 6; i++) {
    const p = Math.floor(rng() * n), c = Math.floor(rng() * NCARDS);
    if (deal.owner[c] !== p) facts.push({ t: "not", p, c });
  }
  for (let i = 0; i < 4; i++) {
    const tr = [Math.floor(rng() * 6), 6 + Math.floor(rng() * 6), 12 + Math.floor(rng() * 9)];
    const holders = tr.map((c) => deal.owner[c]).filter((o) => o < n);
    if (holders.length) facts.push({ t: "some", p: holders[0], cards: tr });
  }
  const tr = [Math.floor(rng() * 6), 6 + Math.floor(rng() * 6), 12 + Math.floor(rng() * 9)];
  if (!tr.every((c) => deal.owner[c] === n)) facts.push({ t: "notEnv", cards: tr });
  return facts;
}
function brute(n, sizes, facts) {
  const fixed = new Array(NCARDS).fill(-1);
  for (const f of facts) if (f.t === "has") fixed[f.c] = f.p;
  const owner = fixed.slice();
  const free = []; for (let c = 0; c < NCARDS; c++) if (fixed[c] < 0) free.push(c);
  const cnt = new Array(n + 1).fill(0);
  for (let c = 0; c < NCARDS; c++) if (owner[c] >= 0) cnt[owner[c]]++;
  const tally = Array.from({ length: NCARDS }, () => new Array(n + 1).fill(0));
  let total = 0;
  const cap = sizes.concat([3]);
  const ok = () => {
    const envCat = [0, 0, 0];
    for (let c = 0; c < NCARDS; c++) if (owner[c] === n) envCat[CAT(c)]++;
    if (envCat.some((x) => x !== 1)) return false;
    for (const f of facts) {
      if (f.t === "not" && owner[f.c] === f.p) return false;
      if (f.t === "some" && !f.cards.some((c) => owner[c] === f.p)) return false;
      if (f.t === "notEnv" && f.cards.every((c) => owner[c] === n)) return false;
    }
    return true;
  };
  const notSet = new Set(facts.filter((f) => f.t === "not").map((f) => f.p + ":" + f.c));
  const rec = (i) => {
    if (i === free.length) {
      if (!ok()) return;
      total++;
      for (let c = 0; c < NCARDS; c++) tally[c][owner[c]]++;
      return;
    }
    for (let o = 0; o <= n; o++) {
      if (cnt[o] >= cap[o] || notSet.has(o + ":" + free[i])) continue;
      owner[free[i]] = o; cnt[o]++;
      rec(i + 1);
      cnt[o]--; owner[free[i]] = -1;
    }
  };
  rec(0);
  return { total, prob: tally.map((r) => r.map((x) => x / total)) };
}

test("exact counts and probabilities match brute force (40 random small problems)", () => {
  const rng = mulberry(7);
  let checked = 0;
  for (let t = 0; t < 40; t++) {
    const n = 3 + Math.floor(rng() * 4);
    const deal = randomDeal(n, rng);
    const facts = randomFacts(n, deal, rng, 15);
    const b = brute(n, deal.sizes, facts);
    const s = solve(n, deal.sizes, facts);
    assert.ok(b.total > 0, "true deal is always consistent");
    assert.equal(s.total, b.total, "deal count");
    for (let c = 0; c < NCARDS; c++) for (let o = 0; o <= n; o++)
      assert.ok(Math.abs(s.prob[c][o] - b.prob[c][o]) < 1e-9, `card ${c} owner ${o}`);
    const envSum = s.env.reduce((a, e) => a + e.p, 0);
    assert.ok(Math.abs(envSum - 1) < 1e-9);
    checked++;
  }
  assert.equal(checked, 40);
});

test("no information: every suspect 1/6, weapon 1/6, room 1/9 in the envelope", () => {
  const s = solve(6, [3, 3, 3, 3, 3, 3], []);
  assert.ok(s.ok);
  // 324 envelopes x 18!/(3!^6) hands
  assert.equal(s.total, 324 * 137225088000);
  assert.ok(Math.abs(s.prob[0][6] - 1 / 6) < 1e-12);
  assert.ok(Math.abs(s.prob[8][6] - 1 / 6) < 1e-12);
  assert.ok(Math.abs(s.prob[15][6] - 1 / 9) < 1e-12);
});

test("hand-worked: my 6 cards + everyone else passed on a suggestion → envelope", () => {
  // 3 players, hands 6/6/6. I (p0) hold suspects 0..4 and weapon 6.
  const facts = [0, 1, 2, 3, 4, 6].map((c) => ({ t: "has", p: 0, c }));
  const s = solve(3, [6, 6, 6], facts);
  assert.equal(s.prob[5][3], 1, "only suspect left must be in the envelope");
  // p1 and p2 both have none of weapon 7 and room 12 → those are the envelope's
  const f2 = facts.concat([{ t: "not", p: 1, c: 7 }, { t: "not", p: 2, c: 7 }, { t: "not", p: 1, c: 12 }, { t: "not", p: 2, c: 12 }]);
  const s2 = solve(3, [6, 6, 6], f2);
  assert.equal(s2.prob[7][3], 1);
  assert.equal(s2.prob[12][3], 1);
  assert.equal(s2.env.length, 1);
  assert.deepEqual(s2.env[0].cards, [5, 7, 12]);
});

test("contradictions are reported, not crashed", () => {
  assert.equal(solve(3, [6, 6, 6], [{ t: "has", p: 0, c: 1 }, { t: "has", p: 1, c: 1 }]).ok, false);
  assert.equal(propagate(3, [6, 6, 6], [{ t: "some", p: 1, cards: [0, 6, 12] }, { t: "not", p: 1, c: 0 }, { t: "not", p: 1, c: 6 }, { t: "not", p: 1, c: 12 }]), null);
});

test("speed: real mid-game knowledge for 3..6 players solves fast", () => {
  const rng = mulberry(99);
  let worst = 0, estimated = 0, compared = 0;
  for (let t = 0; t < 60; t++) {
    const n = 3 + (t % 4);
    const deal = randomDeal(n, rng);
    // my own hand only + a handful of clues (the hard case: little is pinned down)
    const facts = [];
    for (let c = 0; c < NCARDS; c++) if (deal.owner[c] === 0) facts.push({ t: "has", p: 0, c });
    for (let i = 0; i < 8; i++) {
      const tr = [Math.floor(rng() * 6), 6 + Math.floor(rng() * 6), 12 + Math.floor(rng() * 9)];
      const h = tr.map((c) => deal.owner[c]).filter((o) => o > 0 && o < n);
      if (h.length) facts.push({ t: "some", p: h[0], cards: tr });
      for (let p = 1; p < n; p++) if (!tr.some((c) => deal.owner[c] === p) && rng() < 0.3) for (const c of tr) facts.push({ t: "not", p, c });
    }
    const t0 = performance.now();
    const s = solve(n, deal.sizes, facts, { budget: 4e5 });
    const ms = performance.now() - t0;
    worst = Math.max(worst, ms);
    assert.ok(s.ok, "true deal is consistent");
    if (!s.exact) estimated++;
    // the estimate (when used) must agree with the exact answer
    if (!s.exact && compared < 3) {
      const ex = solve(n, deal.sizes, facts, { budget: 1e9 });
      let maxErr = 0;
      for (let c = 0; c < NCARDS; c++) for (let o = 0; o <= n; o++) maxErr = Math.max(maxErr, Math.abs(ex.prob[c][o] - s.prob[c][o]));
      assert.ok(maxErr < 0.05, "estimate within 5 points, got " + maxErr);
      compared++;
    }
  }
  console.log("  worst solve ms:", worst.toFixed(1), "estimated:", estimated, "compared:", compared);
  assert.ok(worst < 3000, "worst " + worst);
});

test("best suggestion prefers cards that can teach us something", () => {
  // 3 players. I hold all suspects except 5, so asking about my own suspects teaches less.
  const facts = [0, 1, 2, 3, 4, 6].map((c) => ({ t: "has", p: 0, c }));
  const s = solve(3, [6, 6, 6], facts);
  const r = rankSuggestions(s, 0, [[0, 6, 12], [5, 7, 13]], mulberry(1), 800);
  assert.deepEqual(r[0].cards, [5, 7, 13]);
  assert.ok(r[1].bits < r[0].bits);
});
