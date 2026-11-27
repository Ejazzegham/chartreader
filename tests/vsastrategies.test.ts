import { defaultParams, makeDemo, parseOhlcvCsv, resample, runBacktest, summarize } from '../src/vsaStrategy';
import { defaultScalpParams, makeDemoM1, runScalp } from '../src/vsaScalpM1';

// Strategy 1 on synthetic M5 data: runs, every trade has a stop on the losing side and a target on the winning side
const m5 = makeDemo();
const t1 = runBacktest(resample(m5), m5, defaultParams());
const bad1 = t1.filter((t) => (t.side === 'BUY' ? !(t.sl < t.entry && t.target > t.entry) : !(t.sl > t.entry && t.target < t.entry)));
console.log('strategy 1 trades', t1.length, JSON.stringify(summarize(t1)));
if (bad1.length) { console.log('FAIL strategy 1: stop/target on the wrong side', bad1.length); process.exit(1); }

// Strategy 2 on synthetic M1 data, with and without the filters
const m1 = makeDemoM1();
const t2 = runScalp(m1, defaultScalpParams({ sessionOnly: false }));
const bad2 = t2.filter((t) => (t.side === 'BUY' ? !(t.sl < t.entry && t.tp > t.entry) : !(t.sl > t.entry && t.tp < t.entry)));
console.log('strategy 2 trades', t2.length, JSON.stringify(summarize(t2)));
if (bad2.length) { console.log('FAIL strategy 2: stop/target on the wrong side', bad2.length); process.exit(1); }
const one = runScalp(m1, defaultScalpParams({ sessionOnly: false, allowOverlap: false }));
for (let i = 1; i < one.length; i++) if (one[i].entryTime < one[i - 1].exitTime) { console.log('FAIL overlap'); process.exit(1); }
if (one.length > t2.length) { console.log('FAIL one-at-a-time has more trades'); process.exit(1); }

// CSV parser
const csv = 'time,open,high,low,close,volume\n2026-01-01 00:00,1,2,0.5,1.5,100\n2026-01-01 00:01,1.5,2,1,1.2,90';
const b = parseOhlcvCsv(csv);
if (b.length !== 2 || b[0].volume !== 100) { console.log('FAIL csv'); process.exit(1); }
console.log('vsa strategies test passed');
