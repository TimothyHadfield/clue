# Rules check (2026-10-19)

Every rule the game enforces, where it comes from, and the test that checks it. All wording here is our own.

Sources:
- **PB1998**: Parker Brothers Clue rules, 1998 ([archived PDF](http://web.archive.org/web/20240629055502/https://phoenix.goucher.edu/~kelliher/f2010/cs245/clueRules.pdf))
- **UK1996**: Waddingtons Cluedo rules ([cluedofan.com](https://cluedofan.com/origrule.htm))
- **H2016**: Hasbro A5826 ([PDF](https://consumercare.hasbro.com/api/download/A5826_en-us))
- **H2023**: Hasbro F6420 ([PDF](https://consumercare.hasbro.com/api/download/F6420_en-us))
- **WP**: [Wikipedia, Cluedo](https://en.wikipedia.org/wiki/Cluedo)
- **Board grid**: four open-source encodings compared cell by cell (k3vonk/UCD-Cluedo, HeycomRoy/Cluedo-text, hawadlu/Cluedo, ZeusExMachina/Swen225-Text-Based-Cluedo)

## Counts (all asserted in tests/game.test.js)

| Rule | Value | Source | Test |
|---|---|---|---|
| Cards | 6 suspects + 6 weapons + 9 rooms = 21 | PB1998 | card facts |
| Envelope | 1 of each kind | PB1998 | deal |
| Dealt | 18 cards, one at a time clockwise; with 4 players the hands are 5,5,4,4, and with 5 players 4,4,4,3,3 | PB1998 | deal |
| Players | 3 to 6; 2 with the room cards (below) | WP (classic box), H2016/H2023 | setup, house |
| Board | 24 × 25 squares, 188 hallway squares, 9 rooms, 17 doors | grid sources | board |
| Doors per room | Kitchen 1, Ballroom 4, Conservatory 1, Dining 2, Billiard 2, Library 2, Lounge 1, Hall 3, Study 1 | grid sources | board |
| Passages | Kitchen ↔ Study, Conservatory ↔ Lounge | UK1996, WP | board, passage |
| Known distance | Peacock's start → Billiard Room = 10 steps | WP (the 2016 board made it 9) | Peacock |
| Tokens | all 6 on the board even with fewer players | PB1998, H2023 | setup |

## Play

| Rule | How it's built | Source | Test |
|---|---|---|---|
| Scarlet starts; play goes clockwise | Seats are sorted in board order from Scarlet. If nobody is Scarlet, the next suspect round the board starts | PB1998, H2016 | suggestion |
| One die (Clue rules) | 1 die. The Cluedo and Newer settings use 2 | PB1998, UK1996, H2023 | rule sets |
| Moves are up/down/left/right, with no square used twice in a turn, and you can't move through or onto another token | Enforced in `reach()` | UK1996, H2016, H2023 | movement |
| Entering a room ends the move and needs no exact count | Enforced | PB1998 | movement |
| Can't leave and re-enter the same room in one turn | Enforced | PB1998 | movement |
| Secret passage instead of rolling, then suggest | Enforced | PB1998 | passage |
| Must be in the room you name | The room is always the room you're in | PB1998 | suggestion |
| No second suggestion from the same room unless your token was moved there (Clue rules) | Enforced. The Cluedo and Newer settings allow staying | PB1998, UK1996, H2023 | no-stay, rule sets |
| The named suspect's token and the weapon move into the room | Enforced | PB1998 | suggestion |
| Disprove clockwise from your left; the first player holding any of the three cards shows exactly one, privately | Enforced. The other players only see who showed | PB1998 | suggestion, secrecy |
| Nobody can show | Everyone passes, and you may accuse | PB1998 | nobody shows |
| Accuse on your turn, naming any room | Enforced (no room needed, as in PB1998) | PB1998 | accusations |
| Wrong accusation: you're out but still show cards; a token left in a doorway moves into the room | Enforced | PB1998 | accusations, doorway |
| Everyone accuses wrongly | The game ends with no winner | H2023 | accusations |

## Edge cases checked (2026-10-20, tests/edge.test.js)

| Situation | Behaviour | Source |
|---|---|---|
| Every exit of your room is blocked and you roll | The turn is spent, the token stays (the passage was still open before rolling) | PB1998 (tokens block hallway squares) |
| Your token is "pulled" into the room it is already in | Not a move: no free suggestion next turn under the Clue rules | PB1998 ("moved into a room by a suggestion") |
| Everyone else has accused wrongly | The last player keeps playing and must still accuse correctly | H2023 wording (see below) |
| You go out on turn 1 | The computers finish the game; out players still show cards | PB1998 |
| No rule gaps were found in this pass | | |

## Interpretations (the rules leave these open)

- **Stepping from the doorway square into the room costs 1 step.** PB1998 says the door "is not counted as a square", and that's how we read it. It reproduces the known "Peacock is 10 from the Billiard Room" fact.
- **Hallway moves must use the full roll under the Clue rules.** No primary source says this outright; it's the common reading. The **Newer** setting lets you move up to the roll (H2023).
- **The first players dealt to get the extra cards** ("deal clockwise", PB1998).
- **The last player left must still accuse correctly to win.** No source gives an automatic win (H2023 wording).

## Variants

| Setting | Dice | Stay to suggest again | Move up to the roll |
|---|---|---|---|
| Clue (classic US) | 1 | no | no |
| Cluedo (UK) | 2 | yes | no |
| Newer (2016/2023) | 2 | yes | yes |

The card names (Classic / Cluedo / 2016 / 2023) are a separate setting, following the WP edition table and H2023.

## Two players and house rules (2026-10-28, tests/house.test.js + tests/house.browser.mjs)

Each is off by default (2 players only when you pick 2) and works with every rule set, against computers and online.

| Option | How it's built | Source | Why this one |
|---|---|---|---|
| **2 players** | Before the deal, 4 of the 18 cards go face down into 4 different random rooms; 14 are dealt, 7 each. Walking (or taking a passage) into such a room lets you look at its card, once, secretly; the table only sees that you looked. Being pulled in by a suggestion doesn't count. | H2016 and H2023 "Two-player (or team) game" (same text in both; checked in the PDFs) | The official answer to "Clue needs 3"; the most asked-for missing mode |
| **Leftovers face up** (house rule) | With 4 or 5 players everyone gets the same number of cards (4 / 3) and the 2 / 3 left over lie face up for everyone. 3 and 6 players: no change | 2011 edition setup ("leftover cards may be placed faceup", summarised at [officialgamerules.org](https://officialgamerules.org/game-rules/clue/)); WP: the 2008 edition also deals evenly; the Clue card game does the same ([gamerules.com](https://gamerules.com/rules/clue-suspect-card-game/)) | The commonest fix for "uneven hands are unfair" |
| **Quick moves** (house rule) | No dice: on your turn, go straight into any room except the one you're in (secret passages still work). Rolling is never needed. | Closest written form: "Speed Moves" (move to an adjacent room or take a passage) at [ultraboardgames.com/clue/variants](https://ultraboardgames.com/clue/variants.php); H2023 also suggests corner rooms "for a speedier game". Ours is the broader "any room" reading | Cuts a 4-player game from ~35 to ~16 turns; pure deduction |

Not added: "suggest from anywhere" (makes the room card free to ask about, so it changes the deduction more than it speeds it up) and "accuse only in the centre" (the classic board's centre is not a room you can walk into).

How the notes and computers know these: the face-up cards / room cards are one more "pile" owner in the solver (`seatView` in js/knowledge.js); the pile never answers a question (`players` in `rankSuggestions`). Ladder per option: data/strength.json `house`.

## Not built (on purpose)

- **UK answering to the right.** UK1996 has the player on your right answer first. We always go to the left.
- **The 2016+ board changes** (Peacock 9 steps, the squared-off Conservatory door). The classic grid is used for every edition.
- **Magnifier dice faces and Clue cards** (H2016, H2023). (The 2-player variant was added 2026-10-28, above.)
- **Rolling for first player** (UK1996, H2023). Scarlet always starts.

## Status

Every row above has a passing test. All 21 tests were also seen **failing** against deliberately broken copies of the engine (5 mutation runs, 2026-10-19).
