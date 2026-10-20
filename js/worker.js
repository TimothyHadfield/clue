// Runs the solver off the main thread so the board never stutters.
import { solve, rankSuggestions, envEntropy, mulberry32 } from "./solver.js";

self.onmessage = (e) => {
  const { id, n, sizes, facts, rank } = e.data;
  try {
    const t0 = performance.now();
    const s = solve(n, sizes, facts);
    if (!s.ok) { self.postMessage({ id, ok: false }); return; }
    const out = { id, ok: true, exact: s.exact, total: s.total, prob: s.prob, env: s.env.slice(0, 12), bits: envEntropy(s.env), envCount: s.env.length };
    if (rank) {
      const rng = mulberry32(rank.seed || 1);
      const cands = [];
      const rooms = rank.room != null ? [rank.room] : [...Array(9).keys()];
      for (const r of rooms) for (let su = 0; su < 6; su++) for (let w = 6; w < 12; w++) cands.push([su, w, 12 + r]);
      out.ranked = rankSuggestions(s, rank.me, cands, rng, rank.samples || 500).slice(0, rank.keep || 36);
    }
    out.ms = performance.now() - t0;
    self.postMessage(out);
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message || err) });
  }
};
