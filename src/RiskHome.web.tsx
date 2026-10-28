import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Rect, Line, Circle, Path, Defs, LinearGradient as SG, Stop, Text as SText } from 'react-native-svg';
import { useApp } from './store';
import { Icon, HeroBanner } from './ui';
import { SYMBOLS, useFeed } from './markets';
import { useRealWindow } from './win';
import { usePal, Panel, Footer, useGo } from './DesktopHome.web';
import { Notices } from './Desktop.web';
import { perPoint, suggestLots, lotSpec, lotUnits, parseLots, lotsError, fmtLots } from './lots';
import { TP_SPLIT } from './gemini';

// The website's Risk & TP Planner, designed like the "Plan Your Trades with Confidence" mockup: hero, left tips rail, three
// numbered calculators (account and trade details, position size, trade plan) and a risk / reward analysis. Same maths as the phone screen,
// now in lots (pick the instrument so the contract size is right).
const num = (s: string) => parseFloat(String(s).replace(',', '.'));
const f = (n: number, d = 2) => n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
const RR_OPT = [1, 1.5, 2, 2.5, 3, 4, 5], RP_OPT = [0.25, 0.5, 1, 1.5, 2, 3, 5];
type Out = { side: 'buy' | 'sell'; amt: number; risk: number; dist: number; lots: number; units: number; dec: number; rows: { label: string; price: number; r: number; pct: number; lots: number; profit: number }[]; total: number; blended: number; be: number };

// ---------- inputs
function Dot() { const P = usePal(); return <View style={{ width: 5, height: 5, backgroundColor: P.blue, transform: [{ rotate: '45deg' }] }} />; }
function Label({ children }: { children: string }) { const P = usePal(); return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><Dot /><Text style={{ color: P.head, fontSize: 12.5, fontWeight: '700' }}>{children}</Text></View>; }

function Field({ label, icon, glyph, value, onChange, placeholder, onSubmit }: { label: string; icon?: string; glyph?: string; value: string; onChange: (v: string) => void; placeholder: string; onSubmit?: () => void }) {
  const P = usePal(), [on, setOn] = useState(false);
  return (
    <View style={{ gap: 8, flex: 1, minWidth: 150 }}>
      <Label>{label}</Label>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 8, borderRadius: 10, borderWidth: on ? 1.6 : 1, borderColor: on ? P.blue : P.border, backgroundColor: P.dark ? P.alt : '#FBFCFF' }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: P.soft, alignItems: 'center', justifyContent: 'center' }}>
          {glyph ? <Text style={{ color: P.blue, fontSize: 15, fontWeight: '800' }}>{glyph}</Text> : <Icon name={icon ?? 'ellipse'} size={16} color={P.blue} />}
        </View>
        <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={P.body + 'AA'} keyboardType="decimal-pad" onFocus={() => setOn(true)} onBlur={() => setOn(false)} onSubmitEditing={onSubmit}
          style={{ flex: 1, minWidth: 0, color: P.head, fontSize: 14, fontWeight: '600', outlineStyle: 'none' } as any} />
      </View>
    </View>
  );
}

function Select({ label, value, options, onPick, flex = 1, maxH = 240 }: { label?: string; value: string; options: { k: string; label: string }[]; onPick: (k: string) => void; flex?: number; maxH?: number }) {
  const P = usePal(), [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 8, flex, minWidth: 150, zIndex: open ? 60 : 1 }}>
      {!!label && <Label>{label}</Label>}
      <View>
        {open && <Pressable onPress={() => setOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 59 } as any} />}
        <Pressable accessibilityRole="button" onPress={() => setOpen(!open)} style={((s: any) => ({ flexDirection: 'row', alignItems: 'center', height: 48, paddingHorizontal: 14, borderRadius: 10, borderWidth: open ? 1.6 : 1, borderColor: open || s.hovered ? P.blue : P.border, backgroundColor: P.dark ? P.alt : '#FBFCFF', cursor: 'pointer' })) as any}>
          <Text style={{ flex: 1, color: P.head, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{options.find((o) => o.k === value)?.label ?? value}</Text>
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} color={P.body} />
        </Pressable>
        {open && (
          <View style={{ position: 'absolute', top: 52, left: 0, right: 0, zIndex: 61, maxHeight: maxH, borderRadius: 10, borderWidth: 1, borderColor: P.border, backgroundColor: P.th.solid, shadowColor: P.shadow, shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, overflow: 'hidden' }}>
            <ScrollView style={{ padding: 4 }}>
              {options.map((o) => (
                <Pressable key={o.k} onPress={() => { onPick(o.k); setOpen(false); }} style={((s: any) => ({ height: 38, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 8, cursor: 'pointer', backgroundColor: o.k === value ? P.soft : s.hovered ? P.alt : 'transparent' })) as any}>
                  <Text style={{ color: o.k === value ? P.blue : P.head, fontSize: 13.5, fontWeight: o.k === value ? '700' : '500' }} numberOfLines={1}>{o.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </View>
  );
}

function CardHead({ n, title, icon }: { n?: number; title: string; icon: string }) {
  const P = usePal();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: P.blue + (P.dark ? '33' : '1F'), alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={17} color={P.blue} /></View>
      <Text style={{ color: P.head, fontSize: 16.5, fontWeight: '800', letterSpacing: -0.2 }}>{n ? `${n}. ` : ''}{title}</Text>
    </View>
  );
}

// ---------- artwork
function HeroArt({ risk, reward, rr }: { risk: number; reward: number; rr: number }) {
  const bars = [[40, 70, 'u'], [70, 100, 'u'], [95, 130, 'd'], [60, 110, 'u'], [90, 150, 'u'], [120, 170, 'd'], [100, 160, 'u'], [140, 200, 'u']] as const;
  return (
    <View style={{ width: 500, height: 250 }}>
      <Svg width={500} height={250} viewBox="0 0 500 250">
        <Defs>
          <SG id="scr" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#0E2C78" /><Stop offset="1" stopColor="#071A4A" /></SG>
          <SG id="coin" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#4FA3FF" /><Stop offset="1" stopColor="#1B54E6" /></SG>
          <SG id="shd" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#7DB6FF" /><Stop offset="1" stopColor="#2A5FE0" /></SG>
        </Defs>
        {bars.map(([a, b, c], i) => <Rect key={i} x={10 + i * 28} y={235 - b} width={9} height={b - a + 30} rx={2} fill={c === 'u' ? '#34E3B5' : '#FF7390'} opacity={0.35} />)}
        <Path d="M96 40 L340 28 L378 188 L60 206 Z" fill="url(#scr)" stroke="#3E6FD8" strokeWidth={4} strokeLinejoin="round" />
        <Path d="M84 206 L392 190 L408 214 L60 232 Z" fill="#2B4FA8" />
        {[[130, 130, 'u'], [150, 112, 'u'], [170, 120, 'd'], [190, 96, 'u'], [210, 104, 'd'], [230, 78, 'u'], [250, 84, 'd'], [270, 60, 'u'], [290, 52, 'u']].map(([x, y, c], i) => (
          <React.Fragment key={i}><Line x1={x as number} y1={(y as number) - 14} x2={x as number} y2={(y as number) + 24} stroke={c === 'u' ? '#34E3B5' : '#FF5C7A'} strokeWidth={1.6} /><Rect x={(x as number) - 4} y={y as number} width={8} height={16} fill={c === 'u' ? '#34E3B5' : '#FF5C7A'} /></React.Fragment>
        ))}
        <Path d="M120 150 C 170 130, 200 110, 240 84 S 300 50, 322 44" stroke="#7DB6FF" strokeWidth={2} fill="none" opacity={0.8} />
        <Circle cx={318} cy={100} r={44} fill="url(#coin)" stroke="#9CC9FF" strokeWidth={4} />
        <SText x={318} y={118} fontSize={50} fontWeight="800" fill="#FFFFFF" textAnchor="middle">$</SText>
        <Path d="M420 96 L470 114 L470 168 Q470 208 420 230 Q370 208 370 168 L370 114 Z" fill="url(#shd)" stroke="#BFDCFF" strokeWidth={3} strokeLinejoin="round" />
        <Path d="M400 168 L416 184 L444 148" stroke="#FFFFFF" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
      <View style={{ position: 'absolute', right: 0, top: 0, width: 152, paddingVertical: 12, paddingHorizontal: 14, gap: 7, borderRadius: 12, backgroundColor: '#3A6FE099', borderWidth: 1, borderColor: '#FFFFFF40' }}>
        {[['Risk', `${f(risk, 1)}%`], ['Reward', `${f(reward, 1)}%`], ['RR', `1:${rr}`]].map(([k, v]) => (
          <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: '#DCE8FF', fontSize: 13 }}>{k}</Text><Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800' }}>{v}</Text></View>
        ))}
      </View>
    </View>
  );
}

function ToolArt() {
  return (
    <Svg width={290} height={190} viewBox="0 0 290 190">
      <Defs><SG id="cb" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#4C8DFF" /><Stop offset="1" stopColor="#1F4FD8" /></SG></Defs>
      <Path d="M40 168 L210 168 L250 150 L84 150 Z" fill="#2F6BFF" opacity={0.16} />
      <Rect x={34} y={30} width={86} height={118} rx={12} fill="url(#cb)" />
      <Rect x={44} y={40} width={66} height={24} rx={5} fill="#CFE2FF" />
      {[0, 1, 2].map((r) => [0, 1, 2].map((c) => <Rect key={`${r}${c}`} x={46 + c * 22} y={74 + r * 22} width={16} height={15} rx={4} fill={c === 2 && r === 2 ? '#FF9A3D' : '#9CC4FF'} />))}
      <Rect x={134} y={84} width={26} height={62} rx={4} fill="#2F6BFF" /><Rect x={168} y={62} width={26} height={84} rx={4} fill="#1F4FD8" />
      <Circle cx={232} cy={98} r={44} fill="#EAF2FF" stroke="#8FB8FF" strokeWidth={3} /><Circle cx={232} cy={98} r={30} fill="#FFFFFF" stroke="#2F6BFF" strokeWidth={9} /><Circle cx={232} cy={98} r={9} fill="#2F6BFF" />
      <Line x1={232} y1={98} x2={274} y2={50} stroke="#1F4FD8" strokeWidth={4} strokeLinecap="round" /><Path d="M262 46 L282 40 L276 60 Z" fill="#1F4FD8" />
    </Svg>
  );
}

// the what-if chart: price path into the entry, a green reward zone and a red risk zone sized by the ratio
function RRChart({ w, rr, rp, buy }: { w: number; rr: number; rp: number; buy: boolean }) {
  const P = usePal(), th = P.th, h = 200, total = rr + 1, u = Math.min(44, (h - 30) / total), top = (h - total * u) / 2;
  const tpY = buy ? top : top + total * u, eY = buy ? top + rr * u : top + u, slY = buy ? top + total * u : top, zx = w * 0.62;
  const k = Math.min(70, buy ? h - eY - 10 : eY - 10), N = 14;
  const closes = Array.from({ length: N }, (_, i) => (buy ? eY + (k * (N - 1 - i)) / (N - 1) : eY - (k * (N - 1 - i)) / (N - 1)) + Math.sin(i * 1.7) * 9);
  const step = (zx - 16) / N;
  const tag = (y: number, t1: string, t2: string, c: string) => (
    <View style={{ position: 'absolute', left: zx + 8, top: y - 15, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c }} /><View><Text style={{ color: c, fontSize: 11.5, fontWeight: '800' }}>{t1}</Text><Text style={{ color: c, fontSize: 11, fontWeight: '700' }}>{t2}</Text></View>
    </View>
  );
  return (
    <View style={{ width: w, height: h }}>
      <Svg width={w} height={h}>
        <Rect x={zx} y={Math.min(tpY, eY)} width={w - zx - 4} height={Math.abs(eY - tpY)} fill={th.buy} opacity={0.2} />
        <Rect x={zx} y={Math.min(slY, eY)} width={w - zx - 4} height={Math.abs(eY - slY)} fill={th.sell} opacity={0.2} />
        <Line x1={8} y1={eY} x2={w - 4} y2={eY} stroke={P.body} strokeWidth={1} strokeDasharray="4 4" opacity={0.7} />
        {closes.map((c, i) => {
          const o = i ? closes[i - 1] : c + (buy ? 8 : -8), up = c < o, col = up ? th.buy : th.sell, x = 12 + i * step;
          return <React.Fragment key={i}><Line x1={x} y1={Math.min(o, c) - 7} x2={x} y2={Math.max(o, c) + 7} stroke={col} strokeWidth={1.4} /><Rect x={x - 3.5} y={Math.min(o, c)} width={7} height={Math.max(5, Math.abs(c - o))} fill={col} /></React.Fragment>;
        })}
      </Svg>
      {tag(tpY, 'Take Profit', `${buy ? '+' : '−'}${f(rp * rr)}%`, th.buy)}
      {tag(eY, 'Entry', '0.00%', P.head)}
      {tag(slY, 'Stop Loss', `${buy ? '−' : '+'}${f(rp)}%`, th.sell)}
    </View>
  );
}

// ---------- page
export default function RiskHome() {
  const P = usePal(), th = P.th, go = useGo(), w = useRealWindow().width;
  const { t, tab, prefill, setPrefill, toast } = useApp();
  const { quotes } = useFeed(tab === 4);
  const rate = (id: string) => quotes[id]?.price;
  const [bal, setBal] = useState(''), [risk, setRisk] = useState(''), [entry, setEntry] = useState(''), [sl, setSl] = useState('');
  const [tp, setTp] = useState(['', '', '']), [split, setSplit] = useState(TP_SPLIT.map(String)), [multi, setMulti] = useState(false);
  const [sym, setSym] = useState('frxEURUSD'), [auto, setAuto] = useState(true), [manual, setManual] = useState('');
  const [err, setErr] = useState(''), [out, setOut] = useState<Out | null>(null), [from, setFrom] = useState('');
  const [rr, setRr] = useState(2), [rp, setRp] = useState(1), [buy, setBuy] = useState(true), [cw, setCw] = useState(0);

  // levels sent from the ICT Lab land here
  useEffect(() => {
    if (tab !== 4 || !prefill) return;
    const d = Math.abs(prefill.entry) >= 100 ? 2 : Math.abs(prefill.entry) >= 1 ? 4 : 5;
    setEntry(prefill.entry.toFixed(d)); setSl(prefill.sl.toFixed(d));
    setTp([0, 1, 2].map((i) => (prefill.tps[i] !== undefined ? prefill.tps[i].toFixed(d) : ''))); setMulti(prefill.tps.length > 1);
    const m = SYMBOLS.find((s) => s.id === prefill.symbol || s.name === prefill.symbol);
    if (m) setSym(m.id);
    setFrom(prefill.symbol ?? ''); setOut(null); setErr(''); setPrefill(null);
  }, [tab, prefill]);
  useEffect(() => { const e = num(entry), s = num(sl); if (isFinite(e) && isFinite(s) && e !== s) setBuy(e > s); }, [entry, sl]);

  const decOf = () => Math.max(2, ...[entry, sl, tp[0]].map((x) => (x.split(/[.,]/)[1] ?? '').length), 0);
  const calc = () => {
    const b = num(bal), r = num(risk), e = num(entry), s = num(sl);
    const tps = (multi ? tp : [tp[0]]).map(num), sp = multi ? split.map(num) : [100];
    const fail = (m: string) => { setErr(m); setOut(null); };
    if ([b, r, e, s].some((x) => !isFinite(x)) || e === s || b <= 0 || r <= 0 || r > 100 || e <= 0 || s <= 0) return fail(t('fillAll'));
    const isBuy = e > s, used = tps.map((v, i) => ({ v, i })).filter((x) => isFinite(x.v));
    if (!used.length) return fail(t('needTp'));
    if (used.some((x) => (isBuy ? x.v <= e : x.v >= e))) return fail(t('tpSide'));
    const sum = used.reduce((a, x) => a + (isFinite(sp[x.i]) ? sp[x.i] : 0), 0);
    if (Math.abs(sum - 100) > 0.01) return fail(`${t('splitSum')} (${sum}%)`);
    const amt = (b * r) / 100, dist = Math.abs(e - s), per = perPoint(1, sym, e, rate), spec = lotSpec(sym, e);
    let lots = 0;
    if (auto) {
      lots = suggestLots(amt, dist, sym, e, rate);
      if (!lots) return fail(`Even the minimum lot (${fmtLots(spec.min)}) risks more than $${f(amt)} with this stop. Raise the risk % or the balance, or tighten the stop.`);
    } else {
      lots = parseLots(manual); const le = lotsError(lots, spec); if (le) return fail(le);
    }
    setErr('');
    const rows = used.map((x) => { const l = (lots * sp[x.i]) / 100, d = Math.abs(x.v - e); return { label: `TP${x.i + 1}`, price: x.v, r: d / dist, pct: sp[x.i], lots: l, profit: d * per * l }; });
    const total = rows.reduce((a, x) => a + x.profit, 0), real = lots * per * dist;
    setOut({ side: isBuy ? 'buy' : 'sell', amt, risk: real, dist, lots, units: lots * lotUnits(sym), dec: decOf(), rows, total, blended: total / real, be: rows[0].profit });
  };

  // risk / reward what-if: shown on the account balance, or a $10,000 example when none is typed
  const base = num(bal) > 0 ? num(bal) : 10000, reward = rp * rr;
  const apply = () => {
    setRisk(String(rp));
    const e = num(entry), s = num(sl);
    if (isFinite(e) && isFinite(s) && e !== s) { const d = Math.abs(e - s), isBuy = e > s; setTp([(isBuy ? e + d * rr : e - d * rr).toFixed(decOf() + 1), tp[1], tp[2]]); setMulti(false); setOut(null); toast(`Risk set to ${rp}% and TP1 placed at 1:${rr}.`, 'good'); }
    else toast(`Risk set to ${rp}%. Add entry and stop loss to place the target.`, 'info');
  };

  const wide = w >= 1060, pad = w >= 700 ? 32 : 16;
  const feat = (icon: string, a: string, b: string) => (
    <View key={a} style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#2F6BFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#4C8DFF', shadowOpacity: 0.6, shadowRadius: 12 }}><Icon name={icon} size={19} color="#FFFFFF" /></View>
      <View><Text style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '800' }}>{a}</Text><Text style={{ color: '#B8CCF5', fontSize: 11 }}>{b}</Text></View>
    </View>
  );
  const tile = (icon: string, c: string, k: string, v: string, vc: string) => (
    <View key={k} style={{ flexGrow: 1, flexBasis: 170, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: P.border, backgroundColor: P.dark ? P.alt : '#FBFCFF' }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c + '24', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={19} color={c} /></View>
      <View style={{ flex: 1, minWidth: 0 }}><Text style={{ color: P.body, fontSize: 12 }}>{k}</Text><Text style={{ color: vc, fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] }} numberOfLines={1}>{v}</Text></View>
    </View>
  );
  const dd = out?.dec ?? 4, slN = num(sl), tpN = num(tp[0]);
  const rrStat = (k: string, big: string, small: string, c: string) => (
    <View style={{ flex: 1, padding: 14, gap: 2, borderRadius: 12, borderWidth: 1, borderColor: P.border }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: P.body, fontSize: 12.5 }}>{k}</Text><Text style={{ color: c, fontSize: 12.5, fontWeight: '700' }}>{small.split('|')[0]}</Text></View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}><Text style={{ color: c, fontSize: 26, fontWeight: '800' }}>{big}</Text><Text style={{ color: P.body, fontSize: 12.5 }}>{small.split('|')[1]}</Text></View>
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: P.bg }} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
      {/* hero: same banner as every other page */}
      <View style={{ width: '100%', maxWidth: 1280, alignSelf: 'center', paddingHorizontal: pad, paddingTop: 18 }}>
        <HeroBanner icon="calculator" tag="Risk & TP Planner" title="Plan Your Trades with Confidence" subtitle="Calculate your position size, set stop loss and take profit levels, and manage your risk with precision."
          features={[
            { icon: 'calculator', title: 'Position Size', sub: 'Trade with the right size' },
            { icon: 'shield-checkmark', title: 'Risk Management', sub: 'Protect your capital' },
            { icon: 'swap-vertical', title: 'TP & SL Planner', sub: 'Plan your exit' },
            { icon: 'bulb', title: 'Better Decisions', sub: 'Trade with confidence' },
          ]} />
      </View>

      <View style={{ width: '100%', maxWidth: 1280, alignSelf: 'center', paddingHorizontal: pad, paddingTop: 20, paddingBottom: 40, gap: 22 }}>
        <Notices flush />
        {!!from && <View style={{ padding: 12, borderRadius: 10, borderWidth: 1, borderColor: P.blue, backgroundColor: P.soft }}><Text style={{ color: P.head, fontSize: 13 }}>{t('prefilled')} {from}</Text></View>}

        <View style={{ flexDirection: wide ? 'row' : 'column', gap: 20, alignItems: 'stretch' }}>
          {/* left rail */}
          <View style={{ width: wide ? 330 : '100%', gap: 16, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: P.border, backgroundColor: P.dark ? P.card : '#F3F7FF' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: P.soft, alignItems: 'center', justifyContent: 'center' }}><Icon name="construct" size={16} color={P.blue} /></View><Text style={{ color: P.head, fontSize: 15, fontWeight: '700' }}>Trading Tools</Text></View>
            <Text style={{ color: P.head, fontSize: 32, fontWeight: '800', letterSpacing: -0.8 }}>Risk & TP Planner</Text>
            <Text style={{ color: P.body, fontSize: 14.5, lineHeight: 23 }}>Use our advanced risk management tools to calculate position size, set stop loss and take profit levels, and plan your trades with precision.</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {[['shield-checkmark', 'Safe Trading', 'Manage risk'], ['analytics', 'Better Results', 'Plan with data'], ['locate', 'Trade Smarter', 'Use the right tools']].map(([i, a, b]) => (
                <View key={a} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: P.soft, alignItems: 'center', justifyContent: 'center' }}><Icon name={i} size={15} color={P.blue} /></View><View><Text style={{ color: P.head, fontSize: 11.5, fontWeight: '700' }}>{a}</Text><Text style={{ color: P.body, fontSize: 10.5 }}>{b}</Text></View></View>
              ))}
            </View>
            <View style={{ alignItems: 'center', paddingVertical: 6 }}><ToolArt /></View>
            <View style={{ flexDirection: 'row', gap: 12, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: P.blue + '33', backgroundColor: P.soft }}>
              <Icon name="bulb" size={22} color={P.blue} />
              <View style={{ flex: 1, gap: 8 }}>
                <Text style={{ color: P.head, fontSize: 15, lineHeight: 22 }}>The key to long-term success in trading is not to be right all the time, but to manage your risk when you are wrong.</Text>
                <Text style={{ color: P.blue, fontSize: 12, fontWeight: '600' }}>— Professional Trader</Text>
              </View>
            </View>
          </View>

          {/* calculators */}
          <View style={{ flex: 1, minWidth: 0, gap: 20 }}>
            <Panel style={{ padding: 22, gap: 18, zIndex: 30 }}>
              <CardHead n={1} title="Account & Trade Details" icon="document-text" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                <Field label="Account Balance" glyph="$" value={bal} onChange={setBal} placeholder="Enter account balance (USD)" onSubmit={calc} />
                <Field label="Risk per Trade (%)" glyph="%" value={risk} onChange={setRisk} placeholder="e.g. 1.0" onSubmit={calc} />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                <Field label="Entry Price" icon="enter-outline" value={entry} onChange={setEntry} placeholder="e.g. 1.1234" onSubmit={calc} />
                <Field label="Stop Loss Price" icon="shield-half" value={sl} onChange={setSl} placeholder="e.g. 1.1200" onSubmit={calc} />
                <Field label={multi ? 'Take Profit 1 Price' : 'Take Profit Price'} icon="flag" value={tp[0]} onChange={(v) => setTp([v, tp[1], tp[2]])} placeholder="e.g. 1.1300" onSubmit={calc} />
              </View>
              {multi && (
                <View style={{ gap: 14 }}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                    <Field label="Take Profit 2 Price" icon="flag" value={tp[1]} onChange={(v) => setTp([tp[0], v, tp[2]])} placeholder="optional" onSubmit={calc} />
                    <Field label="Take Profit 3 Price" icon="flag" value={tp[2]} onChange={(v) => setTp([tp[0], tp[1], v])} placeholder="optional" onSubmit={calc} />
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                    {[0, 1, 2].map((i) => <Field key={i} label={`${t('closePct')} TP${i + 1} (%)`} glyph="%" value={split[i]} onChange={(v) => setSplit(split.map((x, k) => (k === i ? v : x)))} placeholder="e.g. 50" onSubmit={calc} />)}
                  </View>
                </View>
              )}
              <Pressable onPress={() => setMulti(!multi)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', cursor: 'pointer' } as any}>
                <Icon name={multi ? 'remove-circle-outline' : 'add-circle-outline'} size={17} color={P.blue} /><Text style={{ color: P.blue, fontSize: 13, fontWeight: '600' }}>{multi ? 'Use a single take profit' : 'Split across 3 take profits'}</Text>
              </Pressable>
            </Panel>

            <Panel style={{ padding: 22, gap: 18, zIndex: 20 }}>
              <CardHead n={2} title="Position Size Calculator" icon="calculator" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                <Select label="Instrument" value={sym} options={SYMBOLS.map((s) => ({ k: s.id, label: s.name }))} onPick={setSym} />
                <View style={{ flex: 1, minWidth: 150, gap: 10, zIndex: 5 }}>
                  <Select label="Trade Size (Lots)" value={auto ? 'auto' : 'manual'} options={[{ k: 'auto', label: 'Auto Calculate' }, { k: 'manual', label: 'Enter lots myself' }]} onPick={(k) => setAuto(k === 'auto')} />
                  {!auto && <Field label="Lots" icon="layers" value={manual} onChange={setManual} placeholder="e.g. 0.35" onSubmit={calc} />}
                </View>
                <View style={{ flex: 1, minWidth: 150, gap: 8 }}>
                  <Label>Risk Amount (USD)</Label>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: P.border, backgroundColor: P.alt }}>
                    <Icon name="ellipse-outline" size={14} color={P.body} /><Text style={{ color: P.body, fontSize: 14, fontWeight: '600' }}>{isFinite(num(bal) * num(risk)) && num(bal) * num(risk) > 0 ? f((num(bal) * num(risk)) / 100) : '0.00'}</Text>
                  </View>
                </View>
              </View>
              <Pressable accessibilityRole="button" onPress={calc} style={((s: any) => ({ cursor: 'pointer', opacity: s.hovered ? 0.93 : 1 })) as any}>
                <LinearGradient colors={['#2F6BFF', '#7A3FF0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 52, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <Icon name="calculator" size={19} color="#FFFFFF" /><Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>Calculate</Text>
                </LinearGradient>
              </Pressable>
              {!!err && <View style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: 10, backgroundColor: th.sell + '14', borderWidth: 1, borderColor: th.sell + '44' }}><Icon name="alert-circle" size={18} color={th.sell} /><Text style={{ flex: 1, color: th.sell, fontSize: 13, lineHeight: 19 }}>{err}</Text></View>}
            </Panel>

            <Panel style={{ padding: 22, gap: 16, zIndex: 10 }}>
              <CardHead title="Your Trade Plan" icon="shield-checkmark" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
                {tile('layers', P.blue, 'Position Size', `${out ? fmtLots(out.lots) : '0.00'} Lots`, P.blue)}
                {tile('shield-checkmark', P.blue, 'Risk Amount', `$${out ? f(out.risk) : '0.00'}`, P.blue)}
                {tile('close-circle', th.sell, 'Stop Loss', (out ? slN : 0).toFixed(dd), th.sell)}
                {tile('locate', th.buy, 'Take Profit', (out ? tpN : 0).toFixed(dd), th.buy)}
              </View>
              {!out && <Text style={{ color: P.body, fontSize: 12.5, lineHeight: 18 }}>Enter your balance, the risk % and your levels, then press Calculate. The position size, the risk amount and the take-profit ladder appear here.</Text>}
              {out && (
                <View style={{ gap: 12 }}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                    {[['Direction', out.side === 'buy' ? 'Buy (Long)' : 'Sell (Short)', out.side === 'buy' ? th.buy : th.sell], ['Stop distance', f(out.dist, out.dec + 1), P.head], ['Units', f(out.units, 2), P.head], ['Blended reward', `1 : ${f(out.blended)}`, P.blue], ['All targets', `+$${f(out.total)}`, th.buy], ['After TP1 (break-even)', `+$${f(out.be)}`, th.gold], ['Worst case', `−$${f(out.risk)}`, th.sell]].map(([k, v, c]) => (
                      <View key={k} style={{ flexGrow: 1, flexBasis: 140, padding: 10, borderRadius: 10, backgroundColor: P.alt }}><Text style={{ color: P.body, fontSize: 11.5 }}>{k}</Text><Text style={{ color: c, fontSize: 14, fontWeight: '800', marginTop: 2 }}>{v}</Text></View>
                    ))}
                  </View>
                  {out.rows.map((x) => (
                    <View key={x.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: P.border }}>
                      <View style={{ paddingHorizontal: 9, height: 24, borderRadius: 12, justifyContent: 'center', backgroundColor: th.buy + '1F' }}><Text style={{ color: th.buy, fontSize: 12, fontWeight: '800' }}>{x.label}</Text></View>
                      <Text style={{ flex: 1, color: P.head, fontSize: 13.5, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{x.price.toFixed(dd)}</Text>
                      <Text style={{ color: P.body, fontSize: 12 }}>{x.pct}% · {fmtLots(x.lots)} lots</Text>
                      <Text style={{ color: th.buy, fontSize: 13, fontWeight: '800', minWidth: 110, textAlign: 'right' }}>{f(x.r)}R · +${f(x.profit)}</Text>
                    </View>
                  ))}
                  <Text style={{ color: P.body, fontSize: 11.5, lineHeight: 17 }}>{t('calcNote')}</Text>
                </View>
              )}
            </Panel>
          </View>
        </View>

        {/* risk reward analysis */}
        <Panel style={{ padding: 22, gap: 18, zIndex: 5 }}>
          <CardHead n={3} title="Risk Reward Analysis" icon="analytics" />
          <View style={{ flexDirection: wide ? 'row' : 'column', gap: 18, alignItems: 'stretch' }}>
            <View style={{ width: wide ? 270 : '100%', gap: 16, zIndex: 40 }}>
              <Select label="Risk : Reward Ratio" value={String(rr)} options={RR_OPT.map((x) => ({ k: String(x), label: `1 : ${x}` }))} onPick={(k) => setRr(Number(k))} />
              <Select label="Risk Percentage" value={String(rp)} options={RP_OPT.map((x) => ({ k: String(x), label: `${x}%` }))} onPick={(k) => setRp(Number(k))} />
              <View style={{ gap: 8 }}>
                <Label>Trade Direction</Label>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {[[true, 'Buy (Long)'], [false, 'Sell (Short)']].map(([v, l]) => (
                    <Pressable key={String(l)} accessibilityRole="button" onPress={() => setBuy(v as boolean)} style={((s: any) => ({ flex: 1, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backgroundColor: buy === v ? P.blue : s.hovered ? P.soft : P.alt, borderWidth: 1, borderColor: buy === v ? P.blue : P.border })) as any}>
                      <Text style={{ color: buy === v ? P.th.onAccent : P.head, fontSize: 13, fontWeight: '700' }}>{l as string}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <Pressable onPress={apply} style={((s: any) => ({ height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: P.blue + '66', backgroundColor: s.hovered ? P.soft : 'transparent', cursor: 'pointer' })) as any}><Text style={{ color: P.blue, fontSize: 13.5, fontWeight: '700' }}>Apply to my plan</Text></Pressable>
            </View>
            <View onLayout={(e) => setCw(e.nativeEvent.layout.width)} style={{ flex: 1, minWidth: 0, borderRadius: 12, borderWidth: 1, borderColor: P.border, padding: 12, minHeight: 224 }}>
              {cw > 0 && <RRChart w={Math.max(240, cw - 24)} rr={rr} rp={rp} buy={buy} />}
            </View>
            <View style={{ width: wide ? 300 : '100%', gap: 12 }}>
              {rrStat('Potential Profit', `+${f(reward)}%`, `+${f(reward)}%|$${f((base * reward) / 100)}`, th.buy)}
              {rrStat('Potential Loss', `−${f(rp)}%`, `−${f(rp)}%|$${f((base * rp) / 100)}`, th.sell)}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: P.border }}>
                <Icon name="shield-checkmark" size={20} color={P.blue} /><Text style={{ flex: 1, color: P.head, fontSize: 13, fontWeight: '700' }}>Risk : Reward</Text><Text style={{ color: P.blue, fontSize: 15, fontWeight: '800' }}>1 : {rr}</Text>
              </View>
              {!(num(bal) > 0) && <Text style={{ color: P.body, fontSize: 11 }}>Amounts use a $10,000 example account until you enter your balance.</Text>}
            </View>
          </View>
        </Panel>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: P.blue + '26', backgroundColor: P.soft }}>
          <Icon name="bulb" size={26} color={P.blue} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: P.blue, fontSize: 13.5, fontWeight: '800' }}>Pro Trading Tips</Text>
            <Text style={{ color: P.body, fontSize: 12.5, lineHeight: 19, marginTop: 2 }}>Always use a stop loss and never risk more than 1-2% of your account per trade. A good risk/reward ratio (1:2 or higher) helps you stay profitable in the long run, even if you don't win every trade.</Text>
          </View>
        </View>
      </View>
      <Footer w={w} go={go} />
    </ScrollView>
  );
}
