# Clue — project rules

Static site on GitHub Pages: https://timothyhadfield.github.io/clue/ (repo TimothyHadfield/clue). $0, no build step, ES modules.

- Read `progress.md` first.
- Tests: `npm test` (runs `node --test "tests/*.test.js"`; the quoted glob is needed on Windows). The speed test takes about 15 s.
- Strength numbers in `data/strength.json` come from `node tools/sim.js <games> <matchup> [rules] [players]`. Rerun the sims after any change to `js/ai.js` and update the file.
- `js/online.js` is the shared copy from `../_online/`. Never edit it here; copy it again if `_online` changes. gameId is "clue".
- Original art and wording only. Never copy Hasbro card art or rulebook text.
- Local server: `python -m http.server <port> --bind 127.0.0.1` from this folder. Check with `node ~/.claude/tools/phone-view.mjs`.
- Handoff files (`progress.md`, `chat.md`, docs) are edited with the Edit/Write tools only.
