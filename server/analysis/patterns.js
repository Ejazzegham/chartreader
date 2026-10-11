"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.patternsAnalyze = patternsAnalyze;
const ta_1 = require("./ta");
const at = (l, i) => (l.i2 === l.i1 ? l.p1 : l.p1 + ((l.p2 - l.p1) * (i - l.i1)) / (l.i2 - l.i1));
function fit(pts) {
    const n = pts.length, mx = pts.reduce((s, p) => s + p.i, 0) / n, my = pts.reduce((s, p) => s + p.p, 0) / n;
    const den = pts.reduce((s, p) => s + (p.i - mx) ** 2, 0) || 1;
    const m = pts.reduce((s, p) => s + (p.i - mx) * (p.p - my), 0) / den;
    const i1 = pts[0].i, i2 = pts[n - 1].i;
    return { i1, p1: my + m * (i1 - mx), i2, p2: my + m * (i2 - mx) };
}
function patternsAnalyze(c) {
    const n = c.length, empty = { ok: false, list: [] };
    if (n < 40)
        return { ...empty, reason: 'Need at least 40 candles.' };
    const a = (0, ta_1.atr)(c);
    if (!isFinite(a) || a <= 0)
        return { ...empty, reason: 'No volatility data.' };
    const { hi, lo } = (0, ta_1.pivots)(c, 3);
    const price = c[n - 1].c, last = n - 1;
    const list = [];
    const minLow = (x, y) => { let k = x + 1; for (let j = x + 1; j < y; j++)
        if (c[j].l < c[k].l)
            k = j; return { i: k, p: c[k].l }; };
    const maxHigh = (x, y) => { let k = x + 1; for (let j = x + 1; j < y; j++)
        if (c[j].h > c[k].h)
            k = j; return { i: k, p: c[k].h }; };
    const brokeRecently = (dirDown, neck) => {
        for (let i = last; i >= Math.max(0, last - 15); i--)
            if (dirDown ? c[i].c < neck(i) - 0.1 * a : c[i].c > neck(i) + 0.1 * a)
                return true;
        return false;
    };
    // ---------- double top / bottom
    for (let k = Math.max(0, hi.length - 3); k < hi.length - 1; k++) {
        const h1 = hi[k], h2 = hi[k + 1];
        if (h2.i - h1.i < 6 || Math.abs(h1.p - h2.p) > 0.5 * a || last - h2.i > 35)
            continue;
        const v = minLow(h1.i, h2.i), top = Math.max(h1.p, h2.p);
        if (Math.min(h1.p, h2.p) - v.p < 1.5 * a || price > top + 0.3 * a)
            continue;
        const broke = price < v.p - 0.1 * a && brokeRecently(true, () => v.p), h = top - v.p;
        const status = broke ? 'confirmed' : 'forming';
        list.push({ key: `dt${k}`, name: 'Double top', dir: 'bearish', status, lines: [{ i1: h1.i, p1: v.p, i2: last, p2: v.p, kind: 'neck' }], points: [{ i: h1.i, p: h1.p, label: 'T1' }, { i: h2.i, p: h2.p, label: 'T2' }],
            target: v.p - h, entry: broke ? v.p : v.p - 0.1 * a, sl: top + 0.2 * a, quality: 55 + (broke ? 20 : 0) + (last - h2.i < 15 ? 10 : 0) + (Math.abs(h1.p - h2.p) < 0.25 * a ? 10 : 0), note: broke ? 'Neckline broken: sell the retest of the neckline' : 'Sell on a close below the neckline' });
    }
    for (let k = Math.max(0, lo.length - 3); k < lo.length - 1; k++) {
        const l1 = lo[k], l2 = lo[k + 1];
        if (l2.i - l1.i < 6 || Math.abs(l1.p - l2.p) > 0.5 * a || last - l2.i > 35)
            continue;
        const pk = maxHigh(l1.i, l2.i), bot = Math.min(l1.p, l2.p);
        if (pk.p - Math.max(l1.p, l2.p) < 1.5 * a || price < bot - 0.3 * a)
            continue;
        const broke = price > pk.p + 0.1 * a && brokeRecently(false, () => pk.p), h = pk.p - bot;
        list.push({ key: `db${k}`, name: 'Double bottom', dir: 'bullish', status: broke ? 'confirmed' : 'forming', lines: [{ i1: l1.i, p1: pk.p, i2: last, p2: pk.p, kind: 'neck' }], points: [{ i: l1.i, p: l1.p, label: 'B1' }, { i: l2.i, p: l2.p, label: 'B2' }],
            target: pk.p + h, entry: broke ? pk.p : pk.p + 0.1 * a, sl: bot - 0.2 * a, quality: 55 + (broke ? 20 : 0) + (last - l2.i < 15 ? 10 : 0) + (Math.abs(l1.p - l2.p) < 0.25 * a ? 10 : 0), note: broke ? 'Neckline broken: buy the retest of the neckline' : 'Buy on a close above the neckline' });
    }
    // ---------- head and shoulders / inverse
    for (let k = Math.max(0, hi.length - 3); k < hi.length - 2; k++) {
        const L = hi[k], H = hi[k + 1], R = hi[k + 2];
        if (last - R.i > 35 || H.p - L.p < 0.5 * a || H.p - R.p < 0.5 * a || Math.abs(L.p - R.p) > 1.0 * a)
            continue;
        const t1 = minLow(L.i, H.i), t2 = minLow(H.i, R.i), neck = { i1: t1.i, p1: t1.p, i2: t2.i, p2: t2.p };
        const hh = H.p - at(neck, H.i);
        if (hh < 1.5 * a || price > H.p)
            continue;
        const nl = (i) => at(neck, i), broke = price < nl(last) - 0.1 * a && brokeRecently(true, nl);
        list.push({ key: `hs${k}`, name: 'Head and shoulders', dir: 'bearish', status: broke ? 'confirmed' : 'forming', lines: [{ ...neck, i2: last, p2: nl(last), kind: 'neck' }],
            points: [{ i: L.i, p: L.p, label: 'LS' }, { i: H.i, p: H.p, label: 'H' }, { i: R.i, p: R.p, label: 'RS' }], target: nl(last) - hh, entry: broke ? nl(last) : nl(last) - 0.1 * a, sl: R.p + 0.2 * a,
            quality: 60 + (broke ? 20 : 0) + (last - R.i < 15 ? 10 : 0), note: broke ? 'Neckline broken: sell the retest' : 'Sell on a close below the neckline' });
    }
    for (let k = Math.max(0, lo.length - 3); k < lo.length - 2; k++) {
        const L = lo[k], H = lo[k + 1], R = lo[k + 2];
        if (last - R.i > 35 || L.p - H.p < 0.5 * a || R.p - H.p < 0.5 * a || Math.abs(L.p - R.p) > 1.0 * a)
            continue;
        const p1 = maxHigh(L.i, H.i), p2 = maxHigh(H.i, R.i), neck = { i1: p1.i, p1: p1.p, i2: p2.i, p2: p2.p };
        const hh = at(neck, H.i) - H.p;
        if (hh < 1.5 * a || price < H.p)
            continue;
        const nl = (i) => at(neck, i), broke = price > nl(last) + 0.1 * a && brokeRecently(false, nl);
        list.push({ key: `ihs${k}`, name: 'Inverse head and shoulders', dir: 'bullish', status: broke ? 'confirmed' : 'forming', lines: [{ ...neck, i2: last, p2: nl(last), kind: 'neck' }],
            points: [{ i: L.i, p: L.p, label: 'LS' }, { i: H.i, p: H.p, label: 'H' }, { i: R.i, p: R.p, label: 'RS' }], target: nl(last) + hh, entry: broke ? nl(last) : nl(last) + 0.1 * a, sl: R.p - 0.2 * a,
            quality: 60 + (broke ? 20 : 0) + (last - R.i < 15 ? 10 : 0), note: broke ? 'Neckline broken: buy the retest' : 'Buy on a close above the neckline' });
    }
    // ---------- triangles, wedges, rectangle: fit a line through the recent highs and lows
    const H = hi.filter((p) => p.i >= n - 70).slice(-4), Lw = lo.filter((p) => p.i >= n - 70).slice(-4);
    if (H.length >= 2 && Lw.length >= 2) {
        const up = fit(H), dn = fit(Lw), s0 = Math.min(H[0].i, Lw[0].i);
        const span = last - s0;
        if (span >= 14 && last - Math.max(H[H.length - 1].i, Lw[Lw.length - 1].i) <= 12) {
            const U = (at(up, last) - at(up, s0)) / a, L = (at(dn, last) - at(dn, s0)) / a; // total drift in ATR over the span
            const wS = at(up, s0) - at(dn, s0), wE = at(up, last) - at(dn, last);
            const flat = (v) => Math.abs(v) < 0.7;
            let name = '', dir = null;
            const prior = c[s0].c - c[Math.max(0, s0 - 15)].c, priorDir = prior >= 0 ? 'bullish' : 'bearish';
            const conv = wE < 0.75 * wS && wE > 0.25 * a;
            if (conv && flat(U) && L > 0.8) {
                name = 'Ascending triangle';
                dir = 'bullish';
            }
            else if (conv && flat(L) && U < -0.8) {
                name = 'Descending triangle';
                dir = 'bearish';
            }
            else if (conv && U < -0.6 && L > 0.6) {
                name = 'Symmetrical triangle';
                dir = priorDir;
            }
            else if (conv && U > 0.4 && L > 0.4 && L > U) {
                name = 'Rising wedge';
                dir = 'bearish';
            }
            else if (conv && U < -0.4 && L < -0.4 && U < L) {
                name = 'Falling wedge';
                dir = 'bullish';
            }
            else if (flat(U) && flat(L) && wE > 1.2 * a && wS > 1.2 * a && H.length + Lw.length >= 5) {
                name = 'Rectangle range';
                dir = priorDir;
            }
            if (dir) {
                const uL = at(up, last), lL = at(dn, last);
                const brokeUp = price > uL + 0.1 * a, brokeDn = price < lL - 0.1 * a;
                const status = brokeUp || brokeDn ? 'breakout' : 'forming';
                const d = brokeUp ? 'bullish' : brokeDn ? 'bearish' : dir;
                const buy = d === 'bullish', height = Math.max(wS, a);
                const trig = buy ? uL : lL;
                const entry = status === 'breakout' ? trig : buy ? trig + 0.1 * a : trig - 0.1 * a;
                let sl = buy ? lL - 0.2 * a : uL + 0.2 * a;
                if (Math.abs(entry - sl) < 0.5 * a)
                    sl = buy ? entry - 0.5 * a : entry + 0.5 * a;
                list.push({ key: 'ch', name, dir: d, status, lines: [{ ...up, i2: last, p2: uL, kind: 'upper' }, { ...dn, i2: last, p2: lL, kind: 'lower' }],
                    points: [...H.map((p) => ({ i: p.i, p: p.p, label: '' })), ...Lw.map((p) => ({ i: p.i, p: p.p, label: '' }))],
                    target: buy ? entry + height : entry - height, entry, sl, quality: 45 + 5 * (H.length + Lw.length) + (status === 'breakout' ? 15 : 0) + (d === dir ? 5 : -10),
                    note: status === 'breakout' ? `Broke ${buy ? 'up' : 'down'}: ${buy ? 'buy' : 'sell'} the retest of the broken line` : `Wait for a close ${buy ? 'above the upper' : 'below the lower'} line` });
            }
        }
    }
    list.sort((x, y) => y.quality - x.quality);
    const out = { ok: true, list: list.slice(0, 4) };
    const best = out.list[0];
    if (best) {
        out.best = best;
        const buy = best.dir === 'bullish', risk = Math.abs(best.entry - best.sl);
        const okSide = buy ? best.entry > best.sl : best.entry < best.sl;
        if (okSide && risk >= 0.3 * a && (buy ? price > best.sl : price < best.sl)) {
            // targets follow the pattern's own measured move: 60% of it, all of it, then 1.6x
            const d = Math.abs(best.target - best.entry), sg = buy ? 1 : -1;
            const tps = d >= 0.3 * a ? [best.entry + sg * 0.6 * d, best.entry + sg * d, best.entry + sg * 1.6 * d] : (0, ta_1.ladder)(best.entry, best.sl, [], best.target);
            out.setup = { side: buy ? 'buy' : 'sell', entry: best.entry, sl: best.sl, tps, rr: tps.map((p) => Math.abs(p - best.entry) / risk), pattern: best };
        }
    }
    return out;
}
