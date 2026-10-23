// Pure maths for the MT5-style smooth chart zoom (no React), so it can be tested.
//
// The old engine rounded `vis` and `off` to whole candles, so a pinch moved in visible steps. This one keeps both as
// fractions of a candle: the candle under your fingers stays exactly under them, and the candle width changes continuously.
//
//   vis = how many candle slots fit across the plot (a fraction, e.g. 63.42)
//   off = how many candles the right edge of the plot is away from the right edge of the newest candle.
//         off > 0: looking at older candles.   off < 0: empty "future" space on the right (up to FUTURE of the screen).
export type ZF = { vis: number; off: number };

export const MIN_VIS = 6;      // closest zoom: 6 candles across (MT5 goes about this close)
export const FUTURE = 0.45;    // empty space allowed on the right, as a fraction of the screen

const fin = (v: number, d: number) => (typeof v === 'number' && isFinite(v) ? v : d);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const minVis = (total: number) => Math.min(MIN_VIS, Math.max(1, total));

export function clampZ(s: ZF, total: number): ZF {
  if (total <= 0) return { vis: 0, off: 0 };
  const vis = clamp(fin(s.vis, total), minVis(total), Math.max(total, minVis(total)));
  const off = clamp(fin(s.off, 0), -vis * FUTURE, Math.max(-vis * FUTURE, total - vis));
  return { vis, off };
}
export function freeZ(s: ZF, total: number): ZF {
  if (total <= 0) return { vis: 0, off: 0 };
  const vis = clamp(fin(s.vis, total), minVis(total), Math.max(total, minVis(total))), r = offRange(vis, total);
  return { vis, off: clamp(fin(s.off, 0), r.lo - vis, r.hi + vis) };
}
// where `off` may go for this zoom
export const offRange = (vis: number, total: number) => ({ lo: -vis * FUTURE, hi: Math.max(-vis * FUTURE, total - vis) });

export type WinF = { vis: number; off: number; startF: number; endF: number; start: number; end: number; step: number; shift: number; pad: number };

// The window to draw. Candle i is centred at  X(i) = (i - start) * step + step / 2 + shift  =  (i - startF + 0.5) * step.
// `start` / `end` are whole indexes (slice the candles with them, they include the partly visible candles at the edges).
// free = true: only the zoom is limited, `off` may be past the ends (the rubber band while you drag / the bounce after a flick).
export function windowF(s: ZF, total: number, W: number, free = false): WinF {
  const c = free ? freeZ(s, total) : clampZ(s, total), step = W / Math.max(c.vis, 1e-9);
  const startF = total - c.off - c.vis, endF = total - c.off;
  const start = Math.max(0, Math.floor(startF)), end = Math.max(start, Math.min(total, Math.ceil(endF)));
  return { vis: c.vis, off: c.off, startF, endF, start, end, step, shift: (start - startF) * step, pad: Math.max(0, -c.off) };
}

// Zoom by `factor` (< 1 zooms in) keeping the point under `frac` (0 = left edge, 1 = right edge of the plot) exactly where it is.
export function zoomAroundF(s: ZF, total: number, factor: number, frac: number): ZF {
  const c = clampZ(s, total), f = clamp(frac, 0, 1), anchor = total - c.off - c.vis + f * c.vis;
  const vis = clamp(c.vis * factor, minVis(total), Math.max(total, minVis(total)));
  return clampZ({ vis, off: total - (anchor - f * vis) - vis }, total);
}
// Same, but the focal point moved by `dxFrac` of the plot width while the fingers pinched (two-finger pan + zoom together).
export function pinchF(base: ZF, total: number, factor: number, frac0: number, frac1: number): ZF {
  const c = clampZ(base, total), f0 = clamp(frac0, 0, 1), anchor = total - c.off - c.vis + f0 * c.vis;
  const vis = clamp(c.vis * factor, minVis(total), Math.max(total, minVis(total)));
  return clampZ({ vis, off: total - (anchor - clamp(frac1, -0.5, 1.5) * vis) - vis }, total);
}
export const panByF = (s: ZF, total: number, candles: number): ZF => { const c = clampZ(s, total); return clampZ({ vis: c.vis, off: c.off + candles }, total); };
export const setVisF = (s: ZF, total: number, vis: number): ZF => { const c = clampZ(s, total); return clampZ({ vis, off: Math.max(0, c.off) }, total); };

// Put the middle of the screen on position `frac` (0..1) of the whole history (minimap).
export function centerAtF(s: ZF, total: number, frac: number): ZF {
  const c = clampZ(s, total), mid = clamp(frac, 0, 1) * total;
  return clampZ({ vis: c.vis, off: total - (mid - c.vis / 2) - c.vis }, total);
}
export function indexAtF(s: ZF, total: number, x: number, W: number) {
  const w = windowF(s, total, W);
  return clamp(Math.floor(w.startF + Math.max(0, x) / Math.max(w.step, 1e-9)), 0, Math.max(0, total - 1));
}
export const minimapF = (s: ZF, total: number) => {
  const c = clampZ(s, total), a = Math.max(0, total - c.off - c.vis), b = Math.min(total, total - c.off);
  return { left: total ? a / total : 0, width: total ? Math.max(0, b - a) / total : 1 };
};

// ---- animation helpers
export const easeOutCubic = (p: number) => 1 - Math.pow(1 - clamp(p, 0, 1), 3);
export const easeInOut = (p: number) => { const x = clamp(p, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
// zoom in / out evenly to the eye: the width changes geometrically, the position linearly
export const lerpZ = (a: ZF, b: ZF, e: number): ZF => ({ vis: a.vis * Math.pow(Math.max(b.vis, 1e-9) / Math.max(a.vis, 1e-9), e), off: a.off + (b.off - a.off) * e });
// move `cur` toward `target`, frame-rate independent (tau in ms: smaller = faster)
export const easeToward = (cur: number, target: number, dt: number, tau: number) => cur + (target - cur) * (1 - Math.exp(-Math.max(0, dt) / Math.max(1, tau)));

// ---- rubber band: dragging past the end gets harder and harder (iOS style)
const band = (x: number, d: number) => (1 - 1 / ((x * 0.55) / d + 1)) * d;
export function rubber(v: number, lo: number, hi: number, d: number) {
  if (v < lo) return lo - band(lo - v, d);
  if (v > hi) return hi + band(v - hi, d);
  return v;
}

// ---- inertia. m.v is candles per millisecond. Inside the limits the glide slows down smoothly;
// outside them a critically damped spring pulls the chart back (a flick past the end bounces back softly).
export type Motion = { off: number; v: number };
const FRICTION = 0.0036, K = 1.2e-4, C = 2 * Math.sqrt(1.2e-4);
export function stepMotion(m: Motion, dt0: number, lo: number, hi: number): { m: Motion; done: boolean } {
  const dt = clamp(dt0, 0, 34);
  let { off, v } = m;
  const out = off < lo ? off - lo : off > hi ? off - hi : 0;
  if (out !== 0) v += (-K * out - C * v) * dt;
  else v *= Math.exp(-FRICTION * dt);
  off += v * dt;
  const out2 = off < lo ? off - lo : off > hi ? off - hi : 0;
  if (out2 !== 0 && Math.abs(out2) < 0.004 && Math.abs(v) < 0.0002) return { m: { off: out2 < 0 ? lo : hi, v: 0 }, done: true };
  return { m: { off, v }, done: out2 === 0 && Math.abs(v) < 0.00015 };
}
// velocity (candles / ms) from the last few touch samples [t ms, off]
export function velocityOf(samples: { t: number; off: number }[], now: number, windowMs = 90) {
  const s = samples.filter((q) => now - q.t <= windowMs);
  if (s.length < 2) return 0;
  const a = s[0], b = s[s.length - 1], dt = b.t - a.t;
  return dt > 0 ? (b.off - a.off) / dt : 0;
}

// ---- axis labels
// "Nice" price labels like MT5 (1 / 2 / 5 steps), inside [lo, hi].
export function niceTicks(lo: number, hi: number, approx = 6): number[] {
  const rng = hi - lo;
  if (!(rng > 0) || !isFinite(rng)) return [];
  const raw = rng / Math.max(2, approx), p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
  const st = (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p, out: number[] = [];
  for (let k = Math.ceil(lo / st - 1e-9); k <= Math.floor(hi / st + 1e-9); k++) out.push(+(k * st).toPrecision(12));
  return out;
}
// every how many candles a time label fits (labels need `labelPx`), rounded to 1 / 2 / 5 / 10 ...
export function niceEvery(step: number, labelPx: number) {
  const need = Math.max(1, labelPx / Math.max(step, 1e-9)), p = Math.pow(10, Math.floor(Math.log10(need))), m = need / p;
  return Math.max(1, Math.round((m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p));
}
