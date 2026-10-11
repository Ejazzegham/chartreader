import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Switch, BackHandler } from 'react-native';
import { useWindowDimensions } from '../win';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Text as SvgText, Rect, Line, Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../store';
import { Screen, Card, Dim, Body, Icon, AppHeader } from '../ui';
import { SYMBOLS, TFS, Candle, symOf, isBad, useFeed, watchCandles, quotes } from '../markets';
import { analyzeAll } from '../refine';
import { MDEFS, MDef, MKey, Host, mdef, MethodIcon, MiniRing } from '../MethodArt';
import { BodyProps } from '../embed';
import Scalping from './Scalping';
import ICTLab from './ICTLab';
import TopDown from './TopDown';
import Scanner from './Scanner';
import Insight from './Insight';
import { momentum } from '../momentum';

export const ANALYSIS_TAB = 1;

const MARKETS: { k: string; label: string; icon: string }[] = [
  { k: 'favs', label: 'Watch list', icon: 'star' },
  { k: 'crypto', label: 'Crypto', icon: 'logo-bitcoin' },
  { k: 'forex', label: 'Forex', icon: 'swap-horizontal' },
  { k: 'deriv', label: 'Deriv', icon: 'pulse' },
];
const LIVE: { id: string; label: string; bg: string; fg: string; txt: string }[] = [
  { id: 'cryBTCUSD', label: 'BTCUSD', bg: '#F7931A', fg: '#FFFFFF', txt: '₿' },
  { id: 'cryETHUSD', label: 'ETHUSD', bg: '#627EEA', fg: '#FFFFFF', txt: 'Ξ' },
  { id: 'frxXAUUSD', label: 'XAUUSD', bg: '#E0A82E', fg: '#FFFFFF', txt: 'Au' },
  { id: 'frxEURUSD', label: 'EURUSD', bg: '#2457E6', fg: '#FFFFFF', txt: '€' },
  { id: 'frxGBPUSD', label: 'GBPUSD', bg: '#C8102E', fg: '#FFFFFF', txt: '£' },
  { id: 'frxUSDJPY', label: 'USDJPY', bg: '#EDEFF5', fg: '#BC002D', txt: '¥' },
];
const FX_FIRST = ['frxDXY', 'frxXAUUSD', 'frxXAGUSD', 'frxEURUSD', 'frxGBPUSD', 'frxUSDJPY', 'frxAUDUSD', 'frxUSDCAD', 'frxUSDCHF', 'frxNZDUSD', 'frxEURJPY', 'frxGBPJPY'];
const PROBS = [70, 75, 80, 85]; // alerts never go under 70%
type ScanCfg = { auto: boolean; alarm: boolean; minProb: number };
const CFG0: ScanCfg = { auto: true, alarm: true, minProb: 75 };
const groupOf = (cat: string) => (cat === 'indices' ? 'forex' : cat);

// which method a saved setup came from (the text the analysis screens write into `source`)
const methodOfSource = (s?: string): MKey => {
  const x = (s ?? '').toLowerCase();
  if (x.startsWith('ict')) return 'ict';
  if (x.startsWith('smc')) return 'smc';
  if (x.startsWith('vsa')) return 'vsa';
  if (x.startsWith('candle')) return 'candle';
  if (x.startsWith('pattern')) return 'pat';
  if (x.startsWith('scalp')) return 'scalp';
  if (x.startsWith('top')) return 'topdown';
  if (x.startsWith('scanner')) return 'scanner';
  if (x.startsWith('entry')) return 'entry';
  return 'all';
};
const money = (v: number, d: number) => v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });

// small candlestick picture for the banner
const BANNER_CANDLES: [number, number, number, number, number, 's' | 'b' | 'p'][] = [
  [8, 52, 72, 56, 68, 's'], [20, 46, 70, 50, 62, 'p'], [32, 40, 62, 44, 56, 'b'], [44, 34, 58, 40, 52, 's'], [56, 28, 52, 32, 46, 'b'],
  [68, 22, 44, 26, 38, 'p'], [80, 18, 40, 22, 34, 'b'], [92, 10, 34, 14, 28, 'b'], [104, 14, 38, 20, 32, 's'],
];

export default function Analysis() {
  const { th, tab, amethod, setAmethod, asym, setAsym, setTab, signals, alarms } = useApp();
  const { width } = useWindowDimensions();
  const active = tab === ANALYSIS_TAB;
  const { db } = useFeed(active);
  const [symId, setSymId] = useState('frxEURUSD');
  const [market, setMarket] = useState('forex');
  const [q, setQ] = useState('');
  const [mq, setMq] = useState('');
  const [cfg, setCfg] = useState<ScanCfg>(CFG0);
  const cur = mdef(amethod);
  const m = cur && cur.host !== 'tab' ? cur : undefined; // an open method (Planner and Settings are pages of their own)

  // scanner settings are remembered
  useEffect(() => { AsyncStorage.getItem('scan_cfg').then((v) => { if (v) { const c = JSON.parse(v); setCfg({ auto: c.auto !== false, alarm: c.alarm !== false, minProb: PROBS.includes(c.minProb) ? c.minProb : 75 }); } }).catch(() => {}); }, []);
  const setC = (p: Partial<ScanCfg>) => setCfg((o) => { const n = { ...o, ...p }; AsyncStorage.setItem('scan_cfg', JSON.stringify(n)).catch(() => {}); return n; });

  // another page asked for a pair (store.asym): open it here
  useEffect(() => {
    if (!asym) return;
    setSymId(asym); setMarket(groupOf(symOf(asym).cat));
    if (!m || m.host === 'scanner') setAmethod('all');
    setAsym(null);
  }, [asym]);

  // Android back button: from a method back to the Analysis page
  useEffect(() => {
    if (!active || !m) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { setAmethod(''); return true; });
    return () => sub.remove();
  }, [active, !!m]);

  // ---------------------------------------------------------------- live scores for the landing cards (one candle stream for the chosen pair)
  const sym = symOf(symId);
  const [landData, setLandData] = useState<Candle[]>([]);
  useEffect(() => {
    if (!active || m) return;
    setLandData([]);
    return watchCandles(symId, 900, (c) => setLandData(c), () => {});
  }, [active, !!m, symId]);
  const sessions = ['forex', 'indices'].includes(sym.cat);
  const land = useMemo(() => (landData.length > 40 ? analyzeAll(landData, new Date(), { sessions }) : null), [landData, sessions]);
  const mom = useMemo(() => (landData.length ? momentum(landData) : null), [landData]);
  const scores = useMemo(() => {
    const s: Partial<Record<MKey, number | null>> = {};
    const lastOf = (src: string, pairOnly: boolean) => signals.filter((x) => methodOfSource(x.source) === src && (!pairOnly || x.symId === symId)).sort((a, b) => b.date - a.date)[0]?.score ?? null;
    if (land) {
      s.all = land.combo?.score ?? null;
      s.ict = land.ict.setup?.score ?? null;
      s.smc = land.smc.setup?.score ?? null;
      s.vsa = land.vsa.setup ? Math.min(100, Math.abs(land.vsa.score) + 20) : null;
      s.candle = land.cdl.setup?.score ?? null;
      s.pat = land.pat.setup ? Math.min(100, land.pat.setup.pattern.quality) : null;
      s.scalp = land.scalp.setup?.score ?? null;
      s.entry = (land.combo ?? land.ict.setup)?.score ?? null;
    }
    s.momentum = mom && mom.ok ? mom.score : null;
    s.topdown = lastOf('topdown', true);
    s.scanner = lastOf('scanner', false);
    return s;
  }, [land, mom, signals, symId]);
  const poolN = land && land.ict.ok ? land.ict.liquidity.filter((l) => !l.swept).length : null;

  // ---------------------------------------------------------------- pairs
  const pairsFor = (k: string) => {
    if (k === 'favs') return db.favs.filter((id) => !isBad(id));
    let list = SYMBOLS.filter((x) => x.cat === k && !isBad(x.id));
    if (k === 'forex') { const rank = (id: string) => { const i = FX_FIRST.indexOf(id); return i < 0 ? 99 : i; }; list = [...list].sort((a, b) => rank(a.id) - rank(b.id)); }
    const first = k === 'crypto' ? [...list.filter((x) => x.quote === 'USDT'), ...list.filter((x) => x.quote !== 'USDT')] : list;
    return first.map((x) => x.id).slice(0, 14);
  };
  const pickMarket = (k: string) => {
    setMarket(k);
    const list = pairsFor(k);
    if (list.length && !list.includes(symId)) setSymId(list[0]);
  };
  const openMethod = (d: MDef) => { setQ(''); if (d.host === 'tab') setTab(d.tab!); else setAmethod(d.k); };

  const term = q.trim().toLowerCase();
  const found = term ? SYMBOLS.filter((x) => !isBad(x.id) && (x.name + x.id).toLowerCase().includes(term)).slice(0, 6) : [];
  const chips = pairsFor(market);

  const W = width - 32;
  const accent2 = th.accent2;
  const mTerm = mq.trim().toLowerCase();
  const methods = MDEFS.filter((d) => !mTerm || (d.label + ' ' + d.desc).toLowerCase().includes(mTerm));
  const cols = W >= 560 ? 2 : 1;
  const tfName = (tf?: string) => TFS.find((x) => x.k === tf)?.label ?? (tf && tf.includes('/') ? tf.split('/').map((x) => TFS.find((y) => y.k === x)?.label ?? x).join('/') : tf ?? '');
  const recent = [...signals].sort((a, b) => b.date - a.date).slice(0, 8);

  // ---------------------------------------------------------------- pieces
  const header = <AppHeader />; // same row as every page (on the website the sidebar already has the menu and the name)

  const fs = Math.max(17, Math.min(24, Math.round(W * 0.058)));
  const banner = (
    <LinearGradient colors={[th.accent + (th.dark ? '2E' : '16'), accent2 + (th.dark ? '38' : '26')]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ borderRadius: 8, borderWidth: 1, borderColor: th.line, overflow: 'hidden', minHeight: 132, justifyContent: 'center', direction: 'ltr' }}>
      <View style={{ paddingVertical: 14, paddingLeft: 14, width: W >= 520 ? '52%' : '64%' }}>
        <Text style={{ color: th.text, fontSize: fs, fontWeight: '900', letterSpacing: -0.4 }}>Smarter Analysis</Text>
        <Svg width={W * 0.6} height={fs * 1.3}>
          <Defs>
            <SvgGradient id="bt" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor={th.accent} /><Stop offset="1" stopColor={accent2} /></SvgGradient>
          </Defs>
          <SvgText x="0" y={fs * 1.02} fontSize={fs} fontWeight="900" letterSpacing={-0.4} fill="url(#bt)">Better Trading</SvgText>
        </Svg>
        <Text style={{ color: th.dim, fontSize: 11.5, lineHeight: 16, marginTop: 2 }}>Choose your analysis method to study the chart, find high-probability setups and trade with confidence.</Text>
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', right: W >= 520 ? '24%' : 6, top: 14, bottom: 14, width: W >= 520 ? '24%' : '32%', justifyContent: 'center' }}>
        <Svg width="100%" height="100%" viewBox="0 0 120 80" preserveAspectRatio="xMidYMid meet">
          <Path d="M4 68 C 30 66, 44 50, 62 40 S 94 22, 112 12" stroke={accent2} strokeWidth="2" strokeOpacity="0.35" fill="none" strokeLinecap="round" />
          {BANNER_CANDLES.map(([x, wt, wb, bt, bb, c], i) => {
            const col = c === 'b' ? th.buy : c === 's' ? th.sell : accent2;
            return (<React.Fragment key={i}><Line x1={x} y1={wt} x2={x} y2={wb} stroke={col} strokeWidth="1.6" strokeLinecap="round" /><Rect x={x - 3.4} y={bt} width="6.8" height={bb - bt} rx="1.6" fill={col} /></React.Fragment>);
          })}
        </Svg>
      </View>
      {W >= 520 && (
        <View style={{ position: 'absolute', right: 14, top: 0, bottom: 0, width: '22%', justifyContent: 'center', transform: [{ rotate: '-8deg' }] }}>
          <Text style={{ color: th.dim, fontStyle: 'italic', fontSize: 14, lineHeight: 20 }}>“Better Analysis</Text>
          <Text style={{ color: th.dim, fontStyle: 'italic', fontSize: 14, lineHeight: 20 }}>Better Decisions”</Text>
          <View style={{ height: 2, width: '70%', borderRadius: 1, backgroundColor: accent2, marginTop: 4 }} />
        </View>
      )}
    </LinearGradient>
  );

  const methodCard = (d: MDef) => {
    const rec = d.k === 'all', sc = d.score ? scores[d.k] ?? null : null;
    return (
      <Pressable key={d.k} onPress={() => openMethod(d)} accessibilityRole="button" accessibilityLabel={`${d.label}. ${d.desc}`} style={({ pressed }) => ({ width: cols === 2 ? '48.9%' : '100%', opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] })}>
        <LinearGradient colors={[d.colors[0] + (th.dark ? '1C' : '14'), th.panel]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ borderRadius: 8, borderWidth: rec ? 1.6 : 1, borderColor: rec ? accent2 : d.colors[0] + '44', padding: 11, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <MethodIcon def={d} size={52} />
          <View style={{ flex: 1, gap: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ color: th.text, fontSize: 14.5, fontWeight: '800', flexShrink: 1 }} numberOfLines={1}>{d.label}</Text>
            </View>
            <Text style={{ color: th.dim, fontSize: 11, lineHeight: 15 }} numberOfLines={3}>{d.desc}</Text>
            {d.score ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
                <Text style={{ color: th.dim, fontSize: 10.5 }}>Trade Score</Text>
                <MiniRing score={sc} color={th.accent} track={th.dim} text="" />
              </View>
            ) : d.k === 'liquidity' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <Text style={{ color: th.dim, fontSize: 10.5 }}>Resting pools</Text>
                <Text style={{ color: th.accent, fontWeight: '900', fontSize: 12 }}>{poolN == null ? '--' : poolN}</Text>
              </View>
            ) : null}
          </View>
          <Icon name="chevron-forward" size={16} color={th.dim} />
        </LinearGradient>
        {rec && <LinearGradient colors={[th.accent, accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', top: -8, right: 14, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2.5 }}><Text style={{ color: '#FFFFFF', fontSize: 9.5, fontWeight: '800' }}>Recommended</Text></LinearGradient>}
      </Pressable>
    );
  };

  const choose = (
    <View style={{ backgroundColor: th.panel, borderRadius: 8, borderWidth: 1, borderColor: th.line, padding: 12, gap: 12, shadowColor: th.accent, shadowOpacity: th.dark ? 0.2 : 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: th.accent + '1F', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="compass-outline" size={24} color={th.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: th.text, fontSize: 17, fontWeight: '800' }}>Choose Your Analysis Method</Text>
          <Text style={{ color: th.dim, fontSize: 11.5, lineHeight: 16 }}>Select a method to start analyzing the chart with advanced tools, smart indicators and professional insights.</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: th.panel2, borderColor: th.line, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12 }}>
        <Icon name="search" size={18} color={th.dim} />
        <TextInput value={mq} onChangeText={setMq} placeholder="Search method..." placeholderTextColor={th.dim} autoCapitalize="none" style={{ flex: 1, color: th.text, padding: 11 }} />
        {!!mq && <Pressable onPress={() => setMq('')} hitSlop={10}><Icon name="close-circle" size={18} color={th.dim} /></Pressable>}
      </View>
      <Text style={{ color: th.dim, fontSize: 11 }}>Trade Score shown for <Text style={{ color: th.text, fontWeight: '800' }}>{sym.name}</Text> · M15. Pick a market below to change the pair.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', paddingTop: 4 }}>
        {methods.map(methodCard)}
        {methods.length === 0 && <Dim>No method matches “{mq}”.</Dim>}
      </View>
    </View>
  );

  const liveStrip = (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: th.buy }} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: th.text, fontWeight: '800', fontSize: 14 }}>Live Markets</Text>
          <Text style={{ color: th.dim, fontSize: 10 }}>Real-time prices · tap one to score it</Text>
        </View>
        <Pressable onPress={() => setTab(2)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Text style={{ color: th.accent, fontWeight: '800', fontSize: 11.5 }}>View All</Text><Icon name="arrow-forward" size={13} color={th.accent} />
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ direction: 'ltr' }}>
        {LIVE.map((x) => {
          const qt = quotes[x.id], chg = qt && qt.open ? ((qt.price - qt.open) / qt.open) * 100 : null, up = (chg ?? 0) >= 0, on = x.id === symId;
          return (
            <Pressable key={x.id} onPress={() => { setSymId(x.id); setMarket(groupOf(symOf(x.id).cat)); }} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ width: 138, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 9, borderRadius: 8, borderWidth: on ? 1.6 : 1, borderColor: on ? th.accent : th.line, backgroundColor: th.panel }}>
              <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: x.bg, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: x.fg, fontWeight: '900', fontSize: x.txt.length > 1 ? 11 : 15 }}>{x.txt}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: th.dim, fontSize: 9.5, fontWeight: '700' }}>{x.label}</Text>
                <Text style={{ color: th.text, fontSize: 12.5, fontWeight: '800' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{qt ? money(qt.price, qt.dec) : '--'}</Text>
                <Text style={{ color: chg == null ? th.dim : up ? th.buy : th.sell, fontSize: 10, fontWeight: '700' }}>{chg == null ? '' : `${up ? '+' : ''}${chg.toFixed(2)}% ${up ? '↗' : '↘'}`}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  const recentStrip = (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="time-outline" size={18} color={th.accent} />
        <Text style={{ flex: 1, color: th.text, fontWeight: '800', fontSize: 14 }}>Recent Analysis</Text>
        <Pressable onPress={() => setTab(3)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Text style={{ color: th.accent, fontWeight: '800', fontSize: 11.5 }}>View All</Text><Icon name="arrow-forward" size={13} color={th.accent} />
        </Pressable>
      </View>
      {recent.length === 0 ? (
        <Card><Dim>Nothing yet. Open a method above: the setups you analyze are listed here.</Dim></Card>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ direction: 'ltr' }}>
          {recent.map((x) => {
            const d = mdef(methodOfSource(x.source))!, buy = x.side === 'buy';
            return (
              <Pressable key={x.id} onPress={() => { setSymId(x.symId); setMarket(groupOf(symOf(x.symId).cat)); openMethod(d.host === 'tab' ? mdef('all')! : d); }} style={{ width: 188, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: th.line, backgroundColor: th.panel, gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <MethodIcon def={d} size={30} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: th.text, fontSize: 11.5, fontWeight: '800' }} numberOfLines={1}>{d.label}</Text>
                    <Text style={{ color: th.dim, fontSize: 10 }} numberOfLines={1}>{x.name} · {tfName(x.tf)}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: th.dim, fontSize: 10.5 }}>Score <Text style={{ color: th.text, fontWeight: '900' }}>{Math.round(x.score)}%</Text></Text>
                  <View style={{ borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: (buy ? th.buy : th.sell) + '22', borderWidth: 1, borderColor: (buy ? th.buy : th.sell) + '88' }}>
                    <Text style={{ color: buy ? th.buy : th.sell, fontSize: 10, fontWeight: '900' }}>{buy ? 'BUY' : 'SELL'}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );

  // ---------------------------------------------------------------- scanner setup (inside the Scanner workspace)
  const setRow = (icon: string, title: string, sub: string, right: React.ReactNode) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: th.hair }}>
      <Icon name={icon} size={20} color={th.text} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: th.text, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>{title}</Text>
        <Text style={{ color: th.dim, fontSize: 10.5, lineHeight: 14 }} numberOfLines={2}>{sub}</Text>
      </View>
      {right}
    </View>
  );
  const sw = (v: boolean, f: (b: boolean) => void) => <Switch value={v} onValueChange={f} trackColor={{ true: th.accent, false: th.line }} thumbColor="#FFFFFF" />;
  const scanSetup = (
    <Card style={{ paddingVertical: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: th.hair }}>
        <Icon name="settings-outline" size={22} color={th.text} />
        <View><Text style={{ color: th.text, fontSize: 14, fontWeight: '800' }}>Scanner Setup</Text><Text style={{ color: th.dim, fontSize: 10.5 }}>Customize your scanner settings.</Text></View>
      </View>
      {setRow('refresh', 'Auto rescan every 90 sec', 'Keep your analysis updated', sw(cfg.auto, (b) => setC({ auto: b })))}
      {setRow('notifications-outline', 'Alarm for strong setup', 'Get notified when a high probability setup is found', sw(cfg.alarm, (b) => setC({ alarm: b })))}
      <View style={{ paddingTop: 9 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon name="funnel-outline" size={20} color={th.text} />
          <View style={{ flex: 1 }}><Text style={{ color: th.text, fontSize: 13, fontWeight: '700' }}>Probability Filter</Text><Text style={{ color: th.dim, fontSize: 10.5 }}>Minimum probability level (setup score)</Text></View>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
          {PROBS.map((p) => {
            const on = cfg.minProb === p;
            return (
              <Pressable key={p} onPress={() => setC({ minProb: p })} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ flex: 1 }}>
                {on ? (
                  <LinearGradient colors={[th.accent, accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 12.5 }}>{p}%</Text></LinearGradient>
                ) : (
                  <View style={{ height: 32, borderRadius: 8, borderWidth: 1, borderColor: th.line, backgroundColor: th.panel, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: th.text, fontWeight: '700', fontSize: 12.5 }}>{p}%</Text></View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    </Card>
  );

  // ---------------------------------------------------------------- method workspace
  const strip = MDEFS.filter((d) => d.host !== 'tab');
  const backRow = m && (
    <View style={{ gap: 10 }}>
      {/* selected method heading first (back button, icon, name), then two boxes: 1) choose analysis method  2) select market */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => setAmethod('')} accessibilityRole="button" accessibilityLabel="Back to Analysis" hitSlop={8} style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 8, borderWidth: 1, borderColor: th.line, backgroundColor: th.panel, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}>
          <Icon name="chevron-back" size={20} color={th.accent} />
        </Pressable>
        <MethodIcon def={m} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: th.text, fontSize: 18, fontWeight: '800' }} numberOfLines={1}>{m.label}</Text>
          <Text style={{ color: th.dim, fontSize: 11 }} numberOfLines={2}>{m.desc}</Text>
        </View>
      </View>
      <View style={{ backgroundColor: th.panel, borderWidth: 1, borderColor: th.line, borderRadius: 8, padding: 10, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="compass-outline" size={16} color={th.accent} />
          <Text style={{ color: th.text, fontSize: 14, fontWeight: '800' }}>Choose Analysis Method</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {strip.map((d) => {
            const on = d.k === m.k;
            return (
              <Pressable key={d.k} onPress={() => openMethod(d)} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingLeft: 5, paddingRight: 12, height: 38, borderRadius: 8, borderWidth: 1.5, borderColor: on ? th.accent : th.line, backgroundColor: on ? th.accent : th.panel }}>
                <MethodIcon def={d} size={26} />
                <Text style={{ color: on ? th.onAccent : th.dim, fontWeight: '800', fontSize: 12.5 }}>{d.label.replace(' Analysis', '')}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <View style={{ backgroundColor: th.panel, borderWidth: 1, borderColor: th.line, borderRadius: 8, padding: 10, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="globe-outline" size={16} color={th.accent} />
          <Text style={{ color: th.text, fontSize: 14, fontWeight: '800' }}>Select Market</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {MARKETS.map((x) => {
            const on = market === x.k;
            return (
              <Pressable key={x.k} onPress={() => pickMarket(x.k)} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 8, backgroundColor: on ? th.accent : th.panel2, borderWidth: 1, borderColor: on ? th.accent : th.line }}>
                <Icon name={x.icon} size={15} color={on ? '#FFFFFF' : th.dim} />
                <Text style={{ color: on ? '#FFFFFF' : th.text, fontWeight: '700', fontSize: 12 }}>{x.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      {m.host === 'scanner' && scanSetup}
      {m.host !== 'scanner' && (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: th.panel, borderColor: th.line, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12 }}>
            <Icon name="search" size={18} color={th.dim} />
            <TextInput value={q} onChangeText={setQ} placeholder="Search any pair" placeholderTextColor={th.dim} autoCapitalize="none" style={{ flex: 1, color: th.text, padding: 12 }} />
            {!!q && <Pressable onPress={() => setQ('')} hitSlop={10}><Icon name="close-circle" size={18} color={th.dim} /></Pressable>}
          </View>
          {found.length > 0 && (
            <Card style={{ padding: 6 }}>
              {found.map((x) => (
                <Pressable key={x.id} onPress={() => { setSymId(x.id); setMarket(groupOf(x.cat)); setQ(''); }} style={{ padding: 10, flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Body bold>{x.name}</Body><Dim>{x.id}</Dim>
                </Pressable>
              ))}
            </Card>
          )}
          {chips.length === 0 && <Dim>No pairs in this list yet. Star pairs in Markets to fill your Watch list, or search above.</Dim>}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {chips.map((id) => {
              const on = id === symId;
              return (
                <Pressable key={id} onPress={() => setSymId(id)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: on ? th.accent : th.line, backgroundColor: on ? th.accent : th.panel }}>
                  <Text style={{ color: on ? th.onAccent : th.dim, fontWeight: '700', fontSize: 13 }}>{symOf(id).name}</Text>
                </Pressable>
              );
            })}
            {!chips.includes(symId) && (
              <View style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: th.accent, backgroundColor: th.accent + '22' }}>
                <Text style={{ color: th.text, fontWeight: '700', fontSize: 13 }}>{sym.name}</Text>
              </View>
            )}
          </ScrollView>
        </>
      )}
    </View>
  );

  const common: BodyProps = { embedded: true, symId, setSymId };
  const show = (h: Host) => ({ display: m && m.host === h ? 'flex' : 'none' } as const);
  const live = (h: Host) => active && !!m && m.host === h;

  return (
    <Screen title="Analysis" bare scrollKey={amethod}>
      <View style={{ gap: 14 }}>
        {header}
        {!m && (
          <>
            {banner}
            {choose}
            {liveStrip}
            {recentStrip}
            <Dim>Educational tool, not financial advice. Trade Score is the setup's confluence score for the chosen pair, not a guaranteed win rate.</Dim>
          </>
        )}
        {backRow}
        {/* Each method keeps its own state while hidden; only the open one loads candles. */}
        <View style={show('ict')}><ICTLab {...common} on={live('ict')} method={m && m.host === 'ict' ? m.k : 'all'} /></View>
        <View style={show('topdown')}><TopDown {...common} on={live('topdown')} /></View>
        <View style={show('scanner')}><Scanner embedded on={live('scanner')} group={market} cfg={cfg} onOpen={(id) => { setSymId(id); setMarket(groupOf(symOf(id).cat)); setAmethod('all'); }} /></View>
        <View style={show('scalp')}><Scalping {...common} on={live('scalp')} /></View>
        <View style={show('insight')}><Insight {...common} on={live('insight')} method={m && m.host === 'insight' ? m.k : 'liquidity'} /></View>
      </View>
    </Screen>
  );
}
