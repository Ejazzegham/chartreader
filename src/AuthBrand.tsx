import React from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { Icon, HERO_BG, HERO_BRASS } from './ui';
import { LogoMark } from './Brand';
import HeroFx from './HeroFx';

// The short brand panel next to the login / sign up form on a wide website: logo, one headline, a few lines about the product. Nothing else.
const COPY = {
  login: {
    head: 'Welcome back.',
    text: 'Smart-money analysis for forex, gold, crypto and synthetic indices. A clear TRADE with entry, stop loss and three take profits, or a clear WAIT.',
    points: [
      ['analytics-outline', 'TRADE or WAIT, clearly', 'One answer per chart, only when the methods agree.'],
      ['layers-outline', 'ICT, SMC and CR analysis', 'Liquidity, order blocks and structure in one place.'],
      ['notifications-outline', 'Scanner and alerts', 'A / A+ setups, even when the app is closed.'],
    ],
  },
  signup: {
    head: 'Start reading the market.',
    text: 'Create your free account and get professional chart analysis, a live scanner and a trading journal. Learn the method, then trade with precision.',
    points: [
      ['gift-outline', '3-day free trial', 'Full access from the first minute.'],
      ['shield-checkmark-outline', 'Built for discipline', 'Lot size from your stop, daily loss limit, equity curve.'],
      ['school-outline', 'Learn as you trade', 'A step-by-step guide for every method.'],
    ],
  },
} as const;

export default function AuthBrand({ mode }: { mode: 'login' | 'signup' }) {
  const c = COPY[mode], tx = '#FFFFFF', soft = '#C3CDE3';
  return (
    <View style={{ flex: 1, minWidth: 0, backgroundColor: HERO_BG, overflow: 'hidden' }}>
      <HeroFx />
      <View style={{ flex: 1, justifyContent: 'space-between', paddingHorizontal: 56, paddingVertical: 44 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <LogoMark size={48} radius={11} />
          <View>
            <Text style={{ color: tx, fontSize: 21, fontWeight: '700', letterSpacing: -0.2 }}>Chart Reader</Text>
            <Text style={{ color: HERO_BRASS, fontSize: 10, fontWeight: '700', letterSpacing: 2.2 }}>ANALYZE · LEARN · TRADE</Text>
          </View>
        </View>
        <View style={{ gap: 18, maxWidth: 500 }}>
          <View style={{ width: 40, height: 3, borderRadius: 2, backgroundColor: HERO_BRASS }} />
          <Text style={{ color: tx, fontSize: 40, fontWeight: '800', letterSpacing: -1.1, lineHeight: 46 }}>{c.head}</Text>
          <Text style={{ color: soft, fontSize: 16, lineHeight: 25 }}>{c.text}</Text>
          <View style={{ gap: 14, marginTop: 8 }}>
            {c.points.map(([icon, title, sub]) => (
              <View key={title} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: '#FFFFFF1A', borderWidth: 1, borderColor: '#FFFFFF2E', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={icon} size={18} color={HERO_BRASS} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: tx, fontSize: 14.5, fontWeight: '700' }}>{title}</Text>
                  <Text style={{ color: soft, fontSize: 12.5, lineHeight: 18, marginTop: 1 }}>{sub}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 16, rowGap: 6 }}>
          <Text style={{ color: '#9AA7C4', fontSize: 12 }}>Educational tool, not financial advice.</Text>
          {([['Terms', '/terms.html'], ['Privacy', '/privacy.html'], ['Disclaimer', '/disclaimer.html']] as const).map(([l, u]) => (
            <Pressable key={l} accessibilityRole="link" onPress={() => Linking.openURL(u)} style={{ cursor: 'pointer' } as any}><Text style={{ color: HERO_BRASS, fontSize: 12, fontWeight: '600' }}>{l}</Text></Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}
