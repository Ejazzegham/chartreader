// One animated hero background per page (website only). Pure canvas drawing, no React:
// HeroFx.web.tsx owns the canvas and the shared animation loop and calls drawHero() for the pages that are on screen.
// Every page gets its own palette AND its own scene that relates to what the page is about
// (Analysis = candles + indicators, Killzones = radar sweep, Crypto = spinning coins, Settings = gears ...).
export type HeroKind =
  | 'brand' | 'analysis' | 'methods' | 'markets' | 'crypto' | 'sessions' | 'brokers' | 'prop' | 'community' | 'killzones'
  | 'news' | 'performance' | 'risk' | 'journal' | 'guide' | 'checklist' | 'settings' | 'about' | 'paper';

type Ctx = CanvasRenderingContext2D;
type Scene = (cx: Ctx, W: number, H: number, t: number, sy: number, st: any) => void;

const TAU = Math.PI * 2;
const wrap = (v: number, n: number) => ((v % n) + n) % n;
const cl = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const eo = (v: number) => 1 - Math.pow(1 - cl(v), 3);
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const hn = (n: number) => { let x = Math.imul(n | 0, 0x9E3779B1) ^ 0x85EBCA6B; x = Math.imul(x ^ (x >>> 15), 0x2C1B3C6D); x ^= x >>> 12; return (x >>> 0) / 4294967296; }; // stable pseudo-random from an index
export const makeRng = (seed: number) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// Each page: deep navy base (tinted to the page) + the colours of its glow.
export const PAL: Record<HeroKind, { bg: [string, string, string]; g: number[][] }> = {
  brand:       { bg: ['#0A1030', '#141245', '#1B1050'], g: [[59, 130, 246], [168, 85, 247], [236, 72, 153], [34, 211, 238]] },
  analysis:    { bg: ['#071533', '#0B2150', '#12306B'], g: [[59, 130, 246], [34, 211, 238]] },
  methods:     { bg: ['#0B1033', '#1A1050', '#2A1266'], g: [[139, 92, 246], [59, 130, 246]] },
  markets:     { bg: ['#06182E', '#07304A', '#083C5A'], g: [[34, 211, 238], [59, 130, 246]] },
  crypto:      { bg: ['#14102A', '#231436', '#33170F'], g: [[245, 158, 11], [168, 85, 247]] },
  sessions:    { bg: ['#0A1233', '#101A52', '#1C1A60'], g: [[99, 102, 241], [34, 211, 238]] },
  brokers:     { bg: ['#071A2E', '#0A2A44', '#0B3A52'], g: [[20, 184, 166], [59, 130, 246]] },
  prop:        { bg: ['#0D1230', '#17163F', '#2A1D3A'], g: [[245, 180, 60], [139, 92, 246]] },
  community:   { bg: ['#0C1034', '#1A1252', '#2B1260'], g: [[236, 72, 153], [139, 92, 246]] },
  killzones:   { bg: ['#071225', '#0A1B38', '#0B2A3E'], g: [[34, 211, 238], [16, 185, 129]] },
  news:        { bg: ['#10132A', '#1A1530', '#2A1424'], g: [[244, 63, 94], [59, 130, 246]] },
  performance: { bg: ['#071A24', '#08283A', '#0A3446'], g: [[16, 185, 129], [34, 211, 238]] },
  risk:        { bg: ['#0D1230', '#1B1238', '#2E1330'], g: [[244, 63, 94], [16, 185, 129]] },
  journal:     { bg: ['#0D1530', '#141C48', '#1D2058'], g: [[96, 165, 250], [167, 139, 250]] },
  guide:       { bg: ['#071733', '#0B2552', '#123566'], g: [[56, 189, 248], [99, 102, 241]] },
  checklist:   { bg: ['#081A2C', '#0A2A3C', '#0C3A44'], g: [[16, 185, 129], [56, 189, 248]] },
  settings:    { bg: ['#0C1226', '#141C3A', '#1E2848'], g: [[100, 116, 139], [59, 130, 246]] },
  about:       { bg: ['#080C26', '#120E40', '#1E0F52'], g: [[139, 92, 246], [236, 72, 153]] },
  paper:       { bg: ['#071533', '#0A1E4A', '#0F2A5E'], g: [[59, 130, 246], [16, 185, 129]] },
};
export const heroKind = (k?: string): HeroKind => (k && (PAL as any)[k] ? (k as HeroKind) : 'brand');

// ------------------------------------------------------------------ helpers
const rr = (cx: Ctx, x: number, y: number, w: number, h: number, r: number) => {
  r = Math.min(r, w / 2, h / 2);
  cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath();
};
const glow = (cx: Ctx, x: number, y: number, r: number, c: number[], a: number) => {
  const g = cx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${c},${a})`); g.addColorStop(1, `rgba(${c},0)`);
  cx.fillStyle = g; cx.fillRect(x - r, y - r, r * 2, r * 2);
};
const FONT = 'Inter, system-ui, -apple-system, Segoe UI, sans-serif';
const GREEN = '52,211,153', RED = '251,113,133';

type Ser = { s: number[]; w1: number[]; w2: number[]; n: number };
const mkSeries = (r: () => number, n: number): Ser => { // a looping price series
  const p1 = r() * TAU, p2 = r() * TAU, s: number[] = [], w1: number[] = [], w2: number[] = [];
  for (let i = 0; i < n; i++) { s.push(Math.sin(TAU * 3 * i / n + p1) * 0.55 + Math.sin(TAU * 9 * i / n + p2) * 0.22 + (r() - 0.5) * 0.32); w1.push(r() * 0.1); w2.push(r() * 0.1); }
  return { s, w1, w2, n };
};
function candleRun(cx: Ctx, S: Ser, off: number, sp: number, bw: number, yOf: (v: number) => number, alpha: number, xMax: number, cb?: (k: number, x: number, up: boolean, yHi: number, yLo: number) => void) {
  const first = Math.floor(off / sp), frac = off - first * sp, cnt = Math.ceil(xMax / sp) + 2;
  for (let i = -1; i < cnt; i++) {
    const x = i * sp - frac; if (x > xMax) break;
    const k = wrap(first + i, S.n), o = S.s[wrap(k - 1, S.n)], c = S.s[k], up = c >= o;
    const hi = Math.max(o, c) + S.w1[k], lo = Math.min(o, c) - S.w2[k], col = up ? GREEN : RED;
    cx.strokeStyle = cx.fillStyle = `rgba(${col},${alpha})`; cx.lineWidth = 1;
    cx.beginPath(); cx.moveTo(x + bw / 2, yOf(hi)); cx.lineTo(x + bw / 2, yOf(lo)); cx.stroke();
    const yt = yOf(Math.max(o, c)); cx.fillRect(x, yt, bw, Math.max(2, yOf(Math.min(o, c)) - yt));
    if (cb) cb(k, x, up, yOf(hi), yOf(lo));
  }
}

// ------------------------------------------------------------------ scenes
// Home / sign-in panel / call-to-action: the original aurora with flowing waves and a faint candle stream.
const brand: Scene = (cx, W, H, t, sy, st) => {
  for (let i = 0; i < 5; i++) {
    cx.beginPath();
    const base = H * (0.25 + i * 0.14), amp = 14 + i * 6, f = 0.006 + i * 0.001;
    for (let x = 0; x <= W; x += 10) { const y = base + Math.sin(x * f + t * 0.0007 * (1 + i * 0.2) + sy * 0.004) * amp + Math.sin(x * f * 2.2 - t * 0.0005 + i) * amp * 0.4; x ? cx.lineTo(x, y) : cx.moveTo(x, y); }
    cx.strokeStyle = `rgba(${i % 2 ? '244,114,182' : '147,197,253'},${0.26 + i * 0.04})`; cx.lineWidth = 1.5; cx.stroke();
  }
  const S: Ser = st.sr = st.sr || mkSeries(st.r, 300);
  candleRun(cx, S, t * 0.018 + sy * 0.4, 16, 8, (v) => H * (0.84 - v * 0.2), 0.3, W);
};

// Analysis: live candles, two moving averages, support / resistance and a gliding crosshair with a price tag.
const analysis: Scene = (cx, W, H, t, sy, st) => {
  const S: Ser = st.sr = st.sr || mkSeries(st.r, 360), sp = 18, bw = 9, off = t * 0.011 + sy * 0.3, yOf = (v: number) => H * (0.5 - v * 0.3);
  cx.strokeStyle = 'rgba(147,197,253,0.07)'; cx.lineWidth = 1;
  for (let i = 1; i < 5; i++) { cx.beginPath(); cx.moveTo(0, H * i / 5); cx.lineTo(W, H * i / 5); cx.stroke(); }
  cx.setLineDash([7, 7]);
  ([[0.2, GREEN], [0.8, RED]] as [number, string][]).forEach(([f, c], i) => { const y = H * f + Math.sin(t * 0.001 + i) * 2; cx.strokeStyle = `rgba(${c},0.3)`; cx.beginPath(); cx.moveTo(0, y); cx.lineTo(W, y); cx.stroke(); });
  cx.setLineDash([]);
  candleRun(cx, S, off, sp, bw, yOf, 0.42, W);
  const first = Math.floor(off / sp), frac = off - first * sp;
  const ma = (len: number, col: string, a: number) => {
    cx.beginPath(); let m = 0;
    for (let i = 0; i * sp - frac <= W + sp; i++) { let sum = 0; for (let j = 0; j < len; j++) sum += S.s[wrap(first + i - j, S.n)]; const x = i * sp - frac + bw / 2, y = yOf(sum / len); m++ ? cx.lineTo(x, y) : cx.moveTo(x, y); }
    cx.strokeStyle = `rgba(${col},${a})`; cx.lineWidth = 1.8; cx.stroke();
  };
  ma(8, '34,211,238', 0.8); ma(21, '244,114,182', 0.7);
  const xc = W * 0.68 + Math.sin(t * 0.0005) * W * 0.13, i = Math.round((xc + frac) / sp), k = wrap(first + i, S.n), xs = i * sp - frac + bw / 2, ys = yOf(S.s[k]);
  cx.setLineDash([4, 4]); cx.strokeStyle = 'rgba(255,255,255,0.28)'; cx.lineWidth = 1;
  cx.beginPath(); cx.moveTo(xs, 0); cx.lineTo(xs, H); cx.moveTo(0, ys); cx.lineTo(W, ys); cx.stroke(); cx.setLineDash([]);
  rr(cx, W - 64, ys - 9, 58, 18, 4); cx.fillStyle = 'rgba(59,130,246,0.92)'; cx.fill();
  cx.fillStyle = '#fff'; cx.font = `600 10.5px ${FONT}`; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText((1.0842 + S.s[k] * 0.012).toFixed(4), W - 35, ys + 0.5);
  glow(cx, xs, ys, 22, [255, 255, 255], 0.25);
};

// Analysis methods: a web of connected strategy nodes with pulses travelling between them.
const methods: Scene = (cx, W, H, t, _sy, st) => {
  const r = st.r, nodes = st.n = st.n || Array.from({ length: 46 }, () => ({ bx: 0.28 + r() * 0.74, by: 0.08 + r() * 0.84, ax: 10 + r() * 28, ay: 8 + r() * 18, fx: 0.0002 + r() * 0.0005, fy: 0.0002 + r() * 0.0005, px: r() * TAU, py: r() * TAU, s: 2 + r() * 2.4, d: r() < 0.3 }));
  const N = Math.min(46, Math.max(20, Math.round(W / 26))), P = nodes.slice(0, N).map((n: any) => ({ x: n.bx * W + Math.sin(t * n.fx + n.px) * n.ax, y: n.by * H + Math.cos(t * n.fy + n.py) * n.ay, s: n.s, d: n.d })), maxD = Math.max(125, W * 0.12);
  cx.lineWidth = 1;
  for (let a = 0; a < N; a++) for (let b = a + 1; b < N; b++) {
    const d = Math.hypot(P[a].x - P[b].x, P[a].y - P[b].y); if (d > maxD) continue;
    cx.strokeStyle = `rgba(167,139,250,${0.34 * (1 - d / maxD)})`; cx.beginPath(); cx.moveTo(P[a].x, P[a].y); cx.lineTo(P[b].x, P[b].y); cx.stroke();
    if ((a + b) % 4 === 0) { const p = wrap(t * 0.0004 + a * 0.37, 1); glow(cx, P[a].x + (P[b].x - P[a].x) * p, P[a].y + (P[b].y - P[a].y) * p, 7, [196, 181, 253], 0.9); }
  }
  P.forEach((p: any, i: number) => {
    glow(cx, p.x, p.y, 13, i % 2 ? [96, 165, 250] : [196, 181, 253], 0.35);
    cx.fillStyle = i % 2 ? 'rgba(147,197,253,0.95)' : 'rgba(221,214,254,0.95)';
    if (p.d) { cx.beginPath(); cx.moveTo(p.x, p.y - p.s * 1.5); cx.lineTo(p.x + p.s * 1.5, p.y); cx.lineTo(p.x, p.y + p.s * 1.5); cx.lineTo(p.x - p.s * 1.5, p.y); cx.fill(); }
    else { cx.beginPath(); cx.arc(p.x, p.y, p.s, 0, TAU); cx.fill(); }
  });
};

// Markets: a dot grid rippling like a live price map, with arcs and packets running between market hubs.
const markets: Scene = (cx, W, H, t) => {
  const sp = 20, c1x = W * 0.78 + Math.sin(t * 0.0004) * W * 0.1, c1y = H * 0.5, c2x = W * 0.5 + Math.cos(t * 0.0003) * W * 0.1, c2y = H * 0.4;
  for (let gx = sp / 2; gx < W; gx += sp) for (let gy = sp / 2; gy < H; gy += sp) {
    const d1 = Math.hypot(gx - c1x, gy - c1y), d2 = Math.hypot(gx - c2x, gy - c2y);
    const w = cl(Math.max(0, Math.sin(d1 * 0.04 - t * 0.0022)) * Math.max(0, 1 - d1 / (W * 0.5)) + Math.max(0, Math.sin(d2 * 0.05 - t * 0.0018)) * 0.5 * Math.max(0, 1 - d2 / (W * 0.4)));
    cx.fillStyle = `rgba(103,232,249,${0.07 + w * 0.6})`; cx.beginPath(); cx.arc(gx, gy, 1 + w * 1.8, 0, TAU); cx.fill();
  }
  const hubs = [[0.5, 0.7], [0.62, 0.3], [0.74, 0.62], [0.86, 0.25], [0.95, 0.68]].map((h) => [h[0] * W, h[1] * H]);
  for (let i = 0; i < hubs.length - 1; i++) {
    const [ax, ay] = hubs[i], [bx, by] = hubs[i + 1], mx = (ax + bx) / 2, my = Math.min(ay, by) - H * 0.38;
    cx.strokeStyle = 'rgba(34,211,238,0.34)'; cx.lineWidth = 1.2; cx.beginPath(); cx.moveTo(ax, ay); cx.quadraticCurveTo(mx, my, bx, by); cx.stroke();
    const p = wrap(t * 0.00045 + i * 0.27, 1), q = 1 - p;
    glow(cx, q * q * ax + 2 * q * p * mx + p * p * bx, q * q * ay + 2 * q * p * my + p * p * by, 11, [165, 243, 252], 0.95);
  }
  hubs.forEach(([x, y], i) => {
    const p = wrap(t * 0.0006 + i * 0.2, 1);
    cx.strokeStyle = `rgba(103,232,249,${0.5 * (1 - p)})`; cx.lineWidth = 1.2; cx.beginPath(); cx.arc(x, y, 4 + p * 16, 0, TAU); cx.stroke();
    cx.fillStyle = '#A5F3FC'; cx.beginPath(); cx.arc(x, y, 3.2, 0, TAU); cx.fill();
  });
};

// Crypto: a hex lattice with a few cells lighting up, and golden coins spinning as they float up.
const crypto: Scene = (cx, W, H, t, sy, st) => {
  const R = 26, hw = R * Math.sqrt(3), r = st.r;
  cx.strokeStyle = 'rgba(251,191,36,0.09)'; cx.lineWidth = 1; cx.beginPath();
  for (let row = -1; row * R * 1.5 < H + R; row++) for (let col = -1; col * hw < W + hw; col++) {
    const x = col * hw + (row & 1 ? hw / 2 : 0), y = row * R * 1.5;
    for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * TAU / 6, px = x + R * Math.cos(a), py = y + R * Math.sin(a); k ? cx.lineTo(px, py) : cx.moveTo(px, py); }
    cx.closePath();
  }
  cx.stroke();
  for (let i = 0; i < 7; i++) { // cells that light up
    const a = Math.max(0, Math.sin(t * 0.0009 + i * 2.1)), cxp = (0.45 + hn(i * 7) * 0.5) * W, cyp = hn(i * 13 + 1) * H;
    cx.fillStyle = `rgba(245,158,11,${a * 0.14})`; cx.beginPath();
    for (let k = 0; k < 6; k++) { const an = Math.PI / 6 + k * TAU / 6; k ? cx.lineTo(cxp + R * Math.cos(an), cyp + R * Math.sin(an)) : cx.moveTo(cxp + R * Math.cos(an), cyp + R * Math.sin(an)); }
    cx.fill();
  }
  const coins = st.cn = st.cn || Array.from({ length: 9 }, () => ({ x: 0.42 + r() * 0.56, sp: 0.00005 + r() * 0.00007, ph: r(), r: 11 + r() * 15, rs: 0.0012 + r() * 0.002, wob: 8 + r() * 14 }));
  coins.forEach((c: any, i: number) => {
    const p = wrap(t * c.sp + c.ph + sy * 0.0004, 1), x = c.x * W + Math.sin(t * 0.0006 + i) * c.wob, y = H * (1.12 - p * 1.3), sx = Math.max(0.12, Math.abs(Math.cos(t * c.rs + i)));
    const a = Math.sin(p * Math.PI);
    glow(cx, x, y, c.r * 2.2, [245, 158, 11], 0.3 * a);
    const g = cx.createLinearGradient(x - c.r, y - c.r, x + c.r, y + c.r); g.addColorStop(0, `rgba(253,224,71,${0.8 * a})`); g.addColorStop(1, `rgba(217,119,6,${0.8 * a})`);
    cx.fillStyle = g; cx.beginPath(); cx.ellipse(x, y, c.r * sx, c.r, 0, 0, TAU); cx.fill();
    cx.strokeStyle = `rgba(255,251,235,${0.65 * a})`; cx.lineWidth = 1.2; cx.beginPath(); cx.ellipse(x, y, c.r * sx * 0.72, c.r * 0.72, 0, 0, TAU); cx.stroke();
    if (sx > 0.45) { cx.strokeStyle = `rgba(255,251,235,${0.7 * a})`; cx.lineWidth = 1.6; cx.beginPath(); cx.moveTo(x - c.r * sx * 0.12, y - c.r * 0.38); cx.lineTo(x - c.r * sx * 0.12, y + c.r * 0.38); cx.stroke(); }
  });
};

// Forex hours: the four sessions as bars sliding across a 24-hour clock, with a "now" line.
const sessions: Scene = (cx, W, H, t, sy) => {
  const span = Math.max(W * 1.5, 900), hp = span / 24, shift = t * 0.012 + sy * 0.3, xNow = W * 0.7;
  cx.strokeStyle = 'rgba(165,180,252,0.08)'; cx.lineWidth = 1;
  for (let h = 0; h <= 24 * 2; h++) { const x = wrap(h * hp - shift, span) - 0; for (let k = -1; k < 2; k++) { const xx = x + k * span; if (xx < -2 || xx > W + 2) continue; cx.beginPath(); cx.moveTo(xx, 0); cx.lineTo(xx, H); cx.stroke(); } }
  const S = [['SYDNEY', 22, 31, '168,85,247'], ['TOKYO', 24, 33, '236,72,153'], ['LONDON', 8, 17, '59,130,246'], ['NEW YORK', 13, 22, '16,185,129']] as [string, number, number, string][];
  S.forEach(([name, a, b, c], i) => {
    const y = H * (0.17 + i * 0.2), h = Math.min(26, H * 0.12), x0 = wrap(a * hp - shift, span) - span, w = (b - a) * hp;
    for (let k = 0; k < 3; k++) {
      const x = x0 + k * span; if (x > W || x + w < 0) continue;
      const on = xNow >= x && xNow <= x + w;
      rr(cx, x, y, w, h, h / 2); cx.fillStyle = `rgba(${c},${on ? 0.5 : 0.22})`; cx.fill(); cx.strokeStyle = `rgba(${c},${on ? 0.95 : 0.5})`; cx.lineWidth = 1; cx.stroke();
      cx.fillStyle = `rgba(255,255,255,${on ? 0.95 : 0.55})`; cx.font = `700 9.5px ${FONT}`; cx.textAlign = 'left'; cx.textBaseline = 'middle';
      cx.fillText(name, Math.max(x + 12, 12), y + h / 2 + 0.5);
    }
  });
  glow(cx, xNow, H * 0.5, H * 0.7, [165, 243, 252], 0.15);
  cx.strokeStyle = 'rgba(165,243,252,0.85)'; cx.lineWidth = 1.5; cx.beginPath(); cx.moveTo(xNow, 0); cx.lineTo(xNow, H); cx.stroke();
  cx.fillStyle = '#A5F3FC'; cx.beginPath(); cx.arc(xNow, H * 0.08, 4, 0, TAU); cx.fill();
};

// Brokers: a skyline of glass towers with office windows that flicker, plus small trust badges rising.
const brokers: Scene = (cx, W, H, t) => {
  const bw = 26, gap = 8, x0 = W * 0.36, n = Math.ceil((W - x0) / (bw + gap)) + 1;
  for (let i = 0; i < n; i++) {
    const x = x0 + i * (bw + gap), base = 0.34 + hn(i * 5 + 3) * 0.44, h = H * (base + 0.04 * Math.sin(t * 0.0009 + i)), y = H - h;
    const g = cx.createLinearGradient(0, y, 0, H); g.addColorStop(0, 'rgba(45,212,191,0.24)'); g.addColorStop(1, 'rgba(59,130,246,0.06)');
    cx.fillStyle = g; cx.fillRect(x, y, bw, h); cx.strokeStyle = 'rgba(94,234,212,0.3)'; cx.lineWidth = 1; cx.strokeRect(x + 0.5, y + 0.5, bw - 1, h);
    for (let wy = y + 9; wy < H - 6; wy += 11) for (let wx = x + 5; wx < x + bw - 5; wx += 8) {
      const lit = hn((wx * 31 + wy * 17 + Math.floor(t / 1100) * 7 + i) | 0) > 0.62;
      cx.fillStyle = lit ? 'rgba(253,230,138,0.7)' : 'rgba(165,243,252,0.1)'; cx.fillRect(wx, wy, 3.5, 4.5);
    }
  }
  for (let i = 0; i < 4; i++) { // trust badges floating up
    const p = wrap(t * 0.00012 + i * 0.25, 1), x = W * (0.5 + i * 0.13), y = H * (0.9 - p * 0.8), a = Math.sin(p * Math.PI);
    cx.strokeStyle = `rgba(94,234,212,${0.7 * a})`; cx.lineWidth = 1.6; cx.beginPath(); cx.arc(x, y, 8, 0, TAU); cx.stroke();
    cx.beginPath(); cx.moveTo(x - 3.5, y); cx.lineTo(x - 1, y + 3); cx.lineTo(x + 4, y - 3); cx.stroke();
  }
};

// Prop firms: an equity curve climbing through the funding stages, each level lighting up in gold.
const prop: Scene = (cx, W, H, t, _sy, st) => {
  const N = 90, pts: number[] = st.pts = st.pts || (() => { const r = st.r, a: number[] = []; let v = 0; for (let i = 0; i < N; i++) { v += 0.9 / N + (r() - 0.42) * 0.07; a.push(cl(v, 0.02, 1)); } const m = a[N - 1]; return a.map((x) => cl(x / m, 0, 1) * 0.95); })();
  const x0 = W * 0.4, x1 = W * 0.97, yOf = (v: number) => H * (0.88 - 0.72 * v), p = (t * 0.00013) % 1.2, fade = p < 1 ? 1 : cl(1 - (p - 1) / 0.2), upto = cl(p) * (N - 1);
  [0.32, 0.64, 0.95].forEach((lv, i) => {
    cx.setLineDash([6, 6]); cx.strokeStyle = `rgba(251,191,36,${0.22 * fade})`; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(x0 - 30, yOf(lv)); cx.lineTo(x1 + 20, yOf(lv)); cx.stroke(); cx.setLineDash([]);
    cx.fillStyle = `rgba(253,230,138,${0.6 * fade})`; cx.font = `700 9px ${FONT}`; cx.textAlign = 'left'; cx.textBaseline = 'bottom'; cx.fillText('PHASE ' + (i + 1), x0 - 28, yOf(lv) - 3);
  });
  cx.beginPath(); cx.moveTo(x0, H);
  for (let i = 0; i <= upto; i++) cx.lineTo(x0 + (x1 - x0) * i / (N - 1), yOf(pts[i]));
  const hx = x0 + (x1 - x0) * upto / (N - 1), hy = yOf(pts[Math.floor(upto)]);
  const ar = cx.createLinearGradient(0, 0, 0, H); ar.addColorStop(0, `rgba(251,191,36,${0.28 * fade})`); ar.addColorStop(1, 'rgba(251,191,36,0)');
  cx.lineTo(hx, H); cx.closePath(); cx.fillStyle = ar; cx.fill();
  cx.beginPath(); for (let i = 0; i <= upto; i++) { const x = x0 + (x1 - x0) * i / (N - 1), y = yOf(pts[i]); i ? cx.lineTo(x, y) : cx.moveTo(x, y); }
  cx.strokeStyle = `rgba(253,224,71,${0.95 * fade})`; cx.lineWidth = 2.2; cx.stroke();
  [0.32, 0.64, 0.95].forEach((lv) => { // gold diamonds once a stage is passed
    const idx = pts.findIndex((v) => v >= lv); if (idx < 0 || upto < idx) return;
    const x = x0 + (x1 - x0) * idx / (N - 1), y = yOf(lv), age = (upto - idx) / 14, ring = cl(age);
    cx.strokeStyle = `rgba(253,224,71,${0.6 * (1 - ring) * fade})`; cx.lineWidth = 1.4; cx.beginPath(); cx.arc(x, y, 5 + ring * 20, 0, TAU); cx.stroke();
    cx.fillStyle = `rgba(254,243,199,${fade})`; cx.beginPath(); cx.moveTo(x, y - 6); cx.lineTo(x + 6, y); cx.lineTo(x, y + 6); cx.lineTo(x - 6, y); cx.fill();
  });
  if (fade > 0.02) { glow(cx, hx, hy, 26, [253, 224, 71], 0.7 * fade); cx.fillStyle = `rgba(255,255,255,${fade})`; cx.beginPath(); cx.arc(hx, hy, 3.2, 0, TAU); cx.fill(); }
};

// Community: traders as avatars joined by a live network, with chat bubbles popping up above them.
const community: Scene = (cx, W, H, t, _sy, st) => {
  const r = st.r, av = st.av = st.av || Array.from({ length: 16 }, () => ({ bx: 0.34 + r() * 0.64, by: 0.14 + r() * 0.72, ax: 8 + r() * 18, ay: 6 + r() * 12, fx: 0.0003 + r() * 0.0005, fy: 0.0003 + r() * 0.0005, px: r() * TAU, py: r() * TAU, s: 8 + r() * 5, c: r() < 0.5 ? [236, 72, 153] : [139, 92, 246] }));
  const P = av.map((a: any) => ({ x: a.bx * W + Math.sin(t * a.fx + a.px) * a.ax, y: a.by * H + Math.cos(t * a.fy + a.py) * a.ay, s: a.s, c: a.c })), maxD = Math.max(120, W * 0.11);
  cx.lineWidth = 1;
  for (let a = 0; a < P.length; a++) for (let b = a + 1; b < P.length; b++) { const d = Math.hypot(P[a].x - P[b].x, P[a].y - P[b].y); if (d < maxD) { cx.strokeStyle = `rgba(244,114,182,${0.3 * (1 - d / maxD)})`; cx.beginPath(); cx.moveTo(P[a].x, P[a].y); cx.lineTo(P[b].x, P[b].y); cx.stroke(); } }
  P.forEach((p: any) => {
    glow(cx, p.x, p.y, p.s * 2.4, p.c, 0.35);
    cx.fillStyle = `rgba(${p.c},0.5)`; cx.beginPath(); cx.arc(p.x, p.y, p.s, 0, TAU); cx.fill();
    cx.strokeStyle = 'rgba(255,255,255,0.65)'; cx.lineWidth = 1.2; cx.stroke();
    cx.fillStyle = 'rgba(255,255,255,0.85)'; cx.beginPath(); cx.arc(p.x, p.y - p.s * 0.22, p.s * 0.3, 0, TAU); cx.fill(); // head
    cx.beginPath(); cx.arc(p.x, p.y + p.s * 0.62, p.s * 0.52, Math.PI, 0); cx.fill(); // shoulders (clipped by the circle look)
  });
  for (let j = 0; j < 4; j++) { // chat bubbles
    const cyc = 4600, ph = wrap(t + j * 1150, cyc) / cyc, who = P[(Math.floor((t + j * 1150) / cyc) * 5 + j * 3) % P.length], a = Math.sin(ph * Math.PI), bx = who.x + 8, by = who.y - who.s - 26 - ph * 14;
    cx.globalAlpha = cl(a * 1.6); rr(cx, bx, by, 44, 20, 10); cx.fillStyle = 'rgba(255,255,255,0.92)'; cx.fill();
    cx.beginPath(); cx.moveTo(bx + 8, by + 19); cx.lineTo(bx + 4, by + 26); cx.lineTo(bx + 15, by + 19); cx.fill();
    for (let d = 0; d < 3; d++) { cx.fillStyle = 'rgba(190,24,93,0.85)'; cx.beginPath(); cx.arc(bx + 13 + d * 9, by + 10 - Math.max(0, Math.sin(t * 0.008 - d * 0.9)) * 2.5, 2.2, 0, TAU); cx.fill(); }
    cx.globalAlpha = 1;
  }
};

// Killzones: a radar. The sweep passes the London, New York and Silver Bullet windows and lights each one.
const killzones: Scene = (cx, W, H, t) => {
  const x = W * 0.8, y = H * 0.55, R = H * 0.92, sw = wrap(t * 0.0007, TAU);
  cx.lineWidth = 1;
  [0.3, 0.6, 1].forEach((k) => { cx.strokeStyle = 'rgba(103,232,249,0.2)'; cx.beginPath(); cx.arc(x, y, R * k, 0, TAU); cx.stroke(); });
  cx.strokeStyle = 'rgba(103,232,249,0.14)'; cx.beginPath(); cx.moveTo(x - R, y); cx.lineTo(x + R, y); cx.moveTo(x, y - R); cx.lineTo(x, y + R); cx.stroke();
  for (let i = 0; i < 48; i++) { const a = i * TAU / 48, l = i % 4 ? 5 : 10; cx.strokeStyle = 'rgba(165,243,252,0.35)'; cx.beginPath(); cx.moveTo(x + Math.cos(a) * R, y + Math.sin(a) * R); cx.lineTo(x + Math.cos(a) * (R - l), y + Math.sin(a) * (R - l)); cx.stroke(); }
  for (let i = 0; i < 42; i++) { // sweep trail
    const a0 = sw - i * 0.028; cx.fillStyle = `rgba(34,211,238,${0.2 * (1 - i / 42)})`; cx.beginPath(); cx.moveTo(x, y); cx.arc(x, y, R, a0 - 0.03, a0 + 0.001); cx.closePath(); cx.fill();
  }
  cx.strokeStyle = 'rgba(165,243,252,0.95)'; cx.lineWidth = 1.8; cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x + Math.cos(sw) * R, y + Math.sin(sw) * R); cx.stroke();
  ([[3.3, 4.3, '34,211,238'], [4.45, 5.55, '52,211,153'], [5.7, 6.1, '251,191,36']] as [number, number, string][]).forEach(([a, b, c]) => { // the windows
    const inside = sw >= a && sw <= b, lit = inside ? 1 : cl(1 - wrap(sw - b, TAU) / 2.2) * 0.6;
    cx.strokeStyle = `rgba(${c},${0.35 + lit * 0.6})`; cx.lineWidth = 6; cx.lineCap = 'round'; cx.beginPath(); cx.arc(x, y, R * 0.82, a, b); cx.stroke(); cx.lineCap = 'butt';
  });
  glow(cx, x, y, 14, [165, 243, 252], 0.9);
};

// News: headlines streaming past in rows, an occasional red "breaking" line, and a pulsing live dot.
const news: Scene = (cx, W, H, t, sy, st) => {
  const rows = st.rw = st.rw || Array.from({ length: 8 }, (_, ri) => { const r = makeRng(ri * 977 + 11), seg: { w: number; x: number; hot: boolean }[] = []; let x = 0; while (x < 1700) { const w = 34 + r() * 110; seg.push({ w, x, hot: r() < 0.07 }); x += w + 12 + r() * 26; } return { seg, L: x, sp: 0.02 + r() * 0.035, y: 0.1 + ri * 0.112, a: 0.1 + r() * 0.1 }; });
  rows.forEach((row: any, ri: number) => {
    const off = wrap(t * row.sp + sy * (0.5 + ri * 0.1), row.L), y = H * row.y;
    row.seg.forEach((s: any) => {
      for (let k = 0; k < 2; k++) {
        const x = s.x - off + k * row.L; if (x > W || x + s.w < 0) continue;
        const hot = s.hot, pulse = 0.55 + 0.45 * Math.sin(t * 0.006 + ri);
        rr(cx, x, y, s.w, 7, 3.5); cx.fillStyle = hot ? `rgba(251,113,133,${0.45 + pulse * 0.4})` : `rgba(226,232,240,${row.a})`; cx.fill();
      }
    });
  });
  const lx = W * 0.92, ly = H * 0.5;
  for (let k = 0; k < 3; k++) { const p = wrap(t * 0.0006 + k / 3, 1); cx.strokeStyle = `rgba(251,113,133,${0.7 * (1 - p)})`; cx.lineWidth = 1.5; cx.beginPath(); cx.arc(lx, ly, 6 + p * 34, 0, TAU); cx.stroke(); }
  glow(cx, lx, ly, 22, [244, 63, 94], 0.7); cx.fillStyle = '#FB7185'; cx.beginPath(); cx.arc(lx, ly, 5, 0, TAU); cx.fill();
};

// Performance: monthly result bars growing in, a cumulative line over them and a win-rate ring filling up.
const performance: Scene = (cx, W, H, t, _sy, st) => {
  const vals: number[] = st.v = st.v || (() => { const r = st.r; return Array.from({ length: 12 }, () => (r() < 0.22 ? -(0.1 + r() * 0.3) : 0.15 + r() * 0.85)); })();
  const cyc = (t % 8000) / 8000, grow = cl(cyc / 0.34), fade = cyc > 0.88 ? cl((1 - cyc) / 0.12) : 1, x0 = W * 0.34, x1 = W * 0.8, bw = Math.min(20, (x1 - x0) / 12 * 0.62), base = H * 0.66;
  cx.strokeStyle = 'rgba(167,243,208,0.1)'; cx.lineWidth = 1; for (let i = 1; i < 5; i++) { cx.beginPath(); cx.moveTo(x0 - 16, H * i / 5); cx.lineTo(x1 + 8, H * i / 5); cx.stroke(); }
  let cum = 0; const line: number[][] = [];
  vals.forEach((v, i) => {
    const g = eo(grow * 1.7 - i * 0.07), x = x0 + (x1 - x0) * i / 11 - bw / 2, h = v * H * 0.34 * g;
    cx.fillStyle = v >= 0 ? `rgba(${GREEN},${0.5 * fade})` : `rgba(${RED},${0.5 * fade})`;
    rr(cx, x, v >= 0 ? base - h : base, bw, Math.max(2, Math.abs(h)), 3); cx.fill();
    cum += v; line.push([x + bw / 2, cum * g]);
  });
  const mx = Math.max(...vals.map((_, i) => vals.slice(0, i + 1).reduce((a, b) => a + b, 0)));
  cx.beginPath(); line.forEach(([x, c], i) => { const y = base - (c / mx) * H * 0.52; i ? cx.lineTo(x, y) : cx.moveTo(x, y); });
  cx.strokeStyle = `rgba(165,243,252,${0.9 * fade})`; cx.lineWidth = 2; cx.stroke();
  const [lx, lc] = line[11], ly = base - (lc / mx) * H * 0.52; glow(cx, lx, ly, 18, [165, 243, 252], 0.7 * fade);
  const rx = W * 0.915, ry = H * 0.5, rad = Math.min(H * 0.26, 48), win = 0.68 * eo(grow * 1.3);
  cx.lineWidth = 7; cx.lineCap = 'round'; cx.strokeStyle = `rgba(255,255,255,${0.1 * fade})`; cx.beginPath(); cx.arc(rx, ry, rad, 0, TAU); cx.stroke();
  cx.strokeStyle = `rgba(${GREEN},${0.95 * fade})`; cx.beginPath(); cx.arc(rx, ry, rad, -Math.PI / 2, -Math.PI / 2 + TAU * win); cx.stroke(); cx.lineCap = 'butt';
  cx.fillStyle = `rgba(255,255,255,${0.9 * fade})`; cx.font = `700 15px ${FONT}`; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(Math.round(win * 100) + '%', rx, ry);
};

// Risk & TP planner: a position tool. A price path runs from entry to take-profit or stop-loss, and the zone it hits flashes.
const risk: Scene = (cx, W, H, t) => {
  const x0 = W * 0.5, x1 = W * 0.96, ey = H * 0.55, tpY = H * 0.16, slY = H * 0.82, T = 6200, c = Math.floor(t / T), p = (t % T) / T, win = c % 3 !== 2, u = cl(p / 0.72), fade = p > 0.92 ? cl((1 - p) / 0.08) : 1, hit = p >= 0.72;
  const fz = hit ? 0.1 + 0.12 * Math.sin(p * 40) ** 2 : 0.1;
  cx.fillStyle = `rgba(${GREEN},${win && hit ? fz + 0.06 : 0.1})`; cx.fillRect(x0, tpY, x1 - x0, ey - tpY);
  cx.fillStyle = `rgba(${RED},${!win && hit ? fz + 0.06 : 0.1})`; cx.fillRect(x0, ey, x1 - x0, slY - ey);
  cx.strokeStyle = `rgba(${GREEN},0.55)`; cx.lineWidth = 1.2; cx.beginPath(); cx.moveTo(x0, tpY); cx.lineTo(x1, tpY); cx.stroke();
  cx.strokeStyle = `rgba(${RED},0.55)`; cx.beginPath(); cx.moveTo(x0, slY); cx.lineTo(x1, slY); cx.stroke();
  cx.setLineDash([6, 5]); cx.strokeStyle = 'rgba(255,255,255,0.55)'; cx.beginPath(); cx.moveTo(x0, ey); cx.lineTo(x1, ey); cx.stroke(); cx.setLineDash([]);
  cx.font = `700 9.5px ${FONT}`; cx.textBaseline = 'middle'; cx.textAlign = 'left';
  cx.fillStyle = `rgba(${GREEN},0.95)`; cx.fillText('TP', x0 + 8, tpY + 11); cx.fillStyle = `rgba(${RED},0.95)`; cx.fillText('SL', x0 + 8, slY - 11); cx.fillStyle = 'rgba(255,255,255,0.8)'; cx.fillText('ENTRY', x0 + 8, ey - 9);
  cx.textAlign = 'right'; cx.fillStyle = 'rgba(255,255,255,0.85)'; cx.fillText('R : R  1 : 2', x1 - 8, ey - 9);
  const target = win ? tpY : slY, f = (v: number) => ey + (target - ey) * Math.pow(v, 1.5) * 0.97 + Math.sin(v * 17 + c * 3) * H * 0.04 * (1 - v * 0.5);
  cx.beginPath(); for (let i = 0; i <= 80; i++) { const v = u * i / 80, x = x0 + (x1 - x0) * 0.94 * v, y = f(v); i ? cx.lineTo(x, y) : cx.moveTo(x, y); }
  cx.strokeStyle = `rgba(255,255,255,${0.92 * fade})`; cx.lineWidth = 2; cx.stroke();
  const hx = x0 + (x1 - x0) * 0.94 * u, hy = f(u); glow(cx, hx, hy, 20, win ? [52, 211, 153] : [251, 113, 133], 0.85 * fade); cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(hx, hy, 3.2, 0, TAU); cx.fill();
};

// Journal: trade entries scrolling up like pages of a log, each with a win / loss dot and its result.
const journal: Scene = (cx, W, H, t) => {
  const rowH = 40, n = 14, L = n * rowH, x = W * 0.46, w = Math.min(W * 0.5, 520), off = t * 0.014;
  cx.strokeStyle = 'rgba(147,197,253,0.06)'; cx.lineWidth = 1; for (let y = (-off) % 20; y < H; y += 20) { cx.beginPath(); cx.moveTo(x - 10, y); cx.lineTo(x + w + 10, y); cx.stroke(); }
  for (let i = 0; i < n; i++) {
    const y = wrap(i * rowH - off + rowH, L) - rowH, win = hn(i * 9 + 4) > 0.32, a = cl(Math.min(y + rowH, H - y + rowH) / 46);
    if (y > H || y < -rowH) continue;
    cx.globalAlpha = a; rr(cx, x, y + 4, w, rowH - 10, 8); cx.fillStyle = 'rgba(255,255,255,0.06)'; cx.fill(); cx.strokeStyle = 'rgba(165,180,252,0.22)'; cx.lineWidth = 1; cx.stroke();
    cx.fillStyle = win ? `rgba(${GREEN},0.9)` : `rgba(${RED},0.9)`; cx.beginPath(); cx.arc(x + 16, y + rowH / 2 - 1, 4.5, 0, TAU); cx.fill();
    rr(cx, x + 32, y + rowH / 2 - 6, 50 + hn(i * 3) * 70, 5, 2.5); cx.fillStyle = 'rgba(226,232,240,0.5)'; cx.fill();
    rr(cx, x + 32, y + rowH / 2 + 3, 30 + hn(i * 7 + 2) * 60, 4, 2); cx.fillStyle = 'rgba(148,163,184,0.38)'; cx.fill();
    cx.fillStyle = win ? `rgba(${GREEN},0.95)` : `rgba(${RED},0.95)`; cx.font = `700 11px ${FONT}`; cx.textAlign = 'right'; cx.textBaseline = 'middle';
    cx.fillText(win ? '+' + (0.8 + hn(i * 5 + 1) * 2.2).toFixed(1) + 'R' : '-1.0R', x + w - 14, y + rowH / 2 - 1);
    cx.globalAlpha = 1;
  }
};

// Guide: a winding path of numbered steps. A comet travels it and each step lights up as it arrives.
const guide: Scene = (cx, W, H, t) => {
  const x0 = W * 0.4, x1 = W * 0.95, yAt = (x: number) => H * 0.5 + Math.sin((x - x0) * 0.014) * H * 0.2 + Math.sin((x - x0) * 0.005) * H * 0.08, p = (t * 0.00021) % 1.25, px = x0 + (x1 - x0) * cl(p);
  cx.setLineDash([3, 7]); cx.strokeStyle = 'rgba(165,243,252,0.32)'; cx.lineWidth = 2; cx.lineCap = 'round'; cx.beginPath(); for (let x = x0; x <= x1; x += 6) x === x0 ? cx.moveTo(x, yAt(x)) : cx.lineTo(x, yAt(x)); cx.stroke(); cx.setLineDash([]);
  cx.beginPath(); for (let x = x0; x <= px; x += 4) x === x0 ? cx.moveTo(x, yAt(x)) : cx.lineTo(x, yAt(x)); cx.strokeStyle = 'rgba(56,189,248,0.8)'; cx.lineWidth = 3; cx.stroke(); cx.lineCap = 'butt';
  for (let i = 0; i < 5; i++) {
    const x = x0 + (x1 - x0) * (i + 0.5) / 5 * (1 - 0.02), y = yAt(x), on = px >= x, age = on ? cl((px - x) / 120) : 0;
    if (on) { cx.strokeStyle = `rgba(165,243,252,${0.6 * (1 - age)})`; cx.lineWidth = 1.5; cx.beginPath(); cx.arc(x, y, 14 + age * 20, 0, TAU); cx.stroke(); glow(cx, x, y, 34, [56, 189, 248], 0.4); }
    cx.fillStyle = on ? 'rgba(56,189,248,0.95)' : 'rgba(15,30,61,0.85)'; cx.beginPath(); cx.arc(x, y, 14, 0, TAU); cx.fill(); cx.strokeStyle = on ? '#E0F2FE' : 'rgba(165,243,252,0.5)'; cx.lineWidth = 1.6; cx.stroke();
    cx.fillStyle = on ? '#fff' : 'rgba(186,230,253,0.8)'; cx.font = `700 12px ${FONT}`; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(String(i + 1), x, y + 0.5);
  }
  if (p < 1.08) { glow(cx, px, yAt(px), 26, [165, 243, 252], 0.95); cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(px, yAt(px), 3.5, 0, TAU); cx.fill(); }
};

// Checklist: rows that tick themselves off one after another, then reset.
const checklist: Scene = (cx, W, H, t) => {
  const x = W * 0.5, w = Math.min(W * 0.44, 470), rows = 5;
  for (let i = 0; i < rows; i++) {
    const y = H * (0.1 + i * 0.17), tt = wrap(t * 0.00042 - i * 0.3, 4.2), p = cl((tt - 0.2) / 0.55), fade = tt > 3.5 ? cl((4.2 - tt) / 0.7) : 1, h = Math.min(26, H * 0.12);
    cx.globalAlpha = fade; rr(cx, x, y, w, h + 8, 8); cx.fillStyle = 'rgba(255,255,255,0.05)'; cx.fill(); cx.strokeStyle = `rgba(110,231,183,${0.14 + p * 0.2})`; cx.lineWidth = 1; cx.stroke();
    const bx = x + 12, by = y + 4;
    rr(cx, bx, by, h, h, 6); cx.fillStyle = `rgba(${GREEN},${p * 0.55})`; cx.fill(); cx.strokeStyle = `rgba(167,243,208,${0.5 + p * 0.5})`; cx.lineWidth = 1.5; cx.stroke();
    if (p > 0) { cx.strokeStyle = '#fff'; cx.lineWidth = 2.4; cx.lineCap = 'round'; cx.lineJoin = 'round'; cx.beginPath(); const a = [bx + h * 0.24, by + h * 0.52], b = [bx + h * 0.44, by + h * 0.72], c = [bx + h * 0.78, by + h * 0.3], q1 = cl(p * 2), q2 = cl(p * 2 - 1); cx.moveTo(a[0], a[1]); cx.lineTo(a[0] + (b[0] - a[0]) * q1, a[1] + (b[1] - a[1]) * q1); if (q2 > 0) cx.lineTo(b[0] + (c[0] - b[0]) * q2, b[1] + (c[1] - b[1]) * q2); cx.stroke(); cx.lineCap = 'butt'; }
    rr(cx, bx + h + 14, by + h / 2 - 4, (w - h - 60) * (0.5 + hn(i * 11 + 3) * 0.5), 6, 3); cx.fillStyle = `rgba(226,232,240,${0.5 - p * 0.18})`; cx.fill();
    cx.globalAlpha = 1;
  }
};

// Settings: three meshed gears turning slowly.
const gear = (cx: Ctx, x: number, y: number, ro: number, teeth: number, rot: number, a: number) => {
  const ri = ro * 0.82, q = TAU / teeth; cx.beginPath();
  for (let i = 0; i < teeth; i++) { // each tooth is centred on its own angle, so two gears can mesh
    const s = rot + i * q;
    cx.lineTo(x + ri * Math.cos(s - q * 0.25), y + ri * Math.sin(s - q * 0.25)); cx.lineTo(x + ro * Math.cos(s - q * 0.12), y + ro * Math.sin(s - q * 0.12));
    cx.lineTo(x + ro * Math.cos(s + q * 0.12), y + ro * Math.sin(s + q * 0.12)); cx.lineTo(x + ri * Math.cos(s + q * 0.25), y + ri * Math.sin(s + q * 0.25));
  }
  cx.closePath(); cx.fillStyle = `rgba(148,163,184,${a * 0.2})`; cx.fill(); cx.strokeStyle = `rgba(147,197,253,${a})`; cx.lineWidth = 1.5; cx.stroke();
  cx.beginPath(); cx.arc(x, y, ro * 0.3, 0, TAU); cx.strokeStyle = `rgba(147,197,253,${a * 0.8})`; cx.stroke();
  cx.beginPath(); cx.arc(x, y, ro * 0.12, 0, TAU); cx.fillStyle = `rgba(191,219,254,${a})`; cx.fill();
};
const settings: Scene = (cx, W, H, t) => {
  const r1 = H * 0.44, t1 = 14, r2 = H * 0.29, t2 = 9, r3 = H * 0.2, t3 = 6, x1 = W * 0.82, y1 = H * 0.5, rot1 = t * 0.0004;
  const p1 = (r1 * 0.91), p2 = (r2 * 0.91), p3 = (r3 * 0.91), th2 = -2.55, th3 = 0.75;
  const x2 = x1 + Math.cos(th2) * (p1 + p2), y2 = y1 + Math.sin(th2) * (p1 + p2), rot2 = th2 + Math.PI - Math.PI / t2 - (rot1 - th2) * (t1 / t2); // gap of gear 2 faces the tooth of gear 1
  const x3 = x1 + Math.cos(th3) * (p1 + p3), y3 = y1 + Math.sin(th3) * (p1 + p3), rot3 = th3 + Math.PI - Math.PI / t3 - (rot1 - th3) * (t1 / t3);
  glow(cx, x1, y1, r1 * 1.8, [59, 130, 246], 0.16);
  gear(cx, x1, y1, r1, t1, rot1, 0.5); gear(cx, x2, y2, r2, t2, rot2, 0.45); gear(cx, x3, y3, r3, t3, rot3, 0.45);
};

// About: a slow starfield with a drifting constellation and the odd shooting star.
const about: Scene = (cx, W, H, t, sy, st) => {
  const r = st.r, stars = st.st = st.st || Array.from({ length: 110 }, () => ({ x: r(), y: r(), z: 0.2 + r() * 0.8, ph: r() * TAU, s: 0.6 + r() * 1.5 }));
  stars.forEach((s: any) => {
    const x = wrap(s.x * W - t * 0.006 * s.z - sy * 0.2 * s.z, W + 20) - 10, tw = 0.4 + 0.6 * Math.sin(t * 0.002 * s.z + s.ph) ** 2;
    cx.fillStyle = `rgba(221,214,254,${0.2 + tw * 0.65 * s.z})`; cx.beginPath(); cx.arc(x, s.y * H, s.s * s.z, 0, TAU); cx.fill();
  });
  const pts = [[0.5, 0.65], [0.58, 0.3], [0.67, 0.5], [0.76, 0.2], [0.84, 0.55], [0.93, 0.34]].map(([a, b], i) => [a * W + Math.sin(t * 0.0005 + i) * 5, b * H + Math.cos(t * 0.0004 + i * 2) * 5]);
  cx.lineWidth = 1; for (let i = 0; i < pts.length - 1; i++) { cx.strokeStyle = `rgba(196,181,253,${0.25 + 0.2 * Math.sin(t * 0.001 + i)})`; cx.beginPath(); cx.moveTo(pts[i][0], pts[i][1]); cx.lineTo(pts[i + 1][0], pts[i + 1][1]); cx.stroke(); }
  pts.forEach(([x, y], i) => { glow(cx, x, y, 16, i % 2 ? [236, 72, 153] : [167, 139, 250], 0.55); cx.fillStyle = '#F5F3FF'; cx.beginPath(); cx.arc(x, y, 2.6, 0, TAU); cx.fill(); });
  const cyc = 7000, ph = wrap(t, cyc) / cyc;
  if (ph < 0.12) { const q = ph / 0.12, sx = W * (0.95 - q * 0.45), sy2 = H * (0.05 + q * 0.5); const g = cx.createLinearGradient(sx, sy2, sx + 90, sy2 - 50); g.addColorStop(0, `rgba(255,255,255,${0.9 * (1 - q)})`); g.addColorStop(1, 'rgba(255,255,255,0)'); cx.strokeStyle = g; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(sx, sy2); cx.lineTo(sx + 90, sy2 - 50); cx.stroke(); }
};

// Paper trading: a fast live candle stream, BUY / SELL markers popping in and a live price line at the head.
const paper: Scene = (cx, W, H, t, sy, st) => {
  const S: Ser = st.sr = st.sr || mkSeries(st.r, 300), sp = 15, bw = 8, off = t * 0.03 + sy * 0.4, yOf = (v: number) => H * (0.5 - v * 0.3), xHead = W * 0.9;
  cx.strokeStyle = 'rgba(147,197,253,0.06)'; cx.lineWidth = 1; for (let i = 1; i < 5; i++) { cx.beginPath(); cx.moveTo(0, H * i / 5); cx.lineTo(W, H * i / 5); cx.stroke(); }
  let lastY = H / 2;
  candleRun(cx, S, off - xHead, sp, bw, yOf, 0.42, xHead, (k, x, up, yHi, yLo) => {
    lastY = yOf(S.s[k]); const m = hn(k * 7 + 1);
    if (m < 0.07 && x > W * 0.3) {
      const buy = up, y = buy ? yLo + 14 : yHi - 14, age = cl((xHead - x) / (W * 0.5)), a = 0.9 * (1 - age * 0.5);
      cx.fillStyle = `rgba(${buy ? GREEN : RED},${a})`; cx.beginPath();
      if (buy) { cx.moveTo(x + bw / 2, y - 7); cx.lineTo(x + bw / 2 + 6, y + 3); cx.lineTo(x + bw / 2 - 6, y + 3); } else { cx.moveTo(x + bw / 2, y + 7); cx.lineTo(x + bw / 2 + 6, y - 3); cx.lineTo(x + bw / 2 - 6, y - 3); }
      cx.fill(); cx.font = `700 8.5px ${FONT}`; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(buy ? 'BUY' : 'SELL', x + bw / 2, buy ? y + 13 : y - 13);
    }
  });
  const liveY = lastY + Math.sin(t * 0.01) * 3;
  cx.setLineDash([5, 4]); cx.strokeStyle = 'rgba(255,255,255,0.45)'; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(xHead, liveY); cx.lineTo(W, liveY); cx.stroke(); cx.setLineDash([]);
  rr(cx, W - 62, liveY - 9, 56, 18, 4); cx.fillStyle = 'rgba(16,185,129,0.92)'; cx.fill(); cx.fillStyle = '#fff'; cx.font = `600 10.5px ${FONT}`; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText((1.0842 + (liveY / H - 0.5) * -0.04).toFixed(4), W - 34, liveY + 0.5);
  glow(cx, xHead, liveY, 18, [52, 211, 153], 0.7 + 0.2 * Math.sin(t * 0.01)); cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(xHead, liveY, 3, 0, TAU); cx.fill();
};

const SCENES: Record<HeroKind, Scene> = { brand, analysis, methods, markets, crypto, sessions, brokers, prop, community, killzones, news, performance, risk, journal, guide, checklist, settings, about, paper };

// Per-canvas state (random numbers are seeded by the page, so each page always looks the same).
export const heroState = (kind: HeroKind) => ({ r: makeRng(hash(kind)) });

export function drawHero(cx: Ctx, W: number, H: number, t: number, sy: number, kind: HeroKind, st: any) {
  const P = PAL[kind];
  const g = cx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, P.bg[0]); g.addColorStop(0.55, P.bg[1]); g.addColorStop(1, P.bg[2]);
  cx.fillStyle = g; cx.fillRect(0, 0, W, H);
  P.g.forEach((c, i) => { // drifting glows in the page's colours
    const x = W * (0.5 + 0.45 * Math.sin(t * 0.00025 * (i + 1) + i * 1.7 + sy * 0.0008)), y = H * (0.5 + 0.4 * Math.cos(t * 0.0003 * (i + 1) + i * 2.1)), r = Math.max(W * 0.55, H * 1.2);
    const rg = cx.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, `rgba(${c},${kind === 'brand' ? 0.62 : 0.4})`); rg.addColorStop(1, `rgba(${c},0)`);
    cx.fillStyle = rg; cx.fillRect(0, 0, W, H);
  });
  cx.save(); cx.lineCap = 'butt'; cx.lineJoin = 'miter'; cx.setLineDash([]); cx.globalAlpha = 1;
  SCENES[kind](cx, W, H, t, sy, st);
  cx.restore();
  const sc = cx.createLinearGradient(0, 0, W, 0); // keep the text side calm and readable
  sc.addColorStop(0, 'rgba(6,10,30,0.66)'); sc.addColorStop(0.62, 'rgba(6,10,30,0.18)'); sc.addColorStop(1, 'rgba(6,10,30,0)');
  cx.fillStyle = sc; cx.fillRect(0, 0, W, H);
}
