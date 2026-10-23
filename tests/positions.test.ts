import { openPosition, floating, totalPnl, checkLevels, setLevels, toBreakEven, lotsForPct, closeLots, stepPosition } from '../src/positions';
let fails = 0;
const ok = (c: unknown, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const near = (a: number, b: number, e = 0.005) => Math.abs(a - b) < e;
const spec = { min: 0.1, step: 0.1 };
const mk = (side: 'buy' | 'sell', lots = 1) => openPosition({ id: 'p', symId: 'stpRNG', name: 'Step Index', side, lots, perLot: 10, price: 100, tf: '60', dec: 1, now: 1 });

let b = mk('buy');
ok(near(floating(b, 101), 10), 'BUY 1 lot, +1.0 move = +10');
ok(near(floating(b, 99), -10), 'BUY, -1.0 move = -10');
let s = mk('sell'); ok(near(floating(s, 99), 10) && near(floating(s, 101), -10), 'SELL profits when price falls');

ok(checkLevels(b, 100, 101, null) !== '', 'BUY stop above the price is refused');
ok(checkLevels(b, 100, 99, 101) === '', 'BUY stop below / target above is fine');
ok(checkLevels(b, 100, null, 99) !== '', 'BUY target below the price is refused');
ok(checkLevels(s, 100, 101, 99) === '' && checkLevels(s, 100, 99, null) !== '', 'SELL mirrors it');
let r = setLevels(b, 100, 99, 105); ok(r.pos?.sl === 99 && r.pos?.tp === 105, 'levels are saved');
r = setLevels(r.pos!, 100, null, undefined); ok(r.pos?.sl === undefined && r.pos?.tp === 105, 'null removes the stop, undefined keeps the target');

ok(toBreakEven(b, 99).err !== undefined, 'break-even refused while in loss');
const be = toBreakEven(b, 101); ok(be.pos?.sl === 100, 'break-even moves the stop to the entry when in profit');
ok(toBreakEven(be.pos!, 102).err !== undefined, 'break-even twice is refused');
ok(toBreakEven({ ...b, sl: 100.5 }, 102).err !== undefined, 'a stop already past break-even is not pulled back');

ok(lotsForPct(b, 50, spec).lots === 0.5 && !lotsForPct(b, 50, spec).all, '50% of 1 lot = 0.5');
ok(lotsForPct(b, 100, spec).all && lotsForPct(b, 100, spec).lots === 1, '100% closes all');
const small = { ...b, lots: 0.15 }; ok(lotsForPct(small, 25, spec).lots === 0, '25% of 0.15 is under the minimum lot');
ok(lotsForPct({ ...b, lots: 0.25 }, 75, spec).lots === 0.1, '75% of 0.25 = 0.1875, rounded down to the 0.1 step');
ok(lotsForPct({ ...b, lots: 0.19 }, 90, spec).all, 'what would stay open is under the minimum lot: close all');
ok(lotsForPct({ ...b, lots: 0.3 }, 75, spec).all === false && lotsForPct({ ...b, lots: 0.3 }, 75, spec).lots === 0.2, '75% of 0.3 -> 0.2, 0.1 stays');

// partial close, then stop out
let p = b; const c1 = closeLots(p, 102, 0.5); ok(near(c1.booked, 10) && c1.pos?.lots === 0.5 && near(c1.pos!.realized, 10), 'closing half books +10 and keeps 0.5 open');
p = c1.pos!; const c2 = closeLots(p, 101, p.lots); ok(c2.closed && near(c2.closed.pnl, 15) && c2.closed.lots === 1, 'rest closed: total +15');
ok(c2.closed && near(c2.closed.exit, 100 + 15 / 10), 'average exit price matches the result');

// tracker steps
let t = setLevels(b, 100, 98, 103).pos!;
ok(!stepPosition(t, 100.5).closed, 'nothing happens between the levels');
let st = stepPosition(t, 97.5); ok(st.closed?.reason === 'sl' && near(st.closed!.pnl, -20), 'stop loss closes at the stop price (-20)');
st = stepPosition(t, 103.4); ok(st.closed?.reason === 'tp' && near(st.closed!.pnl, 30), 'take profit closes at the target (+30)');
const t2 = { ...setLevels(b, 100, 99, null).pos!, sl: 100 }; st = stepPosition(t2, 99.9); ok(st.closed?.reason === 'be' && near(st.closed!.pnl, 0), 'stop at the entry closes as break-even');
const t3 = { ...t2, sl: 101 }; st = stepPosition(t3, 100.9); ok(st.closed?.reason === 'tp' && near(st.closed!.pnl, 10), 'stop moved into profit closes with profit');
const sp = setLevels(s, 100, 101, 97).pos!; st = stepPosition(sp, 101.2); ok(st.closed?.reason === 'sl' && near(st.closed!.pnl, -10), 'SELL stop above');
st = stepPosition(sp, 96.9); ok(st.closed?.reason === 'tp' && near(st.closed!.pnl, 30), 'SELL target below');
ok(near(totalPnl(c1.pos!, 101), 10 + 5), 'total = booked + floating');
console.log(fails ? `\n${fails} FAILED` : '\nall passed'); process.exit(fails ? 1 : 0);

// ---- the Demo Trade name: new trades say Demo, older saved ones that say Manual are shown as Demo too
import { sourceName } from '../src/trades';
{
  const chk = (n: string, c: boolean) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) process.exitCode = 1; };
  chk('Demo and the old Manual name show as Demo', sourceName('Manual') === 'Demo' && sourceName('Demo') === 'Demo' && sourceName(undefined) === 'Demo' && sourceName('') === 'Demo');
  chk('other sources keep their name', sourceName('ICT') === 'ICT');
}
