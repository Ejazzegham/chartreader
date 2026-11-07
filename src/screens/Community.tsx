import React from 'react';
import { useApp } from '../store';
import { Screen } from '../ui';
import { useLayout } from '../win';
import CommunityHome from '../CommunityHome';
import CommunityView from '../CommunityView';

// Website: the Community page (CommunityHome.web.tsx). Phone app: the same community inside the normal phone screen.
export default function Community() {
  const { t } = useApp();
  if (useLayout().mode === 'desktop') return <CommunityHome />;
  return <Screen fx="community" icon="people" title={t('tabCommunity')} subtitle={t('navDescCommunity')}><CommunityView /></Screen>;
}
