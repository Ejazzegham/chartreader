import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, Easing } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Polygon } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from './store';
import { Icon } from './ui';
import { NAV } from './nav';

// Full-width bottom bar. It spans the whole screen edge to edge (and under the phone's gesture area).
// Every colour comes from the active theme: panel for the bar, line for the top edge, accent for the lamp and the open page, dim for the others.
const BOTTOM = [0, 1, 2, 3, 6];
const H = 66;

export default function Dock() {
  const { th, t, tab, setTab, signals } = useApp();
  const insets = useSafeAreaInsets();
  const [w, setW] = useState(0);
  const idx = BOTTOM.indexOf(tab);
  const last = useRef(idx >= 0 ? idx : 0);
  if (idx >= 0) last.current = idx;
  const pos = useRef(new Animated.Value(last.current)).current;
  const glow = useRef(new Animated.Value(1)).current;
  const sc = useRef(BOTTOM.map((_, i) => new Animated.Value(i === last.current ? 1 : 0))).current;
  const itemW = w ? w / BOTTOM.length : 0;

  useEffect(() => {
    if (idx < 0) { Animated.timing(glow, { toValue: 0, duration: 160, useNativeDriver: true }).start(); return; }
    Animated.parallel([
      Animated.spring(pos, { toValue: idx, damping: 17, stiffness: 170, mass: 0.9, useNativeDriver: true }),
      Animated.sequence([Animated.timing(glow, { toValue: 0.25, duration: 90, useNativeDriver: true }), Animated.timing(glow, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true })]),
      ...sc.map((v, i) => Animated.spring(v, { toValue: i === idx ? 1 : 0, damping: 11, stiffness: 190, useNativeDriver: true })),
    ]).start();
  }, [idx]);

  const bar = th.panel, beam = th.accent, off = th.dim, onIcon = th.dark ? '#FFFFFF' : th.accent;
  const waiting = signals.filter((x) => x.status === 'signal').length, running = signals.filter((x) => x.status === 'open').length;
  const range = BOTTOM.map((_, i) => i);
  const lampW = itemW * 0.5, coneH = H - 4;

  return (
    <View style={{ backgroundColor: bar, borderTopWidth: 1, borderTopColor: th.line, paddingBottom: insets.bottom, direction: 'ltr', shadowColor: beam, shadowOpacity: th.dark ? 0.25 : 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: -4 }, elevation: 16 }}>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: H, flexDirection: 'row', overflow: 'hidden' }}>
          {itemW > 0 && (
            <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: itemW, height: H, alignItems: 'center', opacity: glow, transform: [{ translateX: pos.interpolate({ inputRange: range, outputRange: range.map((i) => i * itemW) }) }] }}>
              {/* cone of light */}
              <Svg width={itemW} height={coneH} style={{ position: 'absolute', top: 0 }}>
                <Defs>
                  <SvgGradient id="cone" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={beam} stopOpacity={th.dark ? 0.5 : 0.32} />
                    <Stop offset="0.6" stopColor={beam} stopOpacity={0.1} />
                    <Stop offset="1" stopColor={beam} stopOpacity={0} />
                  </SvgGradient>
                </Defs>
                <Polygon points={`${(itemW - lampW) / 2},0 ${(itemW + lampW) / 2},0 ${itemW - 2},${coneH} 2,${coneH}`} fill="url(#cone)" />
              </Svg>
              {/* the lamp */}
              <View style={{ width: lampW, height: 4, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, backgroundColor: beam, shadowColor: beam, shadowOpacity: 1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6 }} />
            </Animated.View>
          )}

          {BOTTOM.map((ti, i) => {
            const { key, icon } = NAV[ti], on = idx === i;
            const nBadge = key === 'tabJournal' ? waiting : 0, dot = key === 'tabJournal' && running > 0;
            return (
              <Pressable key={key} onPress={() => setTab(ti)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel={t(key)} accessibilityState={{ selected: on }}>
                <Animated.View style={{ alignItems: 'center', gap: 3, transform: [{ scale: sc[i].interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }] }}>
                  <View style={{ width: 46, height: 28, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={on ? icon : icon + '-outline'} size={23} color={on ? onIcon : off} />
                    {nBadge > 0 && (
                      <View style={{ position: 'absolute', top: -3, right: 2, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, backgroundColor: th.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: bar }}>
                        <Text style={{ color: th.onAccent, fontSize: 9.5, fontWeight: '900' }}>{nBadge > 9 ? '9+' : nBadge}</Text>
                      </View>
                    )}
                    {nBadge === 0 && dot && <View style={{ position: 'absolute', top: 0, right: 6, width: 9, height: 9, borderRadius: 5, backgroundColor: th.buy, borderWidth: 1.5, borderColor: bar }} />}
                  </View>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ maxWidth: itemW - 6, color: on ? onIcon : off, fontSize: 10.5, fontWeight: on ? '900' : '700', letterSpacing: 0.2 }}>{t(key)}</Text>
                </Animated.View>
              </Pressable>
            );
          })}
      </View>
    </View>
  );
}
