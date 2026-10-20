/* Learn: the rules in short, how the notes think, and measured numbers. */
import { help, heat } from "./ui.js";

let done = false;
export async function initLearn(el) {
  if (done) return;
  done = true;
  let S = null;
  try { S = await (await fetch("data/strength.json?v=1")).json(); } catch (e) { S = null; }
  const bar = (p) => `<div class="meter"><i style="width:${Math.round(p * 100)}%;background:${heat(p * 1.6)}"></i></div>`;
  const strength = S ? `
    <div class="panel"><h2>How strong are the computers? ${help("How this was measured", S.how)}</h2>
      ${S.vs.map((r) => `<div class="stat"><span>${r.label}</span><b>${Math.round(r.win * 100)}%</b></div>${bar(r.win)}<div class="muted" style="font-size:12px;margin-bottom:6px">${r.note}</div>`).join("")}
    </div>
    <div class="panel"><h2>Does going first help? ${help("Seat order", S.seatHow)}</h2>
      ${S.seat.map((p, i) => `<div class="stat"><span>${i === 0 ? "First player" : "Player " + (i + 1)}</span><b>${Math.round(p * 100)}%</b></div>${bar(p)}`).join("")}
      <p class="muted" style="font-size:13px">${S.seatNote}</p>
    </div>
    <div class="panel"><h2>How long does a game take?</h2><p>${S.length}</p></div>` : "";
  el.innerHTML = `<div class="page">
    <h2>How to play</h2>
    <div class="panel"><ol style="margin:0;padding-left:20px">
      <li>One suspect, one weapon and one room card go secretly into the case file. The rest are dealt out.</li>
      <li>On your turn, roll and move, or take a secret passage from a corner room.</li>
      <li>When you walk into a room, you may suggest: "it was <i>this person</i> with <i>this weapon</i> in <i>this room</i>". The suspect and the weapon are brought into the room.</li>
      <li>Going clockwise, the first player holding any of those cards shows you exactly one, secretly.</li>
      <li>When you are sure, accuse. Right: you win. Wrong: you're out, but you still show cards.</li>
    </ol></div>
    <h2>How the notes think</h2>
    <div class="panel"><p>There are 6 × 6 × 9 = <b>324</b> possible answers. The notes don't guess: they count every way the 21 cards could have been dealt that fits everything you have seen, then report the share of those deals where each card sits in each place.</p>
      <p>Example: with 6 players and no information, there are 324 × 137,225,088,000 possible deals. As players pass and show cards, deals that don't fit are thrown out.</p>
      <p><b>Bits.</b> 324 answers is about 8.3 bits of mystery (2<sup>8.3</sup> ≈ 324). A question worth 1 bit halves the answers that are left on average. The best question is the one with the most bits.</p></div>
    <h2>Good habits</h2>
    <div class="panel"><ul style="margin:0;padding-left:20px">
      <li><b>Ask about one of your own cards</b> to learn about the other two: nobody can show the one you hold.</li>
      <li><b>When you must show</b>, show a card that player has already seen. It tells them nothing new.</li>
      <li><b>Watch who passes.</b> A pass rules out all three cards for that player — often worth more than a card shown to someone else.</li>
      <li><b>Corner rooms</b> have secret passages: a free trip across the board.</li>
    </ul></div>
    ${strength}
    <p class="muted" style="font-size:12px">Fan-made study tool. Not affiliated with any game publisher. All art drawn for this site.</p>
  </div>`;
}
