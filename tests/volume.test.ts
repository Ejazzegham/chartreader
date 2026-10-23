import { attachVolume, volumeSource, feedHasVolume, closedCandles, isForming, granOf, setVolState, volMissingNote, volCover, tickVolOk, tickBarsFrom, volTile, volLabel, hasVolumePath, setTickState, setVolUsed, TICK_LABEL, crossLegs, fmtVol, volMA, volPaneNote } from '../src/volume';
import { yahooOnly, yahooId, yahooVolumeMulti } from '../src/fallback';
import { lotUnits, lotInfo } from '../src/lots';
import { SYMBOLS } from '../src/markets';
import { vsaAnalyze, hasRealVolume } from '../src/vsa';
import { analyzeAll } from '../src/refine';
let fails = 0;
const ok = (c: unknown, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };

ok(volumeSource('frxEURUSD')?.kind === 'yahoo' && volumeSource('frxXAUUSD')?.label.includes('gold'), 'forex and gold use futures volume');
ok(volumeSource('cryBTCUSD')?.kind === 'binance' && feedHasVolume('bnETHUSDT'), 'crypto uses Binance volume');
ok(volumeSource('R_100') === null && volumeSource('BOOM1000') === null && volumeSource('frxUSDMXN') === null, 'synthetics and pairs with no futures at all have no volume source');

// crosses: the volume of the two currency futures (a labelled proxy), so EUR/JPY and GBP/JPY now have volume on every timeframe
{
  const e = volumeSource('frxEURJPY') as any, g = volumeSource('frxGBPJPY') as any;
  ok(e?.y === '6E=F' && e?.y2 === '6J=F' && e?.proxy === true && e.label.includes('EUR + JPY') && e.label.includes('proxy'), 'EUR/JPY = EUR futures + JPY futures, labelled as a proxy');
  ok(g?.y === '6B=F' && g?.y2 === '6J=F', 'GBP/JPY = GBP futures + JPY futures');
  ok(crossLegs('frxEURGBP')?.y === '6E=F' && crossLegs('frxEURGBP')?.y2 === '6B=F' && crossLegs('frxAUDNZD')?.y2 === '6N=F', 'any cross of two covered currencies works');
  ok(!crossLegs('frxEURUSD') && !crossLegs('frxUSDJPY') && !crossLegs('frxXAUUSD') && !crossLegs('R_100'), 'USD pairs, metals and synthetics are not crosses');
  ok((volumeSource('frxEURUSD') as any)?.y === '6E=F' && !(volumeSource('frxEURUSD') as any)?.y2, 'majors keep their own single contract');
}

// oil is a real symbol of the app, read from the futures contract itself (candles carry their own volume)
{
  const w = SYMBOLS.find((x) => x.id === 'frxWTI'), b = SYMBOLS.find((x) => x.id === 'frxBRENT');
  ok(!!w && !!b && w.cat === 'forex' && b.cat === 'forex', 'WTI and Brent oil are in the symbol list');
  ok(yahooId('frxWTI') === 'CL=F' && yahooId('frxBRENT') === 'BZ=F' && yahooOnly('frxWTI') && yahooOnly('frxBRENT') && yahooOnly('frxDXY') && !yahooOnly('frxXAUUSD'), 'oil candles come from NYMEX / ICE futures');
  ok((volumeSource('frxWTI') as any)?.y === 'CL=F' && (volumeSource('frxBRENT') as any)?.y === 'BZ=F', 'oil has futures volume');
  ok(feedHasVolume('frxWTI') && feedHasVolume('frxBRENT') && !feedHasVolume('frxDXY') && !feedHasVolume('frxXAUUSD'), 'oil candles already carry volume; DXY and gold still need the merge');
  ok(!tickVolOk('frxWTI', 300) && !tickVolOk('frxBRENT', 300), 'oil has no Deriv ticks to count');
  ok(lotUnits('frxWTI') === 1000 && lotInfo('frxBRENT', 80).includes('1,000 barrels'), 'oil lot = 1,000 barrels');
}

// oil: Brent and WTI use ICE / NYMEX futures volume, whatever the broker calls the symbol
ok((volumeSource('frxBROUSD') as any)?.y === 'BZ=F' && (volumeSource('frxXBRUSD') as any)?.y === 'BZ=F', 'Brent oil uses ICE Brent futures volume');
ok((volumeSource('frxWTIUSD') as any)?.y === 'CL=F' && (volumeSource('frxXTIUSD') as any)?.y === 'CL=F' && (volumeSource('frxUSOIL') as any)?.y === 'CL=F', 'WTI oil uses NYMEX crude futures volume');
ok((volumeSource('frxEURGBP') as any)?.y === '6E=F' && (volumeSource('frxAUDJPY') as any)?.y === '6A=F', 'oil patterns do not catch forex crosses (they get their currency legs)');

// the VSA screen says WHY volume is missing (loading / feed failed / too few candles with trades / no source)
const gr = 900, c40 = Array.from({ length: 40 }, (_, i) => ({ t: 1_760_000_000 + i * gr, o: 1, h: 2, l: 1, c: 1.5 }));
ok(volMissingNote('frxXAUUSD', gr, c40).startsWith('Loading real volume'), 'no state yet: says loading');
setVolState('frxXAUUSD', gr, 'failed');
ok(volMissingNote('frxXAUUSD', gr, c40).includes('did not answer'), 'feed failed: says so');
setVolState('frxXAUUSD', gr, 'ok');
ok(volMissingNote('frxXAUUSD', gr, c40.map((x, i) => (i < 10 ? { ...x, v: 5 } : x))).includes('only 10 of the last 40'), 'feed ok but few candles have trades: says how many');
ok(volMissingNote('R_100', gr, c40).includes('Synthetic'), 'synthetic index: no source, says why');
ok(volCover(c40.map((x) => ({ ...x, v: 3 }))).have === 40, 'coverage counts candles with volume');

// Deriv tick volume: M1-H1 forex / metals only, never synthetics, never DXY or oil
ok(tickVolOk('frxEURJPY', 900) && tickVolOk('frxXAUUSD', 60) && tickVolOk('frxEURUSD', 3600) && !tickVolOk('frxEURJPY', 7200) && !tickVolOk('R_100', 60) && !tickVolOk('frxDXY', 60), 'tick volume only for forex-type pairs on M1 to H1');
ok(hasVolumePath('frxEURJPY', 300) && hasVolumePath('frxEURJPY', 86400) && !hasVolumePath('BOOM1000', 60) && !hasVolumePath('frxUSDMXN', 14400) && hasVolumePath('frxUSDMXN', 900), 'crosses have a volume path on every timeframe; a pair with no futures only on M1-H1 (ticks)');
ok(volLabel('frxEURJPY', 300).includes('EUR + JPY') && volLabel('frxXAUUSD', 14400).includes('gold'), 'label names the volume that is used');
setVolUsed('frxEURJPY', 300, 'ticks'); ok(volLabel('frxEURJPY', 300) === TICK_LABEL, 'label switches to tick volume when ticks are the source');
ok(volMissingNote('frxUSDMXN', 14400, c40).includes('Switch to H1'), 'pair with no futures on H4: says tick volume needs H1 or lower');
ok(volTile('frxEURJPY', 300) === 'Loading...', 'tile: loading');
setTickState('frxEURJPY', 300, 'failed'); setVolState('frxEURJPY', 300, 'failed'); ok(volTile('frxEURJPY', 300) === 'Feed error', 'tile: feed error when every source failed');
setTickState('frxEURJPY', 300, 'ok'); setVolState('frxEURJPY', 300, 'ok'); ok(volTile('frxEURJPY', 300) === 'Too little volume', 'tile: loaded but too thin');
{
  const g5 = 300, b0 = 1_760_000_100 - (1_760_000_100 % g5);
  // ticks start in the middle of candle 0 (cut off), candle 1 has 4 ticks, candle 2 has 2, candle 3 has none, candle 4 has 1
  const tk = [b0 + 200, b0 + 250, b0 + g5 + 1, b0 + g5 + 50, b0 + g5 + 100, b0 + g5 + 299, b0 + 2 * g5 + 5, b0 + 2 * g5 + 7, b0 + 4 * g5 + 9];
  const bb = tickBarsFrom([...tk].reverse(), g5);
  ok(bb.length === 3 && bb[0].t === b0 + g5 && bb[0].v === 4 && bb[1].v === 2 && bb[2].t === b0 + 4 * g5 && bb[2].v === 1, 'tick counts per candle: cut-off first candle dropped, empty candle stays empty');
}

// 1-minute volume bars are summed into 5-minute candles; missing bars stay without volume
const base = 1_760_000_000 - (1_760_000_000 % 300);
const candles = [0, 1, 2].map((i) => ({ t: base + i * 300, o: 1, h: 2, l: 0.5, c: 1.5 }));
const bars = [0, 1, 2, 3, 4, 5, 6].map((i) => ({ t: base + i * 60, o: 0, h: 0, l: 0, c: 0, v: 10 }));
const m = attachVolume(candles, bars, 300);
ok(m[0].v === 50 && m[1].v === 20 && m[2].v === undefined, 'volume summed per candle, never invented');

// forming candle
const g = 900, tn = 1_760_000_000, cs = Array.from({ length: 30 }, (_, i) => ({ t: tn - (29 - i) * g, o: 1, h: 2, l: 1, c: 1.5 }));
ok(granOf(cs) === g, 'granularity read from the candles');
ok(isForming(cs, (tn + 100) * 1000) && !isForming(cs, (tn + g + 1) * 1000), 'last candle is forming until its time is over');
ok(closedCandles(cs, (tn + 100) * 1000).length === 29 && closedCandles(cs, (tn + g + 1) * 1000).length === 30, 'forming candle dropped');

// VSA without volume gives no signal at all
const nov = Array.from({ length: 80 }, (_, i) => ({ t: tn - (79 - i) * g, o: 100 + i * 0.1, h: 101 + i * 0.1, l: 99 + i * 0.1, c: 100.5 + i * 0.1 }));
const v0 = vsaAnalyze(nov);
ok(v0.ok && !v0.hasVolume && v0.signals.length === 0 && v0.bias === 'wait' && !v0.setup && !v0.reversal, 'no real volume: VSA abstains');
ok(!hasRealVolume(nov) && hasRealVolume(nov.map((x) => ({ ...x, v: 500 }))), 'real volume detection');
const a = analyzeAll(nov, new Date('2026-10-14T13:00:00Z'));
ok(a.votes.find((x) => x.method === 'VSA')!.side === null, 'VSA casts no vote without volume');

// NO REPAINT: whatever the forming candle does, the methods read the same closed candles
let seed = 5; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
let p = 100; const now = new Date('2026-10-14T13:00:30Z'), ns = now.getTime() / 1000;
const ser = Array.from({ length: 260 }, (_, i) => { const o = p; p += Math.sin(i / 14) * 0.35 + (rnd() - 0.5) * 0.5; return { t: Math.floor(ns / g) * g - (259 - i) * g, o, c: p, h: Math.max(o, p) + rnd() * 0.3, l: Math.min(o, p) - rnd() * 0.3, v: 800 + rnd() * 900 }; });
ok(isForming(ser, now.getTime()), 'test series ends with a forming candle');
const ser2 = ser.map((x, i) => (i === ser.length - 1 ? { ...x, h: x.h + 3, l: x.l - 3, c: x.c + 2, v: 99999 } : x));
const A = analyzeAll(ser, now), B = analyzeAll(ser2, now);
const sig = (r: any) => JSON.stringify([r.ict, r.smc, r.vsa, r.pat, r.cdl]);
ok(sig(A) === sig(B), 'ICT, SMC, VSA, patterns and candles do not change when only the forming candle changes');

// ---- VSA volume rule: 70% of the last 40 candles + 2 of the newest 3, gaps skipped (was 85%) ----
{
  const g2 = 900, t2 = 1_760_000_000, mk = (hasVol: (i: number) => boolean) => Array.from({ length: 60 }, (_, i) => ({ t: t2 + i * g2, o: 100 + i * 0.1, h: 101 + i * 0.1, l: 99 + i * 0.1, c: 100.5 + i * 0.1, ...(hasVol(i) ? { v: 500 + (i % 7) * 40 } : {}) }));
  ok(hasRealVolume(mk((i) => !(i >= 20 && i < 31))), '29 of 40 candles with volume (the gold case from the screenshot) is enough now');
  ok(!hasRealVolume(mk((i) => i % 2 === 0)), 'half the candles with volume is still not enough');
  ok(!hasRealVolume(mk((i) => i < 55)), 'volume missing on the newest candles: no read (it would be about old candles)');
  ok(hasRealVolume(mk((i) => i !== 59 && i % 9 !== 0)), 'the forming candle may still lack volume');
  const gap = vsaAnalyze(mk((i) => !(i >= 20 && i < 31)));
  ok(gap.ok && gap.hasVolume, 'VSA runs through a futures break / quiet gap');
}

// ---- volume pane helpers ----
ok(fmtVol(0) === '0' && fmtVol(850) === '850' && fmtVol(12345) === '12.3K' && fmtVol(250000) === '250K' && fmtVol(4_200_000) === '4.20M' && fmtVol(NaN) === '0', 'volume is shown as 850 / 12.3K / 4.20M');
{
  const c = Array.from({ length: 12 }, (_, i) => ({ t: i, o: 1, h: 2, l: 1, c: 1.5, ...(i === 6 ? {} : { v: 100 }) }));
  const m = volMA(c, 20, 5);
  ok(isNaN(m[3]) && m[4] === 100 && m[6] === 100 && m[11] === 100, 'volume average ignores a gap instead of dropping to zero, and waits for 5 bars');
}
{
  const c = Array.from({ length: 50 }, (_, i) => ({ t: i * 900, o: 1, h: 2, l: 1, c: 1.5 }));
  ok(volPaneNote('frxXAUUSD', 900, c.map((x) => ({ ...x, v: 5 }))) === '', 'pane note empty when candles carry volume');
  ok(volPaneNote('R_100', 60, c) === 'No volume: synthetic index', 'pane says why a synthetic index has no volume');
  ok(volPaneNote('frxEURGBP', 14400, c).length > 0 && volPaneNote(undefined, 900, c) === '', 'pane note for a market that should have volume / unknown market');
}

// ---- two-leg cross volume: a bar is kept only where BOTH currency futures traded ----
(async () => {
  const base = 1_760_000_000 - (1_760_000_000 % 900);
  const mkRes = (rows: [number, number | null][]) => ({ ok: true, json: async () => ({ chart: { result: [{ timestamp: rows.map((r) => r[0]), indicators: { quote: [{ volume: rows.map((r) => r[1]) }] } }] } }) });
  (globalThis as any).fetch = async (u: string) => (String(u).includes('6E%3DF') ? mkRes([[base, 100], [base + 900, 200], [base + 1800, 300]]) : mkRes([[base, 10], [base + 1800, 30]]));
  const r = await yahooVolumeMulti(['6E=F', '6J=F'], 900);
  ok(r.length === 2 && r[0].t === base && r[0].v === 110 && r[1].t === base + 1800 && r[1].v === 330, 'cross proxy: legs are summed per bar, half-traded bars are dropped');
  const one = await yahooVolumeMulti(['6E=F'], 900);
  ok(one.length === 3 && one[1].v === 200, 'single contract: bars unchanged');
  (globalThis as any).fetch = async () => { throw new Error('offline'); };
  const dead = await yahooVolumeMulti(['6E=F', '6J=F'], 900);
  ok(dead.length === 0, 'cross proxy: both legs unreachable gives no volume (never invented)');
  console.log(fails ? `${fails} FAILED` : 'volume test passed');
  process.exit(fails ? 1 : 0);
})();
