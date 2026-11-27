/**
 * VSA zone + lower-timeframe confirmation strategy (TypeScript port of vsa_strategy.py)
 *
 * 1. HTF (H1) structure gives the bias (HH/HL = bull, LH/LL = bear).
 * 2. HTF zones: (a) FVG crossed by the high/low of an ultra-high-volume candle,
 *               (b) Order Block on a No-Supply candle (buy side).
 * 3. Wait for price to return into the zone; never enter on a plain tap.
 * 4. LTF confirmation: biggest-volume candle of the incoming wave must be a SELL candle,
 *    then VSA (break its high) / NS (no-supply sweep + break) / CISD (close above last down-series open).
 * 5. Stop under confirmation low. Exits: fixed RR, H1 structure, or partial.
 *    Sells are handled by mirroring prices.
 *
 * Educational research tool, not financial advice.
 */

// --------------------------------------------------------------------------- types
export interface Bar {
  time: number; // epoch ms (UTC)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Mode = "NS" | "CISD" | "VSA";
export type ExitMode = "fixed" | "structure" | "partial";
export type Bias = "bull" | "bear" | "neutral";

export interface Params {
  volLookback: number;
  ultraZ: number;
  ltfUltraZ: number;
  swingN: number;
  spreadLookback: number;
  smallSpreadRatio: number;
  obConfirmBars: number;
  waveLookback: number;
  zoneExpiry: number;
  invalidAtr: number;
  slBufferAtr: number;
  modes: Mode[];
  nsRequireSweep: boolean;
  useBias: boolean;
  exitMode: ExitMode;
  fixedRr: number;
  minStructureRr: number;
}

export const defaultParams = (over: Partial<Params> = {}): Params => ({
  volLookback: 50,
  ultraZ: 2.0,
  ltfUltraZ: 2.0,
  swingN: 3,
  spreadLookback: 20,
  smallSpreadRatio: 0.8,
  obConfirmBars: 3,
  waveLookback: 60,
  zoneExpiry: 600,
  invalidAtr: 3.0,
  slBufferAtr: 0.1,
  modes: ["NS", "CISD", "VSA"],
  nsRequireSweep: true,
  useBias: true,
  exitMode: "partial",
  fixedRr: 2.0,
  minStructureRr: 2.0,
  ...over,
});

export interface Zone {
  src: string;
  low: number;
  high: number;
  htfIdx: number;
  availTime: number;
  bias: Bias;
  target: number;
}

export interface Signal {
  idx: number;
  mode: Mode;
  entry: number;
  sl: number;
  climax: number;
  tap: number;
}

export interface Trade {
  entryTime: number;
  exitTime: number;
  entry: number;
  sl: number;
  tp1: number;
  target: number;
  rrStructure: number;
  R: number;
  status: "open" | "closed";
  side?: "BUY" | "SELL";
  mode?: Mode;
  zone?: string;
  bias?: Bias;
  zoneLow?: number;
  zoneHigh?: number;
}

/** Bars + derived features, column-oriented for speed. */
export interface Frame {
  time: number[];
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  volume: number[];
  spread: number[];
  volZ: number[];
  avgSpread: number[];
  atr: number[];
  down: boolean[];
  up: boolean[];
  noSupply: boolean[];
}

// --------------------------------------------------------------------------- small helpers
const nanToNum = (x: number) => (Number.isFinite(x) ? x : 0);
const round2 = (x: number) => Math.round(x * 100) / 100;

function maxRange(a: number[], from: number, to: number): number {
  let m = -Infinity;
  for (let i = from; i < to; i++) if (a[i] > m) m = a[i];
  return m;
}
function minRange(a: number[], from: number, to: number): number {
  let m = Infinity;
  for (let i = from; i < to; i++) if (a[i] < m) m = a[i];
  return m;
}
/** index of first maximum in [from, to) (numpy argmax semantics) */
function argmaxRange(a: number[], from: number, to: number): number {
  let best = from;
  for (let i = from + 1; i < to; i++) if (a[i] > a[best]) best = i;
  return best;
}
function lowerBound(a: number[], x: number): number {
  let lo = 0, hi = a.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (a[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
export function median(a: number[]): number {
  const s = [...a].sort((x, y) => x - y);
  const n = s.length;
  if (!n) return NaN;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

export function rollingMean(x: number[], w: number, minP: number): number[] {
  return x.map((_, i) => {
    let s = 0, n = 0;
    for (let k = Math.max(0, i - w + 1); k <= i; k++) if (!Number.isNaN(x[k])) { s += x[k]; n++; }
    return n >= minP && n > 0 ? s / n : NaN;
  });
}
/** sample std (ddof = 1), like pandas */
function rollingStd(x: number[], w: number, minP: number): number[] {
  return x.map((_, i) => {
    let s = 0, n = 0;
    const start = Math.max(0, i - w + 1);
    for (let k = start; k <= i; k++) if (!Number.isNaN(x[k])) { s += x[k]; n++; }
    if (n < minP || n < 2) return NaN;
    const m = s / n;
    let ss = 0;
    for (let k = start; k <= i; k++) if (!Number.isNaN(x[k])) ss += (x[k] - m) ** 2;
    return Math.sqrt(ss / (n - 1));
  });
}

// --------------------------------------------------------------------------- data helpers
export function barsToFrame(bars: Bar[]): Frame {
  return {
    time: bars.map((b) => b.time),
    open: bars.map((b) => b.open),
    high: bars.map((b) => b.high),
    low: bars.map((b) => b.low),
    close: bars.map((b) => b.close),
    volume: bars.map((b) => b.volume),
    spread: [], volZ: [], avgSpread: [], atr: [], down: [], up: [], noSupply: [],
  };
}

function parseTime(s: string): number {
  let t = s.trim().replace(/^"|"$/g, "");
  if (/^\d{9,13}$/.test(t)) return t.length <= 10 ? Number(t) * 1000 : Number(t);
  t = t.replace(" ", "T").replace(/\./g, (m, off) => (off < 10 ? "-" : m)); // 2026.01.05 -> 2026-01-05
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(t)) t += "Z"; // treat naive timestamps as UTC wall-clock
  const ms = Date.parse(t);
  if (Number.isNaN(ms)) throw new Error(`Cannot parse time: ${s}`);
  return ms;
}

/** CSV with columns time, open, high, low, close, volume (any case; tick_volume accepted). */
export function parseOhlcvCsv(text: string): Bar[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  const header = lines[0].split(",").map((c) => c.trim().toLowerCase().replace(/^"|"$/g, ""));
  const find = (names: string[]) => {
    const i = header.findIndex((h) => names.includes(h));
    if (i < 0) throw new Error(`Missing column (one of ${names.join(", ")})`);
    return i;
  };
  const ti = find(["time", "datetime", "timestamp", "date", "gmt time"]);
  const vi = find(["volume", "tick_volume", "vol", "tickvol"]);
  const oi = find(["open"]), hi = find(["high"]), li = find(["low"]), ci = find(["close"]);
  const bars: Bar[] = [];
  for (let r = 1; r < lines.length; r++) {
    const f = lines[r].split(",");
    bars.push({
      time: parseTime(f[ti]),
      open: Number(f[oi]), high: Number(f[hi]), low: Number(f[li]), close: Number(f[ci]),
      volume: Number(f[vi]),
    });
  }
  return bars.sort((a, b) => a.time - b.time);
}

/** Resample into fixed buckets (default 1 hour), aligned to UTC epoch like pandas does. */
export function resample(bars: Bar[], bucketMs = 3_600_000): Bar[] {
  const out: Bar[] = [];
  for (const b of bars) {
    const t = Math.floor(b.time / bucketMs) * bucketMs;
    const last = out[out.length - 1];
    if (last && last.time === t) {
      last.high = Math.max(last.high, b.high);
      last.low = Math.min(last.low, b.low);
      last.close = b.close;
      last.volume += b.volume;
    } else {
      out.push({ time: t, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume });
    }
  }
  return out;
}

/** Flip prices so every SELL setup becomes a BUY setup (volume unchanged). */
export function mirror(bars: Bar[]): Bar[] {
  return bars.map((b) => ({
    time: b.time, open: -b.open, close: -b.close, high: -b.low, low: -b.high, volume: b.volume,
  }));
}

export function addFeatures(bars: Bar[], p: Params): Frame {
  const d = barsToFrame(bars);
  const N = bars.length;
  d.spread = d.high.map((h, i) => h - d.low[i]);
  const mean = rollingMean(d.volume, p.volLookback, 10);
  const std = rollingStd(d.volume, p.volLookback, 10);
  d.volZ = d.volume.map((v, i) => (v - mean[i]) / std[i]);
  d.avgSpread = rollingMean(d.spread, p.spreadLookback, 5);
  const tr = d.high.map((h, i) => {
    let t = h - d.low[i];
    if (i > 0) {
      t = Math.max(t, Math.abs(h - d.close[i - 1]), Math.abs(d.low[i] - d.close[i - 1]));
    }
    return t;
  });
  d.atr = rollingMean(tr, 14, 3);
  d.down = d.close.map((c, i) => c < d.open[i]);
  d.up = d.close.map((c, i) => c > d.open[i]);
  d.noSupply = new Array(N).fill(false).map((_, i) => {
    const small = d.spread[i] < p.smallSpreadRatio * d.avgSpread[i];
    const lowVol = i >= 2 && d.volume[i] < d.volume[i - 1] && d.volume[i] < d.volume[i - 2];
    return d.down[i] && small && lowVol; // (mirrored data: this is No-Demand of the original)
  });
  return d;
}

// --------------------------------------------------------------------------- structure
export function swingPoints(d: Frame, n: number): { sh: boolean[]; sl: boolean[] } {
  const N = d.high.length;
  const sh = new Array<boolean>(N).fill(false);
  const sl = new Array<boolean>(N).fill(false);
  for (let i = n; i < N - n; i++) {
    sh[i] = d.high[i] >= maxRange(d.high, i - n, i + n + 1);
    sl[i] = d.low[i] <= minRange(d.low, i - n, i + n + 1);
  }
  return { sh, sl };
}

function flatNonZero(a: boolean[], upto: number): number[] {
  const out: number[] = [];
  for (let i = 0; i <= Math.min(upto, a.length - 1); i++) if (a[i]) out.push(i);
  return out;
}

export function biasAt(d: Frame, sh: boolean[], sl: boolean[], upto: number): Bias {
  if (upto < 0) return "neutral";
  const hi = flatNonZero(sh, upto).slice(-2);
  const lo = flatNonZero(sl, upto).slice(-2);
  if (hi.length < 2 || lo.length < 2) return "neutral";
  const H = hi.map((i) => d.high[i]);
  const L = lo.map((i) => d.low[i]);
  if (H[1] > H[0] && L[1] > L[0]) return "bull";
  if (H[1] < H[0] && L[1] < L[0]) return "bear";
  return "neutral";
}

// --------------------------------------------------------------------------- HTF zones (BUY side)
export function detectZones(d: Frame, p: Params, delta: number): Zone[] {
  const { sh, sl } = swingPoints(d, p.swingN);
  const H = d.high, L = d.low, C = d.close;
  const vz = d.volZ, atr = d.atr, ns = d.noSupply;
  const n = H.length;
  const zones: Zone[] = [];

  const make = (lo: number, hi: number, a: number, src: string) => {
    if (!(C[a] > hi)) return; // price must be above a buy zone
    const piv = flatNonZero(sh, Math.max(a - p.swingN, 0));
    const cand = piv.filter((i) => H[i] > hi);
    const target = cand.length
      ? H[cand[cand.length - 1]]
      : maxRange(H, Math.max(0, a - 100), a + 1);
    if (target <= hi) return;
    const bias = biasAt(d, sh, sl, a - p.swingN);
    zones.push({ src, low: lo, high: hi, htfIdx: a, availTime: d.time[a] + delta, bias, target });
  };

  // (a) FVG crossed by trigger line (high/low) of an ultra-high-volume candle
  for (let i = 2; i < n; i++) {
    const lo = H[i - 2], hi = L[i];
    if (hi <= lo) continue;
    const tol = Number.isFinite(atr[i]) ? 0.1 * atr[i] : 0;
    for (let j = Math.max(0, i - 3); j <= i; j++) {
      if (vz[j] >= p.ultraZ && [H[j], L[j]].some((x) => lo - tol <= x && x <= hi + tol)) {
        make(lo, hi, i, "FVG+UHV");
        break;
      }
    }
  }

  // (b) Order block on a No-Supply candle, followed by upside displacement
  for (let k = 2; k < n - 1; k++) {
    if (!ns[k]) continue;
    for (let m = 1; m <= p.obConfirmBars; m++) {
      if (k + m < n && C[k + m] > H[k]) {
        make(L[k], H[k], k + m, "OB+NoSupply");
        break;
      }
    }
  }
  return zones;
}

// --------------------------------------------------------------------------- LTF confirmation (BUY side)
export function findSignal(ltf: Frame, z: Zone, p: Params, start: number): Signal | null {
  const { open: o, high: h, low: l, close: c, volume: v } = ltf;
  const vz = ltf.volZ, atr = ltf.atr, down = ltf.down, ns = ltf.noSupply;
  const N = c.length;
  let tap = -1, ws = -1;

  for (let j = start; j < Math.min(N, start + p.zoneExpiry); j++) {
    if (c[j] < z.low - p.invalidAtr * nanToNum(atr[j])) return null; // zone failed
    if (tap < 0) {
      if (l[j] <= z.high && h[j] >= z.low) {
        tap = j; // price enters zone
        const lb = Math.max(0, tap - p.waveLookback);
        ws = argmaxRange(h, lb, tap + 1); // start of the incoming down-wave
      } else continue;
    }
    if (j <= ws) continue;
    const cx = argmaxRange(v, ws, j + 1); // biggest-volume candle of the wave
    if (!(down[cx] && vz[cx] >= p.ltfUltraZ && l[cx] <= z.high && cx < j)) continue;

    const buf = p.slBufferAtr * nanToNum(atr[j]);
    const cands: [Mode, number, number][] = [];

    if (p.modes.includes("VSA") && h[j] > h[cx] && (j === cx + 1 || maxRange(h, cx + 1, j) <= h[cx])) {
      cands.push(["VSA", Math.max(h[cx], o[j]), minRange(l, cx, j + 1) - buf]);
    }
    if (p.modes.includes("NS")) {
      for (let k = cx + 1; k < j; k++) {
        if (ns[k] && h[j] > h[k] && (j === k + 1 || maxRange(h, k + 1, j) <= h[k])) {
          if (p.nsRequireSweep && minRange(l, k + 1, j + 1) >= l[k]) continue;
          cands.push(["NS", Math.max(h[k], o[j]), minRange(l, k, j + 1) - buf]);
        }
      }
    }
    if (p.modes.includes("CISD") && down[j - 1]) {
      let s = j - 1;
      while (s - 1 >= ws && down[s - 1]) s--;
      if (s <= cx && cx <= j - 1 && c[j] > o[s] && minRange(l, s, j) <= z.high) {
        cands.push(["CISD", c[j], minRange(l, s, j + 1) - buf]);
      }
    }

    const valid = cands.filter((x) => x[1] - x[2] > 0);
    if (valid.length) {
      let best = valid[0];
      for (const x of valid) if (x[1] - x[2] < best[1] - best[2]) best = x; // smallest risk wins
      return { idx: j, mode: best[0], entry: best[1], sl: best[2], climax: cx, tap };
    }
  }
  return null;
}

// --------------------------------------------------------------------------- trade simulation (BUY side)
export function simulate(ltf: Frame, sig: Signal, z: Zone, p: Params): Trade | null {
  const { entry, sl } = sig;
  const R = entry - sl;
  const rrStruct = (z.target - entry) / R;
  if ((p.exitMode === "structure" || p.exitMode === "partial") && rrStruct < p.minStructureRr) return null;

  const { high: h, low: l, close: c } = ltf;
  const N = c.length;
  const tp1 = entry + p.fixedRr * R;
  let realized = 0, stage = 0, stop = sl, exitI = N - 1;
  let result: number | null = null;

  for (let j = sig.idx + 1; j < N; j++) {
    if (l[j] <= stop) { // stop first (conservative)
      result = stage === 0 ? -1.0 : realized + (1.0 - 0.5) * (stop - entry) / R;
      exitI = j;
      break;
    }
    if (p.exitMode === "fixed" && h[j] >= tp1) { result = p.fixedRr; exitI = j; break; }
    if (p.exitMode === "structure" && h[j] >= z.target) { result = rrStruct; exitI = j; break; }
    if (p.exitMode === "partial") {
      if (stage === 0 && h[j] >= tp1) { // half off at 1:2, stop to breakeven
        realized = 0.5 * p.fixedRr; stage = 1; stop = entry;
      }
      if (stage === 1 && h[j] >= z.target) { result = realized + 0.5 * rrStruct; exitI = j; break; }
    }
  }

  let status: "open" | "closed" = "closed";
  if (result === null) { // still open at end of data
    result = round2(realized + (stage === 0 ? 1.0 : 0.5) * (c[N - 1] - entry) / R);
    status = "open";
  }
  return {
    entryTime: ltf.time[sig.idx], exitTime: ltf.time[exitI],
    entry, sl, tp1, target: z.target,
    rrStructure: round2(rrStruct), R: round2(result), status,
  };
}

// --------------------------------------------------------------------------- pipeline
export function runBacktest(htfRaw: Bar[], ltfRaw: Bar[], p: Params): Trade[] {
  const diffs = htfRaw.slice(1).map((b, i) => b.time - htfRaw[i].time);
  const delta = median(diffs);
  const rows: Trade[] = [];

  for (const flipped of [false, true]) { // false = BUY, true = SELL (mirror)
    const H = addFeatures(flipped ? mirror(htfRaw) : htfRaw, p);
    const L = addFeatures(flipped ? mirror(ltfRaw) : ltfRaw, p);
    for (const z of detectZones(H, p, delta)) {
      if (p.useBias && z.bias === "bear") continue; // in mirrored space 'bear' = original bull
      const start = lowerBound(L.time, z.availTime);
      if (start >= L.time.length) continue;
      const sig = findSignal(L, z, p, start);
      if (!sig) continue;
      const tr = simulate(L, sig, z, p);
      if (!tr) continue;

      const sgn = flipped ? -1 : 1;
      const bias: Bias = flipped ? (z.bias === "bull" ? "bear" : z.bias === "bear" ? "bull" : z.bias) : z.bias;
      Object.assign(tr, {
        side: flipped ? "SELL" : "BUY", mode: sig.mode, zone: z.src, bias,
        zoneLow: Math.min(sgn * z.low, sgn * z.high),
        zoneHigh: Math.max(sgn * z.low, sgn * z.high),
        entry: sgn * tr.entry, sl: sgn * tr.sl, tp1: sgn * tr.tp1, target: sgn * tr.target,
      });
      rows.push(tr);
    }
  }

  rows.sort((a, b) => a.entryTime - b.entryTime);
  const keep: Trade[] = [];
  let busyUntil = -Infinity; // one position at a time
  for (const r of rows) {
    if (r.entryTime >= busyUntil) {
      keep.push(r);
      busyUntil = r.exitTime;
    }
  }
  return keep;
}

export interface Summary {
  trades: number;
  winRatePct?: number;
  avgR?: number;
  totalR?: number;
  profitFactor?: number;
  maxDrawdownR?: number;
}

export function summarize(t: { R: number }[]): Summary {
  if (!t.length) return { trades: 0 };
  const r = t.map((x) => x.R);
  let eq = 0, peak = 0, maxDd = 0, gp = 0, gl = 0, wins = 0;
  for (const x of r) {
    eq += x;
    peak = Math.max(peak, eq);
    maxDd = Math.max(maxDd, peak - eq);
    if (x > 0) { gp += x; wins++; } else if (x < 0) gl -= x;
  }
  const total = r.reduce((a, b) => a + b, 0);
  return {
    trades: r.length,
    winRatePct: Math.round((1000 * wins) / r.length) / 10,
    avgR: round2(total / r.length),
    totalR: round2(total),
    profitFactor: gl > 0 ? round2(gp / gl) : Infinity,
    maxDrawdownR: round2(maxDd),
  };
}

// --------------------------------------------------------------------------- demo data
export function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Synthetic 5-minute data for smoke testing (not numerically identical to the numpy demo). */
export function makeDemo(days = 40, seed = 7): Bar[] {
  const rnd = mulberry32(seed);
  const normal = (mu: number, sd: number) =>
    mu + sd * Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
  const gamma4 = (scale: number) => -scale * (Math.log(1 - rnd()) + Math.log(1 - rnd()) + Math.log(1 - rnd()) + Math.log(1 - rnd()));
  const n = days * 288, t0 = Date.UTC(2026, 0, 5);
  const bars: Bar[] = [];
  let close = 1.10, prev = 0;
  for (let i = 0; i < n; i++) {
    const drift = Math.sin(i / 900) * 0.00004;
    close += normal(drift, 0.00035);
    const open = i === 0 ? close : prev;
    const rg = Math.abs(normal(0, 0.0003)) + 0.0001;
    let vol = gamma4(100);
    if (rnd() < 0.02) vol *= 3 + 3 * rnd();
    bars.push({
      time: t0 + i * 300_000, open, close,
      high: Math.max(open, close) + rg, low: Math.min(open, close) - rg, volume: vol,
    });
    prev = close;
  }
  return bars;
}
