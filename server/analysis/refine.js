"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeAll = analyzeAll;
exports.methodsContext = methodsContext;
const ta_1 = require("./ta");
const entry_1 = require("./entry");
const ict_1 = require("./ict");
const smc_1 = require("./smc");
const vsa_1 = require("./vsa");
const patterns_1 = require("./patterns");
const scalp_1 = require("./scalp");
const I = __importStar(require("./indicators"));
const candles_1 = require("./candles");
// Indicator confirmation for a proposed trade: trend strength, momentum, overextension, divergence, golden pocket, blocking levels.
function confirm(c, side, entry, tp1, a) {
    const buy = side === 'buy', cl = c.map((x) => x.c), n = c.length;
    const adx = I.adxSeries(c).adx[n - 1], r = I.rsiSeries(cl)[n - 1], st = I.supertrend(c).dir[n - 1];
    const e200 = I.emaS(cl, 200)[n - 1], div = I.rsiDivergence(c), fib = I.fibonacci(c);
    const mh = I.macdSeries(cl).hist, h1 = mh[n - 1], h0 = mh[n - 2];
    const gold = fib ? (() => { const lo = Math.min(fib.levels.find((l) => l.r === 0.618).price, fib.levels.find((l) => l.r === 0.786).price), hi = Math.max(fib.levels.find((l) => l.r === 0.618).price, fib.levels.find((l) => l.r === 0.786).price); return fib.up === buy && entry >= lo - 0.2 * a && entry <= hi + 0.2 * a; })() : false;
    const blockers = I.supportResistance(c).filter((s) => (buy ? s.price > entry && s.price < tp1 : s.price < entry && s.price > tp1) && s.touches >= 3);
    const checks = [];
    let delta = 0;
    if (I.fin(adx)) {
        const ok = adx >= 20;
        checks.push({ text: ok ? `ADX ${adx.toFixed(0)}: the market is trending` : `ADX ${adx.toFixed(0)}: weak trend, expect chop`, ok });
        delta += ok ? 3 : -3;
    }
    if (I.fin(h1) && I.fin(h0)) {
        const ok = buy ? h1 > h0 : h1 < h0;
        checks.push({ text: `MACD momentum ${ok ? 'agrees' : 'is fading'} (histogram ${h1 > h0 ? 'rising' : 'falling'})`, ok });
        delta += ok ? 3 : -3;
    }
    if (I.fin(r)) {
        const bad = buy ? r > 72 : r < 28;
        checks.push({ text: bad ? `RSI ${r.toFixed(0)} is stretched, a pullback entry is safer` : `RSI ${r.toFixed(0)} leaves room to run`, ok: !bad });
        delta += bad ? -5 : 2;
    }
    if (st === 1 || st === -1) {
        const ok = (st === 1) === buy;
        checks.push({ text: `Supertrend is ${st === 1 ? 'up' : 'down'}`, ok });
        delta += ok ? 2 : -3;
    }
    if (I.fin(e200)) {
        const ok = buy ? entry > e200 : entry < e200;
        checks.push({ text: `Entry is ${entry > e200 ? 'above' : 'below'} the EMA 200 (${ok ? 'with' : 'against'} the big trend)`, ok });
        delta += ok ? 3 : -4;
    }
    if (div) {
        const ok = (div.dir === 'bullish') === buy;
        checks.push({ text: div.text, ok });
        delta += ok ? 5 : -7;
    }
    if (gold) {
        checks.push({ text: 'Entry sits in the Fibonacci golden pocket (61.8 - 78.6%)', ok: true });
        delta += 4;
    }
    if (blockers.length) {
        checks.push({ text: `Strong ${buy ? 'resistance' : 'support'} (${blockers[0].touches} touches) sits before TP1`, ok: false });
        delta -= 4;
    }
    const info = { adx, rsi: r, stAgree: st ? (st === 1) === buy : null, ema200: I.fin(e200) ? (entry > e200 ? 'above' : 'below') : null, div: div?.dir ?? null, golden: gold, blocked: blockers[0]?.price ?? null };
    return { checks, delta, info };
}
// opts.htf = candles of a higher timeframe (for example 1h when analysing 15m). A setup against that trend is capped at grade B.
// The same candles give the ICT method its higher-timeframe bias. opts.ict = ICT rule parameters, opts.news = text when major news is near.
function analyzeAll(c, now = new Date(), opts = {}) {
    const ict = (0, ict_1.ictAnalyze)(c, now, { htf: opts.htf, params: opts.ict, news: opts.news }), smc = (0, smc_1.smcAnalyze)(c, { htf: opts.htf }), vsa = (0, vsa_1.vsaAnalyze)(c), pat = (0, patterns_1.patternsAnalyze)(c), cdl = (0, candles_1.candlesAnalyze)(c), scalp = (0, scalp_1.scalpAnalyze)(c, now, opts);
    const votes = [];
    const sideOf = (d) => (d === 'bullish' || d === 'buy' || d === 'bull' ? 'buy' : d === 'bearish' || d === 'sell' || d === 'bear' ? 'sell' : null);
    const iSide = ict.setup?.side ?? sideOf(ict.trend);
    votes.push({ method: 'ICT', side: ict.ok ? iSide : null, text: !ict.ok ? (ict.reason ?? 'No data') : ict.setup ? `${ict.setup.model}, grade ${ict.setup.grade}` : `Structure ${ict.trend}, no clean POI yet` });
    const sSide = smc.setup?.side ?? sideOf(smc.trend);
    votes.push({ method: 'SMC', side: smc.ok ? sSide : null, text: !smc.ok ? (smc.reason ?? 'No data') : smc.setup ? `${smc.setup.model}, grade ${smc.setup.grade}` : `Swing structure ${smc.trend}, no POI yet` });
    const vSide = vsa.ok ? sideOf(vsa.bias) : null;
    const lastSig = vsa.signals[vsa.signals.length - 1];
    votes.push({ method: 'VSA', side: vSide, text: !vsa.ok ? (vsa.reason ?? 'No data') : `${lastSig ? vsa_1.VSA_NAMES[lastSig.tag] : 'No clear signal'}${vsa.hasVolume ? '' : ' (no volume feed, spread only)'}, score ${vsa.score > 0 ? '+' : ''}${vsa.score}` });
    const p = pat.best;
    votes.push({ method: 'PAT', side: p ? sideOf(p.dir) : null, text: p ? `${p.name} (${p.status})` : pat.ok ? 'No clear pattern' : (pat.reason ?? 'No data') });
    const cb = cdl.best;
    votes.push({ method: 'CDL', side: cb ? sideOf(cb.dir) : null, text: cb ? `${cb.name} (${cb.status === 'confirmed' ? 'confirmed' : 'waiting for confirmation'})` : cdl.ok ? (cdl.last ? `${cdl.last.name} only` : 'No candle pattern') : (cdl.reason ?? 'No data') });
    let buyW = 0, sellW = 0;
    const add = (s, w) => { if (s === 'buy')
        buyW += w;
    else if (s === 'sell')
        sellW += w; };
    add(iSide, ict.setup ? 3 : 1);
    add(sSide, smc.setup ? 3 : 1);
    add(vSide, vsa.setup ? 2 : 1.5);
    add(p ? sideOf(p.dir) : null, p ? (p.status === 'forming' ? 1 : 2) : 0);
    add(cb ? sideOf(cb.dir) : null, cb ? (cb.status === 'confirmed' ? 1.5 : 0.75) : 0);
    const out = { ict, smc, vsa, pat, cdl, scalp, votes };
    if (Math.abs(buyW - sellW) < 2) {
        out.why = 'The methods disagree, so there is no combined entry. Wait for them to line up.';
        return out;
    }
    const side = buyW > sellW ? 'buy' : 'sell', buy = side === 'buy';
    const a = (0, ta_1.atr)(c), price = c[c.length - 1].c;
    // ---- location: ICT and SMC zones (overlap = best), else the strongest single source
    const zi = ict.setup && ict.setup.side === side ? ict.setup : undefined, zs = smc.setup && smc.setup.side === side ? smc.setup : undefined;
    let entry, sl, zTop, zBot, basis, base = 30;
    let overlap = false;
    if (zi && zs) {
        const top = Math.min(zi.zoneTop, zs.zone.top), bot = Math.max(zi.zoneBottom, zs.zone.bottom);
        if (top - bot > 0) {
            overlap = true;
            entry = (top + bot) / 2;
            zTop = top;
            zBot = bot;
            sl = buy ? Math.min(zi.sl, zs.sl) : Math.max(zi.sl, zs.sl);
            basis = 'ICT and SMC zones overlap';
            base = 0.4 * zi.score + 0.4 * zs.score + 12;
        }
        else if (zi.score >= zs.score) {
            entry = zi.entry;
            sl = zi.sl;
            zTop = zi.zoneTop;
            zBot = zi.zoneBottom;
            basis = 'ICT zone (SMC points elsewhere)';
            base = 0.7 * zi.score;
        }
        else {
            entry = zs.entry;
            sl = zs.sl;
            zTop = zs.zone.top;
            zBot = zs.zone.bottom;
            basis = 'SMC zone (ICT points elsewhere)';
            base = 0.7 * zs.score;
        }
    }
    else if (zi) {
        entry = zi.entry;
        sl = zi.sl;
        zTop = zi.zoneTop;
        zBot = zi.zoneBottom;
        basis = 'ICT zone';
        base = 0.7 * zi.score;
    }
    else if (zs) {
        entry = zs.entry;
        sl = zs.sl;
        zTop = zs.zone.top;
        zBot = zs.zone.bottom;
        basis = 'SMC zone';
        base = 0.7 * zs.score;
    }
    else if (pat.setup && pat.setup.side === side) {
        entry = pat.setup.entry;
        sl = pat.setup.sl;
        zTop = Math.max(entry, sl);
        zBot = Math.min(entry, sl);
        basis = `${pat.setup.pattern.name} level`;
        base = 35;
    }
    else if (cdl.setup && cdl.setup.side === side) {
        entry = cdl.setup.entry;
        sl = cdl.setup.sl;
        zTop = Math.max(entry, sl);
        zBot = Math.min(entry, sl);
        basis = `${cdl.setup.pattern.name} candle`;
        base = 32;
    }
    else if (vsa.setup && vsa.setup.side === side) {
        entry = vsa.setup.entry;
        sl = vsa.setup.sl;
        zTop = vsa.setup.zoneTop;
        zBot = vsa.setup.zoneBottom;
        basis = `${vsa_1.VSA_NAMES[vsa.setup.tag]} bar`;
        base = 30;
    }
    else {
        out.why = 'The methods agree on direction but none gives a clean zone to enter from yet.';
        return out;
    }
    const notes = [];
    // ---- refine: snap to a VSA / pattern level that sits inside a wide zone
    if (zTop - zBot > 1.0 * a) {
        const near = [vsa.setup?.side === side ? { v: vsa.setup.entry, n: 'VSA test level' } : null, pat.setup?.side === side ? { v: pat.setup.entry, n: 'pattern level' } : null]
            .filter((x) => !!x && x.v >= zBot && x.v <= zTop).sort((x, y) => Math.abs(x.v - price) - Math.abs(y.v - price))[0];
        if (near) {
            entry = near.v;
            notes.push(`Entry snapped to the ${near.n} inside the zone.`);
        }
    }
    if (Math.abs(entry - sl) < 0.4 * a)
        sl = buy ? entry - 0.4 * a : entry + 0.4 * a;
    // ---- targets: unswept opposite liquidity + range extreme, and the pattern's measured move when it agrees
    const liq = ict.liquidity.filter((l) => !l.swept && (buy ? l.side === 'BSL' : l.side === 'SSL')).map((l) => l.price);
    let tps = (0, ta_1.ladder)(entry, sl, liq, ict.range ? (buy ? ict.range.high : ict.range.low) : undefined);
    const risk = Math.abs(entry - sl), dirS = buy ? 1 : -1;
    if (pat.setup && pat.setup.side === side && (pat.setup.pattern.target - entry) * dirS > (tps[0] - entry) * dirS + 0.3 * risk) {
        const tg = pat.setup.pattern.target;
        const k = Math.abs(tps[1] - tg) <= Math.abs(tps[2] - tg) ? 1 : 2;
        tps[k] = tg;
        tps = tps.sort((x, y) => dirS * (x - y));
        for (let i = 1; i < 3; i++)
            if ((tps[i] - tps[i - 1]) * dirS < 0.3 * risk)
                tps[i] = tps[i - 1] + dirS * 0.5 * risk;
        notes.push('A target uses the chart pattern measured move.');
    }
    const t3 = [tps[0], tps[1], tps[2]];
    const rr = t3.map((v) => Math.abs(v - entry) / risk);
    // ---- confirmation from VSA and the pattern
    let score = base;
    const vsaSame = vSide === side, vsaOpp = vSide !== null && vSide !== side;
    if (vsaSame)
        score += vsa.hasVolume ? 12 : 8;
    else if (vsaOpp)
        score -= 15;
    const patSame = p && sideOf(p.dir) === side, patOpp = p && sideOf(p.dir) !== side;
    if (patSame)
        score += p.status === 'forming' ? 6 : 12;
    else if (patOpp)
        score -= 12;
    const cdlSame = cb && sideOf(cb.dir) === side, cdlOpp = cb && sideOf(cb.dir) !== side;
    if (cdlSame)
        score += cb.status === 'confirmed' ? 8 : 4;
    else if (cdlOpp)
        score -= cb.status === 'confirmed' ? 9 : 5;
    if (ict.killzone && ict.killzone.key !== 'asia')
        score += 4;
    const cf = c.length >= 60 ? confirm(c, side, entry, tps[0], a) : null;
    if (cf) {
        score += cf.delta;
        out.confirm = cf.info;
    }
    // ---- higher timeframe: the strongest single filter. With the bigger trend adds, against it is penalised and capped.
    let htfState, htfCheck = null;
    const hx = opts.htf && opts.htf.length >= 40 ? (0, ta_1.context)(opts.htf) : null;
    if (hx) {
        const al = hx.score * (buy ? 1 : -1);
        htfState = al >= 0.3 ? 'with' : al <= -0.3 ? 'against' : 'neutral';
        if (htfState === 'with') {
            score += 6;
            htfCheck = { text: 'Higher timeframe trend agrees', ok: true };
        }
        else if (htfState === 'against') {
            score -= 14;
            htfCheck = { text: 'Higher timeframe trend is AGAINST this trade', ok: false };
        }
        else
            htfCheck = { text: 'Higher timeframe has no clear trend', ok: false };
    }
    // ---- risk shape: a very wide stop or a thin first target is a worse trade even when the zone is good
    if (risk > 3.5 * a) {
        score -= 8;
        notes.push(`The stop is ${(risk / a).toFixed(1)} ATR wide. Use a smaller lot size.`);
    }
    if (rr[0] < 1.2) {
        score -= 10;
        notes.push('TP1 is close to the entry (risk:reward under 1:1.2). Consider skipping or closing at TP2.');
    }
    // ---- entry plan: is price in the zone, did it react, is the trade already gone
    const fmt = (v) => v.toFixed(Math.abs(price) >= 100 ? 2 : Math.abs(price) >= 10 ? 3 : 5);
    const plan = (0, entry_1.planEntry)(c, side, entry, sl, zTop, zBot, tps[0], a, fmt);
    if (plan.status === 'invalid' || plan.status === 'late') {
        out.why = plan.label + '. ' + plan.trigger;
        return out;
    }
    if (plan.distAtr > 8) {
        out.why = `The nearest zone is ${plan.distAtr.toFixed(0)} ATR away, too far to plan an entry now.`;
        return out;
    }
    if (plan.status === 'enter-now')
        score += 5;
    else if (plan.status === 'far')
        score -= 6;
    if (htfState === 'against')
        score = Math.min(score, 69);
    score = Math.max(0, Math.min(100, Math.round(score)));
    const grade = score >= 85 ? 'A+' : score >= 70 ? 'A' : score >= 50 ? 'B' : 'C';
    const checks = [
        { text: overlap ? 'ICT and SMC zones overlap (highest quality location)' : `Location from ${basis}`, ok: overlap || !!(zi || zs) },
        { text: (zs?.confluence.find((x) => x.key === 'idm')?.text) ?? 'SMC inducement: not available', ok: !!smc.idm && smc.idm.taken },
        { text: vsaSame ? `VSA agrees: ${lastSig ? vsa_1.VSA_NAMES[lastSig.tag] : 'bias ' + vsa.bias}` : vsaOpp ? 'VSA disagrees with this direction' : 'VSA has no clear read', ok: vsaSame },
        { text: patSame ? `Pattern agrees: ${p.name} (${p.status})` : patOpp ? `Pattern disagrees: ${p.name}` : 'No chart pattern confirming', ok: !!patSame },
        { text: cdlSame ? `Candle agrees: ${cb.name} (${cb.status === 'confirmed' ? 'confirmed' : 'not confirmed yet'})` : cdlOpp ? `Candle disagrees: ${cb.name}` : 'No candlestick signal', ok: !!cdlSame },
        { text: `TP1 risk:reward 1:${rr[0].toFixed(1)}`, ok: rr[0] >= 1.4 },
    ];
    if (htfCheck)
        checks.push(htfCheck);
    if (cf) {
        checks.push(...cf.checks);
        if (cf.info.adx < 20)
            notes.push('ADX is below 20: the market is ranging, so use the near targets and smaller size.');
        if (cf.info.blocked !== null)
            notes.push('A strong level sits before TP1. Consider closing more at TP1.');
    }
    if (vsaOpp)
        notes.push('VSA reads the other way. Consider waiting for a test or a smaller size.');
    if (smc.idm && !smc.idm.taken && zs)
        notes.push('SMC inducement is not swept yet: a limit order here can get run first.');
    if (!vsa.hasVolume)
        notes.push('No volume feed for this market: VSA used spread and close position only.');
    notes.unshift(plan.label + '. ' + plan.trigger);
    out.combo = { side, entry, sl, tps: t3, rr, score, grade, zoneTop: zTop, zoneBottom: zBot, basis, checks, notes, plan, htf: htfState };
    return out;
}
// One line of context per method for the Gemini prompt.
function methodsContext(all, f) {
    const { smc, vsa, pat, cdl } = all, out = [];
    if (smc.ok)
        out.push(`SMC: swing ${smc.trend}${smc.swing ? ` last ${smc.swing.kind} ${smc.swing.dir}` : ''}${smc.idm ? `, inducement at ${f(smc.idm.price)} ${smc.idm.taken ? 'taken' : 'pending'}` : ''}${smc.setup ? `, POI ${f(smc.setup.zone.bottom)}-${f(smc.setup.zone.top)} (score ${smc.setup.poiScore}/8, ${smc.setup.ready ? 'all rules pass' : 'rules missing'}) entry ${f(smc.setup.entry)} SL ${f(smc.setup.sl)}` : ''}${smc.bias ? `, bias ${smc.bias.dir}` : ''}`);
    if (vsa.ok)
        out.push(`VSA: ${vsa.hasVolume ? 'with volume' : 'spread only, no volume'}, bias ${vsa.bias}, ${vsa.signals.slice(-3).map((s) => `${vsa_1.VSA_NAMES[s.tag]} ${s.dir}`).join('; ') || 'no signals'}`);
    if (pat.best)
        out.push(`Pattern: ${pat.best.name} ${pat.best.status}, entry ${f(pat.best.entry)} SL ${f(pat.best.sl)} target ${f(pat.best.target)}`);
    if (cdl.best)
        out.push(`Candlestick: ${cdl.best.name} ${cdl.best.dir} ${cdl.best.status}${cdl.setup ? `, entry ${f(cdl.setup.entry)} SL ${f(cdl.setup.sl)}` : ''}`);
    if (all.combo)
        out.push(`Combined refined entry ${all.combo.side} ${f(all.combo.entry)} SL ${f(all.combo.sl)} (${all.combo.basis})`);
    return out.join(' | ');
}
