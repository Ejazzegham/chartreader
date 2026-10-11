import { crtAnalyze, refineScalp } from '../src/crt';
import * as I from '../src/indicators';
import type { Candle } from '../src/markets';

let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
function build(way: [number, number][], n: number, flip = false): Candle[] {
  const path: number[] = [];
  for (let i = 0; i < n; i++) {
    let k = 0; while (k < way.length - 2 && way[k + 1][0] <= i) k++;
    const [i0, p0] = way[k], [i1, p1] = way[k + 1];
    path.push(p0 + ((p1 - p0) * (i - i0)) / Math.max(1, i1 - i0));
  }
  const t0 = Math.floor(1_760_000_000 / 3600) * 3600; // hour aligned
  return path.map((p, i) => {
    const pp = flip ? 210 - p : p, prev = i ? (flip ? 210 - path[i - 1] : path[i - 1]) : pp;
    const nz = (rnd() - 0.5) * 0.25;
    const o = prev, c = pp + nz;
    return { t: t0 + i * 300, o, c, h: Math.max(o, c) + rnd() * 0.3, l: Math.min(o, c) - rnd() * 0.3, v: 100 + rnd() * 50 };
  });
}
// 12 M5 candles per hour. C1 = hour 11 (idx 132..143), C2 = hour 12 (idx 144..)
const way: [number, number][] = [[0, 105], [60, 104], [120, 105.5], [132, 105], [136, 100.3], [141, 109.6], [143, 108.5],
  [144, 108.8], [145, 109.6], [146, 111.2], [147, 109.4], [148, 107.9], [149, 106.8], [150, 106.6]];
for (const flip of [false, true]) {
  const c = build(way, 151, flip);
  const r = crtAnalyze(c, 300, new Date('2026-10-05T13:00:00Z'), { dec: 2 });
  console.log(flip ? 'BUY mirror' : 'SELL', JSON.stringify({ ok: r.ok, state: r.state, why: r.why, reason: r.reason, c1: r.c1 && [r.c1.h.toFixed(2), r.c1.l.toFixed(2), r.c1.eq.toFixed(2)], sweep: r.sweep, mss: r.mss }));
  if (r.setup) { const s = r.setup; console.log('  ', s.side, s.state, 'entry', s.entry.toFixed(2), 'sl', s.sl.toFixed(2), 'tps', s.tps.map((x) => x.toFixed(2)).join('/'), 'rr', s.rr.map((x) => x.toFixed(1)).join('/'), 'score', s.score, s.grade, 'ago', s.barsAgo); s.confluence.forEach((x) => console.log('     ', x.ok ? '✓' : '○', x.text)); }
}
// armed case: sweep done but no shift yet (cut the path early)
const armed = build(way.slice(0, 11), 148);
const ra = crtAnalyze(armed, 300, new Date('2026-10-05T13:00:00Z'), { dec: 2 });
console.log('ARMED?', ra.state, ra.setup && [ra.setup.side, ra.setup.state, ra.setup.score, ra.setup.grade, ra.setup.entry.toFixed(2)], ra.why);

// indicators sanity
const c = build(way, 151);
const cl = c.map((x) => x.c);
const chk = (name: string, a: number[]) => { const v = a[a.length - 1]; console.log(name.padEnd(12), Number.isFinite(v) ? v.toFixed(3) : 'NaN', 'len', a.length === c.length ? 'ok' : 'BAD'); };
chk('sma20', I.sma(cl, 20)); chk('ema50', I.emaS(cl, 50)); chk('rsi', I.rsiSeries(cl)); chk('macd', I.macdSeries(cl).hist);
chk('boll up', I.bollinger(cl).up); chk('atr', I.atrSeries(c)); chk('stochK', I.stoch(c).k); chk('adx', I.adxSeries(c).adx);
chk('cci', I.cci(c)); chk('wpr', I.williamsR(c)); chk('supertrend', I.supertrend(c).line); chk('psar', I.psar(c).v);
chk('ichi spanA', I.ichimoku(c).spanA); chk('vwap', I.vwap(c)); chk('obv', I.obv(c));
const rsiRef = (v: number[], n = 14) => { let g = 0, l = 0; for (let i = 1; i <= n; i++) { const d = v[i] - v[i - 1]; if (d >= 0) g += d; else l -= d; } g /= n; l /= n; for (let i = n + 1; i < v.length; i++) { const d = v[i] - v[i - 1]; g = (g * (n - 1) + Math.max(d, 0)) / n; l = (l * (n - 1) + Math.max(-d, 0)) / n; } return 100 - 100 / (1 + g / l); };
console.log('rsi vs reference', I.rsiSeries(cl)[cl.length - 1].toFixed(4), rsiRef(cl).toFixed(4));
console.log('fib', JSON.stringify(I.fibonacci(c)?.levels.slice(0, 4).map((x) => [x.r, +x.price.toFixed(2)])), 'S/R', I.supportResistance(c).map((x) => x.kind[0] + x.price.toFixed(1) + 'x' + x.touches).join(' '));
console.log('hasVolume', I.hasVolume(c), 'div', I.rsiDivergence(c));
