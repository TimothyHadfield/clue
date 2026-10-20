/* Clue — the page. Play (you + computers, or online), Notepad (real table), Learn, Settings. */
import "./fx.js";
import { eventsFor, perform, defineSounds, DEAL_AT, DEAL_GAP } from "./sfx.js";
import { game, movesFor, canPassage, canSuggestHere } from "./game.js";
import { createOnline } from "./online.js";
import { EDITIONS, RULESETS, SUSPECT_COLORS, cardName, shortName } from "./cards.js";
import { cardSvg, weaponSvg, roomSvg, pawnSvg, dieHtml, logoSvg } from "./art.js";
import { boardSvg, roomHitPaths, placeXY, tokenSvg, weaponPieceSvg, walkPath, ROOMS } from "./boardview.js";
import { reach, PASSAGE, idx, rc } from "./board.js";
import { factsFor, handSizes } from "./knowledge.js";
import { recordsFor, LEVELS } from "./ai.js";
import { initNotepad, refreshNotepad } from "./notepad.js";
import { $, $$, esc, store, settings, saveSettings, toast, sheet, closeSheet, sheetOpen, pushLayer, popLayer, takeOwnBack, pct, heat, help, askSolver } from "./ui.js";
import { initLearn } from "./learn.js";

// sounds, celebrations and animations (all switchable in Settings → Sound & effects)
const FX = window.FX;
FX.init({ game: "clue", accent: "#6ea8fe" });
defineSounds(FX);
const stillPage = () => document.documentElement.classList.toggle("fx-still", !FX.settings.animations);
stillPage(); FX.onChange(stillPage);

const E = () => EDITIONS[settings.edition] || EDITIONS.classic;
const cname = (c) => cardName(settings.edition, c);
const sname = (c) => shortName(settings.edition, c);

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
  if (takeOwnBack()) { if (sheetOpen() || (gameEl && gameEl.classList.contains("notesopen"))) pushLayer("again"); return; }
  if (sheetOpen()) { if (o.dataset.lock === "1") pushLayer("sheet"); else closeSheet(true); return; }
  if (gameEl && gameEl.classList.contains("notesopen")) { gameEl.classList.remove("notesopen"); return; }
  showTab(location.hash.slice(1), false);
});

// ------------------------------------------------------------------ local room (same snapshot shape as online.js, plus save/resume)
function localRoom({ seats, options, state }) {
  const handlers = [];
  const S = seats;
  let st = state || game.setup(S.length, options, Math.random, S);
  let timer = null, closed = false;
  const humanSeat = S.findIndex((s) => s.kind === "human");
  const snap = () => {
    const over = game.isOver(st);
    const toAct = over ? [] : game.toAct(st);
    return { mode: "local", status: over ? "finished" : "playing", seats: S.map((s) => ({ kind: s.kind, name: s.name, online: true })),
      toAct, pub: game.publicView(st), mySeat: humanSeat, mine: game.privateView(st, humanSeat), myTurn: toAct.includes(humanSeat), isHost: true };
  };
  const emit = () => { store.set("local", { seats: S, state: st }); const s = snap(); handlers.forEach((f) => f(s)); bots(); };
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
        st = game.apply(JSON.parse(JSON.stringify(st)), seat, a, Math.random);
      } catch (e) { console.error(e); return; }
      emit();
    }, delay);
  }
  return {
    mode: "local",
    on(ev, f) { if (ev === "change") handlers.push(f); },
    act(a) {
      if (!game.toAct(st).includes(humanSeat)) return { ok: false, message: "Not your turn" };
      try { st = game.apply(JSON.parse(JSON.stringify(st)), humanSeat, a, Math.random); }
      catch (e) { FX.play("error"); toast(e.message); return { ok: false, message: e.message }; }
      emit(); return { ok: true };
    },
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
  const rec = store.get("record", { w: 0, l: 0 });
  play.innerHTML = `<div class="setup-wrap">
    <div class="hero">${logoSvg()}<p>Find who, with what, and where — first.</p></div>
    <div class="panel stack">
      <div><div class="label">Players</div><div class="seg" id="pn">${[3, 4, 5, 6].map((k) => `<button data-n="${k}" class="${k === n ? "on" : ""}">${k}</button>`).join("")}</div></div>
      <div><div class="label">You are</div><div class="who" id="pme">${[0, 1, 2, 3, 4, 5].map((s) => `<button data-s="${s}" class="${s === settings.me ? "on" : used.includes(s) ? "" : "off"}">${pawnSvg(s, 30)}${E().short[s]}</button>`).join("")}</div></div>
      <div><div class="label">Computers ${help("How strong are they?", "Easy only crosses off cards it is shown. Medium reasons like a careful player with a pencil. Hard counts every possible deal and asks the question that teaches it the most. Win rates are on the Learn tab.")}</div>
        <div class="seg" id="plv">${LEVELS.map((l, i) => `<button data-l="${i}" class="${i === settings.level ? "on" : ""}">${l}</button>`).join("")}</div></div>
      <button class="btn primary" id="go" style="min-height:50px;font-size:17px">Deal</button>
      <button class="btn" id="goOnline">Play online</button>
    </div>
    <div class="record"><span>You won ${rec.w}</span><span>Lost ${rec.l}</span></div>
  </div>`;
  $$("#pn button").forEach((b) => (b.onclick = () => { settings.players = +b.dataset.n; saveSettings(); setupView(); }));
  $$("#pme button").forEach((b) => (b.onclick = () => { settings.me = +b.dataset.s; saveSettings(); setupView(); }));
  $$("#plv button").forEach((b) => (b.onclick = () => { settings.level = +b.dataset.l; saveSettings(); setupView(); }));
  $("#go").onclick = startLocal;
  $("#goOnline").onclick = onlineView;
}
function gameOptions(chars) {
  const R = RULESETS[settings.rules] || RULESETS.classic;
  return { chars, dice: R.dice, stay: R.stay, upTo: R.upTo, edition: settings.edition, levels: chars.map(() => settings.level) };
}
/** You plus the next suspects clockwise. */
function suspectsFor(n, me) {
  const s = [me];
  for (let k = 1; s.length < n; k++) s.push((me + k) % 6);
  return s.sort((a, b) => a - b);
}
function startLocal(resume) {
  let seats, options, state = null;
  if (resume && resume.state) { seats = resume.seats; state = resume.state; options = state.opts; }
  else {
    const chars = suspectsFor(settings.players, settings.me);
    seats = chars.map((c) => (c === settings.me ? { kind: "human", name: "You" } : { kind: "computer", name: E().short[c] }));
    options = gameOptions(chars);
    myQuestions = [];
    store.set("questions", myQuestions);
  }
  room = localRoom({ seats, options, state });
  room.on("change", onSnap);
  room.start();
}

function onSnap(snap) {
  if (snap.status === "lobby" || snap.status === "joining") { lobbyView(snap); return; }
  if (!snap.pub) {
    if (view === "onlineForm" || view === "setup") return;   // a failed join keeps the form and what you typed
    if (snap.status === "closed") toast("The room was closed", 3000);
    if (snap.status === "closed" || snap.status === "left" || snap.status === "none") setupView();
    return;
  }
  view = "game";
  const first = !gameEl || snapNow && snapNow.pub && snapNow.pub.n !== snap.pub.n;
  const prev = snapNow;
  snapNow = snap;
  if (first) buildGame(snap);
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
      g.style.left = r.left + r.width / 2 - 9 + "px"; g.style.top = r.top + r.height / 2 - 13 + "px";
      document.body.appendChild(g);
      FX.flyTo(g, to, { clone: false, scale: 1, duration: 520 }).then(() => g.remove());
    },
    // the dealt cards fly from the middle of the board into your hand
    deal: () => {
      if (!FX.settings.animations || !gameEl) return;
      const b = $("#bw", gameEl).getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      const sp = FX.settings.animSpeed === "fast" ? 0.55 : 1;
      $$("#hand .cardf", gameEl).forEach((c, i) => {
        const r = c.getBoundingClientRect();
        try {
          c.animate([{ transform: `translate(${cx - r.left - r.width / 2}px, ${cy - r.top - r.height / 2}px) scale(.45) rotate(-12deg)`, opacity: 0 }, { transform: "none", opacity: 1 }],
            { duration: 300 * sp, delay: Math.max(0, DEAL_AT + i * DEAL_GAP - 300 * sp), easing: "cubic-bezier(.3,.7,.3,1)", fill: "backwards" });
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
  play.innerHTML = `<div class="game" id="game">
    <div class="players" id="players"></div>
    <div class="boardwrap" id="bw">${boardSvg(settings.edition)}</div>
    <div class="side" id="side">
      <div class="row between"><div class="label">Your notes ${help("How the notes work", "Every way the 21 cards could have been dealt that fits what you have seen is counted. A card's number is the share of those deals where it sits in that hand or in the case file. ✓ and ✗ mean certain.")}</div><button class="btn small ghost" id="closeNotes">Close</button></div>
      <div class="envline" id="envline"></div>
      <div class="notes" id="notes" style="flex:1"></div>
      <div class="log" id="log" style="max-height:24%"></div>
    </div>
    <div class="bar" id="bar"></div>
  </div>`;
  gameEl = $("#game");
  const svg = $("svg.board", gameEl);
  $(".hits", svg).innerHTML = roomHitPaths();
  $(".toks", svg).innerHTML = [0, 1, 2, 3, 4, 5].map(tokenSvg).join("");
  $(".weps", svg).innerHTML = [0, 1, 2, 3, 4, 5].map(weaponPieceSvg).join("");
  $("#closeNotes").onclick = () => { gameEl.classList.remove("notesopen"); popLayer(); };
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
    const stepMs = 110 / settings.speed;
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
  if (pub.over && !(pp && pp.over)) setTimeout(() => gameOver(snap), 900 / settings.speed);
}

function seatName(pub, i, snap) {
  const sn = snap && snap.seats && snap.seats[i];
  const base = E().short[pub.chars[i]];
  if (snap && i === snap.mySeat) return "You";
  if (sn && sn.kind === "human" && sn.name && snap.mode === "online") return sn.name;
  return base;
}
function renderPlayers(snap) {
  const pub = snap.pub;
  // narrow screens with many players: short labels that stay different (Pe / Pl)
  const room4 = (Math.min(window.innerWidth, 900) - 90) / pub.n;
  const keep = room4 < 62 ? 2 : room4 < 80 ? 3 : 99;
  $("#players").innerHTML = pub.chars.map((c, i) => {
    const cls = ["pl", i === pub.turn && !pub.over ? "turn" : "", pub.sugg && pub.sugg.asking === i ? "asking" : "", pub.out[i] ? "out" : ""].join(" ");
    const sn = snap.seats && snap.seats[i];
    const away = snap.mode === "online" && i !== snap.mySeat && sn && sn.kind === "human" && !sn.online;
    const full = seatName(pub, i, snap);
    const label = i === snap.mySeat ? (keep < 3 ? "Me" : "You") : Array.from(full).slice(0, keep).join("");
    const ctl = away && snap.isHost && !pub.over ? ` data-away="1"` : "";
    return `<div class="${cls}${away ? " away" : ""}" data-seat="${i}" title="${esc(full)} · ${pub.sizes[i]} cards"${ctl}><i style="background:${SUSPECT_COLORS[c]}"></i><span class="nm">${esc(label)}${away ? " ·off" : ""}</span>${keep > 2 ? `<span class="ct" title="cards">${pub.sizes[i]}</span>` : ""}</div>`;
  }).join("") + `<button class="btn small" id="notesBtn" style="flex:none;min-height:30px">Notes</button>`;
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
}
function revealCard(who, c) {
  sheet(`<h3>${esc(who)} showed you</h3><div class="row" style="justify-content:center;margin:8px 0"><div class="cardf lg deal-in">${cardSvg(settings.edition, c)}</div></div><div class="row" style="justify-content:flex-end"><button class="btn primary" data-close>Got it</button></div>`,
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
function renderBar(snap) {
  const pub = snap.pub, bar = $("#bar");
  const me = snap.mySeat;
  const ph = myTurnPhase(snap);
  const place = me >= 0 ? pub.pos[pub.chars[me]] : null;
  let msg = "", acts = "";
  const hand = me >= 0 && snap.mine ? `<div class="hand" id="hand">${snap.mine.hand.map((c) => `<div class="cardf" data-c="${c}">${cardSvg(settings.edition, c)}</div>`).join("")}</div>` : "";
  if (pub.over) {
    msg = pub.winner >= 0 ? `${esc(seatName(pub, pub.winner, snap))} solved it!` : "Nobody solved it.";
    acts = `<button class="btn primary" id="bNew">New game</button><button class="btn" id="bSum">Answer</button>`;
  } else if (ph === "disprove") {
    msg = `Show ${esc(seatName(pub, pub.sugg.by, snap))} one card`;
    acts = `<button class="btn warm" id="bShow">Choose card</button>`;
  } else if (ph === "start") {
    const where = place.room != null ? ` · in the ${esc(E().rooms[place.room])}` : "";
    msg = `Your turn${where}`;
    acts = `<button class="btn primary" id="bRoll">Roll</button>`;
    if (canPassage(pub)) acts += `<button class="btn" id="bPass">Passage → ${esc(E().rooms[PASSAGE[place.room]])}</button>`;
    if (canSuggestHere(pub)) acts += `<button class="btn warm" id="bSug">Suggest here</button>`;
    acts += `<button class="btn" id="bAcc">Accuse</button>`;
    if (settings.odds) msg += ` <span class="sub" id="reachOdds"></span>`;
  } else if (ph === "move") {
    msg = `${dice(pub.roll)} <span>Pick a lit square or room</span>`;
    acts = `<button class="btn" id="bAcc">Accuse</button>`;
  } else if (ph === "suggest") {
    msg = `In the ${esc(E().rooms[place.room])}`;
    acts = `<button class="btn warm" id="bSug">Suggest</button><button class="btn" id="bAcc">Accuse</button><button class="btn ghost" id="bEnd">End turn</button>`;
  } else if (ph === "post") {
    msg = pub.roll && !pub.suggested && !pub.entered ? `${dice(pub.roll)} <span class="sub">Moved</span>` : "Your move is done";
    acts = `<button class="btn" id="bAcc">Accuse</button><button class="btn primary" id="bEnd">End turn</button>`;
  } else {
    const t = pub.phase === "disprove" ? `${esc(seatName(pub, pub.sugg.asking, snap))} is choosing a card…` : `${esc(seatName(pub, pub.turn, snap))}'s turn`;
    msg = t + (pub.roll && pub.phase !== "disprove" ? " " + dice(pub.roll) : "");
    if (me >= 0 && pub.out[me]) msg += ` <span class="sub">(you're out — still showing cards)</span>`;
  }
  bar.classList.toggle("mine", !!ph && !pub.over);
  // the buttons row is always there (empty on others' turns) so the board never jumps between turns
  bar.innerHTML = `<div class="msg">${msg}</div><div class="acts">${acts}</div>${hand}`;
  const on = (id, f) => { const b = $("#" + id, bar); if (b) b.onclick = f; };
  on("bRoll", () => act({ type: "roll" }));
  on("bPass", () => act({ type: "passage" }));
  on("bSug", () => suggestSheet(snap));
  on("bAcc", () => accuseSheet(snap));
  on("bEnd", () => act({ type: "end" }));
  on("bShow", () => showSheet(snap));
  on("bNew", () => { store.del("local"); if (room && room.close) room.close(); if (online && snap.mode === "online") online.leave(); setupView(); });
  on("bSum", () => gameOver(snap));
  if (ph === "disprove" && !$("#overlay").classList.contains("on")) showSheet(snap);
  if (ph === "start" && settings.odds) reachOdds(pub, place);
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

let lastAct = { k: "", t: 0 };
async function act(a) {
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
  if (!snap || myTurnPhase(snap) !== "move") return;
  const t = e.target.closest("[data-sq],[data-room]");
  if (!t) { FX.play("error"); return; }   // a square you can't reach this turn
  if (t.dataset.sq != null) act({ type: "move", sq: +t.dataset.sq });
  else if (t.classList.contains("can")) act({ type: "move", room: +t.dataset.room });
  else FX.play("error");
}
function renderHighlights(snap) {
  const svg = $("svg.board", gameEl), pub = snap.pub;
  const L = $(".reachL", svg);
  $$(".room-hit", svg).forEach((h) => h.classList.remove("can"));
  if (myTurnPhase(snap) !== "move") { L.innerHTML = ""; }
  else {
    const m = movesFor(pub);
    L.innerHTML = m.squares.map((sq) => { const [r, c] = rc(sq); return `<rect class="reach" data-sq="${sq}" x="${c + .06}" y="${r + .06}" width=".88" height=".88" rx=".14"/>`; }).join("");
    for (const x of m.rooms) $(`.room-hit[data-room="${x.room}"]`, svg).classList.add("can");
  }
  // case-file odds for each room, written under the room name
  $$(".roomodds", svg).forEach((x) => x.remove());
  if (settings.odds && notes && notes.prob) {
    const n = pub.n;
    ROOMS.forEach((R, k) => {
      const p = notes.prob[12 + k][n];
      const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("class", "roomodds"); t.setAttribute("x", R.cx); t.setAttribute("y", R.r1 + 0.75);
      t.setAttribute("text-anchor", "middle"); t.setAttribute("font-size", ".62"); t.setAttribute("font-weight", "800");
      t.setAttribute("fill", p === 0 ? "#6b7287" : heat(p)); t.textContent = p === 0 ? "✗" : pct(p);
      svg.insertBefore(t, $(".hits", svg));
    });
  }
}

// ------------------------------------------------------------------ notes (your detective sheet)
function updateNotes(snap) {
  const pub = snap.pub, me = snap.mySeat;
  if (me < 0 || !snap.mine) return;
  const facts = factsFor(me, pub.n, snap.mine.hand, recordsFor(pub, snap.mine));
  const key = JSON.stringify(facts) + pub.n;
  const needRank = snap.myTurn && (pub.phase === "suggest" || (pub.phase === "start" && canSuggestHere(pub)));
  if (key === notesKey && (!needRank || rankKey === key + pub.pos[pub.chars[me]].room)) { drawNotes(snap); return; }
  notesKey = key;
  const roomNow = pub.pos[pub.chars[me]].room;
  askSolver({ n: pub.n, sizes: pub.sizes, facts, rank: needRank ? { me, room: roomNow, samples: 500, seed: pub.turnNo } : null }).then((r) => {
    if (notesKey !== key) return;
    if (!r.ok) return;
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
  const cols = pub.chars.map((c, i) => `<th style="color:${SUSPECT_COLORS[c]}">${i === me ? "You" : esc(E().short[c].slice(0, 3))}</th>`).join("");
  const cats = [["Suspects", 0, 6], ["Weapons", 6, 12], ["Rooms", 12, 21]];
  let rows = "";
  for (const [label, a, b] of cats) {
    rows += `<tr class="cat"><td colspan="${n + 2}">${label}</td></tr>`;
    for (let c = a; c < b; c++) {
      const pe = notes.prob[c][n];
      const mine = snap.mine.hand.includes(c);
      rows += `<tr class="${pe > 0.9995 ? "solved" : ""} ${mine ? "mine" : ""}"><td class="nm">${esc(cname(c))}</td>` +
        pub.chars.map((_, p) => cellMark(notes.prob[c][p])).join("") +
        `<td class="env" style="color:${pe === 0 ? "#5d6478" : heat(pe)}">${pe === 0 ? "✗" : pe > 0.9995 ? "✓" : settings.odds ? pct(pe) : ""}</td></tr>`;
    }
  }
  el.innerHTML = `<table><thead><tr><th style="text-align:left">Card</th>${cols}<th>File</th></tr></thead><tbody>${rows}</tbody></table>`;
  const top = notes.env[0];
  const envl = $("#envline");
  if (envl && top) envl.innerHTML = `<div class="row between" style="font-size:13px"><span>Best guess: <b>${top.cards.map(sname).join(" · ")}</b></span>${settings.odds ? `<b style="color:${heat(top.p)}">${pct(top.p)}</b>` : ""}</div><div class="muted" style="font-size:12px">${notes.envCount} answers still possible${notes.exact ? "" : " (estimated)"}</div>`;
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
  $("#sBest", el).onclick = () => { if (best) { pickS = best.cards[0]; pickW = best.cards[1]; draw(); } };
  let sent = false;
  $("#sGo", el).onclick = () => {
    if (sent) return; sent = true;
    const b = bitsOf(pickS, pickW);
    if (best && b != null) { myQuestions.push({ got: b, best: best.bits }); store.set("questions", myQuestions); }
    act({ type: "suggest", suspect: pickS, weapon: pickW });
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
  $("#aTop", el).onclick = () => { pick = top.cards.slice(); draw(); };
  $("#aNo", el).onclick = closeSheet;
  $("#aGo", el).onclick = () => act({ type: "accuse", suspect: pick[0], weapon: pick[1], room: pick[2] - 12 });
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
  if (snap.mode === "local" && !store.get("counted:" + pub.turnNo + ":" + pub.reveal.env.join(","), false)) {
    const rec = store.get("record", { w: 0, l: 0 });
    if (won) rec.w++; else rec.l++;
    store.set("record", rec);
    store.set("counted:" + pub.turnNo + ":" + pub.reveal.env.join(","), true);
    store.del("local");
  }
  const q = myQuestions.length ? myQuestions.reduce((a, x) => a + (x.best > 0 ? x.got / x.best : 1), 0) / myQuestions.length : null;
  const hands = pub.reveal.hands.map((h, i) => `<div class="row" style="font-size:13px;gap:6px"><i style="width:10px;height:10px;border-radius:50%;background:${SUSPECT_COLORS[pub.chars[i]]};display:inline-block"></i><b style="min-width:58px">${esc(seatName(pub, i, snap))}</b><span class="muted">${h.map(sname).join(", ")}</span></div>`).join("");
  sheet(`<h3>${pub.winner >= 0 ? (won ? "You solved it!" : esc(seatName(pub, pub.winner, snap)) + " solved it") : "Nobody solved it"}</h3>
    <div class="row" style="justify-content:center;gap:8px;margin:6px 0 10px">${pub.reveal.env.map((c) => `<div class="cardf lg deal-in">${cardSvg(settings.edition, c)}</div>`).join("")}</div>
    ${q != null ? `<p>Your questions found <b style="color:${heat(q)}">${Math.round(q * 100)}%</b> of the best possible information ${help("Question quality", "Each time you suggested, the notes compared what your question could teach you (in bits) with the best question available in that room. 100% means you always asked the best one.")}</p>` : ""}
    <div class="stack" style="gap:3px">${hands}</div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn" data-close>Look at board</button><button class="btn primary" id="again">New game</button></div>`,
    (el) => { $("[data-close]", el).onclick = closeSheet; $("#again", el).onclick = () => { closeSheet(); store.del("local"); if (snap.mode === "online" && online) online.leave(); setupView(); }; });
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
  const name = store.get("name", "");
  play.innerHTML = `<div class="setup-wrap"><div class="hero">${logoSvg()}<p>Play with friends on their own phones.</p></div>
    <div class="panel stack">
      <div><div class="label">Your name</div><input type="text" id="oName" maxlength="20" value="${esc(name)}" placeholder="Name"></div>
      <button class="btn primary" id="oCreate">Create a room</button>
      <div class="row"><input type="text" id="oCode" maxlength="5" placeholder="Code" style="text-transform:uppercase;letter-spacing:.2em"><button class="btn" id="oJoin">Join</button></div>
      <p class="muted" style="margin:0;font-size:13px">Room size and your suspect come from the Play screen. Empty seats become computers.</p>
      <button class="btn ghost" id="oBack">Back</button>
    </div></div>`;
  $("#oBack").onclick = setupView;
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
    if (!r.ok) { toast(r.message || "Couldn't join that room"); const b = $("#oJoin"); if (b) b.disabled = false; }
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
  <div class="panel"><div class="label">Sound &amp; effects</div><div id="fxSet"></div></div>
  ${snapNow && snapNow.pub && !snapNow.pub.over ? `<div class="panel"><div class="setrow"><div class="lbl">${snapNow.mode === "online" ? "Leave room" : "Quit game"}<small>${snapNow.mode === "online" ? "A computer takes your seat" : "Ends the game you're playing"}</small></div><button class="btn small danger" id="sQuit">${snapNow.mode === "online" ? "Leave" : "Quit"}</button></div></div>` : ""}
  <div class="panel"><div class="setrow"><div class="lbl">Reset record<small>Your win/loss count</small></div><button class="btn small" id="sReset">Reset</button></div></div></div>`;
  $$("[data-key]", el).forEach((g) => $$("button", g).forEach((b) => (b.onclick = () => {
    const k = g.dataset.key; const v = b.dataset.v;
    settings[k] = k === "edition" || k === "rules" ? v : +v; saveSettings(); settingsView();
    if (k === "edition" && snapNow && snapNow.pub && gameEl) { buildGame(snapNow); renderGame(snapNow, null); }
  })));
  FX.renderSettings($("#fxSet", el));
  $("#sOdds", el).onchange = (e) => { settings.odds = e.target.checked; saveSettings(); if (snapNow) { if (snapNow.pub && gameEl) renderGame(snapNow, null); renderHighlights(snapNow); drawNotes(snapNow); } };
  const q = $("#sQuit", el);
  if (q) q.onclick = () => sheet(`<h3>${snapNow.mode === "online" ? "Leave this room?" : "Quit this game?"}</h3><div class="row" style="justify-content:flex-end"><button class="btn ghost" data-close>Cancel</button><button class="btn danger" id="qYes">${snapNow.mode === "online" ? "Leave" : "Quit"}</button></div>`,
    (s) => { $("[data-close]", s).onclick = closeSheet; $("#qYes", s).onclick = quitGame; });
  $("#sReset", el).onclick = () => { store.set("record", { w: 0, l: 0 }); toast("Record reset"); };
}

// ------------------------------------------------------------------ boot
settingsView();
initNotepad($("#tab-table"));
showTab(location.hash.slice(1) || "play", false);
(async () => {
  const saved = store.get("local", null);
  const resumeOnline = store.get("online.clue.hint", false);
  if (saved && saved.state && !saved.state.over) {
    myQuestions = store.get("questions", []);
    startLocal(saved);
    return;
  }
  setupView();
  try { if (localStorage.getItem("online.clue")) { const ok = await getOnline().resume(); if (!ok) setupView(); } } catch (e) {}
  void resumeOnline;
})();

// test hook (headless checks)
window.__clue = { get snap() { return snapNow; }, act, settings };
