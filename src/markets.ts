import { useEffect, useState } from 'react';
import { Vibration } from 'react-native';
import { notify as notice, askNotifyPermission } from './dialog';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { yahooId, yahooOnly, yahooQuote, yahooCandles } from './fallback';
import { remote } from './remote';
import { isBn, bnRaw, QUOTES, bnPairs, loadBnPairs, bnTickers, watchBnCandles } from './crypto';
import { IS_WEB } from './net';

// One shared Deriv public WebSocket serves forex, metals, crypto and synthetic indices (no API key needed).
// Deriv's current public feed (no key) first, then the legacy endpoints. The app rotates to the next one when an endpoint is unreachable.
export const EPS = [
  'wss://api.derivws.com/trading/v1/options/ws/public',
  'wss://ws.derivws.com/websockets/v3?app_id=1089',
  'wss://ws.binaryws.com/websockets/v3?app_id=1089',
];
let epIdx = 0;

export type Cat = 'forex' | 'crypto' | 'deriv' | 'indices'; // gold and silver are part of forex now
export type Sym = { id: string; name: string; cat: Cat; sub?: string; quote?: string };
export type Q = { price: number; open: number; dec: number; pts: number[]; dir: number };
export type Candle = { t: number; o: number; h: number; l: number; c: number; v?: number };
export type PriceAlert = { id: string; sym: string; level: number; dir: 'above' | 'below' };

const S = (cat: Cat, l: [string, string][]): Sym[] => l.map(([id, name]) => ({ id, name, cat }));
export const EXTRA: Sym[] = [{ id: 'frxDXY', name: 'DXY (US Dollar Index)', cat: 'forex', sub: 'Index' }];
export const SYMBOLS: Sym[] = [
  ...S('forex', [['frxDXY', 'DXY (US Dollar Index)'], ['frxXAUUSD', 'Gold / USD'], ['frxXAGUSD', 'Silver / USD'], ['frxEURUSD', 'EUR/USD'], ['frxGBPUSD', 'GBP/USD'], ['frxUSDJPY', 'USD/JPY'], ['frxAUDUSD', 'AUD/USD'], ['frxUSDCAD', 'USD/CAD'], ['frxUSDCHF', 'USD/CHF'], ['frxNZDUSD', 'NZD/USD'], ['frxEURJPY', 'EUR/JPY'], ['frxGBPJPY', 'GBP/JPY']]),
  ...S('crypto', [['cryBTCUSD', 'Bitcoin'], ['cryETHUSD', 'Ethereum'], ['cryLTCUSD', 'Litecoin'], ['cryBNBUSD', 'BNB'], ['cryXRPUSD', 'XRP']]),
  ...S('deriv', [['R_100', 'Volatility 100'], ['R_75', 'Volatility 75'], ['R_50', 'Volatility 50'], ['R_25', 'Volatility 25'], ['R_10', 'Volatility 10'], ['1HZ100V', 'Volatility 100 (1s)'], ['BOOM1000', 'Boom 1000'], ['CRASH1000', 'Crash 1000'], ['BOOM500', 'Boom 500'], ['CRASH500', 'Crash 500'], ['BOOM300N', 'Boom 300'], ['CRASH300N', 'Crash 300'], ['BOOM600', 'Boom 600'], ['CRASH600', 'Crash 600'], ['BOOM900', 'Boom 900'], ['CRASH900', 'Crash 900'], ['stpRNG', 'Step Index 100'], ['stpRNG2', 'Step Index 200'], ['stpRNG3', 'Step Index 300'], ['stpRNG4', 'Step Index 400'], ['stpRNG5', 'Step Index 500'], ['JD10', 'Jump 10'], ['JD25', 'Jump 25'], ['JD50', 'Jump 50'], ['JD75', 'Jump 75'], ['JD100', 'Jump 100']]),
];
// MetaTrader 5 names. Every one of these is a granularity that Deriv serves and a TradingView interval.
export const TFS: { k: string; label: string }[] = [
  { k: '60', label: 'M1' }, { k: '180', label: 'M3' }, { k: '300', label: 'M5' }, { k: '900', label: 'M15' }, { k: '1800', label: 'M30' },
  { k: '3600', label: 'H1' }, { k: '7200', label: 'H2' }, { k: '14400', label: 'H4' }, { k: '86400', label: 'D1' },
];
// Time left until the running candle closes (candles start on multiples of their length, in UTC).
export const candleLeft = (gran: number, nowMs = Date.now()) => gran - (Math.floor(nowMs / 1000) % gran);
export const fmtLeft = (sec: number) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60, p = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
};
// A pair that is not in the list (e.g. picked inside the Deriv chart) still gets a readable name and the right category,
// so it can be starred, shown in the watchlist and opened again.
const guess = (id: string): Sym => {
  let m: RegExpMatchArray | null;
  if (isBn(id)) { const raw = bnRaw(id), q = QUOTES.find((x) => raw.endsWith(x) && raw.length > x.length); return { id, name: q ? `${raw.slice(0, -q.length)}/${q}` : raw, cat: 'crypto', sub: 'Binance', quote: q }; }
  if (id.startsWith('frx')) return { id, name: id.length === 9 ? `${id.slice(3, 6)}/${id.slice(6)}` : id.slice(3), cat: 'forex' };
  if (id.startsWith('cry')) return { id, name: id.slice(3), cat: 'crypto' };
  if ((m = id.match(/^stpRNG(\d?)$/))) return { id, name: `Step Index ${(Number(m[1]) || 1) * 100}`, cat: 'deriv' };
  if ((m = id.match(/^JD(\d+)$/))) return { id, name: `Jump ${m[1]}`, cat: 'deriv' };
  if ((m = id.match(/^R_(\d+)$/))) return { id, name: `Volatility ${m[1]}`, cat: 'deriv' };
  if ((m = id.match(/^1HZ(\d+)V$/))) return { id, name: `Volatility ${m[1]} (1s)`, cat: 'deriv' };
  if ((m = id.match(/^(BOOM|CRASH)(\d+)N?$/))) return { id, name: `${m[1] === 'BOOM' ? 'Boom' : 'Crash'} ${m[2]}`, cat: 'deriv' };
  return { id, name: id, cat: 'deriv' };
};
export const symOf = (id: string): Sym => SYMBOLS.find((s) => s.id === id) ?? guess(id);
export const nameOf = (id: string) => symOf(id).name;

// ---- shared state (mutated in place, components re-render through useFeed) ----
export const quotes: Record<string, Q> = {};
const opens: Record<string, number> = {};
const bad = new Set<string>();
const closedSet = new Set<string>();
export const flags = { status: 'connecting' as 'connecting' | 'live' | 'offline', got: false, lastTick: 0, backup: false };
export const db = { favs: ['frxEURUSD', 'cryBTCUSD', 'frxXAUUSD', 'R_100'] as string[], alerts: [] as PriceAlert[] };
export const isBad = (id: string) => bad.has(id);
export const isClosed = (id: string) => closedSet.has(id);
export const chg = (id: string) => {
  const q = quotes[id];
  if (!q) return 0;
  const o = opens[id] ?? q.open;
  return o ? ((q.price - o) / o) * 100 : 0;
};

const listeners = new Set<() => void>();
export const subscribeFeed = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
let notifyT: any = null;
const notify = () => {
  if (notifyT) return;
  notifyT = setTimeout(() => { notifyT = null; listeners.forEach((f) => f()); }, 200);
};

// ---- persistence: watchlist + alerts ----
let loaded = false;
const load = async () => {
  if (loaded) return;
  loaded = true;
  try {
    const f = await AsyncStorage.getItem('mk_favs');
    if (f) db.favs = JSON.parse(f);
    const a = await AsyncStorage.getItem('mk_alerts');
    if (a) db.alerts = JSON.parse(a);
  } catch {}
  notify(); remote.queue();
};
const persist = () => {
  AsyncStorage.setItem('mk_favs', JSON.stringify(db.favs)).catch(() => {});
  AsyncStorage.setItem('mk_alerts', JSON.stringify(db.alerts)).catch(() => {});
  remote.queue(); // the server keeps a copy, so it can ring the phone while the app is closed
};
export const toggleFav = (id: string) => {
  db.favs = db.favs.includes(id) ? db.favs.filter((x) => x !== id) : [...db.favs, id];
  persist(); notify();
};
export const addAlert = (sym: string, level: number, dir: 'above' | 'below') => {
  askNotifyPermission(); // browser only: ask once for desktop notifications when the first alert is set
  db.alerts = [...db.alerts, { id: String(Date.now()), sym, level, dir }];
  persist(); notify();
};
export const removeAlert = (id: string) => { db.alerts = db.alerts.filter((a) => a.id !== id); persist(); notify(); };

remote.source(() => db.alerts.map((a) => ({ ...a, name: nameOf(a.sym) })));
remote.fired((ids) => { const n = db.alerts.length; db.alerts = db.alerts.filter((a) => !ids.includes(a.id)); if (db.alerts.length !== n) { persist(); notify(); } });
const checkAlerts = (sym: string, p: number) => {
  const hit = db.alerts.filter((a) => a.sym === sym && (a.dir === 'above' ? p >= a.level : p <= a.level));
  if (!hit.length) return;
  db.alerts = db.alerts.filter((a) => !hit.includes(a));
  persist();
  Vibration.vibrate(400);
  hit.forEach((a) => notice('Price alert', `${nameOf(a.sym)} ${a.dir === 'above' ? '≥' : '≤'} ${a.level}\nNow: ${p}`));
};

// ---- socket with request queue (spaced out to respect rate limits) ----
type H = { msg: any; cb: (d: any) => void; once: boolean };
const hs = new Map<number, H>();
let ws: WebSocket | null = null, nid = 1, users = 0, queue: number[] = [];
let drain: any = null, stopT: any = null, retryT: any = null;

const pump = () => {
  if (drain || !ws || ws.readyState !== 1) return;
  drain = setInterval(() => {
    const id = queue.shift();
    if (id === undefined || !ws || ws.readyState !== 1) { clearInterval(drain); drain = null; return; }
    const h = hs.get(id);
    if (h) ws.send(JSON.stringify({ ...h.msg, req_id: id }));
  }, 100);
};
const enqueue = (id: number, first = false) => { if (first) queue.unshift(id); else queue.push(id); pump(); };
const req = (msg: any, cb: (d: any) => void, once = false, first = false) => {
  const id = nid++;
  hs.set(id, { msg, cb, once });
  enqueue(id, first);
  return id;
};

// Symbols are subscribed on demand (only what a screen is showing), so 100+ Deriv symbols never flood the socket.
const watchers = new Map<string, string[]>();
const tickReq = new Map<string, number>(); // symbol -> request id
const tickSub = new Map<string, string>(); // symbol -> Deriv subscription id
const histAsked = new Set<string>();
const forget = (sub: string) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ forget: sub })); };

export function setWatch(key: string, ids: string[]) {
  if (ids.length) watchers.set(key, ids); else watchers.delete(key);
  const want = new Set<string>(), wantBn = new Set<string>();
  const wantY = new Set<string>();
  watchers.forEach((v) => v.forEach((x) => { if (isBn(x)) wantBn.add(bnRaw(x)); else if (yahooOnly(x)) wantY.add(x); else want.add(x); })); // Binance pairs and DXY have their own price pollers
  yWanted = [...wantY];
  if (yWanted.length && !yTimer && !yBusy) yLoop(); else if (!yWanted.length && yTimer) { clearTimeout(yTimer); yTimer = null; }
  bnWanted = [...wantBn];
  if (bnWanted.length && !bnTimer) bnLoop(); else if (!bnWanted.length && bnTimer) { clearTimeout(bnTimer); bnTimer = null; }
  const fresh = [...want].filter((id) => !tickReq.has(id));
  fresh.forEach((id) => tickReq.set(id, req({ ticks: id, subscribe: 1 }, () => {})));
  fresh.filter((id) => !histAsked.has(id)).forEach((id) => {
    histAsked.add(id);
    req({ ticks_history: id, count: 1, end: 'latest', style: 'candles', granularity: 86400 }, (d) => onDaily(id, d), true);
  });
  [...tickReq.entries()].forEach(([id, rid]) => {
    if (want.has(id)) return;
    hs.delete(rid); tickReq.delete(id);
    const sub = tickSub.get(id); tickSub.delete(id);
    if (sub) forget(sub);
  });
}

// ---- pairs Deriv does not list (DXY): price from the Yahoo source every 15 s ----
let yWanted: string[] = [], yTimer: any = null, yBusy = false;
const yLoop = async () => {
  yTimer = null;
  if (!yWanted.length || yBusy) return;
  yBusy = true;
  for (const id of yWanted) {
    try {
      const r = await yahooQuote(id), o = quotes[id];
      if (!r) continue;
      opens[id] = r.prev;
      quotes[id] = { price: r.price, open: r.prev, dec: o?.dec ?? decOf(r.price), pts: [...(o?.pts ?? []), r.price].slice(-40), dir: o ? Math.sign(r.price - o.price) || o.dir : 0 };
      checkAlerts(id, r.price);
    } catch {}
  }
  yBusy = false; notify();
  if (yWanted.length) yTimer = setTimeout(yLoop, 15000);
};

// ---- Binance crypto pairs (every pair, no key) ----
export const bnState = { ok: false, err: '', loaded: false, count: 0 };
export const priceDec = (p: number) => Math.max(2, Math.min(10, 4 - Math.floor(Math.log10(p || 1))));
const bnDec = priceDec;
let bnWanted: string[] = [], bnTimer: any = null, bnBusy = false;
const bnLoop = async () => {
  bnTimer = null;
  if (!bnWanted.length) return;
  if (!bnBusy) {
    bnBusy = true;
    try {
      const r = await bnTickers(bnWanted);
      Object.entries(r).forEach(([raw, tk]) => {
        const id = 'bn' + raw, o = quotes[id];
        opens[id] = tk.open;
        quotes[id] = { price: tk.price, open: tk.open, dec: bnDec(tk.price), pts: [...(o?.pts ?? []), tk.price].slice(-40), dir: o ? Math.sign(tk.price - o.price) || o.dir : 0 };
        checkAlerts(id, tk.price);
      });
      bnState.ok = true; bnState.err = '';
    } catch (e: any) { bnState.ok = false; bnState.err = e?.message ?? 'Cannot reach Binance.'; }
    bnBusy = false; notify();
  }
  bnTimer = setTimeout(bnLoop, bnWanted.length > 40 ? 10000 : 4000); // a long list refreshes slower (one big request)
};
// Adds every Binance pair to the symbol list and seeds a price + 24h change for each, so the lists show numbers immediately.
const mergeBn = () => {
  const list = bnPairs();
  if (!list.length) return;
  for (let i = SYMBOLS.length - 1; i >= 0; i--) if (isBn(SYMBOLS[i].id)) SYMBOLS.splice(i, 1);
  SYMBOLS.push(...list.map((p) => ({ id: p.id, name: p.name, cat: 'crypto' as Cat, sub: 'Binance', quote: p.quote })));
  list.forEach((p) => { if (!quotes[p.id]) { quotes[p.id] = { price: p.last, open: p.open, dec: bnDec(p.last), pts: [], dir: 0 }; opens[p.id] = p.open; } });
  bnState.loaded = true; bnState.count = list.length; notify();
};
export const loadCrypto = (force = false) => loadBnPairs(force).then(mergeBn).catch((e: any) => { bnState.err = e?.message ?? 'Cannot reach Binance.'; notify(); });

const onTick = (d: any) => {
  const tk = d.tick;
  if (!tk) return;
  if (!tickReq.has(tk.symbol)) { if (d.subscription?.id) forget(d.subscription.id); return; } // no longer watched
  if (d.subscription?.id) tickSub.set(tk.symbol, d.subscription.id);
  const price = Number(tk.quote), o = quotes[tk.symbol];
  quotes[tk.symbol] = {
    price, open: o?.open ?? price, dec: tk.pip_size ?? o?.dec ?? 2,
    pts: [...(o?.pts ?? []), price].slice(-40), dir: o ? Math.sign(price - o.price) || o.dir : 0,
  };
  closedSet.delete(tk.symbol);
  flags.lastTick = Date.now(); flags.backup = false;
  checkAlerts(tk.symbol, price);
  notify();
};
const onDaily = (id: string, d: any) => {
  const c = d.candles?.[0];
  if (!c) return;
  opens[id] = Number(c.open);
  if (!quotes[id]) quotes[id] = { price: Number(c.close), open: Number(c.open), dec: d.pip_size ?? 4, pts: [], dir: 0 };
  notify();
};

const subs = new Map<string, number>(); // Deriv subscription id -> request id (routes candle streams)
const decOf = (p: number) => (p >= 1000 ? 2 : p >= 100 ? 3 : p >= 10 ? 4 : p >= 1 ? 5 : 6);
let fbT: any = null;
const fbLoop = async () => {
  fbT = null;
  if (users === 0 && !db.alerts.length) return;
  if (Date.now() - flags.lastTick > 15000) { // Deriv is not delivering ticks: fill forex/metals/crypto from the backup source
    for (const s of SYMBOLS.filter((x) => tickReq.has(x.id))) {
      if (!yahooId(s.id)) continue;
      try {
        const r = await yahooQuote(s.id), o = quotes[s.id];
        if (!r) continue;
        opens[s.id] = r.prev;
        quotes[s.id] = { price: r.price, open: r.prev, dec: o?.dec ?? decOf(r.price), pts: [...(o?.pts ?? []), r.price].slice(-40), dir: o ? Math.sign(r.price - o.price) || o.dir : 0 };
        flags.backup = true; checkAlerts(s.id, r.price);
      } catch {}
    }
    notify();
  }
  fbT = setTimeout(fbLoop, 20000);
};

// Full live symbol list from Deriv (all forex, synthetic indices, crypto, commodities, indices), grouped by submarket.
const catOf = (m: string): Cat | undefined => {
  const x = String(m).toLowerCase();
  return x.includes('forex') ? 'forex' : x.includes('synthetic') ? 'deriv' : x.includes('crypto') ? 'crypto' : x.includes('commod') ? 'forex' : x.includes('indic') ? 'indices' : undefined;
};
let catalogLoaded = false, catId = 0, catTry = 0;
export const catalog = { loaded: false, count: 0 };
const CAT_REQS = [{ active_symbols: 'brief', product_type: 'basic' }, { active_symbols: 'brief' }, { active_symbols: 'full' }];
const onCatalog = (d: any) => {
  if (d.error && catTry < CAT_REQS.length - 1) { catTry++; askCatalog(true); return; } // try the next request variant
  const next: Sym[] = [];
  (d.active_symbols ?? []).forEach((x: any) => {
    const cat = catOf(x.market);
    if (!cat || !x.symbol) return;
    if (x.exchange_is_open === 0) closedSet.add(x.symbol);
    next.push({ id: x.symbol, name: x.display_name ?? x.symbol, cat, sub: x.submarket_display_name });
  });
  if (!next.length) return;
  next.sort((p, q) => (p.sub ?? '').localeCompare(q.sub ?? '') || p.name.localeCompare(q.name, undefined, { numeric: true }));
  const keepBn = SYMBOLS.filter((x) => isBn(x.id));
  const extra = EXTRA.filter((e) => !next.some((n) => n.id === e.id)); // pairs Deriv does not list (DXY)
  SYMBOLS.splice(0, SYMBOLS.length, ...extra, ...next, ...keepBn);
  catalogLoaded = true; catalog.loaded = true; catalog.count = next.length;
  notify();
};
const askCatalog = (force = false) => {
  if (catalogLoaded) return;
  if (!force) { if (hs.has(catId)) return; catTry = 0; }
  catId = req(CAT_REQS[catTry], onCatalog, true, true);
};
const initBase = () => { askCatalog(); };

const connect = () => {
  flags.status = 'connecting'; notify();
  const w = new WebSocket(EPS[epIdx]);
  ws = w;
  let heard = false;
  const fail = () => {
    if (ws !== w) return;
    ws = null; clearTimeout(guard); clearInterval(drain); drain = null; flags.status = 'offline'; notify();
    try { w.close(); } catch {}
    if (!heard) epIdx = (epIdx + 1) % EPS.length; // endpoint unreachable or silent: try the next one
    if (users > 0 || db.alerts.length) retryT = setTimeout(connect, heard ? 3000 : 700);
  };
  const guard = setTimeout(() => { if (!heard) fail(); }, 8000);
  w.onopen = () => {
    flags.status = 'live';
    askCatalog();
    const ids = [...hs.keys()], top = (i: number) => i === catId || !!(hs.get(i)?.msg.style === 'candles' && hs.get(i)?.msg.subscribe);
    queue = [...ids.filter(top), ...ids.filter((i) => !top(i))]; // symbol list and chart streams first
    pump(); notify();
  };
  w.onmessage = (e) => {
    let d: any;
    try { d = JSON.parse(String(e.data)); } catch { return; }
    heard = true; flags.got = true;
    if (d.tick) { onTick(d); return; } // ticks are routed by their payload, not by request id
    const id: number | undefined = d.req_id ?? d.echo_req?.req_id ?? (d.ohlc?.id ? subs.get(d.ohlc.id) : undefined);
    const h = id ? hs.get(id) : undefined;
    if (d.error) {
      const code = d.error.code, sym = h?.msg.ticks ?? h?.msg.ticks_history;
      if (code === 'RateLimit' && id && h) { setTimeout(() => enqueue(id), 3000); return; }
      if (sym && code === 'InvalidSymbol') bad.add(sym);
      if (sym && code === 'MarketIsClosed') closedSet.add(sym);
      notify();
    }
    if (h) { h.cb(d); if (h.once && id) hs.delete(id); }
  };
  w.onclose = fail;
  w.onerror = () => {};
};

const start = () => {
  clearTimeout(stopT);
  initBase();
  if (!bnState.loaded) loadCrypto();
  if (!ws) { clearTimeout(retryT); connect(); }
  if (!fbT) fbT = setTimeout(fbLoop, 8000);
};
const stop = () => {
  clearTimeout(stopT);
  stopT = setTimeout(() => {
    if (users > 0 || db.alerts.length) return; // keep running while alerts are armed
    clearTimeout(retryT); clearTimeout(fbT); fbT = null; clearTimeout(bnTimer); bnTimer = null; clearTimeout(yTimer); yTimer = null;
    const w = ws; ws = null; clearInterval(drain); drain = null;
    w?.close(); flags.status = 'offline'; notify();
  }, 5000);
};

export function useFeed(active = true) {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    listeners.add(f); load();
    return () => { listeners.delete(f); };
  }, []);
  useEffect(() => {
    if (!active) return;
    users++; start();
    return () => { users--; if (users === 0) stop(); };
  }, [active]);
  return { quotes, db, status: flags.status };
}

const NODATA = 'No chart data received. Check your internet connection (or VPN) and tap Retry.';

// Live candles from Deriv (history, then streaming). If Deriv stays silent for 6s, forex/metals/crypto fall back
// to the backup source (refreshed every 10s). Returns an unsubscribe function.
export function watchCandles(sym: string, gran: number, cb: (c: Candle[]) => void, onErr: (m: string) => void, onSrc?: (s: 'deriv' | 'backup' | 'binance') => void, count = 120) {
  if (isBn(sym)) { // crypto pairs come from Binance, not Deriv
    return watchBnCandles(bnRaw(sym), gran, (c) => { onSrc?.('binance'); cb(c); }, onErr, count);
  }
  if (yahooOnly(sym)) { // DXY: not on Deriv, so skip the 6 s wait and read the Yahoo source straight away
    let off = false, t: any = null, first = true;
    const run = async () => {
      try { const c = await yahooCandles(sym, gran, count); if (off) return; if (c.length > 1) { onSrc?.('backup'); cb(c); } else if (first) onErr(NODATA); } catch { if (first && !off) onErr(NODATA); }
      first = false;
      if (!off) t = setTimeout(run, 10000);
    };
    run();
    return () => { off = true; clearTimeout(t); };
  }
  let arr: Candle[] = [], subId = '', dead = false, got = false, fbTimer: any = null;
  if (!ws) { initBase(); clearTimeout(retryT); connect(); }
  const id = req({ ticks_history: sym, adjust_start_time: 1, count, end: 'latest', style: 'candles', granularity: gran, subscribe: 1 }, (d) => {
    if (dead) return;
    if (d.error) { if (!yahooId(sym)) onErr(d.error.message); return; }
    if (d.subscription?.id) { subId = d.subscription.id; subs.set(subId, id); }
    if (d.candles) arr = d.candles.map((x: any) => ({ t: x.epoch, o: +x.open, h: +x.high, l: +x.low, c: +x.close }));
    else if (d.ohlc) {
      const o = d.ohlc, c: Candle = { t: +o.open_time, o: +o.open, h: +o.high, l: +o.low, c: +o.close };
      const last = arr[arr.length - 1];
      arr = last && last.t === c.t ? [...arr.slice(0, -1), c] : [...arr.slice(-(count - 1)), c];
    } else return;
    if (!got) { got = true; clearTimeout(waitT); clearTimeout(fbTimer); onSrc?.('deriv'); }
    cb(arr);
  }, false, true); // chart requests jump ahead of the startup queue

  const fb = async (first: boolean) => {
    if (dead || got) return;
    try {
      const c = await yahooCandles(sym, gran, count);
      if (dead || got) return;
      if (c.length > 1) { onSrc?.('backup'); cb(c); } else if (first) onErr(NODATA);
    } catch { if (first && !dead && !got) onErr(NODATA); }
    if (!dead && !got) fbTimer = setTimeout(() => fb(false), 10000);
  };
  const waitT = setTimeout(() => { if (got || dead) return; if (yahooId(sym)) fb(true); else onErr(NODATA); }, 6000);

  return () => {
    dead = true; hs.delete(id); clearTimeout(waitT); clearTimeout(fbTimer);
    if (subId) { subs.delete(subId); if (ws && ws.readyState === 1) ws.send(JSON.stringify({ forget: subId })); }
  };
}

// ---- forex sessions (approximate UTC hours, no daylight-saving adjustment) ----
export const SESSIONS = [{ n: 'Sydney', s: 21, e: 6 }, { n: 'Tokyo', s: 0, e: 9 }, { n: 'London', s: 7, e: 16 }, { n: 'New York', s: 12, e: 21 }];
export const sessionOpen = (h: number, s: number, e: number) => (s < e ? h >= s && h < e : h >= s || h < e);
export const fxWeekendClosed = (d: Date) => {
  const day = d.getUTCDay(), h = d.getUTCHours();
  return day === 6 || (day === 5 && h >= 21) || (day === 0 && h < 21);
};

// ---- connection checker: shows exactly which service is unreachable from this phone ----
export type Diag = { name: string; ok: boolean; detail: string };
export async function runDiagnostics(): Promise<Diag[]> {
  const wsTest = (url: string, name: string) => new Promise<Diag>((res) => {
    const t0 = Date.now();
    let done = false, to: any = null, w: WebSocket | null = null;
    const fin = (ok: boolean, detail: string) => { if (done) return; done = true; clearTimeout(to); try { w?.close(); } catch {} res({ name, ok, detail }); };
    to = setTimeout(() => fin(false, 'No answer in 8s (blocked network, VPN or firewall?)'), 8000);
    try {
      w = new WebSocket(url);
      w.onopen = () => w?.send(JSON.stringify({ time: 1 }));
      w.onmessage = (e) => {
        try { const d = JSON.parse(String(e.data)); if (d.error) fin(false, d.error.message ?? 'Error reply'); else fin(true, `Connected in ${Date.now() - t0} ms`); } catch { fin(false, 'Unreadable reply'); }
      };
      w.onerror = () => fin(false, 'Connection error');
      w.onclose = () => fin(false, 'Connection closed');
    } catch (e: any) { fin(false, e?.message ?? 'Cannot open socket'); }
  });
  const http = async (name: string, url: string): Promise<Diag> => {
    const t0 = Date.now();
    try {
      const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 8000);
      try {
        const r = IS_WEB ? await fetch(url, { mode: 'no-cors', signal: ctl.signal }) : await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: ctl.signal });
        return { name, ok: r.ok || r.type === 'opaque', detail: r.type === 'opaque' ? `Reachable in ${Date.now() - t0} ms` : `HTTP ${r.status} in ${Date.now() - t0} ms` };
      } finally { clearTimeout(to); }
    } catch (e: any) { return { name, ok: false, detail: e?.name === 'AbortError' ? 'No answer in 8s (blocked network, VPN or firewall?)' : (e?.message ?? 'Network error') }; }
  };
  return Promise.all([
    wsTest(EPS[0], 'Deriv live feed (new API)'),
    wsTest(EPS[1], 'Deriv live feed (legacy)'),
    wsTest(EPS[2], 'Deriv live feed (binary.com)'),
    http('TradingView', 'https://s3.tradingview.com/tv.js'),
    http('Deriv Charts', 'https://charts.deriv.com/deriv'),
    http('Binance (all crypto pairs)', 'https://data-api.binance.vision/api/v3/ping'),
    http('Backup feed (Yahoo)', 'https://query1.finance.yahoo.com/v8/finance/chart/EURUSD=X?interval=1d&range=5d'),
  ]);
}
