// Pure maths for the VERTICAL zoom and scroll of the candle charts (no React), so it can be tested.
// The chart normally fits the price range of the candles on screen ("fit"). The vertical state changes that range:
//   k = zoom factor. 1 = fit, 2 = show half the price range (zoom in), 0.5 = show twice the range (zoom out)
//   c = how far the middle of the screen is moved up (+) or down (-), measured in units of the fit range
export type VZ = { k: number; c: number };
export const VZ0: VZ = { k: 1, c: 0 };
export const K_MIN = 0.4, K_MAX = 25;
const MARGIN = 0.35;                    // you can scroll the window up to 35% of the fit range beyond the fit range
const HALF = 0.5 + MARGIN;              // half of the scrollable extent, in fit ranges

const fin = (v: number, d: number) => (isFinite(v) ? v : d);
const maxC = (k: number) => Math.max(0, HALF - 0.5 / k);

export function normV(v: VZ): VZ {
  const k = Math.max(K_MIN, Math.min(K_MAX, fin(v.k, 1)));
  const m = maxC(k);
  return { k, c: Math.max(-m, Math.min(m, fin(v.c, 0))) };
}
export const isFit = (v: VZ) => Math.abs(v.k - 1) < 1e-9 && Math.abs(v.c) < 1e-9;

// The price window shown: fit range [lo, hi] -> zoomed / scrolled range.
export function applyV(lo: number, hi: number, v: VZ): { lo: number; hi: number } {
  const n = normV(v), rng = hi - lo || 1, mid = (lo + hi) / 2 + n.c * rng, half = rng / (2 * n.k);
  return { lo: mid - half, hi: mid + half };
}

// Zoom by `factor` (> 1 zooms in) and keep the price at `fracY` of the plot height (0 = top, 1 = bottom) where it is.
export function zoomV(v: VZ, factor: number, fracY: number): VZ {
  const n = normV(v), f = Math.max(0, Math.min(1, fracY));
  const u = n.c + (0.5 - f) / n.k;                 // the price under the finger, in fit-range units from the fit middle
  const k2 = Math.max(K_MIN, Math.min(K_MAX, n.k * factor));
  return normV({ k: k2, c: u - (0.5 - f) / k2 });
}
export const panV = (v: VZ, dFit: number): VZ => { const n = normV(v); return normV({ k: n.k, c: n.c + dFit }); };

// ---- the vertical scroll bar. The track is the scrollable extent (fit range +/- margin); the thumb is the window you see.
export function thumb(v: VZ): { top: number; size: number } {
  const n = normV(v), win = 1 / n.k, ext = 2 * HALF;
  const size = Math.max(0.08, Math.min(1, win / ext));
  const winTop = n.c + 0.5 / n.k;                  // top edge of the window, in fit-range units from the fit middle
  const top = Math.max(0, Math.min(1 - size, (HALF - winTop) / ext));
  return { top, size };
}
// Thumb dragged so that its top edge sits at `top` (0..1 of the track). Keeps the zoom, moves the window.
export function fromThumbTop(v: VZ, top: number): VZ {
  const n = normV(v), ext = 2 * HALF, winTop = HALF - Math.max(0, Math.min(1, top)) * ext;
  return normV({ k: n.k, c: winTop - 0.5 / n.k });
}
// Thumb centre moved to `frac` of the track (tap on the track / drag)
export function fromThumbCenter(v: VZ, frac: number): VZ {
  const t = thumb(v);
  return fromThumbTop(v, Math.max(0, Math.min(1, frac)) - t.size / 2);
}
// Pan by a drag of `dy` pixels in a plot `H` pixels high (dragging down moves the chart down: you see higher prices)
export function panByPixels(v: VZ, dy: number, H: number): VZ {
  const n = normV(v);
  return panV(v, (dy / Math.max(1, H)) / n.k);
}
