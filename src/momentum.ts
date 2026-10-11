import { emaS, rsiSeries, macdSeries, adxSeries, stoch, atrSeries, hasVolume, fin } from './indicators';
import type { Candle } from './markets';

// Momentum reading: five or six indicator votes (trend, RSI, MACD, ADX, stochastic, volume). Used by Momentum & Volume and by its score on the Analysis page.
export type Mom = {
  ok: boolean; score: number; bias: 'bullish' | 'bearish' | 'neutral'; strength: string; volatility: string;
  checks: { text: string; ok: boolean }[]; rsi: number; adx: number; pdi: number; mdi: number; macd: number; stochK: number; atrPct: number; volRatio: number | null;
};
const mean = (a: number[]) => { const v = a.filter(fin); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };

export function momentum(c: Candle[]): Mom {
  const none: Mom = { ok: false, score: 0, bias: 'neutral', strength: '', volatility: '', checks: [], rsi: NaN, adx: NaN, pdi: NaN, mdi: NaN, macd: NaN, stochK: NaN, atrPct: NaN, volRatio: null };
  if (c.length < 60) return none;
  const cl = c.map((x) => x.c), n = cl.length - 1, p = cl[n];
  const e20 = emaS(cl, 20)[n], e50 = emaS(cl, 50)[n];
  const rsi = rsiSeries(cl, 14)[n];
  const mh = macdSeries(cl).hist, h = mh[n], hp = mh[n - 1];
  const ax = adxSeries(c, 14), adx = ax.adx[n], pdi = ax.pdi[n], mdi = ax.mdi[n];
  const st = stoch(c), k = st.k[n], d = st.d[n];
  const atrS = atrSeries(c, 14), at = atrS[n], atAvg = mean(atrS.slice(Math.max(0, n - 49), n + 1));

  const votes: { text: string; v: 1 | -1 | 0 }[] = [];
  if (fin(e20) && fin(e50)) votes.push({ text: p > e20 && e20 > e50 ? 'Trend: price above EMA 20 and EMA 50 (up)' : p < e20 && e20 < e50 ? 'Trend: price below EMA 20 and EMA 50 (down)' : 'Trend: EMAs mixed', v: p > e20 && e20 > e50 ? 1 : p < e20 && e20 < e50 ? -1 : 0 });
  if (fin(rsi)) votes.push({ text: `RSI ${rsi.toFixed(0)}: ${rsi > 55 ? 'bullish momentum' : rsi < 45 ? 'bearish momentum' : 'neutral zone'}`, v: rsi > 55 ? 1 : rsi < 45 ? -1 : 0 });
  if (fin(h) && fin(hp)) votes.push({ text: `MACD histogram ${h > 0 ? 'above' : 'below'} zero and ${h > hp ? 'rising' : 'falling'}`, v: h > 0 && h > hp ? 1 : h < 0 && h < hp ? -1 : 0 });
  if (fin(adx) && fin(pdi) && fin(mdi)) votes.push({ text: `ADX ${adx.toFixed(0)}: ${adx < 20 ? 'no clear trend' : pdi > mdi ? 'buyers lead' : 'sellers lead'}`, v: adx >= 20 ? (pdi > mdi ? 1 : -1) : 0 });
  if (fin(k) && fin(d)) votes.push({ text: `Stochastic ${k.toFixed(0)}: ${k > 50 && k > d ? 'rising above 50' : k < 50 && k < d ? 'falling below 50' : 'no clear push'}`, v: k > 50 && k > d ? 1 : k < 50 && k < d ? -1 : 0 });
  let volRatio: number | null = null;
  if (hasVolume(c)) {
    const vols = c.map((x) => x.v ?? 0), avg = mean(vols.slice(Math.max(0, n - 20), n)), now = mean(vols.slice(n - 2, n + 1));
    if (fin(avg) && avg > 0 && fin(now)) {
      volRatio = now / avg;
      const up = c[n].c >= c[n].o;
      votes.push({ text: `Volume ${volRatio.toFixed(1)}x the average${volRatio > 1.2 ? (up ? ', buyers pushing' : ', sellers pushing') : ', no surge'}`, v: volRatio > 1.2 ? (up ? 1 : -1) : 0 });
    }
  }
  const bull = votes.filter((x) => x.v === 1).length, bear = votes.filter((x) => x.v === -1).length, N = votes.length;
  if (!N) return none;
  const top = Math.max(bull, bear);
  const bias = bull > bear && top / N >= 0.5 ? 'bullish' : bear > bull && top / N >= 0.5 ? 'bearish' : 'neutral';
  const dom = bias === 'bullish' ? 1 : bias === 'bearish' ? -1 : 0;
  const ratio = fin(at) && fin(atAvg) && atAvg > 0 ? at / atAvg : 1;
  return {
    ok: true, score: Math.round((100 * top) / N), bias,
    strength: !fin(adx) ? '' : adx < 20 ? 'No clear trend' : adx < 25 ? 'Trend developing' : adx < 40 ? 'Strong trend' : 'Very strong trend',
    volatility: ratio > 1.3 ? 'Expanding' : ratio < 0.75 ? 'Contracting' : 'Normal',
    checks: votes.map((x) => ({ text: x.text, ok: dom !== 0 && x.v === dom })),
    rsi, adx, pdi, mdi, macd: h, stochK: k, atrPct: fin(at) ? (at / p) * 100 : NaN, volRatio,
  };
}

