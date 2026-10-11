import type { Candle } from './markets';
import { nyOffsetHours } from './ict';

// =====================================================================================
// Is this market really trading right now? A setup built on Friday's last candles is not a setup.
// Two independent checks, because each one alone can be wrong:
//   1. The weekly schedule (forex, metals, indices close for the weekend).
//   2. Fresh data: the newest candle must be recent for the chosen timeframe. This also catches holidays,
//      a dead feed and exchange breaks the schedule does not know about.
// Pure maths, no imports from the app, so the server scanner uses the same rules.
// =====================================================================================
export type MarketState = { open: boolean; reason: string; reopens?: string };

type Cat = 'forex' | 'crypto' | 'deriv' | 'indices';

const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// The forex week runs from Sunday 17:00 to Friday 17:00 New York time.
// That is 21:00 UTC in US summer time and 22:00 UTC in winter.
export const fxWeekBoundsUtc = (d: Date) => { const h = 22 - nyOffsetHours(d); return { closeHour: h, openHour: h }; };

export const fxClosedAt = (d: Date): boolean => {
  const day = d.getUTCDay(), h = d.getUTCHours() + d.getUTCMinutes() / 60, { closeHour, openHour } = fxWeekBoundsUtc(d);
  return day === 6 || (day === 5 && h >= closeHour) || (day === 0 && h < openHour);
};

// Minutes since the forex week opened on Sunday (null at any other time) and minutes left before it closes on Friday.
export const fxMinutesSinceOpen = (d: Date): number | null => {
  const { openHour } = fxWeekBoundsUtc(d);
  return d.getUTCDay() === 0 && d.getUTCHours() >= openHour ? (d.getUTCHours() - openHour) * 60 + d.getUTCMinutes() : null;
};
export const fxMinutesToClose = (d: Date): number | null => {
  const { closeHour } = fxWeekBoundsUtc(d);
  if (d.getUTCDay() !== 5) return null;
  const m = closeHour * 60 - (d.getUTCHours() * 60 + d.getUTCMinutes());
  return m >= 0 ? m : null;
};

const reopenText = (d: Date) => { const { openHour } = fxWeekBoundsUtc(d); return `Sunday ${String(openHour).padStart(2, '0')}:00 UTC`; };

// Indices (Deriv stock indices) trade on weekdays only.
const indicesClosedAt = (d: Date) => { const day = d.getUTCDay(); return day === 6 || day === 0 || (day === 5 && d.getUTCHours() + d.getUTCMinutes() / 60 >= 22 - nyOffsetHours(d)); };

// The newest candle may be at most this old (seconds) before the feed is called stale.
export const maxCandleAge = (gran: number) => Math.max(2 * gran + 120, 600);

// Which asset class a symbol id belongs to, from the id alone (the server has no symbol list).
export const catFromId = (id: string, cat?: string): Cat => {
  if (cat === 'forex' || cat === 'crypto' || cat === 'deriv' || cat === 'indices') return cat;
  if (id.startsWith('frx')) return 'forex';
  if (id.startsWith('cry') || /^bn/i.test(id)) return 'crypto';
  return 'deriv';
};

// Schedule only (no candles needed): used where only the symbol is known.
export function scheduleState(id: string, cat: string | undefined, now: Date): MarketState {
  const k = catFromId(id, cat);
  if (k === 'forex' && fxClosedAt(now)) return { open: false, reason: `Forex and metals are closed for the weekend (${DAY[now.getUTCDay()]}).`, reopens: reopenText(now) };
  if (k === 'indices' && indicesClosedAt(now)) return { open: false, reason: 'Stock indices are closed (weekend).', reopens: 'Monday' };
  return { open: true, reason: '' };
}

// Full check: schedule, the exchange's own "closed" flag (when the feed gives one) and fresh candles.
export function marketState(c: Candle[], gran: number, id: string, cat: string | undefined, now: Date, flaggedClosed = false): MarketState {
  const s = scheduleState(id, cat, now);
  if (!s.open) return s;
  if (flaggedClosed) return { open: false, reason: 'The exchange reports this market as closed right now.' };
  if (!c.length) return { open: false, reason: 'No candles received.' };
  const age = now.getTime() / 1000 - c[c.length - 1].t;
  if (age > maxCandleAge(gran)) {
    const h = age / 3600;
    return { open: false, reason: `No new candles for ${h >= 1 ? h.toFixed(h >= 10 ? 0 : 1) + ' h' : Math.round(age / 60) + ' min'}: the market is closed or the feed is not live.` };
  }
  return { open: true, reason: '' };
}

// Quiet windows around the weekly close / open: thin liquidity, gaps and wide spreads. No new alerts then.
export function thinLiquidity(id: string, cat: string | undefined, now: Date): string | null {
  if (catFromId(id, cat) !== 'forex') return null;
  const toClose = fxMinutesToClose(now), since = fxMinutesSinceOpen(now);
  if (toClose !== null && toClose <= 60) return 'Less than 1 hour before the weekly close: thin market, no new alerts.';
  if (since !== null && since <= 60) return 'The market just reopened: gaps and wide spreads, no alerts for the first hour.';
  return null;
}
