import * as fs from 'fs';
import * as path from 'path';
import { sdDojiEngine, scalpAnalyze, sdReversalEngine, SCALP_TF_SECONDS, PAT_KEYS } from '../src/scalp';
import { TFS } from '../src/markets';
import { analyzeAll } from '../src/refine';
let fails = 0;
const ok = (c: unknown, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };

// 1) the port gives exactly the setups of the original Python script (sd_doji_scalper.py) on the same candles
const ref = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'scalp_ref.json'), 'utf8'));
let total = 0, same = 0;
for (const r of ref) {
  const c = r.c.map(([t, o, h, l, cl]: number[]) => ({ t, o, h, l, c: cl }));
  const mine = sdDojiEngine(c).signals.map((s) => [s.status, s.side, s.dojiI, s.confirmI ?? -1, s.entry, s.stop]);
  total += r.sigs.length;
  const eq = mine.length === r.sigs.length && mine.every((m, i) => m[0] === r.sigs[i][0] && m[1] === r.sigs[i][1] && m[2] === r.sigs[i][2] && m[3] === r.sigs[i][3] && (m[4] == null ? r.sigs[i][4] == null : Math.abs((m[4] as number) - r.sigs[i][4]) < 1e-6) && (m[5] == null ? r.sigs[i][5] == null : Math.abs((m[5] as number) - r.sigs[i][5]) < 1e-6));
  if (eq) same++; else console.log('differs', JSON.stringify(mine), JSON.stringify(r.sigs));
}
ok(total >= 15 && same === ref.length, `all ${ref.length} reference series match the Python script (${total} setups)`);

// 2) hand-built scenario: supply zone, gravestone doji on it, red confirmation candle -> SELL signal
const t0 = 1_760_000_000, g = 300;
const bars: { o: number; h: number; l: number; c: number }[] = [];
let p = 100;
for (let i = 0; i < 70; i++) { const o = p; p += Math.sin(i / 3) * 0.4 + (i % 7 === 0 ? 0.25 : -0.05); bars.push({ o, c: p, h: Math.max(o, p) + 0.25, l: Math.min(o, p) - 0.25 }); }
// swing high, then a clear fall (the supply zone), then a rise back into it
const peak = Math.max(...bars.map((b) => b.h));
bars.push({ o: peak - 0.5, c: peak - 0.1, h: peak + 0.6, l: peak - 0.7 });                    // swing high candle
for (let i = 0; i < 6; i++) { const o = (bars[bars.length - 1].c); bars.push({ o, c: o - 1.6, h: o + 0.2, l: o - 1.9 }); } // price leaves by far more than 2 ATR
for (let i = 0; i < 11; i++) { const o = bars[bars.length - 1].c; bars.push({ o, c: o + 0.9, h: o + 1.05, l: o - 0.1 }); } // and rises back into the zone
const zoneTop = peak + 0.6, zoneBot = peak - 0.5;
const toC = (arr: typeof bars) => arr.map((b, i) => ({ t: t0 + i * g, ...b }));
const E0 = sdDojiEngine(toC(bars));
ok(E0.zones.some((z) => z.kind === 'supply' && z.valid && Math.abs(z.top - zoneTop) < 1e-9), 'a supply zone is detected after a strong move away from a swing high');
const o1 = bars[bars.length - 1].c;
const doji = { o: o1, c: o1 - 0.01, h: o1 + 1.2, l: o1 - 0.05 };                      // gravestone: long upper wick, tiny body, closes inside the zone
const barsD = [...bars, doji];
const W = scalpAnalyze(toC(barsD), new Date('2026-10-14T13:00:00Z'), { sessions: false });
ok(W.status === 'watch' && W.setup?.side === 'sell' && W.setup.state === 'armed' && W.setup.score <= 55, 'doji on the zone, next candle not closed yet: WATCH (armed, no entry)');
ok(Math.abs((W.setup?.entry ?? 0) - doji.l) < 1e-9 && Math.abs((W.setup?.sl ?? 0) - doji.h) < 1e-9, 'armed entry is the doji low, stop is the doji high');
const conf = { o: doji.c + 0.05, c: doji.l - 0.9, h: doji.c + 0.1, l: doji.l - 1.0 };  // red candle closing below the doji low
const SG = scalpAnalyze(toC([...barsD, conf]), new Date('2026-10-14T13:00:00Z'), { sessions: false });
ok(SG.status === 'signal' && SG.setup?.side === 'sell' && SG.setup.state === 'triggered' && SG.setup.barsAgo === 0, 'red candle closing below the doji low: SELL signal');
ok(Math.abs((SG.setup?.entry ?? 0) - conf.c) < 1e-9 && Math.abs((SG.setup?.sl ?? 0) - doji.h) < 1e-9, 'entry = close of the confirmation candle, stop = doji high');
const weak = { o: doji.c, c: doji.c + 0.3, h: doji.c + 0.4, l: doji.c - 0.1 };         // green candle: the sell setup fails
const EX = scalpAnalyze(toC([...barsD, weak]), new Date('2026-10-14T13:00:00Z'), { sessions: false });
ok(EX.status === 'expired' && !EX.setup, 'a candle that does not confirm expires the setup');

// 3) NO REPAINT: scalping reads closed candles only
let seed = 9; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
let q = 100; const now = new Date('2026-10-14T13:00:30Z'), ns = now.getTime() / 1000, gg = 300;
const ser = Array.from({ length: 260 }, (_, i) => { const o = q; q += Math.sin(i / 11) * 0.5 + (rnd() - 0.5) * 0.6; return { t: Math.floor(ns / gg) * gg - (259 - i) * gg, o, c: q, h: Math.max(o, q) + rnd() * 0.3, l: Math.min(o, q) - rnd() * 0.3, v: 900 }; });
const ser2 = ser.map((x, i) => (i === ser.length - 1 ? { ...x, h: x.h + 3, l: x.l - 3, c: x.c + 2 } : x));
const A = analyzeAll(ser, now).scalp, B = analyzeAll(ser2, now).scalp;
ok(JSON.stringify([A.status, A.steps, A.zones, A.setup]) === JSON.stringify([B.status, B.steps, B.zones, B.setup]), 'the forming candle does not change the scalping read');

// 4) shape of the result the screens rely on
const S = scalpAnalyze(ser.slice(0, -1), now);
ok(S.ok && isFinite(S.atr) && Array.isArray(S.steps) && Array.isArray(S.zones) && Array.isArray(S.lines) && ['signal', 'watch', 'expired', 'none', 'busy'].includes(S.status), 'result has status, steps, zones and lines');
ok(scalpAnalyze(ser.slice(0, 30), now).ok === false, 'too few candles are refused');
// every setup found over many random markets is well formed: stop on the right side, targets in order, armed never above 55
let bad = 0, found = 0, armedHigh = 0;
for (let k = 0; k < 400; k++) {
  let s2 = 17 + k; const r2 = () => { s2 = (s2 * 16807) % 2147483647; return s2 / 2147483647; };
  let v = 100; const cc = Array.from({ length: 220 }, (_, i) => { const o = v; v += Math.sin(i / 9 + k) * 0.5 + (r2() - 0.5) * 0.7; const dj = r2() < 0.15; const cl = dj ? o + (r2() - 0.5) * 0.02 : v; return { t: t0 + i * g, o, c: cl, h: Math.max(o, cl) + r2() * (dj ? 0.9 : 0.3), l: Math.min(o, cl) - r2() * (dj ? 0.9 : 0.3) }; });
  const x = scalpAnalyze(cc, now).setup;
  if (!x) continue;
  found++;
  const buy = x.side === 'buy';
  if (buy ? !(x.sl < x.entry && x.tps[0] > x.entry && x.tps[1] > x.tps[0] && x.tps[2] > x.tps[1]) : !(x.sl > x.entry && x.tps[0] < x.entry && x.tps[1] < x.tps[0] && x.tps[2] < x.tps[1])) bad++;
  if (x.state === 'armed' && x.score > 55) armedHigh++;
}
console.log(`   ${found} setups seen in 400 random markets`);
ok(bad === 0 && armedHigh === 0, 'stop on the right side, targets in order, armed setups score at most 55');

// 5) the reversal-candle method: supply / demand zone, then ANY of the reversal candles, then the confirmation candle
type B = { o: number; h: number; l: number; c: number };
const NOW = new Date('2026-10-14T13:00:00Z');
const M = 200, mirror = (b: B): B => ({ o: M - b.o, c: M - b.c, h: M - b.l, l: M - b.h });       // a supply scenario flipped upside down is a demand scenario
const e = bars[bars.length - 1].c;                                                                 // last close of the rise into the supply zone (inside the zone)
const lastUp = bars[bars.length - 1];                                                              // the green candle before the pattern
// each case: the candles that END the pattern (sell side, on the supply zone) and what the app must call it on each side
const CASES: { key: string; sell: string; buy: string; add: B[] }[] = [
  { key: 'doji', sell: 'Doji', buy: 'Doji', add: [{ o: e, c: e + 0.005, h: e + 0.6, l: e - 0.6 }] },
  { key: 'gravestone / dragonfly', sell: 'Gravestone doji', buy: 'Dragonfly doji', add: [{ o: e, c: e - 0.01, h: e + 1.2, l: e - 0.05 }] },
  { key: 'shooting star / hammer', sell: 'Shooting star', buy: 'Hammer', add: [{ o: e, c: e - 0.15, h: e + 1.0, l: e - 0.2 }] },
  { key: 'hanging man / inverted hammer', sell: 'Hanging man', buy: 'Inverted hammer', add: [{ o: e, c: e + 0.15, h: e + 0.2, l: e - 1.0 }] },
  { key: 'engulfing', sell: 'Bearish engulfing', buy: 'Bullish engulfing', add: [{ o: e + 0.05, c: e - 1.0, h: e + 0.1, l: e - 1.05 }] },
  { key: 'tweezer', sell: 'Tweezer top', buy: 'Tweezer bottom', add: [{ o: e - 0.1, c: e - 0.6, h: lastUp.h, l: e - 0.7 }] },
  { key: 'evening / morning star', sell: 'Evening star', buy: 'Morning star', add: [{ o: e + 0.05, c: e + 0.15, h: e + 0.25, l: e - 0.05 }, { o: e + 0.1, c: e - 0.9, h: e + 0.15, l: e - 0.95 }] },
];
let allKeys = new Set<string>();
for (const side of ['sell', 'buy'] as const) {
  for (const cs of CASES) {
    const f = side === 'sell' ? (b: B) => b : mirror, want = side === 'sell' ? cs.sell : cs.buy;
    const base = bars.map(f), pat = cs.add.map(f);
    const sigC = pat[pat.length - 1];
    const W2 = scalpAnalyze(toC([...base, ...pat]), NOW, { sessions: false });
    const set = W2.setup;
    ok(W2.status === 'watch' && set?.state === 'armed' && set.side === side && set.pattern.name === want && set.score <= 55, `${side.toUpperCase()}: ${want} on the ${side === 'sell' ? 'supply' : 'demand'} zone -> WATCH (armed, no entry yet)`);
    if (!set) continue;
    allKeys.add(set.pattern.key);
    const pc = [...base, ...pat].slice(-set.pattern.n);                                                  // every candle of the pattern, including earlier ones
    const ext = side === 'sell' ? Math.max(...pc.map((x) => x.h)) : Math.min(...pc.map((x) => x.l));
    ok(Math.abs(set.sl - ext) < 1e-9, `${side.toUpperCase()}: ${want}: stop is the pattern ${side === 'sell' ? 'high' : 'low'}${pat.length > 1 ? ' of all its candles' : ''}`);
    const conf2: B = side === 'sell' ? { o: sigC.c, c: sigC.l - 0.5, h: sigC.c + 0.05, l: sigC.l - 0.6 } : { o: sigC.c, c: sigC.h + 0.5, h: sigC.h + 0.6, l: sigC.c - 0.05 };
    const SG2 = scalpAnalyze(toC([...base, ...pat, conf2]), NOW, { sessions: false });
    ok(SG2.status === 'signal' && SG2.setup?.side === side && SG2.setup.state === 'triggered' && SG2.setup.barsAgo === 0 && Math.abs(SG2.setup.entry - conf2.c) < 1e-9 && Math.abs(SG2.setup.sl - ext) < 1e-9, `${side.toUpperCase()}: ${want}: confirmation candle -> SIGNAL, entry = its close`);
    const bad2: B = side === 'sell' ? { o: sigC.c, c: sigC.c + 0.3, h: sigC.c + 0.4, l: sigC.c - 0.1 } : { o: sigC.c, c: sigC.c - 0.3, h: sigC.c + 0.1, l: sigC.c - 0.4 };
    const EX2 = scalpAnalyze(toC([...base, ...pat, bad2]), NOW, { sessions: false });
    ok(EX2.status === 'expired' && !EX2.setup, `${side.toUpperCase()}: ${want}: a candle that does not confirm expires the setup`);
  }
}
ok(PAT_KEYS.every((k) => allKeys.has(k)), `all ${PAT_KEYS.length} reversal candles were produced at a zone (doji, gravestone, dragonfly, hammer, inverted hammer, shooting star, hanging man, morning star, evening star, engulfing, tweezer)`);

// the zone decides the side: a buy pattern on a supply zone (or a sell pattern on a demand zone) is not a signal
const dragonflyAtSupply = scalpAnalyze(toC([...bars, { o: e, c: e + 0.01, h: e + 0.05, l: e - 1.2 }]), NOW, { sessions: false });
ok(!dragonflyAtSupply.setup && dragonflyAtSupply.status !== 'watch', 'a dragonfly on a SUPPLY zone gives no setup');
const graveAtDemand = scalpAnalyze(toC([...bars, { o: e, c: e - 0.01, h: e + 1.2, l: e - 0.05 }].map((b) => ({ ...b }))).map((x, i, arr) => (i < bars.length ? { ...x, o: M - x.o, c: M - x.c, h: M - x.l, l: M - x.h } : { ...x, o: M - (arr[i].o), c: M - arr[i].c, h: M - arr[i].l, l: M - arr[i].h })), NOW, { sessions: false });
ok(graveAtDemand.status !== 'watch' && !graveAtDemand.setup || graveAtDemand.setup?.side === 'buy', 'a gravestone-shaped candle on a DEMAND zone is never a sell setup');
// no zone under the candle: no signal, step 1 fails
const farAway = scalpAnalyze(toC([...bars, { o: 90, c: 89.99, h: 91.2, l: 89.95 }]), NOW, { sessions: false });
ok(!farAway.setup && farAway.steps.length === 3 && farAway.steps[0].ok === false, 'a gravestone far from any zone gives no setup and step 1 fails');
// a zone but no reversal candle: step 2 fails and says why
const marubozu = scalpAnalyze(toC([...bars, { o: e - 0.7, c: e, h: e + 0.01, l: e - 0.71 }]), NOW, { sessions: false });
ok(!marubozu.setup && marubozu.steps[0].ok === true && marubozu.steps[1].ok === false && /no reversal candle/.test(marubozu.steps[1].text), 'a strong one-direction candle on the zone is not a reversal candle: step 2 fails with a reason');
// one trade at a time: the confirmation candle opens a trade, so it cannot also start a new setup
const eng = sdReversalEngine(toC([...bars, ...CASES[1].add, { o: e - 0.01, c: e - 1.4, h: e, l: e - 1.5 }]));
ok(eng.signals.filter((x) => x.status === 'CONFIRMED').length === 1 && !eng.signals.some((x) => x.status === 'WAITING'), 'the confirmation candle does not start a second setup while the trade is open');
// timeframes of the method
ok(JSON.stringify(SCALP_TF_SECONDS) === JSON.stringify([60, 300, 900, 1800, 3600]) && SCALP_TF_SECONDS.every((k) => TFS.some((x) => Number(x.k) === k)), 'scalping timeframes are M1, M5, M15, M30, H1 and the app offers all of them');

// more random markets, this time with long wicks and bodies of every size so every pattern family gets a chance
let bad3 = 0, found3 = 0; const names3 = new Set<string>();
for (let k = 0; k < 600; k++) {
  let s3 = 101 + k; const r3 = () => { s3 = (s3 * 16807) % 2147483647; return s3 / 2147483647; };
  let v = 100; const cc = Array.from({ length: 240 }, (_, i) => { const o = v; v += Math.sin(i / 8 + k) * 0.9 + (r3() - 0.5) * 0.8; const cl = r3() < 0.2 ? o + (r3() - 0.5) * 0.1 : v; const w = r3() < 0.3 ? 1.1 : 0.25; return { t: t0 + i * g, o, c: cl, h: Math.max(o, cl) + r3() * w, l: Math.min(o, cl) - r3() * w }; });
  const x = scalpAnalyze(cc, NOW).setup;
  if (!x) continue;
  found3++; names3.add(x.pattern.name);
  const buy = x.side === 'buy';
  if (buy ? !(x.sl < x.entry && x.tps[0] > x.entry && x.tps[1] > x.tps[0] && x.tps[2] > x.tps[1]) : !(x.sl > x.entry && x.tps[0] < x.entry && x.tps[1] < x.tps[0] && x.tps[2] < x.tps[1])) bad3++;
  if (x.state === 'armed' && x.score > 55) bad3++;
  if (buy !== /^(Hammer|Inverted hammer|Dragonfly doji|Morning star|Bullish engulfing|Tweezer bottom)$/.test(x.pattern.name) && x.pattern.name !== 'Doji') bad3++; // side and pattern name agree
}
console.log(`   ${found3} setups seen in 600 random markets (${[...names3].join(', ')})`);
ok(bad3 === 0, 'random markets: stop on the right side, targets in order, armed <= 55, pattern name agrees with the side');

console.log(fails ? `${fails} FAILED` : 'scalp test passed');
process.exit(fails ? 1 : 0);
