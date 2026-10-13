// @ts-nocheck  (uses a fake fetch and the generated server file)
// Real volume for VSA: the volume sources, the merge, the live wrapper, and VSA reading the volume.
import { REAL_VOL, realVolumeSource, volumeMap, mergeVolume, addRealVolume, RealVolume } from '../src/realvol';
import { vsaAnalyze, projectForming } from '../src/vsa';
let fails = 0;
const ok = (c: unknown, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- which markets have a volume source
const FX = ['frxEURUSD', 'frxGBPUSD', 'frxUSDJPY', 'frxAUDUSD', 'frxUSDCAD', 'frxUSDCHF', 'frxNZDUSD', 'frxEURJPY', 'frxGBPJPY', 'frxXAUUSD', 'frxXAGUSD', 'frxDXY'];
const CR = ['cryBTCUSD', 'cryETHUSD', 'cryLTCUSD', 'cryBNBUSD', 'cryXRPUSD'];
ok(FX.every((id) => REAL_VOL[id]?.kind === 'cme'), 'every forex pair, gold, silver and the dollar index has a futures volume source');
ok(CR.every((id) => REAL_VOL[id]?.kind === 'binance' && /USDT$/.test(REAL_VOL[id].sym)), 'every Deriv crypto has a Binance volume source');
ok(!REAL_VOL['R_100'] && !REAL_VOL['BOOM1000'] && !realVolumeSource('R_75'), 'synthetic indices have no volume source (there is no market volume for them)');
ok(realVolumeSource('bnSOLUSDT')?.kind === 'binance', 'Binance pairs report Binance as their volume source');
ok(REAL_VOL.frxEURJPY.proxy && REAL_VOL.frxGBPJPY.proxy && !REAL_VOL.frxEURUSD.proxy, 'only the two JPY crosses are marked as a proxy');

// ---- fake internet: Yahoo futures + Binance klines
const G = 900, base = Math.floor(1_700_000_000 / G) * G;
const yahoo = (ts: number[], vol: (number | null)[]) => ({ chart: { result: [{ timestamp: ts, indicators: { quote: [{ open: ts.map(() => 1), high: ts.map(() => 1.1), low: ts.map(() => 0.9), close: ts.map(() => 1), volume: vol }] } }] } });
let calls: string[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: any) => {
  const u = String(url); calls.push(u);
  const json = (o: any) => ({ ok: true, status: 200, json: async () => o });
  if (u.includes('6E%3DF')) { // 40 bars of 15 minutes
    const ts = Array.from({ length: 40 }, (_, i) => base + i * G);
    return json(yahoo(ts, ts.map((_, i) => (i === 20 ? 9000 : 1000 + i))));
  }
  if (u.includes('GC%3DF')) { // daily bars stamped at 04:00 UTC (the futures session start): must land in the UTC day
    const day0 = Math.floor(1_700_000_000 / 86400) * 86400, ts = [0, 1, 2, 3].map((d) => day0 + d * 86400 + 4 * 3600);
    return json(yahoo(ts, [500, 600, 700, 800]));
  }
  if (u.includes('/klines?symbol=BTCUSDT')) return json(Array.from({ length: 40 }, (_, i) => [(base + i * G) * 1000, '1', '2', '0.5', '1.5', String(10 + i)]));
  return { ok: false, status: 404, json: async () => ({}) };
}) as any;

(async () => {
  // ---- volume maps
  let vm = await volumeMap('frxEURUSD', G);
  ok(vm && vm.size === 40 && vm.get(base + 20 * G) === 9000, 'Yahoo futures volume is read into 15-minute buckets');
  ok(calls.some((u) => u.includes('interval=15m') && u.includes('range=1mo')), 'the volume request asks for a month of 15-minute bars (covers the whole analysis window)');
  const day0 = Math.floor(1_700_000_000 / 86400) * 86400;
  const gm = await volumeMap('frxXAUUSD', 86400);
  ok(gm && gm.get(day0) === 500 && gm.get(day0 + 3 * 86400) === 800, 'daily futures bars stamped 04:00 UTC land in the right UTC day');
  const bm = await volumeMap('cryBTCUSD', G);
  ok(bm && bm.size === 40 && bm.get(base + 5 * G) === 15, 'crypto volume comes from Binance klines');
  ok((await volumeMap('R_100', G)) === null, 'a synthetic index returns no volume');
  ok((await volumeMap('frxEURUSD', 5)) === null, 'a timeframe Yahoo cannot serve returns no volume (no crash)');

  // ---- merge
  const deriv = Array.from({ length: 40 }, (_, i) => ({ t: base + i * G, o: 1, h: 1.1, l: 0.9, c: 1 })); // price only, like Deriv
  const merged = mergeVolume(deriv, vm);
  ok(merged.every((x) => (x.v ?? 0) > 0) && merged[20].v === 9000, 'Deriv candles get the real volume of their time bucket');
  ok(deriv.every((x) => x.v === undefined), 'the original candles are not changed');
  const own = [{ ...deriv[0], v: 7 }, ...deriv.slice(1)];
  ok(mergeVolume(own, vm)[0].v === 7, 'candles that already carry volume keep it');
  const far = deriv.map((x) => ({ ...x, t: x.t + 10 * 86400 }));
  ok(mergeVolume(far, vm) === far, 'if the buckets do not line up at all, no volume is invented');
  ok(mergeVolume(deriv, null) === deriv, 'no volume map: candles are returned unchanged');

  // ---- one-shot (server alerts use this)
  const one = await addRealVolume('frxEURUSD', G, deriv);
  ok(one[20].v === 9000, 'addRealVolume merges real volume (cached for a minute)');
  const n0 = calls.length; await addRealVolume('frxEURUSD', G, deriv); ok(calls.length === n0, 'a second request inside a minute uses the cache (no new download)');
  ok((await addRealVolume('R_100', G, deriv)) === deriv, 'synthetic index: unchanged');

  // ---- live wrapper
  const seen: any[] = []; const rv = new RealVolume('cryBTCUSD', G, (c) => seen.push(c));
  rv.feed(deriv); ok(seen.length === 0, 'live: the first update is held back until the volume has arrived');
  rv.start(); await sleep(300);
  ok(seen.length >= 1 && seen[seen.length - 1][5].v === 15, 'live: after the volume arrives the screen gets candles with volume');
  rv.feed(deriv.slice(0, 30)); ok(seen[seen.length - 1].length === 30 && seen[seen.length - 1][29].v === 39, 'live: every later candle update is merged straight away');
  rv.stop();
  const rv2 = new RealVolume('frxEURUSD', 5, (c) => seen.push(c)); const before = seen.length; rv2.feed(deriv); rv2.start(); await sleep(300); // unsupported timeframe -> volume fails, candles still come through
  ok(seen.length === before + 1 && seen[seen.length - 1][0].v === undefined, 'live: if the volume cannot be loaded the candles still arrive (spread mode)'); rv2.stop();

  // ---- VSA reads the volume
  const mk = (n: number, f: (i: number) => { o: number; h: number; l: number; c: number; v?: number }) => Array.from({ length: n }, (_, i) => ({ t: base + i * G, ...f(i) }));
  const flat = (i: number, v?: number) => { const m = 100 + Math.sin(i / 3) * 0.2; return { o: m - 0.1, h: m + 0.35, l: m - 0.35, c: m + 0.1, v }; };
  const withVol = mk(60, (i) => (i === 55 ? { o: 100, h: 100.12, l: 99.9, c: 100.04, v: 9000 } : flat(i, 1000)));   // big volume, tiny spread
  const noVol = mk(60, (i) => (i === 55 ? { o: 100, h: 100.12, l: 99.9, c: 100.04 } : flat(i)));
  const a = vsaAnalyze(withVol), b = vsaAnalyze(noVol);
  ok(a.hasVolume === true && b.hasVolume === false, 'VSA knows when real volume is present');
  ok(a.signals.some((s) => s.i === 55 && s.tag === 'EFF'), 'with real volume VSA sees "effort without result" (huge volume, tiny spread)');
  ok(!b.signals.some((s) => s.tag === 'EFF'), 'without volume that signal is impossible (spread cannot tell effort)');

  // the newest bar is still forming
  const closed = mk(60, (i) => flat(i, 1000)), now = base + 59 * G + G / 2;           // halfway through the last bar
  const half = closed.map((x, i) => (i === 59 ? { ...x, v: 500 } : x));
  ok(projectForming(half, now)[59].v === 1000, 'a forming bar with half its time gone has its volume doubled before it is judged');
  ok(projectForming(half, base + 59 * G + 2 * G)[59].v === 500, 'a closed bar is never changed');
  ok(projectForming(half, base + 59 * G + 1)[59].v === 2000, 'projection is capped at 4x at the very start of a bar');
  const unknown = mk(60, (i) => flat(i, i === 59 ? undefined : 1000));
  ok(vsaAnalyze(unknown).signals.every((s) => s.i !== 59), 'a bar whose volume is not known yet is not judged');

  // ---- the generated server file behaves the same
  const srv = require('../server/analysis/realvol.js'), srvVsa = require('../server/analysis/vsa.js');
  const sm = await srv.addRealVolume('frxEURUSD', G, deriv);
  ok(sm[20].v === 9000 && srv.REAL_VOL.frxXAUUSD.sym === 'GC=F', 'server/analysis/realvol.js merges the same volume');
  ok(srvVsa.vsaAnalyze(withVol).hasVolume === true, 'server/analysis/vsa.js reads real volume too');

  globalThis.fetch = realFetch;
  console.log(fails ? `${fails} FAILED` : 'all real-volume tests pass'); process.exit(fails ? 1 : 0);
})();
