import React, { useState } from 'react';
import { View, Text, Linking, Pressable, TextInput, ScrollView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Ellipse, Path, Line, Rect, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg';
import { useApp } from '../store';
import { Icon, Card, AppHeader, HeroBanner } from '../ui';
import { LogoMark, PoweredBy } from '../Brand';
import { useLayout, useWindowDimensions } from '../win';
import { PageFooter } from '../SiteFooter';
import { CONTENT, CONTACT_EMAIL } from '../guideContent';
import { ABOUT_EN } from '../aboutContent';

const NAVY = '#071B3F';
const SCRIPT = Platform.OS === 'web' ? "'Segoe Script','Brush Script MT','Snell Roundhand','Lucida Handwriting',cursive" : undefined;
const hand = { cursor: 'pointer' } as any;

// Small label with a short line after it ("ABOUT US ——")
const Eyebrow = ({ children, center }: { children: string; center?: boolean }) => {
  const { th } = useApp();
  const line = <View style={{ width: 34, height: 1.5, backgroundColor: th.accent + '88' }} />;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: center ? 'center' : 'flex-start' }}>
      {center && line}
      <Text style={{ color: th.accent, fontSize: 11.5, fontWeight: '800', letterSpacing: 2 }}>{children.toUpperCase()}</Text>
      {line}
    </View>
  );
};

// Hero picture: a laptop with a live chart and a globe (drawn in SVG, so it is sharp on every screen and follows the theme colours)
const HeroArt = ({ buy, sell, accent }: { buy: string; sell: string; accent: string }) => {
  const cs: [number, number, number, number, boolean][] = [[150, 128, 150, 136, true], [162, 120, 146, 124, false], [174, 124, 150, 130, true], [186, 112, 140, 118, false], [198, 104, 136, 110, false], [210, 108, 138, 114, true], [222, 94, 128, 100, false], [234, 86, 122, 92, false], [246, 90, 120, 96, true], [258, 74, 112, 80, false], [270, 64, 102, 70, false], [282, 58, 98, 64, false]];
  return (
    <Svg width="100%" height="100%" viewBox="0 0 380 240" preserveAspectRatio="xMidYMid meet">
      <Defs>
        <SvgGrad id="gl" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#CFE6FF" /><Stop offset="1" stopColor={accent} stopOpacity="0.85" /></SvgGrad>
        <SvgGrad id="sc" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#0E2A5E" /><Stop offset="1" stopColor="#061633" /></SvgGrad>
      </Defs>
      <Circle cx="92" cy="140" r="70" fill="url(#gl)" opacity="0.9" />
      <Ellipse cx="92" cy="140" rx="70" ry="26" stroke="#FFFFFF" strokeOpacity="0.6" strokeWidth="1.2" fill="none" />
      <Ellipse cx="92" cy="140" rx="30" ry="70" stroke="#FFFFFF" strokeOpacity="0.6" strokeWidth="1.2" fill="none" />
      <Line x1="92" y1="70" x2="92" y2="210" stroke="#FFFFFF" strokeOpacity="0.6" strokeWidth="1.2" />
      <Path d="M60 112 q14 -10 30 -2 q8 10 -6 18 q-14 4 -24 -4 z M104 150 q16 -6 26 6 q-4 16 -20 14 q-10 -8 -6 -20 z" fill="#FFFFFF" opacity="0.5" />
      <Rect x="128" y="42" width="214" height="136" rx="9" fill="#12203F" />
      <Rect x="134" y="48" width="202" height="124" rx="5" fill="url(#sc)" />
      <Path d="M142 160 C 170 158, 190 138, 214 122 S 280 80, 330 56" stroke={accent} strokeOpacity="0.7" strokeWidth="1.5" fill="none" />
      {cs.map(([x, t, b, bt, up], i) => (
        <React.Fragment key={i}>
          <Line x1={x} y1={t - 4} x2={x} y2={b + 14} stroke={up ? buy : sell} strokeWidth="1.2" />
          <Rect x={x - 3} y={bt - 6} width="6" height={Math.max(8, b - bt + 12)} rx="1" fill={up ? buy : sell} />
        </React.Fragment>
      ))}
      {[0, 1, 2, 3].map((i) => <Rect key={i} x={298} y={58 + i * 16} width={30} height={5} rx={2.5} fill="#FFFFFF" opacity={0.18} />)}
      <Path d="M112 178 H358 L346 192 H124 Z" fill="#C9D6EC" />
      <Rect x="206" y="178" width="54" height="4" rx="2" fill="#9FB1D1" />
      <Path d="M300 70 L356 20" stroke="#BFE0FF" strokeWidth="9" strokeLinecap="round" opacity="0.9" />
      <Path d="M334 18 H360 V44" stroke="#BFE0FF" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.9" />
    </Svg>
  );
};

export default function About() {
  const { th, t, settings, rtl, setTab } = useApp();
  const L = useLayout();
  const { width } = useWindowDimensions();
  const desk = L.mode === 'desktop';
  const wide = width >= 760, mid = width >= 520;
  const c = (CONTENT[settings.lang] ?? CONTENT.en).about;
  const x = ABOUT_EN;
  const [mailIn, setMailIn] = useState('');
  const mail = (subject = 'Chart Reader', body = '') => Linking.openURL(`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}${body ? `&body=${encodeURIComponent(body)}` : ''}`).catch(() => {});
  const subscribe = () => mail('Subscribe to Chart Reader updates', mailIn.trim() ? `Please add this email to the updates list: ${mailIn.trim()}` : '');

  const h1 = wide ? 46 : 34, h2 = wide ? 34 : 27;
  const circle = (icon: string, size = 46, bg?: string, col?: string) => (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg ?? th.accent + '1F', alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={size * 0.46} color={col ?? th.accent} />
    </View>
  );

  // ---------- 1. hero ----------
  const hero = (
    <HeroBanner icon="information-circle" title={`${x.title1} ${x.title2}`.replace(/\s+/g, ' ').trim()} subtitle={x.lead}
      features={x.chips.slice(0, 4).map((ch) => ({ icon: ch.icon, title: ch.label, sub: '' }))} />
  );

  // ---------- 2. about + mission / vision ----------
  const mv = (icon: string, title: string, text: string) => (
    <View style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
      {circle(icon, 56)}
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={{ color: th.text, fontSize: 17, fontWeight: '900' }}>{title}</Text>
        <Text style={{ color: th.dim, fontSize: 14, lineHeight: 22 }}>{text}</Text>
      </View>
    </View>
  );
  const who = (
    <View style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? 40 : 22, alignItems: wide ? 'center' : 'stretch', paddingVertical: wide ? 18 : 4 }}>
      <View style={{ flex: 1, gap: 14, minWidth: 0 }}>
        <Eyebrow>{x.whoTag}</Eyebrow>
        <Text accessibilityRole="header" style={{ color: th.text, fontSize: h2, fontWeight: '900', letterSpacing: -0.8 }}>{x.whoTitle}</Text>
        <Text style={{ color: th.dim, fontSize: 15, lineHeight: 24 }}>{x.who1}</Text>
        <Text style={{ color: th.dim, fontSize: 15, lineHeight: 24 }}>{x.who2}</Text>
        <Text style={{ color: th.accent, fontSize: 21, marginTop: 6, fontStyle: 'italic', fontFamily: SCRIPT }}>{x.sign}</Text>
      </View>
      <Card style={{ flex: 1, minWidth: 0, padding: wide ? 28 : 20, gap: 22 }}>
        {mv('locate', x.missionTitle, x.mission)}
        <View style={{ height: 1, backgroundColor: th.hair }} />
        {mv('diamond', x.visionTitle, x.vision)}
      </Card>
    </View>
  );

  // ---------- 3. why choose us ----------
  const per = wide ? 3 : mid ? 2 : 1;
  const why = (
    <View style={{ gap: 14, alignItems: 'stretch', paddingVertical: wide ? 18 : 4 }}>
      <Eyebrow center>{x.whyTag}</Eyebrow>
      <Text accessibilityRole="header" style={{ color: th.text, fontSize: h2, fontWeight: '900', letterSpacing: -0.8, textAlign: 'center' }}>{x.whyTitle}</Text>
      <Text style={{ color: th.dim, fontSize: 15, lineHeight: 22, textAlign: 'center', alignSelf: 'center', maxWidth: 560 }}>{x.whySub}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 14 }}>
        {x.cards.map((cd, i) => (
          <View key={i} style={{ width: per === 1 ? '100%' : per === 2 ? '48.6%' : '31.9%', flexGrow: 1 } as any}>
            <Card style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start', padding: 20, minHeight: 112 }}>
              <LinearGradient colors={cd.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={cd.icon} size={25} color="#FFFFFF" />
              </LinearGradient>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ color: th.text, fontSize: 16, fontWeight: '900' }}>{cd.title}</Text>
                <Text style={{ color: th.dim, fontSize: 13.5, lineHeight: 20 }}>{cd.text}</Text>
              </View>
            </Card>
          </View>
        ))}
      </View>
    </View>
  );

  // ---------- 4. contact ----------
  const contact = (
    <View style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? 40 : 18, alignItems: wide ? 'center' : 'stretch', paddingVertical: wide ? 18 : 4 }}>
      <View style={{ flex: 1, gap: 12, minWidth: 0 }}>
        <Eyebrow>{x.contactTag}</Eyebrow>
        <Text accessibilityRole="header" style={{ color: th.text, fontSize: h2, fontWeight: '900', letterSpacing: -0.8 }}>{c.contactTitle}</Text>
        <Text style={{ color: th.dim, fontSize: 15, lineHeight: 23, maxWidth: 380 }}>{c.contactText}</Text>
        <Pressable accessibilityRole="button" onPress={() => mail()} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 9, alignSelf: 'flex-start', height: 46, paddingHorizontal: 22, borderRadius: 23, backgroundColor: th.accent, opacity: pressed ? 0.85 : 1, marginTop: 6 }, hand]}>
          <Icon name="mail-outline" size={18} color={th.onAccent} />
          <Text style={{ color: th.onAccent, fontWeight: '800', fontSize: 14.5 }}>{c.emailBtn}</Text>
        </Pressable>
      </View>
      <Card style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 18, padding: 24 }}>
        {circle('mail', 72)}
        <View style={{ flex: 1, gap: 6, minWidth: 0 }}>
          <Text style={{ color: th.text, fontSize: 16, fontWeight: '900' }}>{x.contactCardTitle}</Text>
          <Text style={{ color: th.dim, fontSize: 13.5, lineHeight: 20 }}>{c.contactText}</Text>
          <Text selectable onPress={() => mail()} style={[{ color: th.accent, fontWeight: '800', fontSize: 16, marginTop: 2 }, hand]}>{CONTACT_EMAIL}</Text>
        </View>
      </Card>
    </View>
  );

  // ---------- 5. please note ----------
  const note = (
    <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center', padding: 20, borderRadius: 14, borderWidth: 1, borderColor: th.gold + '66', backgroundColor: th.gold + (th.dark ? '18' : '14') }}>
      {circle('alert', 48, th.gold + '33', th.gold)}
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: th.text, fontSize: 16, fontWeight: '900' }}>{c.discTitle}</Text>
        <Text style={{ color: th.dim, fontSize: 13.5, lineHeight: 21 }}>{c.disc}</Text>
      </View>
    </View>
  );

  // ---------- 6. footer ----------
  const fl = (label: string, onPress: () => void) => (
    <Pressable key={label} onPress={onPress} accessibilityRole="link" style={hand}><Text style={{ color: '#C9D6F2', fontSize: 12.5, lineHeight: 26 }}>{label}</Text></Pressable>
  );
  const col = (title: string, links: [string, () => void][]) => (
    <View style={{ minWidth: wide ? 130 : 150, gap: 4 }}>
      <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13.5, marginBottom: 6 }}>{title}</Text>
      {links.map(([l, f]) => fl(l, f))}
    </View>
  );
  const footer = (
    <View style={{ borderRadius: 18, overflow: 'hidden', backgroundColor: NAVY, padding: wide ? 32 : 22, gap: 26 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 28, justifyContent: 'space-between' }}>
        <View style={{ gap: 12, width: wide ? 240 : '100%', maxWidth: 280 } as any}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <LogoMark size={40} radius={10} />
            <View>
              <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '900', letterSpacing: -0.3 }}>Chart Reader</Text>
              <Text style={{ color: '#9FB3DB', fontSize: 9, fontWeight: '700', letterSpacing: 1.2 }}>{x.tagline.toUpperCase()}</Text>
            </View>
          </View>
          <Text style={{ color: '#B8C7E6', fontSize: 12.5, lineHeight: 19 }}>{x.footBlurb}</Text>
        </View>
        {col(x.colQuick, [[t('tabHome'), () => setTab(0)], [t('tabAnalyze'), () => setTab(1)], [t('tabMarkets'), () => setTab(2)], [t('tabJournal'), () => setTab(3)], [t('tabTools'), () => setTab(4)]])}
        {col(x.colMarkets, ['Forex', 'Crypto', 'Metals', 'Deriv', 'Indices'].map((m) => [m, () => setTab(2)] as [string, () => void]))}
        {col(x.colSupport, [[x.helpCenter, () => setTab(14)], [c.contactTitle, () => mail()], [t('tabSettings'), () => setTab(6)]])}
        <View style={{ gap: 8, width: wide ? 230 : '100%', maxWidth: 300 } as any}>
          <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13.5 }}>{x.colStay}</Text>
          <Text style={{ color: '#B8C7E6', fontSize: 12, lineHeight: 17 }}>{x.stayText}</Text>
          <View style={{ flexDirection: 'row', height: 38, borderRadius: 8, overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
            <TextInput value={mailIn} onChangeText={setMailIn} placeholder={x.emailPh} placeholderTextColor="#7C89A6" autoCapitalize="none" keyboardType="email-address" onSubmitEditing={subscribe}
              style={[{ flex: 1, minWidth: 0, paddingHorizontal: 12, fontSize: 12.5, color: '#0B1B3F' }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null]} />
            <Pressable onPress={subscribe} accessibilityRole="button" style={[{ paddingHorizontal: 16, backgroundColor: th.accent, justifyContent: 'center' }, hand]}>
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 12.5 }}>{x.subscribe}</Text>
            </Pressable>
          </View>
        </View>
      </View>
      <View style={{ height: 1, backgroundColor: '#FFFFFF1F' }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 }}>
        <Text style={{ color: '#9FB3DB', fontSize: 11.5 }}>© {new Date().getFullYear()} {x.foot}</Text>
        <Text style={{ color: '#9FB3DB', fontSize: 11.5 }}>{x.slogan.join('   •   ')}</Text>
      </View>
    </View>
  );

  // website: the page body is centred and limited in width, then the shared site footer (same as every other page) spans the full width.
  // phone: this page keeps its own footer card.
  const body = (
    <>
      {!desk && <AppHeader />}
      {hero}
      {who}
      {why}
      {contact}
      {note}
      {!desk && footer}
      {!desk && <PoweredBy compact />}
    </>
  );
  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}
        contentContainerStyle={(desk ? { flexGrow: 1 } : { padding: 16, paddingTop: 28, paddingBottom: 36, gap: wide ? 34 : 24, direction: rtl ? 'rtl' : 'ltr' }) as any}>
        {desk ? (
          <View style={{ flexGrow: 1, padding: 16, paddingTop: 20, paddingBottom: 36, gap: wide ? 34 : 24, direction: rtl ? 'rtl' : 'ltr', width: '100%', maxWidth: L.content, alignSelf: 'center' } as any}>{body}</View>
        ) : body}
        {desk && <PageFooter />}
      </ScrollView>
    </View>
  );
}
