"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionAt = exports.GROUPS = exports.INDICATORS = exports.FIB_EXT = exports.FIB_RATIOS = exports.swings = exports.heikinAshi = exports.obv = exports.vwap = exports.hasVolume = exports.ichimoku = exports.psar = exports.supertrend = exports.williamsR = exports.cci = exports.adxSeries = exports.stoch = exports.atrSeries = exports.trSeries = exports.macdSeries = exports.rsiSeries = exports.bollinger = exports.emaS = exports.sma = exports.fin = void 0;
exports.fibonacci = fibonacci;
exports.supportResistance = supportResistance;
exports.rsiDivergence = rsiDivergence;
// =====================================================================================
// Indicator library. Every function returns arrays ALIGNED to the candles (NaN where there is not enough data yet),
// so the chart can slice them with the same start/end as the candles. Pure TypeScript, no React.
// =====================================================================================
const nan = (n) => new Array(n).fill(NaN);
const fin = (x) => Number.isFinite(x);
exports.fin = fin;
const sma = (v, n) => {
    const out = nan(v.length);
    let s = 0;
    for (let i = 0; i < v.length; i++) {
        s += v[i];
        if (i >= n)
            s -= v[i - n];
        if (i >= n - 1)
            out[i] = s / n;
    }
    return out;
};
exports.sma = sma;
// EMA seeded with the SMA of the first n values (the way MetaTrader and TradingView do it).
const emaS = (v, n) => {
    const out = nan(v.length), k = 2 / (n + 1);
    if (v.length < n)
        return out;
    let e = v.slice(0, n).reduce((a, b) => a + b, 0) / n;
    out[n - 1] = e;
    for (let i = n; i < v.length; i++) {
        e = v[i] * k + e * (1 - k);
        out[i] = e;
    }
    return out;
};
exports.emaS = emaS;
// EMA over a series that itself starts with NaNs (used for MACD signal, Stochastic smoothing...)
const emaNaN = (v, n) => {
    const out = nan(v.length), k = 2 / (n + 1);
    const first = v.findIndex(exports.fin);
    if (first < 0 || v.length - first < n)
        return out;
    let e = 0;
    for (let i = first; i < first + n; i++)
        e += v[i];
    e /= n;
    out[first + n - 1] = e;
    for (let i = first + n; i < v.length; i++) {
        e = v[i] * k + e * (1 - k);
        out[i] = e;
    }
    return out;
};
const smaNaN = (v, n) => {
    const out = nan(v.length);
    for (let i = 0; i < v.length; i++) {
        if (i < n - 1)
            continue;
        let s = 0, ok = true;
        for (let j = i - n + 1; j <= i; j++) {
            if (!(0, exports.fin)(v[j])) {
                ok = false;
                break;
            }
            s += v[j];
        }
        if (ok)
            out[i] = s / n;
    }
    return out;
};
const bollinger = (v, n = 20, k = 2) => {
    const mid = (0, exports.sma)(v, n), up = nan(v.length), lo = nan(v.length);
    for (let i = n - 1; i < v.length; i++) {
        let s = 0;
        for (let j = i - n + 1; j <= i; j++)
            s += (v[j] - mid[i]) ** 2;
        const sd = Math.sqrt(s / n);
        up[i] = mid[i] + k * sd;
        lo[i] = mid[i] - k * sd;
    }
    return { mid, up, lo };
};
exports.bollinger = bollinger;
// Wilder RSI as a full series.
const rsiSeries = (v, n = 14) => {
    const out = nan(v.length);
    if (v.length <= n)
        return out;
    let g = 0, l = 0;
    for (let i = 1; i <= n; i++) {
        const d = v[i] - v[i - 1];
        if (d >= 0)
            g += d;
        else
            l -= d;
    }
    g /= n;
    l /= n;
    const val = () => (g === 0 && l === 0 ? 50 : l === 0 ? 100 : 100 - 100 / (1 + g / l));
    out[n] = val();
    for (let i = n + 1; i < v.length; i++) {
        const d = v[i] - v[i - 1];
        g = (g * (n - 1) + Math.max(d, 0)) / n;
        l = (l * (n - 1) + Math.max(-d, 0)) / n;
        out[i] = val();
    }
    return out;
};
exports.rsiSeries = rsiSeries;
const macdSeries = (v, fast = 12, slow = 26, sig = 9) => {
    const ef = (0, exports.emaS)(v, fast), es = (0, exports.emaS)(v, slow);
    const line = v.map((_, i) => ((0, exports.fin)(ef[i]) && (0, exports.fin)(es[i]) ? ef[i] - es[i] : NaN));
    const signal = emaNaN(line, sig);
    return { line, signal, hist: line.map((x, i) => ((0, exports.fin)(x) && (0, exports.fin)(signal[i]) ? x - signal[i] : NaN)) };
};
exports.macdSeries = macdSeries;
const trSeries = (c) => c.map((x, i) => (i === 0 ? x.h - x.l : Math.max(x.h - x.l, Math.abs(x.h - c[i - 1].c), Math.abs(x.l - c[i - 1].c))));
exports.trSeries = trSeries;
// Wilder ATR as a full series.
const atrSeries = (c, n = 14) => {
    const out = nan(c.length), tr = (0, exports.trSeries)(c);
    if (c.length <= n)
        return out;
    let a = 0;
    for (let i = 1; i <= n; i++)
        a += tr[i];
    a /= n;
    out[n] = a;
    for (let i = n + 1; i < c.length; i++) {
        a = (a * (n - 1) + tr[i]) / n;
        out[i] = a;
    }
    return out;
};
exports.atrSeries = atrSeries;
const stoch = (c, kP = 14, dP = 3, slow = 3) => {
    const raw = nan(c.length);
    for (let i = kP - 1; i < c.length; i++) {
        let hh = -Infinity, ll = Infinity;
        for (let j = i - kP + 1; j <= i; j++) {
            hh = Math.max(hh, c[j].h);
            ll = Math.min(ll, c[j].l);
        }
        raw[i] = hh === ll ? 50 : ((c[i].c - ll) / (hh - ll)) * 100;
    }
    const k = smaNaN(raw, slow), d = smaNaN(k, dP);
    return { k, d };
};
exports.stoch = stoch;
// ADX with +DI / -DI (Wilder smoothing).
const adxSeries = (c, n = 14) => {
    const len = c.length, adx = nan(len), pdi = nan(len), mdi = nan(len);
    if (len <= n * 2)
        return { adx, pdi, mdi };
    const tr = (0, exports.trSeries)(c), pdm = nan(len), mdm = nan(len);
    for (let i = 1; i < len; i++) {
        const up = c[i].h - c[i - 1].h, dn = c[i - 1].l - c[i].l;
        pdm[i] = up > dn && up > 0 ? up : 0;
        mdm[i] = dn > up && dn > 0 ? dn : 0;
    }
    let sTr = 0, sP = 0, sM = 0;
    for (let i = 1; i <= n; i++) {
        sTr += tr[i];
        sP += pdm[i];
        sM += mdm[i];
    }
    const dx = nan(len);
    for (let i = n; i < len; i++) {
        if (i > n) {
            sTr = sTr - sTr / n + tr[i];
            sP = sP - sP / n + pdm[i];
            sM = sM - sM / n + mdm[i];
        }
        const p = sTr ? (100 * sP) / sTr : 0, m = sTr ? (100 * sM) / sTr : 0;
        pdi[i] = p;
        mdi[i] = m;
        dx[i] = p + m ? (100 * Math.abs(p - m)) / (p + m) : 0;
    }
    let a = 0;
    for (let i = n; i < n * 2; i++)
        a += dx[i];
    a /= n;
    adx[n * 2 - 1] = a;
    for (let i = n * 2; i < len; i++) {
        a = (a * (n - 1) + dx[i]) / n;
        adx[i] = a;
    }
    return { adx, pdi, mdi };
};
exports.adxSeries = adxSeries;
const cci = (c, n = 20) => {
    const tp = c.map((x) => (x.h + x.l + x.c) / 3), m = (0, exports.sma)(tp, n), out = nan(c.length);
    for (let i = n - 1; i < c.length; i++) {
        let md = 0;
        for (let j = i - n + 1; j <= i; j++)
            md += Math.abs(tp[j] - m[i]);
        md /= n;
        out[i] = md ? (tp[i] - m[i]) / (0.015 * md) : 0;
    }
    return out;
};
exports.cci = cci;
const williamsR = (c, n = 14) => {
    const out = nan(c.length);
    for (let i = n - 1; i < c.length; i++) {
        let hh = -Infinity, ll = Infinity;
        for (let j = i - n + 1; j <= i; j++) {
            hh = Math.max(hh, c[j].h);
            ll = Math.min(ll, c[j].l);
        }
        out[i] = hh === ll ? -50 : ((hh - c[i].c) / (hh - ll)) * -100;
    }
    return out;
};
exports.williamsR = williamsR;
// Supertrend: line plus direction (1 up / -1 down).
const supertrend = (c, n = 10, mult = 3) => {
    const len = c.length, line = nan(len), dir = nan(len), a = (0, exports.atrSeries)(c, n);
    let fu = NaN, fl = NaN, d = 1;
    for (let i = 0; i < len; i++) {
        if (!(0, exports.fin)(a[i]))
            continue;
        const mid = (c[i].h + c[i].l) / 2, bu = mid + mult * a[i], bl = mid - mult * a[i];
        const pc = c[i - 1]?.c ?? c[i].c;
        fu = !(0, exports.fin)(fu) || bu < fu || pc > fu ? bu : fu;
        fl = !(0, exports.fin)(fl) || bl > fl || pc < fl ? bl : fl;
        if (d === 1 && c[i].c < fl)
            d = -1;
        else if (d === -1 && c[i].c > fu)
            d = 1;
        line[i] = d === 1 ? fl : fu;
        dir[i] = d;
    }
    return { line, dir };
};
exports.supertrend = supertrend;
// Parabolic SAR.
const psar = (c, step = 0.02, max = 0.2) => {
    const len = c.length, out = nan(len), dir = nan(len);
    if (len < 3)
        return { v: out, dir };
    let up = c[1].c >= c[0].c, af = step, ep = up ? c[0].h : c[0].l, sar = up ? c[0].l : c[0].h;
    for (let i = 1; i < len; i++) {
        sar = sar + af * (ep - sar);
        if (up) {
            sar = Math.min(sar, c[i - 1].l, c[Math.max(0, i - 2)].l);
            if (c[i].l < sar) {
                up = false;
                sar = ep;
                ep = c[i].l;
                af = step;
            }
            else if (c[i].h > ep) {
                ep = c[i].h;
                af = Math.min(af + step, max);
            }
        }
        else {
            sar = Math.max(sar, c[i - 1].h, c[Math.max(0, i - 2)].h);
            if (c[i].h > sar) {
                up = true;
                sar = ep;
                ep = c[i].h;
                af = step;
            }
            else if (c[i].l < ep) {
                ep = c[i].l;
                af = Math.min(af + step, max);
            }
        }
        out[i] = sar;
        dir[i] = up ? 1 : -1;
    }
    return { v: out, dir };
};
exports.psar = psar;
// Ichimoku. spanA / spanB are already shifted forward by 26, so spanA[i] is the cloud value to DRAW at candle i.
const ichimoku = (c, t = 9, k = 26, b = 52) => {
    const len = c.length, mid = (n, i) => {
        if (i < n - 1)
            return NaN;
        let hh = -Infinity, ll = Infinity;
        for (let j = i - n + 1; j <= i; j++) {
            hh = Math.max(hh, c[j].h);
            ll = Math.min(ll, c[j].l);
        }
        return (hh + ll) / 2;
    };
    const tenkan = c.map((_, i) => mid(t, i)), kijun = c.map((_, i) => mid(k, i)), sb = c.map((_, i) => mid(b, i));
    const spanA = nan(len), spanB = nan(len);
    for (let i = k; i < len; i++) {
        const s = i - k;
        if ((0, exports.fin)(tenkan[s]) && (0, exports.fin)(kijun[s]))
            spanA[i] = (tenkan[s] + kijun[s]) / 2;
        spanB[i] = sb[s];
    }
    return { tenkan, kijun, spanA, spanB };
};
exports.ichimoku = ichimoku;
// Volume based (only when the feed carries real volume: crypto and Yahoo do, Deriv does not).
const hasVolume = (c) => c.filter((x) => (x.v ?? 0) > 0).length > c.length * 0.5;
exports.hasVolume = hasVolume;
const vwap = (c) => {
    const out = nan(c.length);
    let pv = 0, vv = 0, day = -1;
    c.forEach((x, i) => {
        const d = Math.floor(x.t / 86400);
        if (d !== day) {
            day = d;
            pv = 0;
            vv = 0;
        } // resets every UTC day
        const v = x.v ?? 0;
        pv += ((x.h + x.l + x.c) / 3) * v;
        vv += v;
        if (vv > 0)
            out[i] = pv / vv;
    });
    return out;
};
exports.vwap = vwap;
const obv = (c) => {
    const out = nan(c.length);
    let s = 0;
    c.forEach((x, i) => { if (i)
        s += x.c > c[i - 1].c ? (x.v ?? 0) : x.c < c[i - 1].c ? -(x.v ?? 0) : 0; out[i] = s; });
    return out;
};
exports.obv = obv;
const heikinAshi = (c) => {
    const out = [];
    c.forEach((x, i) => {
        const cl = (x.o + x.h + x.l + x.c) / 4, op = i === 0 ? (x.o + x.c) / 2 : (out[i - 1].o + out[i - 1].c) / 2;
        out.push({ ...x, o: op, c: cl, h: Math.max(x.h, op, cl), l: Math.min(x.l, op, cl) });
    });
    return out;
};
exports.heikinAshi = heikinAshi;
const swings = (c, k = 4) => {
    const hi = [], lo = [];
    for (let i = k; i < c.length - k; i++) {
        let h = true, l = true;
        for (let j = 1; j <= k; j++) {
            if (c[i].h <= c[i - j].h || c[i].h <= c[i + j].h)
                h = false;
            if (c[i].l >= c[i - j].l || c[i].l >= c[i + j].l)
                l = false;
        }
        if (h)
            hi.push({ i, p: c[i].h });
        if (l)
            lo.push({ i, p: c[i].l });
    }
    return { hi, lo };
};
exports.swings = swings;
exports.FIB_RATIOS = [0, 0.236, 0.382, 0.5, 0.618, 0.705, 0.786, 1];
exports.FIB_EXT = [1.272, 1.618];
// Auto Fibonacci on the last meaningful swing. `up` = the last swing leg went up (low then high), so retracements are measured down from the high.
function fibonacci(c, k = 5) {
    if (c.length < 30)
        return null;
    const { hi, lo } = (0, exports.swings)(c, k);
    if (!hi.length || !lo.length)
        return null;
    const a = (0, exports.atrSeries)(c)[c.length - 1];
    // walk back to the most recent pair of swings that make a real leg (at least 2 ATR)
    for (let h = hi.length - 1; h >= Math.max(0, hi.length - 4); h--) {
        for (let l = lo.length - 1; l >= Math.max(0, lo.length - 4); l--) {
            const H = hi[h], L = lo[l], span = H.p - L.p;
            if (span <= 0 || ((0, exports.fin)(a) && span < 2 * a))
                continue;
            const up = L.i < H.i;
            const lv = exports.FIB_RATIOS.map((r) => ({ r, price: up ? H.p - r * span : L.p + r * span }));
            const ext = exports.FIB_EXT.map((r) => ({ r, price: up ? L.p + r * span : H.p - r * span, ext: true }));
            return { hi: H.p, lo: L.p, hiI: H.i, loI: L.i, up, levels: [...lv, ...ext] };
        }
    }
    return null;
}
function supportResistance(c, max = 6) {
    const a = (0, exports.atrSeries)(c)[c.length - 1];
    if (!(0, exports.fin)(a) || c.length < 30)
        return [];
    const { hi, lo } = (0, exports.swings)(c, 3), last = c[c.length - 1].c;
    const pts = [...hi, ...lo].map((p) => p.p).sort((x, y) => x - y);
    const groups = [];
    pts.forEach((p) => {
        const g = groups[groups.length - 1];
        if (g && p - g.sum / g.n <= 0.3 * a) {
            g.sum += p;
            g.n++;
        }
        else
            groups.push({ sum: p, n: 1 });
    });
    return groups.filter((g) => g.n >= 2).map((g) => ({ price: g.sum / g.n, touches: g.n, kind: (g.sum / g.n < last ? 'support' : 'resistance') }))
        .sort((x, y) => Math.abs(x.price - last) - Math.abs(y.price - last)).slice(0, max);
}
// Regular RSI divergence on the last two swings (price makes a lower low but RSI a higher low = bullish, and the mirror for bearish).
function rsiDivergence(c, rsi) {
    const r = rsi ?? (0, exports.rsiSeries)(c.map((x) => x.c));
    const { hi, lo } = (0, exports.swings)(c, 3), n = c.length;
    const recent = (p) => p.filter((q) => q.i >= n - 60 && (0, exports.fin)(r[q.i])).slice(-2);
    const l = recent(lo), h = recent(hi);
    if (l.length === 2 && l[1].p < l[0].p && r[l[1].i] > r[l[0].i] + 2 && n - 1 - l[1].i <= 15)
        return { dir: 'bullish', text: 'Bullish RSI divergence: lower low in price, higher low in RSI' };
    if (h.length === 2 && h[1].p > h[0].p && r[h[1].i] < r[h[0].i] - 2 && n - 1 - h[1].i <= 15)
        return { dir: 'bearish', text: 'Bearish RSI divergence: higher high in price, lower high in RSI' };
    return null;
}
exports.INDICATORS = [
    { id: 'ema20', label: 'EMA 20', group: 'Trend', pane: false, hint: 'Fast trend line' },
    { id: 'ema50', label: 'EMA 50', group: 'Trend', pane: false, hint: 'Medium trend line' },
    { id: 'ema200', label: 'EMA 200', group: 'Trend', pane: false, hint: 'Long-term trend line' },
    { id: 'sma20', label: 'SMA 20', group: 'Trend', pane: false, hint: 'Simple average' },
    { id: 'sma50', label: 'SMA 50', group: 'Trend', pane: false, hint: 'Simple average' },
    { id: 'ichimoku', label: 'Ichimoku', group: 'Trend', pane: false, hint: 'Cloud, Tenkan, Kijun' },
    { id: 'supertrend', label: 'Supertrend', group: 'Trend', pane: false, hint: 'ATR trend stop (10, 3)' },
    { id: 'psar', label: 'Parabolic SAR', group: 'Trend', pane: false, hint: 'Dots flip with the trend' },
    { id: 'vwap', label: 'VWAP', group: 'Trend', pane: false, hint: 'Needs volume (crypto)', needsVolume: true },
    { id: 'boll', label: 'Bollinger', group: 'Volatility', pane: false, hint: 'Bands (20, 2)' },
    { id: 'atr', label: 'ATR 14', group: 'Volatility', pane: true, hint: 'Average candle range' },
    { id: 'fib', label: 'Fibonacci', group: 'Levels', pane: false, hint: 'Auto retracement + extension' },
    { id: 'sr', label: 'Support / Resistance', group: 'Levels', pane: false, hint: 'Auto swing levels' },
    { id: 'cdl', label: 'Candle patterns', group: 'Patterns', pane: false, hint: 'Hammer, engulfing, stars, doji and more' },
    { id: 'rsi', label: 'RSI 14', group: 'Momentum', pane: true, hint: 'Overbought 70 / oversold 30' },
    { id: 'macd', label: 'MACD', group: 'Momentum', pane: true, hint: '12, 26, 9' },
    { id: 'stoch', label: 'Stochastic', group: 'Momentum', pane: true, hint: '14, 3, 3' },
    { id: 'adx', label: 'ADX 14', group: 'Momentum', pane: true, hint: 'Trend strength' },
    { id: 'cci', label: 'CCI 20', group: 'Momentum', pane: true, hint: '+100 / -100' },
    { id: 'wpr', label: 'Williams %R', group: 'Momentum', pane: true, hint: '-20 / -80' },
    { id: 'vol', label: 'Volume', group: 'Volume', pane: true, hint: 'Needs volume (crypto)', needsVolume: true },
    { id: 'obv', label: 'OBV', group: 'Volume', pane: true, hint: 'Needs volume (crypto)', needsVolume: true },
];
exports.GROUPS = ['Trend', 'Volatility', 'Levels', 'Patterns', 'Momentum', 'Volume'];
// UTC hours, approximate, no daylight-saving adjustment.
const sessionAt = (d) => {
    const h = d.getUTCHours();
    if (h >= 12 && h < 16)
        return { name: 'London + New York overlap', good: true };
    if (h >= 7 && h < 12)
        return { name: 'London session', good: true };
    if (h >= 16 && h < 21)
        return { name: 'New York session', good: true };
    return { name: h < 7 ? 'Asian session (slow)' : 'Late New York (thin)', good: false };
};
exports.sessionAt = sessionAt;
