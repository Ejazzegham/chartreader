// Pure maths for chart zoom and pan (no React), so it can be tested.
// State: `vis` = how many candle slots are on screen, `off` = how many candles the right edge is away from the newest one.
// off > 0: looking at older candles. off < 0: empty "future" space on the right (up to 40% of the screen).
export type Z = { vis: number; off: number };
export const MIN_VIS = 12;

export function norm(s: Z, total: number): Z {
  if (total <= 0) return { vis: 0, off: 0 };
  const min = Math.min(MIN_VIS, total);
  const vis = Math.max(min, Math.min(total, Math.round(s.vis || total)));
  const maxPad = Math.round(vis * 0.4);
  const off = Math.max(-maxPad, Math.min(total - vis, Math.round(s.off)));
  return { vis, off };
}

// first and last real candle on screen, empty slots on the right, and total slots
export function win(s: Z, total: number) {
  const c = norm(s, total);
  const start = total - c.off - c.vis;
  return { start, end: Math.min(total, total - c.off), pad: Math.max(0, -c.off), slots: c.vis };
}

// Zoom by `factor` (<1 zooms in) keeping the candle under `frac` (0 = left edge, 1 = right edge) where it is.
export function zoomAround(s: Z, total: number, factor: number, frac: number): Z {
  const c = norm(s, total), w = win(c, total), f = Math.max(0, Math.min(1, frac));
  const anchor = w.start + f * c.vis;
  const vis = Math.max(1, Math.round(c.vis * factor)); // never 0: norm() reads 0 as "show everything"
  const start2 = anchor - f * vis;
  return norm({ vis, off: total - start2 - vis }, total);
}

export const panBy = (s: Z, total: number, candles: number): Z => { const c = norm(s, total); return norm({ vis: c.vis, off: c.off + candles }, total); };
export const setVis = (s: Z, total: number, vis: number): Z => { const c = norm(s, total); return norm({ vis, off: Math.max(0, c.off) }, total); };

// Put the middle of the screen on position `frac` (0..1) of the whole history (used by the minimap).
export function centerAt(s: Z, total: number, frac: number): Z {
  const c = norm(s, total), mid = Math.max(0, Math.min(1, frac)) * total, start = mid - c.vis / 2;
  return norm({ vis: c.vis, off: total - start - c.vis }, total);
}

// Which candle is under screen position x (pixels) in a plot `W` wide. Slots beyond the newest candle give the newest.
export function indexAt(s: Z, total: number, x: number, W: number) {
  const w = win(s, total), step = W / Math.max(1, w.slots);
  return Math.max(0, Math.min(total - 1, w.start + Math.floor(Math.max(0, x) / step)));
}

export const minimap = (s: Z, total: number) => {
  const w = win(s, total);
  return { left: total ? Math.max(0, w.start) / total : 0, width: total ? Math.min(1, (w.end - Math.max(0, w.start)) / total) : 1 };
};
