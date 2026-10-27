// Measures computer strength by self-play.  node tools/sim.js <games> <matchup> [rules]
//   matchup: "2v1" = one Hard vs three Medium, "1v0", "2v0", "seat" (all Medium, win rate by seat)
// The special player rotates through every seat so going first doesn't skew it.
import { game, publicView, privateView } from "../js/game.js";
import { RULESETS } from "../js/cards.js";
import { mulberry32 } from "../js/solver.js";

const N = +(process.argv[2] || 200);
const matchup = process.argv[3] || "2v1";
const R = RULESETS[process.argv[4] || "classic"];
const players = +(process.argv[5] || 4);
const rng = mulberry32(20261019 + matchup.length * 7 + players);

let specialWins = 0, decided = 0, turns = 0, solveNoOne = 0;
const seatWins = new Array(players).fill(0);
const t0 = Date.now();
for (let g = 0; g < N; g++) {
  const seat = g % players;
  let levels;
  if (matchup === "seat") levels = new Array(players).fill(1);
  else { const [a, b] = matchup.split("v").map(Number); levels = new Array(players).fill(b); levels[seat] = a; }
  let s = game.setup(players, { levels, dice: R.dice, stay: R.stay, upTo: R.upTo }, rng, levels.map(() => ({ kind: "computer" })));
  let steps = 0;
  while (!s.over && steps++ < 20000) {
    const who = game.toAct(s)[0];
    const a = game.bot({ pub: publicView(s), mine: privateView(s, who), state: s }, who, rng);
    s = game.apply(s, who, a, rng);
  }
  turns += s.turnNo;
  if (s.winner < 0) { solveNoOne++; continue; }
  decided++;
  seatWins[s.winner]++;
  if (s.winner === seat) specialWins++;
}
const out = {
  matchup, players, rules: process.argv[4] || "classic", games: N,
  specialWinRate: matchup === "seat" ? null : +(specialWins / N).toFixed(4),
  fairShare: +(1 / players).toFixed(4),
  seatWinRate: seatWins.map((w) => +(w / N).toFixed(4)),
  avgTurns: +(turns / N).toFixed(1), avgRoundsPerPlayer: +(turns / N / players).toFixed(1),
  nobodySolved: solveNoOne, seconds: Math.round((Date.now() - t0) / 1000),
};
console.log(JSON.stringify(out));
