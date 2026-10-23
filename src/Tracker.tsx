import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, Pressable, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp, Toast } from './store';
import { Icon } from './ui';
import { useFeed, setWatch } from './markets';
import { makeGuard } from './priceGuard';

// Follows live prices for every logged setup and every taken trade, even while another page is open.
export function Tracker() {
  const { signals, positions, track, loggedIn } = useApp();
  const has = loggedIn && (signals.length > 0 || positions.length > 0);
  const { quotes } = useFeed(has);
  const ids = useMemo(() => {
    const run = [...signals.filter((s) => s.status !== 'signal').map((s) => s.symId), ...positions.map((p) => p.symId)];
    const fresh = signals.filter((s) => s.status === 'signal').slice(0, 8).map((s) => s.symId);
    return [...new Set([...run, ...fresh])];
  }, [signals, positions]);
  const key = ids.join(',');
  useEffect(() => { setWatch('desk', has ? ids : []); return () => setWatch('desk', []); }, [key, has]);
  const guard = useRef(makeGuard()).current;
  useEffect(() => { // runs after every price update
    if (!has) return;
    const prices: Record<string, number> = {};
    ids.forEach((id) => {
      const q = quotes[id];
      if (!q || q.fut) return; // no price yet, or a backup futures price that is not matched to spot
      const p = guard(id, q, q.price); // a far-off reading waits for a second one that agrees
      if (p !== undefined) prices[id] = p;
    });
    if (Object.keys(prices).length) track(prices);
  });
  return null;
}

function ToastCard({ x, onClose }: { x: Toast; onClose: () => void }) {
  const { th, rtl, openNote } = useApp();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(v, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(); }, []);
  const c = x.kind === 'good' ? th.buy : x.kind === 'bad' ? th.sell : th.accent;
  const icon = x.kind === 'good' ? 'checkmark-circle' : x.kind === 'bad' ? 'close-circle' : 'notifications';
  return (
    <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] }) }] }}>
      <Pressable onPress={() => { onClose(); if (x.go) openNote(x.go === true ? {} : x.go); }} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: th.panel, borderRadius: 8, borderWidth: 1, borderColor: c + '88', paddingVertical: 11, paddingHorizontal: 12, shadowColor: c, shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 10 }}>
        <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: c }} />
        <Icon name={icon} size={22} color={c} />
        <Text style={{ flex: 1, color: th.text, fontSize: 13, fontWeight: '700', lineHeight: 18 }}>{x.text}</Text>
        {!!x.go && <Icon name={rtl ? 'chevron-back' : 'chevron-forward'} size={18} color={th.dim} />}
      </Pressable>
    </Animated.View>
  );
}

// Banners that slide in from the top: order filled, TP hit, stop hit, price at the entry zone.
export function Toasts() {
  const { toasts, dismissToast } = useApp();
  const insets = useSafeAreaInsets();
  if (!toasts.length) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: Math.max(insets.top, 12) + 6, left: 12, right: 12, gap: 8, zIndex: 50, direction: 'ltr' }}>
      {toasts.map((x) => <ToastCard key={x.id} x={x} onClose={() => dismissToast(x.id)} />)}
    </View>
  );
}
