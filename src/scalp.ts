import type { Candle } from './markets';
import { atr, ema, rsi, pivots } from './ta';
import { sessionAt } from './indicators';

// =====================================================================================
// Scalping engine (runs on the phone). Made for M1 to M5 charts.
// Three models, all measured in ATR so they work on any market:
//   1. EMA pullback  : trend (EMA 9 > 21 > 50) pulls back to the EMA 21 and a rejection candle closes back out.
//   2. Micro breakout: 10 candles squeeze into a tight box, then one strong candle closes outside it.
//   3. Range fade    : flat EMAs, price stretched at the edge of a range with RSI(7) extreme and a rejection candle.
// Entry is the close of the trigger candle, stop is tight (0.5 to 1.8 ATR), targets are 1R / 1.5R / 2.2R.
// =====================================================================================

export type ScalpSetup = {
  side: 'buy' | 'sell'; model: string; entry: number; sl: number;
  tps: [number, number, number]; rr: [number, number, number];
  score: number; grade: 'A+' | 'A' | 'B' | 'C'; confluence: { text: string; ok: boolean }[]; note: string; barsAgo: number;
};
export type Scalp = {
  ok: boolean; reason?: string; price: number; atr: number;
  trend: 'up' | 'down' | 'flat'; rsi7: number;
  vol: 'dead' | 'ok' | 'wild'; volRatio: number;
  session: { name: string; good: boolean } | null;
  ema: { e9: number[]; e21: number[]; e50: number[] };
  setup?: ScalpSetup; why?: string;
};

export const SCALP_R: [number, number, number] = [1, 1.5, 2.2];

export { sessionAt };

type Cand = { side: 'buy' | 'sell'; model: string; j: number; entry: number; sl: number; trigger: string; value: boolean; note: string };

export function scalpAnalyze(c: Candle[], now = new Date(), opts: { sessions?: boolean } = {}): Scalp {
  const sessions = opts.sessions !== false;
  const emptyE = { e9: [] as number[], e21: [] as number[], e50: [] as number[] };
  const base: Scalp = { ok: false, price: c[c.length - 1]?.c ?? 0, atr: NaN, trend: 'flat', rsi7: NaN, vol: 'ok', volRatio: 1, session: sessions ? sessionAt(now) : null, ema: emptyE };
  if (c.length < 60) return { ...base, reason: 'Need at least 60 candles.' };
  const a = atr(c);
  if (!isFinite(a) || a <= 0) return { ...base, reason: 'No volatility data.' };

  const n = c.length, k = n - 2; // k = last CLOSED candle (the last one is still forming)
  const cl = c.map((x) => x.c);
  const e9 = ema(cl, 9), e21 = ema(cl, 21), e50 = ema(cl, 50);
  const rsi7At = (j: number) => rsi(cl.slice(0, j + 1), 7);
  const trendAt = (j: number): Scalp['trend'] => {
    const slope = (e21[j] - e21[j - 5]) / a;
    if (e9[j] > e21[j] && e21[j] > e50[j] && slope > 0.12) return 'up';
    if (e9[j] < e21[j] && e21[j] < e50[j] && slope < -0.12) return 'down';
    return 'flat';
  };

  // volatility: average true range of the last 14 candles against the 60 before them
  const tr = c.map((x, i) => (i === 0 ? x.h - x.l : Math.max(x.h - x.l, Math.abs(x.h - c[i - 1].c), Math.abs(x.l - c[i - 1].c))));
  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / Math.max(1, arr.length);
  const volRatio = avg(tr.slice(-14)) / (avg(tr.slice(-74, -14)) || 1);
  const vol: Scalp['vol'] = volRatio < 0.55 ? 'dead' : volRatio > 2.2 ? 'wild' : 'ok';
  const trend = trendAt(k), rsi7 = rsi7At(k);
  const out: Scalp = { ...base, ok: true, atr: a, trend, rsi7, vol, volRatio, ema: { e9, e21, e50 } };

  const range = (x: Candle) => Math.max(x.h - x.l, 1e-12);
  const lowerWick = (x: Candle) => Math.min(x.o, x.c) - x.l;
  const upperWick = (x: Candle) => x.h - Math.max(x.o, x.c);

  // ---------- find candidates on the last 3 closed candles ----------
  const cands: Cand[] = [];
  for (let j = k; j >= k - 2; j--) {
    const x = c[j], p = c[j - 1], tj = trendAt(j), r7 = rsi7At(j), r7p = rsi7At(j - 1);
    const bull = x.c > x.o, bear = x.c < x.o;
    const engBull = bull && p.c < p.o && x.c > p.o && x.o <= p.c, engBear = bear && p.c > p.o && x.c < p.o && x.o >= p.c;

    // 1. EMA pullback
    if (tj === 'up') {
      const touched = Math.min(x.l, p.l, c[j - 2].l) <= e21[j] + 0.25 * a;
      const trig = bull && (lowerWick(x) >= 0.35 * range(x) || engBull || x.c > p.h);
      if (touched && x.c > e21[j] && x.c > e50[j] && trig && r7 >= 35 && r7 <= 72 && r7 > r7p) {
        const sw = Math.min(x.l, p.l, c[j - 2].l);
        cands.push({ side: 'buy', model: 'EMA pullback (buy)', j, entry: x.c, sl: sw - 0.2 * a, trigger: engBull ? 'Bullish engulfing' : lowerWick(x) >= 0.35 * range(x) ? 'Rejection wick' : 'Close above the last high', value: x.c > e9[j], note: 'Trend pullback: price dipped into the EMA 21 area and closed back out.' });
      }
    }
    if (tj === 'down') {
      const touched = Math.max(x.h, p.h, c[j - 2].h) >= e21[j] - 0.25 * a;
      const trig = bear && (upperWick(x) >= 0.35 * range(x) || engBear || x.c < p.l);
      if (touched && x.c < e21[j] && x.c < e50[j] && trig && r7 <= 65 && r7 >= 28 && r7 < r7p) {
        const sw = Math.max(x.h, p.h, c[j - 2].h);
        cands.push({ side: 'sell', model: 'EMA pullback (sell)', j, entry: x.c, sl: sw + 0.2 * a, trigger: engBear ? 'Bearish engulfing' : upperWick(x) >= 0.35 * range(x) ? 'Rejection wick' : 'Close below the last low', value: x.c < e9[j], note: 'Trend pullback: price rallied into the EMA 21 area and closed back out.' });
      }
    }

    // 2. micro breakout out of a tight box
    const box = c.slice(j - 10, j), bh = Math.max(...box.map((q) => q.h)), bl = Math.min(...box.map((q) => q.l)), body = Math.abs(x.c - x.o);
    if (bh - bl <= 2.4 * a && body >= 0.8 * a) {
      if (bull && x.c > bh && x.c >= x.l + 0.65 * range(x) && tj !== 'down' && r7 > 55)
        cands.push({ side: 'buy', model: 'Micro breakout (buy)', j, entry: x.c, sl: Math.max(Math.min((bh + bl) / 2 - 0.1 * a, x.c - 0.6 * a), x.c - 1.8 * a), trigger: 'Strong close above the box', value: true, note: 'Squeeze then expansion: ten tight candles, then one strong close above the top.' });
      if (bear && x.c < bl && x.c <= x.h - 0.65 * range(x) && tj !== 'up' && r7 < 45)
        cands.push({ side: 'sell', model: 'Micro breakout (sell)', j, entry: x.c, sl: Math.min(Math.max((bh + bl) / 2 + 0.1 * a, x.c + 0.6 * a), x.c + 1.8 * a), trigger: 'Strong close below the box', value: true, note: 'Squeeze then expansion: ten tight candles, then one strong close below the bottom.' });
    }

    // 3. range fade (flat market only)
    if (tj === 'flat') {
      const rb = c.slice(j - 20, j), rh = Math.max(...rb.map((q) => q.h)), rl = Math.min(...rb.map((q) => q.l)), span = rh - rl;
      if (span >= 1.5 * a && span <= 5 * a) {
        const rmax = Math.max(r7, r7p, rsi7At(j - 2)), rmin = Math.min(r7, r7p, rsi7At(j - 2));
        if (x.h >= rh - 0.15 * a && x.c < rh && bear && upperWick(x) >= 0.4 * range(x) && rmax >= 75)
          cands.push({ side: 'sell', model: 'Range fade (sell)', j, entry: x.c, sl: Math.max(x.h, p.h) + 0.2 * a, trigger: 'Rejection at range top', value: true, note: 'Flat market: price stretched to the top of the range with RSI(7) above 75. Aim for the middle first.' });
        if (x.l <= rl + 0.15 * a && x.c > rl && bull && lowerWick(x) >= 0.4 * range(x) && rmin <= 25)
          cands.push({ side: 'buy', model: 'Range fade (buy)', j, entry: x.c, sl: Math.min(x.l, p.l) - 0.2 * a, trigger: 'Rejection at range bottom', value: true, note: 'Flat market: price stretched to the bottom of the range with RSI(7) below 25. Aim for the middle first.' });
      }
    }
  }

  // ---------- turn candidates into scored setups, drop dead ones ----------
  const piv = pivots(c, 2);
  type Built = { cand: Cand; setup: ScalpSetup };
  const built: Built[] = [];
  for (const cd of cands) {
    const buy = cd.side === 'buy';
    let sl = cd.sl, risk = Math.abs(cd.entry - sl);
    if (risk < 0.5 * a) { sl = buy ? cd.entry - 0.5 * a : cd.entry + 0.5 * a; risk = 0.5 * a; }
    if (risk > 1.8 * a) continue; // too wide for a scalp
    const tps = SCALP_R.map((r) => cd.entry + (buy ? 1 : -1) * r * risk) as [number, number, number];
    const after = c.slice(cd.j + 1);
    if (after.some((x) => (buy ? x.l <= sl : x.h >= sl))) continue;        // already stopped out
    if (after.some((x) => (buy ? x.h >= tps[0] : x.l <= tps[0]))) continue; // TP1 already hit

    const r7 = rsi7At(cd.j), tj = trendAt(cd.j), fade = cd.model.startsWith('Range');
    const nextSwing = (buy ? piv.hi.filter((q) => q.p > cd.entry && q.i <= cd.j) : piv.lo.filter((q) => q.p < cd.entry && q.i <= cd.j))
      .map((q) => Math.abs(q.p - cd.entry)).sort((x, y) => x - y)[0];
    const sessionOk = !sessions || !!base.session?.good;
    const conf: { text: string; ok: boolean }[] = [
      { text: fade ? 'EMAs flat: a range market suits a fade' : `EMA 9 / 21 / 50 stacked and sloping ${buy ? 'up' : 'down'}`, ok: fade ? tj === 'flat' : (buy ? tj === 'up' : tj === 'down') || cd.model.startsWith('Micro') },
      { text: fade ? 'Price stretched at the range edge' : cd.model.startsWith('Micro') ? 'Tight box before the breakout' : 'Pullback closed back beyond the EMA 9', ok: cd.value },
      { text: `Trigger: ${cd.trigger}`, ok: true },
      { text: `RSI(7) ${r7.toFixed(0)} ${fade ? 'at an extreme' : buy ? 'above 50' : 'below 50'}`, ok: fade ? (buy ? r7 < 45 : r7 > 55) : (buy ? r7 > 50 : r7 < 50) },
      { text: `Volatility ${vol === 'ok' ? 'healthy' : vol === 'dead' ? 'too quiet' : 'too wild'}`, ok: vol === 'ok' },
      { text: sessions ? `Session: ${base.session?.name}` : 'Market trades around the clock', ok: sessionOk },
      { text: 'Room to run: next swing is more than 1R away', ok: nextSwing === undefined || nextSwing >= risk },
      { text: `Tight stop: ${(risk / a).toFixed(1)} ATR`, ok: risk <= 1.5 * a },
    ];
    const pts = [20, 15, 15, 10, 10, 10, 12, 8];
    const score = Math.round(conf.reduce((s, x, i) => s + (x.ok ? pts[i] : 0), 0));
    const grade: ScalpSetup['grade'] = score >= 85 ? 'A+' : score >= 70 ? 'A' : score >= 50 ? 'B' : 'C';
    built.push({ cand: cd, setup: { side: cd.side, model: cd.model, entry: cd.entry, sl, tps, rr: SCALP_R, score, grade, confluence: conf, barsAgo: n - 1 - cd.j, note: `${cd.note} Close half at TP1 and move the stop to break-even. Skip the minutes around news.` } });
  }
  built.sort((x, y) => x.setup.barsAgo - y.setup.barsAgo || y.setup.score - x.setup.score);
  if (built[0]) out.setup = built[0].setup;
  else out.why = `No clean scalp trigger on the last 3 closed candles. EMAs: ${trend === 'flat' ? 'flat' : trend}, volatility: ${vol}. Wait for a pullback to the EMA 21, a squeeze breakout, or a stretched range edge.`;
  return out;
}
