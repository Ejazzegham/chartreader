import { vsaAnalyze } from '../src/vsa';

// Builds a downtrend, a selling climax, then a low-volume breakout, a retest and a confirmation candle.
type C = { t: number; o: number; h: number; l: number; c: number; v: number };
const bars: C[] = []; let t = 1_760_000_000;
const add = (o: number, h: number, l: number, c: number, v: number) => bars.push({ t: (t += 900), o, h, l, c, v });
let p = 110;
for (let i = 0; i < 40; i++) { const o = p; p -= 0.5 + (i % 3) * 0.1; add(o, o + 0.3, p - 0.3, p, 1000 + (i % 5) * 40); }   // steady fall, normal volume
// selling climax: wide down bar, huge volume, closes off the low
add(p, p + 0.2, p - 3.2, p - 1.0, 4200); const climaxHigh = bars[bars.length - 1].h; p -= 1.0;
for (let i = 0; i < 3; i++) { const o = p; p += 0.25; add(o, o + 0.4, o - 0.2, p, 900); }                     // bounce, still under the climax high
add(p, climaxHigh + 1.2, p - 0.1, climaxHigh + 1.0, 500); p = climaxHigh + 1.0;                               // LOW-volume breakout above the climax high
const lvl = climaxHigh;
const stage = (label: string) => { const r = vsaAnalyze(bars as any); console.log(label.padEnd(26), r.reversal ? `${r.reversal.tag} stage ${r.reversal.stage}` : 'none', r.setup ? `SETUP ${r.setup.side} e=${r.setup.entry.toFixed(2)} sl=${r.setup.sl.toFixed(2)}` : 'no setup'); return r; };
const s1 = stage('after breakout');
add(p, p + 0.3, lvl + 0.05, lvl + 0.35, 450); p = lvl + 0.35;                                                  // retest touches the level on low volume, holds
const s2 = stage('after retest');
add(p, p + 1.4, p - 0.1, p + 1.2, 800); p += 1.2;                                                               // bullish confirmation candle
const s3 = stage('after confirmation');
const ok = s1.reversal?.stage === 'breakout' && !s1.setup && s2.reversal?.stage === 'retest' && !s2.setup && s3.reversal?.stage === 'confirmed' && s3.setup?.side === 'buy' && s3.setup.sl < s3.setup.entry;
// heavy-volume breakout must NOT count
const bad = bars.slice(0, 44); bad.push({ t: (t += 900), o: p, h: lvl + 2, l: p, c: lvl + 1.5, v: 5000 });
const rb = vsaAnalyze(bad as any); console.log('heavy-volume breakout     ', rb.reversal ? rb.reversal.stage + (rb.reversal.badBreakout ? ' (rejected)' : '') : 'none');
if (!ok || (rb.reversal && rb.reversal.stageNo > 1)) { console.log('FAIL'); process.exit(1); }
console.log('vsa reversal test passed');
// mirror: the same story upside down must give a SELL after a buying climax
const mir = bars.map((b) => ({ t: b.t, o: 200 - b.o, h: 200 - b.l, l: 200 - b.h, c: 200 - b.c, v: b.v }));
const rm = vsaAnalyze(mir as any);
console.log('mirror (buying climax)    ', rm.reversal ? `${rm.reversal.tag} ${rm.reversal.stage}` : 'none', rm.setup ? `SETUP ${rm.setup.side}` : 'no setup');
if (!(rm.setup && rm.setup.side === 'sell' && rm.setup.sl > rm.setup.entry)) { console.log('FAIL mirror'); process.exit(1); }
console.log('mirror test passed');
