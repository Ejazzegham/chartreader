// Pure maths for the start screen (no React / no phone code, so it can be tested in Node).
// An endless, smooth candlestick chart: candles keep forming on the right and slide left. Price rises and falls in slow waves.
export const N = 30, SLOT = 420, T0 = 1000, K0 = 60, PB = 2610, PK = 1.35, VM = 5.5;
export const LOGO_W = 220;
export const UP = '#0FA37F', DN = '#E5384F';
export type Cd = { o: number; c: number; h: number; l: number; v: number };
export type Vr = { lo: number; hi: number; set: boolean; t: number };
export type Layout = { W: number; H: number; top: number; lh: number; y0: number; y1: number; shift: number; bottom: number };
export const ease = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : 1 - Math.pow(1 - t, 3));
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const r2 = (n: number) => Math.round(n * 100) / 100;

const hs = (k: number, s: number) => { const x = Math.sin(k * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };
const cl = (k: number) => 100 + 9 * Math.sin(k * 0.21) + 6 * Math.sin(k * 0.083 + 1.3) + 3 * Math.sin(k * 0.47 + 0.6) + (hs(k, 1) - 0.5) * 3;
const cache = new Map<number, Cd>();
export function cd(k: number): Cd {
  let x = cache.get(k);
  if (!x) {
    const o = cl(k - 1), c = cl(k);
    const h = Math.max(o, c) + 0.25 + hs(k, 2) * 1.2, l = Math.min(o, c) - 0.25 - hs(k, 3) * 1.2;
    x = { o, c, h, l, v: (h - l) * (0.6 + hs(k, 4) * 0.8) };
    cache.set(k, x);
    if (cache.size > 200) cache.delete(cache.keys().next().value as number);
  }
  return x;
}
// price while the candle is forming: open -> low -> high -> close (or open -> high -> low -> close), smooth in between
function pp(x: Cd, f: number) {
  const kf = x.c >= x.o ? [x.o, x.l, x.h, x.c] : [x.o, x.h, x.l, x.c], ts = [0, 0.28, 0.7, 1];
  let i = 0; while (i < 2 && f > ts[i + 1]) i++;
  const u = (f - ts[i]) / (ts[i + 1] - ts[i]), e = u * u * (3 - 2 * u);
  return kf[i] + (kf[i + 1] - kf[i]) * e;
}
export const hslHex = (h: number, s = 0.9, l = 0.56) => {
  const a = s * Math.min(l, 1 - l), f = (n: number) => { const k = (n + h / 30) % 12, c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(255 * c).toString(16).padStart(2, '0'); };
  return '#' + f(0) + f(8) + f(4);
};
export const BUCKETS = 8; // streak colours: 8 steps from green-teal to violet-blue (hue 130..240)
export const bucketHex = (b: number) => hslHex(130 + (b * 110) / (BUCKETS - 1));

export function makeLayout(W: number, H: number, topInset = 0, bottomInset = 0): Layout {
  const lh = Math.round((LOGO_W * 934) / 900); // same logo size and place as the phone's own splash
  const top = Math.max(topInset + 14, H * 0.05);
  const y0 = top + lh + 64, y1 = Math.min(y0 + Math.max(150, H * 0.27), H - 150 - bottomInset);
  return { W, H, top, lh, y0, y1: Math.max(y1, y0 + 100), shift: H / 2 - lh / 2 - top, bottom: bottomInset };
}

export function frame(t: number, L: Layout, vr: Vr) {
  const { W, y0, y1, top, lh } = L;
  const x0 = 10, x1 = W - 56, vh = (y1 - y0) * 0.17, py1 = y1 - vh - 10, sw = (x1 - x0) / N, xr = x1 - sw * 0.7;
  const ia = ease((t - 1000) / 700);
  const tt = Math.max(0, t - T0) / SLOT, fl = Math.floor(tt), f = tt - fl, cur = K0 + fl, X = (k: number) => xr - (cur + f - k) * sw;
  const arr: (Cd & { k: number })[] = [];
  for (let k = cur - N - 12; k < cur; k++) arr.push({ k, ...cd(k) });
  { const x = cd(cur); let h = -1e9, l = 1e9; for (let s = 0; s <= 10; s++) { const v = pp(x, (f * s) / 10); h = Math.max(h, v); l = Math.min(l, v); }
    arr.push({ k: cur, o: x.o, c: pp(x, f), h: Math.max(h, x.o), l: Math.min(l, x.o), v: x.v * f }); }
  const vis = arr.filter((a) => X(a.k) >= x0 - sw);
  let lo = Math.min(...vis.map((a) => a.l)), hi = Math.max(...vis.map((a) => a.h));
  if (hi - lo < 14) { const m = (hi + lo) / 2; lo = m - 7; hi = m + 7; }
  const pd = (hi - lo) * 0.14; lo -= pd; hi += pd;
  if (!vr.set) { vr.lo = lo; vr.hi = hi; vr.set = true; vr.t = t; }
  const dt = clamp(t - vr.t, 0, 100), k = 1 - Math.pow(1 - 0.06, dt / 16.67); // same smoothing at any frame rate
  vr.t = t; vr.lo += (lo - vr.lo) * k; vr.hi += (hi - vr.hi) * k;
  const Y = (v: number) => py1 - ((v - vr.lo) / (vr.hi - vr.lo)) * (py1 - y0), P = (v: number) => PB + v * PK;

  // grid + price labels
  let grid = '', vgrid = ''; const labels: { y: number; txt: string }[] = [];
  const ps = (vr.hi - vr.lo) * PK, step = [1, 2, 5, 10, 20, 25, 50].find((s) => ps / s <= 6) || 50;
  for (let pr = Math.ceil(P(vr.lo) / step) * step; pr < P(vr.hi); pr += step) { const y = r2(Y((pr - PB) / PK)); grid += `M0 ${y}L${r2(x1)} ${y}`; labels.push({ y, txt: pr.toFixed(2) }); }
  for (let kk = cur - N - 2; kk <= cur; kk++) if (kk % 5 === 0) { const x = X(kk); if (x > x0 && x < x1) vgrid += `M${r2(x)} ${r2(y0)}L${r2(x)} ${r2(y1)}`; }

  // candles, wicks, volume, EMA (each colour is one path, so the screen draws only a few shapes per frame)
  let volUp = '', volDn = '', wickUp = '', wickDn = '', bodyUp = '', bodyDn = '', ema = '';
  const bw = sw * 0.58; let e = arr[0].c; const kk2 = 2 / 7; let started = false;
  arr.forEach((c) => {
    e = c.c * kk2 + e * (1 - kk2); const x = X(c.k); if (x < x0 - sw) return;
    ema += (started ? 'L' : 'M') + r2(x) + ' ' + r2(Y(e)); started = true;
    const up = c.c >= c.o, yo = Y(c.o), yc = Y(c.c), bt = Math.min(yo, yc), bh = Math.max(2, Math.abs(yo - yc)), vv = Math.max(1, (c.v / VM) * vh);
    const vol = `M${r2(x - bw / 2)} ${r2(y1 - vv)}h${r2(bw)}v${r2(vv)}h${r2(-bw)}z`, wick = `M${r2(x)} ${r2(Y(c.h))}L${r2(x)} ${r2(Y(c.l))}`, body = `M${r2(x - bw / 2)} ${r2(bt)}h${r2(bw)}v${r2(bh)}h${r2(-bw)}z`;
    if (up) { volUp += vol; wickUp += wick; bodyUp += body; } else { volDn += vol; wickDn += wick; bodyDn += body; }
  });

  const Lc = arr[arr.length - 1], up = Lc.c >= Lc.o, ly = r2(Y(Lc.c));

  // flowing lines on both sides of the logo (logo area only), light streaks travelling left -> right
  const cx = W / 2, zones = [[14, cx - 110 + 12], [cx + 110 - 12, W - 14]];
  const flow: { z: number; y: number; head: number; sl: number; lw: number; b: number }[] = []; let track = '';
  zones.forEach((z, zi) => {
    const a0 = z[0], len = z[1] - z[0];
    for (let i = 0; i < 10; i++) {
      const y = top + lh * (0.07 + i * 0.095), per = 2400 + (((i * 7 + zi * 3) % 5) * 280), ph = (t / per + i * 0.317 + zi * 0.5) % 1, sl = len * (0.55 + 0.14 * ((i * 3) % 4));
      const hue = 185 + 55 * Math.sin(t / 1700 + i * 0.65 + zi * 1.4), b = clamp(Math.round(((hue - 130) / 110) * (BUCKETS - 1)), 0, BUCKETS - 1);
      track += `M${r2(a0)} ${r2(y)}L${r2(a0 + len)} ${r2(y)}`;
      flow.push({ z: zi, y: r2(y), head: r2(a0 + ph * (len + sl)), sl: r2(sl), lw: i % 3 === 0 ? 2 : 1.4, b });
    }
  });

  return {
    ia, flowAl: ease((t - 900) / 900), x0, x1, sw, y0, y1, grid, vgrid, labels, volUp, volDn, wickUp, wickDn, bodyUp, bodyDn, ema,
    tag: { y: ly, txt: P(Lc.c).toFixed(2), col: up ? UP : DN, x: r2(X(cur)) }, flow, track, zones,
  };
}
