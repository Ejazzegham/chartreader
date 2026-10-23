import type { Candle } from './markets';
import type { All } from './refine';
import { atr } from './ta';
import { planEntry } from './entry';
import { VSA_NAMES } from './vsa';
import type { TopDown } from './topdown';

// =====================================================================================
// Every method looks for its own trade. This collects them all with entry, stop, targets and a 0-100 score,
// so the Scanner can show a setup when ANY method finds one at 70 or more (not only when the methods agree).
//   ICT, SMC, Candlestick, Scalping (supply/demand reversal candle, CRT): the method's own score.
//   VSA: strength of the volume-spread read (only exists after the 4-stage reversal is confirmed).
//   Pattern: the pattern's quality score.
//   Combined: the merged ICT + SMC + VSA + pattern + candle entry from refine.ts.
// Setups that are already over (price through the stop, TP1 reached) or more than 8 ATR away are dropped.
// Setups from different methods that sit on the same entry are merged and list the methods that agree ("also").
// Pure maths, no imports from the app, so the server scanner uses the same rules.
// =====================================================================================
export const SETUP_MIN = 70;

export type MethodSetup = {
  method: 'Combined' | 'ICT' | 'SMC' | 'VSA' | 'Pattern' | 'Candle' | 'Scalp' | 'TopDown';
  label: string;                         // what the method saw, for example "Order block + FVG" or "Head and Shoulders (breakout)"
  side: 'buy' | 'sell'; entry: number; sl: number; tps: [number, number, number]; rr: [number, number, number];
  score: number; grade: 'A+' | 'A' | 'B' | 'C'; zone: [number, number];   // zone = [bottom, top]
  why: string[];                         // the reasons the method gives
  plan: { status: string; label: string; trigger: string; cancelIf: string; distAtr: number; inZone: boolean };
  also: string[];                        // other methods with the same trade
};

const gradeOf = (s: number): MethodSetup['grade'] => (s >= 85 ? 'A+' : s >= 70 ? 'A' : s >= 50 ? 'B' : 'C');
const okTexts = (l: { text: string; ok: boolean }[] = [], n = 4) => l.filter((x) => x.ok).slice(0, n).map((x) => x.text);

// only  = the methods the person ticked in the Scanner (every method when left out). A method that is not listed is not read at all,
//         and it can not show up in another setup's "also" list either.
// extra = setups built elsewhere (Top-Down, see topDownSetup below), merged with the same rules.
export function methodSetups(all: All, c: Candle[], min = SETUP_MIN, only?: MethodSetup['method'][], extra: MethodSetup[] = []): MethodSetup[] {
  const use = (m: MethodSetup['method']) => !only || only.includes(m);
  if (c.length < 45 && !extra.length) return [];
  if (c.length < 45) return mergeSame(extra.map((e) => ({ ...e, also: [] })));
  const a = atr(c), price = c[c.length - 1].c, out: MethodSetup[] = [];
  const fmt = (v: number) => v.toFixed(Math.abs(price) >= 100 ? 2 : Math.abs(price) >= 10 ? 3 : 5);
  const push = (method: MethodSetup['method'], label: string, s: { side: 'buy' | 'sell'; entry: number; sl: number; tps: [number, number, number]; rr: [number, number, number] }, score: number, zBot: number, zTop: number, why: string[], plan?: MethodSetup['plan']) => {
    score = Math.max(0, Math.min(100, Math.round(score)));
    if (!isFinite(score) || score < min || !isFinite(s.entry) || !isFinite(s.sl) || s.entry === s.sl || (s.side === 'buy' ? s.sl >= s.entry : s.sl <= s.entry)) return;
    const p = plan ?? (() => { const e = planEntry(c, s.side, s.entry, s.sl, Math.max(zTop, zBot), Math.min(zTop, zBot), s.tps[0], a, fmt); return { status: e.status, label: e.label, trigger: e.trigger, cancelIf: e.cancelIf, distAtr: e.distAtr, inZone: e.inZone }; })();
    if (p.status === 'invalid' || p.status === 'late' || p.distAtr > 8) return;
    out.push({ method, label, side: s.side, entry: s.entry, sl: s.sl, tps: [...s.tps] as [number, number, number], rr: [...s.rr] as [number, number, number], score, grade: gradeOf(score), zone: [Math.min(zBot, zTop), Math.max(zBot, zTop)], why, plan: p, also: [] });
  };

  const cb = all.combo;
  if (cb && use('Combined')) push('Combined', cb.basis, cb, cb.score, cb.zoneBottom, cb.zoneTop, [...okTexts(cb.checks, 5)], { status: cb.plan.status, label: cb.plan.label, trigger: cb.plan.trigger, cancelIf: cb.plan.cancelIf, distAtr: cb.plan.distAtr, inZone: cb.plan.inZone });
  const i = use('ICT') && all.ict.ok && all.ict.setup?.ready ? all.ict.setup : undefined; // ICT only counts when all 8 questions of the guide are "yes"
  if (i) push('ICT', i.model, i, i.score, i.zoneBottom, i.zoneTop, okTexts(i.confluence));
  const s = use('SMC') && all.smc.ok ? all.smc.setup : undefined;
  if (s) push('SMC', s.model, s, s.score, s.zone.bottom, s.zone.top, okTexts(s.confluence));
  const v = use('VSA') && all.vsa.ok ? all.vsa.setup : undefined;
  if (v) push('VSA', VSA_NAMES[v.tag] ?? 'VSA reversal', v, Math.abs(all.vsa.score), v.zoneBottom, v.zoneTop, [v.note]);
  const p = use('Pattern') && all.pat.ok ? all.pat.setup : undefined;
  if (p) push('Pattern', `${p.pattern.name} (${p.pattern.status})`, p, p.pattern.quality, Math.min(p.entry, p.sl), Math.max(p.entry, p.sl), [p.pattern.note]);
  const d = use('Candle') && all.cdl.ok ? all.cdl.setup : undefined;
  if (d) push('Candle', `${d.pattern.name} (${d.state})`, d, d.score, Math.min(d.entry, d.sl), Math.max(d.entry, d.sl), [d.note, ...okTexts(d.confluence, 3)]);
  const k = use('Scalp') ? all.scalp.setup : undefined;
  if (k && k.state === 'triggered' && k.barsAgo <= 3) push('Scalp', k.model, k, k.score, k.entry - 0.15 * a, k.entry + 0.15 * a, [k.note, ...okTexts(k.confluence, 3)]);

  for (const e of extra) out.push({ ...e, also: [] });
  return mergeSame(out);
}

// merge the same trade seen by several methods: keep the best score, list the others in "also"
function mergeSame(out: MethodSetup[]): MethodSetup[] {
  out.sort((x, y) => y.score - x.score || (x.method === 'Combined' ? -1 : 0));
  const kept: MethodSetup[] = [];
  for (const m of out) {
    const dup = kept.find((q) => q.side === m.side && Math.abs(q.entry - m.entry) <= 0.25 * Math.abs(q.entry - q.sl));
    if (dup) { if (!dup.also.includes(m.method)) dup.also.push(m.method); } else kept.push(m);
  }
  return kept;
}

// Top-Down (4H bias -> 1H zone -> 15m trigger) has its own engine and its own three timeframes (src/topdown.ts), so it is not part of analyzeAll.
// This turns its plan into the same MethodSetup shape. c = the smallest (trigger) timeframe: it gives the live price and the ATR for the entry plan.
// 'skip' verdicts, scores under min, and plans that are over, late or more than 8 ATR away are dropped, the same as for every other method.
export function topDownSetup(td: TopDown, c: Candle[], min = SETUP_MIN): MethodSetup | null {
  const p = td.plan;
  if (!td.ok || !p || td.verdict === 'skip' || c.length < 45) return null;
  const score = Math.max(0, Math.min(100, Math.round(td.score)));
  if (!isFinite(score) || score < min || !isFinite(p.entry) || !isFinite(p.sl) || p.entry === p.sl || (p.side === 'buy' ? p.sl >= p.entry : p.sl <= p.entry)) return null;
  const a = atr(c), price = c[c.length - 1].c;
  if (!isFinite(a) || a <= 0) return null;
  const fmt = (v: number) => v.toFixed(Math.abs(price) >= 100 ? 2 : Math.abs(price) >= 10 ? 3 : 5);
  const e = planEntry(c, p.side, p.entry, p.sl, Math.max(p.zoneTop, p.zoneBottom), Math.min(p.zoneTop, p.zoneBottom), p.tps[0], a, fmt, price);
  if (e.status === 'invalid' || e.status === 'late' || e.distAtr > 8) return null;
  return {
    method: 'TopDown', label: `${p.basis} (${td.verdict === 'ready' ? 'ready' : 'watch'})`, side: p.side, entry: p.entry, sl: p.sl,
    tps: [...p.tps] as [number, number, number], rr: [...p.rr] as [number, number, number], score, grade: gradeOf(score),
    zone: [Math.min(p.zoneTop, p.zoneBottom), Math.max(p.zoneTop, p.zoneBottom)],
    why: [...okTexts(td.checks, 4), ...p.notes.slice(0, 1)],
    plan: { status: e.status, label: e.label, trigger: e.trigger, cancelIf: e.cancelIf, distAtr: e.distAtr, inZone: e.inZone }, also: [],
  };
}
