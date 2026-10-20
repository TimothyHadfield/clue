/* The classic 24 x 25 board, cross-checked cell by cell against four independent
 * open-source encodings (see docs/rules-check.md). Row 0 is the Kitchen /
 * Ballroom / Conservatory side. '.' hallway, '#' off the board, X the middle,
 * K B C D I L O H S rooms, 1-6 start squares (Scarlet, Mustard, White, Green, Peacock, Plum). */
export const BOARD_TEXT = `
#########3####4#########
KKKKKK#...BBBB...#CCCCCC
KKKKKK..BBBBBBBB..CCCCCC
KKKKKK..BBBBBBBB..CCCCCC
KKKKKK..BBBBBBBB..CCCCCC
KKKKKK..BBBBBBBB...CCCC#
#KKKKK..BBBBBBBB.......5
........BBBBBBBB.......#
#.................IIIIII
DDDDD.............IIIIII
DDDDDDDD..XXXXX...IIIIII
DDDDDDDD..XXXXX...IIIIII
DDDDDDDD..XXXXX...IIIIII
DDDDDDDD..XXXXX........#
DDDDDDDD..XXXXX...LLLLL#
DDDDDDDD..XXXXX..LLLLLLL
#.........XXXXX..LLLLLLL
2................LLLLLLL
#........HHHHHH...LLLLL#
OOOOOOO..HHHHHH........6
OOOOOOO..HHHHHH........#
OOOOOOO..HHHHHH..SSSSSSS
OOOOOOO..HHHHHH..SSSSSSS
OOOOOOO..HHHHHH..SSSSSSS
OOOOOO#1##HHHH##.#SSSSSS
`;

// [room, room square row, col, hallway square row, col] — 17 doors
export const DOORS = [
  ["K", 6, 4, 7, 4],
  ["B", 5, 8, 5, 7], ["B", 5, 15, 5, 16], ["B", 7, 9, 8, 9], ["B", 7, 14, 8, 14],
  ["C", 4, 18, 5, 18],
  ["D", 12, 7, 12, 8], ["D", 15, 6, 16, 6],
  ["I", 9, 18, 9, 17], ["I", 12, 22, 13, 22],
  ["L", 14, 20, 13, 20], ["L", 16, 17, 16, 16],
  ["O", 19, 6, 18, 6],
  ["H", 18, 11, 17, 11], ["H", 18, 12, 17, 12], ["H", 20, 14, 20, 15],
  ["S", 21, 17, 20, 17],
];

export const PASSAGES = [["K", "S"], ["C", "O"]];
