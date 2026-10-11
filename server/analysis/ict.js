"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ICT_STEPS = exports.ICT_HTF = exports.nyClock = exports.isEntryWindow = exports.nextKillzone = exports.killzoneAt = exports.killzonesFor = exports.KILLZONES = exports.nyOffsetHours = exports.mergeIct = exports.ICT_DEFAULTS = void 0;
exports.ictAnalyze = ictAnalyze;
const ta_1 = require("./ta");
exports.ICT_DEFAULTS = { swingN: 3, dispMult: 1.5, dispClose: 0.7, eqTol: 0.1, sweepWindow: 3, minRR: 2, maxRiskAtr: 3.5 };
const mergeIct = (p) => {
    const o = { ...exports.ICT_DEFAULTS, ...(p ?? {}) };
    const cl = (v, a, b, d) => (isFinite(v) ? Math.min(b, Math.max(a, v)) : d);
    return { swingN: Math.round(cl(o.swingN, 2, 5, 3)), dispMult: cl(o.dispMult, 1, 3, 1.5), dispClose: cl(o.dispClose, 0.5, 0.95, 0.7), eqTol: cl(o.eqTol, 0.02, 0.5, 0.1), sweepWindow: Math.round(cl(o.sweepWindow, 1, 3, 3)), minRR: cl(o.minRR, 1, 5, 2), maxRiskAtr: cl(o.maxRiskAtr, 1, 8, 3.5) };
};
exports.mergeIct = mergeIct;
// ICT works in New York time. Killzones are stored in UTC for the winter clock (EST = UTC-5) and shifted one hour earlier
// while the US is on daylight saving time (second Sunday of March to first Sunday of November).
const nyOffsetHours = (d) => {
    const y = d.getUTCFullYear();
    const nth = (month, dow, k) => { const first = new Date(Date.UTC(y, month, 1)).getUTCDay(); return 1 + ((dow - first + 7) % 7) + 7 * (k - 1); };
    const start = Date.UTC(y, 2, nth(2, 0, 2), 7), end = Date.UTC(y, 10, nth(10, 0, 1), 6); // 2:00 EST = 07:00 UTC, 2:00 EDT = 06:00 UTC
    const t = d.getTime();
    return t >= start && t < end ? 1 : 0;
};
exports.nyOffsetHours = nyOffsetHours;
// guide section 4.1, New York time -> UTC winter (+5 h). Silver Bullet windows are one hour each.
const KZ_WINTER = [
    { key: 'asia', name: 'Asian Range', from: 1, to: 5, note: 'Quiet range, 8 PM to midnight New York. It builds the liquidity London usually raids.' },
    { key: 'london', name: 'London Killzone', from: 7, to: 10, note: 'Often forms the high or low of the day. Look for the Judas swing, then the reversal.' },
    { key: 'nyam', name: 'New York AM Killzone', from: 12, to: 15, note: 'The most popular window: 8:30 data and the 9:30 stock open. Continuation or reversal.' },
    { key: 'lclose', name: 'London Close', from: 15, to: 17, note: 'Frequent retracements or reversals of the New York move.' },
    { key: 'nypm', name: 'New York PM Killzone', from: 18.5, to: 21, note: 'Afternoon reversal or run into the close (about 1:30 to 4:00 PM New York).' },
    { key: 'sbL', name: 'Silver Bullet (London)', from: 8, to: 9, note: 'One hour, one clean trade: sweep, MSS, then the first fair value gap pullback.' },
    { key: 'silver', name: 'Silver Bullet (NY AM)', from: 15, to: 16, note: 'One hour, one clean trade: sweep, MSS, then the first fair value gap pullback.' },
    { key: 'sbP', name: 'Silver Bullet (NY PM)', from: 19, to: 20, note: 'One hour, one clean trade: sweep, MSS, then the first fair value gap pullback.' },
];
exports.KILLZONES = KZ_WINTER;
const killzonesFor = (d) => { const o = (0, exports.nyOffsetHours)(d); return o ? KZ_WINTER.map((k) => ({ ...k, from: k.from - 1, to: k.to - 1 })) : KZ_WINTER; };
exports.killzonesFor = killzonesFor;
// the narrowest window wins, so a Silver Bullet hour inside the New York AM killzone is reported as the Silver Bullet
const killzoneAt = (d) => {
    const h = d.getUTCHours() + d.getUTCMinutes() / 60;
    const hit = (0, exports.killzonesFor)(d).filter((k) => h >= k.from && h < k.to).sort((a, b) => (a.to - a.from) - (b.to - b.from));
    return hit[0] ?? null;
};
exports.killzoneAt = killzoneAt;
const nextKillzone = (d) => {
    const h = d.getUTCHours() * 60 + d.getUTCMinutes();
    const list = (0, exports.killzonesFor)(d).map((k) => ({ k, mins: Math.round(((k.from * 60 - h) + 1440) % 1440) })).sort((a, b) => a.mins - b.mins);
    return list.find((x) => x.mins > 0) ?? list[0];
};
exports.nextKillzone = nextKillzone;
// an entry window (the Asian range is where liquidity is built, not where ICT enters)
const isEntryWindow = (k) => !!k && k.key !== 'asia';
exports.isEntryWindow = isEntryWindow;
// New York clock helpers (candle times are UTC seconds)
const nyShift = (tSec) => (5 - (0, exports.nyOffsetHours)(new Date(tSec * 1000))) * 3600;
const nyDay = (tSec) => Math.floor((tSec - nyShift(tSec)) / 86400);
const nyHour = (tSec) => ((((tSec - nyShift(tSec)) % 86400) + 86400) % 86400) / 3600;
const nyDayStart = (day, tSec) => day * 86400 + nyShift(tSec);
const nyClock = (d) => { const t = d.getTime() / 1000, h = nyHour(t); return { hour: Math.floor(h), min: Math.floor((h % 1) * 60), dow: new Date((t - nyShift(t)) * 1000).getUTCDay() }; };
exports.nyClock = nyClock;
// Higher timeframe used for the bias at each chart timeframe (guide: 4H / 1H for bias, 15m for zones, 5m / 1m for entry).
exports.ICT_HTF = { 60: 3600, 180: 3600, 300: 3600, 900: 14400, 1800: 14400, 3600: 14400, 7200: 86400, 14400: 86400 };
exports.ICT_STEPS = ['HTF bias', 'Premium / discount', 'Killzone', 'Liquidity sweep', 'MSS + displacement', 'Entry zone', 'Reward : risk', 'Risk and news'];
const median = (v) => { const s = [...v].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const granOf = (c) => median(c.slice(1).map((x, i) => x.t - c[i].t).filter((d) => d > 0));
function refLevels(c, a) {
    const n = c.length, out = [];
    if (n < 5)
        return out;
    const g = granOf(c) || 900, tl = c[n - 1].t, dayL = nyDay(tl), hl = nyHour(tl);
    const days = new Map();
    c.forEach((x, i) => {
        const d = nyDay(x.t), e = days.get(d);
        if (!e)
            days.set(d, { hi: x.h, lo: x.l, hiI: i, loI: i, first: i, last: i });
        else {
            if (x.h > e.hi) {
                e.hi = x.h;
                e.hiI = i;
            }
            if (x.l < e.lo) {
                e.lo = x.l;
                e.loI = i;
            }
            e.last = i;
        }
    });
    const sweptHi = (p, from) => c.slice(from + 1).some((x) => x.h > p + 0.02 * a), sweptLo = (p, from) => c.slice(from + 1).some((x) => x.l < p - 0.02 * a);
    // previous trading day (weekends have no candles, so the last earlier day that has some)
    const before = [...days.keys()].filter((d) => d < dayL).sort((x, y) => y - x)[0];
    if (before !== undefined) {
        const e = days.get(before), firstDay = nyDay(c[0].t) === before;
        const partial = firstDay && c[0].t - nyDayStart(before, c[0].t) > 2 * g; // the data starts in the middle of that day
        if (!partial) {
            out.push({ key: 'PDH', name: 'Previous day high', price: e.hi, i: e.hiI, swept: sweptHi(e.hi, e.last) });
            out.push({ key: 'PDL', name: 'Previous day low', price: e.lo, i: e.loI, swept: sweptLo(e.lo, e.last) });
        }
    }
    const window = (d, h0, h1) => {
        const idx = [];
        c.forEach((x, i) => { if (nyDay(x.t) === d) {
            const h = nyHour(x.t);
            if (h >= h0 && h < h1)
                idx.push(i);
        } });
        return idx;
    };
    const span = (idx) => ({ hi: Math.max(...idx.map((i) => c[i].h)), lo: Math.min(...idx.map((i) => c[i].l)), hiI: idx.reduce((m, i) => (c[i].h > c[m].h ? i : m), idx[0]), loI: idx.reduce((m, i) => (c[i].l < c[m].l ? i : m), idx[0]), last: idx[idx.length - 1] });
    const fine = g <= 3600; // the session windows need hourly (or finer) candles to line up with New York hours
    if (fine && hl < 20) { // Asian range 8 PM to midnight New York, the evening before. While it is still forming it is not a level yet.
        const idx = window(dayL - 1, 20, 24);
        if (idx.length >= Math.max(2, Math.floor(3600 / g))) {
            const s = span(idx);
            out.push({ key: 'ASH', name: 'Asian high', price: s.hi, i: s.hiI, swept: sweptHi(s.hi, s.last) });
            out.push({ key: 'ASL', name: 'Asian low', price: s.lo, i: s.loI, swept: sweptLo(s.lo, s.last) });
        }
    }
    if (fine && hl >= 5) { // London session range 2 to 5 AM New York, once it is over
        const idx = window(dayL, 2, 5);
        if (idx.length >= Math.max(2, Math.floor(3600 / g))) {
            const s = span(idx);
            out.push({ key: 'LDH', name: 'London high', price: s.hi, i: s.hiI, swept: sweptHi(s.hi, s.last) });
            out.push({ key: 'LDL', name: 'London low', price: s.lo, i: s.loI, swept: sweptLo(s.lo, s.last) });
        }
    }
    const mo = window(dayL, 0, 24)[0]; // midnight open: first candle of the New York day
    if (fine && mo !== undefined && nyHour(c[mo].t) < 1)
        out.push({ key: 'MO', name: 'Midnight open', price: c[mo].o, i: mo, swept: false });
    return out;
}
function base(c, P, levelsFrom) {
    const n = c.length, price = c[n - 1]?.c ?? 0;
    if (n < 40)
        return { fail: 'Need at least 40 candles.', price, a: NaN };
    const a = (0, ta_1.atr)(c);
    if (!isFinite(a) || a <= 0)
        return { fail: 'No volatility data.', price, a: NaN };
    const N = P.swingN;
    const { hi, lo } = (0, ta_1.pivots)(c, N);
    if (hi.length < 2 || lo.length < 2)
        return { fail: 'Not enough swing points yet.', price, a };
    // ---- displacement: strong one-directional candle (big body, closes near its extreme, leaves a fair value gap)
    const bodies = c.map((x) => Math.abs(x.c - x.o));
    const disp = c.map((x, i) => {
        if (i < 6)
            return null;
        const rng = x.h - x.l;
        if (rng <= 0)
            return null;
        let s = 0, m = 0;
        for (let k = Math.max(0, i - 20); k < i; k++) {
            s += bodies[k];
            m++;
        }
        const avg = m ? s / m : 0;
        if (bodies[i] < P.dispMult * avg || bodies[i] < 0.8 * a)
            return null;
        const up = x.c > x.o, pos = up ? (x.c - x.l) / rng : (x.h - x.c) / rng;
        if (pos < P.dispClose)
            return null;
        if (i < n - 1 && !(up ? c[i + 1].l > c[i - 1].h : c[i + 1].h < c[i - 1].l))
            return null; // it must leave a gap (needs the next candle)
        return up ? 'bullish' : 'bearish';
    });
    // ---- structure: BOS (continuation) and CHoCH / MSS (first break against the trend), a break with displacement is strong
    let trend = 'range';
    let lastBreak;
    const allPiv = [...hi.map((p) => ({ ...p, t: 'h' })), ...lo.map((p) => ({ ...p, t: 'l' }))].sort((x, y) => x.i - y.i);
    let refH = null, refL = null, pi = 0;
    for (let i = 0; i < n; i++) {
        while (pi < allPiv.length && allPiv[pi].i + N <= i) {
            const p = allPiv[pi++];
            if (p.t === 'h')
                refH = { p: p.p, i: p.i };
            else
                refL = { p: p.p, i: p.i };
        }
        if (refH && c[i].c > refH.p) {
            lastBreak = { kind: trend === 'bearish' ? 'CHoCH' : 'BOS', dir: 'bullish', level: refH.p, i, displaced: disp[i] === 'bullish' || disp[i - 1] === 'bullish' };
            trend = 'bullish';
            refH = null;
        }
        else if (refL && c[i].c < refL.p) {
            lastBreak = { kind: trend === 'bullish' ? 'CHoCH' : 'BOS', dir: 'bearish', level: refL.p, i, displaced: disp[i] === 'bearish' || disp[i - 1] === 'bearish' };
            trend = 'bearish';
            refL = null;
        }
    }
    // ---- liquidity: swing highs / lows (equal ones are the obvious targets) + previous day, Asian and London levels
    const tol = P.eqTol * a;
    const liquidity = [];
    hi.slice(-8).forEach((p, k, arr) => {
        const eq = arr.some((q, j) => j !== k && Math.abs(q.p - p.p) <= tol);
        liquidity.push({ side: 'BSL', price: p.p, i: p.i, swept: c.slice(p.i + N + 1).some((x) => x.h > p.p + 0.02 * a), equal: eq, label: eq ? 'EQH' : undefined });
    });
    lo.slice(-8).forEach((p, k, arr) => {
        const eq = arr.some((q, j) => j !== k && Math.abs(q.p - p.p) <= tol);
        liquidity.push({ side: 'SSL', price: p.p, i: p.i, swept: c.slice(p.i + N + 1).some((x) => x.l < p.p - 0.02 * a), equal: eq, label: eq ? 'EQL' : undefined });
    });
    const levels = refLevels(levelsFrom && levelsFrom.length >= 5 ? levelsFrom : c, a);
    // reference levels may come from the higher timeframe candles (they hold the history): map them onto this chart by time
    const tIdx = (t) => { let k = n - 1; while (k > 0 && c[k].t > t)
        k--; return k; };
    const lvOnC = levelsFrom && levelsFrom.length >= 5 ? levels.map((l) => ({ ...l, i: tIdx(levelsFrom[l.i].t) })) : levels;
    for (const l of lvOnC)
        if (l.key !== 'MO')
            liquidity.push({ side: l.key.endsWith('H') ? 'BSL' : 'SSL', price: l.price, i: l.i, swept: l.swept, equal: false, label: l.key });
    // ---- sweeps: price trades beyond a marked level and closes back inside it within 1 to 3 candles (the first time it trades beyond)
    const marks = [];
    hi.slice(-10).forEach((p) => marks.push({ side: 'BSL', price: p.p, i0: p.i + N, label: liquidity.find((l) => l.side === 'BSL' && l.i === p.i && l.price === p.p)?.equal ? 'Equal highs' : 'Swing high', rank: 1 }));
    lo.slice(-10).forEach((p) => marks.push({ side: 'SSL', price: p.p, i0: p.i + N, label: liquidity.find((l) => l.side === 'SSL' && l.i === p.i && l.price === p.p)?.equal ? 'Equal lows' : 'Swing low', rank: 1 }));
    for (const l of lvOnC) {
        if (l.key === 'MO')
            continue;
        const side = l.key.endsWith('H') ? 'BSL' : 'SSL', dup = marks.find((m) => m.side === side && Math.abs(m.price - l.price) < 0.05 * a); // the same level is also a swing point: name it by what it is
        if (dup) {
            dup.label = l.name;
            dup.rank = 2;
        }
        else
            marks.push({ side, price: l.price, i0: l.i, label: l.name, rank: 2 });
    }
    const ranked = [];
    for (const m of marks) {
        const buySide = m.side === 'BSL';
        let j = -1;
        for (let k = Math.max(m.i0 + 1, 1); k < n; k++) {
            if (buySide ? c[k].h > m.price + 0.02 * a : c[k].l < m.price - 0.02 * a) {
                j = k;
                break;
            }
        }
        if (j < 0 || j < n - 30)
            continue;
        let cf = -1;
        for (let k = j; k < Math.min(n, j + P.sweepWindow); k++) {
            if (buySide ? c[k].c < m.price : c[k].c > m.price) {
                cf = k;
                break;
            }
        }
        if (cf < 0)
            continue;
        const extreme = buySide ? Math.max(...c.slice(j).map((x) => x.h)) : Math.min(...c.slice(j).map((x) => x.l));
        ranked.push({ s: { side: m.side, price: m.price, i: j, confirmI: cf, extreme, label: m.label }, rank: m.rank });
    }
    ranked.sort((x, y) => y.s.confirmI - x.s.confirmI || y.rank - x.rank);
    const sweeps = ranked.map((x) => x.s);
    // ---- dealing range (last swing high to last swing low) and premium / discount around the 50% line
    const lastH = hi[hi.length - 1], lastL = lo[lo.length - 1];
    const high = Math.max(lastH.p, ...c.slice(lastH.i).map((x) => x.h)), low = Math.min(lastL.p, ...c.slice(lastL.i).map((x) => x.l));
    const eq = (high + low) / 2;
    const zone = Math.abs(price - eq) <= 0.05 * (high - low) ? 'equilibrium' : price > eq ? 'premium' : 'discount';
    const range = { high, low, eq, hiI: lastH.i, loI: lastL.i };
    // ---- fair value gaps: candle 1 and candle 3 wicks do not overlap. Keep the ones not yet filled.
    const fvgs = [];
    for (let i = 2; i < n; i++) {
        const b = c[i - 2], d = c[i];
        if (d.l > b.h && d.l - b.h >= 0.1 * a) {
            const top = d.l, bottom = b.h;
            if (!c.slice(i + 1).some((x) => x.l <= bottom))
                fvgs.push({ kind: 'FVG', side: 'bullish', top, bottom, i: i - 1, mean: (top + bottom) / 2, fresh: !c.slice(i + 1).some((x) => x.l <= top), disp: disp[i - 1] === 'bullish' });
        }
        else if (d.h < b.l && b.l - d.h >= 0.1 * a) {
            const top = b.l, bottom = d.h;
            if (!c.slice(i + 1).some((x) => x.h >= top))
                fvgs.push({ kind: 'FVG', side: 'bearish', top, bottom, i: i - 1, mean: (top + bottom) / 2, fresh: !c.slice(i + 1).some((x) => x.h >= bottom), disp: disp[i - 1] === 'bearish' });
        }
    }
    // ---- order blocks: last opposite candle before a displacement that broke the recent swing. Breakers: an order block that failed.
    const obs = [], brks = [];
    for (let i = 3; i < n - 1; i++) {
        if (!disp[i])
            continue;
        const up = disp[i] === 'bullish';
        const ref = c.slice(Math.max(0, i - 12), i);
        if (up ? c[i].c <= Math.max(...ref.map((x) => x.h)) : c[i].c >= Math.min(...ref.map((x) => x.l)))
            continue;
        for (let j = i - 1; j >= Math.max(0, i - 6); j--) {
            if (up ? c[j].c < c[j].o : c[j].c > c[j].o) {
                const top = c[j].h, bottom = c[j].l, after = c.slice(i + 1);
                const brokeAt = after.findIndex((x) => (up ? x.c < bottom : x.c > top));
                if (brokeAt < 0)
                    obs.push({ kind: 'OB', side: up ? 'bullish' : 'bearish', top, bottom, i: j, mean: (top + bottom) / 2, fresh: !after.some((x) => (up ? x.l <= top : x.h >= bottom)) });
                else if (disp[i + 1 + brokeAt] === (up ? 'bearish' : 'bullish') || disp[i + brokeAt] === (up ? 'bearish' : 'bullish')) {
                    // it was broken with displacement: it flips into a breaker that is resistance (was demand) or support (was supply) on the retest
                    const rest = after.slice(brokeAt + 1);
                    const dead = up ? rest.some((x) => x.c > top) : rest.some((x) => x.c < bottom);
                    if (!dead)
                        brks.push({ kind: 'BRK', side: up ? 'bearish' : 'bullish', top, bottom, i: j, mean: (top + bottom) / 2, fresh: !rest.some((x) => (up ? x.h >= bottom : x.l <= top)) });
                }
                break;
            }
        }
    }
    const touch = (x, y) => Math.min(x.top, y.top) - Math.max(x.bottom, y.bottom) > 0;
    const fvgL = fvgs.slice(-5), brkL = brks.slice(-3);
    for (const b of brkL)
        b.unicorn = fvgL.some((g) => g.side === b.side && touch(b, g)); // unicorn: a breaker that overlaps a fair value gap
    return { c, n, price, a, P, trend, lastBreak, hi, lo, disp, liquidity, levels: lvOnC, sweeps, range, zone, fvgs: fvgL, obs: obs.slice(-4), brks: brkL };
}
// ---- guide step 1: higher-timeframe bias (bullish, bearish or none) and the draw on liquidity
function biasOf(B, src) {
    const { c, n, a, price } = B, why = [];
    let s = 0;
    const tag = src === 'htf' ? 'Higher timeframe' : 'Chart timeframe';
    if (B.trend === 'bullish') {
        s += 2;
        why.push(`${tag} structure is bullish${B.lastBreak ? ` (last break: ${B.lastBreak.kind} ${B.lastBreak.dir})` : ''}`);
    }
    else if (B.trend === 'bearish') {
        s -= 2;
        why.push(`${tag} structure is bearish${B.lastBreak ? ` (last break: ${B.lastBreak.kind} ${B.lastBreak.dir})` : ''}`);
    }
    else
        why.push(`${tag} structure is sideways`);
    if (B.zone === 'discount') {
        s += 1;
        why.push('Price is in discount of the dealing range (buy side favoured)');
    }
    else if (B.zone === 'premium') {
        s -= 1;
        why.push('Price is in premium of the dealing range (sell side favoured)');
    }
    const sw = B.sweeps.find((x) => n - 1 - x.confirmI <= 8);
    if (sw) {
        const bull = sw.side === 'SSL', dd = bull ? 'bullish' : 'bearish';
        const dsp = B.disp.slice(sw.confirmI, n).some((x) => x === dd);
        s += (bull ? 1 : -1) * (2 + (dsp ? 1 : 0));
        why.push(`${sw.label} was swept and price closed back${dsp ? ' with displacement' : ''} (${bull ? 'bullish' : 'bearish'})`);
    }
    const arr = [...B.obs, ...B.fvgs, ...B.brks].find((z) => price >= z.bottom - 0.1 * a && price <= z.top + 0.1 * a);
    if (arr) {
        s += arr.side === 'bullish' ? 1 : -1;
        why.push(`Price is reacting from a ${arr.side} ${arr.kind === 'OB' ? 'order block' : arr.kind === 'FVG' ? 'fair value gap' : 'breaker'}`);
    }
    const dir = s >= 2 ? 'bullish' : s <= -2 ? 'bearish' : 'none';
    const above = B.liquidity.filter((l) => l.side === 'BSL' && !l.swept && l.price > price).sort((x, y) => x.price - y.price);
    const below = B.liquidity.filter((l) => l.side === 'SSL' && !l.swept && l.price < price).sort((x, y) => y.price - x.price);
    const nm = (l) => l.label ?? (l.side === 'BSL' ? 'Swing high' : 'Swing low');
    const pick = dir === 'bullish' ? above[0] : dir === 'bearish' ? below[0] : [above[0], below[0]].filter(Boolean).sort((x, y) => Math.abs(x.price - price) - Math.abs(y.price - price))[0];
    return { dir, source: src, score: s, reasons: why, zone: B.zone, draw: pick ? { side: pick.side, price: pick.price, label: nm(pick) } : undefined };
}
function ictAnalyze(c, now = new Date(), opts = {}) {
    const P = (0, exports.mergeIct)(opts.params);
    const kz = (0, exports.killzoneAt)(now);
    const empty = { ok: false, price: c[c.length - 1]?.c ?? 0, atr: NaN, trend: 'range', liquidity: [], orderBlocks: [], fvgs: [], killzone: kz, params: P };
    const B0 = base(c, P, opts.htf && opts.htf.length >= 5 && (granOf(opts.htf) || 0) <= 3600 ? opts.htf : undefined);
    if ('fail' in B0)
        return { ...empty, price: B0.price, atr: B0.a, reason: B0.fail };
    const B = B0, { n, price, a, hi, lo } = B;
    // ---- step 1 and 2: bias from the higher timeframe (or from this chart when no higher timeframe is given) and the draw on liquidity
    let bias = biasOf(B, 'ltf');
    const hb = opts.htf && opts.htf.length >= 40 ? base(opts.htf, P) : null;
    if (hb && !('fail' in hb)) {
        const hbias = biasOf(hb, 'htf');
        bias = hbias;
        // draw on liquidity on the chart timeframe when the higher timeframe pool is far away
        if (!hbias.draw)
            bias = { ...hbias, draw: biasOf(B, 'ltf').draw };
    }
    const side = bias.dir === 'bullish' ? 'buy' : bias.dir === 'bearish' ? 'sell' : null;
    // ---- step 5 and 6: sweep against the bias, then MSS with displacement
    const want = side === 'buy' ? 'SSL' : side === 'sell' ? 'BSL' : null;
    const sweep = (want ? B.sweeps.find((x) => x.side === want) : undefined) ?? B.sweeps[0];
    let mss;
    const sweepOk = !!sweep && !!want && sweep.side === want;
    if (sweepOk && sweep) {
        const buy = side === 'buy', p2 = (0, ta_1.pivots)(c, Math.max(2, B.P.swingN - 1));
        const opp = (buy ? p2.hi : p2.lo).filter((p) => p.i < sweep.i).pop(); // the last opposing swing point before the sweep
        if (opp) {
            for (let k = sweep.i; k < n; k++) {
                if (buy ? c[k].c > opp.p : c[k].c < opp.p) {
                    const dd = buy ? 'bullish' : 'bearish';
                    mss = { dir: dd, level: opp.p, i: k, displaced: B.disp[k] === dd || B.disp[k - 1] === dd };
                    break;
                }
            }
        }
    }
    const lastDisp = (() => { for (let i = n - 1; i >= Math.max(0, n - 25); i--)
        if (B.disp[i])
            return { i, dir: B.disp[i] }; return undefined; })();
    const out = { ok: true, price, atr: a, trend: B.trend, lastBreak: B.lastBreak, range: B.range, zone: B.zone, liquidity: B.liquidity, sweep, orderBlocks: B.obs, fvgs: B.fvgs, breakers: B.brks, killzone: kz, params: P, bias, levels: B.levels, displacement: lastDisp, mss };
    const notes = [];
    const dow = (0, exports.nyClock)(now).dow;
    if (dow === 1)
        notes.push('Monday: the weekly range is usually still being built. Many ICT traders find Tuesday to Thursday cleaner.');
    if (dow === 5)
        notes.push('Friday: late in the day quality drops. Be careful with new trades.');
    const mo = B.levels.find((l) => l.key === 'MO');
    if (mo && side)
        notes.push(side === 'buy' ? (price < mo.price ? 'Price is below the midnight open: a good place to buy on a bullish day.' : 'Price is above the midnight open: on a bullish day look to buy below it.') : (price > mo.price ? 'Price is above the midnight open: a good place to sell on a bearish day.' : 'Price is below the midnight open: on a bearish day look to sell above it.'));
    out.notes = notes;
    if (!side) {
        out.verdict = 'no-trade';
        out.next = 'No clear bias. Wait until the higher timeframe shows a direction: no bias means no trade.';
        return out;
    }
    const buy = side === 'buy';
    // ---- the leg: sweep extreme (or last swing) to the latest extreme in the trade direction. OTE is measured on this leg.
    let legLow, legHigh;
    if (buy) {
        legLow = sweepOk && sweep ? sweep.extreme : lo[lo.length - 1].p;
        const li = c.reduce((m, x, i) => (i >= (sweepOk && sweep ? sweep.i : lo[lo.length - 1].i) && x.l <= c[m].l ? i : m), sweepOk && sweep ? sweep.i : lo[lo.length - 1].i);
        legHigh = Math.max(...c.slice(li).map((x) => x.h));
    }
    else {
        legHigh = sweepOk && sweep ? sweep.extreme : hi[hi.length - 1].p;
        const hi0 = sweepOk && sweep ? sweep.i : hi[hi.length - 1].i;
        const hix = c.reduce((m, x, i) => (i >= hi0 && x.h >= c[m].h ? i : m), hi0);
        legLow = Math.min(...c.slice(hix).map((x) => x.l));
    }
    let span = legHigh - legLow;
    if (!(span >= 1.0 * a)) {
        legHigh = B.range.high;
        legLow = B.range.low;
        span = legHigh - legLow;
    }
    const leg = { high: legHigh, low: legLow, eq: (legHigh + legLow) / 2 };
    out.leg = leg;
    const ote = buy ? { top: legHigh - 0.62 * span, bottom: legHigh - 0.79 * span, side: 'buy', sweet: legHigh - 0.705 * span } : { top: legLow + 0.79 * span, bottom: legLow + 0.62 * span, side: 'sell', sweet: legLow + 0.705 * span };
    out.ote = ote;
    // ---- step 6 (zone): fair value gap left by the displacement, or the order block / breaker at the origin of the move
    const wantZ = buy ? 'bullish' : 'bearish';
    const moveFrom = sweepOk && sweep ? sweep.i : Math.max(0, n - 40);
    const cands = [...B.obs, ...B.fvgs, ...B.brks].filter((z) => z.side === wantZ && (buy ? z.top < price + 0.2 * a : z.bottom > price - 0.2 * a));
    const overlap = (z) => Math.min(z.top, ote.top) - Math.max(z.bottom, ote.bottom);
    const zs = (z) => (overlap(z) > 0 ? 3 : 0) + (z.kind === 'OB' ? 1 : 0) + (z.fresh ? 1 : 0) + (buy ? (z.mean < leg.eq ? 1 : 0) : (z.mean > leg.eq ? 1 : 0)) + (z.i >= moveFrom - 1 ? 2 : 0) + (z.unicorn ? 2 : 0) + (z.kind === 'FVG' && z.disp ? 0.5 : 0) - Math.abs(z.mean - price) / (6 * a);
    const best = cands.sort((x, y) => zs(y) - zs(x))[0];
    if (!best) {
        out.verdict = 'wait';
        out.next = `Bias is ${bias.dir}, but there is no unfilled ${buy ? 'bullish' : 'bearish'} fair value gap, order block or breaker to enter from yet.`;
        return out;
    }
    const stack = cands.filter((z) => z !== best && z.kind !== best.kind && Math.min(z.top, best.top) - Math.max(z.bottom, best.bottom) > 0);
    // ---- step 7: entry. Standard = fair value gap midpoint (CE) or block mean threshold, nudged inside OTE. Aggressive = near edge.
    let entry = best.mean;
    if (overlap(best) > 0)
        entry = Math.min(Math.max(entry, ote.bottom), ote.top);
    const aggressive = buy ? best.top : best.bottom;
    // ---- step 8: stop beyond the swept extreme (manipulation low / high), else beyond the zone; targets at the next liquidity
    const pad = 0.15 * a;
    const viaSweep = sweepOk && !!sweep && (buy ? sweep.extreme < entry : sweep.extreme > entry);
    const sl = viaSweep ? (buy ? sweep.extreme - pad : sweep.extreme + pad) : (buy ? best.bottom - pad : best.top + pad);
    if (Math.abs(entry - sl) < 0.4 * a || (buy ? sl >= entry : sl <= entry)) {
        out.verdict = 'wait';
        out.next = 'The stop would be too close to the entry. Wait for a cleaner zone.';
        return out;
    }
    const liqTargets = B.liquidity.filter((l) => !l.swept && (buy ? l.side === 'BSL' : l.side === 'SSL')).map((l) => l.price);
    if (bias.draw && (buy ? bias.draw.price > entry : bias.draw.price < entry))
        liqTargets.push(bias.draw.price);
    const tps = (0, ta_1.ladder)(entry, sl, liqTargets, buy ? Math.max(B.range.high, leg.high) : Math.min(B.range.low, leg.low));
    const risk = Math.abs(entry - sl);
    const rr = tps.map((p) => Math.abs(p - entry) / risk);
    // ---- the 8 pre-trade questions (guide section 9) and the quality checks (guide step 6: OTE, fresh zone, more than one tool)
    const kzOk = (0, exports.isEntryWindow)(kz);
    const kzText = kz ? (kz.key === 'asia' ? 'Asian range: liquidity is being built, not an entry window' : `Inside ${kz.name}`) : 'Outside every killzone';
    const core = [
        { text: `Bias is ${bias.dir} (${bias.source === 'htf' ? 'higher timeframe' : 'chart only, no higher timeframe loaded'})`, ok: true },
        { text: `Entry is in ${buy ? 'discount' : 'premium'} of the leg (below / above the 50% line ${leg.eq.toFixed(5)})`, ok: buy ? entry < leg.eq : entry > leg.eq },
        { text: kzText, ok: kzOk },
        { text: sweepOk && sweep ? `${sweep.label} swept at ${sweep.price.toFixed(5)}, price closed back` : `No ${buy ? 'sell-side' : 'buy-side'} liquidity sweep against the bias yet`, ok: sweepOk },
        { text: mss ? (mss.displaced ? `MSS ${mss.dir} with displacement above ${mss.level.toFixed(5)}` : `Structure broke without displacement: weak, not valid`) : 'No market structure shift after the sweep yet', ok: !!mss && mss.displaced },
        { text: `${best.kind === 'FVG' ? 'Fair value gap' : best.kind === 'OB' ? 'Order block' : 'Breaker block'} ${best.bottom.toFixed(5)} - ${best.top.toFixed(5)}, stop ${viaSweep ? 'beyond the swept extreme' : 'beyond the zone'} ${sl.toFixed(5)}`, ok: true },
        { text: `Target 2 gives 1:${rr[1].toFixed(1)} (minimum 1:${P.minRR})`, ok: rr[1] >= P.minRR },
        { text: opts.news ? `Major news: ${opts.news}` : risk > P.maxRiskAtr * a ? `Stop is ${(risk / a).toFixed(1)} ATR wide: reduce the size or skip` : 'Stop distance is reasonable and no major news is flagged', ok: !opts.news && risk <= P.maxRiskAtr * a },
    ];
    const quality = [
        { text: 'Entry sits inside the OTE zone (62% to 79% of the leg)', ok: entry <= ote.top + 1e-9 && entry >= ote.bottom - 1e-9 },
        { text: `${best.kind === 'FVG' ? 'Gap' : 'Block'} is ${best.fresh ? 'untouched' : 'partly tested'}`, ok: best.fresh },
        { text: best.unicorn ? 'Unicorn: breaker block overlaps a fair value gap' : `Second PD array overlaps (${stack.length ? (stack[0].kind === 'OB' ? 'order block' : stack[0].kind === 'FVG' ? 'fair value gap' : 'breaker') : 'none'})`, ok: !!best.unicorn || stack.length > 0 },
    ];
    const pts = [12, 8, 8, 16, 16, 8, 6, 6, 8, 6, 6]; // 8 questions = 80, quality = 20. The sweep and MSS separate good setups from the rest.
    const all = [...core, ...quality];
    const score = Math.round(all.reduce((s, x, i) => s + (x.ok ? pts[i] : 0), 0));
    const grade = score >= 85 ? 'A+' : score >= 70 ? 'A' : score >= 50 ? 'B' : 'C';
    const ready = core.every((x) => x.ok);
    const missing = core.map((x, i) => (x.ok ? '' : `${exports.ICT_STEPS[i]}: ${x.text}`)).filter(Boolean);
    const inSilver = !!kz && (kz.key === 'silver' || kz.key === 'sbL' || kz.key === 'sbP');
    const asiaSweep = !!sweep && /^Asian/.test(sweep.label) && !!kz && (kz.key === 'london' || kz.key === 'nyam');
    const model = best.unicorn ? 'Unicorn: breaker block + fair value gap'
        : sweepOk && mss ? (inSilver && best.kind === 'FVG' ? 'Silver Bullet: sweep, MSS, fair value gap'
            : asiaSweep ? 'Judas swing: Asian range sweep + MSS'
                : best.kind === 'FVG' ? 'Liquidity sweep + MSS + fair value gap (ICT 2022 model)' : best.kind === 'BRK' ? 'Breaker block entry after sweep + MSS' : 'Order block entry after sweep + MSS')
            : `${best.kind === 'FVG' ? 'Fair value gap' : best.kind === 'OB' ? 'Order block' : 'Breaker'} in OTE (forming, not confirmed)`;
    out.setup = { side, model, entry, sl, tps, rr, invalidation: sl, confluence: all, score, grade, zoneTop: best.top, zoneBottom: best.bottom, ready, missing, aggressive, slBasis: viaSweep ? 'sweep' : 'zone', zoneKind: best.kind, unicorn: !!best.unicorn };
    out.verdict = ready ? 'trade' : core.filter((x) => x.ok).length >= 5 ? 'wait' : 'no-trade';
    const firstBad = core.findIndex((x) => !x.ok);
    out.next = ready ? 'All 8 checks pass. Enter on the pullback into the zone, risk a small fixed percent and manage the trade.'
        : firstBad === 2 ? 'Wait for a killzone (London 2 to 5 AM, New York AM 7 to 10 AM, New York PM 1:30 to 4 PM, New York time).'
            : firstBad === 3 ? `Wait for ${buy ? 'sell-side' : 'buy-side'} liquidity to be swept: price takes the stops ${buy ? 'below a low' : 'above a high'} and closes back inside.`
                : firstBad === 4 ? 'Wait for a market structure shift with displacement after the sweep. No MSS, no trade.'
                    : firstBad === 1 ? `The entry is in ${buy ? 'premium' : 'discount'}. Wait for price to pull back into ${buy ? 'discount' : 'premium'} (OTE).`
                        : firstBad === 6 ? `There is not enough room to the target for 1:${P.minRR}. Skip this one.` : 'The risk check failed. Reduce the size or skip.';
    return out;
}
