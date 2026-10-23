"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.atr = exports.rsi = exports.ema = void 0;
exports.macd = macd;
exports.signal = signal;
exports.pivots = pivots;
exports.context = context;
exports.ladder = ladder;
exports.zoneSpent = zoneSpent;
exports.suggest = suggest;
exports.checkPlan = checkPlan;
const tpconst_1 = require("./tpconst");
// EMA aligned to the input (NaN until enough data), RSI (Wilder) and a simple multi-factor signal.
const ema = (v, n) => {
    const k = 2 / (n + 1);
    let e = 0;
    return v.map((x, i) => { e = i === 0 ? x : x * k + e * (1 - k); return i < n - 1 ? NaN : e; });
};
exports.ema = ema;
const rsi = (v, n = 14) => {
    if (v.length <= n)
        return NaN;
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
    for (let i = n + 1; i < v.length; i++) {
        const d = v[i] - v[i - 1];
        g = (g * (n - 1) + Math.max(d, 0)) / n;
        l = (l * (n - 1) + Math.max(-d, 0)) / n;
    }
    if (g === 0 && l === 0)
        return 50; // no movement at all
    return l === 0 ? 100 : 100 - 100 / (1 + g / l);
};
exports.rsi = rsi;
// MACD (12, 26, 9) aligned to the input. NaN until enough data.
function macd(v, fast = 12, slow = 26, sig = 9) {
    const ef = (0, exports.ema)(v, fast), es = (0, exports.ema)(v, slow);
    const line = v.map((_, i) => (isNaN(ef[i]) || isNaN(es[i]) ? NaN : ef[i] - es[i]));
    const k = 2 / (sig + 1);
    let e = 0, cnt = 0;
    const signal = line.map((x) => {
        if (isNaN(x))
            return NaN;
        cnt++;
        e = cnt === 1 ? x : x * k + e * (1 - k);
        return cnt < sig ? NaN : e;
    });
    return { line, signal, hist: line.map((x, i) => (isNaN(x) || isNaN(signal[i]) ? NaN : x - signal[i])) };
}
function signal(c) {
    const cl = c.map((x) => x.c), last = cl[cl.length - 1];
    const e20 = (0, exports.ema)(cl, 20), e50 = (0, exports.ema)(cl, 50), a = e20[e20.length - 1], b = e50[e50.length - 1], r = (0, exports.rsi)(cl);
    let s = 0;
    if (isFinite(a))
        s += Math.sign(last - a);
    if (isFinite(a) && isFinite(b))
        s += Math.sign(a - b);
    if (isFinite(r))
        s += r > 55 ? 1 : r < 45 ? -1 : 0;
    const m = cl[cl.length - 11];
    if (m !== undefined)
        s += Math.sign(last - m);
    return { score: s, rsi: r, dir: s >= 2 ? 'buy' : s <= -2 ? 'sell' : 'wait' };
}
// =====================================================================================
// Trade plan engine: judges YOUR levels (higher / lower / entry / stop loss / take profit)
// against the live candles with several independent methods, and can also suggest levels.
// Methods: trend (EMA 20/50 + slope), momentum (RSI 14 + MACD), market structure (swing pivots, HH/HL vs LH/LL),
// volatility (ATR 14), support/resistance from confirmed swing pivots, and a quick historical hit-rate test.
// =====================================================================================
const emaRaw = (v, n) => {
    const k = 2 / (n + 1);
    let e = v[0];
    return v.map((x, i) => (e = i === 0 ? x : x * k + e * (1 - k)));
};
const macdHist = (cl) => {
    const slow = emaRaw(cl, 26), m = emaRaw(cl, 12).map((x, i) => x - slow[i]);
    const s = emaRaw(m, 9);
    return m[m.length - 1] - s[s.length - 1];
};
const atr = (c, n = 14) => {
    if (c.length < 3)
        return NaN;
    const tr = c.map((x, i) => (i === 0 ? x.h - x.l : Math.max(x.h - x.l, Math.abs(x.h - c[i - 1].c), Math.abs(x.l - c[i - 1].c))));
    const m = Math.min(n, tr.length - 1);
    let a = tr.slice(1, m + 1).reduce((s, v) => s + v, 0) / m;
    for (let i = m + 1; i < tr.length; i++)
        a = (a * (m - 1) + tr[i]) / m;
    return a;
};
exports.atr = atr;
// Confirmed swing highs / lows: a candle whose high (low) beats the k candles on each side.
function pivots(c, k = 3) {
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
}
// Market context from the candles: score from -1 (strong downtrend) to +1 (strong uptrend).
function context(c) {
    if (c.length < 30)
        return null;
    const cl = c.map((x) => x.c), price = cl[cl.length - 1], n = cl.length;
    const e20a = (0, exports.ema)(cl, 20), e50a = (0, exports.ema)(cl, 50), e20 = e20a[n - 1], e50 = e50a[n - 1];
    const r = (0, exports.rsi)(cl), a = (0, exports.atr)(c), hist = macdHist(cl);
    const { hi, lo } = pivots(c);
    let structure = 'mixed', st = 0;
    if (hi.length >= 2 && lo.length >= 2) {
        const hh = hi[hi.length - 1].p > hi[hi.length - 2].p, hl = lo[lo.length - 1].p > lo[lo.length - 2].p;
        if (hh && hl) {
            structure = 'HH/HL';
            st = 2;
        }
        else if (!hh && !hl) {
            structure = 'LH/LL';
            st = -2;
        }
    }
    let s = st;
    if (isFinite(e20))
        s += price > e20 ? 1 : -1;
    if (isFinite(e20) && isFinite(e50))
        s += e20 > e50 ? 1 : -1;
    if (isFinite(e20) && isFinite(e20a[n - 6]))
        s += Math.sign(e20 - e20a[n - 6]);
    if (isFinite(r))
        s += r > 55 ? 1 : r < 45 ? -1 : 0;
    s += hist > 0 ? 1 : -1;
    const score = Math.max(-1, Math.min(1, s / 7));
    const win = c.slice(-50);
    return {
        price, atr: a, rsi: r, hist, e20, e50, structure, score, bias: score >= 0.3 ? 'buy' : score <= -0.3 ? 'sell' : 'wait',
        support: lo.map((p) => p.p).filter((p) => p < price).sort((x, y) => y - x).slice(0, 3),
        resistance: hi.map((p) => p.p).filter((p) => p > price).sort((x, y) => x - y).slice(0, 3),
        rangeHi: Math.max(...win.map((x) => x.h)), rangeLo: Math.min(...win.map((x) => x.l)),
    };
}
// 3 targets: TP1 1.5R (or just before the nearest opposing liquidity), TP2 2.5R, TP3 4R / the range extreme. Nearest first.
function ladder(entry, sl, liq = [], extreme) {
    const s = entry > sl ? 1 : -1, risk = Math.abs(entry - sl);
    const raw = tpconst_1.TP_R.map((r) => entry + s * r * risk);
    const opp = liq.filter((p) => (s === 1 ? p > entry : p < entry)).sort((a, b) => s * (a - b));
    const snap = raw.map((v) => {
        const near = opp.find((p) => Math.abs(p - v) <= 0.4 * risk);
        return near !== undefined ? near - s * 0.05 * risk : v;
    });
    if (extreme !== undefined && (extreme - entry) * s > 2.5 * risk)
        snap[2] = extreme;
    const out = [...snap].sort((a, b) => s * (a - b));
    for (let i = 1; i < 3; i++)
        if ((out[i] - out[i - 1]) * s < 0.3 * risk)
            out[i] = out[i - 1] + s * 0.5 * risk;
    return [out[0], out[1], out[2]];
}
// A zone is SPENT when price already came back to it and then travelled at least `r` risks away from the entry: the trade
// happened without us (the first target would already be hit). A zone price never returned to (`fresh`) is never spent.
// Without this the engines kept choosing the best-scoring OLD zone in a trend and the entry planner then said "too late".
function zoneSpent(c, buy, zTop, zBot, fromI, fresh, entry, sl, r = tpconst_1.TP_R[0]) {
    const risk = Math.abs(entry - sl);
    if (fresh || !(risk > 0))
        return false;
    let touch = -1;
    for (let k = c.length - 1; k > fromI + 1; k--) {
        if (buy ? c[k].l <= zTop : c[k].h >= zBot) {
            touch = k;
            break;
        }
    }
    if (touch < 0)
        return false;
    let peak = buy ? -Infinity : Infinity;
    for (let k = touch; k < c.length; k++)
        peak = buy ? Math.max(peak, c[k].h) : Math.min(peak, c[k].l);
    return buy ? peak >= entry + r * risk : peak <= entry - r * risk;
}
// Suggested levels: trade with the context, stop beyond the nearest swing (1 to 2.5 ATR), target at the next opposing level or 2R.
function suggest(c) {
    const x = context(c);
    if (!x || !isFinite(x.atr) || x.atr <= 0)
        return null;
    const s = x.score >= 0 ? 1 : -1, a = x.atr, entry = x.price;
    const near = s === 1 ? x.support[0] : x.resistance[0];
    const risk = Math.min(Math.max(near !== undefined ? Math.abs(entry - near) + 0.25 * a : 1.2 * a, a), 2.5 * a);
    const opp = s === 1 ? x.resistance : x.support;
    const sl = entry - s * risk;
    const tps = ladder(entry, sl, opp, s === 1 ? x.rangeHi : x.rangeLo);
    return { side: s === 1 ? 'buy' : 'sell', higher: x.rangeHi, lower: x.rangeLo, entry, sl, tps };
}
// How often did this same stop / target distance work on this pair and timeframe? Stop is checked first (conservative).
function hitRate(c, s, risk, reward) {
    let win = 0, loss = 0, open = 0;
    for (let i = 20; i < c.length - 1; i++) {
        const e = c[i].c, sl = e - s * risk, tp = e + s * reward;
        let res = 0;
        for (let j = i + 1; j < c.length && !res; j++) {
            if (s === 1 ? c[j].l <= sl : c[j].h >= sl)
                res = -1;
            else if (s === 1 ? c[j].h >= tp : c[j].l <= tp)
                res = 1;
        }
        if (res === 1)
            win++;
        else if (res === -1)
            loss++;
        else
            open++;
    }
    const done = win + loss;
    if (done < 10)
        return null;
    const rate = win / done;
    return { win, loss, open, rate, exp: rate * (reward / risk) - (1 - rate) };
}
function checkPlan(c, p, dec) {
    const f = (n) => n.toFixed(dec), checks = [];
    const { higher: hi, lower: lo, entry, sl } = p;
    const tps = p.tps.filter((v) => isFinite(v)), tp = tps[0], tpF = tps[tps.length - 1];
    const x = context(c);
    if (!x || !isFinite(x.atr) || x.atr <= 0)
        return { error: 'Not enough chart data yet (need about 30 candles).', checks };
    const buy = tps.length > 0 && tps.every((v) => v > entry) && sl < entry, sell = tps.length > 0 && tps.every((v) => v < entry) && sl > entry;
    if (!buy && !sell)
        return { error: 'Stop loss and all take profits must be on opposite sides of the entry. Buy: stop loss below, TP1 / TP2 / TP3 above. Sell: the reverse.', checks };
    const s = buy ? 1 : -1, a = x.atr, risk = Math.abs(entry - sl);
    const W = tpconst_1.TP_SPLIT.slice(0, tps.length), WS = W.reduce((q, v) => q + v, 0);
    const rewards = tps.map((v) => Math.abs(v - entry));
    const reward = rewards.reduce((q, v, i) => q + v * W[i], 0) / WS, rr = reward / risk; // blended over the planned close split
    const slAtr = risk / a, tpAtr = reward / a, farAtr = rewards[rewards.length - 1] / a;
    const rrs = rewards.map((v) => v / risk);
    if (tps.length > 1 && !rewards.every((v, i) => i === 0 || v > rewards[i - 1]))
        checks.push({ tone: 'warn', text: 'Take profits should get further from the entry: TP1 nearest, then TP2, then TP3.' });
    // 1) Trend / momentum / structure alignment (30 pts)
    const align = x.score * s;
    const ctxTxt = `Trend ${x.score > 0.15 ? 'up' : x.score < -0.15 ? 'down' : 'sideways'}, structure ${x.structure}, RSI ${isFinite(x.rsi) ? x.rsi.toFixed(0) : '-'}, MACD ${x.hist > 0 ? 'rising' : 'falling'}.`;
    if (align >= 0.3)
        checks.push({ tone: 'good', text: `Trade is WITH the market. ${ctxTxt}` });
    else if (align > -0.3)
        checks.push({ tone: 'warn', text: `Market has no clear direction, so keep size small. ${ctxTxt}` });
    else
        checks.push({ tone: 'bad', text: `Trade is AGAINST the market. ${ctxTxt}` });
    const ptsCtx = 30 * (align + 1) / 2;
    // 2) Risk : reward (25 pts)
    checks.push({ tone: rr >= 2 ? 'good' : rr >= 1.3 ? 'warn' : 'bad', text: `${tps.length > 1 ? `Blended risk:reward (${W.map((v) => v + '%').join(' / ')} closes) ` : 'Risk:reward '}1 : ${rr.toFixed(2)}${rr >= 2 ? ' (strong)' : rr >= 1.3 ? ' (acceptable, 2 or more is better)' : ' (too low, you need a very high win rate)'}.` });
    const ptsRr = 25 * Math.max(0, Math.min(1, (rr - 0.5) / 1.5));
    // 3) Stop loss: size vs volatility, and protected by structure (20 pts)
    const swingBehind = (s === 1 ? x.support : x.resistance)[0];
    const protectedSl = swingBehind === undefined || (s === 1 ? sl < swingBehind : sl > swingBehind);
    let ptsSl = slAtr >= 0.8 && slAtr <= 3 ? 20 : slAtr < 0.8 ? 20 * slAtr / 0.8 : 20 * Math.max(0, 1 - (slAtr - 3) / 3);
    if (slAtr < 0.8)
        checks.push({ tone: 'bad', text: `Stop is only ${slAtr.toFixed(1)} ATR away. Normal candle noise can hit it. Widen it to at least 1 ATR (${f(a)}).` });
    else if (slAtr > 3)
        checks.push({ tone: 'warn', text: `Stop is ${slAtr.toFixed(1)} ATR away, which is wide. Lot size must be small.` });
    else
        checks.push({ tone: 'good', text: `Stop distance ${slAtr.toFixed(1)} ATR is in a healthy range.` });
    if (!protectedSl) {
        ptsSl *= 0.6;
        checks.push({ tone: 'warn', text: `Stop sits in front of the swing ${s === 1 ? 'low' : 'high'} at ${f(swingBehind)}. Price can sweep that level first. Place it just beyond it.` });
    }
    else if (swingBehind !== undefined)
        checks.push({ tone: 'good', text: `Stop is protected by the swing ${s === 1 ? 'low' : 'high'} at ${f(swingBehind)}.` });
    // 4) Take profit: reachable and not blocked by structure (15 pts)
    const blockers = (s === 1 ? x.resistance : x.support).filter((v) => (s === 1 ? v > entry && v < tp : v < entry && v > tp));
    const reach = farAtr <= 5 ? 1 : Math.max(0, 1 - (farAtr - 5) / 7);
    const ptsTp = 15 * reach * (blockers.length === 0 ? 1 : blockers.length === 1 ? 0.7 : 0.4);
    if (blockers.length)
        checks.push({ tone: 'warn', text: `${blockers.length} ${s === 1 ? 'resistance' : 'support'} level${blockers.length > 1 ? 's' : ''} (${blockers.map(f).join(', ')}) before your take profit. Consider taking partial profit there.` });
    else
        checks.push({ tone: 'good', text: 'No swing level blocks the way to your take profit.' });
    if (farAtr > 7)
        checks.push({ tone: 'warn', text: `${tps.length > 1 ? 'TP' + tps.length : 'Target'} is ${farAtr.toFixed(1)} ATR away, so it may take many candles or never arrive.` });
    // 5) Entry location inside your higher / lower range (10 pts)
    let ptsEn = 5;
    if (hi !== undefined && lo !== undefined && isFinite(hi) && isFinite(lo)) {
        if (hi <= lo)
            checks.push({ tone: 'bad', text: 'Higher price must be above lower price.' });
        else {
            const pos = Math.max(0, Math.min(1, (entry - lo) / (hi - lo)));
            ptsEn = 10 * (s === 1 ? 1 - pos : pos);
            const good = s === 1 ? pos <= 0.4 : pos >= 0.6, bad = s === 1 ? pos >= 0.7 : pos <= 0.3;
            checks.push({ tone: good ? 'good' : bad ? 'bad' : 'warn', text: `Entry is ${(pos * 100).toFixed(0)}% up your range. ${s === 1 ? 'Buying near the lower price is best.' : 'Selling near the higher price is best.'}` });
            if (entry < lo || entry > hi)
                checks.push({ tone: 'warn', text: 'Entry is outside your higher / lower range (a breakout entry).' });
            if (s === 1 ? tpF > hi : tpF < lo)
                checks.push({ tone: 'warn', text: `${tps.length > 1 ? 'TP' + tps.length : 'Take profit'} is beyond your ${s === 1 ? 'higher' : 'lower'} price, so it needs a breakout to work.` });
            if (s === 1 ? sl > lo : sl < hi)
                checks.push({ tone: 'warn', text: `Stop loss is inside your range. A normal move to the ${s === 1 ? 'lower' : 'higher'} price would stop you out.` });
        }
    }
    else
        checks.push({ tone: 'warn', text: 'Add higher and lower price to also check the entry location.' });
    // Entry vs current price
    const d = entry - x.price;
    const order = Math.abs(d) <= 0.1 * a ? 'Market entry (at the current price)'
        : s === 1 ? (d < 0 ? 'Buy limit (waiting for a pullback)' : 'Buy stop (breakout entry)') : (d > 0 ? 'Sell limit (waiting for a bounce)' : 'Sell stop (breakout entry)');
    if (Math.abs(d) > 3 * a)
        checks.push({ tone: 'warn', text: `Entry is ${(Math.abs(d) / a).toFixed(1)} ATR from the current price ${f(x.price)}. It may take a long time to trigger.` });
    if (isFinite(x.rsi) && (s === 1 ? x.rsi > 70 : x.rsi < 30))
        checks.push({ tone: 'warn', text: `RSI ${x.rsi.toFixed(0)} is ${s === 1 ? 'overbought' : 'oversold'}. Chasing here is risky. A pullback entry is safer.` });
    // 6) Historical hit rate of the same stop / target distance on this chart
    const test = hitRate(c, s, risk, rewards[0]);
    if (test)
        checks.push({ tone: test.exp > 0.1 ? 'good' : test.exp > -0.1 ? 'warn' : 'bad', text: `On the last ${c.length} candles the same stop and TP1 distance hit the target first ${(test.rate * 100).toFixed(0)}% of the time (${test.win} wins, ${test.loss} losses). Average result ${test.exp >= 0 ? '+' : ''}${test.exp.toFixed(2)}R per trade.` });
    if (tps.length > 1)
        checks.push({ tone: 'good', text: `Ladder: ${rrs.map((v, i) => `TP${i + 1} 1:${v.toFixed(1)}`).join(', ')}. Close ${W.map((v) => v + '%').join(' / ')} and move the stop to break-even after TP1.` });
    // A plan against the market can never be rated better than "needs work", however good its risk:reward looks.
    const score = Math.round(Math.max(0, Math.min(align <= -0.3 ? 55 : 100, ptsCtx + ptsRr + ptsSl + ptsTp + ptsEn)));
    return { side: s === 1 ? 'buy' : 'sell', rr, rrs, risk, reward, slAtr, tpAtr, order, score, verdict: score >= 70 ? 'good' : score >= 45 ? 'okay' : 'weak', ctx: x, checks, test };
}
