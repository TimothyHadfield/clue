# Clue — progress

## START HERE
Last updated 2026-10-27 (follow-up: the guided game never counts in My stats or the W/L record, even when quit (`recordLocal` returns for `meta.tutorial`); quitting a normal game vs computers was already a loss; `tests/quit.browser.mjs` (WebKit 393, in `npm test`, seen failing on the old build: 2 games); build 11. Before that, improve pass: kits, Undo, reveal, replay, achievements, Daily, stronger Hard). Read in this order: this file, CLAUDE.md, docs/rules-check.md, docs/ideas.md, chat.md.
Live: https://timothyhadfield.github.io/clue/ · Repo: https://github.com/TimothyHadfield/clue

## Goal right now
Tim: "add risk, clue, battleship, connect four, stratego, clue, checkers, pandemic, splendor, king of tokyo, 7 wonders, and evolution to the list of games." First version built; waiting on the manager and Tim.

## Status
| Part | State |
|---|---|
| Rules engine (js/game.js, board.js, board-data.js) | Done. Tested against PB1998 and the other sources (docs/rules-check.md) |
| Solver (js/solver.js) | Exact counting with an MCMC fallback when the budget is passed; tested against brute force |
| Computers (js/ai.js) | Easy, Medium and Hard, measured (data/strength.json) |
| Play tab | vs computers, resumes after a reload, odds on the board, best question, end-of-game review |
| Notepad tab | real-table deduction helper |
| Online | works: two-browser test (tools/two-browsers.mjs) passes. If a player's tab closes, the host hands their seat to a computer about 20 s after presence marks it offline (~100 s in all, measured). The host can also tap a dashed chip to hand over at once |
| Learn and Settings | done. Settings has Quit game / Leave room while a game runs |
| QA report 2026-10-20 | all items fixed and retested headless (see chat.md) |
| Design pass 2026-10-20 | done: no sticky hover on phones, cream weapon tokens, bigger pawns, readable hand cards, sheet buttons stay on screen, board never resizes between turns (see chat.md) |
| Sounds and effects 2026-10-20 | done: js/fx.js (shared copy of `_fx/fx.js`, never edit) + js/sfx.js (Clue's events → sounds). Settings → "Sound & effects". tests/fx.test.js |
| Real-table look 2026-10-20 | done: wooden table (shared kit `css/table.css` + `js/table.js`, copies of `../_table`, never edit), board redrawn like the printed one (cream hallway, illustrated room floors, serif name plaques, stairs + CASE FILE envelope in the middle, door swings), glossy plastic pawns, pewter weapons, ivory dice, opponents as seats with fans of maroon card backs, your hand as a fan of real 57x89 cards, notes as a cream detective sheet. Cards are dealt face down off the envelope and turn up; shown / case-file cards turn over in 3-D. Laptop: table left, sheet right. Phone landscape: board left, rest right |
| Visibility pass 2026-10-21 | done: board as big as the screen allows (phone 334→373 px wide, 320 px phone 248→300, landscape 308→363 with the tabs as a left rail, laptop 545→656 with the hand moved under the sheet). Zoom (js/zoom.js, SVG viewBox so taps stay exact): your move auto-zooms to the reachable area when squares are under 22 px; not your move, tap a room to look closer, tap again or the corner button for the whole board; pinch, drag, mouse wheel. Bigger weapons, room names, room odds. Check: `node tools/vis.mjs <url> [--engine chrome]` (25 screens) |
| Improve pass 2026-10-27 | done: shared kits copied in (guided first game + rules sheet `_coach`, My stats / achievements / Daily `_profile`, install + offline `_pwa`, fx.js re-synced). Undo vs computers (6 deep, not in the Daily), case-file reveal scene (js/reveal.js), end-of-game Replay (frames saved with the game), 10 achievements + level ratings (js/clue-profile.js), guided game + rules (js/tutorial.js), suspect cards each get a prop. Hard stronger (see Decisions). Check: `node tools/improve.mjs <url> [--desktop] [--shots dir]` (5 checks), `node tools/pwa-check.mjs` (18) |
| Edge pass 2026-10-20 | done: 47 weird situations listed and tested, 12 failed, all fixed (table below). Checks: `tests/edge.test.js` (engine), `node tools/edge.mjs <url>` (24 browser checks), `node tools/edge-online.mjs <url>` (3 browsers online) |

## Edge pass (2026-10-20): weird situations
| Area | Tested | Was broken, now fixed |
|---|---|---|
| Rules | all wrong, last player standing, you out on turn 1 with 5 Easy, boxed in, pulled into your own room, every rule set x 3-6 players, accuse after rolling | odd peer actions (suspect 2.5, "7") were accepted and corrupted the table; a computer whose move fails now plays a safe legal move instead of freezing (`safeAction` in game.js) |
| People (online) | joining, duplicate names, 20-char emoji name, seat handed to a computer, late joiner | `snap.seats.map` crash while joining; two "Tim"s now read "Tim (Scarlet)" / "Tim (Mustard)"; a player whose seat was handed over is told why; short labels never cut an emoji |
| Taps | double-tap Roll/End, Back everywhere, Settings mid-game and after the end, "?" inside Suggest | result sheet popped again when Settings changed odds/Names after the game; Back on the online form left the site; "?" in Suggest threw away your picks |
| Devices | 320x568, 393x659, 659x393, 1280x800, 1920x1080, rotate, reload after rolling, reload in the moment of winning, two tabs, storage blocked, light/dark | rotating left full names on 6 chips; the win was never counted if the page closed within a second of it; two tabs both ran the computers and overwrote each other (now the tab you look at plays, the other pauses and catches up) |
| Screens | every ending (you win, computer wins after you're out, nobody), boxed-in bar, corrupt saved game | bar said "Moved" when boxed in (now "Blocked in — no move"); a corrupt saved game crashed the page on every load (now dropped) |
Scenario list with results: scratchpad `edge/clue/scenarios.md` of the 2026-10-20 manager session (summary above is the record).

## Sounds and effects: event → sound map (js/sfx.js)
Driven by the difference between two public snapshots, so local, computer and online moves all sound the same.
| Event | Sound | Effect |
|---|---|---|
| New game dealt | `shuffle`, then `cardDeal` per card in your hand | hand cards fly in from the board centre |
| Roll | `diceRoll`, then `diceLand` per die at ~400 ms (die tumble) | existing tumble |
| Walk | `step` per square, paced with the walk | existing walk |
| Enter a room | `creak` (door) at the end of the walk | |
| Secret passage | `whoosh` | |
| Suggestion | `sting` (dun-dun-DUNN), `slide` if a token is summoned, a soft knock per player who says No | suggester chip pulses |
| Card shown | `cardFlip` if shown to you, else `cardSlide`; nobody showed = `ding` | face-down card flies shower → asker |
| You must show a card | `prompt` (alert) | |
| Accusation | `drumroll`; wrong = `stamp` on the last beat | wrong: chip shakes + red flash; the "accused wrongly" toast waits for the beat when game sounds are on |
| Becomes YOUR turn | `turn` (alert) | action bar flashes |
| Illegal board tap / refused action | `error` | |
| Notes gain new ✓/✗ | `scribble` | |
| Notes narrow to one answer | celebrate `big` (sparkles) | once per game |
| Game over | celebrate `win` (winner's colours) or `lose`, as the result sheet opens | |
| Notepad tab: save a suggestion/accusation | `scribble`; a refused save = `error` | |
Animations off adds `html.fx-still` (all CSS animations/transitions off) and tokens jump instead of walking (one knock/creak).

## Standing instructions (Tim's words)
- "add risk, clue, battleship, connect four, stratego, clue, checkers, pandemic, splendor, king of tokyo, 7 wonders, and evolution to the list of games."
- 2026-10-20: "add opptional sounds you can add to the games that reflect what's happening in the game accurately as well as win celebrations, and other fun annimations to go along with everything. Just make sure everything is customizable in the settings so the user can play as preffered."
- 2026-10-20: "could you also make sure that each of the games also have a look to them so that the game (either board or card layout) looks almost identical to how the board or card layout looks like in real life, so it's easy to understand if you've already played it before, and also so it feels more like you're actually playing in real life rather than you're playing it online. Even things like how youre cards or other things are laid out infront of you, make it look like they are actual cards laid out similar to how it looks like in real life. Make the decks look like actual decks. Make the board have the same design as it does in real life with the same layouts. It should look kind of like you're looking through a camera that is connected to a user's glasses that is playing in real life (not actually, but the layout and style of everything should be similar)."
- 2026-10-20: "I've noticed the games often have good user interfaces but could be improved especially when a scenario happens that the game might've not really thought about or whatnot. Could you focus on making each game perfect especially in scenarios that the game doesn't expect or are a little weird."
- 2026-10-21: "for a lot of the games the cards or board layout is too small to easily see what's going on. Some games just need small design imporvements like filling the screen with the board view and fitting the cards and other things in the empty space, some have severe errors like TTR. Fix this so the view of what's happening and where everything is is very clear. Consider parts of the board that are dense in what's happening and if the user can reasonably see it."
- His global rules apply: $0, no permission questions, he decides looks and wording, check at 393 px and on desktop.

## Traps
- `node --test tests/` fails on Windows. Use `npm test` (quoted glob).
- Never load `js/app.js?v=…`. A query string creates a second module instance and breaks the circular imports with "Cannot access 'root' before initialization". Shared helpers live in js/ui.js.
- Native `<select>` renders white in WebKit unless `appearance: none` (fixed in style.css).
- Several builders' local servers share this machine. Use an unusual port (47613 was used).
- Hard's accuse threshold (`CLUE_SURE`, default 0.7) and its reading of computers' questions (`CLUE_MODEL`, turns, default 24; 0 = off) can be overridden by env vars in sims only.
- Kit copies are byte-identical and never edited here: js/fx.js, js/table.js, css/table.css, js/coach.js, css/coach.css, js/profile.js, css/profile.css, js/pwa.js, sw.js, tools/make-icons.mjs, tools/pwa-check.mjs (all `-text` in .gitattributes). Report kit bugs to the manager.
- PWA: bump `?v=N` on the kit scripts/CSS and `data-version` on pwa.js together when shipping, so the service worker picks up the new build. `PWA.safeToReload` is only true on setup / finished game.
- The guided game is seeded (`TUTORIAL.seed` in js/tutorial.js) and stacks your first rolls to reach the nearest room (`tutorialDice` in app.js). The Daily deals with `Profile.daily.rng(day)`.
- A finished local game is counted once by `meta.id` (`counted:<id>` in storage); old saves without meta fall back to turn + case file.
- Replay frames live in the saved game's `meta.frames` (max 800); only move / passage / suggestDone / accuse are recorded.
- The solver speed test (worst solve under 3 s) fails when the machine is at 100% CPU from other builders. Rerun it when the machine is quiet.
- Under load, creating an online room can take more than 20 s, so the test tools wait 60 s.
- Back button: sheets and the phone Notes panel are history layers (pushLayer/popLayer in js/ui.js). `closeSheet` used as an onclick gets an event, which is why it checks `fromBack === true`.
- The Names setting belongs to the viewer, not the game. Never copy `pub.opts.edition` into settings (that was the "reset to Classic" bug).
- Hover styles live inside `@media (hover: hover)`. On a phone a tap leaves :hover stuck, and that used to grey out the blue and gold buttons.
- The action bar always renders its `.acts` row (empty on others' turns). Removing it makes the board resize every turn.
- Bump `css/style.css?v=N` in index.html after CSS changes. Never put a query string on JS (see the app.js trap).
- fx.js is a byte-for-byte copy of `../_fx/fx.js`; Clue-only sounds go in js/sfx.js via `FX.define`. Its `.switch`/`.seg` fallbacks tie on specificity and load later, so style.css overrides them under `.fx-set`.
- Never put an SVG `filter` (drop-shadow) on the board: headless WebKit stopped painting the page (the Notes panel never appeared). The board's shadow is drawn as offset rects inside boardSvg.
- Card backs (`.clue-back`) are hidden by opacity and shown only during the turn animations. Don't switch to `backface-visibility`: WebKit showed the backs of every hand card.
- table.css/table.js are byte copies of `../_table`; Clue-only looks go in style.css.
- online.js is a copy of `_online/online.js`. Another builder is fixing seat takeover there; re-copy it when the manager says.
- Two tabs: `clue.owner` in localStorage names the tab that plays the saved game. The other tab's `storage` listener closes its room (`paused`); focus/visibility or any tap makes it reload the saved game (`takeBack`). Don't remove `store.set("owner", TAB)` from startLocal.
- A saved game is checked by `validSave` before it is resumed; add any new required state field there too.
- `game.bot` validates the computer's move against the rules and falls back to `safeAction`; it warns "computer fallback" in the console when that happens.
- WebKit logs "ResizeObserver loop completed with undelivered notifications" as a page error when the hand fan relayouts (shared js/table.js `fan()` observes the element whose height it sets). Harmless; tools/edge.mjs ignores it. Fix belongs in `_table`.
- Board zoom changes the SVG `viewBox` (js/zoom.js); never zoom with CSS transforms, taps and the token walk rely on SVG units. The svg has `touch-action: none` (pinch/drag are ours). A drag or pinch swallows the following click.
- Headless WebKit runs requestAnimationFrame at a few frames a second, so zoom animations there take seconds: tests wait for `#zoomOut` hidden/shown, never a fixed sleep.
- A finished game is never resumed from storage; tools/vis.mjs reaches the end screen by accusing correctly through `window.__clue.act`.
- Online test tools run from `http://localhost:<port>/` (Firebase works there); `127.0.0.1` is fine for local-only checks.

## Decisions
- Turn order: seats are sorted in board order from Scarlet, which is clockwise.
- Clue rules use 1 die, full roll in the hallway, and no staying in a room. Cluedo uses 2 dice and allows staying. Newer uses 2 dice, staying, and moving up to the roll.
- The step from the doorway into the room costs 1 step, which matches "Peacock is 10 from the Billiard Room".
- Hard accuses at 70% or more (2026-10-27; was 80%, which beat 99.9%). It also reads an Easy/Medium computer's questions in its first 24 turns as naming cards that computer doesn't hold (dropped if that contradicts what it has seen). That part never fires against people or other Hard computers, so against people only the 70% change helps (Hard vs 3 Medium without it: 35.9%).
- 2026-10-27 ladder (2000 games, 4 players): Hard vs 3 Medium 41.1% (was 33.2%; about 68% one-on-one), Hard vs 2 Medium 49.8% (was 42.6%), Medium vs 3 Easy 76.2%, Hard vs 3 Easy 83.1%. Elo: Easy 1200, Medium 1590, Hard 1720.
- 2026-10-27 tried and dropped for Hard (1000-game sweeps, none beat the baseline): valuing rooms by question bits, step cost 0.03/0.1, a lower bar when a rival's question went unanswered, one-roll look-ahead, showing people/weapons before rooms.
- 2026-10-27 profile: Best question, Best guess and Undo make a game "with help" (unrated); the starred best pair and the odds shown by default do not. The guided game is always "with help". The Daily is 4 players, you as Scarlet, 3 Hard computers, Clue rules, no Undo. Quitting counts as a loss. The old W/L record was moved into My stats once (`pfMoved`).
- The classic board is used for every edition's names.
- Easy now knows one trick: if nobody could answer its own question, the cards it doesn't hold are the answer. Six Easy computers went from 379 to 96 turns. Medium beats 3 Easy 74.5% of the time (was 100%).
- 2026-10-21 visibility: auto-zoom only below 22 px per square (phones, not laptops); zoom-out button bottom-left of the board, icon only; laptop hand sits under the notes (78 px cards), notes log capped at 17%.
- On narrow phones with 5 or 6 players, the player chips show 2 letters ("Me", "Mu") and hide the card count (it's in the chip's tooltip).

## NOT verified
- On Tim's real iPhone (only WebKit via phone-view).
- Sounds were never heard by a person: headless WebKit has no Web Audio; Chrome headless counted 198 plays in one bot game. Confetti checked in Chrome (headless WebKit runs only ~2 frames/s).
- Real-table look: deal/turn-up animations only seen in headless Chrome stills (WebKit runs ~2 fps); exact real Clue card size not confirmed (57x89 used).
- Edge pass (2026-10-20), reasoned only: a tab left in the background for 10 minutes (timers throttle, state is saved every move, so it resumes); a slow/dropped network online (handled inside shared online.js); a spectator with no seat; an online player who stays online but never acts (AFK) — nobody can hand that seat over, as at a real table. A phone returning from the background after the host gave its seat away can't reclaim it (online.js design); it now gets a message.
- Online sounds: same code path as local (snapshot diff) but not run in a two-browser test.
- Visibility pass (2026-10-21): pinch and drag only reasoned + synthetic; never done with real fingers. iPhone landscape notch padding (`env(safe-area-inset-*)`) is 0 headless, so the rail next to the notch is unchecked. Still small: at 320 px the seat chips read "M." / "W."; a 6-roll's auto-zoom has 17–19 px squares (it fits every lit square on screen; pinch for more); laptop die beside "You" is small; confetti covers the end sheet on phones.
- Improve pass (2026-10-27): install to the home screen and offline play were checked only headless (pwa-check 18/18), never on Tim's iPhone. The coach bubbles were seen in headless Chrome only (WebKit's slow rAF). The reveal scene's sounds were never heard. No 2-player mode (Clue needs 3+; rivals' 2-player modes are house rules), so none was added.
- The 2016+ board changes aren't modelled.
- UK answering-to-the-right isn't modelled.
- QA fixes checked by reading the code only, not clicked through: the notepad refusing "nobody showed" on a card you hold, room chips clearing after a contradiction, triple-tap Suggest logging once, emoji/long names in notepad headers.
