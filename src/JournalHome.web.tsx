import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Line, Rect, Polyline, Path } from 'react-native-svg';
import { useApp, Trade } from './store';
import { Icon, confirmAction, HeroBanner } from './ui';
import { Coin } from './MarketWidgets';
import GuardBanner from './Guard';
import { MiniRing } from './MethodArt';
import { quotes, setWatch, symOf, chg } from './markets';
import { useRealWindow } from './win';
import { usePal, Panel, Footer, Btn, useGo } from './DesktopHome.web';
import { Sessions } from './AnalysisHome.web';
import { Signal, totalR, floatR, money, fmtR, dirOf, sourceName, todayPnl, stopAtBE } from './trades';

// The website's Journal page, designed like the "Trading Journal" mockup: hero, performance overview, Signals / Live / Closed / Insights tabs
// with filters and tables, and a right column with risk settings, sessions, discipline, strategy results, sentiment and a tip.
// All numbers come from the journal, the signals and the live prices. Nothing is made up.
type Props = {
  active: boolean; px: (id: string) => number | undefined; onTake: (id: string) => void; onManage: (id: string) => void;
  settings: React.ReactNode; showSet: boolean; toggleSet: () => void; exportCsv: () => void; equity: number; floating: number;
};
type View4 = 'signals' | 'open' | 'closed' | 'insights';

const TAGS = ['Followed plan', 'Early exit', 'Late entry', 'FOMO', 'Moved stop'];
const TIPS = ['Stick to your plan. The best trades come from patience, not prediction.', 'Protect your capital first. Profits follow.', 'One good setup beats ten forced trades.', 'Review every closed trade. The lesson is the real profit.', 'Risk small, think long.'];
const dt = (t: number) => new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const dayMs = 86400000;
const tfName = (k: string) => { const n = Number(k); return !isFinite(n) || k.includes('/') ? k : n >= 86400 ? 'D1' : n >= 3600 ? `H${n / 3600}` : `M${n / 60}`; };
const dur = (a?: number, b?: number) => { if (!a || !b) return '—'; const m = Math.max(1, Math.round((b - a) / 60000)); return m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${(m / 1440).toFixed(1)}d`; };
const methodOf = (src?: string) => sourceName(src ? src.split(' · ')[0] : undefined);
const RANGES: [string, string][] = [['all', 'All time'], ['today', 'Today'], ['week', 'Last 7 days'], ['month', 'Last 30 days']];

// ---------- small pieces
function Select({ value, options, onChange, icon, width = 150 }: { value: string; options: [string, string][]; onChange: (k: string) => void; icon?: string; width?: number }) {
  const P = usePal();
  const [open, setOpen] = useState(false);
  const cur = options.find((o) => o[0] === value)?.[1] ?? value;
  return (
    <View style={{ zIndex: open ? 50 : 1 }}>
      <Pressable onPress={() => setOpen((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, height: 36, minWidth: width, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: P.border, backgroundColor: P.card, cursor: 'pointer' } as any}>
        {!!icon && <Icon name={icon} size={14} color={P.blue} />}
        <Text style={{ flex: 1, color: P.head, fontSize: 12.5 }} numberOfLines={1}>{cur}</Text>
        <Icon name="chevron-down" size={13} color={P.body} />
      </Pressable>
      {open && (
        <View style={{ position: 'absolute', top: 40, left: 0, minWidth: Math.max(width, 160), padding: 6, borderRadius: 12, borderWidth: 1, borderColor: P.border, backgroundColor: P.card, zIndex: 60, shadowColor: P.shadow, shadowOpacity: 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } }}>
          {options.map(([k, l]) => (
            <Pressable key={k} onPress={() => { onChange(k); setOpen(false); }} style={((st: any) => ({ height: 34, paddingHorizontal: 10, borderRadius: 8, justifyContent: 'center', cursor: 'pointer', backgroundColor: k === value ? P.soft : st.hovered ? P.alt : 'transparent' })) as any}>
              <Text style={{ color: k === value ? P.blue : P.head, fontSize: 12.5, fontWeight: k === value ? '700' : '500' }}>{l}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function SideChip({ side }: { side: 'buy' | 'sell' }) {
  const th = usePal().th, c = side === 'buy' ? th.buy : th.sell;
  return <View style={{ alignSelf: 'flex-start', paddingHorizontal: 9, height: 22, borderRadius: 6, justifyContent: 'center', backgroundColor: c + '22' }}><Text style={{ color: c, fontSize: 11, fontWeight: '800' }}>{side.toUpperCase()}</Text></View>;
}
function StatusChip({ text, color }: { text: string; color: string }) {
  return <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 22, borderRadius: 11, backgroundColor: color + '1F' }}><View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color }} /><Text style={{ color, fontSize: 11, fontWeight: '700' }}>{text}</Text></View>;
}
function Btn2({ label, onPress, solid, tone, icon, disabled }: { label: string; onPress: () => void; solid?: boolean; tone?: string; icon?: string; disabled?: boolean }) {
  const P = usePal(), c = tone ?? P.blue;
  return (
    <Pressable disabled={disabled} onPress={onPress} style={((st: any) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 34, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: solid ? c : c + '66', backgroundColor: solid ? c : st.hovered ? c + '14' : P.card, opacity: disabled ? 0.45 : 1, cursor: 'pointer' })) as any}>
      {!!icon && <Icon name={icon} size={14} color={solid ? P.th.onAccent : c} />}
      <Text style={{ color: solid ? P.th.onAccent : c, fontSize: 12.5, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}
function Head({ icon, title, sub, right }: { icon: string; title: string; sub?: string; right?: React.ReactNode }) {
  const P = usePal();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Icon name={icon} size={18} color={P.blue} />
      <Text style={{ color: P.head, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 }}>{title}</Text>
      {!!sub && <Text style={{ color: P.body, fontSize: 11.5, marginLeft: 4 }}>{sub}</Text>}
      <View style={{ flex: 1 }} />{right}
    </View>
  );
}
type Col = { label: string; flex: number; align?: 'left' | 'right' };
function Th({ cols }: { cols: Col[] }) {
  const P = usePal();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: P.border, gap: 8 }}>
      {cols.map((c, i) => <Text key={i} style={{ flex: c.flex, color: P.body, fontSize: 11, fontWeight: '600', textAlign: c.align ?? 'left' }} numberOfLines={1}>{c.label}</Text>)}
    </View>
  );
}
const Cell = ({ flex, children, align }: { flex: number; children: React.ReactNode; align?: 'left' | 'right' }) => <View style={{ flex, minWidth: 0, alignItems: align === 'right' ? 'flex-end' : 'flex-start', justifyContent: 'center' }}>{children}</View>;

function Empty({ icon, title, text, children }: { icon: string; title: string; text: string; children?: React.ReactNode }) {
  const P = usePal();
  return (
    <View style={{ alignItems: 'center', gap: 8, paddingVertical: 34, paddingHorizontal: 20, borderRadius: 12, backgroundColor: P.alt }}>
      <Icon name={icon} size={28} color={P.blue} />
      <Text style={{ color: P.head, fontSize: 15, fontWeight: '800' }}>{title}</Text>
      <Text style={{ color: P.body, fontSize: 12.5, lineHeight: 18, textAlign: 'center', maxWidth: 480 }}>{text}</Text>
      {children}
    </View>
  );
}

// ---------- right column: sentiment from the major forex pairs
const MAJORS = ['frxEURUSD', 'frxGBPUSD', 'frxUSDJPY', 'frxAUDUSD', 'frxUSDCAD', 'frxUSDCHF', 'frxNZDUSD'];
function Sentiment({ active }: { active: boolean }) {
  const P = usePal(), th = P.th;
  useEffect(() => { if (active) setWatch('jr-sent', MAJORS); return () => setWatch('jr-sent', []); }, [active]);
  const have = MAJORS.filter((id) => quotes[id]), up = have.filter((id) => chg(id) > 0).length, pct = have.length ? Math.round((up / have.length) * 100) : 50;
  const s = pct >= 60 ? { l: 'Bullish', c: th.buy } : pct <= 40 ? { l: 'Bearish', c: th.sell } : { l: 'Neutral', c: th.gold };
  const len = Math.PI * 70, p = pct / 100;
  return (
    <Panel style={{ padding: 20, gap: 8 }}>
      <Head icon="shield-checkmark" title="Market Sentiment" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 170, height: 96, alignItems: 'center' }}>
          <Svg width={170} height={96} viewBox="0 0 170 96">
            <Path d="M 15 88 A 70 70 0 0 1 155 88" stroke={P.dark ? th.panel2 : '#EEF2F8'} strokeWidth={13} fill="none" strokeLinecap="round" />
            <Path d="M 15 88 A 70 70 0 0 1 155 88" stroke={s.c} strokeWidth={13} fill="none" strokeLinecap="round" strokeDasharray={`${len * p} ${len}`} />
          </Svg>
          <Text style={{ position: 'absolute', bottom: 0, color: P.head, fontSize: 26, fontWeight: '800' }}>{have.length ? `${pct}%` : '—'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: s.c, fontSize: 17, fontWeight: '800' }}>{have.length ? s.l : 'Loading'}</Text>
          <Text style={{ color: P.body, fontSize: 11.5, lineHeight: 16 }}>Share of the 7 major forex pairs trading above today’s open.</Text>
        </View>
      </View>
    </Panel>
  );
}

// ---------- insights (all from the closed trades)
function Insights({ journal, desk, running, today }: { journal: Trade[]; desk: any; running: number; today: number }) {
  const P = usePal(), th = P.th;
  const [cw, setCw] = useState(0);
  const n = journal.length;
  if (!n) return <Empty icon="analytics-outline" title="No closed trades yet" text="Take a signal and let it finish. Your weekly results, win rate, strategies and activity fill in here." />;
  const sorted = [...journal].sort((a, b) => a.date - b.date);
  const wins = journal.filter((j) => j.pnl > 0).length, losses = journal.filter((j) => j.pnl < 0).length;
  const rate = Math.round((wins / n) * 100);
  // weekly P&L, last 10 weeks (weeks start on Monday)
  const mon = new Date(); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const weeks = Array.from({ length: 10 }, (_, i) => { const s = mon.getTime() - (9 - i) * 7 * dayMs; return { s, v: journal.filter((j) => j.date >= s && j.date < s + 7 * dayMs).reduce((a, j) => a + j.pnl, 0) }; });
  const wmax = Math.max(1e-9, ...weeks.map((x) => Math.abs(x.v)));
  // methods, symbols, mistakes
  const by = (key: (j: Trade) => string) => { const m: Record<string, { n: number; w: number; pnl: number }> = {}; journal.forEach((j) => { const e = (m[key(j)] ??= { n: 0, w: 0, pnl: 0 }); e.n++; e.pnl += j.pnl; if (j.pnl > 0) e.w++; }); return Object.entries(m).sort((a, b) => b[1].pnl - a[1].pnl); };
  const meth = by((j) => methodOf(j.source)).slice(0, 5), syms = by((j) => j.symbol).slice(0, 5);
  const mistakes = TAGS.filter((t) => t !== 'Followed plan').map((t) => [t, journal.filter((j) => j.tag === t).length] as const).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]);
  // equity curve
  let run = 0; const pts = [0, ...sorted.map((j) => (run += j.pnl))];
  const emin = Math.min(...pts), emax = Math.max(...pts), erng = emax - emin || 1, W = Math.max(200, cw), H = 150;
  const line = pts.map((v, i) => `${(i / Math.max(1, pts.length - 1)) * (W - 8) + 4},${H - 10 - ((v - emin) / erng) * (H - 22)}`).join(' ');
  const up = pts[pts.length - 1] >= 0;
  // activity heatmap: weekday x 4-hour block of closing time
  const blocks = ['00-06', '06-12', '12-18', '18-24'], days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const grid = days.map(() => blocks.map(() => 0));
  journal.forEach((j) => { const d = new Date(j.date); grid[(d.getDay() + 6) % 7][Math.floor(d.getHours() / 6)]++; });
  const gmax = Math.max(1, ...grid.flat());
  // months
  const months = [...new Set(sorted.map((j) => { const d = new Date(j.date); return `${d.getFullYear()}-${d.getMonth()}`; }))].reverse().slice(0, 4).map((k) => {
    const l = journal.filter((j) => { const d = new Date(j.date); return `${d.getFullYear()}-${d.getMonth()}` === k; }), d = new Date(l[0].date);
    return { label: d.toLocaleString('en-US', { month: 'short', year: 'numeric' }), pnl: l.reduce((a, j) => a + j.pnl, 0), n: l.length, wr: Math.round((l.filter((j) => j.pnl > 0).length / l.length) * 100) };
  });
  // rules
  const limit = (desk.balance * desk.dailyLossPct) / 100;
  const rules: [string, boolean | null][] = [
    [desk.riskPct > 0 ? `Risk per trade set to ${desk.riskPct}%` : 'Set your risk per trade', desk.riskPct > 0],
    [desk.dailyLossPct > 0 ? (today > -limit ? `Daily loss limit ${desk.dailyLossPct}% not reached` : `Daily loss limit ${desk.dailyLossPct}% reached`) : 'Set a daily loss limit', desk.dailyLossPct > 0 ? today > -limit : null],
    [desk.maxOpen > 0 ? `${running} of ${desk.maxOpen} trades running` : 'Set a limit for trades at once', desk.maxOpen > 0 ? running <= desk.maxOpen : null],
    [desk.autoLog ? 'Auto-log of setups is on' : 'Auto-log of setups is off', !!desk.autoLog],
  ];
  const card = (title: string, body: React.ReactNode, flex = 1, minWidth = 260) => <View style={{ flex, minWidth, padding: 16, gap: 10, borderRadius: 12, borderWidth: 1, borderColor: P.border, backgroundColor: P.card }}><Text style={{ color: P.head, fontSize: 13.5, fontWeight: '800' }}>{title}</Text>{body}</View>;
  const dn = 2 * Math.PI * 52;
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        {card('P&L by Week', (
          <View style={{ height: 130, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {weeks.map((x, i) => (
              <View key={i} style={{ flex: 1, height: '100%', alignItems: 'center' }}>
                <View style={{ flex: 1, justifyContent: 'flex-end', width: '100%', alignItems: 'center' }}>{x.v > 0 && <View style={{ width: '70%', height: `${(x.v / wmax) * 100}%`, borderRadius: 3, backgroundColor: th.buy }} />}</View>
                <View style={{ height: 1, width: '100%', backgroundColor: P.border }} />
                <View style={{ flex: 1, justifyContent: 'flex-start', width: '100%', alignItems: 'center' }}>{x.v < 0 && <View style={{ width: '70%', height: `${(-x.v / wmax) * 100}%`, borderRadius: 3, backgroundColor: th.sell }} />}</View>
              </View>
            ))}
          </View>
        ), 1.6, 320)}
        {card('Win / Loss Ratio', (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={120} height={120} viewBox="0 0 120 120" style={{ transform: [{ rotate: '-90deg' }] } as any}>
                <Circle cx={60} cy={60} r={52} stroke={th.sell} strokeWidth={13} fill="none" />
                <Circle cx={60} cy={60} r={52} stroke={th.buy} strokeWidth={13} fill="none" strokeDasharray={`${(dn * wins) / Math.max(1, wins + losses)} ${dn}`} />
              </Svg>
              <Text style={{ position: 'absolute', color: P.head, fontSize: 22, fontWeight: '800' }}>{rate}%</Text>
            </View>
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: th.buy }} /><Text style={{ color: P.body, fontSize: 12.5 }}>Wins  <Text style={{ color: P.head, fontWeight: '800' }}>{wins}</Text></Text></View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: th.sell }} /><Text style={{ color: P.body, fontSize: 12.5 }}>Losses  <Text style={{ color: P.head, fontWeight: '800' }}>{losses}</Text></Text></View>
            </View>
          </View>
        ), 1, 280)}
        {card('Top Performing Strategies', meth.map(([k, v], i) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: P.body, fontSize: 12, width: 16 }}>{i + 1}</Text><Text style={{ flex: 1, color: P.head, fontSize: 12.5, fontWeight: '600' }} numberOfLines={1}>{k}</Text>
            <Text style={{ color: v.pnl >= 0 ? th.buy : th.sell, fontSize: 12.5, fontWeight: '800' }}>{money(v.pnl)}</Text>
          </View>
        )), 1, 260)}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        {card('Common Mistakes', mistakes.length === 0 ? <Text style={{ color: P.body, fontSize: 12, lineHeight: 17 }}>Nothing tagged yet. Tag closed trades in the Closed tab to see your habits here.</Text> : mistakes.map(([t, c]) => (
          <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="warning" size={14} color={th.gold} /><Text style={{ flex: 1, color: P.head, fontSize: 12.5 }}>{t}</Text><Text style={{ color: P.head, fontWeight: '800', fontSize: 12.5 }}>{c}</Text></View>
        )), 1, 240)}
        {card('Symbol Performance', (
          <View style={{ gap: 7 }}>
            <View style={{ flexDirection: 'row' }}><Text style={{ flex: 1.4, color: P.body, fontSize: 11 }}>Symbol</Text><Text style={{ flex: 1, color: P.body, fontSize: 11, textAlign: 'right' }}>P&L</Text><Text style={{ flex: 1, color: P.body, fontSize: 11, textAlign: 'right' }}>Win rate</Text></View>
            {syms.map(([k, v]) => <View key={k} style={{ flexDirection: 'row' }}><Text style={{ flex: 1.4, color: P.head, fontSize: 12.5 }} numberOfLines={1}>{k}</Text><Text style={{ flex: 1, color: v.pnl >= 0 ? th.buy : th.sell, fontSize: 12.5, fontWeight: '700', textAlign: 'right' }}>{money(v.pnl)}</Text><Text style={{ flex: 1, color: P.head, fontSize: 12.5, textAlign: 'right' }}>{Math.round((v.w / v.n) * 100)}%</Text></View>)}
          </View>
        ), 1.3, 300)}
        {card('Risk Rules Checklist', rules.map(([t, ok], i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name={ok === null ? 'ellipse-outline' : ok ? 'checkmark-circle' : 'close-circle'} size={16} color={ok === null ? P.body : ok ? th.buy : th.sell} /><Text style={{ flex: 1, color: P.head, fontSize: 12.5 }}>{t}</Text>
          </View>
        )), 1, 260)}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        {card('Equity Curve (closed trades)', (
          <View onLayout={(e) => setCw(Math.round(e.nativeEvent.layout.width))}>
            {cw > 0 && (
              <Svg width={W} height={H}>
                {pts.length > 1 && <Polyline points={`4,${H - 4} ${line} ${W - 4},${H - 4}`} fill={(up ? th.buy : th.sell) + '1A'} stroke="none" />}
                <Polyline points={line} fill="none" stroke={up ? th.buy : th.sell} strokeWidth={2} />
              </Svg>
            )}
            <Text style={{ color: up ? th.buy : th.sell, fontSize: 12, fontWeight: '800' }}>{money(pts[pts.length - 1])} over {n} trade{n > 1 ? 's' : ''}</Text>
          </View>
        ), 1.4, 320)}
        {card('Trading Activity (by closing time)', (
          <View style={{ gap: 3 }}>
            <View style={{ flexDirection: 'row', gap: 3, paddingLeft: 34 }}>{blocks.map((b) => <Text key={b} style={{ flex: 1, color: P.body, fontSize: 10, textAlign: 'center' }}>{b}</Text>)}</View>
            {days.map((d, r) => (
              <View key={d} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Text style={{ width: 31, color: P.body, fontSize: 10.5 }}>{d}</Text>
                {blocks.map((_, c) => <View key={c} style={{ flex: 1, height: 18, borderRadius: 3, backgroundColor: grid[r][c] ? P.blue + Math.round(40 + (grid[r][c] / gmax) * 190).toString(16).padStart(2, '0') : P.alt }} />)}
              </View>
            ))}
          </View>
        ), 1, 300)}
        {card('Monthly Stats', (
          <View style={{ gap: 7 }}>
            <View style={{ flexDirection: 'row' }}><Text style={{ flex: 1.3, color: P.body, fontSize: 11 }}>Month</Text><Text style={{ flex: 1, color: P.body, fontSize: 11, textAlign: 'right' }}>P&L</Text><Text style={{ flex: 0.7, color: P.body, fontSize: 11, textAlign: 'right' }}>Trades</Text><Text style={{ flex: 0.8, color: P.body, fontSize: 11, textAlign: 'right' }}>Win rate</Text></View>
            {months.map((m) => <View key={m.label} style={{ flexDirection: 'row' }}><Text style={{ flex: 1.3, color: P.head, fontSize: 12.5 }}>{m.label}</Text><Text style={{ flex: 1, color: m.pnl >= 0 ? th.buy : th.sell, fontSize: 12.5, fontWeight: '700', textAlign: 'right' }}>{money(m.pnl)}</Text><Text style={{ flex: 0.7, color: P.head, fontSize: 12.5, textAlign: 'right' }}>{m.n}</Text><Text style={{ flex: 0.8, color: P.head, fontSize: 12.5, textAlign: 'right' }}>{m.wr}%</Text></View>)}
          </View>
        ), 1.1, 280)}
      </View>
    </View>
  );
}

export default function JournalHome({ active, px, onTake, onManage, settings, showSet, toggleSet, exportCsv, equity, floating }: Props) {
  const P = usePal(), th = P.th, go = useGo();
  const w = useRealWindow().width;
  const { journal, signals, desk, skipSetup, clearSignals, closeSignal, breakEven, updateTrade, removeTrade, toast, setTab, setAsym, setHistOpen } = useApp();
  const [view, setView] = useState<View4>('signals');
  const [side, setSide] = useState<'all' | 'buy' | 'sell'>('all'), [q, setQ] = useState(''), [range, setRange] = useState('all'), [strat, setStrat] = useState('all'), [tfF, setTfF] = useState('all'), [order, setOrder] = useState('new');
  const two = w >= 1180;

  const sigs = signals.filter((x) => x.status === 'signal'), live = signals.filter((x) => x.status !== 'signal'), running = live.filter((x) => x.status === 'open');
  const n = journal.length, wins = journal.filter((j) => j.pnl > 0).length, losses = journal.filter((j) => j.pnl < 0).length, rate = n ? Math.round((wins / n) * 100) : 0;
  const closedPnl = journal.reduce((a, j) => a + j.pnl, 0), today = todayPnl(journal), bal = desk.balance;
  const rs = journal.filter((j) => j.r !== undefined), avgR = rs.length ? rs.reduce((a, j) => a + (j.r as number), 0) / rs.length : null;
  const pctOf = (v: number) => (bal > 0 ? `${v >= 0 ? '▲' : '▼'} ${Math.abs((v / bal) * 100).toFixed(2)}%` : '');

  // ---- filters
  const startToday = new Date().setHours(0, 0, 0, 0);
  const inRange = (t: number) => range === 'all' || t >= startToday - ({ today: 0, week: 6, month: 29 } as any)[range] * dayMs;
  const text = q.trim().toLowerCase();
  const methods = [...new Set([...signals.map((x) => methodOf(x.source)), ...journal.map((j) => methodOf(j.source))])];
  const tfs = [...new Set([...signals.map((x) => x.tf), ...journal.map((j) => j.tf ?? '')].filter(Boolean))];
  const okSig = (x: Signal) => (side === 'all' || x.side === side) && inRange(x.date) && (strat === 'all' || methodOf(x.source) === strat) && (tfF === 'all' || x.tf === tfF) && (!text || (x.name + ' ' + x.source).toLowerCase().includes(text));
  const okTr = (j: Trade) => (side === 'all' || j.side === side) && inRange(j.date) && (strat === 'all' || methodOf(j.source) === strat) && (tfF === 'all' || j.tf === tfF) && (!text || (j.symbol + ' ' + (j.source ?? '')).toLowerCase().includes(text));
  const ord = <T extends { date: number }>(l: T[]) => [...l].sort((a, b) => (order === 'new' ? b.date - a.date : a.date - b.date));
  const shownSigs = ord(sigs.filter(okSig)), shownLive = ord(live.filter(okSig)), shownClosed = ord(journal.filter(okTr));
  const [limit, setLimit] = useState(8);
  useEffect(() => { setLimit(8); }, [view, side, q, range, strat, tfF, order]);

  // ---- tiles
  const tile = (label: string, value: string, sub: string, color: string) => (
    <View key={label} style={{ flex: 1, minWidth: 130, padding: 14, gap: 3, borderRadius: 12, borderWidth: 1, borderColor: P.border, backgroundColor: P.card }}>
      <Text style={{ color: P.body, fontSize: 11.5 }}>{label}</Text>
      <Text style={{ color, fontSize: 23, fontWeight: '800', letterSpacing: -0.5 }} numberOfLines={1}>{value}</Text>
      <Text style={{ color: sub.startsWith('▲') ? th.buy : sub.startsWith('▼') ? th.sell : P.body, fontSize: 11 }} numberOfLines={1}>{sub || ' '}</Text>
    </View>
  );
  const overview = (
    <Panel style={{ padding: 20, gap: 14 }}>
      <Head icon="shield-checkmark" title="Performance Overview" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {tile('Total P&L', n ? money(closedPnl) : '—', pctOf(closedPnl), closedPnl >= 0 ? th.buy : th.sell)}
        {tile('Today’s P&L', money(today), pctOf(today), today >= 0 ? th.buy : th.sell)}
        {tile('Win Rate', n ? `${rate}%` : '—', n ? `${wins}W / ${losses}L` : 'No closed trades', P.head)}
        {tile('Running Trades', String(running.length), desk.maxOpen > 0 ? `of ${desk.maxOpen} allowed` : 'Active', P.head)}
        {tile('Closed Trades', String(n), 'Completed', P.head)}
        {tile('Average R', avgR === null ? '—' : fmtR(avgR), 'Per closed trade', avgR === null ? P.head : avgR >= 0 ? th.buy : th.sell)}
      </View>
    </Panel>
  );

  // ---- tabs
  const TABS: [View4, string, string, number][] = [['signals', 'Signals', 'radio-outline', sigs.length], ['open', 'Live', 'pulse-outline', live.length], ['closed', 'Closed', 'checkmark-done-outline', n], ['insights', 'Insights', 'analytics-outline', 0]];
  const tabs = (
    <Panel style={{ padding: 6, flexDirection: 'row', gap: 6 }}>
      {TABS.map(([k, l, ic, c]) => {
        const on = view === k;
        return (
          <Pressable key={k} onPress={() => setView(k)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={((st: any) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: 10, backgroundColor: on ? P.blue : st.hovered ? P.alt : 'transparent', cursor: 'pointer' })) as any}>
            <Icon name={ic} size={16} color={on ? th.onAccent : P.body} />
            <Text style={{ color: on ? th.onAccent : P.body, fontSize: 13.5, fontWeight: on ? '800' : '600' }}>{l}</Text>
            {c > 0 && <View style={{ minWidth: 20, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? '#FFFFFF33' : P.soft }}><Text style={{ color: on ? th.onAccent : P.blue, fontSize: 10.5, fontWeight: '800' }}>{c}</Text></View>}
          </Pressable>
        );
      })}
    </Panel>
  );
  const filters = view !== 'insights' && (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, zIndex: 20 }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {(['all', 'buy', 'sell'] as const).map((k) => {
          const on = side === k, c = k === 'buy' ? th.buy : k === 'sell' ? th.sell : P.blue;
          return <Pressable key={k} onPress={() => setSide(k)} style={{ height: 34, minWidth: 48, paddingHorizontal: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c : P.alt, cursor: 'pointer' } as any}><Text style={{ color: on ? '#FFFFFF' : P.body, fontSize: 12.5, fontWeight: '700' }}>{k === 'all' ? 'All' : k === 'buy' ? 'Buy' : 'Sell'}</Text></Pressable>;
        })}
      </View>
      <View style={{ flex: 1, minWidth: 180, flexDirection: 'row', alignItems: 'center', gap: 8, height: 36, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: P.border, backgroundColor: P.card }}>
        <Icon name="search" size={14} color={P.body} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search symbol or strategy..." placeholderTextColor={P.body} style={{ flex: 1, color: P.head, fontSize: 12.5, outlineStyle: 'none' } as any} />
      </View>
      <Select value={range} options={RANGES} onChange={setRange} icon="calendar-outline" width={140} />
      <Select value={strat} options={[['all', 'All Strategies'], ...methods.map((m) => [m, m] as [string, string])]} onChange={setStrat} width={140} />
      <Select value={tfF} options={[['all', 'All Timeframes'], ...tfs.map((t) => [t, tfName(t)] as [string, string])]} onChange={setTfF} width={140} />
      <Select value={order} options={[['new', 'Newest First'], ['old', 'Oldest First']]} onChange={setOrder} width={130} />
    </View>
  );

  // ---- signals list
  const sigRow = (s: Signal) => {
    const f = (v: number) => v.toFixed(s.dec), price = px(s.symId), sc = s.score >= 70 ? th.buy : s.score >= 50 ? th.gold : th.sell;
    const lv = (label: string, v: string, c: string) => <View style={{ flex: 1, minWidth: 0 }}><Text style={{ color: P.body, fontSize: 11 }}>{label}</Text><Text style={{ color: c, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] }} numberOfLines={1}>{v}</Text></View>;
    return (
      <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 14, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: P.border, backgroundColor: P.card }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, width: 200 }}>
          <Coin s={symOf(s.symId)} size={38} />
          <View style={{ gap: 3, flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text style={{ color: P.head, fontSize: 14, fontWeight: '800' }} numberOfLines={1}>{s.name}</Text><SideChip side={s.side} /></View>
            <Text style={{ color: P.body, fontSize: 11 }} numberOfLines={1}>{methodOf(s.source)} · {tfName(s.tf)}</Text>
          </View>
        </View>
        <View style={{ flex: 1, minWidth: 260, flexDirection: 'row', gap: 10 }}>
          {lv('Entry', f(s.entry), P.head)}{lv('SL', f(s.sl), th.sell)}{s.tps.slice(0, 2).map((p, i) => lv(`TP${i + 1}`, f(p), th.buy))}
        </View>
        <View style={{ width: 120 }}><Text style={{ color: P.body, fontSize: 11, marginBottom: 2 }}>Confidence</Text><MiniRing score={s.score} color={sc} track={P.border} text="" size={24} /></View>
        <View style={{ width: 130, gap: 4 }}>
          <Text style={{ color: P.body, fontSize: 11.5 }}>{dt(s.date)}</Text>
          <StatusChip text={s.armed ? 'Waiting' : price ? 'Active' : 'Pending'} color={s.armed ? th.gold : price ? th.buy : P.body} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Btn2 label="View setup" onPress={() => { setAsym(s.symId); setTab(1); }} />
          <Btn2 label="Take trade" solid onPress={() => onTake(s.id)} />
          <Btn2 label="Skip" tone={th.sell} onPress={() => skipSetup(s)} />
        </View>
      </View>
    );
  };
  const clear = sigs.length > 0 && <Pressable onPress={() => confirmAction('Clear all setups?', 'Setups that are still waiting will be removed. Trades you already took are not touched.', clearSignals, 'Clear')} style={{ cursor: 'pointer' } as any}><Text style={{ color: th.sell, fontSize: 12.5, fontWeight: '700' }}>Clear all</Text></Pressable>;

  // ---- live table
  const liveCols: Col[] = [{ label: 'Symbol', flex: 1.5 }, { label: 'Direction', flex: 0.9 }, { label: 'Entry', flex: 1, align: 'right' }, { label: 'Current', flex: 1, align: 'right' }, { label: 'P&L', flex: 1, align: 'right' }, { label: 'R', flex: 0.8, align: 'right' }, { label: 'Duration', flex: 1 }, { label: 'Setup', flex: 1 }, { label: '', flex: 2.1 }];
  const liveRow = (s: Signal) => {
    const f = (v: number) => v.toFixed(s.dec), price = px(s.symId), run = s.status === 'open';
    const r = run && price ? totalR(s, price) : null, pnl = run ? (price ? (1 - s.done) * floatR(s, price) * s.risk + s.banked * s.risk : null) : null;
    const c = (pnl ?? 0) >= 0 ? th.buy : th.sell;
    return (
      <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: P.border }}>
        <Cell flex={1.5}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Coin s={symOf(s.symId)} size={26} /><Text style={{ color: P.head, fontSize: 12.5, fontWeight: '700' }} numberOfLines={1}>{s.name}</Text></View></Cell>
        <Cell flex={0.9}><SideChip side={s.side} /></Cell>
        <Cell flex={1} align="right"><Text style={{ color: P.head, fontSize: 12.5, fontVariant: ['tabular-nums'] }}>{f(s.fill ?? s.entry)}</Text></Cell>
        <Cell flex={1} align="right"><Text style={{ color: P.head, fontSize: 12.5, fontVariant: ['tabular-nums'] }}>{price ? f(price) : '…'}</Text></Cell>
        <Cell flex={1} align="right"><Text style={{ color: pnl === null ? P.body : c, fontSize: 12.5, fontWeight: '800' }}>{pnl === null ? 'Pending' : money(pnl)}</Text></Cell>
        <Cell flex={0.8} align="right"><Text style={{ color: r === null ? P.body : r >= 0 ? th.buy : th.sell, fontSize: 12.5 }}>{r === null ? '—' : fmtR(r)}</Text></Cell>
        <Cell flex={1}><Text style={{ color: P.body, fontSize: 12 }}>{run ? dur(s.filledAt ?? s.date, Date.now()) : '—'}</Text></Cell>
        <Cell flex={1}><Text style={{ color: P.head, fontSize: 12 }} numberOfLines={1}>{methodOf(s.source)}</Text></Cell>
        <Cell flex={2.1}>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {run ? (
              <>
                <Btn2 label={s.tpAlert ? `TP${s.tpAlert}: decide` : 'Manage'} onPress={() => onManage(s.id)} tone={s.tpAlert ? th.gold : undefined} />
                <Btn2 label={stopAtBE(s) ? 'BE set' : 'Break-even'} disabled={stopAtBE(s) || !price} onPress={() => { const e = breakEven(s.id, price); if (e) toast(e, 'bad'); }} />
                <Btn2 label="Close" tone={th.sell} disabled={!price} onPress={() => closeSignal(s.id, price!)} />
              </>
            ) : <Btn2 label="Cancel order" tone={th.sell} onPress={() => skipSetup(s)} />}
          </View>
        </Cell>
      </View>
    );
  };

  // ---- closed table
  const closedCols: Col[] = [{ label: 'Symbol', flex: 1.5 }, { label: 'Direction', flex: 0.9 }, { label: 'Entry', flex: 1, align: 'right' }, { label: 'Exit', flex: 1, align: 'right' }, { label: 'P&L', flex: 1, align: 'right' }, { label: 'R', flex: 0.8, align: 'right' }, { label: 'Duration', flex: 1 }, { label: 'Setup', flex: 1 }, { label: 'Date', flex: 1.2 }, { label: 'Review', flex: 1.4 }, { label: '', flex: 0.4 }];
  const closedRow = (j: Trade) => {
    const dec = j.dec ?? (j.entry >= 100 ? 2 : 5), f = (v: number) => v.toFixed(dec), c = j.pnl >= 0 ? th.buy : th.sell;
    return (
      <View key={j.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: P.border, zIndex: 1 }}>
        <Cell flex={1.5}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{j.symId ? <Coin s={symOf(j.symId)} size={26} /> : null}<Text style={{ color: P.head, fontSize: 12.5, fontWeight: '700' }} numberOfLines={1}>{j.symbol}</Text></View></Cell>
        <Cell flex={0.9}><SideChip side={j.side} /></Cell>
        <Cell flex={1} align="right"><Text style={{ color: P.head, fontSize: 12.5, fontVariant: ['tabular-nums'] }}>{f(j.entry)}</Text></Cell>
        <Cell flex={1} align="right"><Text style={{ color: P.head, fontSize: 12.5, fontVariant: ['tabular-nums'] }}>{f(j.exit)}</Text></Cell>
        <Cell flex={1} align="right"><Text style={{ color: c, fontSize: 12.5, fontWeight: '800' }}>{money(j.pnl)}</Text></Cell>
        <Cell flex={0.8} align="right"><Text style={{ color: j.r === undefined ? P.body : c, fontSize: 12.5 }}>{j.r === undefined ? '—' : fmtR(j.r)}</Text></Cell>
        <Cell flex={1}><Text style={{ color: P.body, fontSize: 12 }}>{dur(j.openedAt, j.date)}</Text></Cell>
        <Cell flex={1}><Text style={{ color: P.head, fontSize: 12 }} numberOfLines={1}>{methodOf(j.source)}</Text></Cell>
        <Cell flex={1.2}><Text style={{ color: P.body, fontSize: 11.5 }}>{dt(j.date)}</Text></Cell>
        <Cell flex={1.4}><Select value={j.tag ?? ''} options={[['', 'Add tag'], ...TAGS.map((t) => [t, t] as [string, string])]} onChange={(t) => updateTrade(j.id, { tag: t || undefined })} width={120} /></Cell>
        <Cell flex={0.4} align="right"><Pressable onPress={() => confirmAction('Delete this trade?', 'It is removed from your journal and your performance numbers. This cannot be undone.', () => removeTrade(j.id))} hitSlop={8} style={{ cursor: 'pointer' } as any}><Icon name="trash-outline" size={15} color={P.body} /></Pressable></Cell>
      </View>
    );
  };

  const more = (total: number) => total > limit && <View style={{ alignItems: 'center', paddingTop: 6 }}><Btn ghost arrow={false} label={`Show more (${total - limit} left)`} onPress={() => setLimit(limit + 8)} /></View>;
  const main = (
    <Panel style={{ padding: 20, gap: 14, zIndex: 5 }}>
      {view === 'signals' && <Head icon="radio-outline" title="Recent Signals" sub={`${shownSigs.length} signals`} right={clear || undefined} />}
      {view === 'open' && <Head icon="pulse-outline" title="Live Trades" sub={`${live.length} active`} />}
      {view === 'closed' && <Head icon="checkmark-done-outline" title="Closed Trades" sub={`${shownClosed.length} of ${n}`} right={<View style={{ flexDirection: 'row', gap: 8 }}><Btn2 label="Trade history" icon="receipt-outline" onPress={() => setHistOpen(true)} />{n > 0 && <Btn2 label="Export CSV" icon="share-outline" onPress={exportCsv} />}</View>} />}
      {view === 'insights' && <Head icon="analytics-outline" title="Insights & Analytics" />}
      {filters}
      {view === 'signals' && (
        <View style={{ gap: 10 }}>
          {!desk.autoLog && <View style={{ padding: 12, borderRadius: 10, borderWidth: 1, borderColor: th.gold + '88', backgroundColor: th.gold + '14' }}><Text style={{ color: P.head, fontSize: 12.5 }}>Auto-log is off. Turn it on in the settings on the right to receive setups.</Text></View>}
          {shownSigs.length === 0 && <Empty icon="radio-outline" title={sigs.length ? 'No signals match your filters' : 'Waiting for setups'} text={sigs.length ? 'Change or clear a filter to see them.' : `Open Analysis (Scanner, Top-Down, ICT, SMC, VSA, candlesticks, scalping). Any setup scoring ${desk.minScore}+ is saved here with its entry, stop and targets.`}>
            {!sigs.length && <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}><Btn2 label="Open Analysis" solid onPress={() => setTab(1)} /><Btn2 label="Open Scanner" onPress={() => setTab(12)} /></View>}
          </Empty>}
          {shownSigs.slice(0, limit).map(sigRow)}
          {more(shownSigs.length)}
        </View>
      )}
      {view === 'open' && (
        shownLive.length === 0 ? <Empty icon="pulse-outline" title="No live trades" text="When you take a signal it shows here with the live result, take-profit progress and a break-even stop." /> : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={{ minWidth: 860, flex: 1 }}><Th cols={liveCols} />{shownLive.slice(0, limit).map(liveRow)}</View></ScrollView>
        )
      )}
      {view === 'closed' && (
        shownClosed.length === 0 ? <Empty icon="checkmark-done-outline" title={n ? 'No trades match your filters' : 'No closed trades yet'} text={n ? 'Change or clear a filter to see them.' : 'Finished trades are written here automatically with their result in R and money.'} /> : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={{ minWidth: 1080, flex: 1 }}><Th cols={closedCols} />{shownClosed.slice(0, limit).map(closedRow)}</View></ScrollView>
            {more(shownClosed.length)}
          </>
        )
      )}
      {view === 'insights' && <Insights journal={journal} desk={desk} running={running.length} today={today} />}
    </Panel>
  );

  // ---- right column
  const byMeth = (() => { const m: Record<string, { n: number; pnl: number }> = {}; journal.forEach((j) => { const e = (m[methodOf(j.source)] ??= { n: 0, pnl: 0 }); e.n++; e.pnl += j.pnl; }); return Object.entries(m).sort((a, b) => b[1].pnl - a[1].pnl).slice(0, 7); })();
  const mmax = Math.max(1e-9, ...byMeth.map(([, v]) => Math.abs(v.pnl)));
  let best = 0, cur = 0; [...journal].sort((a, b) => a.date - b.date).forEach((j) => { cur = j.pnl > 0 ? cur + 1 : 0; best = Math.max(best, cur); });
  const followed = journal.filter((j) => j.tag === 'Followed plan').length, reviewed = journal.filter((j) => j.tag).length, score = reviewed ? Math.round((followed / reviewed) * 100) : null;
  const tip = TIPS[Math.floor(Date.now() / dayMs) % TIPS.length];
  const right = (
    <View style={{ width: two ? 340 : '100%', gap: 20 }}>
      <Panel style={{ padding: 20, gap: 10 }}>
        <Head icon="shield-checkmark" title="Risk & Equity Configuration" />
        <Text style={{ color: P.body, fontSize: 12.5 }}>Risk per trade: <Text style={{ color: P.head, fontWeight: '700' }}>{desk.riskPct > 0 ? `${desk.riskPct}%` : 'not set'}</Text></Text>
        <Text style={{ color: P.body, fontSize: 12.5 }}>Account equity: <Text style={{ color: P.head, fontWeight: '700' }}>{bal > 0 ? `$${equity.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}` : 'not set'}</Text></Text>
        {floating !== 0 && <Text style={{ color: P.body, fontSize: 11.5 }}>Includes {money(floating)} floating.</Text>}
        <Btn2 label={showSet ? 'Close Settings' : 'Update Settings'} onPress={toggleSet} />
        {showSet && settings}
      </Panel>
      <Sessions go={(t) => go(t)} style={{ flex: 0, minWidth: 0, padding: 20 }} />
      <Panel style={{ padding: 20, gap: 10 }}>
        <Head icon="water" title="Journal Discipline" />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View><Text style={{ color: P.body, fontSize: 11.5 }}>Current win streak</Text><Text style={{ color: P.head, fontSize: 20, fontWeight: '800' }}>{cur} trade{cur === 1 ? '' : 's'}</Text></View>
          <View style={{ alignItems: 'flex-end' }}><Text style={{ color: P.body, fontSize: 11.5 }}>Best streak</Text><Text style={{ color: P.head, fontSize: 20, fontWeight: '800' }}>{best} trade{best === 1 ? '' : 's'}</Text></View>
        </View>
        <View style={{ height: 7, borderRadius: 4, backgroundColor: P.alt, overflow: 'hidden' }}><View style={{ width: `${score ?? 0}%`, height: 7, backgroundColor: th.buy } as any} /></View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: P.body, fontSize: 11.5 }}>Followed-plan score</Text><Text style={{ color: th.buy, fontSize: 12, fontWeight: '800' }}>{score === null ? '—' : `${score}%`}</Text></View>
        {score === null && <Text style={{ color: P.body, fontSize: 11, lineHeight: 15 }}>Tag closed trades (for example “Followed plan”) in the Closed tab to build this score.</Text>}
      </Panel>
      <Panel style={{ padding: 20, gap: 10 }}>
        <Head icon="stats-chart" title="Performance by Strategy" />
        {byMeth.length === 0 && <Text style={{ color: P.body, fontSize: 12.5 }}>Closed trades will appear here by strategy.</Text>}
        {byMeth.map(([k, v]) => (
          <View key={k} style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row' }}><Text style={{ flex: 1, color: P.head, fontSize: 12.5, fontWeight: '600' }} numberOfLines={1}>{k} <Text style={{ color: P.body, fontWeight: '400' }}>· {v.n}</Text></Text><Text style={{ color: v.pnl >= 0 ? th.buy : th.sell, fontSize: 12, fontWeight: '800' }}>{money(v.pnl)}</Text></View>
            <View style={{ height: 5, borderRadius: 3, backgroundColor: P.alt, overflow: 'hidden' }}><View style={{ width: `${(Math.abs(v.pnl) / mmax) * 100}%`, height: 5, backgroundColor: v.pnl >= 0 ? th.buy : th.sell } as any} /></View>
          </View>
        ))}
      </Panel>
      <Sentiment active={active} />
      <Panel style={{ padding: 20, gap: 8 }}>
        <Head icon="bulb-outline" title="Trading Tip" />
        <Text style={{ color: P.body, fontSize: 12.5, lineHeight: 18 }}>{tip}</Text>
      </Panel>
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: P.alt, display: active ? 'flex' : 'none' } as any} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
      <View style={{ width: '100%', maxWidth: 1360, alignSelf: 'center', paddingHorizontal: 32, paddingTop: 22, paddingBottom: 30, gap: 22 }}>
        <HeroBanner icon="book" tag="Journal / Trading Tools" title="Trading Journal" subtitle="Track every setup from scanner to outcome. Improve your strategy, find strengths, fix mistakes and grow consistently." />
        <GuardBanner />
        <View style={{ flexDirection: two ? 'row' : 'column', gap: 22, alignItems: 'flex-start' }}>
          <View style={{ flex: 1, minWidth: 0, width: '100%', gap: 20 }}>{overview}{tabs}{main}</View>
          {right}
        </View>
        <LinearGradient colors={['#0A55E0', '#1F7AF0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flexDirection: w >= 760 ? 'row' : 'column', alignItems: w >= 760 ? 'center' : 'flex-start', gap: 16, padding: 18, borderRadius: 14 }}>
          <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFFFFF2A', alignItems: 'center', justifyContent: 'center' }}><Icon name="book" size={22} color="#FFFFFF" /></View>
          <View style={{ flex: 1 }}><Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>Refine Your Setups. Trade Smarter.</Text><Text style={{ color: '#EAF2FFDD', fontSize: 12.5, marginTop: 2 }}>Use your journal insights to improve your strategy, reduce mistakes and grow consistently.</Text></View>
          <Btn label="Open Analysis" onPress={() => setTab(1)} />
        </LinearGradient>
        <Text style={{ color: P.body, fontSize: 11.5 }}>Paper trading on live prices. Results are a study tool, not financial advice.</Text>
      </View>
      <Footer w={w} go={go} />
    </ScrollView>
  );
}
