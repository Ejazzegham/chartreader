import React from 'react';
import { useWindowDimensions } from 'react-native';
import { useApp } from '../store';
import { Screen } from '../ui';
import { useLayout } from '../win';
import BrokersHome from '../BrokersHome';
import BrokersBody from '../BrokersBody';

// Tab 18 (key tabBrokers). Website: the full page (src/BrokersHome.web.tsx). Phone: the same body inside the normal Screen.
export default function Brokers() {
  const { t, tab } = useApp();
  const { width } = useWindowDimensions();
  if (useLayout().mode === 'desktop') return <BrokersHome active={tab === 18} />;
  return (
    <Screen icon="business" title={t('tabBrokers')} subtitle={t('navDescBrokers')}>
      <BrokersBody w={width - 32} />
    </Screen>
  );
}
