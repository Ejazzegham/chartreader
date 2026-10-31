import React from 'react';
import { View, ScrollView } from 'react-native';
import { HeroBanner } from './ui';
import { useRealWindow } from './win';
import { usePal, Footer, useGo } from './DesktopHome.web';
import { Notices } from './Desktop.web';
import PropFirmsBody from './PropFirmsBody';
import { PROP_FIRMS } from './propFirms';

// The website's Prop Firms page: hero, the shared body (src/PropFirmsBody.tsx, list in src/propFirms.ts) and the site footer.
export default function PropFirmsHome({ active }: { active: boolean }) {
  const P = usePal(), go = useGo();
  const w = useRealWindow().width, pad = w >= 700 ? 32 : 16;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: P.alt, display: active ? 'flex' : 'none' } as any} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
      <View style={{ width: '100%', maxWidth: 1280, alignSelf: 'center', paddingHorizontal: pad, paddingTop: 24 }}>
        <HeroBanner icon="briefcase" title="Prop Firms" subtitle="Funded trading programs in ranked order, each with a direct link to its official website."
          features={[
            { icon: 'star-outline', title: 'Featured', sub: 'Hand-picked firms' },
            { icon: 'list-outline', title: 'Directory', sub: `${PROP_FIRMS.length} ranked firms` },
            { icon: 'git-compare-outline', title: 'Compare', sub: 'Up to 4 side by side' },
            { icon: 'book-outline', title: 'Guide', sub: 'Choose wisely' },
          ]} />
      </View>
      <View style={{ width: '100%', maxWidth: 1280, alignSelf: 'center', paddingHorizontal: pad, paddingTop: 24, paddingBottom: 30, gap: 20 }}>
        <Notices flush />
        <PropFirmsBody w={Math.min(w, 1280) - pad * 2} />
      </View>
      <Footer w={w} go={go} />
    </ScrollView>
  );
}
