import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Rect, Path, Circle, Line } from 'react-native-svg';
import { Icon } from './ui';
import { useRealWindow } from './win';
import { useHeadlines, ago, tone, safeHttpUrl, Topic, Headline } from './headlines';
import { useNews, newsRisk, fmtIn, localTime, Impact, NewsEvent } from './news';
import { usePal, Panel, Footer, useGo } from './DesktopHome.web';
import { Notices } from './Desktop.web';

// The website's News page, designed like the "Market News & Updates" mockup: hero, tabs (Calendar / Forex / Crypto / Deriv),
// filters, a list of story cards, pagination, and a "Set News Alerts" bar. All stories and events come from the same live feeds as the phone app.
type Props = { active: boolean };
type Sub = 'cal' | Topic;

const PER = 8;
const IMPACT = [{ k: 'high', label: 'High only' }, { k: 'med', label: 'Medium +' }, { k: 'all', label: 'All' }];
const CURS = ['ALL', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD', 'CNY'];
const TABS: { k: Sub; label: string; icon: string }[] = [
  { k: 'cal', label: 'Calendar', icon: 'calendar-outline' },
  { k: 'forex', label: 'Forex', icon: 'cash-outline' },
  { k: 'crypto', label: 'Crypto', icon: 'logo-bitcoin' },
  { k: 'deriv', label: 'Deriv', icon: 'git-network-outline' },
];
const TOPIC: Record<Topic, { label: string; icon: string; color: string }> = {
  forex: { label: 'Forex', icon: 'swap-horizontal', color: '#2F6BFF' },
  crypto: { label: 'Crypto', icon: 'logo-bitcoin', color: '#F59E0B' },
  deriv: { label: 'Deriv', icon: 'pulse', color: '#8B5CF6' },
};
const CUR_COLOR: Record<string, string> = { USD: '#2F6BFF', EUR: '#1E40AF', GBP: '#7C3AED', JPY: '#EF4444', AUD: '#0EA5A4', CAD: '#DC2626', CHF: '#E11D48', NZD: '#0F766E', CNY: '#D97706' };

// ---------- small pieces
function Badge({ text, color, dot = true }: { text: string; color: string; dot?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 24, borderRadius: 12, backgroundColor: color + '1A', borderWidth: 1, borderColor: color + '44' }}>
      {dot && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />}
      <Text style={{ color, fontSize: 11, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

function Chip({ label, on, onPress, wide }: { label: string; on: boolean; onPress: () => void; wide?: boolean }) {
  const P = usePal();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress}
      style={((s: any) => ({ minWidth: wide ? 74 : 56, paddingHorizontal: 16, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: on ? P.blue : P.border, backgroundColor: on ? P.blue : s.hovered ? P.alt : P.card, cursor: 'pointer' })) as any}>
      <Text style={{ color: on ? P.th.onAccent : P.head, fontSize: 12.5, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

// ---------- hero
function Hero({ w, setSub }: { w: number; setSub: (k: Sub) => void }) {
  const feat = (icon: string, a: string, b: string, k: Sub) => (
    <Pressable key={a} onPress={() => setSub(k)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, cursor: 'pointer' } as any}>
      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#2F6BFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#2F6BFF', shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}><Icon name={icon} size={19} color="#FFFFFF" /></View>
      <View><Text style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' }}>{a}</Text><Text style={{ color: '#FFFFFFAA', fontSize: 11 }}>{b}</Text></View>
    </Pressable>
  );
  const chip = (label: string, color: string, k: Sub, pos: any, rot: string) => (
    <Pressable key={label} onPress={() => setSub(k)} style={{ position: 'absolute', paddingHorizontal: 18, height: 36, borderRadius: 10, backgroundColor: color, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FFFFFF44', cursor: 'pointer', transform: [{ rotate: rot }], shadowColor: color, shadowOpacity: 0.55, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, ...pos } as any}>
      <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.6 }}>{label}</Text>
    </Pressable>
  );
  return (
    <LinearGradient colors={['#06123A', '#0A2A8C', '#0B49D6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ overflow: 'hidden' }}>
      <View style={{ width: '100%', maxWidth: 1360, alignSelf: 'center', paddingHorizontal: 32, paddingTop: 34, paddingBottom: 30, minHeight: 250 }}>
        <View style={{ maxWidth: 640, gap: 12, zIndex: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="newspaper-outline" size={14} color="#9CC4FF" /><Text style={{ color: '#CFE0FF', fontSize: 12, fontWeight: '800', letterSpacing: 1.2 }}>MARKET NEWS & UPDATES</Text></View>
          <Text style={{ color: '#FFFFFF', fontSize: w >= 760 ? 46 : 34, fontWeight: '800', letterSpacing: -1 }}>Stay Informed, <Text style={{ color: '#4DA3FF' }}>Trade Smarter</Text></Text>
          <Text style={{ color: '#E6EEFF', fontSize: 15, lineHeight: 23 }}><Text style={{ color: '#4DA3FF', fontWeight: '600' }}>Get the latest market news,</Text> economic events, and trading insights from around the world. Stay ahead with real-time updates that <Text style={{ color: '#4DA3FF', fontWeight: '600' }}>move the markets.</Text></Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 26, marginTop: 14 }}>
            {feat('globe-outline', 'Forex News', 'Real-time updates', 'forex')}{feat('logo-bitcoin', 'Crypto News', 'Market movements', 'crypto')}{feat('newspaper-outline', 'Deriv News', 'Trading opportunities', 'deriv')}{feat('calendar-outline', 'Economic Calendar', 'Key events & data', 'cal')}
          </View>
        </View>
        {w >= 1040 && (
          <View pointerEvents="box-none" style={{ position: 'absolute', right: 40, top: 0, bottom: 0, width: 460, justifyContent: 'center' }}>
            <View style={{ position: 'absolute', right: 70, top: 34, width: 300, height: 190, borderRadius: 16, backgroundColor: '#0B2A8Ccc', borderWidth: 1.5, borderColor: '#7DB6FF88', padding: 16, transform: [{ rotate: '-3deg' }] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#2F6BFF', alignItems: 'center', justifyContent: 'center' }}><Icon name="globe-outline" size={16} color="#FFFFFF" /></View>
                <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800', letterSpacing: 0.5 }}>NEWS</Text>
              </View>
              <Svg width={268} height={110} viewBox="0 0 268 110" style={{ marginTop: 10 } as any}>
                {[0, 1, 2].map((i) => <Rect key={i} x={0} y={4 + i * 14} width={150 - i * 24} height={6} rx={3} fill="#7DB6FF" opacity={0.55} />)}
                {[22, 34, 28, 46, 38, 58, 50, 70, 62, 84].map((h, i) => <Rect key={i} x={140 + i * 12} y={104 - h} width={7} height={h} rx={2} fill={i % 3 === 0 ? '#16B97A' : '#4DA3FF'} opacity={0.9} />)}
                <Path d="M 0 96 L 40 82 L 80 88 L 130 62 L 180 70 L 268 20" stroke="#9CC4FF" strokeWidth={1.6} fill="none" opacity={0.8} />
                <Circle cx={268} cy={20} r={3.5} fill="#FFFFFF" />
                <Line x1={0} y1={106} x2={268} y2={106} stroke="#FFFFFF33" strokeWidth={1} />
              </Svg>
            </View>
            {chip('FOREX', '#16B97A', 'forex', { right: 0, top: 6 }, '3deg')}
            {chip('CRYPTO', '#F59E0B', 'crypto', { right: -14, top: 92 }, '-3deg')}
            {chip('DERIV', '#8B5CF6', 'deriv', { right: 8, top: 176 }, '3deg')}
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

// ---------- one story card (calendar event or headline), laid out like the mockup row
function Card({ icon, iconText, color, tag, title, body, time, source, right, onPress, hot }: {
  icon?: string; iconText?: string; color: string; tag: string; title: string; body?: string; time: string; source: string;
  right: { text: string; color: string }; onPress?: () => void; hot?: boolean;
}) {
  const P = usePal();
  return (
    <Pressable disabled={!onPress} onPress={onPress}
      style={((s: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: hot ? right.color + '66' : P.border, backgroundColor: hot ? right.color + '0F' : s.hovered && onPress ? P.alt : P.card, cursor: onPress ? 'pointer' : 'default', shadowColor: P.shadow, shadowOpacity: P.dark ? 0.2 : 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } })) as any}>
      <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: color + '1F', borderWidth: 1, borderColor: color + '44', alignItems: 'center', justifyContent: 'center' }}>
        {iconText ? <Text style={{ color, fontSize: 13, fontWeight: '800' }}>{iconText}</Text> : <Icon name={icon ?? 'newspaper'} size={24} color={color} />}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, height: 20, borderRadius: 10, backgroundColor: color + '1F' }}>
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color }} /><Text style={{ color, fontSize: 10.5, fontWeight: '700' }}>{tag}</Text>
        </View>
        <Text style={{ color: P.head, fontSize: 14.5, fontWeight: '700', lineHeight: 20 }} numberOfLines={2}>{title}</Text>
        {!!body && <Text style={{ color: P.body, fontSize: 12.5, lineHeight: 18 }} numberOfLines={1}>{body}</Text>}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Icon name="time-outline" size={13} color={P.body} /><Text style={{ color: P.body, fontSize: 11.5 }}>{time}</Text></View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 }}><Icon name="globe-outline" size={13} color={P.body} /><Text style={{ color: P.body, fontSize: 11.5 }} numberOfLines={1}>{source}</Text></View>
        </View>
      </View>
      <Badge text={right.text} color={right.color} />
      {!!onPress && <Icon name="chevron-forward" size={18} color={P.blue} />}
    </Pressable>
  );
}

// ---------- pagination
function Pager({ page, pages, set }: { page: number; pages: number; set: (n: number) => void }) {
  const P = usePal();
  if (pages <= 1) return null;
  const nums: number[] = [];
  const from = Math.max(1, Math.min(page - 2, pages - 4)), to = Math.min(pages, from + 4);
  for (let i = from; i <= to; i++) nums.push(i);
  const box = (key: string, on: boolean, off: boolean, onPress: () => void, child: React.ReactNode) => (
    <Pressable key={key} disabled={off} onPress={onPress} accessibilityRole="button"
      style={((s: any) => ({ width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: on ? P.blue : P.border, backgroundColor: on ? P.blue : s.hovered && !off ? P.alt : P.card, opacity: off ? 0.4 : 1, cursor: off ? 'default' : 'pointer' })) as any}>{child}</Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 6 }}>
      {box('p', false, page <= 1, () => set(page - 1), <Icon name="chevron-back" size={15} color={P.head} />)}
      {nums.map((n) => box('n' + n, n === page, false, () => set(n), <Text style={{ color: n === page ? P.th.onAccent : P.head, fontSize: 12.5, fontWeight: '700' }}>{n}</Text>))}
      {box('x', false, page >= pages, () => set(page + 1), <Icon name="chevron-forward" size={15} color={P.head} />)}
    </View>
  );
}

export default function NewsHome({ active }: Props) {
  const P = usePal(), th = P.th, go = useGo();
  const w = useRealWindow().width;
  const [sub, setSub] = useState<Sub>('cal'), [imp, setImp] = useState('med'), [cur, setCur] = useState('ALL'), [q, setQ] = useState(''), [page, setPage] = useState(1), [now, setNow] = useState(Date.now());
  const cal = useNews(active && sub === 'cal');
  const fx = useHeadlines('forex', active && sub === 'forex');
  const cr = useHeadlines('crypto', active && sub === 'crypto');
  const dv = useHeadlines('deriv', active && sub === 'deriv');
  useEffect(() => { if (!active) return; setNow(Date.now()); const i = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(i); }, [active]);
  useEffect(() => { setPage(1); }, [sub, imp, cur, q]);

  const feed = sub === 'forex' ? fx : sub === 'crypto' ? cr : sub === 'deriv' ? dv : null;
  const term = q.trim().toLowerCase();
  const icol = (i: Impact) => (i === 'High' ? th.sell : i === 'Medium' ? th.gold : i === 'Holiday' ? '#8B5CF6' : th.buy);

  const events = useMemo(() => cal.events.filter((e) =>
    (cur === 'ALL' || e.cur === cur) && (imp === 'all' ? true : imp === 'med' ? e.impact === 'High' || e.impact === 'Medium' : e.impact === 'High') &&
    (!term || (e.title + ' ' + e.cur).toLowerCase().includes(term))), [cal.events, cur, imp, term]);
  const stories = useMemo(() => (feed ? feed.items.filter((h) => !term || (h.title + ' ' + h.summary + ' ' + h.source).toLowerCase().includes(term)) : []), [feed?.items, term]);

  const total = sub === 'cal' ? events.length : stories.length;
  const pages = Math.max(1, Math.ceil(total / PER)), pg = Math.min(page, pages);
  const risk = newsRisk(cur === 'ALL' ? null : [cur], cal.events, now);
  const next = cal.events.find((e) => e.impact === 'High' && e.t >= now - 15 * 60000 && (cur === 'ALL' || e.cur === cur));
  const rc = risk.level === 'danger' ? th.sell : risk.level === 'caution' ? th.gold : th.buy;
  const reload = () => (sub === 'cal' ? cal.reload() : feed?.reload());
  const loading = sub === 'cal' ? cal.state === 'loading' && !cal.events.length : !!feed?.loading && !feed.items.length;
  const err = sub === 'cal' ? (cal.err || (cal.state === 'error' ? 'Could not load the calendar.' : '')) : feed?.err ?? '';
  const stamp = sub === 'cal' ? cal.fetchedAt : feed?.at;

  const toneOf = (h: Headline) => { const t = tone(h.title); return t === 'up' ? { text: 'Positive', color: th.buy } : t === 'down' ? { text: 'Negative', color: th.sell } : { text: 'Neutral', color: P.blue }; };
  const evTime = (e: NewsEvent) => { const d = new Date(e.t); return `${d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · ${localTime(e.t)}`; };

  const list: React.ReactNode[] = sub === 'cal'
    ? events.slice((pg - 1) * PER, pg * PER).map((e) => {
        const mins = (e.t - now) / 60000, past = mins < -15, hot = !past && e.impact === 'High' && mins <= 30, c = CUR_COLOR[e.cur] ?? P.blue;
        return (
          <Card key={e.id} iconText={e.cur} color={c} tag="Calendar" hot={hot}
            title={`${e.cur} ${e.title}`}
            body={e.forecast || e.previous ? `${e.forecast ? `Forecast ${e.forecast}` : ''}${e.forecast && e.previous ? '  ·  ' : ''}${e.previous ? `Previous ${e.previous}` : ''}` : undefined}
            time={Math.abs(mins) < 600 && !past ? `${evTime(e)} · ${fmtIn(mins)}` : evTime(e)} source="Forex Factory"
            right={{ text: `${e.impact} Impact`, color: icol(e.impact) }} />
        );
      })
    : stories.slice((pg - 1) * PER, pg * PER).map((h) => {
        const tp = TOPIC[sub as Topic], url = safeHttpUrl(h.link);
        return <Card key={h.id} icon={tp.icon} color={tp.color} tag={tp.label} title={h.title} body={h.summary} time={ago(h.t, now)} source={h.source} right={toneOf(h)} onPress={url ? () => Linking.openURL(url).catch(() => {}) : undefined} />;
      });

  const pad = w >= 700 ? 32 : 16;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: P.alt, display: active ? 'flex' : 'none' } as any} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
      <Hero w={w} setSub={setSub} />
      <View style={{ width: '100%', maxWidth: 1360, alignSelf: 'center', paddingHorizontal: pad, paddingTop: 24, paddingBottom: 30, gap: 18 }}>
        <Notices flush />
        {/* tabs */}
        <View style={{ alignSelf: 'flex-start', flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 5, borderRadius: 14, borderWidth: 1, borderColor: P.border, backgroundColor: P.card }}>
          {TABS.map((t) => {
            const on = sub === t.k;
            return (
              <Pressable key={t.k} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setSub(t.k)}
                style={((s: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, height: 38, borderRadius: 10, backgroundColor: on ? P.blue : s.hovered ? P.alt : 'transparent', cursor: 'pointer' })) as any}>
                <Icon name={t.icon} size={15} color={on ? th.onAccent : P.head} /><Text style={{ color: on ? th.onAccent : P.head, fontSize: 13, fontWeight: '700' }}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* filters */}
        <Panel style={{ padding: 20, gap: 14 }}>
          <View style={{ flexDirection: w >= 900 ? 'row' : 'column', gap: 16, alignItems: w >= 900 ? 'flex-start' : 'stretch' }}>
            {sub === 'cal' ? (
              <View style={{ flex: 1, gap: 12 }}>
                <View style={{ gap: 6 }}>
                  <Text style={{ color: P.body, fontSize: 10.5, fontWeight: '800', letterSpacing: 1 }}>IMPACT</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{IMPACT.map((i) => <Chip key={i.k} wide label={i.label} on={imp === i.k} onPress={() => setImp(i.k)} />)}</View>
                </View>
                <View style={{ gap: 6 }}>
                  <Text style={{ color: P.body, fontSize: 10.5, fontWeight: '800', letterSpacing: 1 }}>CURRENCY</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{CURS.map((c) => <Chip key={c} label={c} on={cur === c} onPress={() => setCur(c)} />)}</View>
                </View>
              </View>
            ) : (
              <View style={{ flex: 1, gap: 6, justifyContent: 'center' }}>
                <Text style={{ color: P.head, fontSize: 15, fontWeight: '800' }}>{TOPIC[sub as Topic].label} headlines</Text>
                <Text style={{ color: P.body, fontSize: 12.5, lineHeight: 18 }}>
                  {sub === 'deriv' ? 'Volatility, Boom, Crash, Step and Jump indices are generated by an algorithm, so economic news does not move them. Deriv forex, gold, silver and crypto do react: check the Calendar tab before trading those.' : 'The label on the right is a keyword hint (positive, negative, neutral), not a trading signal. Click a story to read it at the source.'}
                </Text>
              </View>
            )}
            <View style={{ flex: 1, maxWidth: w >= 900 ? 520 : undefined, gap: 12, alignItems: 'stretch' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: P.border, backgroundColor: P.dark ? th.panel2 : '#FAFBFE' }}>
                <Icon name="search" size={16} color={P.body} />
                <TextInput value={q} onChangeText={setQ} placeholder="Search news, events or keywords..." placeholderTextColor={P.body} style={{ flex: 1, color: P.head, fontSize: 13, outlineStyle: 'none' } as any} />
                {!!q && <Pressable onPress={() => setQ('')} hitSlop={8}><Icon name="close-circle" size={16} color={P.body} /></Pressable>}
              </View>
              <Pressable onPress={reload} style={{ alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 6, cursor: 'pointer' } as any}>
                <Icon name="refresh" size={15} color={P.blue} /><Text style={{ color: P.blue, fontSize: 12.5, fontWeight: '700' }}>Refresh</Text>
              </Pressable>
            </View>
          </View>
          {sub === 'cal' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, backgroundColor: rc + '12', borderWidth: 1, borderColor: rc + '33' }}>
              <Icon name={risk.level === 'clear' ? 'shield-checkmark' : 'warning'} size={17} color={rc} />
              <Text style={{ color: P.head, fontSize: 12.5, flex: 1, lineHeight: 18 }}>
                <Text style={{ fontWeight: '800', color: rc }}>{risk.level === 'danger' ? 'News window: stay out. ' : risk.level === 'caution' ? 'News is close: be careful. ' : 'No high-impact news right now. '}</Text>
                {next ? `Next: ${next.cur} ${next.title}, ${fmtIn((next.t - now) / 60000)} (${localTime(next.t)} your time).` : cal.state === 'loading' ? 'Loading calendar…' : 'No more high-impact events this week for this filter.'}
              </Text>
            </View>
          )}
        </Panel>

        {/* list */}
        <View style={{ gap: 12 }}>
          {loading && <Panel style={{ padding: 20 }}><Text style={{ color: P.body, fontSize: 13 }}>{sub === 'cal' ? 'Loading this week’s calendar…' : 'Loading headlines…'}</Text></Panel>}
          {!!err && (
            <Panel style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Icon name="alert-circle" size={18} color={total ? th.gold : th.sell} />
              <Text style={{ color: total ? th.gold : th.sell, fontSize: 12.5, flex: 1, lineHeight: 18 }}>{total ? `Showing saved data. ${err}` : err}</Text>
              <Pressable onPress={reload} style={{ paddingHorizontal: 14, height: 32, borderRadius: 8, backgroundColor: P.blue, justifyContent: 'center', cursor: 'pointer' } as any}><Text style={{ color: th.onAccent, fontSize: 12, fontWeight: '700' }}>Try again</Text></Pressable>
            </Panel>
          )}
          {!loading && !err && total === 0 && <Panel style={{ padding: 20 }}><Text style={{ color: P.body, fontSize: 13 }}>{sub === 'cal' ? 'No events match this filter.' : 'No stories match.'}</Text></Panel>}
          {list}
          <Pager page={pg} pages={pages} set={setPage} />
          <Text style={{ color: P.body, fontSize: 11.5, textAlign: 'center', marginTop: 4 }}>
            {stamp ? `${sub === 'cal' ? 'Forex Factory' : feed?.source} · updated ${localTime(stamp)} · ` : ''}{total} {sub === 'cal' ? 'events' : 'stories'}. {sub === 'cal' ? 'Times are shown in your time zone and can change.' : ''} Educational tool, not financial advice.
          </Text>
        </View>

        {/* alerts bar */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14, padding: 14, borderRadius: 12, backgroundColor: P.soft, borderWidth: 1, borderColor: P.blue + '33' }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: P.blue + '26', alignItems: 'center', justifyContent: 'center' }}><Icon name="notifications-outline" size={17} color={P.blue} /></View>
          <Text style={{ color: P.head, fontSize: 12.5, flex: 1, minWidth: 220 }}>Stay updated with the latest market news and make better trading decisions.</Text>
          <Pressable onPress={() => go(6)} style={((s: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, height: 38, borderRadius: 8, backgroundColor: P.blue, opacity: s.hovered ? 0.9 : 1, cursor: 'pointer' })) as any}>
            <Icon name="notifications" size={14} color={th.onAccent} /><Text style={{ color: th.onAccent, fontSize: 12.5, fontWeight: '700' }}>Set News Alerts</Text>
          </Pressable>
        </View>
      </View>
      <Footer w={w} go={go} />
    </ScrollView>
  );
}
