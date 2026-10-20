/* Clue's sounds and effects: turns two public snapshots into game events, maps each event to
   sounds (paced with the board's own animations), and plays them through FX (js/fx.js).
   Online and local games both go through here, so every player hears the same table. */
import { walkPath } from "./boardview.js";

/** Clue's own synthesised sounds, on top of fx.js's palette. */
export function defineSounds(FX) {
  // a soft footstep on carpet: low thud + muffled scuff
  FX.define("step", (k) => { k.noise({ f: 380, f2: 200, filter: "lowpass", q: 0.7, dur: 0.09, vol: 0.5 }); k.tone({ f: 85, f2: 55, dur: 0.07, vol: 0.22 }); }, "moves");
  // a door creaking open, then settling
  FX.define("creak", (k) => {
    k.tone({ f: 220, f2: 340, dur: 0.5, a: 0.04, vol: 0.07, type: "sawtooth", lp: 1200 });
    k.tone({ f: 233, f2: 310, dur: 0.45, a: 0.05, vol: 0.05, type: "sawtooth", lp: 1000, at: 0.05 });
    k.noise({ f: 900, f2: 1400, q: 6, dur: 0.5, a: 0.05, vol: 0.12 });
    k.tone({ f: 110, f2: 70, dur: 0.1, vol: 0.22, at: 0.5 });
  }, "moves");
  // the suggestion sting: dun, dun, DUNN (a low diminished chord)
  FX.define("sting", (k) => {
    k.tone({ f: 196, dur: 0.16, vol: 0.1, type: "sawtooth", lp: 1100 });
    k.tone({ f: 185, dur: 0.16, vol: 0.1, type: "sawtooth", lp: 1100, at: 0.18 });
    [175, 208, 247].forEach((f) => k.tone({ f, dur: 0.7, vol: 0.075, type: "sawtooth", lp: 1300, at: 0.38 }));
    k.tone({ f: 87, dur: 0.6, vol: 0.18, at: 0.38 });
  }, "moves");
  // someone asks YOU to show a card
  FX.define("prompt", (k) => { k.tone({ f: 659, dur: 0.22, vol: 0.14, type: "triangle" }); k.tone({ f: 659, dur: 0.3, vol: 0.14, type: "triangle", at: 0.16 }); }, "alerts");
  // a pencil mark on the detective notes
  FX.define("scribble", (k) => { [0, 0.07, 0.13].forEach((at, i) => k.noise({ f: 3200 + i * 500, f2: 4200 - i * 300, q: 1.5, dur: 0.05, vol: 0.16, at })); }, "moves");
}

/** When the dealt cards land in your hand (ms after the deal starts, then one every DEAL_GAP). */
export const DEAL_AT = 260, DEAL_GAP = 75;

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isFresh = (pub) => pub.turnNo === 1 && !pub.log.length && pub.last == null;

/** What happened between two public snapshots, as seen by seat `me`. */
export function eventsFor(pp, pub, me) {
  const ev = [];
  if (!pub) return ev;
  const newGame = !pp || pp.n !== pub.n || pub.turnNo < pp.turnNo || (pp.over && !pub.over);
  if (newGame) {
    if (isFresh(pub)) {
      ev.push({ t: "deal", n: me >= 0 ? pub.sizes[me] : 0 });
      if (pub.turn === me && pub.phase === "start") ev.push({ t: "yourTurn" });
    }
    return ev;
  }
  const L = pub.last;
  if (L && !same(pp.last, L)) {
    if (L.t === "roll") ev.push({ t: "roll", by: L.by, dice: L.dice.length });
    else if (L.t === "move" && pp.turnNo === pub.turnNo) {
      const sus = pub.chars[L.by];
      const blocked = new Set(); pp.pos.forEach((p, i) => { if (i !== sus && p.sq != null) blocked.add(p.sq); });
      const steps = walkPath(pp.pos[sus], pub.pos[sus], blocked).length;
      ev.push({ t: "move", by: L.by, steps, room: pub.pos[sus].room != null });
    } else if (L.t === "passage") ev.push({ t: "passage", by: L.by });
    else if (L.t === "suggest") {
      ev.push({ t: "suggest", by: L.by, passes: pub.sugg ? pub.sugg.passes.length : 0, summoned: !same(pp.pos[L.moved], pub.pos[L.moved]) });
    } else if (L.t === "suggestDone") {
      const r = pub.log[L.i];
      const already = !!(pp.last && pp.last.t === "suggest" && pp.phase === "disprove" && pp.sugg && pp.sugg.by === r.by);
      const moved = r.cards[0];
      ev.push({ t: "suggestDone", by: r.by, fresh: !already, passes: already ? 0 : r.passes.length, shower: r.shower,
        toMe: r.by === me, summoned: !already && !same(pp.pos[moved], pub.pos[moved]) });
    } else if (L.t === "accuse") ev.push({ t: "accuse", by: L.by, correct: !!L.correct, mine: L.by === me });
  }
  if (pub.phase === "disprove" && pub.sugg && pub.sugg.asking === me && !(pp.phase === "disprove" && pp.sugg && pp.sugg.asking === me)) ev.push({ t: "mustShow" });
  if (!pub.over && me >= 0 && pub.turn === me && pub.phase === "start" && !pub.out[me] && pp.turnNo !== pub.turnNo) ev.push({ t: "yourTurn" });
  if (pub.over && !pp.over) ev.push({ t: "over", winner: pub.winner, kind: me >= 0 && pub.winner === me ? "win" : "lose" });
  return ev;
}

/** The sounds for one event, with start times in ms. `anim` false = pieces jump, so no walk. */
export function soundsFor(e, o = {}) {
  const stepMs = o.stepMs || 110, anim = o.anim !== false;
  const s = [];
  const add = (name, at, opts) => s.push({ name, at: Math.round(at), opts });
  const ask = (passes, start) => { let t = start; for (let i = 0; i < passes; i++) { add("place", t, { vol: 0.55, pitch: 0.8 }); t += 150; } return t; };
  switch (e.t) {
    case "deal": add("shuffle", 0); for (let i = 0; i < e.n; i++) add("cardDeal", DEAL_AT + i * DEAL_GAP); break;
    case "roll": add("diceRoll", 0); for (let i = 0; i < e.dice; i++) add("diceLand", 400 + i * 70); break;
    case "move":
      if (anim) { for (let i = 0; i < e.steps; i++) add("step", i * stepMs, { pitch: i % 2 ? 1.06 : 0.94 }); if (e.room) add("creak", e.steps * stepMs); }
      else add(e.room ? "creak" : "place", 0);
      break;
    case "passage": add("whoosh", 0); break;
    case "suggest": add("sting", 0); if (e.summoned) add("slide", 380); ask(e.passes, 650); break;
    case "suggestDone": {
      let t = 0;
      if (e.fresh) { add("sting", 0); if (e.summoned) add("slide", 380); t = ask(e.passes, 650); }
      if (e.shower != null) add(e.toMe ? "cardFlip" : "cardSlide", t + 60);
      else add("ding", t + 60);
      break;
    }
    case "accuse": add("drumroll", 0); if (!e.correct) add("stamp", 950); break;
    case "mustShow": add("prompt", 0); break;
    case "yourTurn": add("turn", 0); break;
  }
  return s;
}

/** Play a batch of events: sounds one after another, plus the matching animations.
 *  ctx: { later(fn, ms), stepMs, me, pub, el: { chip(seat), bar() }, fly(fromSeat, toSeat), deal(), colors(seat), overMs } */
export function perform(events, FX, ctx) {
  const later = ctx.later || ((f, ms) => setTimeout(f, ms));
  const el = ctx.el || {};
  const anim = !!(FX.settings && FX.settings.animations);
  let t0 = 0;
  for (const e of events) {
    const list = soundsFor(e, { stepMs: ctx.stepMs, anim });
    for (const x of list) later(() => FX.play(x.name, x.opts), t0 + x.at);
    const end = list.length ? list[list.length - 1].at : 0;
    try {
      if ((e.t === "suggest" || (e.t === "suggestDone" && e.fresh)) && el.chip) later(() => { const c = el.chip(e.by); if (c) FX.pulse(c); }, t0);
      if (e.t === "suggestDone" && e.shower != null && ctx.fly) later(() => ctx.fly(e.shower, e.by), t0 + end);
      if (e.t === "accuse" && !e.correct && el.chip) later(() => { const c = el.chip(e.by); if (c) { FX.shake(c); FX.flash(c, "var(--bad)"); } }, t0 + 950);
      if (e.t === "yourTurn" && el.bar) later(() => { const b = el.bar(); if (b) FX.flash(b, "var(--accent)"); }, t0);
      if (e.t === "deal" && ctx.deal) later(() => ctx.deal(), 0);
      if (e.t === "over") {
        const colors = ctx.colors && e.winner >= 0 ? ctx.colors(e.winner) : undefined;
        later(() => FX.celebrate({ kind: e.kind, colors }), ctx.overMs != null ? ctx.overMs : 950);
      }
    } catch (err) { /* effects never break the game */ }
    // the next event's sounds start after this one's (e.g. your-turn chime after a drumroll)
    if (list.length && e.t !== "deal") t0 += end + (e.t === "accuse" ? 500 : e.t === "move" ? 250 : 200);
  }
}
