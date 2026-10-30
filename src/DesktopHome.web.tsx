import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import Svg, { Path, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg';
import { useApp } from './store';
import { Icon, HeroBanner, HERO_BG } from './ui';
import { Coin, CandleChart } from './MarketWidgets';
import { useFeed, chg, symOf, SYMBOLS, watchCandles, toggleFav, setWatch, Candle } from './markets';
import { analyzeAll } from './refine';
import { qualify } from './verdict';
import { useRealWindow } from './win';
import { Footer, useGo } from './SiteFooter';
export { Footer, useGo };
import { useDash, setDash } from './dash';

// The website's home page, designed like the "Fintech Analytics Homepage" mockup: hero with a live chart, market overview,
// multi-timeframe analysis, why-choose cards, call-to-action and footer. All numbers are live (same engine as the phone app).
const TFB: [string, string][] = [['60', '1m'], ['300', '5m'], ['900', '15m'], ['1800', '30m'], ['3600', '1h'], ['14400', '4h'], ['86400', '1D']];
const METALS = ['frxXAUUSD', 'frxXAGUSD', 'frxWTI', 'frxBRENT'];
const groupKey = (id: string, cat: string) => (cat === 'crypto' ? 'crypto' : cat === 'deriv' ? 'deriv' : METALS.includes(id) ? 'metals' : 'forex');
const LEAD: Record<string, string> = { forex: 'frxEURUSD', crypto: 'cryBTCUSD', metals: 'frxXAUUSD', deriv: 'R_100' };

export function usePal() {
  const { th } = useApp();
  const d = th.dark;
  return {
    th, dark: d,
    bg: d ? th.bg : '#F6F7F9', section: d ? th.bg : '#FFFFFF', alt: d ? th.panel2 : '#F6F7F9',
    card: d ? th.panel : '#FFFFFF', border: d ? th.line : '#E2E5EB',
    head: d ? th.text : '#0F1B33', body: d ? th.dim : '#5B6577',
    blue: th.accent, brass: th.accent2, soft: th.accent + (d ? '26' : '12'),
    shadow: d ? '#000000' : '#0F1B33',
  };
}

// ---------- live setup for one pair + timeframe (candles, analysis, sentiment, key levels)
export function useSetup(symId: string, tf: string, key: string) {
  const { quotes } = useFeed(true);
  const [data, setData] = useState<Candle[]>([]);
  const [err, setErr] = useState('');
  useEffect(() => { setWatch(key, [symId]); return () => setWatch(key, []); }, [symId]);
  useEffect(() => { setData([]); setErr(''); return watchCandles(symId, Number(tf), (c) => { setErr(''); setData(c); }, setErr); }, [symId, tf]);
  const sym = symOf(symId), quote = quotes[symId], dec = quote?.dec ?? 4;
  const land = useMemo(() => (data.length > 40 ? analyzeAll(data, new Date()) : null), [data]);
  const qual = useMemo(() => (land ? qualify(land, { id: sym.id, cat: sym.cat, now: new Date(), c: data }) : null), [land, data, symId]);
  const cb = land?.combo;
  const bull = cb ? (cb.side === 'buy' ? cb.score : 100 - cb.score) : (() => { const v = land?.votes ?? [], b = v.filter((x) => x.side === 'buy').length, s = v.filter((x) => x.side === 'sell').length; return b + s ? Math.round((b / (b + s)) * 100) : 50; })();
  const structure = !land ? 'Reading the market…' : land.ict.trend === 'bullish' ? 'Higher highs / higher lows' : land.ict.trend === 'bearish' ? 'Lower highs / lower lows' : 'Range-bound';
  return { sym, quote, dec, data, err, land, qual, cb, bull, structure, ready: !!land };
}
type Setup = ReturnType<typeof useSetup>;

// ---------- small building blocks
export function Panel({ children, style }: { children: React.ReactNode; style?: any }) {
  const P = usePal();
  return <View style={[{ backgroundColor: P.card, borderRadius: 12, borderWidth: 1, borderColor: P.border, shadowColor: P.shadow, shadowOpacity: P.dark ? 0.3 : 0.035, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }, style]}>{children}</View>;
}
export const Pill = ({ text, tone }: { text: string; tone?: string }) => {
  const P = usePal(), c = tone ?? P.brass;
  return <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 10 }}><View style={{ width: 22, height: 2, backgroundColor: c }} /><Text style={{ color: c, fontSize: 11, fontWeight: '700', letterSpacing: 1.6 }}>{text.toUpperCase()}</Text></View>;
};
export function Btn({ label, onPress, ghost, arrow = true }: { label: string; onPress: () => void; ghost?: boolean; arrow?: boolean }) {
  const P = usePal();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={((s: any) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 44, paddingHorizontal: 22, borderRadius: 8, cursor: 'pointer', borderWidth: 1, borderColor: ghost ? P.border : P.blue, backgroundColor: ghost ? (s.hovered ? P.alt : 'transparent') : P.blue, opacity: !ghost && s.hovered ? 0.92 : 1 })) as any}>
      <Text style={{ color: ghost ? P.head : P.th.onAccent, fontSize: 14, fontWeight: '600' }}>{label}</Text>
      {arrow && <Icon name="arrow-forward" size={15} color={ghost ? P.head : P.th.onAccent} />}
    </Pressable>
  );
}
export function Spark({ pts, color, w = 130, h = 34 }: { pts: number[]; color: string; w?: number; h?: number }) {
  const a = pts.slice(-40);
  if (a.length < 2) return <View style={{ width: w, height: h }} />;
  const lo = Math.min(...a), hi = Math.max(...a), r = hi - lo || 1;
  const xy = a.map((v, i) => [(i / (a.length - 1)) * w, h - 3 - ((v - lo) / r) * (h - 8)]);
  const line = xy.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  return (
    <Svg width={w} height={h}>
      <Defs><SvgGrad id={'sp' + color.slice(1)} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={color} stopOpacity="0.18" /><Stop offset="1" stopColor={color} stopOpacity="0" /></SvgGrad></Defs>
      <Path d={`${line} L${w} ${h} L0 ${h} Z`} fill={`url(#sp${color.slice(1)})`} />
      <Path d={line} stroke={color} strokeWidth={1.6} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}
function Gauge({ pct, color, track }: { pct: number; color: string; track: string }) {
  const len = Math.PI * 44, p = Math.max(0, Math.min(1, pct / 100));
  return (
    <Svg width={110} height={64} viewBox="0 0 110 64">
      <Path d="M 11 58 A 44 44 0 0 1 99 58" stroke={track} strokeWidth={9} fill="none" strokeLinecap="round" />
      <Path d="M 11 58 A 44 44 0 0 1 99 58" stroke={color} strokeWidth={9} fill="none" strokeLinecap="round" strokeDasharray={`${len * p} ${len}`} />
    </Svg>
  );
}
export function SentimentCard({ s }: { s: Setup }) {
  const P = usePal(), th = P.th;
  const senti = s.bull >= 60 ? { l: 'Bullish', c: th.buy } : s.bull <= 40 ? { l: 'Bearish', c: th.sell } : { l: 'Neutral', c: th.gold };
  return (
    <Panel style={{ padding: 16, gap: 6 }}>
      <Text style={{ color: P.head, fontSize: 13.5, fontWeight: '700' }}>Market Sentiment</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 110, height: 64, alignItems: 'center' }}>
          <Gauge pct={s.bull} color={senti.c} track={P.dark ? th.panel2 : '#EEF2F8'} />
          <Text style={{ position: 'absolute', bottom: 0, color: P.head, fontSize: 20, fontWeight: '800' }}>{s.ready ? `${Math.round(s.bull)}%` : '—'}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 60 }}>
          <Text style={{ color: senti.c, fontSize: 15, fontWeight: '800' }}>{s.ready ? senti.l : 'Loading'}</Text>
          <Text style={{ color: P.body, fontSize: 10.5, lineHeight: 14 }}>Share of methods point up</Text>
        </View>
      </View>
    </Panel>
  );
}
export function LevelsCard({ s }: { s: Setup }) {
  const P = usePal(), th = P.th, cb = s.cb, fx = (v?: number) => (v == null ? '—' : v.toFixed(s.dec));
  const row = (label: string, v?: number, color?: string) => (
    <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}>
      <Text style={{ color: color ?? P.body, fontSize: 13, fontWeight: color ? '600' : '500' }}>{label}</Text>
      <Text style={{ color: color ?? P.head, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{fx(v)}</Text>
    </View>
  );
  return (
    <Panel style={{ padding: 16 }}>
      <Text style={{ color: P.head, fontSize: 13.5, fontWeight: '700', marginBottom: 4 }}>Key Levels</Text>
      {row('Entry', cb?.entry)}{row('Stop Loss', cb?.sl, th.sell)}{row('TP1', cb?.tps[0])}{row('TP2', cb?.tps[1])}{row('TP3', cb?.tps[2])}
    </Panel>
  );
}
function chartLevels(s: Setup) {
  const th = usePalTheme(), cb = s.cb;
  if (!cb) return [];
  return [{ label: 'Entry', price: cb.entry, color: th.accent }, { label: 'SL', price: cb.sl, color: th.sell }, ...cb.tps.map((p: number, i: number) => ({ label: `TP${i + 1}`, price: p, color: th.buy }))];
}
const usePalTheme = () => useApp().th;

export function TfTabs({ tf, set }: { tf: string; set: (k: string) => void }) {
  const P = usePal();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
      {TFB.map(([k, l]) => (
        <Pressable key={k} onPress={() => set(k)} style={((st: any) => ({ paddingHorizontal: 11, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backgroundColor: tf === k ? P.soft : st.hovered ? P.alt : 'transparent' })) as any}>
          <Text style={{ color: tf === k ? P.blue : P.body, fontSize: 12.5, fontWeight: tf === k ? '700' : '500' }}>{l}</Text>
        </Pressable>
      ))}
    </View>
  );
}
export function ChartHeader({ s, sub, price }: { s: Setup; sub?: string; price?: boolean }) {
  const P = usePal(), th = P.th, { db } = useFeed(true);
  const c = chg(s.sym.id), fav = db.favs.includes(s.sym.id);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Coin s={s.sym} size={36} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: P.head, fontSize: 14.5, fontWeight: '700' }} numberOfLines={1}>{s.sym.name}</Text>
        {!!sub && <Text style={{ color: P.body, fontSize: 11.5 }} numberOfLines={1}>{sub}</Text>}
      </View>
      {price && !!s.quote && <Text style={{ color: c >= 0 ? th.buy : th.sell, fontSize: 12.5, fontWeight: '700' }}>{`${c >= 0 ? '+' : '−'}${Math.abs(c).toFixed(2)}%`}</Text>}
      <Pressable onPress={() => toggleFav(s.sym.id)} hitSlop={8} style={{ cursor: 'pointer' } as any}><Icon name={fav ? 'star' : 'star-outline'} size={19} color={fav ? th.gold : P.body} /></Pressable>
    </View>
  );
}
export function ChartBody({ s, tf, width, height }: { s: Setup; tf: string; width: number; height: number }) {
  const P = usePal(), levels = chartLevels(s);
  if (width < 80) return <View style={{ height }} />;
  return s.data.length > 2
    ? <CandleChart data={s.data} width={width} dec={s.dec} height={height} gran={Number(tf)} levels={levels} />
    : <View style={{ height, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: P.body, fontSize: 13 }}>{s.err || 'Loading candles...'}</Text></View>;
}

// ---------- sections
function Hero({ w, go }: { w: number; go: (t: number) => void }) {
  const P = usePal(), th = P.th, d = useDash();
  const s = useSetup(d.sym, d.tf, 'dash');
  const two = w >= 1020, [cw, setCw] = useState(0);
  const c = chg(s.sym.id);
  const cta = (label: string, onPress: () => void, solid?: boolean) => (
    <Pressable key={label} accessibilityRole="button" onPress={onPress} style={((st: any) => ({ height: 42, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backgroundColor: solid ? '#FFFFFF' : 'transparent', borderWidth: 1, borderColor: solid ? '#FFFFFF' : '#FFFFFF4D', opacity: st.hovered ? 0.9 : 1 })) as any}>
      <Text style={{ color: solid ? HERO_BG : '#FFFFFF', fontSize: 13.5, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ backgroundColor: P.bg }}>
      <View style={{ width: '100%', maxWidth: 1280, alignSelf: 'center', paddingHorizontal: w >= 700 ? 32 : 16, paddingTop: 24, paddingBottom: 40, gap: 24 }}>
        <HeroBanner tag="Smarter analysis. Better decisions." title="Trading Analysis Platform" subtitle="Real-time market insights, powerful analysis tools and personalized trading plans, all in one place."
          right={<>{cta('Go to Analysis', () => go(1), true)}{cta('Explore Markets', () => go(2))}</>}
          features={[{ icon: 'flash-outline', title: 'Real-time insights', sub: 'Live prices and signals' }, { icon: 'shield-checkmark-outline', title: 'Risk management', sub: 'Position size and limits' }, { icon: 'locate-outline', title: 'Detailed trade plans', sub: 'Entry, stop loss, 3 targets' }]} />
        <View style={{ flexDirection: two ? 'row' : 'column', gap: 20, alignItems: 'flex-start' }}>
          <Panel style={{ flex: 1, minWidth: 0, width: two ? undefined : '100%', padding: 16, gap: 10 }}>
            <ChartHeader s={s} sub={d.tf === '60' ? '1 minute' : TFB.find((x) => x[0] === d.tf)?.[1]} />
            <TfTabs tf={d.tf} set={(k) => setDash({ tf: k })} />
            <View onLayout={(e) => setCw(e.nativeEvent.layout.width)} style={{ borderRadius: 8, overflow: 'hidden' }}>
              <ChartBody s={s} tf={d.tf} width={cw} height={280} />
            </View>
            <Pressable onPress={() => go(1)} style={((st: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: P.border, cursor: 'pointer', backgroundColor: st.hovered ? P.alt : P.card })) as any}>
              <View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: P.soft, alignItems: 'center', justifyContent: 'center' }}><Icon name="analytics" size={17} color={P.blue} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: P.head, fontSize: 13, fontWeight: '600' }}>Analysis Summary</Text>
                <Text style={{ color: P.body, fontSize: 11.5 }} numberOfLines={1}>{s.structure}</Text>
              </View>
              <Icon name="chevron-forward" size={16} color={P.body} />
            </Pressable>
          </Panel>
          <View style={{ width: two ? 280 : '100%', gap: 16 }}>
            <Panel style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Coin s={s.sym} size={34} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: P.head, fontSize: 12.5, fontWeight: '600' }} numberOfLines={1}>{s.sym.name}</Text>
                <Text style={{ color: c >= 0 ? th.buy : th.sell, fontSize: 11, fontWeight: '600' }}>{`${c >= 0 ? '+' : '−'}${Math.abs(c).toFixed(2)}%`}</Text>
              </View>
              <Text style={{ color: P.head, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{s.quote ? s.quote.price.toFixed(s.dec) : '—'}</Text>
            </Panel>
            <SentimentCard s={s} />
            <LevelsCard s={s} />
          </View>
        </View>
      </View>
    </View>
  );
}

function Overview({ w, go }: { w: number; go: (t: number, market?: string) => void }) {
  const P = usePal(), th = P.th, { quotes } = useFeed(true);
  const d = useDash();
  const s = useSetup(d.sym, d.tf, 'dash-ov'); // candles + methods: the Candles and Top-Down cards read the same analysis as the hero
  const groups = (['forex', 'crypto', 'metals', 'deriv'] as const).map((g) => {
    const list = SYMBOLS.filter((x) => groupKey(x.id, x.cat) === g && quotes[x.id]);
    const avg = list.length ? list.reduce((a, x) => a + chg(x.id), 0) / list.length : 0;
    return { g, n: list.length, green: list.filter((x) => chg(x.id) >= 0).length, avg, pts: (quotes[LEAD[g]] ?? (list[0] ? quotes[list[0].id] : undefined))?.pts ?? [] };
  });
  const eur = quotes['frxEURUSD'];
  const cdl = s.land?.votes.find((x) => x.method === 'CDL');
  const cdlSide = cdl?.side === 'buy' ? { l: 'Buy', c: th.buy } : cdl?.side === 'sell' ? { l: 'Sell', c: th.sell } : { l: 'Neutral', c: th.gold };
  const td = s.land?.ict.trend === 'bullish' ? { l: 'Bullish', c: th.buy } : s.land?.ict.trend === 'bearish' ? { l: 'Bearish', c: th.sell } : { l: 'Neutral', c: th.gold };
  const cardBase = (onPress: () => void, children: React.ReactNode, key: string) => (
    <Pressable key={key} onPress={onPress} style={((st: any) => ({ flexGrow: 1, flexBasis: w >= 1100 ? 170 : 230, minWidth: 170, padding: 16, gap: 8, borderRadius: 12, borderWidth: 1, borderColor: st.hovered ? P.blue + '66' : P.border, backgroundColor: P.card, cursor: 'pointer', shadowColor: P.shadow, shadowOpacity: st.hovered ? 0.12 : 0.05, shadowRadius: 18, shadowOffset: { width: 0, height: 6 } })) as any}>{children}</Pressable>
  );
  const head = (icon: string, name: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 38, height: 38, borderRadius: 8, backgroundColor: P.soft, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={19} color={P.blue} /></View>
      <Text style={{ color: P.head, fontSize: 15, fontWeight: '700' }}>{name}</Text>
    </View>
  );
  const meta: Record<string, [string, string]> = { forex: ['cash', 'Forex'], crypto: ['logo-bitcoin', 'Crypto'], metals: ['layers', 'Metals'], deriv: ['flash', 'Deriv'] };
  return (
    <View style={{ backgroundColor: P.section }}>
      <View style={{ width: '100%', maxWidth: 1280, alignSelf: 'center', paddingHorizontal: 32, paddingVertical: 44, gap: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 16 }}>
          <View style={{ flex: 1, gap: 8 }}>
            <Pill text="Live Market Data" />
            <Text style={{ color: P.head, fontSize: 30, fontWeight: '700', letterSpacing: -0.8 }}>Market Overview</Text>
            <Text style={{ color: P.body, fontSize: 15, lineHeight: 22, maxWidth: 460 }}>Explore major markets at a glance. Track trends, compare assets and stay ahead with real-time data.</Text>
          </View>
          <Pressable onPress={() => go(2)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, cursor: 'pointer', paddingBottom: 6 } as any}>
            <Text style={{ color: P.blue, fontSize: 13.5, fontWeight: '600' }}>View All Markets</Text><Icon name="arrow-forward" size={14} color={P.blue} />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
          {groups.map((g) => {
            const [icon, name] = meta[g.g], up = g.avg >= 0, c = up ? th.buy : th.sell;
            const forex = g.g === 'forex' && !!eur, ec = chg('frxEURUSD');
            const big = forex ? eur.price.toFixed(eur.dec) : g.n ? `${g.green}/${g.n}` : '—';
            const pct = forex ? ec : g.avg, pc = pct >= 0 ? th.buy : th.sell;
            return cardBase(() => go(2, g.g), (
              <>
                {head(icon, name)}
                <Text style={{ color: P.head, fontSize: 25, fontWeight: '800', fontVariant: ['tabular-nums'], marginTop: 4 }}>{big}</Text>
                <Text style={{ color: pc, fontSize: 13.5, fontWeight: '700' }}>{`${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(2)}%`}</Text>
                <Spark pts={forex ? eur.pts : g.pts} color={forex ? pc : c} w={140} />
              </>
            ), g.g);
          })}
          {cardBase(() => go(1, 'candle'), (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 38, height: 38, borderRadius: 8, backgroundColor: P.soft, alignItems: 'center', justifyContent: 'center' }}><Icon name="bar-chart" size={19} color={P.blue} /></View>
                <Text style={{ color: P.head, fontSize: 15, fontWeight: '700', flex: 1 }}>Candles</Text>
                <View style={{ paddingHorizontal: 10, height: 24, borderRadius: 12, justifyContent: 'center', backgroundColor: cdlSide.c + '22' }}><Text style={{ color: cdlSide.c, fontSize: 12, fontWeight: '800' }}>{cdlSide.l}</Text></View>
              </View>
              <Text style={{ color: P.body, fontSize: 12.5, lineHeight: 18, marginTop: 8 }}>{cdl?.text ?? 'Hammer, engulfing, confirmation candle'}</Text>
            </>
          ), 'candles')}
          {cardBase(() => go(1, 'topdown'), (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 38, height: 38, borderRadius: 8, backgroundColor: P.soft, alignItems: 'center', justifyContent: 'center' }}><Icon name="layers" size={19} color={P.blue} /></View>
                <Text style={{ color: P.head, fontSize: 15, fontWeight: '700', flex: 1 }}>Top-Down</Text>
                <View style={{ paddingHorizontal: 10, height: 24, borderRadius: 12, justifyContent: 'center', backgroundColor: td.c + '22' }}><Text style={{ color: td.c, fontSize: 12, fontWeight: '800' }}>{td.l}</Text></View>
              </View>
              <Text style={{ color: P.body, fontSize: 12.5, lineHeight: 18, marginTop: 8 }}>H4 → H1 → M15{'\n'}multi-timeframe</Text>
            </>
          ), 'topdown')}
        </View>
      </View>
    </View>
  );
}

function MultiTf({ w, go }: { w: number; go: (t: number) => void }) {
  const P = usePal();
  const [tf, setTf] = useState('3600'), [cw, setCw] = useState(0);
  const s = useSetup('frxXAUUSD', tf, 'dash-gold');
  const three = w >= 1080, stat = (a: string, b: string) => (
    <View key={a} style={{ gap: 2, paddingRight: 18, marginRight: 4, borderRightWidth: 1, borderRightColor: P.border }}>
      <Text style={{ color: P.head, fontSize: 16, fontWeight: '800' }}>{a}</Text><Text style={{ color: P.body, fontSize: 11.5 }}>{b}</Text>
    </View>
  );
  return (
    <View style={{ backgroundColor: P.alt }}>
      <View style={{ width: '100%', maxWidth: 1280, alignSelf: 'center', paddingHorizontal: 32, paddingVertical: 48, flexDirection: three ? 'row' : 'column', alignItems: three ? 'center' : 'stretch', gap: 30 }}>
        <View style={{ width: three ? 300 : '100%', gap: 16 }}>
          <Pill text="Powerful Analysis Tools" />
          <Text style={{ color: P.head, fontSize: 38, lineHeight: 38, fontWeight: '700', letterSpacing: -0.9 }}>Multi-Timeframe{'\n'}Analysis</Text>
          <Text style={{ color: P.body, fontSize: 15, lineHeight: 23 }}>Analyze multiple timeframes, spot key levels, track trade ideas — all in real time.</Text>
          <View style={{ flexDirection: 'row' }}><Btn label="Explore Analysis" onPress={() => go(1)} /></View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 12, marginTop: 14 }}>
            {stat(`${SYMBOLS.length}+`, 'Symbols')}{stat('Multiple', 'Timeframes')}{stat('Real-time', 'Market Data')}
            <View style={{ gap: 2 }}><Text style={{ color: P.head, fontSize: 16, fontWeight: '800' }}>Advanced</Text><Text style={{ color: P.body, fontSize: 11.5 }}>Tools</Text></View>
          </View>
        </View>
        <Panel style={{ flex: 1, minWidth: 0, width: three ? undefined : '100%', padding: 16, gap: 10 }}>
          <ChartHeader s={s} sub="Gold / US Dollar" />
          <TfTabs tf={tf} set={setTf} />
          <View onLayout={(e) => setCw(e.nativeEvent.layout.width)} style={{ borderRadius: 10, overflow: 'hidden' }}>
            <ChartBody s={s} tf={tf} width={cw} height={310} />
          </View>
        </Panel>
        <View style={{ width: three ? 230 : '100%', gap: 16 }}>
          <SentimentCard s={s} />
          <LevelsCard s={s} />
        </View>
      </View>
    </View>
  );
}

const WHY: [string, string, string][] = [
  ['stats-chart', 'Advanced Analysis', 'Multi-timeframe charts, smart tools and detailed market analysis.'],
  ['globe', 'Market Coverage', 'Forex, Crypto, Metals, Indices, Commodities and more.'],
  ['shield-checkmark', 'Risk Management', 'Plan your trades with built-in risk & TP tools.'],
  ['book', 'Trading Journal', 'Track your progress and improve with journaling tools.'],
  ['flash', 'Real-time Data', 'Up-to-date market data and instant alerts.'],
  ['person', 'Easy to Use', 'Clean, modern interface designed for traders.'],
];
function Why({ w }: { w: number }) {
  const P = usePal();
  return (
    <View style={{ backgroundColor: P.section }}>
      <View style={{ width: '100%', maxWidth: 1280, alignSelf: 'center', paddingHorizontal: 32, paddingTop: 52, paddingBottom: 28, gap: 28 }}>
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Text style={{ color: P.head, fontSize: 28, fontWeight: '700', letterSpacing: -0.7, textAlign: 'center' }}>Why Choose Chart Reader?</Text>
          <Text style={{ color: P.body, fontSize: 15.5, textAlign: 'center' }}>Everything you need for smarter, more confident trading.</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
          {WHY.map(([icon, title, text]) => (
            <View key={title} style={{ flexGrow: 1, flexBasis: w >= 1100 ? 170 : 260, minWidth: 190, padding: 20, gap: 10, borderRadius: 12, borderWidth: 1, borderColor: P.border, backgroundColor: P.card, shadowColor: P.shadow, shadowOpacity: P.dark ? 0.2 : 0.04, shadowRadius: 16, shadowOffset: { width: 0, height: 5 } }}>
              <View style={{ width: 46, height: 46, borderRadius: 10, backgroundColor: P.soft, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={22} color={P.blue} /></View>
              <Text style={{ color: P.head, fontSize: 15, fontWeight: '700', marginTop: 4 }}>{title}</Text>
              <Text style={{ color: P.body, fontSize: 13, lineHeight: 19 }}>{text}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function Cta({ w, go }: { w: number; go: (t: number) => void }) {
  const P = usePal(), wide = w >= 800;
  return (
    <View style={{ backgroundColor: P.section }}>
      <View style={{ width: '100%', maxWidth: 1280, alignSelf: 'center', paddingHorizontal: w >= 700 ? 32 : 16, paddingBottom: 48 }}>
        <View style={{ borderRadius: 14, backgroundColor: HERO_BG, borderWidth: 1, borderColor: '#1C2E56', flexDirection: wide ? 'row' : 'column', alignItems: wide ? 'center' : 'flex-start', gap: 22, paddingVertical: 32, paddingHorizontal: 32 }}>
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '700', letterSpacing: -0.3 }}>Ready to trade with a plan?</Text>
            <Text style={{ color: '#B4C0D8', fontSize: 14.5, lineHeight: 22, maxWidth: 560 }}>Real-time analysis, risk tools and a trading journal in one place.</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => go(1)} style={((st: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, paddingHorizontal: 22, borderRadius: 8, backgroundColor: '#FFFFFF', cursor: 'pointer', opacity: st.hovered ? 0.92 : 1 })) as any}>
            <Text style={{ color: HERO_BG, fontSize: 14, fontWeight: '600' }}>Get started</Text><Icon name="arrow-forward" size={15} color={HERO_BG} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// go(tab, extra): open a page; extra = the analysis method (Analysis page) or the market group (Markets page).
export default function DesktopHome() {
  const w = useRealWindow().width;
  const go = useGo();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: usePalBg() }} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
      <Hero w={w} go={go} />
      <Overview w={w} go={go} />
      <MultiTf w={w} go={go} />
      <Why w={w} />
      <Cta w={w} go={go} />
      <Footer w={w} go={go} />
    </ScrollView>
  );
}
const usePalBg = () => usePal().bg;
