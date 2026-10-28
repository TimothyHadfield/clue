/* Clue — the page. Play (you + computers, or online), Notepad (real table), Learn, Settings. */
import "./fx.js";
import { eventsFor, perform, defineSounds, DEAL_AT, DEAL_GAP } from "./sfx.js";
import { game, movesFor, canPassage, canSuggestHere } from "./game.js";
import { createOnline } from "./online.js?v=a3d0418b";
import { EDITIONS, RULESETS, SUSPECT_COLORS, cardName, shortName } from "./cards.js";
import { cardSvg, cardBackHtml, weaponSvg, roomSvg, pawnSvg, dieHtml, logoSvg } from "./art.js";
import { boardSvg, roomHitPaths, placeXY, tokenSvg, weaponPieceSvg, walkPath, ROOMS } from "./boardview.js";
import { reach, PASSAGE, idx, rc, DOOR_LIST, STEPS_TO_ROOM } from "./board.js";
import { makeZoom } from "./zoom.js";
import { seatView, toTable } from "./knowledge.js";
import { LEVELS } from "./ai.js";
import { initNotepad, refreshNotepad } from "./notepad.js";
import { $, $$, esc, store, settings, saveSettings, toast, sheet, closeSheet, sheetOpen, pushLayer, popLayer, takeOwnBack, pct, heat, help, askSolver } from "./ui.js";
import { initLearn } from "./learn.js";
import { LEVELS as PF_LEVELS, achievements, result as pfResult, DAILY } from "./clue-profile.js";
import { tutorialSteps, rulesSheet, TUTORIAL } from "./tutorial.js";
import { revealScene } from "./reveal.js";
const Profile = window.Profile, COACH = window.COACH;

// sounds, celebrations and animations (all switchable in Settings → Sound & effects)
const FX = window.FX;
FX.init({ game: "clue", accent: "#6ea8fe" });
defineSounds(FX);
const stillPage = () => document.documentElement.classList.toggle("fx-still", !FX.settings.animations);
stillPage(); FX.onChange(stillPage);

const E = () => EDITIONS[settings.edition] || EDITIONS.classic;
const cname = (c) => cardName(settings.edition, c);
const sname = (c) => shortName(settings.edition, c);
let zoom = null, zoomKey = "", zoomTurn = -1;   // the board's zoom (see lookCloser / autoZoom)
const SMALL_SQ = 22;   // px per square below which the board zooms to your move / to a tapped room

// ------------------------------------------------------------------ tabs (Back goes where you were)
const TABS = ["play", "table", "learn", "settings"];
function showTab(t, push = true) {
  if (!TABS.includes(t)) t = "play";
  $$("nav.tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === t));
  $$("main .tab").forEach((s) => s.classList.toggle("active", s.id === "tab-" + t));
  if (push && location.hash !== "#" + t) history.pushState(null, "", "#" + t);
  if (t === "learn") initLearn($("#tab-learn"));
  if (t === "table") refreshNotepad();
  if (t === "settings") settingsView();
}
$$("nav.tabs button").forEach((b) => (b.onclick = () => showTab(b.dataset.tab)));
window.addEventListener("popstate", () => {
  const o = $("#overlay");
  if (window.COACH && COACH.rulesOpen()) { rulesByBack = true; COACH.closeRules(); return; }
  if (takeOwnBack()) { if (sheetOpen() || (gameEl && gameEl.classList.contains("notesopen"))) pushLayer("again"); return; }
  if (sheetOpen()) { if (o.dataset.lock === "1") pushLayer("sheet"); else closeSheet(true); return; }
  if (gameEl && gameEl.classList.contains("notesopen")) { gameEl.classList.remove("notesopen"); return; }
  // Back from the online form (or the lobby you reached from it) goes back to the Play setup
  if (view === "onlineForm") { setupView(); showTab("play", false); return; }
  if (view === "lobby") { if (online) online.leave(); setupView(); showTab("play", false); return; }
  showTab(location.hash.slice(1), false);
});

// ------------------------------------------------------------------ local room (same snapshot shape as online.js, plus save/resume)
function localRoom({ seats, options, state, meta, rng, dealRng }) {
  const handlers = [];
  const S = seats;
  rng = rng || Math.random;
  let st = state || game.setup(S.length, options, dealRng || rng, S);
  let timer = null, closed = false;
  const humanSeat = S.findIndex((s) => s.kind === "human");
  // this game's own record: Daily / guided game, help used (Undo, Best question), frames for the replay
  meta = Object.assign({ id: st.env.join(",") + ":" + Date.now().toString(36), daily: null, tutorial: false, helped: false, frames: [], myTurns: 0, myTurnNo: 0, oddsUsed: false, hunch: false, startWr: st.weaponRoom.slice() }, meta || {});
  const undos = [];   // the game as it was before each of your last moves (this page only)
  const frame = () => {
    const f = meta.frames, L = st.last;
    if (!L || (f.length && JSON.stringify(f[f.length - 1].last) === JSON.stringify(L))) return;
    if (L.t === "suggest" || L.t === "roll") return;   // the finished suggestion / the move are the frames worth seeing
    f.push({ pos: JSON.parse(JSON.stringify(st.pos)), wr: st.weaponRoom.slice(), last: L, turnNo: st.turnNo });
    if (f.length > 800) f.splice(0, f.length - 800);
  };
  const track = () => {
    if (st.turn === humanSeat && st.phase === "start" && meta.myTurnNo !== st.turnNo) { meta.myTurnNo = st.turnNo; meta.myTurns++; }
    if (settings.odds) meta.oddsUsed = true;
  };
  const snap = () => {
    const over = game.isOver(st);
    const toAct = over ? [] : game.toAct(st);
    return { mode: "local", status: over ? "finished" : "playing", seats: S.map((s) => ({ kind: s.kind, name: s.name, online: true })),
      toAct, pub: game.publicView(st), mySeat: humanSeat, mine: game.privateView(st, humanSeat), myTurn: toAct.includes(humanSeat), isHost: true };
  };
  const emit = () => { frame(); track(); store.set("local", { seats: S, state: st, meta }); const s = snap(); handlers.forEach((f) => f(s)); bots(); };
  function bots() {
    if (timer || closed || game.isOver(st)) return;
    const b = game.toAct(st).filter((x) => S[x].kind === "computer");
    if (!b.length) return;
    const delay = (st.phase === "disprove" ? 500 : 650) / settings.speed;
    timer = setTimeout(() => {
      timer = null;
      if (closed) return;
      const seat = b[0];
      try {
        const a = game.bot({ pub: game.publicView(st), mine: game.privateView(st, seat), state: st }, seat, Math.random);
        st = game.apply(JSON.parse(JSON.stringify(st)), seat, a, rng);
      } catch (e) { console.error(e); return; }
      emit();
    }, delay);
  }
  return {
    mode: "local",
    on(ev, f) { if (ev === "change") handlers.push(f); },
    act(a) {
      if (closed) return { ok: false, message: "Not your turn" };
      if (!game.toAct(st).includes(humanSeat)) return { ok: false, message: "Not your turn" };
      const before = JSON.stringify(st);
      if (meta.tutorial && a.type === "roll") tutorialDice(st, rng);
      try { st = game.apply(JSON.parse(before), humanSeat, a, rng); }
      catch (e) { FX.play("error"); toast(e.message); return { ok: false, message: e.message }; }
      if (!meta.daily) { undos.push({ st: before, q: myQuestions.length, f: meta.frames.length, t: meta.myTurns, tn: meta.myTurnNo }); if (undos.length > 6) undos.shift(); }
      emit(); return { ok: true };
    },
    /** Undo (vs computers, not in the Daily): back to just before your last move. Counts as help. */
    canUndo() { return !closed && !meta.daily && undos.length > 0 && !game.isOver(st); },
    undo() {
      if (!this.canUndo()) return false;
      const u = undos.pop();
      clearTimeout(timer); timer = null;
      st = JSON.parse(u.st);
      meta.helped = true; meta.frames.length = Math.min(meta.frames.length, u.f); meta.myTurns = u.t; meta.myTurnNo = u.tn;
      myQuestions.length = Math.min(myQuestions.length, u.q); store.set("questions", myQuestions);
      emit(); return true;
    },
    meta,
    start() { emit(); },
    close() { closed = true; clearTimeout(timer); },
    get state() { return st; },
  };
}

// ------------------------------------------------------------------ PLAY
const play = $("#tab-play");
let room = null, online = null, snapNow = null, prevPub = null, gameEl = null;
let notes = null, notesKey = "", ranked = null, rankKey = "";
let myQuestions = []; // {got, best} bits for each of your suggestions
let animating = Promise.resolve();
let view = "setup";   // setup | onlineForm | lobby | game

function setupView() {
  room = null; snapNow = null; prevPub = null; gameEl = null; view = "setup";
  const n = settings.players;
  const used = suspectsFor(n, settings.me);
  play.innerHTML = `<div class="setup-wrap">
    <div class="hero">${logoSvg()}<p>Find who, with what, and where — first.</p></div>
    <div class="panel stack">
      <div><div class="label">Players ${help("Two players", "With 2 players, four cards lie face down in four rooms (the official 2-player rules). Walk into one of those rooms to look at its card.")}</div><div class="seg" id="pn">${[2, 3, 4, 5, 6].map((k) => `<button data-n="${k}" class="${k === n ? "on" : ""}">${k}</button>`).join("")}</div></div>
      <div><div class="label">You are</div><div class="who" id="pme">${[0, 1, 2, 3, 4, 5].map((s) => `<button data-s="${s}" class="${s === settings.me ? "on" : used.includes(s) ? "" : "off"}">${pawnSvg(s, 30)}${E().short[s]}</button>`).join("")}</div></div>
      <div><div class="label">Computers ${help("How strong are they?", "Easy only crosses off cards it is shown. Medium reasons like a careful player with a pencil. Hard counts every possible deal and asks the question that teaches it the most. Win rates are on the Learn tab.")}</div>
        <div class="seg" id="plv">${LEVELS.map((l, i) => `<button data-l="${i}" class="${i === settings.level ? "on" : ""}">${l}</button>`).join("")}</div></div>
      <button class="btn primary" id="go" style="min-height:50px;font-size:17px">Deal</button>
      <div class="row two"><button class="btn" id="goDaily">Daily game</button><button class="btn" id="goOnline">Play online</button></div>
    </div>
    <div class="record"><button class="pf-open me-btn" id="meBtn" aria-label="My stats"></button></div>
  </div>`;
  $$("#pn button").forEach((b) => (b.onclick = () => { settings.players = +b.dataset.n; saveSettings(); setupView(); }));
  $$("#pme button").forEach((b) => (b.onclick = () => { settings.me = +b.dataset.s; saveSettings(); setupView(); }));
  $$("#plv button").forEach((b) => (b.onclick = () => { settings.level = +b.dataset.l; saveSettings(); setupView(); }));
  $("#go").onclick = () => startLocal();
  $("#goOnline").onclick = onlineView;
  $("#goDaily").onclick = startDaily;
  $("#meBtn").onclick = () => Profile.openPanel();
  paintMe();
  offerTutorial();
}
/** The My stats button: your picture, "My stats" and your wins / losses. */
function paintMe() {
  const b = $("#meBtn");
  if (!b || !Profile) return;
  let st = null; try { st = Profile.stats(); } catch (e) {}
  b.innerHTML = Profile.avatarSVG(Profile.avatar, 26) + `<span>My stats</span>` + (st ? `<span class="wl">Won ${st.wins} · Lost ${st.losses}</span>` : "");
}
/** Today's Daily game: the same deal for everyone today (4 players, 3 Hard computers, Clue rules). */
function startDaily() {
  const day = Profile.daily.date();
  if (room && room.meta && room.meta.daily === day && snapNow && snapNow.pub && !snapNow.pub.over) { Profile.closePanel(); showTab("play"); return; }
  if (Profile.daily.played(day)) { Profile.openPanel({ tab: "daily" }); return; }
  if (online && snapNow && snapNow.mode === "online") { Profile.closePanel(); toast("Leave the online room first"); return; }
  if (room && snapNow && snapNow.pub && !snapNow.pub.over) { Profile.closePanel(); toast("Finish or quit this game first (Settings)"); return; }
  Profile.closePanel(); showTab("play");
  startLocal(null, { daily: day });
}
/** First visit: offer the guided first game once. */
function offerTutorial() {
  if (!COACH || !tour || tour.seen() || COACH.offered("clue-first")) return;
  COACH.offer({ id: "clue-first", title: "New to Clue?", text: "Play a guided first game against two easy computers.", yes: "Teach me", no: "No thanks", onYes: () => startTutorial(), place: "auto", avoid: ["#go"] });
}
function startTutorial() {
  if (online && snapNow && snapNow.mode === "online") { toast("Leave the online room first"); return; }
  if (room && room.close) room.close();
  store.del("local");
  closeSheet(true);
  showTab("play", true);
  tour.reset();
  startLocal(null, { tutorial: true });
  tour.start();
}
let rulesByBack = false;
function openRules(open) {
  if (!COACH) return;
  closeSheet(true);   // an open sheet's Back entry is reused for the rules (no history.back that would land on them)
  pushLayer("rules");
  COACH.rules(Object.assign(rulesSheet(E()), open ? { open } : {}, { onClose: () => { if (!rulesByBack) popLayer(); rulesByBack = false; } }));
}
function gameOptions(chars, fixed = {}) {
  const R = RULESETS[fixed.rules || settings.rules] || RULESETS.classic;
  const lv = fixed.level != null ? fixed.level : settings.level;
  // house rules (Settings) apply to normal games, never to the Daily or the guided game
  const house = fixed.rules ? {} : { faceUp: !!settings.faceUp, quick: !!settings.quick };
  return Object.assign({ chars, dice: R.dice, stay: R.stay, upTo: R.upTo, edition: settings.edition, levels: chars.map(() => lv) }, house);
}
/** Guided game: each of your first rolls is just enough to reach the nearest room (or a 6). */
function tutorialDice(st, rng) {
  if (!rng || !rng.stackInts || st.turnNo > 12) return;
  const p = st.pos[st.chars[st.turn]];
  let need = 6;
  if (p.sq != null) need = Math.min(...STEPS_TO_ROOM.map((a) => a[p.sq]));
  rng.clear(); rng.stackInts([Math.max(1, Math.min(6, need)) - 1], 6);
}
/** You plus the next suspects clockwise. */
function suspectsFor(n, me) {
  const s = [me];
  for (let k = 1; s.length < n; k++) s.push((me + k) % 6);
  return s.sort((a, b) => a - b);
}
function startLocal(resume, how = {}) {
  if (rp) { stopPlay(); rp = null; }
  if (room && room.close) room.close();
  room = null; snapNow = null; prevPub = null; gameEl = null;
  let seats, options, state = null, meta = null, rng = null, dealRng = null;
  if (resume && resume.state) {
    seats = resume.seats; state = resume.state; options = state.opts; meta = resume.meta || null;
    if (meta && meta.tutorial) rng = COACH.rng(TUTORIAL.seed + state.turnNo * 7919 + state.log.length);
  } else {
    const n = how.daily ? DAILY.players : how.tutorial ? TUTORIAL.players : settings.players;
    const meChar = how.daily ? DAILY.me : how.tutorial ? TUTORIAL.me : settings.me;
    const chars = suspectsFor(n, meChar);
    seats = chars.map((c) => (c === meChar ? { kind: "human", name: "You" } : { kind: "computer", name: E().short[c] }));
    options = gameOptions(chars, how.daily ? { level: DAILY.level, rules: DAILY.rules } : how.tutorial ? { level: TUTORIAL.level, rules: TUTORIAL.rules } : {});
    myQuestions = [];
    store.set("questions", myQuestions);
    meta = { daily: how.daily || null, tutorial: !!how.tutorial, helped: !!how.tutorial };
    if (how.daily) dealRng = Profile.daily.rng(how.daily);
    if (how.tutorial) rng = COACH.rng(TUTORIAL.seed);
  }
  room = localRoom({ seats, options, state, meta, rng, dealRng });
  room.on("change", onSnap);
  paused = false;
  store.set("owner", TAB);
  room.start();
}

// ------------------------------------------------------------------ the same game open in two tabs
// Only one tab plays the saved game at a time: the one you opened or looked at last. The other
// stops its computers, and when you come back to it, it picks up the game from where the other left it.
const TAB = Math.random().toString(36).slice(2);
let paused = false;
window.addEventListener("storage", (e) => {
  if (e.key !== "clue.owner" || e.newValue === JSON.stringify(TAB)) return;
  if (room && room.mode === "local") { room.close(); paused = true; }
});
function takeBack() {
  if (!paused) return;
  paused = false;
  if (sheetOpen()) closeSheet();
  room = null; snapNow = null; prevPub = null; gameEl = null;
  const saved = store.get("local", null);
  if (validSave(saved) && !saved.state.over) startLocal(saved);
  else setupView();
}
window.addEventListener("focus", takeBack);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") takeBack(); });

/** A saved game this version can play (anything else is dropped, never crashes the page). */
function validSave(sv) {
  try {
    const st = sv && sv.state, n = st && st.n;
    return Array.isArray(sv.seats) && Number.isInteger(n) && n >= 2 && n <= 6 && sv.seats.length === n && sv.seats.some((x) => x && x.kind === "human")
      && ["hands", "chars", "sizes", "seen", "showed", "out", "envSeen", "summoned"].every((k) => Array.isArray(st[k]) && st[k].length === n)
      && Array.isArray(st.pos) && st.pos.length === 6 && Array.isArray(st.env) && st.env.length === 3
      && Array.isArray(st.weaponRoom) && st.weaponRoom.length === 6 && Array.isArray(st.log) && typeof st.phase === "string"
      && Number.isInteger(st.turn) && st.turn >= 0 && st.turn < n && !!st.opts && typeof st.opts === "object";
  } catch (e) { return false; }
}
/** Count a finished (or quit) local game once in your win/loss record and in My stats. The guided game never counts. */
function recordLocal(turnNo, env, won, meta, st) {
  if (meta && meta.tutorial) return;
  const k = "counted:" + (meta && meta.id ? meta.id : turnNo + ":" + env.join(","));
  if (store.get(k, false)) return;
  const rec = store.get("record", { w: 0, l: 0 });
  if (won) rec.w++; else rec.l++;
  store.set("record", rec);
  store.set(k, true);
  if (!Profile || !meta || !st) return;
  const q = myQuestions.length ? myQuestions.reduce((a, x) => a + (x.best > 0 ? x.got / x.best : 1), 0) / myQuestions.length : null;
  const lv = (st.opts.levels || []).find((l, i) => st.kinds && st.kinds[i] === "computer");
  const r = pfResult({ won, level: lv != null ? lv : (st.opts.levels || [])[0], helped: meta.helped || meta.tutorial, daily: !!meta.daily, players: st.n,
    myTurns: meta.myTurns, quality: q, oddsOff: !meta.oddsUsed, hunch: meta.hunch });
  try { Profile.recordResult(meta.daily ? Object.assign(r, { date: meta.daily }) : r); } catch (e) { /* stats never break the game */ }
  paintMe();
}

function onSnap(snap) {
  if (snap.status === "joining") { const b = $("#oJoin"); if (b) b.textContent = "Joining…"; return; }   // no seats yet: keep the form
  if (snap.status === "lobby") { lobbyView(snap); return; }
  if (!snap.pub) {
    if (view === "onlineForm" || view === "setup") return;   // a failed join keeps the form and what you typed
    if (snap.status === "closed") toast("The room was closed", 3000);
    if (snap.status === "left") toast("The host gave your seat to a computer", 3500);
    if (snap.status === "closed" || snap.status === "left" || snap.status === "none") setupView();
    return;
  }
  view = "game";
  const first = !gameEl || snapNow && snapNow.pub && snapNow.pub.n !== snap.pub.n;
  const prev = snapNow;
  snapNow = snap;
  // a Suggest sheet left open after your suggestion went through (online lag) has nothing left to do
  const sug = $("#overlay.on .sheet[data-for='suggest']");
  if (sug && !(snap.myTurn && (snap.pub.phase === "suggest" || (snap.pub.phase === "start" && canSuggestHere(snap.pub))))) closeSheet();
  if (first) {
    buildGame(snap);
    const up = snap.pub.faceUp || [];
    if (up.length && snap.pub.turnNo === 1 && !snap.pub.log.length) toast(`Face up for everyone: ${up.map(sname).join(", ")}`, 3500);
  }
  animating = animating.then(() => renderGame(snap, prev, true)).catch((e) => console.error(e));
}

// ------------------------------------------------------------------ sounds and effects for each new snapshot
function fxCtx(snap) {
  const chipEl = (s) => gameEl && $(`.pl[data-seat="${s}"]`, gameEl);
  return {
    stepMs: 110 / settings.speed, me: snap.mySeat, pub: snap.pub, overMs: 900 / settings.speed,
    el: { chip: chipEl, bar: () => gameEl && $("#bar", gameEl) },
    colors: (s) => [SUSPECT_COLORS[snap.pub.chars[s]], "#f0b354", "#e8eaf0", "#6ea8fe", "#6ee7a8"],
    // a face-down card slides from the player who showed it to the player who asked
    fly: (a, b) => {
      const from = chipEl(a), to = chipEl(b);
      if (!from || !to || !FX.settings.animations) return;
      const r = from.getBoundingClientRect();
      const g = document.createElement("div");
      g.className = "fx-cardback";
      g.style.left = r.left + r.width / 2 - 11 + "px"; g.style.top = r.top + r.height / 2 - 17 + "px";
      document.body.appendChild(g);
      FX.flyTo(g, to, { clone: false, scale: 1, duration: 520 }).then(() => g.remove());
    },
    // the dealt cards come face down off the case-file envelope, land in your fan and turn face up
    deal: () => {
      if (!FX.settings.animations || !gameEl) return;
      const src = $(".envelope", gameEl) || $("#bw", gameEl);
      const b = src.getBoundingClientRect(), ex = b.left + b.width / 2, ey = b.top + b.height / 2;
      const hr = $("#hand", gameEl).getBoundingClientRect();
      const sp = FX.settings.animSpeed === "fast" ? 0.55 : 1;
      const T = (x, y, r, s, ry) => `perspective(800px) translate(${x}px, ${y}px) rotate(${r}deg) scale(${s}) rotateY(${ry}deg)`;
      $$("#hand .cardf", gameEl).forEach((c, i) => {
        const v = (k) => parseFloat(c.style.getPropertyValue(k)) || 0;
        const x = v("--x"), y = v("--y"), r = v("--r"), w = c.offsetWidth, h = c.offsetHeight;
        const sx = ex - (hr.left + w / 2), sy = ey - (hr.bottom - h / 2);
        const dur = 460 * sp;
        try {
          const timing = { duration: dur, delay: Math.max(0, DEAL_AT + i * DEAL_GAP - dur * 0.62), easing: "cubic-bezier(.3,.7,.3,1)", fill: "backwards" };
          c.animate([{ transform: T(sx, sy, -14, 0.4, 180) }, { transform: T(x, y, r, 1, 180), offset: 0.62 }, { transform: T(x, y, r, 1, 0) }], timing);
          // the back covers the face until the card has turned past edge-on
          const bk = c.querySelector(".clue-back");
          if (bk) bk.animate([{ opacity: 1 }, { opacity: 1, offset: 0.8 }, { opacity: 0, offset: 0.81 }, { opacity: 0 }], timing);
        } catch (e) {}
      });
    },
  };
}
// the notes: a pencil mark when new ✓/✗ appear, and a sparkle when the case is cracked
let notesFx = { key: "", marks: -1, solved: false };
function notesEffects(r, snap) {
  const n = snap.pub.n, key = snap.pub.chars.join() + "|" + snap.mine.hand.join();
  let marks = 0;
  for (const row of r.prob) for (let p = 0; p <= n; p++) if (row[p] > 0.9995 || row[p] < 0.0005) marks++;
  if (notesFx.key !== key) { notesFx = { key, marks, solved: r.envCount === 1 }; return; }
  if (marks > notesFx.marks) FX.play("scribble");
  notesFx.marks = marks;
  if (r.envCount === 1 && r.exact !== false && !notesFx.solved && !snap.pub.over) {
    notesFx.solved = true;
    FX.celebrate({ kind: "big", at: $("#bw", gameEl) });
  }
}

function buildGame(snap) {
  const pub = snap.pub;
  view = "game";
  // the table, seen from your seat: the others across the table, the board in the middle,
  // your own hand at the bottom edge, and your detective sheet beside you
  play.innerHTML = `<div class="game tbl-surface tbl-wood-dark" id="game">
    <div class="players" id="players"></div>
    <div class="boardwrap" id="bw">${boardSvg(settings.edition)}</div>
    <div class="side" id="side">
      <div class="row between"><div class="label">Your notes ${help("How the notes work", "Every way the 21 cards could have been dealt that fits what you have seen is counted. A card's number is the share of those deals where it sits in that hand or in the case file. ✓ and ✗ mean certain.")}</div><button class="btn small ghost" id="closeNotes">Close</button></div>
      <div class="envline" id="envline"></div>
      <div class="notes" id="notes" style="flex:1"></div>
      <div class="log" id="log" style="max-height:24%"></div>
    </div>
    <div class="bar" id="bar"><div class="msgrow"><div id="meSeat"></div><div class="msg"></div></div><div class="acts"></div></div>
    <div class="myseat"><div class="hand" id="hand"></div></div>
  </div>`;
  gameEl = $("#game");
  handKey = "";
  const svg = $("svg.board", gameEl);
  $(".hits", svg).innerHTML = roomHitPaths();
  $(".toks", svg).innerHTML = [0, 1, 2, 3, 4, 5].map(tokenSvg).join("");
  $(".weps", svg).innerHTML = [0, 1, 2, 3, 4, 5].map(weaponPieceSvg).join("");
  $("#closeNotes").onclick = () => { gameEl.classList.remove("notesopen"); popLayer(); };
  // zoom: the whole board shows; your move zooms to where you can go on a phone, pinch / drag / tap a room to look closer
  const zb = document.createElement("button");
  zb.className = "zoomout"; zb.id = "zoomOut"; zb.hidden = true; zb.setAttribute("aria-label", "Whole board");
  zb.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>`;
  $("#bw", gameEl).appendChild(zb);
  zoom = makeZoom(svg, { onChange: (z) => (zb.hidden = !z.zoomed), still: () => !FX.settings.animations });
  zb.onclick = () => zoom.reset();
  zoomKey = ""; zoomTurn = -1;
  svg.addEventListener("click", onBoardClick);
  placePieces(pub, null, true);
}

function slotsFor(pub) {
  // which slot each piece takes inside a room: tokens first, then weapons
  const used = new Map();
  const tokSlot = [], wepSlot = [];
  pub.pos.forEach((p, s) => { if (p.room != null) { const k = used.get(p.room) || 0; tokSlot[s] = k; used.set(p.room, k + 1); } });
  pub.weaponRoom.forEach((r, w) => { const k = used.get(r) || 0; wepSlot[w] = k; used.set(r, k + 1); });
  return { tokSlot, wepSlot };
}
function setXY(el, p) { el.style.transform = `translate(${p.x}px, ${p.y}px)`; }
function placePieces(pub, only, instant) {
  const svg = $("svg.board", gameEl);
  const { tokSlot, wepSlot } = slotsFor(pub);
  pub.pos.forEach((p, s) => {
    if (only != null && only !== s) return;
    const el = $(`.tok[data-s="${s}"]`, svg);
    if (instant) el.style.transition = "none";
    setXY(el, placeXY(p, tokSlot[s] || 0));
    if (instant) { el.getBoundingClientRect(); el.style.transition = ""; }
  });
  if (only == null) pub.weaponRoom.forEach((r, w) => {
    const el = $(`.wep[data-w="${w}"]`, svg);
    if (instant) el.style.transition = "none";
    setXY(el, placeXY({ room: r }, wepSlot[w] || 0));
    if (instant) { el.getBoundingClientRect(); el.style.transition = ""; }
  });
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function renderGame(snap, prev, fresh) {
  const pub = snap.pub;
  const pp = prev && prev.pub;
  // sounds and effects for what just happened (new snapshots only, not a settings redraw)
  if (fresh) { try { perform(eventsFor(pp, pub, snap.mySeat), FX, fxCtx(snap)); } catch (e) { console.warn(e); } }
  // walk the token that just moved, square by square (Animations off: it just jumps)
  if (FX.settings.animations && pp && pub.last && pub.last.t === "move" && pp.turnNo === pub.turnNo && !(pp.last && pp.last === pub.last)) {
    const sus = pub.chars[pub.last.by];
    const blocked = new Set(); pp.pos.forEach((p, i) => { if (i !== sus && p.sq != null) blocked.add(p.sq); });
    const path = walkPath(pp.pos[sus], pub.pos[sus], blocked);
    const el = $(`.tok[data-s="${sus}"]`, gameEl);
    const stepMs = (pub.opts.quick ? Math.min(110, 1400 / Math.max(1, path.length)) : 110) / settings.speed;   // quick moves cross the board in about 1.4 s
    el.style.transition = `transform ${stepMs}ms linear`;
    for (const sq of path) { const [r, c] = rc(sq); setXY(el, { x: c + 0.5, y: r + 0.5 }); await wait(stepMs); }
    el.style.transition = "";
  }
  placePieces(pub);
  renderPlayers(snap);
  renderBar(snap);
  renderHighlights(snap);
  updateNotes(snap);
  renderLog(pub);
  announce(snap, prev);
  if (fresh && pub.over && !(pp && pp.over)) setTimeout(async () => {
    // the case file opens and its three cards slide out, then the result sheet
    if (pub.reveal) {
      const t = pub.winner >= 0 ? (pub.winner === snap.mySeat ? "You solved it!" : esc(seatName(pub, pub.winner, snap)) + " solved it") : "Nobody solved it";
      try { await revealScene({ cards: pub.reveal.env, edition: settings.edition, title: t, FX }); } catch (e) {}
    }
    if (snapNow && snapNow.pub && snapNow.pub.over && snapNow.mode === snap.mode) gameOver(snapNow);
  }, 900 / settings.speed);
}

function seatName(pub, i, snap) {
  const sn = snap && snap.seats && snap.seats[i];
  const base = E().short[pub.chars[i]];
  if (snap && i === snap.mySeat) return "You";
  if (sn && sn.kind === "human" && sn.name && snap.mode === "online") {
    const twin = snap.seats.some((o, j) => j !== i && o && o.kind === "human" && o.name === sn.name);
    return twin ? `${sn.name} (${base})` : sn.name;
  }
  return base;
}
// whole characters, so a short label never cuts an emoji in half
const letters = (t) => { try { return [...new Intl.Segmenter().segment(t)].map((x) => x.segment); } catch (e) { return Array.from(t); } };
function renderPlayers(snap) {
  const pub = snap.pub;
  const others = pub.chars.map((_, i) => i).filter((i) => i !== snap.mySeat);
  // narrow screens with many players: short labels that stay different (Pe / Pl)
  const rowW = ($("#players") && $("#players").clientWidth) || Math.min(window.innerWidth, 900);
  const room4 = (Math.min(rowW, 900) - 64) / Math.max(1, others.length);
  const keep = room4 < 72 ? 2 : room4 < 96 ? 3 : 99;
  // each seat: the cards they hold (backs, in a small fan) and a name plate in their colour
  const seat = (i) => {
    const c = pub.chars[i];
    const cls = ["pl", i === pub.turn && !pub.over ? "turn" : "", pub.sugg && pub.sugg.asking === i ? "asking" : "", pub.out[i] ? "out" : ""].join(" ");
    const sn = snap.seats && snap.seats[i];
    const away = snap.mode === "online" && i !== snap.mySeat && sn && sn.kind === "human" && !sn.online;
    const full = seatName(pub, i, snap);
    const label = i === snap.mySeat ? "You" : letters(full).slice(0, keep).join("");
    const ctl = away && snap.isHost && !pub.over ? ` data-away="1"` : "";
    const n = pub.sizes[i];
    const backs = i === snap.mySeat ? "" : `<span class="backs" style="--n:${n}">${Array.from({ length: n }, (_, k) => `<i style="--k:${k - (n - 1) / 2}"></i>`).join("")}</span>`;
    return `<div class="${cls}${away ? " away" : ""}" data-seat="${i}" title="${esc(full)} · ${n} cards"${ctl}>${backs}<span class="plate"><i style="background:${SUSPECT_COLORS[c]}"></i><span class="nm">${esc(label)}${away ? " ·off" : ""}</span></span></div>`;
  };
  $("#players").innerHTML = others.map(seat).join("") + `<button class="notepad-btn" id="notesBtn" aria-label="Notes"><span>Notes</span></button>`;
  $("#meSeat").innerHTML = snap.mySeat >= 0 ? seat(snap.mySeat) : "";
  $("#notesBtn").onclick = () => { gameEl.classList.add("notesopen"); pushLayer("notes"); };
  $$("#players [data-away]").forEach((el) => (el.onclick = () => handOver(+el.dataset.seat)));
  if (snap.mode === "online") watchAway(snap);
}
function bubble(seat, text) {
  const el = $(`.pl[data-seat="${seat}"]`, gameEl);
  if (!el) return;
  const b = document.createElement("span"); b.className = "say"; b.textContent = text; el.appendChild(b);
  setTimeout(() => b.remove(), 2200 / settings.speed);
}

// what to say about the latest event
function announce(snap, prev) {
  const pub = snap.pub, pp = prev && prev.pub;
  if (!pp || pub.last === null) return;
  if (JSON.stringify(pp.last) === JSON.stringify(pub.last)) return;
  const L = pub.last;
  if (L.t === "suggestDone") {
    const r = pub.log[L.i];
    r.passes.forEach((p) => bubble(p, "No"));
    if (r.shower != null) bubble(r.shower, r.by === snap.mySeat ? "Shows you" : "Shows a card");
    if (r.by === snap.mySeat) {
      const seen = (snap.mine.seen || []).find((x) => x.i === L.i);
      if (seen) revealCard(seatName(pub, seen.from, snap), seen.card);
      else toast("Nobody could show a card!", 3000);
    }
  } else if (L.t === "accuse" && !L.correct) {
    // with game sounds on, the verdict lands on the drumroll's last beat
    const msg = `${seatName(pub, L.by, snap)} accused wrongly — out`;
    if (FX.settings.sound && FX.settings.moves) setTimeout(() => toast(msg, 2600), 950); else toast(msg, 2600);
  } else if (L.t === "roll" && L.by !== snap.mySeat) {
    bubble(L.by, "Rolled " + L.dice.reduce((a, b) => a + b, 0));
  } else if (L.t === "passage" && L.by !== snap.mySeat) {
    bubble(L.by, "Secret passage");
  }
  // 2 players: you walked into a room with a face-down card (only you see it)
  if (L.peek && (L.t === "move" || L.t === "passage")) {
    if (L.by === snap.mySeat) {
      const pk = (snap.mine.seen || []).find((x) => x.i < 0 && x.room === L.room);
      if (pk) revealCard("The " + E().rooms[L.room], pk.card, "card");
    } else bubble(L.by, "Looks at the room card");
  }
}
function revealCard(who, c, how) {
  sheet(`<h3>${how === "card" ? `${esc(who)}'s face-down card` : `${esc(who)} showed you`}</h3><div class="row" style="justify-content:center;margin:8px 0"><div class="cardf lg turnup">${cardSvg(settings.edition, c)}${cardBackHtml()}</div></div><div class="row" style="justify-content:flex-end"><button class="btn primary" data-close>Got it</button></div>`,
    (el) => { $("[data-close]", el).onclick = closeSheet; });
}

function renderLog(pub) {
  const lines = pub.log.slice(-30).reverse().map((r) => {
    const who = seatName(pub, r.by, snapNow);
    if (r.t === "accuse") return `<div><b>${esc(who)}</b> accused ${r.cards.map(sname).join(", ")} — ${r.correct ? "right!" : "wrong"}</div>`;
    const sh = r.shower == null ? "nobody showed" : `${esc(seatName(pub, r.shower, snapNow))} showed${r.passes.length ? ` (${r.passes.map((p) => esc(seatName(pub, p, snapNow))).join(", ")} no)` : ""}`;
    return `<div><b>${esc(who)}</b>: ${r.cards.map(sname).join(", ")} — ${sh}</div>`;
  });
  $("#log").innerHTML = lines.join("") || `<div>Suggestions will appear here.</div>`;
}

// ------------------------------------------------------------------ the action bar
function myTurnPhase(snap) { return snap.myTurn ? snap.pub.phase : null; }
/** Your token can move now: after a roll, or (quick moves) at the start of your turn. */
function canMoveNow(snap) { const ph = myTurnPhase(snap); return ph === "move" || (ph === "start" && !!snap.pub.opts.quick); }
function renderBar(snap) {
  if (rp && gameEl && gameEl.classList.contains("replaying")) { drawReplay(); return; }
  const pub = snap.pub, bar = $("#bar");
  const me = snap.mySeat;
  const ph = myTurnPhase(snap);
  const place = me >= 0 ? pub.pos[pub.chars[me]] : null;
  let msg = "", acts = "";
  renderHand(snap);
  if (pub.over) {
    msg = pub.winner >= 0 ? `${esc(seatName(pub, pub.winner, snap))} solved it!` : "Nobody solved it.";
    acts = `<button class="btn primary" id="bNew">New game</button><button class="btn" id="bSum">Answer</button>`;
  } else if (ph === "disprove") {
    msg = `Show ${esc(seatName(pub, pub.sugg.by, snap))} one card`;
    acts = `<button class="btn warm" id="bShow">Choose card</button>`;
  } else if (ph === "start") {
    const where = place.room != null ? ` · in the ${esc(E().rooms[place.room])}` : "";
    msg = `Your turn${where}`;
    // quick moves: no dice, tap any lit room
    acts = pub.opts.quick ? "" : `<button class="btn primary" id="bRoll"><span class="rolldie">${dieHtml(5)}</span>Roll</button>`;
    if (pub.opts.quick) msg += ` <span class="sub">Tap a room</span>`;
    if (canPassage(pub)) acts += `<button class="btn" id="bPass">Passage → ${esc(E().rooms[PASSAGE[place.room]])}</button>`;
    if (canSuggestHere(pub)) acts += `<button class="btn warm" id="bSug">Suggest here</button>`;
    acts += `<button class="btn" id="bAcc">Accuse</button>`;
    if (settings.odds && !pub.opts.quick) msg += ` <span class="sub" id="reachOdds"></span>`;
  } else if (ph === "move") {
    msg = `${dice(pub.roll)} <span>Pick a lit square or room</span>`;
    acts = `<button class="btn" id="bAcc">Accuse</button>`;
  } else if (ph === "suggest") {
    msg = `In the ${esc(E().rooms[place.room])}`;
    acts = `<button class="btn warm" id="bSug">Suggest</button><button class="btn" id="bAcc">Accuse</button><button class="btn ghost" id="bEnd">End turn</button>`;
  } else if (ph === "post") {
    const boxed = pub.last && pub.last.t === "roll" && pub.last.by === me;   // rolled, but every way out is blocked
    msg = boxed ? `${dice(pub.roll)} <span class="sub">Blocked in — no move</span>` : pub.roll && !pub.suggested && !pub.entered ? `${dice(pub.roll)} <span class="sub">Moved</span>` : "Your move is done";
    acts = `<button class="btn" id="bAcc">Accuse</button><button class="btn primary" id="bEnd">End turn</button>`;
  } else {
    const t = pub.phase === "disprove" ? `${esc(seatName(pub, pub.sugg.asking, snap))} is choosing a card…` : `${esc(seatName(pub, pub.turn, snap))}'s turn`;
    msg = t + (pub.roll && pub.phase !== "disprove" ? " " + dice(pub.roll) : "");
    if (me >= 0 && pub.out[me]) msg += ` <span class="sub">(you're out — still showing cards)</span>`;
  }
  // Undo: against the computers only (never online, never in the Daily); it makes the game unrated
  if (snap.mode === "local" && room && room.canUndo && room.meta && !room.meta.daily && ph && !pub.over && room.canUndo()) acts += `<button class="btn ghost" id="bUndo">Undo</button>`;
  bar.classList.toggle("mine", !!ph && !pub.over);
  // the buttons row is always there (empty on others' turns) so the board never jumps between turns
  $(".msg", bar).innerHTML = msg;
  $(".acts", bar).innerHTML = acts;
  const on = (id, f) => { const b = $("#" + id, bar); if (b) b.onclick = f; };
  on("bRoll", () => act({ type: "roll" }));
  on("bPass", () => act({ type: "passage" }));
  on("bSug", () => suggestSheet(snap));
  on("bAcc", () => accuseSheet(snap));
  on("bEnd", () => act({ type: "end" }));
  on("bShow", () => showSheet(snap));
  on("bUndo", undo);
  on("bNew", () => { if (snap.mode === "local" && room && room.meta && pub.reveal) recordLocal(pub.turnNo, pub.reveal.env, pub.winner === me, room.meta, room.state); store.del("local"); if (room && room.close) room.close(); if (online && snap.mode === "online") online.leave(); setupView(); });
  on("bSum", () => gameOver(snap));
  if (ph === "disprove" && !$("#overlay").classList.contains("on")) showSheet(snap);
  if (ph === "start" && settings.odds && !pub.opts.quick) reachOdds(pub, place);
}
// your hand: held as a fan of real cards along the bottom edge (rebuilt only when the cards change)
let handKey = "", handApi = null;
function renderHand(snap) {
  const el = $("#hand", gameEl);
  if (!el) return;
  const cards = snap.mySeat >= 0 && snap.mine ? snap.mine.hand : [];
  const key = settings.edition + "|" + cards.join();
  if (key === handKey) return;
  handKey = key;
  if (handApi && handApi.disconnect) handApi.disconnect();
  handApi = window.TABLE.fan(el, cards.map((c) => `<div class="cardf tbl-card" data-c="${c}">${cardSvg(settings.edition, c)}${cardBackHtml()}</div>`),
    { pick: false, lift: 0, spread: 0.93, arc: 0.5, maxRot: 7 });
}
function dice(roll) { return roll ? `<span class="dice">${roll.dice.map(dieHtml).join("")}</span>` : ""; }

function reachOdds(pub, place) {
  // chance this turn's roll gets you into a room (not the one you are in)
  const me = pub.chars[pub.turn];
  const blocked = new Set(); pub.pos.forEach((p, i) => { if (i !== me && p.sq != null) blocked.add(p.sq); });
  const dist = pub.opts.dice === 2 ? [0, 0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1].map((x) => x / 36) : [0, 1, 1, 1, 1, 1, 1].map((x) => x / 6);
  let p = 0;
  for (let t = 1; t < dist.length; t++) if (dist[t]) { const m = reach(place, t, blocked); if (m.rooms.some((x) => x.room !== pub.startRoom)) p += dist[t]; }
  const el = $("#reachOdds");
  if (el) el.innerHTML = !settings.odds ? "" : `Room this roll: <b style="color:${heat(p)}">${pct(p)}</b>`;
}

/** Best question / Best guess are hints: the game is then counted "with help", not rated. */
function usedHelp() { if (room && room.meta && room.mode === "local") room.meta.helped = true; }
function undo() {
  if (!room || !room.undo || paused) return;
  closeSheet();
  snapNow = null;   // no sounds or walks for the step back
  if (room.undo()) { if (COACH) COACH.emit("undo"); toast("Took back your last move — this game is unrated now", 2600); }
}
let lastAct = { k: "", t: 0 };
async function act(a) {
  if (paused) { takeBack(); return; }
  if (!snapNow) return;
  const k = JSON.stringify(a), t = Date.now();
  if (k === lastAct.k && t - lastAct.t < 600) return;   // a double tap sends once
  lastAct = { k, t };
  closeSheet();
  if (snapNow.mode === "online") { const r = await online.act(a); if (!r.ok) { FX.play("error"); toast(r.message); } }
  else room.act(a);
}

// board clicks: walk to a lit square or into a lit room
function onBoardClick(e) {
  const snap = snapNow;
  if (!snap) return;
  if (!canMoveNow(snap)) { lookCloser(e); return; }
  const t = e.target.closest("[data-sq],[data-room]");
  if (!t) { FX.play("error"); return; }   // a square you can't reach this turn
  if (t.dataset.sq != null) act({ type: "move", sq: +t.dataset.sq });
  else if (t.classList.contains("can")) act({ type: "move", room: +t.dataset.room });
  else FX.play("error");
}
// ------------------------------------------------------------------ zoom (js/zoom.js)
/** Not your move: tap a room (or anywhere) to look closer on a small screen; tap again for the whole board. */
function lookCloser(e) {
  if (!zoom) return;
  if (zoom.zoomed) { zoom.reset(); return; }
  if (zoom.unitPx() >= SMALL_SQ) return;
  const t = e.target.closest("[data-room]");
  if (t) { const R = ROOMS[+t.dataset.room]; zoom.to({ x: R.c0 - 0.8, y: R.r0 - 0.8, w: R.c1 - R.c0 + 2.6, h: R.r1 - R.r0 + 2.6 }); return; }
  const p = zoom.pt(e.clientX, e.clientY);
  zoom.to({ x: p.x - 5, y: p.y - 5, w: 10, h: 10 });
}
/** The part of the board your move can reach: your pawn, the lit squares and the doors of lit rooms. */
function reachArea(pub, m) {
  const pts = [];
  const mine = pub.pos[pub.chars[pub.turn]];
  if (mine.sq != null) { const [r, c] = rc(mine.sq); pts.push([c, r]); }
  else { const R = ROOMS[mine.room]; pts.push([R.cx - 1, R.cy - 1], [R.cx + 1, R.cy + 1]); }
  for (const sq of m.squares) { const [r, c] = rc(sq); pts.push([c, r]); }
  for (const x of m.rooms) for (const d of DOOR_LIST) if (d.room === x.room) { const [r, c] = rc(d.roomCell); pts.push([c, r]); }
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs) - 1.2, y0 = Math.min(...ys) - 1.2;
  return { x: x0, y: y0, w: Math.max(...xs) + 2.2 - x0, h: Math.max(...ys) + 2.2 - y0 };
}
function autoZoom(snap, m) {
  if (!zoom) return;
  const pub = snap.pub;
  // your turn begins: show the whole board again
  if (snap.myTurn && pub.turnNo !== zoomTurn) { zoomTurn = pub.turnNo; if (zoom.zoomed && pub.phase === "start") zoom.reset(); }
  const key = m ? "m" + pub.turnNo + ":" + (pub.roll ? pub.roll.total : "") : "";
  if (key === zoomKey) return;
  zoomKey = key;
  // quick moves: only whole rooms to tap, so keep the whole board (zooming cut off lit rooms)
  if (m && !pub.opts.quick && (m.squares.length || m.rooms.length) && zoom.unitPx() < SMALL_SQ) zoom.to(reachArea(pub, m), true);
  else if (!m && zoom.auto) zoom.reset();
}
function renderHighlights(snap) {
  const svg = $("svg.board", gameEl), pub = snap.pub;
  const L = $(".reachL", svg);
  $$(".room-hit", svg).forEach((h) => h.classList.remove("can"));
  let m = null;
  if (!canMoveNow(snap)) { L.innerHTML = ""; }
  else {
    m = movesFor(pub);
    // the whole square takes the tap (the lit tile is drawn a little smaller)
    L.innerHTML = m.squares.map((sq) => { const [r, c] = rc(sq); return `<rect data-sq="${sq}" x="${c}" y="${r}" width="1" height="1" fill="transparent" style="cursor:pointer"/><rect class="reach" data-sq="${sq}" x="${c + .06}" y="${r + .06}" width=".88" height=".88" rx=".14"/>`; }).join("");
    for (const x of m.rooms) $(`.room-hit[data-room="${x.room}"]`, svg).classList.add("can");
  }
  autoZoom(snap, m);
  // 2 players: a small face-down card in each room that holds one (a tick once you've looked)
  $$(".hidcard", svg).forEach((x) => x.remove());
  for (const r of pub.hiddenRooms || []) {
    const R = ROOMS[r], looked = snap.mine && (snap.mine.seen || []).some((x) => x.i < 0 && x.room === r);
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "hidcard" + (looked ? " looked" : ""));
    g.setAttribute("transform", `translate(${R.c1 - 0.95} ${R.ly + 1.1}) rotate(8)`);   // right-hand side, the row under the name plaque (pieces stand lower)
    g.innerHTML = `<rect width=".7" height="1.05" rx=".08" fill="#7a1f2b" stroke="#f3ead6" stroke-width=".07"/><path d="M.15 .2h.4M.15 .4h.4M.15 .6h.4M.15 .8h.4" stroke="#b5485a" stroke-width=".05"/>${looked ? `<path d="M.14 .55l.17 .17.3-.36" fill="none" stroke="#f3ead6" stroke-width=".1" stroke-linecap="round"/>` : ""}`;
    svg.insertBefore(g, $(".hits", svg));
  }
  // case-file odds for each room, written under the room name
  $$(".roomodds", svg).forEach((x) => x.remove());
  if (settings.odds && notes && notes.prob) {
    const n = pub.n;
    ROOMS.forEach((R, k) => {
      const p = notes.prob[12 + k][n];
      const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("class", "roomodds"); t.setAttribute("x", R.cx); t.setAttribute("y", R.r1 + 0.8);
      t.setAttribute("text-anchor", "middle"); t.setAttribute("font-size", ".74"); t.setAttribute("font-weight", "800");
      t.setAttribute("fill", p === 0 ? "#6b7287" : heat(p)); t.textContent = p === 0 ? "✗" : pct(p);
      svg.insertBefore(t, $(".hits", svg));
    });
  }
}

// ------------------------------------------------------------------ notes (your detective sheet)
function updateNotes(snap) {
  const pub = snap.pub, me = snap.mySeat;
  if (me < 0 || !snap.mine) return;
  // face-up leftovers / 2-player room cards are one more pile for the solver (see knowledge.js seatView)
  const K = seatView(pub, snap.mine, me), facts = K.facts;
  const key = JSON.stringify(facts) + pub.n + "|" + K.n;
  const needRank = snap.myTurn && (pub.phase === "suggest" || (pub.phase === "start" && canSuggestHere(pub)));
  if (key === notesKey && (!needRank || rankKey === key + pub.pos[pub.chars[me]].room)) { drawNotes(snap); return; }
  notesKey = key;
  const roomNow = pub.pos[pub.chars[me]].room;
  askSolver({ n: K.n, sizes: K.sizes, facts, rank: needRank ? { me, room: roomNow, samples: 500, seed: pub.turnNo, players: pub.n } : null }).then((r) => {
    if (notesKey !== key) return;
    if (!r.ok) return;
    r.prob = toTable(r.prob, K.pile);   // case file at column n, the pile (if any) at n + 1
    try { notesEffects(r, snap); } catch (e) {}
    notes = r;
    if (r.ranked) { ranked = r.ranked; rankKey = key + roomNow; }
    if (snapNow) { drawNotes(snapNow); renderHighlights(snapNow); }
  });
  drawNotes(snap);
}
function drawNotes(snap) {
  const pub = snap.pub, me = snap.mySeat;
  const el = $("#notes"); if (!el) return;
  if (!notes) { el.innerHTML = `<div class="muted" style="padding:10px">Thinking…</div>`; return; }
  const n = pub.n;
  // a pile column: the face-up leftovers ("Up") or the 2-player room cards ("Rm")
  const pileCol = pub.faceUp && pub.faceUp.length ? "Up" : pub.hiddenRooms && pub.hiddenRooms.length ? "Rm" : "";
  const cols = pub.chars.map((c, i) => `<th style="color:${SUSPECT_COLORS[c]}">${i === me ? "You" : esc(E().short[c].slice(0, 3))}</th>`).join("") + (pileCol ? `<th class="pile">${pileCol}</th>` : "");
  const cats = [["Suspects", 0, 6], ["Weapons", 6, 12], ["Rooms", 12, 21]];
  let rows = "";
  for (const [label, a, b] of cats) {
    rows += `<tr class="cat"><td colspan="${n + 2 + (pileCol ? 1 : 0)}">${label}</td></tr>`;
    for (let c = a; c < b; c++) {
      const pe = notes.prob[c][n];
      const mine = snap.mine.hand.includes(c);
      rows += `<tr class="${pe > 0.9995 ? "solved" : ""} ${mine ? "mine" : ""}"><td class="nm">${esc(cname(c))}</td>` +
        pub.chars.map((_, p) => cellMark(notes.prob[c][p])).join("") + (pileCol ? cellMark(notes.prob[c][n + 1] || 0) : "") +
        `<td class="env" style="color:${pe === 0 ? "#5d6478" : heat(pe)}">${pe === 0 ? "✗" : pe > 0.9995 ? "✓" : settings.odds ? pct(pe) : ""}</td></tr>`;
    }
  }
  el.innerHTML = `<table><thead><tr><th style="text-align:left">Card</th>${cols}<th>File</th></tr></thead><tbody>${rows}</tbody></table>`;
  const top = notes.env[0];
  const envl = $("#envline");
  if (envl && top) envl.innerHTML = `<div class="row between" style="font-size:13px"><span>Best guess: <b>${top.cards.map(sname).join(" · ")}</b></span>${settings.odds ? `<b style="color:${heat(top.p)}">${pct(top.p)}</b>` : ""}</div><div class="muted" style="font-size:12px">${notes.envCount} answers still possible${notes.exact ? "" : " (estimated)"}</div>` +
    (pub.faceUp && pub.faceUp.length ? `<div class="faceup">Face up: <b>${pub.faceUp.map(sname).join(" · ")}</b></div>` : "");
}
function cellMark(p) {
  if (p > 0.9995) return `<td><span class="y">✓</span></td>`;
  if (p < 0.0005) return `<td><span class="x">✗</span></td>`;
  return `<td style="color:#c9cede">${settings.odds ? pct(p) : ""}</td>`;
}

// ------------------------------------------------------------------ sheets: suggest / accuse / show
function chip(c, on, extra = "") {
  const p = notes ? notes.prob[c][snapNow.pub.n] : null;
  const icon = c < 6 ? `<i class="dot" style="background:${SUSPECT_COLORS[c]}"></i>` : c < 12 ? weaponSvg(c - 6, 15) : roomSvg(c - 12, 15);
  const odds = settings.odds && p != null ? `<span class="pc" style="color:${p === 0 ? "#6b7287" : heat(p)}">${p === 0 ? "✗" : pct(p)}</span>` : "";
  return `<button class="chip ${on ? "on" : ""} ${p === 0 ? "no" : ""} ${extra}" data-c="${c}">${icon}<span>${esc(sname(c))}</span>${odds}</button>`;
}
function suggestSheet(snap) {
  const pub = snap.pub, me = snap.mySeat;
  const roomNow = pub.pos[pub.chars[me]].room;
  let pickS = -1, pickW = -1;
  const best = ranked && rankKey.endsWith(String(roomNow)) ? ranked[0] : null;
  const bitsOf = (s, w) => { const r = ranked && ranked.find((x) => x.cards[0] === s && x.cards[1] === w); return r ? r.bits : null; };
  const el = sheet(`<h3>Suggest: in the ${esc(E().rooms[roomNow])}</h3>
    <div class="picker"><div class="label">Who</div><div class="chips" id="cs"></div><div class="label">With</div><div class="chips" id="cw"></div></div>
    <p id="qinfo" class="muted" style="min-height:20px;font-size:13px"></p>
    <div class="row"><button class="btn" id="sBest" ${best ? "" : "disabled"}>Best question</button>${help("Best question", "For every suspect and weapon you could name here, the notes work out what each player might show you and how much that would narrow down the case file, in bits. One bit halves the possible answers. The star is the most informative question.")}<span class="grow"></span><button class="btn primary" id="sGo" disabled>Suggest</button></div>`);
  el.dataset.for = "suggest";   // onSnap closes it once suggesting is over (a second tap while online lags)
  const draw = () => {
    const bS = best && best.cards[0], bW = best && best.cards[1];
    $("#cs", el).innerHTML = [0, 1, 2, 3, 4, 5].map((c) => chip(c, c === pickS, c === bS ? "best" : "")).join("");
    $("#cw", el).innerHTML = [6, 7, 8, 9, 10, 11].map((c) => chip(c, c === pickW, c === bW ? "best" : "")).join("");
    $$("#cs .chip", el).forEach((b) => (b.onclick = () => { pickS = +b.dataset.c; draw(); }));
    $$("#cw .chip", el).forEach((b) => (b.onclick = () => { pickW = +b.dataset.c; draw(); }));
    $("#sGo", el).disabled = pickS < 0 || pickW < 0;
    const bits = pickS >= 0 && pickW >= 0 ? bitsOf(pickS, pickW) : null;
    $("#qinfo", el).innerHTML = bits != null && best ? `This question is worth <b style="color:${heat(best.bits ? bits / best.bits : 1)}">${bits.toFixed(2)} bits</b> (best ${best.bits.toFixed(2)})` : best ? `Best here: ${best.cards.slice(0, 2).map(sname).join(" + ")} — ${best.bits.toFixed(2)} bits` : "";
  };
  draw();
  $("#sBest", el).onclick = () => { if (best) { usedHelp(); pickS = best.cards[0]; pickW = best.cards[1]; draw(); } };
  let sent = false;
  $("#sGo", el).onclick = () => {
    if (sent) return; sent = true;
    const b = bitsOf(pickS, pickW);
    act({ type: "suggest", suspect: pickS, weapon: pickW });
    if (best && b != null) { myQuestions.push({ got: b, best: best.bits }); store.set("questions", myQuestions); }
  };
}
function accuseSheet(snap) {
  let pick = [-1, -1, -1];
  const top = notes && notes.env[0];
  const el = sheet(`<h3>Accuse</h3><p class="muted" style="margin-top:0">Wrong means you're out (you still show cards).</p>
    <div class="picker"><div class="label">Who</div><div class="chips" id="as"></div><div class="label">With</div><div class="chips" id="aw"></div><div class="label">Where</div><div class="chips rooms" id="ar"></div></div>
    <p id="ainfo" style="min-height:20px;font-size:13.5px"></p>
    <div class="row"><button class="btn" id="aTop" ${top ? "" : "disabled"}>Best guess</button><span class="grow"></span><button class="btn ghost" id="aNo">Cancel</button><button class="btn danger" id="aGo" disabled>Accuse</button></div>`);
  const draw = () => {
    const g = (id, a, b, k) => { $(id, el).innerHTML = Array.from({ length: b - a }, (_, i) => chip(a + i, pick[k] === a + i)).join(""); $$(id + " .chip", el).forEach((x) => (x.onclick = () => { pick[k] = +x.dataset.c; draw(); })); };
    g("#as", 0, 6, 0); g("#aw", 6, 12, 1); g("#ar", 12, 21, 2);
    const ready = pick.every((c) => c >= 0);
    $("#aGo", el).disabled = !ready;
    if (ready && notes) {
      const m = notes.env.find((x) => x.cards.every((c, i) => c === pick[i]));
      const ruledOut = pick.some((c) => notes.prob[c][snapNow.pub.n] === 0);
      const low = notes.env.length ? notes.env[notes.env.length - 1].p : 0;
      const txt = m ? `<b style="color:${heat(m.p)}">${pct(m.p)}</b>` : ruledOut || notes.envCount <= notes.env.length ? `<b style="color:${heat(0)}">0%</b> — your notes rule it out` : `<b style="color:${heat(low)}">under ${pct(low)}</b>`;
      $("#ainfo", el).innerHTML = settings.odds || ruledOut ? `Chance this is right: ${txt}` : "";
    } else $("#ainfo", el).innerHTML = "";
  };
  draw();
  $("#aTop", el).onclick = () => { usedHelp(); pick = top.cards.slice(); draw(); };
  $("#aNo", el).onclick = closeSheet;
  $("#aGo", el).onclick = () => {
    // "Hunch": you accused while your notes still allowed another answer
    if (room && room.meta && notes) { const m = notes.env.find((x) => x.cards.every((c, i) => c === pick[i])); room.meta.hunch = !m || m.p < 0.9995; }
    act({ type: "accuse", suspect: pick[0], weapon: pick[1], room: pick[2] - 12 });
  };
}
function showSheet(snap) {
  const pub = snap.pub, opts = snap.mine.mustShow || [];
  const asker = pub.sugg.by;
  const already = opts.filter((c) => (snap.mine.showed || []).some((x) => x.to === asker && x.card === c));
  const o = $("#overlay");
  const el = sheet(`<h3>${esc(seatName(pub, asker, snap))} asks: ${pub.sugg.cards.map(sname).join(", ")}</h3>
    <p class="muted" style="margin-top:0">Show one card. Only they see it.${already.length ? " Tip: they've already seen the green-outlined one." : ""}</p>
    <div class="row" style="justify-content:center;gap:10px">${opts.map((c) => `<div class="cardf lg pick" data-c="${c}" style="${already.includes(c) ? "outline-color:var(--good)" : ""}">${cardSvg(settings.edition, c)}</div>`).join("")}</div>`);
  o.dataset.lock = "1";
  $$(".cardf", el).forEach((x) => (x.onclick = () => act({ type: "show", card: +x.dataset.c })));
}

// ------------------------------------------------------------------ game over
function gameOver(snap) {
  const pub = snap.pub;
  if (!pub.reveal) return;
  const me = snap.mySeat;
  const won = pub.winner === me;
  if (snap.mode === "local" && room && room.meta) { recordLocal(pub.turnNo, pub.reveal.env, won, room.meta, room.state); store.del("local"); }
  const q = myQuestions.length ? myQuestions.reduce((a, x) => a + (x.best > 0 ? x.got / x.best : 1), 0) / myQuestions.length : null;
  const hands = pub.reveal.hands.map((h, i) => `<div class="row" style="font-size:13px;gap:6px"><i style="width:10px;height:10px;border-radius:50%;background:${SUSPECT_COLORS[pub.chars[i]]};display:inline-block"></i><b style="min-width:58px">${esc(seatName(pub, i, snap))}</b><span class="muted">${h.map(sname).join(", ")}</span></div>`).join("");
  sheet(`<h3>${pub.winner >= 0 ? (won ? "You solved it!" : esc(seatName(pub, pub.winner, snap)) + " solved it") : "Nobody solved it"}</h3>
    <div class="row" style="justify-content:center;gap:8px;margin:6px 0 10px">${pub.reveal.env.map((c, k) => `<div class="cardf lg turnup" style="animation-delay:${0.15 + k * 0.35}s">${cardSvg(settings.edition, c)}${cardBackHtml()}</div>`).join("")}</div>
    ${q != null ? `<p>Your questions found <b style="color:${heat(q)}">${Math.round(q * 100)}%</b> of the best possible information ${help("Question quality", "Each time you suggested, the notes compared what your question could teach you (in bits) with the best question available in that room. 100% means you always asked the best one.")}</p>` : ""}
    <div class="stack" style="gap:3px">${hands}${extraCards(pub)}</div>
    <div class="row" style="justify-content:flex-end;margin-top:10px">${canReplay() ? `<button class="btn" id="replay">Replay</button>` : ""}<button class="btn" data-close>Look at board</button><button class="btn primary" id="again">New game</button></div>`,
    (el) => { $("[data-close]", el).onclick = closeSheet; const rb = $("#replay", el); if (rb) rb.onclick = () => { closeSheet(); startReplay(); }; $("#again", el).onclick = () => { closeSheet(); store.del("local"); if (snap.mode === "online" && online) online.leave(); setupView(); }; });
}

/** Game over: the 2-player room cards and the face-up leftovers, after the hands. */
function extraCards(pub) {
  const line = (label, txt) => `<div class="row" style="font-size:13px;gap:6px"><i style="width:10px;display:inline-block"></i><b style="min-width:58px">${label}</b><span class="muted">${txt}</span></div>`;
  let h = "";
  if (pub.reveal.hidden && pub.reveal.hidden.length) h += line("Rooms", pub.reveal.hidden.map((x) => `${esc(sname(x.card))} (${esc(E().rooms[x.room])})`).join(", "));
  if (pub.faceUp && pub.faceUp.length) h += line("Face up", pub.faceUp.map((c) => esc(sname(c))).join(", "));
  return h;
}

// ------------------------------------------------------------------ replay (local games): every move and question again, with every card face up
let rp = null;   // { frames, i, timer, st }
function canReplay() { return !!(room && room.mode === "local" && room.meta && room.meta.frames && room.meta.frames.length && room.state && room.state.over); }
function frameText(f, st) {
  const nm = (i) => `<b style="color:${SUSPECT_COLORS[st.chars[i]]}">${esc(seatName(st, i, snapNow))}</b>`;
  const L = f.last;
  if (!L) return "The cards are dealt";
  if (L.t === "move") return L.to && L.to.room != null ? `${nm(L.by)} walked into the ${esc(E().rooms[L.to.room])}` : `${nm(L.by)} moved`;
  if (L.t === "passage") return `${nm(L.by)} took the secret passage to the ${esc(E().rooms[L.to])}`;
  if (L.t === "suggestDone") {
    const r = st.log[L.i];
    if (!r) return "";
    const shown = r.shower != null ? ((st.showed[r.shower] || []).find((x) => x.i === L.i) || {}).card : null;
    return `${nm(r.by)} asked ${r.cards.map((c) => esc(sname(c))).join(", ")}: ` + (r.shower == null ? "nobody could show a card" : `${nm(r.shower)} showed <b>${esc(sname(shown))}</b>`);
  }
  if (L.t === "accuse") return `${nm(L.by)} accused ${L.cards.map((c) => esc(sname(c))).join(", ")}: <b>${L.correct ? "right!" : "wrong, out"}</b>`;
  return "";
}
function startReplay() {
  if (!canReplay() || !gameEl) return;
  stopPlay();
  const st = room.state;
  const first = { pos: game.setup(st.n, st.opts, () => 0.5, []).pos, wr: (room.meta.startWr || st.weaponRoom), last: null };
  rp = { frames: [first].concat(room.meta.frames), i: 0, timer: null, st };
  gameEl.classList.add("replaying");
  if (zoom && zoom.zoomed) zoom.reset();
  drawReplay();
}
function drawReplay() {
  if (!rp || !gameEl) return;
  const f = rp.frames[rp.i];
  placePieces({ pos: f.pos, weaponRoom: f.wr });
  const bar = $("#bar", gameEl);
  bar.classList.remove("mine");
  $(".msg", bar).innerHTML = `<span class="rp-n">${rp.i + 1}/${rp.frames.length}</span> ${frameText(f, rp.st)}`;
  $(".acts", bar).innerHTML = `<button class="btn" id="rpStart" aria-label="First">⏮</button><button class="btn" id="rpBack" aria-label="Back">◀</button><button class="btn primary" id="rpPlay">${rp.timer ? "Pause" : "Play"}</button><button class="btn" id="rpNext" aria-label="Next">▶</button><button class="btn ghost" id="rpDone">Done</button>`;
  const go = (i) => { rp.i = Math.max(0, Math.min(rp.frames.length - 1, i)); drawReplay(); };
  $("#rpStart", bar).onclick = () => { stopPlay(); go(0); };
  $("#rpBack", bar).onclick = () => { stopPlay(); go(rp.i - 1); };
  $("#rpNext", bar).onclick = () => { stopPlay(); go(rp.i + 1); };
  $("#rpPlay", bar).onclick = () => {
    if (rp.timer) { stopPlay(); drawReplay(); return; }
    if (rp.i >= rp.frames.length - 1) rp.i = 0;
    rp.timer = setInterval(() => { if (!rp) return; if (rp.i >= rp.frames.length - 1) { stopPlay(); drawReplay(); return; } go(rp.i + 1); }, 1100 / settings.speed);
    drawReplay();
  };
  $("#rpDone", bar).onclick = endReplay;
}
function stopPlay() { if (rp && rp.timer) { clearInterval(rp.timer); rp.timer = null; } }
function endReplay() {
  stopPlay(); rp = null;
  if (!gameEl || !snapNow) return;
  gameEl.classList.remove("replaying");
  placePieces(snapNow.pub);
  renderBar(snapNow);
}

// ------------------------------------------------------------------ ONLINE
// A player who closes their tab mid-game: the host's page hands that seat to a computer once the
// seat has been offline for a while and the game is waiting on it. The host can also do it by tapping the seat.
const AWAY_MS = 20000;
const awaySince = new Map();
function watchAway(snap) {
  if (!snap.isHost || !snap.pub || snap.pub.over) { awaySince.clear(); return; }
  const now = Date.now();
  snap.seats.forEach((sn, i) => {
    const away = i !== snap.mySeat && sn.kind === "human" && !sn.online;
    if (!away) { awaySince.delete(i); return; }
    if (!awaySince.has(i)) awaySince.set(i, now);
  });
  clearTimeout(watchAway.t);
  if (awaySince.size) watchAway.t = setTimeout(checkAway, 2000);
}
function checkAway() {
  const snap = snapNow;
  if (!snap || snap.mode !== "online" || !snap.isHost || !snap.pub || snap.pub.over) return;
  for (const [i, since] of awaySince) {
    const sn = snap.seats[i];
    if (!sn || sn.kind !== "human" || sn.online) { awaySince.delete(i); continue; }
    if (snap.toAct.includes(i) && Date.now() - since > AWAY_MS) {
      awaySince.delete(i);
      online.setSeat(i, "computer").then((r) => { if (r && r.ok) toast(`${sn.name || "A player"} left — a computer took their seat`, 3000); });
    }
  }
  if (awaySince.size) watchAway.t = setTimeout(checkAway, 2000);
}
function handOver(i) {
  const snap = snapNow;
  if (!snap || !snap.isHost) return;
  const sn = snap.seats[i];
  sheet(`<h3>${esc(sn.name || "This player")} is offline</h3><p>Let a computer play their seat? Their cards stay the same.</p>
    <div class="row" style="justify-content:flex-end"><button class="btn ghost" data-close>Wait</button><button class="btn primary" id="hoYes">Computer plays</button></div>`,
    (el) => { $("[data-close]", el).onclick = closeSheet; $("#hoYes", el).onclick = async () => { closeSheet(); const r = await online.setSeat(i, "computer"); if (!r.ok) toast(r.message); }; });
}
function quitGame() {
  closeSheet(true);
  try { history.replaceState(null, "", "#play"); } catch (e) {}
  // quitting a game against the computers counts as a loss
  if (room && room.mode === "local" && room.meta && !room.state.over) recordLocal(room.state.turnNo, room.state.env, false, room.meta, room.state);
  store.del("local");
  if (room && room.close) room.close();
  if (snapNow && snapNow.mode === "online" && online) online.leave();
  setupView();
  showTab("play", false);
}
function getOnline() {
  if (!online) {
    online = createOnline({ game, gameId: "clue", botDelayMs: 800 });
    online.on("change", (s) => { if (room && room.mode === "local") return; onSnap(s); });
    online.on("error", (m) => toast(typeof m === "string" ? m : m && m.message || "Online error"));
  }
  return online;
}
function onlineView() {
  if (room && room.close) room.close();
  room = null; gameEl = null; view = "onlineForm";
  pushLayer("online");
  const name = store.get("name", "");
  play.innerHTML = `<div class="setup-wrap"><div class="hero">${logoSvg()}<p>Play with friends on their own phones.</p></div>
    <div class="panel stack">
      <div><div class="label">Your name</div><input type="text" id="oName" maxlength="20" value="${esc(name)}" placeholder="Name"></div>
      <button class="btn primary" id="oCreate">Create a room</button>
      <div class="row"><input type="text" id="oCode" maxlength="5" placeholder="Code" style="text-transform:uppercase;letter-spacing:.2em"><button class="btn" id="oJoin">Join</button></div>
      <p class="muted" style="margin:0;font-size:13px">Room size and your suspect come from the Play screen. Empty seats become computers.</p>
      <button class="btn ghost" id="oBack">Back</button>
    </div></div>`;
  $("#oBack").onclick = () => { setupView(); popLayer(); };
  $("#oCreate").onclick = async () => {
    const nm = $("#oName").value.trim() || "Player"; store.set("name", nm);
    const chars = suspectsFor(settings.players, settings.me);
    const seats = chars.map((c) => (c === settings.me ? "human" : "empty"));
    $("#oCreate").disabled = true;
    const r = await getOnline().createRoom({ name: nm, seats, options: gameOptions(chars) });
    if (!r.ok) { toast(r.message); const b = $("#oCreate"); if (b) b.disabled = false; }
  };
  $("#oJoin").onclick = async () => {
    const nm = $("#oName").value.trim() || "Player"; store.set("name", nm);
    const code = $("#oCode").value.trim().toUpperCase();
    if (code.length !== 5) { toast("Codes are 5 letters"); return; }
    $("#oJoin").disabled = true;
    const r = await getOnline().joinRoom(code, nm);
    if (!r.ok) { toast(r.message || "Couldn't join that room"); const b = $("#oJoin"); if (b) { b.disabled = false; b.textContent = "Join"; } }
  };
}
function lobbyView(snap) {
  gameEl = null; view = "lobby";
  const chars = (snap.options && snap.options.chars) || [];
  play.innerHTML = `<div class="setup-wrap"><div class="panel stack" style="text-align:center">
      <div class="label">Room code</div><div style="font-size:44px;font-weight:900;letter-spacing:.25em">${esc(snap.code || "…")}</div>
      <div class="muted" style="font-size:13px">Friends open this page, tap Play online, and type the code.</div></div>
    <div class="panel stack" id="lseats">${snap.seats.map((s, i) => {
      const c = chars[i];
      const who = s.kind === "human" ? esc(s.name || "Player") + (s.isHost ? " (host)" : "") : s.kind === "computer" ? "Computer" : "Open seat";
      const ctl = snap.isHost && s.kind !== "human" ? `<button class="btn small" data-seat="${i}">${s.kind === "computer" ? "Make open" : "Computer"}</button>` : "";
      return `<div class="row between"><div class="row">${c != null ? pawnSvg(c, 26) : ""}<b>${c != null ? esc(E().short[c]) : "Seat " + (i + 1)}</b><span class="muted">${who}</span></div>${ctl}</div>`;
    }).join("")}</div>
    ${snap.isHost ? `<button class="btn primary" id="lStart" style="min-height:50px">Start game</button>` : `<div class="muted" style="text-align:center">Waiting for the host to start…</div>`}
    <button class="btn ghost" id="lLeave">Leave</button></div>`;
  $$("#lseats [data-seat]").forEach((b) => (b.onclick = () => online.setSeat(+b.dataset.seat, snap.seats[+b.dataset.seat].kind === "computer" ? "empty" : "computer")));
  const st = $("#lStart"); if (st) st.onclick = () => online.start();
  $("#lLeave").onclick = async () => { await online.leave(); setupView(); };
}

// ------------------------------------------------------------------ SETTINGS
function settingsView() {
  const el = $("#tab-settings");
  const seg = (key, opts) => `<div class="seg" data-key="${key}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(settings[key]) === String(v) ? "on" : ""}">${l}</button>`).join("")}</div>`;
  el.innerHTML = `<div class="page"><h2>Settings</h2><div class="panel">
    <div class="setrow"><div class="lbl">Names ${help("Names", "Classic: the North American names. Cluedo: the British names (Dagger, Spanner, Reverend Green). 2016: Dr. Orchid instead of Mrs. White. 2023: Chef White, Mayor Green and Solicitor Peacock.")}<small>Card names</small></div>${seg("edition", Object.entries(EDITIONS).map(([k, v]) => [k, v.label]))}</div>
    <div class="setrow"><div class="lbl">Rules ${help("Which rules?", "Clue: the classic North American rules — one die, and you must leave a room before suggesting there again. Cluedo: the British rules — two dice, and you may stay in a room and suggest again. Newer: the 2016 and later rules — two dice, stay if you like, and move up to your roll. The board is the classic one in all three.")}<small>For new games</small></div>${seg("rules", Object.entries(RULESETS).map(([k, v]) => [k, v.label]))}</div>
    <div class="setrow"><div class="lbl">Show odds<small>Percentages on cards and rooms</small></div><label class="switch"><input type="checkbox" id="sOdds" ${settings.odds ? "checked" : ""}><span></span></label></div>
    <div class="setrow"><div class="lbl">Speed<small>Computer turns and walking</small></div>${seg("speed", [[0.6, "Slow"], [1, "Normal"], [2, "Fast"]])}</div>
  </div>
  <div class="panel"><div class="label">House rules ${help("House rules", "Common ways people play at home. They apply to new games, also online, but not to the Daily or the guided game. The Rules sheet explains each one.")}</div>
    <div class="setrow"><div class="lbl">Leftovers face up<small>4 or 5 players: equal hands, spares shown</small></div><label class="switch"><input type="checkbox" id="sFaceUp" ${settings.faceUp ? "checked" : ""}><span></span></label></div>
    <div class="setrow"><div class="lbl">Quick moves<small>No dice: go straight to any room</small></div><label class="switch"><input type="checkbox" id="sQuick" ${settings.quick ? "checked" : ""}><span></span></label></div>
  </div>
  <div class="panel"><div class="label">Sound &amp; effects</div><div id="fxSet"></div></div>
  <div class="panel"><div class="setrow"><div class="lbl">Rules<small>The whole rulebook, in short sections</small></div><button class="btn small" id="sRules">Rules</button></div>
    <div class="setrow"><div class="lbl">Guided game<small>A first game that shows you each step</small></div><button class="btn small" id="sTut">Replay tutorial</button></div></div>
  ${snapNow && snapNow.pub && !snapNow.pub.over ? `<div class="panel"><div class="setrow"><div class="lbl">${snapNow.mode === "online" ? "Leave room" : "Quit game"}<small>${snapNow.mode === "online" ? "A computer takes your seat" : "Ends the game you're playing"}</small></div><button class="btn small danger" id="sQuit">${snapNow.mode === "online" ? "Leave" : "Quit"}</button></div></div>` : ""}
  <div class="panel"><div class="setrow"><div class="lbl">Reset record<small>Your win/loss count</small></div><button class="btn small" id="sReset">Reset</button></div></div></div>`;
  $$("[data-key]", el).forEach((g) => $$("button", g).forEach((b) => (b.onclick = () => {
    const k = g.dataset.key; const v = b.dataset.v;
    settings[k] = k === "edition" || k === "rules" ? v : +v; saveSettings(); settingsView();
    if (k === "edition" && snapNow && snapNow.pub && gameEl) { buildGame(snapNow); renderGame(snapNow, null); }
  })));
  FX.renderSettings($("#fxSet", el));
  $("#sOdds", el).onchange = (e) => { settings.odds = e.target.checked; saveSettings(); if (snapNow) { if (snapNow.pub && gameEl) renderGame(snapNow, null); renderHighlights(snapNow); drawNotes(snapNow); } };
  $("#sFaceUp", el).onchange = (e) => { settings.faceUp = e.target.checked; saveSettings(); };
  $("#sQuick", el).onchange = (e) => { settings.quick = e.target.checked; saveSettings(); };
  const q = $("#sQuit", el);
  if (q) q.onclick = () => sheet(`<h3>${snapNow.mode === "online" ? "Leave this room?" : "Quit this game?"}</h3><div class="row" style="justify-content:flex-end"><button class="btn ghost" data-close>Cancel</button><button class="btn danger" id="qYes">${snapNow.mode === "online" ? "Leave" : "Quit"}</button></div>`,
    (s) => { $("[data-close]", s).onclick = closeSheet; $("#qYes", s).onclick = quitGame; });
  $("#sReset", el).onclick = () => { store.set("record", { w: 0, l: 0 }); try { Profile.reset(); } catch (e) {} paintMe(); toast("Record reset"); };
  $("#sRules", el).onclick = () => openRules();
  $("#sTut", el).onclick = () => {
    if (snapNow && snapNow.mode === "online") { toast("Leave the online room first"); return; }
    if (room && snapNow && snapNow.pub && !snapNow.pub.over && !(room.meta && room.meta.tutorial)) {
      sheet(`<h3>Start the guided game?</h3><p>The game you're playing ends and counts as a loss.</p><div class="row" style="justify-content:flex-end"><button class="btn ghost" data-close>Cancel</button><button class="btn primary" id="tYes">Start</button></div>`,
        (s2) => { $("[data-close]", s2).onclick = closeSheet; $("#tYes", s2).onclick = () => { recordLocal(room.state.turnNo, room.state.env, false, room.meta, room.state); startTutorial(); }; });
      return;
    }
    startTutorial();
  };
}

// ------------------------------------------------------------------ boot
// My stats, achievements and the Daily game (shared _profile kit; everything stays on this device)
try {
  Profile.init({
    game: "clue", levels: PF_LEVELS, achievements: achievements(),
    modes: { help: { name: "Computers, with help" }, online: { hide: true }, friends: { hide: true } },
    daily: { title: "Daily game", onPlay: () => startDaily() },
    onChange: (what) => { if (what === "me" || what === "import" || what === "result" || what === "reset") paintMe(); },
  });
  // bring the old win/loss counter into My stats once (unrated: the level wasn't kept)
  const rec = store.get("record", { w: 0, l: 0 });
  if (!store.get("pfMoved", false)) {
    store.set("pfMoved", true);
    const day = Profile.daily.date();
    let w = Math.min(rec.w, 200), l = Math.min(rec.l, 200);
    while (w > 0 || l > 0) {   // interleaved, so moving them in doesn't invent a winning streak
      if (l > 0) { l--; Profile.recordResult({ mode: "computer", level: null, won: false, date: day, quiet: true }); }
      if (w > 0) { w--; Profile.recordResult({ mode: "computer", level: null, won: true, date: day, quiet: true }); }
    }
  }
} catch (e) { console.warn("profile", e); }
// the guided first game: steps follow the game's own state; they step aside on other tabs and under sheets
let tour = null;
try {
  tour = COACH.tour({
    id: "clue-first",
    steps: tutorialSteps({ snap: () => (room && room.meta && room.meta.tutorial && snapNow && snapNow.mode === "local" ? snapNow : null), wide: () => window.matchMedia("(min-width: 900px)").matches }),
    pauseIf: () => !$("#tab-play").classList.contains("active") || !(room && room.meta && room.meta.tutorial) || sheetOpen() || (Profile && Profile.isOpen()),
  });
} catch (e) { console.warn("coach", e); }
// home-screen install: reload for a new build only when nothing would be lost
if (window.PWA) window.PWA.safeToReload = () => {
  const ae = document.activeElement;
  if ((snapNow && snapNow.mode === "online") || view === "lobby" || view === "onlineForm" || sheetOpen() || (COACH && COACH.rulesOpen()) || (Profile && Profile.isOpen())) return false;
  if (ae && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName)) return false;
  return view === "setup" || !snapNow || !snapNow.pub || snapNow.pub.over;
};
settingsView();
initNotepad($("#tab-table"));
showTab(location.hash.slice(1) || "play", false);
(async () => {
  const saved = store.get("local", null);
  const resumeOnline = store.get("online.clue.hint", false);
  if (saved && !validSave(saved)) store.del("local");
  else if (saved && saved.state.over) {
    // the page was closed in the moment the game ended: count it, then start fresh
    const me = saved.seats.findIndex((x) => x.kind === "human");
    myQuestions = store.get("questions", []);
    recordLocal(saved.state.turnNo, saved.state.env, saved.state.winner === me, saved.meta || {}, saved.state);
    store.del("local");
  } else if (saved) {
    myQuestions = store.get("questions", []);
    try { startLocal(saved); if (saved.meta && saved.meta.tutorial && tour) tour.resume(); return; } catch (e) { console.warn("saved game dropped", e); store.del("local"); room = null; }
  }
  setupView();
  try { if (localStorage.getItem("online.clue")) { const ok = await getOnline().resume(); if (!ok) setupView(); } } catch (e) {}
  void resumeOnline;
})();

// test hook (headless checks)
window.__clue = { get snap() { return snapNow; }, act, settings, get online() { return online; }, get room() { return room; }, undo, startDaily, startTutorial, openRules, get tour() { return tour; } };

// turning the phone: the seats across the table re-fit their name plates
let fitT = null;
window.addEventListener("resize", () => { clearTimeout(fitT); fitT = setTimeout(() => { if (snapNow && snapNow.pub && gameEl) renderPlayers(snapNow); }, 150); });
