// Phone: the real window size. The website version (win.web.ts) works out the desktop layout (sidebar, page width, right panel).
import { useWindowDimensions } from 'react-native';
export { useWindowDimensions };
export const useRealWindow = useWindowDimensions;
export type LayoutInfo = { mode: 'phone' | 'desktop'; sidebar: number; rail: number; content: number; full: number };
export const PHONE_MAX = 100000;
export const useLayout = (): LayoutInfo => { const { width } = useWindowDimensions(); return { mode: 'phone', sidebar: 0, rail: 0, content: width, full: width }; };
