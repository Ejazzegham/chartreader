"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bnLoaded = exports.bnPairs = exports.QUOTES = exports.bnRaw = exports.isBn = exports.BN_PREFIX = exports.BN_HOSTS = void 0;
exports.bnGet = bnGet;
exports.loadBnPairs = loadBnPairs;
exports.bnTickers = bnTickers;
exports.bnCandles = bnCandles;
exports.watchBnCandles = watchBnCandles;
exports.movers = movers;
// =====================================================================================
// All crypto pairs. Binance public market data (no API key, no account).
// REST is polled (prices every 4 s, the open chart every 2 s) which is reliable on phones and cheap.
// If one Binance host is blocked on the phone's network the next one is tried automatically.
// =====================================================================================
exports.BN_HOSTS = ['https://data-api.binance.vision', 'https://api.binance.com', 'https://api1.binance.com', 'https://api2.binance.com', 'https://api3.binance.com'];
exports.BN_PREFIX = 'bn';
const isBn = (id) => id.startsWith(exports.BN_PREFIX) && /^bn[A-Z0-9]{5,20}$/.test(id);
exports.isBn = isBn;
const bnRaw = (id) => id.slice(exports.BN_PREFIX.length);
exports.bnRaw = bnRaw;
// Quote assets worth listing (Binance has many more, but these hold nearly every liquid pair).
exports.QUOTES = ['USDT', 'USDC', 'FDUSD', 'BTC', 'ETH', 'BNB', 'EUR', 'TRY'];
const LEVERAGED = /(UP|DOWN|BULL|BEAR)(USDT|USDC|BTC|ETH|BNB)$/;
let host = 0;
const to = (ms) => { const c = new AbortController(); const t = setTimeout(() => c.abort(), ms); return { signal: c.signal, done: () => clearTimeout(t) }; };
// GET with host rotation: a blocked / slow host moves on to the next one.
async function bnGet(path, ms = 12000) {
    let lastErr = null;
    for (let k = 0; k < exports.BN_HOSTS.length; k++) {
        const h = (host + k) % exports.BN_HOSTS.length, t = to(ms);
        try {
            const r = await fetch(exports.BN_HOSTS[h] + path, { signal: t.signal });
            if (r.status === 451 || r.status === 403)
                throw new Error(`Binance is not available from this network (HTTP ${r.status}).`);
            if (!r.ok)
                throw new Error(`Binance returned ${r.status}`);
            const j = await r.json();
            host = h;
            return j;
        }
        catch (e) {
            lastErr = e;
        }
        finally {
            t.done();
        }
    }
    throw new Error(lastErr?.name === 'AbortError' ? 'Binance did not answer in time.' : (lastErr?.message ?? 'Cannot reach Binance.'));
}
// ---------- the full pair list ----------
let pairs = [], loading = null, loadedAt = 0;
const bnPairs = () => pairs;
exports.bnPairs = bnPairs;
const bnLoaded = () => pairs.length > 0;
exports.bnLoaded = bnLoaded;
const mk = (x) => {
    const raw = String(x.symbol ?? '');
    const quote = exports.QUOTES.find((q) => raw.endsWith(q) && raw.length > q.length);
    if (!quote || LEVERAGED.test(raw))
        return null;
    const base = raw.slice(0, raw.length - quote.length);
    const last = Number(x.lastPrice), open = Number(x.openPrice), vol = Number(x.quoteVolume);
    if (!isFinite(last) || last <= 0)
        return null;
    return { id: exports.BN_PREFIX + raw, raw, base, quote, name: `${base}/${quote}`, vol: isFinite(vol) ? vol : 0, last, open: isFinite(open) && open > 0 ? open : last };
};
// All pairs with their 24h change, sorted by traded value (liquid pairs first). Cached for 10 minutes.
function loadBnPairs(force = false) {
    if (!force && pairs.length && Date.now() - loadedAt < 10 * 60000)
        return Promise.resolve(pairs);
    if (loading)
        return loading;
    loading = (async () => {
        try {
            const j = await bnGet('/api/v3/ticker/24hr?type=MINI', 25000);
            const list = (Array.isArray(j) ? j : []).map(mk).filter((p) => !!p && p.vol > 0).sort((a, b) => b.vol - a.vol);
            if (list.length) {
                pairs = list;
                loadedAt = Date.now();
            }
            return pairs;
        }
        finally {
            loading = null;
        }
    })();
    return loading;
}
async function bnTickers(raws) {
    const out = {};
    const put = (x) => { const p = Number(x.lastPrice), o = Number(x.openPrice); if (isFinite(p) && p > 0)
        out[String(x.symbol)] = { price: p, open: isFinite(o) && o > 0 ? o : p }; };
    if (!raws.length)
        return out;
    if (raws.length > 40) { // many rows on screen: one call for everything is cheaper than many small ones
        const j = await bnGet('/api/v3/ticker/24hr?type=MINI', 25000);
        const want = new Set(raws);
        (Array.isArray(j) ? j : []).forEach((x) => { if (want.has(String(x.symbol)))
            put(x); });
        return out;
    }
    const j = await bnGet(`/api/v3/ticker/24hr?type=MINI&symbols=${encodeURIComponent(JSON.stringify(raws))}`);
    (Array.isArray(j) ? j : [j]).forEach(put);
    return out;
}
// ---------- candles ----------
const INTERVAL = { 60: '1m', 180: '3m', 300: '5m', 900: '15m', 1800: '30m', 3600: '1h', 7200: '2h', 14400: '4h', 86400: '1d' };
const toCandle = (k) => ({ t: Math.floor(Number(k[0]) / 1000), o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] });
async function bnCandles(raw, gran, limit = 300) {
    const iv = INTERVAL[gran];
    if (!iv)
        throw new Error('Timeframe not supported for crypto pairs.');
    const j = await bnGet(`/api/v3/klines?symbol=${raw}&interval=${iv}&limit=${Math.min(1000, limit)}`);
    if (!Array.isArray(j))
        throw new Error('Binance returned no candles for this pair.');
    return j.map(toCandle);
}
// Live candles: history once, then the last two candles every 2 s. Returns an unsubscribe function.
function watchBnCandles(raw, gran, cb, onErr, count = 300) {
    let dead = false, arr = [], timer = null, fails = 0;
    const iv = INTERVAL[gran];
    if (!iv) {
        onErr('Timeframe not supported for crypto pairs.');
        return () => { };
    }
    const tick = async () => {
        if (dead)
            return;
        try {
            if (!arr.length) {
                arr = await bnCandles(raw, gran, count);
            }
            else {
                const j = await bnGet(`/api/v3/klines?symbol=${raw}&interval=${iv}&limit=2`, 8000);
                (Array.isArray(j) ? j : []).map(toCandle).forEach((c) => {
                    const last = arr[arr.length - 1];
                    if (last && last.t === c.t)
                        arr = [...arr.slice(0, -1), c];
                    else if (!last || c.t > last.t)
                        arr = [...arr.slice(-(count - 1)), c];
                });
            }
            fails = 0;
            if (!dead && arr.length)
                cb(arr);
        }
        catch (e) {
            fails++;
            if (!dead && (!arr.length || fails >= 4))
                onErr(e?.message ?? 'Could not load candles.');
        }
        if (!dead)
            timer = setTimeout(tick, arr.length ? 2000 : 3000);
    };
    tick();
    return () => { dead = true; clearTimeout(timer); };
}
// Biggest movers among liquid pairs (used by the crypto news tab).
function movers(n = 5) {
    const liquid = pairs.filter((p) => p.quote === 'USDT' && p.vol > 5000000);
    const chg = (p) => ((p.last - p.open) / p.open) * 100;
    const s = [...liquid].sort((a, b) => chg(b) - chg(a));
    return { up: s.slice(0, n).map((p) => ({ p, chg: chg(p) })), down: s.slice(-n).reverse().map((p) => ({ p, chg: chg(p) })) };
}
