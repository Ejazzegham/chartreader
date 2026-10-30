import type { Candle } from './markets';
import { atr, ladder } from './ta';
import { VSA_MIN_COVER } from './volume';

// =====================================================================================
// VSA - Volume Spread Analysis. Reads effort (REAL traded volume) against result (spread and close position).
// VSA needs real volume. Candles get it from volume.ts (Binance spot for crypto, CME / COMEX / ICE futures for forex majors,
// gold, silver and DXY). Where no real volume exists (synthetic indices, a few crosses) the engine does NOT guess from the
// spread: it says so, gives no signal and no entry (hasVolume = false).
// The caller passes CLOSED candles only (refine.ts drops the forming candle): its volume is partial, so a read from it would repaint.
// =====================================================================================

export type VsaTag = 'SC' | 'BC' | 'ST' | 'UT' | 'SP' | 'ND' | 'NS' | 'SOS' | 'SOW' | 'EFF';
export type VsaSignal = { i: number; tag: VsaTag; dir: 'bull' | 'bear'; text: string; w: number };
// VSA reversal entry model. Core rule for EVERY setup: the entry needs a breakout on LOW volume, then a RETEST of the broken level,
// and the trade is executed only when a confirmation candle closes after that retest.
//   1 pattern    a VSA structure was found (selling / buying climax, no supply / demand, shakeout, upthrust)
//   2 breakout   price broke the key level on low volume
//   3 retest     price came back to test the broken level and held
//   4 confirmed  a confirmation candle closed after the retest: execute
export type VsaStage = 'pattern' | 'breakout' | 'retest' | 'confirmed';
export type VsaStep = { text: string; ok: boolean };
export type VsaReversal = {
  side: 'buy' | 'sell'; tag: VsaTag; stage: VsaStage; stageNo: 1 | 2 | 3 | 4;
  patternI: number; breakoutI?: number; retestI?: number; confirmI?: number;
  level: number;          // the key level that must break (buy: top of the pattern range, sell: bottom)
  invalidAt: number;      // the setup is dead if price closes beyond this
  steps: VsaStep[]; next: string; lowVolBreakout?: boolean; badBreakout?: boolean;
};
export type VSA = {
  ok: boolean; reason?: string; hasVolume: boolean;
  signals: VsaSignal[]; score: number; bias: 'buy' | 'sell' | 'wait';
  reversal?: VsaReversal;
  setup?: { side: 'buy' | 'sell'; entry: number; sl: number; tps: [number, number, number]; rr: [number, number, number]; tag: VsaTag; i: number; zoneTop: number; zoneBottom: number; note: string; level?: number; breakoutI?: number; retestI?: number };
};

export const VSA_RULE = 'Every entry needs a breakout on low volume, then a retest, and you execute only on the confirmation candle.';
// What each setup means, shown in the VSA tab and the trade sheet
export const VSA_HELP: Record<string, string> = {
  BC: 'Buying climax: heavy volume as professionals sell into retail FOMO buying. Wait for a low-volume break down, the retest, then confirmation to sell.',
  SC: 'Selling climax: panic selling on heavy volume is absorbed by smart money. Wait for a low-volume break up, the retest, then confirmation to buy.',
  NS: 'No supply: a low-volume test in a downtrend shows sellers have gone. Needs a low-volume break up, a retest, then confirmation to buy.',
  ND: 'No demand: a low-volume test in an uptrend shows buyers have gone. Needs a low-volume break down, a retest, then confirmation to sell.',
  SP: 'Shakeout: a sharp trap move under support to push retail out before the reversal. Needs a low-volume break back up, a retest, then confirmation to buy.',
  UT: 'Upthrust: a false break above resistance that traps breakout buyers. Needs a low-volume break down, a retest, then confirmation to sell.',
};

export const VSA_NAMES: Record<VsaTag, string> = {
  SC: 'Selling climax', BC: 'Buying climax', ST: 'Stopping volume', UT: 'Upthrust', SP: 'Shakeout',
  ND: 'No demand', NS: 'No supply', SOS: 'Sign of strength', SOW: 'Sign of weakness', EFF: 'Effort, no result',
};

export const VSA_NO_VOLUME = 'No real volume for this market, so VSA gives no signal. VSA reads volume against spread; guessing from the spread alone is not VSA.';
// Average volume of a window, with spikes limited to 2x the median so one climax bar does not make everything after it look quiet
// Candles with no volume (a futures break, a quiet minute) are left out, so a gap never drags the average down and fakes a high-volume bar.
const baseVol = (all: number[]) => {
  const w = all.filter((v) => v > 0);
  if (!w.length) return 0;
  const s = [...w].sort((x, y) => x - y), med = s[Math.floor(s.length / 2)], cap = med > 0 ? 2 * med : Infinity;
  return w.reduce((t, v) => t + Math.min(v, cap), 0) / w.length;
};
// Real volume present: at least 70% of the last 40 candles carry a traded volume (VSA_MIN_COVER), and 2 of the newest 3 do, so the read
// is about NOW and not about old candles. Candles without volume are skipped by the engine (no signal on them, left out of every average).
export const hasRealVolume = (c: Candle[]) => {
  const w = c.slice(-40);
  if (w.length < 30) return false;
  const has = (x: Candle) => (x.v ?? 0) > 0;
  return w.filter(has).length >= Math.ceil(w.length * VSA_MIN_COVER) && w.slice(-3).filter(has).length >= 2;
};

export function vsaAnalyze(c: Candle[]): VSA {
  const n = c.length;
  const empty: VSA = { ok: false, hasVolume: false, signals: [], score: 0, bias: 'wait' };
  if (n < 30) return { ...empty, reason: 'Need at least 30 candles.' };
  const a = atr(c);
  if (!isFinite(a) || a <= 0) return { ...empty, reason: 'No volatility data.' };
  if (!hasRealVolume(c)) return { ...empty, ok: true, reason: VSA_NO_VOLUME };
  const hasVolume = true;
  const sp = (x: Candle) => x.h - x.l;
  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / Math.max(1, arr.length);
  const signals: VsaSignal[] = [];
  const from = Math.max(21, n - 40);

  for (let i = from; i < n; i++) {
    const x = c[i], s = sp(x);
    if (s <= 0) continue;
    const win = c.slice(i - 20, i);
    const aS = avg(win.map(sp)), aV = baseVol(win.map((y) => y.v ?? 0));
    if (!(aV > 0) || !((x.v ?? 0) > 0)) continue; // a bar with no volume cannot be read
    const vr = (x.v ?? 0) / aV;
    const pos = (x.c - x.l) / s; // 0 = closed on the low, 1 = closed on the high
    const up = x.c > x.o, down = x.c < x.o;
    const wide = s > 1.3 * aS, narrow = s < 0.7 * aS;
    const hiV = vr > 1.5, ultra = vr > 2.2, lowV = vr < 0.7 && (x.v ?? 0) < Math.min(c[i - 1].v ?? Infinity, c[i - 2].v ?? Infinity);
    const prior = c[i - 1].c - c[i - 8].c;
    const dn = prior < -0.8 * a, upTrend = prior > 0.8 * a;
    const lo10 = Math.min(...c.slice(i - 10, i).map((y) => y.l)), hi10 = Math.max(...c.slice(i - 10, i).map((y) => y.h));
    const push = (tag: VsaTag, dir: 'bull' | 'bear', w: number, text: string) => signals.push({ i, tag, dir, w, text });
    const vtxt = `volume ${vr.toFixed(1)}x average`;

    if (down && wide && ultra && pos > 0.35 && dn) push('SC', 'bull', 3, `Selling climax: ${vtxt}, wide down bar closing off the low after a fall`);
    else if (up && wide && ultra && pos < 0.65 && upTrend) push('BC', 'bear', 3, `Buying climax: ${vtxt}, wide up bar closing off the high after a rally`);
    else if (x.l < lo10 && x.c > lo10 && pos > 0.55 && vr > 1.0) push('SP', 'bull', 3, `Shakeout: dipped under the recent low on ${vtxt} and closed back above it (trap for sellers)`);
    else if (x.h > hi10 && x.c < hi10 && pos < 0.45 && vr > 1.0) push('UT', 'bear', 3, `Upthrust: poked above the recent high on ${vtxt} and closed back below it (trap for breakout buyers)`);
    else if (down && hiV && pos > 0.5 && !wide) push('ST', 'bull', 2, `Stopping volume: ${vtxt} on a down bar that closes mid/high (absorption)`);
    else if (up && wide && hiV && pos > 0.7) push('SOS', 'bull', 2, `Sign of strength: ${vtxt}, wide up bar closing near the high`);
    else if (down && wide && hiV && pos < 0.3) push('SOW', 'bear', 2, `Sign of weakness: ${vtxt}, wide down bar closing near the low`);
    else if (up && narrow && lowV && prior > 0.4 * a) push('ND', 'bear', 1, `No demand: narrow up bar on low volume (${vtxt})`);
    else if (down && narrow && lowV && prior < -0.4 * a) push('NS', 'bull', 1, `No supply: narrow down bar on low volume (${vtxt})`);
    else if (vr > 1.8 && narrow) push('EFF', up ? 'bear' : 'bull', 1, `Effort, no result: ${vtxt} but tiny spread, the move is being absorbed`);
  }

  // score -100..100, recent bars count more
  let raw = 0;
  signals.forEach((sg) => { const rec = 0.4 + 0.6 * ((sg.i - from) / Math.max(1, n - from)); raw += (sg.dir === 'bull' ? 1 : -1) * sg.w * rec; });
  const score = Math.max(-100, Math.min(100, Math.round(raw * 14)));
  const bias: VSA['bias'] = score >= 25 ? 'buy' : score <= -25 ? 'sell' : 'wait';
  const out: VSA = { ok: true, hasVolume, signals: signals.slice(-8), score, bias };

  // ---- reversal model: pattern -> low-volume breakout -> retest -> confirmation candle
  const rev = findReversal(c, signals, a);
  if (rev) {
    out.reversal = rev;
    if (rev.stage === 'confirmed') { out.bias = rev.side; out.score = rev.side === 'buy' ? Math.max(score, 60) : Math.min(score, -60); }
  }
  if (!rev || rev.stage !== 'confirmed' || rev.confirmI === undefined || rev.retestI === undefined || rev.breakoutI === undefined) return out;

  // Execution: only now, after the confirmation candle closed behind the retest.
  const buy = rev.side === 'buy', k = c[rev.confirmI], rt = c[rev.retestI], pad = 0.2 * a;
  const entry = k.c;
  const lowAfter = Math.min(...c.slice(rev.breakoutI, n).map((x) => x.l)), highAfter = Math.max(...c.slice(rev.breakoutI, n).map((x) => x.h));
  let sl = buy ? Math.min(rt.l, lowAfter) - pad : Math.max(rt.h, highAfter) + pad;
  if (Math.abs(entry - sl) < 0.5 * a) sl = buy ? entry - 0.5 * a : entry + 0.5 * a;
  const price = c[n - 1].c;
  if (buy ? price < sl : price > sl) return out; // already failed
  const liq = c.slice(-60).flatMap((x) => [x.h, x.l]);
  const tps = ladder(entry, sl, liq);
  const risk = Math.abs(entry - sl);
  out.setup = {
    side: rev.side, entry, sl, tps, rr: tps.map((p) => Math.abs(p - entry) / risk) as [number, number, number], tag: rev.tag, i: rev.confirmI,
    zoneTop: Math.max(rt.h, rev.level), zoneBottom: Math.min(rt.l, rev.level), level: rev.level, breakoutI: rev.breakoutI, retestI: rev.retestI,
    note: `${VSA_NAMES[rev.tag]} reversal: low-volume breakout of ${rev.level.toFixed(5).replace(/0+$/, '').replace(/\.$/, '')}, retest held, confirmation candle closed. Entry is taken now, not before.`,
  };
  return out;
}

// ---------------------------------------------------------------------------------------------------------
// Looks for the most advanced reversal among the VSA structures of the last 45 candles.
function findReversal(c: Candle[], signals: VsaSignal[], a: number): VsaReversal | undefined {
  const n = c.length;
  // quiet bar: real volume clearly below the recent average
  const quiet = (j: number) => {
    const win = c.slice(Math.max(0, j - 20), j);
    if (win.length < 5) return false;
    const aV = baseVol(win.map((y) => y.v ?? 0));
    return aV > 0 && (c[j].v ?? 0) > 0 && (c[j].v ?? 0) < 0.85 * aV;
  };
  const stageNo = { pattern: 1, breakout: 2, retest: 3, confirmed: 4 } as const;
  let best: VsaReversal | undefined;

  for (const sg of signals) {
    if (!['SC', 'BC', 'NS', 'ND', 'SP', 'UT'].includes(sg.tag) || n - 1 - sg.i > 45) continue;
    const buy = sg.dir === 'bull', p = sg.i, pb = c[p];
    // key level: the top (buy) or bottom (sell) of the structure that has to break
    const back = c.slice(Math.max(0, p - 10), p);
    let level = buy ? pb.h : pb.l;
    if (sg.tag === 'SP' && back.length) level = Math.max(...back.map((x) => x.h));
    if (sg.tag === 'UT' && back.length) level = Math.min(...back.map((x) => x.l));
    const invalidAt = buy ? pb.l - 0.2 * a : pb.h + 0.2 * a;
    const beyond = (x: Candle) => (buy ? x.c > level : x.c < level);
    const dead = (x: Candle) => (buy ? x.c < invalidAt : x.c > invalidAt);

    let bI: number | undefined, rI: number | undefined, cI: number | undefined, badBreak = false, invalid = false;
    for (let j = p + 1; j < n; j++) {
      if (dead(c[j])) { invalid = true; break; }
      if (bI === undefined) {
        if (!beyond(c[j])) continue;
        if (quiet(j)) bI = j;
        else { badBreak = true; } // broke out on heavy volume: not a valid trigger, keep looking for a quiet break
        continue;
      }
      // a close back through the level (more than half an ATR) means the breakout failed
      if (rI === undefined && (buy ? c[j].c < level - 0.5 * a : c[j].c > level + 0.5 * a)) { invalid = true; break; }
      if (rI === undefined) {
        const touched = buy ? c[j].l <= level + 0.3 * a : c[j].h >= level - 0.3 * a;
        const held = buy ? c[j].c >= level - 0.3 * a : c[j].c <= level + 0.3 * a;
        if (touched && held && j > bI) rI = j;
        continue;
      }
      if (cI === undefined && j > rI) {
        const bull = c[j].c > c[j].o, bear = c[j].c < c[j].o;
        const ok = buy ? bull && c[j].c > level && c[j].c > c[j - 1].h : bear && c[j].c < level && c[j].c < c[j - 1].l;
        // the move away from the retest must come on MORE volume than the retest itself (the side we trade is stepping in)
        const rising = (c[j].v ?? 0) > (c[rI].v ?? 0);
        if (ok && rising) cI = j;
      }
    }
    if (invalid) continue;
    // moved far away from the level without a retest: do not chase
    const now = c[n - 1];
    if (bI !== undefined && rI === undefined && Math.abs(now.c - level) > 3 * a) continue;
    // a confirmation older than 6 candles is stale
    if (cI !== undefined && n - 1 - cI > 6) continue;
    // the pattern itself has to be recent if nothing has happened since
    if (bI === undefined && n - 1 - p > 25) continue;

    const stage: VsaStage = cI !== undefined ? 'confirmed' : rI !== undefined ? 'retest' : bI !== undefined ? 'breakout' : 'pattern';
    const name = VSA_NAMES[sg.tag], dirTxt = buy ? 'above' : 'below';
    const lowVol = bI !== undefined;
    const steps: VsaStep[] = [
      { text: `${name} found ${n - 1 - p} candle${n - 1 - p === 1 ? '' : 's'} ago`, ok: true },
      { text: bI !== undefined ? `Low-volume breakout closed ${dirTxt} ${level.toPrecision(7).replace(/\.?0+$/, '')}` : badBreak ? `Price broke ${dirTxt} the level on HEAVY volume: not a valid trigger` : `Waiting for a low-volume breakout ${dirTxt} ${level.toPrecision(7).replace(/\.?0+$/, '')}`, ok: bI !== undefined },
      { text: rI !== undefined ? 'Retest of the broken level held' : 'Waiting for price to retest the broken level', ok: rI !== undefined },
      { text: cI !== undefined ? 'Confirmation candle closed on rising volume: execute' : 'Waiting for the confirmation candle (it must close on more volume than the retest)', ok: cI !== undefined },
    ];
    const next = stage === 'pattern' ? `Wait for a ${buy ? 'close above' : 'close below'} the level on LOW volume.` : stage === 'breakout' ? 'Do not chase. Wait for price to come back and test the broken level.' : stage === 'retest' ? `Wait for a ${buy ? 'bullish' : 'bearish'} candle to close ${dirTxt} the level. Enter only on that close.` : 'All four conditions are met. Execute with the stop beyond the retest.';
    const cand: VsaReversal = { side: buy ? 'buy' : 'sell', tag: sg.tag, stage, stageNo: stageNo[stage], patternI: p, breakoutI: bI, retestI: rI, confirmI: cI, level, invalidAt, steps, next, lowVolBreakout: lowVol, badBreakout: badBreak && bI === undefined };
    if (!best || cand.stageNo > best.stageNo || (cand.stageNo === best.stageNo && cand.patternI > best.patternI)) best = cand;
  }
  return best;
}
