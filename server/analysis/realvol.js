"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealVolume = exports.REAL_VOL = void 0;
exports.realVolumeSource = realVolumeSource;
exports.volumeMap = volumeMap;
exports.mergeVolume = mergeVolume;
exports.cachedVolumeMap = cachedVolumeMap;
exports.addRealVolume = addRealVolume;
const crypto_1 = require("./crypto");
const fallback_1 = require("./fallback");
exports.REAL_VOL = {
    cryBTCUSD: { kind: 'binance', sym: 'BTCUSDT', label: 'Binance spot BTC/USDT' },
    cryETHUSD: { kind: 'binance', sym: 'ETHUSDT', label: 'Binance spot ETH/USDT' },
    cryLTCUSD: { kind: 'binance', sym: 'LTCUSDT', label: 'Binance spot LTC/USDT' },
    cryBNBUSD: { kind: 'binance', sym: 'BNBUSDT', label: 'Binance spot BNB/USDT' },
    cryXRPUSD: { kind: 'binance', sym: 'XRPUSDT', label: 'Binance spot XRP/USDT' },
    frxEURUSD: { kind: 'cme', sym: '6E=F', label: 'CME Euro FX futures (6E)' },
    frxGBPUSD: { kind: 'cme', sym: '6B=F', label: 'CME British Pound futures (6B)' },
    frxUSDJPY: { kind: 'cme', sym: '6J=F', label: 'CME Japanese Yen futures (6J)' },
    frxAUDUSD: { kind: 'cme', sym: '6A=F', label: 'CME Australian Dollar futures (6A)' },
    frxUSDCAD: { kind: 'cme', sym: '6C=F', label: 'CME Canadian Dollar futures (6C)' },
    frxUSDCHF: { kind: 'cme', sym: '6S=F', label: 'CME Swiss Franc futures (6S)' },
    frxNZDUSD: { kind: 'cme', sym: '6N=F', label: 'CME New Zealand Dollar futures (6N)' },
    frxEURJPY: { kind: 'cme', sym: '6E=F', label: 'CME Euro FX futures (6E), the EUR side', proxy: true },
    frxGBPJPY: { kind: 'cme', sym: '6B=F', label: 'CME British Pound futures (6B), the GBP side', proxy: true },
    frxXAUUSD: { kind: 'cme', sym: 'GC=F', label: 'COMEX Gold futures (GC)' },
    frxXAGUSD: { kind: 'cme', sym: 'SI=F', label: 'COMEX Silver futures (SI)' },
    frxDXY: { kind: 'cme', sym: 'DX=F', label: 'ICE US Dollar Index futures (DX)' },
};
// Where the volume of this market comes from (also for Binance pairs, which carry their own volume), or undefined (synthetic indices).
function realVolumeSource(id) {
    if (exports.REAL_VOL[id])
        return exports.REAL_VOL[id];
    if ((0, crypto_1.isBn)(id))
        return { kind: 'binance', sym: (0, crypto_1.bnRaw)(id), label: `Binance spot ${(0, crypto_1.bnRaw)(id)}` };
    return undefined;
}
// Yahoo ranges (the longest each bar size allows) so the volume covers every candle the analysis looks at.
const YR = { 60: ['1m', '5d'], 180: ['1m', '5d'], 300: ['5m', '1mo'], 900: ['15m', '1mo'], 1800: ['30m', '1mo'], 3600: ['60m', '3mo'], 7200: ['60m', '3mo'], 14400: ['60m', '3mo'], 86400: ['1d', '2y'] };
// At most 4 volume downloads at the same time (the scanner asks for many markets at once; this keeps Yahoo happy).
let running = 0;
const waiting = [];
async function slot(fn) {
    if (running >= 4)
        await new Promise((r) => waiting.push(r));
    running++;
    try {
        return await fn();
    }
    finally {
        running--;
        waiting.shift()?.();
    }
}
// time bucket -> volume, or null when this market has no volume source / the download failed
async function volumeMap(id, gran) {
    const s = exports.REAL_VOL[id];
    if (!s)
        return null;
    let bars;
    if (s.kind === 'binance')
        bars = await slot(() => (0, crypto_1.bnCandles)(s.sym, gran, 1000));
    else {
        const r = YR[gran];
        if (!r)
            return null;
        bars = (0, fallback_1.parseCandles)(await slot(() => (0, fallback_1.yahooGet)(s.sym, r[0], r[1])), gran, 100000);
    }
    const m = new Map();
    bars.forEach((b) => { if ((b.v ?? 0) > 0) {
        const k = Math.floor(b.t / gran) * gran;
        m.set(k, (m.get(k) ?? 0) + b.v);
    } });
    return m.size ? m : null;
}
// Puts the volume into the candles (same time bucket). Candles that already carry volume are left alone.
// If almost nothing lines up (a closed market, a wrong feed) the candles are returned unchanged: no fake volume.
function mergeVolume(c, vm) {
    if (!vm || !c.length)
        return c;
    let hit = 0;
    const out = c.map((x) => { if ((x.v ?? 0) > 0)
        return x; const v = vm.get(x.t); if (v) {
        hit++;
        return { ...x, v };
    } return x; });
    return hit >= Math.min(5, Math.ceil(c.length * 0.2)) ? out : c;
}
// One-shot (server alerts): download (cached for a minute) and merge.
const cache = new Map();
function cachedVolumeMap(id, gran, ttl = 60000) {
    const k = id + ':' + gran, hit = cache.get(k);
    if (hit && Date.now() - hit.at < ttl)
        return hit.p;
    const p = volumeMap(id, gran).catch(() => null);
    cache.set(k, { at: Date.now(), p });
    if (cache.size > 200)
        cache.delete(cache.keys().next().value);
    return p;
}
async function addRealVolume(id, gran, c) {
    if (!exports.REAL_VOL[id] || !c.length)
        return c;
    return mergeVolume(c, await cachedVolumeMap(id, gran));
}
// Live: sits between the candle feed and the screen. It holds the first update back until the volume has arrived (or failed, or 5 s passed)
// so a screen never shows a first frame without volume, then re-merges on every candle update and refreshes the volume in the background.
class RealVolume {
    constructor(id, gran, emit) {
        this.id = id;
        this.gran = gran;
        this.emit = emit;
        this.vm = null;
        this.raw = [];
        this.timer = null;
        this.dead = false;
        this.settled = false;
    }
    feed(c) { this.raw = c; if (this.settled)
        this.emit(mergeVolume(c, this.vm)); }
    settle() { if (this.settled || this.dead)
        return; this.settled = true; if (this.raw.length)
        this.emit(mergeVolume(this.raw, this.vm)); }
    start() {
        const fast = exports.REAL_VOL[this.id]?.kind === 'binance';
        const guard = setTimeout(() => this.settle(), 5000);
        const run = async () => {
            if (this.dead)
                return;
            try {
                const vm = await cachedVolumeMap(this.id, this.gran, fast ? 8000 : 25000);
                if (this.dead)
                    return;
                if (vm) {
                    this.vm = vm;
                    if (this.settled && this.raw.length)
                        this.emit(mergeVolume(this.raw, vm));
                }
            }
            catch { }
            clearTimeout(guard);
            this.settle();
            if (!this.dead)
                this.timer = setTimeout(run, fast ? 10000 : 30000);
        };
        run();
    }
    stop() { this.dead = true; clearTimeout(this.timer); }
}
exports.RealVolume = RealVolume;
