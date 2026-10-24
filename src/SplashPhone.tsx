import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Animated, Easing, Image, Platform } from 'react-native';
import { useRealWindow } from './win';
import Svg, { Defs, LinearGradient, Stop, Path, Rect, Line, Circle, G, ClipPath, Text as SText } from 'react-native-svg';
import { LinearGradient as Grad } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { makeLayout, frame, Vr, LOGO_W, UP, DN, BUCKETS, bucketHex } from './splashMath';

const LOGO = require('../assets/splash.png');
const BLUE = '#2F5BFF', MUTE = '#8A93A6', TRACK = '#E8ECF4', INK = '#1E3778';
const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });
const MSGS = ['Loading market structure', 'Reading price action', 'Detecting liquidity & imbalance', 'Ready'];

// Start screen: white, your logo (starts exactly where the phone's own splash draws it, then glides up), the slogan, an endless live candle chart
// with volume and an EMA, ten flowing lines on each side of the logo, a progress line and the maker's name.
// It stays for `duration` ms (App.tsx: SPLASH_MS), waits for the app to be ready, then fades out. The drawing maths is in src/splashMath.ts.
export default function AnimatedSplash({ done, onGone, duration = 3600 }: { done: boolean; onGone: () => void; duration?: number }) {
  const { width: winW, height: H } = useRealWindow();
  const W = Math.min(winW, 520); // on a wide browser window the splash keeps its phone-sized column, centred
  const ins = useSafeAreaInsets();
  const L = useMemo(() => makeLayout(W, H, ins.top, ins.bottom), [W, H, ins.top, ins.bottom]);
  const vr = useRef<Vr>({ lo: 0, hi: 0, set: false, t: 0 }).current;
  const [t, setT] = useState(0);
  const lift = useRef(new Animated.Value(0)).current;   // logo: centre -> top
  const slog = useRef(new Animated.Value(0)).current;   // slogan + its line (JS driver: letter spacing)
  const fadeIn = useRef(new Animated.Value(0)).current; // footer
  const progIn = useRef(new Animated.Value(0)).current; // progress block
  const prog = useRef(new Animated.Value(0)).current;   // progress 0 -> 1
  const out = useRef(new Animated.Value(1)).current;    // whole-screen fade-out
  const bar = 150;

  useEffect(() => {
    let raf = 0; const t0 = Date.now();
    const loop = () => { setT(Date.now() - t0); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    Animated.timing(lift, { toValue: 1, duration: 1000, delay: 650, easing: Easing.bezier(0.65, 0, 0.25, 1), useNativeDriver: true }).start();
    Animated.timing(slog, { toValue: 1, duration: 1500, delay: 1000, easing: Easing.bezier(0.2, 0.7, 0.2, 1), useNativeDriver: false }).start();
    Animated.timing(fadeIn, { toValue: 1, duration: 700, delay: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    Animated.timing(progIn, { toValue: 1, duration: 700, delay: 1000, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    Animated.timing(prog, { toValue: 1, duration, easing: Easing.bezier(0.3, 0.1, 0.2, 1), useNativeDriver: true }).start();
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!done) return;
    Animated.timing(out, { toValue: 0, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => onGone());
  }, [done]);

  const f = frame(t, L, vr);
  const p = t / duration, msg = p < 0.5 ? MSGS[0] : p < 0.76 ? MSGS[1] : p < 1 ? MSGS[2] : MSGS[3];
  const slogTop = L.top + L.lh + 4;

  return (
    <Animated.View
      pointerEvents={done ? 'none' : 'auto'}
      onLayout={() => SplashScreen.hideAsync().catch(() => {})}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF', zIndex: 100, elevation: 100, opacity: out, direction: 'ltr' }}
    >
      <Svg width={W} height={H} style={{ position: 'absolute', top: 0, left: 0 }} pointerEvents="none">
        <Defs>
          {Array.from({ length: BUCKETS }, (_, b) => (
            <LinearGradient key={b} id={`s${b}`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={bucketHex(b)} stopOpacity={0} />
              <Stop offset="1" stopColor={bucketHex(b)} stopOpacity={0.95} />
            </LinearGradient>
          ))}
          <LinearGradient id="fl" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
          {f.zones.map((z, i) => (
            <ClipPath key={i} id={`z${i}`}><Rect x={z[0]} y={L.top - 4} width={z[1] - z[0]} height={L.lh + 8} /></ClipPath>
          ))}
        </Defs>

        {/* flowing lines beside the logo */}
        <G opacity={f.flowAl}>
          <Path d={f.track} stroke={BLUE} strokeOpacity={0.1} strokeWidth={1.4} strokeLinecap="round" fill="none" />
          {[0, 1].map((zi) => (
            <G key={zi} clipPath={`url(#z${zi})`}>
              {f.flow.filter((s) => s.z === zi).map((s, i) => (
                <React.Fragment key={i}>
                  <Rect x={s.head - s.sl} y={s.y - s.lw / 2} width={s.sl} height={s.lw} rx={s.lw / 2} fill={`url(#s${s.b})`} />
                  <Circle cx={s.head} cy={s.y} r={s.lw === 2 ? 2 : 1.6} fill={bucketHex(s.b)} />
                </React.Fragment>
              ))}
            </G>
          ))}
        </G>

        {/* live chart */}
        <G opacity={f.ia}>
          <Path d={f.grid} stroke={INK} strokeOpacity={0.07} strokeWidth={1} fill="none" />
          <Path d={f.vgrid} stroke={INK} strokeOpacity={0.05} strokeWidth={1} fill="none" />
          <Line x1={0} x2={W} y1={f.y1 + 0.5} y2={f.y1 + 0.5} stroke={INK} strokeOpacity={0.14} strokeWidth={1} />
          <Path d={f.volUp} fill={UP} fillOpacity={0.23} />
          <Path d={f.volDn} fill={DN} fillOpacity={0.23} />
          <Path d={f.ema} stroke={BLUE} strokeOpacity={0.85} strokeWidth={1.8} strokeLinejoin="round" fill="none" />
          <Path d={f.wickUp} stroke={UP} strokeWidth={1.4} fill="none" />
          <Path d={f.wickDn} stroke={DN} strokeWidth={1.4} fill="none" />
          <Path d={f.bodyUp} fill={UP} />
          <Path d={f.bodyDn} fill={DN} />
          <Rect x={0} y={f.y0 - 6} width={f.x0 + f.sw * 4} height={f.y1 - f.y0 + 10} fill="url(#fl)" />
          {f.labels.map((l) => (
            <SText key={l.txt} x={f.x1 + 8} y={l.y + 3.5} fontSize={9.5} fill={MUTE} fontFamily={MONO}>{l.txt}</SText>
          ))}
          <Line x1={f.tag.x} x2={f.x1 + 4} y1={f.tag.y} y2={f.tag.y} stroke={f.tag.col} strokeOpacity={0.6} strokeWidth={1.2} strokeDasharray="5,4" />
          <Rect x={f.x1 + 2} y={f.tag.y - 9} width={W - f.x1 - 8} height={18} rx={4} fill={f.tag.col} />
          <SText x={f.x1 + 2 + (W - f.x1 - 8) / 2} y={f.tag.y + 3.5} fontSize={10} fontWeight="700" fill="#FFFFFF" textAnchor="middle" fontFamily={MONO}>{f.tag.txt}</SText>
        </G>
      </Svg>

      {/* logo: starts centred (same place as the phone's splash), then glides up */}
      <Animated.View style={{ position: 'absolute', top: L.top, left: (W - LOGO_W) / 2, width: LOGO_W, height: L.lh, transform: [{ translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [L.shift, 0] }) }] }}>
        <Image source={LOGO} style={{ width: LOGO_W, height: L.lh }} resizeMode="contain" />
      </Animated.View>

      {/* slogan */}
      <Animated.Text style={{ position: 'absolute', top: slogTop, left: 0, right: 0, textAlign: 'center', fontSize: 10, fontWeight: '600', color: '#5B6B94', opacity: slog, letterSpacing: slog.interpolate({ inputRange: [0, 1], outputRange: [4.2, 1.7] }) }}>
        READ THE MARKET. TRADE WITH <Text style={{ color: BLUE, fontWeight: '700' }}>PRECISION.</Text>
      </Animated.Text>
      <View style={{ position: 'absolute', top: slogTop + 24, left: 0, right: 0, alignItems: 'center' }}>
        <Animated.View style={{ height: 1.5, width: slog.interpolate({ inputRange: [0, 1], outputRange: [0, 130] }), overflow: 'hidden' }}>
          <Grad colors={['rgba(47,91,255,0)', BLUE, 'rgba(47,91,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
        </Animated.View>
      </View>

      {/* progress + status */}
      <Animated.View style={{ position: 'absolute', top: L.y1 + 26, left: 0, right: 0, alignItems: 'center', opacity: progIn }}>
        <View style={{ width: bar, height: 3, borderRadius: 2, backgroundColor: TRACK, overflow: 'hidden' }}>
          <Animated.View style={{ width: bar, height: 3, backgroundColor: BLUE, transform: [{ translateX: prog.interpolate({ inputRange: [0, 1], outputRange: [-bar, 0] }) }] }} />
        </View>
        <Text style={{ marginTop: 11, color: MUTE, fontSize: 10.5, letterSpacing: 1, fontWeight: '500' }}>{msg.toUpperCase()}</Text>
      </Animated.View>

      <Animated.Text style={{ position: 'absolute', bottom: L.bottom + 34, left: 0, right: 0, textAlign: 'center', color: MUTE, fontSize: 11.5, letterSpacing: 0.5, opacity: fadeIn }}>
        Powered by <Text style={{ color: BLUE, fontWeight: '800' }}>Bahu Technology</Text>
      </Animated.Text>
    </Animated.View>
  );
}
