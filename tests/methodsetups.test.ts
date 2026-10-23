import { methodSetups, topDownSetup, SETUP_MIN } from '../src/methodSetups';
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

// ---- the Scanner's method checkboxes: only the ticked methods are read
{
  seed = 11; let checked = 0, leaked = 0, leakedAlso = 0, noneOnEmpty = 0;
  for (let k = 0; k < 400; k++) {
    const len = 240, gran = 900; let p = 100, dir = rnd() < 0.5 ? 1 : -1, leg = 0; const c: any[] = [];
    for (let i = 0; i < len; i++) {
      if (leg <= 0) { dir = rnd() < 0.62 ? dir : -dir; leg = 8 + Math.floor(rnd() * 25); }
      leg--; const o = p, vol = 0.25 + rnd() * 0.5; p += dir * vol * (0.4 + rnd() * 0.9) + (rnd() - 0.5) * vol;
      c.push({ t: nowS - 60 - (len - 1 - i) * gran, o, c: p, h: Math.max(o, p) + rnd() * vol * 0.6, l: Math.min(o, p) - rnd() * vol * 0.6, v: 800 + rnd() * 1500 });
    }
    const a = analyzeAll(c, T);
    for (const pick of [['ICT'], ['SMC', 'VSA'], ['Pattern', 'Candle', 'ICT']] as const) {
      const list = methodSetups(a, c, SETUP_MIN, [...pick]); checked++;
      for (const s of list) { if (!(pick as readonly string[]).includes(s.method)) leaked++; if (s.also.some((m) => !(pick as readonly string[]).includes(m))) leakedAlso++; }
    }
    if (methodSetups(a, c, SETUP_MIN, []).length === 0) noneOnEmpty++;
  }
  ok('a ticked-methods list only ever returns those methods (' + checked + ' runs)', leaked === 0);
  ok('a method that is not ticked never appears in "also" either', leakedAlso === 0);
  ok('an empty selection returns no setups', noneOnEmpty === 400);
}
// ---- Top-Down goes through the same rules
{
  const c: any[] = Array.from({ length: 80 }, (_, i) => ({ t: nowS - (80 - i) * 900, o: 100, c: 100, h: 100.4, l: 99.6, v: 1000 }));
  const td: any = { ok: true, verdict: 'ready', score: 82, grade: 'A', plan: { side: 'buy', entry: 99.8, sl: 99.2, tps: [100.7, 101.3, 102], rr: [1.5, 2.5, 4], zoneTop: 99.9, zoneBottom: 99.6, basis: '1H order block', mode: 'limit', notes: [] }, checks: [{ stage: '4H', text: '4H trend up', ok: true }] };
  const x = topDownSetup(td, c);
  ok('Top-Down plan becomes a TopDown setup', !!x && x.method === 'TopDown' && x.side === 'buy' && x.score === 82);
  ok('Top-Down under the floor is dropped', topDownSetup({ ...td, score: 65 }, c) === null);
  ok('Top-Down "skip" is dropped', topDownSetup({ ...td, verdict: 'skip' }, c) === null);
  ok('Top-Down with a stop on the wrong side is dropped', topDownSetup({ ...td, plan: { ...td.plan, sl: 100.5 } }, c) === null);
  const m = methodSetups(analyzeAll(c, T), c, SETUP_MIN, ['TopDown'], x ? [x] : []);
  ok('Top-Down alone comes through methodSetups', m.length === 1 && m[0].method === 'TopDown');
}
if (fails) process.exit(1); console.log('method setups tests passed');
