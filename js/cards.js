/* Card facts. Index order is fixed: 0-5 suspects, 6-11 weapons, 12-20 rooms.
 * Suspect order is the turn order clockwise around the board, Scarlet first. */

export const EDITIONS = {
  classic: {
    label: "Classic",
    suspects: ["Miss Scarlet", "Colonel Mustard", "Mrs. White", "Mr. Green", "Mrs. Peacock", "Professor Plum"],
    short: ["Scarlet", "Mustard", "White", "Green", "Peacock", "Plum"],
    weapons: ["Candlestick", "Knife", "Lead Pipe", "Revolver", "Rope", "Wrench"],
    rooms: ["Kitchen", "Ballroom", "Conservatory", "Dining Room", "Billiard Room", "Library", "Lounge", "Hall", "Study"],
  },
  uk: {
    label: "Cluedo",
    suspects: ["Miss Scarlett", "Colonel Mustard", "Mrs White", "Reverend Green", "Mrs Peacock", "Professor Plum"],
    short: ["Scarlett", "Mustard", "White", "Green", "Peacock", "Plum"],
    weapons: ["Candlestick", "Dagger", "Lead Piping", "Revolver", "Rope", "Spanner"],
    rooms: ["Kitchen", "Ball Room", "Conservatory", "Dining Room", "Billiard Room", "Library", "Lounge", "Hall", "Study"],
  },
  y2016: {
    label: "2016",
    suspects: ["Miss Scarlett", "Colonel Mustard", "Dr. Orchid", "Mr. Green", "Mrs. Peacock", "Professor Plum"],
    short: ["Scarlett", "Mustard", "Orchid", "Green", "Peacock", "Plum"],
    weapons: ["Candlestick", "Dagger", "Lead Pipe", "Revolver", "Rope", "Wrench"],
    rooms: ["Kitchen", "Ballroom", "Conservatory", "Dining Room", "Billiard Room", "Library", "Lounge", "Hall", "Study"],
  },
  y2023: {
    label: "2023",
    suspects: ["Miss Scarlett", "Colonel Mustard", "Chef White", "Mayor Green", "Solicitor Peacock", "Professor Plum"],
    short: ["Scarlett", "Mustard", "White", "Green", "Peacock", "Plum"],
    weapons: ["Candlestick", "Dagger", "Lead Pipe", "Revolver", "Rope", "Wrench"],
    rooms: ["Kitchen", "Ballroom", "Conservatory", "Dining Room", "Billiard Room", "Library", "Lounge", "Hall", "Study"],
  },
};

/** Rule sets (setup choices). The board is always the classic one. */
export const RULESETS = {
  classic: { label: "Clue", dice: 1, stay: false, upTo: false },
  uk: { label: "Cluedo", dice: 2, stay: true, upTo: false },
  modern: { label: "Newer", dice: 2, stay: true, upTo: true },
};

// token colours (own palette, readable on the dark board)
export const SUSPECT_COLORS = ["#e0464f", "#e8c24a", "#f2f2ee", "#3fae6a", "#3f7fe0", "#8d5bd6"];

export const ROOM_INDEX = { Kitchen: 0, Ballroom: 1, Conservatory: 2, "Dining Room": 3, "Billiard Room": 4, Library: 5, Lounge: 6, Hall: 7, Study: 8 };

export function cardName(ed, c) {
  const E = EDITIONS[ed] || EDITIONS.classic;
  if (c < 6) return E.suspects[c];
  if (c < 12) return E.weapons[c - 6];
  return E.rooms[c - 12];
}
export function shortName(ed, c) {
  const E = EDITIONS[ed] || EDITIONS.classic;
  if (c < 6) return E.short[c];
  return cardName(ed, c);
}
export const SUSPECTS = [0, 1, 2, 3, 4, 5];
export const WEAPONS = [6, 7, 8, 9, 10, 11];
export const ROOMS = [12, 13, 14, 15, 16, 17, 18, 19, 20];
export const roomCard = (r) => 12 + r;
