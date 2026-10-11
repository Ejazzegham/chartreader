import type { All } from './refine';
import type { Candle } from './markets';
import { atr } from './ta';
import { thinLiquidity } from './session';

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
export const ALERT_MIN = 70;      // no alert below this score
export const NEAR_ATR = 1.0;      // "near the entry" means the zone is within this many ATR of price
export const MIN_RR = 1.4;        // first target risk:reward measured from the entry (the engine's own TP1 is 1.5R, snapped targets can be a little less)
export const MIN_AGREE = 3;       // methods that must agree

export type AlertLevel = 'entry' | 'near' | null;
export type Verdict = { level: AlertLevel; agree: string[]; oppose: string[]; blocked: string[] };

export type JudgeCtx = {
  id: string; cat?: string; now: Date; c: Candle[];  // c = the candles the setup was built on (newest last)
  minProb?: number;           // the trader's own level; it can only raise the bar, never go below ALERT_MIN
  newsDanger?: boolean;       // a high-impact release is close (the phone knows the calendar, the server does not)
};

const sideOf = (d?: string | null): 'buy' | 'sell' | null => (d === 'bullish' || d === 'buy' || d === 'bull' ? 'buy' : d === 'bearish' || d === 'sell' || d === 'bear' ? 'sell' : null);

export function judge(all: All, ctx: JudgeCtx): Verdict {
  const cb = all.combo;
  const v: Verdict = { level: null, agree: [], oppose: [], blocked: [] };
  if (!cb) { v.blocked.push(all.why ?? 'No combined setup.'); return v; }
  const side = cb.side, buy = side === 'buy', p = cb.plan;
  const c = ctx.c, a = atr(c), price = c[c.length - 1].c;

  // ---- who agrees and who disagrees (only real reads count: a setup, a bias, a pattern, a candle; a bare trend does not)
  const vote = (name: string, s: 'buy' | 'sell' | null) => { if (s === side) v.agree.push(name); else if (s) v.oppose.push(name); };
  vote('ICT', all.ict.ok ? sideOf(all.ict.setup?.side) : null);
  vote('SMC', all.smc.ok ? sideOf(all.smc.setup?.side) : null);
  vote('VSA', all.vsa.ok ? sideOf(all.vsa.bias) : null);
  vote('Pattern', all.pat.best ? sideOf(all.pat.best.dir) : null);
  vote('Candle', all.cdl.best ? sideOf(all.cdl.best.dir) : null);

  const need = Math.max(ALERT_MIN, ctx.minProb ?? 0);
  if (cb.score < need) v.blocked.push(`Score ${cb.score}% is under the ${need}% needed for an alert.`);
  if (!v.agree.some((m) => m === 'ICT' || m === 'SMC')) v.blocked.push('No ICT or SMC zone gives the entry location.');
  if (v.agree.length < MIN_AGREE) v.blocked.push(`Only ${v.agree.length} of 5 methods agree (need ${MIN_AGREE}).`);
  else if (!v.agree.some((m) => m === 'VSA' || m === 'Pattern' || m === 'Candle')) v.blocked.push('No confirmation from VSA, a chart pattern or a candlestick.');
  if (v.oppose.length) v.blocked.push(`${v.oppose.join(', ')} ${v.oppose.length > 1 ? 'point' : 'points'} the other way.`);
  if (cb.htf === 'against') v.blocked.push('The higher timeframe trend is against this trade.');
  if (cb.rr[0] < MIN_RR - 0.01) v.blocked.push(`First target is only 1:${cb.rr[0].toFixed(1)} (need 1:${MIN_RR}).`);
  if (ctx.newsDanger) v.blocked.push('High-impact news is due: wait until it passes.');
  const thin = thinLiquidity(ctx.id, ctx.cat, ctx.now);
  if (thin) v.blocked.push(thin);

  // ---- timing: running (price in the zone and rejected it) or still approaching it and close
  const zTop = cb.zoneTop, zBot = cb.zoneBottom;
  const away = buy ? Math.max(0, price - zTop) : Math.max(0, zBot - price);            // distance price still has to travel to reach the zone (0 = inside it)
  const through = buy ? price < zBot - 0.1 * a : price > zTop + 0.1 * a;               // beyond the zone, on the stop side
  const touched = c.slice(-10).some((x) => (buy ? x.l <= zTop : x.h >= zBot));         // the zone was reached in the last 10 candles
  if (p.status === 'enter-now') { if (p.rrNow < 1.2) v.blocked.push(`Price moved from the entry: only 1:${p.rrNow.toFixed(1)} left to TP1.`); }
  else if (p.status === 'wait-trigger' || p.status === 'limit') {
    if (through) v.blocked.push('Price is through the zone: the setup is breaking down.');
    else if (!p.inZone && touched && away > 0.5 * a) v.blocked.push('Price already touched the zone and left it: this move is running without you. Wait for a new setup or a return to the zone.');
    else if (!p.inZone && away > NEAR_ATR * a) v.blocked.push(`The zone is ${(away / a).toFixed(1)} ATR away (alerts start within ${NEAR_ATR} ATR).`);
  } else v.blocked.push(p.label + '.');

  if (!v.blocked.length) v.level = p.status === 'enter-now' ? 'entry' : 'near';
  return v;
}

export const levelText = (l: AlertLevel) => (l === 'entry' ? 'Entry now' : l === 'near' ? 'Near entry' : '');
