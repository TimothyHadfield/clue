/* The guided first game (shared _coach kit, js/coach.js) and the rules sheet, in our own words. */

/** The guided game: you are Miss Scarlet against two Easy computers, Clue rules; your first rolls reach a room. */
export const TUTORIAL = { seed: 20261027, players: 3, me: 0, level: 0, rules: "classic" };

/**
 * Steps follow the game's own state. ctx.snap() is the guided game's latest snapshot (null otherwise),
 * ctx.wide() is true on a laptop, where the notes sit beside the board.
 */
export function tutorialSteps(ctx) {
  const my = () => { const s = ctx.snap(); return s && s.myTurn && !s.pub.over ? s.pub.phase : null; };
  const asked = () => { const s = ctx.snap(); return !!s && s.pub.log.some((r) => r.t === "suggest" && r.by === s.mySeat); };
  const notesAt = () => (ctx.wide() ? "#side" : "#notesBtn");
  return [
    { title: "Your cards", target: "#hand", next: true,
      text: "These are your cards. A card in your hand can't be in the case file, so your notes have already crossed them off." },
    { title: "Your notes", target: notesAt, next: true,
      text: "Your detective sheet fills itself in as the game goes. ✓ means certain, ✗ means ruled out, and the % is the chance a card is in the case file." },
    { title: "Roll", target: "#bRoll", when: () => my() === "start", until: () => my() === "move" || my() === "suggest" || my() === "post",
      text: "It's your turn. Tap Roll." },
    { title: "Move", target: "#bw", when: () => my() === "move", until: () => my() !== "move",
      text: "The lit squares and rooms are where you can go. Tap a lit room if there is one, or the lit square closest to a room." },
    { title: "Head for a room", target: "#bEnd", when: () => my() === "post", skipIf: () => my() === "suggest" || asked(), until: () => my() !== "post",
      text: "Questions are asked in rooms. Tap End turn: the computers play, then roll again and walk into a room." },
    { title: "Ask a question", target: "#bSug", when: () => my() === "suggest" || (my() === "start" && !!document.querySelector("#bSug")), until: asked,
      text: "You're in a room, so you can suggest who did it and with what. Tap Suggest, pick a suspect and a weapon (Best question picks the most useful pair), then Suggest." },
    { title: "The answer", target: notesAt, when: () => asked() && !document.querySelector("#overlay.on"), next: true,
      text: "Going round the table, the first player holding one of your three cards shows you one, secretly. Your notes have marked it." },
    { title: "Accuse when sure", target: "#bAcc", when: () => !!document.querySelector("#bAcc"), next: true,
      text: "Keep asking in different rooms. When your notes show one answer at 100%, tap Accuse. Right wins the game; wrong puts you out." },
  ];
}

/** The rulebook in short sections (our own words), with the names of the chosen edition. */
export function rulesSheet(E) {
  const s = E.suspects, w = E.weapons, r = E.rooms;
  return {
    title: "Clue rules",
    intro: "Two to six players race to work out who did it, with which weapon, in which room.",
    foot: "Fan-made summary in our own words. Not affiliated with any game publisher.",
    sections: [
      { id: "goal", title: "The goal", short: "Goal", html: `<p>One suspect card, one weapon card and one room card are hidden in the case file. Be the first to name all three correctly.</p>
        <p>There are 6 suspects (${s.join(", ")}), 6 weapons (${w.join(", ")}) and 9 rooms (${r.join(", ")}).</p>` },
      { id: "setup", title: "Setting up", short: "Setup", html: `<p>Shuffle each kind of card on its own and slide one of each, unseen, into the case file. Shuffle the other 18 together and deal them all out, one at a time. Some players may get one more card than others.</p>
        <p>Each player moves the pawn of their suspect. Every pawn starts on its own start square, even suspects nobody plays. The weapons start in different rooms.</p>
        <p class="tip">The first player is the one playing ${s[0]}; play then goes clockwise.</p>` },
      { id: "turn", title: "Your turn", short: "Turn", html: `<ol><li>Roll and move, or take a secret passage if you start in a corner room.</li><li>If you end up in a room, you may make a suggestion there.</li><li>At any point in your turn you may accuse.</li></ol>` },
      { id: "move", title: "Moving", short: "Move", html: `<p>Move one square at a time, up, down or sideways, never diagonally, and never onto or through another pawn's square. Enter and leave rooms only through doors. Walking through a door ends your move, even with steps left over.</p>
        <p>The corner rooms are joined by secret passages: ${r[0]} with ${r[8]}, and ${r[2]} with ${r[6]}. Taking one is your whole move.</p>
        <p>Under Clue rules you can't suggest in the same room on two turns in a row: leave first (Cluedo and Newer rules let you stay). If someone else's suggestion brings your pawn into a room, you may suggest there on your next turn without moving.</p>` },
      { id: "suggest", title: "Suggesting", short: "Suggest", html: `<p>In a room, say "I suggest it was <i>this suspect</i> with <i>this weapon</i> in <i>this room</i>". The room is always the one you're in. The named suspect's pawn and the weapon are brought into the room.</p>
        <p>The player on your left checks their hand. If they hold one or more of the three cards, they show you exactly one, secretly. If not, they say so and the next player checks, until someone shows you a card or everyone has passed.</p>
        <p class="tip">You may name cards you hold yourself. Nobody can show those, so you learn about the other two.</p>` },
      { id: "show", title: "Showing a card", short: "Show", html: `<p>If you hold more than one of the named cards, you choose which one to show. Only the player who asked sees it.</p>
        <p class="tip">Show a card that player has already seen from you when you can: it tells them nothing new.</p>` },
      { id: "accuse", title: "Accusing", short: "Accuse", html: `<p>When you think you know, accuse: name a suspect, a weapon and any room, then look in the case file without showing anyone.</p>
        <p>Right: you win. Wrong: put the cards back. You're out and can't move, suggest or accuse again, but you still show cards when asked. If everyone accuses wrongly, nobody wins.</p>` },
      { id: "sets", title: "Rule sets", short: "Rule sets", html: `<table><tr><th></th><th>Dice</th><th>Stay in a room</th><th>Move</th></tr>
        <tr><td>Clue</td><td>1</td><td>No</td><td>The full roll in the hallway</td></tr>
        <tr><td>Cluedo</td><td>2</td><td>Yes</td><td>The full roll in the hallway</td></tr>
        <tr><td>Newer</td><td>2</td><td>Yes</td><td>Up to the roll</td></tr></table>
        <p>Choose the rule set in Settings. It applies to new games.</p>` },
      { id: "house", title: "Two players and house rules", short: "House rules", html: `<p><b>Two players.</b> Before dealing, four of the 18 cards go face down into four different rooms; the other 14 are dealt, 7 each. When you walk into a room that holds a card, you look at it secretly. Pick 2 players on the Play screen.</p>
        <p><b>Leftover cards face up</b> (house rule). With 4 or 5 players everyone gets the same number of cards, and the 2 or 3 left over lie face up for all to see.</p>
        <p><b>Quick moves</b> (house rule). No dice: on your turn, go straight to any other room.</p>
        <p>Turn the house rules on in Settings. They apply to new games, also online.</p>` },
      { id: "videos", title: "Videos", short: "Videos", html: `<ul class="vids">
        <li><a href="https://www.youtube.com/watch?v=Vib1LsK4Ln4" target="_blank" rel="noopener">How to play Clue, full tutorial</a> · Watch It Played</li>
        <li><a href="https://www.youtube.com/watch?v=4zUx5uNVsJs" target="_blank" rel="noopener">How to play Clue in 4 minutes (2024 rules)</a> · Triple S Games</li>
        <li><a href="https://www.youtube.com/watch?v=DN5JGrxSC1E" target="_blank" rel="noopener">Advanced tips and strategies</a> · Puzzling Games</li>
        <li><a href="https://www.youtube.com/watch?v=g_F5H7sYd3Y" target="_blank" rel="noopener">Note-taking: the number system</a> · What's What</li></ul>
        <p class="tip">These open YouTube in a new tab.</p>` },
      { id: "notes", title: "Your notes", short: "Notes", html: `<p>The notes count every way the cards could have been dealt that fits what you've seen. ✓ means certain, ✗ means ruled out, and a % is the share of possible deals where that card is in that place.</p>
        <p>Best question picks the suspect and weapon whose answer would narrow things down the most. Using it, Best guess or Undo makes a game "with help" in My stats, so it doesn't change your rating.</p>` },
    ],
  };
}
