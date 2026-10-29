import React from 'react';
import { useWindowDimensions } from 'react-native';
import { useApp } from '../store';
import { Screen } from '../ui';
import { useLayout } from '../win';
import CryptoHome from '../CryptoHome';
import CryptoBody from '../CryptoBody';

// Tab 19 (key tabCrypto). Website: the full page (src/CryptoHome.web.tsx). Phone: the same body inside the normal Screen.
export default function CryptoExchanges() {
  const { t, tab } = useApp();
  const { width } = useWindowDimensions();
  if (useLayout().mode === 'desktop') return <CryptoHome active={tab === 19} />;
  return (
    <Screen icon="logo-bitcoin" title={t('tabCrypto')} subtitle={t('navDescCrypto')}>
      <CryptoBody w={width - 32} />
    </Screen>
  );
}
