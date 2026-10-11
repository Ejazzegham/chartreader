import { step, closeNow, isDuplicate, shares, totalR, todayPnl, guard, DESK0, deskReady, isOldDemoDesk, Signal, partialClose, liveOpposite, dropOpposite, reconcile, isSkipped, pruneSkipped, liveSame, wasTaken, muteKeys, TAKEN_HOURS } from '../src/trades';

let fails = 0;
const ok = (c: unknown, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

const mk = (side: 'buy' | 'sell', over: Partial<Signal> = {}): Signal => {
  const b = side === 'buy';
  return { id: 'a', date: 0, symId: 'X', name: 'X', side, entry: 100, sl: b ? 99 : 101, tps: b ? [101, 102, 103] : [99, 98, 97], tf: '300', dec: 2, source: 'T', grade: 'A', score: 80,
    status: 'pending', risk: 100, from: b ? 'above' : 'below', stop: b ? 99 : 101, hits: 0, done: 0, banked: 0, mfe: 0, mae: 0, ...over };
};
const run = (s0: Signal, prices: number[]) => {
  let s = s0, closed; const ev: string[] = [];
  for (const p of prices) { const r = step(s, p, 1); s = r.sig; ev.push(...r.ev.map((e) => e.kind)); if (r.closed) { closed = r.closed; break; } if (r.drop) { closed = undefined; ev.push('drop'); break; } }
  return { s, closed, ev };
};

// shares
ok(near(shares(3).reduce((a, b) => a + b, 0), 1) && near(shares(3)[0], 0.5), 'shares sum to 1');
ok(near(shares(2)[0], 0.5 / 0.8), 'two targets are normalised');

// buy limit: waits, fills at 100, straight stop
let r = run(mk('buy'), [100.6, 100.2, 100.05]);
ok(r.s.status === 'pending', 'limit order waits above the entry');
r = run(mk('buy'), [100.6, 99.98, 99.5, 98.9]);
ok(r.closed?.reason === 'sl' && near(r.closed.r, -1) && near(r.closed.pnl, -100), 'buy: fill then stop = -1R / -$100');
ok(r.ev.join() === 'fill,sl', 'buy: events fill, sl');

// TP1 only rings the alarm: nothing closes, nothing is banked, the stop stays where it was
r = run(mk('buy'), [99.9, 101.1]);
ok(!r.closed && r.s.status === 'open' && r.s.hits === 1 && r.s.tpAlert === 1, 'buy: TP1 reached -> still open, alarm waiting for the trader');
ok(r.s.banked === 0 && r.s.done === 0 && r.s.stop === 99, 'buy: TP1 banks nothing and does not move the stop');
ok(r.ev.join() === 'fill,tp', `buy: events fill,tp (${r.ev.join()})`);
// ... and if the trader ignores it and price falls back to the stop, the full stop loss applies
r = run(mk('buy'), [99.9, 101.1, 100.4, 98.9]);
ok(r.closed?.reason === 'sl' && near(r.closed.r, -1), 'buy: TP1 ignored, then stop = -1R (the trader chose to hold)');
// a gap through all three TPs: three alarms, trade still open
r = run(mk('buy'), [99.9, 103.5]);
ok(!r.closed && r.s.hits === 3 && r.s.tpAlert === 3 && r.ev.join() === 'fill,tp,tp,tp3', `buy: gap through all TPs -> open, 3 alarms (${r.ev.join()})`);
// the trader closes half at TP1 (price 101.1 = +1.1R): banks 0.55R, then moves the stop to break-even and gets stopped there
const op = mk('buy', { status: 'open', fill: 100, filledAt: 1 });
let pc = partialClose({ ...op, hits: 1, tpAlert: 1 }, 101.1, 0.5);
ok(!pc.closed && near(pc.sig.banked, 0.55) && near(pc.sig.done, 0.5) && pc.sig.tpAlert === 0, 'partial close: half off at +1.1R banks +0.55R and clears the alarm');
r = run({ ...pc.sig, stop: 100 }, [100.5, 99.9]);
ok(r.closed && near(r.closed.r, 0.55) && r.closed.reason === 'tp', 'partial then BE stop = +0.55R kept');
pc = partialClose(pc.sig, 102, 0.3);
ok(!pc.closed && near(pc.sig.done, 0.8) && near(pc.sig.banked, 0.55 + 0.3 * 2), 'second partial: 30% more at +2R');
pc = partialClose(pc.sig, 103, 0.9);
ok(!!pc.closed && near(pc.closed.r, 0.55 + 0.6 + 0.2 * 3), 'asking for more than is left closes everything');
pc = partialClose(op, 0, 0.5);
ok(!pc.closed && pc.sig === op, 'partial close without a price does nothing');
// sell mirror
r = run(mk('sell'), [99.5, 100.02, 99.0, 98.0, 96.9]);
ok(!r.closed && r.s.hits === 3, 'sell: TP1,TP2,TP3 reached -> still open');
r = run(mk('sell'), [99.5, 100.1, 101.2]);
ok(r.closed?.reason === 'sl' && near(r.closed.r, -1), 'sell: fill then stop = -1R');

// pending cancelled when the stop is hit before fill; signal removed when TP1 is reached first
r = run(mk('buy'), [100.5, 98.9]);
ok(r.ev.includes('invalid'), 'pending order cancelled when price hits the stop first');
r = run(mk('buy', { status: 'signal' }), [100.4, 101.2]);
ok(r.ev.includes('missed'), 'signal removed when TP1 is reached without entry');
r = run(mk('buy', { status: 'signal' }), [100.1]);
ok(r.ev.includes('near') && r.s.alerted === true, 'signal near entry raises one alert');
r = run(mk('buy', { status: 'signal' }), [100.1, 100.12]);
ok(r.ev.filter((e) => e === 'near').length === 1, 'alert only once');

// floating R and manual close
const open = mk('buy', { status: 'open', fill: 100, filledAt: 1 });
ok(near(totalR(open, 100.5), 0.5), 'floating +0.5R');
const half = { ...open, banked: 0.5, done: 0.5, hits: 1, stop: 100 };
ok(near(totalR(half, 100.5), 0.5 + 0.5 * 0.5), 'floating counts banked + rest');
const cn = closeNow(half, 100.4);
ok(near(cn.r, 0.7) && near(cn.pnl, 70), 'manual close mid-trade = banked + rest');

// market fill away from the plan entry (fill 100.3, stop 99): risk distance follows the fill
const mkt = mk('buy', { status: 'open', fill: 100.3, filledAt: 1, entry: 100 });
ok(near(totalR(mkt, 101.6), 1), 'R uses the real fill price');

// duplicates
const list = [mk('buy', { status: 'signal' })];
ok(!!isDuplicate(list, { symId: 'X', tf: '300', source: 'T', side: 'buy', entry: 100.2, sl: 99 }), 'near-same setup is a duplicate');
ok(!isDuplicate(list, { symId: 'X', tf: '300', source: 'T', side: 'buy', entry: 101.5, sl: 99 }), 'far entry is a new setup');
ok(!isDuplicate(list, { symId: 'X', tf: '300', source: 'Other', side: 'buy', entry: 100, sl: 99 }), 'other method is a new setup');

// today
const now = Date.now();
ok(near(todayPnl([{ date: now, pnl: -50 }, { date: now - 3 * 86400000, pnl: -500 }, { date: now, pnl: 20 }]), -30), 'today P&L ignores older days');

// discipline guard
const nowG = new Date(); nowG.setHours(15, 0, 0, 0); const T0 = nowG.getTime(), MIN = 60000;
// A trader's own account numbers (nothing is pre-filled any more)
const D = { ...DESK0, balance: 10000, riskPct: 1, dailyLossPct: 3, maxOpen: 3 };
ok(guard([], D, 0, T0).level === 'ok', 'guard: clean day is ok');
ok(guard([{ date: T0 - 5 * MIN, pnl: -100 }], D, 0, T0).level === 'ok', 'guard: one loss is fine');
let g = guard([{ date: T0 - 50 * MIN, pnl: -100 }, { date: T0 - 10 * MIN, pnl: -100 }], D, 0, T0);
ok(g.level === 'stop' && g.until === T0 + 20 * MIN, 'guard: two losses in a row start a 30 min cooldown');
g = guard([{ date: T0 - 80 * MIN, pnl: -100 }, { date: T0 - 40 * MIN, pnl: -100 }], D, 0, T0);
ok(g.level === 'ok', 'guard: cooldown ends after 30 min');
g = guard([{ date: T0 - 80 * MIN, pnl: -100 }, { date: T0 - 40 * MIN, pnl: 50 }, { date: T0 - 5 * MIN, pnl: -100 }], D, 0, T0);
ok(g.level === 'ok', 'guard: a win in between breaks the streak');
g = guard([{ date: T0 - 200 * MIN, pnl: -150 }, { date: T0 - 100 * MIN, pnl: -160 }], D, 0, T0);
ok(g.level === 'stop' && !g.until, 'guard: daily loss limit (3% of 10000 = 300) stops the day');
ok(guard([{ date: T0 - 3 * 86400000, pnl: -5000 }], D, 0, T0).level === 'ok', 'guard: old losses do not count today');
ok(guard([], D, 3, T0).level === 'warn', 'guard: max open trades warns');
g = guard([{ date: T0 - 300 * MIN, pnl: -10 }, { date: T0 - 250 * MIN, pnl: 20 }, { date: T0 - 200 * MIN, pnl: -10 }, { date: T0 - 150 * MIN, pnl: 5 }, { date: T0 - 100 * MIN, pnl: -10 }], D, 0, T0);
ok(g.level === 'warn' && /3 losses/.test(g.title), 'guard: three losses in a day warns');

// ---- one direction per pair
{
  const sig = (id: string, side: 'buy' | 'sell', status: Signal['status'], symId = 'EUR'): Signal => mk(side, { id, symId, status });
  const live = [sig('1', 'buy', 'open')];
  ok(liveOpposite(live, 'EUR', 'sell')?.id === '1', 'a running BUY blocks a SELL on the same pair');
  ok(!liveOpposite(live, 'EUR', 'buy'), 'a running BUY does not block another BUY');
  ok(!liveOpposite(live, 'GBP', 'sell'), 'other pairs are free');
  ok(!!liveOpposite([sig('2', 'sell', 'pending')], 'EUR', 'buy'), 'a waiting limit order also blocks the other side');
  const waiting = [sig('a', 'buy', 'signal'), sig('b', 'sell', 'signal', 'GBP')];
  const after = dropOpposite(waiting, 'EUR', 'sell');
  ok(after.length === 1 && after[0].id === 'b', 'a new SELL replaces the untouched BUY on the same pair only');
  // reconcile: list is newest first
  let rc = reconcile([sig('n', 'sell', 'signal'), sig('o', 'buy', 'signal')]);
  ok(rc.length === 1 && rc[0].id === 'n', 'reconcile keeps the newest direction');
  rc = reconcile([sig('n', 'sell', 'signal'), sig('r', 'buy', 'open')]);
  ok(rc.length === 1 && rc[0].id === 'r', 'reconcile lets the running trade win over an untouched setup');
  rc = reconcile([sig('a', 'buy', 'signal', 'EUR'), sig('b', 'sell', 'signal', 'GBP'), sig('c', 'buy', 'signal', 'EUR')]);
  ok(rc.length === 3, 'reconcile leaves same-direction and other-pair setups alone');
  // skipped
  const sk = [{ symId: 'EUR', source: 'T', side: 'buy' as const, entry: 100, sl: 99, at: 1000 }];
  ok(isSkipped(sk, { symId: 'EUR', source: 'T', side: 'buy', entry: 100.1, sl: 99 }, 2000), 'a skipped setup stays hidden');
  ok(!isSkipped(sk, { symId: 'EUR', source: 'T', side: 'buy', entry: 105, sl: 104 }, 2000), 'a different level is a new setup');
  ok(!isSkipped(sk, { symId: 'EUR', source: 'T', side: 'buy', entry: 100, sl: 99 }, 1000 + 7 * 3600000), 'skips expire after 6 hours');
  ok(pruneSkipped(sk, 1000 + 7 * 3600000).length === 0, 'old skips are pruned');
}

console.log(fails ? `${fails} FAILED` : 'ALL PASSED');

// ---- running / already traded setups are never shown again
{
  const run1 = mk('buy', { id: 'r1', status: 'open', fill: 100, source: 'ICT' });
  const sameDir = mk('buy', { id: 's1', status: 'signal', source: 'Scanner · SMC zone', entry: 100.3 });
  const other = mk('sell', { id: 's2', status: 'signal', source: 'Scanner', entry: 100 });
  ok(liveSame([run1, sameDir], 'X', 'buy')?.id === 'r1', 'liveSame finds the running trade on the pair and side');
  ok(!liveSame([run1], 'X', 'sell') && !liveSame([sameDir], 'X', 'buy'), 'liveSame ignores the other side and untouched setups');
  const rec = reconcile([sameDir, run1]);
  ok(!rec.some((x) => x.id === 's1'), 'reconcile hides an untouched setup in the direction that already runs (even from another method)');
  ok(muteKeys([run1, sameDir, other]).join() === 'X:buy', 'muteKeys lists only running / waiting trades');
  const now = Date.now(), tk = [{ symId: 'X', source: '*', side: 'buy' as const, entry: 100, sl: 99, at: now, hrs: TAKEN_HOURS }];
  ok(isSkipped(tk, { symId: 'X', source: 'Scanner · ICT', side: 'buy', entry: 100.2, sl: 99 }, now + 3600e3), 'a taken setup is hidden whatever method finds it again');
  ok(wasTaken(tk, { symId: 'X', source: 'VSA', side: 'buy', entry: 100, sl: 99 }, now + 1000), 'wasTaken reports it');
  ok(!isSkipped(tk, { symId: 'X', source: 'ICT', side: 'buy', entry: 100, sl: 99 }, now + 25 * 3600e3), 'the hide ends after 24 hours');
  ok(!isSkipped(tk, { symId: 'X', source: 'ICT', side: 'buy', entry: 104, sl: 103 }, now + 1000), 'a clearly different setup (new entry level) is still shown');
  ok(pruneSkipped(tk, now + 12 * 3600e3).length === 1 && pruneSkipped(tk, now + 25 * 3600e3).length === 0, 'prune keeps taken entries 24h, skipped ones 6h');
}
process.exit(fails ? 1 : 0);

// ---- nothing pre-filled ----
ok(DESK0.balance === 0 && DESK0.riskPct === 0 && DESK0.maxOpen === 0 && DESK0.dailyLossPct === 0, 'desk: no made-up balance, risk or limits');
ok(!deskReady(DESK0) && deskReady(D), 'desk: ready only after the trader enters balance and risk');
ok(guard([{ date: T0 - 5 * MIN, pnl: -5000 }], DESK0, 9, T0).level === 'ok', 'guard: no limits set -> no daily-loss or trade-limit warning');
ok(isOldDemoDesk({ balance: 10000, riskPct: 1, dailyLossPct: 3, maxOpen: 3 }) && !isOldDemoDesk({ balance: 2500, riskPct: 1, dailyLossPct: 3, maxOpen: 3 }), 'desk: old pre-filled numbers are recognised, real ones are kept');

