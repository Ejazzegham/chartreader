import { useEffect, useState } from 'react';

// What the website's dashboard is showing right now: the pair, the analysis method, the timeframe and the market tab.
// The top search bar, the market-watch panel and the home dashboard all read and change it.
export type MarketTab = 'favs' | 'forex' | 'crypto' | 'deriv';
export type DashState = { sym: string; method: string; tf: string; market: MarketTab };
let st: DashState = { sym: 'frxEURUSD', method: 'ict', tf: '900', market: 'forex' };
const subs = new Set<() => void>();
export const setDash = (p: Partial<DashState>) => { st = { ...st, ...p }; subs.forEach((f) => f()); };
export function useDash(): DashState {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((n) => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  return st;
}

export const groupOf = (cat: string): MarketTab => (cat === 'crypto' ? 'crypto' : cat === 'deriv' ? 'deriv' : 'forex');