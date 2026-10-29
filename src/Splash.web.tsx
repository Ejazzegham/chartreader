import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import { useRealWindow } from './win';
import { LogoMark } from './Brand';
import LiveCandles from './LiveCandles';
import SplashPhone from './SplashPhone';

const MSGS = ['Loading market structure', 'Reading price action', 'Detecting liquidity & imbalance', 'Ready'];

// The website's start screen. A narrow browser window (a phone) keeps the phone's own start screen; a wide one gets this full-screen version:
// the brand gradient, the logo and name gliding in, a live candle chart, a progress bar with what it is doing, then a soft fade into the login or dashboard.
function DesktopSplash({ done, onGone, duration }: { done: boolean; onGone: () => void; duration: number }) {
  const { width: W, height: H } = useRealWindow();
  const card = Math.min(660, W - 80);
  const pop = useRef(new Animated.Value(0)).current;    // logo tile: scale in
  const name = useRef(new Animated.Value(0)).current;   // name + tagline
  const chart = useRef(new Animated.Value(0)).current;  // chart card
  const prog = useRef(new Animated.Value(0)).current;   // progress 0 -> 1
  const out = useRef(new Animated.Value(1)).current;    // whole-screen fade-out
  const drift = useRef(new Animated.Value(0)).current;  // slow floating of the background circles
  const [t, setT] = useState(0);

  useEffect(() => {
    const t0 = Date.now(); const iv = setInterval(() => setT(Date.now() - t0), 120);
    Animated.spring(pop, { toValue: 1, friction: 6, tension: 70, delay: 150, useNativeDriver: true }).start();
    Animated.timing(name, { toValue: 1, duration: 800, delay: 550, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    Animated.timing(chart, { toValue: 1, duration: 900, delay: 950, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    Animated.timing(prog, { toValue: 1, duration, easing: Easing.bezier(0.3, 0.1, 0.2, 1), useNativeDriver: false }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(drift, { toValue: 1, duration: 6000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(drift, { toValue: 0, duration: 6000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
    return () => clearInterval(iv);
  }, []);
  useEffect(() => {
    if (!done) return;
    Animated.timing(out, { toValue: 0, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => onGone());
  }, [done]);

  const p = Math.min(1, t / duration), msg = p < 0.45 ? MSGS[0] : p < 0.72 ? MSGS[1] : p < 1 ? MSGS[2] : MSGS[3];
  const up = (v: Animated.Value, px: number) => ({ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [px, 0] }) }] });
  const blob = (size: number, extra: object, k: number) => (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: '#FFFFFF10', transform: [{ translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, 26 * k] }) }, { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -18 * k] }) }] }, extra]} />
  );

  return (
    <Animated.View pointerEvents={done ? 'none' : 'auto'} onLayout={() => SplashScreen.hideAsync().catch(() => {})}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, opacity: out, direction: 'ltr', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      <LinearGradient colors={['#0A1530', '#12285C', '#1E40AF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      {blob(520, { right: -160, top: -180 }, 1)}
      {blob(420, { left: -140, bottom: -200 }, -1)}
      {blob(240, { left: W * 0.18, top: H * 0.12 }, 0.6)}
      <View style={{ alignItems: 'center', gap: 22, paddingHorizontal: 24 }}>
        <Animated.View style={{ opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }], shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 30, shadowOffset: { width: 0, height: 14 } }}>
          <LogoMark size={92} radius={22} />
        </Animated.View>
        <Animated.View style={[{ alignItems: 'center', gap: 6 }, up(name, 14)]}>
          <Text style={{ color: '#FFFFFF', fontSize: 46, fontWeight: '900', letterSpacing: -1.5 }}>Chart Reader</Text>
          <Text style={{ color: '#FFFFFFCC', fontSize: 13, fontWeight: '700', letterSpacing: 3 }}>ANALYZE • LEARN • TRADE</Text>
        </Animated.View>
        <Animated.View style={[{ backgroundColor: '#FFFFFF', borderRadius: 18, padding: 8, shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 34, shadowOffset: { width: 0, height: 16 } }, up(chart, 22)]}>
          <LiveCandles width={card - 16} height={Math.min(220, Math.max(150, H * 0.26))} />
        </Animated.View>
        <View style={{ width: Math.min(card, 420), gap: 10, alignItems: 'center' }}>
          <View style={{ width: '100%', height: 5, borderRadius: 3, backgroundColor: '#FFFFFF33', overflow: 'hidden' }}>
            <Animated.View style={{ height: 5, borderRadius: 3, backgroundColor: '#FFFFFF', width: prog.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
          </View>
          <Text style={{ color: '#FFFFFFD9', fontSize: 12.5, fontWeight: '600', letterSpacing: 0.4 }}>{msg}…</Text>
        </View>
      </View>
      <Text style={{ position: 'absolute', bottom: 22, color: '#FFFFFF99', fontSize: 11.5 }}>Educational tool, not financial advice.</Text>
    </Animated.View>
  );
}

export default function AnimatedSplash(props: { done: boolean; onGone: () => void; duration?: number }) {
  const { width } = useRealWindow();
  return width >= 760 ? <DesktopSplash done={props.done} onGone={props.onGone} duration={props.duration ?? 3600} /> : <SplashPhone {...props} />;
}
