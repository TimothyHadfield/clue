// How clearly the play screen shows the game, measured in headless WebKit (2026-10-21 visibility pass).
//   node tools/vis.mjs <base-url> [--shots dir] [--engine chrome] [--only state,state] [--sizes phone,se]
// For every size x game state it screenshots the Play screen and measures the board's share of the
// screen, square size, room-name / piece / card sizes and pieces overlapping inside a crowded room.
// It prints PASS/FAIL against the floors below; exit code 1 on any FAIL.
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { setup } from "../js/game.js";
import { idx } from "../js/board.js";
import { mulberry32 } from "../js/solver.js";
const require = createRequire(join(homedir(), ".claude/tools/") + "x.js");
const pw = require("playwright");

const args = process.argv.slice(2);
const base = (args.find((a) => a.startsWith("http")) || "http://127.0.0.1:52917/").replace(/\/?$/, "/");
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
const shots = opt("--shots");
const only = opt("--only") ? opt("--only").split(",") : null;
const sizesOnly = opt("--sizes") ? opt("--sizes").split(",") : null;
const engine = opt("--engine") === "chrome" ? pw.chromium : pw.webkit;
if (shots) mkdirSync(shots, { recursive: true });
const browser = await engine.launch();
const iphone = pw.devices["iPhone 15"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function saved(n, mod = () => {}, seed = 3) {
  const chars = [...Array(n).keys()];
  const seats = chars.map((c) => (c === 0 ? { kind: "human", name: "You" } : { kind: "computer", name: ["Scarlet", "Mustard", "White", "Green", "Peacock", "Plum"][c] }));
  const state = setup(n, { chars, levels: chars.map(() => 1) }, mulberry32(seed), seats);
  mod(state);
  return { seats, state };
}
const fakeLog = (s, k) => { for (let i = 0; i < k; i++) { const by = i % s.n; s.log.push({ t: "suggest", by, cards: [i % 6, 6 + (i % 6), 12 + (i % 9)], room: i % 9, passes: [], shower: (by + 1) % s.n }); } };
// game states: start (6 players), my move with lit squares, a crowded room late in the game, the end
const STATES = {
  start: () => saved(6),
  move: () => saved(6, (s) => { s.phase = "move"; s.roll = { dice: [6], total: 6 }; s.pos[0] = { sq: idx(7, 7) }; }),
  // late game: 5 pawns and 4 weapons in the Conservatory (small corner room), 4 pawns in the Study, my move next to them
  crowded: () => saved(6, (s) => {
    s.pos = [{ sq: idx(6, 17) }, { room: 2 }, { room: 2 }, { room: 2 }, { room: 2 }, { room: 2 }];
    s.weaponRoom = [2, 2, 2, 2, 8, 6];
    s.phase = "move"; s.roll = { dice: [4], total: 4 }; s.turnNo = 60; fakeLog(s, 24);
  }),
  // the end: you accuse correctly (a finished game is never resumed, so it is played into)
  end: () => saved(6, (s) => { s.turnNo = 80; s.pos[0] = { room: 7 }; fakeLog(s, 30); }),
  // not your turn: tap the crowded Conservatory to look closer
  look: () => saved(6, (s) => {
    s.pos = [{ sq: idx(6, 17) }, { room: 2 }, { room: 2 }, { room: 2 }, { room: 2 }, { room: 2 }];
    s.weaponRoom = [2, 2, 2, 2, 8, 6]; s.turnNo = 61;   // your turn, before rolling (computers wait)
  }),
};
const SIZES = { phone: [393, 659, true], se: [320, 568, true], land: [659, 393, true], laptop: [1280, 800, false], wide: [1440, 900, false] };

async function open(w, h, phone, local) {
  const context = await browser.newContext(phone ? { ...iphone, viewport: { width: w, height: h } } : { viewport: { width: w, height: h } });
  await context.addInitScript((o) => { try { if (!localStorage.getItem("__seeded")) { localStorage.setItem("clue.local", o); localStorage.setItem("__seeded", "1"); } } catch (e) {} }, JSON.stringify(local));
  const page = await context.newPage();
  page.errs = [];
  page.on("console", (m) => { if (m.type() === "error") page.errs.push(m.text()); });
  page.on("pageerror", (e) => { if (!/ResizeObserver loop/.test(e.message)) page.errs.push("pageerror: " + e.message); });
  return page;
}

const measure = (p) => p.evaluate(() => {
  const d = document.documentElement, vw = innerWidth, vh = innerHeight;
  const svg = document.querySelector("svg.board");
  const vb = svg.viewBox.baseVal, sr = svg.getBoundingClientRect();
  // the board as drawn (viewBox fitted inside the svg box)
  const ctm = svg.getScreenCTM(), unit = ctm.a;
  const bx = ctm.e + vb.x * unit, by = ctm.f + vb.y * unit, bw = vb.width * unit, bh = vb.height * unit;
  const vis = (r) => Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
  const boardShare = vis({ left: bx, top: by, right: bx + bw, bottom: by + bh }) / (vw * vh);
  const nav = document.querySelector("nav.tabs").getBoundingClientRect();
  const gameR = document.querySelector("#game").getBoundingClientRect();
  const playArea = gameR.width * gameR.height;
  // room-name plaques and pieces in screen px
  const texts = [...svg.querySelectorAll("text[font-family]")].filter((t) => !t.closest(".envelope"));
  const nameFont = Math.min(...texts.map((t) => +t.getAttribute("font-size") * unit));
  const odds = [...svg.querySelectorAll(".roomodds")].map((t) => +t.getAttribute("font-size") * unit);
  const box = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const toks = [...svg.querySelectorAll(".tok")].map(box), weps = [...svg.querySelectorAll(".wep")].map(box);
  const pawnPx = Math.min(...toks.map((b) => b.h));
  const wepPx = Math.min(...weps.map((b) => Math.max(b.w, b.h)));
  // overlap: share of a piece's box covered by another piece (worst pair), pieces only
  const pcs = [...toks, ...weps];
  let worst = 0;
  for (let i = 0; i < pcs.length; i++) for (let j = 0; j < pcs.length; j++) if (i !== j) {
    const a = pcs[i], b = pcs[j];
    const ox = Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)), oy = Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
    worst = Math.max(worst, (ox * oy) / (a.w * a.h));
  }
  const reach = [...svg.querySelectorAll(".reachL rect:not(.reach)")].map(box);
  // every room name stays on its plaque
  let nameOver = 0;
  for (const t of texts) { const pl = t.previousElementSibling; if (pl && pl.tagName === "rect") nameOver = Math.max(nameOver, t.getBBox().width - +pl.getAttribute("width")); }
  const zb = document.querySelector("#zoomOut"), zoomed = !!zb && !zb.hidden;
  const tapSq = reach.length ? Math.min(...reach.map((b) => b.w)) : null;
  const card = document.querySelector("#hand .cardf");
  const cardW = card ? card.getBoundingClientRect().width : null;
  const plate = document.querySelector("#players .pl .nm");
  const plateFont = plate ? parseFloat(getComputedStyle(plate).fontSize) : null;
  const notesBtn = document.querySelector("#notesBtn");
  const nb = notesBtn ? notesBtn.getBoundingClientRect() : null;
  const side = document.querySelector("#side");
  const sideVisible = side && getComputedStyle(side).display !== "none";
  const notesTd = document.querySelector("#notes td.nm");
  const notesFont = sideVisible && notesTd ? parseFloat(getComputedStyle(notesTd).fontSize) : null;
  const bar = document.querySelector("#bar").getBoundingClientRect();
  return {
    vw, vh, overflowX: d.scrollWidth > d.clientWidth + 1, pageScroll: d.scrollHeight - d.clientHeight,
    board: [Math.round(bw), Math.round(bh)], unit: +unit.toFixed(1), boardShare: +(boardShare).toFixed(3),
    boardOfPlay: +((bw * bh) / playArea).toFixed(3),
    emptyX: Math.round(sr.width - bw), emptyY: Math.round(sr.height - bh),
    nameFont: +nameFont.toFixed(1), oddsFont: odds.length ? +Math.min(...odds).toFixed(1) : null,
    pawnPx: +pawnPx.toFixed(1), wepPx: +wepPx.toFixed(1), overlap: +worst.toFixed(2), tapSq: tapSq && +tapSq.toFixed(1),
    cardW: cardW && Math.round(cardW), plateFont, notesBtn: nb && [Math.round(nb.width), Math.round(nb.height)], notesFont,
    barBottom: Math.round(bar.bottom), navTop: Math.round(nav.top), nameOver: +nameOver.toFixed(2), zoomed,
  };
});

const rows = [];
let fails = 0;
for (const [tag, [w, h, phone]] of Object.entries(SIZES)) {
  if (sizesOnly && !sizesOnly.includes(tag)) continue;
  for (const [st, make] of Object.entries(STATES)) {
    if (only && !only.includes(st)) continue;
    const S = make();
    const p = await open(w, h, phone, S);
    try {
      await p.goto(base + "#play");
      await p.waitForFunction(() => window.__clue && window.__clue.snap && window.__clue.snap.pub && document.querySelector("svg.board"), null, { timeout: 20000 });
      await sleep(1600);
      const why = [];
      if (st === "end") {
        const [su, we, ro] = S.state.env;
        await p.evaluate((a) => window.__clue.act(a), { type: "accuse", suspect: su, weapon: we, room: ro - 12 });
        await p.waitForFunction(() => window.__clue.snap.pub.over && document.querySelector("#overlay.on"), null, { timeout: 15000 });
        await sleep(1500);
        if (shots) await p.screenshot({ path: join(shots, `${tag}-end-sheet.png`) });
      }
      await p.evaluate(() => { const o = document.querySelector("#overlay"); if (o) { o.classList.remove("on"); o.innerHTML = ""; } });
      await sleep(200);
      const whole = await measure(p);
      if (st === "look") {
        // tap the crowded room (its top-left floor square, clear of the pieces)
        const at = await p.evaluate(() => { const r = document.querySelector('.room-hit[data-room="2"]').getBoundingClientRect(); return { x: r.right - 6, y: r.top + r.height * 0.55 }; });
        if (whole.unit < 22) {
          await p.mouse.click(at.x, at.y);
          await p.waitForFunction(() => !document.querySelector("#zoomOut").hidden, null, { timeout: 6000 }).catch(() => {});
          await sleep(300);
          const z = await measure(p);
          if (shots) await p.screenshot({ path: join(shots, `${tag}-look-zoomed.png`) });
          if (!z.zoomed) why.push("tap on a room did not zoom");
          if (z.pawnPx < 24 || z.wepPx < 20 || z.nameFont < 12) why.push(`zoomed room still small: pawns ${z.pawnPx} weapons ${z.wepPx} names ${z.nameFont}`);
          if (z.overlap > 0.35) why.push("pieces overlap " + Math.round(z.overlap * 100) + "%");
          await p.evaluate(() => document.querySelector("#zoomOut").click());
          await p.waitForFunction(() => document.querySelector("#zoomOut").hidden, null, { timeout: 6000 }).catch(() => {});   // headless WebKit animates at a few frames a second
          const back = await measure(p);
          if (back.zoomed || Math.abs(back.unit - whole.unit) > 0.2) why.push("whole-board button did not go back");
        }
      }
      if (st === "move" || st === "crowded") {
        if (whole.unit < 22 && !whole.zoomed) why.push("your move did not zoom in on a small screen");
        if (whole.tapSq < 16) why.push("lit squares " + whole.tapSq + "px < 16");
        // tap the lit square farthest from the middle of the view: the pawn must land there
        const tgt = await p.evaluate(() => {
          const rs = [...document.querySelectorAll(".reachL rect:not(.reach)")].map((r) => ({ sq: +r.dataset.sq, b: r.getBoundingClientRect() }))
            .filter((x) => x.b.top > 0 && x.b.left > 0 && x.b.right < innerWidth && x.b.bottom < innerHeight);
          const btn = (document.querySelector("#zoomOut") || document.body).getBoundingClientRect();
          const ok = rs.filter((x) => !(x.b.right > btn.left && x.b.left < btn.right && x.b.bottom > btn.top && x.b.top < btn.bottom));
          const t = ok[ok.length - 1]; return t && { sq: t.sq, x: t.b.left + t.b.width / 2, y: t.b.top + t.b.height / 2 };
        });
        if (shots) await p.screenshot({ path: join(shots, `${tag}-${st}-pick.png`) });
        if (!tgt) why.push("no lit square on screen");
        else {
          await p.mouse.click(tgt.x, tgt.y);
          await p.waitForFunction((sq) => window.__clue.snap.pub.pos[0].sq === sq, tgt.sq, { timeout: 8000 }).catch(() => why.push("tap on lit square " + tgt.sq + " did not move there"));
          await sleep(2200);   // the walk, then the zoom back out
          const after = await measure(p);
          if (after.zoomed) why.push("still zoomed after the move");
        }
      }
      const m = whole;
      if (shots) await p.screenshot({ path: join(shots, `${tag}-${st}.png`) }).catch(() => {});
      // phone: also the notes panel opened from the notepad on the table
      if (phone && st === "start" && w < 900) {
        const btn = await p.$("#notesBtn");
        if (btn && await btn.isVisible()) { await btn.click(); await sleep(500); if (shots) await p.screenshot({ path: join(shots, `${tag}-notes.png`) }); }
      }
      // floors: the whole board meets the brief's floors on a laptop; on a phone the zoom gets there (checked above)
      if (m.overflowX) why.push("overflowX");
      if (m.pageScroll > 1) why.push("pageScroll " + m.pageScroll);
      if (m.nameOver > 0.05) why.push("a room name runs off its plaque by " + m.nameOver);
      if (!m.zoomed) {
        const big = m.unit >= 22;
        if (m.nameFont < (big ? 10 : 5.5)) why.push("room names " + m.nameFont + "px");
        if (m.pawnPx < (big ? 16 : 9.4)) why.push("pawns " + m.pawnPx + "px");
        if (m.wepPx < (big ? 16 : 7)) why.push("weapons " + m.wepPx + "px");
        if (m.oddsFont != null && m.oddsFont < (big ? 10 : 7.5)) why.push("room odds " + m.oddsFont + "px");
        if (m.boardOfPlay < (w < 900 && h > w ? 0.5 : 0.48)) why.push("board only " + Math.round(m.boardOfPlay * 100) + "% of the play area");
      }
      if (m.overlap > 0.35) why.push("pieces overlap " + Math.round(m.overlap * 100) + "%");
      if (p.errs.length) why.push("console: " + p.errs.slice(0, 2).join(" / "));
      if (why.length) fails++;
      console.log(`${why.length ? "FAIL" : "PASS"} ${tag}-${st}: ${why.join("; ")}\n     ${JSON.stringify(m)}`);
      rows.push({ tag, st, ...m });
    } catch (e) { fails++; console.log(`FAIL ${tag}-${st}: threw ${e.message.split("\n")[0]}`); }
    await p.context().close().catch(() => {});
  }
}
await browser.close();
console.log(`${fails ? "FAILED " + fails : "ALL PASS"} (${rows.length} screens)`);
process.exit(fails ? 1 : 0);
