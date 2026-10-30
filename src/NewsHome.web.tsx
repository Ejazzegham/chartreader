import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Linking } from 'react-native';
import { Icon, HeroBanner } from './ui';
import { useRealWindow } from './win';
import { useHeadlines, ago, tone, safeHttpUrl, Topic, Headline } from './headlines';
import { useNews, newsRisk, fmtIn, localTime, Impact, NewsEvent } from './news';
import { usePal, Footer, useGo } from './DesktopHome.web';
import { Notices } from './Desktop.web';

// The website's News page, laid out like the Forex Factory news page: a compact page header with underline tabs,
// a "Hot Stories" block on top, a dense chronological news list on the left, and the economic Calendar
// (impact squares, time, currency, forecast, previous) in a sidebar on the right. Same live feeds as the phone app.
type Props = { active: boolean };
type Sub = 'all' | 'hot' | Topic;
type Item = Headline & { topic: Topic };

const TABS: { k: Sub; label: string }[] = [{ k: 'all', label: 'Latest' }, { k: 'hot', label: 'Hottest' }, { k: 'forex', label: 'Forex' }, { k: 'crypto', label: 'Crypto' }, { k: 'deriv', label: 'Deriv' }];
const TOPIC: Record<Topic, { label: string; color: string }> = { forex: { label: 'Forex', color: '#3B5B93' }, crypto: { label: 'Crypto', color: '#F59E0B' }, deriv: { label: 'Deriv', color: '#3B5B93' } };
const CURS = ['ALL', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD', 'CNY'];
const IMP: { k: Impact; label: string; color: string }[] = [
  { k: 'High', label: 'High', color: '#E5484D' }, { k: 'Medium', label: 'Medium', color: '#3B5B93' }, { k: 'Low', label: 'Low', color: '#E6CF3A' }, { k: 'Holiday', label: 'Holiday', color: '#98A2B3' },
];
const impColor = (i: Impact) => IMP.find((x) => x.k === i)!.color;
// words that usually move markets: used to rank the Hot Stories block (a keyword hint, not a signal)
const HOT = /\b(fed|powell|fomc|cpi|inflation|nfp|payrolls?|rate (cut|hike|decision)|ecb|lagarde|boe|boj|gold|record|surge[sd]?|plunge[sd]?|tumble[sd]?|crash(es|ed)?|soar(s|ed)?|slump(s|ed)?|tariffs?|war|sanctions?|etf|bitcoin|breaks?|jumps?|hits?|spikes?)\b/gi;

const dayLabel = (t: number, now: number) => {
  const d = new Date(t), n = new Date(now), s = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((s(d) - s(n)) / 86400000), base = d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
  return diff === 0 ? `Today · ${base}` : diff === -1 ? `Yesterday · ${base}` : diff === 1 ? `Tomorrow · ${base}` : base;
};
const group = <T extends { t: number }>(list: T[], now: number) => {
  const m = new Map<string, T[]>();
  for (const x of list) { const k = dayLabel(x.t, now); m.set(k, [...(m.get(k) ?? []), x]); }
  return [...m.entries()];
};
const open = (u: string) => { const url = safeHttpUrl(u); if (url) Linking.openURL(url).catch(() => {}); };

// ---------- small pieces
function Box({ children, style }: { children: React.ReactNode; style?: any }) {
  const P = usePal();
  return <View style={[{ backgroundColor: P.card, borderWidth: 1, borderColor: P.border, borderRadius: 6, overflow: 'hidden' }, style]}>{children}</View>;
}
function BoxHead({ icon, color, title, right }: { icon: string; color?: string; title: string; right?: React.ReactNode }) {
  const P = usePal();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 42, borderBottomWidth: 1, borderBottomColor: P.border, backgroundColor: P.dark ? P.th.panel2 : '#F3F5F9' }}>
      <Icon name={icon} size={16} color={color ?? P.blue} />
      <Text style={{ flex: 1, color: P.head, fontSize: 13.5, fontWeight: '800' }}>{title}</Text>{right}
    </View>
  );
}
const Square = ({ c, size = 12 }: { c: string; size?: number }) => <View style={{ width: size, height: size, borderRadius: 3, backgroundColor: c }} />;
function Toggle({ label, on, onPress, color }: { label: string; on: boolean; onPress: () => void; color?: string }) {
  const P = usePal();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress}
      style={((s: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 26, borderRadius: 5, borderWidth: 1, borderColor: on ? (color ?? P.blue) : P.border, backgroundColor: on ? (color ?? P.blue) + '1A' : s.hovered ? P.alt : 'transparent', cursor: 'pointer' })) as any}>
      {!!color && <Square c={color} size={10} />}<Text style={{ color: on ? P.head : P.body, fontSize: 11.5, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}
function TopicTag({ topic }: { topic: Topic }) {
  const c = TOPIC[topic];
  return <View style={{ paddingHorizontal: 6, height: 17, borderRadius: 3, justifyContent: 'center', backgroundColor: c.color + '1F', minWidth: 46, alignItems: 'center' }}><Text style={{ color: c.color, fontSize: 9.5, fontWeight: '800', letterSpacing: 0.4 }}>{c.label.toUpperCase()}</Text></View>;
}
function ToneDot({ title }: { title: string }) {
  const P = usePal(), t = tone(title);
  return <View accessibilityLabel={t === 'up' ? 'Positive wording' : t === 'down' ? 'Negative wording' : 'Neutral wording'} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: t === 'up' ? P.th.buy : t === 'down' ? P.th.sell : P.border }} />;
}

// ---------- Hot Stories (top block)
function HotStories({ items, now }: { items: Item[]; now: number }) {
  const P = usePal();
  if (!items.length) return null;
  return (
    <Box>
      <BoxHead icon="flame" color="#F26A21" title="Hot Stories" right={<Text style={{ color: P.body, fontSize: 11 }}>Most market-moving headlines right now</Text>} />
      {items.map((h, i) => (
        <Pressable key={h.id} onPress={() => open(h.link)} style={((s: any) => ({ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: P.border, backgroundColor: s.hovered ? P.alt : 'transparent', cursor: 'pointer' })) as any}>
          <Text style={{ width: 20, color: '#F26A21', fontSize: 18, fontWeight: '900', lineHeight: 22 }}>{i + 1}</Text>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text style={{ color: P.head, fontSize: 14.5, fontWeight: '800', lineHeight: 20 }} numberOfLines={2}>{h.title}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TopicTag topic={h.topic} /><Text style={{ color: P.blue, fontSize: 11.5, fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>{h.source}</Text><Text style={{ color: P.body, fontSize: 11.5 }}>{ago(h.t, now)}</Text>
            </View>
          </View>
          <ToneDot title={h.title} />
        </Pressable>
      ))}
    </Box>
  );
}

// ---------- the news list
function NewsList({ items, now, loading, err, retry }: { items: Item[]; now: number; loading: boolean; err: string; retry: () => void }) {
  const P = usePal();
  const [more, setMore] = useState(40);
  useEffect(() => setMore(40), [items.length]);
  const groups = useMemo(() => group(items.slice(0, more), now), [items, more, now]);
  return (
    <Box>
      <BoxHead icon="newspaper" title="News" right={<Text style={{ color: P.body, fontSize: 11.5 }}>{items.length} stories</Text>} />
      {loading && <Text style={{ color: P.body, fontSize: 13, padding: 16 }}>Loading headlines…</Text>}
      {!!err && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: P.th.sell + '12' }}>
          <Icon name="alert-circle" size={16} color={items.length ? P.th.gold : P.th.sell} />
          <Text style={{ flex: 1, color: P.head, fontSize: 12.5, lineHeight: 18 }}>{items.length ? `Showing saved stories. ${err}` : err}</Text>
          <Pressable onPress={retry} style={{ paddingHorizontal: 12, height: 28, borderRadius: 5, backgroundColor: P.blue, justifyContent: 'center', cursor: 'pointer' } as any}><Text style={{ color: P.th.onAccent, fontSize: 12, fontWeight: '700' }}>Try again</Text></Pressable>
        </View>
      )}
      {!loading && !err && !items.length && <Text style={{ color: P.body, fontSize: 13, padding: 16 }}>No stories match.</Text>}
      {groups.map(([day, list]) => (
        <View key={day}>
          <View style={{ paddingHorizontal: 14, height: 28, justifyContent: 'center', backgroundColor: P.dark ? P.th.panel2 : '#EEF1F6', borderTopWidth: 1, borderBottomWidth: 1, borderColor: P.border }}>
            <Text style={{ color: P.body, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 }}>{day.toUpperCase()}</Text>
          </View>
          {list.map((h, i) => (
            <Pressable key={h.id} onPress={() => open(h.link)} style={((s: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: P.border, backgroundColor: s.hovered ? P.alt : 'transparent', cursor: 'pointer' })) as any}>
              <Text style={{ width: 40, color: P.body, fontSize: 11.5, fontWeight: '700' }}>{localTime(h.t)}</Text>
              <TopicTag topic={h.topic} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: P.head, fontSize: 13.5, fontWeight: '600', lineHeight: 19 }} numberOfLines={2}>{h.title}</Text>
                <Text style={{ color: P.body, fontSize: 11.5 }} numberOfLines={1}>{h.source}</Text>
              </View>
              <ToneDot title={h.title} />
            </Pressable>
          ))}
        </View>
      ))}
      {items.length > more && (
        <Pressable onPress={() => setMore(more + 40)} style={((s: any) => ({ height: 42, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderTopColor: P.border, backgroundColor: s.hovered ? P.alt : 'transparent', cursor: 'pointer' })) as any}>
          <Text style={{ color: P.blue, fontSize: 12.5, fontWeight: '800' }}>Show more stories</Text>
        </Pressable>
      )}
    </Box>
  );
}

// ---------- the economic calendar (sidebar)
function Calendar({ active, now, term }: { active: boolean; now: number; term: string }) {
  const P = usePal(), th = P.th;
  const cal = useNews(active);
  const [imps, setImps] = useState<Impact[]>(['High', 'Medium']), [cur, setCur] = useState('ALL');
  const flip = (k: Impact) => setImps(imps.includes(k) ? imps.filter((x) => x !== k) : [...imps, k]);
  const list = useMemo(() => cal.events.filter((e) => imps.includes(e.impact) && (cur === 'ALL' || e.cur === cur) && (!term || (e.title + ' ' + e.cur).toLowerCase().includes(term))), [cal.events, imps, cur, term]);
  const groups = useMemo(() => group(list, now), [list, now]);
  const risk = newsRisk(cur === 'ALL' ? null : [cur], cal.events, now);
  const next = cal.events.find((e) => e.impact === 'High' && e.t >= now - 15 * 60000 && (cur === 'ALL' || e.cur === cur));
  const rc = risk.level === 'danger' ? th.sell : risk.level === 'caution' ? th.gold : th.buy;
  const err = cal.err || (cal.state === 'error' ? 'Could not load the calendar.' : '');
  const th_ = (t: string, w?: number, flex?: number, right?: boolean) => <Text style={{ width: w, flex, color: P.body, fontSize: 10.5, fontWeight: '800', textAlign: right ? 'right' : 'left' }}>{t}</Text>;
  return (
    <Box>
      <BoxHead icon="calendar" title="Calendar" right={<Pressable onPress={cal.reload} hitSlop={8} accessibilityLabel="Refresh calendar" style={{ cursor: 'pointer' } as any}><Icon name="refresh" size={15} color={P.blue} /></Pressable>} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: rc + '12', borderBottomWidth: 1, borderBottomColor: P.border }}>
        <Icon name={risk.level === 'clear' ? 'shield-checkmark' : 'warning'} size={17} color={rc} />
        <Text style={{ flex: 1, color: P.head, fontSize: 12, lineHeight: 17 }}>
          <Text style={{ fontWeight: '800', color: rc }}>{risk.level === 'danger' ? 'News window: stay out. ' : risk.level === 'caution' ? 'News is close: be careful. ' : 'No high-impact news right now. '}</Text>
          {next ? `Next: ${next.cur} ${next.title}, ${fmtIn((next.t - now) / 60000)} (${localTime(next.t)}).` : cal.state === 'loading' ? 'Loading…' : 'No more high-impact events this week.'}
        </Text>
      </View>
      <View style={{ padding: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: P.border }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{IMP.map((i) => <Toggle key={i.k} label={i.label} color={i.color} on={imps.includes(i.k)} onPress={() => flip(i.k)} />)}</View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{CURS.map((c) => <Toggle key={c} label={c} on={cur === c} onPress={() => setCur(c)} />)}</View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 28, borderBottomWidth: 1, borderBottomColor: P.border }}>
        {th_('Time', 40)}{th_('Cur', 34)}{th_('Imp', 22)}{th_('Event', undefined, 1)}{th_('Fcst', 46, undefined, true)}{th_('Prev', 46, undefined, true)}
      </View>
      <ScrollView style={{ maxHeight: 640 }} nestedScrollEnabled>
        {cal.state === 'loading' && !cal.events.length && <Text style={{ color: P.body, fontSize: 12.5, padding: 14 }}>Loading this week’s calendar…</Text>}
        {!!err && (
          <View style={{ padding: 12, gap: 6 }}>
            <Text style={{ color: cal.events.length ? th.gold : th.sell, fontSize: 12, lineHeight: 17 }}>{cal.events.length ? `Showing saved data. ${err}` : err}</Text>
            <Pressable onPress={cal.reload} style={{ alignSelf: 'flex-start', paddingHorizontal: 12, height: 28, borderRadius: 5, backgroundColor: P.blue, justifyContent: 'center', cursor: 'pointer' } as any}><Text style={{ color: th.onAccent, fontSize: 12, fontWeight: '700' }}>Try again</Text></Pressable>
          </View>
        )}
        {cal.state === 'ok' && !groups.length && <Text style={{ color: P.body, fontSize: 12.5, padding: 14 }}>No events match these filters.</Text>}
        {groups.map(([day, items]) => {
          const today = day.startsWith('Today');
          return (
            <View key={day}>
              <View style={{ paddingHorizontal: 12, height: 26, justifyContent: 'center', backgroundColor: today ? P.blue + '1F' : P.dark ? th.panel2 : '#EEF1F6' }}>
                <Text style={{ color: today ? P.blue : P.body, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.5 }}>{day.toUpperCase()}</Text>
              </View>
              {items.map((e: NewsEvent) => {
                const mins = (e.t - now) / 60000, past = mins < -15, hot = !past && e.impact === 'High' && mins <= 30;
                return (
                  <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: P.border, opacity: past ? 0.5 : 1, backgroundColor: hot ? th.sell + '10' : 'transparent' }}>
                    <Text style={{ width: 40, color: P.head, fontSize: 11.5, fontWeight: '700' }}>{localTime(e.t)}</Text>
                    <Text style={{ width: 34, color: P.head, fontSize: 11.5, fontWeight: '800' }}>{e.cur}</Text>
                    <View style={{ width: 22 }}><Square c={impColor(e.impact)} /></View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: P.head, fontSize: 12, fontWeight: '600', lineHeight: 16 }} numberOfLines={2}>{e.title}</Text>
                      {!past && Math.abs(mins) < 600 && <Text style={{ color: hot ? th.sell : P.body, fontSize: 10.5, fontWeight: '700' }}>{fmtIn(mins)}</Text>}
                    </View>
                    <Text style={{ width: 46, color: P.head, fontSize: 11.5, textAlign: 'right' }} numberOfLines={1}>{e.forecast || '-'}</Text>
                    <Text style={{ width: 46, color: P.body, fontSize: 11.5, textAlign: 'right' }} numberOfLines={1}>{e.previous || '-'}</Text>
                  </View>
                );
              })}
            </View>
          );
        })}
      </ScrollView>
      <Text style={{ color: P.body, fontSize: 10.5, lineHeight: 15, padding: 10, borderTopWidth: 1, borderTopColor: P.border }}>
        {cal.fetchedAt ? `Forex Factory data · updated ${localTime(cal.fetchedAt)} · ` : ''}Times are in your time zone and can change.
      </Text>
    </Box>
  );
}

export default function NewsHome({ active }: Props) {
  const P = usePal(), go = useGo(), w = useRealWindow().width;
  const [sub, setSub] = useState<Sub>('all'), [q, setQ] = useState(''), [now, setNow] = useState(Date.now());
  const fx = useHeadlines('forex', active), cr = useHeadlines('crypto', active), dv = useHeadlines('deriv', active);
  useEffect(() => { if (!active) return; setNow(Date.now()); const i = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(i); }, [active]);

  const term = q.trim().toLowerCase();
  const all: Item[] = useMemo(() => {
    const seen = new Set<string>(), out: Item[] = [];
    ([['forex', fx.items], ['crypto', cr.items], ['deriv', dv.items]] as [Topic, Headline[]][]).forEach(([topic, items]) => items.forEach((h) => {
      const k = h.title.toLowerCase().replace(/\W+/g, ' ').trim(); if (seen.has(k)) return; seen.add(k); out.push({ ...h, topic });
    }));
    return out.sort((a, b) => b.t - a.t);
  }, [fx.items, cr.items, dv.items]);
  const hot = useMemo(() => all.map((h) => {
    const age = (now - h.t) / 3600000, hits = (h.title.match(HOT) ?? []).length;
    return { h, score: hits * 2 + (age < 3 ? 3 : age < 12 ? 2 : age < 24 ? 1 : 0) };
  }).filter((x) => x.score >= 3).sort((a, b) => b.score - a.score || b.h.t - a.h.t).slice(0, 5).map((x) => x.h), [all, now]);

  const shown = useMemo(() => {
    let l = sub === 'hot' ? hot : sub === 'all' ? all : all.filter((h) => h.topic === sub);
    if (term) l = l.filter((h) => (h.title + ' ' + h.summary + ' ' + h.source).toLowerCase().includes(term));
    return l;
  }, [all, hot, sub, term]);
  const feeds = [fx, cr, dv];
  const loading = feeds.some((f) => f.loading) && !all.length;
  const err = !all.length ? (feeds.map((f) => f.err).find(Boolean) ?? '') : feeds.every((f) => f.err) ? feeds[0].err : '';
  const reloadAll = () => feeds.forEach((f) => f.reload());
  const stamp = Math.max(0, ...feeds.map((f) => f.at ?? 0));

  const pad = w >= 700 ? 32 : 16, wide = w >= 1120;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: P.bg, display: active ? 'flex' : 'none' } as any} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
      <View style={{ flex: 1, width: '100%', maxWidth: 1280, alignSelf: 'center', paddingHorizontal: pad, paddingTop: 24, paddingBottom: 28, gap: 14 }}>
        <HeroBanner icon="newspaper" tag="Market News" title="News" subtitle={`Market headlines and the economic calendar${stamp ? ` · updated ${localTime(stamp)}` : ''}`} />
        <Notices flush />
        {/* tabs and search */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', gap: 14, borderBottomWidth: 1, borderBottomColor: P.border }}>
          <View style={{ flexDirection: 'row', gap: 2, marginLeft: wide ? 24 : 0 }}>
            {TABS.map((t) => {
              const on = sub === t.k;
              return (
                <Pressable key={t.k} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setSub(t.k)} style={((s: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, height: 40, borderBottomWidth: 3, borderBottomColor: on ? P.blue : 'transparent', backgroundColor: s.hovered && !on ? P.alt : 'transparent', cursor: 'pointer' })) as any}>
                  {t.k === 'hot' && <Icon name="flame" size={14} color="#F26A21" />}
                  <Text style={{ color: on ? P.blue : P.head, fontSize: 13.5, fontWeight: on ? '800' : '600' }}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flex: 1 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 34, paddingHorizontal: 10, marginBottom: 6, width: wide ? 320 : '100%', borderRadius: 5, borderWidth: 1, borderColor: P.border, backgroundColor: P.card }}>
            <Icon name="search" size={15} color={P.body} />
            <TextInput value={q} onChangeText={setQ} placeholder="Search news and events..." placeholderTextColor={P.body} style={{ flex: 1, color: P.head, fontSize: 12.5, outlineStyle: 'none' } as any} />
            {!!q && <Pressable onPress={() => setQ('')} hitSlop={8}><Icon name="close-circle" size={15} color={P.body} /></Pressable>}
            <Pressable onPress={reloadAll} hitSlop={8} accessibilityLabel="Refresh news" style={{ cursor: 'pointer' } as any}><Icon name="refresh" size={15} color={P.blue} /></Pressable>
          </View>
        </View>

        {/* body: news on the left, calendar on the right */}
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: 14, alignItems: 'flex-start' }}>
          <View style={{ flex: 1, width: wide ? undefined : '100%', minWidth: 0, gap: 14 }}>
            {sub !== 'hot' && !term && <HotStories items={hot} now={now} />}
            <NewsList items={shown} now={now} loading={loading} err={err} retry={reloadAll} />
          </View>
          <View style={{ width: wide ? 470 : '100%' }}>
            <Calendar active={active} now={now} term={term} />
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: 12, borderRadius: 6, borderWidth: 1, borderColor: P.blue + '33', backgroundColor: P.soft }}>
          <Icon name="notifications-outline" size={17} color={P.blue} />
          <Text style={{ color: P.head, fontSize: 12.5, flex: 1, minWidth: 220 }}>Get warned before high-impact news. Turn on news alerts in Settings.</Text>
          <Pressable onPress={() => go(6)} style={((s: any) => ({ paddingHorizontal: 16, height: 32, borderRadius: 5, justifyContent: 'center', backgroundColor: P.blue, opacity: s.hovered ? 0.9 : 1, cursor: 'pointer' })) as any}><Text style={{ color: P.th.onAccent, fontSize: 12.5, fontWeight: '700' }}>Set News Alerts</Text></Pressable>
        </View>
        <Text style={{ color: P.body, fontSize: 11, textAlign: 'center' }}>The dot beside a headline is a keyword hint (green positive, red negative), not a trading signal. Hot Stories ranks recent headlines by market-moving keywords. Educational tool, not financial advice.</Text>
      </View>
      <Footer w={w} go={go} />
    </ScrollView>
  );
}
