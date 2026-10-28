import React from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { useApp } from './store';
import { Icon } from './ui';
import { BAHU_URL, LogoMark } from './Brand';
import { setDash } from './dash';
import { useRealWindow } from './win';

// THE website footer. One component, used by every page (the *Home.web.tsx pages, the method pages, and every page built with <Screen>).
// Change it here and it changes everywhere. The phone app has no footer (SiteFooter.tsx returns nothing).

export function Footer({ w, go }: { w: number; go: (t: number, market?: string) => void }) {
  const { setHelpOpen } = useApp();
  const col = (title: string, items: [string, () => void][]) => (
    <View key={title} style={{ gap: 9, minWidth: 130 }}>
      <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700', marginBottom: 4 }}>{title}</Text>
      {items.map(([l, f]) => (
        <Pressable key={l} onPress={f} style={((st: any) => ({ cursor: 'pointer', opacity: st.hovered ? 1 : 0.72 })) as any}><Text style={{ color: '#DCE6FF', fontSize: 12.5 }}>{l}</Text></Pressable>
      ))}
    </View>
  );
  const social = ['logo-twitter', 'logo-youtube', 'paper-plane', 'logo-linkedin', 'logo-instagram'];
  return (
    <View style={{ backgroundColor: '#0A1A4A' }}>
      <View style={{ width: '100%', maxWidth: 1280, alignSelf: 'center', paddingHorizontal: 32, paddingTop: 38, paddingBottom: 18, gap: 26 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 36, justifyContent: 'space-between' }}>
          <View style={{ width: w >= 900 ? 290 : '100%', gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <LogoMark size={34} radius={9} />
              <View><Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '800' }}>Chart Reader</Text><Text style={{ color: '#FFFFFFAA', fontSize: 8, fontWeight: '700', letterSpacing: 0.6 }}>TRADING ANALYSIS PLATFORM</Text></View>
            </View>
            <Text style={{ color: '#DCE6FFCC', fontSize: 12.5, lineHeight: 19 }}>Professional trading analysis tools, real-time market data and powerful insights to help you make better trading decisions.</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {social.map((n) => <View key={n} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFFFFF1F', alignItems: 'center', justifyContent: 'center' }}><Icon name={n} size={14} color="#FFFFFF" /></View>)}
            </View>
          </View>
          {col('Quick Links', [['Home', () => go(0)], ['Analysis', () => go(1)], ['Markets', () => go(2)], ['Journal', () => go(3)], ['Risk & TP Planner', () => go(4)], ['Tools', () => go(9)]])}
          {col('Markets', [['Forex', () => go(2, 'forex')], ['Crypto', () => go(2, 'crypto')], ['Metals', () => go(2, 'metals')], ['Deriv', () => go(2, 'deriv')], ['Candles', () => go(1, 'candle')], ['Top-Down', () => go(1, 'topdown')]])}
          {col('Support', [['Help Center', () => setHelpOpen(true)], ['Contact Us', () => setHelpOpen(true)], ['Terms of Service', () => go(15)], ['Privacy Policy', () => go(15)], ['Disclaimer', () => go(15)]])}
          <View style={{ width: w >= 900 ? 230 : '100%', gap: 10 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>Stay Updated</Text>
            <Text style={{ color: '#DCE6FFCC', fontSize: 12.5, lineHeight: 18 }}>Get the latest market insights and updates.</Text>
            <Pressable onPress={() => go(13)} style={((st: any) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 38, borderRadius: 8, backgroundColor: '#1F5FE8', cursor: 'pointer', opacity: st.hovered ? 0.9 : 1 })) as any}>
              <Icon name="newspaper" size={15} color="#FFFFFF" /><Text style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' }}>Open Market News</Text>
            </Pressable>
          </View>
        </View>
        <View style={{ height: 1, backgroundColor: '#FFFFFF1F' }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <Text style={{ color: '#DCE6FFAA', fontSize: 11.5 }}>© {new Date().getFullYear()} Chart Reader. All rights reserved. Educational tool, not financial advice.</Text>
          <Pressable onPress={() => Linking.openURL(BAHU_URL).catch(() => {})} style={{ cursor: 'pointer' } as any}><Text style={{ color: '#DCE6FFAA', fontSize: 11.5 }}>Powered by <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Bahu Technology</Text></Text></Pressable>
          <Text style={{ color: '#DCE6FFAA', fontSize: 11.5 }}>Trade Smarter  •  Learn Faster  •  Grow Together</Text>
        </View>
      </View>
    </View>
  );
}

// go(tab, extra): open a page; extra = the analysis method (Analysis page) or the market group (Markets page).
export function useGo() {
  const { setTab, setAmethod } = useApp();
  return (tab: number, extra?: string) => {
    if (tab === 1 && extra) setAmethod(extra);
    if (tab === 2 && extra) setDash({ market: extra === 'metals' ? 'forex' : (extra as any) });
    setTab(tab);
  };
}

// Drop-in version for pages that do not have the window width / go() at hand.
export function PageFooter() {
  const w = useRealWindow().width;
  const go = useGo();
  return <Footer w={w} go={go} />;
}
