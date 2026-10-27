/* Clue's part of the player profile (the shared kit js/profile.js is never edited here):
 * the computer levels' ratings, the achievement list, today's Daily game and a finished game → result. */

// Elo of each level, from measured multi-player win rates turned into one-on-one odds
// (a computer that wins share w against k others is s = w·k/(1−w) times as strong; p = s/(s+1)).
// Measured 2026-10-27 (data/strength.json): Medium vs 3 Easy 76% → +390; Hard vs 3 Medium 41% → +130. Easy is anchored at 1200, where every new player starts.
export const LEVELS = [
  { id: "easy", name: "Easy", rating: 1200 },
  { id: "medium", name: "Medium", rating: 1590 },
  { id: "hard", name: "Hard", rating: 1720 },
];
export const LEVEL_IDS = ["easy", "medium", "hard"];

const won = (c) => !!(c.last && c.last.won);
const ex = (c) => (c.last && c.last.extra) || {};
export const achievements = () => [
  { id: "first", title: "First case", desc: "Win a game", test: (c) => c.stats.wins >= 1 },
  { id: "medium", title: "Detective", desc: "Beat Medium computers", test: (c) => won(c) && (c.last.level === "medium" || c.last.level === "hard") },
  { id: "hard", title: "Master detective", desc: "Beat Hard computers", test: (c) => won(c) && c.last.level === "hard" },
  { id: "full", title: "Full house", desc: "Beat 5 Hard computers", test: (c) => won(c) && c.last.level === "hard" && ex(c).players >= 6 },
  { id: "quick", title: "Quick study", desc: "Win in 6 of your own turns or fewer", test: (c) => won(c) && ex(c).myTurns > 0 && ex(c).myTurns <= 6 },
  { id: "sharp", title: "Sharp questions", desc: "Win with question quality 90% or more", test: (c) => won(c) && ex(c).quality >= 0.9 },
  { id: "pencil", title: "Pencil only", desc: "Win with Show odds off", test: (c) => won(c) && ex(c).oddsOff === true },
  { id: "hunch", title: "Hunch", desc: "Win with an accusation your notes put under 100%", test: (c) => won(c) && ex(c).hunch === true },
  { id: "streak", title: "Hat trick", desc: "Win 3 in a row", test: (c) => c.stats.bestStreak >= 3 },
  { id: "daily", title: "Daily detective", desc: "3-day Daily streak", test: (c) => c.daily.streak >= 3 },
];

/** Today's Daily game: the same deal for everyone that day, 4 players, you as Miss Scarlet, 3 Hard computers, Clue rules. */
export const DAILY = { players: 4, me: 0, level: 2, rules: "classic" };

/**
 * A finished (or quit) local game → Profile.recordResult input.
 * helped: Undo or Best question / Best guess was used → "with help", not rated.
 */
export function result({ won, level, helped, daily, players, myTurns, quality, oddsOff, hunch }) {
  const extra = { players, myTurns, quality, oddsOff: !!oddsOff, hunch: !!hunch };
  if (helped) return { mode: "help", level: null, won: !!won, daily: !!daily, extra };
  return { mode: "computer", level: LEVEL_IDS[level] || null, won: !!won, daily: !!daily, extra };
}
