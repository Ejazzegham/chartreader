import React, { useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import Svg, { Polyline, Path, Line, Circle, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg';
import { useApp } from './store';
import { Icon, confirmAction } from './ui';
import { DemoAcct, DemoStats, LEVERAGES, START_PRESETS, MIN_START, MAX_START, parseStart, fmtPF, fmtHold } from './demoAccount';

// DEMO ACCOUNT section of the Demo Trade page: a KPI strip (AccountStrip) and a tabbed panel (DemoAccountPanel):
// Overview (account information, equity curve, win / loss ring), Performance (every statistic), By Symbol, Settings (name, size, leverage, reset).
// All numbers are passed in from ManualTradeDesk.web.tsx; the maths lives in src/demoAccount.ts.
export type AccountNums = { balance: number; equity: number; floatTotal: number; used: number; free: number; level: number; open: number };
const usd = (n: number, sign = true) => `${n < 0 ? '-' : sign && n > 0 ? '+' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number, sign = false) => `${sign && n > 0 ? '+' : ''}${n.toFixed(2)}%`;
const hand: any = { cursor: 'pointer' };

function usePalette() {
  const { th } = useApp(), d = th.dark;
  return { th, card: d ? th.panel : '#FFFFFF', border: d ? th.line : '#E8EDF6', soft: d ? th.panel2 : '#F5F8FE', ink: d ? th.text : '#0B1B3F', dim: th.dim, up: th.buy, down: th.sell };
}
type Pal = ReturnType<typeof usePalette>;
const cardSt = (P: Pal) => ({ backgroundColor: P.card, borderRadius: 16, borderWidth: 1, borderColor: P.border, shadowColor: '#0B1B3F', shadowOpacity: 0.05, shadowRadius: 18, shadowOffset: { width: 0, height: 6 } } as any);
const tone = (P: Pal, n: number) => (n > 0 ? P.up : n < 0 ? P.down : P.ink);

function Tile({ P, icon, label, value, sub, color, w }: { P: Pal; icon: string; label: string; value: string; sub?: string; color?: string; w: string }) {
  return (
    <View style={{ ...cardSt(P), flexGrow: 1, flexBasis: w, minWidth: 0, padding: 16, gap: 6 } as any}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: P.th.accent + '1A', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={15} color={P.th.accent} /></View>
        <Text style={{ color: P.dim, fontSize: 12, fontWeight: '700', flex: 1 }} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={{ color: color ?? P.ink, fontSize: 21, fontWeight: '900', letterSpacing: -0.4 }} numberOfLines={1}>{value}</Text>
      {!!sub && <Text style={{ color: P.dim, fontSize: 11.5 }} numberOfLines={1}>{sub}</Text>}
    </View>
  );
}

/** the six numbers that matter, right under the hero */
export function AccountStrip({ acct, s, a, w }: { acct: DemoAcct; s: DemoStats; a: AccountNums; w: number }) {
  const P = usePalette(), basis = w >= 1100 ? '15%' : w >= 700 ? '31%' : '47%';
  const total = a.equity - acct.start;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
      <Tile P={P} w={basis} icon="wallet-outline" label="Account Balance" value={money(a.balance)} sub={`Started with ${money(acct.start)}`} />
      <Tile P={P} w={basis} icon="speedometer-outline" label="Equity" value={money(a.equity)} sub={`${pct((total / acct.start) * 100, true)} since start`} color={tone(P, total)} />
      <Tile P={P} w={basis} icon="pulse-outline" label="Floating P/L" value={usd(a.floatTotal, false)} sub={`${a.open} open position${a.open === 1 ? '' : 's'}`} color={tone(P, a.floatTotal)} />
      <Tile P={P} w={basis} icon="trending-up" label="Net Profit / Loss" value={usd(s.net)} sub={`Today ${usd(s.today)}`} color={tone(P, s.net)} />
      <Tile P={P} w={basis} icon="trophy-outline" label="Win Rate" value={s.n ? pct(s.winRate) : '-'} sub={s.n ? `${s.wins} won · ${s.losses} lost` : 'No closed trades yet'} color={s.n ? (s.winRate >= 50 ? P.up : P.down) : undefined} />
      <Tile P={P} w={basis} icon="analytics-outline" label="Profit Factor" value={fmtPF(s.profitFactor, s.n)} sub={s.n ? `Payoff ${s.payoff ? s.payoff.toFixed(2) : '-'}` : 'Gross win ÷ gross loss'} color={s.n ? (s.profitFactor >= 1 ? P.up : P.down) : undefined} />
    </View>
  );
}

const TABS = [{ k: 'overview', l: 'Overview', i: 'grid-outline' }, { k: 'perf', l: 'Performance', i: 'analytics-outline' }, { k: 'sym', l: 'By Symbol', i: 'list-outline' }, { k: 'set', l: 'Settings', i: 'settings-outline' }] as const;
type TabK = typeof TABS[number]['k'];

function Row({ P, k, v, c, last }: { P: Pal; k: string; v: string; c?: string; last?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 11, paddingHorizontal: 4, borderBottomWidth: last ? 0 : 1, borderBottomColor: P.border }}>
      <Text style={{ color: P.dim, fontSize: 13 }}>{k}</Text><Text style={{ color: c ?? P.ink, fontSize: 13.5, fontWeight: '800', flexShrink: 1, textAlign: 'right' }}>{v}</Text>
    </View>
  );
}
function Group({ P, title, children, flex = 1 }: { P: Pal; title: string; children: React.ReactNode; flex?: number }) {
  return (
    <View style={{ flexGrow: flex, flexBasis: 300, minWidth: 0, borderRadius: 12, borderWidth: 1, borderColor: P.border, backgroundColor: P.card, padding: 14 }}>
      <Text style={{ color: P.ink, fontSize: 13.5, fontWeight: '900', marginBottom: 4 }}>{title}</Text>{children}
    </View>
  );
}

function EquityChart({ P, data, start, w }: { P: Pal; data: number[]; start: number; w: number }) {
  const h = 190, lo = Math.min(...data, start), hi = Math.max(...data, start), span = hi - lo || 1, padY = 14;
  const y = (v: number) => h - padY - ((v - lo) / span) * (h - padY * 2);
  const pts = data.map((v, i) => [data.length > 1 ? (i / (data.length - 1)) * w : 0, y(v)]);
  const line = pts.map((p) => p.join(',')).join(' '), area = `M0,${h} L${pts.map((p) => p.join(',')).join(' L')} L${w},${h} Z`;
  const up = data[data.length - 1] >= start, c = up ? P.up : P.down;
  return (
    <Svg width="100%" height={h} viewBox={`0 0 ${Math.max(w, 10)} ${h}`}>
      <Defs><SvgGrad id="eqg" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={c} stopOpacity="0.25" /><Stop offset="1" stopColor={c} stopOpacity="0" /></SvgGrad></Defs>
      <Line x1={0} x2={w} y1={y(start)} y2={y(start)} stroke={P.dim} strokeWidth={1} strokeDasharray="5 5" opacity={0.6} />
      <Path d={area} fill="url(#eqg)" /><Polyline points={line} fill="none" stroke={c} strokeWidth={2.2} />
    </Svg>
  );
}
function Ring({ P, s, size = 150 }: { P: Pal; s: DemoStats; size?: number }) {
  const r = size / 2 - 12, C = 2 * Math.PI * r, tot = s.n || 1;
  const seg = [{ v: s.wins, c: P.up }, { v: s.even, c: P.dim }, { v: s.losses, c: P.down }];
  let off = 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={P.border} strokeWidth={14} fill="none" />
        {s.n > 0 && seg.map((x, i) => { if (!x.v) return null; const len = (x.v / tot) * C, el = <Circle key={i} cx={size / 2} cy={size / 2} r={r} stroke={x.c} strokeWidth={14} fill="none" strokeDasharray={`${Math.max(len - 2, 0)} ${C}`} strokeDashoffset={-off} rotation={-90} origin={`${size / 2},${size / 2}`} />; off += len; return el; })}
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}><Text style={{ color: P.ink, fontSize: 24, fontWeight: '900' }}>{s.n ? `${s.winRate.toFixed(0)}%` : '-'}</Text><Text style={{ color: P.dim, fontSize: 11.5 }}>Win rate</Text></View>
    </View>
  );
}
const Dot = ({ c, t, v }: { c: string; t: string; v: string }) => <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: c }} /><Text style={{ color: '#7C8AA8', fontSize: 12.5, flex: 1 }}>{t}</Text><Text style={{ fontSize: 12.5, fontWeight: '800', color: c === '#7C8AA8' ? '#7C8AA8' : c }}>{v}</Text></View>;

export default function DemoAccountPanel({ acct, setAcct, s, a, w, onReset }: { acct: DemoAcct; setAcct: (p: Partial<DemoAcct>) => void; s: DemoStats; a: AccountNums; w: number; onReset: (start: number) => void }) {
  const P = usePalette(), th = P.th;
  const [tab, setTab] = useState<TabK>('overview'), [chartW, setChartW] = useState(600), [custom, setCustom] = useState(''), [name, setName] = useState(acct.name);
  const two = w >= 900;
  const since = acct.resetAt ? new Date(acct.resetAt) : new Date(acct.createdAt);
  const day = (d: Date) => d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const total = a.equity - acct.start;
  const stop = a.used > 0 && a.level < 100;
  const status = a.used === 0 ? { t: 'No open risk', c: P.dim } : a.level >= 200 ? { t: 'Healthy', c: P.up } : a.level >= 100 ? { t: 'Caution', c: th.gold } : { t: 'Margin call', c: P.down };
  const customV = parseStart(custom);
  const apply = (v: number) => confirmAction('Reset demo account', `The balance goes back to ${money(v)} and the statistics start from zero. Your old trades stay in the Journal and Trade history.`, () => { onReset(v); setCustom(''); }, 'Reset');

  const chip = (label: string, on: boolean, f: () => void, key?: string) => (
    <Pressable key={key ?? label} onPress={f} accessibilityRole="button" accessibilityState={{ selected: on }} style={((x: any) => ({ height: 36, paddingHorizontal: 14, borderRadius: 10, justifyContent: 'center', borderWidth: 1, borderColor: on ? th.accent : P.border, backgroundColor: on ? th.accent : x.hovered ? th.accent + '14' : P.soft, ...hand })) as any}>
      <Text style={{ color: on ? th.onAccent : P.ink, fontSize: 13, fontWeight: on ? '800' : '600' }}>{label}</Text>
    </Pressable>
  );
  const bigStat = (label: string, value: string, c?: string, sub?: string) => (
    <View key={label} style={{ flexGrow: 1, flexBasis: w >= 900 ? '23%' : w >= 560 ? '31%' : '47%', minWidth: 0, padding: 14, borderRadius: 12, backgroundColor: P.soft, gap: 3 }}>
      <Text style={{ color: P.dim, fontSize: 11.5, fontWeight: '700' }} numberOfLines={1}>{label}</Text>
      <Text style={{ color: c ?? P.ink, fontSize: 17, fontWeight: '900' }} numberOfLines={1}>{value}</Text>
      {!!sub && <Text style={{ color: P.dim, fontSize: 11 }} numberOfLines={1}>{sub}</Text>}
    </View>
  );
  const sideRow = (label: string, x: { n: number; wins: number; net: number }) => <Row key={label} P={P} k={`${label} · ${x.n} trade${x.n === 1 ? '' : 's'}`} v={x.n ? `${((x.wins / x.n) * 100).toFixed(0)}% win · ${usd(x.net)}` : '-'} c={x.n ? tone(P, x.net) : P.dim} />;

  return (
    <View style={{ ...cardSt(P), padding: 16, gap: 16 } as any}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: th.accent + '1A', alignItems: 'center', justifyContent: 'center' }}><Icon name="person-circle-outline" size={22} color={th.accent} /></View>
        <View style={{ flex: 1, minWidth: 180 }}><Text accessibilityRole="header" style={{ color: P.ink, fontSize: 16, fontWeight: '900' }}>{acct.name}</Text><Text style={{ color: P.dim, fontSize: 12 }}>Virtual money · Account #{acct.id} · 1:{acct.leverage}</Text></View>
        <View style={{ paddingHorizontal: 10, height: 26, borderRadius: 13, justifyContent: 'center', backgroundColor: th.gold + '22' }}><Text style={{ color: th.gold, fontSize: 11.5, fontWeight: '900' }}>DEMO</Text></View>
      </View>
      <View style={{ flexDirection: 'row', gap: 4, padding: 4, borderRadius: 12, backgroundColor: P.soft, alignSelf: 'stretch', flexWrap: 'wrap' }} accessibilityRole={'tablist' as any}>
        {TABS.map((x) => { const on = tab === x.k; return (
          <Pressable key={x.k} onPress={() => setTab(x.k)} accessibilityRole={'tab' as any} accessibilityState={{ selected: on }} style={((h: any) => ({ flexGrow: 1, minWidth: 110, height: 38, borderRadius: 9, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? th.accent : h.hovered ? th.accent + '14' : 'transparent', ...hand })) as any}>
            <Icon name={x.i} size={15} color={on ? th.onAccent : P.dim} /><Text style={{ color: on ? th.onAccent : P.dim, fontSize: 13, fontWeight: '800' }}>{x.l}</Text>
          </Pressable>); })}
      </View>

      {tab === 'overview' && (
        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: 'stretch' }}>
            <Group P={P} title="Account Information">
              <Row P={P} k="Account type" v="Demo (paper money)" /><Row P={P} k="Account number" v={`#${acct.id}`} /><Row P={P} k="Currency" v="USD" />
              <Row P={P} k="Leverage" v={`1:${acct.leverage}`} /><Row P={P} k="Opened" v={day(new Date(acct.createdAt))} /><Row P={P} k="Statistics since" v={day(since)} />
              <Row P={P} k="Starting balance" v={money(acct.start)} last />
            </Group>
            <Group P={P} title="Balance & Margin">
              <Row P={P} k="Balance" v={money(a.balance)} /><Row P={P} k="Equity" v={money(a.equity)} c={tone(P, total)} /><Row P={P} k="Floating P/L" v={usd(a.floatTotal, false)} c={tone(P, a.floatTotal)} />
              <Row P={P} k="Used margin" v={money(a.used)} /><Row P={P} k="Free margin" v={money(a.free)} c={a.free < 0 ? P.down : undefined} />
              <Row P={P} k="Margin level" v={a.used > 0 ? pct(a.level) : '-'} c={a.used > 0 ? (stop ? P.down : P.up) : P.dim} /><Row P={P} k="Account health" v={status.t} c={status.c} last />
            </Group>
          </View>
          <View style={{ flexDirection: two ? 'row' : 'column', gap: 14 }}>
            <View style={{ flex: two ? 2 : undefined, minWidth: 0, borderRadius: 12, borderWidth: 1, borderColor: P.border, backgroundColor: P.card, padding: 14, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={{ color: P.ink, fontSize: 13.5, fontWeight: '900' }}>Equity Curve</Text><Text style={{ color: tone(P, total), fontSize: 13, fontWeight: '800' }}>{usd(total)} ({pct((total / acct.start) * 100, true)})</Text></View>
              <View onLayout={(e) => setChartW(Math.round(e.nativeEvent.layout.width))}><EquityChart P={P} data={[...s.curve.slice(0, -1), a.equity]} start={acct.start} w={chartW} /></View>
              <Text style={{ color: P.dim, fontSize: 11.5 }}>Dashed line = starting balance. Each point is a closed trade; the last point is your equity now.</Text>
            </View>
            <View style={{ flex: two ? 1 : undefined, minWidth: 0, borderRadius: 12, borderWidth: 1, borderColor: P.border, backgroundColor: P.card, padding: 14, gap: 12, alignItems: 'center' }}>
              <Text style={{ color: P.ink, fontSize: 13.5, fontWeight: '900', alignSelf: 'flex-start' }}>Win / Loss</Text>
              <Ring P={P} s={s} />
              <View style={{ alignSelf: 'stretch', gap: 6 }}><Dot c={P.up} t="Winning trades" v={String(s.wins)} /><Dot c={P.down} t="Losing trades" v={String(s.losses)} /><Dot c="#7C8AA8" t="Break-even" v={String(s.even)} /></View>
            </View>
          </View>
        </View>
      )}

      {tab === 'perf' && (
        <View style={{ gap: 14 }}>
          {s.n === 0 && <Text style={{ color: P.dim, fontSize: 13, textAlign: 'center', paddingVertical: 10 }}>No closed demo trades since {day(since)}. Statistics appear after your first closed trade.</Text>}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {bigStat('Total trades', String(s.n))}{bigStat('Win rate', s.n ? pct(s.winRate) : '-', s.n ? (s.winRate >= 50 ? P.up : P.down) : undefined, `${s.wins} winners`)}{bigStat('Loss rate', s.n ? pct(s.lossRate) : '-', undefined, `${s.losses} losers`)}{bigStat('Win : Loss', s.n ? `${s.wins} : ${s.losses}` : '-', undefined, s.losses ? `${(s.wins / s.losses).toFixed(2)} wins per loss` : undefined)}
            {bigStat('Net profit', usd(s.net), tone(P, s.net), pct(s.returnPct, true))}{bigStat('Gross profit', usd(s.grossWin), s.grossWin ? P.up : undefined)}{bigStat('Gross loss', s.grossLoss ? usd(-s.grossLoss) : '$0.00', s.grossLoss ? P.down : undefined)}{bigStat('Profit factor', fmtPF(s.profitFactor, s.n), s.n ? (s.profitFactor >= 1 ? P.up : P.down) : undefined, 'Gross win ÷ gross loss')}
            {bigStat('Average win', s.wins ? usd(s.avgWin) : '-', s.wins ? P.up : undefined)}{bigStat('Average loss', s.losses ? usd(-s.avgLoss) : '-', s.losses ? P.down : undefined)}{bigStat('Payoff ratio', s.payoff ? s.payoff.toFixed(2) : '-', undefined, 'Avg win ÷ avg loss')}{bigStat('Expectancy', s.n ? usd(s.expectancy) : '-', s.n ? tone(P, s.expectancy) : undefined, 'Average per trade')}
            {bigStat('Largest win', s.best > 0 ? usd(s.best) : '-', s.best > 0 ? P.up : undefined)}{bigStat('Largest loss', s.worst < 0 ? usd(s.worst) : '-', s.worst < 0 ? P.down : undefined)}{bigStat('Max drawdown', s.maxDD ? `-${money(s.maxDD)}` : '$0.00', s.maxDD ? P.down : undefined, s.maxDD ? `${s.maxDDPct.toFixed(2)}% from peak` : undefined)}{bigStat('Avg hold time', fmtHold(s.avgHoldMs))}
            {bigStat('Best win streak', String(s.maxWinStreak))}{bigStat('Worst loss streak', String(s.maxLossStreak))}{bigStat('Current streak', s.streak === 0 ? '-' : s.streak > 0 ? `${s.streak} win${s.streak > 1 ? 's' : ''}` : `${-s.streak} loss${s.streak < -1 ? 'es' : ''}`, tone(P, s.streak))}{bigStat('Return', pct(s.returnPct, true), tone(P, s.returnPct), 'On starting balance')}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            <Group P={P} title="Profit & Loss by Period"><Row P={P} k="Today" v={usd(s.today)} c={tone(P, s.today)} /><Row P={P} k="Last 7 days" v={usd(s.week)} c={tone(P, s.week)} /><Row P={P} k="This month" v={usd(s.month)} c={tone(P, s.month)} /><Row P={P} k="Since reset" v={usd(s.net)} c={tone(P, s.net)} last /></Group>
            <Group P={P} title="Buy vs Sell">{sideRow('Buy', s.buy)}{sideRow('Sell', s.sell)}</Group>
          </View>
        </View>
      )}

      {tab === 'sym' && (
        <View style={{ borderRadius: 12, borderWidth: 1, borderColor: P.border, overflow: 'hidden', backgroundColor: P.card }}>
          <View style={{ flexDirection: 'row', backgroundColor: P.soft, paddingVertical: 10, paddingHorizontal: 14 }}>
            {['Symbol', 'Trades', 'Win rate', 'Net P/L'].map((h, i) => <Text key={h} style={{ flex: i === 0 ? 1.4 : 1, color: P.dim, fontSize: 11.5, fontWeight: '800', textAlign: i === 0 ? 'left' : 'right' }}>{h}</Text>)}
          </View>
          {s.bySymbol.length === 0 && <Text style={{ color: P.dim, fontSize: 13, textAlign: 'center', padding: 24 }}>Closed trades by symbol appear here.</Text>}
          {s.bySymbol.map((x) => (
            <View key={x.symbol} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: P.border }}>
              <Text style={{ flex: 1.4, color: P.ink, fontSize: 13.5, fontWeight: '800' }} numberOfLines={1}>{x.symbol}</Text>
              <Text style={{ flex: 1, color: P.ink, fontSize: 13, textAlign: 'right' }}>{x.n}</Text>
              <Text style={{ flex: 1, color: P.ink, fontSize: 13, textAlign: 'right' }}>{((x.wins / x.n) * 100).toFixed(0)}%</Text>
              <Text style={{ flex: 1, color: tone(P, x.net), fontSize: 13, fontWeight: '800', textAlign: 'right' }}>{usd(x.net)}</Text>
            </View>
          ))}
        </View>
      )}

      {tab === 'set' && (
        <View style={{ gap: 14 }}>
          <Group P={P} title="Account name">
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, alignItems: 'center' }}>
              <TextInput value={name} onChangeText={(v) => setName(v.slice(0, 30))} onBlur={() => setAcct({ name })} placeholder="Demo Account" placeholderTextColor={P.dim} accessibilityLabel="Account name" style={{ flex: 1, height: 42, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: P.border, color: P.ink, fontSize: 14, outlineStyle: 'none' } as any} />
              {chip('Save', false, () => setAcct({ name }), 'save-name')}
            </View>
          </Group>
          <Group P={P} title="Leverage">
            <Text style={{ color: P.dim, fontSize: 12.5, lineHeight: 18, marginVertical: 6 }}>Higher leverage needs less margin per trade but makes it easier to run out of free margin. It changes the margin numbers only, not your profit or loss per lot.</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{LEVERAGES.map((l) => chip(`1:${l}`, acct.leverage === l, () => setAcct({ leverage: l })))}</View>
          </Group>
          <Group P={P} title="Account size & reset">
            <Text style={{ color: P.dim, fontSize: 12.5, lineHeight: 18, marginVertical: 6 }}>Pick a new starting balance and reset. Statistics start again from zero; your old trades stay in the Journal and Trade history. Close open positions first.</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{START_PRESETS.map((v) => chip(money(v).replace('.00', ''), false, () => apply(v)))}</View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextInput value={custom} onChangeText={(v) => setCustom(v.replace(/[^0-9.,]/g, '').slice(0, 10))} placeholder={`Custom ($${MIN_START.toLocaleString('en-US')} to $${MAX_START.toLocaleString('en-US')})`} placeholderTextColor={P.dim} accessibilityLabel="Custom starting balance" style={{ flex: 1, minWidth: 200, height: 42, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: custom && !customV ? P.down : P.border, color: P.ink, fontSize: 14, outlineStyle: 'none' } as any} />
              <Pressable disabled={!customV} onPress={() => customV && apply(customV)} accessibilityRole="button" style={((x: any) => ({ height: 42, paddingHorizontal: 18, borderRadius: 10, justifyContent: 'center', backgroundColor: customV ? P.down : P.border, opacity: x.hovered && customV ? 0.9 : 1, ...hand })) as any}><Text style={{ color: customV ? '#FFFFFF' : P.dim, fontSize: 13.5, fontWeight: '800' }}>Reset account</Text></Pressable>
            </View>
          </Group>
          <View style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: th.gold + '66', backgroundColor: th.gold + '14' }}>
            <Icon name="information-circle-outline" size={20} color={th.gold} />
            <Text style={{ flex: 1, color: P.ink, fontSize: 12.5, lineHeight: 19 }}>This is a practice account with virtual money. Orders fill at the live price and no broker is involved, so real trading can differ (spreads, slippage, rejected orders). The account settings are saved on this device.</Text>
          </View>
        </View>
      )}
    </View>
  );
}
