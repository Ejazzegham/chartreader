import type { Candle } from './markets';
import type { Scalp, ScalpSetup } from './scalp';
import { atrSeries, emaS, rsiSeries, swings, fin, sessionAt } from './indicators';

// =====================================================================================
// CRT: Candle Range Theory, built for scalping.
//   C1 = a higher-timeframe candle that sets the RANGE (its high, low and 50% midpoint).
//   C2 = the next candle MANIPULATES: it wicks beyond one side of C1 (a liquidity sweep) and price comes back inside the range.
//   C3 = distribution: price expands to the other side of C1.
// The app builds C1 / C2 from the candles on screen (M1 -> M15, M5 -> H1, M15 -> H4 ...), then uses the scalp timeframe to:
//   1. wait for the sweep, 2. wait for a market structure shift (MSS) back into the range, 3. enter on the displacement
//   fair value gap or the 50% retrace of the leg, 4. put the stop beyond the sweep, 5. target C1 midpoint, C1 opposite side, 1.272 extension.
// =====================================================================================

export const HTF_OF: Record<number, number> = { 60: 900, 180: 900, 300: 3600, 900: 14400, 1800: 14400, 3600: 86400, 7200: 86400, 14400: 86400 };
export const HTF_LABEL: Record<number, string> = { 900: 'M15', 3600: 'H1', 14400: 'H4', 86400: 'D1' };
const LTF_LABEL: Record<number, string> = { 60: 'M1', 180: 'M3', 300: 'M5', 900: 'M15', 1800: 'M30', 3600: 'H1', 7200: 'H2', 14400: 'H4' };

export type Bucket = { key: number; o: number; h: number; l: number; c: number; i0: number; i1: number; closed: boolean };
export type CrtSetup = {
  side: 'buy' | 'sell'; model: string; entry: number; sl: number; tps: [number, number, number]; rr: [number, number, number];
  score: number; grade: 'A+' | 'A' | 'B' | 'C'; confluence: { text: string; ok: boolean }[]; note: string; barsAgo: number;
  state: 'armed' | 'triggered'; trigger: number; zoneTop: number; zoneBottom: number;
};
export type CRT = {
  ok: boolean; reason?: string; why?: string;
  htf: number; htfLabel: string; ltfLabel: string;
  c1?: Bucket & { eq: number }; c2?: Bucket;
  state: 'none' | 'range' | 'armed' | 'triggered';
  sweep?: { side: 'high' | 'low'; extreme: number; i: number; depth: number };
  mss?: { level: number; i: number };
  setup?: CrtSetup;
};

// Group the candles into higher-timeframe candles. A group that starts before the data does (partial) is dropped.
export function aggregate(c: Candle[], gran: number, htf: number): Bucket[] {
  const out: Bucket[] = [];
  c.forEach((x, i) => {
    const key = Math.floor(x.t / htf) * htf, b = out[out.length - 1];
    if (b && b.key === key) { b.h = Math.max(b.h, x.h); b.l = Math.min(b.l, x.l); b.c = x.c; b.i1 = i; }
    else out.push({ key, o: x.o, h: x.h, l: x.l, c: x.c, i0: i, i1: i, closed: false });
  });
  const lastEnd = c.length ? c[c.length - 1].t + gran : 0;
  out.forEach((b) => { b.closed = lastEnd >= b.key + htf; });
  return out.filter((b) => c[b.i0].t <= b.key + gran); // first candle of the group must be (about) the group's start
}

const grade = (s: number): CrtSetup['grade'] => (s >= 85 ? 'A+' : s >= 70 ? 'A' : s >= 50 ? 'B' : 'C');

export function crtAnalyze(c: Candle[], gran: number, now = new Date(), opts: { sessions?: boolean; dec?: number } = {}): CRT {
  const fx = (v: number) => v.toFixed(opts.dec ?? 4);
  const htf = HTF_OF[gran] ?? 86400, htfLabel = HTF_LABEL[htf] ?? 'HTF', ltfLabel = LTF_LABEL[gran] ?? `${gran}s`;
  const base: CRT = { ok: false, htf, htfLabel, ltfLabel, state: 'none' };
  const n = c.length;
  if (n < 60) return { ...base, reason: 'Need at least 60 candles.' };
  const at = atrSeries(c), a = at[n - 1];
  if (!fin(a) || a <= 0) return { ...base, reason: 'No volatility data.' };
  const bk = aggregate(c, gran, htf);
  if (bk.length < 2) return { ...base, reason: `Not enough history to build ${htfLabel} range candles on ${ltfLabel}. Pull the chart back or use a smaller timeframe.` };

  const price = c[n - 1].c;
  const cl = c.map((x) => x.c), e9 = emaS(cl, 9), e21 = emaS(cl, 21), r7 = rsiSeries(cl, 7);
  const sessions = opts.sessions !== false, ses = sessionAt(now);
  const out: CRT = { ...base, ok: true };

  // The latest complete higher-timeframe candle is always shown as the reference range.
  const refIdx = bk[bk.length - 1].closed ? bk.length - 1 : bk.length - 2;
  if (refIdx >= 0) { const r = bk[refIdx]; out.c1 = { ...r, eq: (r.h + r.l) / 2 }; out.state = 'range'; }

  // Two readings: A) C2 is the candle in progress, C1 the one before it. B) C2 just closed, C3 has started.
  const pairs: [Bucket, Bucket][] = [];
  if (bk.length >= 2) pairs.push([bk[bk.length - 2], bk[bk.length - 1]]);
  if (bk.length >= 3 && bk[bk.length - 1].i1 - bk[bk.length - 1].i0 < 0.6 * (htf / gran)) pairs.push([bk[bk.length - 3], bk[bk.length - 2]]);

  let why = '';
  const miss = (m: string) => { if (!why) why = m; }; // keep the reason from the most relevant reading
  for (const [c1, c2] of pairs) {
    const R = c1.h - c1.l, eq = (c1.h + c1.l) / 2;
    if (R < 2.5 * a) { miss(`The ${htfLabel} range candle is only ${(R / a).toFixed(1)} ATR tall, too small to scalp.`); continue; }
    const tol = 0.02 * a, lastClose = price;
    const sweptHigh = c2.h > c1.h + tol, sweptLow = c2.l < c1.l - tol;
    if (sweptHigh && sweptLow) { miss('The latest candle broke both sides of the range (outside bar). CRT needs one clean sweep.'); continue; }
    if (!sweptHigh && !sweptLow) { miss(`${htfLabel} range ${fx(c1.l)} - ${fx(c1.h)} is intact. Wait for a sweep of the high or the low.`); continue; }
    const buy = sweptLow, dirv = buy ? 1 : -1;
    const level = buy ? c1.l : c1.h, opposite = buy ? c1.h : c1.l;
    const insideNow = buy ? lastClose > level : lastClose < level;
    if (!insideNow) { miss(`Price swept the ${buy ? 'low' : 'high'} and is still ${buy ? 'below' : 'above'} it. CRT needs the close back inside the range.`); continue; }

    // sweep extreme and the candle that made it
    let ex = c2.i0;
    for (let i = c2.i0; i <= n - 1; i++) if (buy ? c[i].l < c[ex].l : c[i].h > c[ex].h) ex = i;
    const extreme = buy ? c[ex].l : c[ex].h, depth = Math.abs(extreme - level) / R;
    const exC = c[ex], exRange = Math.max(exC.h - exC.l, 1e-12);
    const wick = (buy ? Math.min(exC.o, exC.c) - exC.l : exC.h - Math.max(exC.o, exC.c)) / exRange;
    const sweep: CRT['sweep'] = { side: buy ? 'low' : 'high', extreme, i: ex, depth };

    // a close that accepts beyond the swept level after the extreme cancels the idea
    if (c.slice(ex + 1).some((x) => (buy ? x.c < level - tol : x.c > level + tol))) { miss('Price closed back outside the range after the sweep, so it is a breakout and not a CRT.'); continue; }

    // market structure shift: the last short-term swing before the extreme must break with a close
    // (a swing from the range candle itself is too far away to be a scalp trigger, so only the leg into the sweep counts)
    const sw = swings(c, 2), pv = (buy ? sw.hi : sw.lo).filter((q) => q.i < ex && q.i >= ex - 12 && Math.abs(q.p - extreme) <= 4 * a);
    let mssLevel = pv.length ? pv[pv.length - 1].p : NaN;
    if (!fin(mssLevel)) {
      const from = Math.max(0, ex - 6), seg = c.slice(from, Math.max(from + 1, ex));
      mssLevel = buy ? Math.max(...seg.map((x) => x.h)) : Math.min(...seg.map((x) => x.l));
    }
    let mssI = -1;
    for (let j = ex + 1; j <= n - 1; j++) if (buy ? c[j].c > mssLevel : c[j].c < mssLevel) { mssI = j; break; }

    const pad = 0.15 * a;
    let sl = extreme - dirv * pad;

    // displacement fair value gap between the extreme and the shift
    let fvgMean = NaN, fvgTop = NaN, fvgBot = NaN;
    if (mssI > 0) {
      for (let k = Math.min(n - 1, mssI + 1); k >= Math.max(ex + 1, 2); k--) {
        if (buy ? c[k].l > c[k - 2].h : c[k].h < c[k - 2].l) {
          const top = buy ? c[k].l : c[k - 2].l, bot = buy ? c[k - 2].h : c[k].h;
          fvgTop = Math.max(top, bot); fvgBot = Math.min(top, bot); fvgMean = (fvgTop + fvgBot) / 2; break;
        }
      }
    }

    let entry: number, state: CrtSetup['state'];
    const legExt = buy ? Math.max(...c.slice(ex).map((x) => x.h)) : Math.min(...c.slice(ex).map((x) => x.l));
    const leg = Math.abs(legExt - extreme);
    if (mssI > 0) {
      state = 'triggered';
      const fib50 = legExt - dirv * 0.5 * leg, fib62 = legExt - dirv * 0.62 * leg;
      const inLeg = (v: number) => fin(v) && Math.abs(v - legExt) / (leg || 1) >= 0.3 && Math.abs(v - legExt) / (leg || 1) <= 0.8;
      entry = inLeg(fvgMean) ? fvgMean : fib62 && inLeg(fib62) ? fib62 : fib50;
      if (buy ? price <= entry + 0.1 * a : price >= entry - 0.1 * a) entry = price; // the retrace is already happening: enter at market
    } else {
      state = 'armed';
      entry = mssLevel; // the entry is the break of the shift level
    }
    let risk = Math.abs(entry - sl);
    if (risk < 0.4 * a) { sl = entry - dirv * 0.4 * a; risk = 0.4 * a; }
    if (risk > 6 * a) { miss(`The stop would be ${(risk / a).toFixed(1)} ATR away, too wide for a scalp. Wait for a tighter shift.`); continue; }

    // targets: C1 midpoint, C1 opposite side, 1.272 extension. Anything too close is replaced by an R multiple.
    const cand = [eq, opposite - dirv * 0.02 * R, opposite + dirv * 0.272 * R].filter((v) => (v - entry) * dirv >= 0.8 * risk).sort((x, y) => dirv * (x - y));
    const fill = [1.5, 2.5, 4];
    const tps = [0, 1, 2].map((k) => cand[k] ?? entry + dirv * fill[k] * risk) as [number, number, number];
    for (let k = 1; k < 3; k++) if ((tps[k] - tps[k - 1]) * dirv < 0.3 * risk) tps[k] = tps[k - 1] + dirv * 0.6 * risk;
    const rr = tps.map((v) => Math.abs(v - entry) / risk) as [number, number, number];

    // already finished? (stopped, or TP1 reached since the shift)
    const after = c.slice(Math.max(ex, mssI > 0 ? mssI : ex) + 1);
    if (state === 'triggered' && after.some((x) => (buy ? x.l <= sl : x.h >= sl))) { miss('The CRT setup was stopped out. Wait for the next sweep.'); continue; }
    if (state === 'triggered' && after.some((x) => (buy ? x.h >= tps[0] : x.l <= tps[0]))) { miss('The CRT move already reached TP1. Do not chase it.'); continue; }

    const sessionOk = !sessions || ses.good;
    const premium = buy ? entry < eq : entry > eq;
    const mom = buy ? e9[n - 1] > e21[n - 1] && r7[n - 1] > 50 : e9[n - 1] < e21[n - 1] && r7[n - 1] < 50;
    const conf: { text: string; ok: boolean }[] = [
      { text: `${htfLabel} range candle is clean (${(R / a).toFixed(1)} ATR tall)`, ok: R >= 2.5 * a && R <= 40 * a },
      { text: `C2 swept the ${buy ? 'low' : 'high'} of C1 and came back inside`, ok: true },
      { text: `Sweep depth ${(depth * 100).toFixed(0)}% of the range (under 50% is clean)`, ok: depth <= 0.5 },
      { text: `Rejection wick on the sweep candle (${(wick * 100).toFixed(0)}%)`, ok: wick >= 0.35 || (buy ? exC.c > exC.o : exC.c < exC.o) },
      { text: state === 'triggered' ? `${ltfLabel} market shift confirmed (close ${buy ? 'above' : 'below'} ${fx(mssLevel)})` : `${ltfLabel} market shift NOT yet confirmed`, ok: state === 'triggered' },
      { text: fin(fvgMean) ? 'Displacement left a fair value gap to enter from' : 'No displacement gap, entry uses the 50% retrace', ok: fin(fvgMean) },
      { text: `Entry in ${buy ? 'discount' : 'premium'} of the ${htfLabel} range`, ok: premium },
      { text: `Momentum agrees (EMA 9 vs 21, RSI(7) ${fin(r7[n - 1]) ? r7[n - 1].toFixed(0) : '-'})`, ok: mom },
      { text: sessions ? `Session: ${ses.name}` : 'Market trades around the clock', ok: sessionOk },
      { text: `TP1 risk:reward 1:${rr[0].toFixed(1)}`, ok: rr[0] >= 1.2 },
    ];
    const pts = [8, 18, 8, 10, 20, 10, 8, 6, 6, 6];
    let score = Math.round(conf.reduce((s, x, i) => s + (x.ok ? pts[i] : 0), 0));
    let g = grade(score);
    if (state === 'armed' && (g === 'A+' || g === 'A')) { score = Math.min(score, 69); g = 'B'; } // never above B until the shift is confirmed
    const zoneTop = fin(fvgMean) ? fvgTop : Math.max(entry, extreme), zoneBottom = fin(fvgMean) ? fvgBot : Math.min(entry, extreme);
    const note = state === 'armed'
      ? `Sweep done. Do NOT enter yet: wait for a ${ltfLabel} candle to close ${buy ? 'above' : 'below'} ${fx(mssLevel)} (market shift). Then enter on the gap or the 50% retrace.`
      : `Sweep of the ${htfLabel} ${buy ? 'low' : 'high'}, shift confirmed on ${ltfLabel}. Target is the other side of the ${htfLabel} range. Stop sits beyond the sweep.`;

    out.c1 = { ...c1, eq }; out.c2 = c2; out.sweep = sweep; out.state = state; out.why = undefined;
    if (mssI > 0) out.mss = { level: mssLevel, i: mssI }; else out.mss = { level: mssLevel, i: -1 };
    out.setup = {
      side: buy ? 'buy' : 'sell', model: `CRT ${htfLabel} sweep (${buy ? 'buy' : 'sell'})`, entry, sl, tps, rr, score, grade: g, confluence: conf, note,
      barsAgo: mssI > 0 ? n - 1 - mssI : 0, state, trigger: mssLevel, zoneTop, zoneBottom,
    };
    return out;
  }
  out.why = why || `Waiting for the ${htfLabel} range to be swept.`;
  return out;
}

// ---------- merge CRT with the supply/demand reversal scalp into ONE final setup ----------
export type Final = Omit<ScalpSetup, 'patternI' | 'pattern' | 'level'> & Partial<Pick<ScalpSetup, 'patternI' | 'pattern' | 'level'>> & { source: 'CRT' | 'CRT + S/D' | 'S/D Reversal'; state?: 'armed' | 'triggered'; trigger?: number; warn?: string };

export function refineScalp(scalp: Scalp, crt?: CRT): Final | null {
  const cs = crt?.setup, ss = scalp.setup;
  if (cs) {
    const f: Final = { ...cs, source: 'CRT', state: cs.state, trigger: cs.trigger };
    if (ss && ss.side === cs.side) {
      f.source = 'CRT + S/D'; f.model = `CRT + ${ss.model}`;
      f.score = Math.min(100, cs.score + (cs.state === 'triggered' ? 8 : 4));
      f.confluence = [...cs.confluence, { text: `${ss.model} fires the same way`, ok: true }];
      f.grade = cs.state === 'armed' && f.score >= 70 ? 'B' : f.score >= 85 ? 'A+' : f.score >= 70 ? 'A' : f.score >= 50 ? 'B' : 'C';
    } else if (ss && ss.side !== cs.side) {
      f.score = Math.max(0, cs.score - 12);
      f.grade = f.score >= 85 ? 'A+' : f.score >= 70 ? 'A' : f.score >= 50 ? 'B' : 'C';
      f.confluence = [...cs.confluence, { text: `${ss.model} points the other way`, ok: false }];
      f.warn = 'The supply/demand reversal setup points the other way. CRT is a reversal idea, so use a smaller size or wait.';
    }
    return f;
  }
  return ss ? { ...ss, source: 'S/D Reversal' } : null;
}
