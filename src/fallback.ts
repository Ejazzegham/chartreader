import { xfetch } from './net';
import type { Candle } from './markets';

// Backup source (Yahoo Finance public chart data) for forex, metals and crypto when the Deriv feed is unreachable.
// Deriv synthetic indices (Volatility, Boom/Crash, Step) exist only on Deriv, so they have no backup.
const YM: Record<string, string> = {
  frxEURUSD: 'EURUSD=X', frxGBPUSD: 'GBPUSD=X', frxUSDJPY: 'USDJPY=X', frxAUDUSD: 'AUDUSD=X', frxUSDCAD: 'USDCAD=X',
  frxUSDCHF: 'USDCHF=X', frxNZDUSD: 'NZDUSD=X', frxEURJPY: 'EURJPY=X', frxGBPJPY: 'GBPJPY=X',
  frxXAUUSD: 'GC=F', frxXAGUSD: 'SI=F', frxDXY: 'DX-Y.NYB',
  frxWTI: 'CL=F', frxBRENT: 'BZ=F', // oil: NYMEX WTI and ICE Brent futures (the futures contract IS the chart, so its volume comes in the same answer)
  // crypto is NOT here on purpose: every crypto price and candle comes from Binance (see crypto.ts cryBn), never from a third price level
};
export const yahooId = (id: string): string | undefined => YM[id];
// Oil is not listed on Deriv under one stable name, so WTI and Brent are read from the futures contract itself.
export const OIL_IDS = ['frxWTI', 'frxBRENT'];
// Pairs that Deriv does not list at all (the US Dollar Index, oil): their price and candles come from this source only, always.
export const yahooOnly = (id: string) => id === 'frxDXY' || OIL_IDS.includes(id);
// Markets whose Yahoo candles carry their OWN exchange volume (the futures contract is the chart). DXY is not one of them: its candles are the spot index.
export const yahooCarriesVolume = (id: string) => OIL_IDS.includes(id);

const RANGE: Record<number, [string, string]> = { 60: ['1m', '1d'], 180: ['1m', '1d'], 300: ['5m', '5d'], 900: ['15m', '5d'], 1800: ['30m', '1mo'], 3600: ['60m', '1mo'], 7200: ['60m', '3mo'], 14400: ['60m', '3mo'], 86400: ['1d', '1y'] };

// Two Yahoo hosts serve the same data: if one is blocked or slow on this network the other is tried (each with its own time limit).
const HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
async function get(y: string, interval: string, range: string): Promise<any> {
  let err: any;
  for (const h of HOSTS) {
    // time limit: without it a silent network made the backup feed wait forever and never retry
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 8000);
    try {
      const r = await xfetch(`https://${h}/v8/finance/chart/${encodeURIComponent(y)}?interval=${interval}&range=${range}`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: ctl.signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (await r.json())?.chart?.result?.[0];
    } catch (e) { err = e; } finally { clearTimeout(to); }
  }
  throw err;
}

export function parseCandles(res: any, gran: number, count = 120): Candle[] {
  const ts: number[] = res?.timestamp ?? [], q = res?.indicators?.quote?.[0];
  if (!q) return [];
  let out: Candle[] = [];
  ts.forEach((t, i) => {
    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i];
    const vol = q.volume?.[i];
    if ([o, h, l, c].every((v) => typeof v === 'number' && isFinite(v))) out.push({ t, o, h, l, c, v: typeof vol === 'number' && vol > 0 ? vol : undefined });
  });
  if (gran === 14400 || gran === 7200 || gran === 180) { // Yahoo has no 4h / 2h / 3m bars: build them from the smaller bars
    const m = new Map<number, Candle>();
    out.forEach((x) => {
      const k = Math.floor(x.t / gran) * gran, b = m.get(k);
      m.set(k, b ? { t: k, o: b.o, h: Math.max(b.h, x.h), l: Math.min(b.l, x.l), c: x.c, v: b.v !== undefined || x.v !== undefined ? (b.v ?? 0) + (x.v ?? 0) : undefined } : { ...x, t: k });
    });
    out = [...m.values()];
  }
  return out.slice(-count);
}

// ---- Gold and silver: the backup source has no SPOT symbol, it serves the COMEX FUTURES contract (GC=F, SI=F).
// Futures trade above spot (gold: usually $5 to $15, and the gap moves). Mixing the two inside one trade makes a setup that was built on futures
// candles "touch" its entry and targets on a spot quote that never got there (or the other way round). So whenever the main feed (Deriv, spot) is seen
// we measure the gap once in a while and take it off every backup price and candle; the backup then lines up with spot / TradingView / your broker.
// When no gap has been measured yet, the backup price is NOT trusted for logged setups or alarms (futAligned = false).
const FUT_PROXY = new Set(['frxXAUUSD', 'frxXAGUSD']);
export const isFutProxy = (id: string) => FUT_PROXY.has(id);
// Forex pairs have a small gap too (Deriv's feed vs the backup, usually a pip or so). It is measured the same way and taken off, but kept only 30 minutes
// (a futures premium is stable for hours, a forex difference is noise) and a forex backup is never blocked while the gap is unknown.
const isGapped = (id: string) => !!YM[id] && !yahooOnly(id);
const GAP_MAX_AGE_FX = 30 * 60e3;
const GAP_MAX_AGE = 6 * 3600e3, GAP_REFRESH = 10 * 60e3, SPOT_FRESH = 90e3;
const spotRef = new Map<string, { p: number; at: number }>(), gapOf = new Map<string, { v: number; at: number }>(), learning = new Set<string>();
export const futGap = (id: string, now = Date.now()): number | undefined => { const g = gapOf.get(id); return g && now - g.at < (FUT_PROXY.has(id) ? GAP_MAX_AGE : GAP_MAX_AGE_FX) ? g.v : undefined; };
export const futAligned = (id: string, now = Date.now()) => !FUT_PROXY.has(id) || futGap(id, now) !== undefined;
export const resetFutGap = () => { spotRef.clear(); gapOf.clear(); learning.clear(); };
// Call this with every fresh price the MAIN (spot) feed gives for the symbol. It keeps the gap up to date in the background.
export function noteSpot(id: string, price: number, now = Date.now()) {
  if (!isGapped(id) || !(price > 0)) return;
  spotRef.set(id, { p: price, at: now });
  const g = gapOf.get(id);
  if (!g || now - g.at > GAP_REFRESH) void learnGap(id);
}
async function learnGap(id: string) {
  if (learning.has(id)) return;
  learning.add(id);
  try {
    const m = (await get(YM[id], '1d', '5d'))?.meta, fut = Number(m?.regularMarketPrice), s = spotRef.get(id);
    if (isFinite(fut) && fut > 0 && s && Date.now() - s.at < SPOT_FRESH && Math.abs(s.p - fut) < s.p * (FUT_PROXY.has(id) ? 0.03 : 0.005)) gapOf.set(id, { v: s.p - fut, at: Date.now() }); // a gap over 3% is bad data, not a premium
  } catch {} finally { learning.delete(id); }
}

export async function yahooCandles(id: string, gran: number, count = 120): Promise<Candle[]> {
  const y = YM[id], rg = RANGE[gran];
  if (!y || !rg) return [];
  const c = parseCandles(await get(y, rg[0], rg[1]), gran, count), g = isGapped(id) ? futGap(id) : undefined;
  return g === undefined ? c : c.map((x) => ({ ...x, o: x.o + g, h: x.h + g, l: x.l + g, c: x.c + g }));
}

// Raw bars of any Yahoo symbol, used ONLY for their volume (CME / COMEX / ICE futures that track a spot pair). Not aggregated here:
// attachVolume() sums them into the chart's candles. Daily candles use hourly bars so the UTC day lines up.
const VRANGE: Record<number, [string, string]> = { 60: ['1m', '1d'], 180: ['1m', '1d'], 300: ['5m', '5d'], 900: ['15m', '5d'], 1800: ['30m', '1mo'], 3600: ['60m', '1mo'], 7200: ['60m', '3mo'], 14400: ['60m', '3mo'], 86400: ['60m', '1y'] };
export async function yahooVolume(y: string, gran: number): Promise<Candle[]> {
  const rg = VRANGE[gran];
  if (!rg) return [];
  const res = await get(y, rg[0], rg[1]), ts: number[] = res?.timestamp ?? [], q = res?.indicators?.quote?.[0];
  if (!q) return [];
  const out: Candle[] = [];
  ts.forEach((t, i) => { const v = q.volume?.[i]; if (typeof v === 'number' && v > 0) out.push({ t, o: 0, h: 0, l: 0, c: 0, v }); });
  return out;
}

// Volume of one futures contract, or of a cross-pair proxy made of its two currency legs (EUR/JPY = EUR futures + JPY futures).
// With two legs a bar is kept only where BOTH legs traded, so a half-sum never sits next to a full one and fakes a volume drop.
export async function yahooVolumeMulti(ys: string[], gran: number): Promise<Candle[]> {
  if (ys.length === 1) return yahooVolume(ys[0], gran);
  const parts = await Promise.all(ys.map((y) => yahooVolume(y, gran).catch(() => [] as Candle[])));
  const sum = new Map<number, { v: number; n: number }>();
  parts.forEach((p) => p.forEach((b) => { const k = sum.get(b.t) ?? { v: 0, n: 0 }; k.v += b.v ?? 0; k.n++; sum.set(b.t, k); }));
  return [...sum.entries()].filter(([, k]) => k.n === ys.length).sort((a, b) => a[0] - b[0]).map(([t, k]) => ({ t, o: 0, h: 0, l: 0, c: 0, v: k.v }));
}

export async function yahooQuote(id: string): Promise<{ price: number; prev: number } | null> {
  const y = YM[id];
  if (!y) return null;
  const m = (await get(y, '1d', '5d'))?.meta;
  const g = isGapped(id) ? futGap(id) ?? 0 : 0; // futures -> spot (gold / silver), backup -> Deriv level (forex)
  const price = Number(m?.regularMarketPrice) + g, prev = Number(m?.chartPreviousClose ?? m?.previousClose) + g;
  return isFinite(price) ? { price, prev: isFinite(prev) ? prev : price } : null;
}
