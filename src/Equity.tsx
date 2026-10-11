import React from 'react';
import { View, Text } from 'react-native';
import { useWindowDimensions } from './win';
import Svg, { Polyline, Line } from 'react-native-svg';
import { useApp } from './store';
import { Card, Dim } from './ui';

export default function EquityCurve() {
  const { th, t, journal } = useApp();
  const { width } = useWindowDimensions();
  if (journal.length < 2) return null;
  const trades = [...journal].sort((a, b) => a.date - b.date);
  let run = 0, peak = 0, dd = 0;
  const pts = [0, ...trades.map((x) => { run += x.pnl; peak = Math.max(peak, run); dd = Math.min(dd, run - peak); return run; })];
  const W = width - 32 - 28, H = 90, min = Math.min(...pts), max = Math.max(...pts), rng = max - min || 1;
  const X = (i: number) => (i / (pts.length - 1)) * W, Y = (v: number) => 6 + (1 - (v - min) / rng) * (H - 12);
  const col = run >= 0 ? th.buy : th.sell;
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Dim>{t('equity')}</Dim>
        <Text style={{ color: col, fontWeight: '700' }}>{run >= 0 ? '+' : ''}{run.toFixed(2)}</Text>
      </View>
      <View style={{ direction: 'ltr' }}>
        <Svg width={W} height={H}>
          <Line x1={0} x2={W} y1={Y(0)} y2={Y(0)} stroke={th.line} strokeWidth={1} strokeDasharray="4 3" />
          <Polyline points={pts.map((v, i) => `${X(i)},${Y(v)}`).join(' ')} fill="none" stroke={col} strokeWidth={2} />
        </Svg>
      </View>
      <Dim>{t('maxDd')}: {dd.toFixed(2)}</Dim>
    </Card>
  );
}
