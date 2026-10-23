import React, { useEffect, useState } from 'react';
import { View, Text, Vibration } from 'react-native';
import { useWindowDimensions } from '../win';
import { useApp } from '../store';
import { Card, Dim, Body, Btn, Row, TimeframeBar, Badge } from '../ui';
import { TpLadder, Checklist } from '../ProUI';
import { analyzeMarket, MarketAI, TP_SPLIT } from '../gemini';
import { volLabel } from '../volume';
import { LANGS } from '../i18n';
import { analyzeAll, methodsContext } from '../refine';
import IndicatorChart from '../IndicatorChart';
import TakeSkip from '../TakeSkip';
import TradePlan, { PlanIn, EMPTY_PLAN, planLevels } from '../TradePlan';
import { BodyProps } from '../embed';
import { Candle, TFS, symOf, quotes, watchCandles, addAlert } from '../markets';

// CR (Chart Reader) Analysis: the chart analysis that used to live on the Market screen ("Analysis View" + "Analysis of this chart").
// It reads the live candles of the pair chosen on the Analysis page, runs every Chart Reader method, asks Gemini for the final
// entry, stop loss and 3 take profits, and draws them on the chart. The result goes to History and has its own Take / Skip buttons.
const GR: Record<string, number> = { 'A+': 90, A: 80, B: 65, C: 50 };
type Level = { label: string; price: number; color: string };

export default function CRAnalysis({ on, symId: symProp }: BodyProps = {}) {
  const { th, t, settings, apiKey, addItem } = useApp();
  const { width } = useWindowDimensions();
  const active = !!on;
  const symId = symProp ?? 'frxEURUSD';
  const [tf, setTf] = useState('900');
  const [data, setData] = useState<Candle[]>([]);
  const [err, setErr] = useState('');
  const [src, setSrc] = useState('');
  const [nonce, setNonce] = useState(0);
  const [flash, setFlash] = useState('');
  const [ai, setAi] = useState<MarketAI | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState('');
  const [plan, setPlan] = useState<PlanIn>(EMPTY_PLAN); // typed or auto-filled Trade plan (moved here from the Market screen)
  useEffect(() => { setPlan(EMPTY_PLAN); }, [symId]); // a plan belongs to one pair

  // one candle stream, only while this method is open; a new pair or timeframe clears the old result
  useEffect(() => {
    if (!active) return;
    setData([]); setErr(''); setSrc(''); setAi(null); setAiErr(''); setFlash('');
    return watchCandles(symId, Number(tf), (c) => { setErr(''); setData(c); }, setErr, setSrc);
  }, [active, symId, tf, nonce]);

  const sym = symOf(symId);
  const dec = quotes[symId]?.dec ?? (data.length && data[data.length - 1].c >= 100 ? 2 : 4);
  const f = (n: number) => (isFinite(n) ? n.toFixed(dec) : '-');
  const tfLabel = TFS.find((x) => x.k === tf)?.label ?? tf;
  const bc = ai ? (ai.bias === 'buy' ? th.buy : ai.bias === 'sell' ? th.sell : th.gold) : th.dim;
  const aiLevels: Level[] = ai ? [
    { label: t('entry'), price: ai.entry, color: th.accent }, { label: t('sl'), price: ai.stopLoss, color: th.sell },
    ...ai.takeProfits.map((p, i) => ({ label: `TP${i + 1}`, price: p, color: th.buy })),
  ] : [];
  const levels: Level[] = [...aiLevels, ...planLevels(plan, th, t)]; // plan levels are drawn on the chart too

  const run = async () => {
    if (!apiKey.trim()) { setAiErr(t('needPay')); return; }
    setAiBusy(true); setAiErr('');
    try {
      const lang = LANGS.find((l) => l.code === settings.lang)?.ai ?? 'English';
      const all = analyzeAll(data), ic = all.ict; // same call the Market screen used
      const ctx = ic.ok ? [`trend ${ic.trend}`, ic.lastBreak && `last break ${ic.lastBreak.kind} ${ic.lastBreak.dir}`, ic.zone && `price in ${ic.zone}`, ic.sweep && `${ic.sweep.side} swept at ${f(ic.sweep.price)}`,
        ic.orderBlocks.length && `order blocks ${ic.orderBlocks.map((z) => `${z.side} ${f(z.bottom)}-${f(z.top)}`).join('; ')}`, ic.fvgs.length && `FVGs ${ic.fvgs.map((z) => `${z.side} ${f(z.bottom)}-${f(z.top)}`).join('; ')}`,
        ic.setup && `proposed ${ic.setup.side} entry ${f(ic.setup.entry)} SL ${f(ic.setup.sl)}`, methodsContext(all, f)].filter(Boolean).join(', ') : '';
      const res = await analyzeMarket(apiKey.trim(), settings.model.trim(), lang, `${sym.name} (${sym.id})`, tfLabel, data, dec, ctx, volLabel(sym.id, Number(tf)));
      setAi(res); addItem(res, sym.name, tfLabel); // saved in History
    } catch (e: any) { setAiErr(e.message ?? 'Error'); } finally { setAiBusy(false); }
  };

  return (
    <View style={{ gap: 12 }}>
      <TimeframeBar value={tf} options={TFS} onChange={setTf} />
      <Card style={{ padding: 8, direction: 'ltr', overflow: 'hidden' }}>
        {err ? (
          <View style={{ gap: 12, padding: 8 }}>
            <Body color={th.sell}>{err}</Body>
            <Btn ghost label={t('retry')} onPress={() => setNonce((n) => n + 1)} />
          </View>
        ) : (
          <IndicatorChart data={data} width={width - 48} dec={dec} levels={levels} gran={Number(tf)} tfs={TFS} onTf={setTf}
            onAlert={(p) => { const last = data[data.length - 1]?.c ?? p; addAlert(sym.id, p, p >= last ? 'above' : 'below'); Vibration.vibrate(40); setFlash(`Price alert set at ${p.toFixed(dec)} (${p >= last ? 'above' : 'below'}). It rings while the app is open.`); }} />
        )}
      </Card>
      {!!src && <Text style={{ color: th.dim, fontSize: 11, textAlign: 'right' }}>{src === 'deriv' ? t('srcDeriv') : src === 'binance' ? 'Binance data' : t('srcBackup')}</Text>}
      {!!flash && <Card style={{ padding: 10 }}><Text style={{ color: th.text, fontSize: 12.5 }}>🔔 {flash}</Text></Card>}

      <Btn label={aiBusy ? t('analyzing') : 'Run CR Analysis'} onPress={run} busy={aiBusy} disabled={data.length < 20} />
      {!!aiErr && <Card style={{ padding: 12 }}><Text style={{ color: th.sell, lineHeight: 20 }}>{aiErr}</Text></Card>}
      {ai && (
        <Card glow style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ color: th.dim, fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>{t('setup').toUpperCase()}</Text>
            <Badge label={t(ai.bias).toUpperCase()} color={bc} />
          </View>
          <Text style={{ color: bc, fontSize: 22, fontWeight: '900', marginBottom: 4 }}>{t(ai.bias)} · {t(ai.trend.direction)}</Text>
          <Body>{ai.trend.summary}</Body>
          <View style={{ height: 8 }} />
          {!!ai.ict?.model && <Row k="ICT" v={`${ai.ict.model}${ai.ict.grade ? ' · ' + ai.ict.grade : ''}`} color={th.accent} />}
          <Row k={t('ictRefined')} v={f(ai.entry)} />
          <Row k={t('sl')} v={f(ai.stopLoss)} color={th.sell} />
          <View style={{ height: 6 }} />
          <TpLadder rows={ai.takeProfits.map((p, i) => ({ label: `TP${i + 1}`, price: f(p), split: TP_SPLIT[i] }))} />
          <View style={{ height: 6 }} />
          {!!ai.ict?.poiTop && !!ai.ict?.poiBottom && <Row k={ai.ict.poiKind === 'FVG' ? 'FVG' : 'Order block'} v={`${f(ai.ict.poiBottom)} - ${f(ai.ict.poiTop)}`} color={th.gold} />}
          {!!ai.support.length && <Row k={t('support')} v={ai.support.map(f).join(' · ')} color={th.buy} />}
          {!!ai.resistance.length && <Row k={t('resistance')} v={ai.resistance.map(f).join(' · ')} color={th.sell} />}
          {!!ai.riskReward && <Row k={t('rr')} v={ai.riskReward} />}
          {!!ai.ict?.confluence?.length && <View style={{ marginTop: 6 }}><Checklist items={ai.ict.confluence.map((text) => ({ text, ok: true }))} /></View>}
          <View style={{ height: 8 }} />
          <Body>{ai.reasoning}</Body>
          {ai.warnings.map((w, i) => <Body key={i} color={th.gold}>• {w}</Body>)}
          <View style={{ height: 8 }} />
          <Dim>{t('disclaimer')}</Dim>
        </Card>
      )}
      {ai && ai.bias !== 'wait' && isFinite(ai.entry) && isFinite(ai.stopLoss) && !!ai.takeProfits?.length && (
        <TakeSkip symId={sym.id} name={sym.name} tf={tf} dec={dec} setup={{ side: ai.bias, entry: ai.entry, sl: ai.stopLoss, tps: ai.takeProfits.slice(0, 3), score: GR[ai.ict?.grade ?? 'B'] ?? 65, grade: ai.ict?.grade ?? 'B', source: 'CR Analysis' }} />
      )}
      <TradePlan symbol={`${sym.name} (${sym.id})`} data={data} dec={dec} tf={tf} setTf={setTf} plan={plan} setPlan={setPlan} noTf />
    </View>
  );
}
