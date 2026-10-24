import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from './store';
import { Icon, Card } from './ui';
import { Coin, CandleChart } from './MarketWidgets';
import MethodChart from './MethodChart';
import { MethodIcon, MDEFS, mdef } from './MethodArt';
import ChartWeb from './ChartWeb';
import { useFeed, chg, symOf, SYMBOLS, watchCandles, toggleFav, setWatch, Candle, Sym } from './markets';
import { tvSymbol, tvHtml, TV_INTERVAL } from './tv';
import { analyzeAll } from './refine';
import { qualify } from './verdict';
import { totalR, money, todayPnl } from './trades';
import { MANUAL_TAB } from './manualTarget';
import { useRealWindow, useLayout } from './win';
import { useDash, setDash } from './dash';
import { useHeadlines } from './headlines';
import { useNews, localTime } from './news';

// The website's home: the trading dashboard. Left/centre: hero, chart with the entry / stop / targets drawn on it, the TRADE or WAIT answer,
// summary and plan, the analysis methods, trade desk, AI analysis, news, quick tools and a market overview. Right: watchlist, sentiment,
// key levels and position size. Everything is live data from the same code as the phone app. The sidebar and top bar are in Desktop.web.tsx.
const TFB: [string, string][] = [['60', '1m'], ['300', '5m'], ['900', '15m'], ['1800', '30m'], ['3600', '1h'], ['14400', '4h'], ['86400', '1D']];
const METHOD_CARDS: { k: string; label: string; vote: string | null; text: string }[] = [
  { k: 'ict', label: 'ICT', vote: 'ICT', text: 'Liquidity sweep, FVG, order block, PD array' },
  { k: 'smc', label: 'SMC', vote: 'SMC', text: 'Market structure, BOS / CHoCH, order flow' },
  { k: 'vsa', label: 'VSA', vote: 'VSA', text: 'Volume analysis, accumulation and distribution' },
  { k: 'pat', label: 'Patterns', vote: 'PAT', text: 'Double top / bottom, triangles, flags' },
  { k: 'candle', label: 'Candles', vote: 'CDL', text: 'Hammer, engulfing, confirmation candle' },
  { k: 'topdown', label: 'Top-Down', vote: null, text: 'H4 → H1 → M15 multi-timeframe' },
];
const METALS = ['frxXAUUSD', 'frxXAGUSD'], ENERGY_IDX = ['frxWTI', 'frxBRENT', 'frxDXY'];
const groupKey = (s: Sym) => (s.cat === 'crypto' ? 'crypto' : s.cat === 'deriv' ? 'deriv' : METALS.includes(s.id) ? 'metals' : ENERGY_IDX.includes(s.id) ? 'other' : 'forex');
const CAT_LABEL: Record<string, string> = { forex: 'Forex', crypto: 'Crypto', deriv: 'Deriv synthetic index' };

const pipOf = (id: string) => (id.startsWith('frx') && !METALS.includes(id) && !ENERGY_IDX.includes(id) ? (id.endsWith('JPY') ? 0.01 : 0.0001) : 0);
const pipsText = (id: string, from: number, to: number) => { const p = pipOf(id); if (!p) return ''; const n = Math.round(Math.abs(to - from) / p); return `(${to >= from ? '+' : '−'}${n} pips)`; };

function Ring({ pct, color, track, size = 62, label }: { pct: number; color: string; track: string; size?: number; label: string }) {
  const r = size / 2 - 5, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct / 100));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={5} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={5} fill="none" strokeLinecap="round" strokeDasharray={`${c * p} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      <Text style={{ color, fontSize: size * 0.27, fontWeight: '900' }}>{label}</Text>
    </View>
  );
}

function Gauge({ pct, color, track }: { pct: number; color: string; track: string }) {
  const len = Math.PI * 60, p = Math.max(0, Math.min(1, pct / 100));
  return (
    <Svg width={150} height={88} viewBox="0 0 150 88">
      <Path d="M 15 78 A 60 60 0 0 1 135 78" stroke={track} strokeWidth={13} fill="none" strokeLinecap="round" />
      <Path d="M 15 78 A 60 60 0 0 1 135 78" stroke={color} strokeWidth={13} fill="none" strokeLinecap="round" strokeDasharray={`${len * p} ${len}`} />
    </Svg>
  );
}

const Title = ({ icon, text, right, onRight }: { icon: string; text: string; right?: string; onRight?: () => void }) => {
  const { th } = useApp();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
      <Icon name={icon} size={17} color={th.accent} />
      <Text style={{ color: th.text, fontSize: 15.5, fontWeight: '900', flex: 1 }}>{text}</Text>
      {!!right && <Pressable onPress={onRight} style={{ cursor: 'pointer' } as any}><Text style={{ color: th.accent, fontSize: 12, fontWeight: '800' }}>{right}</Text></Pressable>}
    </View>
  );
};

const Tabs = ({ items, on, set }: { items: string[]; on: string; set: (k: string) => void }) => {
  const { th } = useApp();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {items.map((k) => (
        <Pressable key={k} onPress={() => set(k)} style={{ paddingHorizontal: 10, height: 28, borderRadius: 14, justifyContent: 'center', cursor: 'pointer', backgroundColor: on === k ? th.accent : th.panel2 } as any}>
          <Text style={{ color: on === k ? th.onAccent : th.dim, fontSize: 11.5, fontWeight: '800' }}>{k}</Text>
        </Pressable>
      ))}
    </View>
  );
};

const Pill = ({ text, color }: { text: string; color: string }) => (
  <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10, backgroundColor: color + '22' }}><Text style={{ color, fontSize: 10.5, fontWeight: '800' }}>{text}</Text></View>
);

export default function DesktopHome() {
  const { th, t, lic, setTab, setAmethod, setAsym, signals, journal, desk, history, logSetup, toast } = useApp();
  const L = useLayout(), real = useRealWindow();
  const pageW = Math.min(real.width - L.sidebar, 1640) - 40;
  const two = pageW >= 1020, RIGHT = 322, mainW = two ? pageW - RIGHT - 16 : pageW;
  const d = useDash();
  const { quotes, db } = useFeed(true);
  const [mode, setMode] = useState<'analysis' | 'pro'>('analysis');
  const [data, setData] = useState<Candle[]>([]);
  const [err, setErr] = useState('');
  const [wtab, setWtab] = useState('All');
  const [dtab, setDtab] = useState('Setups');
  const [ntab, setNtab] = useState('All');
  const sym = symOf(d.sym), tv = tvSymbol(sym), quote = quotes[sym.id];
  const paid = lic.admin || lic.status === 'paid';

  // ---- watchlist rows: the starred markets (or the main forex pairs until something is starred), filtered by the tab
  const pool = useMemo(() => {
    const favs = db.favs.map(symOf);
    const base = wtab === 'All' ? (favs.length ? favs : SYMBOLS.filter((s) => ['frxEURUSD', 'frxGBPUSD', 'frxUSDJPY', 'frxXAUUSD', 'cryBTCUSD', 'cryETHUSD', 'R_100', 'BOOM1000'].includes(s.id))) : SYMBOLS.filter((s) => groupKey(s) === wtab.toLowerCase());
    return base.slice(0, 9);
  }, [wtab, db.favs.join(',')]);
  useEffect(() => { setWatch('dash', Array.from(new Set([sym.id, ...pool.map((s) => s.id), ...SYMBOLS.filter((s) => ['forex', 'crypto'].includes(groupKey(s))).slice(0, 8).map((s) => s.id)]))); return () => setWatch('dash', []); }, [sym.id, pool.map((s) => s.id).join(',')]);
  useEffect(() => { setData([]); setErr(''); return watchCandles(sym.id, Number(d.tf), (c) => { setErr(''); setData(c); }, setErr); }, [sym.id, d.tf]);

  // ---- the answer: TRADE or WAIT from the same quality gate as the phone
  const land = useMemo(() => (data.length > 40 ? analyzeAll(data, new Date()) : null), [data]);
  const qual = useMemo(() => (land ? qualify(land, { id: sym.id, cat: sym.cat, now: new Date(), c: data }) : null), [land, data, sym.id]);
  const cb = land?.combo, dec = quote?.dec ?? 4;
  const fx = (v: number) => v.toFixed(dec);
  const isTrade = !!qual?.trade;
  const vcol = !qual ? th.dim : isTrade ? (cb?.side === 'sell' ? th.sell : th.buy) : th.gold;
  const conf = cb ? (cb.score >= 85 ? 'High Confidence' : cb.score >= 70 ? 'Medium Confidence' : 'Low Confidence') : '';
  const why = qual && !qual.trade ? (qual.reasons[0] ?? 'The conditions are not all met yet.') : '';
  const bull = cb ? (cb.side === 'buy' ? cb.score : 100 - cb.score) : (() => { const v = land?.votes ?? [], b = v.filter((x) => x.side === 'buy').length, s = v.filter((x) => x.side === 'sell').length; return b + s ? Math.round((b / (b + s)) * 100) : 50; })();
  const senti = bull >= 60 ? { l: 'Bullish', c: th.buy } : bull <= 40 ? { l: 'Bearish', c: th.sell } : { l: 'Neutral', c: th.gold };
  const trend = land?.confirm?.ema200 === 'above' ? 'Uptrend' : land?.confirm?.ema200 === 'below' ? 'Downtrend' : land?.ict?.trend === 'bullish' ? 'Uptrend' : land?.ict?.trend === 'bearish' ? 'Downtrend' : 'Sideways';
  const structure = !land ? '—' : land.ict.trend === 'bullish' ? 'Higher highs / higher lows' : land.ict.trend === 'bearish' ? 'Lower highs / lower lows' : 'Range-bound';
  const adx = land?.confirm?.adx ?? 0, momentum = !land ? '—' : adx >= 25 ? 'Strong' : adx >= 18 ? 'Moderate' : 'Weak';
  const volat = useMemo(() => { if (data.length < 60) return '—'; const r = (a: Candle[]) => a.reduce((s, c) => s + (c.h - c.l), 0) / a.length, k = r(data.slice(-14)) / (r(data.slice(-60)) || 1); return k > 1.3 ? 'High' : k < 0.75 ? 'Low' : 'Moderate'; }, [data]);
  const last = data[data.length - 1];
  const c = chg(sym.id), col = c >= 0 ? th.buy : th.sell, fav = db.favs.includes(sym.id);
  const absChg = quote ? quote.price - quote.price / (1 + c / 100) : 0;
  const tfLabel = TFB.find(([k]) => k === d.tf)?.[1] ?? d.tf;
  const open = (k = 'all') => { setAsym(sym.id); setAmethod(k); setTab(1); };
  const addJournal = () => {
    if (!cb) { toast('No setup to add yet. Wait for the chart to load.', 'info'); return; }
    logSetup({ symId: sym.id, name: sym.name, tf: d.tf, dec, side: cb.side, entry: cb.entry, sl: cb.sl, tps: [...cb.tps], score: cb.score, grade: cb.grade, source: 'Combined', why: cb.checks.filter((x) => x.ok).map((x) => x.text).slice(0, 5), zone: [cb.zoneBottom, cb.zoneTop] });
    toast('Setup added to your Journal.', 'good');
  };

  // ---- trade desk
  const waiting = signals.filter((x) => x.status === 'signal'), live = signals.filter((x) => x.status !== 'signal');
  const todayMoney = todayPnl(journal);
  const closedRows = journal.slice(0, 5), wins = journal.filter((x) => x.pnl > 0).length;
  const floatMoney = live.reduce((acc, x) => (x.status === 'open' && quotes[x.symId]?.price ? acc + totalR(x, quotes[x.symId].price) * x.risk : acc), 0);

  // ---- news
  const fx$ = useHeadlines('forex'), cr$ = useHeadlines('crypto'), cal = useNews(true);
  const newsRows = useMemo(() => {
    if (ntab === 'Economy') return cal.events.filter((e) => e.impact === 'High' || e.impact === 'Medium').slice(0, 6).map((e) => ({ id: e.id, t: e.t, title: `${e.cur} · ${e.title}`, tag: e.impact, tc: e.impact === 'High' ? th.sell : th.gold }));
    const f = fx$.items.map((h) => ({ id: h.id, t: h.t, title: h.title, tag: 'Forex', tc: th.accent })), k = cr$.items.map((h) => ({ id: h.id, t: h.t, title: h.title, tag: 'Crypto', tc: th.gold }));
    return (ntab === 'Forex' ? f : ntab === 'Crypto' ? k : [...f, ...k].sort((a, b) => b.t - a.t)).slice(0, 6);
  }, [ntab, fx$.items, cr$.items, cal.events]);

  // ---- market overview: how many markets are green today
  const overview = (['forex', 'crypto', 'metals', 'deriv'] as const).map((g) => {
    const list = SYMBOLS.filter((s) => groupKey(s) === g && quotes[s.id]);
    const green = list.filter((s) => chg(s.id) >= 0).length;
    return { g, n: list.length, green };
  });
  const nMethods = MDEFS.filter((x) => x.host !== 'tab').length;
  const stat = (icon: string, color: string, v: string, l: string) => (
    <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={18} color="#FFFFFF" /></View>
      <View><Text style={{ color: th.text, fontSize: 17, fontWeight: '900' }}>{v}</Text><Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '600' }}>{l}</Text></View>
    </View>
  );
  const lvl = (label: string, v: number | undefined, color?: string) => (
    <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}>
      <Text style={{ color: color ?? th.dim, fontSize: 13, fontWeight: color ? '700' : '500' }}>{label}</Text>
      <Text style={{ color: color ?? th.text, fontSize: 13.5, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{v == null ? '—' : fx(v)}</Text>
    </View>
  );
  const chartW = mainW - 32;

  const rightCol = (
    <View style={{ width: two ? RIGHT : '100%', gap: 16 }}>
      <Card style={{ padding: 16, gap: 12 }}>
        <Title icon="star" text="Watchlist" right="+ Add" onRight={() => setTab(2)} />
        <Tabs items={['All', 'Forex', 'Crypto', 'Metals', 'Deriv']} on={wtab} set={setWtab} />
        <View>
          {pool.length === 0 && <Text style={{ color: th.dim, fontSize: 12.5, paddingVertical: 12 }}>Nothing here yet. Star a market to keep it in your watchlist.</Text>}
          {pool.map((s) => {
            const x = quotes[s.id], cc = chg(s.id), on = s.id === sym.id, f = db.favs.includes(s.id);
            return (
              <Pressable key={s.id} onPress={() => setDash({ sym: s.id })} style={((st: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 10, cursor: 'pointer', backgroundColor: on ? th.accent + '16' : st.hovered ? th.accent + '0C' : 'transparent' })) as any}>
                <Coin s={s} size={30} />
                <Text style={{ flex: 1, color: th.text, fontSize: 13, fontWeight: '800' }} numberOfLines={1}>{s.name}</Text>
                <Text style={{ color: th.text, fontSize: 12.5, fontWeight: '600', width: 70, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{x ? x.price.toFixed(x.dec) : '—'}</Text>
                <Text style={{ color: cc >= 0 ? th.buy : th.sell, fontSize: 12, fontWeight: '800', width: 54, textAlign: 'right' }}>{x ? `${cc >= 0 ? '+' : '−'}${Math.abs(cc).toFixed(2)}%` : ''}</Text>
                <Pressable onPress={() => toggleFav(s.id)} hitSlop={6} style={{ cursor: 'pointer' } as any}><Icon name={f ? 'star' : 'star-outline'} size={16} color={f ? th.gold : th.dim} /></Pressable>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card style={{ padding: 16, gap: 8 }}>
        <Text style={{ color: th.text, fontSize: 15.5, fontWeight: '900' }}>Market Sentiment</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 150, height: 88, alignItems: 'center' }}>
            <Gauge pct={bull} color={senti.c} track={th.panel2} />
            <Text style={{ position: 'absolute', bottom: 2, color: th.text, fontSize: 24, fontWeight: '900' }}>{land ? `${Math.round(bull)}%` : '—'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: senti.c, fontSize: 18, fontWeight: '900' }}>{land ? senti.l : 'Loading'}</Text>
            <Text style={{ color: th.dim, fontSize: 11, lineHeight: 15 }}>{cb ? 'Setup score, from the analysis methods' : 'Share of methods that point up'}</Text>
          </View>
        </View>
      </Card>

      <Card style={{ padding: 16, gap: 4 }}>
        <Text style={{ color: th.text, fontSize: 15.5, fontWeight: '900', marginBottom: 4 }}>Key Levels</Text>
        {lvl('Entry', cb?.entry)}{lvl('Stop Loss', cb?.sl, th.sell)}{lvl('TP1', cb?.tps[0])}{lvl('TP2', cb?.tps[1])}{lvl('TP3', cb?.tps[2])}
        <View style={{ height: 1, backgroundColor: th.line, marginVertical: 6 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
          <Text style={{ color: th.text, fontSize: 13, fontWeight: '800' }}>Risk / Reward</Text>
          <Text style={{ color: th.buy, fontSize: 13.5, fontWeight: '900' }}>{cb ? `1 : ${cb.rr[2].toFixed(1)}` : '—'}</Text>
        </View>
        <View style={{ height: 1, backgroundColor: th.line, marginVertical: 6 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}>
          <Text style={{ color: th.text, fontSize: 13, fontWeight: '800' }}>Position Size</Text>
          {desk.riskPct > 0
            ? <Text style={{ color: th.text, fontSize: 13.5, fontWeight: '800' }}>{desk.riskPct}% <Text style={{ color: desk.riskPct <= 1 ? th.buy : desk.riskPct <= 2 ? th.gold : th.sell, fontWeight: '700' }}>({desk.riskPct <= 1 ? 'Low' : desk.riskPct <= 2 ? 'Medium' : 'High'} Risk)</Text></Text>
            : <Pressable onPress={() => setTab(3)} style={{ cursor: 'pointer' } as any}><Text style={{ color: th.accent, fontSize: 12.5, fontWeight: '800' }}>Set your risk ›</Text></Pressable>}
        </View>
      </Card>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16, width: '100%', maxWidth: pageW + 40, alignSelf: 'center' }} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: two ? 'row' : 'column', alignItems: 'flex-start', gap: 16 }}>
        <View style={{ width: mainW, gap: 16 }}>
          {/* hero */}
          <View style={{ borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: th.line, backgroundColor: th.panel }}>
            <LinearGradient colors={[th.accent + '26', th.accent2 + '12', th.accent + '00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            <View style={{ padding: 24, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 11, height: 26, borderRadius: 13, backgroundColor: th.accent + '1A' }}>
                <Icon name="shield-checkmark" size={13} color={th.accent} /><Text style={{ color: th.accent, fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2 }}>SMART TRADING ANALYSIS</Text>
              </View>
              <Text style={{ color: th.text, fontSize: 36, fontWeight: '900', letterSpacing: -1 }}>Scalp <Text style={{ color: th.accent }}>•</Text> Analyze <Text style={{ color: th.accent }}>•</Text> Execute</Text>
              <Text style={{ color: th.dim, fontSize: 14, lineHeight: 21, maxWidth: 470 }}>Professional trading tools and analysis methods for Forex, Crypto and Deriv, with real-time charts, multi-timeframe analysis and AI insights.</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 6 }}>
                {stat('flash', '#4C8DFF', String(nMethods), 'Analysis Methods')}{stat('pulse', '#34D399', String(SYMBOLS.length), 'Live Markets')}{stat('time', '#FFB62E', '24/7', 'Crypto & Deriv')}{stat('flag', '#8B5CF6', '3 TPs', 'On every setup')}
              </View>
            </View>
            {mainW >= 760 && (
              <View pointerEvents="none" style={{ position: 'absolute', right: 40, top: 26, width: 230 }}>
                <Text style={{ color: th.accent + 'CC', fontSize: 25, fontStyle: 'italic', lineHeight: 33, fontFamily: "'Segoe Script','Brush Script MT','Lucida Handwriting',cursive", transform: [{ rotate: '-6deg' }] } as any}>Better Analysis,{'\n'}Bigger Opportunities</Text>
                <Svg width={90} height={50} style={{ marginLeft: 70, marginTop: 4 }}><Path d="M4 44 C 20 8, 52 4, 82 8" stroke={th.accent + 'AA'} strokeWidth={2} fill="none" strokeLinecap="round" /><Path d="M70 2 L84 8 L72 18" stroke={th.accent + 'AA'} strokeWidth={2} fill="none" strokeLinecap="round" /></Svg>
              </View>
            )}
          </View>

          {/* chart */}
          <Card style={{ padding: 16, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Coin s={sym} size={42} />
              <View>
                <Text style={{ color: th.text, fontSize: 17, fontWeight: '900' }}>{sym.name}</Text>
                <Text style={{ color: th.dim, fontSize: 11.5 }}>{sym.sub ?? CAT_LABEL[sym.cat] ?? sym.cat} · {tfLabel}</Text>
              </View>
              <Text style={{ color: th.text, fontSize: 24, fontWeight: '900', marginLeft: 8, fontVariant: ['tabular-nums'] }}>{quote ? quote.price.toFixed(dec) : '—'}</Text>
              {!!quote && <Text style={{ color: col, fontSize: 12.5, fontWeight: '800' }}>{`${absChg >= 0 ? '+' : '−'}${Math.abs(absChg).toFixed(dec)} (${c >= 0 ? '+' : '−'}${Math.abs(c).toFixed(2)}%)`}</Text>}
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => toggleFav(sym.id)} hitSlop={6} style={{ cursor: 'pointer' } as any}><Icon name={fav ? 'star' : 'star-outline'} size={20} color={fav ? th.gold : th.dim} /></Pressable>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
              {TFB.map(([k, l]) => (
                <Pressable key={k} onPress={() => setDash({ tf: k })} style={{ paddingHorizontal: 12, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backgroundColor: d.tf === k ? th.accent + '26' : 'transparent' } as any}>
                  <Text style={{ color: d.tf === k ? th.accent : th.dim, fontSize: 12.5, fontWeight: '800' }}>{l}</Text>
                </Pressable>
              ))}
              <View style={{ flex: 1 }} />
              {!!tv && (
                <View style={{ flexDirection: 'row', borderRadius: 8, borderWidth: 1, borderColor: th.line, overflow: 'hidden' }}>
                  {([['analysis', 'Analysis'], ['pro', 'Pro chart']] as const).map(([k, l]) => (
                    <Pressable key={k} onPress={() => setMode(k)} style={{ paddingHorizontal: 11, height: 28, justifyContent: 'center', cursor: 'pointer', backgroundColor: mode === k ? th.accent : 'transparent' } as any}><Text style={{ color: mode === k ? th.onAccent : th.dim, fontSize: 12, fontWeight: '800' }}>{l}</Text></Pressable>
                  ))}
                </View>
              )}
              <Pressable onPress={() => open()} style={((st: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 12, marginLeft: 6, borderRadius: 8, borderWidth: 1, borderColor: th.line, cursor: 'pointer', backgroundColor: st.hovered ? th.accent + '14' : 'transparent' })) as any}>
                <Icon name="expand-outline" size={14} color={th.accent} /><Text style={{ color: th.accent, fontSize: 12, fontWeight: '800' }}>Full chart</Text>
              </Pressable>
            </View>
            {!!last && mode === 'analysis' && <Text style={{ color: th.dim, fontSize: 11.5, fontVariant: ['tabular-nums'] }}>O {fx(last.o)}  H {fx(last.h)}  L {fx(last.l)}  C {fx(last.c)}  <Text style={{ color: last.c >= last.o ? th.buy : th.sell }}>{last.c >= last.o ? '+' : '−'}{fx(Math.abs(last.c - last.o))}</Text></Text>}
            <View style={{ borderRadius: 12, borderWidth: 1, borderColor: th.line, overflow: 'hidden', backgroundColor: th.panel2 }}>
              {mode === 'pro' && !!tv
                ? <ChartWeb key={`tv-${sym.id}-${d.tf}-${th.dark}`} height={440} html={tvHtml(tv, TV_INTERVAL[d.tf] ?? '15', th.dark, th.bg, [], '1')} />
                : (
                  <View style={{ minHeight: 360, padding: 4, justifyContent: 'center' }}>
                    {data.length > 40 && land
                      ? <MethodChart data={data} all={land} method="ict" width={chartW - 10} dec={dec} height={420} gran={Number(d.tf)} symId={sym.id} plan={cb ? { entry: cb.entry, sl: cb.sl, tps: [...cb.tps], tag: cb.side === 'buy' ? 'BUY' : 'SELL' } : null} />
                      : data.length ? <CandleChart data={data} width={chartW - 10} dec={dec} height={380} gran={Number(d.tf)} /> : <Text style={{ color: th.dim, textAlign: 'center', padding: 30 }}>{err || 'Loading candles...'}</Text>}
                  </View>
                )}
            </View>
          </Card>

          {/* answer, summary, plan */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
            <Card style={{ flex: 1.1, minWidth: 270, padding: 18, gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Icon name={isTrade ? 'checkmark-circle' : 'hourglass-outline'} size={34} color={vcol} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: vcol, fontSize: 24, fontWeight: '900', letterSpacing: 0.5 }}>{!qual ? 'Reading…' : isTrade ? `TRADE ${cb?.side === 'sell' ? 'SELL' : 'BUY'}` : 'WAIT'}</Text>
                  {!!conf && <View style={{ alignSelf: 'flex-start' }}><Pill text={conf} color={vcol} /></View>}
                </View>
                {!!cb && <View style={{ alignItems: 'center' }}><Ring pct={cb.score} color={vcol} track={th.panel2} label={`${Math.round(cb.score)}%`} /><Text style={{ color: th.dim, fontSize: 9.5, fontWeight: '700' }}>Confluence Score</Text></View>}
              </View>
              <Text style={{ color: th.dim, fontSize: 12.5, lineHeight: 18 }}>{!qual ? 'Reading the chart…' : isTrade ? 'All quality-gate conditions are met. The analysis methods and the higher timeframe agree on this setup.' : why}</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 'auto' as any }}>
                <Pressable onPress={addJournal} style={((st: any) => ({ flex: 1.3, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backgroundColor: isTrade ? th.buy : th.accent, opacity: !cb ? 0.5 : st.hovered ? 0.9 : 1 })) as any}><Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>Add to Journal</Text></Pressable>
                <Pressable onPress={() => open()} style={((st: any) => ({ flex: 1, height: 40, borderRadius: 10, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderWidth: 1, borderColor: th.line, backgroundColor: st.hovered ? th.accent + '12' : 'transparent' })) as any}><Text style={{ color: th.text, fontSize: 13, fontWeight: '800' }}>Open Chart</Text><Icon name="arrow-forward" size={13} color={th.text} /></Pressable>
              </View>
            </Card>
            <Card style={{ flex: 1.3, minWidth: 290, padding: 18, gap: 10 }}>
              <Title icon="sparkles" text="Analysis Summary" />
              <Text style={{ color: th.dim, fontSize: 12.5, lineHeight: 18 }} numberOfLines={4}>{cb ? cb.basis : land?.why ?? 'Reading the chart…'}</Text>
              <View style={{ borderRadius: 10, borderWidth: 1, borderColor: th.line, overflow: 'hidden' }}>
                {([['Market Trend', trend, trend === 'Uptrend' ? th.buy : trend === 'Downtrend' ? th.sell : th.gold], ['Structure', structure, th.text], ['Momentum', momentum, momentum === 'Strong' ? th.buy : th.text], ['Volatility', volat, th.text]] as [string, string, string][]).map(([k, v, cc], i) => (
                  <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: i % 2 ? th.panel2 : 'transparent' }}>
                    <Text style={{ color: th.dim, fontSize: 12.5 }}>{k}</Text><Text style={{ color: cc, fontSize: 12.5, fontWeight: '800' }}>{v}</Text>
                  </View>
                ))}
              </View>
            </Card>
            <Card style={{ flex: 1.1, minWidth: 270, padding: 18, gap: 8 }}>
              <Title icon="clipboard-outline" text="Trade Plan" />
              {([['Entry', cb?.entry, 'enter', th.accent, ''], ['Stop Loss', cb?.sl, 'stop', th.sell, cb ? pipsText(sym.id, cb.entry, cb.sl) : ''], ['Take Profit 1', cb?.tps[0], 'tp', th.buy, cb ? pipsText(sym.id, cb.entry, cb.tps[0]) : ''], ['Take Profit 2', cb?.tps[1], 'tp', th.buy, cb ? pipsText(sym.id, cb.entry, cb.tps[1]) : ''], ['Take Profit 3', cb?.tps[2], 'tp', th.buy, cb ? pipsText(sym.id, cb.entry, cb.tps[2]) : '']] as [string, number | undefined, string, string, string][]).map(([k, v, , cc, p]) => (
                <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
                  <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: cc + '1F', alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cc }} /></View>
                  <Text style={{ flex: 1, color: th.dim, fontSize: 12.5 }}>{k}</Text>
                  <Text style={{ color: th.text, fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{v == null ? '—' : fx(v)}</Text>
                  {!!p && <Text style={{ color: cc === th.sell ? th.sell : th.buy, fontSize: 11, fontWeight: '700', minWidth: 74, textAlign: 'right' }}>{p}</Text>}
                </View>
              ))}
            </Card>
          </View>

          {/* analysis methods */}
          <Card style={{ padding: 16, gap: 12 }}>
            <Title icon="shield-checkmark" text="Analysis Methods" right="View all methods →" onRight={() => { setAmethod(''); setTab(1); }} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {METHOD_CARDS.map(({ k, label, vote, text }) => {
                const def = mdef(k)!, v = vote ? land?.votes.find((x) => x.method === vote) : undefined;
                const hv = vote === null ? (cb?.htf === 'with' ? { l: cb.side === 'buy' ? 'Buy' : 'Sell', c: cb.side === 'buy' ? th.buy : th.sell } : cb?.htf === 'against' ? { l: 'Against', c: th.sell } : { l: 'Neutral', c: th.gold }) : v?.side ? { l: v.side === 'buy' ? 'Buy' : 'Sell', c: v.side === 'buy' ? th.buy : th.sell } : { l: land ? 'Neutral' : '—', c: th.gold };
                return (
                  <Pressable key={k} onPress={() => open(k)} style={((st: any) => ({ flexGrow: 1, flexBasis: 128, minWidth: 128, padding: 12, gap: 8, borderRadius: 12, cursor: 'pointer', borderWidth: 1, borderColor: st.hovered ? th.accent : th.line, backgroundColor: th.panel2 })) as any}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <MethodIcon def={def} size={30} />
                      <Text style={{ flex: 1, color: th.text, fontSize: 13.5, fontWeight: '900' }} numberOfLines={1}>{label}</Text>
                    </View>
                    <View style={{ alignSelf: 'flex-start' }}><Pill text={hv.l} color={hv.c} /></View>
                    <Text style={{ color: th.dim, fontSize: 11, lineHeight: 15 }} numberOfLines={3}>{text}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          {/* trade desk, AI analysis, news */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
            <Card style={{ flex: 1.5, minWidth: 330, padding: 16, gap: 12 }}>
              <Title icon="briefcase-outline" text="Trade Desk" right="Open Journal ›" onRight={() => setTab(3)} />
              <Tabs items={[`Setups (${waiting.length})`, `Live (${live.length})`, 'Closed', 'Insights']} on={dtab.startsWith('Setups') ? `Setups (${waiting.length})` : dtab.startsWith('Live') ? `Live (${live.length})` : dtab} set={(k) => setDtab(k)} />
              {(dtab.startsWith('Setups') || dtab.startsWith('Live')) && (() => {
                const rows = dtab.startsWith('Setups') ? waiting : live;
                return (
                  <View>
                    <View style={{ flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: th.line }}>
                      {['Symbol', 'Type', 'Entry', 'SL', 'TP1', 'Status'].map((h, i) => <Text key={h} style={{ flex: i === 0 ? 1.6 : 1, color: th.dim, fontSize: 10.5, fontWeight: '800' }}>{h}</Text>)}
                    </View>
                    {rows.length === 0 && <Text style={{ color: th.dim, fontSize: 12.5, paddingVertical: 14 }}>{dtab.startsWith('Setups') ? 'No setups waiting. Good setups from the scanner and analysis pages are added here for you.' : 'No trades running.'}</Text>}
                    {rows.slice(0, 5).map((x) => (
                      <Pressable key={x.id} onPress={() => setTab(3)} style={((st: any) => ({ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, cursor: 'pointer', backgroundColor: st.hovered ? th.accent + '0C' : 'transparent' })) as any}>
                        <View style={{ flex: 1.6, flexDirection: 'row', alignItems: 'center', gap: 7 }}><Coin s={symOf(x.symId)} size={22} /><Text style={{ color: th.text, fontSize: 12, fontWeight: '800' }} numberOfLines={1}>{x.name}</Text></View>
                        <View style={{ flex: 1, alignItems: 'flex-start' }}><Pill text={x.side === 'buy' ? 'Buy' : 'Sell'} color={x.side === 'buy' ? th.buy : th.sell} /></View>
                        <Text style={{ flex: 1, color: th.text, fontSize: 12, fontVariant: ['tabular-nums'] }}>{x.entry.toFixed(x.dec)}</Text>
                        <Text style={{ flex: 1, color: th.text, fontSize: 12, fontVariant: ['tabular-nums'] }}>{x.sl.toFixed(x.dec)}</Text>
                        <Text style={{ flex: 1, color: th.text, fontSize: 12, fontVariant: ['tabular-nums'] }}>{x.tps[0]?.toFixed(x.dec) ?? '—'}</Text>
                        <View style={{ flex: 1, alignItems: 'flex-start' }}><Pill text={x.status === 'signal' ? 'Waiting' : x.status === 'pending' ? 'Pending' : 'Live'} color={x.status === 'open' ? th.buy : th.gold} /></View>
                      </Pressable>
                    ))}
                  </View>
                );
              })()}
              {dtab === 'Closed' && (
                <View>
                  {closedRows.length === 0 && <Text style={{ color: th.dim, fontSize: 12.5, paddingVertical: 14 }}>No closed trades yet.</Text>}
                  {closedRows.map((x) => (
                    <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 }}>
                      <Text style={{ flex: 1.6, color: th.text, fontSize: 12, fontWeight: '800' }} numberOfLines={1}>{x.symbol}</Text>
                      <View style={{ flex: 1 }}><Pill text={x.side === 'buy' ? 'Buy' : 'Sell'} color={x.side === 'buy' ? th.buy : th.sell} /></View>
                      <Text style={{ flex: 2, color: x.pnl >= 0 ? th.buy : th.sell, fontSize: 12.5, fontWeight: '800', textAlign: 'right' }}>{money(x.pnl)}</Text>
                    </View>
                  ))}
                </View>
              )}
              {dtab === 'Insights' && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {([['CLOSED', String(journal.length), th.text], ['WIN RATE', journal.length ? `${Math.round((wins / journal.length) * 100)}%` : '—', th.buy], ['TODAY', money(todayMoney), todayMoney >= 0 ? th.buy : th.sell], ['FLOATING', floatMoney ? money(floatMoney) : '—', floatMoney >= 0 ? th.buy : th.sell]] as [string, string, string][]).map(([k, v, cc]) => (
                    <View key={k} style={{ flex: 1, backgroundColor: th.panel2, borderRadius: 10, padding: 10 }}><Text style={{ color: th.dim, fontSize: 9.5, fontWeight: '900', letterSpacing: 0.7 }}>{k}</Text><Text style={{ color: cc, fontSize: 16, fontWeight: '900', marginTop: 2 }} numberOfLines={1}>{v}</Text></View>
                  ))}
                </View>
              )}
            </Card>

            <Card style={{ flex: 1.2, minWidth: 290, padding: 16, gap: 10 }}>
              <Title icon="logo-electron" text="AI Analysis (Gemini)" right="All →" onRight={() => setTab(5)} />
              {history[0] ? (
                <>
                  <Text style={{ color: th.dim, fontSize: 11 }}>{history[0].symbol ?? 'Chart'}{history[0].tf ? ` · ${history[0].tf}` : ''} · {new Date(history[0].date).toLocaleDateString()}</Text>
                  <Text style={{ color: th.text, fontSize: 12.5, lineHeight: 19 }} numberOfLines={7}>{history[0].result.reasoning || history[0].result.trend.summary}</Text>
                </>
              ) : <Text style={{ color: th.dim, fontSize: 12.5, lineHeight: 19 }}>No AI analysis yet. Open an analysis page and press "Analysis of this chart". The newest one is shown here.</Text>}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 'auto' as any }}>
                {([['Run analysis', () => open('all')], ['History', () => setTab(5)]] as [string, () => void][]).map(([l, f]) => (
                  <Pressable key={l} onPress={f} style={((st: any) => ({ flex: 1, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderWidth: 1, borderColor: th.line, backgroundColor: st.hovered ? th.accent + '12' : 'transparent' })) as any}><Text style={{ color: th.accent, fontSize: 12, fontWeight: '800' }}>{l}</Text></Pressable>
                ))}
              </View>
            </Card>

            <Card style={{ flex: 1.2, minWidth: 290, padding: 16, gap: 10 }}>
              <Title icon="newspaper-outline" text="Latest News" right="View All →" onRight={() => setTab(13)} />
              <Tabs items={['All', 'Forex', 'Crypto', 'Economy']} on={ntab} set={setNtab} />
              <View>
                {newsRows.length === 0 && <Text style={{ color: th.dim, fontSize: 12.5, paddingVertical: 12 }}>{fx$.loading || cr$.loading ? 'Loading news…' : 'No news right now.'}</Text>}
                {newsRows.map((n) => (
                  <View key={n.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: th.line + '88' }}>
                    <Text style={{ color: th.dim, fontSize: 11, width: 38, fontVariant: ['tabular-nums'] }}>{localTime(n.t)}</Text>
                    <Text style={{ flex: 1, color: th.text, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>{n.title}</Text>
                    <Pill text={n.tag} color={n.tc} />
                  </View>
                ))}
              </View>
            </Card>
          </View>

          {/* quick tools, market overview, upgrade */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
            <Card style={{ flex: 1.3, minWidth: 300, padding: 16, gap: 12 }}>
              <Text style={{ color: th.text, fontSize: 15.5, fontWeight: '900' }}>Quick Tools</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {([['Scanner', 'search', () => { setAmethod('scanner'); setTab(1); }], ['Planner', 'calculator-outline', () => setTab(4)], ['Killzones', 'alarm-outline', () => setTab(8)], ['News', 'newspaper-outline', () => setTab(13)], ['Demo Trade', 'swap-vertical', () => setTab(MANUAL_TAB)], ['Journal', 'book-outline', () => setTab(3)]] as [string, string, () => void][]).map(([l, ic, f]) => (
                  <Pressable key={l} onPress={f} style={((st: any) => ({ flexGrow: 1, flexBasis: 78, alignItems: 'center', gap: 6, paddingVertical: 11, borderRadius: 12, cursor: 'pointer', borderWidth: 1, borderColor: th.line, backgroundColor: st.hovered ? th.accent + '14' : th.panel2 })) as any}>
                    <Icon name={ic} size={19} color={th.accent} /><Text style={{ color: th.text, fontSize: 11.5, fontWeight: '700' }} numberOfLines={1}>{l}</Text>
                  </Pressable>
                ))}
              </View>
            </Card>
            <Card style={{ flex: 1.7, minWidth: 330, padding: 16, gap: 12 }}>
              <Text style={{ color: th.text, fontSize: 15.5, fontWeight: '900' }}>Market Overview</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {overview.map(({ g, n, green }) => (
                  <View key={g} style={{ flex: 1, backgroundColor: th.panel2, borderRadius: 10, padding: 10, gap: 4 }}>
                    <Text style={{ color: th.text, fontSize: 12.5, fontWeight: '800', textTransform: 'capitalize' }}>{g}</Text>
                    <Text style={{ color: n && green / n >= 0.5 ? th.buy : th.sell, fontSize: 11.5, fontWeight: '800' }}>{n ? `${green}/${n} Green` : '—'}</Text>
                    <View style={{ flexDirection: 'row', height: 5, borderRadius: 3, overflow: 'hidden', backgroundColor: th.line }}>
                      <View style={{ flex: green, backgroundColor: th.buy }} /><View style={{ flex: Math.max(0, n - green), backgroundColor: th.sell }} />
                    </View>
                  </View>
                ))}
              </View>
            </Card>
            <View style={{ flex: 1.1, minWidth: 260, borderRadius: 16, overflow: 'hidden', padding: 18, gap: 8, justifyContent: 'center' }}>
              <LinearGradient colors={['#0B1B3F', '#1E3FD8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
              <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '900', lineHeight: 22 }}>Trade Smarter{'\n'}with Chart Reader</Text>
              <Text style={{ color: '#FFFFFFB3', fontSize: 11.5, lineHeight: 16 }}>Advanced tools, AI insights and real-time alerts.</Text>
              {paid ? <Text style={{ color: '#7CF0C4', fontSize: 12.5, fontWeight: '800' }}>✓ Your PRO plan is active</Text> : (
                <Pressable onPress={() => setTab(6)} style={((st: any) => ({ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 34, borderRadius: 9, cursor: 'pointer', backgroundColor: '#FFFFFF', opacity: st.hovered ? 0.92 : 1 })) as any}>
                  <Text style={{ color: '#14306B', fontSize: 12.5, fontWeight: '800' }}>Upgrade Now</Text><Icon name="arrow-forward" size={13} color="#14306B" />
                </Pressable>
              )}
            </View>
          </View>
        </View>
        {rightCol}
      </View>

      {/* footer */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 14, paddingBottom: 10, borderTopWidth: 1, borderTopColor: th.line }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
          {([['Home', 0], ['Analysis', 1], ['Markets', 2], ['Journal', 3], ['Tools', 4], ['News', 13]] as [string, number][]).map(([l, i]) => (
            <Pressable key={l} onPress={() => setTab(i)} style={{ cursor: 'pointer' } as any}><Text style={{ color: th.dim, fontSize: 12 }}>{l}</Text></Pressable>
          ))}
        </View>
        <Text style={{ color: th.dim, fontSize: 11.5 }}>Educational tool, not financial advice. Trading involves risk. © {new Date().getFullYear()} Chart Reader</Text>
      </View>
    </ScrollView>
  );
}
