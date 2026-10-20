# Chat log

## 2026-10-19: first build (builder agent, Classic+Platform wave)
- **Asked:** Tim: "add risk, clue, battleship, connect four, stratego, clue, checkers, pandemic, splendor, king of tokyo, 7 wonders, and evolution to the list of games." The manager's brief asked for the classic Clue cards and board, an exact deal-counting solver, a best-question picker, computers at measured strengths, a real-table notepad, original art, online play, rules-check and ideas docs, and a QA pass.
- **Built:** the whole site. Tabs: Play, Notepad, Learn, Settings. The solver is exact grouped counting with an MCMC fallback when the work gets too big. Computers come in Easy, Medium and Hard. The online room uses `_online/online.js`.
- **Decided:** Hard accuses once the top answer is 80% likely or more; measured better than waiting for 99.9% (38% vs 30% wins against 3 Medium). The classic board is used for every edition.
- **Verified:** 21 node tests pass, and every one was seen failing against a broken copy of the engine. Sims are in data/strength.json. phone-view at 393 px and on desktop covered every tab, plus a full game autoplayed to the end through the real buttons.
- **Open:** see progress.md NOT verified.
