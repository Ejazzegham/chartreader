import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import Modal from '../Modal';
import { useApp } from '../store';
import { Screen, Card, Icon, Chip } from '../ui';
import { useLayout, useRealWindow } from '../win';
import { SYMBOLS, Sym, useFeed, chg, isBad, symOf, toggleFav, setWatch } from '../markets';
import { Coin } from '../MarketWidgets';
import { tvSymbol, tvHtml, TV_INTERVAL, TV_STUDIES } from '../tv';
import TradingViewPanel from '../TradingViewPanel';
import ChartWeb from '../ChartWeb';
import { useDash } from '../dash';
import { NAV } from '../nav';

// The TradingView page (tab 22, next to Markets in the menu): a full TradingView chart with its drawing tools, a market picker
// (Watchlist / Forex / Crypto / Deriv / Indices with live prices) and the control deck of TradingViewPanel (timeframe, chart style, indicators).
// The chart is only created the first time the page is opened (every page stays mounted, so this keeps the site fast), then it keeps its state.
const TV_TAB = NAV.findIndex((n) => n.key === 'tabTradingView');
const CATS: [string, string][] = [['fav', 'Watchlist'], ['forex', 'Forex'], ['crypto', 'Crypto'], ['deriv', 'Deriv'], ['indices', 'Indices']];
const MAX_ROWS = 60;

export default function TradingView() {
  const { th, t, tab } = useApp();
  const active = tab === TV_TAB;
  const desk = useLayout().mode === 'desktop';
  const H = useRealWindow().height;
  const dash = useDash();
  const { quotes, db } = useFeed(active);

  const [symId, setSymId] = useState(dash.sym);
  const [cat, setCat] = useState<string>(symOf(dash.sym).cat);
  const [q, setQ] = useState('');
  const [tf, setTf] = useState('900');
  const [studies, setStudies] = useState<string[]>(['vol']);
  const [cstyle, setCstyle] = useState('1');
  const [full, setFull] = useState(false);
  const [seen, setSeen] = useState(active);
  useEffect(() => { if (active) setSeen(true); }, [active]);

  const term = q.trim().toLowerCase();
  const favKey = db.favs.join(',');
  const list = useMemo(() => {
    const base = term
      ? SYMBOLS.filter((s) => !isBad(s.id) && (s.name + ' ' + s.id).toLowerCase().includes(term))
      : cat === 'fav' ? db.favs.map(symOf) : SYMBOLS.filter((s) => !isBad(s.id) && s.cat === cat);
    return base.filter((s) => !!tvSymbol(s)).slice(0, MAX_ROWS); // only markets TradingView has a symbol for
  }, [term, cat, favKey]);
  const listKey = list.map((s) => s.id).join(',');

  // live prices only while this page is open
  useEffect(() => {
    setWatch('tvpage', active ? [...new Set([symId, ...list.map((s) => s.id)])] : []);
    return () => setWatch('tvpage', []);
  }, [active, symId, listKey]);

  const sym = symOf(symId);
  const tv = tvSymbol(sym) ?? 'FX:EURUSD';
  const chartH = desk ? Math.max(560, Math.round(H * 0.72)) : Math.max(380, Math.round(H * 0.6));
  const x = quotes[symId], c = chg(symId), up = c >= 0, col = up ? th.buy : th.sell;

  const row = (s: Sym) => {
    const r = quotes[s.id], d = chg(s.id), rc = d >= 0 ? th.buy : th.sell, on = s.id === symId, fav = db.favs.includes(s.id);
    return (
      <Pressable key={s.id} accessibilityRole="button" onPress={() => setSymId(s.id)} style={((st: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 9, borderRadius: 8, borderWidth: 1, borderColor: on ? th.accent : 'transparent', backgroundColor: on ? th.accent + '1F' : st.hovered ? th.panel2 : 'transparent', cursor: 'pointer' })) as any}>
        <Coin s={s} size={30} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: th.text, fontWeight: '700', fontSize: 13.5 }}>{s.name}</Text>
          <Text numberOfLines={1} style={{ color: th.dim, fontSize: 11 }}>{s.sub ?? s.id}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text numberOfLines={1} style={{ color: th.text, fontWeight: '800', fontSize: 13, fontVariant: ['tabular-nums'] }}>{r ? r.price.toFixed(r.dec) : '—'}</Text>
          {!!r && <Text style={{ color: rc, fontSize: 11, fontWeight: '700' }}>{d >= 0 ? '+' : ''}{d.toFixed(2)}%</Text>}
        </View>
        <Pressable onPress={() => toggleFav(s.id)} hitSlop={8}><Icon name={fav ? 'star' : 'star-outline'} size={17} color={fav ? th.gold : th.dim} /></Pressable>
      </Pressable>
    );
  };

  const picker = (
    <Card style={{ padding: 12, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: th.panel2, borderColor: th.hair, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12 }}>
        <Icon name="search" size={17} color={th.dim} />
        <TextInput value={q} onChangeText={setQ} placeholder={`Search ${SYMBOLS.length} markets`} placeholderTextColor={th.dim} autoCapitalize="none" style={{ flex: 1, color: th.text, paddingVertical: 11, fontSize: 14, outlineStyle: 'none' } as any} />
        {!!q && <Pressable onPress={() => setQ('')} hitSlop={10}><Icon name="close-circle" size={17} color={th.dim} /></Pressable>}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
        {CATS.map(([k, label]) => <Chip key={k} label={label} icon={k === 'fav' ? 'star' : undefined} on={cat === k && !term} onPress={() => { setCat(k); setQ(''); }} />)}
      </ScrollView>
      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator style={{ maxHeight: desk ? chartH + 150 : 260 }} contentContainerStyle={{ gap: 2 }}>
        {list.length === 0
          ? <Text style={{ color: th.dim, fontSize: 13, padding: 8 }}>{cat === 'fav' && !term ? 'Star a market to keep it here.' : 'No market found.'}</Text>
          : list.map(row)}
      </ScrollView>
    </Card>
  );

  const chart = seen
    ? <TradingViewPanel symbol={tv} symId={symId} tf={tf} onTf={setTf} studies={studies} onStudies={setStudies} cstyle={cstyle} onStyle={setCstyle} height={chartH} onFull={() => setFull(true)} />
    : <View style={{ height: chartH }} />;

  return (
    <Screen fx="markets" icon="stats-chart" tag="Markets / Charts" title={t('tabTradingView')} subtitle="Professional TradingView charts with drawing tools, Fibonacci, indicators and every Forex, Crypto and Deriv market."
      features={[{ icon: 'pencil', title: 'Drawing tools', sub: 'Trend lines, Fibonacci, zones' }, { icon: 'options-outline', title: 'Indicators', sub: 'RSI, MACD, Bollinger and more' }, { icon: 'globe-outline', title: 'All markets', sub: 'Forex, crypto, Deriv, indices' }]}>
      {/* the pair that is open */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <Coin s={sym} size={40} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: th.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 }}>{sym.name}</Text>
          <Text numberOfLines={1} style={{ color: th.dim, fontSize: 12 }}>{tv}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: x?.dir ? (x.dir > 0 ? th.buy : th.sell) : th.text, fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{x ? x.price.toFixed(x.dec) : '—'}</Text>
          {!!x && <Text style={{ color: col, fontSize: 12.5, fontWeight: '800' }}>{up ? '+' : ''}{c.toFixed(2)}%</Text>}
        </View>
      </View>

      {desk ? (
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
          <View style={{ width: 330 }}>{picker}</View>
          <View style={{ flex: 1, minWidth: 0 }}>{chart}</View>
        </View>
      ) : (
        <View style={{ gap: 12 }}>{picker}{chart}</View>
      )}

      {/* full screen chart */}
      <Modal visible={full} animationType="fade" onRequestClose={() => setFull(false)}>
        <View style={{ flex: 1, backgroundColor: th.bg, paddingTop: desk ? 0 : 44 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}>
            <Coin s={sym} size={32} />
            <Text style={{ color: th.text, fontWeight: '800', fontSize: 16, flex: 1 }} numberOfLines={1}>{sym.name}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setFull(false)} hitSlop={8} style={{ width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: th.panel2, borderWidth: 1, borderColor: th.hair }}>
              <Icon name="close" size={20} color={th.text} />
            </Pressable>
          </View>
          {full && <ChartWeb key={`full-${symId}-${tf}-${cstyle}-${studies.join('')}-${th.bg}`} html={tvHtml(tv, TV_INTERVAL[tf] ?? '15', th.dark, th.bg, TV_STUDIES.filter((s) => studies.includes(s.k)).map((s) => s.id), cstyle)} />}
        </View>
      </Modal>
    </Screen>
  );
}
