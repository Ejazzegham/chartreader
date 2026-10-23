"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PATTERN_GUIDE = void 0;
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
                name = 'Bearish wedge';
                dir = 'bearish';
            }
            else if (conv && U < -0.4 && L < -0.4 && U < L) {
                name = 'Bullish wedge';
                dir = 'bullish';
            }
            else if (flat(U) && flat(L) && wE > 1.2 * a && wS > 1.2 * a && H.length + Lw.length >= 5) {
                name = 'Rectangle';
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
                list.push({ key: 'ch', name: name === 'Rectangle' ? (buy ? 'Bullish rectangle' : 'Bearish rectangle') : name, dir: d, status, lines: [{ ...up, i2: last, p2: uL, kind: 'upper' }, { ...dn, i2: last, p2: lL, kind: 'lower' }],
                    points: [...H.map((p) => ({ i: p.i, p: p.p, label: '' })), ...Lw.map((p) => ({ i: p.i, p: p.p, label: '' }))],
                    target: buy ? entry + height : entry - height, entry, sl, quality: 45 + 5 * (H.length + Lw.length) + (status === 'breakout' ? 15 : 0) + (d === dir ? 5 : -10),
                    note: status === 'breakout' ? `Broke ${buy ? 'up' : 'down'}: ${buy ? 'buy' : 'sell'} the retest of the broken line` : `Wait for a close ${buy ? 'above the upper' : 'below the lower'} line` });
            }
        }
    }
    // ---------- triple top / bottom: three equal extremes, neckline = the lower valley (peak) between them
    for (let k = Math.max(0, hi.length - 3); k < hi.length - 2; k++) {
        const h1 = hi[k], h2 = hi[k + 1], h3 = hi[k + 2];
        const top = Math.max(h1.p, h2.p, h3.p), flatTop = top - Math.min(h1.p, h2.p, h3.p);
        if (h2.i - h1.i < 5 || h3.i - h2.i < 5 || flatTop > 0.5 * a || last - h3.i > 35)
            continue;
        const v1 = minLow(h1.i, h2.i), v2 = minLow(h2.i, h3.i), neck = Math.min(v1.p, v2.p), h = top - neck;
        if (h < 1.5 * a || Math.abs(v1.p - v2.p) > 1.0 * a || price > top + 0.3 * a)
            continue;
        const broke = price < neck - 0.1 * a && brokeRecently(true, () => neck);
        list.push({ key: `tt${k}`, name: 'Triple top', dir: 'bearish', status: broke ? 'confirmed' : 'forming', lines: [{ i1: h1.i, p1: neck, i2: last, p2: neck, kind: 'neck' }],
            points: [{ i: h1.i, p: h1.p, label: 'T1' }, { i: h2.i, p: h2.p, label: 'T2' }, { i: h3.i, p: h3.p, label: 'T3' }], target: neck - h, entry: broke ? neck : neck - 0.1 * a, sl: top + 0.2 * a,
            quality: 62 + (broke ? 20 : 0) + (last - h3.i < 15 ? 10 : 0) + (flatTop < 0.25 * a ? 5 : 0), note: broke ? 'Neckline broken: sell the retest of the neckline' : 'Sell on a close below the neckline' });
    }
    for (let k = Math.max(0, lo.length - 3); k < lo.length - 2; k++) {
        const l1 = lo[k], l2 = lo[k + 1], l3 = lo[k + 2];
        const bot = Math.min(l1.p, l2.p, l3.p), flatBot = Math.max(l1.p, l2.p, l3.p) - bot;
        if (l2.i - l1.i < 5 || l3.i - l2.i < 5 || flatBot > 0.5 * a || last - l3.i > 35)
            continue;
        const p1 = maxHigh(l1.i, l2.i), p2 = maxHigh(l2.i, l3.i), neck = Math.max(p1.p, p2.p), h = neck - bot;
        if (h < 1.5 * a || Math.abs(p1.p - p2.p) > 1.0 * a || price < bot - 0.3 * a)
            continue;
        const broke = price > neck + 0.1 * a && brokeRecently(false, () => neck);
        list.push({ key: `tb${k}`, name: 'Triple bottom', dir: 'bullish', status: broke ? 'confirmed' : 'forming', lines: [{ i1: l1.i, p1: neck, i2: last, p2: neck, kind: 'neck' }],
            points: [{ i: l1.i, p: l1.p, label: 'B1' }, { i: l2.i, p: l2.p, label: 'B2' }, { i: l3.i, p: l3.p, label: 'B3' }], target: neck + h, entry: broke ? neck : neck + 0.1 * a, sl: bot - 0.2 * a,
            quality: 62 + (broke ? 20 : 0) + (last - l3.i < 15 ? 10 : 0) + (flatBot < 0.25 * a ? 5 : 0), note: broke ? 'Neckline broken: buy the retest of the neckline' : 'Buy on a close above the neckline' });
    }
    // ---------- flags and pennants: a sharp pole, then a small counter-trend channel (flag) or a small triangle (pennant).
    // Written once in "bull space" (price flipped for the bear versions) and converted back at the end.
    const pv2 = (0, ta_1.pivots)(c, 2);
    const flagScan = (bull) => {
        const sg = bull ? 1 : -1;
        const Hh = (i) => (bull ? c[i].h : -c[i].l), Ll = (i) => (bull ? c[i].l : -c[i].h);
        const hp = (bull ? pv2.hi : pv2.lo).map((p) => ({ i: p.i, p: sg * p.p })), lp = (bull ? pv2.lo : pv2.hi).map((p) => ({ i: p.i, p: sg * p.p }));
        let pi = -1;
        for (let i = Math.max(20, last - 32); i <= last - 6; i++)
            if (pi < 0 || Hh(i) > Hh(pi))
                pi = i;
        if (pi < 0)
            return;
        const top = Hh(pi);
        let si = Math.max(0, pi - 20);
        for (let i = si; i < pi; i++)
            if (Ll(i) < Ll(si))
                si = i;
        const poleH = top - Ll(si);
        if (poleH < 3 * a || pi - si < 3 || poleH / (pi - si) < 0.3 * a)
            return; // not an impulsive pole
        let consLow = Infinity;
        for (let i = pi + 1; i <= last; i++)
            consLow = Math.min(consLow, Ll(i));
        if (consLow < Ll(si) + 0.5 * poleH)
            return; // retraced more than half of the pole
        const upPts = [{ i: pi, p: top }, ...hp.filter((p) => p.i > pi)], dnPts = lp.filter((p) => p.i > pi);
        if (upPts.length < 2 || dnPts.length < 2)
            return;
        const up = fit(upPts), dn = fit(dnPts);
        const wS = at(up, pi) - at(dn, pi), wE = at(up, last) - at(dn, last);
        const U = (at(up, last) - at(up, pi)) / a, L = (at(dn, last) - at(dn, pi)) / a;
        if (wS < 0.3 * a || wE < 0.2 * a)
            return;
        const isFlag = U <= -0.15 && L <= -0.15 && wE / wS >= 0.7 && wE / wS <= 1.35;
        const isPennant = !isFlag && wE < 0.7 * wS && U < -0.2 && L > -0.1;
        if (!isFlag && !isPennant)
            return;
        const uL = at(up, last), lL = at(dn, last), px = sg * price;
        if (px < lL - 0.1 * a || px > top + 0.5 * poleH)
            return; // flag failed, or the move is already spent
        const broke = px > uL + 0.1 * a;
        const entry = broke ? uL : uL + 0.1 * a;
        let sl = lL - 0.2 * a;
        if (entry - sl < 0.5 * a)
            sl = entry - 0.5 * a;
        const name = isFlag ? (bull ? 'Bull flag' : 'Bearish flag') : bull ? 'Bullish pennant' : 'Bearish pennant';
        list.push({ key: (bull ? 'b' : 's') + (isFlag ? 'f' : 'p'), name, dir: bull ? 'bullish' : 'bearish', status: broke ? 'breakout' : 'forming',
            lines: [{ i1: si, p1: sg * Ll(si), i2: pi, p2: sg * top, kind: 'neck' }, { i1: pi, p1: sg * at(up, pi), i2: last, p2: sg * uL, kind: bull ? 'upper' : 'lower' }, { i1: pi, p1: sg * at(dn, pi), i2: last, p2: sg * lL, kind: bull ? 'lower' : 'upper' }],
            points: [{ i: si, p: sg * Ll(si), label: 'Pole' }, { i: pi, p: sg * top, label: '' }],
            target: sg * (entry + poleH), entry: sg * entry, sl: sg * sl,
            quality: 55 + (poleH >= 4 * a ? 8 : 0) + (broke ? 15 : 0) + (dnPts.length >= 3 ? 4 : 0) + (last - pi <= 20 ? 3 : 0),
            note: broke ? `Broke ${bull ? 'up' : 'down'}: ${bull ? 'buy' : 'sell'} the retest of the ${isFlag ? 'flag' : 'pennant'} line. Target = the pole height` : `Wait for a close ${bull ? 'above' : 'below'} the ${isFlag ? 'flag' : 'pennant'}. Target = the pole height` });
    };
    flagScan(true);
    flagScan(false);
    // ---------- cup and handle / inverse, rounding bottom / top: a rounded U (or dome) between two rims at the same level.
    // With a handle (small pullback after the right rim) it is a cup and handle; without, a rounding bottom / top.
    const cupScan = (bull, handle) => {
        const sg = bull ? 1 : -1;
        const Hh = (i) => (bull ? c[i].h : -c[i].l), Ll = (i) => (bull ? c[i].l : -c[i].h), Cc = (i) => sg * c[i].c;
        const rims = (bull ? hi : lo).map((p) => ({ i: p.i, p: sg * p.p }));
        const minW = handle ? 15 : 30, tolRim = handle ? 0.8 : 0.6, minDepth = handle ? 3 : 3.5, minMid = handle ? 0.6 : 0.7, maxAge = handle ? 40 : 15;
        let best = null;
        for (let kr = Math.max(1, rims.length - 3); kr < rims.length; kr++) {
            const R = rims[kr];
            if (last - R.i > maxAge)
                continue;
            for (let kl = 0; kl < kr; kl++) {
                const Lm = rims[kl], width = R.i - Lm.i;
                if (width < minW || width > 150 || Math.abs(Lm.p - R.p) > tolRim * a)
                    continue;
                const rim = Math.max(Lm.p, R.p);
                let bi = Lm.i + 1, mx = -Infinity;
                for (let i = Lm.i + 1; i < R.i; i++) {
                    if (Ll(i) < Ll(bi))
                        bi = i;
                    mx = Math.max(mx, Hh(i));
                }
                const bot = Ll(bi), depth = rim - bot;
                if (depth < minDepth * a || mx > rim + 0.3 * a)
                    continue; // too shallow, or something poked above the rims
                const where = (bi - Lm.i) / width;
                if (where < 0.25 || where > 0.75)
                    continue; // the bottom must sit near the middle
                let mid = 0, midN = 0, low = 0;
                for (let i = Lm.i; i <= R.i; i++) {
                    if (Ll(i) <= bot + 0.45 * depth)
                        low++;
                    if (i >= Lm.i + width / 3 && i <= R.i - width / 3) {
                        midN++;
                        if (Ll(i) <= bot + 0.45 * depth)
                            mid++;
                    }
                }
                if (midN === 0 || mid / midN < minMid || low / (width + 1) < 0.3)
                    continue; // V shape, not a rounded base
                let hl = Infinity;
                for (let i = R.i + 1; i <= last; i++)
                    hl = Math.min(hl, Ll(i));
                if (!isFinite(hl))
                    continue;
                if (handle && (hl < bot + 0.5 * depth || last - R.i > Math.max(10, width * 0.5)))
                    continue; // handle must stay in the upper half
                const px = sg * price;
                if (px < bot + 0.5 * depth || px > rim + 0.8 * depth)
                    continue;
                let broke = false;
                for (let i = last; i >= Math.max(0, last - 15); i--)
                    if (Cc(i) > rim + 0.1 * a) {
                        broke = true;
                        break;
                    }
                broke = broke && px > rim + 0.1 * a;
                const entry = broke ? rim : rim + 0.1 * a;
                let rs = hl; // no handle: the low of the last 15% of the base
                if (!handle)
                    for (let i = Math.max(Lm.i, R.i - Math.round(width * 0.15)); i <= R.i; i++)
                        rs = Math.min(rs, Ll(i));
                let sl = rs - 0.2 * a;
                if (entry - sl < 0.5 * a)
                    sl = entry - 0.5 * a;
                const name = handle ? (bull ? 'Cup and handle' : 'Inverse cup and handle') : bull ? 'Rounding bottom' : 'Rounding top';
                const q = 58 + (broke ? 20 : 0) + (handle ? 5 : 0) + (mid / midN >= 0.75 ? 5 : 0) + (depth >= 3.5 * a ? 4 : 0) + (last - R.i < 15 ? 4 : 0);
                if (best && best.quality >= q)
                    continue;
                best = { key: (bull ? 'c' : 'ic') + (handle ? 'h' : 'r'), name, dir: bull ? 'bullish' : 'bearish', status: broke ? 'confirmed' : 'forming',
                    lines: [{ i1: Lm.i, p1: sg * rim, i2: last, p2: sg * rim, kind: 'neck' }],
                    points: [{ i: Lm.i, p: sg * Lm.p, label: 'L' }, { i: bi, p: sg * bot, label: 'B' }, { i: R.i, p: sg * R.p, label: 'R' }],
                    target: sg * (entry + depth), entry: sg * entry, sl: sg * sl, quality: q,
                    note: broke ? `Rim broken: ${bull ? 'buy' : 'sell'} the retest of the rim. Target = the depth of the ${handle ? 'cup' : 'base'}` : `Wait for a close ${bull ? 'above' : 'below'} the rim${handle ? ' after the handle' : ''}. Target = the depth of the ${handle ? 'cup' : 'base'}` };
            }
        }
        if (best)
            list.push(best);
    };
    cupScan(true, true);
    cupScan(false, true);
    cupScan(true, false);
    cupScan(false, false);
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
exports.PATTERN_GUIDE = [
    { name: 'Head and shoulders', dir: 'bearish', kind: 'Reversal', shows: 'Three highs, the middle one (head) the highest, the two shoulders about equal. The neckline joins the two lows between them.', trade: 'Sell on a close below the neckline (or its retest). Stop above the right shoulder. Target = the head-to-neckline height projected down.' },
    { name: 'Inverse head and shoulders', dir: 'bullish', kind: 'Reversal', shows: 'Three lows, the middle one (head) the lowest. The neckline joins the two highs between them.', trade: 'Buy on a close above the neckline (or its retest). Stop below the right shoulder. Target = the head-to-neckline height projected up.' },
    { name: 'Double top', dir: 'bearish', kind: 'Reversal', shows: 'Two equal highs with a valley between them after an uptrend.', trade: 'Sell when price closes below the valley (neckline). Stop above the highs. Target = the height of the pattern projected down.' },
    { name: 'Double bottom', dir: 'bullish', kind: 'Reversal', shows: 'Two equal lows with a peak between them after a downtrend.', trade: 'Buy when price closes above the peak (neckline). Stop below the lows. Target = the height of the pattern projected up.' },
    { name: 'Triple top', dir: 'bearish', kind: 'Reversal', shows: 'Three equal highs that all fail at the same resistance. The neckline is the lower of the two valleys.', trade: 'Sell on a close below the neckline. Stop above the three highs. Target = the pattern height projected down.' },
    { name: 'Triple bottom', dir: 'bullish', kind: 'Reversal', shows: 'Three equal lows that all hold at the same support. The neckline is the higher of the two peaks.', trade: 'Buy on a close above the neckline. Stop below the three lows. Target = the pattern height projected up.' },
    { name: 'Descending triangle', dir: 'bearish', kind: 'Continuation', shows: 'A flat support line with lower highs pressing on it.', trade: 'Sell on a close below the flat support. Stop above the last lower high. Target = the widest part of the triangle projected down.' },
    { name: 'Ascending triangle', dir: 'bullish', kind: 'Continuation', shows: 'A flat resistance line with higher lows pushing into it.', trade: 'Buy on a close above the flat resistance. Stop below the last higher low. Target = the widest part of the triangle projected up.' },
    { name: 'Bearish flag', dir: 'bearish', kind: 'Continuation', shows: 'A sharp drop (the pole), then a small rising channel that retraces less than half of it.', trade: 'Sell on a close below the lower flag line. Stop above the flag. Target = the pole height projected down from the break.' },
    { name: 'Bull flag', dir: 'bullish', kind: 'Continuation', shows: 'A sharp rise (the pole), then a small falling channel that retraces less than half of it.', trade: 'Buy on a close above the upper flag line. Stop below the flag. Target = the pole height projected up from the break.' },
    { name: 'Bearish pennant', dir: 'bearish', kind: 'Continuation', shows: 'A sharp drop, then a small symmetrical triangle with the lines closing in.', trade: 'Sell on a close below the lower pennant line. Stop above the pennant. Target = the pole height projected down.' },
    { name: 'Bullish pennant', dir: 'bullish', kind: 'Continuation', shows: 'A sharp rise, then a small symmetrical triangle with the lines closing in.', trade: 'Buy on a close above the upper pennant line. Stop below the pennant. Target = the pole height projected up.' },
    { name: 'Bearish wedge', dir: 'bearish', kind: 'Reversal', shows: 'Two rising lines that close in: the rises get smaller, buyers are tiring.', trade: 'Sell on a close below the lower line. Stop above the last high. Target = the widest part of the wedge projected down.' },
    { name: 'Bullish wedge', dir: 'bullish', kind: 'Reversal', shows: 'Two falling lines that close in: the drops get smaller, sellers are tiring.', trade: 'Buy on a close above the upper line. Stop below the last low. Target = the widest part of the wedge projected up.' },
    { name: 'Bearish rectangle', dir: 'bearish', kind: 'Continuation', shows: 'Price moves sideways between a flat support and a flat resistance after a downtrend.', trade: 'Sell on a close below the support. Stop above the resistance. Target = the height of the rectangle projected down.' },
    { name: 'Bullish rectangle', dir: 'bullish', kind: 'Continuation', shows: 'Price moves sideways between a flat support and a flat resistance after an uptrend.', trade: 'Buy on a close above the resistance. Stop below the support. Target = the height of the rectangle projected up.' },
    { name: 'Inverse cup and handle', dir: 'bearish', kind: 'Reversal', shows: 'A rounded dome between two highs at the same level, then a small bounce (the handle) that stays in the lower half of the dome.', trade: 'Sell on a close below the rim after the handle. Stop above the handle. Target = the depth of the dome projected down.' },
    { name: 'Cup and handle', dir: 'bullish', kind: 'Reversal', shows: 'A rounded U between two highs at the same level, then a small pullback (the handle) that stays in the upper half of the cup.', trade: 'Buy on a close above the rim after the handle. Stop below the handle. Target = the depth of the cup projected up.' },
    { name: 'Rounding top', dir: 'bearish', kind: 'Reversal', shows: 'A slow, rounded dome: buyers fade little by little until sellers take over.', trade: 'Sell on a close below the rim (the level where the dome began). Stop above the last high. Target = the dome height projected down.' },
    { name: 'Rounding bottom', dir: 'bullish', kind: 'Reversal', shows: 'A slow, rounded saucer: sellers fade little by little until buyers take over.', trade: 'Buy on a close above the rim (the level where the saucer began). Stop below the last low. Target = the saucer depth projected up.' },
    { name: 'Symmetrical triangle', dir: 'either', kind: 'Continuation', shows: 'Lower highs and higher lows closing in. It usually breaks in the direction of the trend before it (bullish or bearish).', trade: 'Trade the side that breaks: close above the upper line to buy, below the lower line to sell. Stop on the other side. Target = the widest part of the triangle.' },
];
