import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Linking } from 'react-native';
import { LinearGradient } from './FlatGradient';
import Svg, { Path } from 'react-native-svg';
import { Icon, HeroBanner } from './ui';
import { Coin } from './MarketWidgets';
import { SYMBOLS, Sym, chg, isBad, useFeed, setWatch, toggleFav, symOf } from './markets';
import { useRealWindow } from './win';
import { useHeadlines, ago, tone, safeHttpUrl } from './headlines';
import { usePal, useSetup, Panel, Spark, TfTabs, ChartBody, Footer, Btn, useGo } from './DesktopHome.web';
import { Sessions } from './AnalysisHome.web';

// The website's Markets page, designed like the "Global Markets" mockup: hero, market categories, top watchlist, market explorer,
// live chart, and a right column with sessions, sentiment, top movers and a heatmap. Every number comes from the live feed.
// (Stocks and futures are in the mockup but this app has no feed for them, so they are not shown.)
type Props = { active: boolean; onSelect: (s: Sym) => void };

const GOLD_SILVER = ['frxXAUUSD', 'frxXAGUSD'], OIL = ['frxWTI', 'frxBRENT'];
const FX_FIRST = ['frxEURUSD', 'frxGBPUSD', 'frxUSDJPY', 'frxAUDUSD', 'frxUSDCAD', 'frxDXY', 'frxXAUUSD', 'frxXAGUSD', 'frxWTI', 'frxBRENT', 'cryBTCUSD', 'cryETHUSD'];
type CatKey = 'all' | 'forex' | 'crypto' | 'indices' | 'commodities' | 'metals' | 'deriv' | 'fav';
const CATS: { k: CatKey; label: string; icon: string; color: string }[] = [
  { k: 'all', label: 'All Markets', icon: 'globe-outline', color: '#3B5B93' },
  { k: 'forex', label: 'Forex', icon: 'swap-horizontal', color: '#3B5B93' },
  { k: 'crypto', label: 'Crypto', icon: 'logo-bitcoin', color: '#F59E0B' },
  { k: 'indices', label: 'Indices', icon: 'stats-chart', color: '#3B5B93' },
  { k: 'commodities', label: 'Commodities', icon: 'water', color: '#D99A1B' },
  { k: 'metals', label: 'Metals', icon: 'diamond-outline', color: '#C58A2B' },
  { k: 'deriv', label: 'Deriv', icon: 'pulse', color: '#0EA5A4' },
  { k: 'fav', label: 'Watchlist', icon: 'star', color: '#3B5B93' },
];
const catOf = (s: Sym): CatKey => (GOLD_SILVER.includes(s.id) ? 'metals' : OIL.includes(s.id) ? 'commodities' : s.cat === 'indices' ? 'indices' : s.cat === 'crypto' ? 'crypto' : s.cat === 'deriv' ? 'deriv' : 'forex');
const PAGE = 14;

function Gauge({ pct, color, track }: { pct: number; color: string; track: string }) {
  const len = Math.PI * 70, p = Math.max(0, Math.min(1, pct / 100));
  return (
    <Svg width={170} height={96} viewBox="0 0 170 96">
      <Path d="M 15 88 A 70 70 0 0 1 155 88" stroke={track} strokeWidth={13} fill="none" strokeLinecap="round" />
      <Path d="M 15 88 A 70 70 0 0 1 155 88" stroke={color} strokeWidth={13} fill="none" strokeLinecap="round" strokeDasharray={`${len * p} ${len}`} />
    </Svg>
  );
}

function Head({ icon, title, sub, right, onRight }: { icon: string; title: string; sub?: string; right?: string; onRight?: () => void }) {
  const P = usePal();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Icon name={icon} size={19} color={P.blue} />
      <Text style={{ color: P.head, fontSize: 17, fontWeight: '800', letterSpacing: -0.2 }}>{title}</Text>
      {!!sub && <Text style={{ color: P.body, fontSize: 11.5, marginLeft: 6 }}>{sub}</Text>}
      <View style={{ flex: 1 }} />
      {!!right && <Pressable onPress={onRight} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, cursor: 'pointer' } as any}><Text style={{ color: P.blue, fontSize: 12, fontWeight: '600' }}>{right}</Text><Icon name="arrow-forward" size={12} color={P.blue} /></Pressable>}
    </View>
  );
}

// ---------- hero
function Hero({ w, setCat, live }: { w: number; setCat: (k: CatKey) => void; live: boolean }) {
  return (
    <View style={{ width: '100%', maxWidth: 1280, alignSelf: 'center', paddingHorizontal: 32, paddingTop: 24 }}>
      <HeroBanner icon="pulse" title="Global Markets" subtitle="Explore forex, crypto, indices, commodities and more. Live prices, real-time data and powerful tools."
        features={[{ icon: 'flash', title: 'Live Prices', sub: live ? 'Real-time data' : 'Connecting…' }, { icon: 'stats-chart', title: 'Market Analysis', sub: 'Trends & insights' }, { icon: 'star', title: 'Watchlists', sub: 'Track your favorites' }, { icon: 'construct', title: 'Advanced Tools', sub: 'Make better decisions' }]} />
    </View>
  );
}

// ---------- category cards
function CatCards({ w, cat, setCat, counts, live }: { w: number; cat: CatKey; setCat: (k: CatKey) => void; counts: Record<string, number>; live: boolean }) {
  const P = usePal(), th = P.th, [gw, setGw] = useState(0);
  const list = CATS.filter((c) => c.k === 'all' || c.k === 'fav' || counts[c.k] > 0);
  const cols = w >= 1240 ? list.length : w >= 900 ? 4 : w >= 600 ? 3 : 2, gap = 12;
  const cw = gw ? Math.floor((gw - gap * (Math.min(cols, 8) - 1)) / Math.min(cols, 8)) : 0;
  return (
    <View onLayout={(e) => setGw(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
      {cw > 0 && list.map((c) => {
        const on = cat === c.k;
        return (
          <Pressable key={c.k} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setCat(c.k)}
            style={((s: any) => ({ width: cw, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: on ? 1.6 : 1, borderColor: on ? P.blue : s.hovered ? P.blue + '66' : P.border, backgroundColor: on ? P.soft : P.card, cursor: 'pointer', shadowColor: P.shadow, shadowOpacity: on ? 0.14 : 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } })) as any}>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: c.color + '24', alignItems: 'center', justifyContent: 'center' }}><Icon name={c.icon} size={18} color={c.color} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: P.head, fontSize: 12.5, fontWeight: '700' }} numberOfLines={1}>{c.label}</Text>
              <Text style={{ color: P.head, fontSize: 14, fontWeight: '800', marginTop: 1 }}>{counts[c.k] ?? 0}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: live ? th.buy : P.body }} /><Text style={{ color: live ? th.buy : P.body, fontSize: 10.5, fontWeight: '600' }}>{live ? 'Live' : 'Offline'}</Text></View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------- one row of the explorer / one card of the watchlist
function Row({ s, onSelect }: { s: Sym; onSelect: (s: Sym) => void }) {
  const P = usePal(), th = P.th, { quotes, db } = useFeed(true);
  const x = quotes[s.id], c = chg(s.id), col = c >= 0 ? th.buy : th.sell, fav = db.favs.includes(s.id);
  return (
    <Pressable onPress={() => onSelect(s)} style={((st: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: P.border, backgroundColor: st.hovered ? P.alt : P.card, cursor: 'pointer' })) as any}>
      <Coin s={s} size={38} />
      <View style={{ flex: 1.3, minWidth: 0 }}>
        <Text style={{ color: P.head, fontSize: 13.5, fontWeight: '700' }} numberOfLines={1}>{s.name}</Text>
        <Text style={{ color: P.body, fontSize: 11 }} numberOfLines={1}>{s.sub ?? s.id.replace(/^(frx|cry)/, '')}</Text>
      </View>
      <Spark pts={x?.pts ?? []} color={col} w={92} h={28} />
      <View style={{ minWidth: 86, alignItems: 'flex-end' }}>
        <Text style={{ color: P.head, fontSize: 13.5, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{x ? x.price.toFixed(x.dec) : '—'}</Text>
        <Text style={{ color: x ? col : P.body, fontSize: 11.5, fontWeight: '700' }}>{x ? `${c >= 0 ? '+' : '−'}${Math.abs(c).toFixed(2)}%` : ''}</Text>
      </View>
      <Pressable onPress={() => toggleFav(s.id)} hitSlop={8} style={{ cursor: 'pointer' } as any}><Icon name={fav ? 'star' : 'star-outline'} size={17} color={fav ? th.gold : P.body} /></Pressable>
    </Pressable>
  );
}

function WatchCard({ s, onSelect }: { s: Sym; onSelect: (s: Sym) => void }) {
  const P = usePal(), th = P.th, { quotes } = useFeed(true);
  const x = quotes[s.id], c = chg(s.id), col = c >= 0 ? th.buy : th.sell;
  return (
    <Pressable onPress={() => onSelect(s)} style={((st: any) => ({ width: 168, padding: 12, gap: 4, borderRadius: 12, borderWidth: 1, borderColor: P.border, backgroundColor: st.hovered ? P.alt : P.card, cursor: 'pointer' })) as any}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><Coin s={s} size={22} /><Text style={{ color: P.head, fontSize: 12, fontWeight: '700', flex: 1 }} numberOfLines={1}>{s.name}</Text></View>
      <Text style={{ color: col, fontSize: 19, fontWeight: '800', fontVariant: ['tabular-nums'] }} numberOfLines={1}>{x ? x.price.toFixed(x.dec) : '—'}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: x ? col : P.body, fontSize: 11.5, fontWeight: '700' }}>{x ? `${c >= 0 ? '+' : '−'}${Math.abs(c).toFixed(2)}%` : ''}</Text>
        <Spark pts={x?.pts ?? []} color={col} w={70} h={24} />
      </View>
    </Pressable>
  );
}

export default function MarketsHome({ active, onSelect }: Props) {
  const P = usePal(), th = P.th, go = useGo();
  const w = useRealWindow().width;
  const { quotes, db, status } = useFeed(active);
  const live = status === 'live';
  const [cat, setCat] = useState<CatKey>('all'), [q, setQ] = useState(''), [sort, setSort] = useState<'pop' | 'up' | 'down' | 'az'>('pop'), [sortOpen, setSortOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE), [mover, setMover] = useState<'gain' | 'lose'>('gain');
  const [chartSym, setChartSym] = useState('frxEURUSD'), [tf, setTf] = useState('3600'), [pairOpen, setPairOpen] = useState(false), [cw, setCw] = useState(0);
  const heads = useHeadlines('forex', active);
  useEffect(() => { setLimit(PAGE); }, [cat, q, sort]);

  const all = useMemo(() => SYMBOLS.filter((s) => !isBad(s.id)), [Object.keys(quotes).length]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length, fav: db.favs.length };
    all.forEach((s) => { const k = catOf(s); c[k] = (c[k] ?? 0) + 1; });
    return c;
  }, [all, db.favs.length]);

  const term = q.trim().toLowerCase();
  const rows = useMemo(() => {
    let l = term ? all.filter((s) => (s.name + ' ' + s.id).toLowerCase().includes(term)) : cat === 'all' ? all : cat === 'fav' ? db.favs.map(symOf) : all.filter((s) => catOf(s) === cat);
    const rank = (s: Sym) => { const i = FX_FIRST.indexOf(s.id); return i < 0 ? 99 : i; };
    if (sort === 'pop') l = [...l].sort((a, b) => rank(a) - rank(b));
    else if (sort === 'az') l = [...l].sort((a, b) => a.name.localeCompare(b.name));
    else l = [...l].sort((a, b) => (sort === 'up' ? chg(b.id) - chg(a.id) : chg(a.id) - chg(b.id)));
    return l;
  }, [all, cat, term, sort, db.favs.join(','), Object.keys(quotes).length]);
  const shown = rows.slice(0, limit);

  // quotes are only fetched for pairs somebody watches: the explorer rows, the watchlist, and a spread of every market for movers, sentiment and the heatmap
  const spread = useMemo(() => [...new Set([...FX_FIRST, ...all.filter((s) => catOf(s) !== 'deriv').slice(0, 40).map((s) => s.id)])].filter((id) => !isBad(id)), [all]);
  const watchKey = [...shown.map((s) => s.id), ...db.favs, ...spread, chartSym].join(',');
  useEffect(() => { if (active) setWatch('mk-home', [...new Set(watchKey.split(','))].slice(0, 90)); return () => setWatch('mk-home', []); }, [active, watchKey]);

  const favs = db.favs.filter((id) => !isBad(id)).slice(0, 6).map(symOf);
  const wide = w >= 1100, two = w >= 1180;

  // ---- derived from the live quotes
  const withQ = spread.map(symOf).filter((s) => quotes[s.id]);
  const forexSet = withQ.filter((s) => catOf(s) === 'forex');
  const upPct = forexSet.length ? Math.round((forexSet.filter((s) => chg(s.id) > 0).length / forexSet.length) * 100) : 50;
  const senti = upPct >= 60 ? { l: 'Bullish', c: th.buy } : upPct <= 40 ? { l: 'Bearish', c: th.sell } : { l: 'Neutral', c: th.gold };
  const movers = useMemo(() => [...withQ].sort((a, b) => (mover === 'gain' ? chg(b.id) - chg(a.id) : chg(a.id) - chg(b.id))).slice(0, 5), [withQ.map((s) => s.id).join(','), mover, Object.values(quotes).length]);
  const heat = (['forex', 'crypto', 'indices', 'metals', 'commodities'] as CatKey[]).filter((k) => counts[k] > 0).map((k) => {
    const l = withQ.filter((s) => catOf(s) === k);
    return { k, label: CATS.find((c) => c.k === k)!.label, v: l.length ? l.reduce((a, s) => a + chg(s.id), 0) / l.length : null };
  });
  const best = [...withQ].sort((a, b) => chg(b.id) - chg(a.id))[0], worst = [...withQ].sort((a, b) => chg(a.id) - chg(b.id))[0];
  const dxy = quotes['frxDXY'] ? chg('frxDXY') : null;
  const pm = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}%`;
  const insights: { s?: Sym; t: string; d: string }[] = [];
  if (best && chg(best.id) > 0) insights.push({ s: best, t: `${best.name} leads the gainers`, d: `${pm(chg(best.id))} today among the markets tracked.` });
  if (worst && chg(worst.id) < 0) insights.push({ s: worst, t: `${worst.name} is the weakest`, d: `${pm(chg(worst.id))} today among the markets tracked.` });
  if (dxy != null) insights.push({ s: symOf('frxDXY'), t: `US Dollar Index is ${dxy >= 0 ? 'higher' : 'lower'}`, d: `${pm(dxy)} today. A stronger dollar often weighs on EUR/USD, gold and crypto.` });
  if (forexSet.length) insights.push({ t: `${forexSet.filter((s) => chg(s.id) > 0).length} of ${forexSet.length} forex pairs are up`, d: 'Share of tracked forex pairs trading above their daily open.' });

  // ---- live chart
  const s = useSetup(chartSym, tf, 'mk-chart');
  const last = s.data.slice(-60), hi = last.length ? Math.max(...last.map((c) => c.h)) : null, lo = last.length ? Math.min(...last.map((c) => c.l)) : null;
  const trend = s.land?.ict.trend, tc = trend === 'bullish' ? th.buy : trend === 'bearish' ? th.sell : th.gold;
  const pairs = [...new Set([chartSym, ...db.favs, 'frxEURUSD', 'frxGBPUSD', 'frxUSDJPY', 'frxXAUUSD', 'cryBTCUSD'])].filter((id) => !isBad(id)).slice(0, 9);
  const mini = (icon: string, t: string, pill: string, pc: string, body: React.ReactNode) => (
    <View style={{ flex: 1, minWidth: 240, flexDirection: 'row', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: P.border, backgroundColor: P.card }}>
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: P.soft, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={17} color={P.blue} /></View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text style={{ color: P.head, fontSize: 13.5, fontWeight: '700', flex: 1 }}>{t}</Text><View style={{ paddingHorizontal: 10, height: 22, borderRadius: 11, justifyContent: 'center', backgroundColor: pc + '1F' }}><Text style={{ color: pc, fontSize: 11, fontWeight: '700' }}>{pill}</Text></View></View>
        {body}
      </View>
    </View>
  );
  const fxp = (v: number | null) => (v == null ? '—' : v.toFixed(s.dec));

  const left = (
    <View style={{ flex: 1, minWidth: 0, gap: 22 }}>
      {/* top watchlist + search + category chips */}
      <Panel style={{ padding: 20, gap: 14 }}>
        <Head icon="star" title="Top Watchlist" right="View All" onRight={() => setCat('fav')} />
        {favs.length === 0 ? <Text style={{ color: P.body, fontSize: 12.5 }}>Tap the star on any market to keep it here.</Text> : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>{favs.map((f) => <WatchCard key={f.id} s={f} onSelect={onSelect} />)}</ScrollView>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: P.border, backgroundColor: P.dark ? th.panel2 : '#FAFBFE' }}>
          <Icon name="search" size={16} color={P.body} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search markets (symbol, name, or keyword)..." placeholderTextColor={P.body} style={{ flex: 1, color: P.head, fontSize: 13, outlineStyle: 'none' } as any} />
          {!!q && <Pressable onPress={() => setQ('')} hitSlop={8}><Icon name="close-circle" size={16} color={P.body} /></Pressable>}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {CATS.filter((c) => c.k !== 'fav' && (c.k === 'all' || counts[c.k] > 0)).map((c) => {
            const on = cat === c.k && !term;
            return (
              <Pressable key={c.k} onPress={() => { setCat(c.k); setQ(''); }} style={((st: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 34, borderRadius: 10, borderWidth: 1, borderColor: on ? P.blue : P.border, backgroundColor: on ? P.blue : st.hovered ? P.alt : P.card, cursor: 'pointer' })) as any}>
                {c.k !== 'all' && <Icon name={c.icon} size={13} color={on ? th.onAccent : P.blue} />}
                <Text style={{ color: on ? th.onAccent : P.head, fontSize: 12.5, fontWeight: '600' }}>{c.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </Panel>

      {/* market explorer */}
      <Panel style={{ padding: 20, gap: 14, zIndex: 5 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 6 }}>
          <Icon name="star" size={19} color={P.blue} />
          <Text style={{ color: P.head, fontSize: 17, fontWeight: '800' }}>Market Explorer</Text>
          <Text style={{ color: P.body, fontSize: 11.5, marginLeft: 6 }}>Showing {Math.min(limit, rows.length)} of {rows.length} markets</Text>
          <View style={{ flex: 1 }} />
          <View>
            <Pressable onPress={() => setSortOpen((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: P.border, backgroundColor: P.card, cursor: 'pointer' } as any}>
              <Text style={{ color: P.body, fontSize: 12 }}>Sort by: <Text style={{ color: P.head, fontWeight: '700' }}>{({ pop: 'Popular', up: 'Top gainers', down: 'Top losers', az: 'A to Z' } as const)[sort]}</Text></Text>
              <Icon name="chevron-down" size={13} color={P.body} />
            </Pressable>
            {sortOpen && (
              <View style={{ position: 'absolute', top: 38, right: 0, minWidth: 160, padding: 6, borderRadius: 12, borderWidth: 1, borderColor: P.border, backgroundColor: P.card, zIndex: 20, shadowColor: P.shadow, shadowOpacity: 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } }}>
                {([['pop', 'Popular'], ['up', 'Top gainers'], ['down', 'Top losers'], ['az', 'A to Z']] as const).map(([k, l]) => (
                  <Pressable key={k} onPress={() => { setSort(k); setSortOpen(false); }} style={((st: any) => ({ height: 34, paddingHorizontal: 10, borderRadius: 8, justifyContent: 'center', cursor: 'pointer', backgroundColor: sort === k ? P.soft : st.hovered ? P.alt : 'transparent' })) as any}><Text style={{ color: sort === k ? P.blue : P.head, fontSize: 12.5, fontWeight: sort === k ? '700' : '500' }}>{l}</Text></Pressable>
                ))}
              </View>
            )}
          </View>
        </View>
        {rows.length === 0 && <Text style={{ color: P.body, fontSize: 13, padding: 8 }}>{cat === 'fav' && !term ? 'Tap the star on any market to keep it here.' : 'No market matches.'}</Text>}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {shown.map((m) => <View key={m.id} style={{ width: wide ? '49.3%' : '100%' } as any}><Row s={m} onSelect={onSelect} /></View>)}
        </View>
        {rows.length > limit && <View style={{ alignItems: 'center' }}><Btn ghost arrow={false} label={`Show more (${rows.length - limit} left)`} onPress={() => setLimit(limit + PAGE)} /></View>}
      </Panel>

      {/* live chart */}
      <Panel style={{ padding: 20, gap: 12, zIndex: 4 }}>
        <Head icon="analytics" title="Live Market Chart" />
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, zIndex: 6 }}>
          <View>
            <Pressable onPress={() => setPairOpen((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 36, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: P.border, backgroundColor: P.card, cursor: 'pointer' } as any}>
              <Coin s={s.sym} size={22} /><Text style={{ color: P.head, fontSize: 13.5, fontWeight: '700' }}>{s.sym.name}</Text><Icon name="chevron-down" size={13} color={P.body} />
            </Pressable>
            {pairOpen && (
              <View style={{ position: 'absolute', top: 40, left: 0, minWidth: 200, padding: 6, borderRadius: 12, borderWidth: 1, borderColor: P.border, backgroundColor: P.card, zIndex: 30, shadowColor: P.shadow, shadowOpacity: 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } }}>
                {pairs.map((id) => (
                  <Pressable key={id} onPress={() => { setChartSym(id); setPairOpen(false); }} style={((st: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, height: 36, paddingHorizontal: 8, borderRadius: 8, cursor: 'pointer', backgroundColor: id === chartSym ? P.soft : st.hovered ? P.alt : 'transparent' })) as any}>
                    <Coin s={symOf(id)} size={20} /><Text style={{ color: P.head, fontSize: 12.5, fontWeight: '600' }}>{symOf(id).name}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
          <TfTabs tf={tf} set={setTf} />
        </View>
        <View onLayout={(e) => setCw(Math.round(e.nativeEvent.layout.width))} style={{ borderRadius: 10, overflow: 'hidden' }}>
          <ChartBody s={s} tf={tf} width={cw} height={340} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {mini('git-network', 'Market Structure', trend === 'bullish' ? 'Bullish' : trend === 'bearish' ? 'Bearish' : 'Range', tc, <Text style={{ color: P.body, fontSize: 11.5, lineHeight: 16 }}>{s.ready ? s.structure : 'Reading the market…'}</Text>)}
          {mini('layers', 'Key Levels', 'Last 60 candles', P.blue, (
            <View style={{ gap: 2 }}>
              <Text style={{ color: P.body, fontSize: 11.5 }}>Range high: <Text style={{ color: P.head, fontWeight: '700' }}>{fxp(hi)}</Text></Text>
              <Text style={{ color: P.body, fontSize: 11.5 }}>Range low: <Text style={{ color: P.head, fontWeight: '700' }}>{fxp(lo)}</Text></Text>
            </View>
          ))}
        </View>
      </Panel>
    </View>
  );

  const right = (
    <View style={{ width: two ? 340 : '100%', gap: 22 }}>
      <Sessions go={(t) => go(t)} style={{ flex: 0, minWidth: 0, padding: 20 }} />
      <Panel style={{ padding: 20, gap: 8 }}>
        <Head icon="shield-checkmark" title="Forex Market Sentiment" right="News" onRight={() => go(13)} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 170, height: 96, alignItems: 'center' }}>
            <Gauge pct={upPct} color={senti.c} track={P.dark ? th.panel2 : '#EEF2F8'} />
            <Text style={{ position: 'absolute', bottom: 0, color: P.head, fontSize: 26, fontWeight: '800' }}>{forexSet.length ? `${upPct}%` : '—'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: senti.c, fontSize: 17, fontWeight: '800' }}>{forexSet.length ? senti.l : 'Loading'}</Text>
            <Text style={{ color: P.body, fontSize: 11.5, lineHeight: 16 }}>Share of forex pairs trading above today’s open.</Text>
          </View>
        </View>
      </Panel>
      <Panel style={{ padding: 20, gap: 10 }}>
        <Head icon="trending-up" title="Top Movers" />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {([['gain', 'Gainers', 'arrow-up', th.buy], ['lose', 'Losers', 'arrow-down', th.sell]] as const).map(([k, l, ic, c]) => (
            <Pressable key={k} onPress={() => setMover(k)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 34, borderRadius: 8, backgroundColor: mover === k ? c + '1F' : P.alt, cursor: 'pointer' } as any}>
              <Icon name={ic} size={13} color={c} /><Text style={{ color: mover === k ? c : P.body, fontSize: 12.5, fontWeight: '700' }}>{l}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', paddingHorizontal: 4 }}>
          <Text style={{ flex: 1.6, color: P.body, fontSize: 11 }}>Symbol</Text><Text style={{ flex: 1, color: P.body, fontSize: 11, textAlign: 'right' }}>Price</Text><Text style={{ flex: 1, color: P.body, fontSize: 11, textAlign: 'right' }}>Change</Text>
        </View>
        {movers.length === 0 && <Text style={{ color: P.body, fontSize: 12.5 }}>Waiting for prices…</Text>}
        {movers.map((m) => {
          const c = chg(m.id), col = c >= 0 ? th.buy : th.sell, x = quotes[m.id];
          return (
            <Pressable key={m.id} onPress={() => onSelect(m)} style={((st: any) => ({ flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingHorizontal: 4, borderRadius: 8, cursor: 'pointer', backgroundColor: st.hovered ? P.alt : 'transparent' })) as any}>
              <View style={{ flex: 1.6, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 }}><Coin s={m} size={22} /><Text style={{ color: P.head, fontSize: 12.5, fontWeight: '600', flex: 1 }} numberOfLines={1}>{m.name}</Text></View>
              <Text style={{ flex: 1, color: P.head, fontSize: 12.5, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{x ? x.price.toFixed(x.dec) : '—'}</Text>
              <Text style={{ flex: 1, color: col, fontSize: 12.5, fontWeight: '700', textAlign: 'right' }}>{pm(c)}</Text>
            </Pressable>
          );
        })}
      </Panel>
      <Panel style={{ padding: 20, gap: 12 }}>
        <Head icon="grid" title="Market Heatmap" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {heat.map((h) => {
            const up = (h.v ?? 0) >= 0, a = Math.min(1, Math.abs(h.v ?? 0) / 2), base = h.v == null ? P.alt : up ? th.buy : th.sell;
            return (
              <View key={h.k} style={{ width: '31.5%', height: 58, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: h.v == null ? P.alt : base + (Math.round(40 + a * 120)).toString(16).padStart(2, '0') } as any}>
                <Text style={{ color: P.head, fontSize: 12, fontWeight: '700' }}>{h.label}</Text>
                <Text style={{ color: h.v == null ? P.body : up ? th.buy : th.sell, fontSize: 12, fontWeight: '800' }}>{h.v == null ? '—' : pm(h.v)}</Text>
              </View>
            );
          })}
        </View>
        <Text style={{ color: P.body, fontSize: 11 }}>Average daily change of the markets tracked in each group.</Text>
      </Panel>
    </View>
  );

  const bottom = w >= 1000;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: P.alt, display: active ? 'flex' : 'none' } as any} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
      <Hero w={w} setCat={(k) => setCat(k)} live={live} />
      <View style={{ width: '100%', maxWidth: 1280, alignSelf: 'center', paddingHorizontal: 32, paddingTop: 24, paddingBottom: 30, gap: 22 }}>
        <CatCards w={w} cat={cat} setCat={(k) => { setCat(k); setQ(''); }} counts={counts} live={live} />
        <View style={{ flexDirection: two ? 'row' : 'column', gap: 22, alignItems: 'flex-start' }}>{left}{right}</View>
        <View style={{ flexDirection: bottom ? 'row' : 'column', gap: 22, alignItems: 'stretch' }}>
          <Panel style={{ flex: 1, padding: 20, gap: 12 }}>
            <Head icon="newspaper" title="Latest Market News" right="View All" onRight={() => go(13)} />
            {heads.items.length === 0 && <Text style={{ color: P.body, fontSize: 12.5 }}>{heads.loading ? 'Loading headlines…' : heads.err || 'No headlines right now.'}</Text>}
            {heads.items.slice(0, 5).map((h) => {
              const t = tone(h.title), c = t === 'up' ? th.buy : t === 'down' ? th.sell : P.blue, url = safeHttpUrl(h.link);
              return (
                <Pressable key={h.id} onPress={() => url && Linking.openURL(url).catch(() => {})} style={{ flexDirection: 'row', gap: 10, cursor: 'pointer' } as any}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c, marginTop: 6 }} />
                  <View style={{ flex: 1 }}><Text style={{ color: P.head, fontSize: 12.5, fontWeight: '600', lineHeight: 17 }} numberOfLines={2}>{h.title}</Text><Text style={{ color: P.body, fontSize: 11 }}>{h.source} · {ago(h.t)}</Text></View>
                </Pressable>
              );
            })}
          </Panel>
          <Panel style={{ flex: 1, padding: 20, gap: 12 }}>
            <Head icon="bulb-outline" title="Today’s Market Facts" />
            {insights.length === 0 && <Text style={{ color: P.body, fontSize: 12.5 }}>Waiting for prices…</Text>}
            {insights.map((i, k) => (
              <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {i.s ? <Coin s={i.s} size={34} /> : <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: P.soft, alignItems: 'center', justifyContent: 'center' }}><Icon name="pie-chart" size={16} color={P.blue} /></View>}
                <View style={{ flex: 1 }}><Text style={{ color: P.head, fontSize: 12.5, fontWeight: '700' }} numberOfLines={1}>{i.t}</Text><Text style={{ color: P.body, fontSize: 11.5, lineHeight: 16 }} numberOfLines={2}>{i.d}</Text></View>
              </View>
            ))}
          </Panel>
          <LinearGradient colors={['#0F1E3D', '#0F1E3D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, padding: 22, borderRadius: 14, gap: 10, justifyContent: 'center', overflow: 'hidden' }}>
            <Text style={{ color: '#FFFFFF', fontSize: 19, fontWeight: '800', lineHeight: 24 }}>Trade Smarter with Our Tools</Text>
            <Text style={{ color: '#DCE6FFCC', fontSize: 12.5, lineHeight: 18 }}>Advanced charts, real-time data, market analysis and more.</Text>
            <View style={{ alignSelf: 'flex-start', marginTop: 6 }}><Btn label="Explore Tools" onPress={() => go(1)} /></View>
          </LinearGradient>
        </View>
      </View>
      <Footer w={w} go={go} />
    </ScrollView>
  );
}
