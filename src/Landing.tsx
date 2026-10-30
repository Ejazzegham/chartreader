import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Icon } from './ui';
import { HERO_BG, HERO_BRASS } from './ui';
import { LogoMark } from './Brand';
import { PLANS } from './license';

const POINTS: { title: string; text: string }[] = [
  { title: 'TRADE or WAIT, clearly', text: 'One answer per chart. A trade is shown only when the methods and the higher timeframe agree; otherwise you see why to wait.' },
  { title: 'ICT, SMC and CR Analysis', text: 'Liquidity sweeps, order blocks, fair value gaps and structure, with a double-checked entry, stop loss and three take profits.' },
  { title: 'Scanner and alerts', text: 'Scans forex, gold, crypto and synthetic indices and notifies you of every A / A+ setup, even when the app is closed.' },
  { title: 'Risk, journal and discipline', text: 'Lot size from your stop, a daily loss limit, journal insights and an equity curve.' },
];

// The website's front page (shown next to the login form on wide screens): what the product does and what it costs. Calm, flat and quiet.
export default function Landing() {
  const tx = '#FFFFFF', soft = '#B4C0D8';
  return (
    <View style={{ flex: 1.1, minWidth: 0, backgroundColor: HERO_BG }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 64, paddingVertical: 48, justifyContent: 'center', gap: 36 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <LogoMark size={44} radius={10} />
          <View>
            <Text style={{ color: tx, fontSize: 20, fontWeight: '700', letterSpacing: -0.2 }}>Chart Reader</Text>
            <Text style={{ color: HERO_BRASS, fontSize: 10, fontWeight: '700', letterSpacing: 2.2 }}>ANALYZE · LEARN · TRADE</Text>
          </View>
        </View>
        <View style={{ gap: 16 }}>
          <View style={{ width: 36, height: 2, backgroundColor: HERO_BRASS }} />
          <Text style={{ color: tx, fontSize: 40, fontWeight: '700', letterSpacing: -1, lineHeight: 46 }}>Read the market.{'\n'}Trade with precision.</Text>
          <Text style={{ color: soft, fontSize: 16, lineHeight: 25, maxWidth: 520 }}>Smart-money analysis for forex, gold, crypto and synthetic indices. A clear TRADE with entry, stop loss and three take profits, or a clear WAIT.</Text>
        </View>
        <View style={{ gap: 20, maxWidth: 540 }}>
          {POINTS.map((f) => (
            <View key={f.title} style={{ flexDirection: 'row', gap: 14 }}>
              <View style={{ marginTop: 2 }}><Icon name="checkmark" size={16} color={HERO_BRASS} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: tx, fontSize: 14.5, fontWeight: '600' }}>{f.title}</Text>
                <Text style={{ color: soft, fontSize: 13, lineHeight: 19, marginTop: 2 }}>{f.text}</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={{ borderTopWidth: 1, borderTopColor: '#FFFFFF1F', paddingTop: 18, gap: 6, maxWidth: 540 }}>
          <Text style={{ color: tx, fontSize: 13, fontWeight: '600' }}>{`3-day free trial  ·  Weekly $${PLANS.weekly}  ·  Monthly $${PLANS.monthly}`}</Text>
          <Text style={{ color: '#8E9BB8', fontSize: 12 }}>Educational tool, not financial advice.</Text>
        </View>
      </ScrollView>
    </View>
  );
}
