// Improve pass checks (2026-10-27), headless WebKit at iPhone size: guided game, Daily, Undo, quit = loss,
// case-file reveal + replay + My stats, rules sheet + Back.   node tools/improve.mjs <base-url> [--shots dir] [--only a,b]
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
const require = createRequire(join(homedir(), ".claude/tools/") + "x.js");
const pw = require("playwright");

const args = process.argv.slice(2);
const base = (args.find((a) => a.startsWith("http")) || "http://127.0.0.1:47917/").replace(/\/?$/, "/");
const shots = args.includes("--shots") ? args[args.indexOf("--shots") + 1] : null;
const only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : null;
const wide = args.includes("--desktop");
if (shots) mkdirSync(shots, { recursive: true });
const browser = args.includes("--chrome") ? await pw.chromium.launch() : await pw.webkit.launch();
const iphone = pw.devices["iPhone 15"];
const results = [];
let cur = null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open({ settings = null } = {}) {
  const ctx = await browser.newContext(wide ? { viewport: { width: 1280, height: 800 } } : (args.includes("--chrome") ? { viewport: { width: 393, height: 659 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 } : { ...iphone, viewport: { width: 393, height: 659 } }));
  await ctx.addInitScript((s) => { try { if (s && !localStorage.getItem("clue.settings")) localStorage.setItem("clue.settings", s); } catch (e) {} }, settings ? JSON.stringify(settings) : null);
  const page = await ctx.newPage();
  cur = page;
  page.errs = [];
  page.on("console", (m) => { if (m.type() === "error") page.errs.push(m.text()); });
  page.on("pageerror", (e) => { if (!/ResizeObserver loop/.test(e.message)) page.errs.push("pageerror: " + e.message); });
  await page.goto(base);
  await page.waitForFunction(() => window.__clue && document.querySelector("#go"));
  return page;
}
const shot = async (p, name) => { if (shots) await p.screenshot({ path: join(shots, name + ".png") }); };
const S = (p) => p.evaluate(() => { const s = window.__clue.snap; return s && s.pub ? { phase: s.pub.phase, myTurn: s.myTurn, turnNo: s.pub.turnNo, n: s.pub.n, over: s.pub.over, roll: s.pub.roll, levels: s.pub.opts.levels, me: s.mySeat, chars: s.pub.chars, hand: s.mine && s.mine.hand } : null; });
const myTurn = (p, phase) => p.waitForFunction((ph) => { const s = window.__clue.snap; return s && s.pub && s.myTurn && (!ph || s.pub.phase === ph); }, phase, { timeout: 60000 });
const stats = (p) => p.evaluate(() => { const s = Profile.stats(); return { games: s.games, wins: s.wins, losses: s.losses, byMode: s.byMode, byLevel: s.byLevel, ach: Object.keys(s.ach || {}) }; });
const bubble = (p) => p.evaluate(() => { const b = document.querySelector(".coach-bubble"); return b && b.offsetParent !== null && getComputedStyle(b).visibility !== "hidden" ? (b.querySelector(".coach-title") || b).textContent : null; });
async function check(name, fn) {
  if (only && !only.includes(name)) return;
  let page = null; cur = null;
  try { page = await fn(); const errs = page && page.errs.length ? page.errs : []; results.push([name, errs.length ? "FAIL" : "PASS", errs.length ? "errors: " + errs.join(" | ") : page.note || ""]); }
  catch (e) { results.push([name, "FAIL", e.message.split("\n")[0]]); page = page || cur; if (page) { await shot(page, "fail-" + name); results[results.length - 1][2] += " | " + JSON.stringify(await S(page).catch(() => null)) + " | " + (await bubble(page).catch(() => "")); } }
  finally { page = page || cur; if (page) await page.context().close(); }
}

// 1) First visit: the offer, then the guided game walks through cards, notes, roll, move, room, question
await check("tutorial", async () => {
  const p = await open();
  await p.waitForSelector(".coach-offer", { timeout: 8000 });
  await shot(p, "tutorial-offer");
  await p.click(".coach-offer .coach-btn:last-child");
  await p.waitForFunction(() => window.__clue.snap && window.__clue.snap.pub);
  const s0 = await S(p);
  if (s0.n !== 3 || s0.levels.some((l) => l !== 0) || s0.chars[s0.me] !== 0) throw new Error("tutorial table " + JSON.stringify(s0));
  await p.waitForFunction(() => /Your cards/.test(document.querySelector(".coach-bubble")?.textContent || ""), null, { timeout: 8000 });
  await shot(p, "tutorial-1-cards");
  const seen = [];
  const next = async () => { await p.click(".coach-bubble .coach-btn:last-child"); await sleep(300); };
  await next(); seen.push(await bubble(p)); await shot(p, "tutorial-2-notes");
  await next(); seen.push(await bubble(p));
  await myTurn(p, "start");
  await p.waitForFunction(() => /Roll/.test(document.querySelector(".coach-bubble")?.textContent || ""), null, { timeout: 8000 });
  await shot(p, "tutorial-3-roll");
  // two turns: each roll is rigged to reach the nearest room when it can
  let rolls = [];
  for (let k = 0; k < 4; k++) {
    await myTurn(p, "start");
    await p.click("#bRoll");
    await p.waitForFunction(() => window.__clue.snap.pub.phase !== "start");
    const s = await S(p); rolls.push(s.roll && s.roll.total);
    if (s.phase === "move") {
      if (k === 0) { await p.waitForFunction(() => /Move/.test(document.querySelector(".coach-bubble")?.textContent || ""), null, { timeout: 8000 }); await shot(p, "tutorial-4-move"); }
      // a lit room if there is one, else the lit square closest to a room
      await p.evaluate(async () => {
        const { movesFor } = await import("./js/game.js"); const { STEPS_TO_ROOM } = await import("./js/board.js");
        const pub = window.__clue.snap.pub, m = movesFor(pub);
        if (m.rooms.length) return window.__clue.act({ type: "move", room: m.rooms[0].room });
        let best = m.squares[0], bd = 99;
        for (const sq of m.squares) { const d = Math.min(...STEPS_TO_ROOM.map((a) => a[sq])); if (d < bd) { bd = d; best = sq; } }
        return window.__clue.act({ type: "move", sq: best });
      });
      await p.waitForFunction(() => window.__clue.snap.pub.phase !== "move");
    }
    const s2 = await S(p);
    if (s2.phase === "suggest") break;
    await p.waitForFunction(() => document.querySelector("#bEnd"));
    await p.click("#bEnd");
  }
  await p.waitForFunction(() => /Ask a question/.test(document.querySelector(".coach-bubble")?.textContent || ""), null, { timeout: 10000 });
  await shot(p, "tutorial-5-ask");
  p.note = `steps ${seen.join(" → ")} → Roll → Move → Ask; rolls ${rolls.join(",")}`;
  return p;
});

// 2) The Daily: same deal for two different players today, 3 Hard computers, no Undo
await check("daily", async () => {
  const hands = [];
  let p;
  for (let k = 0; k < 2; k++) {
    if (p) await p.context().close();
    p = await open();
    await p.evaluate(() => { try { COACH.closeOffer(); } catch (e) {} });
    await p.click("#goDaily");
    await p.waitForFunction(() => window.__clue.snap && window.__clue.snap.pub);
    const s = await S(p);
    if (s.n !== 4 || s.levels.some((l) => l !== 2) || s.chars[s.me] !== 0) throw new Error("daily table " + JSON.stringify(s));
    hands.push(JSON.stringify(s.hand) + "|" + (await p.evaluate(() => window.__clue.room.state.env.join(","))));
  }
  if (hands[0] !== hands[1]) throw new Error("deals differ " + hands.join(" vs "));
  await myTurn(p, "start");
  await p.click("#bRoll");
  await sleep(400);
  if (await p.$("#bUndo")) throw new Error("Undo shown in the Daily");
  await shot(p, "daily");
  // quitting the Daily counts as a loss
  await p.click('nav.tabs [data-tab="settings"]');
  await p.click("#sQuit"); await p.click("#qYes");
  const st = await stats(p);
  if (st.losses !== 1) throw new Error("quit Daily not a loss " + JSON.stringify(st));
  p.note = "same deal in 2 fresh browsers; no Undo; quit = loss";
  return p;
});

// 3) Undo vs computers: takes back your last move and makes the game unrated
await check("undo", async () => {
  const p = await open({ settings: { level: 1, players: 3, speed: 2 } });
  await p.evaluate(() => { try { COACH.closeOffer(); } catch (e) {} });
  await p.click("#go");
  await myTurn(p, "start");
  const before = await S(p);
  await p.click("#bRoll");
  await p.waitForSelector("#bUndo", { timeout: 5000 });
  await shot(p, "undo-button");
  await p.click("#bUndo");
  await p.waitForFunction(() => window.__clue.snap.pub.phase === "start" && !window.__clue.snap.pub.roll);
  const after = await S(p);
  const helped = await p.evaluate(() => window.__clue.room.meta.helped);
  if (after.turnNo !== before.turnNo || !helped) throw new Error("undo state " + JSON.stringify({ before, after, helped }));
  // finish it right: counted "with help", not rated
  await p.evaluate(() => { const e = window.__clue.room.state.env; window.__clue.act({ type: "accuse", suspect: e[0], weapon: e[1], room: e[2] - 12 }); });
  await p.waitForFunction(() => Profile.stats().games >= 1, null, { timeout: 15000 });
  const st = await stats(p);
  if (!st.byMode.help || st.byMode.help.w !== 1 || (st.byMode.computer && st.byMode.computer.g)) throw new Error("not counted as help " + JSON.stringify(st.byMode));
  p.note = "roll → Undo → back to Roll; win counted with help, unrated";
  return p;
});

// 4) A win vs Hard: case file opens, result sheet, Replay steps through the game, My stats counts it rated
await check("reveal-replay", async () => {
  const p = await open({ settings: { level: 2, players: 4, speed: 2 } });
  await p.evaluate(() => { try { COACH.closeOffer(); } catch (e) {} });
  await p.click("#go");
  // a few real turns so the replay has frames
  for (let k = 0; k < 2; k++) {
    await myTurn(p, "start");
    await p.click("#bRoll");
    await p.waitForFunction(() => window.__clue.snap.pub.phase !== "start");
    if ((await S(p)).phase === "move") {
      await p.evaluate(async () => { const { movesFor } = await import("./js/game.js"); const m = movesFor(window.__clue.snap.pub); window.__clue.act(m.rooms.length ? { type: "move", room: m.rooms[0].room } : { type: "move", sq: m.squares[0] }); });
      await p.waitForFunction(() => window.__clue.snap.pub.phase !== "move");
    }
    if ((await S(p)).phase === "suggest") { await p.evaluate(() => window.__clue.act({ type: "suggest", suspect: 1, weapon: 7 })); await p.waitForFunction(() => window.__clue.snap.pub.phase !== "suggest" && window.__clue.snap.pub.phase !== "disprove" || window.__clue.snap.myTurn === false, null, { timeout: 20000 }); }
    await p.waitForFunction(() => document.querySelector("#bEnd") || !window.__clue.snap.myTurn);
    await p.evaluate(() => { if (document.querySelector("#bEnd")) window.__clue.act({ type: "end" }); });
  }
  await myTurn(p, "start");
  await p.evaluate(() => { const e = window.__clue.room.state.env; window.__clue.act({ type: "accuse", suspect: e[0], weapon: e[1], room: e[2] - 12 }); });
  await p.waitForSelector(".reveal", { timeout: 8000 });
  await sleep(2600); await shot(p, "reveal");
  await p.evaluate(() => { const r = document.querySelector(".reveal"); if (r) r.click(); });
  await p.waitForSelector("#replay", { timeout: 8000 });
  await shot(p, "result-sheet");
  await p.click("#replay");
  await p.waitForSelector("#rpNext");
  const n0 = await p.textContent(".rp-n");
  await p.click("#rpNext"); await p.click("#rpNext");
  const cap = await p.textContent("#bar .msg");
  await shot(p, "replay");
  await p.click("#rpDone");
  const st = await stats(p);
  if (!st.byLevel.hard || st.byLevel.hard.w !== 1 || !st.ach.includes("first") || !st.ach.includes("hard")) throw new Error("stats " + JSON.stringify(st));
  // My stats panel from the setup screen
  await p.click("#again").catch(() => {});
  await p.evaluate(() => { const b = document.querySelector("#bNew"); if (b) b.click(); });
  await p.waitForSelector("#meBtn");
  await p.click("#meBtn");
  await p.waitForSelector(".pf-panel");
  await sleep(300); await shot(p, "my-stats");
  p.note = `replay ${n0.trim()} → "${cap.trim().slice(0, 60)}"; rated Hard win; achievements ${st.ach.join(",")}`;
  return p;
});

// 5) Rules sheet from Settings; Back closes it and stays on Settings
await check("rules-back", async () => {
  const p = await open();
  await p.evaluate(() => { try { COACH.closeOffer(); } catch (e) {} });
  await p.click('nav.tabs [data-tab="settings"]');
  await p.click("#sRules");
  await p.waitForSelector(".coach-rules");
  await sleep(300); await shot(p, "rules");
  await p.goBack();
  await sleep(500);
  const r = await p.evaluate(() => ({ open: COACH.rulesOpen(), tab: document.querySelector("main .tab.active").id, url: location.href }));
  if (r.open || r.tab !== "tab-settings") throw new Error("after Back " + JSON.stringify(r));
  p.note = "Back closed the rules, still on Settings";
  return p;
});

await browser.close();
for (const [n, r, m] of results) console.log(`${r} ${n}: ${m}`);
const fails = results.filter((r) => r[1] !== "PASS").length;
console.log(`${results.length - fails}/${results.length} passed`);
process.exit(fails ? 1 : 0);
