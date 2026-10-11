// Usage (needs internet and Node 22+):   node backtest.js frxEURUSD,frxXAUUSD,R_75 900 [step] [minScore]
//   symbols: Deriv ids (frx..., cry..., R_75, ...) or Binance ids (bn...)   timeframe in seconds: 300, 900, 3600 ...
// Pulls about 5000 candles per symbol (and the higher timeframe), replays them candle by candle and prints win rate / average R
// per score bucket, per entry status and with / against the higher timeframe. Use it to pick the minimum score you trust.
const { simulate, report, stats, HTF } = require('./backtest-core');
const { realFeed } = require('./alerts');
const [, , symArg, tfArg = '900', stepArg = '3', minArg = '0'] = process.argv;
if (!symArg) { console.log('node backtest.js frxEURUSD,frxXAUUSD 900 [step=3] [minScore=0]'); process.exit(1); }
(async () => {
  const feed = realFeed(), gran = Number(tfArg), all = [];
  for (const id of symArg.split(',')) {
    try {
      const c = await feed.candles(id, gran, 5000); const h = HTF[gran] ? await feed.candles(id, HTF[gran], 3000) : undefined;
      if (!c || c.length < 400) { console.log(id + ': not enough candles'); continue; }
      const sess = /^frx|^OTC/.test(id), t = simulate(c, h, gran, { step: Number(stepArg), sess, minScore: Number(minArg) });
      console.log(`\n=== ${id}  ${c.length} candles  ${t.length} orders`, JSON.stringify(stats(t))); all.push(...t.map((x) => ({ ...x, id })));
    } catch (e) { console.log(id + ' failed: ' + e.message); }
  }
  console.log('\n######## ALL SYMBOLS'); const r = report(all);
  for (const [k, v] of Object.entries(r)) { console.log('\n' + k); if (k === 'all') console.log(' ', JSON.stringify(v)); else for (const [g, s] of Object.entries(v)) console.log('  ' + g.padEnd(12), JSON.stringify(s)); }
  console.log('\nRead it like this: pick the lowest score bucket where avgR is clearly above 0 over many trades (100+). Few trades = not reliable.');
  process.exit(0);
})();
