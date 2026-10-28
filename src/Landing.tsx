import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from './store';
import { Icon } from './ui';
import { LogoMark } from './Brand';
import LiveCandles from './LiveCandles';
import { PLANS } from './license';

const FEATURES: { icon: string; title: string; text: string }[] = [
  { icon: 'checkmark-circle', title: 'TRADE or WAIT, clearly', text: 'One answer per chart. A trade is shown only when the methods and the higher timeframe agree; otherwise you see why to wait.' },
  { icon: 'git-network', title: 'ICT, SMC and CR Analysis', text: 'Liquidity sweeps, order blocks, fair value gaps, BOS and CHoCH, plus CR Analysis with a double-checked entry, stop loss and three take profits.' },
  { icon: 'stats-chart', title: 'VSA, patterns and candles', text: 'Real-volume VSA, classic chart patterns and 20+ candlestick patterns confirmed by the next candle.' },
  { icon: 'layers', title: 'Top-down and scalping', text: 'Three timeframes from bias to entry, plus EMA-pullback, breakout and range scalp models.' },
  { icon: 'radio', title: 'Scanner and alerts', text: 'Scans forex, gold, crypto and synthetic indices. Every A / A+ setup goes to your Journal and rings your phone, even when the app is closed.' },
  { icon: 'briefcase', title: 'Automatic trade desk', text: 'Setups are logged for you, tracked live, closed at 50/30/20% targets, with stop to break-even and a trade replay.' },
  { icon: 'swap-vertical', title: 'Demo Trade', text: 'Practise on live prices with an MT5-style Buy / Sell ticket, stop loss, take profit and partial close.' },
  { icon: 'calculator', title: 'Risk, journal and discipline', text: 'Lot size from your stop, daily loss limit, cooldown after losses, journal insights and an equity curve.' },
];

// The website's front page (shown next to the login form on wide screens): what the product does, a live chart, the price.
export default function Landing() {
  const { th } = useApp();
  const [pw, setPw] = useState(0);
  const tx = th.onAccent, soft = tx + 'CC';
  return (
    <View style={{ flex: 1.15, minWidth: 0 }} onLayout={(e) => setPw(e.nativeEvent.layout.width)}>
      <LinearGradient colors={[th.accent, th.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <View pointerEvents="none" style={{ position: 'absolute', right: -120, top: -120, width: 420, height: 420, borderRadius: 210, backgroundColor: tx + '10' }} />
      <View pointerEvents="none" style={{ position: 'absolute', left: -100, bottom: -140, width: 360, height: 360, borderRadius: 180, backgroundColor: tx + '0C' }} />
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 40, justifyContent: 'center', gap: 22 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <LogoMark size={56} radius={12} />
          <View>
            <Text style={{ color: tx, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 }}>Chart Reader</Text>
            <Text style={{ color: soft, fontSize: 11, fontWeight: '700', letterSpacing: 1.4 }}>ANALYZE • LEARN • TRADE</Text>
          </View>
        </View>
        <View style={{ gap: 12 }}>
          <Text style={{ color: tx, fontSize: 44, fontWeight: '900', letterSpacing: -1.4, lineHeight: 48 }}>Read the market.{'\n'}Trade with precision.</Text>
          <Text style={{ color: soft, fontSize: 16, lineHeight: 24, maxWidth: 560 }}>Smart-money analysis for forex, gold, crypto and synthetic indices. A clear TRADE with entry, stop loss and three take profits, or a clear WAIT.</Text>
        </View>
        {pw > 0 && (
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 8, maxWidth: 640, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 30, shadowOffset: { width: 0, height: 14 } }}>
            <LiveCandles width={Math.min(624, pw - 112)} height={210} />
          </View>
        )}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, maxWidth: 700 }}>
          {FEATURES.map((f) => (
            <View key={f.title} style={{ width: '48%', flexGrow: 1, minWidth: 250, flexDirection: 'row', gap: 12, padding: 14, borderRadius: 12, backgroundColor: tx + '14', borderWidth: 1, borderColor: tx + '22' }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: tx + '22', alignItems: 'center', justifyContent: 'center' }}><Icon name={f.icon} size={19} color={tx} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: tx, fontSize: 14, fontWeight: '800' }}>{f.title}</Text>
                <Text style={{ color: soft, fontSize: 12.5, lineHeight: 18, marginTop: 2 }}>{f.text}</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          {['3-day free trial', `Weekly $${PLANS.weekly}`, `Monthly $${PLANS.monthly}`].map((p) => (
            <View key={p} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: tx + '1E', borderWidth: 1, borderColor: tx + '33' }}><Text style={{ color: tx, fontSize: 13, fontWeight: '800' }}>{p}</Text></View>
          ))}
          <Text style={{ color: soft, fontSize: 12, marginStart: 4 }}>Educational tool, not financial advice.</Text>
        </View>
      </ScrollView>
    </View>
  );
}
