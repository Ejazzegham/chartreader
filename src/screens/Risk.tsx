import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useApp } from '../store';
import { Screen, Card, Field, Btn, Row, Dim, SectionTitle, StatTile } from '../ui';
import { TpLadder } from '../ProUI';
import { TP_SPLIT } from '../gemini';

const num = (s: string) => parseFloat(s.replace(',', '.'));
const f = (n: number, d = 2) => n.toLocaleString('en-US', { maximumFractionDigits: d });

export default function Risk() {
  const { th, t, prefill, setPrefill, tab } = useApp();
  const [bal, setBal] = useState('');
  const [risk, setRisk] = useState('');
  const [entry, setEntry] = useState('');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState(['', '', '']);
  const [split, setSplit] = useState(TP_SPLIT.map(String));
  const [err, setErr] = useState('');
  const [out, setOut] = useState<null | { side: 'buy' | 'sell'; amt: number; dist: number; units: number; rows: { label: string; price: number; r: number; pct: number; units: number; profit: number }[]; total: number; blended: number; be: number }>(null);
  const [from, setFrom] = useState('');

  // Levels sent from the ICT Lab land here.
  useEffect(() => {
    if (tab !== 4 || !prefill) return;
    const d = Math.abs(prefill.entry) >= 100 ? 2 : Math.abs(prefill.entry) >= 1 ? 4 : 5;
    setEntry(prefill.entry.toFixed(d)); setSl(prefill.sl.toFixed(d));
    setTp([0, 1, 2].map((i) => (prefill.tps[i] !== undefined ? prefill.tps[i].toFixed(d) : '')));
    setFrom(prefill.symbol ?? ''); setOut(null); setErr('');
    setPrefill(null);
  }, [tab, prefill]);

  const calc = () => {
    const b = num(bal), r = num(risk), e = num(entry), s = num(sl);
    const tps = tp.map(num), sp = split.map(num);
    if ([b, r, e, s].some((x) => !isFinite(x)) || e === s || b <= 0 || r <= 0 || r > 100 || e <= 0 || s <= 0) { setErr(t('fillAll')); setOut(null); return; } // zero / negative balance, risk or prices gave negative position sizes
    const buy = e > s, used = tps.map((v, i) => ({ v, i })).filter((x) => isFinite(x.v));
    if (!used.length) { setErr(t('needTp')); setOut(null); return; }
    if (used.some((x) => (buy ? x.v <= e : x.v >= e))) { setErr(t('tpSide')); setOut(null); return; }
    const sum = used.reduce((a, x) => a + (isFinite(sp[x.i]) ? sp[x.i] : 0), 0);
    if (Math.abs(sum - 100) > 0.01) { setErr(`${t('splitSum')} (${sum}%)`); setOut(null); return; }
    setErr('');
    const amt = (b * r) / 100, dist = Math.abs(e - s), units = amt / dist;
    const rows = used.map((x) => {
      const u = (units * sp[x.i]) / 100, d = Math.abs(x.v - e);
      return { label: `TP${x.i + 1}`, price: x.v, r: d / dist, pct: sp[x.i], units: u, profit: d * u };
    });
    const total = rows.reduce((a, x) => a + x.profit, 0);
    setOut({ side: buy ? 'buy' : 'sell', amt, dist, units, rows, total, blended: total / amt, be: rows[0].profit });
  };

  const tpField = (i: number) => (
    <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
      <View style={{ flex: 2 }}><Field label={`TP${i + 1} ${t('price')}`} value={tp[i]} onChangeText={(v) => setTp(tp.map((x, k) => (k === i ? v : x)))} keyboardType="decimal-pad" /></View>
      <View style={{ flex: 1 }}><Field label={`${t('closePct')} %`} value={split[i]} onChangeText={(v) => setSplit(split.map((x, k) => (k === i ? v : x)))} keyboardType="decimal-pad" /></View>
    </View>
  );

  return (
    <Screen icon="calculator" title={t('calcTitle')} subtitle={t('navDescRisk')}>
      <View style={{ gap: 12 }}>
        {!!from && <Card style={{ borderColor: th.accent }}><Dim>{t('prefilled')} {from}</Dim></Card>}
        <Card>
          <SectionTitle icon="wallet-outline">{t('account')}</SectionTitle>
          <View style={{ height: 10 }} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Field label={t('balance')} value={bal} onChangeText={setBal} keyboardType="decimal-pad" /></View>
            <View style={{ flex: 1 }}><Field label={t('riskPct')} value={risk} onChangeText={setRisk} keyboardType="decimal-pad" /></View>
          </View>
          <SectionTitle icon="locate-outline">{t('levels')}</SectionTitle>
          <View style={{ height: 10 }} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Field label={t('entryP')} value={entry} onChangeText={setEntry} keyboardType="decimal-pad" /></View>
            <View style={{ flex: 1 }}><Field label={t('slP')} value={sl} onChangeText={setSl} keyboardType="decimal-pad" /></View>
          </View>
          <SectionTitle icon="flag-outline">{t('tpLadder')}</SectionTitle>
          <View style={{ height: 10 }} />
          {[0, 1, 2].map(tpField)}
          <Btn label={t('calc')} onPress={calc} icon="calculator-outline" />
        </Card>
        {!!err && <Text style={{ color: th.sell, lineHeight: 20 }}>{err}</Text>}

        {out && (
          <>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <StatTile label={t('riskAmt')} value={f(out.amt)} color={th.sell} icon="shield-outline" />
              <StatTile label={t('rrBlend')} value={`1 : ${f(out.blended)}`} color={th.accent} icon="trending-up-outline" />
            </View>
            <Card>
              <SectionTitle icon="flag">{t('tpLadder')}</SectionTitle>
              <View style={{ height: 10 }} />
              <TpLadder rows={out.rows.map((x) => ({ label: x.label, price: f(x.price, 5), split: x.pct, r: `${f(x.r)}R · +${f(x.profit)}` }))} />
              <View style={{ height: 12 }} />
              <Row k={t('slDist')} v={f(out.dist, 5)} />
              <Row k={t('units')} v={f(out.units, 4)} color={th.accent} />
              {out.rows.map((x) => <Row key={x.label} k={`${x.label} · ${f(x.units, 4)} ${t('unitsShort')}`} v={`+${f(x.profit)}`} color={th.buy} />)}
              <Row k={t('allTps')} v={`+${f(out.total)}`} color={th.buy} />
              <Row k={t('beAfterTp1')} v={`+${f(out.be)}`} color={th.gold} />
              <Row k={t('worstCase')} v={`-${f(out.amt)}`} color={th.sell} />
              <View style={{ height: 6 }} />
              <Dim>{t('calcNote')}</Dim>
            </Card>
          </>
        )}
      </View>
    </Screen>
  );
}
