import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import { useWindowDimensions } from '../win';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../store';
import { Screen, Card, Dim, Body, Btn, Badge, SectionTitle, Icon, TimeframeBar, Segment } from '../ui';
import { Checklist, Tile, SetupCard } from '../ProUI';
import NewsBanner from '../NewsBanner';
import GuardBanner from '../Guard';
import { analyzeAll } from '../refine';
import { crtAnalyze, refineScalp } from '../crt';
import { candlesAnalyze, GUIDE } from '../candles';
import MethodChart, { heikin } from '../MethodChart';
import { useSignalLog, Logged } from '../signalLog';
import TakeSkip from '../TakeSkip';
import { BodyProps } from '../embed';
import { Candle, SYMBOLS, TFS, symOf, isBad, useFeed, watchCandles, quotes, candleLeft, fmtLeft } from '../markets';

const SCALP_TFS = TFS.filter((x) => Number(x.k) <= 1800); // M1 .. M30
const TAB = 1;

export default function Scalping({ embedded, on, symId: symProp, setSymId: setSymProp }: BodyProps = {}) {
  const { th, t, tab, setPrefill, setTab } = useApp();
  const { width } = useWindowDimensions();
  const active = embedded ? !!on : tab === TAB;
  const { db } = useFeed(active);
  const [symLocal, setSymLocal] = useState('frxEURUSD');
  const symId = symProp ?? symLocal, setSymId = setSymProp ?? setSymLocal;
  const [tf, setTf] = useState('300');
  const [data, setData] = useState<Candle[]>([]);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [nonce, setNonce] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [view, setView] = useState<'scalp' | 'candle'>('scalp'); // which setup drives the hero, the chart levels and the card
  const [style, setStyle] = useState<'candle' | 'ha'>('candle');
  const [pats, setPats] = useState(true);
  const [guide, setGuide] = useState(false);

  useEffect(() => {
    if (!active) return;
    setData([]); setErr('');
    return watchCandles(symId, Number(tf), (c) => { setErr(''); setData(c); }, setErr);
  }, [active, symId, tf, nonce]);

  useEffect(() => { if (!active) return; const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, [active]);

  const sym = symOf(symId), dec = quotes[symId]?.dec ?? (data.length && data[data.length - 1].c >= 100 ? 2 : 5);
  const sessions = ['forex', 'indices'].includes(sym.cat);
  const all = useMemo(() => analyzeAll(data, new Date(), { sessions }), [data, sessions]);
  const { scalp } = all;
  const crt = useMemo(() => crtAnalyze(data, Number(tf), new Date(), { sessions, dec }), [data, tf, sessions, dec]);
  const fin = refineScalp(scalp, crt);
  const cdl = useMemo(() => candlesAnalyze(data), [data]);
  const f = (n: number) => n.toFixed(dec);
  const term = q.trim().toLowerCase();
  const found = term ? SYMBOLS.filter((x) => !isBad(x.id) && (x.name + x.id).toLowerCase().includes(term)).slice(0, 6) : [];
  const chips = [...new Set([...db.favs, 'frxEURUSD', 'frxXAUUSD', 'frxGBPUSD', 'cryBTCUSD', 'R_75'])].slice(0, 12);
  const tfLabel = TFS.find((x) => x.k === tf)?.label ?? tf;
  const left = candleLeft(Number(tf), now);

  // One shape for both setups, so the hero, chart and card do not care where it came from.
  const cs = cdl.setup;
  const cdlArmed = cs?.state === 'armed';
  const s = view === 'candle'
    ? (cs ? { side: cs.side, model: cs.pattern.name, score: cs.score, grade: cs.grade, entry: cs.entry, sl: cs.sl, tps: cs.tps as number[], rr: cs.rr as number[], source: 'Candle', state: cs.state as string | undefined, barsAgo: cs.pattern.age, note: cs.note, warn: undefined as string | undefined, confluence: cs.confluence } : null)
    : (fin ? { ...fin, tps: fin.tps as number[], rr: fin.rr as number[], state: fin.state as string | undefined, warn: fin.warn as string | undefined } : null);
  const armed = view === 'candle' ? cdlArmed : fin?.state === 'armed';
  const bc = s ? (s.side === 'buy' ? th.buy : th.sell) : th.gold;
  const status = view === 'candle' && !cdl.ok ? t('planNoData') : view === 'scalp' && !scalp.ok ? t('planNoData') : s ? (armed ? `${s.side === 'buy' ? t('buy') : t('sell')} · WAIT` : s.side === 'buy' ? t('buy') : t('sell')) : t('wait');
  const shown = useMemo(() => (style === 'ha' ? heikin(data) : data), [style, data]);

  // only the setup that is open goes to the Journal (before, the scalp AND the candle setup were logged together and could point opposite ways)
  const curSetup: Logged | null = view === 'candle'
    ? (cs ? { side: cs.side, entry: cs.entry, sl: cs.sl, tps: [...cs.tps], score: cs.score, grade: cs.grade, source: `Candle · ${cs.pattern.name}`, armed: cdlArmed } : null)
    : (fin ? { side: fin.side, entry: fin.entry, sl: fin.sl, tps: [...fin.tps], score: fin.score, grade: fin.grade, source: `Scalp · ${fin.source === 'Classic' ? fin.model : 'CRT'}`, armed: fin.state === 'armed' } : null);
  useSignalLog({ active, symId, name: sym.name, tf, dec, setup: curSetup });

  const body = (
      <View style={{ gap: 12 }}>
        <NewsBanner symId={symId} active={active} />
        <GuardBanner />
        {!symProp && (<>
        {/* ---------- search + symbols ---------- */}
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
        <TimeframeBar value={tf} options={SCALP_TFS} onChange={setTf} />

        <Segment value={view} onChange={(k) => setView(k as any)} options={[{ k: 'scalp', label: 'Scalp setup' }, { k: 'candle', label: 'Candlestick setup' }]} />

        {/* ---------- live signal hero ---------- */}
        <LinearGradient colors={[bc + '33', th.panel]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 8, borderWidth: 1, borderColor: bc + '66', padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="flash" size={16} color={th.gold} />
              <Text style={{ color: th.dim, fontWeight: '800', fontSize: 11, letterSpacing: 1.2 }}>{sym.name} · {tfLabel}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: th.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: th.line }}>
              <Icon name="timer-outline" size={13} color={th.accent} />
              <Text style={{ color: th.text, fontWeight: '800', fontSize: 12, fontVariant: ['tabular-nums'] }}>{fmtLeft(left)}</Text>
            </View>
          </View>
          <Text style={{ color: bc, fontSize: 34, fontWeight: '900', marginTop: 6 }}>{status}</Text>
          <Text style={{ color: th.dim, fontSize: 12.5, lineHeight: 18 }} numberOfLines={3}>
            {s ? `${s.model} · score ${s.score}/100 (${s.grade})${armed ? (view === 'candle' ? ' · waiting for confirmation' : ' · waiting for the shift') : ''}` : view === 'candle' ? (cdl.ok ? cdl.why : cdl.reason) : scalp.ok ? scalp.why : scalp.reason ?? t('planNoData')}
          </Text>
        </LinearGradient>

        {Number(tf) > 900 && (
          <Card>
            <Body color={th.gold}>Scalping works best on M1 to M5. You are on {tfLabel}.</Body>
            <View style={{ height: 8 }} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Btn ghost label="Use M1" onPress={() => setTf('60')} /></View>
              <View style={{ flex: 1 }}><Btn label="Use M5" onPress={() => setTf('300')} /></View>
            </View>
          </Card>
        )}

        {/* ---------- chart ---------- */}
        <Card style={{ padding: 8, direction: 'ltr' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 8, paddingHorizontal: 2 }}>
            {([['candle', 'Candles', 'bar-chart-outline'], ['ha', 'Heikin Ashi', 'swap-vertical-outline']] as const).map(([k, label, ic]) => {
              const on = style === k;
              return (
                <Pressable key={k} onPress={() => setStyle(k)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 30, borderRadius: 8, borderWidth: 1, borderColor: on ? th.accent : th.line, backgroundColor: on ? th.accent : th.bg }}>
                  <Icon name={ic} size={13} color={on ? th.onAccent : th.dim} />
                  <Text style={{ color: on ? th.onAccent : th.dim, fontSize: 11.5, fontWeight: '800' }}>{label}</Text>
                </Pressable>
              );
            })}
            <View style={{ flex: 1 }} />
            <Pressable onPress={() => setPats(!pats)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 30, borderRadius: 8, borderWidth: 1, borderColor: pats ? th.gold : th.line, backgroundColor: pats ? th.gold + '22' : th.bg }}>
              <Icon name={pats ? 'eye' : 'eye-off'} size={13} color={pats ? th.gold : th.dim} />
              <Text style={{ color: pats ? th.text : th.dim, fontSize: 11.5, fontWeight: '800' }}>Patterns</Text>
            </Pressable>
          </View>
          {err ? (
            <View style={{ gap: 12, padding: 8 }}><Body color={th.sell}>{err}</Body><Btn ghost label={t('retry')} onPress={() => setNonce((n) => n + 1)} /></View>
          ) : (
            <MethodChart data={shown} all={all} method={view === 'candle' ? 'candle' : 'scalp'} patterns={pats} width={width - 48} dec={dec} gran={Number(tf)}
              plan={s ? { entry: s.entry, sl: s.sl, tps: [...s.tps], tag: armed ? 'WAIT' : view === 'candle' ? 'CANDLE' : s.source === 'Classic' ? 'SCALP' : 'CRT' } : undefined}
              marks={crt.c1 ? [{ v: crt.c1.h, color: th.gold, label: `${crt.htfLabel} High` }, { v: crt.c1.l, color: th.gold, label: `${crt.htfLabel} Low` }, { v: crt.c1.eq, color: th.accent2, label: 'CRT 50%' }, ...(crt.mss && armed && view === 'scalp' ? [{ v: crt.mss.level, color: th.poi, label: 'Shift' }] : [])] : undefined}
              lines={scalp.ok ? [{ v: scalp.ema.e9, color: th.gold, label: 'EMA 9' }, { v: scalp.ema.e21, color: th.accent, label: 'EMA 21' }, { v: scalp.ema.e50, color: th.sell, label: 'EMA 50' }] : undefined} />
          )}
          {style === 'ha' && <Text style={{ color: th.dim, fontSize: 10.5, paddingTop: 6, paddingHorizontal: 4 }}>Heikin Ashi smooths the trend. Entry, stop and targets still use the real candles.</Text>}
        </Card>

        {/* ---------- CRT (Candle Range Theory) ---------- */}
        <Card glow={crt.state === 'triggered'}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <SectionTitle icon="resize-outline">{`CRT · ${crt.htfLabel} range`}</SectionTitle>
            <Badge label={!crt.ok ? 'NO DATA' : crt.state === 'triggered' ? 'TRIGGERED' : crt.state === 'armed' ? 'ARMED' : 'WAITING'} color={crt.state === 'triggered' ? th.buy : crt.state === 'armed' ? th.gold : th.dim} />
          </View>
          <View style={{ height: 10 }} />
          {crt.c1 ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[[`${crt.htfLabel} High`, crt.c1.h, th.sell], ['50%', crt.c1.eq, th.accent2], [`${crt.htfLabel} Low`, crt.c1.l, th.buy]].map(([k, v, c]: any) => (
                <View key={k} style={{ flex: 1, backgroundColor: th.bg, borderRadius: 8, borderWidth: 1, borderColor: th.line, padding: 10 }}>
                  <Text style={{ color: th.dim, fontSize: 10, fontWeight: '800' }}>{k}</Text>
                  <Text style={{ color: c, fontWeight: '900', marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit>{f(v)}</Text>
                </View>
              ))}
            </View>
          ) : <Body color={th.dim}>{crt.reason ?? 'Building the range candle...'}</Body>}
          <View style={{ height: 10 }} />
          <Body color={th.dim}>{crt.setup ? crt.setup.note : crt.why ?? crt.reason ?? ''}</Body>
          <View style={{ height: 8 }} />
          <Dim>{`1) C1 sets the range  2) C2 sweeps one side and closes back inside  3) wait for a ${crt.ltfLabel} shift  4) enter on the gap, stop beyond the sweep, target the other side.`}</Dim>
        </Card>

        {/* ---------- candlestick read ---------- */}
        {cdl.ok && (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <SectionTitle icon="stats-chart-outline">Candlestick read</SectionTitle>
              {cdl.best && <Badge label={cdl.best.status === 'confirmed' ? 'CONFIRMED' : 'UNCONFIRMED'} color={cdl.best.status === 'confirmed' ? th.buy : th.gold} />}
            </View>
            <View style={{ height: 8 }} />
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
              <View style={{ flex: 1, backgroundColor: th.bg, borderRadius: 8, borderWidth: 1, borderColor: th.line, padding: 10 }}>
                <Text style={{ color: th.dim, fontSize: 10, fontWeight: '800' }}>TREND INTO NOW</Text>
                <Text style={{ color: cdl.trend === 'up' ? th.buy : cdl.trend === 'down' ? th.sell : th.dim, fontWeight: '900', marginTop: 2 }}>{cdl.trend === 'up' ? 'Rising' : cdl.trend === 'down' ? 'Falling' : 'Sideways'}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: th.bg, borderRadius: 8, borderWidth: 1, borderColor: th.line, padding: 10 }}>
                <Text style={{ color: th.dim, fontSize: 10, fontWeight: '800' }}>CANDLE BIAS</Text>
                <Text style={{ color: cdl.bias === 'bullish' ? th.buy : cdl.bias === 'bearish' ? th.sell : th.gold, fontWeight: '900', marginTop: 2 }}>{cdl.bias === 'bullish' ? 'Bullish' : cdl.bias === 'bearish' ? 'Bearish' : 'Neutral'}</Text>
              </View>
            </View>
            {cdl.best ? (
              <>
                <Text style={{ color: cdl.best.dir === 'bullish' ? th.buy : th.sell, fontWeight: '900', fontSize: 16 }}>{cdl.best.dir === 'bullish' ? '▲' : '▼'} {cdl.best.name}</Text>
                <Dim>{cdl.best.note}</Dim>
                {!!fin && view === 'scalp' && ((fin.side === 'buy') !== (cdl.best.dir === 'bullish')) && <Text style={{ color: th.gold, marginTop: 6, lineHeight: 19 }}>The candle points the opposite way to the scalp setup. Wait or use a smaller size.</Text>}
                {!!fin && view === 'scalp' && ((fin.side === 'buy') === (cdl.best.dir === 'bullish')) && <Text style={{ color: th.buy, marginTop: 6, lineHeight: 19 }}>The candle agrees with the scalp setup.</Text>}
              </>
            ) : <Dim>{cdl.last ? `Latest candle: ${cdl.last.name}. ` : ''}{cdl.why}</Dim>}
            {cdl.list.length > 1 && (
              <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: th.line, paddingTop: 10, gap: 6 }}>
                <Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8 }}>LAST 6 CANDLES</Text>
                {cdl.list.slice(0, 5).map((q2, i) => (
                  <View key={q2.key + i} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <Text style={{ color: q2.dir === 'bullish' ? th.buy : q2.dir === 'bearish' ? th.sell : th.gold, fontWeight: '800', fontSize: 13, flexShrink: 1 }}>{q2.dir === 'bullish' ? '▲' : q2.dir === 'bearish' ? '▼' : '●'} {q2.name}</Text>
                    <Text style={{ color: th.dim, fontSize: 12 }}>{q2.age === 0 ? 'now' : `${q2.age} ago`} · {q2.strength}/100</Text>
                  </View>
                ))}
              </View>
            )}
            <Pressable onPress={() => setGuide(!guide)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: th.line }}>
              <Text style={{ color: th.accent, fontWeight: '800', fontSize: 13 }}>Pattern guide</Text>
              <Icon name={guide ? 'chevron-up' : 'chevron-down'} size={18} color={th.dim} />
            </Pressable>
            {guide && (
              <View style={{ marginTop: 8, gap: 10 }}>
                {GUIDE.map((g) => (
                  <View key={g.name}>
                    <Text style={{ color: g.dir === 'bullish' ? th.buy : g.dir === 'bearish' ? th.sell : th.gold, fontWeight: '900' }}>{g.name} · {g.candles} candle{g.candles > 1 ? 's' : ''}</Text>
                    <Dim>{g.shows}</Dim>
                    <Dim>{`How to trade: ${g.trade}`}</Dim>
                  </View>
                ))}
                <Dim>Rules: trade a pattern only at the end of a trend, wait for the confirmation candle, and put the stop just beyond the pattern.</Dim>
              </View>
            )}
          </Card>
        )}

        {/* ---------- conditions ---------- */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Tile label="EMA 9/21/50" value={scalp.trend === 'up' ? 'Up' : scalp.trend === 'down' ? 'Down' : 'Flat'} color={scalp.trend === 'up' ? th.buy : scalp.trend === 'down' ? th.sell : th.gold} sub={isFinite(scalp.rsi7) ? `RSI(7) ${scalp.rsi7.toFixed(0)}` : undefined} />
          <Tile label="Volatility" value={scalp.vol === 'ok' ? 'Healthy' : scalp.vol === 'dead' ? 'Too quiet' : 'Too wild'} color={scalp.vol === 'ok' ? th.buy : th.gold} sub={`${scalp.volRatio.toFixed(1)}x normal`} />
          <Tile label="Session" value={scalp.session ? (scalp.session.good ? 'Active' : 'Slow') : '24h'} color={!scalp.session || scalp.session.good ? th.buy : th.gold} sub={scalp.session?.name} />
        </View>

        {view === 'scalp' && !scalp.ok && <Card><Body color={th.gold}>{scalp.reason ?? t('planNoData')}</Body></Card>}
        {view === 'candle' && cdl.ok && !s && <Card><SectionTitle icon="hourglass-outline">No candlestick trade</SectionTitle><View style={{ height: 6 }} /><Body color={th.dim}>{cdl.why}</Body></Card>}
        {view === 'scalp' && scalp.ok && !s && <Card><SectionTitle icon="hourglass-outline">No scalp trigger</SectionTitle><View style={{ height: 6 }} /><Body color={th.dim}>{scalp.why}</Body></Card>}
        {armed && <Card style={{ borderColor: th.gold }}><Body color={th.gold}>{view === 'candle' ? 'Do not enter yet. Wait for the confirmation candle. The entry shown is the break level that confirms the pattern.' : `Do not enter yet. This setup is ARMED: the sweep happened, but the ${crt.ltfLabel} shift candle has not closed. The entry shown is the shift level.`}</Body></Card>}
        {s && (
          <SetupCard side={s.side} model={s.model} score={s.score} grade={s.grade} entry={s.entry} sl={s.sl} tps={s.tps} rr={s.rr} f={f}
            onSend={() => { setPrefill({ entry: s.entry, sl: s.sl, tps: [...s.tps], symbol: sym.name }); setTab(4); }}
            badge={<View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}><Badge label={s.source} color={s.source === 'Classic' ? th.dim : th.gold} />{!!s.state && <Badge label={armed ? 'ARMED' : view === 'candle' ? 'CONFIRMED' : 'TRIGGERED'} color={armed ? th.gold : th.buy} />}</View>}
            note={`${armed ? '' : s.barsAgo === 0 ? 'Trigger candle just closed.' : `Trigger was ${s.barsAgo} candles ago, check price is still near the entry.`} ${s.note}${s.warn ? ' ' + s.warn : ''} This setup is also saved in your Journal.`} />
        )}
        {curSetup && <TakeSkip symId={symId} name={sym.name} tf={tf} dec={dec} setup={curSetup} />}
        {s && <Card><SectionTitle icon="checkmark-done-outline">{t('confluence')}</SectionTitle><View style={{ height: 8 }} /><Checklist items={s.confluence} /></Card>}

        <Card>
          <SectionTitle icon="flash-outline">Scalping rules</SectionTitle>
          <View style={{ height: 8 }} />
          <Body>1. Trade only in an active session with healthy volatility.</Body>
          <Body>2. Enter on the close of the trigger candle, never in the middle of it.</Body>
          <Body>3. Keep the stop tight and risk 0.5 to 1% per trade.</Body>
          <Body>4. Close half at TP1 and move the stop to break-even.</Body>
          <Body>5. Two losses in a row: stop for 30 minutes. Skip news.</Body>
          <Body>6. CRT: never enter on the sweep alone. Wait for the shift candle to close.</Body>
        </Card>
        <Dim>Educational tool, not financial advice. Test on a demo account first.</Dim>
      </View>
  );
  return embedded ? body : <Screen icon="speedometer" title={t('tabScalp')} subtitle={t('navDescScalp')} right={<Badge label="PRO" color={th.gold} />}>{body}</Screen>;
}
