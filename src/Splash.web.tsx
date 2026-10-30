import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { LogoMark } from './Brand';
import { HERO_BG, HERO_BRASS } from './ui';
import { useRealWindow } from './win';
import SplashPhone from './SplashPhone';

// The website's start screen. A narrow browser window (a phone) keeps the phone's own start screen; a wide one gets this quiet version:
// flat deep navy, the logo and name fading in, a thin progress line, then a soft fade into the login or dashboard.
function DesktopSplash({ done, onGone, duration }: { done: boolean; onGone: () => void; duration: number }) {
  const show = useRef(new Animated.Value(0)).current;
  const prog = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(show, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    Animated.timing(prog, { toValue: 1, duration, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  }, []);
  useEffect(() => {
    if (!done) return;
    Animated.timing(out, { toValue: 0, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => onGone());
  }, [done]);

  return (
    <Animated.View pointerEvents={done ? 'none' : 'auto'} onLayout={() => SplashScreen.hideAsync().catch(() => {})}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, opacity: out, direction: 'ltr', alignItems: 'center', justifyContent: 'center', backgroundColor: HERO_BG }}>
      <Animated.View style={{ alignItems: 'center', gap: 18, opacity: show, transform: [{ translateY: show.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
        <LogoMark size={64} radius={14} />
        <Text style={{ color: '#FFFFFF', fontSize: 30, fontWeight: '700', letterSpacing: -0.5 }}>Chart Reader</Text>
        <Text style={{ color: HERO_BRASS, fontSize: 11, fontWeight: '700', letterSpacing: 2.4 }}>ANALYZE · LEARN · TRADE</Text>
        <View style={{ width: 160, height: 2, backgroundColor: '#FFFFFF1F', marginTop: 10, overflow: 'hidden' }}>
          <Animated.View style={{ height: 2, backgroundColor: HERO_BRASS, width: prog.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
        </View>
      </Animated.View>
      <Text style={{ position: 'absolute', bottom: 22, color: '#8E9BB8', fontSize: 11.5 }}>Educational tool, not financial advice.</Text>
    </Animated.View>
  );
}

export default function AnimatedSplash(props: { done: boolean; onGone: () => void; duration?: number }) {
  const { width } = useRealWindow();
  return width >= 760 ? <DesktopSplash done={props.done} onGone={props.onGone} duration={props.duration ?? 1400} /> : <SplashPhone {...props} />;
}
