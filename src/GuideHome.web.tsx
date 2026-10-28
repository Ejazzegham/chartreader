import React from 'react';
import { View, Text, Pressable, ScrollView, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Rect, Circle, Line, Path, G, Text as SvgText, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg';
import { useApp } from './store';
import { Icon, HeroBanner } from './ui';
import { useRealWindow } from './win';
import { usePal, Footer, useGo } from './DesktopHome.web';
import { Notices } from './Desktop.web';
import { SUPPORT_EMAIL } from './license';

// The website's "How to Use Chart Reader" page, designed like the mockup: hero, intro strip, then three groups of step cards
// (Getting Started, Market Analysis Tools, Trading & Execution) and a Support & Help panel. Every card opens the page it explains.
type Props = { active: boolean };

type Kind = 'account' | 'dash' | 'prefs' | 'charts' | 'scanner' | 'news' | 'risk' | 'trade' | 'manage' | 'monitor' | 'discipline';
type Step = { kind: Kind; icon: string; title: string; body: string; tab: number; extra?: string };
type Group = { n: number; title: string; sub: string; steps: Step[] };

const GROUPS: Group[] = [
  {
    n: 1, title: 'Getting Started', sub: 'Set up your account, explore the dashboard and get familiar with the platform.',
    steps: [
      { kind: 'account', icon: 'person', title: 'Create Your Account', body: 'Sign up with your email and password. Verify your account to get full access to all features.', tab: 6 },
      { kind: 'dash', icon: 'grid', title: 'Explore the Dashboard', body: 'Get familiar with the main menu, charts and tools. Customize your layout for a better experience.', tab: 0 },
      { kind: 'prefs', icon: 'shield-checkmark', title: 'Set Up Your Preferences', body: 'Configure your trading settings, notifications and theme to match your style.', tab: 6 },
    ],
  },
  {
    n: 2, title: 'Market Analysis Tools', sub: 'Use powerful analysis tools to find high-probability trading opportunities.',
    steps: [
      { kind: 'charts', icon: 'stats-chart', title: 'Charts & Indicators', body: 'Analyze price action with advanced indicators and drawing tools.', tab: 1 },
      { kind: 'scanner', icon: 'search', title: 'Market Scanner', body: 'Find the best setups with real-time market scanning and filters.', tab: 1, extra: 'scanner' },
      { kind: 'news', icon: 'newspaper', title: 'News & Events', body: 'Stay updated with the latest financial news and economic events.', tab: 13 },
      { kind: 'risk', icon: 'calculator', title: 'Risk & TP Planner', body: 'Calculate position size, risk amount and set your take-profit levels.', tab: 4 },
    ],
  },
  {
    n: 3, title: 'Trading & Execution', sub: 'Turn your analysis into action and manage your trades with confidence.',
    steps: [
      { kind: 'trade', icon: 'swap-vertical', title: 'Open a Trade', body: 'Use the chart or market list to open a trade with your preferred settings.', tab: 16 },
      { kind: 'manage', icon: 'settings', title: 'Manage Your Trade', body: 'Set stop loss, take profit and manage your position.', tab: 5 },
      { kind: 'monitor', icon: 'stats-chart', title: 'Monitor Performance', body: 'Track your trades, review results and improve your strategy.', tab: 9 },
      { kind: 'discipline', icon: 'locate', title: 'Stay Disciplined', body: 'Follow your plan, control emotions and trade with discipline.', tab: 11 },
    ],
  },
];

// ---------- the small drawings above each card (all drawn with SVG, so they stay sharp and follow the light / dark theme)
function Art({ kind }: { kind: Kind }) {
  const P = usePal(), th = P.th, d = P.dark;
  const blue = P.blue, ink = d ? '#0E1A3D' : '#0B2A80', paper = d ? th.panel2 : '#FFFFFF', line = d ? th.line : '#D7E3FA', soft = d ? th.accent + '33' : '#E6EEFF';
  const up = th.buy, dn = th.sell, vio = th.accent2;
  const candles = (x0: number, base: number, n: number, step: number, rise: number) => Array.from({ length: n }, (_, i) => {
    const x = x0 + i * step, wob = Math.sin(i * 1.9) * 7, mid = base - i * rise + wob, h = 8 + ((i * 7) % 9), isUp = i % 3 !== 1, c = isUp ? up : dn;
    return <G key={i}><Line x1={x} y1={mid - h - 5} x2={x} y2={mid + h + 5} stroke={c} strokeWidth="1.4" /><Rect x={x - 3.5} y={mid - h} width="7" height={h * 1.6} rx="1.5" fill={c} /></G>;
  });
  const bars = (x: number, y: number, w: number, n: number, gap = 12, op = 1) => Array.from({ length: n }, (_, i) => <Rect key={i} x={x} y={y + i * gap} width={i % 2 ? w * 0.7 : w} height="5" rx="2.5" fill={line} opacity={op} />);
  let art: React.ReactNode = null;
  switch (kind) {
    case 'account':
      art = <G>
        <Rect x="70" y="14" width="150" height="88" rx="9" fill={paper} stroke={line} />
        <Circle cx="145" cy="42" r="15" fill={blue} /><Circle cx="145" cy="38" r="5" fill="#fff" /><Path d="M135 50 a10 8 0 0 1 20 0 z" fill="#fff" />
        <Rect x="100" y="64" width="90" height="7" rx="3.5" fill={line} /><Rect x="112" y="78" width="66" height="7" rx="3.5" fill={line} />
        <Rect x="108" y="90" width="74" height="9" rx="4.5" fill={blue} />
      </G>; break;
    case 'dash':
      art = <G>
        <Rect x="44" y="12" width="202" height="92" rx="8" fill={paper} stroke={line} />
        <Rect x="44" y="12" width="40" height="92" rx="8" fill={ink} />
        {[26, 40, 54, 68].map((y) => <Rect key={y} x="52" y={y} width="24" height="6" rx="3" fill={blue} opacity="0.8" />)}
        <Path d="M96 78 L116 62 L134 70 L156 44 L178 56 L200 30 L232 40" stroke={blue} strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {[96, 140, 184].map((x) => <Rect key={x} x={x} y="86" width="38" height="12" rx="4" fill={soft} />)}
      </G>; break;
    case 'prefs':
      art = <G>
        <Rect x="44" y="12" width="202" height="92" rx="8" fill={paper} stroke={line} />
        <Rect x="44" y="12" width="52" height="92" rx="8" fill={ink} />
        {[26, 42, 58, 74].map((y) => <G key={y}><Circle cx="58" cy={y + 3} r="3.5" fill={blue} /><Rect x="68" y={y} width="20" height="6" rx="3" fill="#8FA9E8" opacity="0.6" /></G>)}
        <Circle cx="176" cy="48" r="20" fill={soft} stroke={blue} strokeWidth="2" /><Circle cx="176" cy="48" r="7" fill={paper} stroke={blue} strokeWidth="2" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => { const r = (a * Math.PI) / 180; return <Line key={a} x1={176 + 20 * Math.cos(r)} y1={48 + 20 * Math.sin(r)} x2={176 + 26 * Math.cos(r)} y2={48 + 26 * Math.sin(r)} stroke={blue} strokeWidth="4" strokeLinecap="round" />; })}
        <Rect x="118" y="84" width="48" height="8" rx="4" fill={line} /><Rect x="186" y="84" width="40" height="8" rx="4" fill={blue} />
      </G>; break;
    case 'charts':
      art = <G>
        <Path d="M20 96 H270 M20 70 H270 M20 44 H270 M20 18 H270" stroke={line} strokeWidth="1" opacity="0.7" />
        {candles(34, 80, 18, 13.5, 2.6)}
        <Path d="M30 86 C 80 80, 120 70, 160 52 S 230 24, 268 16" stroke={blue} strokeWidth="2" fill="none" opacity="0.55" />
      </G>; break;
    case 'scanner':
      art = <G>
        <Rect x="58" y="12" width="174" height="92" rx="8" fill={paper} stroke={line} />
        <Rect x="68" y="20" width="60" height="8" rx="4" fill={blue} />
        {[38, 60, 82].map((y, i) => <G key={y}><Circle cx="76" cy={y + 6} r="5" fill={soft} /><Rect x="88" y={y + 2} width="70" height="6" rx="3" fill={line} />
          <Rect x="188" y={y} width="32" height="12" rx="6" fill={[up, dn, vio][i]} opacity="0.9" /></G>)}
      </G>; break;
    case 'news':
      art = <G>
        <Rect x="50" y="14" width="150" height="86" rx="8" fill={paper} stroke={line} />
        <Rect x="50" y="14" width="52" height="16" rx="6" fill={blue} /><Rect x="58" y="19" width="36" height="6" rx="3" fill="#fff" />
        {bars(60, 42, 120, 4, 13)}
        <Rect x="170" y="38" width="86" height="58" rx="8" fill={blue} opacity="0.92" /><Rect x="170" y="38" width="86" height="58" rx="8" fill={vio} opacity="0.35" />
        <Path d="M182 80 L200 62 L214 72 L244 50" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </G>; break;
    case 'risk':
      art = <G>
        <Rect x="96" y="8" width="98" height="100" rx="10" fill={paper} stroke={line} />
        <Rect x="106" y="18" width="78" height="20" rx="5" fill={ink} /><Rect x="114" y="25" width="40" height="6" rx="3" fill={blue} />
        {[0, 1, 2, 3].map((r) => [0, 1, 2].map((c) => <Rect key={r + '-' + c} x={106 + c * 27} y={46 + r * 15} width="22" height="11" rx="3" fill={c === 2 && r === 3 ? blue : soft} />))}
      </G>; break;
    case 'trade':
      art = <G>
        <Rect x="44" y="10" width="202" height="92" rx="10" fill={paper} stroke={line} />
        <Rect x="58" y="22" width="60" height="7" rx="3.5" fill={line} /><Rect x="58" y="36" width="120" height="7" rx="3.5" fill={line} />
        <Rect x="58" y="62" width="86" height="28" rx="6" fill={blue} /><Rect x="152" y="62" width="82" height="28" rx="6" fill={dn} />
        <SvgText x="101" y="80" fontSize="12" fontWeight="700" fill="#fff" textAnchor="middle">BUY</SvgText><SvgText x="193" y="80" fontSize="12" fontWeight="700" fill="#fff" textAnchor="middle">SELL</SvgText>
      </G>; break;
    case 'manage':
      art = <G>
        <Rect x="50" y="10" width="190" height="96" rx="10" fill={paper} stroke={line} />
        {[0, 1].map((i) => <G key={i}>
          <Circle cx="82" cy={38 + i * 40} r="14" fill={i ? up : dn} /><Rect x="106" y={34 + i * 40} width="100" height="7" rx="3.5" fill={line} />
          <Path d={`M222 ${38 + i * 40} l-6 -5 v10 z`} fill={blue} />
        </G>)}
        <Path d="M76 38 h12 M76 78 h12" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      </G>; break;
    case 'monitor':
      art = <G>
        <Rect x="36" y="8" width="218" height="94" rx="9" fill={ink} />
        <Path d="M46 86 H244 M46 66 H244 M46 46 H244 M46 26 H244" stroke="#FFFFFF" strokeWidth="1" opacity="0.12" />
        {candles(58, 80, 14, 14, 2.4)}
        <Path d="M50 84 C 100 76, 140 64, 180 46 S 224 28, 244 22" stroke="#7FB0FF" strokeWidth="2" fill="none" />
      </G>; break;
    case 'discipline':
      art = <G>
        <Circle cx="145" cy="58" r="42" fill={vio} opacity="0.25" /><Circle cx="145" cy="58" r="34" fill={paper} stroke={vio} strokeWidth="5" />
        <Circle cx="145" cy="58" r="22" fill="none" stroke={blue} strokeWidth="5" /><Circle cx="145" cy="58" r="10" fill={blue} /><Circle cx="145" cy="58" r="4" fill="#fff" />
        <Line x1="145" y1="58" x2="190" y2="16" stroke={ink} strokeWidth="3" strokeLinecap="round" /><Path d="M186 8 l16 4 l-10 12 z" fill={vio} />
      </G>; break;
  }
  return (
    <View style={{ height: 118, overflow: 'hidden', borderTopLeftRadius: 14, borderTopRightRadius: 14 }}>
      <LinearGradient colors={[d ? th.accent + '1F' : '#EAF1FF', d ? th.accent2 + '14' : '#F3F0FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width="100%" height="118" viewBox="0 0 290 112" preserveAspectRatio="xMidYMid meet" style={{ direction: 'ltr' } as any}>{art}</Svg>
      </LinearGradient>
    </View>
  );
}

// ---------- hero art: a laptop with a live-looking chart and three floating tiles (book, chart, gear)
function HeroArt({ w }: { w: number }) {
  const tile = (icon: string, x: number, y: number, s: number, c: [string, string]) => (
    <View key={icon} style={{ position: 'absolute', left: x, top: y, width: s, height: s, borderRadius: s * 0.24, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } }}>
      <LinearGradient colors={c} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FFFFFF55', borderRadius: s * 0.24 }}>
        <Icon name={icon} size={s * 0.5} color="#FFFFFF" />
      </LinearGradient>
    </View>
  );
  const cs = Array.from({ length: 22 }, (_, i) => { const x = 40 + i * 14, m = 150 - i * 4.2 + Math.sin(i * 1.7) * 12, h = 7 + ((i * 5) % 9), u = i % 3 !== 1; return { x, m, h, c: u ? '#34E3B5' : '#FF6B88' }; });
  return (
    <View style={{ width: Math.min(w, 520), height: 250 }} pointerEvents="none">
      <Svg width="100%" height="250" viewBox="0 0 400 250" style={{ position: 'absolute', left: 0, top: 0 } as any}>
        <Defs><SvgGrad id="gh" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#1B3FA8" /><Stop offset="1" stopColor="#0A1E66" /></SvgGrad></Defs>
        {[0, 1, 2, 3, 4].map((i) => <Rect key={i} x={14 + i * 22} y={150 - i * 16 - (i % 2) * 14} width="14" height={90 + i * 16} rx="3" fill="#3C7BFF" opacity="0.22" />)}
        <Path d="M46 214 L70 70 Q72 60 84 60 L330 60 Q342 60 344 70 L368 214 Z" fill="url(#gh)" stroke="#6FA0FF" strokeWidth="2" />
        <Rect x="58" y="72" width="296" height="130" rx="4" fill="#0A1840" />
        {cs.map((c, i) => <G key={i}><Line x1={c.x + 30} y1={c.m - c.h - 14 + 20} x2={c.x + 30} y2={c.m + c.h + 14 + 20} stroke={c.c} strokeWidth="1.3" /><Rect x={c.x + 26.5} y={c.m - c.h + 20} width="7" height={c.h * 1.5} rx="1.5" fill={c.c} /></G>)}
        <Path d="M20 222 H392 L378 236 Q376 240 370 240 H42 Q36 240 34 236 Z" fill="#C8D9FF" opacity="0.9" />
      </Svg>
      {tile('book-outline', 330, 6, 82, ['#5E94FF', '#2B63F0'])}
      {tile('stats-chart', 352, 100, 60, ['#6FA8FF', '#3C73F5'])}
      {tile('settings', 346, 176, 66, ['#5B8CFF', '#2A56D9'])}
    </View>
  );
}

function StepCard({ s, i, width, onOpen }: { s: Step; i: number; width: number | string; onOpen: () => void }) {
  const P = usePal(), th = P.th;
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`${i + 1}. ${s.title}`} onPress={onOpen}
      style={((st: any) => ({ width, flexGrow: 1, minWidth: 0, borderRadius: 14, borderWidth: 1, borderColor: st.hovered ? P.blue + '88' : P.border, backgroundColor: P.card, cursor: 'pointer', shadowColor: P.shadow, shadowOpacity: P.dark ? 0.3 : st.hovered ? 0.14 : 0.07, shadowRadius: 22, shadowOffset: { width: 0, height: 8 } })) as any}>
      <Art kind={s.kind} />
      <View style={{ padding: 16, paddingTop: 14, gap: 8, flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: P.soft, alignItems: 'center', justifyContent: 'center' }}><Icon name={s.icon} size={18} color={P.blue} /></View>
          <Text accessibilityRole="header" style={{ flex: 1, color: P.head, fontSize: 15.5, fontWeight: '800' }}>{i + 1}. {s.title}</Text>
        </View>
        <Text style={{ color: P.body, fontSize: 13, lineHeight: 20, paddingRight: 28, minHeight: 40 }}>{s.body}</Text>
        <View style={{ alignItems: 'flex-end', marginTop: 'auto' } as any}>
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: P.blue, alignItems: 'center', justifyContent: 'center' }}><Icon name="arrow-forward" size={14} color={th.onAccent} /></View>
        </View>
      </View>
    </Pressable>
  );
}

function GroupHead({ g, count, unit }: { g: { n: number; title: string; sub: string }; count: number; unit: string }) {
  const P = usePal(), th = P.th;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 14, flexShrink: 1 }}>
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: P.blue, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: th.onAccent, fontSize: 17, fontWeight: '800' }}>{g.n}</Text></View>
        <View style={{ flexShrink: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text accessibilityRole="header" style={{ color: P.head, fontSize: 21, fontWeight: '800', letterSpacing: -0.3 }}>{g.title}</Text>
            <View style={{ width: 28, height: 2, borderRadius: 1, backgroundColor: P.blue + '66' }} />
          </View>
          <Text style={{ color: P.body, fontSize: 13.5, lineHeight: 20 }}>{g.sub}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 32, paddingHorizontal: 14, borderRadius: 16, backgroundColor: P.soft }}>
        <Icon name="grid" size={13} color={P.blue} /><Text style={{ color: P.blue, fontSize: 12.5, fontWeight: '700' }}>{count} {unit}</Text>
      </View>
    </View>
  );
}

export default function GuideHome({ active }: Props) {
  const P = usePal(), th = P.th, go = useGo();
  const { setHelpOpen } = useApp();
  const w = useRealWindow().width;
  const pad = w >= 700 ? 32 : 16;
  const inner = Math.min(w, 1360) - pad * 2;
  const cols3 = w >= 900 ? 3 : w >= 600 ? 2 : 1, cols4 = w >= 1180 ? 4 : w >= 600 ? 2 : 1;
  const basis = (cols: number) => `${100 / cols - 1.6}%`;
  const open = (s: Step) => go(s.tab, s.extra);
  const mail = () => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Chart Reader support')}`).catch(() => setHelpOpen(true));

  const hero = [
    { icon: 'locate', t: 'Easy to Follow', s: 'Step-by-step guide' },
    { icon: 'shield-checkmark', t: 'Build Your Skills', s: 'Learn at your own pace' },
    { icon: 'shield-half', t: 'Trade Smarter', s: 'Use the right tools' },
    { icon: 'headset', t: 'Get Support', s: "We're here to help" },
  ];
  const help: { icon: string; title: string; body: string; onPress: () => void }[] = [
    { icon: 'mail-outline', title: 'Contact Us', body: 'Send us an email and we will reply as soon as we can.', onPress: mail },
    { icon: 'chatbubbles-outline', title: 'Help Chat', body: 'Write to us in the app. Replies arrive here and as a notification.', onPress: () => setHelpOpen(true) },
    { icon: 'information-circle-outline', title: 'About & Disclaimer', body: 'What Chart Reader is, who makes it and what it cannot promise.', onPress: () => go(15) },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: P.alt, display: active ? 'flex' : 'none' } as any} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
      {/* hero: same banner as every other page */}
      <View style={{ width: '100%', maxWidth: 1360, alignSelf: 'center', paddingHorizontal: pad, paddingTop: 22 }}>
        <HeroBanner icon="book-outline" tag="Guide & Tutorials" title="How to Use Chart Reader" subtitle="Follow this step-by-step guide to learn how to use the platform, find the right tools, and make the most of your trading experience."
          features={hero.map((h) => ({ icon: h.icon, title: h.t, sub: h.s }))} />
      </View>

      <View style={{ width: '100%', maxWidth: 1360, alignSelf: 'center', paddingHorizontal: pad, paddingTop: 22, paddingBottom: 34, gap: 34 }}>
        <Notices flush />

        {/* intro strip */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 12, backgroundColor: P.soft, borderWidth: 1, borderColor: P.blue + '33', marginBottom: -6 }}>
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: P.blue, alignItems: 'center', justifyContent: 'center' }}><Icon name="information" size={20} color={th.onAccent} /></View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: P.head, fontSize: 14, fontWeight: '800' }}>Start your journey</Text>
            <Text style={{ color: P.body, fontSize: 13, lineHeight: 19 }}>Explore the platform step by step and learn how to use the key features, from market analysis to trade planning.</Text>
          </View>
          {w >= 900 && <Text style={{ color: P.blue, fontSize: 18, fontStyle: 'italic', transform: [{ rotate: '-4deg' }], fontFamily: "'Segoe Script','Brush Script MT','Lucida Handwriting',cursive" } as any}>Better Tools. Smarter Trading.</Text>}
        </View>

        {GROUPS.map((g) => {
          const cols = g.steps.length === 3 ? cols3 : cols4;
          return (
            <View key={g.n} style={{ gap: 16 }}>
              <GroupHead g={g} count={g.steps.length} unit="Steps" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
                {g.steps.map((s, i) => <StepCard key={s.title} s={s} i={i} width={basis(cols) as any} onOpen={() => open(s)} />)}
              </View>
            </View>
          );
        })}

        {/* support & help */}
        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: P.blue + '22', backgroundColor: P.dark ? th.panel : th.accent2 + '0D', padding: 20, gap: 16 }}>
          <GroupHead g={{ n: 4, title: 'Support & Help', sub: "Need assistance? We're here to help you 24/7." }} count={help.length} unit="Options" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
            {help.map((h) => (
              <Pressable key={h.title} accessibilityRole="button" onPress={h.onPress}
                style={((st: any) => ({ flexBasis: basis(cols3), flexGrow: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18, borderRadius: 12, borderWidth: 1, borderColor: st.hovered ? P.blue + '88' : P.border, backgroundColor: P.card, cursor: 'pointer' })) as any}>
                <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: P.soft, alignItems: 'center', justifyContent: 'center' }}><Icon name={h.icon} size={26} color={P.blue} /></View>
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <Text style={{ color: P.head, fontSize: 15, fontWeight: '800' }}>{h.title}</Text>
                  <Text style={{ color: P.body, fontSize: 12.5, lineHeight: 18 }}>{h.body}</Text>
                </View>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: P.blue, alignItems: 'center', justifyContent: 'center' }}><Icon name="arrow-forward" size={14} color={th.onAccent} /></View>
              </Pressable>
            ))}
          </View>
        </View>

        <Text style={{ color: P.body, fontSize: 12, lineHeight: 18, textAlign: 'center', maxWidth: 760, alignSelf: 'center' }}>Chart Reader is an educational tool. It is not financial advice and it cannot promise profit. Trading is risky. Test on a demo account first and never risk money you cannot afford to lose.</Text>
      </View>
      <Footer w={w} go={go} />
    </ScrollView>
  );
}
