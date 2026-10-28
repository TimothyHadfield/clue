// Plays the human seat by clicking the real buttons until the game ends.
// Used by phone-view: --eval "$(cat tools/autoplay.js)". Returns a short report.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (s) => document.querySelector(s);
  window.__clue.settings.speed = 4;
  const seen = [];
  for (let i = 0; i < 4000; i++) {
    const snap = window.__clue.snap;
    if (snap && snap.pub && snap.pub.over) { await sleep(800); break; }
    const sheetOpen = q("#overlay.on");
    if (sheetOpen) {
      const pick = q("#overlay .cardf.pick");
      if (pick) { pick.click(); seen.push("show"); await sleep(150); continue; }
      const best = q("#sBest");
      if (best && !best.disabled) { best.click(); await sleep(50); }
      if (q("#sGo")) {
        if (q("#sGo").disabled) { q("#cs .chip").click(); await sleep(20); q("#cw .chip").click(); await sleep(20); }
        q("#sGo").click(); seen.push("suggest"); await sleep(150); continue;
      }
      const close = q("#overlay [data-close]");
      if (close) { close.click(); await sleep(100); continue; }
    }
    const b = (id) => { const x = q("#" + id); if (x && !x.disabled) { x.click(); seen.push(id); return true; } return false; };
    if (snap && snap.myTurn) {
      const ph = snap.pub.phase;
      if (ph === "start") {
        // quick moves: no Roll button, tap a lit room
        if (!b("bSug")) if (!b("bPass")) if (!b("bRoll")) {
          // quick moves: prefer a room card not yet looked at (2 players), else a random lit room
          const lit = [...document.querySelectorAll(".room-hit.can")];
          const looked = new Set((snap.mine.seen || []).filter((x) => x.i < 0).map((x) => x.room));
          const fresh = lit.filter((r) => (snap.pub.hiddenRooms || []).includes(+r.dataset.room) && !looked.has(+r.dataset.room));
          const pool = fresh.length ? fresh : lit;
          const room = pool[Math.floor(Math.random() * pool.length)];
          if (room) room.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        }
      }
      else if (ph === "move") {
        const room = q(".room-hit.can"); const sq = q(".reach");
        if (room) room.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        else if (sq) sq.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      }
      else if (ph === "suggest") b("bSug");
      else if (ph === "post") {
        const top = snap && document.querySelector("#envline b:last-child");
        if (top && top.textContent === "100%") { b("bAcc"); await sleep(100); b("aTop"); await sleep(50); b("aGo"); }
        else b("bEnd");
      }
    }
    await sleep(120);
  }
  const s = window.__clue.snap;
  return { over: s.pub.over, winner: s.pub.winner, turns: s.pub.turnNo, log: s.pub.log.length, clicks: seen.length };
})()
