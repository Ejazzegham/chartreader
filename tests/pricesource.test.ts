// Price sources: crypto = Binance, oil / DXY have TradingView symbols, bid/ask spread, forex backup gap.
import { cryBn, bnId, bnTickers } from '../src/crypto';
import { tvSymbol } from '../src/tv';
import { symOf, quotes, spreadOf } from '../src/markets';
import { yahooId, noteSpot, futGap, futAligned, yahooQuote, resetFutGap, isFutProxy } from '../src/fallback';

let fails = 0;
const ok = (c: boolean, m: string) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // ---------- crypto: every id is priced by Binance ----------
  ok(cryBn('cryBTCUSD') === 'bnBTCUSDT' && cryBn('cryXRPUSD') === 'bnXRPUSDT' && cryBn('cryBNBUSD') === 'bnBNBUSDT', 'cryBTCUSD / XRP / BNB map to the Binance USDT pair');
  ok(bnId('bnETHUSDT') === 'bnETHUSDT' && bnId('cryETHUSD') === 'bnETHUSDT' && bnId('frxEURUSD') === undefined && bnId('R_100') === undefined, 'Binance ids stay, forex and Deriv indices are not crypto');
  ok(yahooId('cryBTCUSD') === undefined && yahooId('cryETHUSD') === undefined, 'crypto has no Yahoo backup price any more');

  // ---------- TradingView symbols ----------
  ok(tvSymbol(symOf('frxWTI')) === 'TVC:USOIL' && tvSymbol(symOf('frxBRENT')) === 'TVC:UKOIL' && tvSymbol(symOf('frxDXY')) === 'TVC:DXY', 'oil and DXY now have a TradingView symbol');
  ok(tvSymbol(symOf('frxEURUSD')) === 'FX:EURUSD' && tvSymbol(symOf('frxXAUUSD')) === 'OANDA:XAUUSD' && tvSymbol(symOf('cryBTCUSD')) === 'BINANCE:BTCUSDT' && tvSymbol(symOf('bnSOLUSDT')) === 'BINANCE:SOLUSDT', 'forex, gold and crypto symbols unchanged');

  // ---------- Binance bid / ask ----------
  const realFetch = globalThis.fetch;
  (globalThis as any).fetch = async (url: string) => {
    const j = String(url).includes('bookTicker')
      ? [{ symbol: 'BTCUSDT', bidPrice: '100000.10', askPrice: '100000.11' }]
      : [{ symbol: 'BTCUSDT', lastPrice: '100000.10', openPrice: '99000' }];
    return { ok: true, status: 200, json: async () => j };
  };
  const r = await bnTickers(['BTCUSDT']);
  ok(r.BTCUSDT.price === 100000.1 && r.BTCUSDT.bid === 100000.1 && r.BTCUSDT.ask === 100000.11, 'Binance price carries the real bid and ask');
  (globalThis as any).fetch = async (url: string) => {
    if (String(url).includes('bookTicker')) return { ok: false, status: 500, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => [{ symbol: 'BTCUSDT', lastPrice: '100000.10', openPrice: '99000' }] };
  };
  const r2 = await bnTickers(['BTCUSDT']);
  ok(r2.BTCUSDT.price === 100000.1 && r2.BTCUSDT.bid === undefined, 'if the spread request fails the price still arrives');

  // ---------- spreadOf ----------
  quotes.frxEURUSD = { price: 1.1, open: 1.1, dec: 5, pts: [], dir: 0, bid: 1.09998, ask: 1.10002 };
  const sp = spreadOf('frxEURUSD');
  ok(!!sp && Math.abs(sp.abs - 0.00004) < 1e-9, 'spread = ask - bid');
  quotes.R_100 = { price: 900, open: 900, dec: 2, pts: [], dir: 0 };
  quotes.R_75 = { price: 900, open: 900, dec: 2, pts: [], dir: 0, bid: 900, ask: 900 };
  ok(spreadOf('R_100') === null && spreadOf('R_75') === null && spreadOf('nope') === null, 'no spread shown when the source gave no bid/ask, or bid = ask');

  // ---------- forex backup is matched to the Deriv level too (no jump when the source switches) ----------
  let yp = 1.10012;
  (globalThis as any).fetch = async () => ({ ok: true, json: async () => ({ chart: { result: [{ meta: { regularMarketPrice: yp, chartPreviousClose: yp - 0.002 }, timestamp: [], indicators: { quote: [{}] } }] } }) });
  resetFutGap();
  ok(!isFutProxy('frxEURUSD') && futAligned('frxEURUSD'), 'forex is never blocked while its gap is unknown');
  let q0 = await yahooQuote('frxEURUSD'); ok(q0?.price === yp, 'no gap known: backup price unchanged');
  noteSpot('frxEURUSD', 1.10000); await wait(60);
  ok(Math.abs((futGap('frxEURUSD') ?? 9) - (1.1 - yp)) < 1e-12, 'forex gap measured from the Deriv price');
  q0 = await yahooQuote('frxEURUSD'); ok(Math.abs((q0?.price ?? 0) - 1.1) < 1e-9, 'backup quote now reads the Deriv level');
  ok(await (async () => { const g = futGap('frxEURUSD', Date.now() + 31 * 60e3); return g === undefined; })(), 'a forex gap older than 30 minutes is dropped');
  resetFutGap(); yp = 1.2; noteSpot('frxEURUSD', 1.1); await wait(60);
  ok(futGap('frxEURUSD') === undefined, 'a forex gap over 0.5% is bad data, not used');
  const dxy = await yahooQuote('frxDXY'); noteSpot('frxDXY', 100); await wait(60);
  ok(futGap('frxDXY') === undefined && (await yahooQuote('frxDXY'))?.price === dxy?.price, 'DXY / oil (no Deriv price) are never shifted');
  (globalThis as any).fetch = realFetch;

  console.log(fails ? `\n${fails} FAILED` : '\nall price source tests passed');
  process.exit(fails ? 1 : 0);
})();
