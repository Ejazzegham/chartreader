import React from 'react';
import { useWindowDimensions } from 'react-native';
import { useApp } from '../store';
import { Screen } from '../ui';
import { useLayout } from '../win';
import ForexHoursHome from '../ForexHoursHome';
import ForexHoursBody from '../ForexHoursBody';

// Tab 8 (key tabKillzones, now shown as "Forex Market Hours"). Website: the full page (src/ForexHoursHome.web.tsx). Phone: the same body inside the normal Screen.
export default function ForexHours() {
  const { t, tab, setTab, setAmethod } = useApp();
  const { width } = useWindowDimensions();
  if (useLayout().mode === 'desktop') return <ForexHoursHome active={tab === 8} />;
  return (
    <Screen icon="globe" title={t('tabKillzones')} subtitle={t('navDescKz')}>
      <ForexHoursBody active={tab === 8} w={width - 32} onAnalysis={(m) => { setAmethod(m ?? ''); setTab(1); }} />
    </Screen>
  );
}
