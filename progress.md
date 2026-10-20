# Clue — progress

## START HERE
Last updated 2026-10-19. Read in this order: this file, CLAUDE.md, docs/rules-check.md, docs/ideas.md, chat.md.
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
| Online | wired via online.js (gameId "clue"); see NOT verified |
| Learn and Settings | done |

## Standing instructions (Tim's words)
- "add risk, clue, battleship, connect four, stratego, clue, checkers, pandemic, splendor, king of tokyo, 7 wonders, and evolution to the list of games."
- His global rules apply: $0, no permission questions, he decides looks and wording, check at 393 px and on desktop.

## Traps
- `node --test tests/` fails on Windows. Use `npm test` (quoted glob).
- Never load `js/app.js?v=…`. A query string creates a second module instance and breaks the circular imports with "Cannot access 'root' before initialization". Shared helpers live in js/ui.js.
- Native `<select>` renders white in WebKit unless `appearance: none` (fixed in style.css).
- Several builders' local servers share this machine. Use an unusual port (47613 was used).
- Hard's accuse threshold can be overridden with the env var `CLUE_SURE` (sims only).

## Decisions
- Turn order: seats are sorted in board order from Scarlet, which is clockwise.
- Clue rules use 1 die, full roll in the hallway, and no staying in a room. Cluedo uses 2 dice and allows staying. Newer uses 2 dice, staying, and moving up to the roll.
- The step from the doorway into the room costs 1 step, which matches "Peacock is 10 from the Billiard Room".
- Hard accuses at 80% or more (measured better than 99.9%).
- The classic board is used for every edition's names.

## NOT verified
- On Tim's real iPhone (only WebKit via phone-view).
- The 2016+ board changes aren't modelled.
- UK answering-to-the-right isn't modelled.
