/* Notepad: detective notes for a REAL Clue game at the table.
 * You type in what happens; it does every deduction and shows the odds. */
import { EDITIONS, SUSPECT_COLORS, cardName, shortName } from "./cards.js";
import { weaponSvg, roomSvg } from "./art.js";
import { factsFor, handSizes } from "./knowledge.js";
import { store, settings, sheet, closeSheet, toast, askSolver, pct, heat, help } from "./ui.js";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

let root = null;
let T = null;           // table state
let result = null, resultKey = "", ranked = null, rankRoom = -1;
const blank = () => ({ started: false, names: ["You", "", "", ""], me: 0, first: 0, hand: [], records: [] });

export function initNotepad(el) {
  root = el;
  T = Object.assign(blank(), store.get("table", {}));
  render();
}
export function refreshNotepad() { if (root && T) render(); }
const save = () => store.set("table", T);
/** First few letters of a name, counting emoji as one letter, with "…" when cut. */
function clip(str, k) {
  let g;
  try { g = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(str)].map((x) => x.segment); } catch (e) { g = Array.from(str); }
  return g.length > k ? g.slice(0, k - 1).join("") + "…" : str;
}
const ed = () => settings.edition;
const sname = (c) => shortName(ed(), c);
const n = () => T.names.length;
const nm = (i) => (T.names[i] || "").trim() || (i === T.me ? "You" : "Player " + (i + 1));
const sizes = () => handSizes(n(), T.first);

function render() { if (!T.started) setupView(); else mainView(); }

function setupView() {
  const N = n();
  root.innerHTML = `<div class="page" style="max-width:620px">
    <h2>Real-table notepad ${help("What is this?", "Use it while playing the real board game. Enter who asked what and who showed a card. It crosses off everything that can be worked out, and shows how likely each card is to be in the case file.")}</h2>
    <div class="panel stack">
      <div><div class="label">Players</div><div class="seg" id="tn">${[3, 4, 5, 6].map((k) => `<button data-n="${k}" class="${k === N ? "on" : ""}">${k}</button>`).join("")}</div></div>
      <div><div class="label">Names, in turn order ${help("Why order matters", "Players are asked to show a card going clockwise from the one who asked. The order lets the notepad know who passed without you typing it.")}</div>
        <div class="stack" style="gap:6px" id="tnames">${T.names.map((x, i) => `<div class="row"><input type="text" data-i="${i}" value="${esc(x)}" placeholder="Player ${i + 1}" maxlength="16"><button class="btn small ${i === T.me ? "primary" : ""}" data-me="${i}">${i === T.me ? "Me" : "Me?"}</button></div>`).join("")}</div></div>
      <div class="row between"><div class="label">First card dealt to ${help("Hand sizes", "18 cards are dealt one at a time, so with 4 or 5 players some hands get one more card. Pick who got the first card.")}</div>
        <select id="tfirst" style="width:auto">${T.names.map((_, i) => `<option value="${i}" ${i === T.first ? "selected" : ""}>${esc(nm(i))}</option>`).join("")}</select></div>
      <div><div class="label">Your cards (<span id="hc">${T.hand.length}</span> of ${sizes()[T.me]})</div><div class="chips" id="thand" style="grid-template-columns:repeat(3,1fr)"></div></div>
      <button class="btn primary" id="tgo" style="min-height:48px">Start notes</button>
    </div></div>`;
  const drawHand = () => {
    $("#thand", root).innerHTML = [...Array(21).keys()].map((c) => chipHtml(c, T.hand.includes(c))).join("");
    $("#hc", root).textContent = T.hand.length;
    $$("#thand .chip", root).forEach((b) => (b.onclick = () => { const c = +b.dataset.c; T.hand = T.hand.includes(c) ? T.hand.filter((x) => x !== c) : T.hand.concat([c]); save(); drawHand(); }));
  };
  drawHand();
  $$("#tn button", root).forEach((b) => (b.onclick = () => { const k = +b.dataset.n; T.names = Array.from({ length: k }, (_, i) => T.names[i] || ""); if (T.me >= k) T.me = 0; if (T.first >= k) T.first = 0; save(); setupView(); }));
  $$("#tnames input", root).forEach((x) => (x.oninput = () => { T.names[+x.dataset.i] = x.value; save(); }));
  $$("#tnames [data-me]", root).forEach((b) => (b.onclick = () => { T.me = +b.dataset.me; save(); setupView(); }));
  $("#tfirst", root).onchange = (e) => { T.first = +e.target.value; save(); setupView(); };
  $("#tgo", root).onclick = () => {
    if (T.hand.length !== sizes()[T.me]) { toast(`Pick your ${sizes()[T.me]} cards`); return; }
    T.started = true; save(); render();
  };
}

function chipHtml(c, on, extra = "", p = null) {
  const icon = c < 6 ? `<i class="dot" style="background:${SUSPECT_COLORS[c]}"></i>` : c < 12 ? weaponSvg(c - 6, 15) : roomSvg(c - 12, 15);
  const odds = p != null && settings.odds ? `<span class="pc" style="color:${p === 0 ? "#6b7287" : heat(p)}">${p === 0 ? "✗" : pct(p)}</span>` : "";
  return `<button class="chip ${on ? "on" : ""} ${extra}" data-c="${c}">${icon}<span>${esc(sname(c))}</span>${odds}</button>`;
}

function mainView() {
  root.innerHTML = `<div class="np">
    <div class="top"><button class="btn primary grow" id="tSug">+ Suggestion</button><button class="btn" id="tAcc">+ Wrong guess</button><button class="btn" id="tUndo" ${T.records.length ? "" : "disabled"}>Undo</button><button class="btn ghost" id="tNew">New</button></div>
    <div class="notes" id="tnotes"></div>
    <div class="npside">
      <div class="panel" id="tenv" style="padding:9px 11px"></div>
      <div class="panel" style="padding:9px 11px"><div class="row between"><div class="label">Best question in ${help("Best question", "Pick the room you can reach. The notepad tries every suspect and weapon you could name there and ranks them by how much the answer would narrow down the case file (bits). One bit halves the possibilities.")}</div></div>
        <div class="chips rooms" id="troom" style="margin:5px 0"></div><div id="trank" class="muted" style="font-size:13px;min-height:18px"></div></div>
      <div class="log panel" id="tlog" style="padding:8px 10px;max-height:160px"></div>
    </div></div>`;
  $("#tSug", root).onclick = suggestionSheet;
  $("#tAcc", root).onclick = accusationSheet;
  $("#tUndo", root).onclick = () => { T.records.pop(); save(); mainView(); };
  $("#tNew", root).onclick = () => {
    sheet(`<h3>Start a new game?</h3><p>Your notes for this game will be cleared.</p><div class="row" style="justify-content:flex-end"><button class="btn ghost" data-close>Cancel</button><button class="btn danger" id="yes">New game</button></div>`,
      (el) => { $("[data-close]", el).onclick = closeSheet; $("#yes", el).onclick = () => { T.started = false; T.hand = []; T.records = []; save(); closeSheet(); render(); }; });
  };
  drawRooms();
  drawLog();
  solveNow();
}

function drawRooms() {
  $("#troom", root).innerHTML = [...Array(9).keys()].map((r) => chipHtml(12 + r, r === rankRoom, "", result ? result.prob[12 + r][n()] : null)).join("");
  $$("#troom .chip", root).forEach((b) => (b.onclick = () => { rankRoom = +b.dataset.c - 12; ranked = null; drawRooms(); solveNow(); }));
}
function drawLog() {
  $("#tlog", root).innerHTML = T.records.slice().reverse().map((r) => {
    if (r.t === "accuse") return `<div><b>${esc(nm(r.by))}</b> guessed wrong: ${r.cards.map(sname).join(", ")}</div>`;
    const sh = r.shower == null ? "nobody showed" : `${esc(nm(r.shower))} showed${r.shown != null ? " " + sname(r.shown) : ""}`;
    return `<div><b>${esc(nm(r.by))}</b>: ${r.cards.map(sname).join(", ")} — ${sh}</div>`;
  }).join("") || `<div>Add each suggestion as it happens.</div>`;
}

function solveNow() {
  const facts = factsFor(T.me, n(), T.hand, T.records);
  const key = JSON.stringify(facts) + "|" + rankRoom;
  resultKey = key;
  $("#tnotes", root).innerHTML = result ? $("#tnotes", root).innerHTML : `<div class="muted" style="padding:10px">Thinking…</div>`;
  askSolver({ n: n(), sizes: sizes(), facts, rank: rankRoom >= 0 ? { me: T.me, room: rankRoom, samples: 600, seed: T.records.length + 1 } : null }).then((r) => {
    if (resultKey !== key || !root.isConnected) return;
    if (!r.ok) {
      result = null; ranked = null; drawRooms(); drawRank();
      $("#tnotes", root).innerHTML = `<div style="padding:12px">These notes contradict each other — something was entered wrong. Tap <b>Undo</b> to remove the last entry.</div>`;
      $("#tenv", root).innerHTML = "";
      return;
    }
    result = r; ranked = r.ranked || null;
    drawGrid(); drawRooms(); drawRank();
  });
}
function drawGrid() {
  const N = n();
  const head = (i) => ((T.names[i] || "").trim() ? clip(nm(i).trim(), 5) : i === T.me ? "You" : "P" + (i + 1));
  const cols = T.names.map((_, i) => `<th>${esc(head(i))}</th>`).join("");
  let rows = "";
  for (const [label, a, b] of [["Suspects", 0, 6], ["Weapons", 6, 12], ["Rooms", 12, 21]]) {
    rows += `<tr class="cat"><td colspan="${N + 2}">${label}</td></tr>`;
    for (let c = a; c < b; c++) {
      const pe = result.prob[c][N];
      rows += `<tr class="${pe > 0.9995 ? "solved" : ""} ${T.hand.includes(c) ? "mine" : ""}"><td class="nm">${esc(cardName(ed(), c))}</td>` +
        T.names.map((_, p) => { const x = result.prob[c][p]; return x > 0.9995 ? `<td><span class="y">✓</span></td>` : x < 0.0005 ? `<td><span class="x">✗</span></td>` : `<td style="color:#c9cede">${settings.odds ? pct(x) : ""}</td>`; }).join("") +
        `<td class="env" style="color:${pe === 0 ? "#5d6478" : heat(pe)}">${pe === 0 ? "✗" : pe > 0.9995 ? "✓" : settings.odds ? pct(pe) : ""}</td></tr>`;
    }
  }
  $("#tnotes", root).innerHTML = `<table><thead><tr><th style="text-align:left">Card</th>${cols}<th>File</th></tr></thead><tbody>${rows}</tbody></table>`;
  const top = result.env[0];
  $("#tenv", root).innerHTML = `<div class="row between"><span class="label">Most likely answer</span>${settings.odds ? `<b style="color:${heat(top.p)}">${pct(top.p)}</b>` : ""}</div><div style="font-weight:700;font-size:15px">${top.cards.map((c) => esc(cardName(ed(), c))).join(" · ")}</div><div class="muted" style="font-size:12px">${result.envCount} possible answers · ${result.bits.toFixed(1)} bits left${result.exact ? "" : " (estimated)"}</div>`;
}
function drawRank() {
  const el = $("#trank", root);
  if (rankRoom < 0) { el.textContent = "Tap a room you can reach."; return; }
  if (!ranked) { el.textContent = "Working…"; return; }
  el.innerHTML = ranked.slice(0, 3).map((x, i) => `<div>${i + 1}. <b style="color:var(--text)">${sname(x.cards[0])} + ${sname(x.cards[1])}</b> — ${x.bits.toFixed(2)} bits</div>`).join("");
}

function seatChips(id, sel, extra = "") {
  return `<div class="chips" id="${id}" style="grid-template-columns:repeat(${Math.min(n() + (extra ? 1 : 0), 4)},1fr)">${T.names.map((_, i) => `<button class="chip ${sel === i ? "on" : ""}" data-p="${i}">${esc(nm(i))}</button>`).join("")}${extra}</div>`;
}
function suggestionSheet() {
  const f = { by: -1, cards: [-1, -1, -1], shower: undefined, shown: null };
  const el = sheet(`<h3>Suggestion</h3><div class="picker" id="sf"></div><div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn ghost" data-close>Cancel</button><button class="btn primary" id="sSave" disabled>Save</button></div>`);
  $("[data-close]", el).onclick = closeSheet;
  const draw = () => {
    let h = `<div class="label">Who asked</div>${seatChips("fby", f.by)}`;
    const g = (lab, a, b, k) => `<div class="label">${lab}</div><div class="chips ${k === 2 ? "rooms" : ""}" data-k="${k}">${Array.from({ length: b - a }, (_, i) => chipHtml(a + i, f.cards[k] === a + i)).join("")}</div>`;
    h += g("Who", 0, 6, 0) + g("With", 6, 12, 1) + g("Where", 12, 21, 2);
    h += `<div class="label">Who showed a card</div>${seatChips("fsh", f.shower, `<button class="chip ${f.shower === null ? "on" : ""}" data-p="none">Nobody</button>`)}`;
    if (f.by === T.me && f.shower != null && f.shower !== T.me && f.cards.every((c) => c >= 0)) {
      h += `<div class="label">Which card did you see?</div><div class="chips" id="fcard">${f.cards.map((c) => chipHtml(c, f.shown === c)).join("")}</div>`;
    }
    $("#sf", el).innerHTML = h;
    $$("#fby .chip", el).forEach((b) => (b.onclick = () => { f.by = +b.dataset.p; if (f.shower === f.by) f.shower = undefined; draw(); }));
    $$("[data-k] .chip", el).forEach((b) => (b.onclick = () => { f.cards[+b.parentElement.dataset.k] = +b.dataset.c; f.shown = null; draw(); }));
    $$("#fsh .chip", el).forEach((b) => (b.onclick = () => { const p = b.dataset.p === "none" ? null : +b.dataset.p; if (p === f.by) { toast("The asker can't show their own card"); return; } f.shower = p; f.shown = null; draw(); }));
    $$("#fcard .chip", el).forEach((b) => (b.onclick = () => { f.shown = +b.dataset.c; draw(); }));
    const needCard = f.by === T.me && f.shower != null && f.shower !== T.me;
    $("#sSave", el).disabled = !(f.by >= 0 && f.cards.every((c) => c >= 0) && f.shower !== undefined && (!needCard || f.shown != null));
  };
  draw();
  $("#sSave", el).onclick = () => {
    const passes = [];
    for (let k = 1; k < n(); k++) { const p = (f.by + k) % n(); if (p === f.shower) break; passes.push(p); }
    const held = f.cards.filter((c) => T.hand.includes(c));
    if (passes.includes(T.me) && held.length) { toast(`You hold ${sname(held[0])}, so you would have shown it`); return; }
    if (f.shower === T.me && !held.length) { toast("You hold none of those cards"); return; }
    const rec = { t: "suggest", by: f.by, cards: f.cards.slice(), passes, shower: f.shower };
    if (f.shown != null) rec.shown = f.shown;
    T.records.push(rec); save(); closeSheet(); mainView();
  };
}
function accusationSheet() {
  const f = { by: -1, cards: [-1, -1, -1] };
  const el = sheet(`<h3>Wrong accusation</h3><p class="muted" style="margin-top:0">That exact combination is not the answer.</p><div class="picker" id="af"></div><div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn ghost" data-close>Cancel</button><button class="btn primary" id="aSave" disabled>Save</button></div>`);
  $("[data-close]", el).onclick = closeSheet;
  const draw = () => {
    const g = (lab, a, b, k) => `<div class="label">${lab}</div><div class="chips ${k === 2 ? "rooms" : ""}" data-k="${k}">${Array.from({ length: b - a }, (_, i) => chipHtml(a + i, f.cards[k] === a + i)).join("")}</div>`;
    $("#af", el).innerHTML = `<div class="label">Who</div>${seatChips("aby", f.by)}` + g("Suspect", 0, 6, 0) + g("Weapon", 6, 12, 1) + g("Room", 12, 21, 2);
    $$("#aby .chip", el).forEach((b) => (b.onclick = () => { f.by = +b.dataset.p; draw(); }));
    $$("[data-k] .chip", el).forEach((b) => (b.onclick = () => { f.cards[+b.parentElement.dataset.k] = +b.dataset.c; draw(); }));
    $("#aSave", el).disabled = !(f.by >= 0 && f.cards.every((c) => c >= 0));
  };
  draw();
  $("#aSave", el).onclick = () => { T.records.push({ t: "accuse", by: f.by, cards: f.cards.slice(), correct: false }); save(); closeSheet(); mainView(); };
}
