import type { Candle } from './markets';

// =====================================================================================
// All crypto pairs. Binance public market data (no API key, no account).
// REST is polled (prices every 4 s, the open chart every 2 s) which is reliable on phones and cheap.
// If one Binance host is blocked on the phone's network the next one is tried automatically.
// =====================================================================================

export const BN_HOSTS = ['https://data-api.binance.vision', 'https://api.binance.com', 'https://api1.binance.com', 'https://api2.binance.com', 'https://api3.binance.com'];
export const BN_PREFIX = 'bn';
export const isBn = (id: string) => id.startsWith(BN_PREFIX) && /^bn[A-Z0-9]{5,20}$/.test(id);
export const bnRaw = (id: string) => id.slice(BN_PREFIX.length);

// Quote assets worth listing (Binance has many more, but these hold nearly every liquid pair).
export const QUOTES = ['USDT', 'USDC', 'FDUSD', 'BTC', 'ETH', 'BNB', 'EUR', 'TRY'];
const LEVERAGED = /(UP|DOWN|BULL|BEAR)(USDT|USDC|BTC|ETH|BNB)$/;

export type BnPair = { id: string; raw: string; base: string; quote: string; name: string; vol: number; last: number; open: number };

let host = 0;
const to = (ms: number) => { const c = new AbortController(); const t = setTimeout(() => c.abort(), ms); return { signal: c.signal, done: () => clearTimeout(t) }; };

// GET with host rotation: a blocked / slow host moves on to the next one.
export async function bnGet(path: string, ms = 12000): Promise<any> {
  let lastErr: any = null;
  for (let k = 0; k < BN_HOSTS.length; k++) {
    const h = (host + k) % BN_HOSTS.length, t = to(ms);
    try {
      const r = await fetch(BN_HOSTS[h] + path, { signal: t.signal });
      if (r.status === 451 || r.status === 403) throw new Error(`Binance is not available from this network (HTTP ${r.status}).`);
      if (!r.ok) throw new Error(`Binance returned ${r.status}`);
      const j = await r.json();
      host = h; return j;
    } catch (e: any) { lastErr = e; } finally { t.done(); }
  }
  throw new Error(lastErr?.name === 'AbortError' ? 'Binance did not answer in time.' : (lastErr?.message ?? 'Cannot reach Binance.'));
}

// ---------- the full pair list ----------
let pairs: BnPair[] = [], loading: Promise<BnPair[]> | null = null, loadedAt = 0;
export const bnPairs = () => pairs;
export const bnLoaded = () => pairs.length > 0;

const mk = (x: any): BnPair | null => {
  const raw = String(x.symbol ?? '');
  const quote = QUOTES.find((q) => raw.endsWith(q) && raw.length > q.length);
  if (!quote || LEVERAGED.test(raw)) return null;
  const base = raw.slice(0, raw.length - quote.length);
  const last = Number(x.lastPrice), open = Number(x.openPrice), vol = Number(x.quoteVolume);
  if (!isFinite(last) || last <= 0) return null;
  return { id: BN_PREFIX + raw, raw, base, quote, name: `${base}/${quote}`, vol: isFinite(vol) ? vol : 0, last, open: isFinite(open) && open > 0 ? open : last };
};

// All pairs with their 24h change, sorted by traded value (liquid pairs first). Cached for 10 minutes.
export function loadBnPairs(force = false): Promise<BnPair[]> {
  if (!force && pairs.length && Date.now() - loadedAt < 10 * 60000) return Promise.resolve(pairs);
  if (loading) return loading;
  loading = (async () => {
    try {
      const j = await bnGet('/api/v3/ticker/24hr?type=MINI', 25000);
      const list = (Array.isArray(j) ? j : []).map(mk).filter((p): p is BnPair => !!p && p.vol > 0).sort((a, b) => b.vol - a.vol);
      if (list.length) { pairs = list; loadedAt = Date.now(); }
      return pairs;
    } finally { loading = null; }
  })();
  return loading;
}

// ---------- live prices for the pairs a screen is showing ----------
export type BnTick = { price: number; open: number };
export async function bnTickers(raws: string[]): Promise<Record<string, BnTick>> {
  const out: Record<string, BnTick> = {};
  const put = (x: any) => { const p = Number(x.lastPrice), o = Number(x.openPrice); if (isFinite(p) && p > 0) out[String(x.symbol)] = { price: p, open: isFinite(o) && o > 0 ? o : p }; };
  if (!raws.length) return out;
  if (raws.length > 40) { // many rows on screen: one call for everything is cheaper than many small ones
    const j = await bnGet('/api/v3/ticker/24hr?type=MINI', 25000);
    const want = new Set(raws);
    (Array.isArray(j) ? j : []).forEach((x: any) => { if (want.has(String(x.symbol))) put(x); });
    return out;
  }
  const j = await bnGet(`/api/v3/ticker/24hr?type=MINI&symbols=${encodeURIComponent(JSON.stringify(raws))}`);
  (Array.isArray(j) ? j : [j]).forEach(put);
  return out;
}

// ---------- candles ----------
const INTERVAL: Record<number, string> = { 60: '1m', 180: '3m', 300: '5m', 900: '15m', 1800: '30m', 3600: '1h', 7200: '2h', 14400: '4h', 86400: '1d' };
const toCandle = (k: any[]): Candle => ({ t: Math.floor(Number(k[0]) / 1000), o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] });

export async function bnCandles(raw: string, gran: number, limit = 300): Promise<Candle[]> {
  const iv = INTERVAL[gran];
  if (!iv) throw new Error('Timeframe not supported for crypto pairs.');
  const j = await bnGet(`/api/v3/klines?symbol=${raw}&interval=${iv}&limit=${Math.min(1000, limit)}`);
  if (!Array.isArray(j)) throw new Error('Binance returned no candles for this pair.');
  return j.map(toCandle);
}

// Live candles: history once, then the last two candles every 2 s. Returns an unsubscribe function.
export function watchBnCandles(raw: string, gran: number, cb: (c: Candle[]) => void, onErr: (m: string) => void, count = 300): () => void {
  let dead = false, arr: Candle[] = [], timer: any = null, fails = 0;
  const iv = INTERVAL[gran];
  if (!iv) { onErr('Timeframe not supported for crypto pairs.'); return () => {}; }
  const tick = async () => {
    if (dead) return;
    try {
      if (!arr.length) { arr = await bnCandles(raw, gran, count); }
      else {
        const j = await bnGet(`/api/v3/klines?symbol=${raw}&interval=${iv}&limit=2`, 8000);
        (Array.isArray(j) ? j : []).map(toCandle).forEach((c) => {
          const last = arr[arr.length - 1];
          if (last && last.t === c.t) arr = [...arr.slice(0, -1), c]; else if (!last || c.t > last.t) arr = [...arr.slice(-(count - 1)), c];
        });
      }
      fails = 0;
      if (!dead && arr.length) cb(arr);
    } catch (e: any) {
      fails++;
      if (!dead && (!arr.length || fails >= 4)) onErr(e?.message ?? 'Could not load candles.');
    }
    if (!dead) timer = setTimeout(tick, arr.length ? 2000 : 3000);
  };
  tick();
  return () => { dead = true; clearTimeout(timer); };
}

// Biggest movers among liquid pairs (used by the crypto news tab).
export function movers(n = 5) {
  const liquid = pairs.filter((p) => p.quote === 'USDT' && p.vol > 5_000_000);
  const chg = (p: BnPair) => ((p.last - p.open) / p.open) * 100;
  const s = [...liquid].sort((a, b) => chg(b) - chg(a));
  return { up: s.slice(0, n).map((p) => ({ p, chg: chg(p) })), down: s.slice(-n).reverse().map((p) => ({ p, chg: chg(p) })) };
}
