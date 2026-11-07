import React from 'react';
import { View, ScrollView } from 'react-native';
import { HeroBanner } from './ui';
import { usePal, Footer, useGo } from './DesktopHome.web';
import { Notices } from './Desktop.web';
import { useRealWindow } from './win';
import CommunityView from './CommunityView';

// The website's Community page: the same hero as every other page, then the community (feed + side panel), then the footer.
export default function CommunityHome() {
  const P = usePal(), w = useRealWindow().width, go = useGo(), pad = w >= 700 ? 32 : 16;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: P.bg }} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
      <View style={{ width: '100%', maxWidth: 1280, alignSelf: 'center', paddingHorizontal: pad, paddingTop: 24, paddingBottom: 40, gap: 20 }}>
        <Notices flush />
        <HeroBanner icon="people" tag="Community" title="Trader Community" subtitle="Discuss the markets, ask questions and share your trade ideas with traders from around the world."
          features={[{ icon: 'stats-chart', title: 'Share analysis', sub: 'Entry, stop loss and targets' }, { icon: 'chatbubbles', title: 'Discuss ideas', sub: 'Comment and learn together' }, { icon: 'help-circle', title: 'Ask questions', sub: 'Get answers from traders' }, { icon: 'shield-checkmark', title: 'Moderated', sub: 'Respectful and spam-free' }]} />
        <CommunityView />
      </View>
      <Footer w={w} go={go} />
    </ScrollView>
  );
}
