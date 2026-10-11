import { crtAnalyze } from '../src/crt';
import type { Candle } from '../src/markets';
const way: [number, number][] = [[0, 105], [60, 104], [120, 105.5], [132, 105], [136, 100.3], [141, 109.6], [143, 108.5],[144, 108.8], [145, 109.6], [146, 111.2], [147, 109.4]];
const res: Record<string, number> = {}; const whys: Record<string, number> = {};
for (let sd = 1; sd <= 60; sd++) {
  let seed = sd * 977; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const path: number[] = [];
  for (let i = 0; i < 148; i++) { let k = 0; while (k < way.length - 2 && way[k + 1][0] <= i) k++; const [i0, p0] = way[k], [i1, p1] = way[k + 1]; path.push(p0 + ((p1 - p0) * (i - i0)) / Math.max(1, i1 - i0)); }
  const t0 = Math.floor(1_760_000_000 / 3600) * 3600;
  const c: Candle[] = path.map((p, i) => { const o = i ? path[i - 1] : p, cc = p + (rnd() - 0.5) * 0.25; return { t: t0 + i * 300, o, c: cc, h: Math.max(o, cc) + rnd() * 0.3, l: Math.min(o, cc) - rnd() * 0.3 }; });
  const r = crtAnalyze(c, 300, new Date('2026-10-05T13:00:00Z'), { dec: 2 });
  res[r.state] = (res[r.state] ?? 0) + 1; if (r.why) whys[r.why] = (whys[r.why] ?? 0) + 1;
}
console.log(res, whys);
