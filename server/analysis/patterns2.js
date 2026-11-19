"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.specialPatterns = specialPatterns;
const at = (l, i) => (l.i2 === l.i1 ? l.p1 : l.p1 + ((l.p2 - l.p1) * (i - l.i1)) / (l.i2 - l.i1));
function fit(pts) {
    const n = pts.length, mx = pts.reduce((s, p) => s + p.i, 0) / n, my = pts.reduce((s, p) => s + p.p, 0) / n;
    const den = pts.reduce((s, p) => s + (p.i - mx) ** 2, 0) || 1;
    const m = pts.reduce((s, p) => s + (p.i - mx) * (p.p - my), 0) / den;
    const i1 = pts[0].i, i2 = pts[n - 1].i;
    return { i1, p1: my + m * (i1 - mx), i2, p2: my + m * (i2 - mx) };
}
const Q = (q) => Math.max(25, Math.min(97, Math.round(q)));
function specialPatterns(c, a, hi, lo) {
    const n = c.length, last = n - 1, price = c[last].c, out = [];
    const recent = (down, lvl, from = 0) => {
        for (let i = last; i >= Math.max(from, last - 15); i--)
            if (down ? c[i].c < lvl(i) - 0.1 * a : c[i].c > lvl(i) + 0.1 * a)
                return true;
        return false;
    };
    const rangeOf = (x, y) => { let h = -Infinity, l = Infinity; for (let i = Math.max(0, x); i <= Math.min(last, y); i++) {
        h = Math.max(h, c[i].h);
        l = Math.min(l, c[i].l);
    } return h - l; };
    // ---------- rising / falling channel: two parallel, clearly sloped lines with at least five touches
    {
        const H = hi.filter((p) => p.i >= n - 90).slice(-4), Lw = lo.filter((p) => p.i >= n - 90).slice(-4);
        if (H.length >= 2 && Lw.length >= 2 && H.length + Lw.length >= 5) {
            const up = fit(H), dn = fit(Lw), s0 = Math.min(H[0].i, Lw[0].i), span = last - s0;
            const U = (at(up, last) - at(up, s0)) / a, D = (at(dn, last) - at(dn, s0)) / a;
            const wS = at(up, s0) - at(dn, s0), wE = at(up, last) - at(dn, last);
            const resid = Math.max(...H.map((p) => Math.abs(p.p - at(up, p.i))), ...Lw.map((p) => Math.abs(p.p - at(dn, p.i))));
            const parallel = wS > 1.5 * a && wE > 1.5 * a && wE / wS > 0.8 && wE / wS < 1.25 && resid < 0.8 * a;
            const rising = U > 1.5 && D > 1.5, falling = U < -1.5 && D < -1.5;
            if (span >= 20 && parallel && (rising || falling) && last - Math.max(H[H.length - 1].i, Lw[Lw.length - 1].i) <= 12) {
                const uL = at(up, last), lL = at(dn, last), mid = { i1: s0, p1: (at(up, s0) + at(dn, s0)) / 2, i2: last, p2: (uL + lL) / 2 };
                const brokeAgainst = rising ? price < lL - 0.1 * a : price > uL + 0.1 * a; // the channel broke against its slope
                const overshoot = rising ? price > uL + 0.1 * a : price < lL - 0.1 * a; // ran out of the channel with its slope: no entry
                if (!overshoot) {
                    const buy = brokeAgainst ? !rising : rising, w = Math.max(wE, a);
                    const entry = brokeAgainst ? (rising ? lL : uL) : buy ? lL + 0.15 * a : uL - 0.15 * a;
                    const sl = brokeAgainst ? (buy ? uL - Math.max(0.25 * w, 0.6 * a) : lL + Math.max(0.25 * w, 0.6 * a)) : buy ? lL - 0.5 * a : uL + 0.5 * a;
                    const target = brokeAgainst ? (buy ? entry + w : entry - w) : buy ? uL - 0.1 * a : lL + 0.1 * a;
                    out.push({ key: rising ? 'chu' : 'chd', name: rising ? 'Rising channel' : 'Falling channel', family: 'Continuation', dir: buy ? 'bullish' : 'bearish', status: brokeAgainst ? 'breakout' : 'forming',
                        lines: [{ ...up, i2: last, p2: uL, kind: 'upper' }, { ...dn, i2: last, p2: lL, kind: 'lower' }, { ...mid, kind: 'mid' }],
                        points: [...H.map((p) => ({ i: p.i, p: p.p, label: '' })), ...Lw.map((p) => ({ i: p.i, p: p.p, label: '' }))],
                        target, entry, sl, quality: Q(46 + 5 * (H.length + Lw.length) + (brokeAgainst ? 12 : 0) + (resid < 0.4 * a ? 6 : 0)),
                        note: brokeAgainst ? `Channel broke ${rising ? 'down' : 'up'}: ${buy ? 'buy' : 'sell'} the retest of the broken line` : buy ? 'Buy the bounce at the lower channel line, stop under it. Target = the upper line' : 'Sell the rejection at the upper channel line, stop above it. Target = the lower line' });
                }
            }
        }
    }
    // ---------- broadening top / bottom and megaphone: highs keep rising, lows keep falling (five touches)
    {
        const H = hi.filter((p) => p.i >= n - 80).slice(-4), Lw = lo.filter((p) => p.i >= n - 80).slice(-4);
        if (H.length >= 2 && Lw.length >= 2 && H.length + Lw.length >= 5) {
            const up = fit(H), dn = fit(Lw), s0 = Math.min(H[0].i, Lw[0].i), span = last - s0;
            const U = (at(up, last) - at(up, s0)) / a, D = (at(dn, last) - at(dn, s0)) / a;
            const wS = at(up, s0) - at(dn, s0), wE = at(up, last) - at(dn, last);
            const hiUp = H.every((p, k) => k === 0 || p.p > H[k - 1].p - 0.1 * a), loDn = Lw.every((p, k) => k === 0 || p.p < Lw[k - 1].p + 0.1 * a);
            if (span >= 20 && U > 0.8 && D < -0.8 && hiUp && loDn && wS > 0.3 * a && wE > 1.4 * wS && last - Math.max(H[H.length - 1].i, Lw[Lw.length - 1].i) <= 12) {
                const uL = at(up, last), lL = at(dn, last), prior = c[s0].c - c[Math.max(0, s0 - 20)].c;
                const kind = prior >= 1.5 * a ? 'top' : prior <= -1.5 * a ? 'bottom' : 'mega';
                const lastH = H[H.length - 1].p, lastL = Lw[Lw.length - 1].p, eq = (uL + lL) / 2;
                let buy, status = 'forming', entry, sl, target, note;
                if (kind === 'mega') {
                    const above = price > uL + 0.1 * a, below = price < lL - 0.1 * a;
                    if (above || below) {
                        buy = above;
                        status = 'breakout';
                        entry = above ? uL : lL;
                        sl = buy ? entry - Math.max(0.5 * wE, a) : entry + Math.max(0.5 * wE, a);
                        target = buy ? entry + wE : entry - wE;
                        note = `Broke ${buy ? 'up' : 'down'} out of the megaphone: ${buy ? 'buy' : 'sell'} the retest of the band`;
                    }
                    else {
                        buy = price < eq;
                        entry = buy ? lL + 0.1 * a : uL - 0.1 * a;
                        sl = buy ? lL - 0.6 * a : uL + 0.6 * a;
                        target = buy ? uL - 0.1 * a : lL + 0.1 * a;
                        note = `Price is at the ${buy ? 'lower' : 'upper'} band: ${buy ? 'buy' : 'sell'} a rejection candle there. A close beyond the band means the breakout trade instead`;
                    }
                }
                else {
                    buy = kind === 'bottom';
                    const trig = buy ? uL : lL, broke = buy ? price > trig + 0.1 * a && recent(false, () => trig) : price < trig - 0.1 * a && recent(true, () => trig);
                    status = broke ? 'confirmed' : 'forming';
                    entry = broke ? trig : buy ? trig + 0.1 * a : trig - 0.1 * a;
                    sl = buy ? Math.min(lastL, lL) - 0.2 * a : Math.max(lastH, uL) + 0.2 * a;
                    if (Math.abs(entry - sl) < 0.5 * a)
                        sl = buy ? entry - 0.5 * a : entry + 0.5 * a;
                    target = buy ? entry + wE : entry - wE;
                    note = broke ? `Band broken: ${buy ? 'buy' : 'sell'} the retest of the ${buy ? 'upper' : 'lower'} line` : `Wait for a close ${buy ? 'above the upper' : 'below the lower'} line. Target = the width of the formation`;
                }
                out.push({ key: kind === 'top' ? 'bdt' : kind === 'bottom' ? 'bdb' : 'mg', name: kind === 'top' ? 'Broadening top' : kind === 'bottom' ? 'Broadening bottom' : 'Megaphone pattern', family: 'Special', dir: buy ? 'bullish' : 'bearish', status,
                    lines: [{ ...up, i2: last, p2: uL, kind: 'upper' }, { ...dn, i2: last, p2: lL, kind: 'lower' }],
                    points: [...H.map((p) => ({ i: p.i, p: p.p, label: '' })), ...Lw.map((p) => ({ i: p.i, p: p.p, label: '' }))],
                    target, entry, sl, quality: Q((kind === 'mega' ? 40 : 48) + 4 * (H.length + Lw.length) + (status !== 'forming' ? 14 : 0)), note });
            }
        }
    }
    // ---------- diamond top / bottom: the range widens to a peak and a trough, then narrows again
    {
        const W = Math.min(100, n), w0 = n - W;
        const hW = hi.filter((p) => p.i >= w0), lW = lo.filter((p) => p.i >= w0);
        if (W >= 50 && hW.length >= 3 && lW.length >= 3) {
            const m0 = w0 + W * 0.25, m1 = w0 + W * 0.8;
            const pk = hW.filter((p) => p.i >= m0 && p.i <= m1).sort((x, y) => y.p - x.p)[0], tr = lW.filter((p) => p.i >= m0 && p.i <= m1).sort((x, y) => x.p - y.p)[0];
            if (pk && tr && Math.abs(pk.i - tr.i) <= 0.3 * W && pk.p - tr.p >= 3 * a) {
                const mA = Math.min(pk.i, tr.i), mB = Math.max(pk.i, tr.i), H = pk.p - tr.p;
                const lh = hW.filter((p) => p.i < mA - 2), ll = lW.filter((p) => p.i < mA - 2), rh = hW.filter((p) => p.i > mB + 2), rl = lW.filter((p) => p.i > mB + 2);
                const mono = (arr, up) => arr.every((p, k) => k === 0 || (up ? p.p >= arr[k - 1].p - 0.3 * a : p.p <= arr[k - 1].p + 0.3 * a));
                if (lh.length && ll.length && rh.length && rl.length
                    && lh.every((p) => p.p < pk.p - 0.3 * a) && ll.every((p) => p.p > tr.p + 0.3 * a) && rh.every((p) => p.p < pk.p - 0.3 * a) && rl.every((p) => p.p > tr.p + 0.3 * a)
                    && mono(lh, true) && mono(ll, false) && mono(rh, false) && mono(rl, true)) {
                    const sI = Math.min(lh[0].i, ll[0].i), eI = Math.max(rh[rh.length - 1].i, rl[rl.length - 1].i);
                    const prior = c[sI].c - c[Math.max(0, sI - 25)].c, top = prior >= 2 * a, bottom = prior <= -2 * a;
                    if ((top || bottom) && rangeOf(sI - 2, sI + 8) < 0.6 * H && rangeOf(last - 8, last) < 0.75 * H && last - eI <= 20 && price > tr.p - 1.5 * a && price < pk.p + 0.5 * a) {
                        const left = { i: sI, p: (lh[0].p + ll[0].p) / 2 }, right = { i: eI, p: (rh[rh.length - 1].p + rl[rl.length - 1].p) / 2 };
                        const edge = top ? { i1: tr.i, p1: tr.p, i2: eI, p2: right.p } : { i1: pk.i, p1: pk.p, i2: eI, p2: right.p }; // the right-hand edge that must break
                        if (eI - edge.i1 >= 3) {
                            const trig = (i) => at(edge, i), tl = trig(last);
                            const broke = top ? price < tl - 0.1 * a && recent(true, trig) : price > tl + 0.1 * a && recent(false, trig);
                            const entry = broke ? tl : top ? tl - 0.1 * a : tl + 0.1 * a;
                            let sl = top ? Math.max(...rh.map((p) => p.p)) + 0.2 * a : Math.min(...rl.map((p) => p.p)) - 0.2 * a;
                            if (Math.abs(entry - sl) < 0.5 * a)
                                sl = top ? entry + 0.5 * a : entry - 0.5 * a;
                            out.push({ key: top ? 'dmt' : 'dmb', name: top ? 'Diamond top' : 'Diamond bottom', family: 'Reversal', dir: top ? 'bearish' : 'bullish', status: broke ? 'confirmed' : 'forming',
                                lines: [{ i1: edge.i1, p1: edge.p1, i2: last, p2: tl, kind: 'neck' }],
                                poly: [left, { i: pk.i, p: pk.p }, right, { i: tr.i, p: tr.p }],
                                points: [{ i: pk.i, p: pk.p, label: '' }, { i: tr.i, p: tr.p, label: '' }, ...lh.map((p) => ({ i: p.i, p: p.p, label: '' })), ...ll.map((p) => ({ i: p.i, p: p.p, label: '' })), ...rh.map((p) => ({ i: p.i, p: p.p, label: '' })), ...rl.map((p) => ({ i: p.i, p: p.p, label: '' }))],
                                target: top ? entry - H : entry + H, entry, sl, quality: Q(55 + (broke ? 20 : 0) + (last - eI < 12 ? 6 : 0) + (H >= 4 * a ? 4 : 0)),
                                note: broke ? `Edge broken: ${top ? 'sell' : 'buy'} the retest of the ${top ? 'lower' : 'upper'} right-hand edge` : `Wait for a close ${top ? 'below the lower' : 'above the upper'} right-hand edge. Target = the height of the diamond` });
                        }
                    }
                }
            }
        }
    }
    // ---------- island reversal: a cluster of candles cut off from the trend by a gap on each side (gaps relaxed to 0.2 ATR for 24h markets)
    for (let j = Math.max(7, n - 24); j <= last - 1; j++) {
        for (const bear of [true, false]) {
            const gapIn = bear ? c[j].l > c[j - 1].h + 0.2 * a : c[j].h < c[j - 1].l - 0.2 * a;
            if (!gapIn)
                continue;
            let legLo = Infinity, legHi = -Infinity;
            for (let i = Math.max(0, j - 14); i < j; i++) {
                legLo = Math.min(legLo, c[i].l);
                legHi = Math.max(legHi, c[i].h);
            }
            if (bear ? c[j - 1].c - legLo < 2 * a : legHi - c[j - 1].c < 2 * a)
                continue; // there must be a trend to reverse
            let cl = bear ? Infinity : -Infinity, ch = bear ? -Infinity : Infinity, k = -1;
            for (let m = j; m <= Math.min(last, j + 10); m++) {
                if (m > j && (bear ? c[m].h < cl - 0.2 * a : c[m].l > cl + 0.2 * a) && (bear ? cl > c[j - 1].h : cl < c[j - 1].l)) {
                    k = m;
                    break;
                }
                if (bear) {
                    cl = Math.min(cl, c[m].l);
                    ch = Math.max(ch, c[m].h);
                }
                else {
                    cl = Math.max(cl, c[m].h);
                    ch = Math.min(ch, c[m].l);
                }
            }
            if (k < 0 || (bear ? cl <= c[j - 1].h : cl >= c[j - 1].l) || last - k > 12)
                continue;
            // bear: cl = island low, ch = island high. bull: cl = island high, ch = island low.
            const isl = bear ? { top: ch, bottom: cl } : { top: cl, bottom: ch };
            if (bear ? price > isl.top : price < isl.bottom)
                continue; // price is back above / below the island: failed
            const entry = bear ? isl.bottom - 0.1 * a : isl.top + 0.1 * a;
            let sl = bear ? isl.top + 0.2 * a : isl.bottom - 0.2 * a;
            if (Math.abs(entry - sl) < 0.5 * a)
                sl = bear ? entry + 0.5 * a : entry - 0.5 * a;
            const risk = Math.abs(entry - sl), leg = bear ? c[j - 1].h - legLo : legHi - c[j - 1].l, move = Math.max(2 * risk, 0.6 * leg);
            if (bear ? price < entry - move : price > entry + move)
                continue; // the move is already spent
            const gapSize = bear ? Math.min(c[j].l - c[j - 1].h, isl.bottom - c[k].h) : Math.min(c[j - 1].l - c[j].h, c[k].l - isl.top);
            out.push({ key: `is${bear ? 't' : 'b'}${j}`, name: 'Island reversal', family: 'Special', dir: bear ? 'bearish' : 'bullish', status: 'confirmed',
                lines: [{ i1: j, p1: bear ? isl.bottom : isl.top, i2: last, p2: bear ? isl.bottom : isl.top, kind: 'neck' }],
                boxes: [
                    { i1: j - 1, i2: j, top: bear ? c[j].l : c[j - 1].l, bottom: bear ? c[j - 1].h : c[j].h, label: 'Gap' },
                    { i1: k - 1, i2: k, top: bear ? isl.bottom : c[k].l, bottom: bear ? c[k].h : isl.top, label: 'Gap' },
                    { i1: j, i2: k - 1, top: isl.top, bottom: isl.bottom, label: 'Island' },
                ],
                points: [{ i: bear ? hiIdx(c, j, k - 1) : loIdx(c, j, k - 1), p: bear ? isl.top : isl.bottom, label: '' }],
                target: bear ? entry - move : entry + move, entry, sl, quality: Q(58 + (k - j <= 4 ? 8 : 0) + (gapSize >= 0.5 * a ? 6 : 0) + (last - k <= 6 ? 6 : 0)),
                note: `Gaps on both sides isolate the island: ${bear ? 'sell' : 'buy'} the retest of the island ${bear ? 'floor' : 'roof'}. Stop beyond the island` });
        }
    }
    // ---------- Adam and Eve top / bottom: a sharp first extreme (Adam) and a wide, rounded second one (Eve) at the same level
    const width = (i, top, up) => {
        let w = 1;
        for (let j = i - 1; j >= Math.max(0, i - 15) && (up ? c[j].h >= top - 0.6 * a : c[j].l <= top + 0.6 * a); j--)
            w++;
        for (let j = i + 1; j <= Math.min(last, i + 15) && (up ? c[j].h >= top - 0.6 * a : c[j].l <= top + 0.6 * a); j++)
            w++;
        return w;
    };
    for (const up of [true, false]) {
        const pv = up ? hi : lo;
        for (let k = Math.max(0, pv.length - 5); k < pv.length - 1; k++)
            for (let m = k + 1; m < pv.length; m++) {
                const p1 = pv[k], p2 = pv[m];
                if (pv.slice(k + 1, m).some((q) => (up ? q.p > Math.min(p1.p, p2.p) - 1.5 * a : q.p < Math.max(p1.p, p2.p) + 1.5 * a)))
                    continue; // another top / bottom in between: not a clean pair
                if (p2.i - p1.i < 8 || Math.abs(p1.p - p2.p) > 0.5 * a || last - p2.i > 35)
                    continue;
                let vi = p1.i + 1;
                for (let j = p1.i + 1; j < p2.i; j++)
                    if (up ? c[j].l < c[vi].l : c[j].h > c[vi].h)
                        vi = j;
                const v = up ? c[vi].l : c[vi].h, ext = up ? Math.max(p1.p, p2.p) : Math.min(p1.p, p2.p), h = Math.abs(ext - v);
                if (up ? Math.min(p1.p, p2.p) - v < 1.5 * a || price > ext + 0.3 * a : v - Math.max(p1.p, p2.p) < 1.5 * a || price < ext - 0.3 * a)
                    continue;
                const w1 = width(p1.i, p1.p, up), w2 = width(p2.i, p2.p, up);
                if (!(w1 <= 3 && w2 >= 5 && w2 >= 2 * w1))
                    continue;
                const broke = up ? price < v - 0.1 * a && recent(true, () => v) : price > v + 0.1 * a && recent(false, () => v);
                out.push({ key: `ae${up ? 't' : 'b'}${p1.i}`, name: up ? 'Adam and Eve top' : 'Adam and Eve bottom', family: 'Special', dir: up ? 'bearish' : 'bullish', status: broke ? 'confirmed' : 'forming',
                    lines: [{ i1: p1.i, p1: v, i2: last, p2: v, kind: 'neck' }],
                    points: [{ i: p1.i, p: p1.p, label: 'Adam' }, { i: p2.i, p: p2.p, label: 'Eve' }],
                    curve: roundedArc(c, p2.i, up, a),
                    target: up ? v - h : v + h, entry: broke ? v : up ? v - 0.1 * a : v + 0.1 * a, sl: up ? ext + 0.2 * a : ext - 0.2 * a,
                    quality: Q(62 + (broke ? 20 : 0) + (last - p2.i < 15 ? 8 : 0) + (Math.abs(p1.p - p2.p) < 0.25 * a ? 6 : 0)),
                    note: broke ? `Neckline broken: ${up ? 'sell' : 'buy'} the retest of the neckline` : `Sharp first ${up ? 'top' : 'bottom'} (Adam) and rounded second (Eve). ${up ? 'Sell on a close below' : 'Buy on a close above'} the neckline` });
            }
    }
    // ---------- Quasimodo and 1-2-3: written once for the bearish form; the bullish form runs on negated prices
    const seq = [];
    for (const s of [...hi.map((p) => ({ ...p, t: 'H' })), ...lo.map((p) => ({ ...p, t: 'L' }))].sort((x, y) => x.i - y.i)) {
        const prev = seq[seq.length - 1];
        if (prev && prev.t === s.t) {
            if (s.t === 'H' ? s.p > prev.p : s.p < prev.p)
                seq[seq.length - 1] = s;
        }
        else
            seq.push(s);
    }
    for (const sg of [1, -1]) {
        const bear = sg === 1;
        const Hh = (i) => (bear ? c[i].h : -c[i].l), Cc = (i) => sg * c[i].c, px = sg * price;
        const sw = seq.map((s) => ({ i: s.i, p: sg * s.p, t: (bear ? s.t : s.t === 'H' ? 'L' : 'H') }));
        const maxH = (x, y) => { let m = -Infinity; for (let i = x; i <= y; i++)
            m = Math.max(m, Hh(i)); return m; };
        const minC = (x, y) => { let m = Infinity; for (let i = Math.max(0, x); i <= y; i++)
            m = Math.min(m, Cc(i)); return m; };
        // Quasimodo: LS (high), a low B, a higher HEAD, then a LOWER low D that breaks B: sell when price returns to the left shoulder
        for (let k = Math.max(0, sw.length - 7); k + 3 < sw.length; k++) {
            const [A, B, C, D] = sw.slice(k, k + 4);
            if (A.t !== 'H' || B.t !== 'L' || C.t !== 'H' || D.t !== 'L')
                continue;
            if (C.p < A.p + 0.25 * a || D.p > B.p - 0.2 * a || B.i - A.i < 3 || C.i - B.i < 3 || D.i - C.i < 3 || last - D.i > 40)
                continue;
            if (A.p - minC(A.i - 15, A.i) < 2 * a || px < D.p + 0.2 * a || px > A.p + 0.6 * a || maxH(D.i, last) >= C.p)
                continue;
            const tapped = maxH(D.i, last) >= A.p - 0.3 * a, confirmed = tapped && px < A.p - 0.25 * a;
            const entry = A.p - 0.05 * a, sl = C.p + 0.25 * a, target = D.p - 0.25 * (entry - D.p);
            if (entry - sl > -0.3 * a || px < D.p + 0.4 * (entry - D.p))
                continue;
            const hz = (v) => sg * v, zTop = hz(A.p + 0.1 * a), zBot = hz(A.p - 0.6 * a);
            out.push({ key: `qm${bear ? 's' : 'b'}${A.i}`, name: 'Quasimodo (QM)', family: 'Special', dir: bear ? 'bearish' : 'bullish', status: confirmed ? 'confirmed' : 'forming',
                lines: [{ i1: A.i, p1: hz(A.p), i2: last, p2: hz(A.p), kind: 'neck' }],
                path: [A, B, C, D].map((s) => ({ i: s.i, p: hz(s.p) })),
                boxes: [{ i1: A.i, i2: last, top: Math.max(zTop, zBot), bottom: Math.min(zTop, zBot), label: 'QM level' }],
                points: [{ i: A.i, p: hz(A.p), label: 'LS' }, { i: B.i, p: hz(B.p), label: '' }, { i: C.i, p: hz(C.p), label: 'Head' }, { i: D.i, p: hz(D.p), label: 'BOS' }],
                target: hz(target), entry: hz(entry), sl: hz(sl), quality: Q(58 + (confirmed ? 16 : 0) + (C.p - A.p >= 0.5 * a ? 4 : 0) + (last - D.i < 20 ? 5 : 0)),
                note: confirmed ? `Price tapped the left shoulder and was rejected: ${bear ? 'sell' : 'buy'} the QM level, stop beyond the head` : `Structure broke (new ${bear ? 'lower low' : 'higher high'}). Wait for price to return to the left shoulder and reject it, then ${bear ? 'sell' : 'buy'}` });
        }
        // 1-2-3 reversal: 1 = the extreme, 2 = the swing back, 3 = a lower high that fails; the trade triggers when 2 breaks
        for (let k = Math.max(0, sw.length - 6); k + 2 < sw.length; k++) {
            const [P1, P2, P3] = sw.slice(k, k + 3);
            if (P1.t !== 'H' || P2.t !== 'L' || P3.t !== 'H' || last - P3.i > 25)
                continue;
            const leg = P1.p - P2.p, retr = (P3.p - P2.p) / (leg || 1);
            if (leg < 1.5 * a || P3.p > P1.p - 0.25 * a || retr < 0.3 || retr > 0.85)
                continue;
            if (P1.p - minC(P1.i - 15, P1.i) < 2.5 * a || maxH(P3.i + 1, last) >= P1.p || px > P3.p + 0.5 * a)
                continue;
            const broke = px < P2.p - 0.1 * a && (() => { for (let i = last; i > P3.i; i--)
                if (Cc(i) < P2.p - 0.1 * a)
                    return true; return false; })();
            if (px < P2.p - leg)
                continue; // the move is already spent
            const entry = broke ? P2.p : P2.p - 0.1 * a;
            let sl = P3.p + 0.2 * a;
            if (sl - entry < 0.5 * a)
                sl = entry + 0.5 * a;
            const hz = (v) => sg * v;
            out.push({ key: `t123${bear ? 's' : 'b'}${P1.i}`, name: '1-2-3 reversal', family: 'Special', dir: bear ? 'bearish' : 'bullish', status: broke ? 'confirmed' : 'forming',
                lines: [{ i1: P2.i, p1: hz(P2.p), i2: last, p2: hz(P2.p), kind: 'neck' }],
                path: [P1, P2, P3].map((s) => ({ i: s.i, p: hz(s.p) })),
                points: [{ i: P1.i, p: hz(P1.p), label: '1' }, { i: P2.i, p: hz(P2.p), label: '2' }, { i: P3.i, p: hz(P3.p), label: '3' }],
                target: hz(entry - leg), entry: hz(entry), sl: hz(sl), quality: Q(50 + (broke ? 20 : 0) + (retr >= 0.45 && retr <= 0.7 ? 6 : 0) + (last - P3.i < 12 ? 6 : 0) + (leg >= 3 * a ? 4 : 0)),
                note: broke ? `Point 2 broken: ${bear ? 'sell' : 'buy'} the retest of point 2. Target = the 1-2 leg` : `Wait for a close ${bear ? 'below' : 'above'} point 2. Stop beyond point 3. Target = the 1-2 leg` });
        }
    }
    // ---------- Elliott wave: the 5-wave impulse (0-1-2-3-4-5) and the 3-wave correction (A-B-C), on filtered swings (every leg at least 1.5 ATR)
    // Rules checked: wave 2 never goes back past the start of wave 1, wave 3 is never the shortest of 1 / 3 / 5, wave 4 never overlaps wave 1.
    // A finished impulse is traded AGAINST (the correction that follows); an impulse stuck at wave 4 is traded WITH (the coming wave 5);
    // a finished A-B-C is traded as the end of the correction. Written for a rising impulse / falling correction, the mirror runs on negated prices.
    const big = [];
    for (const s of seq) {
        const prev = big[big.length - 1];
        if (!prev) {
            big.push(s);
            continue;
        }
        if (prev.t === s.t) {
            if (s.t === 'H' ? s.p > prev.p : s.p < prev.p)
                big[big.length - 1] = s;
            continue;
        }
        if (Math.abs(s.p - prev.p) < 1.5 * a)
            continue;
        big.push(s);
    }
    for (const sg of [1, -1]) {
        const up = sg === 1, px = sg * price, hz = (v) => sg * v;
        const sw = big.map((s) => ({ i: s.i, p: sg * s.p, t: (up ? s.t : s.t === 'H' ? 'L' : 'H') }));
        const chan = (P0, P1, P2, P3, P4, endI = last) => {
            const lowT = fit([P0, P2, P4]), upT = fit([P1, P3]);
            const real = (l, i1, kind) => ({ i1, p1: hz(at(l, i1)), i2: endI, p2: hz(at(l, endI)), kind });
            return [real(lowT, P0.i, up ? 'lower' : 'upper'), real(upT, P1.i, up ? 'upper' : 'lower')];
        };
        for (let k = Math.max(0, sw.length - 8); k + 4 < sw.length; k++) {
            const [P0, P1, P2, P3, P4] = sw.slice(k, k + 5), P5 = sw[k + 5];
            if (P0.t !== 'L' || P1.t !== 'H' || P2.t !== 'L' || P3.t !== 'H' || P4.t !== 'L')
                continue;
            const len1 = P1.p - P0.p, len3 = P3.p - P2.p, r2 = (P1.p - P2.p) / (len1 || 1), r4 = (P3.p - P4.p) / (len3 || 1);
            if (len1 < 1.5 * a || P2.p < P0.p + 0.1 * a || P3.p < P1.p + 0.1 * a || P4.p < P1.p + 0.1 * a || r2 < 0.2 || r4 < 0.15 || r4 > 0.8)
                continue;
            const ratios = (r2 >= 0.382 && r2 <= 0.618 ? 4 : 0) + (r4 >= 0.236 && r4 <= 0.5 ? 4 : 0);
            if (P5 && P5.t === 'H' && P5.p > P3.p + 0.1 * a) {
                const len5 = P5.p - P4.p; // finished impulse: trade the correction
                if (len3 < Math.min(len1, len5) || last - P5.i > 30 || px > P5.p + 0.3 * a)
                    continue;
                const whole = P5.p - P0.p, broke = px < P4.p - 0.1 * a, entry = broke ? P4.p : P4.p - 0.1 * a, sl = P5.p + 0.2 * a;
                let target = P5.p - 0.382 * whole;
                if (entry - target < 0.5 * a)
                    target = P5.p - 0.618 * whole;
                if (entry - target < 0.5 * a || px < target || sl - entry < 0.5 * a)
                    continue;
                out.push({ key: `ewi${up ? 'u' : 'd'}${P0.i}`, name: 'Elliott wave (impulse)', family: 'Special', dir: up ? 'bearish' : 'bullish', status: broke ? 'confirmed' : 'forming',
                    lines: [...chan(P0, P1, P2, P3, P4, P5.i), { i1: P4.i, p1: hz(P4.p), i2: last, p2: hz(P4.p), kind: 'neck' }],
                    path: [P0, P1, P2, P3, P4, P5].map((q) => ({ i: q.i, p: hz(q.p) })),
                    points: [P0, P1, P2, P3, P4, P5].map((q, n2) => ({ i: q.i, p: hz(q.p), label: String(n2) })),
                    target: hz(target), entry: hz(entry), sl: hz(sl), quality: Q(52 + ratios + (len3 >= Math.max(len1, len5) ? 6 : 0) + (broke ? 14 : 0) + (last - P5.i < 15 ? 5 : 0) + (P5.p - P3.p <= 1.8 * len3 ? 2 : 0)),
                    note: broke ? `All five waves are complete and wave 4 broke: ${up ? 'sell' : 'buy'} the retest of the wave 4 ${up ? 'low' : 'high'}. Target = 38% of the whole move (the A-B-C correction)` : `Five waves are complete. Wait for a close ${up ? 'below the wave 4 low' : 'above the wave 4 high'}, then trade the correction. Stop beyond wave 5` });
            }
            else if (k + 4 === sw.length - 1 && len3 >= len1 && last - P4.i <= 30 && px > P4.p - 0.1 * a && px < P3.p + 0.5 * len1) {
                const breakout = px > P3.p + 0.1 * a, entry = breakout ? P3.p : P4.p + 0.15 * a, sl = P4.p - 0.3 * a; // wave 4 is done: trade wave 5
                let target = P4.p + len1;
                if (target < P3.p + 0.5 * a)
                    target = P3.p + 0.618 * len1;
                if (target - entry < 0.8 * a || px >= target - 0.5 * a)
                    continue;
                out.push({ key: `ew5${up ? 'u' : 'd'}${P0.i}`, name: 'Elliott wave (impulse)', family: 'Special', dir: up ? 'bullish' : 'bearish', status: breakout ? 'breakout' : 'forming',
                    lines: chan(P0, P1, P2, P3, P4),
                    path: [P0, P1, P2, P3, P4].map((q) => ({ i: q.i, p: hz(q.p) })),
                    points: [P0, P1, P2, P3, P4].map((q, n2) => ({ i: q.i, p: hz(q.p), label: String(n2) })),
                    target: hz(target), entry: hz(entry), sl: hz(sl), quality: Q(50 + ratios + (len3 >= 1.5 * len1 ? 6 : 0) + (breakout ? 8 : 0) + (last - P4.i < 15 ? 5 : 0)),
                    note: breakout ? `Wave 5 is already running above wave 3: ${up ? 'buy' : 'sell'} only a pullback to the wave 3 ${up ? 'high' : 'low'}. Target = wave 5 equal to wave 1` : `Waves 1-4 are in place (wave 4 holds above wave 1). ${up ? 'Buy' : 'Sell'} the wave 4 ${up ? 'low' : 'high'}, stop just beyond it. Target = wave 5 equal to wave 1` });
            }
        }
        for (let k = Math.max(0, sw.length - 6); k + 3 < sw.length; k++) { // A-B-C correction (falling for sg = 1): traded as its end
            const [S0, A, B, C] = sw.slice(k, k + 4);
            if (S0.t !== 'H' || A.t !== 'L' || B.t !== 'H' || C.t !== 'L' || k + 3 !== sw.length - 1)
                continue;
            const legA = S0.p - A.p, rB = (B.p - A.p) / (legA || 1), rC = (A.p - C.p) / (legA || 1);
            if (legA < 1.5 * a || rB < 0.3 || rB > 0.95 || rC < 0.1 || rC > 1.8 || last - C.i > 25 || px < C.p - 0.3 * a)
                continue;
            const breakout = px > B.p + 0.1 * a, confirmed = !breakout && px > C.p + 0.382 * (B.p - C.p);
            const entry = breakout ? B.p : C.p + 0.15 * a, sl = C.p - 0.3 * a, target = C.p + 0.618 * (S0.p - C.p);
            if (target - entry < 0.8 * a || px >= target)
                continue;
            out.push({ key: `ewa${up ? 'u' : 'd'}${S0.i}`, name: 'Elliott wave (ABC)', family: 'Special', dir: up ? 'bullish' : 'bearish', status: breakout ? 'breakout' : confirmed ? 'confirmed' : 'forming',
                lines: [{ i1: B.i, p1: hz(B.p), i2: last, p2: hz(B.p), kind: 'neck' }],
                path: [S0, A, B, C].map((q) => ({ i: q.i, p: hz(q.p) })),
                points: [{ i: A.i, p: hz(A.p), label: 'A' }, { i: B.i, p: hz(B.p), label: 'B' }, { i: C.i, p: hz(C.p), label: 'C' }],
                target: hz(target), entry: hz(entry), sl: hz(sl), quality: Q(48 + (rB >= 0.5 && rB <= 0.786 ? 6 : 0) + (rC >= 0.6 && rC <= 1.7 ? 4 : 0) + (breakout ? 16 : confirmed ? 10 : 0) + (last - C.i < 12 ? 5 : 0)),
                note: breakout ? `Wave B broke: the A-B-C correction is over, ${up ? 'buy' : 'sell'} the retest of wave B. Target = 62% back to where it started` : `A-B-C correction looks complete at C. ${up ? 'Buy' : 'Sell'} near C with the stop just beyond it. A close beyond wave B confirms it` });
        }
    }
    return out;
}
function hiIdx(c, x, y) { let k = x; for (let j = x; j <= y; j++)
    if (c[j].h > c[k].h)
        k = j; return k; }
function loIdx(c, x, y) { let k = x; for (let j = x; j <= y; j++)
    if (c[j].l < c[k].l)
        k = j; return k; }
// A smooth arc through the second (rounded) extreme of Adam and Eve: the extreme price of every 2nd candle around it.
function roundedArc(c, i, up, a) {
    const pk = up ? c[i].h : c[i].l, pts = [];
    let x0 = i, x1 = i;
    while (x0 > 0 && i - x0 < 15 && (up ? c[x0 - 1].h >= pk - 0.9 * a : c[x0 - 1].l <= pk + 0.9 * a))
        x0--;
    while (x1 < c.length - 1 && x1 - i < 15 && (up ? c[x1 + 1].h >= pk - 0.9 * a : c[x1 + 1].l <= pk + 0.9 * a))
        x1++;
    for (let j = x0; j <= x1; j += Math.max(1, Math.floor((x1 - x0) / 6)))
        pts.push({ i: j, p: up ? c[j].h : c[j].l });
    if (pts[pts.length - 1].i !== x1)
        pts.push({ i: x1, p: up ? c[x1].h : c[x1].l });
    return pts;
}
