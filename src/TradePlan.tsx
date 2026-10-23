import React, { useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { useApp } from './store';
import { Card, Dim, Body, Btn, Field, Row, TimeframeBar } from './ui';
import { checkPlan, suggest } from './ta';
import { reviewPlan, PlanAI } from './gemini';
import { LANGS } from './i18n';
import { TFS } from './markets';
import type { Candle } from './markets';

export type PlanIn = { hi: string; lo: string; en: string; sl: string; tp: string; tp2: string; tp3: string };
export const EMPTY_PLAN: PlanIn = { hi: '', lo: '', en: '', sl: '', tp: '', tp2: '', tp3: '' };
const num = (s: string) => { const v = parseFloat(s.replace(',', '.')); return isFinite(v) ? v : undefined; };
// Levels drawn on the Quick chart while the plan is being typed.
export const planLevels = (p: PlanIn, th: { accent: string; sell: string; buy: string; gold: string; poi: string }, t: (k: string) => string) => {
  const o: { label: string; price: number; color: string }[] = [];
  const add = (label: string, s: string, color: string) => { const v = num(s); if (v !== undefined) o.push({ label, price: v, color }); };
  add(t('planHigher'), p.hi, th.poi); add(t('planLower'), p.lo, th.poi);
  add(t('entry'), p.en, th.accent); add(t('sl'), p.sl, th.sell); add('TP1', p.tp, th.buy); add('TP2', p.tp2, th.buy); add('TP3', p.tp3, th.buy);
  return o;
};

export default function TradePlan({ symbol, data, dec, tf, setTf, plan, setPlan, noTf }: {
  symbol: string; data: Candle[]; dec: number; tf: string; setTf: (k: string) => void; plan: PlanIn; setPlan: (p: PlanIn) => void; noTf?: boolean; // noTf: the screen already has its own timeframe bar
}) {
  const { th, t, settings, apiKey, live } = useApp();
  const [ai, setAi] = useState<PlanAI | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: keyof PlanIn) => (v: string) => { setPlan({ ...plan, [k]: v }); setAi(null); };
  const en = num(plan.en), sl = num(plan.sl), tp = num(plan.tp), tp2 = num(plan.tp2), tp3 = num(plan.tp3), hi = num(plan.hi), lo = num(plan.lo);
  const tps = [tp, tp2, tp3].filter((v): v is number => v !== undefined);
  const ready = en !== undefined && sl !== undefined && tp !== undefined;
  const res = useMemo(() => (ready ? checkPlan(data, { higher: hi, lower: lo, entry: en!, sl: sl!, tps }, dec) : null), [data, plan.hi, plan.lo, plan.en, plan.sl, plan.tp, plan.tp2, plan.tp3, dec]);
  const tone = (k: 'good' | 'warn' | 'bad') => (k === 'good' ? th.buy : k === 'warn' ? th.gold : th.sell);
  const vc = res?.verdict === 'good' ? th.buy : res?.verdict === 'okay' ? th.gold : th.sell;

  const fill = () => {
    if (data.length < 30) { setErr(`Waiting for chart candles (${data.length} of 30). Check your internet, or wait a few seconds and tap again.`); return; }
    const s = suggest(data);
    if (!s) { setErr(t('planNoData')); return; }
    setErr(''); setAi(null);
    const f = (n: number) => n.toFixed(dec);
    setPlan({ hi: f(s.higher), lo: f(s.lower), en: f(s.entry), sl: f(s.sl), tp: f(s.tps[0]), tp2: f(s.tps[1]), tp3: f(s.tps[2]) });
  };
  const runAi = async () => {
    if (!res || res.error || !ready) return;
    if (!apiKey.trim()) { setErr(t('needPay')); return; }
    setBusy(true); setErr('');
    try {
      const lang = LANGS.find((l) => l.code === settings.lang)?.ai ?? 'English';
      const c = res.ctx!;
      const engine = `score ${res.score}/100, side ${res.side}, blended RR 1:${res.rr!.toFixed(2)} over 3 TPs, SL ${res.slAtr!.toFixed(1)} ATR, TP ${res.tpAtr!.toFixed(1)} ATR, RSI ${c.rsi.toFixed(0)}, structure ${c.structure}, trend score ${c.score.toFixed(2)}, ATR ${c.atr.toFixed(dec)}, support ${c.support.map((v) => v.toFixed(dec)).join('/')}, resistance ${c.resistance.map((v) => v.toFixed(dec)).join('/')}`;
      setAi(await reviewPlan(apiKey.trim(), settings.model.trim(), lang, symbol, TFS.find((x) => x.k === tf)?.label ?? tf, data, dec, { higher: hi, lower: lo, entry: en!, sl: sl!, tps }, engine));
    } catch (e: any) { setErr(e.message ?? 'Error'); } finally { setBusy(false); }
  };
  const pair = (a: keyof PlanIn, b: keyof PlanIn, la: string, lb: string) => (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <View style={{ flex: 1 }}><Field label={la} value={plan[a]} onChangeText={set(a)} keyboardType="decimal-pad" /></View>
      <View style={{ flex: 1 }}><Field label={lb} value={plan[b]} onChangeText={set(b)} keyboardType="decimal-pad" /></View>
    </View>
  );

  return (
    <Card>
      <Text style={{ color: th.text, fontSize: 18, fontWeight: '700', marginBottom: 2 }}>{t('planTitle')}</Text>
      <Dim>{t('planHint')}</Dim>
      {!noTf && <TimeframeBar value={tf} options={TFS} onChange={(k) => { setTf(k); setAi(null); }} />}
      <View style={{ height: 12 }} />
      {pair('hi', 'lo', t('planHigher'), t('planLower'))}
      {pair('en', 'sl', t('planEntry'), t('planSl'))}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {([['tp', 'TP1', 50], ['tp2', 'TP2', 30], ['tp3', 'TP3', 20]] as const).map(([k, l, pc]) => (
          <View key={k} style={{ flex: 1 }}><Field label={`${l} · ${pc}%`} value={plan[k]} onChangeText={set(k)} keyboardType="decimal-pad" /></View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {live && <View style={{ flex: 1 }}><Btn ghost label={t('planAuto')} onPress={fill} /></View>}
        <View style={{ flex: 1 }}><Btn ghost label={t('planClear')} onPress={() => { setPlan(EMPTY_PLAN); setAi(null); setErr(''); }} /></View>
      </View>
      {!!err && <Text style={{ color: th.sell, lineHeight: 20, marginTop: 8 }}>{err}</Text>}

      {!res && <View style={{ marginTop: 10 }}><Dim>{t('planFill')}</Dim></View>}
      {res?.error && <View style={{ marginTop: 10 }}><Body color={th.sell}>{res.error}</Body></View>}
      {res && !res.error && (
        <View style={{ marginTop: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 4, borderColor: vc, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: vc, fontSize: 22, fontWeight: '800' }}>{res.score}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: vc, fontSize: 18, fontWeight: '700' }}>{t(res.side!)} · {t('plan_' + res.verdict)}</Text>
              <Dim>{res.order}</Dim>
            </View>
          </View>
          <Row k={t('rrBlend')} v={`1 : ${res.rr!.toFixed(2)}`} />
          {res.rrs!.map((v, i) => <Row key={i} k={`TP${i + 1} · ${[50, 30, 20][i]}%`} v={`1 : ${v.toFixed(2)}`} color={th.buy} />)}
          <Row k={t('planRisk')} v={`${res.risk!.toFixed(dec)} (${res.slAtr!.toFixed(1)} ATR)`} color={th.sell} />
          <Row k={t('planReward')} v={`${res.reward!.toFixed(dec)} (${res.tpAtr!.toFixed(1)} ATR)`} color={th.buy} />
          <Row k="ATR 14" v={res.ctx!.atr.toFixed(dec)} />
          {!!res.ctx!.support.length && <Row k={t('support')} v={res.ctx!.support.map((v) => v.toFixed(dec)).join(' · ')} color={th.buy} />}
          {!!res.ctx!.resistance.length && <Row k={t('resistance')} v={res.ctx!.resistance.map((v) => v.toFixed(dec)).join(' · ')} color={th.sell} />}
          <View style={{ height: 8 }} />
          {res.checks.map((c, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
              <Text style={{ color: tone(c.tone), fontWeight: '800', width: 16 }}>{c.tone === 'good' ? '✓' : c.tone === 'warn' ? '!' : '✗'}</Text>
              <View style={{ flex: 1 }}><Body>{c.text}</Body></View>
            </View>
          ))}
          <View style={{ height: 6 }} />
          <Btn label={busy ? t('analyzing') : t('planAi')} onPress={runAi} busy={busy} />
          {ai && (
            <View style={{ marginTop: 12 }}>
              <Text style={{ color: ai.verdict === 'good' ? th.buy : ai.verdict === 'okay' ? th.gold : th.sell, fontSize: 16, fontWeight: '700', marginBottom: 4 }}>{t('plan_' + ai.verdict)}</Text>
              <Body>{ai.summary}</Body>
              {ai.improvements.map((w, i) => <Body key={i} color={th.gold}>• {w}</Body>)}
              {ai.betterEntry !== undefined && <Row k={t('planBetterEntry')} v={ai.betterEntry.toFixed(dec)} />}
              {ai.betterStopLoss !== undefined && <Row k={t('planBetterSl')} v={ai.betterStopLoss.toFixed(dec)} color={th.sell} />}
              {ai.betterTakeProfit !== undefined && <Row k={t('planBetterTp')} v={ai.betterTakeProfit.toFixed(dec)} color={th.buy} />}
            </View>
          )}
          <View style={{ height: 8 }} />
          <Dim>{t('planDisclaimer')}</Dim>
        </View>
      )}
    </Card>
  );
}
