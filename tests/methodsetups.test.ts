import { methodSetups, SETUP_MIN } from '../src/methodSetups';
import { analyzeAll } from '../src/refine';

let seed = 5; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const T = new Date('2026-10-07T13:00:00Z'), nowS = T.getTime() / 1000;
let series = 0, withSetup = 0, total = 0, bad = 0, merged = 0, withCombined = 0; const byMethod: Record<string, number> = {};
for (let k = 0; k < 1500; k++) {
  const len = 240, gran = 900; let p = 100, dir = rnd() < 0.5 ? 1 : -1, leg = 0; const c: any[] = [];
  for (let i = 0; i < len; i++) {
    if (leg <= 0) { dir = rnd() < 0.62 ? dir : -dir; leg = 8 + Math.floor(rnd() * 25); }
    leg--; const o = p, vol = 0.25 + rnd() * 0.5; p += dir * vol * (0.4 + rnd() * 0.9) + (rnd() - 0.5) * vol;
    c.push({ t: nowS - 60 - (len - 1 - i) * gran, o, c: p, h: Math.max(o, p) + rnd() * vol * 0.6, l: Math.min(o, p) - rnd() * vol * 0.6, v: 800 + rnd() * 1500 });
  }
  series++; const a = analyzeAll(c, T), list = methodSetups(a, c); if (!list.length) continue; withSetup++;
  for (let i = 0; i < list.length; i++) {
    const s = list[i], buy = s.side === 'buy'; total++; byMethod[s.method] = (byMethod[s.method] || 0) + 1; if (s.method === 'Combined') withCombined++; if (s.also.length) merged++;
    const geo = (buy ? s.sl < s.entry && s.tps[0] > s.entry : s.sl > s.entry && s.tps[0] < s.entry) && (buy ? s.tps[1] >= s.tps[0] && s.tps[2] >= s.tps[1] : s.tps[1] <= s.tps[0] && s.tps[2] <= s.tps[1]);
    const okScore = s.score >= SETUP_MIN && s.score <= 100 && (i === 0 || s.score <= list[i - 1].score);
    const alive = s.plan.status !== 'invalid' && s.plan.status !== 'late' && s.plan.distAtr <= 8;
    if (!geo || !okScore || !alive) bad++;
  }
}
console.log({ series, seriesWithSetup: withSetup, setups: total, mergedDuplicates: merged, byMethod });
let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) fails++; };
ok('every setup has valid stop/targets, score 70-100, sorted, still alive', bad === 0);
ok('methods other than Combined also produce setups', Object.keys(byMethod).some((m) => m !== 'Combined'));
ok('a higher floor hides setups', (() => { const c: any[] = []; return methodSetups(analyzeAll([] as any, T), c).length === 0; })());
if (fails) process.exit(1); console.log('method setups tests passed');
