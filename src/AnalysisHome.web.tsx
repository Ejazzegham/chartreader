import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Switch } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from './store';
import { Icon } from './ui';
import { Coin } from './MarketWidgets';
import { MDEFS, MDef, MethodIcon } from './MethodArt';
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

// ---------- 2. analysis methods
function Methods({ w, onOpenMethod }: { w: number; onOpenMethod: Props['onOpenMethod'] }) {
  const P = usePal();
  const [mq, setMq] = useState('');
  const t = mq.trim().toLowerCase(), list = MDEFS.filter((d) => !t || (d.label + ' ' + d.desc).toLowerCase().includes(t));
  const wide = w >= 940, head = w >= 760;
  return (
    <Panel style={{ padding: 24, gap: 18 }}>
      <View style={{ flexDirection: head ? 'row' : 'column', alignItems: head ? 'center' : 'stretch', gap: 14 }}>
        <View style={{ flex: 1 }}><SectionHead icon="git-network" title="Analysis Methods" sub="Explore professional trading analysis methods and find the approach that fits your trading style." /></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, width: head ? 320 : '100%', paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: P.border, backgroundColor: P.dark ? P.th.panel2 : '#FFFFFF' } as any}>
          <Icon name="search" size={17} color={P.blue} />
          <TextInput value={mq} onChangeText={setMq} placeholder="Search analysis methods..." placeholderTextColor={P.body} style={{ flex: 1, color: P.head, fontSize: 13.5, outlineStyle: 'none' } as any} />
          {!!mq && <Pressable onPress={() => setMq('')} hitSlop={8}><Icon name="close-circle" size={17} color={P.body} /></Pressable>}
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        {list.map((d) => (
          <Pressable key={d.k} accessibilityRole="button" onPress={() => onOpenMethod(d)} style={((s: any) => ({ width: wide ? '48.9%' : '100%', flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: s.hovered ? P.blue + '66' : P.border, backgroundColor: s.hovered ? P.alt : P.card, cursor: 'pointer', shadowColor: P.shadow, shadowOpacity: s.hovered ? 0.1 : 0.03, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } })) as any}>
            <MethodIcon def={d} size={46} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: P.head, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>{d.label}</Text>
              <Text style={{ color: P.body, fontSize: 11.5, lineHeight: 16 }} numberOfLines={2}>{d.desc}</Text>
            </View>
            <Icon name="chevron-forward" size={16} color={P.body} />
          </Pressable>
        ))}
        {list.length === 0 && <Text style={{ color: P.body, fontSize: 13 }}>No method matches “{mq}”.</Text>}
      </View>
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

export default function AnalysisHome({ cfg, setC, probs, onOpenMethod, onPair, top }: Props) {
  const P = usePal(), go = useGo();
  const w = useRealWindow().width, bgOn = cfg.auto && cfg.alarm;
  const [hideNote, setHideNote] = useState(false);
  const two = w >= 1000;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: P.alt }} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
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
        <Scanner w={w} cfg={cfg} setC={setC} probs={probs} />
        <Methods w={w} onOpenMethod={onOpenMethod} />
        <View style={{ flexDirection: two ? 'row' : 'column', gap: 22, alignItems: 'stretch' }}>
          <Watchlist onPair={onPair} go={go} />
          <Sessions go={go} />
        </View>
        <Latest w={w} openAll={() => go(1, 'all')} />
        <Panel style={{ flexDirection: w >= 760 ? 'row' : 'column', alignItems: w >= 760 ? 'center' : 'flex-start', gap: 16, padding: 18 }}>
          <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: P.blue, alignItems: 'center', justifyContent: 'center' }}><Icon name="school" size={22} color={P.th.onAccent} /></View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: P.head, fontSize: 15, fontWeight: '800' }}>Trade Smarter with Knowledge</Text>
            <Text style={{ color: P.body, fontSize: 12.5, marginTop: 2 }}>Learn proven strategies, improve your skills and make better trading decisions.</Text>
          </View>
          <Btn label="Explore Learning Center" onPress={() => go(14)} />
        </Panel>
      </View>
      <Footer w={w} go={go} />
    </ScrollView>
  );
}
