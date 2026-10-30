import React from 'react';
import { View, ScrollView } from 'react-native';
import { HeroBanner } from './ui';
import { useRealWindow } from './win';
import { usePal, Footer, useGo } from './DesktopHome.web';
import { Notices } from './Desktop.web';
import ForexHoursBody from './ForexHoursBody';

// The website's Forex Market Hours page (it replaces the old Killzones page): hero, then the shared body (converter, overlaps, steps, FAQ), then the site footer.
// The body is src/ForexHoursBody.tsx; the times come from src/forexHours.ts.
export default function ForexHoursHome({ active }: { active: boolean }) {
  const P = usePal(), go = useGo();
  const w = useRealWindow().width;
  const pad = w >= 700 ? 32 : 16;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: P.alt, display: active ? 'flex' : 'none' } as any} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
      <View style={{ width: '100%', maxWidth: 1280, alignSelf: 'center', paddingHorizontal: pad, paddingTop: 24 }}>
        <HeroBanner icon="globe" title="Forex Market Hours" subtitle="See which forex sessions are open right now, in your own time zone."
          features={[
            { icon: 'globe-outline', title: 'Any Time Zone', sub: 'Your city or UTC' },
            { icon: 'radio-outline', title: 'Live Session Status', sub: 'Open or closed right now' },
            { icon: 'layers-outline', title: 'Session Overlaps', sub: 'The busiest hours' },
            { icon: 'calendar-outline', title: 'Weekly Open & Close', sub: 'Sunday to Friday' },
          ]} />
      </View>
      <View style={{ width: '100%', maxWidth: 1280, alignSelf: 'center', paddingHorizontal: pad, paddingTop: 24, paddingBottom: 30, gap: 20 }}>
        <Notices flush />
        <ForexHoursBody active={active} w={Math.min(w, 1280) - pad * 2} onAnalysis={(m) => go(1, m)} onGuide={() => go(14)} />
      </View>
      <Footer w={w} go={go} />
    </ScrollView>
  );
}
