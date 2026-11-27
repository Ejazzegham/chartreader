/**
 * METHOD 2 - 1-minute VSA retracement scalping (TypeScript port of vsa_scalp_m1.py)
 * Sells are the exact mirror image (prices are mirrored), same as in vsaStrategy.ts.
 *
 * BUY side: bullish structure with a protected low, retracement = body close under the last buy
 * candle's low, biggest-volume candle of the wave must be a SELL candle, then a low-volume momentum
 * candle closes above its high. Stop under the retracement low. Exit: BE at 1R / TP at 1:2.
 * Educational research tool, not financial advice.
 */
import { median, mirror, mulberry32, resample, rollingMean, type Bar } from "./vsaStrategy";

export type ScalpExit = "be_rr" | "fixed" | "runner";

export interface ScalpParams {
  swingN: number;
  structLookback: number;
  useHtfTrend: boolean;
  htfMinutes: number;
  sessionOnly: boolean;
  sessionStartUtc: number;
  sessionEndUtc: number;
  dataUtcOffset: number;
  maxRetrBars: number;
  bigMustBeSell: boolean;
  momentumBodyRatio: number;
  momentumBodyAtr: number;
  lowVolRatio: number;
  useEma: boolean;
  emaPeriod: number;
  slBufferAtr: number;
  slBufferAbs: number;
  minRiskAtr: number;
  maxRiskAtr: number;
  spread: number;
  exitMode: ScalpExit;
  beAtR: number;
  rr: number;
  allowOverlap: boolean;
}

export const defaultScalpParams = (over: Partial<ScalpParams> = {}): ScalpParams => ({
  swingN: 3, structLookback: 120, useHtfTrend: true, htfMinutes: 10,
  sessionOnly: true, sessionStartUtc: 13, sessionEndUtc: 21, dataUtcOffset: 0,
  maxRetrBars: 90, bigMustBeSell: true, momentumBodyRatio: 0.6, momentumBodyAtr: 0.5,
  lowVolRatio: 1.0, useEma: false, emaPeriod: 5,
  slBufferAtr: 0.15, slBufferAbs: 0.0, minRiskAtr: 0.5, maxRiskAtr: 10.0, spread: 0.0,
  exitMode: "be_rr", beAtR: 1.0, rr: 2.0, allowOverlap: true,
  ...over,
});

export interface ScalpTrade {
  entryTime: number;
  exitTime: number;
  entry: number;
  sl: number;
  tp: number;
  R: number;
  exitReason: "stop" | "breakeven" | "target" | "structure_break" | "open";
  bars: number;
  side: "BUY" | "SELL";
  climaxTime: number;
  retrStartTime: number;
}

interface Feat {
  o: number[]; h: number[]; l: number[]; c: number[]; v: number[]; atr: number[]; ema: number[];
  trend: boolean[]; plow: number[]; htf: boolean[]; sess: boolean[]; up: boolean[]; down: boolean[];
}
interface Sig { sigIdx: number; entryIdx: number; fill: number; sl: number; retrStart: number; climax: number }

const nanToNum = (x: number) => (Number.isFinite(x) ? x : 0);
const round2 = (x: number) => Math.round(x * 100) / 100;

// --------------------------------------------------------------------------- structure
/** Bullish-structure flag per bar + protected low. No look-ahead (pivots confirmed n bars later). */
export function structureTrend(h: number[], l: number[], c: number[], n: number, lookback: number) {
  const N = c.length;
  const trend = new Array<boolean>(N).fill(false);
  const plow = new Array<number>(N).fill(NaN);
  const piv: number[] = [];
  let bull = false, cur = NaN, lastUsed = -1;
  for (let i = 0; i < N; i++) {
    const p = i - n;
    if (p - n >= 0) {
      let mx = -Infinity;
      for (let k = p - n; k <= p + n; k++) if (h[k] > mx) mx = h[k];
      if (h[p] >= mx) piv.push(p);
    }
    let cand = -1;
    for (let k = piv.length - 1; k >= 0; k--) {
      const q = piv[k];
      if (q < i - lookback) break;
      if (cand < 0 || h[q] > h[cand]) cand = q;
    }
    if (cand >= 0 && cand !== lastUsed && c[i] > h[cand]) { // break of structure
      let newpl = Infinity;
      for (let k = cand; k <= i; k++) if (l[k] < newpl) newpl = l[k];
      cur = bull && Number.isFinite(cur) ? Math.max(cur, newpl) : newpl;
      bull = true; lastUsed = cand;
    } else if (bull && c[i] < cur) { // protected low broken
      bull = false; cur = NaN;
    }
    trend[i] = bull; plow[i] = cur;
  }
  return { trend, plow };
}

function features(d: Bar[], p: ScalpParams): Feat {
  const o = d.map((b) => b.open), h = d.map((b) => b.high), l = d.map((b) => b.low);
  const c = d.map((b) => b.close), v = d.map((b) => b.volume);
  const N = d.length;
  const tr = h.map((hh, i) => {
    let t = hh - l[i];
    if (i > 0) t = Math.max(t, Math.abs(hh - c[i - 1]), Math.abs(l[i] - c[i - 1]));
    return t;
  });
  const atr = rollingMean(tr, 14, 3);
  const alpha = 2 / (p.emaPeriod + 1); // pandas ewm(span, adjust=False)
  const ema: number[] = [];
  c.forEach((x, i) => ema.push(i === 0 ? x : alpha * x + (1 - alpha) * ema[i - 1]));
  const { trend, plow } = structureTrend(h, l, c, p.swingN, p.structLookback);

  // higher-timeframe (10m) trend mapped onto M1 bars, available only after the HTF bar has closed
  let htf = new Array<boolean>(N).fill(true);
  if (p.useHtfTrend) {
    const ms = p.htfMinutes * 60_000;
    const H = resample(d, ms);
    const t10 = structureTrend(H.map((b) => b.high), H.map((b) => b.low), H.map((b) => b.close), p.swingN, 40).trend;
    const avail = H.map((b) => b.time + ms);
    const dt = median(d.slice(1).map((b, i) => b.time - d[i].time));
    let k = -1;
    htf = d.map((b) => {
      const mt = b.time + dt;
      while (k + 1 < avail.length && avail[k + 1] <= mt) k++;
      return k >= 0 ? t10[k] : false;
    });
  }

  let sess = new Array<boolean>(N).fill(true);
  if (p.sessionOnly) {
    const a = p.sessionStartUtc, b = p.sessionEndUtc;
    sess = d.map((bar) => {
      const hr = (((new Date(bar.time).getUTCHours() - p.dataUtcOffset) % 24) + 24) % 24;
      return a < b ? hr >= a && hr < b : hr >= a || hr < b;
    });
  }
  return { o, h, l, c, v, atr, ema, trend, plow, htf, sess, up: c.map((x, i) => x > o[i]), down: c.map((x, i) => x < o[i]) };
}

// --------------------------------------------------------------------------- signal scan (BUY side)
function scanBuy(d: Bar[], p: ScalpParams): { sigs: Sig[]; f: Feat } {
  const f = features(d, p);
  const { o, h, l, c, v, atr, up, down } = f;
  const N = d.length;
  const sigs: Sig[] = [];
  let lastBuy = -1, retr = -1;

  for (let j = 20; j < N - 1; j++) {
    const okTrend = f.trend[j] && f.htf[j];
    if (retr >= 0 && (!f.trend[j] || j - retr > p.maxRetrBars)) { retr = -1; lastBuy = -1; }
    if (retr < 0) {
      if (lastBuy >= 0 && okTrend && c[j] < l[lastBuy]) retr = lastBuy + 1; // body close under last buy low
      else if (up[j]) lastBuy = j;
      continue;
    }
    if (j <= retr || !okTrend) continue;

    // biggest-volume candle of the retracement wave
    let cx: number;
    if (p.bigMustBeSell) {
      cx = retr;
      for (let k = retr + 1; k <= j; k++) if (v[k] > v[cx]) cx = k;
      if (!(down[cx] && cx < j)) continue;
    } else {
      cx = -1;
      for (let k = retr; k < j; k++) if (down[k] && (cx < 0 || v[k] > v[cx])) cx = k;
      if (cx < 0) continue;
      if (v[j] >= p.lowVolRatio * v[cx]) continue;
    }

    // low-volume momentum breakout
    const body = Math.abs(c[j] - o[j]), spr = h[j] - l[j];
    const a = nanToNum(atr[j]);
    const momentum = up[j] && spr > 0 && body / spr >= p.momentumBodyRatio && body >= p.momentumBodyAtr * a;
    if (!(momentum && c[j] > h[cx] && v[j] < p.lowVolRatio * v[cx])) continue;
    if (p.useEma && !(c[j] > f.ema[j])) continue;
    if (!f.sess[j]) continue;

    const fill = o[j + 1] + p.spread;
    let lo = Infinity;
    for (let k = retr; k <= j; k++) if (l[k] < lo) lo = l[k];
    const sl = lo - Math.max(p.slBufferAbs, p.slBufferAtr * a);
    const risk = fill - sl;
    if (risk <= 0 || !(p.minRiskAtr * a <= risk && risk <= p.maxRiskAtr * a)) continue;

    sigs.push({ sigIdx: j, entryIdx: j + 1, fill, sl, retrStart: retr, climax: cx });
    retr = -1; lastBuy = j; // next retracement needs a new low break
  }
  return { sigs, f };
}

// --------------------------------------------------------------------------- simulation (BUY side)
function simulate(d: Bar[], f: Feat, s: Sig, p: ScalpParams): Omit<ScalpTrade, "side" | "climaxTime" | "retrStartTime"> {
  const { h, l, c, trend } = f;
  const N = d.length;
  const { fill, sl } = s;
  const R = fill - sl;
  const tp = fill + p.rr * R;
  const runner = p.exitMode === "runner";
  let stop = sl, stage = 0, realized = 0, kExit = N - 1;
  let res: number | null = null;
  let reason: ScalpTrade["exitReason"] = "open";

  for (let k = s.entryIdx; k < N; k++) {
    if (l[k] <= stop) { // stop first (conservative)
      res = stage === 0 ? -1.0 : realized + (1 - (runner ? 0.5 : 0)) * (stop - fill) / R;
      reason = stage === 0 ? "stop" : "breakeven";
      kExit = k;
      break;
    }
    if (stage === 0 && (p.exitMode === "be_rr" || runner) && h[k] >= fill + p.beAtR * R) {
      stage = 1; stop = fill;
      if (runner) realized = 0.5 * p.beAtR;
    }
    if ((p.exitMode === "be_rr" || p.exitMode === "fixed") && h[k] >= tp) {
      res = p.rr; reason = "target"; kExit = k;
      break;
    }
    if (runner && !trend[k] && k > s.entryIdx) { // structure low broke -> out
      res = stage ? realized + 0.5 * (c[k] - fill) / R : (c[k] - fill) / R;
      reason = "structure_break"; kExit = k;
      break;
    }
  }
  if (res === null) {
    res = stage && runner ? realized + 0.5 * (c[N - 1] - fill) / R : (c[N - 1] - fill) / R;
  }
  return { entryTime: d[s.entryIdx].time, exitTime: d[kExit].time, entry: fill, sl, tp, R: round2(res), exitReason: reason, bars: kExit - s.entryIdx };
}

// --------------------------------------------------------------------------- pipeline
export function runScalp(raw: Bar[], p: ScalpParams): ScalpTrade[] {
  let rows: ScalpTrade[] = [];
  for (const flipped of [false, true]) { // BUY, then SELL via mirror
    const d = flipped ? mirror(raw) : raw;
    const { sigs, f } = scanBuy(d, p);
    const sg = flipped ? -1 : 1;
    for (const s of sigs) {
      const t = simulate(d, f, s, p);
      rows.push({
        ...t, side: flipped ? "SELL" : "BUY",
        climaxTime: d[s.climax].time, retrStartTime: d[s.retrStart].time,
        entry: sg * t.entry, sl: sg * t.sl, tp: sg * t.tp,
      });
    }
  }
  rows.sort((a, b) => a.entryTime - b.entryTime);
  if (!p.allowOverlap) {
    const keep: ScalpTrade[] = [];
    let busy = -Infinity;
    for (const r of rows) if (r.entryTime >= busy) { keep.push(r); busy = r.exitTime; }
    rows = keep;
  }
  return rows;
}

// --------------------------------------------------------------------------- demo data
/** Synthetic 1-minute data for smoke testing (not numerically identical to the numpy demo). */
export function makeDemoM1(days = 25, seed = 11): Bar[] {
  const rnd = mulberry32(seed);
  const normal = (mu: number, sd: number) => mu + sd * Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
  const gamma4 = (sc: number) => -sc * (Math.log(1 - rnd()) + Math.log(1 - rnd()) + Math.log(1 - rnd()) + Math.log(1 - rnd()));
  const n = days * 1440, t0 = Date.UTC(2026, 1, 2);
  const bars: Bar[] = [];
  let close = 1.10, prev = 0;
  for (let i = 0; i < n; i++) {
    close += normal(Math.sin(i / 700) * 0.00002, 0.00012);
    const open = i === 0 ? close : prev;
    const w = Math.abs(normal(0, 0.0001)) + 0.00003;
    let vol = gamma4(50);
    if (rnd() < 0.03) vol *= 3 + 3 * rnd();
    bars.push({ time: t0 + i * 60_000, open, close, high: Math.max(open, close) + w, low: Math.min(open, close) - w, volume: vol });
    prev = close;
  }
  return bars;
}
