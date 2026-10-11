import { momentum } from '../src/momentum';

let fails = 0;
const ok = (c: unknown, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };

// synthetic candles: a steady trend with a little noise
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const make = (n: number, drift: number, vol = true) => {
  let p = 100; const t0 = 1_760_000_000;
  return Array.from({ length: n }, (_, i) => {
    const o = p; p += drift + (rnd() - 0.5) * 0.4;
    const up = p >= o;
    return { t: t0 + i * 900, o, c: p, h: Math.max(o, p) + rnd() * 0.15, l: Math.min(o, p) - rnd() * 0.15, ...(vol ? { v: 100 + rnd() * 20 + (i > n - 4 ? (up ? 150 : 150) : 0) } : {}) };
  });
};

const up = momentum(make(200, 0.25));
ok(up.ok && up.bias === 'bullish', 'steady uptrend reads bullish');
ok(up.score >= 50 && up.score <= 100, 'score is a percentage of agreeing checks');
ok(up.checks.length >= 5, 'at least five checks vote');
const dn = momentum(make(200, -0.25));
ok(dn.ok && dn.bias === 'bearish', 'steady downtrend reads bearish');
ok(!momentum(make(30, 0.2)).ok, 'too few candles gives no reading');
const nv = momentum(make(200, 0.25, false));
ok(nv.ok && nv.volRatio === null, 'no volume feed: the volume check is skipped, not invented');
ok(nv.checks.length === up.checks.length - 1, 'one check fewer without volume');
const flat = momentum(make(200, 0));
ok(flat.ok && flat.score <= 100 && ['neutral', 'bullish', 'bearish'].includes(flat.bias), 'sideways market gives a valid reading');
ok(up.checks.every((x) => typeof x.text === 'string' && x.text.length > 3), 'every check has readable text');

console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
