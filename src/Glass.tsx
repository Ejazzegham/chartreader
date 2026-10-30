import React from 'react';
import { View } from 'react-native';
import { useApp } from './store';

// Backdrop of the translucent-panel themes: one calm flat colour. (It used to be a gradient with three colour glows; the site is now quiet and flat.)
export default function GlassBackdrop() {
  const { th } = useApp();
  if (!th.glass) return null;
  return <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: th.bg }} />;
}
