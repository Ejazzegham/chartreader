import { withVolume } from '../src/volumeFeed';
import { getVolUsed, getVolState, getTickState } from '../src/volume';
import { vsaAnalyze } from '../src/vsa';
let fails = 0;
const ok = (c: unknown, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Yahoo (futures volume) is unreachable, exactly like a blocked network
(globalThis as any).fetch = async () => { throw new Error('Network request failed'); };

const gran = 300, now = Math.floor(Date.now() / 1000), t0 = now - (now % gran) - 80 * gran;
let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
let p = 150;
const candles = Array.from({ length: 80 }, (_, i) => { const o = p; p += (rnd() - 0.5) * 0.2; return { t: t0 + i * gran, o, c: p, h: Math.max(o, p) + 0.05, l: Math.min(o, p) - 0.05 }; });
// fake Deriv tick counter: every candle except the oldest has 40-80 ticks
const loader = async (_s: string, g: number, fromT: number, alive: () => boolean) => (alive() ? candles.slice(1).map((c, i) => ({ t: c.t, o: 0, h: 0, l: 0, c: 0, v: 40 + (i * 7) % 41 })) : []);

(async () => {
  // 1) cross pair with no futures contract: tick volume reaches the candles, and VSA now has volume to work with
  let got: any[] = [];
  const f1 = withVolume('frxEURJPY', gran, 120, (c) => { got = c; }, loader);
  f1.push(candles); await sleep(60);
  ok(got.length === 80 && got.slice(-40).every((c) => (c.v ?? 0) > 0), 'cross pair: candles carry tick volume');
  ok(getVolUsed('frxEURJPY', gran) === 'ticks' && getTickState('frxEURJPY', gran) === 'ok', 'cross pair: source reported as tick volume');
  const v1 = vsaAnalyze(got.slice(0, -1));
  ok(v1.ok && v1.hasVolume, 'VSA has volume on the cross pair (it said "Spread only" before)');
  f1.stop();

  // 2) gold: futures volume fails (Yahoo blocked) -> ticks take over and the failure is reported
  let got2: any[] = [];
  const f2 = withVolume('frxXAUUSD', gran, 120, (c) => { got2 = c; }, loader);
  f2.push(candles); await sleep(150);
  ok(getVolState('frxXAUUSD', gran) === 'failed', 'gold: futures failure is reported');
  ok(got2.slice(-40).every((c) => (c.v ?? 0) > 0) && getVolUsed('frxXAUUSD', gran) === 'ticks', 'gold: tick volume takes over when futures volume is unreachable');
  f2.stop();

  // 3) no tick loader and no futures: unchanged behaviour, no volume
  let got3: any[] = [];
  const f3 = withVolume('frxEURJPY', gran, 120, (c) => { got3 = c; });
  f3.push(candles); await sleep(20);
  ok(got3.length === 80 && got3.every((c) => c.v === undefined), 'without a tick loader nothing is invented');
  f3.stop();

  // 4) synthetic index: never gets tick volume
  let got4: any[] = [];
  const f4 = withVolume('R_100', gran, 120, (c) => { got4 = c; }, loader);
  f4.push(candles); await sleep(20);
  ok(got4.every((c) => c.v === undefined), 'synthetic index gets no volume');
  f4.stop();

  // 5) progressive tick loading: the newest candles get their volume while the older history is still loading
  {
    let got5: any[] = [];
    const bars = (from: number) => candles.slice(from).map((c, i) => ({ t: c.t, o: 0, h: 0, l: 0, c: 0, v: 50 + i }));
    const slow = async (_s: string, _g: number, _f: number, alive: () => boolean, _n?: number, onPart?: (b: any[]) => void) => { onPart?.(bars(50)); await sleep(120); return alive() ? bars(1) : []; };
    const f5 = withVolume('frxEURJPY', gran, 120, (c) => { got5 = c; }, slow as any);
    f5.push(candles); await sleep(60);
    ok(got5.slice(-30).every((c) => (c.v ?? 0) > 0) && got5.slice(0, 40).every((c) => c.v === undefined), 'progressive: newest 30 candles have volume while the rest is loading');
    await sleep(200);
    ok(got5.slice(-79).every((c) => (c.v ?? 0) > 0), 'progressive: the full history fills in afterwards');
    f5.stop();
  }

  // 6) cross pair: futures volume of its two currencies (proxy) reaches the candles, and tick volume is NOT needed
  {
    const mkRes = (rows: [number, number][]) => ({ ok: true, json: async () => ({ chart: { result: [{ timestamp: rows.map((r) => r[0]), indicators: { quote: [{ volume: rows.map((r) => r[1]) }] } }] } }) });
    const rows = (k: number): [number, number][] => candles.map((c) => [c.t, k] as [number, number]);
    (globalThis as any).fetch = async (u: string) => mkRes(String(u).includes('6E%3DF') ? rows(100) : rows(25));
    let got6: any[] = [], calls = 0;
    const f6 = withVolume('frxEURJPY', gran, 120, (c) => { got6 = c; }, (async () => { calls++; return []; }) as any);
    f6.push(candles); await sleep(150);
    ok(got6.slice(-40).every((c) => c.v === 125) && getVolUsed('frxEURJPY', gran) === 'futures' && calls === 0, 'cross proxy: EUR + JPY futures volume attached, no tick counting needed');
    f6.stop();
    (globalThis as any).fetch = async () => { throw new Error('Network request failed'); };
  }

  // 7) oil: candles from the futures contract already carry volume, so nothing is merged (and no ticks)
  {
    let got7: any[] = [];
    const withV = candles.map((c) => ({ ...c, v: 77 }));
    const f7 = withVolume('frxWTI', gran, 120, (c) => { got7 = c; }, loader);
    f7.push(withV); await sleep(20);
    ok(got7.length === 80 && got7.every((c) => c.v === 77), 'oil: its own volume is left untouched');
    f7.stop();
  }

  console.log(fails ? `${fails} FAILED` : 'volume feed test passed');
  process.exit(fails ? 1 : 0);
})();
