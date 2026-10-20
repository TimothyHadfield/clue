// Odd online moments with three headless browsers (2026-10-20 edge pass).
//   node tools/edge-online.mjs [url]
// Two players called "Tim" plus a long emoji name; the "joining" moment; the host hands a seat
// to a computer while that player is still there; a late joiner with a new name.
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
const require = createRequire(join(homedir(), ".claude/tools/") + "x.js");
const pw = require("playwright");

const url = process.argv.slice(2).find((a) => a.startsWith("http")) || "https://timothyhadfield.github.io/clue/";
const shots = process.argv.includes("--shots") ? process.argv[process.argv.indexOf("--shots") + 1] : null;
const LONG = "👨‍👩‍👧‍👦 Bartholo";
const iphone = { ...pw.devices["iPhone 15"], viewport: { width: 393, height: 659 } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const res = (name, ok, detail) => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${detail}`); };

const browsers = [], pages = [];
for (const n of ["A", "B", "C"]) {
  const b = await pw.webkit.launch(); browsers.push(b);
  const p = await (await b.newContext(iphone)).newPage();
  p.errs = [];
  p.on("console", (m) => { if (m.type() === "error" && !/BloomFilter/.test(m.text())) p.errs.push(m.text()); });
  p.on("pageerror", (e) => p.errs.push("pageerror: " + e.message));
  pages.push(p);
}
const [A, B, C] = pages;
const snap = (p) => p.evaluate(() => JSON.parse(JSON.stringify(window.__clue.snap || null)));
try {
  for (const p of pages) await p.goto(url + "#play");
  await A.click("#goOnline"); await A.fill("#oName", "Tim"); await A.click("#oCreate");
  const codeSel = '.setup-wrap div[style*="44px"]';
  await A.waitForFunction((sel) => { const e = document.querySelector(sel); return e && /^[A-Z0-9]{5}$/.test(e.textContent.trim()); }, codeSel, { timeout: 60000 });
  const code = (await A.textContent(codeSel)).trim();
  console.log("room", code);
  for (const [p, nm] of [[B, "Tim"], [C, LONG]]) {
    await p.click("#goOnline"); await p.fill("#oName", nm); await p.fill("#oCode", code); await p.click("#oJoin");
    await p.waitForSelector("#lseats", { timeout: 60000 });
  }
  const joinErrs = [B, C].flatMap((p) => p.errs.filter((e) => /seats/.test(e)));
  res("joining-no-crash", !joinErrs.length, joinErrs.length ? joinErrs.join(" / ") : "no snap.seats error while joining");
  await A.waitForFunction(() => document.querySelectorAll("#lseats .row.between").length && /Barth/.test(document.querySelector("#lseats").textContent), null, { timeout: 60000 });
  await A.click("#lStart");
  for (const p of pages) await p.waitForFunction(() => window.__clue.snap && window.__clue.snap.pub && document.querySelector("svg.board"), null, { timeout: 60000 });
  await sleep(1500);
  const plates = await C.evaluate(() => [...document.querySelectorAll("#players .pl")].map((x) => ({ nm: x.querySelector(".nm").textContent, title: x.title })));
  const tims = plates.filter((x) => /Tim/.test(x.title));
  res("duplicate-names", tims.length === 2 && tims[0].title.split(" · ")[0] !== tims[1].title.split(" · ")[0], "C sees " + plates.map((x) => x.nm + " [" + x.title + "]").join(", "));
  const fit = await A.evaluate(() => { const pl = document.querySelector("#players"); return pl.scrollWidth - pl.clientWidth; });
  const aPlates = await A.evaluate(() => [...document.querySelectorAll("#players .pl .nm")].map((x) => x.textContent));
  res("long-emoji-name", fit <= 1 && aPlates.some((t) => /👨‍👩‍👧‍👦/.test(t)), "A sees " + aPlates.join(", ") + " overflow " + fit);
  if (shots) { await A.screenshot({ path: shots + "/online-A.png" }); await C.screenshot({ path: shots + "/online-C.png" }); }

  // the host hands Bob's seat to a computer while Bob is still there
  const sb = await snap(B);
  B.errs.length = 0;
  const r = await A.evaluate((i) => window.__clue.online.setSeat(i, "computer"), sb.mySeat);
  await B.waitForSelector("#pn, #oName", { timeout: 30000 });
  const toastB = await B.evaluate(() => document.querySelector("#toast").textContent);
  res("seat-taken-message", /computer/i.test(toastB), `setSeat ${JSON.stringify(r)}; B toast "${toastB}"`);

  // a late joiner with a new name
  if (!(await B.$("#oName"))) await B.click("#goOnline");
  await B.fill("#oName", "Zed"); await B.fill("#oCode", code); await B.click("#oJoin");
  await B.waitForFunction(() => document.querySelector("#toast.on"), null, { timeout: 30000 });
  const t2 = await B.evaluate(() => document.querySelector("#toast").textContent);
  const kept = await B.evaluate(() => document.querySelector("#oCode") && document.querySelector("#oCode").value);
  res("late-joiner", /already started/i.test(t2) && kept === code, `toast "${t2}", code kept "${kept}"`);

  const errs = pages.flatMap((p, i) => p.errs.map((e) => "ABC"[i] + ": " + e));
  res("no-console-errors", !errs.length, errs.slice(0, 5).join(" / ") || "none");
  await A.evaluate(() => window.__clue.online.leave()).catch(() => {});
} catch (e) {
  res("run", false, e.message.split("\n")[0]);
}
for (const b of browsers) await b.close();
const bad = results.filter((x) => !x).length;
console.log(`\n${results.length - bad}/${results.length} passed`);
process.exit(bad ? 1 : 0);
