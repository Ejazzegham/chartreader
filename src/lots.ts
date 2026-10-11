// Position size in lots -> money. Pure maths, no React.
// Contract size per 1.0 lot: forex 100,000 units, gold 100 oz, silver 5,000 oz, crypto and synthetic indices 1 unit.
// Money per 1.0 price move = lots x contract size x (quote currency -> USD). Paper trading: the account is treated as USD.
export const lotUnits = (symId: string): number => {
  if (symId === 'frxDXY') return 1000; // US Dollar Index CFD: 1.0 lot = $1,000 per 1.00 index move
  if (/^frxXAU/.test(symId)) return 100;
  if (/^frxXAG/.test(symId)) return 5000;
  if (/^frx(XPT|XPD)/.test(symId)) return 100;
  if (symId.startsWith('frx')) return 100000;
  return 1;
};

// USD value of one unit of the pair's quote currency. USD-quoted pairs: 1. USD/JPY style: 1 / price. Crosses: use the USD pair of the quote currency when a live price exists.
export function usdPerQuote(symId: string, price: number, rate: (id: string) => number | undefined = () => undefined): number {
  if (!symId.startsWith('frx') || symId.length !== 9) return 1;
  const base = symId.slice(3, 6), quote = symId.slice(6, 9);
  if (quote === 'USD') return 1;
  if (base === 'USD') return price > 0 ? 1 / price : 1;
  const q = rate(`frx${quote}USD`); if (q && q > 0) return q;
  const i = rate(`frxUSD${quote}`); if (i && i > 0) return 1 / i;
  return 1;
}

export const perPoint = (lots: number, symId: string, price: number, rate?: (id: string) => number | undefined) => lots * lotUnits(symId) * usdPerQuote(symId, price, rate);

// ---------------------------------------------------------------- lot system per market
// Forex (with gold, silver and DXY): 1.00 lot is a fixed contract, min 0.01, step 0.01.
// Crypto: 1.00 lot = 1 coin, so the smallest lot shrinks as the coin gets more expensive (about $30-$100 per minimum lot).
// Deriv synthetics: 1.00 lot = $1 per index point, and every index has its own minimum / step / maximum (table below, MT5 style).
export type LotMarket = 'forex' | 'crypto' | 'deriv';
export type LotSpec = { market: LotMarket; label: string; min: number; step: number; max: number; chips: number[] };
export const lotMarket = (symId: string): LotMarket => (symId.startsWith('frx') ? 'forex' : symId.startsWith('cry') || /^bn[A-Z0-9]/.test(symId) ? 'crypto' : 'deriv');

// [id pattern, min lot, step, max lot]. Source: third-party MT5 baselines for Deriv; Deriv can change them, so confirm in your own account (MT5: Ctrl+U). Indices not listed use 0.01 / 0.01 / 100.
const DERIV_LOTS: [RegExp, number, number, number][] = [
  [/^R_(10|25)$/, 0.5, 0.01, 100], [/^R_50$/, 4, 0.01, 200], [/^R_75$/, 0.001, 0.001, 20], [/^1HZ75V$/, 0.005, 0.001, 20],
  [/^(BOOM|CRASH)(500|600|900|1000)N?$/, 0.2, 0.01, 50], [/^(BOOM|CRASH)300N?$/, 1, 0.01, 50], [/^stpRNG\d?$/, 0.1, 0.1, 200],
];
const clean = (n: number) => Number(n.toPrecision(10));

export function lotSpec(symId: string, price = 0): LotSpec {
  const market = lotMarket(symId);
  if (market === 'forex') return { market, label: 'Forex', min: 0.01, step: 0.01, max: 100, chips: [0.01, 0.05, 0.1, 0.5, 1] };
  if (market === 'crypto') {
    const step = price > 0 ? clean(Math.min(100, Math.max(0.0001, Math.pow(10, Math.floor(Math.log10(100 / price)))))) : 0.01;
    return { market, label: 'Crypto', min: step, step, max: MAX_LOTS, chips: [1, 5, 10, 50, 100].map((k) => clean(step * k)) };
  }
  const row = DERIV_LOTS.find((r) => r[0].test(symId));
  const [min, step, max] = row ? [row[1], row[2], row[3]] : [0.01, 0.01, 100];
  return { market, label: 'Deriv', min, step, max, chips: [1, 2, 5, 10, 50].map((k) => clean(min * k)).filter((v) => v <= max) };
}

// the contract in plain words: what 1.00 lot is and what a move is worth
export function lotInfo(symId: string, price: number, rate?: (id: string) => number | undefined): string {
  const sp = lotSpec(symId, price), per = perPoint(1, symId, price, rate), f = (n: number) => String(clean(n));
  const limits = `min ${f(sp.min)}, step ${f(sp.step)}`;
  const usd = (n: number) => '$' + n.toLocaleString(undefined, { maximumFractionDigits: n >= 100 ? 0 : 2, minimumFractionDigits: n >= 100 ? 0 : 2 });
  if (sp.market === 'forex') {
    if (/^frx(XAU|XPT|XPD)/.test(symId)) return `Forex lots · 1.00 lot = ${lotUnits(symId)} oz · ${usd(per)} per $1 move · ${limits}`;
    if (/^frxXAG/.test(symId)) return `Forex lots · 1.00 lot = 5,000 oz · ${usd(per)} per $1 move · ${limits}`;
    if (symId === 'frxDXY') return `Forex lots · 1.00 lot = ${usd(per)} per 1.00 index move · ${limits}`;
    const pip = symId.endsWith('JPY') ? 0.01 : 0.0001;
    return `Forex lots · 1.00 lot = 100,000 ${symId.slice(3, 6)} · about ${usd(per * pip)} per pip · ${limits}`;
  }
  if (sp.market === 'crypto') {
    const m = symId.match(/^cry([A-Z0-9]+?)USD$/) ?? symId.match(/^bn([A-Z0-9]+?)(USDT|USDC|FDUSD|BUSD|BTC|ETH|BNB)$/);
    return `Crypto lots · 1.00 lot = 1 ${m ? m[1] : 'coin'} · ${usd(1)} per $1 move · ${limits}`;
  }
  return `Deriv lots · 1.00 lot = ${usd(per)} per index point · ${limits}`;
}

// lots that risk `riskMoney` over a stop distance, rounded DOWN to the market's step so the suggestion never exceeds the wish. 0 when even the minimum lot is too big.
export function suggestLots(riskMoney: number, dist: number, symId: string, price: number, rate?: (id: string) => number | undefined) {
  const per = perPoint(1, symId, price, rate), sp = lotSpec(symId, price);
  if (!(riskMoney > 0) || !(dist > 0) || !(per > 0)) return 0;
  const n = clean(Math.min(sp.max, Math.floor((riskMoney / (dist * per)) / sp.step + 1e-9) * sp.step));
  return n + 1e-12 >= sp.min ? n : 0;
}

export const parseLots = (v: string): number => { const n = Number(String(v).replace(',', '.')); return isFinite(n) ? Math.round(n * 100000) / 100000 : NaN; };
export const MAX_LOTS = 1000;
export const lotsError = (n: number, sp?: LotSpec) => {
  if (!isFinite(n) || n <= 0) return 'Enter how many lots you want to trade, for example 0.35.';
  if (!sp) return n > MAX_LOTS ? `The maximum is ${MAX_LOTS} lots.` : '';
  if (n + 1e-9 < sp.min) return `The minimum for this ${sp.label} market is ${clean(sp.min)} lots.`;
  if (n > sp.max + 1e-9) return `The maximum for this ${sp.label} market is ${clean(sp.max)} lots.`;
  const k = n / sp.step;
  if (Math.abs(k - Math.round(k)) > 1e-6) return `Lots move in steps of ${clean(sp.step)} here (for example ${clean(Math.max(sp.min, Math.round(k) * sp.step))}).`;
  return '';
};
export const fmtLots = (n: number) => String(Number(n.toFixed(n >= 10 ? 1 : n >= 0.1 ? 2 : 5)));
