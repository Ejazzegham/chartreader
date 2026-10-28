import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing } from 'react-native';
import { createPortal } from 'react-dom';
import { useFrameHost } from './Frame';
import { useApp } from './store';
import { useLayout, useWindowDimensions } from './win';

// Same props as React Native's Modal (the ones this app uses). It is drawn inside the app column instead of over the whole browser window,
// fades / slides in like the phone version, and closes with the Escape key (onRequestClose).
export default function Modal({ visible = true, transparent, animationType = 'none', onRequestClose, children }: { visible?: boolean; transparent?: boolean; animationType?: 'none' | 'slide' | 'fade'; onRequestClose?: () => void; children?: React.ReactNode; [k: string]: any }) {
  const host = useFrameHost();
  const { th, rtl } = useApp();
  const desk = useLayout().mode === 'desktop', { width } = useWindowDimensions();
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
    <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, direction: rtl ? 'rtl' : 'ltr', backgroundColor: desk ? 'rgba(4,8,20,0.55)' : transparent ? 'transparent' : th.bg, opacity: v, transform: animationType === 'slide' ? [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }] : undefined }}>
      {desk ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View style={{ width, maxWidth: '100%', height: '100%', maxHeight: 920, borderRadius: 16, overflow: 'hidden', backgroundColor: transparent ? 'transparent' : th.bg, borderWidth: 1, borderColor: th.line }}>{children}</View>
        </View>
      ) : <View style={{ flex: 1 }}>{children}</View>}
    </Animated.View>,
    host,
  );
}
