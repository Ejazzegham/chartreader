import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect, Line, Circle, Polyline, Defs, LinearGradient as SG, Stop, Text as SText } from 'react-native-svg';
import { useApp } from './store';
import { Icon, HeroBanner } from './ui';
import { quotes, setWatch } from './markets';
import { useRealWindow } from './win';
import { usePal, Panel, Footer, useGo } from './DesktopHome.web';
import { Notices } from './Desktop.web';
import { totalR } from './trades';

// The website's Performance page, designed like the "Trading Analytics" mockup: hero with Win Rate and Profit Factor, a range bar,
// four KPI tiles, the Performance Overview chart (balance and equity) next to the Trade Statistics list, Profit & Loss with a donut,
// Buy vs Sell, a call to action and the footer. Every number comes from the journal. Nothing is made up.
const f = (n: number, d = 2) => (isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 }) : '-');
const dayMs = 86400000;
const RANGES: [string, string, number][] = [['all', 'All Time', 0], ['today', 'Today', 0], ['week', 'Last 7 days', 6], ['month', 'Last 30 days', 29], ['year', 'Last 12 months', 364]];
const CHART_R: [string, number][] = [['1D', 1], ['1W', 7], ['1M', 30], ['3M', 90], ['ALL', 0]];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function Chip({ icon, color, size = 40 }: { icon: string; color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2.6, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={size * 0.47} color={color} /></View>;
}

function HeroArt({ rate, pf }: { rate: number; pf: string }) {
  const bars = [[40, 70, 'u'], [70, 100, 'u'], [95, 130, 'd'], [60, 110, 'u'], [90, 150, 'u'], [120, 170, 'd'], [100, 160, 'u'], [140, 200, 'u']] as const;
  return (
    <View style={{ width: 520, height: 250 }}>
      <Svg width={520} height={250} viewBox="0 0 520 250">
        <Defs>
          <SG id="pscr" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#0E2C78" /><Stop offset="1" stopColor="#071A4A" /></SG>
          <SG id="pcoin" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#4FA3FF" /><Stop offset="1" stopColor="#1B54E6" /></SG>
        </Defs>
        {bars.map(([a, b, c], i) => <Rect key={i} x={10 + i * 28} y={235 - b} width={9} height={b - a + 30} rx={2} fill={c === 'u' ? '#34E3B5' : '#FF7390'} opacity={0.3} />)}
        <Path d="M96 40 L340 28 L378 188 L60 206 Z" fill="url(#pscr)" stroke="#3E6FD8" strokeWidth={4} strokeLinejoin="round" />
        <Path d="M84 206 L392 190 L408 214 L60 232 Z" fill="#2B4FA8" />
        {[[130, 140, 'u'], [150, 124, 'u'], [170, 130, 'd'], [190, 104, 'u'], [210, 112, 'd'], [230, 86, 'u'], [250, 92, 'd'], [270, 66, 'u'], [290, 56, 'u']].map(([x, y, c], i) => (
          <React.Fragment key={i}><Line x1={x as number} y1={(y as number) - 14} x2={x as number} y2={(y as number) + 24} stroke={c === 'u' ? '#34E3B5' : '#FF5C7A'} strokeWidth={1.6} /><Rect x={(x as number) - 4} y={y as number} width={8} height={16} fill={c === 'u' ? '#34E3B5' : '#FF5C7A'} /></React.Fragment>
        ))}
        <Circle cx={92} cy={196} r={36} fill="url(#pcoin)" stroke="#9CC9FF" strokeWidth={4} />
        <Path d="M74 206 L86 194 L96 202 L112 184" stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
      {([['trending-up', 'Win Rate', `${f(rate, 0)}%`, 0], ['analytics', 'Profit Factor', pf, 82]] as const).map(([ic, k, v, y], i) => (
        <View key={k} style={{ position: 'absolute', right: i ? 0 : 30, top: i ? 96 : 0, width: 176, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: '#3A6FE0AA', borderWidth: 1, borderColor: '#FFFFFF40' }}>
          <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#FFFFFF26', alignItems: 'center', justifyContent: 'center' }}><Icon name={ic} size={21} color="#FFFFFF" /></View>
          <View><Text style={{ color: '#DCE8FF', fontSize: 12.5 }}>{k}</Text><Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800' }}>{v}</Text></View>
        </View>
      ))}
    </View>
  );
}

function Select({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (k: string) => void }) {
  const P = usePal();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ zIndex: open ? 50 : 1 }}>
      {open && <Pressable onPress={() => setOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 49 } as any} />}
      <Pressable accessibilityRole="button" onPress={() => setOpen(!open)} style={{ flexDirection: 'row', alignItems: 'center', gap: 9, height: 44, minWidth: 170, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: P.border, backgroundColor: P.card, cursor: 'pointer', zIndex: 51 } as any}>
        <Icon name="calendar-outline" size={17} color={P.blue} />
        <Text style={{ flex: 1, color: P.head, fontSize: 13.5, fontWeight: '500' }}>{options.find((o) => o[0] === value)?.[1]}</Text>
        <Icon name="chevron-down" size={14} color={P.body} />
      </Pressable>
      {open && (
        <View style={{ position: 'absolute', top: 48, right: 0, minWidth: 190, padding: 6, borderRadius: 12, borderWidth: 1, borderColor: P.border, backgroundColor: P.th.solid, zIndex: 52, shadowColor: P.shadow, shadowOpacity: 0.18, shadowRadius: 22, shadowOffset: { width: 0, height: 10 } }}>
          {options.map(([k, l]) => (
            <Pressable key={k} onPress={() => { onChange(k); setOpen(false); }} style={((s: any) => ({ height: 36, paddingHorizontal: 11, borderRadius: 8, justifyContent: 'center', cursor: 'pointer', backgroundColor: k === value ? P.soft : s.hovered ? P.alt : 'transparent' })) as any}>
              <Text style={{ color: k === value ? P.blue : P.head, fontSize: 13, fontWeight: k === value ? '700' : '500' }}>{l}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function Head({ icon, title, sub, color }: { icon: string; title: string; sub: string; color?: string }) {
  const P = usePal();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
      <Chip icon={icon} color={color ?? '#7B4DF0'} size={38} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: P.head, fontSize: 17, fontWeight: '800', letterSpacing: -0.2 }}>{title}</Text>
        <Text style={{ color: P.body, fontSize: 12.5, marginTop: 2 }}>{sub}</Text>
      </View>
    </View>
  );
}

// balance (and equity) over time, with month labels like the mockup and a dot at every trade
function Curve({ w, bal, eq, labels, empty }: { w: number; bal: number[]; eq: number[]; labels: string[]; empty: boolean }) {
  const P = usePal(), th = P.th, h = 250, L = 44, R = 12, T = 12, B = 30, iw = w - L - R, ih = h - T - B;
  const all = [...bal, ...eq, 0];
  let lo = Math.min(...all), hi = Math.max(...all);
  if (empty || hi === lo) { lo = 0; hi = 1; }
  const pad = (hi - lo) * 0.08; lo -= lo === 0 && empty ? 0 : pad; hi += pad;
  const X = (i: number, n: number) => L + (n <= 1 ? 0 : (i / (n - 1)) * iw), Y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * ih;
  const ticks = [0, 1, 2, 3, 4, 5].map((i) => lo + ((hi - lo) * i) / 5);
  const line = (a: number[]) => a.map((v, i) => `${X(i, a.length).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const fmt = (v: number) => (Math.abs(hi - lo) < 5 ? v.toFixed(1) : Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0));
  return (
    <Svg width={w} height={h}>
      {ticks.map((v, i) => (
        <React.Fragment key={i}>
          <Line x1={L} x2={w - R} y1={Y(v)} y2={Y(v)} stroke={P.border} strokeWidth={1} />
          <SText x={L - 10} y={Y(v) + 4} fontSize={11.5} fill={P.body} textAnchor="end">{empty ? v.toFixed(1) : fmt(v)}</SText>
        </React.Fragment>
      ))}
      {labels.map((l, i) => <SText key={i} x={X(i, labels.length)} y={h - 8} fontSize={11.5} fill={P.body} textAnchor="middle">{l}</SText>)}
      {empty ? (
        <>
          <Line x1={L} x2={w - R} y1={Y(0)} y2={Y(0)} stroke={th.buy} strokeWidth={2} />
          {labels.map((_, i) => <Circle key={i} cx={X(i, labels.length)} cy={Y(0)} r={3.5} fill={th.buy} />)}
        </>
      ) : (
        <>
          <Polyline points={line(bal)} fill="none" stroke="#5B5CF0" strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
          <Polyline points={line(eq)} fill="none" stroke={th.buy} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={eq.every((v, i) => v === bal[i]) ? '' : '5 4'} />
          {bal.length <= 40 && bal.map((v, i) => <Circle key={i} cx={X(i, bal.length)} cy={Y(v)} r={3} fill="#5B5CF0" />)}
        </>
      )}
    </Svg>
  );
}

function Donut({ pct, profit, loss, size = 150 }: { pct: number; profit: number; loss: number; size?: number }) {
  const P = usePal(), th = P.th, r = size / 2 - 11, c = 2 * Math.PI * r, tot = profit + loss;
  const g = tot ? (profit / tot) * c : 0, l = tot ? (loss / tot) * c : 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] } as any}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={P.dark ? P.alt : '#DDE3FB'} strokeWidth={14} fill="none" />
        {tot > 0 && <Circle cx={size / 2} cy={size / 2} r={r} stroke={th.buy} strokeWidth={14} fill="none" strokeDasharray={`${g} ${c}`} strokeLinecap="butt" />}
        {tot > 0 && <Circle cx={size / 2} cy={size / 2} r={r} stroke={th.sell} strokeWidth={14} fill="none" strokeDasharray={`${l} ${c}`} strokeDashoffset={-g} strokeLinecap="butt" />}
      </Svg>
      <Text style={{ color: P.head, fontSize: 25, fontWeight: '800' }}>{f(pct, 1)}%</Text>
      <Text style={{ color: P.body, fontSize: 12.5 }}>Total Return</Text>
    </View>
  );
}

export default function PerformanceHome() {
  const P = usePal(), th = P.th, go = useGo(), w = useRealWindow().width;
  const { journal, desk, signals, tab } = useApp();
  const [range, setRange] = useState('all'), [cr, setCr] = useState('ALL');
  const [cw, setCw] = useState(0);
  const wide = w >= 1060, pad = w >= 700 ? 32 : 16;
  const active = tab === 9;

  // live prices for the trades that are running, so Equity = balance + open profit
  const running = signals.filter((x) => x.status === 'open');
  const ids = useMemo(() => [...new Set(running.map((x) => x.symId))].slice(0, 20), [signals]);
  useEffect(() => { setWatch('perf', active ? ids : []); return () => setWatch('perf', []); }, [active, ids.join(',')]);
  const floating = running.reduce((a, x) => { const p = quotes[x.symId]?.price; return p ? a + totalR(x, p) * x.risk : a + x.banked * x.risk; }, 0);

  const startToday = new Date().setHours(0, 0, 0, 0);
  const rdef = RANGES.find((r) => r[0] === range)!;
  const list = useMemo(() => journal.filter((j) => range === 'all' || j.date >= startToday - rdef[2] * dayMs).sort((a, b) => a.date - b.date), [journal, range]);
  const wins = list.filter((j) => j.pnl > 0), losses = list.filter((j) => j.pnl < 0), n = list.length;
  const gw = wins.reduce((a, j) => a + j.pnl, 0), gl = Math.abs(losses.reduce((a, j) => a + j.pnl, 0)), net = gw - gl;
  const rate = n ? (wins.length / n) * 100 : 0, pf = gl ? gw / gl : gw ? Infinity : 0, expct = n ? net / n : 0;
  const avgW = wins.length ? gw / wins.length : 0, avgL = losses.length ? gl / losses.length : 0;
  let cur = 0, best = 0, worst = 0;
  list.forEach((j) => { if (j.pnl > 0) { cur = cur > 0 ? cur + 1 : 1; best = Math.max(best, cur); } else if (j.pnl < 0) { cur = cur < 0 ? cur - 1 : -1; worst = Math.min(worst, cur); } });
  const bestT = n ? Math.max(...list.map((j) => j.pnl)) : null, worstT = n ? Math.min(...list.map((j) => j.pnl)) : null;
  const base = desk.balance > 0 ? desk.balance : 0;
  const ret = base > 0 ? (net / base) * 100 : 0;
  const side = (s: 'buy' | 'sell') => { const l = list.filter((j) => j.side === s), wn = l.filter((j) => j.pnl > 0).length; return { n: l.length, rate: l.length ? (wn / l.length) * 100 : 0, pnl: l.reduce((a, j) => a + j.pnl, 0) }; };
  const B = side('buy'), S = side('sell');
  const pfTxt = pf === Infinity ? '∞' : f(pf);
  const sg = (v: number) => `${v > 0 ? '+' : ''}${f(v)}`;

  // chart: balance after each closed trade inside the chosen window; the last equity point adds the open profit
  const cdef = CHART_R.find((c) => c[0] === cr)!;
  const win = journal.filter((j) => (cdef[1] === 0 || j.date >= Date.now() - cdef[1] * dayMs)).sort((a, b) => a.date - b.date);
  const before = journal.filter((j) => !win.includes(j)).reduce((a, j) => a + j.pnl, 0);
  let run = base + before;
  const bal = win.length ? [run, ...win.map((j) => (run += j.pnl))] : [];
  const eq = bal.map((v, i) => (i === bal.length - 1 ? v + floating : v));
  const first = win[0]?.date, last = win[win.length - 1]?.date;
  const labels = win.length < 2 ? MONTHS : (() => {
    const span = last - first, d = (t: number) => new Date(t);
    const k = Math.min(8, win.length), out: string[] = [];
    for (let i = 0; i < bal.length; i++) { const t = i === 0 ? first : win[i - 1].date; out.push(i % Math.ceil(bal.length / k) === 0 ? (span > 90 * dayMs ? MONTHS[d(t).getMonth()] : d(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })) : ''); }
    return out;
  })();

  const kpi = (icon: string, c: string, k: string, v: string, sub: string, vc?: string) => (
    <View key={k} style={{ flexGrow: 1, flexBasis: 220, flexDirection: 'row', gap: 16, padding: 20, borderRadius: 14, borderWidth: 1, borderColor: P.border, backgroundColor: P.card, shadowColor: P.shadow, shadowOpacity: P.dark ? 0.25 : 0.05, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } }}>
      <Chip icon={icon} color={c} size={44} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: P.head, fontSize: 15, fontWeight: '700' }}>{k}</Text>
        <Text style={{ color: vc ?? P.head, fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginTop: 4 }} numberOfLines={1}>{v}</Text>
        <Text style={{ color: P.body, fontSize: 12.5, marginTop: 2 }}>{sub}</Text>
      </View>
    </View>
  );
  const row = (icon: string, c: string, k: string, v: string, vc: string, last?: boolean) => (
    <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 11, borderBottomWidth: last ? 0 : 1, borderBottomColor: P.border }}>
      <Chip icon={icon} color={c} size={32} />
      <Text style={{ flex: 1, color: P.head, fontSize: 14 }}>{k}</Text>
      <Text style={{ color: vc, fontSize: 14.5, fontWeight: '800' }}>{v}</Text>
    </View>
  );
  const sideCard = (label: string, icon: string, c: string, v: { n: number; rate: number; pnl: number }) => (
    <View key={label} style={{ flex: 1, minWidth: 200, padding: 18, gap: 10, borderRadius: 14, borderWidth: 1, borderColor: c + '33', backgroundColor: c + (P.dark ? '14' : '0F') }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: c + '26', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={19} color={c} /></View>
        <View><Text style={{ color: c, fontSize: 15, fontWeight: '800' }}>{label} Trades</Text><Text style={{ color: P.head, fontSize: 24, fontWeight: '800' }}>{v.n}</Text><Text style={{ color: P.body, fontSize: 12 }}>Total Trades</Text></View>
      </View>
      <View style={{ height: 1, backgroundColor: c + '33', marginTop: 4 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingRight: 24 }}>
        <View><Text style={{ color: c, fontSize: 15, fontWeight: '800' }}>{f(v.rate, 0)}%</Text><Text style={{ color: P.body, fontSize: 12 }}>Win Rate</Text></View>
        <View><Text style={{ color: v.pnl > 0 ? th.buy : v.pnl < 0 ? th.sell : P.head, fontSize: 15, fontWeight: '800' }}>{sg(v.pnl)}</Text><Text style={{ color: P.body, fontSize: 12 }}>P&amp;L</Text></View>
      </View>
    </View>
  );
  const pnlRow = (c: string, k: string, v: string) => (
    <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: P.border }}>
      <View style={{ width: 13, height: 13, borderRadius: 7, backgroundColor: c }} />
      <Text style={{ flex: 1, color: P.head, fontSize: 14 }}>{k}</Text>
      <Text style={{ color: P.head, fontSize: 14.5, fontWeight: '800' }}>{v}</Text>
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: P.bg }} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
      <View style={{ width: '100%', maxWidth: 1280, alignSelf: 'center', paddingHorizontal: pad, paddingTop: 18, gap: 20 }}>
        <Notices flush />

        {/* hero: same banner as every other page */}
        <HeroBanner icon="stats-chart" tag="Trading Analytics" title="Performance" subtitle="Track your trading progress with detailed performance metrics, win rate, and key statistics." />

        {/* range bar */}
        <Panel style={{ padding: 18, flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap', zIndex: 20 }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#6D4CF0', alignItems: 'center', justifyContent: 'center' }}><Icon name="bar-chart" size={23} color="#FFFFFF" /></View>
          <View style={{ flex: 1, minWidth: 220 }}>
            <Text style={{ color: P.head, fontSize: 14, fontWeight: '700' }}>Your performance summary is based on your trading journal.</Text>
            <Text style={{ color: P.body, fontSize: 13.5, marginTop: 2 }}>Track your progress, improve your strategy, and achieve your goals.</Text>
          </View>
          <Select value={range} options={RANGES.map((r) => [r[0], r[1]] as [string, string])} onChange={setRange} />
        </Panel>

        {/* kpis */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
          {kpi('cube', '#F0527A', 'Profit Factor', pfTxt, 'Total profit / Total loss', pf >= 1 ? th.buy : n ? th.sell : th.sell)}
          {kpi('pulse', '#8B5CF6', 'Expectancy', f(expct), 'Avg. win/loss per trade', expct > 0 ? th.buy : expct < 0 ? th.sell : P.head)}
          {kpi('trophy', '#1FB58F', 'Win Rate', `${f(rate, 0)}%`, 'Winning trades percentage', P.head)}
          {kpi('swap-horizontal', '#2F6BFF', 'Total Trades', String(n), 'Total executed trades')}
        </View>

        {/* overview + statistics */}
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: 20, alignItems: 'stretch' }}>
          <Panel style={{ flex: wide ? 1.75 : undefined, padding: 22, gap: 14, minWidth: 0 }}>
            <Head icon="analytics" title="Performance Overview" sub="Track your trading results and see how you are performing over time." />
            <View style={{ height: 1, backgroundColor: P.border }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
              {[['Balance', '#5B5CF0'], ['Equity', th.buy]].map(([k, c]) => <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c }} /><Text style={{ color: P.body, fontSize: 13 }}>{k}</Text></View>)}
              <View style={{ flex: 1 }} />
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {CHART_R.map(([k]) => {
                  const on = cr === k;
                  return <Pressable key={k} onPress={() => setCr(k)} style={((s: any) => ({ minWidth: 40, height: 30, paddingHorizontal: 11, borderRadius: 15, alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backgroundColor: on ? '#1F6BFF' : s.hovered ? P.soft : P.soft, borderWidth: on ? 0 : 1, borderColor: P.blue + '33' })) as any}><Text style={{ color: on ? '#FFFFFF' : P.blue, fontSize: 12.5, fontWeight: '800' }}>{k}</Text></Pressable>;
                })}
              </View>
            </View>
            <View onLayout={(e) => setCw(e.nativeEvent.layout.width)} style={{ minHeight: 250 }}>
              {cw > 0 && <Curve w={cw} bal={bal} eq={eq} labels={labels} empty={bal.length === 0} />}
            </View>
            {bal.length === 0 && <Text style={{ color: P.body, fontSize: 12.5 }}>No closed trades in this period yet. Close a trade in your Journal and the curve appears here.</Text>}
          </Panel>

          <Panel style={{ flex: wide ? 1 : undefined, padding: 22, gap: 8, minWidth: 0 }}>
            <Head icon="bar-chart" title="Trade Statistics" sub="Detailed breakdown of your trading performance." />
            <View style={{ marginTop: 6 }}>
              {row('stats-chart', '#8B5CF6', 'Total Trades', String(n), P.head)}
              {row('bar-chart', '#1FB58F', 'Average Win', avgW ? `+${f(avgW)}` : '0', avgW ? th.buy : P.head)}
              {row('trending-down', '#F0527A', 'Average Loss', avgL ? `-${f(avgL)}` : '0', avgL ? th.sell : P.head)}
              {row('flame', '#F5A623', 'Best Win Streak', String(best), P.head)}
              {row('thunderstorm', '#8B5CF6', 'Worst Loss Streak', String(Math.abs(worst)), P.head)}
              {row('trophy', '#2F6BFF', 'Best Trade', bestT === null ? '-' : sg(bestT), bestT && bestT > 0 ? th.buy : P.head)}
              {row('warning', '#F0527A', 'Worst Trade', worstT === null ? '-' : sg(worstT), worstT && worstT < 0 ? th.sell : P.head, true)}
            </View>
          </Panel>
        </View>

        {/* profit & loss + buy vs sell */}
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: 20, alignItems: 'stretch' }}>
          <Panel style={{ flex: wide ? 1 : undefined, padding: 22, gap: 14, minWidth: 0 }}>
            <Head icon="cash" title="Profit & Loss" sub="Track your overall profit and loss in the selected period." />
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 26, paddingTop: 8 }}>
              <Donut pct={ret} profit={gw} loss={gl} />
              <View style={{ flex: 1, minWidth: 200 }}>
                {pnlRow(th.buy, 'Total Profit', f(gw))}
                {pnlRow(th.sell, 'Total Loss', f(gl))}
                {pnlRow('#2F6BFF', 'Net P&L', sg(net))}
              </View>
            </View>
            {base === 0 && n > 0 && <Text style={{ color: P.body, fontSize: 12 }}>Set your account balance in the Journal risk settings to see the return in %.</Text>}
          </Panel>

          <Panel style={{ flex: wide ? 1.15 : undefined, padding: 22, gap: 14, minWidth: 0 }}>
            <Head icon="swap-vertical" title="Buy vs Sell Performance" sub="Compare the performance of buy and sell trades." />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingTop: 4 }}>
              {sideCard('Buy', 'arrow-up', th.buy, B)}
              {sideCard('Sell', 'arrow-down', th.sell, S)}
            </View>
          </Panel>
        </View>

        {/* call to action */}
        <LinearGradient colors={['#2F4FE0', '#5B4BEA', '#8A5CF0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ borderRadius: 22, marginBottom: 28 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, flexWrap: 'wrap', paddingHorizontal: 28, paddingVertical: 22 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFFFFF26', alignItems: 'center', justifyContent: 'center' }}><Icon name="locate" size={28} color="#FFFFFF" /></View>
            <View style={{ flex: 1, minWidth: 240 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '800' }}>Improve Your Performance</Text>
              <Text style={{ color: '#E3ECFF', fontSize: 13.5, marginTop: 3 }}>Use your trading journal, analyze your trades, and follow your plan to achieve better results.</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => go(3)} style={((s: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 9, height: 46, paddingHorizontal: 22, borderRadius: 10, backgroundColor: '#FFFFFF', cursor: 'pointer', opacity: s.hovered ? 0.92 : 1 })) as any}>
              <Text style={{ color: '#2F4FE0', fontSize: 14, fontWeight: '700' }}>View Journal</Text><Icon name="arrow-forward" size={16} color="#2F4FE0" />
            </Pressable>
          </View>
        </LinearGradient>
      </View>
      <Footer w={w} go={go} />
    </ScrollView>
  );
}
