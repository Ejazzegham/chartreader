import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { xfetch } from './net';

// Market headlines from free public feeds (no key). Each topic tries several sources in turn and caches the result on the phone,
// so the screen still shows the last headlines when the phone is offline or a feed is down.
export type Topic = 'forex' | 'crypto' | 'deriv';
export type Headline = { id: string; title: string; link: string; source: string; t: number; summary: string };

const gnews = (q: string) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
const FEEDS: Record<Topic, { name: string; url: string; json?: boolean }[]> = {
  crypto: [
    { name: 'CryptoCompare', url: 'https://min-api.cryptocompare.com/data/v2/news/?lang=EN', json: true },
    { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
    { name: 'Cointelegraph', url: 'https://cointelegraph.com/rss' },
    { name: 'Google News', url: gnews('crypto OR bitcoin OR ethereum when:2d') },
  ],
  forex: [
    { name: 'FXStreet', url: 'https://www.fxstreet.com/rss/news' },
    { name: 'Investing.com', url: 'https://www.investing.com/rss/news_1.rss' },
    { name: 'Google News', url: gnews('forex OR EURUSD OR "US dollar" OR gold price when:2d') },
  ],
  deriv: [
    { name: 'Google News', url: gnews('Deriv.com OR "Deriv" trading platform OR "synthetic indices"') },
    { name: 'Google News', url: gnews('Deriv broker news') },
  ],
};

const TTL = 15 * 60 * 1000;
const mem: Record<string, { items: Headline[]; at: number; src: string }> = {};
const pending: Record<string, Promise<void> | undefined> = {};
const errs: Record<string, string> = {};
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());

const decode = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/\s+/g, ' ').trim();
const tag = (x: string, name: string) => { const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(x); return m ? m[1] : ''; };

// Only web links may be opened from a feed (a feed must never be able to open tel:, intent: or other app links).
export const safeHttpUrl = (u: string) => (/^https?:\/\/\S+$/i.test(u.trim()) ? u.trim() : '');

export function parseRss(xml: string, fallbackSource: string): Headline[] {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  return items.map((it, i) => {
    const title = decode(tag(it, 'title')), link = decode(tag(it, 'link')) || (/<link[^>]*href="([^"]+)"/i.exec(it)?.[1] ?? '');
    const date = Date.parse(decode(tag(it, 'pubDate') || tag(it, 'updated') || tag(it, 'published')));
    let source = decode(tag(it, 'source')) || fallbackSource, ttl = title;
    const gm = /^(.*) - ([^-]{2,40})$/.exec(title); // Google News titles end with " - Publisher"
    if (gm && fallbackSource === 'Google News') { ttl = gm[1]; source = gm[2]; }
    return { id: `${link || title}|${i}`, title: ttl, link: safeHttpUrl(link), source, t: isFinite(date) ? date : Date.now(), summary: decode(decode(tag(it, 'description') || tag(it, 'summary'))).slice(0, 220) };
  }).filter((h) => h.title.length > 8);
}

const parseCC = (j: any): Headline[] => (j?.Data ?? []).map((x: any) => ({ id: String(x.id ?? x.url), title: String(x.title ?? ''), link: safeHttpUrl(String(x.url ?? '')), source: String(x.source_info?.name ?? x.source ?? 'CryptoCompare'), t: Number(x.published_on) * 1000, summary: decode(String(x.body ?? '')).slice(0, 220) })).filter((h: Headline) => h.title);

async function fetchTopic(topic: Topic) {
  let last = '';
  for (const f of FEEDS[topic]) {
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 10000);
    try {
      const r = await xfetch(f.url, { signal: ctl.signal, headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/rss+xml, application/xml, application/json, */*' } });
      if (!r.ok) throw new Error(`${f.name} returned ${r.status}`);
      const items = (f.json ? parseCC(await r.json()) : parseRss(await r.text(), f.name)).sort((a, b) => b.t - a.t).slice(0, 40);
      if (!items.length) throw new Error(`${f.name} returned no stories`);
      mem[topic] = { items, at: Date.now(), src: f.name }; errs[topic] = '';
      AsyncStorage.setItem('hl_' + topic, JSON.stringify(mem[topic])).catch(() => {});
      return;
    } catch (e: any) { last = e?.name === 'AbortError' ? `${f.name} did not answer in time` : (e?.message ?? 'Network error'); } finally { clearTimeout(to); }
  }
  errs[topic] = `Could not load headlines (${last}). Showing saved stories if any.`;
}

export function loadHeadlines(topic: Topic, force = false): Promise<void> {
  const run = async () => {
    if (!mem[topic]) { try { const v = await AsyncStorage.getItem('hl_' + topic); if (v) { mem[topic] = JSON.parse(v); notify(); } } catch {} }
    if (!force && mem[topic] && Date.now() - mem[topic].at < TTL) return;
    await fetchTopic(topic);
  };
  if (!pending[topic]) pending[topic] = run().finally(() => { pending[topic] = undefined; notify(); });
  notify();
  return pending[topic]!;
}

export function useHeadlines(topic: Topic, active = true) {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((n) => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  useEffect(() => { if (active) loadHeadlines(topic); }, [topic, active]);
  const m = mem[topic];
  return { items: m?.items ?? [], source: m?.src ?? '', at: m?.at ?? 0, err: errs[topic] ?? '', loading: !!pending[topic], reload: () => loadHeadlines(topic, true) };
}

// Crypto Fear & Greed index (alternative.me, free).
export type Fng = { value: number; label: string; at: number };
export async function loadFng(): Promise<Fng | null> {
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 10000); // this call used to have no time limit
  try {
    const r = await xfetch('https://api.alternative.me/fng/?limit=1', { signal: ctl.signal });
    const j = await r.json(), d = j?.data?.[0];
    return d ? { value: Number(d.value), label: String(d.value_classification), at: Number(d.timestamp) * 1000 } : null;
  } catch { return null; } finally { clearTimeout(to); }
}

export const ago = (t: number, now = Date.now()) => {
  const m = Math.max(0, Math.round((now - t) / 60000));
  return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)}d ago`;
};

// Quick tone read of a headline, used for the coloured dot. Keyword based, so it is a hint and not advice.
// Whole words only. Before, "ban" matched inside "Bank" and "rise" inside "Surprise", so "Bank of England holds rates" got a red dot.
const POS = /\b(surg(e|es|ed|ing)|soar(s|ed|ing)?|rall(y|ies|ied)|jump(s|ed|ing)?|gain(s|ed|ing)?|ris(e|es|ing)|rose|climb(s|ed|ing)?|record high|bullish|approv(e|es|ed|al)|adopt(s|ed|ion)?|breakout|rebound(s|ed)?|upgrade[sd]?|beat(s)?)\b/i;
const NEG = /\b(plung(e|es|ed|ing)|crash(es|ed|ing)?|drop(s|ped|ping)?|fall(s|ing)?|fell|slump(s|ed)?|tumbl(e|es|ed|ing)|bearish|hack(s|ed)?|exploit(s|ed)?|ban(s|ned)?|lawsuit|sell-?off|fraud|probe[sd]?|downgrade[sd]?|miss(es|ed)?|warn(s|ed|ing)?)\b/i;
export const tone = (t: string): 'up' | 'down' | 'flat' => (POS.test(t) && !NEG.test(t) ? 'up' : NEG.test(t) && !POS.test(t) ? 'down' : 'flat');
