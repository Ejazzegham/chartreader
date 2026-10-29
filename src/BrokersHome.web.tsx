import React from 'react';
import { View, ScrollView } from 'react-native';
import { HeroBanner } from './ui';
import { useRealWindow } from './win';
import { usePal, Footer, useGo } from './DesktopHome.web';
import { Notices } from './Desktop.web';
import BrokersBody from './BrokersBody';
import { BROKERS } from './brokers';

// The website's Forex Brokers page: hero, the shared directory body (src/BrokersBody.tsx, list in src/brokers.ts) and the site footer.
export default function BrokersHome({ active }: { active: boolean }) {
  const P = usePal(), go = useGo();
  const w = useRealWindow().width, pad = w >= 700 ? 32 : 16;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: P.alt, display: active ? 'flex' : 'none' } as any} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
      <View style={{ width: '100%', maxWidth: 1360, alignSelf: 'center', paddingHorizontal: pad, paddingTop: 24 }}>
        <HeroBanner icon="business" title="Forex Brokers" subtitle="Major forex brokers in one list, each with a direct link to its official website."
          features={[
            { icon: 'business-outline', title: 'Major Brokers', sub: `${BROKERS.length} brokers` },
            { icon: 'link-outline', title: 'Official Links', sub: 'Open in a new tab' },
            { icon: 'search-outline', title: 'Quick Search', sub: 'By name or website' },
            { icon: 'shield-checkmark-outline', title: 'Choose Wisely', sub: 'Four checks first' },
          ]} />
      </View>
      <View style={{ width: '100%', maxWidth: 1360, alignSelf: 'center', paddingHorizontal: pad, paddingTop: 24, paddingBottom: 30, gap: 20 }}>
        <Notices flush />
        <BrokersBody w={Math.min(w, 1360) - pad * 2} />
      </View>
      <Footer w={w} go={go} />
    </ScrollView>
  );
}
