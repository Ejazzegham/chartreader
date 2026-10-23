import { lotUnits, usdPerQuote, perPoint, suggestLots, parseLots, lotsError, lotSpec, lotInfo, lotMarket, fmtLots } from '../src/lots';
let fails = 0;
const ok = (c: unknown, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e;

ok(lotUnits('frxEURUSD') === 100000 && lotUnits('frxXAUUSD') === 100 && lotUnits('cryBTCUSD') === 1 && lotUnits('R_75') === 1, 'contract sizes');
// EUR/USD 0.35 lots, stop 20 pips (0.0020): 0.35 x 100000 x 0.0020 = $70
ok(near(perPoint(0.35, 'frxEURUSD', 1.08) * 0.002, 70), 'EUR/USD 0.35 lots, 20 pip stop = $70');
// USD/JPY 0.10 lots, stop 0.50 yen at 150: 0.1 x 100000 x 0.5 / 150 = $33.33
ok(near(perPoint(0.1, 'frxUSDJPY', 150) * 0.5, 33.3333333, 1e-4), 'USD/JPY converts yen to dollars');
// EUR/GBP cross uses GBP/USD
ok(near(usdPerQuote('frxEURGBP', 0.85, (id) => (id === 'frxGBPUSD' ? 1.27 : undefined)), 1.27), 'cross pair uses the quote currency rate');
ok(near(usdPerQuote('frxEURGBP', 0.85), 1), 'cross pair without a rate falls back to 1');
// Gold 0.5 lots, $10 stop: 0.5 x 100 x 10 = $500
ok(near(perPoint(0.5, 'frxXAUUSD', 2400) * 10, 500), 'gold 0.5 lots, $10 stop = $500');
ok(suggestLots(100, 0.002, 'frxEURUSD', 1.08) === 0.5, 'suggest: $100 risk over 20 pips = 0.50 lots');
ok(suggestLots(0, 0.002, 'frxEURUSD', 1.08) === 0, 'suggest: no risk amount = 0');
ok(parseLots('0,35') === 0.35 && parseLots('0.35') === 0.35 && isNaN(parseLots('abc')), 'parse lots (comma or dot)');
ok(lotsError(0) !== '' && lotsError(NaN) !== '' && lotsError(0.35) === '' && lotsError(5000) !== '', 'lots validation');
// ---- lot system per market
ok(lotMarket('frxEURUSD') === 'forex' && lotMarket('frxXAUUSD') === 'forex' && lotMarket('frxDXY') === 'forex' && lotMarket('cryBTCUSD') === 'crypto' && lotMarket('bnSOLUSDT') === 'crypto' && lotMarket('R_75') === 'deriv' && lotMarket('BOOM1000') === 'deriv', 'market of each id');
ok(lotUnits('frxDXY') === 1000 && near(perPoint(0.1, 'frxDXY', 104) * 2, 200), 'DXY: 0.10 lot, 2.00 move = $200');
const fx = lotSpec('frxEURUSD', 1.08);
ok(fx.min === 0.01 && fx.step === 0.01 && lotsError(0.35, fx) === '' && lotsError(0.005, fx) !== '' && lotsError(0.355, fx) !== '' && lotsError(101, fx) !== '', 'forex: min 0.01, step 0.01, max 100');
const v75 = lotSpec('R_75'), v50 = lotSpec('R_50'), boom = lotSpec('BOOM1000'), step = lotSpec('stpRNG');
ok(v75.min === 0.001 && v50.min === 4 && boom.min === 0.2 && step.min === 0.1 && step.step === 0.1, 'Deriv: each index has its own minimum and step');
ok(lotsError(0.01, v50) !== '' && lotsError(4, v50) === '' && lotsError(0.15, step) !== '' && lotsError(0.3, step) === '' && lotsError(21, v75) !== '', 'Deriv validation (V50 min 4, Step steps of 0.1, V75 max 20)');
const btc = lotSpec('cryBTCUSD', 100000), eth = lotSpec('cryETHUSD', 3000), xrp = lotSpec('cryXRPUSD', 0.6);
ok(btc.step === 0.001 && eth.step === 0.01 && xrp.step === 100, 'crypto: smallest lot follows the coin price (BTC 0.001, ETH 0.01, XRP 100)');
ok(lotsError(0.0005, btc) !== '' && lotsError(0.002, btc) === '', 'crypto validation');
ok(near(perPoint(0.5, 'cryBTCUSD', 100000) * 1000, 500), 'crypto: 0.5 coin, $1000 move = $500');
ok(suggestLots(100, 0.002, 'frxEURUSD', 1.08) === 0.5 && suggestLots(100, 500, 'cryBTCUSD', 100000) === 0.2, 'suggest: forex 0.50 lots, BTC 0.2 coin');
ok(suggestLots(10, 5, 'R_50', 450) === 0 && suggestLots(100, 5, 'R_50', 450) === 20 && suggestLots(12, 5, 'stpRNG', 450) === 2.4, 'suggest: 0 when even the minimum lot is too big, else rounded down to the step');
ok(/pip/.test(lotInfo('frxEURUSD', 1.08)) && /oz/.test(lotInfo('frxXAUUSD', 2400)) && /index/.test(lotInfo('frxDXY', 104)) && /1 BTC/.test(lotInfo('cryBTCUSD', 100000)) && /Deriv/.test(lotInfo('R_75', 450000)), 'plain-words contract line');
ok(fmtLots(0.001) === '0.001' && fmtLots(0.35) === '0.35' && fmtLots(4) === '4', 'lot formatting keeps small lots');
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
