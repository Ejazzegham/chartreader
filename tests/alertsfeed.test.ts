// @ts-nocheck  (fake Deriv socket + fake internet; runs the real server/alerts.js feed)
// The server's background alerts must read the SAME real volume as the app (Binance / futures), or their scores would differ.
let fails = 0;
const ok = (c: unknown, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const G = 900, base = Math.floor(1_700_000_000 / G) * G;

// fake Deriv: price candles only, no volume (like the real thing)
class FakeWS { onopen: any; onmessage: any; onclose: any; onerror: any;
  constructor(_u: string) { setTimeout(() => this.onopen?.(), 0); }
  send(m: string) { const q = JSON.parse(m); setTimeout(() => this.onmessage?.({ data: JSON.stringify({ req_id: q.req_id, candles: Array.from({ length: Math.min(q.count, 40) }, (_, i) => ({ epoch: base + i * G, open: 1, high: 1.1, low: 0.9, close: 1 })) }) }), 0); }
  close() {} }
(globalThis as any).WebSocket = FakeWS;
const yahoo = (ts: number[], vol: number[]) => ({ chart: { result: [{ timestamp: ts, indicators: { quote: [{ open: ts.map(() => 1), high: ts.map(() => 1.1), low: ts.map(() => 0.9), close: ts.map(() => 1), volume: vol }] } }] } });
let urls: string[] = [];
(globalThis as any).fetch = async (url: any) => {
  const u = String(url); urls.push(u); const json = (o: any) => ({ ok: true, status: 200, json: async () => o });
  if (u.includes('6E%3DF')) { const ts = Array.from({ length: 40 }, (_, i) => base + i * G); return json(yahoo(ts, ts.map((_, i) => 2000 + i))); }
  if (u.includes('/klines?symbol=BTCUSDT')) return json(Array.from({ length: 40 }, (_, i) => [(base + i * G) * 1000, '1', '2', '0.5', '1.5', String(77)]));
  return { ok: false, status: 404, json: async () => ({}) };
};

(async () => {
  const { realFeed } = require('../server/alerts.js');
  const feed = realFeed();
  const eur = await feed.candles('frxEURUSD', G, 150);
  ok(eur.length === 40 && eur.every((x: any) => x.v > 0) && eur[10].v === 2010, 'alerts feed: forex candles from Deriv get the real (futures) volume');
  ok(urls.some((u) => u.includes('6E%3DF')), 'alerts feed: it downloaded the Euro FX futures volume');
  const n = urls.length; await feed.candles('frxEURUSD', G, 150); ok(urls.length === n, 'alerts feed: the volume download is cached, so a scan of many markets does not hammer Yahoo');
  const big = await feed.candles('frxEURUSD', G, 5000);
  ok(big.every((x: any) => x.v === undefined), 'alerts feed: the long backtest downloads (5000 candles) are left exactly as before');
  const syn = await feed.candles('R_100', G, 150);
  ok(syn.length === 40 && syn.every((x: any) => x.v === undefined), 'alerts feed: synthetic indices stay price-only (no market volume exists)');
  const btc = await feed.candles('bnBTCUSDT', G, 150);
  ok(btc.length === 40 && btc.every((x: any) => x.v === 77), 'alerts feed: Binance pairs keep their own volume');
  const cry = await feed.candles('cryBTCUSD', G, 150);
  ok(cry.length === 40 && cry.every((x: any) => x.v === 77), 'alerts feed: Deriv crypto gets Binance volume');
  console.log(fails ? `${fails} FAILED` : 'all alerts-feed tests pass'); process.exit(fails ? 1 : 0);
})();
