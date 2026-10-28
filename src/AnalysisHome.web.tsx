import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Switch } from 'react-native';
import Svg, { Line, Rect, Path, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from './store';
import { Icon, HeroBanner } from './ui';
import { Coin } from './MarketWidgets';
import { MDEFS, MDef, MethodIcon, mdef } from './MethodArt';
import { SYMBOLS, symOf, chg, setWatch, toggleFav, useFeed, SESSIONS, sessionOpen, fxWeekendClosed, isBad } from './markets';
import { useRealWindow } from './win';
import { usePal, useSetup, Panel, Pill, Btn, Spark, SentimentCard, LevelsCard, TfTabs, ChartHeader, ChartBody, Footer, useGo } from './DesktopHome.web';

// The website's Analysis page (when no method is open), designed like the "Analysis" mockup: alert scanner with notification preferences,
// the analysis methods, market watchlist, forex sessions, latest market analysis, learning banner and footer. The method workspaces
// (ICT, SMC, Scanner...) still open inside Analysis.tsx exactly as before.
type Cfg = { auto: boolean; alarm: boolean; minProb: number; watch?: boolean; digest?: boolean; dayBreaks?: boolean; news?: boolean };
type Props = { cfg: Cfg; setC: (p: Partial<Cfg>) => void; probs: number[]; onOpenMethod: (d: MDef) => void; onPair: (id: string) => void; top?: React.ReactNode };

const METALS = ['frxXAUUSD', 'frxXAGUSD', 'frxWTI', 'frxBRENT'];
const groupKey = (id: string, cat: string) => (cat === 'crypto' ? 'crypto' : cat === 'deriv' ? 'deriv' : METALS.includes(id) ? 'metals' : 'forex');
const DEFAULT_LIST = ['frxEURUSD', 'frxGBPUSD', 'frxXAUUSD', 'cryBTCUSD', 'frxUSDJPY', 'R_100'];
const WL_TABS = ['All', 'Forex', 'Metals', 'Crypto', 'Deriv'];
const S_COL = ['#2F6BFF', '#F0524F', '#7C4DFF', '#F5A524'], S_ABBR = ['SYD', 'TYO', 'LDN', 'NY'];
const S_TEXT = ['Low volatility, limited movement.', 'Increased activity, good for range trades.', 'High volatility, strong trends.', 'Solid volume, great for breakouts.'];

export function SectionHead({ icon, title, sub, right, onRight }: { icon: string; title: string; sub?: string; right?: string; onRight?: () => void }) {
  const P = usePal();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: P.soft, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={20} color={P.blue} /></View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: P.head, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 }}>{title}</Text>
        {!!sub && <Text style={{ color: P.body, fontSize: 12.5, lineHeight: 17, marginTop: 1 }}>{sub}</Text>}
      </View>
      {!!right && (
        <Pressable onPress={onRight} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, cursor: 'pointer' } as any}>
          <Text style={{ color: P.blue, fontSize: 12.5, fontWeight: '600' }}>{right}</Text><Icon name="arrow-forward" size={13} color={P.blue} />
        </Pressable>
      )}
    </View>
  );
}

// ---------- 1. alert scanner + notification preferences
function Scanner({ w, cfg, setC, probs }: { w: number; cfg: Cfg; setC: Props['setC']; probs: number[] }) {
  const P = usePal(), th = P.th, on = cfg.auto && cfg.alarm, two = w >= 980;
  const feat = (icon: string, a: string, b: string) => (
    <View key={a} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: P.card, borderWidth: 1, borderColor: P.border, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={17} color={P.blue} /></View>
      <Text style={{ color: P.body, fontSize: 12, lineHeight: 16 }}>{a}{'\n'}{b}</Text>
    </View>
  );
  const pref = (icon: string, color: string, title: string, sub: string, value: boolean, onChange: (b: boolean) => void) => (
    <View key={title} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: P.border, backgroundColor: P.card, opacity: on ? 1 : 0.55 }}>
      <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={18} color="#FFFFFF" /></View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: P.head, fontSize: 13.5, fontWeight: '700' }} numberOfLines={1}>{title}</Text>
        <Text style={{ color: P.body, fontSize: 11.5, lineHeight: 15 }} numberOfLines={2}>{sub}</Text>
      </View>
      <Switch disabled={!on} value={value && on} onValueChange={onChange} trackColor={{ true: P.blue, false: P.dark ? th.line : '#D5DDEB' }} thumbColor="#FFFFFF" />
    </View>
  );
  return (
    <Panel style={{ overflow: 'hidden', flexDirection: two ? 'row' : 'column' }}>
      <View style={{ flex: two ? 1 : undefined, padding: 28, gap: 14, justifyContent: 'center', overflow: 'hidden' }}>
        <LinearGradient colors={P.dark ? [th.panel2, th.panel] : ['#EAF1FF', '#F4F8FF', '#FFFFFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16 }}>
          <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: P.blue + '22', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: on ? P.blue : P.body + '66', alignItems: 'center', justifyContent: 'center' }}><Icon name={on ? 'notifications' : 'notifications-off'} size={22} color="#FFFFFF" /></View>
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 24, borderRadius: 12, backgroundColor: (on ? th.buy : P.body) + '22' }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: on ? th.buy : P.body }} />
                <Text style={{ color: on ? th.buy : P.body, fontSize: 12, fontWeight: '700' }}>{on ? 'Active' : 'Off'}</Text>
              </View>
              {on && <Text style={{ color: P.body, fontSize: 11.5 }}>Scans every 90 s · min {cfg.minProb}%</Text>}
            </View>
            <Text style={{ color: P.head, fontSize: 30, fontWeight: '800', letterSpacing: -0.7 }}>Smart Alert Scanner</Text>
            <Text style={{ color: P.body, fontSize: 14, lineHeight: 21, maxWidth: 460 }}>{on ? 'Get real-time alerts for key market movements, technical patterns, and important trading opportunities, even when the website is closed.' : 'Switch on to get a notification the moment a setup forms. Without it, you only see setups while the website is open.'}</Text>
          </View>
          <Switch value={on} onValueChange={(b) => setC({ auto: b, alarm: b })} trackColor={{ true: P.blue, false: P.dark ? th.line : '#D5DDEB' }} thumbColor="#FFFFFF" />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20, marginTop: 8 }}>
          {feat('stats-chart', 'Multi-Market', 'Monitoring')}{feat('funnel', 'Smart Filtering', '& Signals')}{feat('notifications', 'Real-time', 'Notifications')}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 6, opacity: on ? 1 : 0.5 }}>
          <Text style={{ color: P.body, fontSize: 12, fontWeight: '600', marginRight: 4 }}>Minimum probability</Text>
          {probs.map((p) => {
            const sel = cfg.minProb === p;
            return (
              <Pressable key={p} disabled={!on} onPress={() => setC({ minProb: p })} style={{ minWidth: 52, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backgroundColor: sel ? P.blue : P.card, borderWidth: 1, borderColor: sel ? P.blue : P.border } as any}>
                <Text style={{ color: sel ? th.onAccent : P.head, fontSize: 12.5, fontWeight: '700' }}>{p}%</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={{ flex: two ? 1 : undefined, padding: 24, gap: 12, backgroundColor: P.dark ? 'transparent' : '#F7FAFF', borderLeftWidth: two ? 1 : 0, borderLeftColor: P.border, borderTopWidth: two ? 0 : 1, borderTopColor: P.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
          <Icon name="settings-outline" size={16} color={P.head} />
          <Text style={{ color: P.head, fontSize: 15, fontWeight: '800', flex: 1 }}>Notification Preferences</Text>
        </View>
        {pref('eye', '#8B5CF6', 'Early heads-up', 'Setup forming at the POI but not A-grade yet.', cfg.watch !== false, (b) => setC({ watch: b }))}
        {pref('pulse', '#16B97A', 'Analysis digest', 'A silent note every 90 s with the best setups.', !!cfg.digest, (b) => setC({ digest: b }))}
        {pref('swap-vertical', '#2F6BFF', 'Daily high / low breaks', 'When a pair breaks the previous day’s high or low.', cfg.dayBreaks !== false, (b) => setC({ dayBreaks: b }))}
        {pref('newspaper', '#F5A524', 'High-impact news', 'An alert 15 minutes before big economic releases.', cfg.news !== false, (b) => setC({ news: b }))}
      </View>
    </Panel>
  );
}

// ---------- 2. analysis methods: every method in 3 rows of 5 cards
const ROWS: { title: string; sub: string; icon: string; keys: string[] }[] = [
  { title: 'Core Analysis', sub: 'Market structure, smart money and multi-timeframe reading', icon: 'layers', keys: ['all', 'cr', 'ict', 'smc', 'topdown'] },
  { title: 'Confirmation & Patterns', sub: 'Scan markets and confirm setups with volume, candles and patterns', icon: 'checkmark-done', keys: ['scanner', 'vsa', 'candle', 'pat', 'scalp'] },
  { title: 'Precision & Execution', sub: 'Find liquidity, time the entry and plan the trade', icon: 'locate', keys: ['liquidity', 'entry', 'momentum', 'planner'] },
];
const TAG: Record<string, string> = { all: 'All-in-one', cr: 'Chart Reader', ict: 'Smart Money', smc: 'Structure', topdown: 'Multi-timeframe', scanner: 'Scanner', vsa: 'Volume', candle: 'Candles', pat: 'Patterns', scalp: 'M1 – H1', liquidity: 'Liquidity', entry: 'Entries', momentum: 'Momentum', planner: 'Risk & Plan' };

function MethodCard({ d, cols, onOpen }: { d: MDef; cols: number; onOpen: () => void }) {
  const P = usePal();
  return (
    <Pressable accessibilityRole="button" onPress={onOpen} style={((st: any) => ({ flexGrow: 1, flexBasis: 0, minWidth: cols === 5 ? 190 : 220, minHeight: 176, padding: 16, gap: 10, borderRadius: 14, borderWidth: 1, borderColor: st.hovered ? d.colors[0] + '99' : P.border, backgroundColor: st.hovered ? (P.dark ? P.th.panel2 : '#F8FAFF') : P.card, cursor: 'pointer', shadowColor: P.shadow, shadowOpacity: st.hovered ? 0.14 : 0.04, shadowRadius: st.hovered ? 20 : 10, shadowOffset: { width: 0, height: st.hovered ? 8 : 3 } })) as any}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <MethodIcon def={d} size={46} />
        <View style={{ paddingHorizontal: 9, height: 22, borderRadius: 11, justifyContent: 'center', backgroundColor: d.colors[0] + '1A' }}><Text style={{ color: d.colors[1], fontSize: 10.5, fontWeight: '700' }}>{TAG[d.k] ?? 'Analysis'}</Text></View>
      </View>
      <Text style={{ color: P.head, fontSize: 14.5, fontWeight: '800', letterSpacing: -0.2 }} numberOfLines={2}>{d.label}</Text>
      <Text style={{ color: P.body, fontSize: 11.5, lineHeight: 16.5, flex: 1 }} numberOfLines={3}>{d.desc}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Text style={{ color: P.blue, fontSize: 12, fontWeight: '700' }}>Open analysis</Text><Icon name="arrow-forward" size={12} color={P.blue} />
      </View>
    </Pressable>
  );
}

function Methods({ w, onOpenMethod, go }: { w: number; onOpenMethod: Props['onOpenMethod']; go: (t: number, e?: string) => void }) {
  const P = usePal();
  const [mq, setMq] = useState('');
  const t = mq.trim().toLowerCase(), head = w >= 760, cols = w >= 1100 ? 5 : w >= 760 ? 3 : 1;
  const match = (d: MDef) => !t || (d.label + ' ' + d.desc + ' ' + (TAG[d.k] ?? '')).toLowerCase().includes(t);
  const total = MDEFS.filter(match).length;
  return (
    <Panel style={{ padding: 24, gap: 20 }}>
      <View style={{ flexDirection: head ? 'row' : 'column', alignItems: head ? 'center' : 'stretch', gap: 14 }}>
        <View style={{ flex: 1 }}><SectionHead icon="git-network" title="Analysis Methods" sub="Professional analysis methods in one place. Pick the approach that fits your trading style." /></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, width: head ? 320 : '100%', paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: P.border, backgroundColor: P.dark ? P.th.panel2 : '#FFFFFF' } as any}>
          <Icon name="search" size={17} color={P.blue} />
          <TextInput value={mq} onChangeText={setMq} placeholder="Search analysis methods..." placeholderTextColor={P.body} style={{ flex: 1, color: P.head, fontSize: 13.5, outlineStyle: 'none' } as any} />
          {!!mq && <Pressable onPress={() => setMq('')} hitSlop={8}><Icon name="close-circle" size={17} color={P.body} /></Pressable>}
        </View>
      </View>
      {ROWS.map((r, ri) => {
        const items = r.keys.map((k) => mdef(k)).filter((d): d is MDef => !!d && match(d));
        if (!items.length && !(ri === 2 && !t)) return null;
        const fill = ri === 2 && !t ? 5 - items.length : 0; // last row: the Learning Center card completes the grid
        return (
          <View key={r.title} style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: P.soft, alignItems: 'center', justifyContent: 'center' }}><Icon name={r.icon} size={14} color={P.blue} /></View>
              <Text style={{ color: P.head, fontSize: 13.5, fontWeight: '800' }}>{r.title}</Text>
              {w >= 900 && <Text style={{ color: P.body, fontSize: 12 }}>{r.sub}</Text>}
              <View style={{ flex: 1, height: 1, backgroundColor: P.border }} />
              <Text style={{ color: P.body, fontSize: 11.5, fontWeight: '600' }}>{`0${ri + 1}`}</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
              {items.map((d) => <MethodCard key={d.k} d={d} cols={cols} onOpen={() => onOpenMethod(d)} />)}
              {fill > 0 && (
                <Pressable onPress={() => go(14)} style={((st: any) => ({ flexGrow: fill, flexBasis: 0, minWidth: cols === 5 ? 190 : 220, minHeight: 176, padding: 18, gap: 10, justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: P.blue + '66', backgroundColor: st.hovered ? P.soft : P.alt, cursor: 'pointer' })) as any}>
                  <View style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: P.blue, alignItems: 'center', justifyContent: 'center' }}><Icon name="school" size={22} color={P.th.onAccent} /></View>
                  <Text style={{ color: P.head, fontSize: 14.5, fontWeight: '800' }}>New to these methods?</Text>
                  <Text style={{ color: P.body, fontSize: 11.5, lineHeight: 16.5 }}>Learn how each method works, step by step, in the Learning Center.</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Text style={{ color: P.blue, fontSize: 12, fontWeight: '700' }}>Explore Learning Center</Text><Icon name="arrow-forward" size={12} color={P.blue} /></View>
                </Pressable>
              )}
            </View>
          </View>
        );
      })}
      {t.length > 0 && total === 0 && <Text style={{ color: P.body, fontSize: 13 }}>No method matches “{mq}”.</Text>}
    </Panel>
  );
}

// ---------- 3. market watchlist
function Watchlist({ onPair, go }: { onPair: (id: string) => void; go: (t: number, e?: string) => void }) {
  const P = usePal(), th = P.th, { quotes, db } = useFeed(true);
  const [tab, setTab] = useState('All'), [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const rows = useMemo(() => {
    const ok = (id: string) => !isBad(id) && SYMBOLS.some((s) => s.id === id);
    if (term) return SYMBOLS.filter((s) => !isBad(s.id) && (s.name + ' ' + s.id).toLowerCase().includes(term)).slice(0, 6);
    if (tab === 'All') return [...new Set([...db.favs, ...DEFAULT_LIST])].filter(ok).map(symOf).slice(0, 6);
    const g = tab.toLowerCase(), all = SYMBOLS.filter((s) => !isBad(s.id) && groupKey(s.id, s.cat) === g);
    return [...all.filter((s) => quotes[s.id]), ...all.filter((s) => !quotes[s.id])].slice(0, 6);
  }, [tab, term, db.favs.join(','), Object.keys(quotes).length]);
  const key = rows.map((r) => r.id).join(',');
  useEffect(() => { setWatch('an-list', rows.map((r) => r.id)); return () => setWatch('an-list', []); }, [key]);
  const colH = (t: string, extra?: any) => <Text style={{ color: P.body, fontSize: 11.5, fontWeight: '600', ...extra }}>{t}</Text>;
  return (
    <Panel style={{ flex: 1.15, minWidth: 320, padding: 22, gap: 14 }}>
      <SectionHead icon="trending-up" title="Market Watchlist" right="View All Markets" onRight={() => go(2)} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 42, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: P.border, backgroundColor: P.dark ? th.panel2 : '#FAFBFE' }}>
        <Icon name="search" size={16} color={P.body} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search pair, symbol or asset..." placeholderTextColor={P.body} style={{ flex: 1, color: P.head, fontSize: 13, outlineStyle: 'none' } as any} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {WL_TABS.map((k) => (
          <Pressable key={k} onPress={() => { setTab(k); setQ(''); }} style={((s: any) => ({ minWidth: 60, paddingHorizontal: 14, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderWidth: 1, borderColor: tab === k && !term ? P.blue + '88' : P.border, backgroundColor: tab === k && !term ? P.soft : s.hovered ? P.alt : P.card })) as any}>
            <Text style={{ color: tab === k && !term ? P.blue : P.body, fontSize: 12.5, fontWeight: tab === k && !term ? '700' : '500' }}>{k}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: P.border }}>
        <View style={{ flex: 2.2 }}>{colH('Symbol')}</View><View style={{ flex: 1.1 }}>{colH('Last Price')}</View><View style={{ flex: 1.1 }}>{colH('Change')}</View><View style={{ flex: 1.4 }} />
      </View>
      {rows.length === 0 && <Text style={{ color: P.body, fontSize: 13, padding: 12 }}>No pairs match.</Text>}
      {rows.map((s) => {
        const qt = quotes[s.id], c = chg(s.id), col = c >= 0 ? th.buy : th.sell, abs = qt ? qt.price - qt.open : 0;
        return (
          <Pressable key={s.id} onPress={() => onPair(s.id)} style={((st: any) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 9, borderRadius: 10, cursor: 'pointer', backgroundColor: st.hovered ? P.alt : 'transparent' })) as any}>
            <View style={{ flex: 2.2, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <Coin s={s} size={34} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: P.head, fontSize: 13.5, fontWeight: '700' }} numberOfLines={1}>{s.name}</Text>
                <Text style={{ color: P.body, fontSize: 11 }} numberOfLines={1}>{s.sub ?? s.id.replace(/^(frx|cry)/, '')}</Text>
              </View>
            </View>
            <Text style={{ flex: 1.1, color: P.head, fontSize: 13.5, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{qt ? qt.price.toFixed(qt.dec) : '—'}</Text>
            <View style={{ flex: 1.1 }}>
              {qt ? <>
                <Text style={{ color: col, fontSize: 12.5, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{`${abs >= 0 ? '+' : '−'}${Math.abs(abs).toFixed(qt.dec)}`}</Text>
                <Text style={{ color: col, fontSize: 11.5, fontWeight: '600' }}>{`(${c >= 0 ? '+' : '−'}${Math.abs(c).toFixed(2)}%)`}</Text>
              </> : <Text style={{ color: P.body }}>—</Text>}
            </View>
            <View style={{ flex: 1.4, alignItems: 'flex-end' }}><Spark pts={qt?.pts ?? []} color={col} w={110} h={30} /></View>
          </Pressable>
        );
      })}
    </Panel>
  );
}

// ---------- 4. forex sessions
export function Sessions({ go, style }: { go: (t: number) => void; style?: any }) {
  const P = usePal(), th = P.th;
  const [now, setNow] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(i); }, []);
  const closed = fxWeekendClosed(now), h = now.getUTCHours(), tzo = -now.getTimezoneOffset() / 60;
  const hh = (x: number) => String((((x + tzo) % 24) + 24) % 24).padStart(2, '0') + ':00';
  const gmt = `GMT${tzo >= 0 ? '+' : '−'}${Math.abs(tzo)}`;
  return (
    <Panel style={{ flex: 1, minWidth: 300, padding: 22, gap: 12, ...style }}>
      <SectionHead icon="globe-outline" title="Forex Sessions" right="View All" onRight={() => go(13)} />
      {SESSIONS.map((s, i) => {
        const on = !closed && sessionOpen(h, s.s, s.e), tone = on ? th.buy : closed ? P.body : P.blue;
        return (
          <Pressable key={s.n} onPress={() => go(13)} style={((st: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: P.border, cursor: 'pointer', backgroundColor: st.hovered ? P.alt : P.card })) as any}>
            <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: S_COL[i] + '1F', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: S_COL[i], fontSize: 13, fontWeight: '800' }}>{S_ABBR[i]}</Text></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: P.head, fontSize: 14.5, fontWeight: '700' }}>{s.n}</Text>
              <Text style={{ color: P.body, fontSize: 11.5 }}>{hh(s.s)} - {hh(s.e)} ({gmt})</Text>
              <Text style={{ color: P.body, fontSize: 11.5, marginTop: 2 }} numberOfLines={1}>{S_TEXT[i]}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 24, borderRadius: 12, backgroundColor: tone + '1F' }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tone }} />
              <Text style={{ color: tone, fontSize: 12, fontWeight: '700' }}>{on ? 'Active' : closed ? 'Closed' : 'Upcoming'}</Text>
            </View>
            <Icon name="chevron-forward" size={15} color={P.body} />
          </Pressable>
        );
      })}
      <Text style={{ color: P.body, fontSize: 11 }}>Times are in your local time, no daylight-saving adjustment. Forex closes for the weekend.</Text>
    </Panel>
  );
}

// ---------- 5. latest market analysis
function Latest({ w, openAll }: { w: number; openAll: () => void }) {
  const P = usePal();
  const [tf, setTf] = useState('3600'), [cw, setCw] = useState(0);
  const s = useSetup('frxXAUUSD', tf, 'an-gold');
  const row = w >= 980;
  return (
    <Panel style={{ padding: 22, gap: 16 }}>
      <SectionHead icon="bar-chart" title="Latest Market Analysis" sub="In-depth analysis, key levels and actionable trade ideas from our expert tools." right="View All Analysis" onRight={openAll} />
      <View style={{ flexDirection: row ? 'row' : 'column', gap: 18, alignItems: 'flex-start' }}>
        <View style={{ flex: row ? 1 : undefined, width: row ? undefined : '100%', minWidth: 0, gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: P.border, backgroundColor: P.card }}>
          <ChartHeader s={s} sub="Gold / US Dollar" />
          <TfTabs tf={tf} set={setTf} />
          <View onLayout={(e) => setCw(e.nativeEvent.layout.width)} style={{ borderRadius: 10, overflow: 'hidden' }}>
            <ChartBody s={s} tf={tf} width={cw} height={300} />
          </View>
        </View>
        <View style={{ width: row ? 300 : '100%', gap: 16 }}><SentimentCard s={s} /><LevelsCard s={s} /></View>
      </View>
    </Panel>
  );
}

// ---------- hero (dark blue, like the Analysis mockup)
function HeroArt({ w }: { w: number }) {
  const W = Math.min(520, w), H = 250, n = 26;
  const cs = useMemo(() => {
    let v = 120, seed = 7; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    return Array.from({ length: n }, (_, i) => { const o = v, d = (rnd() - 0.38) * 20, cl = o + d; v = cl; return { o, c: cl, h: Math.max(o, cl) + rnd() * 8, l: Math.min(o, cl) - rnd() * 8, i }; });
  }, []);
  const lo = Math.min(...cs.map((x) => x.l)), hi = Math.max(...cs.map((x) => x.h)), y = (p: number) => H - 24 - ((p - lo) / (hi - lo)) * (H - 56), step = (W - 28) / n;
  return (
    <View style={{ width: W, borderRadius: 16, padding: 10, backgroundColor: '#0A1F55', borderWidth: 1, borderColor: '#2F5BD8', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 30, shadowOffset: { width: 0, height: 16 } }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 6, paddingBottom: 6 }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#16B97A' }} /><Text style={{ color: '#DCE7FF', fontSize: 11, fontWeight: '700' }}>EUR/USD · M15</Text>
      </View>
      <Svg width={W - 20} height={H}>
        <Defs><SvgGrad id="hg" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#4C8DFF" stopOpacity="0.35" /><Stop offset="1" stopColor="#4C8DFF" stopOpacity="0" /></SvgGrad></Defs>
        {[0.2, 0.4, 0.6, 0.8].map((f) => <Line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="#FFFFFF" strokeOpacity="0.07" />)}
        <Path d={cs.map((x, i) => `${i ? 'L' : 'M'}${10 + x.i * step + step / 2},${y(x.c)}`).join(' ') + ` L${10 + (n - 1) * step + step / 2},${H} L${10 + step / 2},${H} Z`} fill="url(#hg)" />
        {cs.map((x) => { const up = x.c >= x.o, col = up ? '#16C784' : '#FF4D5E', cx = 10 + x.i * step + step / 2; return (
          <React.Fragment key={x.i}>
            <Line x1={cx} x2={cx} y1={y(x.h)} y2={y(x.l)} stroke={col} strokeWidth="1.4" />
            <Rect x={cx - step * 0.28} y={y(Math.max(x.o, x.c))} width={step * 0.56} height={Math.max(2, Math.abs(y(x.o) - y(x.c)))} rx="1.5" fill={col} />
          </React.Fragment>); })}
      </Svg>
    </View>
  );
}

function Hero({ w }: { w: number }) {
  return (
    <View style={{ width: '100%', maxWidth: 1280, alignSelf: 'center', paddingHorizontal: 32, paddingTop: 24 }}>
      <HeroBanner icon="analytics" title="Trading Analysis" subtitle="Get in-depth market analysis, real-time insights and professional trading tools to make better decisions."
        features={[{ icon: 'stats-chart', title: 'Live Market Data', sub: 'Real-time price & charts' }, { icon: 'git-network', title: 'Technical Analysis', sub: 'Indicators & patterns' }, { icon: 'pulse', title: 'Market Sentiment', sub: 'Bullish / Bearish' }, { icon: 'shield-checkmark', title: 'Risk Management', sub: 'Plan & protect' }]} />
    </View>
  );
}

// ---------- market overview (your own trading numbers) + quick access
function Overview({ w, onOpenMethod, go }: { w: number; onOpenMethod: Props['onOpenMethod']; go: (t: number, e?: string) => void }) {
  const P = usePal(), th = P.th, { journal, positions } = useApp() as any;
  const j: any[] = journal ?? [], n = j.length, wins = j.filter((x) => x.pnl > 0).length, rate = n ? Math.round((wins / n) * 100) : 0;
  const total = j.reduce((a, x) => a + x.pnl, 0), d0 = new Date(); d0.setHours(0, 0, 0, 0);
  const today = j.filter((x) => x.date >= d0.getTime()).reduce((a, x) => a + x.pnl, 0);
  const rs = j.filter((x) => typeof x.r === 'number'), avgR = rs.length ? rs.reduce((a, x) => a + x.r, 0) / rs.length : 0;
  const run = (positions ?? []).length;
  const money = (v: number) => `${v >= 0 ? '+' : '−'}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const col = (v: number) => (v > 0 ? th.buy : v < 0 ? th.sell : P.head);
  const stat = (icon: string, tint: string, label: string, value: string, sub: string, vc?: string) => (
    <View key={label} style={{ flexGrow: 1, flexBasis: 150, minWidth: 140, padding: 16, gap: 6, borderRadius: 12, borderWidth: 1, borderColor: P.border, backgroundColor: P.card }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name={icon} size={15} color={tint} /><Text style={{ color: P.body, fontSize: 11.5, fontWeight: '600' }}>{label}</Text></View>
      <Text style={{ color: vc ?? P.head, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 }}>{value}</Text>
      <Text style={{ color: P.body, fontSize: 11.5 }}>{sub}</Text>
    </View>
  );
  const quick = (icon: string, color: string, label: string, onPress: () => void) => (
    <Pressable key={label} onPress={onPress} style={((s: any) => ({ flexBasis: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: s.hovered ? P.blue + '66' : P.border, backgroundColor: s.hovered ? P.soft : P.alt, cursor: 'pointer' })) as any}>
      <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={17} color="#FFFFFF" /></View>
      <Text style={{ color: P.head, fontSize: 12.5, fontWeight: '700', flex: 1 }} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
  const two = w >= 1050;
  return (
    <Panel style={{ padding: 22, gap: 16 }}>
      <SectionHead icon="stats-chart" title="Market Overview" sub="Your trading snapshot and key performance indicators." />
      <View style={{ flexDirection: two ? 'row' : 'column', gap: 18 }}>
        <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {stat('wallet', th.buy, 'Total P&L', n ? money(total) : '$0.00', `${n} closed trades`, n ? col(total) : undefined)}
          {stat('calendar', th.buy, 'Today’s P&L', money(today), 'Since midnight', col(today))}
          {stat('trophy', '#F5A524', 'Win Rate', `${rate}%`, `${wins}W / ${n - wins}L`)}
          {stat('pulse', P.blue, 'Running Trades', String(run), run ? 'Active' : 'None open')}
          {stat('checkmark-done', P.blue, 'Closed Trades', String(n), 'Completed')}
          {stat('speedometer', '#8B5CF6', 'Average R:R', rs.length ? `1:${Math.abs(avgR).toFixed(1)}` : '—', 'Your average')}
        </View>
        <View style={{ width: two ? 300 : '100%', gap: 12, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: P.border, backgroundColor: P.card }}>
          <Text style={{ color: P.head, fontSize: 14, fontWeight: '800' }}>Quick Access</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {quick('add-circle', '#8B5CF6', 'New Analysis', () => onOpenMethod(mdef('all')!))}
            {quick('search', '#16B97A', 'Scanner', () => onOpenMethod(mdef('scanner')!))}
            {quick('bar-chart', '#2F6BFF', 'Chart', () => go(2))}
            {quick('clipboard', '#F5A524', 'Trade Plan', () => onOpenMethod(mdef('planner')!))}
          </View>
        </View>
      </View>
    </Panel>
  );
}

// ---------- live market signals strip (live price and day momentum)
function Signals({ onPair, go }: { onPair: (id: string) => void; go: (t: number, e?: string) => void }) {
  const P = usePal(), th = P.th, { quotes, db } = useFeed(true);
  const [tab, setTab] = useState('All');
  const rows = useMemo(() => {
    if (tab === 'All') return [...new Set([...DEFAULT_LIST, ...db.favs])].filter((id) => !isBad(id) && SYMBOLS.some((s) => s.id === id)).map(symOf).slice(0, 6);
    const g = tab.toLowerCase(), all = SYMBOLS.filter((s) => !isBad(s.id) && groupKey(s.id, s.cat) === g);
    return [...all.filter((s) => quotes[s.id]), ...all.filter((s) => !quotes[s.id])].slice(0, 6);
  }, [tab, db.favs.join(','), Object.keys(quotes).length]);
  const key = rows.map((r) => r.id).join(',');
  useEffect(() => { setWatch('an-sig', rows.map((r) => r.id)); return () => setWatch('an-sig', []); }, [key]);
  return (
    <Panel style={{ padding: 22, gap: 14 }}>
      <SectionHead icon="pulse" title="Live Market Signals" sub="Live prices with today’s momentum. Open a pair to see its full analysis." right="View All Markets" onRight={() => go(2)} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {WL_TABS.map((k) => (
          <Pressable key={k} onPress={() => setTab(k)} style={((s: any) => ({ minWidth: 60, paddingHorizontal: 16, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderWidth: 1, borderColor: tab === k ? P.blue : P.border, backgroundColor: tab === k ? P.blue : s.hovered ? P.alt : P.card })) as any}>
            <Text style={{ color: tab === k ? th.onAccent : P.body, fontSize: 12.5, fontWeight: '700' }}>{k}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {rows.map((s) => {
          const qt = quotes[s.id], c = chg(s.id), up = c >= 0, col = up ? th.buy : th.sell;
          return (
            <Pressable key={s.id} onPress={() => onPair(s.id)} style={((st: any) => ({ flexGrow: 1, flexBasis: 170, minWidth: 170, padding: 14, gap: 8, borderRadius: 12, borderWidth: 1, borderColor: st.hovered ? P.blue + '66' : P.border, backgroundColor: st.hovered ? P.alt : P.card, cursor: 'pointer' })) as any}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                <Coin s={s} size={30} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: P.head, fontSize: 13, fontWeight: '800' }} numberOfLines={1}>{s.name}</Text>
                  <Text style={{ color: P.body, fontSize: 10.5 }}>{qt ? qt.price.toFixed(qt.dec) : '—'}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View>
                  <View style={{ alignSelf: 'flex-start', paddingHorizontal: 8, height: 20, borderRadius: 10, justifyContent: 'center', backgroundColor: col + '1F' }}><Text style={{ color: col, fontSize: 10.5, fontWeight: '800' }}>{qt ? (up ? 'BULLISH' : 'BEARISH') : '—'}</Text></View>
                  <Text style={{ color: col, fontSize: 13, fontWeight: '800', marginTop: 4 }}>{qt ? `${up ? '+' : '−'}${Math.abs(c).toFixed(2)}%` : '—'}</Text>
                </View>
                <Spark pts={qt?.pts ?? []} color={col} w={70} h={28} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </Panel>
  );
}

export default function AnalysisHome({ cfg, setC, probs, onOpenMethod, onPair, top }: Props) {
  const P = usePal(), go = useGo();
  const w = useRealWindow().width, bgOn = cfg.auto && cfg.alarm;
  const [hideNote, setHideNote] = useState(false);
  const two = w >= 1000;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: P.alt }} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
      <Hero w={w} />
      <View style={{ width: '100%', maxWidth: 1280, alignSelf: 'center', paddingHorizontal: 32, paddingTop: 22, paddingBottom: 30, gap: 22 }}>
        {top}
        {!hideNote && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: P.blue + '33', backgroundColor: P.soft }}>
            <Icon name={bgOn ? 'notifications' : 'notifications-outline'} size={18} color={P.blue} />
            <Text style={{ flex: 1, color: P.head, fontSize: 13.5 }}>{bgOn ? 'Stay informed! Smart alerts are on: setups, news and level breaks reach you as they happen.' : 'Stay informed! Turn on Smart Alerts to get trading opportunities and market news the moment they appear.'}</Text>
            {!bgOn && (
              <Pressable onPress={() => setC({ auto: true, alarm: true })} style={((s: any) => ({ height: 34, paddingHorizontal: 16, borderRadius: 8, justifyContent: 'center', backgroundColor: P.blue, cursor: 'pointer', opacity: s.hovered ? 0.9 : 1 })) as any}><Text style={{ color: P.th.onAccent, fontSize: 12.5, fontWeight: '700' }}>Turn on Alerts</Text></Pressable>
            )}
            <Pressable onPress={() => setHideNote(true)} hitSlop={8} style={{ cursor: 'pointer' } as any}><Icon name="close" size={18} color={P.body} /></Pressable>
          </View>
        )}
        <Overview w={w} onOpenMethod={onOpenMethod} go={go} />
        <Methods w={w} onOpenMethod={onOpenMethod} go={go} />
        <Signals onPair={onPair} go={go} />
        <Scanner w={w} cfg={cfg} setC={setC} probs={probs} />
        <View style={{ flexDirection: two ? 'row' : 'column', gap: 22, alignItems: 'stretch' }}>
          <Watchlist onPair={onPair} go={go} />
          <Sessions go={go} />
        </View>
        <Latest w={w} openAll={() => go(1, 'all')} />
        <View style={{ overflow: 'hidden', borderRadius: 14, flexDirection: w >= 760 ? 'row' : 'column', alignItems: w >= 760 ? 'center' : 'flex-start', gap: 16, padding: 20 }}>
          <LinearGradient colors={['#0A3FD0', '#1F6BFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <View style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}><Icon name="analytics" size={22} color="#1F5FFF" /></View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>Refine Your Setups. Trade Smarter.</Text>
            <Text style={{ color: '#DCE7FF', fontSize: 12.5, marginTop: 2 }}>Use your market insights to improve your strategy, reduce mistakes and grow consistently.</Text>
          </View>
          <Pressable onPress={() => onOpenMethod(mdef('all')!)} style={((s: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, height: 42, paddingHorizontal: 20, borderRadius: 9, backgroundColor: '#FFFFFF', cursor: 'pointer', opacity: s.hovered ? 0.92 : 1 })) as any}>
            <Text style={{ color: '#1F5FFF', fontSize: 13.5, fontWeight: '800' }}>Open Analysis</Text><Icon name="arrow-forward" size={14} color="#1F5FFF" />
          </Pressable>
        </View>
      </View>
      <Footer w={w} go={go} />
    </ScrollView>
  );
}
