import { SYMBOLS } from './markets';
import type { Sym } from './markets';
import { isBn, bnRaw } from './crypto';

export const DERIV_CHARTS = 'https://charts.deriv.com/deriv';
export const TV_INTERVAL: Record<string, string> = { '60': '1', '180': '3', '300': '5', '900': '15', '1800': '30', '3600': '60', '7200': '120', '14400': '240', '86400': 'D' };

// Deriv symbol -> TradingView symbol. Deriv indices use TradingView's DERIV: exchange, named from the display name
// (e.g. "Volatility 100 (1s) Index" -> DERIV:VOLATILITY_100_1S_INDEX, "Boom 1000 Index" -> DERIV:BOOM_1000_INDEX).
export function tvSymbol(s: Sym): string | null {
  const id = s.id;
  if (id === 'frxBROUSD') return 'TVC:UKOIL';
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
export const tvHtml = (symbol: string, interval: string, dark: boolean, bg: string, studies: string[] = [], style = '1') => `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>html,body{margin:0;height:100%;background:${bg};touch-action:none;overscroll-behavior:none;-webkit-user-select:none;user-select:none}.tradingview-widget-container,.tradingview-widget-container__widget{height:100%;width:100%}</style></head><body><div class="tradingview-widget-container"><div class="tradingview-widget-container__widget"></div><script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js" async>${JSON.stringify({
  autosize: true, symbol, interval, timezone: 'Etc/UTC', theme: dark ? 'dark' : 'light', style, locale: 'en',
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
