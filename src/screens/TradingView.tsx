import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Platform, Linking } from 'react-native';
import Modal from '../Modal';
import { useApp } from '../store';
import { Screen, Card, Icon } from '../ui';
import { useLayout, useRealWindow } from '../win';
import { SYMBOLS, Sym, useFeed, chg, isBad, symOf, toggleFav, setWatch } from '../markets';
import { Coin } from '../MarketWidgets';
import { tvSymbol, tvHtml, TV_STUDIES, TV_STYLES, TV_GROUPS } from '../tv';
import ChartWeb from '../ChartWeb';
import { useDash } from '../dash';
import { NAV } from '../nav';

// The TradingView page (tab 22, next to Markets). A pro charting workspace:
//  - market picker (Watchlist / Forex / Crypto / Deriv / Indices, live prices, star)
//  - 1, 2 or 4 charts at once (compare pairs), each with its own pair; timeframes can be linked or independent
//  - pro timeframe bar (1m ... 1M), chart styles, indicators with quick sets, time zone, compare presets
//  - a compare strip (price, day change, relative strength) and true browser full screen (key F)
// The charts are created the first time the page is opened (every page stays mounted), then keep their state.
const TV_TAB = NAV.findIndex((n) => n.key === 'tabTradingView');
type Layout = '1' | '2h' | '2v' | '4';
const CATS: [string, string][] = [['fav', 'Watchlist'], ['forex', 'Forex'], ['crypto', 'Crypto'], ['deriv', 'Deriv'], ['indices', 'Indices']];
const MAX_ROWS = 60;
const TF_GROUPS: { g: string; items: [string, string][] }[] = [
  { g: 'MINUTES', items: [['1', '1m'], ['3', '3m'], ['5', '5m'], ['15', '15m'], ['30', '30m']] },
  { g: 'HOURS', items: [['60', '1H'], ['120', '2H'], ['240', '4H']] },
  { g: 'DAYS +', items: [['D', '1D'], ['W', '1W'], ['M', '1M']] },
];
const LAYOUTS: { k: Layout; n: number; label: string }[] = [{ k: '1', n: 1, label: 'Single chart' }, { k: '2h', n: 2, label: '2 side by side' }, { k: '2v', n: 2, label: '2 stacked' }, { k: '4', n: 4, label: '4 charts' }];
const ZONES: [string, string][] = [['Etc/UTC', 'UTC'], ['America/New_York', 'New York'], ['Europe/London', 'London'], ['Asia/Tokyo', 'Tokyo'], ['Asia/Dubai', 'Dubai'], ['Asia/Karachi', 'Karachi']];
const SETS: [string, string[]][] = [['Classic', ['rsi', 'macd', 'bb']], ['Momentum', ['rsi', 'macd', 'stoch']], ['Trend', ['ema', 'adx', 'sar']], ['Volatility', ['bb', 'atr']], ['Volume', ['vol', 'obv', 'mfi']]];
const PRESETS: { label: string; layout: Layout; ids: string[] }[] = [
  { label: 'EUR/USD vs GBP/USD', layout: '2h', ids: ['frxEURUSD', 'frxGBPUSD'] },
  { label: 'Gold vs Dollar Index', layout: '2h', ids: ['frxXAUUSD', 'frxDXY'] },
  { label: 'Bitcoin vs Ethereum', layout: '2h', ids: ['cryBTCUSD', 'cryETHUSD'] },
  { label: 'USD/JPY vs EUR/JPY', layout: '2v', ids: ['frxUSDJPY', 'frxEURJPY'] },
  { label: 'The 4 majors', layout: '4', ids: ['frxEURUSD', 'frxGBPUSD', 'frxUSDJPY', 'frxUSDCHF'] },
  { label: 'Gold, DXY, EUR, BTC', layout: '4', ids: ['frxXAUUSD', 'frxDXY', 'frxEURUSD', 'cryBTCUSD'] },
];

const Glyph = ({ k, color }: { k: Layout; color: string }) => {
  const box = (key: number) => <View key={key} style={{ flex: 1, borderWidth: 1.5, borderColor: color, borderRadius: 2 }} />;
  const rowOf = (key: number) => <View key={key} style={{ flex: 1, flexDirection: 'row', gap: 2 }}>{[0, 1].map(box)}</View>;
  return (
    <View style={{ width: 20, height: 15, flexDirection: k === '2v' ? 'column' : 'row', gap: 2 }}>
      {k === '1' && box(0)}
      {(k === '2h' || k === '2v') && [0, 1].map(box)}
      {k === '4' && <View style={{ flex: 1, gap: 2 }}>{[0, 1].map(rowOf)}</View>}
    </View>
  );
};

export default function TradingView() {
  const { th, t, tab } = useApp();
  const active = tab === TV_TAB;
  const desk = useLayout().mode === 'desktop';
  const H = useRealWindow().height;
  const web = Platform.OS === 'web';
  const dash = useDash();
  const { quotes, db } = useFeed(active);

  const [layout, setLayout] = useState<Layout>('1');
  const [cells, setCells] = useState<string[]>([dash.sym, 'frxGBPUSD', 'frxUSDJPY', 'frxXAUUSD']);
  const [act, setAct] = useState(0); // the chart the picker changes
  const [tfs, setTfs] = useState<string[]>(['15', '15', '15', '15']);
  const [sync, setSync] = useState(true); // one timeframe for every chart
  const [studies, setStudies] = useState<string[]>(['vol']);
  const [cstyle, setCstyle] = useState('1');
  const [tz, setTz] = useState('Etc/UTC');
  const [panel, setPanel] = useState<'' | 'style' | 'ind' | 'tz' | 'cmp'>('');
  const [cat, setCat] = useState<string>(symOf(dash.sym).cat);
  const [q, setQ] = useState('');
  const [reload, setReload] = useState(0);
  const [isFs, setIsFs] = useState(false), [pseudo, setPseudo] = useState(false);
  const [seen, setSeen] = useState(active);
  const wsRef = useRef<any>(null);
  useEffect(() => { if (active) setSeen(true); }, [active]);

  const n = LAYOUTS.find((l) => l.k === layout)!.n;
  useEffect(() => { if (act >= n) setAct(0); }, [n]);
  const symId = cells[act] ?? cells[0];
  const sym = symOf(symId);
  const tv = tvSymbol(sym) ?? 'FX:EURUSD';
  const fsOn = isFs || pseudo;
  const stack = !desk || layout === '2v';
  const gridH = desk ? Math.max(520, Math.round(H * 0.7)) : n === 1 ? Math.max(380, Math.round(H * 0.6)) : n * 320;
  const studyIds = TV_STUDIES.filter((s) => studies.includes(s.k)).map((s) => s.id);

  // ---- market picker ----
  const term = q.trim().toLowerCase();
  const favKey = db.favs.join(',');
  const list = useMemo(() => {
    const base = term
      ? SYMBOLS.filter((s) => !isBad(s.id) && (s.name + ' ' + s.id).toLowerCase().includes(term))
      : cat === 'fav' ? db.favs.map(symOf) : SYMBOLS.filter((s) => !isBad(s.id) && s.cat === cat);
    return base.filter((s) => !!tvSymbol(s)).slice(0, MAX_ROWS);
  }, [term, cat, favKey]);
  const watchKey = [...cells.slice(0, n), ...list.map((s) => s.id)].join(',');
  useEffect(() => {
    setWatch('tvpage', active ? [...new Set(watchKey.split(','))] : []);
    return () => setWatch('tvpage', []);
  }, [active, watchKey]);

  // ---- actions ----
  const pickSym = (id: string) => setCells((c) => c.map((x, i) => (i === act ? id : x)));
  const setTf = (k: string) => setTfs((a) => (sync ? a.map(() => k) : a.map((x, i) => (i === act ? k : x))));
  const toggleStudy = (k: string) => setStudies((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  const applyPreset = (p: typeof PRESETS[number]) => { setLayout(p.layout); setCells((c) => c.map((x, i) => p.ids[i] ?? x)); setAct(0); setPanel(''); };
  const toggleFull = () => {
    if (pseudo) { setPseudo(false); return; }
    if (web && (document as any).fullscreenElement) { (document as any).exitFullscreen?.(); return; }
    const el = wsRef.current;
    try { if (web && el?.requestFullscreen) { Promise.resolve(el.requestFullscreen()).catch(() => setPseudo(true)); return; } } catch {}
    setPseudo(true); // browsers or phones without the Fullscreen API: a full-window view instead
  };
  useEffect(() => {
    if (!web) return;
    const f = () => setIsFs(!!wsRef.current && (document as any).fullscreenElement === wsRef.current);
    document.addEventListener('fullscreenchange', f);
    return () => document.removeEventListener('fullscreenchange', f);
  }, [web]);
  useEffect(() => {
    if (!web || !active) return;
    const k = (e: KeyboardEvent) => {
      const tg = e.target as HTMLElement | null;
      if (tg && /INPUT|TEXTAREA/.test(tg.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'f' || e.key === 'F') toggleFull();
      const m: Record<string, Layout> = { '1': '1', '2': '2h', '3': '2v', '4': '4' };
      if (m[e.key]) setLayout(m[e.key]);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [web, active, pseudo]);

  // ---- pieces ----
  const hov = (on: boolean, st: any) => ({ backgroundColor: on ? th.accent + '26' : st.hovered ? th.panel2 : 'transparent', borderColor: on ? th.accent : th.hair });
  const tool = (icon: string, label: string, on: boolean, onPress: () => void, badge?: string) => (
    <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={((st: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 7, height: 36, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, cursor: 'pointer', ...hov(on, st) })) as any}>
      <Icon name={icon} size={16} color={on ? th.accent : th.text} />
      <Text style={{ color: on ? th.accent : th.text, fontSize: 12.5, fontWeight: '700' }}>{label}</Text>
      {!!badge && <View style={{ minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: th.accent, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: th.onAccent, fontSize: 10.5, fontWeight: '800' }}>{badge}</Text></View>}
    </Pressable>
  );
  const chipBtn = (key: string, label: string, on: boolean, onPress: () => void, icon?: string) => (
    <Pressable key={key} onPress={onPress} style={((st: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, cursor: 'pointer', ...hov(on, st) })) as any}>
      {!!icon && <Icon name={icon} size={15} color={on ? th.accent : th.dim} />}
      <Text style={{ color: on ? th.accent : th.text, fontSize: 12.5, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
  const eyebrow = (s: string) => <Text style={{ color: th.dim, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 }}>{s}</Text>;

  const row = (s: Sym) => {
    const r = quotes[s.id], d = chg(s.id), rc = d >= 0 ? th.buy : th.sell, on = cells.slice(0, n).includes(s.id), cur = s.id === symId, fav = db.favs.includes(s.id);
    return (
      <Pressable key={s.id} accessibilityRole="button" onPress={() => pickSym(s.id)} style={((st: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 9, borderRadius: 8, borderWidth: 1, borderColor: cur ? th.accent : 'transparent', backgroundColor: cur ? th.accent + '1F' : st.hovered ? th.panel2 : 'transparent', cursor: 'pointer' })) as any}>
        <Coin s={s} size={30} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: th.text, fontWeight: '700', fontSize: 13.5 }}>{s.name}</Text>
          <Text numberOfLines={1} style={{ color: th.dim, fontSize: 11 }}>{on && !cur ? 'On a chart now' : s.sub ?? s.id}</Text>
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
      {n > 1 && (
        <View style={{ gap: 6 }}>
          {eyebrow('CHANGING CHART')}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {cells.slice(0, n).map((id, i) => (
              <Pressable key={i} onPress={() => setAct(i)} style={((st: any) => ({ flex: 1, height: 34, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center', cursor: 'pointer', ...hov(i === act, st) })) as any}>
                <Text numberOfLines={1} style={{ color: i === act ? th.accent : th.text, fontSize: 11.5, fontWeight: '800' }}>{i + 1} · {symOf(id).name.split(' ')[0]}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: th.panel2, borderColor: th.hair, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12 }}>
        <Icon name="search" size={17} color={th.dim} />
        <TextInput value={q} onChangeText={setQ} placeholder={`Search ${SYMBOLS.length} markets`} placeholderTextColor={th.dim} autoCapitalize="none" style={{ flex: 1, color: th.text, paddingVertical: 11, fontSize: 14, outlineStyle: 'none' } as any} />
        {!!q && <Pressable onPress={() => setQ('')} hitSlop={10}><Icon name="close-circle" size={17} color={th.dim} /></Pressable>}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {CATS.map(([k, label]) => chipBtn(k, label, cat === k && !term, () => { setCat(k); setQ(''); }, k === 'fav' ? 'star' : undefined))}
      </View>
      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ maxHeight: desk ? gridH + 90 : 260 }} contentContainerStyle={{ gap: 2 }}>
        {list.length === 0
          ? <Text style={{ color: th.dim, fontSize: 13, padding: 8 }}>{cat === 'fav' && !term ? 'Star a market to keep it here.' : 'No market found.'}</Text>
          : list.map(row)}
      </ScrollView>
    </Card>
  );

  // the pair that is open: always on a solid card so it reads on any backdrop
  const x = quotes[symId], c = chg(symId), up = c >= 0, col = up ? th.buy : th.sell, fav = db.favs.includes(symId);
  const pairCard = (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
      <Coin s={sym} size={42} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: th.text, fontSize: 19, fontWeight: '800', letterSpacing: -0.3 }}>{sym.name}</Text>
        <Text numberOfLines={1} style={{ color: th.dim, fontSize: 12 }}>{tv}{n > 1 ? `  ·  Chart ${act + 1} of ${n}` : ''}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ color: x?.dir ? (x.dir > 0 ? th.buy : th.sell) : th.text, fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{x ? x.price.toFixed(x.dec) : '—'}</Text>
        {!!x && <Text style={{ color: col, fontSize: 12.5, fontWeight: '800' }}>{up ? '+' : ''}{c.toFixed(2)}%</Text>}
      </View>
      <Pressable onPress={() => toggleFav(symId)} hitSlop={8} style={{ paddingLeft: 4 }}><Icon name={fav ? 'star' : 'star-outline'} size={22} color={fav ? th.gold : th.dim} /></Pressable>
    </Card>
  );

  // pro timeframe bar
  const tfBar = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
      {TF_GROUPS.map((g) => (
        <View key={g.g} style={{ gap: 4 }}>
          <Text style={{ color: th.dim, fontSize: 9.5, fontWeight: '800', letterSpacing: 1.4, paddingLeft: 4 }}>{g.g}</Text>
          <View style={{ flexDirection: 'row', padding: 3, gap: 2, borderRadius: 11, backgroundColor: th.panel2, borderWidth: 1, borderColor: th.hair }}>
            {g.items.map(([k, label]) => {
              const on = tfs[act] === k;
              return (
                <Pressable key={k} accessibilityRole="button" accessibilityLabel={label} onPress={() => setTf(k)} style={((st: any) => ({ minWidth: 40, height: 32, paddingHorizontal: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backgroundColor: on ? th.accent : st.hovered ? th.accent + '22' : 'transparent', boxShadow: on ? `0 6px 16px -6px ${th.accent}` : 'none', transitionProperty: 'background-color, box-shadow', transitionDuration: '160ms' })) as any}>
                  <Text style={{ color: on ? th.onAccent : th.text, fontSize: 12.5, fontWeight: on ? '800' : '600' }}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );

  const actions = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      <View style={{ flexDirection: 'row', padding: 3, gap: 2, borderRadius: 11, backgroundColor: th.panel2, borderWidth: 1, borderColor: th.hair }}>
        {LAYOUTS.filter((l) => desk || l.k !== '2h').map((l) => {
          const on = layout === l.k;
          return (
            <Pressable key={l.k} accessibilityRole="button" accessibilityLabel={l.label} onPress={() => setLayout(l.k)} style={((st: any) => ({ width: 38, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backgroundColor: on ? th.accent + '2E' : st.hovered ? th.accent + '14' : 'transparent' })) as any}>
              <Glyph k={l.k} color={on ? th.accent : th.dim} />
            </Pressable>
          );
        })}
      </View>
      {n > 1 && tool(sync ? 'link' : 'unlink', sync ? 'Linked timeframe' : 'Own timeframes', sync, () => { if (!sync) setTfs((a) => a.map(() => a[act])); setSync(!sync); })}
      {tool('swap-horizontal', 'Compare', panel === 'cmp', () => setPanel(panel === 'cmp' ? '' : 'cmp'))}
      {tool('stats-chart-outline', 'Style', panel === 'style', () => setPanel(panel === 'style' ? '' : 'style'))}
      {tool('options-outline', 'Indicators', panel === 'ind', () => setPanel(panel === 'ind' ? '' : 'ind'), studies.length ? String(studies.length) : undefined)}
      {tool('time-outline', ZONES.find((z) => z[0] === tz)?.[1] ?? 'UTC', panel === 'tz', () => setPanel(panel === 'tz' ? '' : 'tz'))}
      <View style={{ flex: 1, minWidth: 4 }} />
      {tool('refresh', '', false, () => setReload((v) => v + 1))}
      {tool(fsOn ? 'contract-outline' : 'expand-outline', fsOn ? 'Exit full screen' : 'Full screen', fsOn, toggleFull)}
    </View>
  );

  const panelBody = panel === '' ? null : (
    <View style={{ gap: 10, padding: 12, borderRadius: 10, backgroundColor: th.panel2, borderWidth: 1, borderColor: th.hair }}>
      {panel === 'style' && (<>{eyebrow('CHART STYLE')}<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{TV_STYLES.map((s) => chipBtn(s.k, s.label, cstyle === s.k, () => setCstyle(s.k), s.icon))}</View></>)}
      {panel === 'tz' && (<>{eyebrow('TIME ZONE OF THE CHARTS')}<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{ZONES.map(([k, label]) => chipBtn(k, label, tz === k, () => setTz(k)))}</View></>)}
      {panel === 'cmp' && (<>
        {eyebrow('COMPARE PAIRS SIDE BY SIDE')}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{PRESETS.filter((p) => p.ids.every((id) => SYMBOLS.some((s) => s.id === id))).map((p) => chipBtn(p.label, p.label, false, () => applyPreset(p)))}</View>
        <Text style={{ color: th.dim, fontSize: 12 }}>Or pick a layout above, choose a chart number in the market list and search any market for it. Press 1 to 4 on the keyboard to change the layout.</Text>
      </>)}
      {panel === 'ind' && (<>
        {eyebrow('QUICK SETS')}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {SETS.map(([label, ids]) => chipBtn(label, label, false, () => setStudies(ids)))}
          {chipBtn('clear', 'Clear all', false, () => setStudies([]))}
        </View>
        {TV_GROUPS.map((g) => (
          <View key={g.g} style={{ gap: 6 }}>
            {eyebrow(g.label.toUpperCase())}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{TV_STUDIES.filter((s) => s.g === g.g).map((s) => chipBtn(s.k, s.label, studies.includes(s.k), () => toggleStudy(s.k), studies.includes(s.k) ? 'checkmark' : undefined))}</View>
          </View>
        ))}
      </>)}
    </View>
  );

  // compare strip: price, day change and a relative strength bar for each chart
  const strip = n > 1 && (() => {
    const items = cells.slice(0, n).map((id, i) => ({ id, i, s: symOf(id), c: chg(id), r: quotes[id] }));
    const max = Math.max(0.01, ...items.map((it) => Math.abs(it.c))), best = items.reduce((a, b) => (b.c > a.c ? b : a), items[0]);
    return (
      <View style={{ flexDirection: desk ? 'row' : 'column', gap: 8 }}>
        {items.map((it) => {
          const cc = it.c >= 0 ? th.buy : th.sell, on = it.i === act;
          return (
            <Pressable key={it.i} accessibilityRole="button" onPress={() => setAct(it.i)} style={((st: any) => ({ flex: desk ? 1 : undefined, minWidth: 0, gap: 6, padding: 10, borderRadius: 10, borderWidth: 1, cursor: 'pointer', borderColor: on ? th.accent : th.hair, backgroundColor: on ? th.accent + '1A' : st.hovered ? th.panel2 : th.panel })) as any}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 20, height: 20, borderRadius: 6, backgroundColor: on ? th.accent : th.panel2, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: on ? th.onAccent : th.dim, fontSize: 11, fontWeight: '800' }}>{it.i + 1}</Text></View>
                <Text numberOfLines={1} style={{ flex: 1, color: th.text, fontSize: 13, fontWeight: '700' }}>{it.s.name}</Text>
                {best.i === it.i && it.c > 0 && <View style={{ paddingHorizontal: 6, height: 18, borderRadius: 5, backgroundColor: th.buy + '26', justifyContent: 'center' }}><Text style={{ color: th.buy, fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6 }}>STRONGEST</Text></View>}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <Text style={{ color: th.text, fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{it.r ? it.r.price.toFixed(it.r.dec) : '—'}</Text>
                <Text style={{ color: cc, fontSize: 12, fontWeight: '800' }}>{it.c >= 0 ? '+' : ''}{it.c.toFixed(2)}%</Text>
              </View>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: th.hair, overflow: 'hidden' }}><View style={{ width: `${Math.max(6, (Math.abs(it.c) / max) * 100)}%`, height: 4, backgroundColor: cc }} /></View>
            </Pressable>
          );
        })}
      </View>
    );
  })();

  const cell = (i: number) => {
    const id = cells[i], tvs = tvSymbol(symOf(id)) ?? 'FX:EURUSD', on = n > 1 && i === act;
    return (
      <View key={i} style={{ flex: 1, minWidth: 0, minHeight: 0, borderRadius: 10, overflow: 'hidden', borderWidth: on ? 2 : 1, borderColor: on ? th.accent : th.line, backgroundColor: th.panel }}>
        {seen && <ChartWeb key={`${id}-${tfs[i]}-${cstyle}-${studyIds.join('')}-${tz}-${th.bg}-${reload}`} html={tvHtml(tvs, tfs[i], th.dark, th.bg, studyIds, cstyle, tz)} />}
      </View>
    );
  };
  const r2 = (a: number, b: number) => <View style={{ flex: 1, minHeight: 0, flexDirection: 'row', gap: 8 }}>{cell(a)}{cell(b)}</View>;
  const grid = (
    <View style={[{ gap: 8 }, fsOn ? { flex: 1, minHeight: 0 } : { height: gridH }]}>
      {n === 1 ? cell(0)
        : stack ? <>{cells.slice(0, n).map((_, i) => cell(i))}</>
        : layout === '2h' ? r2(0, 1)
        : <>{r2(0, 1)}{r2(2, 3)}</>}
    </View>
  );

  const workspace = (
    <View ref={wsRef} style={[{ gap: 10 }, isFs ? { width: '100%', height: '100%', padding: 10, backgroundColor: th.bg } : pseudo ? { flex: 1, padding: 10, backgroundColor: th.bg } : null]}>
      {tfBar}
      {actions}
      {panelBody}
      {strip}
      {grid}
      {!fsOn && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Icon name="hand-left-outline" size={15} color={th.dim} />
          <Text style={{ flex: 1, color: th.dim, fontSize: 11.5, minWidth: 200 }}>Scroll to zoom, drag to move through time, use the toolbar on the left of each chart for drawing tools and Fibonacci. Keys: F full screen, 1 to 4 layouts.</Text>
          <Pressable onPress={() => Linking.openURL(`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tv)}`).catch(() => {})} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="open-outline" size={14} color={th.dim} /><Text style={{ color: th.dim, fontSize: 11.5, fontWeight: '700' }}>Open {symId.replace(/^(frx|cry)/, '')} on tradingview.com</Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  const main = (
    <View style={{ flex: 1, minWidth: 0, gap: 12 }}>
      {pairCard}
      {pseudo ? <View style={{ height: 120 }} /> : workspace}
    </View>
  );

  return (
    <Screen fx="tradingview" icon="stats-chart" tag="Markets / TradingView" title={t('tabTradingView')} subtitle="A pro charting workspace: compare up to four pairs at once, pro timeframes, drawing tools, indicators and every market."
      features={[{ icon: 'grid-outline', title: 'Multi-chart compare', sub: '1, 2 or 4 pairs at once' }, { icon: 'time-outline', title: 'Pro timeframes', sub: '1 minute to 1 month' }, { icon: 'pencil', title: 'Drawing tools', sub: 'Trend lines, Fibonacci, zones' }]}>
      {desk ? (
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
          <View style={{ width: 320 }}>{picker}</View>
          {main}
        </View>
      ) : (
        <View style={{ gap: 12 }}>{picker}{main}</View>
      )}
      <Modal visible={pseudo} animationType="fade" onRequestClose={() => setPseudo(false)}>
        <View style={{ flex: 1, backgroundColor: th.bg, paddingTop: desk ? 0 : 44 }}>{pseudo && workspace}</View>
      </Modal>
    </Screen>
  );
}
