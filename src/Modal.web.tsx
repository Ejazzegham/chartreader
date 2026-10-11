import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing } from 'react-native';
import { createPortal } from 'react-dom';
import { useFrameHost } from './Frame';
import { useApp } from './store';

// Same props as React Native's Modal (the ones this app uses). It is drawn inside the app column instead of over the whole browser window,
// fades / slides in like the phone version, and closes with the Escape key (onRequestClose).
export default function Modal({ visible, transparent, animationType = 'none', onRequestClose, children }: { visible?: boolean; transparent?: boolean; animationType?: 'none' | 'slide' | 'fade'; onRequestClose?: () => void; children?: React.ReactNode; [k: string]: any }) {
  const host = useFrameHost();
  const { th, rtl } = useApp();
  const v = useRef(new Animated.Value(0)).current;
  const closeRef = useRef(onRequestClose); closeRef.current = onRequestClose;
  useEffect(() => {
    if (!visible) { v.setValue(0); return; }
    Animated.timing(v, { toValue: 1, duration: animationType === 'none' ? 0 : 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current?.(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [visible]);
  if (!visible || !host) return null;
  return createPortal(
    <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, direction: rtl ? 'rtl' : 'ltr', backgroundColor: transparent ? 'transparent' : th.bg, opacity: v, transform: animationType === 'slide' ? [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }] : undefined }}>
      <View style={{ flex: 1 }}>{children}</View>
    </Animated.View>,
    host,
  );
}
