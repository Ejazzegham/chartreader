"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionAt = exports.SCALP_R = exports.SCALP_TF_SECONDS = exports.SCALP_DEFAULTS = exports.PAT_KEYS = void 0;
exports.sdDojiEngine = sdDojiEngine;
exports.detectPats = detectPats;
exports.sdReversalEngine = sdReversalEngine;
exports.scalpAnalyze = scalpAnalyze;
const ta_1 = require("./ta");
const indicators_1 = require("./indicators");
Object.defineProperty(exports, "sessionAt", { enumerable: true, get: function () { return indicators_1.sessionAt; } });
exports.PAT_KEYS = ['doji', 'gravestone', 'dragonfly', 'hammer', 'invhammer', 'hanging', 'shooting', 'morning', 'evening', 'engulfing', 'tweezer'];
exports.SCALP_DEFAULTS = {
    swingLeft: 3, swingRight: 3, atrPeriod: 14, impulse: 2, dojiPct: 10, rejectionOnly: true,
    wickPct: 60, oppWickPct: 20, minRangeAtr: 0.5, maxRangeAtr: 2.5, touchTolAtr: 0, maxZoneAge: 300,
    patterns: exports.PAT_KEYS, trendlines: false, smallBodyPct: 35, maxMultiAtr: 3.5, starBodyAtr: 0.6, tweezerTolAtr: 0.1,
};
// the scalping timeframes of the method, in seconds: M1, M5, M15, M30, H1
exports.SCALP_TF_SECONDS = [60, 300, 900, 1800, 3600];
exports.SCALP_R = [1, 2, 3];
const f6 = (x) => String(Number(x.toPrecision(6)));
const clock = (t) => { const d = new Date(t * 1000); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
// ---------------------------------------------------------------- indicators / swings (same maths as the script)
function atrSeries(c, n) {
    const out = new Array(c.length).fill(NaN);
    let y = NaN;
    for (let i = 0; i < c.length; i++) {
        const tr = i === 0 ? c[0].h - c[0].l : Math.max(c[i].h - c[i].l, Math.abs(c[i].h - c[i - 1].c), Math.abs(c[i].l - c[i - 1].c));
        y = i === 0 ? tr : (1 - 1 / n) * y + (1 / n) * tr; // ewm(alpha = 1/n, adjust = False)
        if (i >= n - 1)
            out[i] = y; // min_periods = n
    }
    return out;
}
function findSwings(c, L, R) {
    const n = c.length, sh = new Array(n).fill(false), sl = new Array(n).fill(false);
    for (let i = L; i < n - R; i++) {
        let hl = -Infinity, hr = -Infinity, ll = Infinity, lr = Infinity;
        for (let k = i - L; k < i; k++) {
            hl = Math.max(hl, c[k].h);
            ll = Math.min(ll, c[k].l);
        }
        for (let k = i + 1; k <= i + R; k++) {
            hr = Math.max(hr, c[k].h);
            lr = Math.min(lr, c[k].l);
        }
        if (c[i].h > hl && c[i].h > hr)
            sh[i] = true;
        if (c[i].l < ll && c[i].l < lr)
            sl[i] = true;
    }
    return { sh, sl };
}
const newZone = (kind, top, bottom, idx, need) => ({ kind, top, bottom, idx, need, extreme: kind === 'supply' ? Infinity : -Infinity, valid: false, dead: false });
const moved = (z) => (z.kind === 'supply' ? z.bottom - z.extreme : z.extreme - z.top);
function zoneUpdate(z, hj, lj, cj) {
    if (z.dead)
        return;
    if (z.kind === 'supply') {
        if (cj > z.top) {
            z.dead = true;
            return;
        }
        z.extreme = Math.min(z.extreme, lj);
    }
    else {
        if (cj < z.bottom) {
            z.dead = true;
            return;
        }
        z.extreme = Math.max(z.extreme, hj);
    }
    if (moved(z) >= z.need)
        z.valid = true;
}
const newLine = (kind, i1, p1, i2, p2) => ({ kind, i1, p1, slope: (p2 - p1) / (i2 - i1), dead: false });
const lineAt = (l, t) => l.p1 + l.slope * (t - l.i1);
function lineUpdate(l, t, cj) {
    if (l.dead)
        return;
    const v = lineAt(l, t);
    if ((l.kind === 'support' && cj < v) || (l.kind === 'resistance' && cj > v))
        l.dead = true;
}
// ---------------------------------------------------------------- first version of the method: zone / trendline + rejection doji only (kept for the Python parity test)
function sdDojiEngine(c, p = exports.SCALP_DEFAULTS) {
    const n = c.length, L = p.swingLeft, R = p.swingRight;
    const atr = atrSeries(c, p.atrPeriod);
    const { sh, sl } = findSwings(c, L, R);
    let zones = [];
    const swingHighs = [], swingLows = [];
    const seen = new Set();
    let support = null, resist = null;
    let pending = null;
    let busyUntil = -1;
    const signals = [];
    let diag = null;
    // the trade the script would have taken: where does it end? (used only to know if an earlier trade is still open)
    const simulate = (side, d, t) => {
        for (let k = t + 1; k < n; k++) {
            if (side === 'sell') {
                const stop = Math.min(c[k - 1].h, c[d].h);
                if (c[k].o > stop || c[k].h > stop)
                    return k;
            }
            else {
                const stop = Math.max(c[k - 1].l, c[d].l);
                if (c[k].o < stop || c[k].l < stop)
                    return k;
            }
        }
        return n - 1;
    };
    for (let t = 0; t < n; t++) {
        // ---- STEP 3: confirmation of the doji from the previous bar
        if (pending) {
            const pend = pending;
            pending = null;
            const { side, d } = pend;
            const ok = (side === 'sell' && c[t].c < c[t].o && c[t].c < c[d].l) || (side === 'buy' && c[t].c > c[t].o && c[t].c > c[d].h);
            const sig = { ...pend.info, confirmI: t, dojiHigh: c[d].h, dojiLow: c[d].l, status: 'EXPIRED' };
            if (ok) {
                const stop = side === 'sell' ? c[d].h : c[d].l;
                sig.status = 'CONFIRMED';
                sig.entry = c[t].c;
                sig.stop = stop;
                sig.risk = Math.abs(stop - c[t].c);
                if (t < n - 1)
                    busyUntil = simulate(side, d, t);
            }
            signals.push(sig);
        }
        // ---- STEP 1 + 2: level check, then doji check (zone state through t-1)
        const rng = c[t].h - c[t].l;
        if (t > busyUntil && rng > 0) {
            const body = Math.abs(c[t].c - c[t].o), upper = c[t].h - Math.max(c[t].o, c[t].c), lower = Math.min(c[t].o, c[t].c) - c[t].l;
            const isDoji = body <= (p.dojiPct / 100) * rng;
            if (isDoji || t === n - 1) {
                const a = atr[t], tol = !isNaN(a) ? p.touchTolAtr * a : 0;
                const sells = [], buys = [];
                for (const z of zones) {
                    if (z.dead || !z.valid)
                        continue;
                    if (!(c[t].h >= z.bottom - tol && c[t].l <= z.top + tol))
                        continue;
                    const stg = z.need > 0 ? moved(z) / z.need : 0;
                    const det = `${z.kind} zone ${f6(z.bottom)} - ${f6(z.top)} (swing ${clock(c[z.idx].t)}, price left by ${stg.toFixed(1)}x required)`;
                    if (z.kind === 'supply' && c[t].c <= z.top)
                        sells.push([stg, 'supply zone', det]);
                    else if (z.kind === 'demand' && c[t].c >= z.bottom)
                        buys.push([stg, 'demand zone', det]);
                }
                if (resist && !resist.dead) {
                    const v = lineAt(resist, t);
                    if (c[t].c <= v && c[t].l - tol <= v && v <= c[t].h + tol)
                        sells.push([0, 'falling trendline', `falling trendline at ${f6(v)}`]);
                }
                if (support && !support.dead) {
                    const v = lineAt(support, t);
                    if (c[t].c >= v && c[t].l - tol <= v && v <= c[t].h + tol)
                        buys.push([0, 'rising trendline', `rising trendline at ${f6(v)}`]);
                }
                const levelOk = (sells.length > 0) !== (buys.length > 0);
                let levelMsg, lvl;
                if (sells.length && buys.length)
                    levelMsg = 'sits on both supply and demand -> no signal';
                else if (!sells.length && !buys.length)
                    levelMsg = 'no valid zone or trendline under this candle';
                else {
                    lvl = (sells.length ? sells : buys).reduce((m, x) => (x[0] > m[0] ? x : m));
                    levelMsg = lvl[2];
                }
                const side = levelOk ? (sells.length ? 'sell' : 'buy') : null;
                const wick = (p.wickPct / 100) * rng, opp = (p.oppWickPct / 100) * rng;
                const kind = upper >= wick && lower <= opp ? 'gravestone-type' : lower >= wick && upper <= opp ? 'dragonfly-type' : 'plain/long-legged';
                const rngAtr = !isNaN(a) ? `${(rng / a).toFixed(1)}x ATR` : 'ATR n/a';
                const shape = `${kind}: body ${Math.round((body / rng) * 100)}%, upper wick ${Math.round((upper / rng) * 100)}%, lower wick ${Math.round((lower / rng) * 100)}%, range ${rngAtr}`;
                let rangeOk = true;
                if (p.minRangeAtr > 0 || p.maxRangeAtr > 0)
                    rangeOk = !isNaN(a) && rng >= p.minRangeAtr * a && (p.maxRangeAtr <= 0 || rng <= p.maxRangeAtr * a);
                let dojiOk = isDoji && rangeOk, dojiMsg = shape;
                if (!isDoji)
                    dojiMsg += ` -> body above the ${p.dojiPct.toFixed(0)}% doji limit`;
                else if (!rangeOk)
                    dojiMsg += ' -> range outside the ATR limits';
                else if (p.rejectionOnly) {
                    let need = side === 'sell' ? 'gravestone-type' : side === 'buy' ? 'dragonfly-type' : null;
                    if (need === null)
                        need = kind !== 'plain/long-legged' ? kind : null;
                    if (kind !== need) {
                        dojiOk = false;
                        dojiMsg += ' -> not a rejection doji for this side';
                    }
                }
                if (t === n - 1)
                    diag = { levelOk, levelMsg, dojiOk, dojiMsg };
                if (levelOk && dojiOk && side && lvl) {
                    pending = { side, d: t, info: { side, dojiI: t, level: lvl[1], levelDetail: levelMsg, stg: lvl[0], dojiDetail: shape, dojiKind: kind, bodyPct: body / rng, rangeAtr: !isNaN(a) ? rng / a : NaN } };
                }
            }
        }
        // ---- update state with bar t
        for (const z of zones)
            zoneUpdate(z, c[t].h, c[t].l, c[t].c);
        zones = zones.filter((z) => !z.dead && !(p.maxZoneAge && t - z.idx > p.maxZoneAge));
        const i = t - R;
        if (i >= L) {
            const mk = [[sh[i], 'supply', c[i].h, Math.min(c[i].o, c[i].c)], [sl[i], 'demand', Math.max(c[i].o, c[i].c), c[i].l]];
            for (const [flag, kind, top, bottom] of mk) {
                if (flag && !isNaN(atr[i])) {
                    const z = newZone(kind, top, bottom, i, atr[i] * p.impulse);
                    for (let j = i + 1; j <= t; j++)
                        zoneUpdate(z, c[j].h, c[j].l, c[j].c);
                    if (!z.dead)
                        zones.push(z);
                }
            }
            if (sh[i])
                swingHighs.push([i, c[i].h]);
            if (sl[i])
                swingLows.push([i, c[i].l]);
        }
        if (swingLows.length >= 2 && swingLows[swingLows.length - 1][1] > swingLows[swingLows.length - 2][1]) {
            const [i1, p1] = swingLows[swingLows.length - 2], [i2, p2] = swingLows[swingLows.length - 1], key = `s${i1}-${i2}`;
            if (!seen.has(key)) {
                seen.add(key);
                support = newLine('support', i1, p1, i2, p2);
                for (let j = i2 + 1; j <= t; j++)
                    lineUpdate(support, j, c[j].c);
            }
            else if (support)
                lineUpdate(support, t, c[t].c);
        }
        else
            support = null;
        if (swingHighs.length >= 2 && swingHighs[swingHighs.length - 1][1] < swingHighs[swingHighs.length - 2][1]) {
            const [i1, p1] = swingHighs[swingHighs.length - 2], [i2, p2] = swingHighs[swingHighs.length - 1], key = `r${i1}-${i2}`;
            if (!seen.has(key)) {
                seen.add(key);
                resist = newLine('resistance', i1, p1, i2, p2);
                for (let j = i2 + 1; j <= t; j++)
                    lineUpdate(resist, j, c[j].c);
            }
            else if (resist)
                lineUpdate(resist, t, c[t].c);
        }
        else
            resist = null;
    }
    if (pending)
        signals.push({ ...pending.info, status: 'WAITING', dojiHigh: c[pending.d].h, dojiLow: c[pending.d].l });
    return { signals, diag, zones, support, resist, atr };
}
// when several patterns end on the same candle the more complete story wins
const RANK = { doji: 1, gravestone: 2, dragonfly: 2, hammer: 2, invhammer: 2, hanging: 2, shooting: 2, tweezer: 3, engulfing: 4, morning: 5, evening: 5 };
// Every reversal pattern that ENDS on candle t. The side is NOT guessed from the trend: a pattern is a SELL pattern for a supply zone and a BUY
// pattern for a demand zone, so the same hammer shape is a Hammer on demand and a Hanging man on supply.
function detectPats(c, t, a, p = exports.SCALP_DEFAULTS) {
    const X = c[t], R = X.h - X.l;
    if (!(R > 0) || !(a > 0))
        return { pats: [], blocked: [], shape: 'no ATR or no range on this candle yet' };
    const body = Math.abs(X.c - X.o), up = X.h - Math.max(X.o, X.c), lw = Math.min(X.o, X.c) - X.l;
    const pc = (v) => Math.round((v / R) * 100);
    const shape = `body ${pc(body)}%, upper wick ${pc(up)}%, lower wick ${pc(lw)}%, range ${(R / a).toFixed(1)}x ATR`;
    const tol = 0.05 * a, raw = [];
    const add = (key, name, side, n, detail) => {
        if (!p.patterns.includes(key))
            return;
        const from = t - n + 1;
        let hi = -Infinity, lo = Infinity;
        for (let k = from; k <= t; k++) {
            hi = Math.max(hi, c[k].h);
            lo = Math.min(lo, c[k].l);
        }
        raw.push({ key, name, side, n, from, hi, lo, rank: RANK[key], detail, sizeAtr: (hi - lo) / a, bodyPct: body / R });
    };
    // ---- one candle
    const dojiLim = (p.dojiPct / 100) * R, wick = (p.wickPct / 100) * R, opp = (p.oppWickPct / 100) * R;
    if (body <= dojiLim) {
        if (up >= wick && lw <= opp)
            add('gravestone', 'Gravestone doji', 'sell', 1, `gravestone doji: ${shape}`);
        else if (lw >= wick && up <= opp)
            add('dragonfly', 'Dragonfly doji', 'buy', 1, `dragonfly doji: ${shape}`);
        else {
            add('doji', 'Doji', 'buy', 1, `doji: ${shape}`);
            add('doji', 'Doji', 'sell', 1, `doji: ${shape}`);
        }
    }
    else if (body <= (p.smallBodyPct / 100) * R) {
        if (lw >= 2 * body && lw >= 0.55 * R && up <= 0.2 * R) {
            add('hammer', 'Hammer', 'buy', 1, `hammer shape: ${shape}`);
            add('hanging', 'Hanging man', 'sell', 1, `hanging man shape: ${shape}`);
        }
        else if (up >= 2 * body && up >= 0.55 * R && lw <= 0.2 * R) {
            add('invhammer', 'Inverted hammer', 'buy', 1, `inverted hammer shape: ${shape}`);
            add('shooting', 'Shooting star', 'sell', 1, `shooting star shape: ${shape}`);
        }
    }
    // ---- two candles
    if (t >= 1) {
        const q = c[t - 1], qb = Math.abs(q.c - q.o), qUp = q.c > q.o, qDn = q.c < q.o, xUp = X.c > X.o, xDn = X.c < X.o;
        if (qb >= 0.25 * a && body > qb) {
            if (qDn && xUp && X.o <= q.c + tol && X.c >= q.o - tol)
                add('engulfing', 'Bullish engulfing', 'buy', 2, `bullish engulfing: the green body covers the red body before it (${(body / qb).toFixed(1)}x bigger)`);
            if (qUp && xDn && X.o >= q.c - tol && X.c <= q.o + tol)
                add('engulfing', 'Bearish engulfing', 'sell', 2, `bearish engulfing: the red body covers the green body before it (${(body / qb).toFixed(1)}x bigger)`);
        }
        const tw = p.tweezerTolAtr * a;
        if (Math.abs(q.l - X.l) <= tw && qDn && xUp)
            add('tweezer', 'Tweezer bottom', 'buy', 2, `tweezer bottom: red then green candle stop at the same low (${q.l.toPrecision(6)} / ${X.l.toPrecision(6)})`);
        if (Math.abs(q.h - X.h) <= tw && qUp && xDn)
            add('tweezer', 'Tweezer top', 'sell', 2, `tweezer top: green then red candle stop at the same high (${q.h.toPrecision(6)} / ${X.h.toPrecision(6)})`);
    }
    // ---- three candles
    if (t >= 2) {
        const c0 = c[t - 2], c1 = c[t - 1], b0 = Math.abs(c0.c - c0.o), b1 = Math.abs(c1.c - c1.o), mid0 = (c0.o + c0.c) / 2;
        const star = c1.h - c1.l > 0 && b1 <= (p.dojiPct / 100) * (c1.h - c1.l) ? ' (the middle candle is a doji)' : '';
        if (c0.c < c0.o && b0 >= p.starBodyAtr * a && b1 <= 0.4 * b0 && Math.max(c1.o, c1.c) <= c0.c + tol && X.c > X.o && X.c > mid0)
            add('morning', 'Morning star', 'buy', 3, `morning star${star}: red candle, small pause candle, green candle closing above the middle of the first body`);
        if (c0.c > c0.o && b0 >= p.starBodyAtr * a && b1 <= 0.4 * b0 && Math.min(c1.o, c1.c) >= c0.c - tol && X.c < X.o && X.c < mid0)
            add('evening', 'Evening star', 'sell', 3, `evening star${star}: green candle, small pause candle, red candle closing below the middle of the first body`);
    }
    const pats = [], blocked = [];
    for (const q of raw) {
        const lim = q.n === 1 ? p.maxRangeAtr : p.maxMultiAtr;
        if (q.sizeAtr >= p.minRangeAtr && (lim <= 0 || q.sizeAtr <= lim))
            pats.push(q);
        else if (!blocked.includes(q.name))
            blocked.push(`${q.name} (${q.sizeAtr.toFixed(1)} ATR tall)`);
    }
    return { pats, blocked, shape };
}
// ---------------------------------------------------------------- engine: zone -> reversal candle -> confirmation
function sdReversalEngine(c, p = exports.SCALP_DEFAULTS) {
    const n = c.length, L = p.swingLeft, R = p.swingRight;
    const atr = atrSeries(c, p.atrPeriod);
    const { sh, sl } = findSwings(c, L, R);
    let zones = [];
    const swingHighs = [], swingLows = [];
    const seen = new Set();
    let support = null, resist = null;
    let pending = null;
    let busyUntil = -1;
    const signals = [];
    let diag = null;
    // where does the trade the method would have taken end? (used only to know if an earlier trade is still open)
    const simulate = (side, extreme, t) => {
        for (let k = t + 1; k < n; k++) {
            if (side === 'sell') {
                const stop = Math.min(c[k - 1].h, extreme);
                if (c[k].o > stop || c[k].h > stop)
                    return k;
            }
            else {
                const stop = Math.max(c[k - 1].l, extreme);
                if (c[k].o < stop || c[k].l < stop)
                    return k;
            }
        }
        return n - 1;
    };
    // STEP 1: valid levels of one side that the price range [lo, hi] touches (zone state through t-1)
    const levelsFor = (side, lo, hi, t) => {
        const out = [], a = atr[t], tol = !isNaN(a) ? p.touchTolAtr * a : 0;
        for (const z of zones) {
            if (z.dead || !z.valid || z.kind !== (side === 'sell' ? 'supply' : 'demand'))
                continue;
            if (!(hi >= z.bottom - tol && lo <= z.top + tol))
                continue;
            if (side === 'sell' ? !(c[t].c <= z.top) : !(c[t].c >= z.bottom))
                continue;
            const stg = z.need > 0 ? moved(z) / z.need : 0;
            out.push([stg, side === 'sell' ? 'supply zone' : 'demand zone', `${z.kind} zone ${f6(z.bottom)} - ${f6(z.top)} (swing ${clock(c[z.idx].t)}, price left by ${stg.toFixed(1)}x required)`]);
        }
        if (p.trendlines) {
            if (side === 'sell' && resist && !resist.dead) {
                const v = lineAt(resist, t);
                if (c[t].c <= v && lo - tol <= v && v <= hi + tol)
                    out.push([0, 'falling trendline', `falling trendline at ${f6(v)}`]);
            }
            if (side === 'buy' && support && !support.dead) {
                const v = lineAt(support, t);
                if (c[t].c >= v && lo - tol <= v && v <= hi + tol)
                    out.push([0, 'rising trendline', `rising trendline at ${f6(v)}`]);
            }
        }
        return out;
    };
    const best = (l) => l.reduce((m, x) => (x[0] > m[0] ? x : m));
    for (let t = 0; t < n; t++) {
        // ---- STEP 3: confirmation of the reversal candle from the previous bar
        if (pending) {
            const pend = pending;
            pending = null;
            const { side, info } = pend, d = info.sigI;
            const ok = (side === 'sell' && c[t].c < c[t].o && c[t].c < c[d].l) || (side === 'buy' && c[t].c > c[t].o && c[t].c > c[d].h);
            const sig = { ...info, confirmI: t, status: 'EXPIRED' };
            if (ok) {
                const stop = side === 'sell' ? info.pat.hi : info.pat.lo;
                sig.status = 'CONFIRMED';
                sig.entry = c[t].c;
                sig.stop = stop;
                sig.risk = Math.abs(stop - c[t].c);
                busyUntil = simulate(side, stop, t); // the trade opens at the close of this candle, so it also blocks a new setup on this same candle
            }
            signals.push(sig);
        }
        // ---- STEP 1 + 2: the reversal candle on a zone (zone state through t-1)
        if (t > busyUntil && c[t].h - c[t].l > 0) {
            const a = atr[t], det = detectPats(c, t, a, p);
            const cands = [];
            for (const pat of det.pats) {
                const mine = levelsFor(pat.side, pat.lo, pat.hi, t), other = levelsFor(pat.side === 'sell' ? 'buy' : 'sell', pat.lo, pat.hi, t);
                if (mine.length && !other.length)
                    cands.push({ pat, lv: best(mine) }); // sitting on both supply and demand = no signal
            }
            cands.sort((x, y) => y.pat.rank - x.pat.rank || y.lv[0] - x.lv[0]);
            const pick = cands[0];
            if (pick) {
                const { pat, lv } = pick;
                pending = { side: pat.side, info: { side: pat.side, sigI: t, pat, level: lv[1], levelDetail: lv[2], stg: lv[0], sigHigh: c[t].h, sigLow: c[t].l } };
            }
            if (t === n - 1) {
                if (pick)
                    diag = { levelOk: true, levelMsg: pick.lv[2], patOk: true, patMsg: pick.pat.detail };
                else {
                    // explain what is missing: the zones under the last candle (or under the candles of a pattern that just formed) and what the last candle looks like
                    let lo3 = c[t].l, hi3 = c[t].h;
                    for (const q of det.pats) {
                        lo3 = Math.min(lo3, q.lo);
                        hi3 = Math.max(hi3, q.hi);
                    }
                    const sells = levelsFor('sell', lo3, hi3, t), buys = levelsFor('buy', lo3, hi3, t);
                    const levelOk = (sells.length > 0) !== (buys.length > 0);
                    const levelMsg = sells.length && buys.length ? 'this candle sits on both supply and demand -> no signal' : !sells.length && !buys.length ? 'no valid supply or demand zone under this candle' : best(sells.length ? sells : buys)[2];
                    const names = [...new Set(det.pats.map((q) => q.name))].join(', ');
                    const patMsg = det.pats.length
                        ? `${names} formed (${det.shape}) but not on a ${levelOk ? 'zone of the matching side' : 'valid zone'}`
                        : det.blocked.length ? `${det.blocked.join(', ')} found, but the size is outside the ATR limits` : `no reversal candle on the last candle: ${det.shape}`;
                    diag = { levelOk, levelMsg, patOk: false, patMsg };
                }
            }
        }
        // ---- update state with bar t
        for (const z of zones)
            zoneUpdate(z, c[t].h, c[t].l, c[t].c);
        zones = zones.filter((z) => !z.dead && !(p.maxZoneAge && t - z.idx > p.maxZoneAge));
        const i = t - R;
        if (i >= L) {
            const mk = [[sh[i], 'supply', c[i].h, Math.min(c[i].o, c[i].c)], [sl[i], 'demand', Math.max(c[i].o, c[i].c), c[i].l]];
            for (const [flag, kind, top, bottom] of mk) {
                if (flag && !isNaN(atr[i])) {
                    const z = newZone(kind, top, bottom, i, atr[i] * p.impulse);
                    for (let j = i + 1; j <= t; j++)
                        zoneUpdate(z, c[j].h, c[j].l, c[j].c);
                    if (!z.dead)
                        zones.push(z);
                }
            }
            if (sh[i])
                swingHighs.push([i, c[i].h]);
            if (sl[i])
                swingLows.push([i, c[i].l]);
        }
        if (swingLows.length >= 2 && swingLows[swingLows.length - 1][1] > swingLows[swingLows.length - 2][1]) {
            const [i1, p1] = swingLows[swingLows.length - 2], [i2, p2] = swingLows[swingLows.length - 1], key = `s${i1}-${i2}`;
            if (!seen.has(key)) {
                seen.add(key);
                support = newLine('support', i1, p1, i2, p2);
                for (let j = i2 + 1; j <= t; j++)
                    lineUpdate(support, j, c[j].c);
            }
            else if (support)
                lineUpdate(support, t, c[t].c);
        }
        else
            support = null;
        if (swingHighs.length >= 2 && swingHighs[swingHighs.length - 1][1] < swingHighs[swingHighs.length - 2][1]) {
            const [i1, p1] = swingHighs[swingHighs.length - 2], [i2, p2] = swingHighs[swingHighs.length - 1], key = `r${i1}-${i2}`;
            if (!seen.has(key)) {
                seen.add(key);
                resist = newLine('resistance', i1, p1, i2, p2);
                for (let j = i2 + 1; j <= t; j++)
                    lineUpdate(resist, j, c[j].c);
            }
            else if (resist)
                lineUpdate(resist, t, c[t].c);
        }
        else
            resist = null;
    }
    if (pending)
        signals.push({ ...pending.info, status: 'WAITING' });
    return { signals, diag, zones, support, resist, atr };
}
// ---------------------------------------------------------------- app wrapper
// c = CLOSED candles. Same shape as before (setup / why / session / volatility) so the rest of the app keeps working.
function scalpAnalyze(c, now = new Date(), opts = {}) {
    const sessions = opts.sessions !== false, p = { ...exports.SCALP_DEFAULTS, ...opts.params };
    const base = { ok: false, price: c[c.length - 1]?.c ?? 0, atr: NaN, rsi7: NaN, vol: 'ok', volRatio: 1, session: sessions ? (0, indicators_1.sessionAt)(now) : null, status: 'none', steps: [], zones: [], lines: [] };
    if (c.length < 60)
        return { ...base, reason: 'Need at least 60 candles.' };
    const n = c.length, last = n - 1;
    const E = sdReversalEngine(c, p), a = E.atr[last];
    if (!isFinite(a) || a <= 0)
        return { ...base, reason: 'No volatility data.' };
    // volatility: average true range of the last 14 candles against the 60 before them
    const tr = c.map((x, i) => (i === 0 ? x.h - x.l : Math.max(x.h - x.l, Math.abs(x.h - c[i - 1].c), Math.abs(x.l - c[i - 1].c))));
    const avg = (arr) => arr.reduce((s, v) => s + v, 0) / Math.max(1, arr.length);
    const volRatio = avg(tr.slice(-14)) / (avg(tr.slice(-74, -14)) || 1);
    const vol = volRatio < 0.55 ? 'dead' : volRatio > 2.2 ? 'wild' : 'ok';
    const zones = E.zones.filter((z) => z.valid && !z.dead).map((z) => ({ kind: z.kind, top: z.top, bottom: z.bottom, i: z.idx, strength: z.need > 0 ? moved(z) / z.need : 0 }));
    const lines = [];
    if (p.trendlines)
        for (const l of [E.support, E.resist])
            if (l && !l.dead)
                lines.push({ kind: l.kind, v: c.map((_, t) => (t >= l.i1 ? lineAt(l, t) : NaN)) });
    const out = { ...base, ok: true, atr: a, rsi7: (0, ta_1.rsi)(c.map((x) => x.c), 7), vol, volRatio, zones, lines };
    const s = [...E.signals].reverse().find((x) => x.status === 'WAITING' || x.confirmI === last);
    if (!s) {
        if (!E.diag) {
            out.status = 'busy';
            out.why = 'A trade from an earlier signal would still be open, so there is no new signal.';
            return out;
        }
        out.steps = [
            { n: 1, title: 'Supply / demand zone', ok: E.diag.levelOk, text: E.diag.levelMsg },
            { n: 2, title: 'Reversal candle', ok: E.diag.patOk, text: E.diag.patMsg },
            { n: 3, title: 'Confirmation', ok: false, text: 'Waiting for steps 1 and 2' },
        ];
        out.why = `No signal. Step 1 ${E.diag.levelOk ? 'passes' : 'fails'}: ${E.diag.levelMsg}. Step 2 ${E.diag.patOk ? 'passes' : 'fails'}: ${E.diag.patMsg}.`;
        return out;
    }
    const buy = s.side === 'buy', pat = s.pat;
    const need = buy ? `GREEN candle closing above ${f6(s.sigHigh)}` : `RED candle closing below ${f6(s.sigLow)}`;
    out.steps = [
        { n: 1, title: 'Supply / demand zone', ok: true, text: s.levelDetail },
        { n: 2, title: 'Reversal candle', ok: true, text: `${pat.detail} [${pat.n === 1 ? 'candle' : `${pat.n} candles, last`} at ${clock(c[s.sigI].t)}]` },
        s.status === 'WAITING' ? { n: 3, title: 'Confirmation', ok: false, text: `WAITING: the next candle must be a ${need}` }
            : s.status === 'EXPIRED' ? { n: 3, title: 'Confirmation', ok: false, text: `FAILED: the candle was not a ${need}` }
                : { n: 3, title: 'Confirmation', ok: true, text: `${buy ? 'Green' : 'Red'} candle closed beyond the ${pat.name.toLowerCase()}` },
    ];
    if (s.status === 'EXPIRED') {
        out.status = 'expired';
        out.why = `Setup expired: the candle after the ${pat.name.toLowerCase()} was not a ${need}.`;
        return out;
    }
    const armed = s.status === 'WAITING';
    out.status = armed ? 'watch' : 'signal';
    const stop = buy ? pat.lo : pat.hi;
    const entry = armed ? (buy ? s.sigHigh : s.sigLow) : s.entry;
    const risk = Math.max(Math.abs(entry - stop), 1e-12);
    const tps = exports.SCALP_R.map((r) => entry + (buy ? 1 : -1) * r * risk);
    // room to run: no valid zone of the other side within 1R
    const room = !zones.some((z) => (buy ? z.kind === 'supply' && z.bottom > entry && z.bottom < entry + risk : z.kind === 'demand' && z.top < entry && z.top > entry - risk));
    const isZone = s.level.endsWith('zone');
    const conf = [
        { text: `Step 1: ${s.levelDetail}`, ok: true },
        { text: `Step 2: ${pat.detail}`, ok: true },
        { text: armed ? `Step 3: waiting for a ${need}` : `Step 3: ${buy ? 'green' : 'red'} candle closed beyond the ${pat.name.toLowerCase()}`, ok: !armed },
        { text: isZone ? `Strong zone: price left it by ${s.stg.toFixed(1)}x the required move` : 'Trendline level (zones are stronger)', ok: isZone && s.stg >= 1.5 },
        { text: pat.n >= 2 ? `${pat.name}: a ${pat.n}-candle pattern is a fuller story than one candle` : `Clean candle: body ${Math.round(pat.bodyPct * 100)}% of the range`, ok: pat.n >= 2 || pat.bodyPct <= 0.2 },
        { text: `Tight stop: ${(risk / a).toFixed(1)} ATR`, ok: risk <= 1.5 * a },
        { text: sessions ? `Session: ${base.session?.name}` : 'Market trades around the clock', ok: !sessions || !!base.session?.good },
        { text: `Volatility ${vol === 'ok' ? 'healthy' : vol === 'dead' ? 'too quiet' : 'too wild'}`, ok: vol === 'ok' },
        { text: 'Room to run: no opposite zone within 1R', ok: room },
    ];
    const pts = [20, 20, 20, 10, 5, 10, 5, 5, 5];
    let score = Math.round(conf.reduce((q, x, i) => q + (x.ok ? pts[i] : 0), 0));
    if (armed)
        score = Math.min(score, 55); // no entry yet
    const grade = score >= 85 ? 'A+' : score >= 70 ? 'A' : score >= 50 ? 'B' : 'C';
    const exit = buy ? "close when price breaks the previous candle's low" : "close when price breaks the previous candle's high";
    out.setup = {
        side: s.side, model: `${s.level[0].toUpperCase()}${s.level.slice(1)} + ${pat.name.toLowerCase()}`, entry, sl: stop, tps, rr: exports.SCALP_R, score, grade, confluence: conf, barsAgo: 0,
        state: armed ? 'armed' : 'triggered', patternI: s.sigI, pattern: { key: pat.key, name: pat.name, n: pat.n, from: pat.from }, level: s.level, confirmI: armed ? undefined : s.confirmI,
        note: armed
            ? `The ${pat.name.toLowerCase()} formed on the ${s.level}. Do not enter yet: the next candle must be a ${need}. The entry shown is that break level.`
            : `${pat.name} on the ${s.level}, confirmed. Entry at the close of the confirmation candle, stop at the pattern ${buy ? 'low' : 'high'}. Exit rule of the method: ${exit}; a gap fills at the open, and the stop is never beyond the pattern ${buy ? 'low' : 'high'}. TP1-3 are only reference levels at 1R / 2R / 3R. Skip the minutes around news.`,
    };
    return out;
}
