import { useWindowDimensions as real } from 'react-native';

// Website layout. Under 900 px wide the app keeps its phone layout (bottom bar), centred and at most PHONE_MAX wide.
// From 900 px it becomes a desktop website: left sidebar, a page area, and (from 1240 px) a market-watch panel on the right.
// Every screen sizes itself from useWindowDimensions().width, which here is the width of the PAGE area, not of the browser window.
export const SIDEBAR_W = 244, RAIL_W = 340, PHONE_MAX = 640, DESKTOP_MIN = 900, RAIL_MIN = 1240, PAGE_MAX = 980;
export type LayoutInfo = { mode: 'phone' | 'desktop'; sidebar: number; rail: number; content: number; full: number };

export function layoutFor(w: number): LayoutInfo {
  if (w < DESKTOP_MIN) return { mode: 'phone', sidebar: 0, rail: 0, content: Math.min(w, PHONE_MAX), full: w };
  const rail = w >= RAIL_MIN ? RAIL_W : 0, free = w - SIDEBAR_W - rail;
  return { mode: 'desktop', sidebar: SIDEBAR_W, rail, content: Math.max(560, Math.min(free, PAGE_MAX)), full: w };
}
export const useRealWindow = real;
export const useLayout = (): LayoutInfo => layoutFor(real().width);
export function useWindowDimensions() { const d = real(); return { ...d, width: layoutFor(d.width).content }; }
