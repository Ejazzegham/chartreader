// Spike pairs: Boom = BUY only, Crash = SELL only, and the trend rules that would block them are skipped.
// Run: npx tsx --tsconfig tests/tsconfig.json tests/spike.test.ts   (synthetic candles: this proves the rule, it is NOT a measure of profit)
import { qualify, judge, spikeSide } from '../src/verdict';
import { analyzeAll } from '../src/refine';

let fails = 0;
const ok = (name: string, cond: boolean) => { console.log((cond ? 'PASS ' : 'FAIL ') + name); if (!cond) fails++; };

ok('Boom pairs are BUY only', ['BOOM1000', 'BOOM500', 'BOOM300N', 'BOOM600', 'BOOM900'].every((id) => spikeSide(id) === 'buy'));
ok('Crash pairs are SELL only', ['CRASH1000', 'CRASH500', 'CRASH300N', 'CRASH600', 'CRASH900'].every((id) => spikeSide(id) === 'sell'));
ok('other pairs have no spike rule', [undefined, 'R_100', '1HZ100V', 'stpRNG', 'JD10', 'frxEURUSD', 'cryBTCUSD', 'BOOMER'].every((id) => spikeSide(id as any) === null));

// Boom-like candles: drift down, rare sharp jump up. Crash-like = the mirror image.
let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const T = new Date('2026-10-07T13:00:00Z'), nowS = T.getTime() / 1000, gran = 900;
const series = (up: boolean) => { let p = 1000; const c: any[] = [];
  for (let i = 0; i < 240; i++) { const o = p, jump = rnd() < 0.1; p += (up ? -1 : 1) * (0.6 + rnd() * 0.6) + (jump ? (up ? 1 : -1) * (6 + rnd() * 6) : 0);
    c.push({ t: nowS - 60 - (239 - i) * gran, o, c: p, h: Math.max(o, p) + rnd() * 0.4, l: Math.min(o, p) - rnd() * 0.4, v: 800 + rnd() * 1500 }); }
  return c; };

let boomBuy = 0, boomSell = 0, crashBuy = 0, crashSell = 0, genericTrades = 0, spikeTrades = 0, wrongSide = 0, wrongReasonMissing = 0, combos = 0;
for (let k = 0; k < 800; k++) {
  for (const boom of [true, false]) {
    const c = series(boom), a = analyzeAll(c, T); if (!a.combo) continue; combos++;
    const id = boom ? 'BOOM1000' : 'CRASH500', want = boom ? 'buy' : 'sell';
    const q = qualify(a, { id, cat: 'deriv', now: T, c }), g = qualify(a, { id: 'R_100', cat: 'deriv', now: T, c });
    if (g.trade) genericTrades++;
    if (q.trade) { spikeTrades++; if (a.combo.side !== want) wrongSide++; if (boom) boomBuy++; else crashSell++; }
    // the other side must always say why
    if (a.combo.side !== want) { if (q.trade || q.level || !q.reasons.some((r) => /never alerted/.test(r))) wrongReasonMissing++; if (judge(a, { id, cat: 'deriv', now: T, c }).level) wrongSide++; }
  }
}
console.log(`synthetic spike markets: ${combos} setups. Alerts with the old generic gate: ${genericTrades}. With the spike rule: ${spikeTrades} (Boom BUY ${boomBuy}, Crash SELL ${crashSell}).`);
ok('no alert is ever against the spike', wrongSide === 0 && boomSell === 0 && crashBuy === 0);
ok('a setup against the spike always says why and never alerts', wrongReasonMissing === 0);
ok('the spike rule is not a pass-through (most setups are still blocked)', spikeTrades < combos / 2);
console.log(fails ? fails + ' FAILED' : 'spike test passed'); process.exit(fails ? 1 : 0);
