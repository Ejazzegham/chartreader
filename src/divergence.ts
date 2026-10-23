import type { Candle } from './markets';
import { rsiSeries, atrSeries, sessionAt } from './indicators';

// =====================================================================================
// RSI DIVERGENCE scalping method. Works on any timeframe (the Scalping screen offers M1, M5, M15, M30, H1).
// Price and the RSI make two swing points in a row; when they disagree, the move is running out of strength.
//
//                     price swing        RSI at the swing
//   BULLISH (lows)
//     Strong          lower low          higher low        -> BUY
//     Medium          equal low          higher low        -> BUY
//     Weak            lower low          equal low         -> BUY
//     Hidden          higher low         lower low         -> BUY   (trend continuation)
//   BEARISH (highs)
//     Strong          higher high        lower high        -> SELL
//     Medium          equal high         lower high        -> SELL
//     Weak            higher high        equal high        -> SELL
//     Hidden          lower high         higher high       -> SELL  (trend continuation)
//
// A swing is confirmed only after `pivotRight` closed candles have printed beyond it, so a signal never repaints.
// The signal is given on the close of that confirming candle: ONE signal at a time, the newest divergence wins.
//   Entry : close of the confirming candle       Stop : beyond the second swing (+ a small ATR buffer)
//   TP1-3 : reference levels at 1R / 2R / 3R (the method has no fixed target)
// Pure maths, no imports from the app screens, so the server can run it too.
// =====================================================================================

export type DivKind = 'strong' | 'medium' | 'weak' | 'hidden';
export const DIV_KINDS: DivKind[] = ['strong', 'medium', 'weak', 'hidden'];

export type DivParams = {
  rsiPeriod: number;
  pivotLeft: number;     // a swing must be the extreme of this many candles on its left ...
  pivotRight: number;    // ... and of this many CLOSED candles on its right (this is the confirmation delay)
  minGap: number;        // the two swings must be at least this many candles apart
  maxGap: number;        // ... and at most this many
  eqTolAtr: number;      // price swings closer than this many ATR count as "equal"
  eqTolRsi: number;      // RSI values closer than this many points count as "equal"
  maxAge: number;        // a signal is shown for this many candles after the confirming candle
  stopBufferAtr: number; // stop = second swing +/- this many ATR
  maxRiskAtr: number;    // stop further than this many ATR from the entry: no signal
  kinds: DivKind[];      // which divergences may give a signal
};
export const DIV_DEFAULTS: DivParams = {
  rsiPeriod: 14, pivotLeft: 3, pivotRight: 3, minGap: 5, maxGap: 60, eqTolAtr: 0.15, eqTolRsi: 1.5,
  maxAge: 3, stopBufferAtr: 0.1, maxRiskAtr: 3, kinds: DIV_KINDS,
};

export type DivPoint = { i: number; price: number; rsi: number };
export type DivFound = {
  side: 'buy' | 'sell'; kind: DivKind; name: string; a: DivPoint; b: DivPoint; confirmI: number; text: string;
};
export type DivSetup = {
  side: 'buy' | 'sell'; model: string; kind: DivKind; source: 'RSI Divergence';
  entry: number; sl: number; tps: [number, number, number]; rr: [number, number, number];
  score: number; grade: 'A+' | 'A' | 'B' | 'C'; confluence: { text: string; ok: boolean }[];
  note: string; warn?: string; barsAgo: number; state: 'triggered'; a: DivPoint; b: DivPoint; confirmI: number;
};
export type Div = {
  ok: boolean; reason?: string; price: number; atr: number; rsiNow: number; rsi: number[];
  vol: 'dead' | 'ok' | 'wild'; volRatio: number; session: { name: string; good: boolean } | null;
  status: 'signal' | 'expired' | 'none';
  setup?: DivSetup; why: string;
  found: DivFound[]; // every confirmed divergence in the loaded candles, newest first
};

export const DIV_R: [number, number, number] = [1, 2, 3];
const f6 = (x: number) => String(Number(x.toPrecision(6)));
const clock = (t: number) => { const d = new Date(t * 1000); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

const KIND_NAME: Record<DivKind, string> = { strong: 'Strong', medium: 'Medium', weak: 'Weak', hidden: 'Hidden' };
// rank used only to break a tie between two divergences confirmed on the same candle
const KIND_RANK: Record<DivKind, number> = { strong: 4, medium: 3, hidden: 2, weak: 1 };

// Plain-words guide, one line per cell of the strong / medium / weak / hidden table
export const DIV_GUIDE: { side: 'buy' | 'sell'; kind: DivKind; price: string; rsi: string; meaning: string }[] = [
  { side: 'buy', kind: 'strong', price: 'Lower low', rsi: 'Higher low', meaning: 'Sellers push price to a new low but the RSI refuses to follow: selling is exhausted. The classic reversal.' },
  { side: 'buy', kind: 'medium', price: 'Equal low', rsi: 'Higher low', meaning: 'Price stops at the same low while the RSI rises: buyers are stepping in on the double bottom.' },
  { side: 'buy', kind: 'weak', price: 'Lower low', rsi: 'Equal low', meaning: 'Price makes a new low, the RSI only repeats its low. Less proof than a strong divergence: needs more care.' },
  { side: 'buy', kind: 'hidden', price: 'Higher low', rsi: 'Lower low', meaning: 'In an uptrend the pullback is shallow in price but deep in the RSI: the trend is likely to continue up.' },
  { side: 'sell', kind: 'strong', price: 'Higher high', rsi: 'Lower high', meaning: 'Buyers push price to a new high but the RSI fails to follow: buying is exhausted. The classic reversal.' },
  { side: 'sell', kind: 'medium', price: 'Equal high', rsi: 'Lower high', meaning: 'Price stops at the same high while the RSI falls: sellers are stepping in on the double top.' },
  { side: 'sell', kind: 'weak', price: 'Higher high', rsi: 'Equal high', meaning: 'Price makes a new high, the RSI only repeats its high. Less proof than a strong divergence: needs more care.' },
  { side: 'sell', kind: 'hidden', price: 'Lower high', rsi: 'Higher high', meaning: 'In a downtrend the bounce is weak in price but strong in the RSI: the trend is likely to continue down.' },
];

// Swing indexes. A low is a swing when it is lower than the `left` candles before it and not higher than the `right` candles after it.
function swings(c: Candle[], left: number, right: number, kind: 'low' | 'high'): number[] {
  const out: number[] = [];
  for (let i = left; i < c.length - right; i++) {
    let ok = true;
    for (let k = 1; k <= left && ok; k++) ok = kind === 'low' ? c[i].l < c[i - k].l : c[i].h > c[i - k].h;
    for (let k = 1; k <= right && ok; k++) ok = kind === 'low' ? c[i].l <= c[i + k].l : c[i].h >= c[i + k].h;
    if (ok) out.push(i);
  }
  return out;
}

// The RSI at a swing: the most extreme RSI within one candle of it (the RSI often turns one candle before or after the price)
function rsiAt(r: number[], i: number, kind: 'low' | 'high'): number {
  let v = NaN;
  for (let k = i - 1; k <= i + 1; k++) {
    const x = r[k];
    if (!isFinite(x)) continue;
    if (!isFinite(v) || (kind === 'low' ? x < v : x > v)) v = x;
  }
  return v;
}

// Compare two swings of the same kind. Returns the divergence kind or null when price and RSI agree.
export function classify(side: 'buy' | 'sell', p1: number, p2: number, r1: number, r2: number, tolPrice: number, tolRsi: number): DivKind | null {
  const pr = Math.abs(p2 - p1) <= tolPrice ? 0 : p2 > p1 ? 1 : -1;   // 1 = higher, -1 = lower, 0 = equal
  const rr = Math.abs(r2 - r1) <= tolRsi ? 0 : r2 > r1 ? 1 : -1;
  if (side === 'buy') {
    if (pr === -1 && rr === 1) return 'strong';
    if (pr === 0 && rr === 1) return 'medium';
    if (pr === -1 && rr === 0) return 'weak';
    if (pr === 1 && rr === -1) return 'hidden';
  } else {
    if (pr === 1 && rr === -1) return 'strong';
    if (pr === 0 && rr === -1) return 'medium';
    if (pr === 1 && rr === 0) return 'weak';
    if (pr === -1 && rr === 1) return 'hidden';
  }
  return null;
}

const describe = (side: 'buy' | 'sell', kind: DivKind, a: DivPoint, b: DivPoint): string => {
  const bull = side === 'buy', sw = bull ? 'low' : 'high';
  const pw = kind === 'hidden' ? (bull ? 'higher' : 'lower') : kind === 'medium' ? 'equal' : (bull ? 'lower' : 'higher');
  const rw = kind === 'hidden' ? (bull ? 'lower' : 'higher') : kind === 'weak' ? 'equal' : (bull ? 'higher' : 'lower');
  return `${KIND_NAME[kind]} ${bull ? 'bullish' : 'bearish'} divergence: price made a ${pw} ${sw} (${f6(a.price)} then ${f6(b.price)}) while the RSI made ${rw === 'equal' ? 'an equal' : 'a ' + rw} ${sw} (${a.rsi.toFixed(1)} then ${b.rsi.toFixed(1)}).`;
};

// Every confirmed divergence in the candles, newest first. c = CLOSED candles.
export function findDivergences(c: Candle[], p: DivParams = DIV_DEFAULTS, rsi?: number[], atr?: number[]): DivFound[] {
  const r = rsi ?? rsiSeries(c.map((x) => x.c), p.rsiPeriod), at = atr ?? atrSeries(c, 14);
  const found: DivFound[] = [];
  for (const side of ['buy', 'sell'] as const) {
    const kind: 'low' | 'high' = side === 'buy' ? 'low' : 'high';
    const sw = swings(c, p.pivotLeft, p.pivotRight, kind);
    for (let q = 1; q < sw.length; q++) {
      const ia = sw[q - 1], ib = sw[q], gap = ib - ia;
      if (gap < p.minGap || gap > p.maxGap) continue;
      const pa = side === 'buy' ? c[ia].l : c[ia].h, pb = side === 'buy' ? c[ib].l : c[ib].h;
      const ra = rsiAt(r, ia, kind), rb = rsiAt(r, ib, kind), a14 = at[ib];
      if (!isFinite(ra) || !isFinite(rb) || !isFinite(a14) || a14 <= 0) continue;
      const k = classify(side, pa, pb, ra, rb, p.eqTolAtr * a14, p.eqTolRsi);
      if (!k || !p.kinds.includes(k)) continue;
      // the two swings must be the real extremes of the stretch between them: price did not break either one, the RSI did not dip / spike past both
      let clean = true;
      for (let j = ia + 1; j < ib && clean; j++) {
        if (side === 'buy') clean = c[j].l >= Math.min(pa, pb) && (!isFinite(r[j]) || r[j] >= Math.min(ra, rb) - 1);
        else clean = c[j].h <= Math.max(pa, pb) && (!isFinite(r[j]) || r[j] <= Math.max(ra, rb) + 1);
      }
      if (!clean) continue;
      const A: DivPoint = { i: ia, price: pa, rsi: ra }, B: DivPoint = { i: ib, price: pb, rsi: rb };
      found.push({ side, kind: k, name: `${KIND_NAME[k]} ${side === 'buy' ? 'bullish' : 'bearish'}`, a: A, b: B, confirmI: ib + p.pivotRight, text: describe(side, k, A, B) });
    }
  }
  return found.sort((x, y) => y.confirmI - x.confirmI || KIND_RANK[y.kind] - KIND_RANK[x.kind]);
}

// App wrapper. c = CLOSED candles (the forming candle must already be dropped, see closedCandles in volume.ts).
export function divAnalyze(c: Candle[], now = new Date(), opts: { sessions?: boolean; params?: Partial<DivParams> } = {}): Div {
  const sessions = opts.sessions !== false, p = { ...DIV_DEFAULTS, ...opts.params };
  const base: Div = { ok: false, price: c[c.length - 1]?.c ?? 0, atr: NaN, rsiNow: NaN, rsi: [], vol: 'ok', volRatio: 1, session: sessions ? sessionAt(now) : null, status: 'none', why: '', found: [] };
  if (c.length < 60) return { ...base, reason: 'Need at least 60 candles.', why: 'Need at least 60 candles.' };
  const n = c.length, last = n - 1;
  const rsi = rsiSeries(c.map((x) => x.c), p.rsiPeriod), at = atrSeries(c, 14), a = at[last];
  if (!isFinite(a) || a <= 0) return { ...base, reason: 'No volatility data.', why: 'No volatility data.' };

  const tr = c.map((x, i) => (i === 0 ? x.h - x.l : Math.max(x.h - x.l, Math.abs(x.h - c[i - 1].c), Math.abs(x.l - c[i - 1].c))));
  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / Math.max(1, arr.length);
  const volRatio = avg(tr.slice(-14)) / (avg(tr.slice(-74, -14)) || 1);
  const vol: Div['vol'] = volRatio < 0.55 ? 'dead' : volRatio > 2.2 ? 'wild' : 'ok';
  const found = findDivergences(c, p, rsi, at);
  const out: Div = { ...base, ok: true, atr: a, rsiNow: rsi[last], rsi, vol, volRatio, found };

  const d = found[0];
  if (!d) { out.why = 'No divergence yet. The RSI and price agree on the last swings. Wait for price to make two swing lows or highs where the RSI disagrees.'; return out; }
  const barsAgo = last - d.confirmI;
  if (barsAgo > p.maxAge) {
    out.why = `The last divergence (${d.name.toLowerCase()}, confirmed ${barsAgo} candles ago) is too old to trade. Wait for a new one.`;
    return out;
  }

  const buy = d.side === 'buy', col = c[d.confirmI];
  const entry = col.c, stop = buy ? d.b.price - p.stopBufferAtr * a : d.b.price + p.stopBufferAtr * a;
  const risk = Math.abs(entry - stop);
  if (!(risk > 0) || (buy ? stop >= entry : stop <= entry)) { out.why = `${d.name} divergence found, but the confirming candle closed beyond the stop level, so there is no valid entry.`; return out; }
  if (risk > p.maxRiskAtr * a) { out.status = 'none'; out.why = `${d.name} divergence found, but the stop would be ${(risk / a).toFixed(1)} ATR away (limit ${p.maxRiskAtr} ATR). Skip it.`; return out; }
  const tps = DIV_R.map((x) => entry + (buy ? 1 : -1) * x * risk) as [number, number, number];

  // what happened after the confirming candle: stop hit, or price already ran 1R (the entry is gone)
  for (let j = d.confirmI + 1; j <= last; j++) {
    if (buy ? c[j].l <= stop : c[j].h >= stop) { out.status = 'expired'; out.why = `The ${d.name.toLowerCase()} divergence failed: price hit the stop level ${f6(stop)}.`; return out; }
    if (buy ? c[j].h >= tps[0] : c[j].l <= tps[0]) { out.status = 'expired'; out.why = `The ${d.name.toLowerCase()} divergence already moved 1R from the entry ${f6(entry)}. Wait for the next one.`; return out; }
  }

  const moved = buy ? c[last].c - entry : entry - c[last].c;
  const warn = barsAgo > 0 && moved > 0.5 * risk ? `Price is already ${(moved / risk).toFixed(1)}R from the entry: do not chase.` : undefined;
  const rsiZone = d.kind === 'hidden' ? (buy ? d.b.rsi <= 50 : d.b.rsi >= 50) : (buy ? d.b.rsi <= 35 : d.b.rsi >= 65);
  const rsiGap = Math.abs(d.b.rsi - d.a.rsi);
  const green = col.c >= col.o;
  const conf: { text: string; ok: boolean }[] = [
    { text: d.text, ok: d.kind !== 'weak' },
    { text: d.kind === 'hidden' ? `RSI ${d.b.rsi.toFixed(0)}: ${rsiZone ? 'room left for the trend to continue' : 'already stretched'}` : `RSI ${d.b.rsi.toFixed(0)}: ${rsiZone ? (buy ? 'oversold zone' : 'overbought zone') : 'not in the extreme zone'}`, ok: rsiZone },
    { text: `RSI difference between the swings: ${rsiGap.toFixed(1)} points`, ok: rsiGap >= 5 },
    { text: `Tight stop: ${(risk / a).toFixed(1)} ATR`, ok: risk <= 1.5 * a },
    { text: sessions ? `Session: ${base.session?.name}` : 'Market trades around the clock', ok: !sessions || !!base.session?.good },
    { text: `Volatility ${vol === 'ok' ? 'healthy' : vol === 'dead' ? 'too quiet' : 'too wild'}`, ok: vol === 'ok' },
    { text: `Confirming candle closed ${green ? 'green' : 'red'}`, ok: buy ? green : !green },
  ];
  const kindPts = { strong: 40, medium: 35, hidden: 30, weak: 20 }[d.kind], pts = [kindPts, 15, 10, 10, 10, 10, 5];
  // the divergence itself always scores its own points (strong 40 ... weak 20); every other check adds its points when it passes
  const score = Math.min(100, Math.round(kindPts + conf.slice(1).reduce((q, x, i) => q + (x.ok ? pts[i + 1] : 0), 0)));
  const grade: DivSetup['grade'] = score >= 85 ? 'A+' : score >= 70 ? 'A' : score >= 50 ? 'B' : 'C';

  out.status = 'signal';
  out.why = `${d.name} divergence confirmed. ${buy ? 'BUY' : 'SELL'} at ${f6(entry)}.`;
  out.setup = {
    side: d.side, model: `${d.name} RSI divergence`, kind: d.kind, source: 'RSI Divergence', entry, sl: stop, tps, rr: DIV_R, score, grade, confluence: conf, barsAgo, state: 'triggered', a: d.a, b: d.b, confirmI: d.confirmI, warn,
    note: `${d.text} It was confirmed when the candle at ${clock(col.t)} closed (${p.pivotRight} candles after the second swing). Entry at that close, stop just beyond the second swing. ${d.kind === 'hidden' ? 'Hidden divergence trades WITH the trend, not against it.' : d.kind === 'weak' ? 'A weak divergence is the least reliable: use a smaller size.' : ''} TP1-3 are only reference levels at 1R / 2R / 3R.`.replace(/\s+/g, ' ').trim(),
  };
  return out;
}
