/* The case-file reveal: when a game ends, the envelope opens and its three cards slide out, drawn large,
 * before the result sheet. Original art only. Skipped with Animations off or reduced motion; a tap skips it. */
import { cardSvg } from "./art.js";
import { cardName } from "./cards.js";

const envelopeSvg = () => `<svg class="rv-env" viewBox="0 0 220 150" aria-hidden="true">
  <rect x="4" y="10" width="212" height="136" rx="6" fill="#c9a66b" stroke="#6b4e24" stroke-width="2.5"/>
  <path d="M4 16 110 92 216 16" fill="none" stroke="#8a6a35" stroke-width="2" opacity=".55"/>
  <rect x="58" y="96" width="104" height="30" rx="3" fill="none" stroke="#7d2433" stroke-width="3" transform="rotate(-6 110 111)"/>
  <text x="110" y="118" text-anchor="middle" font-size="17" font-weight="900" letter-spacing="3" fill="#7d2433" font-family="Georgia, 'Times New Roman', serif" transform="rotate(-6 110 111)">CASE FILE</text>
</svg>`;
const flapSvg = () => `<svg class="rv-flap" viewBox="0 0 220 80" aria-hidden="true"><path d="M4 6Q4 2 8 2h204q4 0 4 4L110 76z" fill="#b8955a" stroke="#6b4e24" stroke-width="2.5" stroke-linejoin="round"/><circle cx="110" cy="58" r="9" fill="#7d2433"/><circle cx="110" cy="58" r="5" fill="none" stroke="#b5485a" stroke-width="1.5"/></svg>`;

/**
 * Show the scene. opts: { cards: [suspect, weapon, room], edition, title, FX }.
 * Resolves when it has finished or been tapped away.
 */
export function revealScene({ cards, edition, title, FX }) {
  const motion = FX && FX.settings && FX.settings.animations !== false && !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  if (!motion || !cards || cards.length !== 3) return Promise.resolve();
  const fast = FX.settings.animSpeed === "fast" ? 0.6 : 1;
  const el = document.createElement("div");
  el.className = "reveal";
  el.style.setProperty("--sp", fast);
  const words = [cardName(edition, cards[0]), "with the " + cardName(edition, cards[1]), "in the " + cardName(edition, cards[2])];
  el.innerHTML = `<div class="rv-stage">
      <div class="rv-title">${title}</div>
      <div class="rv-cards">${cards.map((c, i) => `<div class="rv-card" style="--i:${i}">${cardSvg(edition, c)}</div>`).join("")}</div>
      <div class="rv-pack">${envelopeSvg()}${flapSvg()}</div>
      <div class="rv-words">${words.map((w, i) => `<span style="--i:${i}">${w}</span>`).join(" ")}</div>
      <div class="rv-tap">Tap to continue</div>
    </div>`;
  document.body.appendChild(el);
  // sounds: the flap, then each card sliding out
  const T = (ms) => ms * fast;
  const timers = [];
  try {
    timers.push(setTimeout(() => FX.play("whoosh"), T(250)));
    [0, 1, 2].forEach((i) => timers.push(setTimeout(() => FX.play("cardSlide"), T(700 + i * 380))));
  } catch (e) {}
  return new Promise((done) => {
    let over = false;
    const end = () => {
      if (over) return; over = true;
      timers.forEach(clearTimeout);
      el.classList.add("out");
      setTimeout(() => { el.remove(); done(); }, 260);
    };
    el.addEventListener("click", end);
    timers.push(setTimeout(end, T(3900)));
  });
}
