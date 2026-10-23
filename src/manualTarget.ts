import { NAV } from './nav';

// Manual Trade is a page of its own (opened from Home). Other pages can ask it to open on a pair: set `manualTarget.sym`, then go to MANUAL_TAB.
export const MANUAL_TAB = NAV.findIndex((n) => n.key === 'tabManual');
export const manualTarget = { sym: '' };
