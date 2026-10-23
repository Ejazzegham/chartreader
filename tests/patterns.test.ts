import { patternsAnalyze, PATTERN_GUIDE } from '../src/patterns';
import type { Candle } from '../src/markets';

let fails = 0;
const ok = (c: unknown, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const T0 = 1_760_000_000;
const lcg = (sd: number) => { let seed = sd; return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; };

// A price path through waypoints [candle, price] with a little noise, turned into candles.
function path(way: [number, number][], tail: number[] = [], seed = 7, jitter = 0.12): Candle[] {
  const rnd = lcg(seed), c: Candle[] = [];
  const end = way[way.length - 1][0];
  const at = (i: number) => { let k = 0; while (k < way.length - 2 && way[k + 1][0] <= i) k++; const [i0, p0] = way[k], [i1, p1] = way[k + 1]; return p0 + ((p1 - p0) * (i - i0)) / Math.max(1, i1 - i0); };
  for (let i = 0; i <= end; i++) {
    const p = at(i) + (rnd() - 0.5) * jitter, o = i ? c[i - 1].c : p;
    c.push({ t: T0 + i * 900, o, c: p, h: Math.max(o, p) + 0.12 + rnd() * 0.12, l: Math.min(o, p) - 0.12 - rnd() * 0.12 });
  }
  for (const p of tail) { const o = c[c.length - 1].c; c.push({ t: T0 + c.length * 900, o, c: p, h: Math.max(o, p) + 0.15, l: Math.min(o, p) - 0.15 }); }
  return c;
}
const flip = (c: Candle[], m: number): Candle[] => c.map((x) => ({ ...x, o: m - x.o, c: m - x.c, h: m - x.l, l: m - x.h }));
const has = (c: Candle[], name: string) => patternsAnalyze(c).list.find((p) => p.name === name);

// ---------- triple top / bottom ----------
const tt = path([[0, 90], [25, 110], [35, 104], [45, 110], [55, 104], [65, 110], [75, 103]]);
ok(has(tt, 'Triple top')?.dir === 'bearish', 'triple top found (three equal highs)');
const ttp = has(tt, 'Triple top')!;
ok(ttp && ttp.sl > ttp.entry && ttp.target < ttp.entry, 'triple top: stop above, target below the entry');
ok(has(flip(tt, 200), 'Triple bottom')?.dir === 'bullish', 'triple bottom found (mirror)');

// ---------- bull flag / bearish flag ----------
const flagWay: [number, number][] = [[0, 100], [25, 100], [33, 112], [36, 110.2], [39, 111.2], [42, 109.4], [45, 110.4], [48, 108.8], [50, 109.5]];
const bf = path(flagWay);
const bfp = has(bf, 'Bull flag');
ok(bfp?.dir === 'bullish' && bfp.status === 'forming', 'bull flag found while forming');
ok(bfp && bfp.target > bfp.entry && bfp.sl < bfp.entry && Math.abs(bfp.target - bfp.entry) > 10, 'bull flag: target = the pole height above the entry, stop under the flag');
ok(has(path(flagWay, [111.5]), 'Bull flag')?.status === 'breakout', 'bull flag breakout after a close above the flag line');
ok(has(flip(bf, 200), 'Bearish flag')?.dir === 'bearish', 'bearish flag found (mirror)');

// ---------- pennants ----------
const penWay: [number, number][] = [[0, 100], [25, 100], [33, 112], [36, 109.4], [39, 111.2], [42, 109.9], [45, 110.7], [48, 110.2], [51, 110.5]];
const bp = path(penWay);
ok(has(bp, 'Bullish pennant')?.dir === 'bullish', 'bullish pennant found');
ok(has(flip(bp, 200), 'Bearish pennant')?.dir === 'bearish', 'bearish pennant found (mirror)');

// ---------- cup and handle / inverse, rounding bottom / top ----------
const cupWay = (): [number, number][] => {
  const w: [number, number][] = [[0, 90], [20, 110]];
  for (let i = 22; i <= 80; i += 2) w.push([i, 105 + 5 * Math.cos((2 * Math.PI * (i - 20)) / 60)]);
  return w;
};
const cup = path([...cupWay(), [84, 107.8], [88, 107.6], [94, 109.3]]);
const cp = has(cup, 'Cup and handle');
ok(cp?.dir === 'bullish', 'cup and handle found');
ok(cp && Math.abs(cp.target - cp.entry - 10) < 1.5 && cp.sl < 108, 'cup: target = the cup depth above the rim, stop under the handle');
ok(has(flip(cup, 200), 'Inverse cup and handle')?.dir === 'bearish', 'inverse cup and handle found (mirror)');
const round = path([...cupWay(), [84, 109.0], [88, 109.5]]);
ok(has(round, 'Rounding bottom')?.dir === 'bullish', 'rounding bottom found');
ok(has(flip(round, 200), 'Rounding top')?.dir === 'bearish', 'rounding top found (mirror)');
ok(!patternsAnalyze(path([[0, 110], [30, 100], [60, 110], [75, 108.5], [90, 109.4]])).list.some((p) => /cup|rounding/i.test(p.name)), 'a sharp V is not a cup');

// ---------- rectangle, wedges, existing patterns keep working ----------
const rect = path([[0, 90], [25, 106], [33, 100], [41, 106], [49, 100], [57, 106], [65, 100], [72, 105]]);
ok(patternsAnalyze(rect).list.some((p) => p.name === 'Bullish rectangle'), 'bullish rectangle (range after an up move)');
ok(patternsAnalyze(flip(rect, 200)).list.some((p) => p.name === 'Bearish rectangle'), 'bearish rectangle (range after a down move)');
const dt = path([[0, 90], [20, 110], [30, 102], [45, 110], [57, 102], [70, 106], [78, 101]]);
ok(patternsAnalyze(dt).list.some((p) => p.name === 'Double top' || p.name === 'Head and shoulders' || p.name === 'Triple top'), 'double top family still found');

// ---------- guide covers every name the detector can produce ----------
const names = ['Head and shoulders', 'Inverse head and shoulders', 'Double top', 'Double bottom', 'Triple top', 'Triple bottom', 'Descending triangle', 'Ascending triangle', 'Bearish flag', 'Bull flag', 'Bearish pennant', 'Bullish pennant', 'Bearish wedge', 'Bullish wedge', 'Bearish rectangle', 'Bullish rectangle', 'Inverse cup and handle', 'Cup and handle', 'Rounding top', 'Rounding bottom', 'Symmetrical triangle'];
ok(names.every((n) => PATTERN_GUIDE.some((g) => g.name === n)) && PATTERN_GUIDE.length === names.length, 'pattern guide lists all ' + names.length + ' patterns');

// ---------- random walks: no crash, a setup is always on the right side ----------
let bad = 0;
for (let s = 1; s <= 300; s++) {
  const rnd = lcg(s * 13 + 1), c: Candle[] = []; let p = 100;
  for (let i = 0; i < 40 + Math.floor(rnd() * 200); i++) { const o = p; p += (rnd() - 0.5) * 1.2 + Math.sin(i / (8 + (s % 9))) * 0.4; c.push({ t: T0 + i * 900, o, c: p, h: Math.max(o, p) + rnd() * 0.4, l: Math.min(o, p) - rnd() * 0.4 }); }
  const r = patternsAnalyze(c);
  if (r.setup) { const sp = r.setup; if (sp.side === 'buy' ? !(sp.sl < sp.entry && sp.tps[0] > sp.entry) : !(sp.sl > sp.entry && sp.tps[0] < sp.entry)) bad++; }
  for (const q of r.list) if (![q.entry, q.sl, q.target, q.quality].every(isFinite)) bad++;
}
ok(bad === 0, 'random walks: every setup has its stop and targets on the right side, no NaN');

console.log(fails ? `\n${fails} FAILED` : '\nall pattern tests passed');
process.exit(fails ? 1 : 0);
