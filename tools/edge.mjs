// Odd situations, checked in headless WebKit (2026-10-20 edge pass).
//   node tools/edge.mjs <base-url> [--shots dir] [--only name,name]
// Each check prints PASS/FAIL with what it measured. Saved games are built with the real engine.
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
const base = (args.find((a) => a.startsWith("http")) || "http://127.0.0.1:47977/").replace(/\/?$/, "/");
const shots = args.includes("--shots") ? args[args.indexOf("--shots") + 1] : null;
const only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : null;
if (shots) mkdirSync(shots, { recursive: true });
const browser = await pw.webkit.launch();
const iphone = pw.devices["iPhone 15"];
const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A saved local game: you are seat 0 (Scarlet), the rest are Medium computers. */
function saved(n = 4, mod = () => {}, seed = 1) {
  const chars = [...Array(n).keys()];
  const seats = chars.map((c) => (c === 0 ? { kind: "human", name: "You" } : { kind: "computer", name: ["Scarlet", "Mustard", "White", "Green", "Peacock", "Plum"][c] }));
  const state = setup(n, { chars, levels: chars.map(() => 1) }, mulberry32(seed), seats);
  mod(state);
  return { seats, state };
}
async function open({ w = 393, h = 659, phone = true, local = null, settings = null, blockStorage = false, scheme = null, ctx = null } = {}) {
  const context = ctx || await browser.newContext(phone ? { ...iphone, viewport: { width: w, height: h } } : { viewport: { width: w, height: h } });
  if (scheme) await context.pages()[0]?.emulateMedia({ colorScheme: scheme });
  const init = { local: local ? JSON.stringify(local) : null, settings: settings ? JSON.stringify(settings) : null, blockStorage };
  await context.addInitScript((o) => {
    try {
      if (o.local && !localStorage.getItem("__seeded")) { localStorage.setItem("clue.local", o.local); localStorage.setItem("__seeded", "1"); }
      if (o.settings && !localStorage.getItem("clue.settings")) localStorage.setItem("clue.settings", o.settings);
    } catch (e) {}
    if (o.blockStorage) {
      const boom = () => { throw new DOMException("The operation is insecure.", "SecurityError"); };
      for (const k of ["localStorage", "sessionStorage"]) Object.defineProperty(window, k, { get: boom, configurable: true });
    }
  }, init);
  const page = await context.newPage();
  if (scheme) await page.emulateMedia({ colorScheme: scheme });
  page.errs = [];
  page.on("console", (m) => { if (m.type() === "error") page.errs.push(m.text()); });
  // known, harmless and inside the shared js/table.js (reported): WebKit's ResizeObserver loop notice
  page.on("pageerror", (e) => { if (!/ResizeObserver loop/.test(e.message)) page.errs.push("pageerror: " + e.message); });
  return page;
}
const snap = (p) => p.evaluate(() => JSON.parse(JSON.stringify(window.__clue && window.__clue.snap || null)));
const inGame = (p) => p.waitForFunction(() => window.__clue && window.__clue.snap && window.__clue.snap.pub && document.querySelector("svg.board"), null, { timeout: 20000 });
const layout = (p) => p.evaluate(() => {
  const d = document.documentElement, bar = document.querySelector("#bar"), pl = document.querySelector("#players"), hand = document.querySelector("#hand");
  const r = bar && bar.getBoundingClientRect();
  return { overflowX: d.scrollWidth > d.clientWidth + 1, pageScroll: d.scrollHeight - d.clientHeight, barBottom: r ? Math.round(r.bottom) : null, vh: innerHeight,
    playersOverflow: pl ? pl.scrollWidth - pl.clientWidth : null, handBottom: hand ? Math.round(hand.getBoundingClientRect().bottom) : null };
});
async function check(name, fn) {
  if (only && !only.includes(name)) return;
  let page = null;
  try {
    const r = await fn((p) => (page = p));
    const errs = page ? page.errs : [];
    const ok = r.ok && !errs.length;
    results.push([name, ok]);
    console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${r.detail || ""}${errs.length ? " | console: " + errs.slice(0, 3).join(" / ") : ""}`);
  } catch (e) {
    results.push([name, false]);
    console.log(`FAIL ${name}: threw ${e.message.split("\n")[0]} @${(String(e.stack).match(/edge\.mjs:(\d+)/) || [])[1]}${page && page.errs.length ? " | console: " + page.errs.slice(0, 3).join(" / ") : ""}`);
  }
  if (page) await page.context().close().catch(() => {});
}
const shot = (p, f) => (shots ? p.screenshot({ path: join(shots, f) }) : null);

// ---------------------------------------------------------------- devices: 6 players at every size
for (const [w, h, phone, tag] of [[320, 568, true, "se"], [393, 659, true, "phone"], [659, 393, true, "landscape"], [1280, 800, false, "laptop"], [1920, 1080, false, "huge"]]) {
  await check("size-" + tag, async (use) => {
    const p = use(await open({ w, h, phone, local: saved(6) }));
    await p.goto(base + "#play"); await inGame(p); await sleep(1500);
    const L = await layout(p); await shot(p, `size-${tag}.png`);
    const ok = !L.overflowX && L.pageScroll <= 1 && L.barBottom <= L.vh && L.playersOverflow <= 1;
    return { ok, detail: JSON.stringify(L) };
  });
}
await check("rotate", async (use) => {
  const p = use(await open({ w: 659, h: 393, local: saved(6) }));
  await p.goto(base + "#play"); await inGame(p); await sleep(800);
  await p.setViewportSize({ width: 393, height: 659 });
  await p.waitForFunction(() => [...document.querySelectorAll("#players .pl .nm")].every((x) => x.textContent.length <= 3), null, { timeout: 5000 }).catch(() => {});
  const L = await layout(p);
  const chips = await p.evaluate(() => [...document.querySelectorAll("#players .pl .nm")].map((x) => x.textContent));
  await shot(p, "rotate.png");
  return { ok: !L.overflowX && L.playersOverflow <= 1 && chips.every((c) => c.length <= 3), detail: JSON.stringify(L) + " " + chips.join(",") };
});

// ---------------------------------------------------------------- rules moments on screen
await check("boxed-in", async (use) => {
  const p = use(await open({ local: saved(3, (s) => { s.pos[0] = { room: 0 }; s.pos[1] = { sq: idx(7, 4) }; s.startRoom = 0; }) }));
  await p.goto(base + "#play"); await inGame(p);
  await p.click("#bRoll"); await sleep(500);
  const msg = await p.textContent("#bar .msg"); await shot(p, "boxed-in.png");
  return { ok: !/Moved/.test(msg) && /block/i.test(msg), detail: "bar says: " + msg.trim() };
});
await check("double-tap-end", async (use) => {
  const p = use(await open({ local: saved(4, (s) => { s.phase = "post"; s.roll = { dice: [3], total: 3 }; }) }));
  await p.goto(base + "#play"); await inGame(p);
  await p.evaluate(() => { const b = document.querySelector("#bEnd"); b.click(); b.click(); b.click(); });
  await sleep(100);
  const s = await snap(p); const toast = await p.evaluate(() => document.querySelector("#toast.on") ? document.querySelector("#toast").textContent : "");
  return { ok: s.pub.turn === 1 && s.pub.turnNo === 2 && !toast, detail: `turn ${s.pub.turn} turnNo ${s.pub.turnNo} toast "${toast}"` };
});
await check("double-tap-roll", async (use) => {
  const p = use(await open({ local: saved(4) }));
  await p.goto(base + "#play"); await inGame(p);
  await p.evaluate(() => { const b = document.querySelector("#bRoll"); b.click(); b.click(); });
  await sleep(700);
  await p.evaluate(() => { const b = document.querySelector("#bRoll"); if (b) b.click(); });
  const s = await snap(p); const toast = await p.evaluate(() => document.querySelector("#toast.on") ? document.querySelector("#toast").textContent : "");
  return { ok: s.pub.phase !== "start" && !toast, detail: `phase ${s.pub.phase} toast "${toast}"` };
});
await check("end-you-win", async (use) => {
  const p = use(await open({ local: saved(4) }));
  await p.goto(base + "#play"); await inGame(p);
  await p.evaluate(() => { const s = window.__clue.snap; });
  const st = (await p.evaluate(() => JSON.parse(localStorage.getItem("clue.local")).state.env));
  await p.evaluate((e) => window.__clue.act({ type: "accuse", suspect: e[0], weapon: e[1], room: e[2] - 12 }), st);
  await p.waitForSelector("#overlay.on #again", { timeout: 8000 }); await sleep(1500);
  const h = await p.textContent("#overlay h3"); await shot(p, "end-win.png");
  const rec = await p.evaluate(() => localStorage.getItem("clue.record"));
  return { ok: /You solved it/.test(h) && /"w":1/.test(rec), detail: h + " record " + rec };
});
await check("end-nobody", async (use) => {
  const p = use(await open({ local: saved(3, (s) => { s.out[1] = s.out[2] = true; }) }));
  await p.goto(base + "#play"); await inGame(p);
  await p.evaluate(() => window.__clue.act({ type: "accuse", suspect: 0, weapon: 6, room: 0 }).catch(() => {}));
  const s0 = await snap(p);
  await p.waitForSelector("#overlay.on #again", { timeout: 8000 }); await sleep(1200);
  const h = await p.textContent("#overlay h3"); await shot(p, "end-nobody.png");
  return { ok: /Nobody solved it/.test(h) || (s0.pub.winner === 0 && /You solved/.test(h)), detail: h };
});
await check("end-computer-wins-after-you-out", async (use) => {
  const p = use(await open({ local: saved(4, (s) => { s.out[0] = true; s.turn = 1; s.envSeen[2] = true; }) }));
  await p.goto(base + "#play"); await inGame(p);
  await p.waitForSelector("#overlay.on #again", { timeout: 20000 }); await sleep(1200);
  const h = await p.textContent("#overlay h3"); const bar = await p.textContent("#bar .msg"); await shot(p, "end-computer.png");
  return { ok: /solved it/.test(h) && !/You/.test(h), detail: h + " | bar: " + bar };
});
await check("settings-after-over", async (use) => {
  const p = use(await open({ local: saved(4) }));
  await p.goto(base + "#play"); await inGame(p);
  const e = await p.evaluate(() => JSON.parse(localStorage.getItem("clue.local")).state.env);
  await p.evaluate((e) => window.__clue.act({ type: "accuse", suspect: e[0], weapon: e[1], room: e[2] - 12 }), e);
  await p.waitForSelector("#overlay.on #again", { timeout: 8000 });
  await sleep(1500);
  await p.evaluate(() => document.querySelector("#overlay [data-close]").click()); await sleep(300);
  await p.evaluate(() => document.querySelector('nav.tabs button[data-tab="settings"]').click()); await sleep(300);
  await p.evaluate(() => { const i = document.querySelector("#sOdds"); i.checked = !i.checked; i.dispatchEvent(new Event("change")); }); await sleep(1500);
  const a = await p.evaluate(() => document.querySelector("#overlay").classList.contains("on"));
  await p.evaluate(() => document.querySelector('#tab-settings [data-key="edition"] button[data-v="uk"]').click()); await sleep(1500);
  const b = await p.evaluate(() => document.querySelector("#overlay").classList.contains("on"));
  await shot(p, "settings-after-over.png");
  return { ok: !a && !b, detail: `result sheet reopened: odds ${a}, names ${b}` };
});

await check("help-inside-suggest", async (use) => {
  const p = use(await open({ local: saved(4, (s) => { s.pos[0] = { room: 6 }; s.phase = "suggest"; s.entered = true; }) }));
  await p.goto(base + "#play"); await inGame(p); await sleep(500);
  await p.evaluate(() => document.querySelector("#bSug").click()); await p.waitForSelector("#overlay.on #cs .chip");
  await p.evaluate(() => document.querySelector("#cs .chip").click());
  await p.evaluate(() => document.querySelector("#overlay .q").click()); await sleep(300);
  const helpUp = await p.evaluate(() => !document.querySelector("#overlay #sGo"));
  await p.evaluate(() => document.querySelector("#overlay [data-close]").click()); await sleep(300);
  const back = await p.evaluate(() => ({ sheet: !!document.querySelector("#overlay.on #sGo"), picked: !!document.querySelector("#cs .chip.on") }));
  await shot(p, "help-inside-suggest.png");
  return { ok: helpUp && back.sheet && back.picked, detail: `help shown ${helpUp}; after OK: Suggest sheet ${back.sheet}, pick kept ${back.picked}` };
});

// ---------------------------------------------------------------- Back button
await check("back-online-form", async (use) => {
  const p = use(await open());
  await p.goto(base + "#play"); await p.waitForSelector("#goOnline");
  await p.click("#goOnline"); await p.waitForSelector("#oName");
  await p.goBack(); await sleep(500);
  const url = p.url(); const setup = await p.$("#pn");
  return { ok: url.startsWith(base) && !!setup, detail: "after Back: " + url + (setup ? " (setup)" : " (not setup)") };
});
await check("back-forced-show", async (use) => {
  const p = use(await open({ local: saved(3, (s) => {
    const card = s.hands[0][0], other = s.hands[0][1];
    s.turn = 1; s.phase = "disprove"; s.pos[1] = { room: 6 };
    const cards = [card < 6 ? card : 0, card >= 6 && card < 12 ? card : other >= 6 && other < 12 ? other : 6, 18];
    if (!cards.includes(card)) cards[2] = card >= 12 ? card : 18;
    s.sugg = { by: 1, cards, k: 2, passes: [2], shower: 0, shown: null, asking: 0 };
  }) }));
  await p.goto(base + "#play"); await inGame(p); await p.waitForSelector("#overlay.on .pick");
  await p.goBack(); await sleep(500);
  const still = await p.$("#overlay.on .pick");
  return { ok: !!still, detail: still ? "Show sheet stays after Back" : "Show sheet closed by Back" };
});

// ---------------------------------------------------------------- reloads, tabs, storage
await check("reload-after-roll", async (use) => {
  const p = use(await open({ local: saved(4) }));
  await p.goto(base + "#play"); await inGame(p);
  await p.click("#bRoll"); await sleep(400);
  const a = await snap(p);
  await p.reload(); await inGame(p); await sleep(400);
  const b = await snap(p);
  const same = a.pub.phase === b.pub.phase && JSON.stringify(a.pub.roll) === JSON.stringify(b.pub.roll) && a.mine.hand.join() === b.mine.hand.join();
  const lit = await p.evaluate(() => document.querySelectorAll(".reach").length + document.querySelectorAll(".room-hit.can").length);
  return { ok: same && lit > 0, detail: `phase ${a.pub.phase}->${b.pub.phase} roll ${JSON.stringify(b.pub.roll)} lit ${lit}` };
});
await check("reload-just-after-win", async (use) => {
  const p = use(await open({ local: saved(4) }));
  await p.goto(base + "#play"); await inGame(p);
  const e = await p.evaluate(() => JSON.parse(localStorage.getItem("clue.local")).state.env);
  await p.evaluate((e) => window.__clue.act({ type: "accuse", suspect: e[0], weapon: e[1], room: e[2] - 12 }), e);
  await p.reload(); await p.waitForSelector("#pn, svg.board"); await sleep(800);
  const rec = await p.evaluate(() => localStorage.getItem("clue.record"));
  const local = await p.evaluate(() => localStorage.getItem("clue.local"));
  return { ok: /"w":1/.test(rec || "") && !local, detail: `record ${rec} saved game left: ${!!local}` };
});
await check("two-tabs", async (use) => {
  const ctx = await browser.newContext({ ...iphone, viewport: { width: 393, height: 659 } });
  const A = await open({ ctx, local: saved(5, (s) => { s.turn = 1; }, 4), settings: { speed: 2, players: 5, me: 0, level: 0 } });
  use(A);
  await A.goto(base + "#play"); await inGame(A); await sleep(1500);
  const B = await ctx.newPage(); B.errs = A.errs;
  B.on("pageerror", (e) => A.errs.push("B pageerror: " + e.message));
  await B.goto(base + "#play"); await inGame(B);
  const key = (x) => JSON.stringify([x.pub.turnNo, x.pub.phase, x.pub.pos, x.pub.roll, x.pub.log.length]);
  const a0 = key(await snap(A));
  await sleep(4000);
  const sa = await snap(A), sb = await snap(B);
  const agree = await B.evaluate(() => { const st = JSON.parse(localStorage.getItem("clue.local")).state, p = window.__clue.snap.pub; return JSON.stringify(p.pos) === JSON.stringify(st.pos) && p.turnNo === st.turnNo; });
  // A must not keep playing its own copy: either it stood still or it shows exactly B's game
  const aStale = key(sa) === a0 || key(sa) === key(sb);
  // back to A: it picks up B's game
  await A.bringToFront(); await A.evaluate(() => window.dispatchEvent(new Event("focus"))); await sleep(800);
  const sa2 = await snap(A); const stored2 = await A.evaluate(() => JSON.parse(localStorage.getItem("clue.local")).state);
  const adopted = sa2.pub.turnNo >= sb.pub.turnNo && sa2.pub.turnNo === stored2.turnNo && JSON.stringify(sa2.pub.pos) === JSON.stringify(stored2.pos);
  return { ok: agree && aStale && adopted, detail: `B==storage ${agree}; A paused ${aStale} (A turn ${sa.pub.turnNo} ${key(sa) === a0 ? 'still' : 'moved'}, B turn ${sb.pub.turnNo}); A picked up ${adopted} (turn ${sa2.pub.turnNo})` };
});
await check("storage-blocked", async (use) => {
  const p = use(await open({ blockStorage: true }));
  await p.goto(base + "#play"); await p.waitForSelector("#go");
  await p.click("#go"); await inGame(p);
  await p.click("#bRoll"); await sleep(500);
  const s = await snap(p); await shot(p, "storage-blocked.png");
  return { ok: s.pub.phase !== "start", detail: "phase after roll " + s.pub.phase };
});
await check("corrupt-save", async (use) => {
  const p = use(await open({ local: { seats: [{ kind: "human", name: "You" }], state: { over: false, n: 4, turn: 0 } } }));
  p.errs.length = 0;
  await p.goto(base + "#play"); await sleep(2000);
  const setupShown = !!(await p.$("#pn"));
  const left = await p.evaluate(() => localStorage.getItem("clue.local"));
  return { ok: setupShown && !left, detail: `setup shown ${setupShown}, bad save cleared ${!left}` };
});
await check("animations-off", async (use) => {
  const ctx = await browser.newContext({ ...iphone, viewport: { width: 393, height: 659 } });
  await ctx.addInitScript(() => { try { localStorage.setItem("fx:clue", JSON.stringify({ animations: false, sound: false })); } catch (e) {} });
  const p = use(await open({ ctx, local: saved(4) }));
  await p.goto(base + "#play"); await inGame(p);
  await p.click("#bRoll"); await sleep(300);
  await p.evaluate(() => { const r = document.querySelector(".room-hit.can") || document.querySelector(".reach"); r.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
  await sleep(400);
  const s = await snap(p); const still = await p.evaluate(() => document.documentElement.classList.contains("fx-still"));
  return { ok: still && s.pub.phase !== "move", detail: `fx-still ${still}, phase ${s.pub.phase}` };
});
for (const scheme of ["light", "dark"]) await check("scheme-" + scheme, async (use) => {
  const p = use(await open({ local: saved(4), scheme }));
  await p.goto(base + "#play"); await inGame(p); await sleep(800);
  await shot(p, `scheme-${scheme}.png`);
  const L = await layout(p);
  return { ok: !L.overflowX, detail: JSON.stringify(L) };
});

await browser.close();
const bad = results.filter((r) => !r[1]).map((r) => r[0]);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? " — failed: " + bad.join(", ") : ""}`);
process.exit(bad.length ? 1 : 0);
