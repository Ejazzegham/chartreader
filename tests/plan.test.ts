import { step, planFromPct, defaultPlanPct, stopAtBE, bookedMoney, openMoney, Signal } from '../src/trades';

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

// ---------------------------------------------------------------- auto stop: TP1 -> entry, TP2 -> TP1, TP3 -> whole trade closes
// alarm mode + auto stop (no plan): TP1 moves the stop to the entry
r = run(mk({ autoBe: true }), [101.1]);
ok(r.s.stop === 100 && r.ev.join() === 'bemove,tp' && r.s.tpAlert === 1, 'auto stop: TP1 moves the stop to the entry, and the alarm still tells the trader (partials stay his choice)');
// TP2 moves it to TP1
r = run(mk({ autoBe: true }), [101.1, 102.1]);
ok(r.s.stop === 101 && r.ev.join() === 'bemove,tp,bemove,tp' && r.s.tpAlert === 2 && !r.closed, 'auto stop: TP2 moves the stop to TP1');
// price falls back to TP1 after TP2: the whole (still fully open) trade is closed at TP1 = +1R, not at the entry
r = run(mk({ autoBe: true }), [101.1, 102.1, 100.9]);
ok(r.closed && near(r.closed.r, 1) && near(r.closed.pnl, 100) && r.closed.reason === 'tp', 'auto stop: after TP2 a fall to TP1 closes with +1R');
// TP3 closes everything that is open, at the TP3 price
r = run(mk({ autoBe: true }), [101.1, 102.1, 103.2]);
ok(r.closed && near(r.closed.r, 3) && near(r.closed.pnl, 300) && r.closed.reason === 'tp' && r.ev.at(-1) === 'auto', 'auto stop: TP3 closes the whole trade at +3R');
// one tick through every target does all three steps
r = run(mk({ autoBe: true }), [103.5]);
ok(r.closed && near(r.closed.r, 3), 'auto stop: a gap through TP1, TP2 and TP3 still closes at TP3');
// auto stop + 50/30/20 plan: shares close at their TPs and the last one is the rest
r = run(mk({ plan: [0.5, 0.3, 0.2], auto: true, autoBe: true }), [101.1, 102.1, 103.2]);
ok(r.closed && near(r.closed.r, 1.7) && near(r.closed.pnl, 170), 'auto stop + plan: +1.7R / +$170 at TP3');
r = run(mk({ plan: [0.5, 0.3, 0.2], auto: true, autoBe: true }), [101.1, 102.1, 100.9]);
ok(r.closed && near(r.closed.r, 0.5 + 0.6 + 0.2 * 1) && r.s.stop === 101, 'auto stop + plan: 50% + 30% banked, the last 20% is stopped at TP1');
// the trader closed 70% by hand: TP3 must close the REST (30%), not only the planned 20%
r = run(mk({ plan: [0.5, 0.3, 0.2], auto: true, autoBe: true, done: 0.7, banked: 1.1, hits: 2, stop: 101 }), [103.2]);
ok(r.closed && near(r.closed.r, 1.1 + 0.3 * 3), 'TP3 closes everything still open (30% here), not just the planned 20%');
// without the switch nothing changes: TP3 only rings
r = run(mk({}), [101.1, 102.1, 103.2]);
ok(!r.closed && r.s.stop === 99 && r.s.tpAlert === 3 && r.ev.join() === 'tp,tp,tp3', 'switch off: stop stays, TP3 only rings the alarm');
// the stop never goes backwards: a stop the trader already moved higher is left alone
r = run(mk({ autoBe: true, stop: 100.5 }), [101.1]);
ok(r.s.stop === 100.5 && !r.ev.includes('bemove'), 'a better stop is not pulled back to the entry');
// sell side mirrors it
const sell2 = (o: Partial<Signal> = {}) => mk({ side: 'sell', sl: 101, stop: 101, tps: [99, 98, 97], ...o });
r = run(sell2({ autoBe: true }), [98.9, 97.9]);
ok(r.s.stop === 99 && r.ev.join() === 'bemove,tp,bemove,tp', 'sell: TP1 -> entry, TP2 -> TP1');
r = run(sell2({ autoBe: true }), [98.9, 97.9, 96.8]);
ok(r.closed && near(r.closed.r, 3), 'sell: TP3 closes the whole trade');

// stopAtBE: the manual break-even button must not pull a stop back from TP1 to the entry
ok(!stopAtBE(mk()) && stopAtBE(mk({ stop: 100 })) && stopAtBE(mk({ stop: 101 })), 'stopAtBE: original stop no, entry yes, TP1 yes');
ok(stopAtBE(sell2({ stop: 100 })) && stopAtBE(sell2({ stop: 99 })) && !stopAtBE(sell2()), 'stopAtBE (sell)');
ok(!stopAtBE(mk({ status: 'pending', fill: undefined })), 'stopAtBE: a waiting order has no break-even');

// money view (no R): booked part and the part still open
const half = mk({ banked: 0.5, done: 0.5, hits: 1 });
ok(near(bookedMoney(half), 50) && near(openMoney(half, 101.5), 75), '50% closed at TP1: $50 booked, the other half floats +$75 at 101.5');
ok(near(openMoney(mk(), 100.5), 50) && near(bookedMoney(mk()), 0), 'nothing closed: all of it floats');

// messages speak money, not R
let st = step(mk({ plan: [0.5, 0.3, 0.2], auto: true }), 101.1, 1);
ok(/50% closed at 101\.00\. \+\$50\.00 booked\./.test(st.ev[0].text) && !/\dR\b/.test(st.ev[0].text), 'TP1 text: "50% closed ... +$50.00 booked", no R');
st = step(mk({ plan: [0.5, 0.3, 0.2], auto: true, autoBe: true, done: 0.8, banked: 1.1, hits: 2, stop: 101 }), 103.2, 1);
ok(/20% closed \(\+\$60\.00\)\. Trade finished, result \+\$170\.00\./.test(st.ev[0].text), 'TP3 text: last 20% = +$60.00, trade result +$170.00');
st = step(mk({ stop: 101, hits: 2, autoBe: true }), 100.9, 1);
ok(/stop at TP1 hit, profit kept\. Trade result \+\$100\.00\./.test(st.ev[0].text), 'stop at TP1 hit: says profit kept, in money');
st = step(mk({ stop: 100 }), 99.9, 1);
ok(/stopped out at break-even\. Trade result \+\$0\.00\./.test(st.ev[0].text), 'stop at the entry: break-even text in money');
st = step(mk(), 98.9, 1);
ok(/stop loss hit\. -\$100\.00/.test(st.ev[0].text), 'stop loss text in money');

console.log(fails ? `${fails} FAILED` : 'all plan tests passed');
process.exit(fails ? 1 : 0);
