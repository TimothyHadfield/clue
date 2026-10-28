// Browser test (WebKit, iPhone size): the house-rule switches, Quick moves, leftovers face up,
// the 2-player room cards, and the Videos in the rules sheet.
//   node tests/house.browser.mjs        (needs Playwright in ~/.claude/tools)
//   CLUE_ROOT=<other checkout> runs it against older code.
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import fs from "node:fs";
const require = createRequire(join(homedir(), ".claude/tools/") + "x.js");
const pw = require("playwright");
const ROOT = process.env.CLUE_ROOT || join(dirname(fileURLToPath(import.meta.url)), "..");

const T = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split("?")[0]); if (p.endsWith("/")) p += "index.html";
  fs.readFile(join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { "content-type": T[extname(p)] || "application/octet-stream" }); r.end(d); } });
});
await new Promise((ok) => srv.listen(0, ok));
const url = "http://localhost:" + srv.address().port + "/?nosw#play";
let failed = 0;
const check = (ok, msg) => { console.log((ok ? "  PASS  " : "  FAIL  ") + msg); if (!ok) failed++; };
const SHOTS = process.env.CLUE_SHOTS || "";

const browser = await pw.webkit.launch();
try {
  for (const width of [393, 320]) {
    console.log(`-- ${width} px`);
    const ctx = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : 659 }, hasTouch: true, isMobile: true });
    await ctx.addInitScript(() => { try { localStorage.setItem("coach-offer:clue-first", "1"); } catch (e) {} });
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => { if (!/ResizeObserver loop/.test(e.message)) errs.push(e.message); });
    await page.goto(url);
    await page.waitForFunction(() => window.__clue && window.Profile);
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

    // Settings: two house-rule switches, off by default
    await page.click('[data-tab="settings"]');
    await page.waitForSelector("#sQuick", { state: "attached" });
    check(await page.evaluate(() => !document.querySelector("#sFaceUp").checked && !document.querySelector("#sQuick").checked), "house rules are off by default");
    await page.click("label.switch:has(#sFaceUp)");
    await page.click("label.switch:has(#sQuick)");
    check(await page.evaluate(() => __clue.settings.faceUp === true && __clue.settings.quick === true), "the switches turn the house rules on");
    check(await page.evaluate(() => { const v = document.querySelector("#tab-settings"); return v.scrollWidth <= v.clientWidth + 1; }), "Settings fits its width");
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/settings-${width}.png` });

    // 4 players, leftovers face up + quick moves
    await page.click('[data-tab="play"]');
    await page.click('#pn button[data-n="4"]');
    await page.click("#go");
    await page.waitForFunction(() => __clue.snap && __clue.snap.pub);
    const pub = await page.evaluate(() => __clue.snap.pub);
    check(pub.faceUp.length === 2 && pub.sizes.every((x) => x === 4), "4 players: 4 cards each, 2 face up");
    check(pub.opts.quick === true, "quick moves are in the game's options");
    await page.waitForFunction(() => __clue.snap.myTurn && __clue.snap.pub.phase === "start", null, { timeout: 15000 });
    check(!(await page.$("#bRoll")), "quick moves: no Roll button");
    check(await page.evaluate(() => document.querySelectorAll(".room-hit.can").length === 9), "quick moves: all 9 rooms lit at the start of your turn");
    await page.waitForTimeout(2500);   // headless WebKit zooms slowly
    check(!(await page.isVisible("#zoomOut")), "quick moves: the board stays whole (no auto-zoom cutting off rooms)");
    await page.waitForFunction(() => document.querySelector("#notes th.pile"), null, { timeout: 15000 });
    check(await page.evaluate(() => document.querySelector("#notes th.pile").textContent === "Up"), "notes have an Up column");
    check(await page.evaluate(() => /Face up/.test(document.querySelector("#envline").textContent)), "notes list the face-up cards");
    const upRowOk = await page.evaluate(() => {
      const up = __clue.snap.pub.faceUp; const rows = [...document.querySelectorAll("#notes tbody tr:not(.cat)")];
      return up.every((c) => { const cells = rows[c].querySelectorAll("td"); const env = cells[cells.length - 1].textContent, pile = cells[cells.length - 2].textContent; return env === "✗" && pile.includes("✓"); });
    });
    check(upRowOk, "face-up cards: ✗ in the case file, ✓ in the Up column");
    await page.evaluate(() => document.querySelector('.room-hit[data-room="4"]').dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await page.waitForFunction(() => __clue.snap.pub.phase === "suggest", null, { timeout: 15000 });
    check(await page.evaluate(() => { const p = __clue.snap.pub; return p.pos[p.chars[p.turn]].room === 4; }), "tapping a lit room moves you straight there");
    check((await overflow()) <= 0, "no sideways scroll in the game");
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/quick-faceup-${width}.png` });
    await page.evaluate(() => { localStorage.removeItem("clue.local"); });

    // 2 players
    await page.waitForLoadState("networkidle").catch(() => {}); await page.goto(url);   // a lazy module cut off mid-load logs "Importing a module script failed"
    await page.waitForFunction(() => window.__clue);
    await page.click('#pn button[data-n="2"]');
    await page.click("#go");
    await page.waitForFunction(() => __clue.snap && __clue.snap.pub && __clue.snap.pub.n === 2);
    const p2 = await page.evaluate(() => __clue.snap.pub);
    check(p2.hiddenRooms.length === 4 && p2.sizes.join() === "7,7", "2 players: 7 cards each, 4 rooms hold a card");
    check(await page.evaluate(() => document.querySelectorAll(".hidcard").length === 4), "the board shows the 4 face-down room cards");
    await page.waitForFunction(() => __clue.snap.myTurn && __clue.snap.pub.phase === "start", null, { timeout: 15000 });
    const target = p2.hiddenRooms[0];
    await page.evaluate((r) => document.querySelector(`.room-hit[data-room="${r}"]`).dispatchEvent(new MouseEvent("click", { bubbles: true })), target);
    await page.waitForFunction(() => document.querySelector("#overlay.on h3"), null, { timeout: 15000 });
    check(/face-down card/.test(await page.textContent("#overlay h3")), "walking in shows you the room's card");
    check(await page.evaluate((r) => { const p = __clue.snap.pub; return p.pos[p.chars[__clue.snap.mySeat]].room === r; }, target), "you are in that room");
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/two-peek-${width}.png` });
    await page.click("#overlay [data-close]");
    await page.waitForFunction(() => document.querySelector("#notes th.pile"), null, { timeout: 15000 });
    check(await page.evaluate(() => document.querySelector("#notes th.pile").textContent === "Rm"), "notes have a Rooms column");
    check(await page.evaluate((r) => document.querySelector(".hidcard.looked") !== null, target), "the card you looked at gets a tick");
    check((await overflow()) <= 0, "no sideways scroll (2 players)");
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/two-${width}.png` });

    // rules sheet: Videos, readable links that open a new tab
    await page.evaluate(() => __clue.openRules("videos"));
    await page.waitForSelector(".coach-rules-body ul.vids a", { timeout: 5000 }).catch(() => {});
    const links = await page.evaluate(() => [...document.querySelectorAll(".coach-rules-body ul.vids a")].map((a) => ({ href: a.href, t: a.target, rel: a.rel, color: getComputedStyle(a).color })));
    check(links.length === 4 && links.every((l) => /youtube\.com\/watch\?v=/.test(l.href) && l.t === "_blank" && /noopener/.test(l.rel)), "rules sheet: 4 YouTube videos open in a new tab");
    check(links.length > 0 && links[0].color === "rgb(42, 79, 158)", "video links are dark blue on the cream paper");
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/videos-${width}.png` });

    // Online lag: Suggest tapped again before your suggestion comes back. If nobody can show a card,
    // nothing replaces that sheet, and it used to stay open with a dead Suggest button (found in the
    // 2-player online run). Ask about cards you hold yourself, in a room whose card you hold, so nobody shows.
    let hand = null;
    for (let k = 0; k < 15 && !hand; k++) {
      await page.evaluate(() => localStorage.removeItem("clue.local"));
      await page.waitForLoadState("networkidle").catch(() => {}); await page.goto(url);
      await page.waitForFunction(() => window.__clue);
      await page.click('#pn button[data-n="2"]');
      await page.click("#go");
      await page.waitForFunction(() => __clue.snap && __clue.snap.pub && __clue.snap.pub.n === 2);
      const h = await page.evaluate(() => __clue.snap.mine.hand);
      const s = h.find((c) => c < 6), w = h.find((c) => c >= 6 && c < 12), r = h.find((c) => c >= 12);
      if (s != null && w != null && r != null) hand = { s, w, room: r - 12 };
    }
    check(!!hand, "found a 2-player deal with a suspect, weapon and room in your hand");
    if (hand) {
      await page.waitForFunction(() => __clue.snap.myTurn && __clue.snap.pub.phase === "start", null, { timeout: 15000 });
      await page.evaluate((r) => document.querySelector(`.room-hit[data-room="${r}"]`).dispatchEvent(new MouseEvent("click", { bubbles: true })), hand.room);
      await page.waitForFunction(() => __clue.snap.pub.phase === "suggest", null, { timeout: 15000 });
      await page.waitForSelector("#bSug", { state: "attached", timeout: 15000 });   // after the walk
      await page.waitForTimeout(500);
      await page.evaluate(() => { const c = document.querySelector("#overlay.on [data-close]"); if (c) c.click(); });   // the room card you looked at, if any
      await page.evaluate(() => document.querySelector("#bSug").click());
      await page.waitForSelector("#overlay.on #sGo");
      await page.evaluate((h) => __clue.room.act({ type: "suggest", suspect: h.s, weapon: h.w }), hand);   // the first tap, arriving late
      await page.waitForFunction(() => __clue.snap.pub.phase === "post", null, { timeout: 15000 });
      await page.waitForTimeout(300);
      check(await page.evaluate(() => __clue.snap.pub.last.shower == null), "nobody could show a card");
      check(!(await page.$("#overlay.on #sGo")), "the leftover Suggest sheet closes once the suggestion is made");
    }
    check(errs.length === 0, "no page errors" + (errs.length ? ": " + errs.join(" | ") : ""));
    await ctx.close();
  }
} finally {
  await browser.close();
  srv.close();
}
console.log(failed ? `${failed} FAILED` : "all passed");
process.exit(failed ? 1 : 0);
