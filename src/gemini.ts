import { getServer } from './license';
import { hasRealVolume } from './vsa';
// Close split for the 3 take profits and their default distance in R.
import { TP_SPLIT, TP_R } from './tpconst';
export { TP_SPLIT, TP_R };


// ---------------------------------------------------------------------------------------------------------------------
// One shared way to talk to the server's /gemini proxy: uses the server address from Settings, has a time limit,
// turns every failure into a message a trader can understand, and never hands broken data to the screens.
// ---------------------------------------------------------------------------------------------------------------------
const errText = (d: any, status: number): string =>
  typeof d?.error === 'string' ? d.error : d?.error?.message ? String(d.error.message) : status === 401 ? 'Session expired. Log in again.' : status === 402 ? 'Free trial ended. Subscribe to unlock analysis.' : status === 429 ? 'Too many requests. Try again later.' : `Server error (HTTP ${status}).`;

async function askGemini(key: string, model: string, parts: any[]): Promise<string> {
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 90000);
  let res: Response;
  try {
    res = await fetch(`${getServer()}/gemini/${encodeURIComponent(model)}`, {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1', Authorization: 'Bearer ' + key },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0.2 } }),
    });
  } catch (e: any) {
    throw new Error(e?.name === 'AbortError' ? 'The analysis took too long. Check your connection and try again.' : 'Cannot reach the server. Check your internet connection and the server address in Settings.');
  } finally { clearTimeout(to); }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(errText(data, res.status));
  const text: string = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? '';
  if (!text.trim()) throw new Error(data?.promptFeedback?.blockReason ? 'This chart could not be analyzed. Try again in a moment.' : 'The analysis came back empty. Please try again.');
  return text;
}

// The model sometimes wraps JSON in ```fences``` or adds a sentence around it. Take the outermost {...} and parse that.
function parseJson(text: string): any {
  const clean = text.replace(/```json|```/g, '').trim();
  try { return JSON.parse(clean); } catch {}
  const a = clean.indexOf('{'), b = clean.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(clean.slice(a, b + 1)); } catch {} }
  throw new Error('The analysis came back in an unexpected format. Please try again.');
}

// ---- Analysis of the chart: sends the live candles of the open pair to Gemini ----
export type MarketAI = {
  trend: { direction: 'bullish' | 'bearish' | 'sideways'; strength: string; summary: string };
  bias: 'buy' | 'sell' | 'wait'; entry: number; stopLoss: number; takeProfits: number[];
  support: number[]; resistance: number[]; riskReward: string; reasoning: string; warnings: string[];
  ict?: { model: string; grade: string; zone: string; confluence: string[]; poiTop?: number; poiBottom?: number; poiKind?: string };
};

// Exactly 3 take profits, nearest first. Missing ones are extended from the risk distance (1.5R / 2.5R / 4R).
export function fillTPs(entry: number, sl: number, tps: number[]): number[] {
  if (!isFinite(entry) || !isFinite(sl) || entry === sl) return tps.slice(0, 3);
  const s = entry > sl ? 1 : -1, risk = Math.abs(entry - sl);
  const ok = tps.filter((p) => (p - entry) * s > 0).sort((a, b) => s * (a - b)).slice(0, 3);
  for (let i = ok.length; i < 3; i++) ok.push(entry + s * risk * TP_R[i]);
  return ok;
}

export async function analyzeMarket(key: string, model: string, lang: string, symbol: string, tf: string, candles: { o: number; h: number; l: number; c: number; v?: number }[], dec: number, ictCtx = '', volKind = ''): Promise<MarketAI> {
  // REAL traded volume (futures volume for forex / metals / oil, exchange volume for crypto) is sent when the candles carry it, so VSA is read
  // from volume against spread. Without it (synthetic indices, a feed that did not load) the old spread-only wording is kept, and says so.
  const last100 = candles.slice(-100), withVol = hasRealVolume(last100 as any); // same rule as the VSA engine (vsa.ts)
  const rows = last100.map((c) => [...[c.o, c.h, c.l, c.c].map((v) => v.toFixed(dec)), ...(withVol ? [String(Math.round(c.v ?? 0))] : [])].join(' ')).join('\n');
  const cols = withVol ? 'open high low close volume' : 'open high low close';
  const vsaWords = withVol
    ? 'VSA (volume spread analysis: the last column is volume (' + (volKind || 'real traded volume') + '), so judge effort against result: climaxes, no demand / no supply, stopping volume, upthrust, shakeout, effort without result, and whether a breakout came on low or high volume; the forming candle has only PARTIAL volume so never read it as low volume)'
    : 'VSA (spread and close position; no volume is supplied, so only judge spread, close and follow-through)';
  const text = `You are an expert price-action analyst who combines ICT (Inner Circle Trader), SMC (smart money concepts), VSA (volume spread analysis) and classic chart patterns. Below are the latest ${Math.min(100, candles.length)} candles (oldest first) for ${symbol} on the ${tf} timeframe, one per line as "${cols}". The last candle is still forming.
Analyze trend, market structure (HH/HL/LH/LL, BOS, CHoCH/MSS), liquidity (equal highs/lows, sweeps), order blocks, fair value gaps, premium/discount of the dealing range and the OTE zone (62%-79%). Also weigh SMC (decisional order blocks, inducement, breaker blocks), ${vsaWords} and any chart pattern (double top/bottom, head and shoulders, triangles, wedges). Then REFINE the entry: put "entry" at the 50% mean threshold of the best order block or the consequent encroachment of the best FVG that overlaps OTE, put the stop loss beyond that block / swept liquidity, and give EXACTLY 3 take profits (TP1 nearest internal liquidity ~1.5R, TP2 ~2.5R, TP3 external range liquidity ~4R), nearest first.
Use REAL prices taken from the data. All price fields must be plain numbers. If the bias is unclear use "wait" and still give the nearest sensible levels. Be honest about uncertainty in "warnings".
${ictCtx ? `Our local engines (ICT, SMC, VSA, chart patterns) found (verify against the candles, correct anything wrong; where methods overlap, refine the entry there): ${ictCtx}\n` : ''}Write every human-readable text value (strength, summary, riskReward notes, reasoning, warnings, ict.model, ict.confluence) in ${lang}. Keep JSON keys and enum values (bullish, bearish, sideways, buy, sell, wait, A+, A, B, C) in English.
Return ONLY JSON with this exact shape:
{"trend":{"direction":"bullish|bearish|sideways","strength":"","summary":""},"bias":"buy|sell|wait","entry":0,"stopLoss":0,"takeProfits":[0,0,0],"support":[0],"resistance":[0],"riskReward":"","reasoning":"","warnings":[""],
"ict":{"model":"","grade":"A+|A|B|C","zone":"premium|discount|equilibrium","confluence":[""],"poiKind":"OB|FVG","poiTop":0,"poiBottom":0}}
Candles:
${rows}`;
  const a = parseJson(await askGemini(key, model, [{ text }]));
  const nums = (x: any): number[] => (Array.isArray(x) ? x : []).map(Number).filter((n) => isFinite(n));
  const entry = Number(a.entry), stopLoss = Number(a.stopLoss);
  const bias = ['buy', 'sell', 'wait'].includes(a.bias) ? a.bias : 'wait';
  if (bias !== 'wait' && (!isFinite(entry) || !isFinite(stopLoss) || entry === stopLoss)) throw new Error('The analysis returned unusable price levels. Please try again.');
  const i = a.ict;
  const n1 = (x: any) => (x !== undefined && x !== null && isFinite(Number(x)) && Number(x) !== 0 ? Number(x) : undefined);
  return {
    trend: a.trend ?? { direction: 'sideways', strength: '', summary: '' },
    bias, entry, stopLoss, takeProfits: fillTPs(entry, stopLoss, nums(a.takeProfits)),
    support: nums(a.support), resistance: nums(a.resistance),
    riskReward: String(a.riskReward ?? ''), reasoning: String(a.reasoning ?? ''), warnings: Array.isArray(a.warnings) ? a.warnings.map(String) : [],
    ict: i ? { model: String(i.model ?? ''), grade: String(i.grade ?? ''), zone: String(i.zone ?? ''), confluence: Array.isArray(i.confluence) ? i.confluence.map(String) : [], poiTop: n1(i.poiTop), poiBottom: n1(i.poiBottom), poiKind: i.poiKind ? String(i.poiKind) : undefined } : undefined,
  };
}

// ---- Second opinion on the user's own plan (higher / lower / entry / stop loss / take profit) ----
export type PlanAI = { verdict: 'good' | 'okay' | 'weak'; summary: string; improvements: string[]; betterEntry?: number; betterStopLoss?: number; betterTakeProfit?: number };

export async function reviewPlan(key: string, model: string, lang: string, symbol: string, tf: string, candles: { o: number; h: number; l: number; c: number }[], dec: number,
  plan: { higher?: number; lower?: number; entry: number; sl: number; tps: number[] }, engine: string): Promise<PlanAI> {
  const rows = candles.slice(-100).map((c) => [c.o, c.h, c.l, c.c].map((v) => v.toFixed(dec)).join(' ')).join('\n');
  const text = `You are a strict, honest professional trader reviewing a trade plan for ${symbol} on the ${tf} timeframe. Latest candles (oldest first, "open high low close", last candle still forming):
${rows}

The trader's plan: higher price ${plan.higher ?? 'n/a'}, lower price ${plan.lower ?? 'n/a'}, entry ${plan.entry}, stop loss ${plan.sl}, take profits ${plan.tps.map((v, i) => `TP${i + 1} ${v}`).join(', ')} (planned close split 50% / 30% / 20%).
Indicator engine result (trend, RSI, MACD, ATR, swings, risk:reward, hit rate): ${engine}

Judge the plan against the real candles: trend and structure, liquidity and stop hunts, support and resistance, volatility, and whether the entry, stop and target are placed well. Use ICT ideas too (order blocks, fair value gaps, liquidity sweeps, premium/discount, OTE). If a level should move, give a better price taken from the data. Do not flatter the trader. Do not promise profit.
Write summary and improvements in ${lang}. Keep JSON keys and the verdict enum (good, okay, weak) in English. Prices must be plain numbers, or omit the field.
Return ONLY JSON: {"verdict":"good|okay|weak","summary":"","improvements":[""],"betterEntry":0,"betterStopLoss":0,"betterTakeProfit":0}`;
  const a = parseJson(await askGemini(key, model, [{ text }]));
  const num = (x: any) => (x !== undefined && x !== null && isFinite(Number(x)) && Number(x) !== 0 ? Number(x) : undefined);
  return {
    verdict: ['good', 'okay', 'weak'].includes(a.verdict) ? a.verdict : 'okay', summary: String(a.summary ?? ''),
    improvements: Array.isArray(a.improvements) ? a.improvements.map(String) : [],
    betterEntry: num(a.betterEntry), betterStopLoss: num(a.betterStopLoss), betterTakeProfit: num(a.betterTakeProfit),
  };
}
