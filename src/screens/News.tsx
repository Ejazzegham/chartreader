import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { LinearGradient } from '../FlatGradient';
import { useApp } from '../store';
import { Screen, Card, Dim, Body, Btn, Badge, Icon, TimeframeBar, Chip } from '../ui';
import { useHeadlines, loadFng, Fng, ago, tone, safeHttpUrl } from '../headlines';
import { movers, bnPairs } from '../crypto';
import { loadCrypto, bnState } from '../markets';
import { Linking } from 'react-native';
import { useNews, newsRisk, fmtIn, localTime, Impact } from '../news';
import { useLayout } from '../win';
import NewsHome from '../NewsHome';

const TAB = 13;
const IMPACT = [{ k: 'high', label: 'High only' }, { k: 'med', label: 'Medium +' }, { k: 'all', label: 'All' }];
const CURS = ['ALL', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD', 'CNY'];

function Calendar({ active }: { active: boolean }) {
  const { th } = useApp();
  const { events, state, err, fetchedAt, reload } = useNews(active);
  const [imp, setImp] = useState('med');
  const [cur, setCur] = useState('ALL');
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!active) return; setNow(Date.now()); const i = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(i); }, [active]);

  const icol = (i: Impact) => (i === 'High' ? th.sell : i === 'Medium' ? th.gold : i === 'Holiday' ? th.poi : th.dim);
  const list = useMemo(() => events.filter((e) =>
    (cur === 'ALL' || e.cur === cur) && (imp === 'all' ? true : imp === 'med' ? e.impact === 'High' || e.impact === 'Medium' : e.impact === 'High')), [events, imp, cur]);
  const upcoming = events.filter((e) => e.impact === 'High' && e.t >= now - 15 * 60000 && (cur === 'ALL' || e.cur === cur))[0];
  const risk = newsRisk(cur === 'ALL' ? null : [cur], events, now);

  const groups = useMemo(() => {
    const m = new Map<string, typeof list>();
    for (const e of list) {
      const d = new Date(e.t);
      const k = d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return [...m.entries()];
  }, [list]);

  const heroCol = risk.level === 'danger' ? th.sell : risk.level === 'caution' ? th.gold : th.buy;
  const heroTitle = risk.level === 'danger' ? 'News window: stay out' : risk.level === 'caution' ? 'News is close: be careful' : 'No high-impact news right now';

  return (
    <>
      <View style={{ gap: 12 }}>
        <LinearGradient colors={[heroCol + '33', th.panel]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 8, borderWidth: 1, borderColor: heroCol + '66', padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name={risk.level === 'clear' ? 'shield-checkmark' : 'warning'} size={18} color={heroCol} />
            <Text style={{ color: heroCol, fontWeight: '900', fontSize: 16, flex: 1 }}>{heroTitle}</Text>
          </View>
          {upcoming ? (
            <>
              <Text style={{ color: th.dim, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginTop: 10 }}>NEXT HIGH-IMPACT EVENT{cur !== 'ALL' ? ` · ${cur}` : ''}</Text>
              <Text style={{ color: th.text, fontSize: 18, fontWeight: '800', marginTop: 2 }}>{upcoming.cur} {upcoming.title}</Text>
              <Text style={{ color: th.accent, fontWeight: '800', marginTop: 2 }}>{fmtIn((upcoming.t - now) / 60000)} · {localTime(upcoming.t)} your time</Text>
            </>
          ) : <Body color={th.dim}>{state === 'loading' ? 'Loading calendar…' : 'No more high-impact events this week for this filter.'}</Body>}
        </LinearGradient>

        <Card>
          <Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '800', letterSpacing: 1, marginBottom: 6 }}>IMPACT</Text>
          <TimeframeBar value={imp} options={IMPACT} onChange={setImp} />
          <Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '800', letterSpacing: 1, marginTop: 10, marginBottom: 6 }}>CURRENCY</Text>
          <TimeframeBar value={cur} options={CURS.map((c) => ({ k: c, label: c }))} onChange={setCur} />
        </Card>

        {state === 'loading' && !events.length && <Card><Body color={th.dim}>Loading this week's calendar…</Body></Card>}
        {state === 'error' && !events.length && (
          <Card>
            <Body color={th.sell}>{err || 'Could not load the calendar.'}</Body>
            <View style={{ height: 8 }} />
            <Btn ghost label="Retry" icon="refresh" onPress={reload} />
          </Card>
        )}
        {!!events.length && !!err && <Dim>Showing saved data. {err}</Dim>}

        {groups.map(([day, items]) => (
          <View key={day} style={{ gap: 8 }}>
            <Text style={{ color: th.dim, fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginTop: 4 }}>{day.toUpperCase()}</Text>
            <Card style={{ padding: 6 }}>
              {items.map((e, i) => {
                const mins = (e.t - now) / 60000, past = mins < -15, hot = !past && e.impact === 'High' && mins <= 30;
                return (
                  <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderTopWidth: i ? 1 : 0, borderColor: th.line, opacity: past ? 0.5 : 1, backgroundColor: hot ? th.sell + '14' : 'transparent', borderRadius: hot ? 8 : 0 }}>
                    <View style={{ width: 8, height: 36, borderRadius: 4, backgroundColor: icol(e.impact) }} />
                    <View style={{ width: 46 }}>
                      <Text style={{ color: th.text, fontWeight: '800', fontSize: 13 }}>{localTime(e.t)}</Text>
                      <Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '700' }}>{e.cur}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: th.text, fontWeight: '700', fontSize: 13.5 }} numberOfLines={2}>{e.title}</Text>
                      <Text style={{ color: th.dim, fontSize: 11.5 }} numberOfLines={1}>
                        {e.forecast ? `Forecast ${e.forecast}` : ''}{e.forecast && e.previous ? ' · ' : ''}{e.previous ? `Previous ${e.previous}` : ''}{!e.forecast && !e.previous ? e.impact : ''}
                      </Text>
                    </View>
                    {!past && Math.abs(mins) < 600 && <Text style={{ color: hot ? th.sell : th.dim, fontSize: 11, fontWeight: '800' }}>{fmtIn(mins)}</Text>}
                  </View>
                );
              })}
            </Card>
          </View>
        ))}
        {state === 'ok' && !groups.length && <Card><Body color={th.dim}>No events match this filter.</Body></Card>}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Dim>{fetchedAt ? `Updated ${localTime(fetchedAt)}` : ''}</Dim>
          <Pressable onPress={reload} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="refresh" size={14} color={th.accent} /><Text style={{ color: th.accent, fontWeight: '800', fontSize: 12 }}>Refresh</Text>
          </Pressable>
        </View>
        <Dim>Times are shown in your phone's time zone. Warning windows: High impact is red from 30 min before to 15 min after and amber up to 2 hours before. Release times can change. Educational tool, not financial advice.</Dim>
      </View>
    </>
  );
}

const TABS = [{ k: 'cal', label: 'Calendar', icon: 'calendar-outline' }, { k: 'forex', label: 'Forex', icon: 'cash-outline' }, { k: 'crypto', label: 'Crypto', icon: 'logo-bitcoin' }, { k: 'deriv', label: 'Deriv', icon: 'git-network-outline' }];

function Story({ h, now }: { h: { id: string; title: string; link: string; source: string; t: number; summary: string }; now: number }) {
  const { th } = useApp();
  const tn = tone(h.title), col = tn === 'up' ? th.buy : tn === 'down' ? th.sell : th.dim;
  return (
    <Pressable onPress={() => safeHttpUrl(h.link) && Linking.openURL(h.link).catch(() => {})} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <Card style={{ padding: 14, flexDirection: 'row', gap: 12 }}>
        <View style={{ width: 4, borderRadius: 2, backgroundColor: col }} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: th.text, fontWeight: '800', fontSize: 14.5, lineHeight: 20 }} numberOfLines={3}>{h.title}</Text>
          {!!h.summary && <Text style={{ color: th.dim, fontSize: 12.5, lineHeight: 18, marginTop: 4 }} numberOfLines={2}>{h.summary}</Text>}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <Text style={{ color: th.accent, fontWeight: '800', fontSize: 11.5, flexShrink: 1 }} numberOfLines={1}>{h.source}</Text>
            <Text style={{ color: th.dim, fontSize: 11.5 }}>· {ago(h.t, now)}</Text>
            <View style={{ flex: 1 }} />
            <Icon name="open-outline" size={14} color={th.dim} />
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

function Feed({ topic, active }: { topic: 'forex' | 'crypto' | 'deriv'; active: boolean }) {
  const { th } = useApp();
  const { items, source, at, err, loading, reload } = useHeadlines(topic, active);
  const [fng, setFng] = useState<Fng | null>(null);
  const [now, setNow] = useState(Date.now());
  const [, force] = useState(0);
  useEffect(() => { if (!active) return; setNow(Date.now()); const i = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(i); }, [active]);
  useEffect(() => { if (active && topic === 'crypto') { loadFng().then(setFng); if (!bnState.loaded) loadCrypto().then(() => force((n) => n + 1)); } }, [active, topic]);
  const mv = topic === 'crypto' && bnPairs().length ? movers(4) : null;
  const fc = fng ? (fng.value >= 60 ? th.buy : fng.value <= 40 ? th.sell : th.gold) : th.dim;

  return (
    <View style={{ gap: 12 }}>
      {topic === 'crypto' && (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Card style={{ flex: 1, padding: 14 }}>
            <Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '900', letterSpacing: 1 }}>FEAR & GREED</Text>
            <Text style={{ color: fc, fontSize: 30, fontWeight: '900', marginTop: 4 }}>{fng ? fng.value : '--'}</Text>
            <Text style={{ color: fc, fontWeight: '800', fontSize: 12 }}>{fng?.label ?? 'Loading...'}</Text>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: th.line, marginTop: 8, overflow: 'hidden', direction: 'ltr' }}><View style={{ width: `${fng?.value ?? 0}%`, height: 6, backgroundColor: fc }} /></View>
          </Card>
          <Card style={{ flex: 1.3, padding: 14 }}>
            <Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '900', letterSpacing: 1 }}>24H MOVERS (USDT)</Text>
            {mv ? [...mv.up.slice(0, 2), ...mv.down.slice(0, 2)].map(({ p, chg }) => (
              <View key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }}>
                <Text style={{ color: th.text, fontWeight: '800', fontSize: 12.5 }}>{p.base}</Text>
                <Text style={{ color: chg >= 0 ? th.buy : th.sell, fontWeight: '900', fontSize: 12.5 }}>{chg >= 0 ? '+' : ''}{chg.toFixed(1)}%</Text>
              </View>
            )) : <Text style={{ color: th.dim, fontSize: 12, marginTop: 6 }}>{bnState.err || 'Loading...'}</Text>}
          </Card>
        </View>
      )}
      {topic === 'deriv' && (
        <Card glow>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="information-circle" size={18} color={th.accent} /><Text style={{ color: th.text, fontWeight: '900', fontSize: 14.5 }}>Trading Deriv markets</Text></View>
          <View style={{ height: 6 }} />
          <Body color={th.dim}>Volatility, Boom, Crash, Step and Jump indices are generated by an algorithm, so economic news does not move them. Deriv forex (with gold and silver) and crypto do react: check the Calendar tab before trading those.</Body>
        </Card>
      )}
      {loading && !items.length && <Card><Body color={th.dim}>Loading headlines...</Body></Card>}
      {!!err && <Card><Body color={items.length ? th.gold : th.sell}>{err}</Body>{!items.length && <><View style={{ height: 8 }} /><Btn ghost label="Retry" icon="refresh" onPress={reload} /></>}</Card>}
      {items.map((h) => <Story key={h.id} h={h} now={now} />)}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Dim>{at ? `${source} · updated ${localTime(at)}` : ''}</Dim>
        <Pressable onPress={reload} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="refresh" size={14} color={th.accent} /><Text style={{ color: th.accent, fontWeight: '800', fontSize: 12 }}>Refresh</Text></Pressable>
      </View>
      <Dim>The coloured bar is a keyword hint (green positive, red negative, grey neutral), not a trading signal. Tap a story to read it at the source.</Dim>
    </View>
  );
}

export default function News() {
  const { tab } = useApp();
  const { th } = useApp();
  const active = tab === TAB;
  const [sub, setSub] = useState('cal');
  const desk = useLayout().mode === 'desktop';
  // website: the Market News & Updates page (src/NewsHome.web.tsx); the phone keeps the layout below
  if (desk) return <NewsHome active={active} />;
  return (
    <Screen icon="newspaper" title="News" subtitle="Calendar, forex, crypto and Deriv headlines" right={<Badge label="PRO" color={th.gold} />}>
      <View style={{ gap: 14 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {TABS.map((x) => <Chip key={x.k} label={x.label} on={sub === x.k} onPress={() => setSub(x.k)} />)}
        </ScrollView>
        {sub === 'cal' ? <Calendar active={active} /> : <Feed topic={sub as any} active={active} />}
      </View>
    </Screen>
  );
}
