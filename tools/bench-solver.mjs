// Times the exact solver on realistic mid-game knowledge. node tools/bench-solver.mjs
import { solve, NCARDS } from "../js/solver.js";
function mulberry(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rng = mulberry(99);
for (let t = 0; t < 24; t++) {
  const n = 3 + (t % 4);
  const env = [Math.floor(rng() * 6), 6 + Math.floor(rng() * 6), 12 + Math.floor(rng() * 9)];
  const rest = []; for (let c = 0; c < NCARDS; c++) if (!env.includes(c)) rest.push(c);
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  const owner = new Array(NCARDS).fill(n), sizes = new Array(n).fill(0);
  rest.forEach((c, i) => { owner[c] = i % n; sizes[i % n]++; });
  const facts = [];
  for (let c = 0; c < NCARDS; c++) if (owner[c] === 0) facts.push({ t: "has", p: 0, c });
  for (let i = 0; i < 8; i++) {
    const tr = [Math.floor(rng() * 6), 6 + Math.floor(rng() * 6), 12 + Math.floor(rng() * 9)];
    const h = tr.map((c) => owner[c]).filter((o) => o > 0 && o < n);
    if (h.length) facts.push({ t: "some", p: h[0], cards: tr });
    for (let p = 1; p < n; p++) if (!tr.some((c) => owner[c] === p) && rng() < 0.3) for (const c of tr) facts.push({ t: "not", p, c });
  }
  const t0 = performance.now();
  const s = solve(n, sizes, facts, { budget: 5e6 });
  console.log(n, "states", s.states, "ms", (performance.now() - t0).toFixed(0), s.ok);
}
