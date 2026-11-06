import { createContext, useContext } from 'react';
import { useWindowDimensions as real } from 'react-native';

// Website layout: the same design on every screen size (top bar, page area). The phone app (native) keeps its own layout in win.ts.
// Every screen sizes itself from useWindowDimensions().width, which here is the width of the PAGE area, not of the browser window.
export const SIDEBAR_W = 0, RAIL_W = 340, PHONE_MAX = 640, DESKTOP_MIN = 900, RAIL_MIN = 1240, PAGE_MAX = 1248; // = 1280 (the width of the navbar, heroes and sections) minus the 16 px page padding each side, so every page lines up
export type LayoutInfo = { mode: 'phone' | 'desktop'; sidebar: number; rail: number; content: number; full: number };

export function layoutFor(w: number): LayoutInfo {
  // ONE website for every screen: the desktop design, from a phone (360 px) up to a wide monitor. Narrow screens get the same pages in one column and a menu button
  // instead of the link row (see TopNav in Desktop.web.tsx); each page adapts itself to the width it is given.
  return { mode: 'desktop', sidebar: 0, rail: 0, content: Math.min(w, PAGE_MAX), full: w };
}
export const useRealWindow = real;
export const useLayout = (): LayoutInfo => layoutFor(real().width);
// Cols (ui.tsx) puts cards in two columns; inside a column every screen part sizes itself to that column's width.
export const WidthCtx = createContext<number | null>(null);
export function useWindowDimensions() { const d = real(), o = useContext(WidthCtx); return { ...d, width: o ?? layoutFor(d.width).content }; }
