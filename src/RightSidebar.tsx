import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, ScrollView, Easing } from 'react-native';
import { useWindowDimensions } from './win';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from './store';
import { LogoMark, PoweredBy, Avatar } from './Brand';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './ui';
import { NAV } from './nav';

// Compact right-hand sidebar: profile, every page, Trade history and the Pro tools. Slides in from the right edge.
export default function RightSidebar() {
  const { th, t, menu, setMenu, tab, setTab, account, logout, history, journal, lic, setAdminOpen, setHistOpen } = useApp();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const W = Math.min(284, width * 0.76); // slim panel: never more than about three quarters of a phone, 284 px at most
  const x = useRef(new Animated.Value(W)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (menu) { setMounted(true); Animated.timing(x, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(); }
    else if (mounted) Animated.timing(x, { toValue: W, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => setMounted(false));
  }, [menu]);
  if (!mounted) return null;

  const go = (i: number) => { setTab(i); setMenu(false); };
  const initials = (account?.name ?? '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const backdrop = x.interpolate({ inputRange: [0, W], outputRange: [0.55, 0], extrapolate: 'clamp' });

  // One menu row: a clear icon tile, a readable name (15.5 px, full-contrast colour) and a one-line explanation, so nobody has to guess what a page does.
  const row = (key: string, icon: string, title: string, sub: string | undefined, on: boolean, press: () => void, opts: { tint?: string; chevron?: boolean } = {}) => {
    const c = opts.tint ?? th.accent;
    return (
      <Pressable key={key} onPress={press} accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ selected: on }}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, borderColor: on ? c + '66' : 'transparent', backgroundColor: on ? c + '1F' : pressed ? th.hair : 'transparent' })}>
        {on ? (
          <LinearGradient colors={[c, th.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={icon} size={18} color={th.onAccent} />
          </LinearGradient>
        ) : (
          <View style={{ width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: c + '1A' }}>
            <Icon name={icon} size={18} color={c} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ color: th.text, fontWeight: on ? '800' : '600', fontSize: 14, letterSpacing: 0 }} numberOfLines={1}>{title}</Text>
          {!!sub && <Text style={{ color: th.dim, fontSize: 10.5, marginTop: 1, lineHeight: 13 }} numberOfLines={1}>{sub}</Text>}
        </View>
        {on ? <View style={{ width: 3, height: 18, borderRadius: 2, backgroundColor: c }} /> : opts.chevron !== false && <Icon name="chevron-forward" size={14} color={th.dim} />}
      </Pressable>
    );
  };
  const item = (i: number) => { const n = NAV[i]; return row(n.key, n.icon, t(n.key), t(n.desc) === n.desc ? undefined : t(n.desc), tab === i, () => go(i)); };
  const adminItem = lic.admin || lic.adminEmail
    ? row('admin', lic.admin ? 'shield-checkmark' : 'lock-closed', lic.admin ? 'Admin panel' : 'Unlock admin', lic.admin ? 'Users, payments and server key' : 'Confirm your email to unlock', false, () => { setMenu(false); if (lic.admin) setAdminOpen(true); else setTab(0); }, { tint: lic.admin ? th.accent : th.gold })
    : null;
  const historyItem = row('tradeHistory', 'receipt', t('tabTradeHistory'), `${journal.length} ${t('closedTradesWord')}`, false, () => { setMenu(false); setHistOpen(true); }, { tint: th.gold });
  const section = (label: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, marginBottom: 4, marginStart: 6 }}>
      <Text style={{ color: th.dim, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 }}>{label.toUpperCase()}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: th.hair }} />
    </View>
  );
  const planLabel = lic.status === 'admin' ? 'ADMIN' : lic.status === 'paid' ? 'PRO' : lic.status === 'trial' ? 'TRIAL' : 'EXPIRED';

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 50, elevation: 50, direction: 'ltr' }}>
      <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: '#000', opacity: backdrop }}>
        <Pressable style={{ flex: 1 }} onPress={() => setMenu(false)} />
      </Animated.View>
      <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: W, transform: [{ translateX: x }], backgroundColor: th.solid, borderTopLeftRadius: 8, borderBottomLeftRadius: 8, borderLeftWidth: 1, borderColor: th.line, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 18, elevation: 24 }}>
        <LinearGradient colors={[th.accent, th.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingTop: insets.top + 8, paddingBottom: 12, paddingHorizontal: 12 }}>
          <View pointerEvents="none" style={{ position: 'absolute', right: -40, top: -50, width: 150, height: 150, borderRadius: 75, backgroundColor: th.onAccent + '14' }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <LogoMark size={22} radius={6} />
            <Text style={{ flex: 1, color: th.onAccent, fontWeight: '900', fontSize: 14, letterSpacing: 0.2 }}>Chart Reader</Text>
            <Pressable onPress={() => setMenu(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close menu" style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: th.onAccent + '26', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={18} color={th.onAccent} />
            </Pressable>
          </View>
          <Pressable onPress={() => go(6)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Avatar size={42} name={account?.name || account?.email} bg={th.onAccent + '26'} fg={th.onAccent} ring={th.onAccent + '88'} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: th.onAccent, fontWeight: '800', fontSize: 14.5 }} numberOfLines={1}>{account?.name || 'Your account'}</Text>
              <Text style={{ color: th.onAccent, opacity: 0.85, fontSize: 11 }} numberOfLines={1}>{account?.email}</Text>
            </View>
            <View style={{ backgroundColor: th.onAccent, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
              <Text style={{ color: th.accent, fontWeight: '900', fontSize: 10, letterSpacing: 0.8 }}>{planLabel}</Text>
            </View>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
            {[[String(history.length), t('statAnalyses'), 'analytics-outline'], [String(journal.length), t('trades'), 'book-outline']].map(([v, k, ic], i) => (
              <View key={i} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: th.onAccent + '22', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8 }}>
                <Icon name={ic} size={14} color={th.onAccent} />
                <Text style={{ color: th.onAccent, fontWeight: '900', fontSize: 14 }}>{v}</Text>
                <Text style={{ flex: 1, color: th.onAccent, opacity: 0.85, fontSize: 10, fontWeight: '700' }} numberOfLines={1}>{k}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 0, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
          {!!adminItem && section('Admin')}
          {adminItem}
          {section(t('navPages'))}
          <View style={{ gap: 2 }}>{NAV.map((n, i) => (n.group === 'main' ? item(i) : null))}{historyItem}</View>
          {section(t('navProTools'))}
          <View style={{ gap: 2 }}>{NAV.map((n, i) => (n.group === 'pro' ? item(i) : null))}</View>
        </ScrollView>

        <View style={{ paddingHorizontal: 10, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 8) + 2, borderTopWidth: 1, borderColor: th.hair, gap: 4 }}>
          <Pressable onPress={() => { setMenu(false); logout(); }} accessibilityRole="button" accessibilityLabel={t('logout')} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 42, borderRadius: 8, borderWidth: 1, borderColor: th.sell + '88', backgroundColor: th.sell + (pressed ? '30' : '1A') })}>
            <Icon name="log-out-outline" size={17} color={th.sell} />
            <Text style={{ color: th.sell, fontWeight: '800', fontSize: 14 }}>{t('logout')}</Text>
          </Pressable>
          <PoweredBy compact />
          <Text style={{ color: th.dim, fontSize: 10, textAlign: 'center' }}>v2.10</Text>
        </View>
      </Animated.View>
    </View>
  );
}
