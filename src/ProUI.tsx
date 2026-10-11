import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useApp } from './store';
import { Body, Card, Dim, Row, Btn } from './ui';
import { TP_SPLIT } from './gemini';

// 3-step take profit ladder: TP1 / TP2 / TP3 with the share of the position to close at each.
export function TpLadder({ rows }: { rows: { label: string; price: string; split: number; r?: string }[] }) {
  const { th } = useApp();
  return (
    <View style={{ gap: 8 }}>
      {rows.map((x, i) => (
        <View key={x.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: th.buy + '12', borderColor: th.buy + '44', borderWidth: 1, borderRadius: 8, padding: 10 }}>
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: th.buy, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: th.dark ? '#08110E' : '#FFFFFF', fontWeight: '900', fontSize: 12 }}>{x.label}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: th.text, fontWeight: '800', fontSize: 16 }}>{x.price}</Text>
            <Text style={{ color: th.dim, fontSize: 11 }}>{x.r ? `${x.r} · ` : ''}{i === 0 ? '→ SL to break-even' : i === 1 ? '→ trail behind structure' : '→ runner'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: th.buy, fontWeight: '900', fontSize: 15 }}>{x.split}%</Text>
            <Text style={{ color: th.dim, fontSize: 10 }}>CLOSE</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export function ScoreRing({ score, color, size = 72, label }: { score: number; color: string; size?: number; label?: string }) {
  const { th } = useApp();
  const r = (size - 10) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, score));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', direction: 'ltr' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={th.line} strokeWidth={6} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={6} fill="none" strokeLinecap="round" strokeDasharray={`${(c * v) / 100} ${c}`} />
      </Svg>
      <Text style={{ color, fontWeight: '900', fontSize: size * 0.3 }}>{label ?? Math.round(v)}</Text>
    </View>
  );
}

export function Checklist({ items }: { items: { text: string; ok: boolean }[] }) {
  const { th } = useApp();
  return (
    <View style={{ gap: 6 }}>
      {items.map((c, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
          <Text style={{ color: c.ok ? th.buy : th.dim, fontWeight: '900', width: 16 }}>{c.ok ? '✓' : '○'}</Text>
          <View style={{ flex: 1 }}><Body color={c.ok ? th.text : th.dim}>{c.text}</Body></View>
        </View>
      ))}
    </View>
  );
}

export const Tile = ({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) => {
  const { th } = useApp();
  return (
    <Card style={{ flex: 1, padding: 12 }}>
      <Dim>{label}</Dim>
      <Text style={{ color: color ?? th.text, fontWeight: '800', fontSize: 14 }} numberOfLines={2}>{value}</Text>
      {!!sub && <Text style={{ color: th.dim, fontSize: 11 }} numberOfLines={1}>{sub}</Text>}
    </Card>
  );
};

export function SetupCard({ side, model, score, grade, entry, sl, tps, rr, f, onSend, note, badge }: { side: 'buy' | 'sell'; model: string; score: number; grade: string; entry: number; sl: number; tps: number[]; rr: number[]; f: (n: number) => string; onSend: () => void; note?: string; badge?: React.ReactNode }) {
  const { th, t } = useApp();
  const sc = score >= 70 ? th.buy : score >= 50 ? th.gold : th.sell, bc = side === 'buy' ? th.buy : th.sell;
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <ScoreRing score={score} color={sc} label={grade} size={78} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: bc, fontSize: 24, fontWeight: '900' }}>{t(side)}</Text>
          <Text style={{ color: th.text, fontWeight: '700' }}>{model}</Text>
          {badge}
          <Dim>{t('confluenceScore')} {score}/100</Dim>
        </View>
      </View>
      <View style={{ height: 12 }} />
      <Row k={t('ictRefined')} v={f(entry)} color={th.accent} />
      <Row k={t('sl')} v={f(sl)} color={th.sell} />
      <Row k={t('ictInvalid')} v={`${side === 'buy' ? '<' : '>'} ${f(sl)}`} />
      <View style={{ height: 8 }} />
      <TpLadder rows={tps.map((p, i) => ({ label: `TP${i + 1}`, price: f(p), split: TP_SPLIT[i], r: `${rr[i].toFixed(1)}R` }))} />
      {!!note && <><View style={{ height: 8 }} /><Dim>{note}</Dim></>}
      <View style={{ height: 12 }} />
      <Btn label={t('sendRisk')} icon="calculator-outline" onPress={onSend} />
    </Card>
  );
}

