import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Switch, BackHandler, Animated, Easing, AccessibilityInfo } from 'react-native';
import { useWindowDimensions } from '../win';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../store';
import { Screen, Card, Dim, Body, Icon, LiveDot, MenuButton, BellButton, AppHeader } from '../ui';
import { SYMBOLS, symOf, isBad, useFeed } from '../markets';
import { MDEFS, MDef, Host, mdef, MethodIcon } from '../MethodArt';
import { BodyProps } from '../embed';
import Scalping from './Scalping';
import ICTLab from './ICTLab';
import TopDown from './TopDown';
import Scanner from './Scanner';
import Insight from './Insight';
import CRAnalysis from './CRAnalysis';
import AnalysisHome from '../AnalysisHome';
import MethodPage from '../MethodPage';
import { useDesktop } from '../Desktop';

export const ANALYSIS_TAB = 1;

const MARKETS: { k: string; label: string; icon: string }[] = [
  { k: 'favs', label: 'Watch list', icon: 'star' },
  { k: 'crypto', label: 'Crypto', icon: 'logo-bitcoin' },
  { k: 'forex', label: 'Forex', icon: 'swap-horizontal' },
  { k: 'deriv', label: 'Deriv', icon: 'pulse' },
];
const FX_FIRST = ['frxDXY', 'frxXAUUSD', 'frxXAGUSD', 'frxWTI', 'frxBRENT', 'frxEURUSD', 'frxGBPUSD', 'frxUSDJPY', 'frxAUDUSD', 'frxUSDCAD', 'frxUSDCHF', 'frxNZDUSD', 'frxEURJPY', 'frxGBPJPY'];
const PROBS = [70, 75, 80, 85]; // alerts never go under 70%
type ScanCfg = { auto: boolean; alarm: boolean; minProb: number; watch?: boolean; digest?: boolean; dayBreaks?: boolean; news?: boolean };
const CFG0: ScanCfg = { auto: true, alarm: true, minProb: 75 };
const groupOf = (cat: string) => (cat === 'indices' ? 'forex' : cat);

// Running news-style warning at the top of the Analysis page. One message, scrolling right to left, nonstop while the page is open.
// (Reduce-motion users get the same message standing still.)
const TICKER_TEXT = "DON'T ANTI TRADE ON BOOM & CRASH";
function RunningAlert({ active }: { active: boolean }) {
  const { th } = useApp();
  const x = useRef(new Animated.Value(0)).current;
  const [seg, setSeg] = useState(0);   // width of one repeated message
  const [box, setBox] = useState(0);   // width of the visible strip
  const [still, setStill] = useState(false);
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => {}); }, []);
  useEffect(() => {
    if (!active || still || !seg) return;
    x.setValue(0);
    const loop = Animated.loop(Animated.timing(x, { toValue: -seg, duration: Math.max(4000, seg * 24), easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [active, still, seg]);
  const copies = seg ? Math.ceil(box / seg) + 2 : 1;
  const msg = (k: number) => (
    <View key={k} onLayout={k === 0 ? (e) => setSeg(e.nativeEvent.layout.width) : undefined} style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 0, paddingRight: 34 }}>
      <Text numberOfLines={1} style={{ color: th.text, fontSize: 12, fontWeight: '900', letterSpacing: 0.9 }}>{TICKER_TEXT}</Text>
      <Text style={{ color: th.sell, fontSize: 10, marginLeft: 34 }}>◆</Text>
    </View>
  );
  return (
    <View accessible accessibilityRole="alert" accessibilityLabel="Do not anti trade on Boom and Crash" style={{ flexDirection: 'row', alignItems: 'center', height: 32, borderRadius: 8, borderWidth: 1, borderColor: th.sell + '88', backgroundColor: th.sell + (th.dark ? '22' : '14'), overflow: 'hidden', direction: 'ltr' }}>
      <View style={{ height: '100%', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: th.sell }}>
        <Icon name="warning" size={13} color="#FFFFFF" />
        <Text style={{ color: '#FFFFFF', fontSize: 10.5, fontWeight: '900', letterSpacing: 1 }}>ALERT</Text>
      </View>
      <View onLayout={(e) => setBox(e.nativeEvent.layout.width)} style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
        {still ? (
          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 10 }}><Text numberOfLines={1} style={{ color: th.text, fontSize: 12, fontWeight: '900', letterSpacing: 0.6 }}>{TICKER_TEXT}</Text></View>
        ) : (
          <Animated.View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', transform: [{ translateX: x }] }}>
            {Array.from({ length: copies }, (_, k) => msg(k))}
          </Animated.View>
        )}
      </View>
    </View>
  );
}

export default function Analysis() {
  const { th, tab, amethod, setAmethod, asym, setAsym, setTab } = useApp();
  const { width } = useWindowDimensions();
  const active = tab === ANALYSIS_TAB;
  const { db } = useFeed(active);
  const [symId, setSymId] = useState('frxEURUSD');
  const [market, setMarket] = useState('forex');
  const [q, setQ] = useState('');
  const [mq, setMq] = useState('');
  const [cfg, setCfg] = useState<ScanCfg>(CFG0);
  const desk = useDesktop(); // website on a wide screen: the new Analysis page (src/AnalysisHome.web.tsx) replaces the method list; method workspaces below are unchanged
  const cur = mdef(amethod);
  const m = cur && cur.host !== 'tab' ? cur : undefined; // an open method (Planner and Settings are pages of their own)

  // scanner settings are remembered
  useEffect(() => { AsyncStorage.getItem('scan_cfg').then((v) => { if (v) { const c = JSON.parse(v); setCfg({ auto: c.auto !== false, alarm: c.alarm !== false, minProb: PROBS.includes(c.minProb) ? c.minProb : 75, watch: c.watch !== false, digest: !!c.digest, dayBreaks: c.dayBreaks !== false, news: c.news !== false }); } }).catch(() => {}); }, []);
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

  const sym = symOf(symId);

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

  // ---------------------------------------------------------------- pieces
  const header = <AppHeader />; // same row as every page (on the website the sidebar already has the menu and the name)


  const methodCard = (d: MDef) => {
    const rec = d.k === 'all';
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
          <Text style={{ color: th.text, fontSize: 17, fontWeight: '800' }}>Analysis Methods</Text>
          <Text style={{ color: th.dim, fontSize: 11.5, lineHeight: 16 }}>Pick a method to analyze the chart. You choose the market and pair inside it.</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: th.panel2, borderColor: th.line, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12 }}>
        <Icon name="search" size={18} color={th.dim} />
        <TextInput value={mq} onChangeText={setMq} placeholder="Search method..." placeholderTextColor={th.dim} autoCapitalize="none" style={{ flex: 1, color: th.text, padding: 11 }} />
        {!!mq && <Pressable onPress={() => setMq('')} hitSlop={10}><Icon name="close-circle" size={18} color={th.dim} /></Pressable>}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', paddingTop: 4 }}>
        {methods.map(methodCard)}
        {methods.length === 0 && <Dim>No method matches “{mq}”.</Dim>}
      </View>
    </View>
  );

  const bgOn = cfg.auto && cfg.alarm;
  // Background scanner card: the server scans while the app is closed and pushes a notification. One master switch, four optional alert types.
  const optRow = (icon: string, tint: string, title: string, sub: string, value: boolean, onChange: (b: boolean) => void, last?: boolean) => (
    <View key={title} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: last ? 0 : 1, borderBottomColor: th.hair }}>
      <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: tint + '22', borderWidth: 1, borderColor: tint + '55', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={17} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: th.text, fontSize: 13.5, fontWeight: '800' }} numberOfLines={1}>{title}</Text>
        <Text style={{ color: th.dim, fontSize: 11, lineHeight: 15, marginTop: 1 }} numberOfLines={3}>{sub}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: th.accent, false: th.line }} thumbColor="#FFFFFF" />
    </View>
  );
  const bgCard = (
    <View style={{ borderRadius: 14, borderWidth: 1, borderColor: bgOn ? th.accent + '99' : th.line, backgroundColor: th.panel, overflow: 'hidden', shadowColor: th.accent, shadowOpacity: bgOn ? (th.dark ? 0.32 : 0.14) : 0, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: bgOn ? 4 : 1 }}>
      <LinearGradient colors={[th.accent + (bgOn ? '30' : '12'), th.accent2 + (bgOn ? '10' : '06'), th.panel]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 14, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <LinearGradient colors={bgOn ? [th.accent, th.accent2] : [th.line, th.line]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={{ width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={bgOn ? 'radio' : 'notifications-off-outline'} size={23} color={bgOn ? '#FFFFFF' : th.dim} />
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={{ color: th.text, fontSize: 15.5, fontWeight: '900', letterSpacing: -0.2 }} numberOfLines={1}>Smart Alert Scanner</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, height: 20, borderRadius: 10, backgroundColor: (bgOn ? th.buy : th.dim) + '22', borderWidth: 1, borderColor: (bgOn ? th.buy : th.dim) + '66' }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: bgOn ? th.buy : th.dim }} />
                <Text style={{ color: bgOn ? th.buy : th.dim, fontSize: 9.5, fontWeight: '900', letterSpacing: 1 }}>{bgOn ? 'ACTIVE' : 'OFF'}</Text>
              </View>
              {bgOn && <Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '700' }}>every 90 s · min {cfg.minProb}%</Text>}
            </View>
          </View>
          <Switch value={bgOn} onValueChange={(b) => setC({ auto: b, alarm: b })} trackColor={{ true: th.accent, false: th.line }} thumbColor="#FFFFFF" />
        </View>
        <Text style={{ color: th.dim, fontSize: 11.5, lineHeight: 17 }}>
          {bgOn ? 'Your server scans your watch list, forex, crypto and Deriv around the clock. Every A or A+ setup is added to your Journal (Take or Skip) and sent as a notification when it reaches its POI, even with the app closed. Tap the notification to open that setup.' : 'Switch on to get a notification the moment a setup forms. Without it, you only see setups while the app is open.'}
        </Text>
      </LinearGradient>
      {bgOn && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 4, borderTopWidth: 1, borderTopColor: th.hair }}>
          {optRow('eye-outline', th.gold, 'Early heads-up', 'Setup forming at the POI but not A-grade yet. More alerts, lower accuracy.', (cfg as any).watch !== false, (b) => setC({ watch: b } as any))}
          {optRow('pulse-outline', th.accent, 'Analysis digest', 'A silent notification every 90 s with the best setups, even when there is no alert.', !!(cfg as any).digest, (b) => setC({ digest: b } as any))}
          {optRow('swap-vertical-outline', th.buy, 'Daily high / low breaks', 'When any pair breaks the previous day’s high or low. Checked every minute.', cfg.dayBreaks !== false, (b) => setC({ dayBreaks: b }))}
          {optRow('newspaper-outline', th.sell, 'High-impact news', 'An alert 15 minutes before every high-impact economic release.', cfg.news !== false, (b) => setC({ news: b }), true)}
        </View>
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

  const deskHome = desk && !m;
  const pickPair = (id: string) => { setSymId(id); setMarket(groupOf(symOf(id).cat)); setAmethod('all'); };
  // Each method keeps its own state while hidden; only the open one loads candles.
  const bodies = (
    <>
      <View style={show('ict')}><ICTLab {...common} on={live('ict')} method={m && m.host === 'ict' ? m.k : 'all'} /></View>
      <View style={show('cr')}><CRAnalysis {...common} on={live('cr')} /></View>
      <View style={show('topdown')}><TopDown {...common} on={live('topdown')} /></View>
      <View style={show('scanner')}><Scanner embedded on={live('scanner')} group={market} cfg={cfg} onOpen={(id) => { setSymId(id); setMarket(groupOf(symOf(id).cat)); setAmethod('all'); }} /></View>
      <View style={show('scalp')}><Scalping {...common} on={live('scalp')} /></View>
      <View style={show('insight')}><Insight {...common} on={live('insight')} method={m && m.host === 'insight' ? m.k : 'liquidity'} /></View>
    </>
  );

  // Website: market and pair pickers inside the method header (the method itself is chosen in the card grid above).
  const chip = (on: boolean) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 32, borderRadius: 16, borderWidth: 1, borderColor: on ? th.accent + '88' : th.line, backgroundColor: on ? th.accent + '1A' : th.panel, cursor: 'pointer' } as any);
  const deskControls = (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        {MARKETS.map((x) => {
          const on = market === x.k;
          return (
            <Pressable key={x.k} onPress={() => pickMarket(x.k)} accessibilityRole="button" accessibilityState={{ selected: on }} style={chip(on)}>
              <Icon name={x.icon} size={14} color={on ? th.accent : th.dim} />
              <Text style={{ color: on ? th.accent : th.dim, fontWeight: on ? '700' : '500', fontSize: 12.5 }}>{x.label}</Text>
            </Pressable>
          );
        })}
        {m && m.host !== 'scanner' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 32, minWidth: 220, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: th.line, backgroundColor: th.panel2, marginLeft: 'auto' } as any}>
            <Icon name="search" size={14} color={th.dim} />
            <TextInput value={q} onChangeText={setQ} placeholder="Search any pair" placeholderTextColor={th.dim} autoCapitalize="none" style={{ flex: 1, color: th.text, fontSize: 12.5, outlineStyle: 'none' } as any} />
            {!!q && <Pressable onPress={() => setQ('')} hitSlop={8}><Icon name="close-circle" size={14} color={th.dim} /></Pressable>}
          </View>
        )}
      </View>
      {m && m.host !== 'scanner' && found.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {found.map((x) => (
            <Pressable key={x.id} onPress={() => { setSymId(x.id); setMarket(groupOf(x.cat)); setQ(''); }} style={chip(false)}><Text style={{ color: th.text, fontSize: 12.5, fontWeight: '600' }}>{x.name}</Text></Pressable>
          ))}
        </View>
      )}
      {m && m.host !== 'scanner' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {chips.map((id) => {
            const on = id === symId;
            return (
              <Pressable key={id} onPress={() => setSymId(id)} style={chip(on)}>
                <Text style={{ color: on ? th.accent : th.text, fontWeight: on ? '700' : '500', fontSize: 12.5 }}>{symOf(id).name}</Text>
              </Pressable>
            );
          })}
          {!chips.includes(symId) && <View style={chip(true)}><Text style={{ color: th.accent, fontWeight: '700', fontSize: 12.5 }}>{sym.name}</Text></View>}
        </ScrollView>
      )}
      {chips.length === 0 && m && m.host !== 'scanner' && <Dim>No pairs in this list yet. Star pairs in Markets to fill your Watch list, or search above.</Dim>}
      {m && m.host === 'scanner' && scanSetup}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {deskHome && active && <AnalysisHome cfg={cfg} setC={setC} probs={PROBS} onOpenMethod={openMethod} onPair={pickPair} top={<RunningAlert active={active} />} />}
      {desk ? (
        <MethodPage visible={!deskHome} m={m} symId={symId} sym={sym.name} onOpenMethod={openMethod} onPair={(id: string) => { setSymId(id); setMarket(groupOf(symOf(id).cat)); }} top={<RunningAlert active={active && !deskHome} />} controls={deskControls}>
          {bodies}
        </MethodPage>
      ) : (
        <Screen title="Analysis" bare scrollKey={amethod}>
          <View style={{ gap: 14 }}>
            {header}
            <RunningAlert active={active} />
            {!m && (
              <>
                {bgCard}
                {choose}
                <Dim>Educational tool, not financial advice.</Dim>
              </>
            )}
            {backRow}
            {bodies}
          </View>
        </Screen>
      )}
    </View>
  );
}
