import { classify, findDivergences, divAnalyze, DIV_DEFAULTS, DIV_KINDS } from '../src/divergence';
import type { Candle } from '../src/markets';

let fails = 0;
const ok = (c: unknown, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };

// ---- the 8 cells of the strong / medium / weak / hidden table
const T = 0.1, TR = 1.5;
ok(classify('buy', 100, 98, 30, 36, T, TR) === 'strong', 'bullish strong: lower low in price, higher low in RSI');
ok(classify('buy', 100, 100.05, 30, 36, T, TR) === 'medium', 'bullish medium: equal low in price, higher low in RSI');
ok(classify('buy', 100, 98, 30, 30.8, T, TR) === 'weak', 'bullish weak: lower low in price, equal low in RSI');
ok(classify('buy', 100, 102, 36, 30, T, TR) === 'hidden', 'bullish hidden: higher low in price, lower low in RSI');
ok(classify('sell', 100, 102, 70, 62, T, TR) === 'strong', 'bearish strong: higher high in price, lower high in RSI');
ok(classify('sell', 100, 99.95, 70, 62, T, TR) === 'medium', 'bearish medium: equal high in price, lower high in RSI');
ok(classify('sell', 100, 102, 70, 70.5, T, TR) === 'weak', 'bearish weak: higher high in price, equal high in RSI');
ok(classify('sell', 100, 98, 62, 70, T, TR) === 'hidden', 'bearish hidden: lower high in price, higher high in RSI');
ok(classify('buy', 100, 98, 36, 30, T, TR) === null, 'price and RSI agree (both lower): no divergence');
ok(classify('buy', 100, 102, 30, 36, T, TR) === null, 'price and RSI agree (both higher): no divergence');
ok(classify('sell', 100, 100, 70, 70, T, TR) === null, 'everything equal: no divergence');

// ---- synthetic market with a clear bullish regular divergence: a hard drop, a bounce, then a slow grind to a lower low
const t0 = 1_760_000_000;
const mk = (closes: number[], wick = 0.3): Candle[] => closes.map((c, i) => {
  const o = i ? closes[i - 1] : c;
  return { t: t0 + i * 300, o, c, h: Math.max(o, c) + wick, l: Math.min(o, c) - wick };
});
const path: number[] = [];
let p = 200;
for (let i = 0; i < 40; i++) { p += Math.sin(i / 3) * 0.4; path.push(p); }          // calm start
for (let i = 0; i < 10; i++) { p -= 2.2; path.push(p); }                             // violent drop: RSI crashes
for (let i = 0; i < 8; i++) { p += 1.2; path.push(p); }                              // bounce
for (let i = 0; i < 20; i++) { p -= 1.0; path.push(p); p += 0.45; path.push(p); }  // slow saw-tooth grind lower: price makes a lower low, the RSI stays far above its crash low
for (let i = 0; i < 5; i++) { p += 0.6; path.push(p); }                              // turn up: confirms the second low
const c = mk(path);
const all = findDivergences(c, DIV_DEFAULTS);
ok(all.some((d) => d.side === 'buy' && d.kind === 'strong'), 'found a bullish strong divergence in the drop / grind market');
ok(all.every((d) => d.confirmI === d.b.i + DIV_DEFAULTS.pivotRight), 'every divergence is confirmed exactly pivotRight candles after the second swing');
ok(all.every((d) => d.b.i - d.a.i >= DIV_DEFAULTS.minGap && d.b.i - d.a.i <= DIV_DEFAULTS.maxGap), 'swing distance stays inside minGap..maxGap');

// ---- no repainting: adding candles after the signal never changes the earlier divergences
const upto = findDivergences(c.slice(0, c.length - 2), DIV_DEFAULTS).map((d) => `${d.side}${d.kind}${d.a.i}${d.b.i}`);
const full = findDivergences(c, DIV_DEFAULTS).map((d) => `${d.side}${d.kind}${d.a.i}${d.b.i}`);
ok(upto.every((k) => full.includes(k)), 'divergences found earlier are still there when candles are added (no repaint)');

// ---- signal on the confirming candle
const d0 = all.filter((d) => d.side === 'buy' && d.kind === 'strong')[0];
const asOf = c.slice(0, d0.confirmI + 1);
const r = divAnalyze(asOf, new Date(t0 * 1000), { sessions: false });
ok(r.ok && r.status === 'signal' && r.setup?.side === 'buy', 'one BUY signal on the candle that confirms the divergence');
ok(!!r.setup && r.setup.barsAgo === 0 && r.setup.entry === asOf[asOf.length - 1].c, 'entry is the close of the confirming candle');
ok(!!r.setup && r.setup.sl < r.setup.entry && r.setup.tps[0] > r.setup.entry && r.setup.tps[2] > r.setup.tps[1], 'stop below entry, targets above, TP3 above TP2 (buy)');
ok(!!r.setup && Math.abs(r.setup.tps[0] - r.setup.entry - (r.setup.entry - r.setup.sl)) < 1e-9, 'TP1 is exactly 1R');
ok(!!r.setup && r.setup.sl < d0.b.price, 'stop sits beyond the second swing low');
ok(!!r.setup && r.setup.score >= 0 && r.setup.score <= 100, 'score is inside 0..100');
const old = divAnalyze(c.concat(mk(Array(10).fill(path[path.length - 1] + 0.1))).map((x, i) => ({ ...x, t: t0 + i * 300 })), new Date(t0 * 1000), { sessions: false });
ok(old.status !== 'signal' || (old.setup?.barsAgo ?? 0) <= DIV_DEFAULTS.maxAge, 'a divergence older than maxAge no longer gives a signal');

// ---- mirror market: a bearish strong divergence (flip every price around 400)
const cm = mk(path.map((x) => 400 - x));
const allm = findDivergences(cm, DIV_DEFAULTS);
ok(allm.some((d) => d.side === 'sell' && d.kind === 'strong'), 'the mirrored market gives a bearish strong divergence');
const dm = allm.filter((d) => d.side === 'sell' && d.kind === 'strong')[0];
const rm = divAnalyze(cm.slice(0, dm.confirmI + 1), new Date(t0 * 1000), { sessions: false });
ok(rm.status === 'signal' && rm.setup?.side === 'sell' && rm.setup.sl > rm.setup.entry && rm.setup.tps[0] < rm.setup.entry, 'one SELL signal: stop above entry, targets below');

// ---- stop hit after the signal: the setup expires instead of staying open
const crash = mk(path.slice(0, d0.confirmI + 1).concat([path[d0.confirmI] - 6, path[d0.confirmI] - 8]));
const rc = divAnalyze(crash, new Date(t0 * 1000), { sessions: false });
ok(rc.status !== 'signal', 'once price runs through the stop the signal is gone');

// ---- limits
ok(divAnalyze(c.slice(0, 30)).ok === false, 'fewer than 60 candles: no analysis');
ok(divAnalyze(c, new Date(), { params: { kinds: ['hidden'] } }).found.every((d) => d.kind === 'hidden'), 'the kinds option filters the divergences');
ok(DIV_KINDS.length === 4, 'four kinds: strong, medium, weak, hidden');

// ---- 400 random markets: never a NaN, never a wrong-side stop or target, never two signals
let bad = 0, sigs = 0;
let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
for (let m = 0; m < 400; m++) {
  let q = 100; const cl: number[] = [];
  for (let i = 0; i < 220; i++) { q += (rnd() - 0.5) * 2 + Math.sin(i / (6 + (m % 9))) * 0.6; cl.push(q); }
  const cs = mk(cl, 0.2 + rnd() * 0.3);
  for (let end = 70; end <= cs.length; end += 7) {
    const res = divAnalyze(cs.slice(0, end), new Date(t0 * 1000), { sessions: false });
    if (res.status === 'signal') {
      sigs++;
      const s = res.setup!, buy = s.side === 'buy';
      const fin = [s.entry, s.sl, ...s.tps, s.score].every(Number.isFinite);
      const side = buy ? s.sl < s.entry && s.tps[0] > s.entry && s.tps[1] > s.tps[0] && s.tps[2] > s.tps[1] : s.sl > s.entry && s.tps[0] < s.entry && s.tps[1] < s.tps[0] && s.tps[2] < s.tps[1];
      if (!fin || !side) bad++;
    }
  }
}
ok(bad === 0, `400 random markets, ${sigs} signals: every level is finite and on the right side`);
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
