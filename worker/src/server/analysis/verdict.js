"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.levelText = exports.spikeSide = exports.MIN_AGREE = exports.MIN_RR = exports.NEAR_ATR = exports.ALERT_MIN = void 0;
exports.judge = judge;
exports.qualify = qualify;
const ta_1 = require("./ta");
const session_1 = require("./session");
const quality_1 = require("./quality");
// =====================================================================================
// Alert gate: the checklist a professional trader runs before taking a setup.
// A setup can be in the list, but it only rings (notification, alarm, push) when ALL of these hold:
//   1. the market is open and the candles are fresh (checked by session.ts before the analysis runs)
//   2. combined score is at least 70% (never lower, whatever the slider says)
//   3. LOCATION: an ICT or SMC zone gives the entry area
//   4. CONFLUENCE: at least 3 of the 5 methods (ICT, SMC, VSA, chart pattern, candlestick) point the same way,
//      and at least one of them is a confirmation method (VSA, pattern or candle), not only a zone
//   5. NOTHING AGAINST: no method disagrees, and the higher timeframe is not against the trade
//   6. TIMING: price is in the zone and reacted (entry now), or is still approaching the zone and within 1 ATR of it (near entry).
//      A zone price already touched and left is not an approach: that trade is running without you, so no alert
//   7. RISK: first target is at least 1:1.4 from the entry (1:1.2 from the current price when entering now)
//   8. no high-impact news around the pair, and not in the thin hour around the weekly close / open
// Pure maths, no imports from the app, so the server scanner uses the same rules.
// =====================================================================================
exports.ALERT_MIN = 70; // no alert below this score
exports.NEAR_ATR = quality_1.QUALITY.nearAtr; // "near the entry" means the zone is within this many ATR of price
exports.MIN_RR = quality_1.QUALITY.tp1R - 0.05; // first target risk:reward measured from the entry (the engine's TP1 is QUALITY.tp1R, rounding can make it a hair less)
exports.MIN_AGREE = 3; // methods that must agree
// Deriv spike pairs. Boom drifts DOWN between its spikes and jumps UP, so only BUY is ever alerted there. Crash drifts UP and jumps DOWN, so only SELL.
// A trade against the spike is never an alert, whatever its score. Because the drift runs against the spike, the "higher timeframe with the trade" and
// "ADX trending" rules cannot be used on these pairs (they would block every BUY on Boom and every SELL on Crash), so they are skipped here.
const spikeSide = (id) => { const m = /^(BOOM|CRASH)\d+N?$/.exec(id ?? ''); return m ? (m[1] === 'BOOM' ? 'buy' : 'sell') : null; };
exports.spikeSide = spikeSide;
const spikeWhy = (id) => ((0, exports.spikeSide)(id) === 'buy' ? 'Boom pairs spike UP: a SELL is never alerted (BUY only).' : 'Crash pairs spike DOWN: a BUY is never alerted (SELL only).');
const sideOf = (d) => (d === 'bullish' || d === 'buy' || d === 'bull' ? 'buy' : d === 'bearish' || d === 'sell' || d === 'bear' ? 'sell' : null);
function judge(all, ctx) {
    const cb = all.combo;
    const v = { level: null, agree: [], oppose: [], blocked: [] };
    if (!cb) {
        v.blocked.push(all.why ?? 'No combined setup.');
        return v;
    }
    const side = cb.side, buy = side === 'buy', p = cb.plan, spike = (0, exports.spikeSide)(ctx.id);
    const c = ctx.c, a = (0, ta_1.atr)(c), price = c[c.length - 1].c;
    // ---- who agrees and who disagrees (only real reads count: a setup, a bias, a pattern, a candle; a bare trend does not)
    const vote = (name, s) => { if (s === side)
        v.agree.push(name);
    else if (s)
        v.oppose.push(name); };
    vote('ICT', all.ict.ok ? sideOf(all.ict.setup?.side) : null);
    vote('SMC', all.smc.ok ? sideOf(all.smc.setup?.side) : null);
    vote('VSA', all.vsa.ok ? sideOf(all.vsa.bias) : null);
    vote('Pattern', all.pat.best ? sideOf(all.pat.best.dir) : null);
    vote('Candle', all.cdl.best ? sideOf(all.cdl.best.dir) : null);
    const need = Math.max(exports.ALERT_MIN, ctx.minProb ?? 0);
    if (cb.score < need)
        v.blocked.push(`Score ${cb.score}% is under the ${need}% needed for an alert.`);
    if (!v.agree.some((m) => m === 'ICT' || m === 'SMC'))
        v.blocked.push('No ICT or SMC zone gives the entry location.');
    if (v.agree.length < exports.MIN_AGREE)
        v.blocked.push(`Only ${v.agree.length} of 5 methods agree (need ${exports.MIN_AGREE}).`);
    else if (!v.agree.some((m) => m === 'VSA' || m === 'Pattern' || m === 'Candle'))
        v.blocked.push('No confirmation from VSA, a chart pattern or a candlestick.');
    if (v.oppose.length)
        v.blocked.push(`${v.oppose.join(', ')} ${v.oppose.length > 1 ? 'point' : 'points'} the other way.`);
    if (spike && side !== spike)
        v.blocked.push(spikeWhy(ctx.id));
    if (cb.htf === 'against' && !spike)
        v.blocked.push('The higher timeframe trend is against this trade.');
    if (cb.rr[0] < exports.MIN_RR - 0.01)
        v.blocked.push(`First target is only 1:${cb.rr[0].toFixed(1)} (need 1:${exports.MIN_RR}).`);
    if (ctx.newsDanger)
        v.blocked.push('High-impact news is due: wait until it passes.');
    const thin = (0, session_1.thinLiquidity)(ctx.id, ctx.cat, ctx.now);
    if (thin)
        v.blocked.push(thin);
    // ---- timing: running (price in the zone and rejected it) or still approaching it and close
    const zTop = cb.zoneTop, zBot = cb.zoneBottom;
    const away = buy ? Math.max(0, price - zTop) : Math.max(0, zBot - price); // distance price still has to travel to reach the zone (0 = inside it)
    const through = buy ? price < zBot - 0.1 * a : price > zTop + 0.1 * a; // beyond the zone, on the stop side
    const touched = c.slice(-10).some((x) => (buy ? x.l <= zTop : x.h >= zBot)); // the zone was reached in the last 10 candles
    if (p.status === 'enter-now') {
        if (p.rrNow < 0.6 * quality_1.QUALITY.tp1R)
            v.blocked.push(`Price moved from the entry: only 1:${p.rrNow.toFixed(1)} left to TP1.`);
    }
    else if (p.status === 'wait-trigger' || p.status === 'limit') {
        if (through)
            v.blocked.push('Price is through the zone: the setup is breaking down.');
        else if (!p.inZone && touched && away > 0.5 * a)
            v.blocked.push('Price already touched the zone and left it: this move is running without you. Wait for a new setup or a return to the zone.');
        else if (!p.inZone && away > exports.NEAR_ATR * a)
            v.blocked.push(`The zone is ${(away / a).toFixed(1)} ATR away (alerts start within ${exports.NEAR_ATR} ATR).`);
    }
    else
        v.blocked.push(p.label + '.');
    if (!v.blocked.length)
        v.level = p.status === 'enter-now' ? 'entry' : 'near';
    return v;
}
const levelText = (l) => (l === 'entry' ? 'Entry now' : l === 'near' ? 'Near entry' : '');
exports.levelText = levelText;
function qualify(all, ctx) {
    const v = judge(all, { ...ctx, minProb: Math.max(ctx.minProb ?? 0, quality_1.QUALITY.minScore) });
    const reasons = [...v.blocked], cb = all.combo;
    if (cb) {
        const buy = cb.side === 'buy', cf = all.confirm, spike = !!(0, exports.spikeSide)(ctx.id); // spike pairs: the drift is against the spike by design, so no trend rules (see spikeSide)
        if (quality_1.QUALITY.requireHtf && cb.htf !== 'with' && !spike)
            reasons.push(cb.htf === undefined ? 'Not enough candles to read the higher timeframe trend.' : cb.htf === 'neutral' ? 'The higher timeframe has no clear trend.' : 'The higher timeframe trend is against this trade.');
        if (cf) {
            if (!spike && isFinite(cf.adx) && cf.adx < quality_1.QUALITY.adxMin)
                reasons.push(`The market is ranging (ADX ${cf.adx.toFixed(0)}, needs ${quality_1.QUALITY.adxMin}).`);
            if (isFinite(cf.rsi) && (buy ? cf.rsi > 72 : cf.rsi < 28))
                reasons.push(`RSI ${cf.rsi.toFixed(0)} is stretched: wait for a pullback.`);
            if (cf.blocked !== null)
                reasons.push('A strong level sits between the entry and the first target.');
        }
        if (all.smc.ok && all.smc.idm && !all.smc.idm.taken && all.smc.setup?.side === cb.side && cb.plan.status !== 'enter-now')
            reasons.push('SMC inducement is not swept yet: a limit order here can be run first.');
    }
    const uniq = [...new Set(reasons)], trade = !!cb && uniq.length === 0;
    return { trade, level: trade ? v.level : null, grade: trade && cb ? (cb.score >= 85 ? 'A+' : 'A') : null, reasons: uniq, verdict: v };
}
