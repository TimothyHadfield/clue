# Clue — progress

## START HERE
Last updated 2026-10-20 (real-table look). Read in this order: this file, CLAUDE.md, docs/rules-check.md, docs/ideas.md, chat.md.
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
- His global rules apply: $0, no permission questions, he decides looks and wording, check at 393 px and on desktop.

## Traps
- `node --test tests/` fails on Windows. Use `npm test` (quoted glob).
- Never load `js/app.js?v=…`. A query string creates a second module instance and breaks the circular imports with "Cannot access 'root' before initialization". Shared helpers live in js/ui.js.
- Native `<select>` renders white in WebKit unless `appearance: none` (fixed in style.css).
- Several builders' local servers share this machine. Use an unusual port (47613 was used).
- Hard's accuse threshold can be overridden with the env var `CLUE_SURE` (sims only).
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

## Decisions
- Turn order: seats are sorted in board order from Scarlet, which is clockwise.
- Clue rules use 1 die, full roll in the hallway, and no staying in a room. Cluedo uses 2 dice and allows staying. Newer uses 2 dice, staying, and moving up to the roll.
- The step from the doorway into the room costs 1 step, which matches "Peacock is 10 from the Billiard Room".
- Hard accuses at 80% or more (measured better than 99.9%).
- The classic board is used for every edition's names.
- Easy now knows one trick: if nobody could answer its own question, the cards it doesn't hold are the answer. Six Easy computers went from 379 to 96 turns. Medium beats 3 Easy 74.5% of the time (was 100%).
- On narrow phones with 5 or 6 players, the player chips show 2 letters ("Me", "Mu") and hide the card count (it's in the chip's tooltip).

## NOT verified
- On Tim's real iPhone (only WebKit via phone-view).
- Sounds were never heard by a person: headless WebKit has no Web Audio; Chrome headless counted 198 plays in one bot game. Confetti checked in Chrome (headless WebKit runs only ~2 frames/s).
- Real-table look: deal/turn-up animations only seen in headless Chrome stills (WebKit runs ~2 fps); exact real Clue card size not confirmed (57x89 used).
- Online test (2026-10-20): every PASS line passes, but Bob logs `TypeError ... snap.seats.map` (app.js lobby ~743) on both this branch and the live main build. Not fixed (pre-existing, outside the table-look slice).
- Online sounds: same code path as local (snapshot diff) but not run in a two-browser test.
- The 2016+ board changes aren't modelled.
- UK answering-to-the-right isn't modelled.
- QA fixes checked by reading the code only, not clicked through: the notepad refusing "nobody showed" on a card you hold, room chips clearing after a contradiction, triple-tap Suggest logging once, emoji/long names in notepad headers.
