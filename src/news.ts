import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { symOf } from './markets';
import { xfetch } from './net';

// Economic calendar (this week) from the free Forex Factory weekly JSON mirror.
// Cached on the phone so the app does not hammer the feed, and stale data is still used when the phone is offline.
const FEED = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
const KEY = 'newscal.v1';
const TTL = 45 * 60 * 1000;

export type Impact = 'High' | 'Medium' | 'Low' | 'Holiday';
export type NewsEvent = { id: string; title: string; cur: string; t: number; impact: Impact; forecast: string; previous: string };
export type Risk = 'danger' | 'caution' | 'clear';
export type NewsRisk = { level: Risk; event?: NewsEvent; mins: number };

let events: NewsEvent[] = [];
let fetchedAt = 0;
let state: 'idle' | 'loading' | 'ok' | 'error' = 'idle';
let errMsg = '';
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());

const parse = (raw: any[]): NewsEvent[] =>
  raw.map((x, i) => ({
    id: `${x.date}|${x.country}|${x.title}|${i}`,
    title: String(x.title ?? ''),
    cur: String(x.country ?? '').toUpperCase(),
    t: Date.parse(x.date),
    impact: (['High', 'Medium', 'Low', 'Holiday'].includes(x.impact) ? x.impact : 'Low') as Impact,
    forecast: String(x.forecast ?? ''),
    previous: String(x.previous ?? ''),
  })).filter((e) => isFinite(e.t)).sort((a, b) => a.t - b.t);

let inflight = false;
export async function loadNews(force = false) {
  if (state === 'loading' || inflight) return;
  if (!events.length) {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) { const s = JSON.parse(raw); events = s.events ?? []; fetchedAt = s.at ?? 0; if (events.length) { state = 'ok'; notify(); } }
    } catch {}
  }
  if (!force && events.length && Date.now() - fetchedAt < TTL) return;
  inflight = true; state = events.length ? state : 'loading'; errMsg = ''; notify();
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await xfetch(FEED, { signal: ctl.signal });
    if (!r.ok) throw new Error(r.status === 429 ? 'The news feed is rate-limited, try again in a few minutes.' : `News feed returned ${r.status}.`);
    const list = parse(await r.json());
    if (!list.length) throw new Error('The news feed returned no events.');
    events = list; fetchedAt = Date.now(); state = 'ok';
    AsyncStorage.setItem(KEY, JSON.stringify({ events, at: fetchedAt })).catch(() => {});
  } catch (e: any) {
    errMsg = e?.name === 'AbortError' ? 'The news feed did not answer in time.' : (e?.message ?? 'Could not load news.');
    state = events.length ? 'ok' : 'error'; // keep showing the older list if we have one
  } finally { clearTimeout(to); inflight = false; notify(); }
}

export function useNews(active = true) {
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick((n) => n + 1);
    subs.add(f);
    if (active) loadNews();
    return () => { subs.delete(f); };
  }, [active]);
  return { events, state, err: errMsg, fetchedAt, reload: () => loadNews(true) };
}

// Which currencies move a market. Synthetic indices (Volatility, Boom, Crash) ignore news.
export function currenciesOf(id: string): string[] {
  const s = symOf(id);
  if (s.cat === 'deriv') return [];
  const m = /^frx([A-Z]{3})([A-Z]{3})$/.exec(id);
  if (m) return [m[1], m[2]];
  return ['USD']; // gold, silver, crypto and indices are priced in USD
}

// Window rules: a High impact release is dangerous from 30 min before to 15 min after, caution up to 2 h before.
// A Medium release is caution from 30 min before to 10 min after.
export function newsRisk(cur: string[] | null, list: NewsEvent[] = events, now = Date.now()): NewsRisk {
  let best: NewsRisk = { level: 'clear', mins: Infinity };
  const rank = { clear: 0, caution: 1, danger: 2 } as const;
  for (const e of list) {
    if (e.impact !== 'High' && e.impact !== 'Medium') continue;
    if (cur && !cur.includes(e.cur)) continue;
    const mins = (e.t - now) / 60000;
    let lv: Risk = 'clear';
    if (e.impact === 'High') lv = mins >= -15 && mins <= 30 ? 'danger' : mins > 30 && mins <= 120 ? 'caution' : 'clear';
    else lv = mins >= -10 && mins <= 30 ? 'caution' : 'clear';
    if (lv === 'clear') continue;
    if (rank[lv] > rank[best.level] || (rank[lv] === rank[best.level] && Math.abs(mins) < Math.abs(best.mins))) best = { level: lv, event: e, mins };
  }
  return best;
}

export const riskFor = (symId: string, now = Date.now()) => newsRisk(currenciesOf(symId), events, now);

export const fmtIn = (mins: number) => {
  const a = Math.abs(Math.round(mins));
  const txt = a >= 60 ? `${Math.floor(a / 60)}h ${String(a % 60).padStart(2, '0')}m` : `${a} min`;
  return mins >= 0 ? `in ${txt}` : `${txt} ago`;
};
export const localTime = (t: number) => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
