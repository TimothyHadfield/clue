// Two separate headless browsers play an online Clue room to the end.
//   node tools/two-browsers.mjs [url] [--engine webkit|chromium] [--shots dir]
// Proves: create room, join by code, hands stay private, a reload mid-game puts you back, the game ends for both.
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const require = createRequire(join(homedir(), ".claude/tools/") + "x.js");
const pw = require("playwright");

const args = process.argv.slice(2);
const url = args.find((a) => a.startsWith("http")) || "https://timothyhadfield.github.io/clue/";
const engine = args.includes("--engine") ? args[args.indexOf("--engine") + 1] : "webkit";
const shots = args.includes("--shots") ? args[args.indexOf("--shots") + 1] : null;
const fail = (m) => { console.error("FAIL: " + m); process.exit(1); };
const auto = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "autoplay.js"), "utf8");
const autoN = (n) => auto.replace("i < 4000", "i < " + n);

const iphone = pw.devices["iPhone 13"] ? { ...pw.devices["iPhone 13"], viewport: { width: 393, height: 659 } } : {};
const opts = engine === "webkit" ? iphone : {};
const bA = await pw[engine].launch(), bB = await pw[engine].launch();
const A = await (await bA.newContext(opts)).newPage(), B = await (await bB.newContext(opts)).newPage();
const errs = [], reloadNoise = [];
let reloading = false;
for (const [n, p] of [["A", A], ["B", B]]) {
  p.on("console", (m) => { if (m.type() === "error" && !/BloomFilter/.test(m.text())) (reloading && n === "B" ? reloadNoise : errs).push(n + ": " + m.text()); });
  p.on("pageerror", (e) => (reloading && n === "B" ? reloadNoise : errs).push(n + " pageerror: " + e.message));
}
const snap = (p) => p.evaluate(() => JSON.parse(JSON.stringify(window.__clue.snap || null)));

await A.goto(url); await B.goto(url);
await A.click("#goOnline"); await A.fill("#oName", "Alice"); await A.click("#oCreate");
await A.waitForSelector("#lseats", { timeout: 20000 });
const codeSel = '.setup-wrap div[style*="44px"]';
await A.waitForFunction((sel) => /^[A-Z0-9]{5}$/.test(document.querySelector(sel).textContent.trim()), codeSel, { timeout: 20000 });
const code = (await A.textContent(codeSel)).trim();
console.log("room code", code);
if (shots) await A.screenshot({ path: shots + "/online-lobby.png" });

await B.click("#goOnline"); await B.fill("#oName", "Bob"); await B.fill("#oCode", code); await B.click("#oJoin");
await A.waitForFunction(() => /Bob/.test(document.querySelector("#lseats").textContent), null, { timeout: 25000 });
console.log("PASS Bob is seated");
await A.click("#lStart");
for (const p of [A, B]) await p.waitForFunction(() => window.__clue.snap && window.__clue.snap.pub && window.__clue.snap.mine && document.querySelector("svg.board"), null, { timeout: 25000 });

const sA = await snap(A), sB = await snap(B);
console.log("Alice seat", sA.mySeat, "hand", sA.mine.hand.join(","), "| Bob seat", sB.mySeat, "hand", sB.mine.hand.join(","));
if (sA.mySeat === sB.mySeat) fail("same seat");
if (sA.mine.hand.some((c) => sB.mine.hand.includes(c))) fail("hands overlap");
const pubB = JSON.stringify(sB.pub);
if (sB.pub.reveal || /"hands"|"env"/.test(pubB)) fail("Bob's public view holds hands or the case file");
if (JSON.stringify(sB).includes(JSON.stringify(sA.mine.hand))) fail("Bob's snapshot contains Alice's hand");
console.log("PASS hidden hands: Bob's snapshot has no other hand and no case file");
if (shots) { await A.screenshot({ path: shots + "/online-alice.png" }); await B.screenshot({ path: shots + "/online-bob.png" }); }

// play a while, then Bob reloads mid-game
const pA = A.evaluate(autoN(40)), pB = B.evaluate(autoN(40));
await Promise.all([pA, pB]);
const before = await snap(B);
if (before.pub.over) console.log("note: game ended before the reload");
reloading = true;
await B.reload();
await B.waitForFunction(() => window.__clue.snap && window.__clue.snap.pub && document.querySelector("svg.board"), null, { timeout: 30000 });
reloading = false;
const after = await snap(B);
if (after.mySeat !== before.mySeat) fail("Bob came back in a different seat");
if (after.pub.log.length < before.pub.log.length) fail("Bob's game went backwards after the reload");
console.log("PASS Bob reloaded and is back in seat", after.mySeat, "at turn", after.pub.turnNo);

const [rA, rB] = await Promise.all([A.evaluate(auto), B.evaluate(auto)]);
for (const p of [A, B]) await p.waitForFunction(() => window.__clue.snap.pub.over, null, { timeout: 60000 });
const eA = await snap(A), eB = await snap(B);
if (eA.pub.winner !== eB.pub.winner) fail("players disagree on the winner");
console.log("PASS both see the game end; winner seat", eA.pub.winner, "after", eA.pub.turnNo, "turns", JSON.stringify(rA), JSON.stringify(rB));
if (shots) { await A.screenshot({ path: shots + "/online-alice-end.png" }); await B.screenshot({ path: shots + "/online-bob-end.png" }); }

if (reloadNoise.length) console.log(`note: ${reloadNoise.length} messages while Bob's page reloaded (cut-off Firestore channels)`);
if (errs.length) fail("console errors:\n" + errs.join("\n"));
console.log("PASS no console errors (" + engine + ")");
await bA.close(); await bB.close();
