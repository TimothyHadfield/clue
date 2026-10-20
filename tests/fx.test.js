// Sounds, celebrations and animations: the event -> sound map for a scripted game, the Settings
// switches (Sound off = no audio, Animations off = no animation), and the end-of-game celebration.
import test from "node:test";
import assert from "node:assert/strict";
import { game } from "../js/game.js";
import { mulberry32 } from "../js/solver.js";

// a fake Web Audio context that counts nodes, so "no sound" can be measured
class FakeParam { setValueAtTime() {} linearRampToValueAtTime() {} exponentialRampToValueAtTime() {} setTargetAtTime() {} }
class FakeNode { constructor() { this.gain = new FakeParam(); this.frequency = new FakeParam(); this.Q = new FakeParam(); this.pan = new FakeParam(); } connect() {} start() {} stop() {} }
class FakeAC {
  constructor() { this.state = "running"; this.currentTime = 0; this.sampleRate = 8000; this.destination = new FakeNode(); FakeAC.made++; }
  createGain() { return new FakeNode(); } createOscillator() { return new FakeNode(); } createBiquadFilter() { return new FakeNode(); }
  createBufferSource() { return new FakeNode(); } createDynamicsCompressor() { return new FakeNode(); }
  createBuffer(c, n) { return { getChannelData: () => new Float32Array(n) }; } resume() { return Promise.resolve(); }
}
FakeAC.made = 0;
globalThis.AudioContext = FakeAC;
await import("../js/fx.js");
const FX = globalThis.FX;
const { eventsFor, soundsFor, perform, defineSounds } = await import("../js/sfx.js");
FX.init({ game: "clue-test", clicks: false });
defineSounds(FX);

/** Play a seeded game with computers, collecting each public snapshot (like the page receives). */
function scriptedGame(seed = 7, n = 4) {
  const rng = mulberry32(seed);
  let st = game.setup(n, { chars: [0, 1, 2, 3].slice(0, n), levels: [1, 1, 1, 1] }, rng, []);
  const pubs = [JSON.parse(JSON.stringify(game.publicView(st)))];
  for (let k = 0; k < 4000 && !st.over; k++) {
    const seat = game.toAct(st)[0];
    const a = game.bot({ pub: game.publicView(st), mine: game.privateView(st, seat), state: st }, seat, rng);
    st = game.apply(JSON.parse(JSON.stringify(st)), seat, a, rng);
    pubs.push(JSON.parse(JSON.stringify(game.publicView(st))));
  }
  return pubs;
}

function spyFX() {
  const calls = { play: [], celebrate: [], anim: [] };
  const fake = {
    settings: { animations: true },
    play: (name, o) => { calls.play.push(name); return true; },
    celebrate: (o) => { calls.celebrate.push(o.kind); return Promise.resolve(); },
    pop: () => { calls.anim.push("pop"); return Promise.resolve(); },
    shake: () => { calls.anim.push("shake"); return Promise.resolve(); },
    pulse: () => { calls.anim.push("pulse"); return Promise.resolve(); },
    flash: () => { calls.anim.push("flash"); return Promise.resolve(); },
    flyTo: () => { calls.anim.push("flyTo"); return Promise.resolve(); },
    define: () => true,
  };
  return { fake, calls };
}
const now = (fn) => fn();   // run scheduled sounds at once

test("event -> sound map: a scripted game fires the right sounds in order", () => {
  const pubs = scriptedGame(7);
  const me = 0;
  const { fake, calls } = spyFX();
  const seen = new Set();
  for (let i = 1; i < pubs.length; i++) {
    const evs = eventsFor(pubs[i - 1], pubs[i], me);
    evs.forEach((e) => seen.add(e.t));
    perform(evs, fake, { later: now, stepMs: 110, me, pub: pubs[i] });
  }
  // every roll is a dice roll then one landing per die
  const rolls = pubs.filter((p, i) => i && p.last && p.last.t === "roll" && JSON.stringify(p.last) !== JSON.stringify(pubs[i - 1].last)).length;
  assert.ok(rolls > 0);
  assert.equal(calls.play.filter((s) => s === "diceRoll").length, rolls);
  assert.equal(calls.play.filter((s) => s === "diceLand").length, rolls);   // 1 die in Clue rules
  // walking makes footsteps; entering a room creaks the door
  assert.ok(calls.play.filter((s) => s === "step").length > rolls, "footsteps per square");
  assert.ok(calls.play.includes("creak"), "door creak");
  // a suggestion is a sting, a card shown is a card sound
  const suggestions = pubs[pubs.length - 1].log.filter((r) => r.t === "suggest").length;
  assert.equal(calls.play.filter((s) => s === "sting").length, suggestions);
  const shows = pubs[pubs.length - 1].log.filter((r) => r.t === "suggest" && r.shower != null).length;
  assert.equal(calls.play.filter((s) => s === "cardFlip" || s === "cardSlide").length, shows);
  // the accusation is a drumroll
  const accs = pubs[pubs.length - 1].log.filter((r) => r.t === "accuse").length;
  assert.equal(calls.play.filter((s) => s === "drumroll").length, accs);
  // your-turn chime only when it becomes seat 0's turn (not every turn)
  const myTurns = pubs.filter((p, i) => i && p.turn === me && p.phase === "start" && !p.over && pubs[i - 1].turnNo !== p.turnNo).length;
  assert.equal(calls.play.filter((s) => s === "turn").length, myTurns);
  assert.ok(seen.has("over"));
});

test("soundsFor: a roll with 2 dice lands twice, after the tumble; a walk paces its steps", () => {
  const s = soundsFor({ t: "roll", dice: 2 }, { stepMs: 110, anim: true });
  assert.deepEqual(s.map((x) => x.name), ["diceRoll", "diceLand", "diceLand"]);
  assert.ok(s[1].at >= 350 && s[2].at > s[1].at);
  const w = soundsFor({ t: "move", steps: 5, room: true }, { stepMs: 100, anim: true });
  assert.deepEqual(w.map((x) => x.name), ["step", "step", "step", "step", "step", "creak"]);
  assert.deepEqual(w.map((x) => x.at), [0, 100, 200, 300, 400, 500]);
  // Animations off: the token jumps, so one knock instead of a walk
  assert.deepEqual(soundsFor({ t: "move", steps: 5, room: false }, { stepMs: 100, anim: false }).map((x) => x.name), ["place"]);
});

test("game over: celebrate 'win' for the winner's page, 'lose' for everyone else", () => {
  const pubs = scriptedGame(7);
  const last = pubs[pubs.length - 1], prev = pubs[pubs.length - 2];
  assert.ok(last.over && last.winner >= 0);
  for (let me = 0; me < last.n; me++) {
    const { fake, calls } = spyFX();
    perform(eventsFor(prev, last, me), fake, { later: now, stepMs: 110, me, pub: last });
    assert.deepEqual(calls.celebrate, [me === last.winner ? "win" : "lose"], "seat " + me);
  }
});

test("Settings: Sound off = no audio at all; Game sounds off = no game sounds; Animations off = no animation", async () => {
  FX.reset();
  FX.unlock();                                   // the user's first tap
  assert.equal(FakeAC.made, 1);
  const pubs = scriptedGame(11);
  const runAll = () => { for (let i = 1; i < pubs.length; i++) perform(eventsFor(pubs[i - 1], pubs[i], 0), FX, { later: now, stepMs: 110, me: 0, pub: pubs[i] }); };
  let n0 = FX.stats.plays; runAll();
  assert.ok(FX.stats.plays - n0 > 20, "sounds play when on");
  FX.set("sound", false);
  n0 = FX.stats.plays; const nodes0 = FX.stats.nodes; runAll();
  assert.equal(FX.stats.plays - n0, 0); assert.equal(FX.stats.nodes - nodes0, 0);
  FX.set("sound", true); FX.set("moves", false); FX.set("alerts", false); FX.set("celebrations", false);
  n0 = FX.stats.plays; runAll();
  assert.equal(FX.stats.plays - n0, 0, "no sounds with the categories off");
  FX.reset();
  // Animations off: helpers never touch the element
  FX.set("animations", false);
  let animated = 0;
  const el = { animate() { animated++; return {}; }, getBoundingClientRect: () => ({ left: 0, top: 0, width: 10, height: 10 }) };
  await FX.pop(el); await FX.shake(el); await FX.pulse(el);
  assert.equal(animated, 0);
  FX.set("animations", true);
  globalThis.document = undefined;
  FX.reset();
});

test("no sound before the first tap (iOS)", async () => {
  // a fresh copy of fx.js with no gesture yet
  delete globalThis.FX;
  await import("../js/fx.js?fresh=1");
  const F2 = globalThis.FX;
  F2.init({ game: "clue-test2", clicks: false });
  assert.equal(F2.play("diceRoll"), false);
  assert.equal(F2.stats.plays, 0);
  globalThis.FX = FX;
});
