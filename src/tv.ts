import { SYMBOLS, symOf } from './markets';
import type { Sym } from './markets';
import { isBn, bnRaw } from './crypto';

export const DERIV_CHARTS = 'https://charts.deriv.com/deriv';
export const TV_INTERVAL: Record<string, string> = { '60': '1', '180': '3', '300': '5', '900': '15', '1800': '30', '3600': '60', '7200': '120', '14400': '240', '86400': 'D' };

// Deriv symbol -> TradingView symbol. Deriv indices use TradingView's DERIV: exchange, named from the display name
// (e.g. "Volatility 100 (1s) Index" -> DERIV:VOLATILITY_100_1S_INDEX, "Boom 1000 Index" -> DERIV:BOOM_1000_INDEX).
// Markets that are not a 6-letter currency pair (the dollar index and oil) have their own TradingView symbols.
const TV_FIXED: Record<string, string> = { frxDXY: 'TVC:DXY', frxWTI: 'TVC:USOIL', frxBRENT: 'TVC:UKOIL', frxBROUSD: 'TVC:UKOIL',
  OTC_SPC: 'SP:SPX', OTC_NDX: 'NASDAQ:NDX', OTC_DJI: 'DJ:DJI', OTC_GDAXI: 'XETR:DAX', OTC_FTSE: 'TVC:UKX', OTC_FCHI: 'TVC:CAC40', OTC_N225: 'TVC:NI225', OTC_HSI: 'TVC:HSI', OTC_AS51: 'ASX:XJO', OTC_AEX: 'TVC:AEX', OTC_IBEX35: 'TVC:IBEX35', OTC_SX5E: 'TVC:SX5E', OTC_SSMI: 'TVC:SMI' };
export function tvSymbol(s: Sym): string | null {
  const id = s.id;
  if (TV_FIXED[id]) return TV_FIXED[id];
  if (id.startsWith('frx')) {
    const p = id.slice(3);
    if (!/^[A-Z]{6}$/.test(p)) return null;
    return /^(XAU|XAG|XPT|XPD)/.test(p) ? `OANDA:${p}` : `FX:${p}`;
  }
  if (isBn(id)) return `BINANCE:${bnRaw(id)}`;
  if (id.startsWith('cry')) return `BINANCE:${id.slice(3).replace(/USD$/, '')}USDT`;
  if (s.cat === 'deriv') return 'DERIV:' + s.name.toUpperCase().replace(/\(1S\)/, '1S').replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return null;
}

export type TvStudy = { k: string; label: string; id: string; g: 'trend' | 'momentum' | 'volatility' | 'volume' };
export const TV_STUDIES: TvStudy[] = [
  { k: 'ema', label: 'EMA 50', id: 'MAExp@tv-basicstudies', g: 'trend' }, { k: 'sma', label: 'SMA 50', id: 'MASimple@tv-basicstudies', g: 'trend' },
  { k: 'ichi', label: 'Ichimoku', id: 'IchimokuCloud@tv-basicstudies', g: 'trend' }, { k: 'sar', label: 'Parabolic SAR', id: 'PSAR@tv-basicstudies', g: 'trend' },
  { k: 'adx', label: 'ADX', id: 'ADX@tv-basicstudies', g: 'trend' }, { k: 'vwap', label: 'VWAP', id: 'VWAP@tv-basicstudies', g: 'trend' },
  { k: 'rsi', label: 'RSI', id: 'RSI@tv-basicstudies', g: 'momentum' }, { k: 'macd', label: 'MACD', id: 'MACD@tv-basicstudies', g: 'momentum' },
  { k: 'stoch', label: 'Stochastic', id: 'Stochastic@tv-basicstudies', g: 'momentum' }, { k: 'cci', label: 'CCI', id: 'CCI@tv-basicstudies', g: 'momentum' },
  { k: 'bb', label: 'Bollinger Bands', id: 'BB@tv-basicstudies', g: 'volatility' }, { k: 'atr', label: 'ATR', id: 'ATR@tv-basicstudies', g: 'volatility' },
  { k: 'kc', label: 'Keltner Channels', id: 'KeltnerChannels@tv-basicstudies', g: 'volatility' },
  { k: 'vol', label: 'Volume', id: 'Volume@tv-basicstudies', g: 'volume' }, { k: 'obv', label: 'On Balance Volume', id: 'OBV@tv-basicstudies', g: 'volume' },
  { k: 'mfi', label: 'Money Flow', id: 'MFI@tv-basicstudies', g: 'volume' },
];
export const TV_GROUPS: { g: TvStudy['g']; label: string }[] = [
  { g: 'trend', label: 'Trend' }, { g: 'momentum', label: 'Momentum' }, { g: 'volatility', label: 'Volatility' }, { g: 'volume', label: 'Volume' },
];
// TradingView chart styles (the `style` option of the widget).
export const TV_STYLES: { k: string; label: string; icon: string }[] = [
  { k: '1', label: 'Candles', icon: 'bar-chart-outline' }, { k: '9', label: 'Hollow', icon: 'stats-chart-outline' }, { k: '8', label: 'Heikin Ashi', icon: 'analytics-outline' },
  { k: '0', label: 'Bars', icon: 'reorder-three-outline' }, { k: '2', label: 'Line', icon: 'trending-up-outline' }, { k: '3', label: 'Area', icon: 'pulse-outline' },
];
// The chart page. user-scalable=no + touch-action:none keep two-finger pinch for the chart itself (zoom in and out) instead of zooming the whole page.
export const tvHtml = (symbol: string, interval: string, dark: boolean, bg: string, studies: string[] = [], style = '1', tz = 'Etc/UTC') => `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>html,body{margin:0;height:100%;background:${bg};touch-action:none;overscroll-behavior:none;-webkit-user-select:none;user-select:none}.tradingview-widget-container,.tradingview-widget-container__widget{height:100%;width:100%}</style></head><body><div class="tradingview-widget-container"><div class="tradingview-widget-container__widget"></div><script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js" async>${JSON.stringify({
  autosize: true, symbol, interval, timezone: tz, theme: dark ? 'dark' : 'light', style, locale: 'en',
  backgroundColor: bg, gridColor: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)', allow_symbol_change: false, hide_side_toolbar: false, hide_top_toolbar: false, hide_legend: false,
  withdateranges: true, save_image: false, enable_publishing: false, calendar: false, details: false, hotlist: false, support_host: 'https://www.tradingview.com', studies,
})}</script></div></body></html>`;

// ---- follow the pair shown inside a chart page ----
// Turns whatever a chart shows in its symbol box ("stpRNG3", "EURUSD", "BTCUSDT", "DERIV:BOOM_1000_INDEX", "Volatility 100 Index")
// into one of the app's markets, so the header, price and star can follow the chart.
const norm = (x: string) => x.toUpperCase().replace(/[^A-Z0-9]/g, '');
const keysOf = (s: Sym): string[] => {
  const k = [s.id, s.name];
  if (s.id.startsWith('frx')) k.push(s.id.slice(3));
  if (s.id.startsWith('cry')) { const p = s.id.slice(3), b = p.replace(/USD$/, ''); k.push(p, b, `${b}USDT`); }
  if (isBn(s.id)) k.push(bnRaw(s.id));
  const tv = tvSymbol(s);
  if (tv) k.push(tv.split(':').pop() ?? tv);
  return k.map(norm).filter(Boolean);
};
export function matchSymbol(raw: string): Sym | null {
  const full = norm(raw), base = norm(raw.split(':').pop() ?? raw);
  if (!base) return null;
  return SYMBOLS.find((s) => { const k = keysOf(s); return k.includes(full) || k.includes(base); }) ?? null;
}


// ---- every market, like TradingView ----
// The app's own lists (all Deriv markets, all Binance pairs) come from SYMBOLS. TV_EXTRA adds what they do not have: every forex pair
// (majors, minors, exotics), metals and energy, the world's stock indices and popular stocks. Anything else can be typed as a TradingView
// symbol (EXCHANGE:TICKER) and becomes an id that starts with TVX.
export const TVX = 'tvx:';
export type TvItem = Sym & { tv: string };
const FX = (p: string, sub: string): TvItem => ({ id: 'frx' + p, name: `${p.slice(0, 3)}/${p.slice(3)}`, cat: 'forex', sub, tv: `FX:${p}` });
const ITEM = (tv: string, name: string, cat: string, sub: string): TvItem => ({ id: TVX + tv, name, cat: cat as any, sub, tv });
export const TV_EXTRA: TvItem[] = [
  ...'EURUSD GBPUSD AUDUSD NZDUSD USDJPY USDCHF USDCAD'.split(' ').map((p) => FX(p, 'Major Pairs')),
  ...'EURGBP EURJPY EURCHF EURAUD EURNZD EURCAD GBPJPY GBPCHF GBPAUD GBPNZD GBPCAD AUDJPY AUDCHF AUDNZD AUDCAD NZDJPY NZDCHF NZDCAD CADJPY CADCHF CHFJPY'.split(' ').map((p) => FX(p, 'Minor Pairs')),
  ...'USDTRY USDZAR USDMXN USDSEK USDNOK USDDKK USDPLN USDHUF USDCZK USDSGD USDHKD USDCNH USDINR USDTHB USDILS USDRON EURTRY EURPLN EURSEK EURNOK EURDKK EURHUF EURCZK EURZAR EURMXN GBPSEK GBPNOK GBPPLN GBPZAR GBPSGD AUDSGD SGDJPY ZARJPY'.split(' ').map((p) => FX(p, 'Exotic Pairs')),
  ITEM('OANDA:XAUUSD', 'Gold / USD', 'forex', 'Metals'), ITEM('OANDA:XAGUSD', 'Silver / USD', 'forex', 'Metals'), ITEM('OANDA:XPTUSD', 'Platinum / USD', 'forex', 'Metals'), ITEM('OANDA:XPDUSD', 'Palladium / USD', 'forex', 'Metals'),
  ITEM('OANDA:XAUEUR', 'Gold / EUR', 'forex', 'Metals'), ITEM('OANDA:XAUGBP', 'Gold / GBP', 'forex', 'Metals'), ITEM('OANDA:XCUUSD', 'Copper / USD', 'forex', 'Metals'),
  ITEM('TVC:USOIL', 'Oil WTI (US Crude)', 'forex', 'Energy'), ITEM('TVC:UKOIL', 'Oil Brent', 'forex', 'Energy'), ITEM('NYMEX:NG1!', 'Natural Gas', 'forex', 'Energy'), ITEM('TVC:DXY', 'DXY (US Dollar Index)', 'forex', 'Indices'),
  ITEM('SP:SPX', 'US 500 (S&P 500)', 'indices', 'Americas'), ITEM('NASDAQ:NDX', 'US Tech 100 (Nasdaq 100)', 'indices', 'Americas'), ITEM('DJ:DJI', 'Wall Street 30 (Dow Jones)', 'indices', 'Americas'),
  ITEM('TVC:RUT', 'US Small Cap 2000', 'indices', 'Americas'), ITEM('TVC:VIX', 'Volatility Index (VIX)', 'indices', 'Americas'),
  ITEM('XETR:DAX', 'Germany 40 (DAX)', 'indices', 'Europe'), ITEM('TVC:UKX', 'UK 100 (FTSE 100)', 'indices', 'Europe'), ITEM('TVC:CAC40', 'France 40 (CAC 40)', 'indices', 'Europe'),
  ITEM('TVC:SX5E', 'Euro Stoxx 50', 'indices', 'Europe'), ITEM('TVC:IBEX35', 'Spain 35 (IBEX 35)', 'indices', 'Europe'), ITEM('TVC:AEX', 'Netherlands 25 (AEX)', 'indices', 'Europe'), ITEM('TVC:SMI', 'Switzerland 20 (SMI)', 'indices', 'Europe'),
  ITEM('TVC:NI225', 'Japan 225 (Nikkei)', 'indices', 'Asia Pacific'), ITEM('TVC:HSI', 'Hong Kong 50 (Hang Seng)', 'indices', 'Asia Pacific'), ITEM('ASX:XJO', 'Australia 200 (ASX 200)', 'indices', 'Asia Pacific'),
  ITEM('SSE:000001', 'Shanghai Composite', 'indices', 'Asia Pacific'), ITEM('NSE:NIFTY', 'India 50 (Nifty 50)', 'indices', 'Asia Pacific'), ITEM('BSE:SENSEX', 'India Sensex', 'indices', 'Asia Pacific'),
  ...([['NASDAQ:AAPL', 'Apple'], ['NASDAQ:MSFT', 'Microsoft'], ['NASDAQ:NVDA', 'NVIDIA'], ['NASDAQ:TSLA', 'Tesla'], ['NASDAQ:AMZN', 'Amazon'], ['NASDAQ:GOOGL', 'Alphabet (Google)'], ['NASDAQ:META', 'Meta Platforms'], ['NASDAQ:NFLX', 'Netflix'],
    ['NASDAQ:AMD', 'AMD'], ['NASDAQ:INTC', 'Intel'], ['NASDAQ:ADBE', 'Adobe'], ['NASDAQ:PYPL', 'PayPal'], ['NASDAQ:COIN', 'Coinbase'], ['NASDAQ:AVGO', 'Broadcom'], ['NYSE:BABA', 'Alibaba'], ['NYSE:DIS', 'Disney'],
    ['NYSE:JPM', 'JPMorgan Chase'], ['NYSE:V', 'Visa'], ['NYSE:WMT', 'Walmart'], ['NYSE:KO', 'Coca-Cola'], ['NYSE:BA', 'Boeing'], ['NYSE:XOM', 'ExxonMobil'], ['NYSE:NKE', 'Nike'], ['NYSE:UBER', 'Uber']] as [string, string][])
    .map(([tv, name]) => ITEM(tv, `${name} (${tv.split(':')[1]})`, 'stocks', 'Popular stocks')),
];
const EXTRA_BY_ID = new Map(TV_EXTRA.map((e) => [e.id, e]));
// The market behind an id: the app's own list first, then the extras, then a custom TradingView symbol typed by the person.
export function lookSym(id: string): Sym & { tv?: string } {
  const s = SYMBOLS.find((x) => x.id === id);
  if (s) return s;
  const e = EXTRA_BY_ID.get(id);
  if (e) return e;
  if (id.startsWith(TVX)) { const raw = id.slice(TVX.length); return { id, name: raw.split(':').pop() || raw, cat: 'stocks' as any, sub: raw.includes(':') ? raw.split(':')[0] : 'TradingView', tv: raw } as any; }
  return symOf(id);
}
// The TradingView symbol of any market above (extras and custom symbols carry it, the app's own markets are mapped).
export const tvOf = (s: Sym): string | null => (s as any).tv ?? tvSymbol(s);
