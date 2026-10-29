import { fxClosedAt } from './session';

// =====================================================================================
// Forex Market Hours: pure maths for the four sessions, any time zone, overlaps and typical volume.
// A session is a LOCAL working day in its own city (Sydney 7 to 16, Tokyo 9 to 18, London 8 to 17, New York 8 to 17),
// so every window moves by itself when a city changes its clock. Time zones come from Intl (no hand-made offsets).
// No imports from the app except the weekly forex schedule, so tests can run it on its own.
// =====================================================================================
export type FxSession = { key: 'sydney' | 'tokyo' | 'london' | 'newyork'; city: string; tz: string; open: number; close: number; color: string; weight: number; pairs: string };

export const FX_SESSIONS: FxSession[] = [
  { key: 'sydney', city: 'Sydney', tz: 'Australia/Sydney', open: 7, close: 16, color: '#F5A524', weight: 1, pairs: 'AUD, NZD' },
  { key: 'tokyo', city: 'Tokyo', tz: 'Asia/Tokyo', open: 9, close: 18, color: '#D77CF2', weight: 2, pairs: 'JPY, AUD' },
  { key: 'london', city: 'London', tz: 'Europe/London', open: 8, close: 17, color: '#22C58B', weight: 4, pairs: 'EUR, GBP, CHF' },
  { key: 'newyork', city: 'New York', tz: 'America/New_York', open: 8, close: 17, color: '#2F6BFF', weight: 3, pairs: 'USD, CAD' },
];

export type TzChoice = { id: string; label: string; tz: string };
export const localTz = (): string => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } };
export const TZ_CHOICES = (): TzChoice[] => [
  { id: 'local', label: 'My time zone', tz: localTz() },
  { id: 'utc', label: 'UTC', tz: 'UTC' },
  { id: 'newyork', label: 'New York', tz: 'America/New_York' },
  { id: 'london', label: 'London', tz: 'Europe/London' },
  { id: 'dubai', label: 'Dubai', tz: 'Asia/Dubai' },
  { id: 'karachi', label: 'Karachi', tz: 'Asia/Karachi' },
  { id: 'tokyo', label: 'Tokyo', tz: 'Asia/Tokyo' },
  { id: 'sydney', label: 'Sydney', tz: 'Australia/Sydney' },
];

// ---------- time zone helpers
const fmtCache: Record<string, Intl.DateTimeFormat> = {};
const parts = (tz: string, ms: number) => {
  const f = fmtCache[tz] ?? (fmtCache[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', weekday: 'short' }));
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(new Date(ms))) o[p.type] = p.value;
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(o.weekday);
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, min: +o.minute, s: +o.second, wd };
};
/** minutes the zone is ahead of UTC at this moment (DST included) */
export const offsetMin = (tz: string, ms: number): number => {
  const p = parts(tz, ms);
  return Math.round((Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(ms / 1000) * 1000) / 60000);
};
/** the UTC moment when the wall clock in `tz` reads y-m-d h:min (m is 1 to 12; day overflow is fine) */
export const zonedToUtc = (tz: string, y: number, m: number, d: number, h: number, min = 0): number => {
  const guess = Date.UTC(y, m - 1, d, h, min);
  const a = guess - offsetMin(tz, guess) * 60000;
  const b = guess - offsetMin(tz, a) * 60000;
  return b;
};
export const dayStartUtc = (tz: string, ms: number, plusDays = 0): number => { const p = parts(tz, ms); return zonedToUtc(tz, p.y, p.m, p.d + plusDays, 0, 0); };
export const wallParts = parts;

export const fmtClock = (ms: number, tz: string, h24: boolean, seconds = false): string => {
  const p = parts(tz, ms), pad = (n: number) => String(n).padStart(2, '0');
  if (h24) return `${pad(p.h)}:${pad(p.min)}${seconds ? ':' + pad(p.s) : ''}`;
  const h = p.h % 12 || 12;
  return `${h}:${pad(p.min)}${seconds ? ':' + pad(p.s) : ''} ${p.h < 12 ? 'am' : 'pm'}`;
};
export const fmtDay = (ms: number, tz: string): string => new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(ms));
export const fmtWeekdayClock = (ms: number, tz: string, h24: boolean): string => `${new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(new Date(ms))} ${fmtClock(ms, tz, h24)}`;
export const tzAbbr = (ms: number, tz: string): string => {
  try { return new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date(ms)).find((p) => p.type === 'timeZoneName')?.value ?? tz; } catch { return tz; }
};
export const utcLabel = (ms: number, tz: string): string => {
  const o = offsetMin(tz, ms), s = o < 0 ? '-' : '+', a = Math.abs(o), h = Math.floor(a / 60), m = a % 60;
  return `UTC ${s}${h}${m ? ':' + String(m).padStart(2, '0') : ''}`;
};
/** hour label on the timeline axis */
export const axisLabel = (hour: number, h24: boolean): string => (h24 ? String(hour % 24).padStart(2, '0') : hour % 24 === 0 ? '12a' : hour === 12 ? '12p' : hour < 12 ? `${hour}a` : `${hour - 12}p`);

export const fmtLeft = (mins: number): string => {
  const m = Math.max(0, Math.round(mins));
  if (m >= 1440) return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
};

// ---------- sessions
export type Win = { start: number; end: number }; // UTC milliseconds
/** every window of a session that touches [from, to), skipping the city's own Saturdays and Sundays */
export const sessionWindows = (s: FxSession, from: number, to: number): Win[] => {
  const out: Win[] = [];
  const p0 = parts(s.tz, from - 36 * 3600e3);
  for (let i = 0; i < 6; i++) {
    const start = zonedToUtc(s.tz, p0.y, p0.m, p0.d + i, Math.floor(s.open), Math.round((s.open % 1) * 60));
    const end = zonedToUtc(s.tz, p0.y, p0.m, p0.d + i, Math.floor(s.close), Math.round((s.close % 1) * 60));
    const wd = parts(s.tz, start + 3600e3).wd;
    if (wd === 0 || wd === 6) continue;
    if (end > from && start < to) out.push({ start, end });
  }
  return out;
};

export type SessionState = { s: FxSession; open: boolean; minsLeft: number; nextOpen: number | null; nextClose: number | null; win: Win | null };
/** is the session trading at `now` (inside its local day AND the forex week is open), and when does it next open or close */
export const sessionState = (s: FxSession, now: Date): SessionState => {
  const t = now.getTime();
  const wins = sessionWindows(s, t - 24 * 3600e3, t + 8 * 24 * 3600e3);
  const weekClosed = fxClosedAt(now);
  const cur = wins.find((w) => t >= w.start && t < w.end) ?? null;
  if (cur && !weekClosed) { const end = Math.min(cur.end, weekCloseAfter(t)); return { s, open: true, minsLeft: (end - t) / 60000, nextOpen: null, nextClose: end, win: cur }; }
  const reopen = weekClosed ? weekOpenAfter(t) : 0; // while the week is closed nothing opens before the week does
  for (const w of wins) {
    const eff = Math.max(w.start, reopen);
    if (w.end <= t || eff >= w.end || eff <= t) continue;
    return { s, open: false, minsLeft: (eff - t) / 60000, nextOpen: eff, nextClose: null, win: w };
  }
  return { s, open: false, minsLeft: 0, nextOpen: null, nextClose: null, win: null };
};

// ---------- the forex week: Sunday 17:00 to Friday 17:00 New York time
const NY = 'America/New_York';
export const weekOpenAfter = (ms: number): number => { // next Sunday 17:00 New York at or after ms
  const p = parts(NY, ms);
  for (let i = 0; i < 9; i++) { const t = zonedToUtc(NY, p.y, p.m, p.d + i, 17, 0); if (parts(NY, t + 3600e3).wd === 0 && t >= ms) return t; }
  return ms;
};
export const weekCloseAfter = (ms: number): number => { // next Friday 17:00 New York at or after ms
  const p = parts(NY, ms);
  for (let i = 0; i < 9; i++) { const t = zonedToUtc(NY, p.y, p.m, p.d + i, 17, 0); if (parts(NY, t - 3600e3).wd === 5 && t >= ms) return t; }
  return ms;
};

// ---------- typical volume: sessions add up, London + New York is the busiest time of the day
export type Level = 'closed' | 'low' | 'medium' | 'high';
export const volumeAt = (ms: number): Level => {
  if (fxClosedAt(new Date(ms))) return 'closed';
  let sum = 0;
  for (const s of FX_SESSIONS) if (sessionWindows(s, ms, ms + 1).some((w) => ms >= w.start && ms < w.end)) sum += s.weight;
  return sum >= 7 ? 'high' : sum >= 3 ? 'medium' : 'low';
};

export type Overlap = { a: FxSession; b: FxSession; start: number; end: number };
export const OVERLAP_PAIRS: [FxSession['key'], FxSession['key']][] = [['sydney', 'tokyo'], ['tokyo', 'london'], ['london', 'newyork']];
/** the next (or current) overlap of each pair around `now`, for the "best time to trade" cards */
export const overlapsAround = (now: Date): Overlap[] => {
  const t = now.getTime(), out: Overlap[] = [];
  for (const [ka, kb] of OVERLAP_PAIRS) {
    const a = FX_SESSIONS.find((s) => s.key === ka)!, b = FX_SESSIONS.find((s) => s.key === kb)!;
    const wa = sessionWindows(a, t - 24 * 3600e3, t + 5 * 24 * 3600e3), wb = sessionWindows(b, t - 24 * 3600e3, t + 5 * 24 * 3600e3);
    let best: Overlap | null = null;
    for (const x of wa) for (const y of wb) {
      const start = Math.max(x.start, y.start), end = Math.min(x.end, y.end);
      if (end > start && end > t && (!best || start < best.start)) best = { a, b, start, end };
    }
    if (best) out.push(best);
  }
  return out;
};

// ---------- the day shown on the timeline: midnight to midnight in the chosen zone
export type Lane = { s: FxSession; segs: { from: number; to: number }[] }; // fractions of the day, 0 to 1
export const timelineDay = (tz: string, now: Date) => {
  const t = now.getTime(), start = dayStartUtc(tz, t), end = dayStartUtc(tz, t, 1), span = end - start;
  const lanes: Lane[] = FX_SESSIONS.map((s) => ({
    s,
    segs: sessionWindows(s, start, end).map((w) => ({ from: (Math.max(w.start, start) - start) / span, to: (Math.min(w.end, end) - start) / span })),
  }));
  const cells = 48, vol: Level[] = Array.from({ length: cells }, (_, i) => volumeAt(start + ((i + 0.5) / cells) * span));
  return { start, end, span, nowPos: (t - start) / span, lanes, vol, hours: Math.round(span / 3600e3) };
};
