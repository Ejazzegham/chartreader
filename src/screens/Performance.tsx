import React from 'react';
import { View, Text } from 'react-native';
import { useApp } from '../store';
import { Screen, Card, Dim, Body, SectionTitle, StatTile, Cols } from '../ui';
import EquityCurve from '../Equity';

const f = (n: number, d = 2) => (isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: d }) : '-');

export default function Performance() {
  const { th, t, journal, history } = useApp();
  const wins = journal.filter((j) => j.pnl > 0), losses = journal.filter((j) => j.pnl < 0);
  const gw = wins.reduce((a, j) => a + j.pnl, 0), gl = Math.abs(losses.reduce((a, j) => a + j.pnl, 0));
  const total = gw - gl, n = journal.length;
  const rate = n ? (wins.length / n) * 100 : 0;
  const avgW = wins.length ? gw / wins.length : 0, avgL = losses.length ? gl / losses.length : 0;
  const pf = gl ? gw / gl : gw ? Infinity : 0;
  const expct = n ? total / n : 0;
  const sorted = [...journal].sort((a, b) => a.date - b.date);
  let cur = 0, best = 0, worst = 0;
  sorted.forEach((j) => { if (j.pnl > 0) { cur = cur > 0 ? cur + 1 : 1; best = Math.max(best, cur); } else if (j.pnl < 0) { cur = cur < 0 ? cur - 1 : -1; worst = Math.min(worst, cur); } });
  const by: Record<string, { pnl: number; n: number }> = {};
  journal.forEach((j) => { const e = (by[j.symbol] ??= { pnl: 0, n: 0 }); e.pnl += j.pnl; e.n++; });
  const syms = Object.entries(by).sort((a, b) => b[1].pnl - a[1].pnl);
  const maxAbs = Math.max(1e-9, ...syms.map(([, v]) => Math.abs(v.pnl)));
  const side = (s: 'buy' | 'sell') => { const l = journal.filter((j) => j.side === s); return { n: l.length, pnl: l.reduce((a, j) => a + j.pnl, 0) }; };
  const B = side('buy'), S = side('sell');
  const grades: Record<string, number> = { 'A+': 0, A: 0, B: 0, C: 0 };
  history.forEach((h) => { if (h.result.ict) grades[h.result.ict.grade] = (grades[h.result.ict.grade] ?? 0) + 1; });
  const gTotal = Object.values(grades).reduce((a, b) => a + b, 0);

  return (
    <Screen icon="stats-chart" title={t('tabPerf')} subtitle={t('navDescPerf')}>
      <Cols>
        {n === 0 && <Card><Body color={th.dim}>{t('perfEmpty')}</Body></Card>}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <StatTile label={t('pnl')} value={`${total >= 0 ? '+' : ''}${f(total)}`} color={total >= 0 ? th.buy : th.sell} icon="cash-outline" />
          <StatTile label={t('statWinRate')} value={`${f(rate, 0)}%`} color={th.accent} icon="trophy-outline" />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <StatTile label={t('profitFactor')} value={pf === Infinity ? '∞' : f(pf)} color={pf >= 1.5 ? th.buy : pf >= 1 ? th.gold : th.sell} icon="podium-outline" />
          <StatTile label={t('expectancy')} value={f(expct)} color={expct >= 0 ? th.buy : th.sell} icon="pulse-outline" />
        </View>
        <EquityCurve />
        <Card>
          <SectionTitle icon="bar-chart-outline">{t('tradeStats')}</SectionTitle>
          <View style={{ height: 8 }} />
          {[[t('trades'), String(n), th.text], [t('avgWin'), `+${f(avgW)}`, th.buy], [t('avgLoss'), `-${f(avgL)}`, th.sell], [t('winStreak'), String(best), th.buy], [t('lossStreak'), String(Math.abs(worst)), th.sell],
            [t('bestTrade'), n ? `+${f(Math.max(...journal.map((j) => j.pnl)))}` : '-', th.buy], [t('worstTrade'), n ? f(Math.min(...journal.map((j) => j.pnl))) : '-', th.sell]].map(([k, v, c], i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}><Body>{k}</Body><Text style={{ color: c, fontWeight: '800' }}>{v}</Text></View>
          ))}
        </Card>
        <Card>
          <SectionTitle icon="swap-vertical-outline">{t('buySell')}</SectionTitle>
          <View style={{ height: 8 }} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {([[t('buy'), B, th.buy], [t('sell'), S, th.sell]] as const).map(([k, v, c]) => (
              <View key={k} style={{ flex: 1, borderWidth: 1, borderColor: c + '55', backgroundColor: c + '12', borderRadius: 8, padding: 12 }}>
                <Text style={{ color: c, fontWeight: '800' }}>{k} · {v.n}</Text>
                <Text style={{ color: v.pnl >= 0 ? th.buy : th.sell, fontWeight: '800', fontSize: 18 }}>{v.pnl >= 0 ? '+' : ''}{f(v.pnl)}</Text>
              </View>
            ))}
          </View>
        </Card>
        {syms.length > 0 && (
          <Card>
            <SectionTitle icon="layers-outline">{t('bySymbol')}</SectionTitle>
            <View style={{ height: 8 }} />
            {syms.slice(0, 8).map(([k, v]) => (
              <View key={k} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Body bold>{k} <Text style={{ color: th.dim, fontWeight: '400' }}>· {v.n}</Text></Body><Text style={{ color: v.pnl >= 0 ? th.buy : th.sell, fontWeight: '800' }}>{v.pnl >= 0 ? '+' : ''}{f(v.pnl)}</Text></View>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: th.line, marginTop: 4, direction: 'ltr' }}><View style={{ height: 6, borderRadius: 3, width: `${Math.max(4, (Math.abs(v.pnl) / maxAbs) * 100)}%`, backgroundColor: v.pnl >= 0 ? th.buy : th.sell }} /></View>
              </View>
            ))}
          </Card>
        )}
        <Card>
          <SectionTitle icon="git-network-outline">{t('ictGrades')}</SectionTitle>
          <View style={{ height: 8 }} />
          {gTotal === 0 ? <Dim>{t('ictGradesEmpty')}</Dim> : (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {Object.entries(grades).map(([g, c]) => (
                <View key={g} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: th.line }}>
                  <Text style={{ color: g === 'A+' || g === 'A' ? th.buy : g === 'B' ? th.gold : th.sell, fontWeight: '900', fontSize: 18 }}>{g}</Text>
                  <Text style={{ color: th.dim, fontSize: 12 }}>{c}</Text>
                </View>
              ))}
            </View>
          )}
        </Card>
      </Cols>
    </Screen>
  );
}
