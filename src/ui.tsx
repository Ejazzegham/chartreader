import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View, Pressable, ActivityIndicator, TextInput, TextInputProps, ViewStyle, TextStyle, Animated } from 'react-native';
import { showAlert } from './dialog';
import { useWindowDimensions, useLayout, WidthCtx } from './win';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from './FlatGradient';
import Svg, { Path, Line } from 'react-native-svg';
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
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 4 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c }} />
      <Text style={{ color: th.dim, fontSize: 11.5, fontWeight: '600', letterSpacing: 0.3 }}>{st === 'live' ? 'Live' : st === 'offline' ? 'Offline' : 'Syncing'}</Text>
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

// ONE hero for every page of the website: the same width (the page width), the same height, the same flat deep-navy surface with a brass hairline.
// No gradients, glows, circles or watermark icons. Title + one line of text on the left, an optional action on the right, an optional quiet row of key points at the foot.
export const HERO_H = 232;
export const HERO_BG = '#0F1E3D', HERO_BRASS = '#C8A96A';
export type HeroFeature = { icon: string; title: string; sub: string; onPress?: () => void };
export const HeroBanner = ({ title, subtitle, icon, features, right, tag }: { title: string; subtitle?: string; icon?: string; features?: HeroFeature[]; right?: React.ReactNode; tag?: string }) => {
  const { rtl } = useApp();
  const { width } = useWindowDimensions();
  const wide = width >= 640;
  const feats = !!features?.length && (
    <View style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? 0 : 8, borderTopWidth: 1, borderTopColor: '#FFFFFF1F', paddingTop: wide ? 14 : 12 }}>
      {features!.map((f, i) => (
        <Pressable key={f.title} disabled={!f.onPress} onPress={f.onPress} style={{ flex: wide ? 1 : undefined, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: wide && i > 0 ? 18 : 0, marginLeft: wide && i > 0 ? 18 : 0, borderLeftWidth: wide && i > 0 ? 1 : 0, borderLeftColor: '#FFFFFF1F', cursor: f.onPress ? 'pointer' : 'default' } as any}>
          <Icon name={f.icon} size={17} color={HERO_BRASS} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 13 }} numberOfLines={1}>{f.title}</Text>
            {!!f.sub && <Text style={{ color: '#A9B6D0', fontSize: 11.5 }} numberOfLines={1}>{f.sub}</Text>}
          </View>
        </Pressable>
      ))}
    </View>
  );
  return (
    <View style={{ borderRadius: 14, overflow: 'hidden', direction: 'ltr', backgroundColor: HERO_BG, borderWidth: 1, borderColor: '#1C2E56', ...(wide ? { height: HERO_H } : null) }}>
      <View style={{ padding: wide ? 32 : 20, paddingVertical: wide ? 26 : 20, gap: 14, ...(wide ? { height: HERO_H, justifyContent: 'center' } : null) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 24, direction: rtl ? 'rtl' : 'ltr' }}>
          <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 26, height: 2, backgroundColor: HERO_BRASS }} />
              <Text style={{ color: HERO_BRASS, fontSize: 11, fontWeight: '700', letterSpacing: 1.8 }} numberOfLines={1}>{(tag || 'Chart Reader').toUpperCase()}</Text>
            </View>
            <Text accessibilityRole="header" style={{ color: '#FFFFFF', fontSize: wide ? 32 : 24, fontWeight: '700', letterSpacing: -0.5 }} numberOfLines={1}>{title}</Text>
            {!!subtitle && <Text style={{ color: '#B4C0D8', fontSize: 14.5, lineHeight: 22, maxWidth: 780 }} numberOfLines={2}>{subtitle}</Text>}
            {!!right && !wide && <View style={{ flexDirection: 'row', alignSelf: 'flex-start', marginTop: 4 }}>{right}</View>}
          </View>
          {!!right && wide && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>{right}</View>}
        </View>
        {feats}
      </View>
    </View>
  );
};

// Phone and tablet: a quiet header card (the website uses the HeroBanner above).
export const PageHero = ({ title, subtitle, icon, right, tag }: { title: string; subtitle?: string; icon?: string; right?: React.ReactNode; tag?: string }) => {
  const { th, rtl } = useApp();
  const desk = useLayout().mode === 'desktop';
  if (desk) return <HeroBanner title={title} subtitle={subtitle} icon={icon} right={right} tag={tag} />;
  return (
    <View style={{ borderRadius: 8, borderWidth: 1, borderColor: th.line, backgroundColor: th.panel, padding: 16, gap: 10, direction: rtl ? 'rtl' : 'ltr' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {!!icon && <IconTile icon={icon} size={44} />}
        <View style={{ flex: 1 }}>
          {!!tag && <Text style={{ color: th.accent2, fontSize: 10, fontWeight: '700', letterSpacing: 1.4, marginBottom: 2 }}>{tag.toUpperCase()}</Text>}
          <Text accessibilityRole="header" style={{ color: th.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.3 }} numberOfLines={2}>{title}</Text>
        </View>
      </View>
      {!!subtitle && <Text style={{ color: th.dim, fontSize: 12.5, lineHeight: 18 }} numberOfLines={3}>{subtitle}</Text>}
      {!!right && <View style={{ flexDirection: 'row', alignSelf: 'flex-start' }}>{right}</View>}
    </View>
  );
};

// bare: the page draws its own header (the Analysis page does). scrollKey: when it changes the page jumps back to the top.
// Every other page gets the same header row and hero banner as the Analysis page.
export const Screen = ({ title = '', subtitle, right, children, bare, scrollKey, icon, tag }: { title?: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode; bare?: boolean; scrollKey?: string; icon?: string; tag?: string }) => {
  const L = useLayout();
  const insets = useSafeAreaInsets();
  const scroller = useRef<ScrollView>(null);
  const [lock, setLock] = useState(false); // a finger is on a chart: the page must not scroll
  useEffect(() => { scroller.current?.scrollTo({ y: 0, animated: false }); }, [scrollKey]);
  return (
    <View style={{ flex: 1 }}>
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
    <View style={[{ backgroundColor: th.panel, borderColor: glow ? th.accent + '66' : th.line, borderWidth: 1, borderRadius: desk ? 12 : 8, padding: 16, shadowColor: glow ? th.accent : '#000', shadowOpacity: th.dark ? 0.16 : 0.035, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 0 }, style]}>
      {children}
    </View>
  );
};

// Quiet icon tile: a soft tint of the brand colour with a hairline border. Every page uses the same one, so the icons never turn into a rainbow.
export const IconTile = ({ icon, size = 44 }: { icon: string; size?: number; colors?: [string, string] }) => {
  const { th } = useApp();
  const desk = useLayout().mode === 'desktop';
  return (
    <View style={{ width: size, height: size, borderRadius: desk ? 10 : 8, alignItems: 'center', justifyContent: 'center', backgroundColor: th.accent + (th.dark ? '2A' : '12'), borderWidth: 1, borderColor: th.accent + (th.dark ? '44' : '24') }}>
      <Icon name={icon} size={size * 0.48} color={th.dark ? th.text : th.accent} />
    </View>
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
