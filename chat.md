# Chat log

## 2026-10-19: first build (builder agent, Classic+Platform wave)
- **Asked:** Tim: "add risk, clue, battleship, connect four, stratego, clue, checkers, pandemic, splendor, king of tokyo, 7 wonders, and evolution to the list of games." The manager's brief asked for the classic Clue cards and board, an exact deal-counting solver, a best-question picker, computers at measured strengths, a real-table notepad, original art, online play, rules-check and ideas docs, and a QA pass.
- **Built:** the whole site. Tabs: Play, Notepad, Learn, Settings. The solver is exact grouped counting with an MCMC fallback when the work gets too big. Computers come in Easy, Medium and Hard. The online room uses `_online/online.js`.
- **Decided:** Hard accuses once the top answer is 80% likely or more; measured better than waiting for 99.9% (38% vs 30% wins against 3 Medium). The classic board is used for every edition.
- **Verified:** 21 node tests pass, and every one was seen failing against a broken copy of the engine. Sims are in data/strength.json. phone-view at 393 px and on desktop covered every tab, plus a full game autoplayed to the end through the real buttons.
- **Open:** see progress.md NOT verified.

## 2026-10-20: QA report fixes (same builder)
- **Asked:** the manager's QA report: online freeze when a tab closes, a bad join code crashing to setup, Names lost on reload, Back leaving the site, no quit/leave, cut chips at 393 px with 6 players, plus minor items (odds-off still showing %, "0% or less", my seat flickering "off", notepad headers, no message when the host leaves the lobby, stale room odds, impossible notepad entries, triple-tap Suggest, slow Easy games).
- **Built:** all of them. The host hands an offline seat to a computer (automatically, or by tapping the dashed chip). The join form keeps what you typed. Names stay the viewer's own choice, and changing them mid-game redraws the board. Back closes sheets and Notes. Settings has Quit/Leave. Chips go to 2 letters. Easy uses the "nobody could answer" trick.
- **Verified:** `npm test` 21/21. A headless WebKit script at 393 px got 14/14 (Back ×3, Names mid-game and after reload, odds off on Play/Notepad/Accuse, Quit, bad code keeps the form, no console errors). Tab-close takeover: the seat went to a computer after 101 s and play continued. Host leaving the lobby: the guest gets "The room was closed". tools/two-browsers.mjs passes. Desktop has no overflow.
- **Open:** see progress.md NOT verified.
