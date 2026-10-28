import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View, Pressable, ActivityIndicator, TextInput, TextInputProps, ViewStyle, TextStyle, Animated } from 'react-native';
import { showAlert } from './dialog';
import { useWindowDimensions, useLayout, WidthCtx } from './win';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Line, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from './store';
import { ScrollLockContext } from './scrollLock';
import { flags, subscribeFeed } from './markets';
import { TfBar, isTfList } from './Timeframe';
import { PageFooter } from './SiteFooter';

// Ask before anything that deletes the user's data. Runs `onYes` only when the person confirms.
export const confirmAction = (title: string, message: string, onYes: () => void, yes = 'Delete', no = 'Cancel') =>
  showAlert(title, message, [{ text: no, style: 'cancel' }, { text: yes, style: 'destructive', onPress: onYes }]);

export const Icon = ({ name, size = 22, color }: { name: string; size?: number; color?: string }) => {
  const { th } = useApp();
  return <Ionicons name={name as any} size={size} color={color ?? th.text} />;
};

export const WaveHeader = ({ height = 220, children }: { height?: number; children?: React.ReactNode }) => {
  const { th } = useApp();
  const { width } = useWindowDimensions();
  return (
    <View style={{ height, direction: 'ltr' }}>
      <LinearGradient colors={[th.accent, th.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
      <View pointerEvents="none" style={{ position: 'absolute', right: -50, top: -60, width: 210, height: 210, borderRadius: 105, backgroundColor: th.onAccent + '12' }} />
      <View pointerEvents="none" style={{ position: 'absolute', left: -40, bottom: 20, width: 130, height: 130, borderRadius: 65, backgroundColor: th.onAccent + '0C' }} />
      <Svg width={width} height={56} viewBox="0 0 400 56" preserveAspectRatio="none" style={{ position: 'absolute', bottom: -1 }}>
        <Path d="M0 28 C 70 -6, 150 60, 230 26 S 350 6, 400 24 L400 56 L0 56 Z" fill={th.bg} opacity={0.35} />
        <Path d="M0 38 C 80 8, 170 64, 250 36 S 360 18, 400 34 L400 56 L0 56 Z" fill={th.bg} />
      </Svg>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 28 }}>{children}</View>
    </View>
  );
};

// Feed status pill in every page header: green LIVE, amber while connecting, red when offline.
export const LiveDot = () => {
  const { th } = useApp();
  const [st, setSt] = useState(flags.status);
  useEffect(() => subscribeFeed(() => setSt((p) => (flags.status === p ? p : flags.status))), []);
  const c = st === 'live' ? th.buy : st === 'offline' ? th.sell : th.gold;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, paddingHorizontal: 9, borderRadius: 8, backgroundColor: c + '1C', borderWidth: 1, borderColor: c + '55' }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c, shadowColor: c, shadowOpacity: 1, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } }} />
      <Text style={{ color: c, fontSize: 9.5, fontWeight: '900', letterSpacing: 0.8 }}>{st === 'live' ? 'LIVE' : st === 'offline' ? 'OFFLINE' : 'SYNC'}</Text>
    </View>
  );
};

// The button that opens the sidebar. It is a plain three-line menu icon in a bordered tile, so it reads as a control and not as a logo.
export const MenuButton = () => {
  const { th, setMenu } = useApp();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Menu" accessibilityHint="Opens the sidebar" onPress={() => setMenu(true)} hitSlop={6}
      style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 8, borderWidth: 1, borderColor: pressed ? th.accent : th.line, backgroundColor: pressed ? th.accent + '1F' : th.panel, alignItems: 'center', justifyContent: 'center', direction: 'ltr' })}>
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <Line x1="4" y1="7" x2="20" y2="7" stroke={th.text} strokeWidth="2.2" strokeLinecap="round" />
        <Line x1="4" y1="12" x2="20" y2="12" stroke={th.text} strokeWidth="2.2" strokeLinecap="round" />
        <Line x1="4" y1="17" x2="14" y2="17" stroke={th.accent} strokeWidth="2.2" strokeLinecap="round" />
      </Svg>
    </Pressable>
  );
};

// The bell. Tap it to read every notification. The red number counts the ones not seen yet and disappears once the list has been opened.
export const BellButton = () => {
  const { th, t, notes, setNotesOpen } = useApp();
  const unread = notes.filter((n) => !n.read).length;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('tabNotifications')} onPress={() => setNotesOpen(true)} hitSlop={8} style={({ pressed }) => ({ width: 38, height: 38, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
      <Icon name={unread ? 'notifications' : 'notifications-outline'} size={24} color={th.text} />
      {unread > 0 && (
        <View style={{ position: 'absolute', top: 2, right: 0, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4, backgroundColor: th.sell, borderWidth: 1.5, borderColor: th.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 9.5, fontWeight: '900' }}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      )}
    </Pressable>
  );
};

// Top row shared by every page (same as the Analysis page): logo opens the menu, brand name, PRO, feed status, alerts bell.
export const AppHeader = () => {
  const { th } = useApp();
  const desk = useLayout().mode === 'desktop'; // website: the sidebar has the menu and the name, the top bar has the status chips
  if (desk) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, direction: 'ltr' }}>
      {!desk && <MenuButton />}
      {desk ? <View style={{ flex: 1 }} /> : <View style={{ flex: 1 }}>
        <Text accessibilityRole="header" style={{ color: th.accent, fontSize: 21, fontWeight: '900', letterSpacing: -0.4 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Chart Reader</Text>
        <Text style={{ color: th.dim, fontSize: 9.5, fontWeight: '700', letterSpacing: 1.2 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>ANALYZE • LEARN • TRADE</Text>
      </View>}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 28, paddingHorizontal: 9, borderRadius: 8, borderWidth: 1, borderColor: th.gold + '88', backgroundColor: th.gold + '1F' }}>
        <MaterialCommunityIcons name="crown" size={13} color={th.gold} />
        <Text style={{ color: th.gold, fontSize: 10, fontWeight: '900', letterSpacing: 0.6 }}>PRO</Text>
      </View>
      <LiveDot />
      <BellButton />
    </View>
  );
};

// small candlestick picture (same one the Analysis banner draws)
const HERO_CANDLES: [number, number, number, number, number, 's' | 'b' | 'p'][] = [
  [8, 52, 72, 56, 68, 's'], [20, 46, 70, 50, 62, 'p'], [32, 40, 62, 44, 56, 'b'], [44, 34, 58, 40, 52, 's'], [56, 28, 52, 32, 46, 'b'],
  [68, 22, 44, 26, 38, 'p'], [80, 18, 40, 22, 34, 'b'], [92, 10, 34, 14, 28, 'b'], [104, 14, 38, 20, 32, 's'],
];

// One hero for every page, the size of the Settings hero: blue card, big title, one or two lines of text and an optional row of feature chips.
export const HERO_H = 220;
const HERO_BLUE = ['#0A2A8F', '#1747D1', '#2B63F0'] as [string, string, string];
export type HeroFeature = { icon: string; title: string; sub: string; onPress?: () => void };
export const HeroBanner = ({ title, subtitle, icon, features, right, tag }: { title: string; subtitle?: string; icon?: string; features?: HeroFeature[]; right?: React.ReactNode; tag?: string }) => {
  const { rtl } = useApp();
  const { width } = useWindowDimensions();
  const wide = width >= 640;
  return (
    <View style={{ borderRadius: 18, overflow: 'hidden', direction: 'ltr', ...(wide ? { height: HERO_H } : null) }}>
      <LinearGradient colors={HERO_BLUE} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: wide ? 28 : 20, gap: 18, ...(wide ? { height: HERO_H, justifyContent: 'center' } : null) }}>
        <View pointerEvents="none" style={{ position: 'absolute', right: -30, top: -40, width: 260, height: 260, borderRadius: 130, backgroundColor: '#FFFFFF10' }} />
        {!!icon && <View pointerEvents="none" style={{ position: 'absolute', right: wide ? 70 : 10, top: wide ? 30 : 14, opacity: 0.22 }}><Icon name={icon} size={wide ? 150 : 84} color="#FFFFFF" /></View>}
        <View style={{ gap: 6, direction: rtl ? 'rtl' : 'ltr' }}>
          {!!tag && <Text style={{ color: '#9CC4FF', fontSize: 11.5, fontWeight: '800', letterSpacing: 1.3 }}>{tag.toUpperCase()}</Text>}
          <Text accessibilityRole="header" style={{ color: '#FFFFFF', fontSize: wide ? 34 : 26, fontWeight: '900', letterSpacing: -0.8 }} numberOfLines={1}>{title}</Text>
          {!!subtitle && <Text style={{ color: '#DCE6FF', fontSize: 14.5, lineHeight: 21, maxWidth: 560 }} numberOfLines={2}>{subtitle}</Text>}
          {!!right && <View style={{ flexDirection: 'row', alignSelf: 'flex-start', marginTop: 4 }}>{right}</View>}
        </View>
        {!!features?.length && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {features.map((f) => (
              <Pressable key={f.title} disabled={!f.onPress} onPress={f.onPress} style={{ flexBasis: wide ? '23%' : '47%', flexGrow: 1, minWidth: 150, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF1A', borderColor: '#FFFFFF2E', borderWidth: 1, borderRadius: 12, padding: 10, cursor: f.onPress ? 'pointer' : 'default' } as any}>
                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#FFFFFF24', alignItems: 'center', justifyContent: 'center' }}><Icon name={f.icon} size={18} color="#FFFFFF" /></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }} numberOfLines={1}>{f.title}</Text>
                  {!!f.sub && <Text style={{ color: '#C9D8FF', fontSize: 11.5 }} numberOfLines={1}>{f.sub}</Text>}
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </LinearGradient>
    </View>
  );
};

// Hero banner at the top of every page: the same look as the Analysis page banner (soft accent gradient, candles on the right).
export const PageHero = ({ title, subtitle, icon, right, tag }: { title: string; subtitle?: string; icon?: string; right?: React.ReactNode; tag?: string }) => {
  const { th, rtl } = useApp();
  const { width } = useWindowDimensions();
  const W = width - 32, fs = Math.max(20, Math.min(26, Math.round(W * 0.064)));
  const desk = useLayout().mode === 'desktop';
  if (desk) return <HeroBanner title={title} subtitle={subtitle} icon={icon} right={right} tag={tag} />; // website: the same hero as Settings
  return (
    <LinearGradient colors={[th.accent + (th.dark ? '2E' : '16'), th.accent2 + (th.dark ? '38' : '26')]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ borderRadius: 8, borderWidth: 1, borderColor: th.line, overflow: 'hidden', minHeight: 112, justifyContent: 'center', direction: 'ltr' }}>
      <View pointerEvents="none" style={{ position: 'absolute', right: 8, top: 12, bottom: 12, width: W >= 520 ? '26%' : '34%', justifyContent: 'center', opacity: 0.9 }}>
        <Svg width="100%" height="100%" viewBox="0 0 120 80" preserveAspectRatio="xMidYMid meet">
          <Path d="M4 68 C 30 66, 44 50, 62 40 S 94 22, 112 12" stroke={th.accent2} strokeWidth="2" strokeOpacity="0.35" fill="none" strokeLinecap="round" />
          {HERO_CANDLES.map(([x, wt, wb, bt, bb, c], i) => {
            const col = c === 'b' ? th.buy : c === 's' ? th.sell : th.accent2;
            return (<React.Fragment key={i}><Line x1={x} y1={wt} x2={x} y2={wb} stroke={col} strokeWidth="1.6" strokeLinecap="round" /><Rect x={x - 3.4} y={bt} width="6.8" height={bb - bt} rx="1.6" fill={col} /></React.Fragment>);
          })}
        </Svg>
      </View>
      <View style={{ padding: 16, paddingRight: W >= 520 ? '30%' : '36%', gap: 10, direction: rtl ? 'rtl' : 'ltr' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {!!icon && <IconTile icon={icon} size={46} />}
          <View style={{ flex: 1 }}>
            {!!tag && <Text style={{ color: th.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.4, marginBottom: 2 }}>{tag.toUpperCase()}</Text>}
            <Text accessibilityRole="header" style={{ color: th.text, fontSize: fs, fontWeight: '900', letterSpacing: -0.5 }} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>{title}</Text>
          </View>
        </View>
        {!!subtitle && <Text style={{ color: th.dim, fontSize: 12, lineHeight: 17 }} numberOfLines={3}>{subtitle}</Text>}
        {!!right && <View style={{ flexDirection: 'row', alignSelf: 'flex-start' }}>{right}</View>}
      </View>
    </LinearGradient>
  );
};

// bare: the page draws its own header (the Analysis page does). scrollKey: when it changes the page jumps back to the top.
// Every other page gets the same header row and hero banner as the Analysis page.
export const Screen = ({ title, subtitle, right, children, bare, scrollKey, icon, tag }: { title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode; bare?: boolean; scrollKey?: string; icon?: string; tag?: string }) => {
  const { th } = useApp();
  const L = useLayout();
  const insets = useSafeAreaInsets();
  const scroller = useRef<ScrollView>(null);
  const [lock, setLock] = useState(false); // a finger is on a chart: the page must not scroll
  useEffect(() => { scroller.current?.scrollTo({ y: 0, animated: false }); }, [scrollKey]);
  return (
    <View style={{ flex: 1 }}>
      {/* soft accent glow behind the header: gives every page the same premium depth */}
      {L.mode !== 'desktop' && <LinearGradient pointerEvents="none" colors={[th.accent + (th.dark ? '2E' : '1C'), th.accent2 + (th.dark ? '0E' : '08'), th.bg + '00']} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 280 }} />}
      <ScrollLockContext.Provider value={setLock}>
      <ScrollView ref={scroller} scrollEnabled={!lock} style={{ flex: 1 }} contentContainerStyle={L.mode === 'desktop' ? { flexGrow: 1 } : { padding: 16, paddingTop: Math.max(insets.top, 24) + 4, paddingBottom: 36 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* website: the page body is centred and limited in width; the shared footer below it spans the full width (same as every other page) */}
        <View style={L.mode === 'desktop' ? { flexGrow: 1, padding: 16, paddingTop: Math.max(insets.top, 24) + 4, paddingBottom: 36, width: '100%', maxWidth: L.content, alignSelf: 'center' } : undefined}>
          {!bare && <View style={{ gap: 14, marginBottom: 16 }}>
            <AppHeader />
            <PageHero title={title} subtitle={subtitle} icon={icon} right={right} tag={tag} />
          </View>}
          {children}
        </View>
        {L.mode === 'desktop' && <PageFooter />}
      </ScrollView>
      </ScrollLockContext.Provider>
    </View>
  );
};

export const Card = ({ children, style, glow }: { children: React.ReactNode; style?: ViewStyle; glow?: boolean }) => {
  const { th } = useApp();
  const desk = useLayout().mode === 'desktop';
  return (
    <View style={[{ backgroundColor: th.panel, borderColor: glow ? th.accent + '66' : th.line, borderWidth: 1, borderRadius: desk ? 14 : 8, padding: 16, shadowColor: glow ? th.accent : '#000', shadowOpacity: th.glass ? (th.dark ? 0.18 : 0.08) : glow ? (th.dark ? 0.3 : 0.14) : th.dark ? 0.22 : 0.05, shadowRadius: glow ? 16 : 10, shadowOffset: { width: 0, height: glow ? 6 : 4 }, elevation: th.glass ? 0 : glow ? 4 : 1 }, style]}>
      <LinearGradient pointerEvents="none" colors={th.glass ? ['transparent', th.dark ? '#FFFFFF66' : '#FFFFFFE6', 'transparent'] : ['transparent', th.accent + (th.dark ? '66' : '40'), 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', top: 0, left: 18, right: 18, height: 1 }} />
      {children}
    </View>
  );
};

// Rounded gradient icon tile (home tools, headers, empty states).
export const IconTile = ({ icon, size = 44, colors }: { icon: string; size?: number; colors?: [string, string] }) => {
  const { th } = useApp();
  const desk = useLayout().mode === 'desktop';
  return (
    <LinearGradient colors={colors ?? [th.accent, th.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: desk ? 12 : 8, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={size * 0.5} color={th.onAccent} />
    </LinearGradient>
  );
};

// Section heading with an optional "See all" link.
export const SectionHeader = ({ title, icon, action, onAction }: { title: string; icon?: string; action?: string; onAction?: () => void }) => {
  const { th } = useApp();
  const desk = useLayout().mode === 'desktop';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
        {desk && !!icon ? <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: th.accent + '22', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={16} color={th.accent} /></View> : <>
        <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: th.accent }} />
        {!!icon && <Icon name={icon} size={16} color={th.accent} />}</>}
        <Text accessibilityRole="header" style={{ color: th.text, fontSize: 17, fontWeight: desk ? '900' : '800', letterSpacing: -0.2 }}>{title}</Text>
      </View>
      {!!action && <Pressable onPress={onAction} hitSlop={10}><Text style={{ color: th.accent, fontWeight: '800', fontSize: 12.5 }}>{action} ›</Text></Pressable>}
    </View>
  );
};

// Filter chip (categories, quote assets, news tabs).
export const Chip = ({ label, on, onPress, icon, count }: { label: string; on: boolean; onPress: () => void; icon?: string; count?: number }) => {
  const { th } = useApp();
  const desk = useLayout().mode === 'desktop';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 38, borderRadius: desk ? 10 : 8, backgroundColor: on ? th.accent : th.panel, borderWidth: 1, borderColor: on ? th.accent : th.line, opacity: pressed ? 0.85 : 1 })}>
      {!!icon && <Icon name={icon} size={14} color={on ? th.onAccent : th.gold} />}
      <Text style={{ color: on ? th.onAccent : th.text, fontWeight: '800', fontSize: 13 }}>{label}</Text>
      {count !== undefined && <Text style={{ color: on ? th.onAccent + 'CC' : th.dim, fontWeight: '700', fontSize: 11 }}>{count}</Text>}
    </Pressable>
  );
};

export const SectionTitle = ({ icon, children }: { icon?: string; children: React.ReactNode }) => {
  const { th } = useApp();
  const desk = useLayout().mode === 'desktop';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
      {!!icon && <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: th.accent + '22', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={15} color={th.accent} /></View>}
      <Text style={{ color: th.text, fontSize: desk ? 16 : 15, fontWeight: desk ? '900' : '800', letterSpacing: desk ? 0 : 0.2, flexShrink: 1 }}>{children}</Text>
    </View>
  );
};

export const Badge = ({ label, color }: { label: string; color?: string }) => {
  const { th } = useApp();
  const c = color ?? th.accent;
  return <View style={{ backgroundColor: c + '24', borderColor: c + '66', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}><Text style={{ color: c, fontSize: 11, fontWeight: '900', letterSpacing: 0.6 }}>{label}</Text></View>;
};

export const StatTile = ({ label, value, color, icon }: { label: string; value: string; color?: string; icon?: string }) => {
  const { th } = useApp();
  return (
    <Card style={{ flex: 1, padding: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        {!!icon && <Icon name={icon} size={13} color={th.dim} />}
        <Text style={{ color: th.dim, fontSize: 11, fontWeight: '600', letterSpacing: 0.3 }} numberOfLines={1}>{label.toUpperCase()}</Text>
      </View>
      <Text style={{ color: color ?? th.text, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </Card>
  );
};

export const Dim = ({ children }: { children: React.ReactNode }) => {
  const { th } = useApp();
  return <Text style={{ color: th.dim, fontSize: 13, marginBottom: 4 }}>{children}</Text>;
};

export const Body = ({ children, color, bold, style }: { children: React.ReactNode; color?: string; bold?: boolean; style?: TextStyle }) => {
  const { th } = useApp();
  return <Text style={[{ color: color ?? th.text, fontSize: 14, lineHeight: 21, fontWeight: bold ? '600' : '400' }, style]}>{children}</Text>;
};

// Shared button. Labels never wrap (they shrink a little instead), so "Break-even" and "Close all" stay on one line on small phones.
// tone: 'danger' = solid red (closing money), 'warn' = amber outline (protective moves), 'good' = solid green. `danger` (old prop) = red outline.
export const Btn = ({ label, onPress, ghost, busy, disabled, icon, danger, tone }: { label: string; onPress: () => void; ghost?: boolean; busy?: boolean; disabled?: boolean; icon?: string; danger?: boolean; tone?: 'danger' | 'warn' | 'good' }) => {
  const { th } = useApp();
  const solid = tone === 'danger' || tone === 'good', warn = tone === 'warn';
  const base = tone === 'danger' ? th.sell : tone === 'good' ? th.buy : warn ? th.gold : th.accent;
  const fg = solid ? '#FFFFFF' : warn ? th.gold : danger ? th.sell : ghost ? th.text : th.onAccent;
  const ic = solid ? '#FFFFFF' : warn ? th.gold : danger ? th.sell : ghost ? th.accent : th.onAccent;
  const flat = ghost || warn;
  const inner = busy ? <ActivityIndicator color={flat ? th.accent : th.onAccent} /> : (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, maxWidth: '100%' }}>
      {!!icon && <Icon name={icon} size={18} color={ic} />}
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ color: fg, fontWeight: '900', fontSize: 15, letterSpacing: 0.2, flexShrink: 1 }}>{label}</Text>
    </View>
  );
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!(busy || disabled), busy: !!busy }} onPress={onPress} disabled={busy || disabled} style={({ pressed }) => ({ borderRadius: 10, overflow: flat ? 'hidden' : 'visible', opacity: busy || disabled ? 0.5 : pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.985 : 1 }], borderWidth: flat ? 1 : 0, borderColor: warn ? th.gold + '88' : danger ? th.sell + '66' : th.line, shadowColor: base, shadowOpacity: flat || disabled ? 0 : th.dark ? 0.4 : 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: flat || disabled ? 0 : 5 })}>
      {flat ? <View style={{ minHeight: 50, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: warn ? th.gold + '16' : th.panel2 }}>{inner}</View> : (
        <LinearGradient colors={solid ? [base, base + 'CC'] : [th.accent, th.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ minHeight: 52, borderRadius: 10, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '48%', backgroundColor: '#FFFFFF', opacity: 0.12 }} />
          {inner}
        </LinearGradient>
      )}
    </Pressable>
  );
};

// Compact action button for trade cards: icon over a one-line label, equal height. Used for Manage / Break-even / Close all.
// tone: 'neutral' (outline), 'warn' (amber, protective), 'danger' (solid red, closes the trade), 'done' (green, already applied)
export const ActionBtn = ({ label, icon, onPress, tone = 'neutral', disabled, flex = 1 }: { label: string; icon: string; onPress: () => void; tone?: 'neutral' | 'warn' | 'danger' | 'done'; disabled?: boolean; flex?: number }) => {
  const { th } = useApp();
  const c = tone === 'danger' ? th.sell : tone === 'warn' ? th.gold : tone === 'done' ? th.buy : th.accent;
  const solid = tone === 'danger';
  const inner = (
    <View style={{ height: 56, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 6 }}>
      <Icon name={icon} size={19} color={solid ? '#FFFFFF' : c} />
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: solid ? '#FFFFFF' : tone === 'neutral' ? th.text : c, fontWeight: '900', fontSize: 12.5, letterSpacing: 0.2, maxWidth: '100%' }}>{label}</Text>
    </View>
  );
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} onPress={onPress} disabled={disabled}
      style={({ pressed }) => ({ flex, borderRadius: 12, overflow: 'hidden', opacity: disabled && tone !== 'done' ? 0.45 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }], borderWidth: solid ? 0 : 1, borderColor: tone === 'neutral' ? th.line : c + '77', shadowColor: c, shadowOpacity: solid && !disabled ? 0.4 : 0, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: solid && !disabled ? 5 : 0 })}>
      {solid ? (
        <LinearGradient colors={[c, c + 'D0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '45%', backgroundColor: '#FFFFFF', opacity: 0.12 }} />
          {inner}
        </LinearGradient>
      ) : <View style={{ backgroundColor: tone === 'neutral' ? th.panel2 : c + '16' }}>{inner}</View>}
    </Pressable>
  );
};

export const Field = ({ label, right, onFocus, onBlur, ...p }: { label: string; right?: React.ReactNode } & TextInputProps) => {
  const { th } = useApp();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ marginBottom: 12 }}>
      <Dim>{label}</Dim>
      <View>
        <TextInput {...p} accessibilityLabel={label} placeholderTextColor={th.dim + 'AA'} selectionColor={th.accent}
          onFocus={(e) => { setFocus(true); onFocus?.(e); }} onBlur={(e) => { setFocus(false); onBlur?.(e); }}
          style={{ backgroundColor: th.dark ? th.bg : th.panel2, borderColor: focus ? th.accent : th.line, borderWidth: focus ? 1.5 : 1, borderRadius: 8, color: th.text, paddingHorizontal: focus ? 13.5 : 14, paddingVertical: focus ? 13.5 : 14, fontSize: 15, paddingEnd: right ? 46 : 14 }} />
        {right && <View style={{ position: 'absolute', end: 12, top: 0, bottom: 0, justifyContent: 'center' }}>{right}</View>}
      </View>
    </View>
  );
};

export const Segment = ({ value, options, onChange }: { value: string; options: { k: string; label: string }[]; onChange: (k: string) => void }) => {
  const { th } = useApp();
  const [w, setW] = useState(0);
  const i = Math.max(0, options.findIndex((o) => o.k === value));
  const x = useRef(new Animated.Value(i)).current;
  useEffect(() => { Animated.spring(x, { toValue: i, damping: 18, stiffness: 230, useNativeDriver: true }).start(); }, [i]);
  const cw = options.length ? (w - 8 - (options.length - 1) * 4) / options.length : 0;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', borderWidth: 1, borderColor: th.line, borderRadius: 8, padding: 4, backgroundColor: th.bg, gap: 4, direction: 'ltr' }}>
      {w > 0 && options.length > 1 && (
        <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 4, bottom: 4, left: 4, width: cw, borderRadius: 9, backgroundColor: th.accent, shadowColor: th.accent, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3, transform: [{ translateX: x.interpolate({ inputRange: options.map((_, k) => k), outputRange: options.map((_, k) => k * (cw + 4)) }) }] }} />
      )}
      {options.map((o) => {
        const on = value === o.k;
        return (
          <Pressable key={o.k} onPress={() => onChange(o.k)} style={{ flex: 1, minHeight: 44, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: options.length < 2 && on ? th.accent : 'transparent' }}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: on ? th.onAccent : th.dim, fontWeight: '800', fontSize: 14, textAlign: 'center' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

export const Row = ({ k, v, color }: { k: string; v?: string; color?: string }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, paddingVertical: 3 }}>
    <View style={{ flex: 1, minWidth: 0 }}><Body>{k}</Body></View>
    <View style={{ flexShrink: 1, maxWidth: '62%' }}><Body color={color} bold style={{ textAlign: 'right' }}>{v || '-'}</Body></View>
  </View>
);

// Option strip. When the options are timeframes (60, 300, 900 ...) it becomes the premium timeframe bar:
// quick row of pinned timeframes + a grouped picker sheet. Any other list (markets, impact, currencies) keeps the simple chip strip.
export const TimeframeBar = ({ value, options, onChange }: { value: string; options: { k: string; label: string }[]; onChange: (k: string) => void }) => {
  const { th } = useApp();
  if (isTfList(options)) return <TfBar value={value} options={options} onChange={onChange} />;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 6, paddingVertical: 2 }} style={{ direction: 'ltr' }}>
      {options.map((o) => {
        const on = value === o.k;
        return (
          <Pressable key={o.k} onPress={() => onChange(o.k)} style={{ minWidth: 52, height: 38, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: on ? th.accent : th.line, backgroundColor: on ? th.accent : th.panel }}>
            <Text style={{ color: on ? th.onAccent : th.text, fontWeight: on ? '900' : '600', fontSize: 13, letterSpacing: 0.3 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

// Small caps label that groups cards on long pages (Settings).
export const Group = ({ title, children, gap = 12 }: { title: string; children: React.ReactNode; gap?: number }) => {
  const { th } = useApp();
  return (
    <View style={{ gap }}>
      <Text accessibilityRole="header" style={{ color: th.dim, fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginTop: 10, marginStart: 4 }}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
};

export const Divider = ({ inset = 0 }: { inset?: number }) => {
  const { th } = useApp();
  return <View style={{ height: 1, backgroundColor: th.hair, marginVertical: 10, marginHorizontal: inset }} />;
};

// Friendly empty page: icon, a short title, one line of help and an optional action.
export const EmptyState = ({ icon, title, body, action, onAction }: { icon: string; title: string; body?: string; action?: string; onAction?: () => void }) => {
  const { th } = useApp();
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 30, gap: 10 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: th.accent + '14', borderWidth: 1, borderColor: th.accent + '33', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={28} color={th.accent} />
      </View>
      <Text style={{ color: th.text, fontSize: 17, fontWeight: '800', textAlign: 'center' }}>{title}</Text>
      {!!body && <Text style={{ color: th.dim, fontSize: 13.5, lineHeight: 20, textAlign: 'center', maxWidth: 300 }}>{body}</Text>}
      {!!action && !!onAction && <View style={{ alignSelf: 'stretch', marginTop: 6 }}><Btn label={action} onPress={onAction} /></View>}
    </Card>
  );
};

// Cards in two balanced columns on a wide website page; a plain stack on the phone and on narrow pages.
// The first pass puts cards left / right in turn, measures them, then fills the shorter column first. After that the placement is kept,
// so a card never jumps while you use it. Inside a column every part sizes itself to the column's width (WidthCtx).
export const Cols = ({ children, gap = 16 }: { children: React.ReactNode; gap?: number }) => {
  const L = useLayout();
  const { width } = useWindowDimensions();
  const kids = React.Children.toArray(children).filter(Boolean);
  const [h, setH] = useState<Record<number, number>>({});
  const plan = useRef<number[] | null>(null);
  if (L.mode !== 'desktop' || width < 760) return <View style={{ gap }}>{kids}</View>;
  if (plan.current && plan.current.length !== kids.length) plan.current = null;
  if (!plan.current && kids.every((_, i) => h[i] !== undefined)) {
    const sums = [0, 0]; plan.current = kids.map((_, i) => { const j = sums[0] <= sums[1] ? 0 : 1; sums[j] += h[i] + gap; return j; });
  }
  const colW = (width - 32 - gap) / 2, cols: React.ReactNode[][] = [[], []];
  kids.forEach((k, i) => cols[plan.current ? plan.current[i] : i % 2].push(
    <View key={(k as any).key ?? i} onLayout={(e) => { const y = Math.round(e.nativeEvent.layout.height); setH((p) => (p[i] === y ? p : { ...p, [i]: y })); }}>{k}</View>));
  return (
    <WidthCtx.Provider value={colW + 32}>
      <View style={{ flexDirection: 'row', gap, alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap, minWidth: 0 }}>{cols[0]}</View>
        <View style={{ flex: 1, gap, minWidth: 0 }}>{cols[1]}</View>
      </View>
    </WidthCtx.Provider>
  );
};
