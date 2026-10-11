import type { Candle } from './markets';
import { atr, ema, rsi, macd, pivots, ladder } from './ta';
import { ictAnalyze, ICT, Zone, Liq } from './ict';

// =====================================================================================
// Top-Down analysis (runs on the phone): read the chart the way professionals do.
//   4H  : Direction, key levels, supply and demand       -> WHAT side are we allowed to trade?
//   1H  : Trend, breaks (BOS), reversal (CHoCH), OB, FVG, liquidity -> WHERE is the entry zone?
//   15m : Confirmation (candle, structure shift, RSI, MACD)         -> WHEN do we pull the trigger?
// EMA 200 filters all three timeframes. RSI(14) and MACD(12,26,9) confirm momentum.
// =====================================================================================

type Side = 'buy' | 'sell';
export type Level = { price: number; touches: number };

export type H4 = {
  ok: boolean; reason?: string; price: number; atr: number;
  trend: ICT['trend']; direction: Side | null; dirScore: number;
  ema200: number; emaLen: number; emaApprox: boolean; aboveEma: boolean; slope: 'up' | 'down' | 'flat';
  rsi: number; macdHist: number; macdRising: boolean;
  support: Level[]; resistance: Level[];
  demand: Zone[]; supply: Zone[];
  atZone: { kind: 'demand' | 'supply'; zone: Zone } | null; atLevel: { kind: 'support' | 'resistance'; price: number } | null;
};
export type Poi = Zone & { near: boolean; confluence: boolean; dist: number };
export type H1 = {
  ok: boolean; reason?: string; price: number; atr: number;
  trend: ICT['trend']; aligned: boolean; counter: boolean;
  lastBreak?: ICT['lastBreak']; breakAgo: number; breakRecent: boolean; reversalBack: boolean;
  orderBlocks: Zone[]; fvgs: Zone[]; liquidity: Liq[]; sweep?: ICT['sweep']; sweepOk: boolean; targets: number[];
  poi: Poi | null; aboveEma: boolean; ema200: number; rsi: number; macdHist: number;
  ict?: ICT;
};
export type M15 = {
  ok: boolean; reason?: string; price: number; atr: number;
  candle: string | null; shift: boolean; rsiOk: boolean; macdOk: boolean; tapped: boolean; confirmed: boolean; count: number;
  rsi: number; macdHist: number; aboveEma: boolean; ema200: number;
};
export type TDCheck = { stage: '4H' | '1H' | '15m' | 'Plan'; text: string; ok: boolean };
export type TDPlan = { side: Side; entry: number; sl: number; tps: [number, number, number]; rr: [number, number, number]; zoneTop: number; zoneBottom: number; basis: string; mode: 'limit' | 'market'; notes: string[] };
export type TopDown = {
  ok: boolean; reason?: string;
  bias: Side | 'wait'; verdict: 'ready' | 'watch' | 'skip'; score: number; grade: 'A+' | 'A' | 'B' | 'C';
  h4: H4; h1: H1; m15: M15; checks: TDCheck[]; plan?: TDPlan;
  ema200: { h4: number[]; h1: number[]; m15: number[] };
};

const emaLenFor = (n: number) => (n >= 215 ? 200 : Math.max(20, n - 15));
const last = <T,>(a: T[]) => a[a.length - 1];

// cluster swing prices that sit within tol of each other into one level
function cluster(pts: number[], tol: number): Level[] {
  const sorted = [...pts].sort((x, y) => x - y), out: { sum: number; n: number }[] = [];
  for (const p of sorted) {
    const g = out[out.length - 1];
    if (g && Math.abs(p - g.sum / g.n) <= tol) { g.sum += p; g.n++; } else out.push({ sum: p, n: 1 });
  }
  return out.map((g) => ({ price: g.sum / g.n, touches: g.n }));
}

const overlap = (a: { top: number; bottom: number }, b: { top: number; bottom: number }) => Math.min(a.top, b.top) - Math.max(a.bottom, b.bottom) > 0;

function candleAt(c: Candle[], j: number, side: Side, a: number): string | null {
  const x = c[j], p = c[j - 1];
  if (!x || !p) return null;
  const rng = Math.max(x.h - x.l, 1e-12), body = Math.abs(x.c - x.o), lw = Math.min(x.o, x.c) - x.l, uw = x.h - Math.max(x.o, x.c);
  if (side === 'buy') {
    if (x.c > x.o && p.c < p.o && x.c > p.o && x.o <= p.c) return 'Bullish engulfing';
    if (lw >= 2 * body && lw >= 0.55 * rng && body <= 0.4 * rng) return 'Bullish pin bar';
    if (x.c > x.o && body >= 0.6 * rng && body >= 0.8 * a) return 'Strong bullish close';
  } else {
    if (x.c < x.o && p.c > p.o && x.c < p.o && x.o >= p.c) return 'Bearish engulfing';
    if (uw >= 2 * body && uw >= 0.55 * rng && body <= 0.4 * rng) return 'Bearish pin bar';
    if (x.c < x.o && body >= 0.6 * rng && body >= 0.8 * a) return 'Strong bearish close';
  }
  return null;
}

export function topDownAnalyze(c4: Candle[], c1: Candle[], c15: Candle[], now = new Date()): TopDown {
  const blank = (price: number): { price: number; atr: number } => ({ price, atr: NaN });
  const h4: H4 = { ok: false, ...blank(last(c4)?.c ?? 0), trend: 'range', direction: null, dirScore: 0, ema200: NaN, emaLen: 200, emaApprox: false, aboveEma: false, slope: 'flat', rsi: NaN, macdHist: NaN, macdRising: false, support: [], resistance: [], demand: [], supply: [], atZone: null, atLevel: null };
  const h1: H1 = { ok: false, ...blank(last(c1)?.c ?? 0), trend: 'range', aligned: false, counter: false, breakAgo: 999, breakRecent: false, reversalBack: false, orderBlocks: [], fvgs: [], liquidity: [], sweepOk: false, targets: [], poi: null, aboveEma: false, ema200: NaN, rsi: NaN, macdHist: NaN };
  const m15: M15 = { ok: false, ...blank(last(c15)?.c ?? 0), candle: null, shift: false, rsiOk: false, macdOk: false, tapped: false, confirmed: false, count: 0, rsi: NaN, macdHist: NaN, aboveEma: false, ema200: NaN };
  const e200 = { h4: [] as number[], h1: [] as number[], m15: [] as number[] };
  const out: TopDown = { ok: false, bias: 'wait', verdict: 'skip', score: 0, grade: 'C', h4, h1, m15, checks: [], ema200: e200 };
  if (c4.length < 45) return { ...out, reason: `4H needs at least 45 candles (got ${c4.length}).` };
  if (c1.length < 45) return { ...out, reason: `1H needs at least 45 candles (got ${c1.length}).` };
  if (c15.length < 45) return { ...out, reason: `15m needs at least 45 candles (got ${c15.length}).` };

  // ================= 4H : direction, key levels, supply and demand =================
  const a4 = atr(c4), cl4 = c4.map((x) => x.c), n4 = c4.length, p4 = cl4[n4 - 1];
  const len4 = emaLenFor(n4), E4 = ema(cl4, len4), m4 = macd(cl4);
  e200.h4 = E4;
  const ict4 = ictAnalyze(c4, now);
  Object.assign(h4, { ok: true, price: p4, atr: a4, trend: ict4.trend, ema200: E4[n4 - 1], emaLen: len4, emaApprox: len4 < 200, aboveEma: p4 > E4[n4 - 1] });
  const sl4 = (E4[n4 - 1] - E4[n4 - 11]) / a4;
  h4.slope = sl4 > 0.1 ? 'up' : sl4 < -0.1 ? 'down' : 'flat';
  h4.rsi = rsi(cl4, 14); h4.macdHist = m4.hist[n4 - 1]; h4.macdRising = m4.hist[n4 - 1] > m4.hist[n4 - 2];
  let ds = 0;
  ds += h4.aboveEma ? 1 : -1;
  ds += h4.slope === 'up' ? 1 : h4.slope === 'down' ? -1 : 0;
  ds += ict4.trend === 'bullish' ? 1 : ict4.trend === 'bearish' ? -1 : 0;
  h4.dirScore = ds;
  h4.direction = ds >= 2 ? 'buy' : ds <= -2 ? 'sell' : null;
  const pv4 = pivots(c4, 3);
  const lv = (arr: { p: number }[]) => cluster(arr.map((q) => q.p), 0.4 * a4);
  h4.resistance = lv(pv4.hi).filter((l) => l.price > p4).sort((x, y) => x.price - y.price).slice(0, 3);
  h4.support = lv(pv4.lo).filter((l) => l.price < p4).sort((x, y) => y.price - x.price).slice(0, 3);
  const zones4 = [...ict4.orderBlocks, ...ict4.fvgs];
  h4.demand = zones4.filter((z) => z.side === 'bullish');
  h4.supply = zones4.filter((z) => z.side === 'bearish');
  const near4 = 0.5 * a4;
  const dz = h4.demand.find((z) => p4 >= z.bottom - near4 && p4 <= z.top + near4), sz = h4.supply.find((z) => p4 >= z.bottom - near4 && p4 <= z.top + near4);
  h4.atZone = dz ? { kind: 'demand', zone: dz } : sz ? { kind: 'supply', zone: sz } : null;
  const sup = h4.support[0], res = h4.resistance[0];
  h4.atLevel = sup && p4 - sup.price <= near4 ? { kind: 'support', price: sup.price } : res && res.price - p4 <= near4 ? { kind: 'resistance', price: res.price } : null;

  const dir = h4.direction;
  const want = dir === 'buy' ? 'bullish' : 'bearish';

  // ================= 1H : trend, breaks, reversal, OB, FVG, liquidity =================
  const a1 = atr(c1), cl1 = c1.map((x) => x.c), n1 = c1.length, p1 = cl1[n1 - 1];
  const len1 = emaLenFor(n1), E1 = ema(cl1, len1), m1 = macd(cl1);
  e200.h1 = E1;
  const ict1 = ictAnalyze(c1, now);
  Object.assign(h1, { ok: ict1.ok, reason: ict1.reason, price: p1, atr: a1, trend: ict1.trend, lastBreak: ict1.lastBreak, orderBlocks: ict1.orderBlocks, fvgs: ict1.fvgs, liquidity: ict1.liquidity, sweep: ict1.sweep, aboveEma: p1 > E1[n1 - 1], ema200: E1[n1 - 1], rsi: rsi(cl1, 14), macdHist: m1.hist[n1 - 1], ict: ict1 });
  if (dir) {
    h1.aligned = ict1.trend === want;
    h1.counter = ict1.trend !== 'range' && ict1.trend !== want;
    h1.breakAgo = ict1.lastBreak ? n1 - 1 - ict1.lastBreak.i : 999;
    h1.breakRecent = !!ict1.lastBreak && ict1.lastBreak.dir === want && h1.breakAgo <= 40;
    h1.reversalBack = h1.breakRecent && ict1.lastBreak!.kind === 'CHoCH';
    // liquidity: a sweep of the opposite side (sell-side for a buy) = stop hunt done; unswept liquidity ahead = targets
    h1.sweepOk = !!ict1.sweep && ((dir === 'buy' && ict1.sweep.side === 'SSL') || (dir === 'sell' && ict1.sweep.side === 'BSL'));
    h1.targets = ict1.liquidity.filter((l) => !l.swept && (dir === 'buy' ? l.side === 'BSL' && l.price > p1 : l.side === 'SSL' && l.price < p1)).map((l) => l.price);
    // point of interest: nearest unmitigated 1H order block / FVG on the right side, boosted when it lines up with a 4H zone or level
    const cands = [...ict1.orderBlocks, ...ict1.fvgs].filter((z) => z.side === want);
    const levels4 = [...h4.support, ...h4.resistance].map((l) => l.price);
    const scored = cands.map((z) => {
      const dist = dir === 'buy' ? Math.max(0, p1 - z.top) : Math.max(0, z.bottom - p1);
      const wrongSide = dir === 'buy' ? z.bottom > p1 + 0.3 * a1 : z.top < p1 - 0.3 * a1;
      const confluence = zones4.some((q) => q.side === z.side && overlap(q, z)) || levels4.some((p) => p >= z.bottom - 0.3 * a1 && p <= z.top + 0.3 * a1);
      const s = -dist / a1 + (z.kind === 'OB' ? 0.5 : 0) + (z.fresh ? 0.5 : 0) + (confluence ? 1.5 : 0);
      return { z, dist, wrongSide, confluence, s };
    }).filter((x) => !x.wrongSide && x.dist <= 6 * a1).sort((x, y) => y.s - x.s);
    if (scored[0]) { const b = scored[0]; h1.poi = { ...b.z, near: b.dist <= 1.5 * a1, confluence: b.confluence, dist: b.dist }; }
  }

  // ================= 15m : confirmation =================
  const a15 = atr(c15), cl15 = c15.map((x) => x.c), n15 = c15.length, p15 = cl15[n15 - 1], k15 = n15 - 2;
  const len15 = emaLenFor(n15), E15 = ema(cl15, len15), mm = macd(cl15);
  e200.m15 = E15;
  Object.assign(m15, { ok: true, price: p15, atr: a15, rsi: rsi(cl15, 14), macdHist: mm.hist[n15 - 1], aboveEma: p15 > E15[n15 - 1], ema200: E15[n15 - 1] });
  if (dir) {
    m15.candle = candleAt(c15, k15, dir, a15) ?? candleAt(c15, k15 - 1, dir, a15);
    const ict15 = ictAnalyze(c15, now);
    m15.shift = !!ict15.lastBreak && ict15.lastBreak.dir === want && n15 - 1 - ict15.lastBreak.i <= 12;
    const rPrev = rsi(cl15.slice(0, -2), 14);
    m15.rsiOk = dir === 'buy' ? m15.rsi >= 45 && m15.rsi <= 72 && m15.rsi > rPrev : m15.rsi <= 55 && m15.rsi >= 28 && m15.rsi < rPrev;
    m15.macdOk = dir === 'buy' ? mm.hist[n15 - 2] > mm.hist[n15 - 3] : mm.hist[n15 - 2] < mm.hist[n15 - 3];
    const poi = h1.poi;
    m15.tapped = !!poi && (c15.slice(-12).some((x) => x.l <= poi.top && x.h >= poi.bottom) || (p15 >= poi.bottom - 0.5 * a15 && p15 <= poi.top + 0.5 * a15));
    m15.count = [!!m15.candle, m15.shift, m15.rsiOk, m15.macdOk].filter(Boolean).length;
    m15.confirmed = m15.tapped && m15.count >= 3;
  }

  // ================= checks and score =================
  const checks: TDCheck[] = [];
  const pts: number[] = [];
  const add = (stage: TDCheck['stage'], text: string, ok: boolean, p: number) => { checks.push({ stage, text, ok }); pts.push(ok ? p : 0); };
  const buy = dir === 'buy';
  add('4H', dir ? `Direction is clear: ${buy ? 'bullish' : 'bearish'} (structure, EMA 200 and its slope agree ${Math.abs(ds)}/3)` : 'Direction is mixed: structure, EMA 200 and its slope disagree', !!dir, 12);
  add('4H', `Price is ${buy ? 'above' : 'below'} the EMA ${len4}${h4.emaApprox ? ' (short history)' : ''}`, !!dir && (buy ? h4.aboveEma : !h4.aboveEma), 8);
  add('4H', `Price is at ${buy ? 'demand or support' : 'supply or resistance'}`, !!dir && ((buy && (h4.atZone?.kind === 'demand' || h4.atLevel?.kind === 'support')) || (!buy && (h4.atZone?.kind === 'supply' || h4.atLevel?.kind === 'resistance'))), 10);
  add('1H', dir ? `1H trend ${h1.trend === 'range' ? 'is sideways' : h1.trend} ${h1.aligned ? 'agrees with' : 'differs from'} the 4H` : '1H trend (needs a 4H direction first)', !!dir && (h1.aligned || h1.reversalBack), 10);
  add('1H', h1.lastBreak ? `Last break: ${h1.lastBreak.kind} ${h1.lastBreak.dir} ${h1.breakAgo} candles ago` : 'No structure break found yet', !!dir && h1.breakRecent, 8);
  add('1H', h1.poi ? `${h1.poi.kind === 'OB' ? 'Order block' : 'Fair value gap'} ${h1.poi.near ? 'is close to price' : 'is still far from price'}${h1.poi.confluence ? ', lines up with 4H' : ''}` : 'No order block or FVG in the trade direction', !!h1.poi && h1.poi.near, 10);
  add('1H', h1.sweepOk ? 'Liquidity was swept (stop hunt done)' : h1.targets.length ? `Liquidity ahead to target (${h1.targets.length} levels)` : 'No liquidity swept and no clear liquidity target', !!dir && (h1.sweepOk || h1.targets.length > 0), 7);
  add('15m', m15.candle ? `Confirmation candle: ${m15.candle}` : 'No confirmation candle yet', !!dir && !!m15.candle, 8);
  add('15m', m15.shift ? '15m structure shifted in the trade direction' : 'No 15m structure shift yet', !!dir && m15.shift, 7);
  add('15m', `RSI(14) ${isFinite(m15.rsi) ? m15.rsi.toFixed(0) : '-'} and MACD ${m15.macdOk ? 'turning with the trade' : 'not confirming'}`, !!dir && m15.rsiOk && m15.macdOk, 10);

  // ================= plan =================
  let plan: TDPlan | undefined;
  const poi = h1.poi;
  if (dir && poi) {
    const market = m15.confirmed && poi.near;
    const entry = market ? p15 : poi.mean;
    let sl = buy ? poi.bottom - 0.2 * a1 : poi.top + 0.2 * a1;
    if (Math.abs(entry - sl) < 0.4 * a1) sl = buy ? entry - 0.4 * a1 : entry + 0.4 * a1;
    if (buy ? sl < entry : sl > entry) {
      const liq = [...h1.targets, ...(buy ? h4.resistance : h4.support).map((l) => l.price)];
      const tps = ladder(entry, sl, liq, ict1.range ? (buy ? ict1.range.high : ict1.range.low) : undefined);
      const risk = Math.abs(entry - sl), rr = tps.map((p) => Math.abs(p - entry) / risk) as [number, number, number];
      const notes: string[] = [];
      const nextLvl = (buy ? h4.resistance : h4.support)[0];
      if (nextLvl && Math.abs(nextLvl.price - entry) < Math.abs(tps[1] - entry)) notes.push(`4H ${buy ? 'resistance' : 'support'} at ${nextLvl.price.toFixed(5)} sits before TP2: take most profit there.`);
      if (!market) notes.push('Limit order at the middle of the zone. Wait for the 15m to react before it fills, cancel if price breaks the zone.');
      else notes.push('15m confirmed inside the zone: market entry at the last close.');
      plan = { side: dir, entry, sl, tps, rr, zoneTop: poi.top, zoneBottom: poi.bottom, basis: `${poi.kind === 'OB' ? '1H order block' : '1H fair value gap'}${poi.confluence ? ' + 4H confluence' : ''}`, mode: market ? 'market' : 'limit', notes };
    }
  }
  add('Plan', plan ? `TP1 risk:reward 1:${plan.rr[0].toFixed(1)}` : 'No entry zone to build a plan from', !!plan && plan.rr[0] >= 1.5, 10);

  const score = Math.round(pts.reduce((s, v) => s + v, 0));
  const grade: TopDown['grade'] = score >= 85 ? 'A+' : score >= 70 ? 'A' : score >= 50 ? 'B' : 'C';
  const verdict: TopDown['verdict'] = dir && plan && m15.confirmed && score >= 65 ? 'ready' : dir && score >= 40 ? 'watch' : 'skip';
  return { ...out, ok: true, bias: dir ?? 'wait', verdict, score, grade, checks, plan };
}
