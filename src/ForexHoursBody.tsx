import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { useApp } from './store';
import { Icon } from './ui';
import { fxClosedAt } from './session';
import {
  FX_SESSIONS, TZ_CHOICES, sessionState, timelineDay, overlapsAround, volumeAt, fmtClock, fmtDay, fmtLeft, fmtWeekdayClock,
  tzAbbr, utcLabel, weekOpenAfter, weekCloseAfter, axisLabel, zonedToUtc, wallParts, Level, Win,
} from './forexHours';

// Forex Market Hours: time zone converter (live session cards + 24 hour timeline), best overlaps, how to use, FAQ and a call to action.
// One body for the website and the phone. It only needs the window width and a callback to open the Analysis page.
// All times come from src/forexHours.ts, so they follow every city's daylight saving by themselves.

const WEB = Platform.OS === 'web';
const hand: any = WEB ? { cursor: 'pointer' } : null;
const tab: any = { fontVariant: ['tabular-nums'] };

// same palette rules as the other website pages (usePal in DesktopHome.web.tsx), kept here so the phone can use it too
function useFxPal() {
  const { th } = useApp();
  const d = th.dark;
  return {
    th, dark: d,
    alt: d ? th.panel2 : '#F5F8FE', card: d ? th.panel : '#FFFFFF', border: d ? th.line : '#E5EBF5',
    head: d ? th.text : '#0B1B3F', body: d ? th.dim : '#5A6B89',
    blue: th.accent, soft: th.accent + (d ? '26' : '14'), shadow: d ? '#000000' : '#1B3A7A',
  };
}
type Pal = ReturnType<typeof useFxPal>;

const lum = (h: string) => { const n = parseInt(h.slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255].map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }).reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0); };
const txtOn = (bg: string) => { const l = lum(bg), w = 1.05 / (l + 0.05), k = (l + 0.05) / (lum('#0B1220') + 0.05); return w >= k ? '#FFFFFF' : '#0B1220'; };

const LEVEL_TEXT: Record<Level, string> = { closed: 'The market is closed for the weekend.', low: 'Trading volume is usually low at this time of day.', medium: 'Trading volume is usually moderate at this time of day.', high: 'Trading volume is usually at its highest at this time of day.' };
const LEVEL_NAME: Record<Level, string> = { closed: 'Closed', low: 'Low', medium: 'Moderate', high: 'High' };

function Box({ P, children, style }: { P: Pal; children: React.ReactNode; style?: any }) {
  return <View style={[{ backgroundColor: P.card, borderRadius: 14, borderWidth: 1, borderColor: P.border, padding: 20, gap: 16, shadowColor: P.shadow, shadowOpacity: P.dark ? 0.3 : 0.07, shadowRadius: 22, shadowOffset: { width: 0, height: 8 } }, style]}>{children}</View>;
}
function Head({ P, icon, title, sub, right }: { P: Pal; icon: string; title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1, minWidth: 220 }}>
        <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: P.soft, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={20} color={P.blue} /></View>
        <View style={{ flexShrink: 1 }}>
          <Text accessibilityRole="header" style={{ color: P.head, fontSize: 16, fontWeight: '800' }}>{title}</Text>
          {!!sub && <Text style={{ color: P.body, fontSize: 12.5, lineHeight: 18, marginTop: 1 }}>{sub}</Text>}
        </View>
      </View>
      {right}
    </View>
  );
}
function Chip({ P, label, on, onPress, kind = 'radio' }: { P: Pal; label: string; on: boolean; onPress: () => void; kind?: 'radio' | 'button' }) {
  return (
    <Pressable onPress={onPress} accessibilityRole={kind as any} accessibilityState={{ selected: on, checked: on }}
      style={((s: any) => ({ height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center', borderWidth: 1, borderColor: on ? P.blue : P.border, backgroundColor: on ? P.blue : s.hovered ? P.soft : P.alt, ...hand })) as any}>
      <Text style={{ color: on ? P.th.onAccent : P.head, fontSize: 13, fontWeight: on ? '800' : '600' }}>{label}</Text>
    </Pressable>
  );
}
function Status({ color, text }: { color: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 24, borderRadius: 12, backgroundColor: color + '1F', borderWidth: 1, borderColor: color + '55' }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ color, fontSize: 11.5, fontWeight: '800' }}>{text}</Text>
    </View>
  );
}

const STEPS = [
  { icon: 'globe-outline', title: 'Pick your time zone', body: 'Choose My time zone or any city. Every time on this page changes with it.' },
  { icon: 'radio-outline', title: 'See what is open', body: 'The cards show which sessions are trading and how long until each one opens or closes.' },
  { icon: 'layers-outline', title: 'Find the overlaps', body: 'Look for hours where two bars sit on top of each other. Those are the busiest hours.' },
  { icon: 'swap-horizontal-outline', title: 'Match your pair', body: 'Trade a currency while its home session is open: JPY in Tokyo, EUR and GBP in London, USD and CAD in New York.' },
];
const OVERLAP_INFO: Record<string, { name: string; tag: string; body: string }> = {
  'london-newyork': { name: 'London and New York', tag: 'Highest volume', body: 'The busiest hours of the day. EUR/USD, GBP/USD, USD/CHF and USD/CAD usually have the tightest spreads and the biggest moves.' },
  'tokyo-london': { name: 'Tokyo and London', tag: 'Moderate', body: 'A short hand-over from Asia to Europe. Yen crosses such as EUR/JPY and GBP/JPY can pick up speed.' },
  'sydney-tokyo': { name: 'Sydney and Tokyo', tag: 'Moderate', body: 'Quiet but steady. AUD/JPY, NZD/JPY and AUD/USD are the most active pairs; majors like EUR/USD often stay slow.' },
};

export default function ForexHoursBody({ active, w, onAnalysis, onGuide }: { active: boolean; w: number; onAnalysis: (method?: string) => void; onGuide?: () => void }) {
  const P = useFxPal(), th = P.th;
  const [tzId, setTzId] = useState('local');
  const [h24, setH24] = useState(false);
  const [open, setOpen] = useState(0);
  const [now, setNow] = useState(new Date());
  const [trackW, setTrackW] = useState(0);
  useEffect(() => { if (!active) return; setNow(new Date()); const i = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(i); }, [active]);

  const choices = useMemo(() => TZ_CHOICES(), []);
  const ch = choices.find((c) => c.id === tzId) ?? choices[0], tz = ch.tz, t = now.getTime(), minute = Math.floor(t / 60000);
  const where = ch.id === 'local' ? 'your time' : ch.label;
  const closed = fxClosedAt(now);

  // heavier parts are rebuilt once a minute, the clocks and countdowns every second
  const tl = useMemo(() => timelineDay(tz, new Date(minute * 60000)), [tz, minute]);
  const ovs = useMemo(() => overlapsAround(new Date(minute * 60000)), [minute]);
  const vol = useMemo(() => volumeAt(minute * 60000), [minute]);
  const states = FX_SESSIONS.map((s) => sessionState(s, now));
  const openNames = states.filter((x) => x.open).map((x) => x.s.city);
  const nowPos = Math.min(1, Math.max(0, (t - tl.start) / tl.span));

  const dayNow = fmtDay(t, tz);
  const range = (a: number, b: number) => { const wd = (x: number) => (fmtDay(x, tz) !== dayNow ? new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(new Date(x)) + ' ' : ''); return `${wd(a)}${fmtClock(a, tz, h24)} – ${wd(b)}${fmtClock(b, tz, h24)}`; };
  const rangeIn = (win: Win, zone: string) => `${fmtClock(win.start, zone, h24)} – ${fmtClock(win.end, zone, h24)}`;

  const cols4 = w >= 1100, cols2 = w >= 640, twoCols = w >= 1000;
  const labelW = w >= 420 ? 78 : 62;
  const bands: { from: number; to: number; hi: boolean }[] = [];
  tl.lanes.forEach((a, i) => tl.lanes.slice(i + 1).forEach((b) => a.segs.forEach((x) => b.segs.forEach((y) => {
    const from = Math.max(x.from, y.from), to = Math.min(x.to, y.to);
    if (to - from > 0.0005) bands.push({ from, to, hi: [a.s.key, b.s.key].sort().join() === 'london,newyork' });
  }))));
  const bubble = Math.min(Math.max(trackW * nowPos - 34, 0), Math.max(trackW - 68, 0));
  const volColor = (l: Level) => (l === 'high' ? th.buy : l === 'medium' ? th.gold + 'B3' : l === 'low' ? P.blue + '40' : P.border);

  const wOpen = weekOpenAfter(t), wClose = weekCloseAfter(t);
  const faq = [
    { q: 'What are the forex market hours?', a: `Forex trades around the clock on weekdays. Retail trading runs from Sunday 5:00 pm to Friday 5:00 pm New York time. In ${where} that is ${fmtWeekdayClock(wOpen, tz, h24)} to ${fmtWeekdayClock(wClose, tz, h24)}.` },
    { q: 'What are the four forex sessions?', a: states.map((x) => `${x.s.city} trades ${fmtClock(zoned(x.s, x.s.open), x.s.tz, false)} to ${fmtClock(zoned(x.s, x.s.close), x.s.tz, false)} local time${x.win ? `, which is ${range(x.win.start, x.win.end)} in ${where}` : ''}.`).join(' ') },
    { q: 'Why do session times change during the year?', a: 'Each session follows its own city’s working day. When a city moves its clocks for daylight saving, its session shifts by one hour in every other time zone. This page recalculates the times for you.' },
    { q: 'When is the best time to trade forex?', a: 'Usually when two sessions overlap, because more traders are buying and selling. The London and New York overlap is the busiest. Also check that the currencies in your pair have their home session open.' },
    { q: 'Is the market really closed at the weekend?', a: 'Banks and exchanges are shut, so most brokers stop quoting from Friday evening to Sunday evening New York time. Prices can reopen away from Friday’s close, which is called a weekend gap.' },
  ];

  const sectionGap = 20;
  const status = closed ? { c: th.sell, t: 'WEEKEND CLOSED' } : { c: th.buy, t: 'FOREX OPEN' };
  const nextLine = closed ? `Reopens ${fmtWeekdayClock(wOpen, tz, h24)} (in ${fmtLeft((wOpen - t) / 60000)})` : `Weekly close ${fmtWeekdayClock(wClose, tz, h24)} (in ${fmtLeft((wClose - t) / 60000)})`;

  return (
    <View style={{ gap: sectionGap }}>
      {/* intro */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 12, backgroundColor: P.soft, borderWidth: 1, borderColor: P.blue + '33' }}>
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: P.blue, alignItems: 'center', justifyContent: 'center' }}><Icon name="information" size={20} color={th.onAccent} /></View>
        <Text style={{ color: P.head, fontSize: 13, lineHeight: 20, flex: 1 }}>Forex trades around the clock from Sunday evening to Friday evening, New York time. Not every hour is equal: spreads are tighter and prices move more while several financial centers are open together. Pick your time zone to see when that happens for you.</Text>
      </View>

      {/* converter */}
      <Box P={P} style={{ borderColor: closed ? P.border : th.buy + '55' }}>
        <Head P={P} icon="time-outline" title="Forex Market Time Zone Converter" sub="Open and close times of the four sessions in the time zone you choose." right={<Status color={status.c} text={status.t} />} />

        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole={'radiogroup' as any}>
            {choices.map((c) => <Chip key={c.id} P={P} label={c.label} on={c.id === tzId} onPress={() => setTzId(c.id)} />)}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }} accessibilityRole={'radiogroup' as any}>
            <Chip P={P} label="12 hour" on={!h24} onPress={() => setH24(false)} />
            <Chip P={P} label="24 hour" on={h24} onPress={() => setH24(true)} />
          </View>
        </View>

        {/* now */}
        <View style={{ borderRadius: 14, borderWidth: 1, borderColor: P.border, backgroundColor: P.dark ? th.panel2 : '#F8FAFF', padding: 18, gap: 12, flexDirection: w >= 760 ? 'row' : 'column', alignItems: w >= 760 ? 'center' : 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ gap: 2 }}>
            <Text style={{ color: P.body, fontSize: 12.5 }}>{ch.id === 'local' ? 'Your time' : ch.label} · {tzAbbr(t, tz)} ({utcLabel(t, tz)})</Text>
            <Text style={[{ color: P.head, fontSize: w >= 700 ? 38 : 30, fontWeight: '900', letterSpacing: -1 }, tab]}>{fmtClock(t, tz, h24, true)}</Text>
            <Text style={{ color: P.body, fontSize: 13 }}>{dayNow}</Text>
          </View>
          <View style={{ gap: 8, flexShrink: 1, maxWidth: 520 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: P.head, fontSize: 13.5, fontWeight: '800' }}>{closed ? 'No session is open' : openNames.length ? `Open now: ${openNames.join(', ')}` : 'Between sessions'}</Text>
              <Status color={vol === 'high' ? th.buy : vol === 'medium' ? th.gold : vol === 'low' ? P.blue : P.body} text={`Volume: ${LEVEL_NAME[vol]}`} />
            </View>
            <Text style={{ color: P.body, fontSize: 13, lineHeight: 19 }}>{LEVEL_TEXT[vol]}</Text>
            <Text style={{ color: P.blue, fontSize: 13, fontWeight: '700' }}>{nextLine}</Text>
          </View>
        </View>

        {/* session cards */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {states.map((x) => {
            const s = x.s;
            return (
              <View key={s.key} style={{ flexGrow: 1, flexBasis: cols4 ? '23%' : cols2 ? '47%' : '100%', minWidth: 0, flexDirection: 'row', borderRadius: 12, borderWidth: 1, borderColor: x.open ? s.color + '99' : P.border, backgroundColor: x.open ? s.color + '14' : P.card, overflow: 'hidden' }}>
                <View style={{ width: 5, backgroundColor: s.color }} />
                <View style={{ flex: 1, padding: 14, gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <Text style={{ color: P.head, fontSize: 14.5, fontWeight: '800' }}>{s.city}</Text>
                    <Status color={x.open ? th.buy : P.body} text={x.open ? 'OPEN' : 'CLOSED'} />
                  </View>
                  <Text style={[{ color: P.head, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 }, tab]}>{fmtClock(t, s.tz, h24)}</Text>
                  <Text style={{ color: P.body, fontSize: 12 }}>{fmtDay(t, s.tz)} · {tzAbbr(t, s.tz)} ({utcLabel(t, s.tz)})</Text>
                  <Text style={{ color: x.open ? th.buy : P.blue, fontSize: 12.5, fontWeight: '700', marginTop: 4 }}>{x.open ? `Closes in ${fmtLeft(x.minsLeft)}` : x.nextOpen ? `Opens in ${fmtLeft(x.minsLeft)}` : 'Closed'}</Text>
                  {!!x.win && <Text style={[{ color: P.body, fontSize: 12 }, tab]}>{x.open ? 'Today' : 'Next'} in {where}: {range(x.nextOpen && !x.open ? x.nextOpen : x.win.start, x.win.end)}</Text>}
                  <Text style={{ color: P.body, fontSize: 11.5, opacity: 0.85 }}>Local hours {fmtClock(zoned(s, s.open), s.tz, h24)} – {fmtClock(zoned(s, s.close), s.tz, h24)} · {s.pairs}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* 24 hour timeline */}
        <View style={{ gap: 8 }}>
          <Text style={{ color: P.head, fontSize: 14, fontWeight: '800' }}>Today in {where}</Text>
          <View accessible accessibilityLabel={`Timeline of the four forex sessions for today in ${where}. Open now: ${openNames.join(', ') || 'none'}.`} style={{ flexDirection: 'row', direction: 'ltr' } as any}>
            <View style={{ width: labelW, paddingTop: 22 }}>
              {FX_SESSIONS.map((s) => <View key={s.key} style={{ height: 28, justifyContent: 'center' }}><Text style={{ color: P.head, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>{s.city}</Text></View>)}
              <View style={{ height: 22, justifyContent: 'center' }}><Text style={{ color: P.body, fontSize: 11.5 }}>Volume</Text></View>
            </View>
            <View style={{ flex: 1, minWidth: 0 }} onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}>
              <View style={{ height: 22 }}>
                {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h, i) => (
                  <Text key={h} style={{ position: 'absolute', top: 4, left: `${(i / 8) * 100}%`, width: 30, marginLeft: i === 0 ? 0 : i === 8 ? -30 : -15, textAlign: i === 0 ? 'left' : i === 8 ? 'right' : 'center', color: P.body, fontSize: 10.5 } as any}>{axisLabel(h, h24)}</Text>
                ))}
              </View>
              <View style={{ height: 4 * 28 + 8 + 22, borderRadius: 8, backgroundColor: P.alt, borderWidth: 1, borderColor: P.border, overflow: 'hidden' }}>
                {[1, 2, 3, 4, 5, 6, 7].map((i) => <View key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(i / 8) * 100}%`, width: 1, backgroundColor: P.border }} />)}
                {bands.map((b, i) => <View key={i} style={{ position: 'absolute', top: 0, height: 4 * 28, left: `${b.from * 100}%`, width: `${(b.to - b.from) * 100}%`, backgroundColor: b.hi ? th.buy + '2E' : P.blue + '1A' } as any} />)}
                {tl.lanes.map((l, i) => {
                  const on = states[i].open, fg = txtOn(l.s.color);
                  return l.segs.map((sg, j) => {
                    const px = (sg.to - sg.from) * trackW;
                    return (
                      <View key={l.s.key + j} style={{ position: 'absolute', top: i * 28 + 5, height: 18, borderRadius: 6, justifyContent: 'center', paddingHorizontal: 6, overflow: 'hidden', left: `${sg.from * 100}%`, width: `${(sg.to - sg.from) * 100}%`, backgroundColor: l.s.color + (on ? 'FF' : 'B3') } as any}>
                        {px >= 118 && <Text numberOfLines={1} style={[{ color: fg, fontSize: 10.5, fontWeight: '800' }, tab]}>{fmtClock(tl.start + sg.from * tl.span, tz, h24)} – {fmtClock(tl.start + sg.to * tl.span, tz, h24)}</Text>}
                      </View>
                    );
                  });
                })}
                <View style={{ position: 'absolute', top: 4 * 28 + 8, left: 0, right: 0, height: 22, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 0 }}>
                  {tl.vol.map((l, i) => <View key={i} style={{ flex: 1, height: 12, backgroundColor: volColor(l) }} />)}
                </View>
                <View style={{ position: 'absolute', top: 0, bottom: 0, left: `${nowPos * 100}%`, width: 2, marginLeft: -1, backgroundColor: P.head } as any} />
              </View>
              <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: bubble, width: 68, height: 18, borderRadius: 9, backgroundColor: P.head, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={[{ color: P.dark ? th.bg : '#FFFFFF', fontSize: 10.5, fontWeight: '800' }, tab]}>{fmtClock(t, tz, h24)}</Text>
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
            {FX_SESSIONS.map((s) => <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: s.color }} /><Text style={{ color: P.body, fontSize: 11.5 }}>{s.city}</Text></View>)}
            <Text style={{ color: P.body, fontSize: 11.5 }}>Volume:</Text>
            {(['low', 'medium', 'high'] as Level[]).map((l) => <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: volColor(l) }} /><Text style={{ color: P.body, fontSize: 11.5 }}>{LEVEL_NAME[l]}</Text></View>)}
          </View>
          <Text style={{ color: P.body, fontSize: 12, lineHeight: 17 }}>The dark line is now. Shaded bands are overlaps; the green band is London and New York. Volume is a typical pattern, not a live feed. Sessions follow each city’s own working day, so they move by one hour when daylight saving changes.</Text>
        </View>
      </Box>

      {/* overlaps + steps */}
      <View style={{ flexDirection: twoCols ? 'row' : 'column', alignItems: 'flex-start', gap: sectionGap }}>
        <Box P={P} style={{ flex: twoCols ? 1 : undefined, width: twoCols ? undefined : '100%', minWidth: 0 }}>
          <Head P={P} icon="layers-outline" title="Best Times to Trade" sub="Busy hours are when two sessions are open together." />
          <View style={{ gap: 10 }}>
            {ovs.map((o) => {
              const info = OVERLAP_INFO[`${o.a.key}-${o.b.key}`], live = t >= o.start && t < o.end && !closed, hi = o.a.key === 'london';
              return (
                <View key={o.a.key + o.b.key} style={{ borderRadius: 12, borderWidth: 1, borderColor: live ? th.buy + '88' : P.border, backgroundColor: live ? th.buy + '12' : P.card, padding: 14, gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <Text style={{ color: P.head, fontSize: 14, fontWeight: '800' }}>{info.name}</Text>
                    <Status color={hi ? th.buy : th.gold} text={info.tag} />
                    {live && <Status color={th.buy} text="LIVE NOW" />}
                  </View>
                  <Text style={[{ color: P.blue, fontSize: 13, fontWeight: '700' }, tab]}>{range(o.start, o.end)} in {where}</Text>
                  <Text style={{ color: P.body, fontSize: 12.5, lineHeight: 18 }}>{info.body}</Text>
                </View>
              );
            })}
          </View>
        </Box>

        <Box P={P} style={{ flex: twoCols ? 1 : undefined, width: twoCols ? undefined : '100%', minWidth: 0, backgroundColor: P.dark ? th.panel : th.accent2 + '0A' }}>
          <Head P={P} icon="book-outline" title="How to Use This Page" sub="Four steps from time zone to trade."
            right={onGuide ? <Pressable onPress={onGuide} accessibilityRole="link" style={((s: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: s.hovered ? 0.8 : 1, ...hand })) as any}><Text style={{ color: P.blue, fontSize: 13, fontWeight: '700' }}>View Full Guide</Text><Icon name="arrow-forward" size={14} color={P.blue} /></Pressable> : undefined} />
          <View style={{ gap: 10 }}>
            {STEPS.map((s, i) => (
              <View key={s.title} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: P.border, backgroundColor: P.card }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: th.accent2 + '1A', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={s.icon} size={22} color={th.accent2} />
                  <View style={{ position: 'absolute', top: -4, left: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: th.accent2, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>{i + 1}</Text></View>
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={{ color: P.head, fontSize: 14, fontWeight: '800' }}>{s.title}</Text>
                  <Text style={{ color: P.body, fontSize: 12.5, lineHeight: 18 }}>{s.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </Box>
      </View>

      {/* FAQ */}
      <Box P={P}>
        <Head P={P} icon="help-circle-outline" title="Forex Market Hours FAQ" sub="Answers use the time zone you picked above." />
        <View style={{ gap: 8 }}>
          {faq.map((f, i) => {
            const on = open === i;
            return (
              <View key={f.q} style={{ borderRadius: 12, borderWidth: 1, borderColor: on ? P.blue + '66' : P.border, backgroundColor: on ? P.soft : P.card, overflow: 'hidden' }}>
                <Pressable onPress={() => setOpen(on ? -1 : i)} accessibilityRole="button" accessibilityState={{ expanded: on }} style={((s: any) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 14, opacity: s.hovered ? 0.9 : 1, ...hand })) as any}>
                  <Text style={{ color: P.head, fontSize: 14, fontWeight: '700', flex: 1 }}>{f.q}</Text>
                  <Icon name={on ? 'chevron-up' : 'chevron-down'} size={18} color={P.blue} />
                </Pressable>
                {on && <Text style={{ color: P.body, fontSize: 13, lineHeight: 20, paddingHorizontal: 14, paddingBottom: 14 }}>{f.a}</Text>}
              </View>
            );
          })}
        </View>
      </Box>

      {/* call to action */}
      <View style={{ borderRadius: 14, borderWidth: 1, borderColor: P.blue + '22', backgroundColor: P.blue + (P.dark ? '26' : '14'), padding: 22, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 18 }}>
        <View style={{ flex: 1, minWidth: 240, gap: 4 }}>
          <Text style={{ color: P.head, fontSize: 20, fontWeight: '900' }}>Trade when the market is moving</Text>
          <Text style={{ color: P.body, fontSize: 13.5, lineHeight: 20, maxWidth: 560 }}>Pick the hours that suit you, then analyze a pair from a session that is open. Looking for ICT killzones? They are part of the ICT analysis.</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Pressable accessibilityRole="button" onPress={() => onAnalysis()} style={((s: any) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 48, paddingHorizontal: 24, borderRadius: 10, backgroundColor: P.blue, opacity: s.hovered ? 0.92 : 1, ...hand })) as any}>
            <Icon name="stats-chart" size={16} color={th.onAccent} /><Text style={{ color: th.onAccent, fontSize: 14.5, fontWeight: '700' }}>Open Analysis</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => onAnalysis('ict')} style={((s: any) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 48, paddingHorizontal: 22, borderRadius: 10, borderWidth: 1.5, borderColor: P.blue + '66', backgroundColor: s.hovered ? P.soft : 'transparent', ...hand })) as any}>
            <Text style={{ color: P.blue, fontSize: 14.5, fontWeight: '700' }}>ICT Killzones</Text><Icon name="arrow-forward" size={16} color={P.blue} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// a session's opening / closing hour today in its own zone, as a UTC moment (only used to print the local hours)
function zoned(s: { tz: string }, hour: number): number {
  const p = wallParts(s.tz, Date.now());
  return zonedToUtc(s.tz, p.y, p.m, p.d, Math.floor(hour), Math.round((hour % 1) * 60));
}
