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
- **Verified (QA):** `npm test` 21/21. A headless WebKit script at 393 px got 14/14 (Back ×3, Names mid-game and after reload, odds off on Play/Notepad/Accuse, Quit, bad code keeps the form, no console errors). Tab-close takeover: the seat went to a computer after 101 s and play continued. Host leaving the lobby: the guest gets "The room was closed". tools/two-browsers.mjs passes. Desktop has no overflow.
- **Open:** see progress.md NOT verified.

## 2026-10-20: visual design pass (builder agent)
- **Asked:** Tim: "once you're finished with all the games, review them again for design improvements especially visually." Polish only: no rules, behaviour or wording changes.
- **Built:** hover only on real mice (on phones the stuck hover greyed out Suggest, Got it and New game). Weapon tokens are now cream discs with dark drawings, and pawns are larger with a floor shadow. Lit squares are stronger blue with a white edge. The turn chip and your action bar glow when it's your move. The buttons row is always there, so the board stays the same size between turns. Hand cards fill the row, with bigger labels and long names split over two lines. Sheet cards are bigger. Sheet buttons stick to the bottom of tall sheets. Chips are at least 40 px tall. The phone notepad side panel scrolls. Setup is centred vertically. On desktop the notes are 13 px and the card count sits next to the name.
- **Verified:** `npm test` 21/21. A headless WebKit capture of 17 states at 393 px and 1280 px, before and after (scratchpad design/clue/), showed no overflow, no page scroll and no console errors. The board measured 361 px on phone in every game state, including others' turns.
- **Open:** the board is about 4% smaller on phone because the hand cards are bigger.

## 2026-10-21: visibility pass (builder agent)
- **Asked:** Tim: "the cards or board layout is too small to easily see what's going on ... Consider parts of the board that are dense in what's happening and if the user can reasonably see it." (full quote in progress.md)
- **Built:** board takes all the space it can on every size (seats tucked behind plates, hand sized to the screen height, landscape tabs as a left rail, laptop hand moved under the notes). js/zoom.js: auto-zoom to your move on phones, tap a room to look closer, pinch/drag/wheel, whole-board button. Bigger weapons, room names, odds; full-square tap targets; 320 px notes fit all columns.
- **Verified:** `npm test` 35/35, `node tools/edge.mjs` 24/24, new `node tools/vis.mjs` 25/25 in WebKit and Chrome (it failed all 25 on the old build). One read-only reviewer pass on before/after shots (scratchpad vis/clue/); its fixes applied.
- **Open:** see NOT verified (real pinch, notch, still-small items).

## 2026-10-20: edge pass, weird situations (builder agent)
- **Asked:** Tim: "Could you focus on making each game perfect especially in scenarios that the game doesn't expect or are a little weird." Plus the known `snap.seats.map` lobby error.
- **Built:** 47 scenarios listed (rules, odd people, odd taps, odd devices, odd screens) and tested; 12 failed and were fixed: peer actions must be whole numbers; computers fall back to a safe legal move; no crash while joining; duplicate online names get the suspect added; emoji-safe short labels; a player whose seat was handed over is told; the result sheet no longer reopens from Settings; Back on the online form returns to setup; "?" inside Suggest returns to it with picks kept; chips re-fit on rotate; a win in the last second before closing is counted; a corrupt save is dropped; two tabs no longer fight; boxed in says "Blocked in — no move".
- **Verified:** `npm test` 35/35 (new tests/edge.test.js: 3 of 9 seen failing first). `node tools/edge.mjs` 24/24 in headless WebKit (before: 7 failed). `node tools/edge-online.mjs` 6/6 with 3 browsers (before: join crash, duplicate names). Screens in scratchpad edge/clue/after/.
- **Open:** see NOT verified (AFK online, background reclaim).

## 2026-10-20: real-table look (builder agent, table-look wave)
- **Asked:** Tim: "make sure that each of the games also have a look to them so that the game ... looks almost identical to how the board or card layout looks like in real life ... like you're looking through a camera that is connected to a user's glasses" (full quote in progress.md). No rule or behaviour changes; keep every helper.
- **Built:** the play screen is a dark wooden table (shared `css/table.css` + `js/table.js`). The board is redrawn like the printed one: cream hallway, illustrated room floors and furniture, serif name plaques, door swings, stairs with the CASE FILE envelope in the middle, and a dark printed margin. Pawns are glossy plastic, weapons pewter, dice ivory (one on the Roll button). Opponents sit across the top with a fan of maroon lattice backs (one per card held). Your hand is a fan of real-proportion 57x89 cards at the bottom. Notes are a cream detective sheet. Cards are dealt face down off the envelope and turn up; shown and case-file cards turn over in 3-D. `js/fx.js` re-copied from `_fx` 1.0.3 (Clue never had a speed workaround).
- **Verified:** `npm test` 26/26. Headless WebKit at 320, 393, 659 landscape and 1280: no page scroll, no overflow, no console errors. "Effects speed" → fast left the game's Speed at 1. Two reviewer passes on the screenshots (scratchpad table/clue/). Online two-browser test: all 4 PASS lines, but one console error `snap.seats.map` on Bob's side, which also happens on the live main build (pre-existing, lobby code at app.js ~743).
- **Open:** setup screen and end sheet are still app-styled; real-phone check.

## 2026-10-20: sounds, celebrations and animations (builder agent)
- **Asked:** Tim: "add opptional sounds you can add to the games that reflect what's happening in the game accurately as well as win celebrations, and other fun annimations to go along with everything. Just make sure everything is customizable in the settings so the user can play as preffered."
- **Built:** js/fx.js (the shared copy) and js/sfx.js, which works out events from snapshot diffs and maps them to sounds (the map is in progress.md). Five Clue sounds were added: footstep, door creak, suggestion sting, "show a card" prompt and pencil scribble. Effects: hand cards fly in when the cards are dealt, a face-down card flies from the shower to the asker, the suggester's chip pulses, a wrong accusation shakes the chip, the bar flashes on your turn, sparkles appear when the notes crack the case, and the game ends with confetti or a lose dim. Settings has a "Sound & effects" panel. Animations off stops every CSS animation and the token walk.
- **Verified:** `npm test` passes 26/26. The new tests/fx.test.js (5 tests) failed first because js/sfx.js didn't exist. phone-view at 393 px and on desktop covered Settings, mid-game and the win screen (scratchpad design/clue-fx/), with no console errors and no overflow; the game screen is still 659/659 with no page scroll. In Chrome, a full bot game after a wrong accusation gave 198 sound plays, 15 card flies, and the lose sheet.
- **Open:** a person still has to listen to it on an iPhone.

## 2026-10-27: improve pass (builder agent, manager's per-game brief)
- **Asked:** the manager's improve brief, quoting Tim: "start building every single improvement you can think of after your competitor analysis" and "I want to make our boardgames the best in every single metric we can." It covered: the listed fixes, a stronger Hard (at least 65% one-on-one against Medium), rivals' variants, Undo, replay, a reveal scene, achievements, the shared kits (guided game, My stats, Daily, PWA), richer art, and no empty bands.
- **Built:**
  - **Kits copied in, byte-identical:** coach, profile, pwa, and fx re-synced.
  - **New in the game:** a guided first game and a rules sheet, a My stats pill plus a Daily button on setup, and 10 achievements. Undo goes 6 moves deep and is not available in the Daily.
  - **End of game:** a case-file reveal, then a Replay on the result sheet.
  - **Art:** a prop for each suspect card.
  - **Hard computer:** it accuses at 70%, and it reads other computers' early questions.
  - **Reviewer fixes:** the result sheet after the reveal online, Undo dropping the question score, the counted-once key, a new game clearing the replay, and Back over the rules.
- **Verified:**
  - `npm test` 39/39. The new profile test failed on a broken `result()`.
  - `tools/improve.mjs` 5/5 in WebKit, phone and desktop. `tools/edge.mjs` 24/24. `tools/pwa-check.mjs` 18/18.
  - Sims (2000 games) are in data/strength.json.
- **Open:** see progress.md NOT verified. Tim's calls are in the report.

## 2026-10-28: wave 3 (builder agent under the classic manager)
- **Asked:** Tim: "Go ahead and go through each project adding features or changing things that you think should be changed... common house rules... links to youtube videos... making the layout better on iphone... Just make the games better." Brief: house rules (off by default, sourced, computers handle them, ladder measured), a Videos section, practical settings if missing, an iPhone layout check.
- **Built:** the official 2-player game (4 cards face down in rooms, look once by walking in); Settings → House rules: Leftovers face up, Quick moves; Rules sheet "House rules" + "Videos" (4 links). Solver "pile" owner for face-up/room cards; Hard drags its rival in 2-player. Layout: coach offer moved to the top (it covered the tab bar), quick moves no longer auto-zoom, a stale Suggest sheet closes after an online-lag double tap. Practical settings: already there (speed, animations, remembered setup, odds on/off, manual Notepad), none added.
- **Verified:** `npm test` (44 node + quit + house browser at 393/320; new tests seen failing on the old code), 7 node runs clean (no flake), house browser 6/6 after the networkidle fix. tools/edge.mjs 24/24, pwa-check 18/18, two-browsers online 4-player and `--two` (2-player quick) both pass. Layout script at 393, 320, 659x393, 1280, 1440: no overflow, offer covers neither tabs nor Deal. Ladder sims in data/strength.json.
- **Open:** see progress.md NOT verified.

## 2026-10-28 — wave 3 kit sweep (builder A2): game-coach 1.2.0 + game-pwa 1.4.0 copied, offer `place:"auto"` avoiding Deal, local offer/link CSS dropped; `npm test` green, pwa-check 18/18, offer/settings rect checks pass at 393/320/659×393.
