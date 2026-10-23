import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Line, Polyline, Circle, Rect, Text as SvgText } from 'react-native-svg';
import { useApp } from './store';
import type { Div } from './divergence';

// RSI line of the closed candles with the 30 / 50 / 70 levels. The newest divergence is drawn as a line joining the RSI at the two swings,
// so the disagreement with price can be seen at a glance. Own window (not tied to the price chart zoom): it always shows the divergence.
export default function DivPanel({ div, width, height = 120 }: { div: Div; width: number; height?: number }) {
  const { th } = useApp();
  const r = div.rsi, n = r.length;
  if (!div.ok || n < 30) return null;
  const d = div.found[0];
  const want = Math.max(70, d ? n - d.a.i + 6 : 0);
  const start = Math.max(0, Math.min(n - 30, n - Math.min(want, n)));
  const padR = 30, W = width - padR, H = height, top = 8, bot = 8, ih = H - top - bot;
  const count = n - start, step = W / Math.max(1, count - 1);
  const X = (i: number) => (i - start) * step, Y = (v: number) => top + (1 - Math.max(0, Math.min(100, v)) / 100) * ih;
  const pts = r.slice(start).map((v, k) => (isFinite(v) ? `${X(start + k)},${Y(v)}` : '')).filter(Boolean).join(' ');
  const col = d ? (d.side === 'buy' ? th.buy : th.sell) : th.dim;
  const now = div.rsiNow;
  return (
    <View style={{ direction: 'ltr' }}>
      <Svg width={width} height={H}>
        <Rect x={0} y={Y(70)} width={W} height={Y(30) - Y(70)} fill={th.accent + '10'} />
        {[70, 50, 30].map((v) => (
          <React.Fragment key={v}>
            <Line x1={0} x2={W} y1={Y(v)} y2={Y(v)} stroke={th.line} strokeWidth={1} strokeDasharray={v === 50 ? '2 5' : '4 4'} />
            <SvgText x={W + 4} y={Y(v) + 3} fontSize={9} fill={th.dim}>{v}</SvgText>
          </React.Fragment>
        ))}
        {!!pts && <Polyline points={pts} fill="none" stroke={th.accent} strokeWidth={1.6} />}
        {d && d.a.i >= start && (
          <>
            <Line x1={X(d.a.i)} y1={Y(d.a.rsi)} x2={X(d.b.i)} y2={Y(d.b.rsi)} stroke={col} strokeWidth={2} />
            <Circle cx={X(d.a.i)} cy={Y(d.a.rsi)} r={4} fill={col} />
            <Circle cx={X(d.b.i)} cy={Y(d.b.rsi)} r={4} fill={col} />
            <SvgText x={Math.min(W - 70, X(d.b.i) + 6)} y={Math.max(11, Y(d.b.rsi) + (d.side === 'buy' ? 14 : -7))} fontSize={9.5} fontWeight="800" fill={col}>{d.kind.toUpperCase()}</SvgText>
          </>
        )}
        {isFinite(now) && <Circle cx={X(n - 1)} cy={Y(now)} r={3} fill={th.text} />}
      </Svg>
      <Text style={{ color: th.dim, fontSize: 11, marginTop: 2 }}>{`RSI 14 now ${isFinite(now) ? now.toFixed(1) : '-'}. Line = RSI at the two swings of the newest divergence.`}</Text>
    </View>
  );
}
