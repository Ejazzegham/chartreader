import { createContext, useContext } from 'react';

// A page that scrolls provides this. A chart calls it with true while a finger is on it, and false when all fingers lift,
// so the page stops scrolling and pinch zoom / drag go to the chart instead of the ScrollView.
export const ScrollLockContext = createContext<(on: boolean) => void>(() => {});
export const useScrollLock = () => useContext(ScrollLockContext);
