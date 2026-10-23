import { notifTarget, hasTarget } from '../src/notifTarget';
let fails = 0;
const ok = (c: unknown, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

ok(same(notifTarget({ type: 'support' }), { kind: 'help' }), 'support message opens Help');
ok(same(notifTarget({ type: 'support', sym: 'frxXAUUSD' }), { kind: 'help' }), 'support wins even if a symbol is present');
ok(same(notifTarget({ type: 'admin' }), { kind: 'admin' }), 'admin banner opens the admin panel');
ok(same(notifTarget({ type: 'price', sym: 'frxXAUUSD', id: 'x' } as any), { kind: 'symbol', sym: 'frxXAUUSD' }), 'price alert opens its pair');
ok(same(notifTarget({ type: 'level', symId: 'BOOM1000' } as any), { kind: 'symbol', sym: 'BOOM1000' }), 'a daily high / low break opens its pair (Boom and Crash too)');
ok(same(notifTarget({ type: 'news' }), { kind: 'bell' }), 'a news alert opens the bell list');
ok(same(notifTarget({ type: 'setup', symId: 'cryBTCUSD' }), { kind: 'symbol', sym: 'cryBTCUSD' }), 'scanner setup opens its pair (push carries symId)');
ok(same(notifTarget({ type: 'setup', sym: 'R_100' }), { kind: 'symbol', sym: 'R_100' }), 'setup line saved in the bell carries sym');
ok(same(notifTarget({ type: 'price' }), { kind: 'bell' }), 'price alert without a pair falls back to the bell');
ok(same(notifTarget({ type: 'info', sym: 'frxEURUSD' }), { kind: 'bell' }), 'unknown type falls back to the bell');
ok(same(notifTarget(undefined), { kind: 'bell' }) && same(notifTarget(null), { kind: 'bell' }) && same(notifTarget({}), { kind: 'bell' }), 'missing data falls back to the bell');
ok(same(notifTarget({ type: 'price', sym: 'a b; drop' }), { kind: 'bell' }), 'a strange symbol text is never used');
ok(same(notifTarget({ type: 5, sym: 7 } as any), { kind: 'bell' }), 'wrong data types are ignored');
ok(hasTarget({ type: 'support' }) && hasTarget({ type: 'price', sym: 'frxEURUSD' }) && !hasTarget({ type: 'info' }), 'hasTarget tells tappable lines');
if (fails) { console.log(fails + ' failed'); process.exit(1); }

// ---- bell lines that were saved without a pair, and local trade lines
import { guessSym } from '../src/notifTarget';
{
  const S = [{ id: 'frxEURUSD', name: 'EUR/USD' }, { id: 'frxXAUUSD', name: 'Gold (XAUUSD)' }, { id: 'cryBTCUSD', name: 'BTCUSD' }, { id: 'R_75', name: 'V75' }];
  const chk = (n: string, c: boolean) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) process.exitCode = 1; };
  chk('local trade line with a pair opens it', JSON.stringify(notifTarget({ type: 'trade', sym: 'frxEURUSD' })) === JSON.stringify({ kind: 'symbol', sym: 'frxEURUSD' }));
  chk('old scanner line is matched by its text', guessSym('1 setup near entry. EURUSD BUY 82% (near entry)', S) === 'frxEURUSD');
  chk('names with a slash match too', guessSym('EUR/USD closed. Trade result +12', S) === 'frxEURUSD');
  chk('short names never match by accident', guessSym('Stop moved to break-even for V75', S) === '');
  chk('no pair named gives nothing', guessSym('High impact news at 14:30', S) === '');
}
