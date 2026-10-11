import { candlesAnalyze, candleMarks } from '../src/candles';
import type { Candle } from '../src/markets';
const t0 = 1_760_000_000;
function trend(dir: 'down' | 'up', n = 45): Candle[] {
  const out: Candle[] = []; let p = dir === 'down' ? 120 : 80, seed = 11;
  const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < n; i++) { const o = p, c = p + (dir === 'down' ? -0.6 : 0.6) + (r() - 0.5) * 0.4; p = c; out.push({ t: t0 + i * 300, o, c, h: Math.max(o, c) + 0.25 + r() * 0.2, l: Math.min(o, c) - 0.25 - r() * 0.2 }); }
  return out;
}
const K = (base: Candle[], rows: [number, number, number, number][]) => { const c = [...base]; rows.forEach(([o, cl, h, l]) => c.push({ t: t0 + c.length * 300, o, c: cl, h, l })); return c; };
const show = (name: string, c: Candle[]) => { const r = candlesAnalyze(c); console.log(name.padEnd(30), '→', r.best ? `${r.best.name} [${r.best.dir}] str ${r.best.strength} ${r.best.status}` : 'none', r.setup ? `| ${r.setup.side} ${r.setup.state} entry ${r.setup.entry.toFixed(2)} sl ${r.setup.sl.toFixed(2)} tp1 ${r.setup.tps[0].toFixed(2)} score ${r.setup.score}${r.setup.grade}` : `| ${r.why ?? ''}`); return r; };
const D = trend('down'), U = trend('up'); const dl = D[D.length - 1].c, ul = U[U.length - 1].c;
show('hammer after fall', K(D, [[dl - 0.3, dl + 0.3, dl + 0.4, dl - 2.4]]));
show('  + confirmation candle', K(D, [[dl - 0.3, dl + 0.3, dl + 0.4, dl - 2.4], [dl + 0.3, dl + 1.4, dl + 1.6, dl - 0.1]]));
show('hanging man after rise (same shape)', K(U, [[ul + 0.3, ul - 0.3, ul + 0.4, ul - 2.4]]));
show('shooting star after rise', K(U, [[ul + 0.3, ul - 0.3, ul + 2.4, ul - 0.4]]));
show('bullish engulfing', K(D, [[dl + 0.2, dl - 0.9, dl + 0.3, dl - 1.0], [dl - 1.0, dl + 0.9, dl + 1.0, dl - 1.1]]));
show('bearish engulfing', K(U, [[ul - 0.2, ul + 0.9, ul + 1.0, ul - 0.3], [ul + 1.0, ul - 0.9, ul + 1.1, ul - 1.0]]));
show('morning star', K(D, [[dl, dl - 1.6, dl + 0.1, dl - 1.7], [dl - 1.8, dl - 1.9, dl - 1.6, dl - 2.1], [dl - 1.8, dl - 0.2, dl - 0.1, dl - 1.9]]));
show('evening star', K(U, [[ul, ul + 1.6, ul + 1.7, ul - 0.1], [ul + 1.8, ul + 1.9, ul + 2.1, ul + 1.6], [ul + 1.8, ul + 0.2, ul + 1.9, ul + 0.1]]));
show('bullish abandoned baby', K(D, [[dl, dl - 1.6, dl + 0.1, dl - 1.7], [dl - 2.4, dl - 2.4, dl - 2.1, dl - 2.7], [dl - 1.4, dl - 0.1, dl, dl - 1.5]]));
show('three white soldiers', K(D, [[dl - 0.6, dl + 0.6, dl + 0.7, dl - 0.7], [dl + 0.5, dl + 1.7, dl + 1.8, dl + 0.4], [dl + 1.6, dl + 2.8, dl + 2.9, dl + 1.5]]));
show('advance block', K(U, [[ul, ul + 1.4, ul + 1.5, ul - 0.1], [ul + 1.0, ul + 2.2, ul + 2.7, ul + 0.9], [ul + 2.0, ul + 2.7, ul + 3.4, ul + 1.9]]));
show('dark cloud cover', K(U, [[ul, ul + 1.5, ul + 1.6, ul - 0.1], [ul + 1.55, ul + 0.5, ul + 1.7, ul + 0.4]]));
show('piercing line', K(D, [[dl, dl - 1.5, dl + 0.1, dl - 1.6], [dl - 1.55, dl - 0.6, dl - 0.5, dl - 1.7]]));
show('plain doji in downtrend', K(D, [[dl, dl + 0.02, dl + 0.5, dl - 0.5]]));
show('hammer in SIDEWAYS (should skip)', K(Array.from({ length: 45 }, (_, i) => ({ t: t0 + i * 300, o: 100 + (i % 2) * 0.2, c: 100.1 + ((i + 1) % 2) * 0.2, h: 100.6, l: 99.7 })), [[100, 100.1, 100.2, 98.0]]));
const marks = candleMarks(K(D, [[dl - 0.3, dl + 0.3, dl + 0.4, dl - 2.4], [dl + 0.3, dl + 1.4, dl + 1.6, dl - 0.1]]));
console.log('marks', JSON.stringify(marks));
