import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import { useWindowDimensions } from '../win';
import { useApp } from '../store';
import { Screen, Card, Dim, Body, Btn, Row, Badge, SectionTitle, Icon, TimeframeBar } from '../ui';
import { TpLadder, ScoreRing, Checklist, Tile, SetupCard } from '../ProUI';
import NewsBanner from '../NewsBanner';
import { analyzeAll, methodsContext } from '../refine';
import MethodChart, { Method } from '../MethodChart';
import { VSA_NAMES, VSA_RULE, VSA_HELP } from '../vsa';
import { realVolumeSource } from '../realvol';
import { GUIDE } from '../candles';
import { analyzeMarket, MarketAI, TP_SPLIT } from '../gemini';
import { useSignalLog, Logged } from '../signalLog';
import TakeSkip from '../TakeSkip';
import VsaCard from '../VsaCard';
import { BodyProps } from '../embed';
import { LANGS } from '../i18n';
import { Candle, SYMBOLS, TFS, symOf, isBad, useFeed, watchCandles, quotes } from '../markets';
import { ictAnalyze, ICT_HTF } from '../ict';
import { smcAnalyze } from '../smc';
import { IctVerdict, IctSteps, IctBiasCard, IctTime, IctLevels, IctSettings, IctGuide, useIctParams } from '../IctPanels';
import { useNews, newsRisk, currenciesOf, fmtIn } from '../news';

export default function ICTLab({ embedded, on, symId: symProp, setSymId: setSymProp, method: methodProp }: BodyProps = {}) {
  const { th, t, tab, settings, apiKey, setPrefill, setTab } = useApp();
  const { width } = useWindowDimensions();
  const active = embedded ? !!on : tab === 7;
  const { db } = useFeed(active);
  const [symLocal, setSymLocal] = useState('frxEURUSD');
  const symId = symProp ?? symLocal, setSymId = setSymProp ?? setSymLocal;
  const [tf, setTf] = useState('900');
  const [data, setData] = useState<Candle[]>([]);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [ai, setAi] = useState<MarketAI | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiErr, setAiErr] = useState('');
  const [nonce, setNonce] = useState(0);
  const [methodLocal, setMethod] = useState<Method>('all');
  const method = (methodProp ?? methodLocal) as Method;

  useEffect(() => {
    if (!active) return;
    setData([]); setErr(''); setAi(null); setAiErr('');
    return watchCandles(symId, Number(tf), (c) => { setErr(''); setData(c); }, setErr, undefined, method === 'ict' ? 400 : 120); // ICT needs more history for the previous day / Asian levels
  }, [active, symId, tf, nonce, method === 'ict']);

  // ICT bias comes from a higher timeframe (guide: 4H / 1H for bias). Auto picks it from the chart timeframe.
  const [htf, setHtf] = useState<Candle[]>([]);
  const [biasTf, setBiasTf] = useState('auto');
  const ictp = useIctParams();
  const htfGran = method === 'ict' || method === 'smc' ? (biasTf === 'auto' ? (ICT_HTF[Number(tf)] ?? 0) : Number(biasTf)) : 0;
  const htfOn = htfGran > Number(tf);
  useEffect(() => {
    setHtf([]);
    if (!active || !htfOn) return;
    return watchCandles(symId, htfGran, (c) => setHtf(c), () => {}, undefined, 200);
  }, [active, symId, htfGran, htfOn, nonce]);
  const { events } = useNews(active && method === 'ict');

  const sym = symOf(symId), dec = quotes[symId]?.dec ?? (data.length && data[data.length - 1].c >= 100 ? 2 : 5);
  const sessions = ['forex', 'indices'].includes(sym.cat); // synthetic indices and crypto trade around the clock
  const all = useMemo(() => analyzeAll(data, new Date(), { sessions }), [data, sessions]);
  const { ict, smc, vsa, pat, cdl, combo } = all;
  const [guide, setGuide] = useState(false);
  const newsText = useMemo(() => { const r = newsRisk(currenciesOf(symId), events, Date.now()); return r.level === 'danger' && r.event ? `${r.event.cur} ${r.event.title} in ${fmtIn(r.mins)}` : null; }, [events, symId, data]);
  const htfData = htfOn && htf.length >= 40 ? htf : undefined;
  const ictX = useMemo(() => (method === 'ict' ? ictAnalyze(data, new Date(), { htf: htfData, params: ictp.params, news: newsText }) : ict), [method, data, htfData, ictp.params, newsText, ict]);
  const smcX = useMemo(() => (method === 'smc' ? smcAnalyze(data, { htf: htfData }) : smc), [method, data, htfData, smc]);
  const chartAll = useMemo(() => (method === 'ict' ? { ...all, ict: ictX } : method === 'smc' ? { ...all, smc: smcX } : all), [all, ictX, smcX, method]);
  const s = ictX.setup, f = (n: number) => n.toFixed(dec);
  const htfLabel = (TFS.find((x) => x.k === String(htfGran))?.label ?? 'HTF') + ' BIAS';
  const term = q.trim().toLowerCase();
  const found = term ? SYMBOLS.filter((x) => !isBad(x.id) && (x.name + x.id).toLowerCase().includes(term)).slice(0, 6) : [];
  const chips = [...new Set([...db.favs, 'frxEURUSD', 'frxXAUUSD', 'cryBTCUSD', 'R_75'])].slice(0, 12);
  const sc = s ? (s.score >= 70 ? th.buy : s.score >= 50 ? th.gold : th.sell) : th.dim;
  const bc = s ? (s.side === 'buy' ? th.buy : th.sell) : th.gold;

  // the setup of the view that is open goes to the Journal by itself
  const GR: Record<string, number> = { 'A+': 90, A: 80, B: 65, C: 50 };
  const cur: Logged | null = (() => {
    type X = { side: 'buy' | 'sell'; entry: number; sl: number; tps: number[]; score: number; grade: string };
    const z = (x: X | undefined | null, source: string, armed?: boolean, extra?: { why?: string[]; zone?: [number, number]; level?: number }): Logged | null => (x ? { side: x.side, entry: x.entry, sl: x.sl, tps: [...x.tps], score: x.score, grade: x.grade, source, armed, ...extra } : null);
    const ck = (l?: { text: string; ok: boolean }[]) => (l ?? []).filter((q) => q.ok).slice(0, 5).map((q) => q.text);
    if (method === 'ict') return ictX.setup && ictX.setup.ready ? z(ictX.setup, 'ICT', false, { why: [`${ictX.setup.model}: enter on the pullback into the zone, stop beyond ${f(ictX.setup.invalidation)}`, ...ck(ictX.setup.confluence)], zone: [ictX.setup.zoneBottom, ictX.setup.zoneTop] }) : null; // only a trade with all 8 questions answered "yes" goes to the Journal
    if (method === 'smc') return z(smcX.setup, 'SMC', false, smcX.setup ? { why: [`${smcX.setup.model}: enter on the reaction from the ${smcX.setup.zone.label}`, ...ck(smcX.setup.confluence)], zone: [smcX.setup.zone.bottom, smcX.setup.zone.top] } : undefined);
    if (method === 'vsa') {
      const v = Math.abs(vsa.score), r = vsa.reversal;
      return vsa.setup ? z({ ...vsa.setup, score: Math.min(100, v + 20), grade: v >= 60 ? 'A' : v >= 40 ? 'B' : 'C' }, 'VSA', false, { why: [VSA_RULE, ...(r ? r.steps.map((q) => (q.ok ? '✓ ' : '… ') + q.text) : []), VSA_HELP[vsa.setup.tag]].filter(Boolean), zone: [vsa.setup.zoneBottom, vsa.setup.zoneTop], level: vsa.setup.level }) : null;
    }
    if (method === 'candle') return cdl.setup ? z(cdl.setup, `Candle · ${cdl.setup.pattern.name}`, cdl.setup.state === 'armed') : null;
    if (method === 'pat') { const q = pat.setup?.pattern.quality ?? 0; return pat.setup ? z({ ...pat.setup, score: Math.min(100, q), grade: q >= 80 ? 'A' : q >= 65 ? 'B' : 'C' }, `Pattern · ${pat.setup.pattern.name}`) : null; }
    if (method === 'scalp') return z(all.scalp.setup, 'Scalp');
    return combo ? z(combo, 'Combined', false, { why: [combo.plan.trigger, combo.plan.cancelIf, ...ck(combo.checks)], zone: [combo.zoneBottom, combo.zoneTop] }) : null;
  })();
  const aiSetup: Logged | null = ai && ai.bias !== 'wait' && isFinite(ai.entry) && isFinite(ai.stopLoss) && ai.takeProfits?.length ? { side: ai.bias, entry: ai.entry, sl: ai.stopLoss, tps: ai.takeProfits.slice(0, 3), score: GR[ai.ict?.grade ?? 'B'] ?? 65, grade: ai.ict?.grade ?? 'B', source: 'Chart analysis' } : null;
  useSignalLog({ active, symId, name: sym.name, tf, dec, setup: cur }); // the chart-analysis result is not auto-logged: it has its own Take / Skip buttons

  const refine = async () => {
    if (!apiKey.trim()) { setAiErr(t('needPay')); return; }
    setBusy(true); setAiErr('');
    try {
      const lang = LANGS.find((l) => l.code === settings.lang)?.ai ?? 'English';
      const ctx = [`trend ${ictX.trend}`, ictX.lastBreak && `last break ${ictX.lastBreak.kind} ${ictX.lastBreak.dir} at ${f(ictX.lastBreak.level)}`, ictX.zone && `price in ${ictX.zone}`,
        ictX.range && `dealing range ${f(ictX.range.low)} - ${f(ictX.range.high)}`, ictX.sweep && `${ictX.sweep.side} swept at ${f(ictX.sweep.price)}`,
        ictX.orderBlocks.length && `order blocks ${ictX.orderBlocks.map((z) => `${z.side} ${f(z.bottom)}-${f(z.top)}`).join('; ')}`,
        ictX.fvgs.length && `FVGs ${ictX.fvgs.map((z) => `${z.side} ${f(z.bottom)}-${f(z.top)}`).join('; ')}`,
        s && `proposed ${s.side} entry ${f(s.entry)} SL ${f(s.sl)} TP ${s.tps.map(f).join('/')}`, ictX.killzone && `killzone ${ictX.killzone.name}`, methodsContext(all, f)].filter(Boolean).join(', ');
      setAi(await analyzeMarket(apiKey.trim(), settings.model.trim(), lang, `${sym.name} (${sym.id})`, TFS.find((x) => x.k === tf)?.label ?? tf, data, dec, ctx));
    } catch (e: any) { setAiErr(e.message ?? 'Error'); } finally { setBusy(false); }
  };
  const ac = ai ? (ai.bias === 'buy' ? th.buy : ai.bias === 'sell' ? th.sell : th.gold) : th.dim;

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
        <TimeframeBar value={tf} options={TFS} onChange={setTf} />

        {!methodProp && (<TimeframeBar value={method} options={[{ k: 'all', label: t('methodAll') }, { k: 'ict', label: 'ICT' }, { k: 'smc', label: 'SMC' }, { k: 'vsa', label: 'VSA' }, { k: 'pat', label: t('methodPat') }, { k: 'candle', label: 'Candles' }]} onChange={(k) => setMethod(k as Method)} />)}

        <Card style={{ padding: 8, direction: 'ltr' }}>
          {err ? (
            <View style={{ gap: 12, padding: 8 }}><Body color={th.sell}>{err}</Body><Btn ghost label={t('retry')} onPress={() => setNonce((n) => n + 1)} /></View>
          ) : <MethodChart data={data} all={chartAll} method={method} width={width - 48} dec={dec} gran={Number(tf)} />}
        </Card>

        {method === 'all' && (
          <View style={{ flexDirection: 'row', gap: 10 }}>
          <Card style={{ flex: 1, padding: 12 }}><Dim>{t('trend')}</Dim><Text style={{ color: ict.trend === 'bullish' ? th.buy : ict.trend === 'bearish' ? th.sell : th.gold, fontWeight: '800', fontSize: 15 }}>{ict.trend === 'range' ? t('sideways') : t(ict.trend)}</Text>{!!ict.lastBreak && <Text style={{ color: th.dim, fontSize: 11 }}>{ict.lastBreak.kind}</Text>}</Card>
          <Card style={{ flex: 1, padding: 12 }}><Dim>{t('ictZone')}</Dim><Text style={{ color: ict.zone === 'discount' ? th.buy : ict.zone === 'premium' ? th.sell : th.gold, fontWeight: '800', fontSize: 15 }}>{ict.zone ? t(ict.zone) : '—'}</Text></Card>
          <Card style={{ flex: 1, padding: 12 }}><Dim>{t('ictKz')}</Dim><Text style={{ color: ict.killzone ? th.buy : th.dim, fontWeight: '800', fontSize: 13 }} numberOfLines={2}>{ict.killzone ? ict.killzone.name.replace(' Killzone', '') : t('kzNone')}</Text></Card>
        </View>
        )}

        {method === 'ict' && (
          <>
            <View style={{ gap: 6 }}>
              <Dim>Bias timeframe</Dim>
              <TimeframeBar value={biasTf} options={[{ k: 'auto', label: 'Auto' }, { k: '3600', label: 'H1' }, { k: '14400', label: 'H4' }, { k: '86400', label: 'D1' }]} onChange={setBiasTf} />
            </View>
            {!ictX.ok && <Card><Body color={th.gold}>{ictX.reason ?? t('planNoData')}</Body></Card>}
            {ictX.ok && <IctVerdict ict={ictX} f={f} />}
            {ictX.ok && <IctSteps ict={ictX} />}

            {s && (
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <SectionTitle icon="locate-outline">{s.ready ? 'Trade plan' : 'Plan (not ready yet)'}</SectionTitle>
                  <Badge label={s.ready ? 'READY' : 'WAIT'} color={s.ready ? th.buy : th.gold} />
                </View>
                <View style={{ height: 10 }} />
                <Row k="Standard entry (zone midpoint)" v={f(s.entry)} color={th.accent} />
                <Row k="Aggressive entry (zone edge)" v={f(s.aggressive)} />
                <Row k={`${t('sl')} (${s.slBasis === 'sweep' ? 'beyond the swept extreme' : 'beyond the zone'})`} v={f(s.sl)} color={th.sell} />
                <Row k={t('ictInvalid')} v={`${s.side === 'buy' ? '<' : '>'} ${f(s.invalidation)}`} />
                <Row k={s.zoneKind === 'FVG' ? 'Fair value gap' : s.zoneKind === 'OB' ? 'Order block' : 'Breaker block'} v={`${f(s.zoneBottom)} - ${f(s.zoneTop)}`} color={th.gold} />
                <View style={{ height: 8 }} />
                <TpLadder rows={s.tps.map((p, i) => ({ label: `TP${i + 1}`, price: f(p), split: TP_SPLIT[i], r: `${s.rr[i].toFixed(1)}R` }))} />
                <View style={{ height: 8 }} />
                <Dim>TP1: take partial profit and move the stop to break-even. TP2: external liquidity. For a conservative entry wait for a lower-timeframe reaction (rejection candle or small MSS) inside the zone. Do not chase if price runs away without retracing.</Dim>
                <View style={{ height: 8 }} />
                <Btn label={t('sendRisk')} icon="calculator-outline" onPress={() => { setPrefill({ entry: s.entry, sl: s.sl, tps: [...s.tps], symbol: sym.name }); setTab(4); }} />
              </Card>
            )}
            {cur && <TakeSkip symId={symId} name={sym.name} tf={tf} dec={dec} setup={cur} />}

            <IctBiasCard ict={ictX} htfLabel={htfLabel} f={f} />
            <IctTime ict={ictX} />
            <IctLevels ict={ictX} f={f} />

            {s && (
              <Card>
                <SectionTitle icon="checkmark-done-outline">Zone quality</SectionTitle>
                <View style={{ height: 8 }} />
                <Checklist items={s.confluence.slice(8)} />
              </Card>
            )}

            {(ictX.orderBlocks.length > 0 || ictX.fvgs.length > 0 || (ictX.breakers?.length ?? 0) > 0) && (
              <Card>
                <SectionTitle icon="cube-outline">{t('pdArrays')}</SectionTitle>
                <View style={{ height: 8 }} />
                {ictX.orderBlocks.map((z, i) => <Row key={`o${i}`} k={`${z.side === 'bullish' ? '▲' : '▼'} OB${z.fresh ? '' : ' (tested)'}`} v={`${f(z.bottom)} - ${f(z.top)}  ·  50% ${f(z.mean)}`} color={z.side === 'bullish' ? th.buy : th.sell} />)}
                {ictX.fvgs.map((z, i) => <Row key={`g${i}`} k={`${z.side === 'bullish' ? '▲' : '▼'} FVG${z.fresh ? '' : ' (tested)'}`} v={`${f(z.bottom)} - ${f(z.top)}  ·  CE ${f(z.mean)}`} color={z.side === 'bullish' ? th.buy : th.sell} />)}
                {(ictX.breakers ?? []).map((z, i) => <Row key={`b${i}`} k={`${z.side === 'bullish' ? '▲' : '▼'} ${z.unicorn ? 'Unicorn' : 'Breaker'}${z.fresh ? '' : ' (tested)'}`} v={`${f(z.bottom)} - ${f(z.top)}`} color={z.side === 'bullish' ? th.buy : th.sell} />)}
                {ictX.range && <Row k={t('ictRange')} v={`${f(ictX.range.low)} → ${f(ictX.range.high)}`} />}
                {ictX.range && <Row k="EQ 50%" v={f(ictX.range.eq)} color={th.accent2} />}
              </Card>
            )}

            {ictX.liquidity.length > 0 && (
              <Card>
                <SectionTitle icon="water-outline">{t('liq')}</SectionTitle>
                <View style={{ height: 8 }} />
                {ictX.liquidity.slice(-10).reverse().map((l, i) => <Row key={i} k={`${l.side === 'BSL' ? t('buySideLiq') : t('sellSideLiq')}${l.label ? ' · ' + l.label : ''}`} v={`${f(l.price)}${l.swept ? '  ✓ ' + t('swept') : ''}`} color={l.swept ? th.dim : th.text} />)}
              </Card>
            )}
            <IctSettings {...ictp} />
            <IctGuide />
          </>
        )}

        {method === 'all' && (
          <>
            {!combo && <Card><SectionTitle icon="hourglass-outline">{t('ictNoSetup')}</SectionTitle><View style={{ height: 6 }} /><Body color={th.dim}>{all.why ?? ict.reason ?? t('planNoData')}</Body></Card>}
            {combo && (
              <SetupCard side={combo.side} model={combo.basis} score={combo.score} grade={combo.grade} entry={combo.entry} sl={combo.sl} tps={combo.tps} rr={combo.rr} f={f}
                onSend={() => { setPrefill({ entry: combo.entry, sl: combo.sl, tps: [...combo.tps], symbol: sym.name }); setTab(4); }} note={combo.notes.join(' ')} />
            )}
            {cur && <TakeSkip symId={symId} name={sym.name} tf={tf} dec={dec} setup={cur} />}
            {combo && <Card><SectionTitle icon="checkmark-done-outline">{t('confluence')}</SectionTitle><View style={{ height: 8 }} /><Checklist items={combo.checks} /></Card>}
            <Card>
              <SectionTitle icon="git-compare-outline">{t('methodVotes')}</SectionTitle>
              <View style={{ height: 8 }} />
              {all.votes.map((v) => (
                <View key={v.method} style={{ marginBottom: 6 }}>
                  <Row k={v.method} v={v.side ? t(v.side) : '-'} color={v.side === 'buy' ? th.buy : v.side === 'sell' ? th.sell : th.dim} />
                  <Dim>{v.text}</Dim>
                </View>
              ))}
            </Card>
          </>
        )}

        {method === 'smc' && (
          <>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Tile label={t('smcSwing')} value={smcX.trend === 'range' ? t('sideways') : t(smcX.trend)} color={smcX.trend === 'bullish' ? th.buy : smcX.trend === 'bearish' ? th.sell : th.gold} sub={smcX.swing ? `${smcX.swing.kind} (swing)` : undefined} />
              <Tile label={t('smcIdm')} value={smcX.idm ? (smcX.idm.taken ? t('smcTaken') : t('smcPending')) : '—'} color={smcX.idm ? (smcX.idm.taken ? th.buy : th.gold) : th.dim} sub={smcX.internal ? `${smcX.internal.kind} (int)` : undefined} />
            </View>
            {!smcX.ok && <Card><Body color={th.gold}>{smcX.reason ?? t('planNoData')}</Body></Card>}
            {smcX.ok && !smcX.setup && <Card><SectionTitle icon="hourglass-outline">{t('smcNoSetup')}</SectionTitle><View style={{ height: 6 }} /><Body color={th.dim}>{t('smcNoSetupText')}</Body></Card>}
            {smcX.ok && smcX.bias && (
              <Card>
                <SectionTitle icon="compass-outline">Bias and plan</SectionTitle>
                <View style={{ height: 6 }} />
                <Row k="Higher-timeframe bias" v={smcX.bias.dir === 'neutral' ? 'Neutral (no trade)' : smcX.bias.dir === 'bullish' ? 'Bullish' : 'Bearish'} color={smcX.bias.dir === 'bullish' ? th.buy : smcX.bias.dir === 'bearish' ? th.sell : th.gold} />
                {smcX.zone && <Row k="Price in the dealing range" v={smcX.zone === 'premium' ? 'Premium (sell side)' : smcX.zone === 'discount' ? 'Discount (buy side)' : 'Equilibrium'} color={th.accent2} />}
                {smcX.ote && <Row k="OTE zone 62 - 79 %" v={`${f(Math.min(smcX.ote.top, smcX.ote.bottom))} - ${f(Math.max(smcX.ote.top, smcX.ote.bottom))}`} color={th.accent2} />}
                {smcX.sweep && <Row k={`Sweep: ${smcX.sweep.label}`} v={f(smcX.sweep.price)} color={th.gold} />}
                {smcX.phase && <Body color={th.dim}>{smcX.phase}</Body>}
                {smcX.bias.reasons.map((r, i) => <Body key={i} color={th.dim}>{r}</Body>)}
                {smcX.plan && <Body>{smcX.plan}</Body>}
                {smcX.next && <Body color={th.gold}>{smcX.next}</Body>}
                {smcX.notes.map((r, i) => <Body key={'n' + i} color={th.dim}>{r}</Body>)}
              </Card>
            )}
            {smcX.setup && (
              <SetupCard side={smcX.setup.side} model={smcX.setup.model} score={smcX.setup.score} grade={smcX.setup.grade} entry={smcX.setup.entry} sl={smcX.setup.sl} tps={smcX.setup.tps} rr={smcX.setup.rr} f={f}
                onSend={() => { setPrefill({ entry: smcX.setup!.entry, sl: smcX.setup!.sl, tps: [...smcX.setup!.tps], symbol: sym.name }); setTab(4); }} note={t('smcEntryNote')} />
            )}
            {cur && <TakeSkip symId={symId} name={sym.name} tf={tf} dec={dec} setup={cur} />}
            {smcX.setup && <Card><SectionTitle icon="checkmark-done-outline">{t('confluence')}</SectionTitle><View style={{ height: 8 }} /><Checklist items={smcX.setup.confluence} /></Card>}
            {smcX.setup && <Card><SectionTitle icon="ribbon-outline">{`POI score ${smcX.setup.poiScore} / 8 (trade at 6 or more)`}</SectionTitle><View style={{ height: 8 }} /><Checklist items={smcX.setup.poiChecks} /></Card>}
            {smcX.zones.length > 0 && (
              <Card>
                <SectionTitle icon="cube-outline">{t('smcZones')}</SectionTitle>
                <View style={{ height: 8 }} />
                {smcX.zones.map((q, i) => <Row key={i} k={`${q.side === 'bullish' ? '▲' : '▼'} ${q.label}${q.fresh ? '' : ' (tested)'}`} v={`${f(q.bottom)} - ${f(q.top)}`} color={q.side === 'bullish' ? th.buy : th.sell} />)}
                {smcX.range && <Row k="EQ 50%" v={f(smcX.range.eq)} color={th.accent2} />}
              </Card>
            )}
          </>
        )}

        {method === 'vsa' && (
          <>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Tile label={t('vsaBias')} value={vsa.bias === 'wait' ? t('wait') : t(vsa.bias)} color={vsa.bias === 'buy' ? th.buy : vsa.bias === 'sell' ? th.sell : th.gold} sub={`${vsa.score > 0 ? '+' : ''}${vsa.score}`} />
              <Tile label={t('vsaFeed')} value={vsa.hasVolume ? t('vsaReal') : t('vsaSpread')} color={vsa.hasVolume ? th.buy : th.gold} />
            </View>
            {!vsa.ok && <Card><Body color={th.gold}>{vsa.reason ?? t('planNoData')}</Body></Card>}
            {vsa.ok && vsa.hasVolume && !!realVolumeSource(symId) && <Dim>{`Volume source: ${realVolumeSource(symId)!.label}${realVolumeSource(symId)!.proxy ? ' (proxy: this pair has no futures of its own)' : ''}. Real traded volume, not spread or tick count.`}</Dim>}
            {vsa.ok && !vsa.hasVolume && <Card><Body color={th.gold}>{t('vsaNoVol')}</Body></Card>}
            {vsa.ok && vsa.signals.length === 0 && <Card><Body color={th.dim}>{t('vsaNone')}</Body></Card>}
            {vsa.ok && <VsaCard vsa={vsa} f={f} />}
            {vsa.setup && (
              <SetupCard side={vsa.setup.side} model={VSA_NAMES[vsa.setup.tag]} score={Math.min(100, Math.abs(vsa.score) + 20)} grade={Math.abs(vsa.score) >= 60 ? 'A' : Math.abs(vsa.score) >= 40 ? 'B' : 'C'} entry={vsa.setup.entry} sl={vsa.setup.sl} tps={vsa.setup.tps} rr={vsa.setup.rr} f={f}
                onSend={() => { setPrefill({ entry: vsa.setup!.entry, sl: vsa.setup!.sl, tps: [...vsa.setup!.tps], symbol: sym.name }); setTab(4); }} note={vsa.setup.note} />
            )}
            {cur && <TakeSkip symId={symId} name={sym.name} tf={tf} dec={dec} setup={cur} />}
            {vsa.signals.length > 0 && (
              <Card>
                <SectionTitle icon="pulse-outline">{t('vsaSignals')}</SectionTitle>
                <View style={{ height: 8 }} />
                {[...vsa.signals].reverse().map((g, i) => (
                  <View key={i} style={{ marginBottom: 8 }}>
                    <Row k={`${g.dir === 'bull' ? '▲' : '▼'} ${VSA_NAMES[g.tag]}`} v={`${data.length - 1 - g.i} ${t('barsAgo')}`} color={g.dir === 'bull' ? th.buy : th.sell} />
                    <Dim>{g.text}</Dim>
                  </View>
                ))}
              </Card>
            )}
          </>
        )}

        {method === 'candle' && (
          <>
            {!cdl.ok && <Card><Body color={th.gold}>{cdl.reason ?? t('planNoData')}</Body></Card>}
            {cdl.ok && (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Tile label="Trend into now" value={cdl.trend === 'up' ? 'Rising' : cdl.trend === 'down' ? 'Falling' : 'Sideways'} color={cdl.trend === 'up' ? th.buy : cdl.trend === 'down' ? th.sell : th.dim} />
                <Tile label="Candle bias" value={cdl.bias === 'bullish' ? 'Bullish' : cdl.bias === 'bearish' ? 'Bearish' : 'Neutral'} color={cdl.bias === 'bullish' ? th.buy : cdl.bias === 'bearish' ? th.sell : th.gold} sub={cdl.last ? `Last candle: ${cdl.last.name}` : undefined} />
              </View>
            )}
            {cdl.ok && !cdl.setup && <Card><SectionTitle icon="hourglass-outline">No candle trade</SectionTitle><View style={{ height: 6 }} /><Body color={th.dim}>{cdl.why}</Body></Card>}
            {cdl.setup && (
              <>
                {cdl.setup.state === 'armed' && <Card style={{ borderColor: th.gold }}><Body color={th.gold}>Do not enter yet. Wait for the confirmation candle. The entry shown is the break level that confirms the pattern.</Body></Card>}
                <SetupCard side={cdl.setup.side} model={cdl.setup.pattern.name} score={cdl.setup.score} grade={cdl.setup.grade} entry={cdl.setup.entry} sl={cdl.setup.sl} tps={cdl.setup.tps} rr={cdl.setup.rr} f={f}
                  badge={<View style={{ marginTop: 4 }}><Badge label={cdl.setup.state === 'armed' ? 'WAIT FOR CONFIRMATION' : 'CONFIRMED'} color={cdl.setup.state === 'armed' ? th.gold : th.buy} /></View>}
                  onSend={() => { setPrefill({ entry: cdl.setup!.entry, sl: cdl.setup!.sl, tps: [...cdl.setup!.tps], symbol: sym.name }); setTab(4); }} note={cdl.setup.note} />
                {cur && <TakeSkip symId={symId} name={sym.name} tf={tf} dec={dec} setup={cur} />}
                <Card>
                  <SectionTitle icon="checkmark-done-outline">Why this score</SectionTitle>
                  <View style={{ height: 8 }} />
                  <Checklist items={cdl.setup.confluence} />
                </Card>
              </>
            )}
            {cdl.list.length > 0 && (
              <Card>
                <SectionTitle icon="analytics-outline">Patterns in the last 6 candles</SectionTitle>
                <View style={{ height: 8 }} />
                {cdl.list.map((q2, i) => (
                  <View key={q2.key + i} style={{ marginBottom: 8 }}>
                    <Row k={`${q2.dir === 'bullish' ? '▲' : q2.dir === 'bearish' ? '▼' : '●'} ${q2.name}`} v={q2.age === 0 ? 'now' : `${q2.age} ago`} color={q2.dir === 'bullish' ? th.buy : q2.dir === 'bearish' ? th.sell : th.gold} />
                    <Dim>{`${q2.status === 'confirmed' ? 'Confirmed' : q2.dir === 'neutral' ? 'Indecision' : 'Waiting for confirmation'} · strength ${q2.strength}/100. ${q2.note}`}</Dim>
                  </View>
                ))}
              </Card>
            )}
            <Pressable onPress={() => setGuide(!guide)}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <SectionTitle icon="school-outline">Pattern guide</SectionTitle>
                <Icon name={guide ? 'chevron-up' : 'chevron-down'} size={18} color={th.dim} />
              </Card>
            </Pressable>
            {guide && (
              <Card>
                {GUIDE.map((g, i) => (
                  <View key={g.name} style={{ marginBottom: i === GUIDE.length - 1 ? 0 : 12 }}>
                    <Text style={{ color: g.dir === 'bullish' ? th.buy : g.dir === 'bearish' ? th.sell : th.gold, fontWeight: '900' }}>{g.name} · {g.candles} candle{g.candles > 1 ? 's' : ''}</Text>
                    <Dim>{g.shows}</Dim>
                    <Dim>{`How to trade: ${g.trade}`}</Dim>
                  </View>
                ))}
                <View style={{ height: 10 }} />
                <Dim>Rules: trade a pattern only at the end of a trend, wait for the confirmation candle, add volume or momentum when you can, put the stop just beyond the pattern with a small cushion. Forex, crypto and synthetic indices rarely gap, so gap rules are relaxed.</Dim>
              </Card>
            )}
          </>
        )}

        {method === 'pat' && (
          <>
            {!pat.ok && <Card><Body color={th.gold}>{pat.reason ?? t('planNoData')}</Body></Card>}
            {pat.ok && pat.list.length === 0 && <Card><SectionTitle icon="hourglass-outline">{t('patNone')}</SectionTitle><View style={{ height: 6 }} /><Body color={th.dim}>{t('patNoneText')}</Body></Card>}
            {pat.best && (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Tile label={t('patName')} value={pat.best.name} color={pat.best.dir === 'bullish' ? th.buy : th.sell} />
                <Tile label={t('patStatus')} value={t('pat_' + pat.best.status)} color={pat.best.status === 'forming' ? th.gold : th.accent} />
              </View>
            )}
            {pat.setup && (
              <SetupCard side={pat.setup.side} model={pat.setup.pattern.name} score={Math.min(100, pat.setup.pattern.quality)} grade={pat.setup.pattern.quality >= 80 ? 'A' : pat.setup.pattern.quality >= 65 ? 'B' : 'C'} entry={pat.setup.entry} sl={pat.setup.sl} tps={pat.setup.tps} rr={pat.setup.rr} f={f}
                onSend={() => { setPrefill({ entry: pat.setup!.entry, sl: pat.setup!.sl, tps: [...pat.setup!.tps], symbol: sym.name }); setTab(4); }} note={pat.setup.pattern.note} />
            )}
            {cur && <TakeSkip symId={symId} name={sym.name} tf={tf} dec={dec} setup={cur} />}
            {pat.list.length > 0 && (
              <Card>
                <SectionTitle icon="analytics-outline">{t('patFound')}</SectionTitle>
                <View style={{ height: 8 }} />
                {pat.list.map((q, i) => (
                  <View key={q.key + i} style={{ marginBottom: 8 }}>
                    <Row k={`${q.dir === 'bullish' ? '▲' : '▼'} ${q.name}`} v={t('pat_' + q.status)} color={q.dir === 'bullish' ? th.buy : th.sell} />
                    <Dim>{q.note} · {t('patTarget')} {f(q.target)}</Dim>
                  </View>
                ))}
              </Card>
            )}
          </>
        )}

        <Btn label={busy ? t('analyzing') : t('ictAi')} onPress={refine} busy={busy} disabled={data.length < 40} icon="analytics-outline" />
        {!!aiErr && <Text style={{ color: th.sell, lineHeight: 20 }}>{aiErr}</Text>}
        {ai && (
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <SectionTitle icon="analytics">{t('ictAiResult')}</SectionTitle>
              {!!ai.ict?.grade && <Badge label={ai.ict.grade} color={ai.ict.grade.startsWith('A') ? th.buy : ai.ict.grade === 'B' ? th.gold : th.sell} />}
            </View>
            <Text style={{ color: ac, fontSize: 22, fontWeight: '900', marginTop: 6 }}>{t(ai.bias)} · {t(ai.trend.direction)}</Text>
            {!!ai.ict?.model && <Body bold>{ai.ict.model}</Body>}
            <Body>{ai.trend.summary}</Body>
            <View style={{ height: 8 }} />
            <Row k={t('ictRefined')} v={f(ai.entry)} color={th.accent} />
            <Row k={t('sl')} v={f(ai.stopLoss)} color={th.sell} />
            <View style={{ height: 6 }} />
            <TpLadder rows={ai.takeProfits.map((p, i) => ({ label: `TP${i + 1}`, price: f(p), split: TP_SPLIT[i] }))} />
            {!!ai.ict?.poiTop && !!ai.ict?.poiBottom && <Row k={ai.ict.poiKind === 'FVG' ? 'FVG' : 'Order block'} v={`${f(ai.ict.poiBottom)} - ${f(ai.ict.poiTop)}`} color={th.gold} />}
            {!!ai.riskReward && <Row k={t('rr')} v={ai.riskReward} />}
            <View style={{ height: 8 }} />
            {ai.ict?.confluence.map((c, i) => <Body key={i}>✓ {c}</Body>)}
            <Body>{ai.reasoning}</Body>
            {ai.warnings.map((w, i) => <Body key={i} color={th.gold}>• {w}</Body>)}
          </Card>
        )}
        {aiSetup && <TakeSkip symId={symId} name={sym.name} tf={tf} dec={dec} setup={aiSetup} />}
        <Dim>{t('ictDisclaimer')}</Dim>
      </View>
  );
  return embedded ? body : <Screen icon="git-network" title={t('tabIct')} subtitle={t('navDescIct')} right={<Badge label="PRO" color={th.gold} />}>{body}</Screen>;
}
