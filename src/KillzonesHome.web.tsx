import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Line, Rect, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg';
import { useApp } from './store';
import { Icon, HeroBanner } from './ui';
import { useRealWindow } from './win';
import { killzonesFor, nextKillzone } from './ict';
import { fxWeekendClosed } from './markets';
import { usePal, Panel, Footer, useGo } from './DesktopHome.web';
import { Notices } from './Desktop.web';

// The website's Killzones page, designed like the "Killzones" mockup: hero, intro strip, live clock next to the killzone list,
// six "how to use" steps, and a call-to-action. All times come from the same killzone rules as the phone app (src/ict.ts),
// including the one-hour shift while the US is on daylight saving time.
type Props = { active: boolean };

const pad = (n: number) => String(n).padStart(2, '0');
const utcTxt = (h: number) => `${pad(Math.floor(h))}:${pad(Math.round((h % 1) * 60))}`; // windows can start at half hours (New York PM)
// UTC hour -> this computer's local time text
const local = (h: number) => { const d = new Date(); d.setUTCHours(Math.floor(h), Math.round((h % 1) * 60), 0, 0); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

// one colour per window, as in the mockup (the three Silver Bullet hours share one colour)
const KZ_COLOR: Record<string, string> = { asia: '#D77CF2', london: '#22C58B', nyam: '#2F6BFF', lclose: '#F5A524', nypm: '#8B5CF6', sbL: '#14B8A6', silver: '#14B8A6', sbP: '#14B8A6' };
const LANE_ONE = ['asia', 'london', 'nyam', 'lclose', 'nypm'];

const STEPS: { icon: string; title: string; body: string }[] = [
  { icon: 'time-outline', title: 'Identify the Session', body: 'Check the current time and find which killzone is active.' },
  { icon: 'stats-chart-outline', title: 'Mark Key Levels', body: 'Use highs, lows and liquidity zones from the session.' },
  { icon: 'locate-outline', title: 'Wait for Setup', body: 'Look for sweeps, MSS, and confirmation signals.' },
  { icon: 'arrow-forward', title: 'Look for Entry', body: 'Use the killzone timing and price action confirmation.' },
  { icon: 'shield-checkmark-outline', title: 'Manage Risk', body: 'Set your stop loss and take profit using your plan.' },
  { icon: 'play-circle-outline', title: 'Execute Trade', body: 'Enter with discipline and follow your strategy.' },
];

// ---------- analog clock that shows the live UTC time (the same time as the digital clock above it)
function AnalogClock({ now, size = 104 }: { now: Date; size?: number }) {
  const P = usePal(), th = P.th;
  const sec = now.getUTCSeconds(), min = now.getUTCMinutes() + sec / 60, hr = (now.getUTCHours() % 12) + min / 60;
  const hand = (deg: number, len: number) => { const a = (deg * Math.PI) / 180; return { x2: 50 + len * Math.sin(a), y2: 50 - len * Math.cos(a) }; };
  const h = hand(hr * 30, 22), m = hand(min * 6, 32), s = hand(sec * 6, 36);
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" style={{ direction: 'ltr' } as any}>
      <Defs>
        <SvgGrad id="kzRing" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={P.blue} /><Stop offset="1" stopColor={th.accent2} /></SvgGrad>
      </Defs>
      <Circle cx="50" cy="50" r="45" fill={P.dark ? th.panel2 : '#FFFFFF'} stroke="url(#kzRing)" strokeWidth="6" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * 30 * Math.PI) / 180, r1 = i % 3 === 0 ? 34 : 37, r2 = 40;
        return <Line key={i} x1={50 + r1 * Math.sin(a)} y1={50 - r1 * Math.cos(a)} x2={50 + r2 * Math.sin(a)} y2={50 - r2 * Math.cos(a)} stroke={P.body} strokeWidth={i % 3 === 0 ? 2 : 1} strokeLinecap="round" />;
      })}
      <Line x1="50" y1="50" x2={h.x2} y2={h.y2} stroke={P.head} strokeWidth="3.4" strokeLinecap="round" />
      <Line x1="50" y1="50" x2={m.x2} y2={m.y2} stroke={P.head} strokeWidth="2.4" strokeLinecap="round" />
      <Line x1="50" y1="50" x2={s.x2} y2={s.y2} stroke={th.accent2} strokeWidth="1.2" strokeLinecap="round" />
      <Circle cx="50" cy="50" r="3" fill={P.blue} />
    </Svg>
  );
}

// small row of candles drawn on the right of the call-to-action
function CandleArt() {
  const P = usePal();
  const c: [number, number, number, number, boolean][] = [[12, 52, 78, 58, true], [34, 40, 70, 46, false], [56, 44, 74, 50, true], [78, 26, 58, 32, false], [100, 30, 60, 38, true], [122, 12, 46, 18, false], [144, 8, 40, 14, false]];
  return (
    <Svg width={170} height={86} viewBox="0 0 160 86" style={{ opacity: 0.55 } as any}>
      {c.map(([x, wt, wb, bt, up], i) => {
        const col = up ? P.blue : P.th.accent2, bb = Math.min(wb, bt + 22);
        return <React.Fragment key={i}><Line x1={x} y1={wt} x2={x} y2={wb} stroke={col} strokeWidth="1.6" strokeLinecap="round" /><Rect x={x - 5} y={bt} width="10" height={bb - bt} rx="2" fill={col} /></React.Fragment>;
      })}
    </Svg>
  );
}

function Dot({ color, live }: { color: string; live?: boolean }) {
  return <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color, ...(live ? { shadowColor: color, shadowOpacity: 1, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } } : null) } as any} />;
}

function PanelHead({ icon, title, sub, right, bar }: { icon?: string; title: string; sub?: string; right?: React.ReactNode; bar?: boolean }) {
  const P = usePal();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 }}>
        {!!icon && <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: P.soft, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={20} color={P.blue} /></View>}
        {bar && <View style={{ width: 3, height: 18, borderRadius: 2, backgroundColor: P.blue }} />}
        <View style={{ flexShrink: 1 }}>
          <Text accessibilityRole="header" style={{ color: P.head, fontSize: 16, fontWeight: '800' }}>{title}</Text>
          {!!sub && <Text style={{ color: P.body, fontSize: 12.5, marginTop: 1 }}>{sub}</Text>}
        </View>
      </View>
      {right}
    </View>
  );
}

export default function KillzonesHome({ active }: Props) {
  const P = usePal(), th = P.th, go = useGo();
  const { t } = useApp();
  const w = useRealWindow().width;
  const [now, setNow] = useState(new Date());
  useEffect(() => { if (!active) return; setNow(new Date()); const i = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(i); }, [active]);

  const zones = killzonesFor(now);
  const hUtc = now.getUTCHours() + now.getUTCMinutes() / 60;
  const inside = (k: { from: number; to: number }) => hUtc >= k.from && hUtc < k.to;
  // the narrowest window is "the" current session (a Silver Bullet hour inside New York AM reads as the Silver Bullet)
  const cur = zones.filter(inside).sort((a, b) => (a.to - a.from) - (b.to - b.from))[0] ?? null;
  const nx = nextKillzone(now), closed = fxWeekendClosed(now);
  const hh = Math.floor(nx.mins / 60), mm = nx.mins % 60;
  const utcPos = (hUtc / 24) * 100;
  const status = closed ? { text: 'FX CLOSED', color: th.sell } : cur ? { text: 'LIVE', color: th.buy } : { text: 'WAITING', color: th.gold };

  const pad32 = w >= 700 ? 32 : 16;
  const twoCols = w >= 1000;
  const stepCols = w >= 1000 ? 3 : w >= 640 ? 2 : 1;
  const wideRows = w >= 760;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: P.alt, display: active ? 'flex' : 'none' } as any} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
      {/* hero */}
      <View style={{ width: '100%', maxWidth: 1360, alignSelf: 'center', paddingHorizontal: pad32, paddingTop: 24 }}>
        <HeroBanner icon="alarm" title="Killzones" subtitle="London, New York and Silver Bullet windows with a live clock."
          features={[
            { icon: 'earth-outline', title: 'Precise Time Zones', sub: 'London, New York, Asia & more' },
            { icon: 'time-outline', title: 'Live Session Clock', sub: 'Real-time countdown' },
            { icon: 'notifications-outline', title: 'Smart Notifications', sub: 'Never miss a killzone', onPress: () => go(6) },
            { icon: 'trending-up-outline', title: 'Better Trading', sub: 'Trade with confidence' },
          ]} />
      </View>

      <View style={{ width: '100%', maxWidth: 1360, alignSelf: 'center', paddingHorizontal: pad32, paddingTop: 24, paddingBottom: 30, gap: 20 }}>
        <Notices flush />

        {/* intro strip */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 12, backgroundColor: P.soft, borderWidth: 1, borderColor: P.blue + '33' }}>
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: P.blue, alignItems: 'center', justifyContent: 'center' }}><Icon name="information" size={20} color={th.onAccent} /></View>
          <Text style={{ color: P.head, fontSize: 13, lineHeight: 20, flex: 1 }}>The Killzones page shows the most important trading sessions and time windows, helping you identify high-probability periods for market movements. Use the live clock and session timeline to plan your trades with precision.</Text>
          {w >= 900 && <Text style={{ color: P.blue, fontSize: 19, lineHeight: 22, fontStyle: 'italic', textAlign: 'center', transform: [{ rotate: '-6deg' }], fontFamily: "'Segoe Script','Brush Script MT','Lucida Handwriting',cursive" } as any}>{'Trade Smarter\nNot Harder'}</Text>}
        </View>

        {/* clock + overview */}
        <View style={{ flexDirection: twoCols ? 'row' : 'column', alignItems: 'flex-start', gap: 20 }}>
          <View style={{ flex: twoCols ? 1 : undefined, width: twoCols ? undefined : '100%', gap: 20, minWidth: 0 }}>
            <Panel style={{ padding: 20, gap: 16, borderColor: cur ? th.buy + '66' : P.border }}>
              <PanelHead icon="alarm-outline" title="Live Killzones Clock" sub="Current time and active session"
                right={
                  <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: 10 }}>
                    <Text style={{ color: P.body, fontSize: 13, fontVariant: ['tabular-nums'] } as any}>UTC {pad(now.getUTCHours())}:{pad(now.getUTCMinutes())}:{pad(now.getUTCSeconds())}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 24, borderRadius: 12, backgroundColor: status.color + '1F', borderWidth: 1, borderColor: status.color + '55' }}>
                      <Dot color={status.color} live />
                      <Text style={{ color: status.color, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>{status.text}</Text>
                    </View>
                  </View>
                } />
              <View style={{ borderRadius: 14, borderWidth: 1, borderColor: P.border, backgroundColor: P.dark ? th.panel2 : '#F8FAFF', padding: 20, gap: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                  <AnalogClock now={now} />
                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <Text style={{ color: P.head, fontSize: 14, fontWeight: '800' }}>Current Session</Text>
                    <Text style={{ color: P.head, fontSize: w >= 700 ? 28 : 22, fontWeight: '900', letterSpacing: -0.5 }} numberOfLines={2}>{cur ? cur.name : 'Between killzones'}</Text>
                    <Text style={{ color: P.body, fontSize: 13.5, lineHeight: 20 }}>{cur ? cur.note : `Next: ${nx.k.name}`}</Text>
                  </View>
                </View>
                <View style={{ height: 1, backgroundColor: P.border }} />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
                  <Text style={{ color: P.blue, fontSize: 15, fontWeight: '800' }}>Next:</Text>
                  <Text style={{ color: P.blue, fontSize: 15, fontWeight: '800' }}>{nx.k.name} - {hh}h {pad(mm)}m</Text>
                </View>
              </View>
            </Panel>

            {/* 24 hour timeline (two lanes: the big windows, then the Silver Bullet hours) */}
            <Panel style={{ padding: 20, gap: 12 }}>
              <PanelHead icon="analytics-outline" title="24 hour UTC timeline" sub="Where each window sits in the day" />
              <View style={{ height: 40, borderRadius: 8, backgroundColor: P.alt, borderWidth: 1, borderColor: P.border, overflow: 'hidden', direction: 'ltr' } as any}>
                {zones.map((k) => {
                  const lane = LANE_ONE.includes(k.key) ? 4 : 22, on = inside(k), c = KZ_COLOR[k.key] ?? P.blue;
                  return <View key={k.key} style={{ position: 'absolute', top: lane, height: 14, borderRadius: 4, left: `${(k.from / 24) * 100}%`, width: `${((k.to - k.from) / 24) * 100}%`, backgroundColor: c + (on ? 'E6' : '88') } as any} />;
                })}
                <View style={{ position: 'absolute', top: 0, bottom: 0, left: `${utcPos}%`, width: 2, backgroundColor: P.head } as any} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', direction: 'ltr' } as any}>
                {[0, 6, 12, 18, 24].map((h) => <Text key={h} style={{ color: P.body, fontSize: 10.5 }}>{pad(h % 24)}</Text>)}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
                {[['asia', 'Asia'], ['london', 'London'], ['nyam', 'NY AM'], ['lclose', 'London Close'], ['nypm', 'NY PM'], ['silver', 'Silver Bullet']].map(([k, label]) => (
                  <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: KZ_COLOR[k] }} /><Text style={{ color: P.body, fontSize: 11.5 }}>{label}</Text></View>
                ))}
              </View>
              <Text style={{ color: P.body, fontSize: 12, lineHeight: 17 }}>{t('kzLocalNote')}</Text>
            </Panel>
          </View>

          {/* killzones overview */}
          <Panel style={{ flex: twoCols ? 1.15 : undefined, width: twoCols ? undefined : '100%', padding: 20, gap: 14, minWidth: 0 }}>
            <PanelHead bar title="Killzones Overview" />
            <View style={{ gap: 10 }}>
              {zones.map((k) => {
                const on = inside(k), c = KZ_COLOR[k.key] ?? P.blue;
                return (
                  <View key={k.key} style={{ flexDirection: 'row', alignItems: 'stretch', borderRadius: 12, borderWidth: 1, borderColor: on ? c + '88' : P.border, backgroundColor: on ? c + '12' : P.card, overflow: 'hidden' }}>
                    <View style={{ width: 5, backgroundColor: c }} />
                    <View style={{ flex: 1, flexDirection: wideRows ? 'row' : 'column', alignItems: wideRows ? 'center' : 'flex-start', gap: wideRows ? 18 : 6, paddingVertical: 14, paddingHorizontal: 16 }}>
                      <View style={{ width: wideRows ? 210 : undefined, gap: 3 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Dot color={c} />
                          <Text style={{ color: P.head, fontSize: 14, fontWeight: '800', flexShrink: 1 }}>{k.name}</Text>
                          {on && <View style={{ paddingHorizontal: 7, height: 18, borderRadius: 9, backgroundColor: th.buy + '24', justifyContent: 'center' }}><Text style={{ color: th.buy, fontSize: 9.5, fontWeight: '900', letterSpacing: 0.5 }}>LIVE</Text></View>}
                        </View>
                        <Text style={{ color: P.body, fontSize: 12.5, fontVariant: ['tabular-nums'] } as any}>UTC {utcTxt(k.from)} - {utcTxt(k.to)}</Text>
                        <Text style={{ color: P.body, fontSize: 11, opacity: 0.8, fontVariant: ['tabular-nums'] } as any}>{t('kzYourTime')} {local(k.from)} - {local(k.to)}</Text>
                      </View>
                      <Text style={{ color: P.body, fontSize: 12.5, lineHeight: 18, flex: 1 }}>{k.note}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </Panel>
        </View>

        {/* how to use */}
        <Panel style={{ padding: 20, gap: 16, backgroundColor: P.dark ? th.panel : th.accent2 + '0A' }}>
          <PanelHead icon="book-outline" title="How to Use Killzones" sub="Follow these steps to trade the killzones effectively."
            right={<Pressable onPress={() => go(14)} accessibilityRole="link" style={((s: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: s.hovered ? 0.8 : 1, cursor: 'pointer' })) as any}><Text style={{ color: P.blue, fontSize: 13, fontWeight: '700' }}>View Full Guide</Text><Icon name="arrow-forward" size={14} color={P.blue} /></Pressable>} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            {STEPS.map((s, i) => (
              <View key={s.title} style={{ flexGrow: 1, flexBasis: stepCols === 3 ? '30%' : stepCols === 2 ? '45%' : '100%', minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, paddingLeft: 18, borderRadius: 12, borderWidth: 1, borderColor: P.border, backgroundColor: P.card }}>
                <View style={{ position: 'absolute', top: -8, left: -8, width: 24, height: 24, borderRadius: 12, backgroundColor: th.accent2, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>{i + 1}</Text></View>
                <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: th.accent2 + '1A', alignItems: 'center', justifyContent: 'center' }}><Icon name={s.icon} size={26} color={th.accent2} /></View>
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <Text style={{ color: P.head, fontSize: 14, fontWeight: '800' }}>{s.title}</Text>
                  <Text style={{ color: P.body, fontSize: 12.5, lineHeight: 18 }}>{s.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </Panel>

        {/* call to action */}
        <LinearGradient colors={[P.blue + (P.dark ? '26' : '14'), th.accent2 + (P.dark ? '26' : '14')]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ borderRadius: 14, borderWidth: 1, borderColor: P.blue + '22', padding: 22, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 22, overflow: 'hidden' }}>
          <AnalogClock now={now} size={76} />
          <View style={{ flex: 1, minWidth: 240, gap: 4 }}>
            <Text style={{ color: P.head, fontSize: 20, fontWeight: '900' }}>Trade the Best Time</Text>
            <Text style={{ color: P.body, fontSize: 13.5, lineHeight: 20, maxWidth: 560 }}>Killzones give you the edge. Use the right time, right tools and better analysis to improve your trading results.</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => go(1, 'ict')} style={((s: any) => ({ borderRadius: 10, opacity: s.hovered ? 0.92 : 1, cursor: 'pointer', shadowColor: P.blue, shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } })) as any}>
            <LinearGradient colors={[P.blue, th.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 50, paddingHorizontal: 28, borderRadius: 10 }}>
              <Icon name="stats-chart" size={16} color="#FFFFFF" /><Text style={{ color: '#FFFFFF', fontSize: 14.5, fontWeight: '700' }}>Open Analysis</Text><Icon name="arrow-forward" size={16} color="#FFFFFF" />
            </LinearGradient>
          </Pressable>
          {w >= 1100 && <CandleArt />}
        </LinearGradient>
      </View>
      <Footer w={w} go={go} />
    </ScrollView>
  );
}
