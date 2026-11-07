import React from 'react';
import { View } from 'react-native';
import { useApp } from './store';

// Phone apps keep a calm flat background (the animated backdrop is the website only; see LiveBackdrop.web.tsx).
export default function LiveBackdrop() {
  const { th } = useApp();
  return <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: th.bg }} />;
}
