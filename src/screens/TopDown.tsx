import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import { useWindowDimensions } from '../win';
import { useApp } from '../store';
import { useSignalLog, Logged } from '../signalLog';
import TakeSkip from '../TakeSkip';
import { BodyProps } from '../embed';
import { Screen, Card, Dim, Body, Btn, Segment, Row, Badge, SectionTitle, Icon, TimeframeBar } from '../ui';
import { TpLadder, ScoreRing, Checklist } from '../ProUI';
import NewsBanner from '../NewsBanner';
import { analyzeAll } from '../refine';
import MethodChart from '../MethodChart';
import { topDownAnalyze } from '../topdown';
import { TP_SPLIT } from '../gemini';
import { Candle, SYMBOLS, TFS, symOf, isBad, useFeed, watchCandles, quotes } from '../markets';

const COUNT = 320; // enough history for a real EMA 200
// Top-Down works with ANY three timeframes: the biggest decides the side, the middle finds the zone, the smallest times the entry.
const PRESETS: { k: string; label: string; tfs: [string, string, string] }[] = [
  { k: 'swing', label: 'Swing', tfs: ['86400', '14400', '3600'] },
  { k: 'day', label: 'Intraday', tfs: ['14400', '3600', '900'] },
  { k: 'scalp', label: 'Scalp', tfs: ['3600', '900', '300'] },
  { k: 'fast', label: 'Fast', tfs: ['900', '300', '60'] },
];
const tfName = (k: string) => TFS.find((x) => x.k === k)?.label ?? k;

export default function TopDown({ embedded, on, symId: symProp, setSymId: setSymProp }: BodyProps = {}) {
  const { th, t, tab, setPrefill, setTab } = useApp();
  const { width } = useWindowDimensions();
  const active = embedded ? !!on : tab === 10;
  const { db } = useFeed(active);
  const [symLocal, setSymLocal] = useState('frxEURUSD');
  const symId = symProp ?? symLocal, setSymId = setSymProp ?? setSymLocal;
  const [q, setQ] = useState('');
  const [d4, setD4] = useState<Candle[]>([]);
  const [d1, setD1] = useState<Candle[]>([]);
  const [d15, setD15] = useState<Candle[]>([]);
  const [err, setErr] = useState({ h4: '', h1: '', m15: '' });
  const [nonce, setNonce] = useState(0);
  const [view, setView] = useState('h1');
  const [tfs, setTfs] = useState<[string, string, string]>(PRESETS[1].tfs);
  const L = tfs.map(tfName) as [string, string, string];
  const STAGES = [{ k: 'h4', label: L[0] }, { k: 'h1', label: L[1] }, { k: 'm15', label: L[2] }];
  const preset = PRESETS.find((p) => p.tfs.join() === tfs.join())?.k ?? 'custom';
  const setOne = (i: number, k: string) => setTfs((o) => { const n = [...o] as [string, string, string]; n[i] = k; return n; });
  const ordered = Number(tfs[0]) > Number(tfs[1]) && Number(tfs[1]) > Number(tfs[2]);
  // the analysis text is written with 4H / 1H / 15m; show the timeframes the person actually picked
  const rl = (s?: string) => (s ?? '').replace(/\b(4H|1H|15m)\b/g, (m) => (m === '4H' ? L[0] : m === '1H' ? L[1] : L[2]));

  useEffect(() => {
    if (!active) return;
    setD4([]); setD1([]); setD15([]); setErr({ h4: '', h1: '', m15: '' });
    const un = [
      watchCandles(symId, Number(tfs[0]), (c) => { setErr((e) => ({ ...e, h4: '' })); setD4(c); }, (m) => setErr((e) => ({ ...e, h4: m })), undefined, COUNT),
      watchCandles(symId, Number(tfs[1]), (c) => { setErr((e) => ({ ...e, h1: '' })); setD1(c); }, (m) => setErr((e) => ({ ...e, h1: m })), undefined, COUNT),
      watchCandles(symId, Number(tfs[2]), (c) => { setErr((e) => ({ ...e, m15: '' })); setD15(c); }, (m) => setErr((e) => ({ ...e, m15: m })), undefined, COUNT),
    ];
    return () => un.forEach((f) => f());
  }, [active, symId, nonce, tfs.join()]);

  const sym = symOf(symId), dec = quotes[symId]?.dec ?? (d1.length && d1[d1.length - 1].c >= 100 ? 2 : 5);
  const f = (n: number) => (isFinite(n) ? n.toFixed(dec) : '-');
  const td = useMemo(() => (d4.length && d1.length && d15.length ? topDownAnalyze(d4, d1, d15) : null), [d4, d1, d15]);
  const tdSetup: Logged | null = td?.plan && td.verdict !== 'skip' ? { side: td.plan.side, entry: td.plan.entry, sl: td.plan.sl, tps: [...td.plan.tps], score: td.score, grade: td.grade, source: 'Top-Down', armed: td.verdict === 'watch' } : null;
  useSignalLog({ active, symId, name: sym.name, tf: L.join('/'), dec, setup: tdSetup });
  const chartData = view === 'h4' ? d4 : view === 'h1' ? d1 : d15;
  const chartAll = useMemo(() => (chartData.length > 40 ? analyzeAll(chartData) : null), [chartData]);

  const term = q.trim().toLowerCase();
  const found = term ? SYMBOLS.filter((x) => !isBad(x.id) && (x.name + x.id).toLowerCase().includes(term)).slice(0, 6) : [];
  const chips = [...new Set([...db.favs, 'frxEURUSD', 'frxXAUUSD', 'cryBTCUSD', 'R_75'])].slice(0, 12);
  const loading = !td && !err.h4 && !err.h1 && !err.m15;
  const firstErr = err.h4 || err.h1 || err.m15;

  const bias = td?.bias ?? 'wait';
  const bc = bias === 'buy' ? th.buy : bias === 'sell' ? th.sell : th.gold;
  const sc = td ? (td.score >= 70 ? th.buy : td.score >= 50 ? th.gold : th.sell) : th.dim;
  const vTxt = td?.verdict === 'ready' ? 'READY: all three timeframes agree' : td?.verdict === 'watch' ? `WATCH: wait for the ${L[2]} to confirm` : 'NO TRADE: the timeframes do not line up';
  const vCol = td?.verdict === 'ready' ? th.buy : td?.verdict === 'watch' ? th.gold : th.sell;
  const dirCol = (d: string | null | undefined) => (d === 'buy' || d === 'bullish' ? th.buy : d === 'sell' || d === 'bearish' ? th.sell : th.gold);
  const trendTxt = (x: string) => (x === 'bullish' ? 'Bullish' : x === 'bearish' ? 'Bearish' : 'Sideways');

  const Stage = ({ n, tf, title, ok, children }: { n: number; tf: string; title: string; ok: boolean | null; children: React.ReactNode }) => (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: th.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: th.onAccent, fontWeight: '900', fontSize: 12 }}>{tf}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: th.text, fontWeight: '800', fontSize: 15 }}>Step {n}: {title}</Text>
        </View>
        {ok !== null && <Icon name={ok ? 'checkmark-circle' : 'alert-circle'} size={22} color={ok ? th.buy : th.gold} />}
      </View>
      {children}
    </Card>
  );

  const lines = td && chartAll ? [{ v: view === 'h4' ? td.ema200.h4 : view === 'h1' ? td.ema200.h1 : td.ema200.m15, color: th.gold, label: view === 'h4' ? `EMA ${td.h4.emaLen}` : chartData.length >= 215 ? 'EMA 200' : 'EMA' }] : undefined;
  const planLine = td?.plan ? { entry: td.plan.entry, sl: td.plan.sl, tps: td.plan.tps, tag: 'PLAN' } : null;

  const body = (
      <View style={{ gap: 12 }}>
        <NewsBanner symId={symId} active={active} />
        {!symProp && (<>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: th.panel, borderColor: th.line, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12 }}>
          <Icon name="search" size={18} color={th.dim} />
          <TextInput value={q} onChangeText={setQ} placeholder={t('search')} placeholderTextColor={th.dim} autoCapitalize="none" style={{ flex: 1, color: th.text, padding: 12 }} />
          {!!q && <Pressable onPress={() => setQ('')} hitSlop={10}><Icon name="close-circle" size={18} color={th.dim} /></Pressable>}
        </View>
        {found.length > 0 && (
          <Card style={{ padding: 6 }}>
            {found.map((x) => (
              <Pressable key={x.id} onPress={() => { setSymId(x.id); setQ(''); }} style={{ padding: 10, flexDirection: 'row', justifyContent: 'space-between' }}>
                <Body bold>{x.name}</Body><Dim>{x.id}</Dim>
              </Pressable>
            ))}
          </Card>
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {chips.map((id) => {
            const on = id === symId;
            return (
              <Pressable key={id} onPress={() => setSymId(id)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: on ? th.accent : th.line, backgroundColor: on ? th.accent : th.panel }}>
                <Text style={{ color: on ? th.onAccent : th.dim, fontWeight: '700', fontSize: 13 }}>{symOf(id).name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        </>)}

        {/* ---------- timeframe selector: every timeframe is available ---------- */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <SectionTitle icon="time-outline">Timeframes</SectionTitle>
            <Badge label={preset === 'custom' ? 'Custom' : (PRESETS.find((p) => p.k === preset)?.label ?? '')} color={th.accent} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>
            {PRESETS.map((p) => {
              const on = p.k === preset;
              return (
                <Pressable key={p.k} onPress={() => setTfs(p.tfs)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: on ? th.accent : th.line, backgroundColor: on ? th.accent : th.bg }}>
                  <Text style={{ color: on ? th.onAccent : th.dim, fontWeight: '800', fontSize: 12.5 }}>{p.label}</Text>
                  <Text style={{ color: th.dim, fontSize: 10.5 }}>{p.tfs.map(tfName).join(' · ')}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {(['Direction', 'Zone', 'Entry'] as const).map((lab, i) => (
            <View key={lab} style={{ marginTop: i ? 8 : 0 }}>
              <Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '800', letterSpacing: 1, marginBottom: 4 }}>STEP {i + 1} · {lab.toUpperCase()}</Text>
              <TimeframeBar value={tfs[i]} options={TFS} onChange={(k) => setOne(i, k)} />
            </View>
          ))}
          {!ordered && <View style={{ marginTop: 10 }}><Body color={th.gold}>Tip: pick them from big to small (Direction biggest, Entry smallest) for the cleanest read.</Body></View>}
        </Card>

        {/* ---------- verdict ---------- */}
        {loading && <Card><Body color={th.dim}>Loading {L[0]}, {L[1]} and {L[2]} candles for {sym.name}…</Body></Card>}
        {!td && !!firstErr && (
          <Card>
            <Body color={th.sell}>{rl(firstErr)}</Body>
            <View style={{ height: 8 }} />
            <Btn ghost label={t('retry')} onPress={() => setNonce((n) => n + 1)} />
          </Card>
        )}
        {td && !td.ok && <Card><Body color={th.gold}>{rl(td.reason)}</Body><View style={{ height: 8 }} /><Btn ghost label={t('retry')} onPress={() => setNonce((n) => n + 1)} /></Card>}

        {td?.ok && (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <ScoreRing score={td.score} color={sc} label={td.grade} size={78} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: bc, fontSize: 26, fontWeight: '900' }}>{bias === 'wait' ? t('wait') : t(bias)}</Text>
                <Text style={{ color: vCol, fontWeight: '800', fontSize: 12.5 }}>{vTxt}</Text>
                <Dim>{t('confluenceScore')} {td.score}/100</Dim>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              {[[L[0], td.h4.direction ? true : false, td.h4.direction ? (td.h4.direction === 'buy' ? 'Bullish' : 'Bearish') : 'Mixed'],
                [L[1], !!td.h1.poi?.near, td.h1.poi ? (td.h1.poi.near ? 'Zone near' : 'Zone far') : 'No zone'],
                [L[2], td.m15.confirmed, td.m15.confirmed ? 'Confirmed' : `${td.m15.count}/4`]].map(([k, ok, txt]) => (
                <View key={String(k)} style={{ flex: 1, borderRadius: 8, borderWidth: 1, borderColor: (ok ? th.buy : th.line), backgroundColor: ok ? th.buy + '14' : th.bg, paddingVertical: 8, alignItems: 'center' }}>
                  <Text style={{ color: th.dim, fontSize: 10, fontWeight: '800' }}>{String(k)}</Text>
                  <Text style={{ color: ok ? th.buy : th.text, fontWeight: '800', fontSize: 12.5 }}>{String(txt)}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* ---------- chart ---------- */}
        {td?.ok && (
          <>
            <Segment value={view} options={STAGES} onChange={setView} />
            <Card style={{ padding: 8, direction: 'ltr' }}>
              {chartAll ? <MethodChart data={chartData} all={chartAll} method="ict" width={width - 48} dec={dec} lines={lines} plan={planLine} symId={symId} gran={Number(tfs[view === 'h4' ? 0 : view === 'h1' ? 1 : 2])} /> : <View style={{ padding: 20 }}><Dim>Loading chart…</Dim></View>}
            </Card>
          </>
        )}

        {/* ---------- step 1: 4H ---------- */}
        {td?.ok && (
          <Stage n={1} tf={L[0]} title="Direction, key levels, supply and demand" ok={!!td.h4.direction}>
            <Row k="Direction" v={td.h4.direction ? (td.h4.direction === 'buy' ? 'Bullish: look for buys' : 'Bearish: look for sells') : 'Mixed: no trade'} color={dirCol(td.h4.direction)} />
            <Row k="Structure" v={trendTxt(td.h4.trend)} color={dirCol(td.h4.trend)} />
            <Row k={`EMA ${td.h4.emaLen}${td.h4.emaApprox ? ' (short history)' : ''}`} v={`${f(td.h4.ema200)} · price ${td.h4.aboveEma ? 'above' : 'below'} · slope ${td.h4.slope}`} color={td.h4.aboveEma ? th.buy : th.sell} />
            <Row k="RSI(14)" v={isFinite(td.h4.rsi) ? td.h4.rsi.toFixed(0) : '-'} />
            <Row k="MACD" v={td.h4.macdRising ? 'Histogram rising' : 'Histogram falling'} color={td.h4.macdRising ? th.buy : th.sell} />
            <View style={{ height: 6 }} />
            <Text style={{ color: th.dim, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>KEY LEVELS</Text>
            {td.h4.resistance.length === 0 && td.h4.support.length === 0 && <Dim>No clear swing levels in this range.</Dim>}
            {[...td.h4.resistance].reverse().map((l, i) => <Row key={`r${i}`} k={`Resistance${l.touches > 1 ? ` (${l.touches} touches)` : ''}`} v={f(l.price)} color={th.sell} />)}
            {td.h4.support.map((l, i) => <Row key={`s${i}`} k={`Support${l.touches > 1 ? ` (${l.touches} touches)` : ''}`} v={f(l.price)} color={th.buy} />)}
            <View style={{ height: 6 }} />
            <Text style={{ color: th.dim, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>SUPPLY AND DEMAND</Text>
            {td.h4.supply.length === 0 && td.h4.demand.length === 0 && <Dim>No fresh zones on the {L[0]}.</Dim>}
            {td.h4.supply.map((z, i) => <Row key={`su${i}`} k={`Supply${z.fresh ? '' : ' (tested)'}`} v={`${f(z.bottom)} - ${f(z.top)}`} color={th.sell} />)}
            {td.h4.demand.map((z, i) => <Row key={`de${i}`} k={`Demand${z.fresh ? '' : ' (tested)'}`} v={`${f(z.bottom)} - ${f(z.top)}`} color={th.buy} />)}
            {(td.h4.atZone || td.h4.atLevel) && (
              <Body color={th.accent}>Price is at {td.h4.atZone ? `a ${td.h4.atZone.kind} zone` : `${td.h4.atLevel!.kind} ${f(td.h4.atLevel!.price)}`}.</Body>
            )}
          </Stage>
        )}

        {/* ---------- step 2: 1H ---------- */}
        {td?.ok && (
          <Stage n={2} tf={L[1]} title="Trend, breaks, order block, FVG, liquidity" ok={td.h1.ok && td.h1.poi ? td.h1.poi.near : false}>
            {!td.h1.ok && <Body color={th.gold}>{rl(td.h1.reason)}</Body>}
            <Row k="Trend" v={`${trendTxt(td.h1.trend)}${td.h4.direction ? (td.h1.aligned ? ` · agrees with ${L[0]}` : td.h1.counter ? ` · against ${L[0]}` : '') : ''}`} color={dirCol(td.h1.trend)} />
            <Row k="EMA 200" v={`${f(td.h1.ema200)} · price ${td.h1.aboveEma ? 'above' : 'below'}`} color={td.h1.aboveEma ? th.buy : th.sell} />
            <Row k="Last break" v={td.h1.lastBreak ? `${td.h1.lastBreak.kind === 'CHoCH' ? 'Reversal (CHoCH)' : 'Break (BOS)'} ${td.h1.lastBreak.dir} · ${td.h1.breakAgo} candles ago` : 'None'} color={td.h1.lastBreak ? dirCol(td.h1.lastBreak.dir) : th.dim} />
            <Row k="RSI(14)" v={isFinite(td.h1.rsi) ? td.h1.rsi.toFixed(0) : '-'} />
            <Row k="MACD" v={td.h1.macdHist > 0 ? 'Above signal' : 'Below signal'} color={td.h1.macdHist > 0 ? th.buy : th.sell} />
            <View style={{ height: 6 }} />
            <Text style={{ color: th.dim, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>ORDER BLOCKS AND FVG</Text>
            {td.h1.orderBlocks.length === 0 && td.h1.fvgs.length === 0 && <Dim>None found.</Dim>}
            {td.h1.orderBlocks.map((z, i) => <Row key={`o${i}`} k={`${z.side === 'bullish' ? '▲' : '▼'} OB${z.fresh ? '' : ' (tested)'}`} v={`${f(z.bottom)} - ${f(z.top)}`} color={z.side === 'bullish' ? th.buy : th.sell} />)}
            {td.h1.fvgs.map((z, i) => <Row key={`g${i}`} k={`${z.side === 'bullish' ? '▲' : '▼'} FVG${z.fresh ? '' : ' (tested)'}`} v={`${f(z.bottom)} - ${f(z.top)}`} color={z.side === 'bullish' ? th.buy : th.sell} />)}
            <View style={{ height: 6 }} />
            <Text style={{ color: th.dim, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>LIQUIDITY</Text>
            {td.h1.sweep && <Row k="Recent sweep" v={`${td.h1.sweep.side === 'SSL' ? 'Sell-side' : 'Buy-side'} at ${f(td.h1.sweep.price)}`} color={td.h1.sweepOk ? th.buy : th.gold} />}
            {td.h1.liquidity.filter((l) => !l.swept).slice(-4).reverse().map((l, i) => <Row key={`l${i}`} k={`${l.side === 'BSL' ? t('buySideLiq') : t('sellSideLiq')}${l.equal ? ' · EQ' : ''}`} v={f(l.price)} />)}
            {td.h1.poi && (
              <>
                <View style={{ height: 6 }} />
                <Body color={th.accent}>Entry zone: {td.h1.poi.kind === 'OB' ? 'order block' : 'FVG'} {f(td.h1.poi.bottom)} - {f(td.h1.poi.top)}{td.h1.poi.confluence ? ' (lines up with the {L[0]})' : ''}, {td.h1.poi.near ? 'price is close' : 'price is still far'}.</Body>
              </>
            )}
          </Stage>
        )}

        {/* ---------- step 3: 15m ---------- */}
        {td?.ok && (
          <Stage n={3} tf={L[2]} title="Confirmation" ok={td.m15.confirmed}>
            {!td.h4.direction && <Body color={th.gold}>No {L[0]} direction, so there is nothing to confirm yet.</Body>}
            <Row k="Zone tapped" v={td.m15.tapped ? 'Yes' : 'Not yet'} color={td.m15.tapped ? th.buy : th.dim} />
            <Row k="Confirmation candle" v={td.m15.candle ?? 'None yet'} color={td.m15.candle ? th.buy : th.dim} />
            <Row k="Structure shift" v={td.m15.shift ? 'Yes, in trade direction' : 'Not yet'} color={td.m15.shift ? th.buy : th.dim} />
            <Row k="RSI(14)" v={`${isFinite(td.m15.rsi) ? td.m15.rsi.toFixed(0) : '-'} · ${td.m15.rsiOk ? 'agrees' : 'not confirming'}`} color={td.m15.rsiOk ? th.buy : th.dim} />
            <Row k="MACD" v={td.m15.macdOk ? 'Turning with the trade' : 'Not confirming'} color={td.m15.macdOk ? th.buy : th.dim} />
            <Row k={`EMA 200`} v={`${f(td.m15.ema200)} · price ${td.m15.aboveEma ? 'above' : 'below'}`} color={td.m15.aboveEma ? th.buy : th.sell} />
            <Dim>Confirmed means the zone was tapped and at least 3 of the 4 signals agree ({td.m15.count}/4 now).</Dim>
          </Stage>
        )}

        {/* ---------- plan ---------- */}
        {td?.ok && !td.plan && td.h4.direction && <Card><SectionTitle icon="hourglass-outline">No entry plan yet</SectionTitle><View style={{ height: 6 }} /><Body color={th.dim}>The {L[1]} has no order block or FVG in the {td.h4.direction === 'buy' ? 'buy' : 'sell'} direction close enough to trade. Wait for price to build one.</Body></Card>}
        {td?.ok && td.plan && (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ color: td.plan.side === 'buy' ? th.buy : th.sell, fontSize: 24, fontWeight: '900', flex: 1 }}>{t(td.plan.side)} · {td.plan.mode === 'market' ? 'Market' : 'Limit'}</Text>
              <Badge label={td.verdict === 'ready' ? 'READY' : 'WAIT'} color={td.verdict === 'ready' ? th.buy : th.gold} />
            </View>
            <Dim>{rl(td.plan.basis)}</Dim>
            <View style={{ height: 10 }} />
            <Row k={t('ictRefined')} v={f(td.plan.entry)} color={th.accent} />
            <Row k={t('sl')} v={f(td.plan.sl)} color={th.sell} />
            <View style={{ height: 8 }} />
            <TpLadder rows={td.plan.tps.map((p, i) => ({ label: `TP${i + 1}`, price: f(p), split: TP_SPLIT[i], r: `${td.plan!.rr[i].toFixed(1)}R` }))} />
            {td.plan.notes.map((n, i) => <View key={i} style={{ marginTop: 8 }}><Dim>{rl(n)}</Dim></View>)}
            <View style={{ height: 12 }} />
            <Btn label={t('sendRisk')} icon="calculator-outline" onPress={() => { setPrefill({ entry: td.plan!.entry, sl: td.plan!.sl, tps: [...td.plan!.tps], symbol: sym.name }); setTab(4); }} />
          </Card>
        )}

        {tdSetup && td?.ok && td.plan && <TakeSkip symId={symId} name={sym.name} tf={L.join('/')} dec={dec} setup={tdSetup} />}

        {/* ---------- checklist ---------- */}
        {td?.ok && (
          <Card>
            <SectionTitle icon="checkmark-done-outline">{t('confluence')}</SectionTitle>
            <View style={{ height: 8 }} />
            <Checklist items={td.checks.map((c) => ({ ok: c.ok, text: `[${c.stage === '4H' ? L[0] : c.stage === '1H' ? L[1] : c.stage === '15m' ? L[2] : c.stage}] ${rl(c.text)}` }))} />
          </Card>
        )}
        <Dim>Top-down means the big timeframe decides the side, the middle one finds the zone and the small one times the entry. Educational tool, not financial advice. Test on a demo account first.</Dim>
      </View>
  );
  return embedded ? body : <Screen icon="layers" title={t('tabTopDown')} subtitle={t('navDescTopDown')} right={<Badge label="PRO" color={th.gold} />}>{body}</Screen>;
}
