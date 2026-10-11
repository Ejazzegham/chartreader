import { ictAnalyze, killzoneAt, nextKillzone, killzonesFor, nyOffsetHours, ICT_STEPS, mergeIct } from '../src/ict';
import type { Candle } from '../src/markets';

let fails = 0;
const ok = (c: unknown, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };

// ---------- killzones (guide section 4.1, New York time) ----------
const at = (iso: string) => new Date(iso);
ok(nyOffsetHours(at('2026-10-08T12:00:00Z')) === 1 && nyOffsetHours(at('2026-12-08T12:00:00Z')) === 0, 'New York daylight saving is detected');
ok(killzoneAt(at('2026-10-08T06:30:00Z'))?.key === 'london', 'summer: 2:30 AM New York is the London killzone');
ok(killzoneAt(at('2026-12-08T07:30:00Z'))?.key === 'london', 'winter: 2:30 AM New York is the London killzone');
ok(killzoneAt(at('2026-10-08T07:30:00Z'))?.key === 'sbL', '3:30 AM New York is the London Silver Bullet (narrowest window wins)');
ok(killzoneAt(at('2026-10-08T11:15:00Z'))?.key === 'nyam', '7:15 AM New York is the New York AM killzone');
ok(killzoneAt(at('2026-10-08T14:30:00Z'))?.key === 'silver', '10:30 AM New York is the NY AM Silver Bullet');
ok(killzoneAt(at('2026-10-08T15:30:00Z'))?.key === 'lclose', '11:30 AM New York is London Close');
ok(killzoneAt(at('2026-10-08T17:45:00Z'))?.key === 'nypm', '1:45 PM New York is the New York PM killzone');
ok(killzoneAt(at('2026-10-08T18:30:00Z'))?.key === 'sbP', '2:30 PM New York is the PM Silver Bullet');
ok(killzoneAt(at('2026-10-08T21:00:00Z')) === null, '5 PM New York is outside every killzone');
ok(killzoneAt(at('2026-10-08T01:00:00Z'))?.key === 'asia', '9 PM New York is the Asian range');
ok(nextKillzone(at('2026-10-08T21:00:00Z')).mins > 0 && killzonesFor(at('2026-10-08T12:00:00Z')).length === 8, 'next killzone is found, 8 windows');
ok(mergeIct({ swingN: 99, dispMult: -1, sweepWindow: 0 } as any).swingN === 5 && mergeIct({ dispMult: -1 }).dispMult === 1 && mergeIct({ sweepWindow: 0 }).sweepWindow === 1, 'parameters are clamped to safe ranges');

// ---------- a textbook long: bullish higher timeframe, Asian low swept in the London killzone, MSS with displacement, pullback into the gap ----------
const T0 = Date.UTC(2026, 9, 6, 0, 0) / 1000; // Tue 6 Oct 2026 00:00 UTC, M5 candles
const G = 300;
const utc = (d: number, h: number, m = 0) => Math.round((Date.UTC(2026, 9, d, h, m) / 1000 - T0) / G);
let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const way: [number, number][] = [[utc(6, 0), 100.0], [utc(6, 12), 100.9], [utc(6, 20), 100.5], [utc(7, 8), 101.4], [utc(7, 14), 103.0], [utc(7, 20), 102.3], [utc(8, 0), 102.2], [utc(8, 3, 55), 102.3], [utc(8, 5, 30), 102.45], [utc(8, 6, 30), 102.5]];
const price = (i: number) => { let k = 0; while (k < way.length - 2 && way[k + 1][0] <= i) k++; const [i0, p0] = way[k], [i1, p1] = way[k + 1]; return p0 + ((p1 - p0) * (i - i0)) / Math.max(1, i1 - i0); };
const nCandles = utc(8, 7, 35) + 1;
const c: Candle[] = [];
for (let i = 0; i < nCandles; i++) {
  const pth = price(i) + Math.sin(i / 7) * 0.12 + Math.sin(i / 23) * 0.2, o = i ? c[i - 1].c : pth, cl = pth + (rnd() - 0.5) * 0.05;
  c.push({ t: T0 + i * G, o, c: cl, h: Math.max(o, cl) + rnd() * 0.04, l: Math.min(o, cl) - rnd() * 0.04 });
}
// the Asian range (8 PM to midnight New York = 00:00 to 04:00 UTC) is tight around 102.0 to 102.4
for (let i = utc(8, 0); i < utc(8, 4); i++) { const m = 102.2 + Math.sin(i / 3) * 0.12; c[i] = { t: c[i].t, o: m - 0.02, c: m + 0.02, h: Math.min(102.4, m + 0.06), l: Math.max(102.0, m - 0.06) }; }
// then a quiet climb into London, last swing high 102.60 before the sweep
for (let i = utc(8, 4); i < utc(8, 6, 55); i++) { const m = 102.3 + 0.28 * Math.min(1, (i - utc(8, 4)) / 40) + Math.sin(i / 4) * 0.04; c[i] = { t: c[i].t, o: m - 0.01, c: m + 0.01, h: m + 0.05, l: m - 0.05 }; }
const sc = (i: number, o: number, cl: number, h: number, l: number) => { c[i] = { t: T0 + i * G, o, c: cl, h, l }; };
const s0 = utc(8, 6, 55);
sc(s0, 102.55, 102.42, 102.57, 102.40);          // 2:55 AM NY: down
sc(s0 + 1, 102.42, 102.25, 102.43, 102.22);
sc(s0 + 2, 102.25, 102.10, 102.26, 102.07);
sc(s0 + 3, 102.10, 101.98, 102.11, 101.84);      // trades below the Asian low 102.0 (stops taken)
sc(s0 + 4, 101.98, 102.06, 102.10, 101.95);      // closes back above it: the sweep
sc(s0 + 5, 102.06, 102.50, 102.52, 102.05);      // displacement up (gap above the high of the candle before)
sc(s0 + 6, 102.50, 102.92, 102.95, 102.48);      // displacement again, closes above the last swing high: MSS
sc(s0 + 7, 102.92, 102.80, 102.94, 102.70);      // pullback
sc(s0 + 8, 102.80, 102.62, 102.82, 102.55);
sc(s0 + 9, 102.62, 102.40, 102.64, 102.34);
const last = c.length - 1;
sc(last, 102.40, 102.38, 102.43, 102.30);        // price is now inside the fair value gap
const agg = (src: Candle[], g: number): Candle[] => { const m = new Map<number, Candle>(); for (const x of src) { const k = Math.floor(x.t / g) * g, e = m.get(k); if (!e) m.set(k, { t: k, o: x.o, h: x.h, l: x.l, c: x.c }); else { e.h = Math.max(e.h, x.h); e.l = Math.min(e.l, x.l); e.c = x.c; } } return [...m.values()].sort((a, b) => a.t - b.t); };
const h1 = agg(c, 3600);
const now = new Date(c[last].t * 1000 + 60_000); // 07:36 UTC = 3:36 AM New York (Silver Bullet London)
console.log('last candle', new Date(c[last].t * 1000).toISOString(), 'h1 candles', h1.length);
const r = ictAnalyze(c, now, { htf: h1 });
console.log(r.ok, r.reason, 'bias', r.bias?.dir, r.bias?.source, r.bias?.reasons, 'draw', r.bias?.draw);
console.log('levels', r.levels?.map((l) => `${l.key} ${l.price.toFixed(2)}${l.swept ? ' swept' : ''}`).join(', '));
console.log('sweep', r.sweep, 'mss', r.mss, 'killzone', r.killzone?.key, 'trend', r.trend);
console.log('verdict', r.verdict, '|', r.next);
if (r.setup) console.log(r.setup.model, 'entry', r.setup.entry.toFixed(3), 'sl', r.setup.sl.toFixed(3), 'tps', r.setup.tps.map((x) => x.toFixed(3)).join('/'), 'rr', r.setup.rr.map((x) => x.toFixed(1)).join('/'), 'score', r.setup.score, r.setup.grade, 'ready', r.setup.ready, r.setup.missing);
if (r.setup) console.log(r.setup.confluence.map((x, i) => (x.ok ? '✓ ' : '○ ') + (ICT_STEPS[i] ?? 'quality') + ': ' + x.text).join('\n'));

ok(r.ok, 'engine runs on the scenario');
ok(r.bias?.dir === 'bullish' && r.bias.source === 'htf', 'higher timeframe bias is bullish');
ok(r.levels?.some((l) => l.key === 'ASL' && Math.abs(l.price - 102.0) < 0.05), 'Asian low is marked from the 8 PM to midnight range');
ok(r.levels?.some((l) => l.key === 'PDH'), 'previous day high is marked');
ok(r.sweep?.side === 'SSL' && /Asian/.test(r.sweep.label), 'sell-side liquidity (Asian low) was swept');
ok(!!r.mss && r.mss.dir === 'bullish' && r.mss.displaced, 'MSS with displacement after the sweep');
ok(r.killzone?.key === 'sbL', 'inside the London Silver Bullet');
ok(!!r.setup && r.setup.side === 'buy', 'a buy setup is built');
ok(!!r.setup && r.setup.slBasis === 'sweep' && r.setup.sl < 101.84, 'stop sits beyond the swept low');
ok(!!r.setup && r.setup.tps[0] > r.setup.entry && r.setup.tps[1] > r.setup.tps[0] && r.setup.tps[2] > r.setup.tps[1], 'targets are ordered above the entry');
ok(!!r.setup && r.setup.ready && r.verdict === 'trade', 'all 8 pre-trade questions pass: verdict TRADE');

// the same chart outside a killzone must NOT be a trade
const r2 = ictAnalyze(c, new Date('2026-10-08T21:30:00Z'), { htf: h1 });
ok(r2.setup && !r2.setup.ready && r2.verdict !== 'trade' && /killzone/i.test(r2.setup.missing.join(' ')), 'outside a killzone: not ready, the missing step is named');
// without the sweep (cut the candles before it) the setup cannot be ready
const r3 = ictAnalyze(c.slice(0, s0 + 2), new Date(c[s0 + 2].t * 1000 + 60000), { htf: agg(c.slice(0, s0 + 2), 3600) });
ok(!r3.setup || !r3.setup.ready, 'before the sweep: not ready');
// news flag fails the last check
const r4 = ictAnalyze(c, now, { htf: h1, news: 'US CPI in 20 min' });
ok(r4.setup && !r4.setup.ready && /news/i.test(r4.setup.missing.join(' ')), 'major news blocks the trade');

// ---------- fuzz: random markets never crash and every setup is internally consistent ----------
let setups = 0, readyN = 0;
for (let sd = 1; sd <= 150; sd++) {
  let s = sd * 7919; const rr = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  let p = 100; const t0 = Date.UTC(2026, 9, 5, 0, 0) / 1000;
  const cc: Candle[] = Array.from({ length: 480 }, (_, i) => { const o = p; p += Math.sin(i / (9 + (sd % 7))) * 0.25 + (rr() - 0.5) * 0.6; return { t: t0 + i * 900, o, c: p, h: Math.max(o, p) + rr() * 0.3, l: Math.min(o, p) - rr() * 0.3 }; });
  const hh = agg(cc, 14400);
  for (const hz of [undefined, hh]) {
    const x = ictAnalyze(cc, new Date(cc[cc.length - 1].t * 1000 + 3 * 3600_000 * (sd % 8)), hz ? { htf: hz } : {});
    const q = x.setup;
    if (!q) continue;
    setups++; if (q.ready) readyN++;
    const buy = q.side === 'buy', good = isFinite(q.entry) && isFinite(q.sl) && q.tps.every(isFinite) && (buy ? q.sl < q.entry && q.tps[0] > q.entry && q.tps[1] >= q.tps[0] && q.tps[2] >= q.tps[1] : q.sl > q.entry && q.tps[0] < q.entry && q.tps[1] <= q.tps[0] && q.tps[2] <= q.tps[1]) && q.score >= 0 && q.score <= 100 && q.rr.every((v) => v > 0) && q.confluence.length === 11 && (!q.ready || q.missing.length === 0) && q.zoneTop >= q.zoneBottom;
    if (!good) { ok(false, `fuzz seed ${sd}: inconsistent setup ${JSON.stringify(q)}`); break; }
  }
}
ok(setups > 20, `fuzz: ${setups} setups built on 300 random runs, all consistent (${readyN} ready)`);
console.log(fails ? `${fails} FAILED` : 'ALL OK');
process.exit(fails ? 1 : 0);
