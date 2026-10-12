import { useEffect, useState } from 'react';
import { SYMBOLS, symOf, Sym } from './markets';

// What the website's dashboard is showing right now: the pair, the analysis method, the timeframe and the market tab.
// The top search bar, the market-watch panel and the home dashboard all read and change it.
export type MarketTab = 'favs' | 'forex' | 'crypto' | 'deriv';
export type DashState = { sym: string; method: string; tf: string; market: MarketTab };
let st: DashState = { sym: 'frxEURUSD', method: 'ict', tf: '900', market: 'forex' };
const subs = new Set<() => void>();
export const getDash = () => st;
export const setDash = (p: Partial<DashState>) => { st = { ...st, ...p }; subs.forEach((f) => f()); };
export function useDash(): DashState {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((n) => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  return st;
}

export const groupOf = (cat: string): MarketTab => (cat === 'crypto' ? 'crypto' : cat === 'deriv' ? 'deriv' : 'forex'); // gold, silver, DXY and indices live under Forex
const FX_FIRST = ['frxDXY', 'frxXAUUSD', 'frxXAGUSD', 'frxEURUSD', 'frxGBPUSD', 'frxUSDJPY', 'frxAUDUSD', 'frxUSDCAD', 'frxUSDCHF', 'frxNZDUSD', 'frxEURJPY', 'frxGBPJPY'];
export function listFor(market: MarketTab, favs: string[]): Sym[] {
  if (market === 'favs') return favs.map(symOf);
  const l = SYMBOLS.filter((s) => groupOf(s.cat) === market);
  if (market === 'forex') { const r = (s: Sym) => { const i = FX_FIRST.indexOf(s.id); return i < 0 ? 99 : i; }; l.sort((a, b) => r(a) - r(b)); }
  return l;
}
export const TF_BUTTONS: { k: string; label: string }[] = [{ k: '60', label: '1m' }, { k: '300', label: '5m' }, { k: '900', label: '15m' }, { k: '3600', label: '1h' }, { k: '14400', label: '4h' }, { k: '86400', label: '1D' }];
