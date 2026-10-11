import type { Candle } from './markets';
import { atr, pivots, ladder } from './ta';

// =====================================================================================
// SMC - Smart Money Concepts. Follows "Smart Money Concepts (SMC): The Complete A to Z Guide" step by step:
//   3.1-3.2 structure: swing + internal pivots, BOS / CHoCH only on a candle BODY close, displacement check
//   3.4     liquidity: swing highs/lows, equal highs/lows (EQH/EQL), previous day / week high / low, inducement, sweeps
//   3.5     imbalance: fair value gaps (CE = midpoint) and inverse FVGs
//   3.6-3.7 order blocks (extreme + decisional), breaker and mitigation blocks, supply / demand bases (DBR, RBD, RBR, DBD)
//   3.8-3.9 premium / discount, OTE 62-79 %, and the 8-point POI score (trade only 6 or more)
//   4       top-down: higher-timeframe bias first (neutral = no trade), then the POI, then the entry timeframe
//   6-7     entry models, stop beyond the structure that proves you wrong, targets at liquidity, main target at least 1:2
//   12      the pre-trade checklist. If any answer is "no" there is no trade: a setup that fails one is capped at grade B.
// Every rule is a parameter (SMC_DEFAULTS). Study tool only. Not financial advice.
// =====================================================================================

type Side = 'bullish' | 'bearish';

export type SmcParams = {
  swingN: number;      // swing pivot: a candle beats N candles on each side (2 to 5). Sets the bias.
  internalN: number;   // internal pivot (small). Times the entry.
  dispMult: number;    // displacement: body at least this many times the average body ...
  dispClose: number;   // ... and the close sits in the outer part of the candle (0.7 = top / bottom 30 %)
  eqTol: number;       // equal highs / lows: within this many ATR
  sweepWindow: number; // a sweep closes back inside within this many candles (1 to 3)
  minPoi: number;      // POI score (0 to 8) needed to trade
  minRR: number;       // reward : risk needed for the main target (TP2)
  maxRiskAtr: number;  // a stop wider than this many ATR counts as "too wide"
  htfFactor: number;   // when no higher-timeframe candles are given, build them by grouping this many chart candles
  entryAt: 'mean' | 'edge'; // limit order at the middle (mean threshold / CE) or at the near edge of the POI
};
export const SMC_DEFAULTS: SmcParams = { swingN: 5, internalN: 2, dispMult: 1.5, dispClose: 0.7, eqTol: 0.1, sweepWindow: 3, minPoi: 6, minRR: 2, maxRiskAtr: 3.5, htfFactor: 4, entryAt: 'mean' };
export const mergeSmc = (p?: Partial<SmcParams>): SmcParams => {
  const o = { ...SMC_DEFAULTS, ...(p ?? {}) };
  const cl = (v: number, a: number, b: number, d: number) => (isFinite(v) ? Math.min(b, Math.max(a, v)) : d);
  return {
    swingN: Math.round(cl(o.swingN, 2, 5, 5)), internalN: Math.round(cl(o.internalN, 2, 5, 2)), dispMult: cl(o.dispMult, 1, 3, 1.5), dispClose: cl(o.dispClose, 0.5, 0.95, 0.7),
    eqTol: cl(o.eqTol, 0.02, 0.5, 0.1), sweepWindow: Math.round(cl(o.sweepWindow, 1, 3, 3)), minPoi: Math.round(cl(o.minPoi, 1, 8, 6)), minRR: cl(o.minRR, 1, 5, 2),
    maxRiskAtr: cl(o.maxRiskAtr, 1, 8, 3.5), htfFactor: Math.round(cl(o.htfFactor, 3, 6, 4)), entryAt: o.entryAt === 'edge' ? 'edge' : 'mean',
  };
};

export type PoiCheck = { text: string; ok: boolean };
export type SmcZone = {
  kind: 'OB' | 'BASE' | 'BRK' | 'MIT' | 'FVG'; side: Side; top: number; bottom: number; mean: number; i: number; fresh: boolean; decisional: boolean; label: string;
  extreme?: boolean; pattern?: string;
  org?: number; broke?: boolean; disp?: boolean; took?: boolean;      // facts used by the POI score
  poi?: { score: number; checks: PoiCheck[] };
};
export type SmcLiq = { side: 'BSL' | 'SSL'; price: number; i: number; from: number; kind: 'swing' | 'EQ' | 'PD' | 'PW'; label: string; swept: boolean; external: boolean };
export type SmcSweep = { side: 'BSL' | 'SSL'; price: number; i: number; confirmI: number; extreme: number; label: string };
type Brk = { kind: 'BOS' | 'CHoCH'; dir: Side; level: number; i: number; origin: number; disp: boolean };

export type SMC = {
  ok: boolean; reason?: string; price: number;
  trend: 'bullish' | 'bearish' | 'range';
  swing?: Brk;
  internal?: Brk;
  strong?: number; weak?: number;       // strong (protected) and weak (likely to be taken) swing extremes of the last swing break
  zones: SmcZone[];
  liquidity: SmcLiq[];
  sweep?: SmcSweep;                     // the latest sweep on the side that matters for the trade
  idm?: { price: number; i: number; taken: boolean; side: 'buy' | 'sell' };
  range?: { high: number; low: number; eq: number };
  zone?: 'premium' | 'discount' | 'equilibrium';
  ote?: { top: number; bottom: number; sweet: number; side: 'buy' | 'sell' };
  bias?: { dir: Side | 'neutral'; source: 'htf' | 'built'; reasons: string[] };
  phase?: string;                       // Wyckoff reading: spring / upthrust
  plan?: string;                        // the written if-then plan (guide section 5)
  next?: string;                        // what to wait for
  notes: string[];
  setup?: {
    side: 'buy' | 'sell'; entry: number; sl: number; tps: [number, number, number]; rr: [number, number, number]; score: number; grade: 'A+' | 'A' | 'B' | 'C';
    zone: SmcZone; confluence: { text: string; ok: boolean; key?: string }[]; model: string;
    ready: boolean; missing: string[]; poiScore: number; poiChecks: PoiCheck[]; aggressive: number; slBasis: 'sweep' | 'zone'; htfBuilt: boolean;
  };
};

// ---------------------------------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------------------------------
type Piv = { i: number; p: number };

function aggregate(c: Candle[], f: number): Candle[] {
  const out: Candle[] = [];
  for (let s = c.length % f; s + f <= c.length; s += f) {
    const g = c.slice(s, s + f);
    out.push({ t: g[0].t, o: g[0].o, c: g[g.length - 1].c, h: Math.max(...g.map((x) => x.h)), l: Math.min(...g.map((x) => x.l)) });
  }
  return out;
}

const overlaps = (x: { top: number; bottom: number }, y: { top: number; bottom: number }, pad = 0) => Math.min(x.top, y.top) - Math.max(x.bottom, y.bottom) > -pad;

// swing / internal structure. A BOS or CHoCH needs a candle BODY close beyond the pivot: a wick is a sweep, not a break.
function structure(c: Candle[], k: number, dispAt: (j: number, d: Side) => boolean) {
  const { hi, lo } = pivots(c, k);
  const piv = [...hi.map((p) => ({ ...p, t: 'h' as const })), ...lo.map((p) => ({ ...p, t: 'l' as const }))].sort((x, y) => x.i - y.i);
  let trend: 'bullish' | 'bearish' | 'range' = 'range';
  let refH: Piv | null = null, refL: Piv | null = null, lastH: Piv | null = null, lastL: Piv | null = null, pi = 0;
  const breaks: Brk[] = [];
  for (let i = 0; i < c.length; i++) {
    while (pi < piv.length && piv[pi].i + k <= i) {
      const p = piv[pi++];
      if (p.t === 'h') { refH = { i: p.i, p: p.p }; lastH = refH; } else { refL = { i: p.i, p: p.p }; lastL = refL; }
    }
    let dir: Side | null = null;
    if (refH && c[i].c > refH.p) dir = 'bullish'; else if (refL && c[i].c < refL.p) dir = 'bearish';
    if (!dir) continue;
    const bull = dir === 'bullish';
    const level = bull ? (refH as Piv).p : (refL as Piv).p;
    const prot: Piv | null = bull ? lastL : lastH;                        // the swing point that protected the trend
    const from = prot ? prot.i : Math.max(0, i - 20);
    let o = from;
    for (let j = from; j <= i; j++) if (bull ? c[j].l < c[o].l : c[j].h > c[o].h) o = j; // origin of the leg
    let disp = false;
    for (let j = Math.max(o, i - 4); j <= i; j++) if (dispAt(j, dir)) { disp = true; break; }
    breaks.push({ kind: trend === (bull ? 'bearish' : 'bullish') ? 'CHoCH' : 'BOS', dir, level, i, origin: o, disp });
    trend = dir;
    if (bull) refH = null; else refL = null;
  }
  return { trend, breaks, last: breaks[breaks.length - 1] as Brk | undefined, hi, lo };
}

// everything that can be read from one set of candles: structure, liquidity, sweeps, FVGs, order blocks, breakers, bases
function core(c: Candle[], P: SmcParams, kS: number, kI: number) {
  const n = c.length, a = atr(c);
  const bodies = c.map((x) => Math.abs(x.c - x.o));
  const avgB = (j: number) => { const s = Math.max(0, j - 20); let t = 0, m = 0; for (let q = s; q < j; q++) { t += bodies[q]; m++; } return m ? t / m : bodies[j]; };
  // displacement: a big body (vs the average body) that closes near its extreme
  const dispAt = (j: number, d: Side): boolean => {
    const x = c[j]; if (!x) return false;
    const rng = x.h - x.l; if (rng <= 0) return false;
    const bull = d === 'bullish';
    if (bull ? x.c <= x.o : x.c >= x.o) return false;
    const loc = bull ? (x.c - x.l) / rng : (x.h - x.c) / rng;
    return bodies[j] >= P.dispMult * avgB(j) && bodies[j] >= 0.5 * a && loc >= P.dispClose;
  };
  const sw = structure(c, kS, dispAt), it = structure(c, kI, dispAt);
  const allBreaks = [...sw.breaks, ...it.breaks];

  // ---- dealing range from the last swing high / low
  const lastH = sw.hi[sw.hi.length - 1], lastL = sw.lo[sw.lo.length - 1];
  const range = lastH && lastL ? (() => {
    const high = Math.max(lastH.p, ...c.slice(lastH.i).map((x) => x.h)), low = Math.min(lastL.p, ...c.slice(lastL.i).map((x) => x.l));
    return { high, low, eq: (high + low) / 2 };
  })() : undefined;

  // ---- liquidity pools
  const pools: SmcLiq[] = [];
  sw.hi.forEach((p) => pools.push({ side: 'BSL', price: p.p, i: p.i, from: p.i + 1, kind: 'swing', label: 'Swing high', swept: false, external: false }));
  sw.lo.forEach((p) => pools.push({ side: 'SSL', price: p.p, i: p.i, from: p.i + 1, kind: 'swing', label: 'Swing low', swept: false, external: false }));
  const eq = (arr: Piv[], side: 'BSL' | 'SSL') => {
    for (let q = 1; q < arr.length; q++) for (let r = Math.max(0, q - 6); r < q; r++) {
      if (arr[q].i - arr[r].i < 3 || Math.abs(arr[q].p - arr[r].p) > P.eqTol * a) continue;
      const price = side === 'BSL' ? Math.max(arr[q].p, arr[r].p) : Math.min(arr[q].p, arr[r].p);
      if (!pools.some((x) => x.kind === 'EQ' && x.side === side && Math.abs(x.price - price) <= 0.05 * a)) pools.push({ side, price, i: arr[q].i, from: arr[q].i + 1, kind: 'EQ', label: side === 'BSL' ? 'EQH' : 'EQL', swept: false, external: false });
    }
  };
  eq(it.hi, 'BSL'); eq(it.lo, 'SSL');
  if (n > 2 && c[0].t > 0) {                              // previous day / week high and low (UTC days; weeks start Monday)
    const day = (t: number) => Math.floor(t / 86400), wk = (t: number) => Math.floor((day(t) + 3) / 7);
    const add = (key: (t: number) => number, spanSec: number, startOffset: number, kind: 'PD' | 'PW', hiL: string, loL: string) => {
      const cur = key(c[n - 1].t), prevStart = (cur - 1) * spanSec - startOffset;
      if (c[0].t > prevStart + 7200) return;              // the data does not cover the whole previous period
      let h = -Infinity, l = Infinity, hi = -1, li = -1, first = -1, cnt = 0;
      for (let j = 0; j < n; j++) {
        const k = key(c[j].t);
        if (k === cur && first < 0) first = j;
        if (k === cur - 1) { cnt++; if (c[j].h > h) { h = c[j].h; hi = j; } if (c[j].l < l) { l = c[j].l; li = j; } }
      }
      if (cnt < 4 || first < 0) return;
      pools.push({ side: 'BSL', price: h, i: hi, from: first, kind, label: hiL, swept: false, external: true });
      pools.push({ side: 'SSL', price: l, i: li, from: first, kind, label: loL, swept: false, external: true });
    };
    add(day, 86400, 0, 'PD', 'PDH', 'PDL');
    add(wk, 7 * 86400, 3 * 86400, 'PW', 'PWH', 'PWL');
  }
  if (range) for (const L of pools) if (L.kind === 'swing' && (Math.abs(L.price - range.high) < 1e-9 || Math.abs(L.price - range.low) < 1e-9)) L.external = true;

  // ---- sweeps: price trades through a level and closes back inside within a few candles. No close back = a break, not a sweep.
  const sweeps: SmcSweep[] = [];
  for (const L of pools) {
    const bsl = L.side === 'BSL';
    for (let j = L.from; j < n; j++) {
      if (!(bsl ? c[j].h > L.price : c[j].l < L.price)) continue;
      L.swept = true;
      let m = -1;
      for (let q = j; q < Math.min(n, j + P.sweepWindow); q++) if (bsl ? c[q].c < L.price : c[q].c > L.price) { m = q; break; }
      if (m >= 0) {
        let ex = bsl ? -Infinity : Infinity;
        for (let q = j; q <= m; q++) ex = bsl ? Math.max(ex, c[q].h) : Math.min(ex, c[q].l);
        sweeps.push({ side: L.side, price: L.price, i: j, confirmI: m, extreme: ex, label: L.label });
      }
      break;
    }
  }
  sweeps.sort((x, y) => x.confirmI - y.confirmI);
  const sweepNear = (side: 'BSL' | 'SSL', lo: number, hi: number) => sweeps.some((s) => s.side === side && s.i >= lo && s.i <= hi);

  // ---- fair value gaps (CE = midpoint). A body close through the whole gap turns it into an inverse FVG.
  const zones: SmcZone[] = [];
  for (let i = Math.max(1, n - 120); i < n - 1; i++) {
    const p = c[i - 1], q = c[i + 1];
    let side: Side | null = null, bottom = 0, top = 0;
    if (p.h < q.l && q.l - p.h >= 0.1 * a) { side = 'bullish'; bottom = p.h; top = q.l; }
    else if (p.l > q.h && p.l - q.h >= 0.1 * a) { side = 'bearish'; bottom = q.h; top = p.l; }
    if (!side) continue;
    const bull = side === 'bullish', after = c.slice(i + 2), mean = (top + bottom) / 2;
    const thru = after.findIndex((x) => (bull ? x.c < bottom : x.c > top));
    if (thru >= 0) {
      const rest = after.slice(thru + 1);
      if (i >= n - 60 && !(bull ? rest.some((x) => x.c > top) : rest.some((x) => x.c < bottom)))
        zones.push({ kind: 'FVG', side: bull ? 'bearish' : 'bullish', top, bottom, mean, i, fresh: !rest.some((x) => (bull ? x.h >= bottom : x.l <= top)), decisional: false, label: bull ? 'Inverse FVG (supply)' : 'Inverse FVG (demand)', org: i, broke: false, disp: false, took: false });
      continue;
    }
    if (after.some((x) => (bull ? x.l <= bottom : x.h >= top))) continue;  // filled completely
    const leg = allBreaks.find((b) => b.dir === side && i >= b.origin && i <= b.i);
    zones.push({ kind: 'FVG', side, top, bottom, mean, i, fresh: !after.some((x) => (bull ? x.l <= top : x.h >= bottom)), decisional: false, label: bull ? 'Bullish FVG' : 'Bearish FVG', org: leg ? leg.origin : i, broke: !!leg, disp: dispAt(i, side), took: leg ? sweepNear(bull ? 'SSL' : 'BSL', leg.origin - 5, leg.origin + 3) : false });
  }

  // ---- order blocks from every structure break (guide 3.6): extreme OB at the origin of the leg, decisional OB right before the displacement
  const opp = (j: number, bull: boolean) => (bull ? c[j].c < c[j].o : c[j].c > c[j].o);
  const seen = new Set<string>();
  const pushOB = (j: number, b: Brk, extreme: boolean, decisional: boolean) => {
    const bull = b.dir === 'bullish', key = `${bull}-${j}`;
    if (seen.has(key)) {
      const z = zones.find((q) => q.i === j && (q.kind === 'OB' || q.kind === 'BRK' || q.kind === 'MIT'));
      if (z && z.kind === 'OB') { z.extreme = z.extreme || extreme; z.decisional = z.decisional || decisional; z.label = `${z.extreme && z.decisional ? 'Extreme + decisional OB' : z.extreme ? 'Extreme OB' : 'Decisional OB'} (${bull ? 'demand' : 'supply'})`; }
      return;
    }
    seen.add(key);
    const top = c[j].h, bottom = c[j].l, mean = (top + bottom) / 2, after = c.slice(j + 1);
    const fail = after.findIndex((x) => (bull ? x.c < bottom : x.c > top));          // a body closed through the whole block
    const took = sweepNear(bull ? 'SSL' : 'BSL', b.origin - 5, b.origin + 3);
    if (fail < 0) {
      const fresh = !c.slice(b.i + 1).some((x) => (bull ? x.l <= top : x.h >= bottom));
      zones.push({ kind: 'OB', side: b.dir, top, bottom, mean, i: j, fresh, decisional, extreme, label: `${extreme && decisional ? 'Extreme + decisional OB' : extreme ? 'Extreme OB' : 'Decisional OB'} (${bull ? 'demand' : 'supply'})`, org: b.origin, broke: true, disp: b.disp, took });
      return;
    }
    // failed block -> breaker (a high / low was swept first) or mitigation block (no sweep first). Needs displacement through the block.
    const k = j + 1 + fail, through: Side = bull ? 'bearish' : 'bullish';
    if (!(dispAt(k, through) || dispAt(k - 1, through))) return;
    const rest = c.slice(k + 1);
    if (bull ? rest.some((x) => x.c > top) : rest.some((x) => x.c < bottom)) return;     // flipped back: dead
    const swept = sweeps.some((s) => s.side === (bull ? 'BSL' : 'SSL') && s.confirmI <= k && s.confirmI >= k - 15);
    zones.push({ kind: swept ? 'BRK' : 'MIT', side: through, top, bottom, mean, i: j, fresh: !rest.some((x) => (bull ? x.h >= bottom : x.l <= top)), decisional: false, extreme: false, label: swept ? (bull ? 'Breaker (supply)' : 'Breaker (demand)') : (bull ? 'Mitigation block (supply)' : 'Mitigation block (demand)'), org: b.origin, broke: true, disp: true, took: swept });
  };
  for (const b of allBreaks) {
    if (b.i < n - 160) continue;
    const bull = b.dir === 'bullish', o = b.origin;
    let ex = -1;
    for (let j = Math.min(o + 2, b.i - 1); j >= Math.max(0, o - 4); j--) if (opp(j, bull)) { ex = j; break; }
    if (ex < 0) ex = o;
    let di = -1;
    for (let j = Math.max(o, b.i - 4); j <= b.i; j++) if (dispAt(j, b.dir)) { di = j; break; }
    let dec = -1;
    if (di > 0) for (let j = di - 1; j >= Math.max(0, o - 1); j--) if (opp(j, bull)) { dec = j; break; }
    pushOB(ex, b, true, dec === ex);
    if (dec >= 0 && dec !== ex) pushOB(dec, b, false, true);
  }

  // ---- supply / demand bases: 1-3 small candles, then a displacement candle. DBR / RBD reverse, RBR / DBD continue.
  for (let i = 4; i < n - 1; i++) {
    const d = c[i];
    if (bodies[i] < 1.2 * a) continue;
    const up = d.c > d.o;
    let j = i - 1, cnt = 0;
    while (j >= 0 && cnt < 3 && bodies[j] < 0.6 * a) { j--; cnt++; }
    if (cnt === 0) continue;
    const base = c.slice(j + 1, i);
    const top = Math.max(...base.map((x) => x.h)), bottom = Math.min(...base.map((x) => x.l));
    if (top - bottom > 1.6 * a) continue;
    const after = c.slice(i + 1), side: Side = up ? 'bullish' : 'bearish';
    if (up ? after.some((x) => x.c < bottom) : after.some((x) => x.c > top)) continue;
    if (zones.some((z) => (z.kind === 'OB' || z.kind === 'BRK' || z.kind === 'MIT') && z.side === side && Math.min(z.top, top) - Math.max(z.bottom, bottom) > 0.5 * (top - bottom))) continue; // an order block is the narrow version of the same zone
    const s = j + 1, legIn = c[s - 1].c - c[Math.max(0, s - 4)].c;
    const pattern = up ? (legIn < -0.8 * a ? 'DBR' : legIn > 0.8 * a ? 'RBR' : '') : (legIn > 0.8 * a ? 'RBD' : legIn < -0.8 * a ? 'DBD' : '');
    zones.push({ kind: 'BASE', side, top, bottom, mean: (top + bottom) / 2, i: s, fresh: !after.some((x) => (up ? x.l <= top : x.h >= bottom)), decisional: false, pattern: pattern || undefined, label: `${up ? 'Demand' : 'Supply'} base${pattern ? ` (${pattern})` : ''}`, org: j, broke: allBreaks.some((b) => b.dir === side && b.i >= i && b.i <= i + 8), disp: dispAt(i, side), took: sweepNear(up ? 'SSL' : 'BSL', j - 5, i) });
  }

  return { c, n, a, sw, it, allBreaks, range, pools, sweeps, zones, dispAt };
}
type Core = ReturnType<typeof core>;

// Wyckoff spring / upthrust (guide 3.10 and 6.5): a clear range, a sweep of its edge that closes back inside, then a close beyond the midpoint
function rangeEvent(c: Candle[], a: number, P: SmcParams) {
  const n = c.length;
  if (n < 60) return null;
  const base = c.slice(Math.max(0, n - 62), n - 12);
  const hi = Math.max(...base.map((x) => x.h)), lo = Math.min(...base.map((x) => x.l)), mid = (hi + lo) / 2;
  const h = hi - lo;
  if (h > 8 * a || h < 1.5 * a) return null;
  if (Math.abs(base[base.length - 1].c - base[0].c) > 0.5 * h) return null;                       // a trending leg is not a range
  // both edges must be tested and price must have moved between them at least 3 times (top -> bottom -> top, or the reverse)
  let lastBand = '', swings = 0;
  for (const x of base) {
    const band = x.h >= hi - 0.2 * h ? 'T' : x.l <= lo + 0.2 * h ? 'B' : '';
    if (band && band !== lastBand) { if (lastBand) swings++; lastBand = band; }
  }
  if (swings < 3) return null;
  let best: { kind: 'spring' | 'upthrust'; i: number; extreme: number; hi: number; lo: number; mid: number } | null = null;
  for (let q = n - 12; q < n; q++) {
    for (const kind of ['spring', 'upthrust'] as const) {
      const spring = kind === 'spring';
      if (!(spring ? c[q].l < lo - 0.02 * a : c[q].h > hi + 0.02 * a)) continue;
      let m = -1;
      for (let r = q; r < Math.min(n, q + P.sweepWindow); r++) if (spring ? c[r].c > lo : c[r].c < hi) { m = r; break; }
      if (m < 0) continue;
      let ex = spring ? Infinity : -Infinity;
      for (let r = q; r <= m; r++) ex = spring ? Math.min(ex, c[r].l) : Math.max(ex, c[r].h);
      if (!c.slice(m + 1).some((x) => (spring ? x.c > mid : x.c < mid))) continue;     // needs the shift through the midpoint
      if (!best || q > best.i) best = { kind, i: q, extreme: ex, hi, lo, mid };
    }
  }
  return best;
}

// ---------------------------------------------------------------------------------------------------------
// main entry
// ---------------------------------------------------------------------------------------------------------
export function smcAnalyze(c: Candle[], opts: { htf?: Candle[]; params?: Partial<SmcParams> } = {}): SMC {
  const P = mergeSmc(opts.params);
  const n = c.length, price = c[n - 1]?.c ?? 0;
  const empty: SMC = { ok: false, price, trend: 'range', zones: [], liquidity: [], notes: [] };
  if (n < 40) return { ...empty, reason: 'Need at least 40 candles.' };
  if (!isFinite(atr(c)) || atr(c) <= 0) return { ...empty, reason: 'No volatility data.' };
  const K = core(c, P, P.swingN, P.internalN), a = K.a, { sw, it } = K;
  if (sw.hi.length < 1 || sw.lo.length < 1 || !K.range) return { ...empty, reason: 'Not enough swing points yet.' };
  const range = K.range, trend = sw.last ? sw.last.dir : 'range';
  const span = range.high - range.low;
  const eqPos: SMC['zone'] = price > range.eq + 0.05 * span ? 'premium' : price < range.eq - 0.05 * span ? 'discount' : 'equilibrium';
  const fmt = (v: number) => v.toFixed(Math.abs(price) >= 100 ? 2 : Math.abs(price) >= 10 ? 3 : 5);
  const notes: string[] = [];

  // ---- step 1: higher-timeframe bias (neutral means no trade)
  const realHtf = !!opts.htf && opts.htf.length >= 30;
  const htfC = realHtf ? (opts.htf as Candle[]) : aggregate(c, P.htfFactor);
  const H: Core | null = htfC.length >= 30 && isFinite(atr(htfC)) && atr(htfC) > 0 ? core(htfC, P, 3, 2) : null;
  const biasDir: Side | null = H && H.sw.trend !== 'range' ? H.sw.trend : null;
  const reasons: string[] = [];
  if (H) {
    reasons.push(`${realHtf ? 'Higher timeframe' : `Chart candles x${P.htfFactor}`} structure is ${H.sw.trend === 'range' ? 'sideways' : H.sw.trend}${H.sw.last ? ` (last ${H.sw.last.kind})` : ''}`);
    if (H.range) reasons.push(`Price is in ${price > H.range.eq ? 'premium' : 'discount'} of the higher-timeframe range`);
  } else reasons.push('Not enough candles for a higher-timeframe read');
  if (!realHtf) notes.push(`No higher-timeframe candles were supplied, so the bias is read from the chart candles grouped x${P.htfFactor}.`);
  const bias: SMC['bias'] = { dir: biasDir ?? 'neutral', source: realHtf ? 'htf' : 'built', reasons };

  const ev = rangeEvent(c, a, P);
  const evDir: Side | null = ev ? (ev.kind === 'spring' ? 'bullish' : 'bearish') : null;
  const useEv = !!ev && (!biasDir || biasDir === evDir);
  const dir: Side | null = biasDir ?? (useEv ? evDir : null);

  const out: SMC = { ok: true, price, trend, swing: sw.last, internal: it.last, zones: [], liquidity: K.pools.filter((l) => !l.swept || l.external).slice(-14), range, zone: eqPos, bias, notes };
  if (sw.last) {
    const bull = sw.last.dir === 'bullish';
    out.strong = bull ? c[sw.last.origin].l : c[sw.last.origin].h;
    out.weak = bull ? Math.max(...c.slice(sw.last.origin).map((x) => x.h)) : Math.min(...c.slice(sw.last.origin).map((x) => x.l));
  }
  if (useEv && ev) out.phase = ev.kind === 'spring' ? 'Wyckoff: spring (sweep of the range low), then a shift through the midpoint. Accumulation reading.' : 'Wyckoff: upthrust (sweep of the range high), then a shift through the midpoint. Distribution reading.';
  const shortlist = (all: SmcZone[], keep?: SmcZone) => {
    const near = all.filter((z) => Math.abs(z.mean - price) <= 14 * a).sort((x, y) => Math.abs(x.mean - price) - Math.abs(y.mean - price)).slice(0, 8);
    if (keep && !near.includes(keep)) near.push(keep);
    return near.sort((x, y) => x.i - y.i);
  };
  if (!dir) {
    out.zones = shortlist(K.zones);
    out.next = 'Higher-timeframe bias is neutral: no trade. Wait for the higher timeframe to show a clear BOS or CHoCH.';
    return out;
  }
  const buy = dir === 'bullish', side: Side = dir, sweepSide: 'BSL' | 'SSL' = buy ? 'SSL' : 'BSL', eqv = range.eq;
  const ote = buy ? { side: 'buy' as const, top: range.high - 0.62 * span, bottom: range.high - 0.79 * span, sweet: range.high - 0.705 * span } : { side: 'sell' as const, bottom: range.low + 0.62 * span, top: range.low + 0.79 * span, sweet: range.low + 0.705 * span };
  out.ote = ote;

  // ---- the structure shift on the entry timeframe and the sweep that came before it
  const fav = [...K.allBreaks].filter((b) => b.dir === dir).sort((x, y) => y.i - x.i)[0] as Brk | undefined;
  const shiftRecent = !!fav && n - 1 - fav.i <= 40;
  const sweepRef = K.sweeps.filter((s) => s.side === sweepSide && (fav ? s.confirmI <= fav.i + 2 && s.i >= fav.origin - 8 : n - 1 - s.confirmI <= 60)).sort((x, y) => y.confirmI - x.confirmI)[0] as SmcSweep | undefined;
  const sweepAny = K.sweeps.filter((s) => s.side === sweepSide && n - 1 - s.confirmI <= 80).sort((x, y) => y.confirmI - x.confirmI)[0] as SmcSweep | undefined;
  out.sweep = sweepRef ?? sweepAny;
  const swingAgrees = trend === dir;
  const reversal = !!fav && fav.kind === 'CHoCH' && !!sweepRef;

  // ---- candidate POIs on the trade side, scored 0-8 (guide 3.9)
  const htfZones = H ? H.zones.filter((z) => z.side === side) : [];
  const poolsBeyond = (entry: number) => K.pools.filter((l) => !l.swept && (buy ? l.side === 'BSL' && l.price > entry : l.side === 'SSL' && l.price < entry)).map((l) => l.price);
  const pad = 0.15 * a;
  const entryOf = (z: SmcZone) => (P.entryAt === 'edge' ? (buy ? z.top : z.bottom) : z.mean);
  const slOf = (z: SmcZone) => { const e = entryOf(z); let sl = buy ? z.bottom - pad : z.top + pad; if (Math.abs(e - sl) < 0.4 * a) sl = buy ? e - 0.4 * a : e + 0.4 * a; return sl; };
  let cands = K.zones.filter((z) => z.side === side && (buy ? z.top < price + 0.2 * a : z.bottom > price - 0.2 * a) && Math.abs(z.mean - price) <= 12 * a);
  if (useEv && ev) cands = cands.filter((z) => z.i >= ev.i - 1);
  if (!cands.length) {
    out.zones = shortlist(K.zones);
    out.next = `No unmitigated ${buy ? 'demand' : 'supply'} zone (order block, FVG, breaker) near price. ${buy ? 'Wait for a sweep of sell-side liquidity, then a bullish CHoCH with displacement.' : 'Wait for a sweep of buy-side liquidity, then a bearish CHoCH with displacement.'}`;
    return out;
  }
  const scoreZ = (z: SmcZone) => {
    const e = entryOf(z), sl = slOf(z), risk = Math.abs(e - sl);
    const target = poolsBeyond(e).find((p) => Math.abs(p - e) >= P.minRR * risk);
    const fvgOverlap = K.zones.some((q) => q !== z && q.kind === 'FVG' && q.side === side && q.fresh && overlaps(q, z));
    const inOte = overlaps(z, ote);
    const checks: PoiCheck[] = [
      { text: `POI is in the ${buy ? 'discount (lower)' : 'premium (upper)'} half of the range`, ok: buy ? z.mean <= eqv : z.mean >= eqv },
      { text: 'It created the break of structure with displacement', ok: !!z.broke && !!z.disp },
      { text: 'It took liquidity before the move', ok: !!z.took },
      { text: z.fresh ? 'It is unmitigated (price has not come back)' : 'It was already tested (mitigated)', ok: z.fresh },
      { text: `Aligned with the ${realHtf ? 'higher-timeframe' : 'x' + P.htfFactor} bias`, ok: biasDir === side },
      { text: 'Inside or touching a higher-timeframe POI', ok: htfZones.some((q) => q.fresh && overlaps(q, z, 0.1 * a)) },
      { text: fvgOverlap ? 'Overlaps a fair value gap' : inOte ? 'Sits in the OTE zone (62 - 79 %)' : 'No FVG overlap and outside the OTE zone', ok: fvgOverlap || inOte },
      { text: target !== undefined ? `Clear target liquidity at least ${P.minRR.toFixed(0)}R away` : `No liquidity target ${P.minRR.toFixed(0)}R away`, ok: target !== undefined },
    ];
    return { score: checks.filter((x) => x.ok).length, checks };
  };
  cands.forEach((z) => { z.poi = scoreZ(z); });
  cands.sort((x, y) => (y.poi as { score: number }).score - (x.poi as { score: number }).score || Math.abs(x.mean - price) - Math.abs(y.mean - price));
  const best = cands[0], poi = best.poi as { score: number; checks: PoiCheck[] };
  out.zones = shortlist(K.zones, best);

  // ---- inducement: the nearest minor swing between price and the POI. Taking it first is the trap before the move.
  const minors = buy ? it.lo.filter((p) => p.p > best.top && p.i > best.i) : it.hi.filter((p) => p.p < best.bottom && p.i > best.i);
  const m = minors[minors.length - 1];
  if (m) {
    const taken = buy ? c.slice(m.i + 2).some((x) => x.l < m.p - 0.02 * a) : c.slice(m.i + 2).some((x) => x.h > m.p + 0.02 * a);
    out.idm = { price: m.p, i: m.i, taken, side: buy ? 'buy' : 'sell' };
  }

  // ---- entry, stop and targets (guide 7). The stop goes beyond the structure that proves the idea wrong: the swept extreme or the far side of the POI.
  const entry = entryOf(best), aggressive = buy ? best.top : best.bottom;
  const zoneSl = slOf(best);
  const swExt = useEv && ev ? ev.extreme : sweepRef?.extreme;
  let sl = zoneSl, slBasis: 'sweep' | 'zone' = 'zone';
  if (swExt !== undefined) {
    const sSl = buy ? swExt - pad : swExt + pad;
    if ((buy ? sSl < zoneSl : sSl > zoneSl) && Math.abs(entry - sSl) <= P.maxRiskAtr * a) { sl = sSl; slBasis = 'sweep'; }
  }
  const risk = Math.abs(entry - sl);
  const htfOpp = H ? H.zones.filter((z) => z.side !== side && z.fresh && (buy ? z.bottom > entry : z.top < entry)).map((z) => (buy ? z.bottom : z.top)) : [];
  const extreme = useEv && ev ? (buy ? Math.max(ev.hi, range.high) : Math.min(ev.lo, range.low)) : buy ? range.high : range.low;
  const tps = ladder(entry, sl, [...poolsBeyond(entry), ...htfOpp], extreme);
  const rr = tps.map((p) => Math.abs(p - entry) / risk) as [number, number, number];

  // ---- the pre-trade checklist (guide 12)
  const model = reversal ? 'Sweep + CHoCH + POI retest'
    : useEv && ev ? (ev.kind === 'spring' ? 'Wyckoff spring + POI retest' : 'Wyckoff upthrust + POI retest')
    : best.kind === 'BRK' ? 'Breaker / flip entry'
    : out.idm?.taken ? 'Inducement sweep into POI'
    : fav && fav.kind === 'BOS' && swingAgrees ? 'BOS + pullback into POI'
    : best.decisional || best.extreme ? 'Order block retest' : best.kind === 'FVG' ? 'FVG retest' : 'Supply / demand base retest';
  const swept = !!sweepRef || !!(out.idm && out.idm.taken) || (useEv && !!ev);
  const shiftOk = useEv && ev ? true : !!fav && shiftRecent && fav.disp && (swingAgrees || (fav.kind === 'CHoCH' && !!sweepRef));
  const idmOk = !out.idm || out.idm.taken;
  const pdOk = buy ? best.mean <= eqv : best.mean >= eqv;
  const stopOk = risk >= 0.3 * a && risk <= P.maxRiskAtr * a;
  const rrOk = rr[1] >= P.minRR;
  const conf: { text: string; ok: boolean; key: string }[] = [
    { key: 'bias', text: `${realHtf ? 'Higher-timeframe' : 'Grouped-candle (x' + P.htfFactor + ')'} bias is ${buy ? 'bullish' : 'bearish'} and agrees with the ${buy ? 'buy' : 'sell'}`, ok: biasDir === side },
    { key: 'pd', text: `POI sits in ${buy ? 'discount' : 'premium'} of the dealing range${overlaps(best, ote) ? ' (inside the OTE zone)' : ''}`, ok: pdOk },
    { key: 'poi', text: `POI score ${poi.score} / 8 (${best.label}${best.fresh ? ', untouched' : ', tested'}); needs ${P.minPoi}`, ok: poi.score >= P.minPoi },
    { key: 'sweep', text: sweepRef ? `${buy ? 'Sell' : 'Buy'}-side liquidity swept (${sweepRef.label} at ${fmt(sweepRef.price)}) and price closed back inside` : out.idm?.taken ? 'Inducement was swept (internal liquidity taken)' : useEv ? 'Range edge was swept (spring / upthrust)' : `No ${buy ? 'sell' : 'buy'}-side liquidity sweep before the move`, ok: swept },
    { key: 'idm', text: out.idm ? (out.idm.taken ? 'Inducement already swept, the trap is done' : 'Inducement not swept yet: wait for it before entering') : 'No clear inducement before the POI', ok: idmOk },
    { key: 'shift', text: useEv ? 'Range edge swept and price closed through the midpoint' : fav ? `${fav.kind} ${fav.dir} ${n - 1 - fav.i} candles ago, ${fav.disp ? 'with displacement' : 'without displacement (weak)'}` : 'No structure break in the trade direction yet', ok: shiftOk },
    { key: 'stop', text: `Stop ${slBasis === 'sweep' ? 'beyond the swept extreme' : 'beyond the far side of the POI'}, ${(risk / a).toFixed(1)} ATR${risk > P.maxRiskAtr * a ? ' (too wide)' : ''}`, ok: stopOk },
    { key: 'rr', text: `Main target (TP2) risk:reward 1:${rr[1].toFixed(1)}; needs 1:${P.minRR.toFixed(0)}`, ok: rrOk },
  ];
  const missing = conf.filter((x) => !x.ok).map((x) => x.text);
  const ready = conf.every((x) => x.ok);
  const raw = Math.round((100 * poi.score) / 8);
  const score = ready ? raw : Math.min(raw, 69);   // "If any answer is no, there is no trade"
  const grade = score >= 85 ? 'A+' : score >= 70 ? 'A' : score >= 50 ? 'B' : 'C';
  if (!ready) notes.push(`Not tradeable yet: ${missing.length} rule${missing.length > 1 ? 's' : ''} missing. Grade is capped at B until every rule passes.`);
  if (out.idm && !out.idm.taken) notes.push('Inducement is not swept yet: a limit order at the POI can get run first.');
  if (!swingAgrees && fav) notes.push('Swing structure has not flipped yet; this is an early entry-timeframe CHoCH after a sweep.');
  if (!best.fresh) notes.push('This POI was already tested once. First touches are the best; later touches are weaker.');

  const tgt = `${fmt(tps[0])} / ${fmt(tps[1])} / ${fmt(tps[2])}`;
  out.plan = `If price ${sweepRef ? `has swept ${sweepRef.label} (${fmt(sweepRef.price)}) and` : `sweeps ${buy ? 'sell' : 'buy'}-side liquidity and`} shifts structure at the ${best.label} (${fmt(best.bottom)} - ${fmt(best.top)}), ${buy ? 'buy' : 'sell'} at ${fmt(entry)} with a stop at ${fmt(sl)}, targeting ${tgt}. If the structure breaks the other way first, do nothing.`;
  out.next = ready ? `All rules pass. Wait for price to reach ${fmt(entry)} and react on the lower timeframe, then enter.` : `Wait: ${missing[0]}`;
  out.setup = { side: buy ? 'buy' : 'sell', entry, sl, tps, rr, score, grade, zone: best, confluence: conf, model, ready, missing, poiScore: poi.score, poiChecks: poi.checks, aggressive, slBasis, htfBuilt: !realHtf };
  return out;
}
