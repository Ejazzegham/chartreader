"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetFutGap = exports.futAligned = exports.futGap = exports.isFutProxy = exports.yahooCarriesVolume = exports.yahooOnly = exports.OIL_IDS = exports.yahooId = void 0;
exports.parseCandles = parseCandles;
exports.noteSpot = noteSpot;
exports.yahooCandles = yahooCandles;
exports.yahooVolume = yahooVolume;
exports.yahooVolumeMulti = yahooVolumeMulti;
exports.yahooQuote = yahooQuote;
const net_1 = require("./net");
// Backup source (Yahoo Finance public chart data) for forex, metals and crypto when the Deriv feed is unreachable.
// Deriv synthetic indices (Volatility, Boom/Crash, Step) exist only on Deriv, so they have no backup.
const YM = {
    frxEURUSD: 'EURUSD=X', frxGBPUSD: 'GBPUSD=X', frxUSDJPY: 'USDJPY=X', frxAUDUSD: 'AUDUSD=X', frxUSDCAD: 'USDCAD=X',
    frxUSDCHF: 'USDCHF=X', frxNZDUSD: 'NZDUSD=X', frxEURJPY: 'EURJPY=X', frxGBPJPY: 'GBPJPY=X',
    frxXAUUSD: 'GC=F', frxXAGUSD: 'SI=F', frxDXY: 'DX-Y.NYB',
    frxWTI: 'CL=F', frxBRENT: 'BZ=F', // oil: NYMEX WTI and ICE Brent futures (the futures contract IS the chart, so its volume comes in the same answer)
    // crypto is NOT here on purpose: every crypto price and candle comes from Binance (see crypto.ts cryBn), never from a third price level
};
const yahooId = (id) => YM[id];
exports.yahooId = yahooId;
// Oil is not listed on Deriv under one stable name, so WTI and Brent are read from the futures contract itself.
exports.OIL_IDS = ['frxWTI', 'frxBRENT'];
// Pairs that Deriv does not list at all (the US Dollar Index, oil): their price and candles come from this source only, always.
const yahooOnly = (id) => id === 'frxDXY' || exports.OIL_IDS.includes(id);
exports.yahooOnly = yahooOnly;
// Markets whose Yahoo candles carry their OWN exchange volume (the futures contract is the chart). DXY is not one of them: its candles are the spot index.
const yahooCarriesVolume = (id) => exports.OIL_IDS.includes(id);
exports.yahooCarriesVolume = yahooCarriesVolume;
const RANGE = { 60: ['1m', '1d'], 180: ['1m', '1d'], 300: ['5m', '5d'], 900: ['15m', '5d'], 1800: ['30m', '1mo'], 3600: ['60m', '1mo'], 7200: ['60m', '3mo'], 14400: ['60m', '3mo'], 86400: ['1d', '1y'] };
// Two Yahoo hosts serve the same data: if one is blocked or slow on this network the other is tried (each with its own time limit).
const HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
async function get(y, interval, range) {
    let err;
    for (const h of HOSTS) {
        // time limit: without it a silent network made the backup feed wait forever and never retry
        const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 8000);
        try {
            const r = await (0, net_1.xfetch)(`https://${h}/v8/finance/chart/${encodeURIComponent(y)}?interval=${interval}&range=${range}`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: ctl.signal });
            if (!r.ok)
                throw new Error(`HTTP ${r.status}`);
            return (await r.json())?.chart?.result?.[0];
        }
        catch (e) {
            err = e;
        }
        finally {
            clearTimeout(to);
        }
    }
    throw err;
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
// ---- Gold and silver: the backup source has no SPOT symbol, it serves the COMEX FUTURES contract (GC=F, SI=F).
// Futures trade above spot (gold: usually $5 to $15, and the gap moves). Mixing the two inside one trade makes a setup that was built on futures
// candles "touch" its entry and targets on a spot quote that never got there (or the other way round). So whenever the main feed (Deriv, spot) is seen
// we measure the gap once in a while and take it off every backup price and candle; the backup then lines up with spot / TradingView / your broker.
// When no gap has been measured yet, the backup price is NOT trusted for logged setups or alarms (futAligned = false).
const FUT_PROXY = new Set(['frxXAUUSD', 'frxXAGUSD']);
const isFutProxy = (id) => FUT_PROXY.has(id);
exports.isFutProxy = isFutProxy;
// Forex pairs have a small gap too (Deriv's feed vs the backup, usually a pip or so). It is measured the same way and taken off, but kept only 30 minutes
// (a futures premium is stable for hours, a forex difference is noise) and a forex backup is never blocked while the gap is unknown.
const isGapped = (id) => !!YM[id] && !(0, exports.yahooOnly)(id);
const GAP_MAX_AGE_FX = 30 * 60e3;
const GAP_MAX_AGE = 6 * 3600e3, GAP_REFRESH = 10 * 60e3, SPOT_FRESH = 90e3;
const spotRef = new Map(), gapOf = new Map(), learning = new Set();
const futGap = (id, now = Date.now()) => { const g = gapOf.get(id); return g && now - g.at < (FUT_PROXY.has(id) ? GAP_MAX_AGE : GAP_MAX_AGE_FX) ? g.v : undefined; };
exports.futGap = futGap;
const futAligned = (id, now = Date.now()) => !FUT_PROXY.has(id) || (0, exports.futGap)(id, now) !== undefined;
exports.futAligned = futAligned;
const resetFutGap = () => { spotRef.clear(); gapOf.clear(); learning.clear(); };
exports.resetFutGap = resetFutGap;
// Call this with every fresh price the MAIN (spot) feed gives for the symbol. It keeps the gap up to date in the background.
function noteSpot(id, price, now = Date.now()) {
    if (!isGapped(id) || !(price > 0))
        return;
    spotRef.set(id, { p: price, at: now });
    const g = gapOf.get(id);
    if (!g || now - g.at > GAP_REFRESH)
        void learnGap(id);
}
async function learnGap(id) {
    if (learning.has(id))
        return;
    learning.add(id);
    try {
        const m = (await get(YM[id], '1d', '5d'))?.meta, fut = Number(m?.regularMarketPrice), s = spotRef.get(id);
        if (isFinite(fut) && fut > 0 && s && Date.now() - s.at < SPOT_FRESH && Math.abs(s.p - fut) < s.p * (FUT_PROXY.has(id) ? 0.03 : 0.005))
            gapOf.set(id, { v: s.p - fut, at: Date.now() }); // a gap over 3% is bad data, not a premium
    }
    catch { }
    finally {
        learning.delete(id);
    }
}
async function yahooCandles(id, gran, count = 120) {
    const y = YM[id], rg = RANGE[gran];
    if (!y || !rg)
        return [];
    const c = parseCandles(await get(y, rg[0], rg[1]), gran, count), g = isGapped(id) ? (0, exports.futGap)(id) : undefined;
    return g === undefined ? c : c.map((x) => ({ ...x, o: x.o + g, h: x.h + g, l: x.l + g, c: x.c + g }));
}
// Raw bars of any Yahoo symbol, used ONLY for their volume (CME / COMEX / ICE futures that track a spot pair). Not aggregated here:
// attachVolume() sums them into the chart's candles. Daily candles use hourly bars so the UTC day lines up.
const VRANGE = { 60: ['1m', '1d'], 180: ['1m', '1d'], 300: ['5m', '5d'], 900: ['15m', '5d'], 1800: ['30m', '1mo'], 3600: ['60m', '1mo'], 7200: ['60m', '3mo'], 14400: ['60m', '3mo'], 86400: ['60m', '1y'] };
async function yahooVolume(y, gran) {
    const rg = VRANGE[gran];
    if (!rg)
        return [];
    const res = await get(y, rg[0], rg[1]), ts = res?.timestamp ?? [], q = res?.indicators?.quote?.[0];
    if (!q)
        return [];
    const out = [];
    ts.forEach((t, i) => { const v = q.volume?.[i]; if (typeof v === 'number' && v > 0)
        out.push({ t, o: 0, h: 0, l: 0, c: 0, v }); });
    return out;
}
// Volume of one futures contract, or of a cross-pair proxy made of its two currency legs (EUR/JPY = EUR futures + JPY futures).
// With two legs a bar is kept only where BOTH legs traded, so a half-sum never sits next to a full one and fakes a volume drop.
async function yahooVolumeMulti(ys, gran) {
    if (ys.length === 1)
        return yahooVolume(ys[0], gran);
    const parts = await Promise.all(ys.map((y) => yahooVolume(y, gran).catch(() => [])));
    const sum = new Map();
    parts.forEach((p) => p.forEach((b) => { const k = sum.get(b.t) ?? { v: 0, n: 0 }; k.v += b.v ?? 0; k.n++; sum.set(b.t, k); }));
    return [...sum.entries()].filter(([, k]) => k.n === ys.length).sort((a, b) => a[0] - b[0]).map(([t, k]) => ({ t, o: 0, h: 0, l: 0, c: 0, v: k.v }));
}
async function yahooQuote(id) {
    const y = YM[id];
    if (!y)
        return null;
    const m = (await get(y, '1d', '5d'))?.meta;
    const g = isGapped(id) ? (0, exports.futGap)(id) ?? 0 : 0; // futures -> spot (gold / silver), backup -> Deriv level (forex)
    const price = Number(m?.regularMarketPrice) + g, prev = Number(m?.chartPreviousClose ?? m?.previousClose) + g;
    return isFinite(price) ? { price, prev: isFinite(prev) ? prev : price } : null;
}
