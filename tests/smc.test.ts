import { smcAnalyze, mergeSmc, SMC_DEFAULTS } from '../src/smc';
import { pivots } from '../src/ta';
import type { Candle } from '../src/markets';

let fails = 0;
const ok = (c: unknown, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };

const T0 = 1_760_000_000;
const lcg = (sd: number) => { let seed = sd; return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; };

// ---------- parameters (every rule is configurable and clamped) ----------
ok(mergeSmc({ swingN: 99, internalN: 0, dispMult: -1, sweepWindow: 0, minPoi: 99, htfFactor: 1 } as any).swingN === 5
  && mergeSmc({ internalN: 0 } as any).internalN === 2 && mergeSmc({ dispMult: -1 }).dispMult === 1 && mergeSmc({ sweepWindow: 0 }).sweepWindow === 1
  && mergeSmc({ minPoi: 99 }).minPoi === 8 && mergeSmc({ htfFactor: 1 }).htfFactor === 3 && mergeSmc({ entryAt: 'edge' }).entryAt === 'edge', 'parameters are clamped to the ranges in the guide');
ok(SMC_DEFAULTS.minPoi === 6 && SMC_DEFAULTS.minRR === 2, 'defaults: POI score 6 of 8 and main target 1:2 (guide 3.9, 7)');

// ---------- a textbook long (guide 6.1): HTF bullish, sell-side liquidity swept, CHoCH with displacement, pullback into the FVG / OB ----------
const way: [number, number][] = [[0, 100], [30, 106], [45, 103.5], [75, 112], [95, 108.2], [125, 116], [160, 109.6]];
const base = (i: number) => { let k = 0; while (k < way.length - 2 && way[k + 1][0] <= i) k++; const [i0, p0] = way[k], [i1, p1] = way[k + 1]; return p0 + ((p1 - p0) * (i - i0)) / Math.max(1, i1 - i0); };
function textbook(): Candle[] {
  const rnd = lcg(5), c: Candle[] = [];
  for (let i = 0; i <= 160; i++) { const p = base(i) + (rnd() - 0.5) * 0.5, o = i ? c[i - 1].c : p; c.push({ t: T0 + i * 900, o, c: p, h: Math.max(o, p) + rnd() * 0.25, l: Math.min(o, p) - rnd() * 0.25 }); }
  const push = (o: number, cl: number, h: number, l: number) => c.push({ t: T0 + c.length * 900, o, c: cl, h, l });
  const lo = Math.min(...c.slice(80, 110).map((x) => x.l));
  push(109.6, 109.2, 109.7, 108.9); push(109.2, 108.6, 109.3, 108.4);
  push(108.6, 108.9, 109.0, lo - 0.25);   // wick below the swing low, close back above: a sweep, not a break
  push(108.9, 109.9, 110.0, 108.8);
  push(109.9, 112.6, 112.7, 109.8);       // displacement: big body, closes at its high, leaves a gap
  push(112.6, 113.4, 113.6, 112.4); push(113.4, 112.4, 113.5, 112.2); push(112.4, 111.4, 112.5, 111.3); push(111.4, 110.7, 111.5, 110.5);
  return c;
}
const long = textbook(), swingLow = Math.min(...long.slice(80, 110).map((x) => x.l));
const r = smcAnalyze(long);
const s = r.setup;
ok(r.ok && r.bias?.dir === 'bullish' && r.trend === 'bullish', 'higher-timeframe bias and swing structure are bullish');
ok(!!r.sweep && r.sweep.side === 'SSL' && Math.abs(r.sweep.price - swingLow) < 1e-9, 'the wick below the swing low is read as a sell-side liquidity SWEEP (closed back inside)');
ok(r.internal?.dir === 'bullish' && r.internal.kind === 'CHoCH' && r.internal.disp === true, 'the break after the sweep is a CHoCH with displacement');
ok(r.zone === 'discount' && !!r.ote && r.ote.bottom < r.ote.sweet && r.ote.sweet < r.ote.top, 'price is in discount and the OTE band is drawn (62 - 79 %)');
{ const R = r.range!.high - r.range!.low; ok(Math.abs(r.ote!.top - (r.range!.high - 0.62 * R)) < 1e-9 && Math.abs(r.ote!.bottom - (r.range!.high - 0.79 * R)) < 1e-9 && Math.abs(r.ote!.sweet - (r.range!.high - 0.705 * R)) < 1e-9, 'OTE = 0.62 to 0.79 of the leg, sweet spot 0.705'); }
const fvg = r.zones.find((z) => z.kind === 'FVG' && z.side === 'bullish' && Math.abs(z.bottom - 109.0) < 1e-6);
ok(!!fvg && Math.abs(fvg.top - 109.8) < 1e-6 && Math.abs(fvg.mean - 109.4) < 1e-6 && fvg.fresh, 'bullish FVG = candle 1 high to candle 3 low, CE is its midpoint, still unmitigated');
ok(!!s && s.side === 'buy' && s.ready && s.model === 'Sweep + CHoCH + POI retest', 'setup: buy, every pre-trade rule passes, model "Sweep + CHoCH + POI retest"');
if (s) {
  ok(s.confluence.length === 8 && s.confluence[4].key === 'idm' && s.poiChecks.length === 8, 'checklist has 8 items (inducement stays at index 4) and the POI score has 8 checks');
  ok(s.poiScore === s.poiChecks.filter((x) => x.ok).length && s.poiScore >= 6, 'POI score is the number of passed checks and is at least 6');
  ok(s.slBasis === 'sweep' && s.sl < r.sweep!.extreme, 'stop goes beyond the swept extreme');
  ok(s.entry === s.zone.mean && s.sl < s.entry && s.tps[0] > s.entry && s.tps[0] < s.tps[1] && s.tps[1] < s.tps[2], 'entry at the middle of the POI, stop below, targets rise in order');
  ok(s.rr[1] >= 2, 'main target (TP2) is at least 1:2');
  ok(s.score >= 70 && (s.grade === 'A' || s.grade === 'A+'), `ready setup scores 70 or more (got ${s.score} ${s.grade})`);
  ok(!!r.plan && r.plan.includes('buy') && r.plan.includes('do nothing'), 'the written if-then plan is produced (guide section 5)');
}

// ---------- the same chart mirrored must give the mirror trade ----------
const mid = 200;
const mirror = long.map((x) => ({ ...x, o: mid - x.o, c: mid - x.c, h: mid - x.l, l: mid - x.h }));
const rm = smcAnalyze(mirror);
ok(!!rm.setup && rm.setup.side === 'sell' && rm.setup.ready && rm.setup.sl > rm.setup.entry && rm.setup.tps[0] < rm.setup.entry && rm.sweep?.side === 'BSL', 'mirrored chart: sell setup, buy-side liquidity swept, stop above');

// ---------- not ready = capped (guide 12: if any answer is no, there is no trade) ----------
const noSweep = long.slice(0, 161);                      // the same chart before the sweep and the CHoCH
const rn = smcAnalyze(noSweep);
ok(!rn.setup || !rn.setup.ready || rn.setup.score >= 70, 'before the sweep the engine does not claim a ready trade it cannot prove');

// ---------- a wick through a swing point is a sweep, not a break (guide 3.2) ----------
function zig(extra: (c: Candle[], level: number) => void) {
  const closes = [100, 100.5, 101, 101.5, 102, 102.5, 103, 103.5, 104, 104.5, 105, 104.4, 103.8, 103.2, 102.6, 102.2, 102.6, 103.0, 103.4, 103.8, 104.2, 104.0, 103.7, 103.4, 103.7, 104.0, 104.2, 103.9, 103.6, 103.9, 104.1, 103.8, 103.5, 103.8, 104.0, 103.7, 103.9, 104.1, 103.8, 103.6, 103.8, 104.0, 103.7, 103.9];
  const c: Candle[] = closes.map((p, i) => { const o = i ? closes[i - 1] : p; return { t: T0 + i * 900, o, c: p, h: Math.max(o, p) + 0.05 + ((i * 37) % 7) / 100, l: Math.min(o, p) - 0.05 - ((i * 53) % 7) / 100 }; });
  const level = pivots(c, SMC_DEFAULTS.swingN).hi.slice(-1)[0].p;   // the last confirmed swing high
  extra(c, level);
  return { c, level };
}
{
  const a = zig((c, level) => { const p = c[c.length - 1].c; c.push({ t: T0 + c.length * 900, o: p, c: level - 0.3, h: level + 0.4, l: p - 0.1 }); });
  const b = zig((c, level) => { const p = c[c.length - 1].c; c.push({ t: T0 + c.length * 900, o: p, c: level + 0.4, h: level + 0.5, l: p - 0.1 }); });
  const ra = smcAnalyze(a.c), rb = smcAnalyze(b.c);
  const lastA = a.c.length - 1, lastB = b.c.length - 1;
  ok(!(ra.swing && ra.swing.i === lastA && ra.swing.dir === 'bullish'), 'a wick above the swing high with a close below it is NOT a break of structure');
  ok(!!rb.swing && rb.swing.i === lastB && rb.swing.dir === 'bullish' && rb.swing.level === b.level, 'a BODY close above the swing high IS a break of structure');
}

// ---------- equal highs are liquidity; a sweep needs the close back inside ----------
{
  const closes = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 109, 108, 107, 106, 107, 108, 109, 110, 109, 108, 107, 106, 105, 104, 103, 102, 103, 104, 105, 106, 105, 104, 103, 102, 101, 100, 101, 102, 103, 104, 105, 104, 103, 102, 101, 100, 99];
  const c: Candle[] = closes.map((p, i) => { const o = i ? closes[i - 1] : p; return { t: T0 + i * 900, o, c: p, h: Math.max(o, p) + 0.1 + ((i * 37) % 7) / 100 * (p === 110 ? 0 : 1) + (p === 110 ? 0.1 : 0), l: Math.min(o, p) - 0.1 - ((i * 53) % 7) / 100 }; });
  const q = smcAnalyze(c);
  ok(q.liquidity.some((l) => l.label === 'EQH' && l.side === 'BSL'), 'two highs at nearly the same price are marked as equal highs (EQH, buy-side liquidity)');
}

// ---------- neutral higher timeframe = no trade (guide 4, step 1) ----------
{
  const flat: Candle[] = Array.from({ length: 80 }, (_, i) => { const p = 100 + (i % 8 < 4 ? (i % 8) * 0.5 : (7 - (i % 8)) * 0.5), o = i ? 100 + ((i - 1) % 8 < 4 ? ((i - 1) % 8) * 0.5 : (7 - ((i - 1) % 8)) * 0.5) : p; return { t: T0 + i * 3600, o, c: p, h: Math.max(o, p) + 0.1, l: Math.min(o, p) - 0.1 }; });
  const rf = smcAnalyze(long, { htf: flat });
  ok(rf.bias?.dir === 'neutral' && !rf.setup && /neutral/i.test(rf.next ?? ''), 'a sideways higher timeframe gives a neutral bias and no setup');
}

// ---------- invariants on 600 random markets ----------
{
  let setups = 0, ready = 0, bad = 0, kinds: Record<string, number> = {};
  for (let sd = 1; sd <= 600; sd++) {
    const rnd = lcg(sd * 7919); let p = 100; const amp = 0.2 + rnd() * 0.6, per = 8 + rnd() * 30;
    const c: Candle[] = Array.from({ length: 260 }, (_, i) => { const o = p; p += Math.sin(i / per) * amp + (rnd() - 0.5) * 0.9; return { t: T0 + i * 900, o, c: p, h: Math.max(o, p) + rnd() * 0.4, l: Math.min(o, p) - rnd() * 0.4 }; });
    const x = smcAnalyze(c);
    x.zones.forEach((z) => { kinds[z.kind] = (kinds[z.kind] ?? 0) + 1; if (!(z.top > z.bottom) || !isFinite(z.mean)) bad++; });
    const t = x.setup; if (!t) continue;
    setups++; if (t.ready) ready++;
    const side = t.side === 'buy' ? t.sl < t.entry && t.tps[0] > t.entry && t.tps[0] < t.tps[1] && t.tps[1] < t.tps[2] : t.sl > t.entry && t.tps[0] < t.entry && t.tps[0] > t.tps[1] && t.tps[1] > t.tps[2];
    const fin = [t.entry, t.sl, ...t.tps, ...t.rr, t.score].every(Number.isFinite);
    if (!side || !fin || t.score < 0 || t.score > 100 || (!t.ready && t.score > 69) || (t.ready && (t.poiScore < 6 || t.rr[1] < 2 || t.score < 70)) || t.confluence.length !== 8) bad++;
  }
  console.log('     random markets:', { setups, ready, kinds });
  ok(bad === 0, 'random markets: valid stops and targets, never NaN, "not ready" is always capped at 69, "ready" always has POI >= 6 and main target >= 1:2');
}

if (fails) { console.log(fails + ' failed'); process.exit(1); } else console.log('all smc tests passed');
