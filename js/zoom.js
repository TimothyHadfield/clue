/* Board zoom: moves the board SVG's viewBox, so every tap still lands on the real square or room.
 *   const z = makeZoom(svg, { onChange })
 *   z.to({x, y, w, h}, auto)  look at a part of the board (board units; widened to the box's shape)
 *   z.reset()                 the whole board again
 *   z.unitPx()                screen px per square when the whole board shows
 * Two fingers pinch, one finger drags while zoomed in, the mouse wheel zooms on a laptop.
 * A drag or pinch never counts as a tap on the board. */
export function makeZoom(svg, { onChange = () => {}, still = () => false } = {}) {
  const vb = svg.viewBox.baseVal;
  const full = { x: vb.x, y: vb.y, w: vb.width, h: vb.height };
  let cur = { ...full }, raf = 0, auto = false;
  const MIN_W = 7;                       // never closer than 7 squares across
  const box = () => svg.getBoundingClientRect();
  const aspect = () => { const r = box(); return r.width > 0 && r.height > 0 ? r.width / r.height : full.w / full.h; };
  // the whole board, widened to the box's shape
  const fullView = () => { const a = aspect(); const w = Math.max(full.w, full.h * a); return { x: full.x - (w - full.w) / 2, y: full.y - (w / a - full.h) / 2, w, h: w / a }; };
  const scale = () => fullView().w / cur.w;
  const set = (v) => { cur = v; svg.setAttribute("viewBox", `${v.x.toFixed(3)} ${v.y.toFixed(3)} ${v.w.toFixed(3)} ${v.h.toFixed(3)}`); };

  /** Fit a wanted area to the box's shape, no closer than MIN_W, kept on the board. */
  function shape(r) {
    const a = aspect(), F = fullView();
    let w = Math.max(r.w, r.h * a, MIN_W), cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    if (w >= F.w * 0.97) return F;
    const h = w / a;
    const clamp = (c, size, lo, len) => (size >= len ? lo + len / 2 : Math.min(Math.max(c, lo + size / 2), lo + len - size / 2));
    cx = clamp(cx, w, full.x, full.w); cy = clamp(cy, h, full.y, full.h);
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  }
  function go(target, animate = true) {
    cancelAnimationFrame(raf);
    const from = { ...cur };
    const done = () => onChange(api);
    if (!animate || still()) { set(target); done(); return; }
    const t0 = performance.now(), ms = 320;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      set({ x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, w: from.w + (target.w - from.w) * e, h: from.h + (target.h - from.h) * e });
      if (k < 1) raf = requestAnimationFrame(step); else done();
    };
    raf = requestAnimationFrame(step);
  }
  // screen point -> board units
  function pt(clientX, clientY) {
    const m = svg.getScreenCTM(); if (!m) return { x: 0, y: 0 };
    const p = svg.createSVGPoint(); p.x = clientX; p.y = clientY;
    const q = p.matrixTransform(m.inverse()); return { x: q.x, y: q.y };
  }
  /** Zoom by factor k around a board point, without animation (pinch and wheel). */
  function zoomAround(k, at) {
    const F = fullView();
    let w = Math.min(F.w, Math.max(MIN_W, cur.w / k));
    if (w >= F.w * 0.97) { set(F); auto = false; onChange(api); return; }
    const h = w / aspect();
    const fx = (at.x - cur.x) / cur.w, fy = (at.y - cur.y) / cur.h;
    const v = shape({ x: at.x - fx * w, y: at.y - fy * h, w, h });
    set(v); auto = false; onChange(api);
  }

  // ---- touch and mouse: pinch, drag to pan, wheel
  const ptrs = new Map();
  let moved = false, pinch0 = null, pan0 = null;
  svg.addEventListener("pointerdown", (e) => {
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) { moved = false; pan0 = { x: e.clientX, y: e.clientY, v: { ...cur } }; }
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y), w: cur.w, at: pt((a.x + b.x) / 2, (a.y + b.y) / 2) };
      moved = true;
    }
  });
  svg.addEventListener("pointermove", (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size >= 2 && pinch0) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch0.d > 0 && d > 0) zoomAround(cur.w / (pinch0.w * pinch0.d / d), pinch0.at);
      return;
    }
    if (ptrs.size === 1 && pan0) {
      const dx = e.clientX - pan0.x, dy = e.clientY - pan0.y;
      if (!moved && Math.hypot(dx, dy) < 8) return;
      if (scale() <= 1.01) return;                 // nothing to pan on the whole board
      moved = true;
      const r = box(), upp = Math.max(pan0.v.w / r.width, pan0.v.h / r.height);
      set(shape({ x: pan0.v.x - dx * upp, y: pan0.v.y - dy * upp, w: pan0.v.w, h: pan0.v.h }));
      auto = false;
    }
  });
  const up = (e) => {
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch0 = null;
    if (ptrs.size === 0) { pan0 = null; if (moved) onChange(api); }
  };
  svg.addEventListener("pointerup", up);
  svg.addEventListener("pointercancel", up);
  // a drag or a pinch is not a tap
  svg.addEventListener("click", (e) => { if (moved) { e.stopImmediatePropagation(); e.preventDefault(); moved = false; } }, true);
  svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    zoomAround(Math.exp(-e.deltaY * 0.0022), pt(e.clientX, e.clientY));
  }, { passive: false });

  const api = {
    get zoomed() { return scale() > 1.02; },
    get auto() { return auto; },
    get view() { return { ...cur }; },
    full,
    to(r, isAuto = false) { const t = shape(r); auto = isAuto && t.w < fullView().w; go(t); },
    reset(animate = true) { auto = false; go(fullView(), animate); },
    unitPx() { const r = box(); return Math.min(r.width / full.w, r.height / full.h); },
    scale, pt,
  };
  return api;
}
