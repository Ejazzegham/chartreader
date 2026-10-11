import { step, planFromPct, defaultPlanPct, Signal } from '../src/trades';

let fails = 0;
const ok = (c: unknown, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

// a running BUY: fill 100, stop 99 (1R = 1.0), TPs 101 / 102 / 103, risk $100
const mk = (over: Partial<Signal> = {}): Signal => ({ id: 'a', date: 0, symId: 'X', name: 'X', side: 'buy', entry: 100, sl: 99, tps: [101, 102, 103], tf: '300', dec: 2, source: 'T', grade: 'A', score: 80,
  status: 'open', fill: 100, risk: 100, stop: 99, hits: 0, done: 0, banked: 0, mfe: 0, mae: 0, ...over });
const run = (s0: Signal, prices: number[]) => { let s = s0, closed; const ev: string[] = []; for (const p of prices) { const r = step(s, p, 1); s = r.sig; ev.push(...r.ev.map((e) => e.kind)); if (r.closed) { closed = r.closed; break; } } return { s, closed, ev }; };

ok(planFromPct([50, 30, 20])?.join() === '0.5,0.3,0.2', 'plan 50/30/20 is accepted');
ok(planFromPct([50, 30, 10]) === null, 'plan not adding to 100 is refused');
ok(planFromPct([50, -10, 60]) === null, 'negative share is refused');
ok(defaultPlanPct(3).join() === '50,30,20', 'default split is 50/30/20');

// auto plan 50/30/20: closes by itself at every TP, last share finishes the trade at +1R*0.5 + 2R*0.3 + 3R*0.2 = 1.7R
let r = run(mk({ plan: [0.5, 0.3, 0.2], auto: true }), [100.5, 101.1]);
ok(near(r.s.done, 0.5) && near(r.s.banked, 0.5) && r.s.tpAlert === undefined && r.ev.join() === 'auto', 'TP1: 50% closed at 101, no alarm');
r = run(mk({ plan: [0.5, 0.3, 0.2], auto: true }), [101.1, 102.1, 103.2]);
ok(r.closed && near(r.closed.r, 1.7) && near(r.closed.pnl, 170) && r.closed.reason === 'tp', 'TP3: trade finished, +1.7R / +$170');
ok(r.ev.join() === 'auto,auto,auto', 'three auto events');
// one tick that jumps over every target still closes the shares at the TP prices
r = run(mk({ plan: [0.5, 0.3, 0.2], auto: true }), [103.5]);
ok(r.closed && near(r.closed.r, 1.7), 'gap through all TPs: same result');
// 100/0/0 closes everything at TP1
r = run(mk({ plan: [1, 0, 0], auto: true }), [101.2]);
ok(r.closed && near(r.closed.r, 1), '100% at TP1 finishes the trade at +1R');

// alarm only (auto off): nothing closes, plan is only a hint
r = run(mk({ plan: [0.5, 0.3, 0.2], auto: false }), [101.1]);
ok(!r.closed && r.s.done === 0 && r.s.tpAlert === 1 && r.ev[0] === 'tp', 'auto off: only the alarm rings');

// break-even after TP1 (alarm mode): stop moves to fill, and a return to the entry closes at 0
r = run(mk({ autoBe: true }), [101.1]);
ok(r.s.stop === 100 && r.ev.includes('bemove') && r.s.tpAlert === 1, 'TP1 moves the stop to break-even');
r = run(mk({ autoBe: true }), [101.1, 99.9]);
ok(r.closed && near(r.closed.r, 0) && r.closed.reason === 'be', 'back to entry after TP1 = break-even, 0R');
// auto + BE: 50% banked (+0.5R), then the rest stopped at entry -> +0.5R total
r = run(mk({ plan: [0.5, 0.3, 0.2], auto: true, autoBe: true }), [101.1, 99.9]);
ok(r.closed && near(r.closed.r, 0.5) && r.closed.reason === 'tp', 'auto + BE: +0.5R locked, rest stopped at entry');
// without BE the same move would hit the original stop
r = run(mk({ plan: [0.5, 0.3, 0.2], auto: true }), [101.1, 98.9]);
ok(r.closed && near(r.closed.r, 0.5 - 0.5), 'without BE the rest is stopped at -1R: 0.5 - 0.5 = 0R');

// sell side mirrors it
const sell = mk({ side: 'sell', sl: 101, stop: 101, tps: [99, 98, 97], plan: [0.5, 0.3, 0.2], auto: true });
r = run(sell, [98.9, 97.9, 96.8]);
ok(r.closed && near(r.closed.r, 1.7), 'sell: +1.7R as well');

console.log(fails ? `${fails} FAILED` : 'all plan tests passed');
process.exit(fails ? 1 : 0);
