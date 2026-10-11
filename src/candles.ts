import type { Candle } from './markets';
import { atrSeries, emaS, rsiSeries, supportResistance, hasVolume, fin, SR } from './indicators';
import { ladder } from './ta';

// =====================================================================================
// Candlestick method.
// Rules taken from the TrendSpider guide "Trading Candlestick Patterns 101":
//   1. A reversal candle only matters at the END of a trend (hammer after a fall = hammer, the same shape after a rise = hanging man).
//   2. Confirm before entering: the next candle should close in the new direction and hold the signal candle's low (bullish) / high (bearish).
//   3. Volume and momentum indicators add confidence.
//   4. Enter above the signal / confirmation candle high (below the low for sells).
//   5. Stop just beyond the pattern's extreme with a small cushion (stop hunts).
// Families covered: hammer family (hammer, inverted hammer, hanging man, shooting star), doji family (dragonfly, gravestone, long-legged, neutral),
// engulfing, piercing line, dark cloud cover, harami, tweezers, morning / evening star (and doji star), abandoned baby, three white soldiers /
// three black crows, advance block, marubozu.
// Forex, crypto and synthetic indices trade almost without gaps, so "gap" rules are relaxed to "open near the previous close", except for
// the abandoned baby which needs a real gap.
// =====================================================================================

export type CDir = 'bullish' | 'bearish' | 'neutral';
export type CStatus = 'forming' | 'pending' | 'confirmed';
export type Cdl = {
  key: string; name: string; dir: CDir; kind: 1 | 2 | 3; from: number; i: number; strength: number; trade: boolean;
  status: CStatus; confIdx: number; age: number; reasons: { text: string; ok: boolean }[]; note: string; low: number; high: number;
};
export type CTrend = 'up' | 'down' | 'flat';
export type CdlSetup = {
  side: 'buy' | 'sell'; entry: number; sl: number; tps: [number, number, number]; rr: [number, number, number]; score: number; grade: 'A+' | 'A' | 'B' | 'C';
  state: 'armed' | 'triggered'; trigger: number; pattern: Cdl; confluence: { text: string; ok: boolean }[]; note: string;
};
export type Candles = {
  ok: boolean; reason?: string; why?: string; trend: CTrend; list: Cdl[]; best?: Cdl; setup?: CdlSetup; bias: CDir;
  last?: { name: string; dir: CDir }; // what the latest candle alone looks like
};
export type Mark = { i: number; label: string; dir: CDir; strength: number };

const body = (x: Candle) => Math.abs(x.c - x.o), rng = (x: Candle) => x.h - x.l, upW = (x: Candle) => x.h - Math.max(x.o, x.c), loW = (x: Candle) => Math.min(x.o, x.c) - x.l;
const bull = (x: Candle) => x.c > x.o, bear = (x: Candle) => x.c < x.o, mid = (x: Candle) => (x.o + x.c) / 2;

const BASE: Record<string, number> = {
  hammer: 56, invhammer: 48, hanging: 48, shooting: 56, dragonfly: 52, gravestone: 52, longleg: 50, doji: 36,
  bullEng: 62, bearEng: 62, piercing: 56, darkcloud: 56, harami: 40, tweezer: 50,
  morning: 66, evening: 66, abandoned: 74, soldiers: 60, crows: 60, advblock: 55, maru: 40,
};

type Env = { c: Candle[]; a: number[]; e20: number[]; rsi: number[]; sr: SR[]; vol: boolean; avgVol: number[] };

function envOf(c: Candle[]): Env {
  const cl = c.map((x) => x.c), vol = hasVolume(c);
  const avgVol = c.map((_, i) => { if (i < 20) return NaN; let s = 0; for (let j = i - 20; j < i; j++) s += c[j].v ?? 0; return s / 20; });
  return { c, a: atrSeries(c), e20: emaS(cl, 20), rsi: rsiSeries(cl), sr: supportResistance(c, 10), vol, avgVol };
}

// Trend into the pattern: the move over the 8 candles BEFORE its first candle, measured in ATR.
function trendBefore(env: Env, i0: number): { t: CTrend; move: number } {
  const { c, a, e20 } = env, k = Math.min(8, i0 - 1);
  if (k < 4 || !fin(a[i0 - 1]) || !fin(e20[i0 - 1])) return { t: 'flat', move: 0 };
  const move = (c[i0 - 1].c - c[i0 - 1 - k].c) / a[i0 - 1], slope = e20[i0 - 1] - (fin(e20[i0 - 1 - k]) ? e20[i0 - 1 - k] : e20[i0 - 1]);
  if (move <= -0.9 && (c[i0 - 1].c < e20[i0 - 1] || slope < 0)) return { t: 'down', move };
  if (move >= 0.9 && (c[i0 - 1].c > e20[i0 - 1] || slope > 0)) return { t: 'up', move };
  return { t: 'flat', move };
}

// All patterns that END on candle i (one per family, the strongest wins later).
function detect(env: Env, i: number): Cdl[] {
  const { c } = env, a = env.a[i];
  if (i < 25 || !fin(a) || a <= 0) return [];
  const out: Cdl[] = [], x = c[i], tol = 0.05 * a;
  const add = (key: string, name: string, dir: CDir, kind: 1 | 2 | 3, trade: boolean, tr: { t: CTrend; move: number }, note: string, extra = 0, fit = true) => {
    const from = i - kind + 1, pc = c.slice(from, i + 1);
    const low = Math.min(...pc.map((q) => q.l)), high = Math.max(...pc.map((q) => q.h)), size = (high - low) / a;
    let s = (BASE[key] ?? 45) + extra;
    const reasons: { text: string; ok: boolean }[] = [];
    const bullish = dir === 'bullish';
    const wantTrend: CTrend = bullish ? 'down' : 'up';
    const trendOk = dir === 'neutral' ? true : tr.t === wantTrend || (!fit);
    reasons.push({ text: dir === 'neutral' ? `Market was ${tr.t === 'flat' ? 'sideways' : tr.t === 'up' ? 'rising' : 'falling'} before this candle` : trendOk && fit ? `Appears after a ${bullish ? 'fall' : 'rise'} (${Math.abs(tr.move).toFixed(1)} ATR), where reversals matter` : 'Not at the end of a clear trend, weaker signal', ok: dir === 'neutral' ? true : trendOk && fit });
    if (dir !== 'neutral') { if (trendOk && fit) s += Math.abs(tr.move) >= 2 ? 8 : 4; else s -= 12; }
    reasons.push({ text: `Pattern size ${size.toFixed(1)} ATR`, ok: size >= 0.9 });
    if (size >= 1.2) s += 4; else if (size < 0.6) s -= 10;
    if (dir !== 'neutral') {
      const lvl = env.sr.find((r) => Math.abs((bullish ? low : high) - r.price) <= 0.6 * a && (bullish ? r.kind === 'support' : r.kind === 'resistance'));
      reasons.push({ text: lvl ? `Sits on ${bullish ? 'support' : 'resistance'} (${lvl.touches} touches)` : `Not at a known ${bullish ? 'support' : 'resistance'} level`, ok: !!lvl });
      if (lvl) s += 10;
      const r = env.rsi[i];
      if (fin(r)) { const ok = bullish ? r < 38 : r > 62; reasons.push({ text: `RSI ${r.toFixed(0)} ${ok ? 'supports a reversal' : 'is not stretched'}`, ok }); if (ok) s += 6; }
      if (env.vol) { const av = env.avgVol[i], v = x.v ?? 0, ok = fin(av) && av > 0 && v > 1.3 * av; reasons.push({ text: ok ? `Volume ${(v / av).toFixed(1)}x the average` : 'Volume is not above average', ok }); if (ok) s += 8; }
      else reasons.push({ text: 'No volume on this feed: confirm with RSI or MACD', ok: false });
    }
    out.push({ key, name, dir, kind, from, i, strength: Math.max(0, Math.min(100, Math.round(s))), trade, status: i === c.length - 1 ? 'forming' : 'pending', confIdx: -1, age: c.length - 1 - i, reasons, note, low, high });
  };

  // ---------- single candle ----------
  const R = rng(x), B = body(x), U = upW(x), L = loW(x);
  const t1 = trendBefore(env, i);
  if (R >= 0.5 * a) {
    if (B <= 0.1 * R) {
      if (L >= 0.6 * R && U <= 0.15 * R) { if (t1.t === 'down') add('dragonfly', 'Dragonfly Doji', 'bullish', 1, true, t1, 'Sellers pushed hard, buyers took it all back. Needs a bullish candle after it.'); }
      else if (U >= 0.6 * R && L <= 0.15 * R) { if (t1.t === 'up') add('gravestone', 'Gravestone Doji', 'bearish', 1, true, t1, 'Buyers pushed hard, sellers took it all back. Needs a bearish candle after it.'); }
      else if (U >= 0.3 * R && L >= 0.3 * R && R >= 1.2 * a) {
        if (t1.t !== 'flat') add('longleg', 'Long-Legged Doji', t1.t === 'down' ? 'bullish' : 'bearish', 1, true, t1, 'Big swings both ways and no winner: the strongest of the doji reversal signals.');
        else add('doji', 'Long-Legged Doji', 'neutral', 1, false, t1, 'Big indecision with no clear trend to reverse.');
      } else add('doji', 'Doji', 'neutral', 1, false, t1, 'Indecision: supply and demand are in balance. Wait for the next candle to choose a side.');
    } else if (B <= 0.38 * R) {
      if (L >= 2 * B && L >= 0.55 * R && U <= 0.2 * R) {
        if (t1.t === 'down') add('hammer', 'Hammer', 'bullish', 1, true, t1, 'Price fell, then buyers rejected the low and closed near the top. Confirm with a higher low next candle.', bull(x) ? 4 : 0);
        else if (t1.t === 'up') add('hanging', 'Hanging Man', 'bearish', 1, true, t1, 'Hammer shape at the top: supply showed up but buyers absorbed it, for now. Needs a bearish confirmation.', bear(x) ? 4 : 0);
      } else if (U >= 2 * B && U >= 0.55 * R && L <= 0.2 * R) {
        if (t1.t === 'up') add('shooting', 'Shooting Star', 'bearish', 1, true, t1, 'Buyers pushed to a new high, then sellers drove it back to the open. Confirm with a lower high next candle.', bear(x) ? 4 : 0);
        else if (t1.t === 'down') add('invhammer', 'Inverted Hammer', 'bullish', 1, true, t1, 'Buyers tested higher at the bottom of a fall. Needs a bullish confirmation candle.', bull(x) ? 4 : 0);
      }
    }
    if (B >= 0.9 * R && B >= 1.3 * a) add('maru', bull(x) ? 'Bullish Marubozu' : 'Bearish Marubozu', bull(x) ? 'bullish' : 'bearish', 1, false, t1, 'A full-bodied momentum candle with almost no wicks. It shows strength, not a reversal.', 0, false);
  }

  // ---------- two candles ----------
  const p = c[i - 1], t2 = trendBefore(env, i - 1), bp = body(p);
  if (bp >= 0.25 * a) {
    if (bear(p) && bull(x) && x.o <= p.c + tol && x.c >= p.o - tol && B > bp && t2.t === 'down') add('bullEng', 'Bullish Engulfing', 'bullish', 2, true, t2, 'The green body swallows the red one: buyers took control from sellers.', B > 1.5 * bp ? 4 : 0);
    if (bull(p) && bear(x) && x.o >= p.c - tol && x.c <= p.o + tol && B > bp && t2.t === 'up') add('bearEng', 'Bearish Engulfing', 'bearish', 2, true, t2, 'The red body swallows the green one: sellers took control from buyers.', B > 1.5 * bp ? 4 : 0);
    if (bear(p) && bp >= 0.6 * a && bull(x) && x.o <= p.c + tol && x.c > mid(p) && x.c < p.o && t2.t === 'down') add('piercing', 'Piercing Line', 'bullish', 2, true, t2, 'Buyers closed above the middle of the previous red body.');
    if (bull(p) && bp >= 0.6 * a && bear(x) && x.o >= p.c - tol && x.c < mid(p) && x.c > p.o && t2.t === 'up') add('darkcloud', 'Dark Cloud Cover', 'bearish', 2, true, t2, 'Sellers closed below the middle of the previous green body: buyers are under pressure.');
    if (bp >= 0.8 * a && B <= 0.5 * bp && Math.max(x.o, x.c) <= Math.max(p.o, p.c) && Math.min(x.o, x.c) >= Math.min(p.o, p.c)) {
      if (bear(p) && t2.t === 'down') add('harami', 'Bullish Harami', 'bullish', 2, true, t2, 'A small candle inside a big red body: the fall is losing steam.');
      if (bull(p) && t2.t === 'up') add('harami', 'Bearish Harami', 'bearish', 2, true, t2, 'A small candle inside a big green body: the rise is losing steam.');
    }
  }
  if (Math.abs(p.l - x.l) <= 0.1 * a && bear(p) && bull(x) && t2.t === 'down') add('tweezer', 'Tweezer Bottom', 'bullish', 2, true, t2, 'Two candles stop at the same low: the level held twice.');
  if (Math.abs(p.h - x.h) <= 0.1 * a && bull(p) && bear(x) && t2.t === 'up') add('tweezer', 'Tweezer Top', 'bearish', 2, true, t2, 'Two candles stop at the same high: the level held twice.');

  // ---------- three candles ----------
  const c0 = c[i - 2], c1 = p, t3 = trendBefore(env, i - 2), b0 = body(c0), b1 = body(c1);
  if (bear(c0) && b0 >= 0.8 * a && b1 <= 0.4 * b0 && Math.max(c1.o, c1.c) <= c0.c + tol && bull(x) && x.c > mid(c0) && t3.t === 'down') {
    const dj = b1 <= 0.1 * rng(c1);
    if (dj && c1.h < c0.l && c1.h < x.l) add('abandoned', 'Bullish Abandoned Baby', 'bullish', 3, true, t3, 'A doji gapped away on both sides at the bottom: rare and reliable.');
    else add('morning', dj ? 'Morning Doji Star' : 'Morning Star', 'bullish', 3, true, t3, 'Fall, pause, then a strong green candle back into the first body: the low is in.', dj ? 4 : 0);
  }
  if (bull(c0) && b0 >= 0.8 * a && b1 <= 0.4 * b0 && Math.min(c1.o, c1.c) >= c0.c - tol && bear(x) && x.c < mid(c0) && t3.t === 'up') {
    const dj = b1 <= 0.1 * rng(c1);
    if (dj && c1.l > c0.h && c1.l > x.h) add('abandoned', 'Bearish Abandoned Baby', 'bearish', 3, true, t3, 'A doji gapped away on both sides at the top: rare and reliable.');
    else add('evening', dj ? 'Evening Doji Star' : 'Evening Star', 'bearish', 3, true, t3, 'Rise, pause, then a strong red candle back into the first body: the high is in.', dj ? 4 : 0);
  }
  const b2 = B, rises = bull(c0) && bull(c1) && bull(x) && c1.c > c0.c && x.c > c1.c && c1.o >= c0.o && c1.o <= c0.c + tol && x.o >= c1.o && x.o <= c1.c + tol;
  const falls = bear(c0) && bear(c1) && bear(x) && c1.c < c0.c && x.c < c1.c && c1.o <= c0.o && c1.o >= c0.c - tol && x.o <= c1.o && x.o >= c1.c - tol;
  if (rises && Math.min(b0, b1, b2) >= 0.5 * a) {
    if (upW(c1) > upW(c0) && upW(x) > upW(c0) && b2 < b0 && t3.t === 'up') add('advblock', 'Advance Block', 'bearish', 3, true, t3, 'Three green candles but the bodies shrink and upper wicks grow: buyers are running out of steam.');
    else if (t3.t !== 'up' && Math.max(upW(c0), upW(c1), upW(x)) <= 0.3 * Math.max(b0, b1, b2)) add('soldiers', 'Three White Soldiers', 'bullish', 3, true, t3, 'Three strong green candles in a row from a low: a new uptrend is starting.', 0, t3.t === 'down');
  }
  if (falls && Math.min(b0, b1, b2) >= 0.5 * a && t3.t !== 'down' && Math.max(loW(c0), loW(c1), loW(x)) <= 0.3 * Math.max(b0, b1, b2)) add('crows', 'Three Black Crows', 'bearish', 3, true, t3, 'Three strong red candles in a row from a high: a new downtrend is starting.', 0, t3.t === 'up');
  return out;
}

// Did the NEXT candles confirm the signal? Bullish: a candle closes up above the signal close and the pattern low holds. Bearish is the mirror.
function evaluate(c: Candle[], p: Cdl, a: number): Cdl | null {
  const n = c.length, buy = p.dir === 'bullish', sig = c[p.i];
  if (p.dir === 'neutral') return p;
  for (let j = p.i + 1; j < n; j++) {
    if (buy ? c[j].c < p.low - 0.1 * a : c[j].c > p.high + 0.1 * a) return null; // pattern failed
    const holds = buy ? c[j].l >= p.low : c[j].h <= p.high;
    if (j <= p.i + 3 && holds && (buy ? c[j].c > sig.c && c[j].c > c[j].o : c[j].c < sig.c && c[j].c < c[j].o)) return { ...p, status: 'confirmed', confIdx: j };
  }
  return { ...p, status: n - 1 - p.i === 0 ? 'forming' : 'pending' };
}

const grade = (s: number): CdlSetup['grade'] => (s >= 85 ? 'A+' : s >= 70 ? 'A' : s >= 50 ? 'B' : 'C');

export function candlesAnalyze(c: Candle[]): Candles {
  const n = c.length, empty: Candles = { ok: false, trend: 'flat', list: [], bias: 'neutral' };
  if (n < 40) return { ...empty, reason: 'Need at least 40 candles.' };
  const env = envOf(c), a = env.a[n - 1];
  if (!fin(a) || a <= 0) return { ...empty, reason: 'No volatility data.' };
  const price = c[n - 1].c, tr = trendBefore(env, n);
  const list: Cdl[] = [];
  for (let i = n - 1; i >= n - 6; i--) {
    const cands = detect(env, i).sort((x, y) => y.strength - x.strength);
    // prefer a longer pattern when it is nearly as strong (the three-candle story is more complete)
    const best = cands.find((q) => q.kind === 3 && q.strength >= (cands[0]?.strength ?? 0) - 6) ?? cands[0];
    if (!best) continue;
    const ev = evaluate(c, best, a);
    if (!ev) continue;
    if (ev.status === 'pending' && ev.age > 3 && ev.dir !== 'neutral') continue; // never confirmed: stale
    list.push(ev);
  }
  const rank = (q: Cdl) => (q.trade && q.dir !== 'neutral' ? q.strength : q.strength - 25) + (q.status === 'confirmed' ? 10 : 0) - q.age * 3;
  list.sort((x, y) => rank(y) - rank(x));
  const actionable = list.filter((q) => q.trade && q.dir !== 'neutral' && q.strength >= 45);
  const best = actionable[0];
  const out: Candles = { ok: true, trend: tr.t, list, best, bias: best?.dir ?? 'neutral', last: list.find((q) => q.age === 0) ? { name: list.find((q) => q.age === 0)!.name, dir: list.find((q) => q.age === 0)!.dir } : undefined };
  if (!best) { out.why = list.length ? 'Only indecision candles (doji, harami) so far. Wait for a clear reversal candle at a support or resistance level.' : 'No candlestick pattern in the last 6 candles.'; return out; }

  // ---------- trade plan ----------
  const buy = best.dir === 'bullish', d = buy ? 1 : -1, sig = c[best.i];
  const sl = buy ? best.low - 0.2 * a : best.high + 0.2 * a;       // beyond the pattern, with a cushion for stop hunts
  const confHigh = best.confIdx >= 0 ? (buy ? c[best.confIdx].h : c[best.confIdx].l) : buy ? sig.h : sig.l;
  const trigger = confHigh + d * 0.05 * a;
  const passed = (price - trigger) * d >= 0;
  const entry = best.status === 'confirmed' ? (passed ? price : trigger) : trigger;
  let risk = Math.abs(entry - sl);
  if (risk < 0.5 * a) { out.why = 'The pattern is too small to trade: the stop would sit inside the normal noise.'; return out; }
  if (risk > 4.5 * a) { out.why = `${best.name} found, but the stop would be ${(risk / a).toFixed(1)} ATR away. Too wide, skip it.`; return out; }
  const levels = env.sr.filter((r) => (r.price - entry) * d > 0).map((r) => r.price);
  const tps = ladder(entry, sl, levels) as [number, number, number];
  const rr = tps.map((v) => Math.abs(v - entry) / risk) as [number, number, number];
  if ((price - tps[0]) * d >= 0) { out.why = `${best.name} already reached TP1. Do not chase it.`; return out; }
  if (c.slice(best.i + 1).some((q) => (buy ? q.l <= sl : q.h >= sl))) { out.why = `${best.name} was stopped out. Wait for the next one.`; return out; }

  const state: CdlSetup['state'] = best.status === 'confirmed' ? 'triggered' : 'armed';
  const confOk = best.status === 'confirmed';
  let score = best.strength + (confOk ? 8 : 0);
  if (!confOk) score = Math.min(score, 69); // never above B before the confirmation candle
  const confl = [
    ...best.reasons,
    { text: confOk ? `Confirmed: candle ${best.confIdx - best.i} after the signal closed ${buy ? 'higher' : 'lower'} and held the ${buy ? 'low' : 'high'}` : `Not confirmed yet: wait for a candle that closes ${buy ? 'above' : 'below'} ${sig.c.toFixed(4)} and holds the ${buy ? 'low' : 'high'}`, ok: confOk },
    { text: `TP1 risk:reward 1:${rr[0].toFixed(1)}`, ok: rr[0] >= 1.2 },
  ];
  const note = confOk
    ? `${best.name} confirmed. ${passed ? 'Price already broke the trigger, so this is a market entry.' : `Enter on a break ${buy ? 'above' : 'below'} the confirmation candle.`} Stop sits beyond the pattern with a cushion.`
    : `${best.name} just formed. Do NOT enter yet. Wait for the next candle to close ${buy ? 'higher with a higher low' : 'lower with a lower high'}, then enter on a break ${buy ? 'above' : 'below'} ${trigger.toFixed(4)}.`;
  out.setup = { side: buy ? 'buy' : 'sell', entry, sl, tps, rr, score: Math.max(0, Math.min(100, Math.round(score))), grade: grade(Math.max(0, Math.min(100, score))), state, trigger, pattern: best, confluence: confl, note };
  return out;
}

// Pattern labels for the chart (every candle in the last `look`, strongest per candle, weak ones skipped).
const SHORT: Record<string, string> = { hammer: 'H', invhammer: 'IH', hanging: 'HM', shooting: 'SS', dragonfly: 'DD', gravestone: 'GD', longleg: 'LL', doji: 'D', bullEng: 'BE', bearEng: 'BE', piercing: 'PL', darkcloud: 'DC', harami: 'HA', tweezer: 'TW', morning: 'MS', evening: 'ES', abandoned: 'AB', soldiers: '3WS', crows: '3BC', advblock: 'AD', maru: 'M' };
export function candleMarks(c: Candle[], look = 120): Mark[] {
  if (c.length < 40) return [];
  const env = envOf(c), out: Mark[] = [];
  for (let i = Math.max(26, c.length - look); i < c.length; i++) {
    const best = detect(env, i).filter((q) => q.trade && q.dir !== 'neutral' && q.strength >= 55).sort((x, y) => y.strength - x.strength)[0];
    if (best) out.push({ i, label: SHORT[best.key] ?? '?', dir: best.dir, strength: best.strength });
  }
  return out;
}

// Pattern guide (what it shows and how to trade it), written for the in-app help card.
export const GUIDE: { name: string; icon: string; dir: CDir; candles: number; shows: string; trade: string }[] = [
  { name: 'Hammer / Inverted Hammer', icon: 'T', dir: 'bullish', candles: 1, shows: 'After a fall, a small body with a long wick shows buyers rejecting lower prices (the inverted version shows them testing higher).', trade: 'Wait for the next candle to close up and keep a higher low. Buy above its high, stop under the hammer low.' },
  { name: 'Hanging Man / Shooting Star', icon: 'T', dir: 'bearish', candles: 1, shows: 'The same shapes after a rise. Heavy selling appeared and was only absorbed for the moment.', trade: 'Wait for a lower close with a lower high. Sell below its low, stop above the pattern high.' },
  { name: 'Doji family', icon: '+', dir: 'neutral', candles: 1, shows: 'Open and close almost equal: indecision. Dragonfly leans bullish, gravestone bearish, long-legged is the strongest reversal hint.', trade: 'Never trade a doji alone. Use it at support or resistance and confirm with the next candle, volume or momentum.' },
  { name: 'Engulfing', icon: 'E', dir: 'bullish', candles: 2, shows: 'A body that fully covers the previous opposite body at the end of a trend.', trade: 'Check the candles around it. Enter on a break of the engulfing candle extreme, stop beyond the pattern.' },
  { name: 'Piercing Line / Dark Cloud Cover', icon: 'P', dir: 'bullish', candles: 2, shows: 'The second candle closes past the middle of the first one: the move is under pressure.', trade: 'A bearish confirmation closing below the second candle close confirms Dark Cloud; the mirror confirms Piercing.' },
  { name: 'Morning / Evening Star', icon: '*', dir: 'bullish', candles: 3, shows: 'Strong move, a small pause candle, then a strong candle back the other way into the first body.', trade: 'Enter after the third candle closes beyond the first candle midpoint. Stop beyond the star.' },
  { name: 'Abandoned Baby', icon: 'A', dir: 'bullish', candles: 3, shows: 'Like a star, but the middle doji gaps away on both sides. Rarer and more reliable.', trade: 'Needs volume for a full reversal. Treat as an A-grade idea when it forms at a key level.' },
  { name: 'Three Soldiers / Crows', icon: '3', dir: 'bullish', candles: 3, shows: 'Three strong candles in the same direction from a turn: a new trend starting.', trade: 'Enter on the pullback after the third candle, not at the top of it.' },
  { name: 'Advance Block', icon: 'B', dir: 'bearish', candles: 3, shows: 'Three green candles with shrinking bodies and growing upper wicks: buyers fading at the peak.', trade: 'Bearish only after a long rise. Wait for a red candle to confirm.' },
];
