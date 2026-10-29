import React from 'react';
import { View, ScrollView } from 'react-native';
import { HeroBanner } from './ui';
import { useRealWindow } from './win';
import { usePal, Footer, useGo } from './DesktopHome.web';
import { Notices } from './Desktop.web';
import CryptoBody from './CryptoBody';
import { CEX, DEX } from './cryptoExchanges';

// The website's Crypto Exchanges page: hero, the shared directory body (src/CryptoBody.tsx, list in src/cryptoExchanges.ts) and the site footer.
export default function CryptoHome({ active }: { active: boolean }) {
  const P = usePal(), go = useGo();
  const w = useRealWindow().width, pad = w >= 700 ? 32 : 16;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: P.alt, display: active ? 'flex' : 'none' } as any} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
      <View style={{ width: '100%', maxWidth: 1360, alignSelf: 'center', paddingHorizontal: pad, paddingTop: 24 }}>
        <HeroBanner icon="logo-bitcoin" title="Crypto Exchanges" subtitle="Leading centralized and decentralized crypto exchanges, each with a direct link to its official website."
          features={[
            { icon: 'logo-bitcoin', title: 'Top Exchanges', sub: `${CEX.length} CEX and ${DEX.length} DEX` },
            { icon: 'link-outline', title: 'Official Links', sub: 'Open in a new tab' },
            { icon: 'search-outline', title: 'Quick Search', sub: 'By name or website' },
            { icon: 'shield-checkmark-outline', title: 'Trade Safely', sub: 'Security checks first' },
          ]} />
      </View>
      <View style={{ width: '100%', maxWidth: 1360, alignSelf: 'center', paddingHorizontal: pad, paddingTop: 24, paddingBottom: 30, gap: 20 }}>
        <Notices flush />
        <CryptoBody w={Math.min(w, 1360) - pad * 2} />
      </View>
      <Footer w={w} go={go} />
    </ScrollView>
  );
}
