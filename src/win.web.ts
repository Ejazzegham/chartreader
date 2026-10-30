import { createContext, useContext } from 'react';
import { useWindowDimensions as real } from 'react-native';

// Website layout. Under 900 px wide the app keeps its phone layout (bottom bar), centred and at most PHONE_MAX wide.
// From 900 px it becomes a desktop website: left sidebar, a page area, and (from 1240 px) a market-watch panel on the right.
// Every screen sizes itself from useWindowDimensions().width, which here is the width of the PAGE area, not of the browser window.
export const SIDEBAR_W = 0, RAIL_W = 340, PHONE_MAX = 640, DESKTOP_MIN = 900, RAIL_MIN = 1240, PAGE_MAX = 1248; // = 1280 (the width of the navbar, heroes and sections) minus the 16 px page padding each side, so every page lines up
export type LayoutInfo = { mode: 'phone' | 'desktop'; sidebar: number; rail: number; content: number; full: number };

export function layoutFor(w: number): LayoutInfo {
  if (w < DESKTOP_MIN) return { mode: 'phone', sidebar: 0, rail: 0, content: Math.min(w, PHONE_MAX), full: w };
  const rail = 0, free = w - SIDEBAR_W; // no right-hand market-watch panel any more
  return { mode: 'desktop', sidebar: SIDEBAR_W, rail, content: Math.max(560, Math.min(free, PAGE_MAX)), full: w };
}
export const useRealWindow = real;
export const useLayout = (): LayoutInfo => layoutFor(real().width);
// Cols (ui.tsx) puts cards in two columns; inside a column every screen part sizes itself to that column's width.
export const WidthCtx = createContext<number | null>(null);
export function useWindowDimensions() { const d = real(), o = useContext(WidthCtx); return { ...d, width: o ?? layoutFor(d.width).content }; }
