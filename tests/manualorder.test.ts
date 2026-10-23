import { buildTicket } from '../src/manualOrderMath';
import { step, closeNow, Signal } from '../src/trades';
let fails = 0;
const ok = (c: unknown, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const near = (a: number, b: number, e = 1e-9) => Math.abs(a - b) < e;
const base = { side: 'buy' as const, mode: 'market' as const, price: 100, entryTxt: '', slTxt: '', tpTxt: [null, null, null] as (string | null)[], rr: [1, 2, 3] };

let t = buildTicket({ ...base, slTxt: '99' });
ok(t.err === '' && near(t.entry!, 100) && near(t.dist, 1) && t.tps.join() === '101,102,103', 'BUY: stop 99 gives auto TP at 1R / 2R / 3R');
t = buildTicket({ ...base, side: 'sell', slTxt: '101' });
ok(t.err === '' && t.tps.join() === '99,98,97', 'SELL: targets go down');
t = buildTicket({ ...base, slTxt: '101' }); ok(/below the entry/.test(t.err), 'BUY with the stop above is refused');
t = buildTicket({ ...base, side: 'sell', slTxt: '99' }); ok(/above the entry/.test(t.err), 'SELL with the stop below is refused');
t = buildTicket({ ...base, slTxt: '' }); ok(/stop loss/.test(t.err), 'no stop is refused');
t = buildTicket({ ...base, price: undefined, slTxt: '99' }); ok(/live price/.test(t.err), 'market without a live price waits');
t = buildTicket({ ...base, slTxt: '99', tpTxt: ['', '', ''] }); ok(/take profit/.test(t.err), 'all targets emptied is refused');
t = buildTicket({ ...base, slTxt: '99', tpTxt: ['105', null, null] }); ok(t.tps.join() === '102,103,105', 'one typed target, the others stay automatic, sorted by distance');
t = buildTicket({ ...base, slTxt: '99', tpTxt: ['99.5', null, null] }); ok(/above the entry/.test(t.err), 'a target on the wrong side is refused');
t = buildTicket({ ...base, slTxt: '99', tpTxt: ['0,5', '', ''] }); ok(t.err !== '', 'comma decimals parse (0,5 is under the entry)');
t = buildTicket({ ...base, slTxt: '99', tpTxt: ['100.5', '', ''] }); ok(t.err === '' && t.tps.length === 1, 'comma / dot, one target is enough');
t = buildTicket({ ...base, slTxt: '99', price: 100.9, tpTxt: ['100.5', '', ''] }); ok(t.err !== '', 'market with a target already behind the live price is refused');
t = buildTicket({ ...base, mode: 'limit', slTxt: '98', entryTxt: '99' }); ok(t.err === '' && near(t.entry!, 99) && t.tps.join() === '100,101,102', 'limit: targets follow the typed entry');
t = buildTicket({ ...base, mode: 'limit', slTxt: '98', entryTxt: '' }); ok(/limit price/.test(t.err), 'limit without a price is refused');
t = buildTicket({ ...base, slTxt: '99', rr: [1.5, 3, 4.5] }); ok(t.tps.join() === '101.5,103,104.5', 'other R preset');

// a manual order lives through the real tracker: open at market, TP1 -> bank, break-even, stop out / close
const tk = buildTicket({ ...base, slTxt: '99' });
const sig: Signal = { id: 'm1', date: 0, symId: 'frxEURUSD', name: 'EUR/USD', side: 'buy', entry: tk.entry!, sl: tk.sl, tps: tk.tps, tf: '900', dec: 2, source: 'Manual', grade: 'M', score: 0,
  status: 'open', risk: 50, lots: 1, perPt: 50, stop: tk.sl, hits: 0, done: 0, banked: 0, mfe: 0, mae: 0, fill: 100, filledAt: 1, mode: 'market', takenAt: 1, plan: [0.5, 0.3, 0.2], auto: true, autoBe: true };
let s = sig, closed: any = null;
for (const p of [100.4, 101.2, 101.6, 100.0, 99.9]) { const r = step(s, p, 1000); s = r.sig; if (r.closed) { closed = r.closed; break; } }
ok(s.hits >= 1, `TP1 was reached by the tracker (hits ${s.hits})`);
ok(closed && closed.pnl >= 0, `the manual trade closes into the journal (pnl ${closed ? closed.pnl.toFixed(2) : 'open'}, ${closed?.reason})`);
const c2 = closeNow({ ...sig }, 99.5); ok(c2.pnl < 0 && c2.reason === 'manual', 'closing by hand at a loss books a negative result');
console.log(fails ? `\n${fails} FAILED` : '\nall passed'); process.exit(fails ? 1 : 0);
