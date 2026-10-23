import { authReady } from '../src/authReady';
import { makeGuard } from '../src/priceGuard';
import { noteSpot, futGap, futAligned, resetFutGap, yahooQuote, yahooCandles, isFutProxy } from '../src/fallback';

let fails = 0;
const ok = (c: unknown, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // ---------- saved login is restored on start (Firebase 9 has no authStateReady) ----------
  let fired = 0;
  const v9 = { onAuthStateChanged: (cb: (u: unknown) => void) => { setTimeout(() => { fired++; cb({ uid: 'u1' }); }, 20); return () => {}; } };
  await authReady(v9 as any); ok(fired === 1, 'Firebase 9 (no authStateReady): waits for the saved login to be read, no TypeError');
  let called = 0; await authReady({ authStateReady: async () => { called++; }, onAuthStateChanged: () => () => {} } as any); ok(called === 1, 'Firebase 10+: uses authStateReady');
  const t0 = Date.now(); await authReady({ onAuthStateChanged: () => () => {} } as any, 120); ok(Date.now() - t0 >= 100 && Date.now() - t0 < 1000, 'never blocks the start for ever (time limit)');
  await authReady({ onAuthStateChanged: () => { throw new Error('boom'); } } as any); ok(true, 'a failing auth object does not throw');
  let offCalled = false; await authReady({ onAuthStateChanged: (cb: any) => { cb(null); return () => { offCalled = true; }; } } as any); ok(offCalled, 'the listener is removed again (even when it answers at once)');

  // ---------- price guard: one far-off reading cannot move a trade ----------
  const g = makeGuard();
  const q = (p: number) => ({ price: p });
  const a = q(4150.1); ok(g('XAU', a, a.price) === 4150.1, 'first reading is accepted');
  const b = q(4150.9); ok(g('XAU', b, b.price) === 4150.9, 'normal tick is accepted');
  const s1 = q(4169.2); ok(g('XAU', s1, s1.price) === undefined, 'a jump of $18 in one reading is held back');
  ok(g('XAU', s1, s1.price) === undefined, 'the same reading seen again is NOT a confirmation');
  const back = q(4151.2); ok(g('XAU', back, back.price) === 4151.2, 'the price comes back: the spike is forgotten');
  const m1 = q(4165); ok(g('XAU', m1, m1.price) === undefined, 'a feed that moved to another level: first reading held');
  const m2 = q(4165.3); ok(g('XAU', m2, m2.price) === 4165.3, 'second reading at the new level confirms it (a real gap is accepted)');
  ok(g('EUR', q(1.1), 1.1) === 1.1 && g('XAU', m2, m2.price) === 4165.3, 'symbols are kept apart; an accepted reading seen again keeps its price');

  // ---------- gold / silver backup is a futures price: matched to spot before it is used ----------
  const realFetch = globalThis.fetch; let fut = 4160.4;
  (globalThis as any).fetch = async (url: string) => {
    const n = 12, ts = Array.from({ length: n }, (_, i) => 1_760_000_000 + i * 300), base = fut;
    return { ok: true, json: async () => ({ chart: { result: [{ meta: { regularMarketPrice: fut, chartPreviousClose: fut - 5 }, timestamp: ts, indicators: { quote: [{ open: ts.map(() => base), high: ts.map(() => base + 1), low: ts.map(() => base - 1), close: ts.map(() => base), volume: ts.map(() => 10) }] } }] } }) };
  };
  resetFutGap();
  ok(isFutProxy('frxXAUUSD') && isFutProxy('frxXAGUSD') && !isFutProxy('frxEURUSD') && !isFutProxy('cryBTCUSD'), 'only gold and silver use a futures backup');
  ok(!futAligned('frxXAUUSD') && futAligned('frxEURUSD'), 'gold backup is not trusted before the gap is known; EUR/USD always is');
  noteSpot('frxXAUUSD', 4150.2); await wait(60);
  ok(Math.abs((futGap('frxXAUUSD') ?? 0) - (4150.2 - 4160.4)) < 1e-9 && futAligned('frxXAUUSD'), 'gap measured from the spot price: about -$10.2');
  const qt = await yahooQuote('frxXAUUSD'); ok(Math.abs((qt?.price ?? 0) - 4150.2) < 1e-9 && Math.abs((qt?.prev ?? 0) - (4155.4 - 10.2)) < 1e-6, 'the backup quote now reads the spot level (the futures premium is taken off)');
  const cs = await yahooCandles('frxXAUUSD', 300, 50); ok(cs.length === 12 && Math.abs(cs[0].c - 4150.2) < 1e-9 && Math.abs(cs[0].h - 4151.2) < 1e-9, 'backup candles are shifted the same way (open, high, low, close)');
  const eur = await yahooQuote('frxEURUSD'); ok(eur?.price === 4160.4, 'other pairs are left exactly as they are');
  resetFutGap(); fut = 4160.4; noteSpot('frxXAUUSD', 4150.2, Date.now() - 200_000); await wait(60);
  ok(!futAligned('frxXAUUSD'), 'a spot reading that is more than 90 s old is not used to measure the gap');
  resetFutGap(); fut = 4300; noteSpot('frxXAUUSD', 4150.2); await wait(60);
  ok(!futAligned('frxXAUUSD'), 'an absurd gap (over 3%) is treated as bad data');
  (globalThis as any).fetch = realFetch;

  console.log(fails ? `\n${fails} FAILED` : '\nall login + gold tests passed');
  process.exit(fails ? 1 : 0);
})();
