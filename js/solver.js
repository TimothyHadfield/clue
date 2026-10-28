/* ============================================================================
 * solver.js — exact Clue deduction.
 *
 * Counts EVERY deal (envelope + all hands) consistent with what one player
 * has seen, and turns the counts into probabilities: for each card, the chance
 * it is in the envelope or in each player's hand. No guessing, no sampling:
 * cards that are interchangeable (same category, same possible owners, same
 * clues) are grouped, so the count is done with binomials instead of listing
 * billions of deals one by one.
 *
 * Knowledge is a list of facts from ONE viewer's point of view:
 *   { t: "has",  p, c }            player p holds card c
 *   { t: "not",  p, c }            player p does not hold card c
 *   { t: "some", p, cards: [..] }  p holds at least one of these (showed one we didn't see)
 *   { t: "notEnv", cards: [s,w,r] } the envelope is not exactly this (a wrong accusation)
 * plus handSizes[p] for every player. Owners 0..n-1 are players, owner n = envelope.
 * ==========================================================================*/

export const NCARDS = 21;
export const CAT = (c) => (c < 6 ? 0 : c < 12 ? 1 : 2);   // 0 suspect, 1 weapon, 2 room
export const CAT_CARDS = [[0, 1, 2, 3, 4, 5], [6, 7, 8, 9, 10, 11], [12, 13, 14, 15, 16, 17, 18, 19, 20]];

const binomTable = [];
for (let n = 0; n <= 21; n++) {
  binomTable[n] = [];
  for (let k = 0; k <= n; k++) binomTable[n][k] = k === 0 || k === n ? 1 : binomTable[n - 1][k - 1] + binomTable[n - 1][k];
}
const C = (n, k) => (k < 0 || k > n ? 0 : binomTable[n][k]);
const bit = (o) => 1 << o;
const popcount = (x) => { let c = 0; while (x) { x &= x - 1; c++; } return c; };
const lowBit = (x) => 31 - Math.clz32(x & -x);

/**
 * Turn facts into per-card "possible owners" masks and simplified clauses,
 * propagating the certain deductions (the ✓/✗ a careful player would write).
 * Returns null if the facts contradict each other.
 */
export function propagate(n, handSizes, facts) {
  const ENV = n, ALL = (1 << (n + 1)) - 1;
  const allowed = new Array(NCARDS).fill(ALL);
  for (let p = 0; p < n; p++) if (!(handSizes[p] > 0)) for (let c = 0; c < NCARDS; c++) allowed[c] &= ~bit(p);
  let clauses = [];
  const notEnv = [];
  for (const f of facts) {
    if (f.t === "has") allowed[f.c] &= bit(f.p);
    else if (f.t === "not") allowed[f.c] &= ~bit(f.p);
    else if (f.t === "some") clauses.push({ p: f.p, cards: [...new Set(f.cards)] });
    else if (f.t === "notEnv") notEnv.push([...f.cards]);
  }
  const sizes = handSizes.slice(0, n).concat([3]);
  let changed = true, guard = 0;
  while (changed && guard++ < 200) {
    changed = false;
    for (let c = 0; c < NCARDS; c++) if (!allowed[c]) return null;
    // clauses
    const next = [];
    for (const cl of clauses) {
      if (cl.cards.some((c) => allowed[c] === bit(cl.p))) { changed = true; continue; } // satisfied
      const live = cl.cards.filter((c) => allowed[c] & bit(cl.p));
      if (live.length === 0) return null;
      if (live.length === 1) { allowed[live[0]] = bit(cl.p); changed = true; continue; }
      if (live.length !== cl.cards.length) changed = true;
      next.push({ p: cl.p, cards: live });
    }
    clauses = next;
    // hand sizes (players) and one-per-category (envelope)
    for (let o = 0; o <= n; o++) {
      const groups = o === ENV ? CAT_CARDS : [Array.from({ length: NCARDS }, (_, i) => i)];
      for (const cards of groups) {
        const need = o === ENV ? 1 : sizes[o];
        let known = 0, possible = 0;
        for (const c of cards) { if (allowed[c] === bit(o)) known++; if (allowed[c] & bit(o)) possible++; }
        if (known > need || possible < need) return null;
        if (known === need && possible > known) {
          for (const c of cards) if (allowed[c] !== bit(o) && (allowed[c] & bit(o))) { allowed[c] &= ~bit(o); changed = true; }
        } else if (possible === need && known < need) {
          for (const c of cards) if (allowed[c] & bit(o) && allowed[c] !== bit(o)) { allowed[c] = bit(o); changed = true; }
        }
      }
    }
    // a wrong accusation whose other two cards are certainly in the envelope
    for (const tr of notEnv) {
      const notIn = tr.filter((c) => allowed[c] !== bit(ENV));
      if (notIn.length === 0) return null;
      if (notIn.length === 1 && (allowed[notIn[0]] & bit(ENV))) { allowed[notIn[0]] &= ~bit(ENV); changed = true; }
    }
  }
  return { allowed, clauses, notEnv, sizes };
}

/** Build the grouped counting problem. */
function buildProblem(n, handSizes, facts) {
  const pr = propagate(n, handSizes, facts);
  if (!pr) return null;
  const { allowed, clauses, notEnv, sizes } = pr;
  const ENV = n;
  const cap = sizes.slice();
  const envNeed = [1, 1, 1];
  const undet = [];
  for (let c = 0; c < NCARDS; c++) {
    if (popcount(allowed[c]) === 1) {
      const o = lowBit(allowed[c]);
      if (o === ENV) envNeed[CAT(c)] = 0; else cap[o]--;
    } else undet.push(c);
  }
  // accusation tags on undetermined cards; triples with a card surely not in the envelope vanish
  const tags = [];
  const liveTriples = [];
  for (const tr of notEnv) {
    if (tr.some((c) => !(allowed[c] & bit(ENV)))) continue;
    const und = tr.filter((c) => allowed[c] !== bit(ENV));
    if (!und.length) return null;
    liveTriples.push(und);
  }
  // signature for grouping
  const sig = new Map();
  const groups = [];
  const groupOf = new Array(NCARDS).fill(-1);
  for (const c of undet) {
    const cl = []; clauses.forEach((x, i) => { if (x.cards.includes(c)) cl.push(i); });
    const tg = []; liveTriples.forEach((x, i) => { if (x.includes(c)) tg.push(i); });
    const key = CAT(c) + "|" + allowed[c] + "|" + cl.join(",") + "|" + tg.join(",");
    let g = sig.get(key);
    if (g === undefined) { g = groups.length; sig.set(key, g); groups.push({ cat: CAT(c), allowed: allowed[c], clauses: cl, tags: tg, cards: [] }); }
    groups[g].cards.push(c);
    groupOf[c] = g;
  }
  return { n, ENV, allowed, clauses, liveTriples, cap, envNeed, groups, groupOf };
}

/**
 * Exact solve. Returns
 *   { ok, total, prob[c][o], env: [{cards:[s,w,r], p}], allowed, certain }
 * prob[c][o] = chance card c is with owner o (o = n is the envelope).
 */
export function solve(n, handSizes, facts, opts = {}) {
  const P = buildProblem(n, handSizes, facts);
  if (!P) return { ok: false, total: 0 };
  const { ENV, groups, cap, envNeed, clauses, liveTriples } = P;
  const G = groups.length;
  // envelope first, then the most tightly constrained players (fewest choices), the loosest last (forced)
  const freedom = (o) => { let a = 0; for (const g of groups) if (g.allowed & bit(o)) a += g.cards.length; return C(a, cap[o]); };
  const order = [ENV].concat([...Array(n).keys()].sort((a, b) => freedom(a) - freedom(b)));
  const L = order.length;
  const lastLevel = groups.map((g) => { let last = -1; order.forEach((o, l) => { if (g.allowed & bit(o)) last = l; }); return last; });
  const memo = order.map(() => new Map());
  let states = 0, work = 0;
  const budget = opts.budget || 600000;    // transitions (~1 µs each); past this we estimate instead

  // remaining-cards vector packed into one number (mixed radix) for fast memo keys
  const size = groups.map((g) => g.cards.length);
  const radix = []; { let r = 1; for (let g = 0; g < G; g++) { radix[g] = r; r *= size[g] + 1; } }
  const decode = (key, out) => { for (let g = 0; g < G; g++) out[g] = Math.floor(key / radix[g]) % (size[g] + 1); return out; };
  // per owner: which of its clauses each group satisfies (bitmask, or list when > 30 clauses)
  const ownerCl = order.map((o) => clauses.map((x, i) => (x.p === o ? i : -1)).filter((i) => i >= 0));
  const big = ownerCl.some((a) => a.length > 30);
  const gMask = order.map((o, l) => groups.map((g) => {
    let m = 0; if (!big) ownerCl[l].forEach((ci, b) => { if (g.clauses.includes(ci)) m |= 1 << b; }); return m;
  }));
  const fullMask = ownerCl.map((a) => (big ? 0 : a.length === 31 ? -1 : (1 << a.length) - 1));
  const cats = [0, 1, 2].filter((c) => envNeed[c]);
  const tripleGroups = liveTriples.map((t) => t.map((c) => P.groupOf[c]));
  const scratch = order.map(() => new Array(G).fill(0));

  // enumerate choices for level l from packed key: cb(childKey, weight, k)
  function choices(l, key, cb) {
    const o = order[l];
    const rem = decode(key, scratch[l]);
    const k = new Array(G).fill(0);
    if (o === ENV) {
      const rec = (ci, w, ck) => {
        if (ci === cats.length) {
          for (let g = 0; g < G; g++) if (lastLevel[g] === l && rem[g] !== k[g]) return;
          for (const t of tripleGroups) if (t.every((g) => k[g] === 1)) return;
          cb(ck, w, k); return;
        }
        for (let g = 0; g < G; g++) {
          if (groups[g].cat !== cats[ci] || !(groups[g].allowed & bit(ENV)) || rem[g] < 1) continue;
          k[g] = 1; rec(ci + 1, w * rem[g], ck - radix[g]); k[g] = 0;
        }
      };
      rec(0, 1, key);
      return;
    }
    const need = cap[o];
    const cand = [];
    let forcedSum = 0, ck0 = key, m0 = 0, w0 = 1;
    for (let g = 0; g < G; g++) {
      if (!(groups[g].allowed & bit(o)) || rem[g] === 0) continue;
      if (lastLevel[g] === l) { k[g] = rem[g]; forcedSum += rem[g]; ck0 -= rem[g] * radix[g]; m0 |= gMask[l][g]; }
      else cand.push(g);
    }
    if (forcedSum > need) return;
    const gm = gMask[l], full = fullMask[l];
    const slowCheck = () => ownerCl[l].every((ci) => { for (let g = 0; g < G; g++) if (k[g] > 0 && groups[g].clauses.includes(ci)) return true; return false; });
    const suffix = new Array(cand.length + 1).fill(0);
    for (let i = cand.length - 1; i >= 0; i--) suffix[i] = suffix[i + 1] + rem[cand[i]];
    const rec = (i, left, w, ck, m) => {
      if (left === 0) {
        if (big ? !slowCheck() : (m & full) !== full) return;
        cb(ck, w, k); return;
      }
      if (suffix[i] < left) return;
      const g = cand[i];
      const r = rem[g];
      const max = r < left ? r : left;
      for (let x = max; x >= 0; x--) {
        k[g] = x;
        rec(i + 1, left - x, w * C(r, x), ck - x * radix[g], x ? m | gm[g] : m);
      }
      k[g] = 0;
    };
    rec(0, need - forcedSum, w0, ck0, m0);
  }

  function count(l, key) {
    if (l === L) return key === 0 ? 1 : 0;
    const m = memo[l].get(key);
    if (m !== undefined) return m;
    states++;
    let total = 0;
    choices(l, key, (ck, w) => { if (++work > budget) throw new Error("budget"); const c = count(l + 1, ck); if (c) total += w * c; });
    memo[l].set(key, total);
    return total;
  }

  let key0 = 0; for (let g = 0; g < G; g++) key0 += size[g] * radix[g];
  let total;
  try { total = count(0, key0); } catch (e) {
    if (e.message !== "budget") throw e;
    return estimate(n, handSizes, facts, opts);
  }
  if (!total) return { ok: false, total: 0 };

  // top-down: expected number of each group's cards with each owner
  const expK = order.map(() => new Array(G).fill(0));
  const envJoint = [];
  let level = new Map([[key0, 1]]);
  for (let l = 0; l < L; l++) {
    const next = new Map();
    for (const [key, mass] of level) {
      const here = count(l, key);
      choices(l, key, (ck, w, k) => {
        const c = count(l + 1, ck);
        if (!c) return;
        const pm = (mass * w * c) / here;
        for (let g = 0; g < G; g++) if (k[g]) expK[l][g] += pm * k[g];
        if (l === 0) envJoint.push({ groups: k.map((x, g) => (x ? g : -1)).filter((g) => g >= 0), p: pm });
        next.set(ck, (next.get(ck) || 0) + pm);
      });
    }
    level = next;
  }

  const prob = Array.from({ length: NCARDS }, () => new Array(n + 1).fill(0));
  for (let c = 0; c < NCARDS; c++) {
    const g = P.groupOf[c];
    if (g < 0) { prob[c][lowBit(P.allowed[c])] = 1; continue; }
    order.forEach((o, l) => { prob[c][o] = expK[l][g] / groups[g].cards.length; });
  }
  // envelope as specific triples
  const fixedEnv = [0, 1, 2].map((cat) => CAT_CARDS[cat].find((c) => P.allowed[c] === bit(ENV)));
  const env = [];
  for (const j of envJoint) {
    const perCat = [0, 1, 2].map((cat) => {
      if (fixedEnv[cat] !== undefined) return [fixedEnv[cat]];
      const g = j.groups.find((g) => groups[g].cat === cat);
      return groups[g].cards;
    });
    const each = j.p / (perCat[0].length * perCat[1].length * perCat[2].length);
    for (const s of perCat[0]) for (const w of perCat[1]) for (const r of perCat[2]) env.push({ cards: [s, w, r], p: each });
  }
  env.sort((a, b) => b.p - a.p);

  // exact sampler of complete deals (for "best next suggestion")
  function sample(rng) {
    const owner = new Array(NCARDS).fill(-1);
    for (let c = 0; c < NCARDS; c++) if (P.groupOf[c] < 0) owner[c] = lowBit(P.allowed[c]);
    let key = key0;
    const pools = groups.map((g) => g.cards.slice());
    for (let l = 0; l < L; l++) {
      const here = count(l, key);
      let x = rng() * here, pick = null, pickKey = 0, last = null, lastKey = 0;
      choices(l, key, (ck, w, k) => {
        if (pick) return;
        const c = count(l + 1, ck);
        if (!c) return;
        last = k.slice(); lastKey = ck;
        x -= w * c;
        if (x <= 0) { pick = last; pickKey = ck; }
      });
      if (!pick) { pick = last; pickKey = lastKey; } // float edge
      for (let g = 0; g < G; g++) for (let i = 0; i < pick[g]; i++) {
        const j = Math.floor(rng() * pools[g].length);
        owner[pools[g][j]] = order[l];
        pools[g].splice(j, 1);
      }
      key = pickKey;
    }
    return owner;
  }

  return { ok: true, exact: true, total, prob, env, allowed: P.allowed, states, work, sample, n };
}

/** Shannon entropy (bits) of the envelope distribution. */
export function envEntropy(env) {
  let h = 0; for (const e of env) if (e.p > 0) h -= e.p * Math.log2(e.p);
  return h;
}

/**
 * Who would answer a suggestion in a given deal: the first player clockwise
 * from the suggester holding any of the three cards. Returns {p, held:[cards]} or null.
 */
export function answerer(owner, n, suggester, cards) {
  for (let i = 1; i < n; i++) {
    const p = (suggester + i) % n;
    const held = cards.filter((c) => owner[c] === p);
    if (held.length) return { p, held };
  }
  return null;
}

/**
 * Expected information (bits about the envelope) the SUGGESTER gains from each
 * candidate suggestion, estimated over exact samples of the posterior.
 * candidates: [[s,w,r], ...]. Returns [{cards, bits}] best first.
 */
export function rankSuggestions(sol, me, candidates, rng, nSamples = 600) {
  const n = sol.n, players = sol.players || n;
  const samples = [];
  for (let i = 0; i < nSamples; i++) samples.push(sol.sample(rng));
  const envKey = (o) => {
    const k = [];
    for (let c = 0; c < NCARDS; c++) if (o[c] === n) k.push(c);
    return k.join(",");
  };
  const keys = samples.map(envKey);
  const H = (m, tot) => { let h = 0; for (const v of m.values()) { const p = v / tot; h -= p * Math.log2(p); } return h; };
  const prior = new Map(); for (const k of keys) prior.set(k, (prior.get(k) || 0) + 1);
  const H0 = H(prior, samples.length);
  const out = [];
  for (const cards of candidates) {
    const byOutcome = new Map();
    samples.forEach((o, i) => {
      const a = answerer(o, players, me, cards);   // a pile of cards on the table (owner n - 1) never answers
      if (!a) { add("none", keys[i], 1); return; }
      // the answerer picks one of the held cards; assume each equally likely
      for (const c of a.held) add(a.p + ":" + c, keys[i], 1 / a.held.length);
    });
    function add(oc, k, w) {
      let m = byOutcome.get(oc); if (!m) { m = { tot: 0, env: new Map() }; byOutcome.set(oc, m); }
      m.tot += w; m.env.set(k, (m.env.get(k) || 0) + w);
    }
    let cond = 0;
    for (const m of byOutcome.values()) cond += (m.tot / samples.length) * H(m.env, m.tot);
    out.push({ cards, bits: Math.max(0, H0 - cond) });
  }
  out.sort((a, b) => b.bits - a.bits);
  return out;
}

/**
 * Fallback when the exact count would take too long: a Markov chain that walks
 * between consistent deals by swapping two cards. Every consistent deal is
 * equally likely in the long run, so the tallies estimate the same numbers.
 */
export function estimate(n, handSizes, facts, opts = {}) {
  const pr = propagate(n, handSizes, facts);
  if (!pr) return { ok: false, total: 0 };
  const { allowed, clauses, notEnv } = pr;
  const ENV = n;
  const rng = opts.rng || mulberry32(12345);
  const sizes = pr.sizes;
  // start: a deal that respects "possible owners" and sizes (greedy, most constrained first)
  let owner = null;
  for (let attempt = 0; attempt < 200 && !owner; attempt++) owner = greedyDeal(n, allowed, sizes, rng);
  if (!owner) return { ok: false, total: 0 };
  const viol = (o) => {
    let v = 0;
    for (const cl of clauses) if (!cl.cards.some((c) => o[c] === cl.p)) v++;
    for (const t of notEnv) if (t.every((c) => o[c] === ENV)) v++;
    return v;
  };
  const cards = [...Array(NCARDS).keys()].filter((c) => popcount(allowed[c]) > 1);
  const trySwap = (o) => {
    const a = cards[Math.floor(rng() * cards.length)], b = cards[Math.floor(rng() * cards.length)];
    const oa = o[a], ob = o[b];
    if (oa === ob) return null;
    if ((oa === ENV || ob === ENV) && CAT(a) !== CAT(b)) return null;
    if (!(allowed[a] & bit(ob)) || !(allowed[b] & bit(oa))) return null;
    return [a, b];
  };
  // anneal to a fully consistent deal
  let v = viol(owner);
  for (let i = 0; i < 200000 && v > 0; i++) {
    const s = trySwap(owner); if (!s) continue;
    const [a, b] = s; [owner[a], owner[b]] = [owner[b], owner[a]];
    const v2 = viol(owner);
    if (v2 <= v || rng() < 0.05) v = v2; else [owner[a], owner[b]] = [owner[b], owner[a]];
  }
  if (v > 0) return { ok: false, total: 0 };
  const N = opts.samples || 4000, thin = opts.thin || 45;
  const tally = Array.from({ length: NCARDS }, () => new Array(n + 1).fill(0));
  const envT = new Map();
  const draws = [];
  for (let i = 0; i < N * thin + 2000; i++) {
    const s = trySwap(owner);
    if (s) {
      const [a, b] = s; [owner[a], owner[b]] = [owner[b], owner[a]];
      if (viol(owner) > 0) [owner[a], owner[b]] = [owner[b], owner[a]];
    }
    if (i >= 2000 && i % thin === 0) {
      for (let c = 0; c < NCARDS; c++) tally[c][owner[c]]++;
      const k = []; for (let c = 0; c < NCARDS; c++) if (owner[c] === ENV) k.push(c);
      const key = k.join(","); envT.set(key, (envT.get(key) || 0) + 1);
      if (draws.length < 1500) draws.push(owner.slice());
    }
  }
  const total = N;
  const prob = tally.map((r) => r.map((x) => x / total));
  const env = [...envT].map(([k, c]) => ({ cards: k.split(",").map(Number), p: c / total })).sort((a, b) => b.p - a.p);
  let di = 0;
  return { ok: true, exact: false, total: -1, prob, env, allowed, n, sample: () => draws[(di++) % draws.length].slice() };
}

function greedyDeal(n, allowed, sizes, rng) {
  const ENV = n;
  const owner = new Array(NCARDS).fill(-1);
  const left = sizes.slice();
  const envCat = [0, 0, 0];
  const order = [...Array(NCARDS).keys()].sort((a, b) => popcount(allowed[a]) - popcount(allowed[b]) || rng() - 0.5);
  for (const c of order) {
    const opts = [];
    for (let o = 0; o <= n; o++) {
      if (!(allowed[c] & bit(o)) || left[o] <= 0) continue;
      if (o === ENV && envCat[CAT(c)]) continue;
      opts.push(o);
    }
    if (!opts.length) return null;
    const o = opts[Math.floor(rng() * opts.length)];
    owner[c] = o; left[o]--; if (o === ENV) envCat[CAT(c)]++;
  }
  return envCat.every((x) => x === 1) ? owner : null;
}

export function mulberry32(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
