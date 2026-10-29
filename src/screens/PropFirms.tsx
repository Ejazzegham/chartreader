import React from 'react';
import { useWindowDimensions } from 'react-native';
import { useApp } from '../store';
import { Screen } from '../ui';
import { useLayout } from '../win';
import PropFirmsHome from '../PropFirmsHome';
import PropFirmsBody from '../PropFirmsBody';

// Tab 17 (key tabPropFirms). Website: the full page (src/PropFirmsHome.web.tsx). Phone: the same body inside the normal Screen.
export default function PropFirms() {
  const { t, tab } = useApp();
  const { width } = useWindowDimensions();
  if (useLayout().mode === 'desktop') return <PropFirmsHome active={tab === 17} />;
  return (
    <Screen icon="briefcase" title={t('tabPropFirms')} subtitle={t('navDescPropFirms')}>
      <PropFirmsBody w={width - 32} />
    </Screen>
  );
}
