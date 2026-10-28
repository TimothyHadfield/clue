/* Shared page helpers: storage, settings, sheets, toasts, the solver worker. */

// ------------------------------------------------------------------ helpers
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem("clue." + k)); return v == null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("clue." + k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem("clue." + k); } catch (e) {} },
};
export const settings = Object.assign({ edition: "classic", rules: "classic", level: 2, odds: true, speed: 1, players: 4, me: 0, faceUp: false, quick: false }, store.get("settings", {}));
export const saveSettings = () => store.set("settings", settings);
let toastT = null;
export function toast(msg, ms = 2200) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("on");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), ms);
}
// Back button: an open sheet (or the phone's Notes panel) is one history step, so Back closes it
// instead of changing tab or leaving the site.
let ownBacks = 0;
export function pushLayer(kind) { try { if (!(history.state && history.state.layer)) history.pushState({ layer: kind }, ""); } catch (e) {} }
export function popLayer() { try { if (history.state && history.state.layer) { ownBacks++; history.back(); } } catch (e) {} }
/** For the popstate handler: true if this pop was our own popLayer(). */
export function takeOwnBack() { if (ownBacks > 0) { ownBacks--; return true; } return false; }
export function sheet(html, onOpen) {
  const o = $("#overlay");
  o.innerHTML = `<div class="sheet">${html}</div>`;
  o.classList.add("on");
  o.dataset.lock = "";
  o.onclick = (e) => { if (e.target === o && o.dataset.lock !== "1") closeSheet(); };
  pushLayer("sheet");
  if (onOpen) onOpen(o.firstElementChild);
  return o.firstElementChild;
}
export function sheetOpen() { return $("#overlay").classList.contains("on"); }
export function closeSheet(fromBack) {
  const o = $("#overlay");
  const was = o.classList.contains("on");
  o.classList.remove("on"); o.innerHTML = ""; o.dataset.lock = "";
  if (was && fromBack !== true) popLayer();
}
export const pct = (p) => (p >= 0.9995 ? "100%" : p <= 0.0005 ? "0%" : p < 0.01 ? "<1%" : Math.round(p * 100) + "%");
/** red → green for "how likely is this the answer" */
export const heat = (p) => `hsl(${Math.round(8 + 120 * Math.min(1, p))} 70% 62%)`;
export function help(title, body) { return `<button class="q" data-help="${esc(title)}" data-body="${esc(body)}" aria-label="Why?">?</button>`; }
document.addEventListener("click", (e) => {
  const q = e.target.closest("[data-help]");
  if (!q) return;
  e.stopPropagation();
  // a "?" inside another sheet (e.g. Suggest) opens on top of it, and OK goes back to it with your picks kept
  const o = $("#overlay");
  const under = sheetOpen() ? o.firstElementChild : null, lock = o.dataset.lock;
  const back = () => { o.innerHTML = ""; o.appendChild(under); o.dataset.lock = lock; o.onclick = (ev) => { if (ev.target === o && o.dataset.lock !== "1") closeSheet(); }; };
  sheet(`<h3>${q.dataset.help}</h3><p>${q.dataset.body}</p><div class="row" style="justify-content:flex-end"><button class="btn small" data-close>OK</button></div>`, (el) => {
    $("[data-close]", el).onclick = under ? back : closeSheet;
    if (under) o.onclick = (ev) => { if (ev.target === o) back(); };
  });
});

// ------------------------------------------------------------------ solver worker
let worker = null, wid = 0;
const pending = new Map();
export function askSolver(payload) {
  if (!worker) {
    worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
    worker.onmessage = (e) => { const f = pending.get(e.data.id); if (f) { pending.delete(e.data.id); f(e.data); } };
    worker.onerror = (e) => { console.warn("solver worker", e.message); };
  }
  const id = ++wid;
  return new Promise((res) => { pending.set(id, res); worker.postMessage(Object.assign({ id }, payload)); });
}

