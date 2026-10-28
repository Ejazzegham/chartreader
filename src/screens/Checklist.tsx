import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import Svg, { Circle, Rect, Line, Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../store';
import { Screen, Card, Icon, AppHeader, IconTile, HeroBanner } from '../ui';
import { useWindowDimensions, useLayout } from '../win';

const KEY = 'pretrade.v1';
type Item = { t: string; d?: string };
const DEFAULTS: Item[] = [
  { t: 'Check Higher Timeframe Trend', d: 'Confirm the overall trend on the higher timeframe (e.g. 1H, 4H, or Daily).' },
  { t: 'Identify Key Entry Zone', d: 'Look for a clear zone (order block, FVG, support or resistance).' },
  { t: 'Check for Stop Loss & Risk', d: 'Place your stop loss and ensure risk is 1% or less per trade.' },
  { t: 'Confirm Reward to Risk', d: 'Make sure the reward is at least 2R to the first target.' },
  { t: 'Look for No High-Impact News', d: 'Avoid trading during high-impact news in the next 30 minutes.' },
  { t: 'Check for Active Session', d: 'Trade during London, New York or Silver Bullet session (your preferred time).' },
  { t: 'Final Review', d: 'Take a deep breath and confirm your plan. No revenge trading, no FOMO.' },
];
// Rules saved by the older version were plain strings. Old default wording maps to the new titles; anything the person wrote stays as it was.
const OLD: Record<string, number> = {
  'Higher timeframe direction agrees with my trade': 0,
  'Entry is at a clear zone (order block, FVG, support or resistance)': 1,
  'Stop loss is placed and risk is 1% or less': 2,
  'Reward is at least 2R to the first target': 3,
  'No high-impact news in the next 30 minutes': 4,
  'I am inside an active session or killzone': 5,
  'I am calm: no revenge trading, no FOMO': 6,
};
const norm = (x: any): Item => (typeof x === 'string' ? (OLD[x] !== undefined ? DEFAULTS[OLD[x]] : { t: x }) : { t: String(x?.t ?? ''), d: x?.d });

const TILES: { icon: string; c: [string, string] }[] = [
  { icon: 'trending-up', c: ['#8B5CF6', '#6D4AE8'] },
  { icon: 'locate', c: ['#22C55E', '#16A34A'] },
  { icon: 'shield-half', c: ['#F05252', '#DC2626'] },
  { icon: 'aperture', c: ['#3B82F6', '#2563EB'] },
  { icon: 'newspaper', c: ['#FBBF24', '#F97316'] },
  { icon: 'time', c: ['#A855F7', '#7C3AED'] },
  { icon: 'sparkles', c: ['#14B8A6', '#0EA5E9'] },
];
const TIPS = [
  'Be disciplined and follow the rules.',
  'Always check higher timeframe trend.',
  'Avoid trading during high-impact news.',
  'Use proper risk management (1% or less).',
  'Stay patient and wait for high-probability setups.',
];

type Saved = { items: any[]; checked: boolean[]; day: string; streak: number; lastDay: string; days?: string[] };
const dkey = (d: Date) => d.toISOString().slice(0, 10);
const today = () => dkey(new Date());
const yesterday = () => dkey(new Date(Date.now() - 86400000));

function Ring({ pct, label, sub, color, size = 112 }: { pct: number; label: string; sub: string; color: string; size?: number }) {
  const { th } = useApp();
  const sw = 9, r = (size - sw) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, pct));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', direction: 'ltr' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={th.accent + '26'} strokeWidth={sw} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={sw} fill="none" strokeLinecap="round" strokeDasharray={`${(c * v) / 100} ${c}`} />
      </Svg>
      <Text style={{ color: th.text, fontWeight: '900', fontSize: size * 0.24 }}>{label}</Text>
      <Text style={{ color: th.dim, fontSize: 12, fontWeight: '600' }}>{sub}</Text>
    </View>
  );
}

// Clipboard with ticks, a target and a few candles: the picture on the right of the banner.
function HeroArt() {
  return (
    <Svg width={300} height={170} viewBox="0 0 300 170" style={{ direction: 'ltr' as any }}>
      <Rect x="196" y="92" width="96" height="70" rx="10" fill="#FFFFFF" fillOpacity="0.14" />
      {[[212, 138, 120, 'b'], [226, 128, 108, 'b'], [240, 140, 120, 's'], [254, 118, 100, 'b'], [268, 108, 90, 'b'], [282, 112, 98, 's']].map(([x, y1, y2, k]: any, i) => (
        <React.Fragment key={i}>
          <Line x1={x} y1={y2 - 8} x2={x} y2={y1 + 8} stroke={k === 'b' ? '#86EFAC' : '#FCA5A5'} strokeWidth="2" />
          <Rect x={x - 3.5} y={y2} width="7" height={y1 - y2} rx="1.5" fill={k === 'b' ? '#4ADE80' : '#F87171'} />
        </React.Fragment>
      ))}
      <Rect x="40" y="20" width="118" height="140" rx="14" fill="#FFFFFF" />
      <Rect x="82" y="10" width="34" height="18" rx="9" fill="#6D5BF0" />
      {[48, 80, 112].map((y, i) => (
        <React.Fragment key={i}>
          <Rect x="56" y={y} width="20" height="20" rx="6" fill="#E0E7FF" />
          <Path d={`M61 ${y + 10} l4 4 l8 -9`} stroke="#5B4BEA" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Rect x="86" y={y + 3} width="56" height="5" rx="2.5" fill="#C7D2FE" />
          <Rect x="86" y={y + 12} width="38" height="5" rx="2.5" fill="#E0E7FF" />
        </React.Fragment>
      ))}
      <Circle cx="190" cy="66" r="36" fill="#FFFFFF" fillOpacity="0.2" />
      <Circle cx="190" cy="66" r="28" fill="#FFFFFF" />
      <Circle cx="190" cy="66" r="19" fill="#6D5BF0" />
      <Circle cx="190" cy="66" r="11" fill="#FFFFFF" />
      <Circle cx="190" cy="66" r="5" fill="#6D5BF0" />
      <Line x1="190" y1="66" x2="226" y2="28" stroke="#FBBF24" strokeWidth="4" strokeLinecap="round" />
    </Svg>
  );
}

function Bars({ color }: { color: string }) {
  return (
    <Svg width={120} height={52} viewBox="0 0 120 52">
      {[10, 16, 14, 24, 30, 38].map((h, i) => <Rect key={i} x={6 + i * 19} y={50 - h} width="11" height={h} rx="2" fill={color} fillOpacity={0.25 + i * 0.1} />)}
      <Path d="M4 40 L34 30 L58 34 L86 18 L112 6" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function Checklist() {
  const { th, setTab, journal } = useApp();
  const win = useWindowDimensions(); // website: already the page-content width
  const avail = win.width;
  const wide = avail >= 900, mid = avail >= 560;
  const isDesk = useLayout().mode === 'desktop';

  const [items, setItems] = useState<Item[]>(DEFAULTS);
  const [checked, setChecked] = useState<boolean[]>(DEFAULTS.map(() => false));
  const [streak, setStreak] = useState(0);
  const [lastDay, setLastDay] = useState('');
  const [days, setDays] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [edit, setEdit] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((raw) => {
      if (raw) {
        try {
          const s: Saved = JSON.parse(raw);
          const it = (Array.isArray(s.items) ? s.items : DEFAULTS).map(norm);
          setItems(it); setStreak(s.streak || 0); setLastDay(s.lastDay || ''); setDays(Array.isArray(s.days) ? s.days : []);
          setChecked(s.day === today() && Array.isArray(s.checked) ? it.map((_, i) => !!s.checked[i]) : it.map(() => false)); // new day, fresh list
        } catch {}
      }
      loaded.current = true;
    }).catch(() => { loaded.current = true; });
  }, []);

  const save = (n: Partial<Saved>) => {
    const s: Saved = { items, checked, day: today(), streak, lastDay, days, ...n };
    AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => {});
  };

  const done = checked.filter(Boolean).length, total = items.length;
  const score = total ? Math.round((done / total) * 100) : 0;
  const go = total > 0 && score === 100, near = score >= 70;
  const col = go ? th.buy : near ? th.gold : th.accent;
  const verdict = go ? 'GO: all rules passed' : near ? 'CAUTION: finish the remaining rules' : 'NO TRADE: setup does not meet your rules';
  const vcol = go ? th.buy : near ? th.gold : th.sell;
  const confirmed = lastDay === today();

  // numbers for the four tiles
  const wk = new Date(); wk.setHours(0, 0, 0, 0); wk.setDate(wk.getDate() - ((wk.getDay() + 6) % 7));
  const weekTrades = journal.filter((x) => x.date >= wk.getTime()).length;
  const winRate = journal.length ? Math.round((journal.filter((x) => x.pnl > 0).length / journal.length) * 100) : 0;
  const cutoff = dkey(new Date(Date.now() - 29 * 86400000));
  const consistency = days.filter((d) => d >= cutoff).length;

  const toggle = (i: number) => { const c = checked.map((v, k) => (k === i ? !v : v)); setChecked(c); save({ checked: c }); };
  const reset = () => { const c = items.map(() => false); setChecked(c); save({ checked: c }); };
  const markAll = () => { const c = items.map(() => true); setChecked(c); save({ checked: c }); };
  const add = () => {
    const v = text.trim(); if (!v) return;
    const it = [...items, { t: v }], c = [...checked, false];
    setItems(it); setChecked(c); setText(''); save({ items: it, checked: c });
  };
  const remove = (i: number) => {
    const it = items.filter((_, k) => k !== i), c = checked.filter((_, k) => k !== i);
    setItems(it); setChecked(c); save({ items: it, checked: c });
  };
  const restore = () => { setItems(DEFAULTS); const c = DEFAULTS.map(() => false); setChecked(c); save({ items: DEFAULTS, checked: c }); };
  // Count a disciplined day once: the first time the full list is passed that day.
  const confirm = () => {
    const td = today();
    if (lastDay === td) return;
    const ns = lastDay === yesterday() ? streak + 1 : 1;
    const nd = [...days.filter((d) => d !== td), td].slice(-60);
    setStreak(ns); setLastDay(td); setDays(nd); save({ streak: ns, lastDay: td, days: nd });
  };

  const h2 = { color: th.text, fontWeight: '800' as const, fontSize: 17 };
  const soft = th.accent + (th.dark ? '1F' : '0F');   // pale tint used by the inner tiles
  const tile = { backgroundColor: soft, borderColor: th.accent + (th.dark ? '33' : '1F'), borderWidth: 1, borderRadius: 12 };

  // ---------- pieces ----------
  const hero = (
    <LinearGradient colors={['#2F55E8', '#5B4BEA', '#8B5CF6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 18, overflow: 'hidden', padding: mid ? 28 : 20, minHeight: mid ? 200 : undefined, justifyContent: 'center', direction: 'ltr' }}>
      <View pointerEvents="none" style={{ position: 'absolute', right: -40, top: -50, width: 280, height: 280, borderRadius: 140, backgroundColor: '#FFFFFF12' }} />
      {mid && <View pointerEvents="none" style={{ position: 'absolute', right: 28, top: 0, bottom: 0, justifyContent: 'center' }}><HeroArt /></View>}
      <View style={{ gap: 8, maxWidth: mid ? 520 : undefined }}>
        <Text style={{ color: '#C7D2FE', fontSize: 12, fontWeight: '800', letterSpacing: 1.4 }}>TRADING TOOLS</Text>
        <Text accessibilityRole="header" style={{ color: '#FFFFFF', fontSize: mid ? 38 : 28, fontWeight: '900', letterSpacing: -1 }}>Trade Checklist</Text>
        <Text style={{ color: '#E5EAFF', fontSize: 15, lineHeight: 22 }}>Follow a step-by-step trading checklist to stay disciplined, reduce emotional trades, and increase your chances of success.</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
          <View style={{ backgroundColor: '#FBBF24', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 }}><Text style={{ color: '#3B2A00', fontWeight: '900', fontSize: 12 }}>PRO</Text></View>
          <View style={{ width: 1, height: 22, backgroundColor: '#FFFFFF55' }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF1F', borderColor: '#FFFFFF4D', borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Icon name="shield-checkmark" size={14} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12 }}>Build Better Trading Habits</Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  );

  const stat = (icon: string, c: string, label: string, value: string, sub: string) => (
    <View key={label} style={{ flexBasis: mid ? '22%' : '46%', flexGrow: 1, minWidth: 140, flexDirection: 'row', gap: 10, padding: 12, backgroundColor: th.panel2, borderColor: th.line, borderWidth: 1, borderRadius: 12 }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c + '26', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={20} color={c} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: th.dim, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>{label}</Text>
        <Text style={{ color: th.text, fontSize: 20, fontWeight: '900' }} numberOfLines={1}>{value}</Text>
        <Text style={{ color: th.dim, fontSize: 10.5 }} numberOfLines={1}>{sub}</Text>
      </View>
    </View>
  );

  const summary = (
    <Card style={{ padding: mid ? 20 : 16, gap: 16 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
        <Ring pct={score} label={`${done}/${total}`} sub="Completed" color={col} />
        <View style={[tile, { flex: 1, minWidth: 220, padding: 16, gap: 6 }]}>
          <Text style={{ color: th.text, fontWeight: '800', fontSize: 17 }}>Stay Disciplined, Trade Smarter</Text>
          <Text style={{ color: th.dim, fontSize: 13, lineHeight: 19 }}>Complete all checklist items before taking a trade. This simple process helps you avoid emotional decisions and stay consistent.</Text>
          <Text style={{ color: vcol, fontSize: 12.5, fontWeight: '800', marginTop: 2 }}>{verdict}</Text>
        </View>
        <View style={[tile, { minWidth: 150, padding: 16, gap: 6, flexGrow: mid ? 0 : 1 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="calendar" size={18} color={th.accent} /><Text style={{ color: th.dim, fontSize: 12.5, fontWeight: '700' }}>Day Streak</Text></View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="flame" size={20} color="#F97316" /><Text style={{ color: th.text, fontWeight: '900', fontSize: 22 }}>{streak}</Text></View>
          <Text style={{ color: th.dim, fontSize: 11 }}>{streak ? 'Great discipline!' : 'Keep your streak going!'}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {stat('radio-button-on', '#E0489B', 'Discipline Score', `${score}/100`, 'Based on checklist completion')}
        {stat('trending-up', '#3B6BF0', 'Total Trades', String(weekTrades), 'This week')}
        {stat('cash', '#16A34A', 'Win Rate', `${winRate}%`, 'From completed trades')}
        {stat('trophy', '#F59E0B', 'Consistency', `${consistency} days`, 'Last 30 days')}
      </View>
    </Card>
  );

  const list = (
    <Card style={{ padding: mid ? 20 : 14, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Icon name="checkmark-circle" size={24} color={th.accent} />
        <Text style={[h2, { flex: 1 }]}>Checklist Items</Text>
        <Pressable onPress={() => setEdit((e) => !e)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 10, cursor: 'pointer' } as any}>
          <Icon name={edit ? 'checkmark' : 'create-outline'} size={15} color={th.accent} /><Text style={{ color: th.accent, fontWeight: '700', fontSize: 13 }}>{edit ? 'Done' : 'Edit'}</Text>
        </Pressable>
        <Pressable onPress={reset} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, cursor: 'pointer' } as any}>
          <Icon name="refresh" size={15} color={th.accent} /><Text style={{ color: th.accent, fontWeight: '700', fontSize: 13 }}>Reset All</Text>
        </Pressable>
      </View>

      {items.map((it, i) => {
        const tl = TILES[i % TILES.length], on = checked[i];
        return (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => toggle(i)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: mid ? 14 : 10, padding: mid ? 14 : 10, backgroundColor: on ? th.buy + '14' : th.panel2, borderColor: on ? th.buy + '66' : th.line, borderWidth: 1, borderRadius: 12, cursor: 'pointer' } as any}>
              <IconTile icon={tl.icon} size={mid ? 48 : 40} colors={tl.c} />
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: th.accent + '1A', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: th.accent, fontWeight: '800', fontSize: 11.5 }}>{i + 1}</Text></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: th.text, fontWeight: '800', fontSize: 14.5 }}>{it.t}</Text>
                {!!it.d && <Text style={{ color: th.dim, fontSize: 12.5, lineHeight: 18, marginTop: 2 }}>{it.d}</Text>}
              </View>
              <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: on ? th.buy : th.dim + '88', backgroundColor: on ? th.buy : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                {on && <Icon name="checkmark" size={16} color={th.dark ? '#08110E' : '#FFFFFF'} />}
              </View>
            </Pressable>
            {edit && <Pressable onPress={() => remove(i)} hitSlop={8} style={{ padding: 8 }}><Icon name="trash-outline" size={18} color={th.sell} /></Pressable>}
          </View>
        );
      })}
      {items.length === 0 && <Text style={{ color: th.dim, padding: 8 }}>No rules yet. Add your first one below.</Text>}

      {edit && (
        <View style={[tile, { padding: 14, gap: 10 }]}>
          <Text style={{ color: th.text, fontWeight: '800', fontSize: 14 }}>Add your own rule</Text>
          <TextInput value={text} onChangeText={setText} placeholder="e.g. Wait for the 15m candle close" placeholderTextColor={th.dim} onSubmitEditing={add}
            style={{ backgroundColor: th.panel2, borderColor: th.line, borderWidth: 1, borderRadius: 10, color: th.text, padding: 12 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Pressable onPress={add} disabled={!text.trim()} style={{ backgroundColor: th.accent, opacity: text.trim() ? 1 : 0.45, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10, cursor: 'pointer' } as any}><Text style={{ color: th.onAccent, fontWeight: '800' }}>Add rule</Text></Pressable>
            <Pressable onPress={restore}><Text style={{ color: th.accent, fontWeight: '700' }}>Restore default rules</Text></Pressable>
          </View>
        </View>
      )}

      <Pressable accessibilityRole="button" disabled={confirmed} onPress={go ? confirm : markAll} style={{ borderRadius: 10, overflow: 'hidden', opacity: confirmed ? 0.7 : 1, cursor: confirmed ? 'default' : 'pointer' } as any}>
        <LinearGradient colors={confirmed ? [th.buy, th.buy] : ['#2563EB', '#7C4DFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Icon name={confirmed ? 'checkmark-done' : 'checkmark'} size={16} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>{confirmed ? 'Done today' : go ? 'Confirm day' : 'Mark All as Complete'}</Text>
        </LinearGradient>
      </Pressable>
    </Card>
  );

  const quick = [
    { icon: 'create-outline', c: ['#A855F7', '#7C3AED'] as [string, string], t: 'Use Risk & TP Planner', d: 'Plan your risk and targets', tab: 4 },
    { icon: 'analytics', c: ['#6366F1', '#4F46E5'] as [string, string], t: 'View Market Analysis', d: 'Find the best opportunities', tab: 1 },
    { icon: 'book', c: ['#3B82F6', '#2563EB'] as [string, string], t: 'Open Journal', d: 'Track your trades & notes', tab: 3 },
    { icon: 'apps', c: ['#2563EB', '#7C4DFF'] as [string, string], t: 'Explore Tools', d: 'More trading utilities', tab: 8 },
  ];
  const actions = (
    <Card style={{ padding: 18, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}><Icon name="flash" size={20} color={th.accent} /><Text style={h2}>Quick Actions</Text></View>
      {quick.map((q) => (
        <Pressable key={q.t} accessibilityRole="button" onPress={() => setTab(q.tab)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: th.panel2, borderColor: th.line, borderWidth: 1, borderRadius: 12, cursor: 'pointer' } as any}>
          <IconTile icon={q.icon} size={44} colors={q.c} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: th.text, fontWeight: '800', fontSize: 13.5 }} numberOfLines={1}>{q.t}</Text>
            <Text style={{ color: th.dim, fontSize: 12 }} numberOfLines={1}>{q.d}</Text>
          </View>
          <Icon name="chevron-forward" size={16} color={th.dim} />
        </Pressable>
      ))}
    </Card>
  );

  const tips = (
    <Card style={{ padding: 18, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="bulb-outline" size={21} color={th.accent} /><Text style={h2}>Checklist Tips</Text></View>
      {TIPS.map((x) => (
        <View key={x} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon name="checkmark" size={18} color={th.accent} />
          <Text style={{ flex: 1, color: th.dim, fontSize: 13, lineHeight: 19 }}>{x}</Text>
        </View>
      ))}
    </Card>
  );

  const cta = (
    <LinearGradient colors={['#5B4BEA', '#7C4DFF', '#8B5CF6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 14, padding: 20, gap: 10, overflow: 'hidden', direction: 'ltr' }}>
      <View pointerEvents="none" style={{ position: 'absolute', right: -50, bottom: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: '#FFFFFF14' }} />
      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFFFFF26', alignItems: 'center', justifyContent: 'center' }}><Icon name="trophy" size={22} color="#FFFFFF" /></View>
      <Text style={{ color: '#FFFFFF', fontSize: 19, fontWeight: '900' }}>Trade with Confidence</Text>
      <Text style={{ color: '#EDE9FE', fontSize: 13, lineHeight: 19 }}>The checklist helps you stay focused, reduce mistakes, and build consistent trading habits.</Text>
      <Pressable accessibilityRole="button" onPress={() => setTab(1)} style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 11, marginTop: 6, cursor: 'pointer' } as any}>
        <Text style={{ color: '#4338CA', fontWeight: '800', fontSize: 13.5 }}>Start Trading</Text>
        <Icon name="arrow-forward" size={15} color="#4338CA" />
      </Pressable>
    </LinearGradient>
  );

  const banner = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: mid ? 20 : 14, borderRadius: 14, backgroundColor: soft, borderColor: th.accent + (th.dark ? '33' : '1F'), borderWidth: 1, overflow: 'hidden' }}>
      <IconTile icon="trophy" size={52} colors={['#8B5CF6', '#6D4AE8']} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: th.text, fontWeight: '800', fontSize: 16 }}>Discipline Builds Profits</Text>
        <Text style={{ color: th.dim, fontSize: 13, lineHeight: 19 }}>Small steps, when followed consistently, lead to big results.</Text>
      </View>
      {mid && <Bars color={th.accent} />}
    </View>
  );

  return (
    <Screen bare>
      <View style={{ gap: 14, marginBottom: 16 }}>
        <AppHeader />
        {isDesk ? <HeroBanner icon="checkbox" tag="Trading Tools" title="Trade Checklist" subtitle="Follow a step-by-step trading checklist to stay disciplined, reduce emotional trades, and increase your chances of success." /> : hero}
      </View>
      {wide ? (
        <View style={{ flexDirection: 'row', gap: 18, alignItems: 'flex-start' }}>
          <View style={{ flex: 2, minWidth: 0, gap: 18 }}>{summary}{list}{banner}</View>
          <View style={{ flex: 1, minWidth: 280, gap: 18 }}>{actions}{tips}{cta}</View>
        </View>
      ) : (
        <View style={{ gap: 16 }}>{summary}{list}{actions}{tips}{cta}{banner}</View>
      )}
      <Text style={{ color: th.dim, fontSize: 12, lineHeight: 17, marginTop: 16 }}>A trade that fails your own rules is a trade you planned not to take. Educational tool, not financial advice.</Text>
    </Screen>
  );
}
