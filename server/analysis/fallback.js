"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.yahooOnly = exports.yahooId = void 0;
exports.parseCandles = parseCandles;
exports.yahooCandles = yahooCandles;
exports.yahooQuote = yahooQuote;
// Backup source (Yahoo Finance public chart data) for forex, metals and crypto when the Deriv feed is unreachable.
// Deriv synthetic indices (Volatility, Boom/Crash, Step) exist only on Deriv, so they have no backup.
const YM = {
    frxEURUSD: 'EURUSD=X', frxGBPUSD: 'GBPUSD=X', frxUSDJPY: 'USDJPY=X', frxAUDUSD: 'AUDUSD=X', frxUSDCAD: 'USDCAD=X',
    frxUSDCHF: 'USDCHF=X', frxNZDUSD: 'NZDUSD=X', frxEURJPY: 'EURJPY=X', frxGBPJPY: 'GBPJPY=X',
    frxXAUUSD: 'GC=F', frxXAGUSD: 'SI=F', frxDXY: 'DX-Y.NYB',
    cryBTCUSD: 'BTC-USD', cryETHUSD: 'ETH-USD', cryLTCUSD: 'LTC-USD', cryBNBUSD: 'BNB-USD', cryXRPUSD: 'XRP-USD',
};
const yahooId = (id) => YM[id];
exports.yahooId = yahooId;
// Pairs that Deriv does not list at all (the US Dollar Index): their price and candles come from this source only, always.
const yahooOnly = (id) => id === 'frxDXY';
exports.yahooOnly = yahooOnly;
const RANGE = { 60: ['1m', '1d'], 180: ['1m', '1d'], 300: ['5m', '5d'], 900: ['15m', '5d'], 1800: ['30m', '1mo'], 3600: ['60m', '1mo'], 7200: ['60m', '3mo'], 14400: ['60m', '3mo'], 86400: ['1d', '1y'] };
async function get(y, interval, range) {
    // time limit: without it a silent network made the backup feed wait forever and never retry
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 10000);
    try {
        const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(y)}?interval=${interval}&range=${range}`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: ctl.signal });
        if (!r.ok)
            throw new Error(`HTTP ${r.status}`);
        return (await r.json())?.chart?.result?.[0];
    }
    finally {
        clearTimeout(to);
    }
}
function parseCandles(res, gran, count = 120) {
    const ts = res?.timestamp ?? [], q = res?.indicators?.quote?.[0];
    if (!q)
        return [];
    let out = [];
    ts.forEach((t, i) => {
        const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i];
        const vol = q.volume?.[i];
        if ([o, h, l, c].every((v) => typeof v === 'number' && isFinite(v)))
            out.push({ t, o, h, l, c, v: typeof vol === 'number' && vol > 0 ? vol : undefined });
    });
    if (gran === 14400 || gran === 7200 || gran === 180) { // Yahoo has no 4h / 2h / 3m bars: build them from the smaller bars
        const m = new Map();
        out.forEach((x) => {
            const k = Math.floor(x.t / gran) * gran, b = m.get(k);
            m.set(k, b ? { t: k, o: b.o, h: Math.max(b.h, x.h), l: Math.min(b.l, x.l), c: x.c, v: b.v !== undefined || x.v !== undefined ? (b.v ?? 0) + (x.v ?? 0) : undefined } : { ...x, t: k });
        });
        out = [...m.values()];
    }
    return out.slice(-count);
}
async function yahooCandles(id, gran, count = 120) {
    const y = YM[id], rg = RANGE[gran];
    if (!y || !rg)
        return [];
    return parseCandles(await get(y, rg[0], rg[1]), gran, count);
}
async function yahooQuote(id) {
    const y = YM[id];
    if (!y)
        return null;
    const m = (await get(y, '1d', '5d'))?.meta;
    const price = Number(m?.regularMarketPrice), prev = Number(m?.chartPreviousClose ?? m?.previousClose);
    return isFinite(price) ? { price, prev: isFinite(prev) ? prev : price } : null;
}
