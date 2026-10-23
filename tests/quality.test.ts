import { analyzeAll, autoHtf } from '../src/refine';
import { qualify } from '../src/verdict';
import { planEntry } from '../src/entry';
import { QUALITY } from '../src/quality';
let fails = 0;
const ok = (name: string, c: boolean) => { console.log((c ? 'PASS ' : 'FAIL ') + name); if (!c) fails++; };
let seed = 9; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const mk = (n: number, g: number, t0: number) => { let p = 100, tr = 0; return Array.from({ length: n }, (_, i) => { const o = p; if (i % 120 === 0) tr = (rnd() - 0.5) * 0.3; p += tr + Math.sin(i / 11) * 0.3 + (rnd() - 0.5) * 0.5; return { t: t0 + i * g, o, c: p, h: Math.max(o, p) + rnd() * 0.3, l: Math.min(o, p) - rnd() * 0.3, v: 100 }; }); };

// higher timeframe built from the candles: complete buckets only, aligned, OHLC correct
const m15 = mk(400, 900, 1_760_000_000 - (1_760_000_000 % 3600));
const h1 = autoHtf(m15)!;
ok('autoHtf builds 1h candles from 15m', !!h1 && h1.length >= 90 && h1.every((x) => x.t % 3600 === 0));
ok('autoHtf high/low/open/close are right', (() => { const b = h1[5], src = m15.filter((x) => x.t >= b.t && x.t < b.t + 3600); return b.h === Math.max(...src.map((x) => x.h)) && b.l === Math.min(...src.map((x) => x.l)) && b.o === src[0].o && b.c === src[src.length - 1].c; })());
ok('autoHtf drops an incomplete last bucket', autoHtf(m15.slice(0, 399))!.length <= h1.length && autoHtf(m15.slice(0, 399))!.every((x) => x.t + 3600 <= m15[398].t + 900));
ok('autoHtf needs a known timeframe', autoHtf(mk(400, 777, 1_760_000_000)) === undefined);

// every combined setup now carries a higher-timeframe verdict without the screen passing one
let combos = 0, withHtf = 0, tp1ok = 0, entryEdge = 0, trades = 0;
for (let k = 0; k < 400; k++) {
  const c = mk(260, 900, 1_760_000_000 - (1_760_000_000 % 3600)), a = analyzeAll(c, new Date('2026-10-07T13:00:00Z'));
  if (!a.combo) continue; combos++;
  const cb = a.combo; if (cb.htf) withHtf++;
  if (cb.rr[0] <= QUALITY.tp1R + 0.01) tp1ok++;
  if (cb.zoneTop >= cb.entry - 1e-9 && cb.zoneBottom <= cb.entry + 1e-9 || cb.basis.includes('level') || cb.basis.includes('candle') || cb.basis.includes('bar')) entryEdge++;
  const q = qualify(a, { id: 'R_100', cat: 'deriv', now: new Date('2026-10-07T13:00:00Z'), c });
  if (q.trade) { trades++; ok('a TRADE has the higher timeframe with it and a fillable entry', cb.htf === 'with' && (cb.plan.status === 'enter-now' || cb.plan.distAtr <= QUALITY.maxDistAtr) && q.reasons.length === 0 && cb.score >= QUALITY.minScore); }
  else ok('a WAIT always says why', q.reasons.length > 0 && q.grade === null);
}
console.log(`synthetic: ${combos} setups, ${trades} trades`);
ok('setups exist', combos > 20);
ok('TP1 is never farther than tp1R', tp1ok === combos);
ok('entry stays inside its zone', entryEdge === combos);
ok('most setups are not TRADE (the gate selects)', trades < combos / 2);

// entry planner: a zone that is too far is "far", not a limit order
const c0 = mk(120, 900, 1_760_000_000), last = c0[c0.length - 1].c;
const far = planEntry(c0, 'buy', last - 5, last - 6, last - 4.8, last - 5.2, last + 1, 1, undefined, last);
ok('3+ ATR away is "far" (not offered as a limit)', far.status === 'far');
if (fails) { console.log(fails + ' FAILED'); process.exit(1); }
