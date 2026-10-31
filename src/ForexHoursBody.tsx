import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Platform, ScrollView } from 'react-native';
import { useApp } from './store';
import { Icon } from './ui';
import { fxClosedAt } from './session';
import {
  FX_SESSIONS, TZ_CHOICES, sessionState, timelineDay, overlapsAround, volumeAt, fmtClock, fmtDay, fmtLeft, fmtWeekdayClock,
  tzAbbr, utcLabel, weekOpenAfter, weekCloseAfter, axisLabel, zonedToUtc, wallParts, Level,
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


// BabyPips-style table: a header row, then one row per item, hairline dividers, theme colours. Scrolls sideways on a narrow screen.
type Col = { t: string; flex: number; align?: 'left' | 'right' | 'center' };
function Table({ P, cols, rows, min = 560 }: { P: Pal; cols: Col[]; rows: React.ReactNode[][]; min?: number }) {
  return (
    <View style={{ borderRadius: 12, borderWidth: 1, borderColor: P.border, overflow: 'hidden', backgroundColor: P.card }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ flexGrow: 1, minWidth: min }}>
          <View style={{ flexDirection: 'row', backgroundColor: P.alt, borderBottomWidth: 1, borderBottomColor: P.border }}>
            {cols.map((c) => <Text key={c.t} style={{ flex: c.flex, paddingVertical: 11, paddingHorizontal: 14, color: P.body, fontSize: 11.5, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', textAlign: c.align ?? 'left' } as any}>{c.t}</Text>)}
          </View>
          {rows.map((r, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', borderTopWidth: i ? 1 : 0, borderTopColor: P.border }}>
              {r.map((cell, j) => <View key={j} style={{ flex: cols[j].flex, paddingVertical: 12, paddingHorizontal: 14, alignItems: cols[j].align === 'right' ? 'flex-end' : cols[j].align === 'center' ? 'center' : 'flex-start' }}>{typeof cell === 'string' ? <Text style={{ color: P.head, fontSize: 13, fontWeight: '600' }}>{cell}</Text> : cell}</View>)}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
const hd = (P: Pal): any => ({ color: P.body, fontSize: 11.5, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 2 });
const OV_PAIRS: Record<string, string> = { 'london-newyork': 'EUR/USD, GBP/USD, USD/CHF, USD/CAD', 'tokyo-london': 'EUR/JPY, GBP/JPY', 'sydney-tokyo': 'AUD/JPY, NZD/JPY, AUD/USD' };
const BULLETS = [
  'Focus on the busiest sessions: Tokyo, London and New York.',
  'Activity picks up when one of these three centers opens.',
  'The best hours are when two or more sessions are open together.',
  'Match the pair to its home sessions, for example JPY pairs in Tokyo and EUR pairs in London.',
];

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

  const volColor = (l: Level) => (l === 'high' ? th.buy : l === 'medium' ? th.gold + 'B3' : l === 'low' ? P.blue + '40' : P.border);

  const wOpen = weekOpenAfter(t), wClose = weekCloseAfter(t);
  const faq = [
    { q: 'What are the forex market hours?', a: `Forex trades around the clock on weekdays. Retail trading runs from Sunday 5:00 pm to Friday 5:00 pm New York time. In ${where} that is ${fmtWeekdayClock(wOpen, tz, h24)} to ${fmtWeekdayClock(wClose, tz, h24)}.` },
    { q: 'What are the four forex sessions?', a: states.map((x) => `${x.s.city} trades ${fmtClock(zoned(x.s, x.s.open), x.s.tz, false)} to ${fmtClock(zoned(x.s, x.s.close), x.s.tz, false)} local time${x.win ? `, which is ${range(x.win.start, x.win.end)} in ${where}` : ''}.`).join(' ') },
    { q: 'What time does the forex market open and close?', a: `It opens on Sunday at 5:00 pm New York time and closes on Friday at 5:00 pm New York time. In ${where}, the next open is ${fmtWeekdayClock(wOpen, tz, h24)} and the next close is ${fmtWeekdayClock(wClose, tz, h24)}.` },
    { q: 'Why do session times change during the year?', a: 'Each session follows its own city’s working day. When a city moves its clocks for daylight saving, its session shifts by one hour in every other time zone. This page recalculates the times for you.' },
    { q: 'When is the best time to trade forex?', a: 'Usually when two sessions overlap, because more traders are buying and selling. The London and New York overlap is the busiest. Also check that the currencies in your pair have their home session open.' },
    { q: 'Is the market really closed at the weekend?', a: 'Banks and exchanges are shut, so most brokers stop quoting from Friday evening to Sunday evening New York time. Prices can reopen away from Friday’s close, which is called a weekend gap.' },
  ];

  const sectionGap = 20;
  const status = closed ? { c: th.sell, t: 'WEEKEND CLOSED' } : { c: th.buy, t: 'FOREX OPEN' };
  const nextLine = closed ? `Reopens ${fmtWeekdayClock(wOpen, tz, h24)} (in ${fmtLeft((wOpen - t) / 60000)})` : `Weekly close ${fmtWeekdayClock(wClose, tz, h24)} (in ${fmtLeft((wClose - t) / 60000)})`;

  const wide = w >= 820, leftW = wide ? 160 + 200 + 150 : 0;
  const hourMarks = trackW >= 640 ? Array.from({ length: 25 }, (_, h) => h) : [0, 3, 6, 9, 12, 15, 18, 21, 24];
  const utcHrs = (s: typeof FX_SESSIONS[number]) => `${fmtClock(zoned(s, s.open), 'UTC', true)} – ${fmtClock(zoned(s, s.close), 'UTC', true)}`;
  const nowLine = <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: `${nowPos * 100}%`, width: 2, marginLeft: -1, backgroundColor: P.head } as any} />;
  const track = (children: React.ReactNode, h = 40, first = false) => (
    <View onLayout={first ? (e) => setTrackW(e.nativeEvent.layout.width) : undefined} style={{ height: h, borderRadius: 8, backgroundColor: P.alt, borderWidth: 1, borderColor: P.border, overflow: 'hidden' }}>
      {[3, 6, 9, 12, 15, 18, 21].map((hh) => <View key={hh} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(hh / 24) * 100}%`, width: 1, backgroundColor: P.border }} />)}
      {children}{nowLine}
    </View>
  );
  const axis = () => (
    <View style={{ height: 18 }}>
      {hourMarks.map((h) => <Text key={h} style={{ position: 'absolute', top: 2, left: `${(h / 24) * 100}%`, width: 30, marginLeft: h === 0 ? 0 : h === 24 ? -30 : -15, textAlign: h === 0 ? 'left' : h === 24 ? 'right' : 'center', color: P.body, fontSize: 10.5 } as any}>{axisLabel(h, h24)}</Text>)}
    </View>
  );
  const bars = (i: number) => tl.lanes[i].segs.map((sg, j) => {
    const l = tl.lanes[i], px = (sg.to - sg.from) * trackW, fg = txtOn(l.s.color), on = states[i].open;
    return (
      <View key={l.s.key + j} style={{ position: 'absolute', top: 7, height: 24, borderRadius: 6, justifyContent: 'center', paddingHorizontal: 8, overflow: 'hidden', left: `${sg.from * 100}%`, width: `${(sg.to - sg.from) * 100}%`, backgroundColor: l.s.color + (on ? 'FF' : 'B3') } as any}>
        {px >= 118 && <Text numberOfLines={1} style={[{ color: fg, fontSize: 11, fontWeight: '800' }, tab]}>{fmtClock(tl.start + sg.from * tl.span, tz, h24)} – {fmtClock(tl.start + sg.to * tl.span, tz, h24)}</Text>}
      </View>
    );
  });
  const volStrip = <View style={{ flexDirection: 'row', height: '100%' as any, alignItems: 'center' }}>{tl.vol.map((l, i) => <View key={i} style={{ flex: 1, height: 14, backgroundColor: volColor(l) }} />)}</View>;
  const infoCols = w >= 1000;

  return (
    <View style={{ gap: sectionGap }}>
      {/* intro */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 12, backgroundColor: P.soft, borderWidth: 1, borderColor: P.blue + '33' }}>
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: P.blue, alignItems: 'center', justifyContent: 'center' }}><Icon name="information" size={20} color={th.onAccent} /></View>
        <Text style={{ color: P.head, fontSize: 13, lineHeight: 20, flex: 1 }}>When does the forex market open? Use the converter below to see when the four main sessions open and close in your own time zone. Retail forex trades from Sunday evening to Friday evening, New York time.</Text>
      </View>

      {/* converter */}
      <Box P={P} style={{ borderColor: closed ? P.border : th.buy + '55' }}>
        <Head P={P} icon="time-outline" title="Forex Market Time Zone Converter" sub={`${ch.id === 'local' ? 'Your time' : ch.label} · ${tzAbbr(t, tz)} (${utcLabel(t, tz)}) · ${dayNow}`} right={<Status color={status.c} text={status.t} />} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }} accessibilityRole={'radiogroup' as any}>
          {choices.map((c) => <Chip key={c.id} P={P} label={c.label} on={c.id === tzId} onPress={() => setTzId(c.id)} />)}
          <View style={{ width: 1, height: 24, backgroundColor: P.border, marginHorizontal: 4 }} />
          <Chip P={P} label="12 hour" on={!h24} onPress={() => setH24(false)} />
          <Chip P={P} label="24 hour" on={h24} onPress={() => setH24(true)} />
        </View>

        {/* session table: one row per city, with its own 24 hour bar */}
        <View style={{ borderRadius: 12, borderWidth: 1, borderColor: P.border, overflow: 'hidden', backgroundColor: P.card }} accessible accessibilityLabel={`Forex sessions today in ${where}. Open now: ${openNames.join(', ') || 'none'}.`}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', backgroundColor: P.alt, borderBottomWidth: 1, borderBottomColor: P.border, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8, gap: 14 }}>
            {wide && <><Text style={[hd(P), { width: 160 - 14 }]}>Session</Text><Text style={[hd(P), { width: 200 - 14 }]}>Local time</Text><Text style={[hd(P), { width: 150 - 14 }]}>Status</Text></>}
            <View style={{ flex: 1, minWidth: 0 }}><Text style={hd(P)}>{wide ? '' : 'Sessions · '}24 hour timeline in {where}</Text>{axis()}</View>
          </View>
          {states.map((x, i) => {
            const s = x.s;
            const info = (
              <>
                <View style={{ width: wide ? 160 - 14 : undefined, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 4, height: 34, borderRadius: 2, backgroundColor: s.color }} />
                  <View><Text style={{ color: P.head, fontSize: 15, fontWeight: '800' }}>{s.city}</Text><Text style={{ color: P.body, fontSize: 11.5 }}>{s.pairs}</Text></View>
                </View>
                <View style={{ width: wide ? 200 - 14 : undefined }}>
                  <Text style={[{ color: P.head, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }, tab]}>{fmtClock(t, s.tz, h24)}</Text>
                  <Text style={{ color: P.body, fontSize: 11.5 }}>{fmtDay(t, s.tz)} · {tzAbbr(t, s.tz)} ({utcLabel(t, s.tz)})</Text>
                </View>
                <View style={{ width: wide ? 150 - 14 : undefined, gap: 3, alignItems: 'flex-start' }}>
                  <Status color={x.open ? th.buy : P.body} text={x.open ? 'Session open' : 'Session closed'} />
                  <Text style={{ color: x.open ? th.buy : P.blue, fontSize: 11.5, fontWeight: '700' }}>{x.open ? `Closes in ${fmtLeft(x.minsLeft)}` : x.nextOpen ? `Opens in ${fmtLeft(x.minsLeft)}` : 'Closed'}</Text>
                </View>
              </>
            );
            return (
              <View key={s.key} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: P.border, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: x.open ? s.color + '10' : 'transparent', flexDirection: wide ? 'row' : 'column', alignItems: wide ? 'center' : 'stretch', gap: wide ? 14 : 10 }}>
                {wide ? info : <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>{info}</View>}
                <View style={{ flex: wide ? 1 : undefined, minWidth: 0 }}>{track(bars(i), 40, i === 0)}</View>
              </View>
            );
          })}
          <View style={{ borderTopWidth: 1, borderTopColor: P.border, backgroundColor: P.alt, paddingHorizontal: 14, paddingVertical: 10, flexDirection: wide ? 'row' : 'column', alignItems: wide ? 'center' : 'stretch', gap: wide ? 14 : 8 }}>
            <View style={{ width: wide ? leftW - 14 : undefined, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ color: P.head, fontSize: 13.5, fontWeight: '800' }}>Trading volume</Text>
              <Status color={vol === 'high' ? th.buy : vol === 'medium' ? th.gold : vol === 'low' ? P.blue : P.body} text={LEVEL_NAME[vol]} />
              <Text style={[{ color: P.body, fontSize: 12 }, tab]}>{fmtWeekdayClock(t, tz, h24)}</Text>
            </View>
            <View style={{ flex: wide ? 1 : undefined, minWidth: 0 }}>{track(volStrip, 26)}</View>
          </View>
        </View>
        <Text style={{ color: P.body, fontSize: 12.5, lineHeight: 19 }}>{LEVEL_TEXT[vol]} {nextLine}. The dark line is now. Bars are each city’s local working day, so they shift by an hour when daylight saving changes. Volume is a typical daily pattern, not a live feed.</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
          <Text style={{ color: P.body, fontSize: 11.5 }}>Volume:</Text>
          {(['low', 'medium', 'high'] as Level[]).map((l) => <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: volColor(l) }} /><Text style={{ color: P.body, fontSize: 11.5 }}>{LEVEL_NAME[l]}</Text></View>)}
        </View>
      </Box>

      {/* forex trading sessions */}
      <Box P={P}>
        <Head P={P} icon="calendar-outline" title="Forex Trading Sessions" sub="Four sessions, named after the big financial centers." />
        <Text style={{ color: P.body, fontSize: 13.5, lineHeight: 21 }}>You can trade forex at any hour on a weekday, but that does not mean every hour is a good one. The best moments are when many traders are buying and selling at once, because that is when spreads are tight and orders fill cleanly. The sessions follow the local working day of each city.</Text>
        <Table P={P} cols={[{ t: 'Session', flex: 1.1 }, { t: 'Local hours', flex: 1.2 }, { t: 'UTC', flex: 1.2 }, { t: `In ${where}`, flex: 1.4 }, { t: 'Main currencies', flex: 1.1 }]}
          rows={states.map((x) => [
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: x.s.color }} /><Text style={{ color: P.head, fontSize: 13.5, fontWeight: '800' }}>{x.s.city}</Text></View>,
            <Text style={[{ color: P.head, fontSize: 13 }, tab]}>{fmtClock(zoned(x.s, x.s.open), x.s.tz, h24)} – {fmtClock(zoned(x.s, x.s.close), x.s.tz, h24)}</Text>,
            <Text style={[{ color: P.head, fontSize: 13 }, tab]}>{utcHrs(x.s)}</Text>,
            <Text style={[{ color: P.blue, fontSize: 13, fontWeight: '700' }, tab]}>{x.win ? range(x.nextOpen && !x.open ? x.nextOpen : x.win.start, x.win.end) : '—'}</Text>,
            x.s.pairs,
          ])} min={640} />
      </Box>

      {/* volume + best times */}
      <View style={{ flexDirection: infoCols ? 'row' : 'column', alignItems: 'flex-start', gap: sectionGap }}>
        <Box P={P} style={{ flex: infoCols ? 1 : undefined, width: infoCols ? undefined : '100%', minWidth: 0 }}>
          <Head P={P} icon="bar-chart-outline" title="Forex Trading Volume" sub="Why the hour you trade matters." />
          <Text style={{ color: P.body, fontSize: 13.5, lineHeight: 21 }}>Price can only move when trades happen. A quiet market gives you wide spreads and little movement, while a busy one gives tighter spreads and less slippage. More traders trading means more volume, and more volume usually means better execution.</Text>
          <Text style={{ color: P.body, fontSize: 13.5, lineHeight: 21 }}>On weekdays at least one session is always open, but there are thin periods when only one center is trading. The highest volume of the day comes when London and New York overlap, because those two centers carry more than half of all trading.</Text>
        </Box>
        <Box P={P} style={{ flex: infoCols ? 1 : undefined, width: infoCols ? undefined : '100%', minWidth: 0, backgroundColor: P.dark ? th.panel : th.accent2 + '0A' }}>
          <Head P={P} icon="book-outline" title="How to Use the Converter" sub="Four steps from time zone to trade."
            right={onGuide ? <Pressable onPress={onGuide} accessibilityRole="link" style={((s: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: s.hovered ? 0.8 : 1, ...hand })) as any}><Text style={{ color: P.blue, fontSize: 13, fontWeight: '700' }}>View Full Guide</Text><Icon name="arrow-forward" size={14} color={P.blue} /></Pressable> : undefined} />
          <View style={{ gap: 10 }}>
            {STEPS.map((s, i) => (
              <View key={s.title} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: P.border, backgroundColor: P.card }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: th.accent2 + '1A', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: th.accent2, fontSize: 14, fontWeight: '900' }}>{i + 1}</Text></View>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}><Text style={{ color: P.head, fontSize: 14, fontWeight: '800' }}>{s.title}</Text><Text style={{ color: P.body, fontSize: 12.5, lineHeight: 18 }}>{s.body}</Text></View>
              </View>
            ))}
          </View>
        </Box>
      </View>

      <Box P={P}>
        <Head P={P} icon="layers-outline" title="When Is the Best Time to Trade Forex?" sub="Sessions overlap, and overlaps are the busy hours." />
        <Table P={P} cols={[{ t: 'Overlap', flex: 1.3 }, { t: `When in ${where}`, flex: 1.6 }, { t: 'Volume', flex: 1 }, { t: 'Busiest pairs', flex: 1.5 }]}
          rows={ovs.map((o) => {
            const key = `${o.a.key}-${o.b.key}`, info = OVERLAP_INFO[key], live = t >= o.start && t < o.end && !closed, hi = o.a.key === 'london';
            return [
              <View style={{ gap: 4, alignItems: 'flex-start' }}><Text style={{ color: P.head, fontSize: 13.5, fontWeight: '800' }}>{info.name}</Text>{live && <Status color={th.buy} text="LIVE NOW" />}</View>,
              <Text style={[{ color: P.blue, fontSize: 13, fontWeight: '700' }, tab]}>{range(o.start, o.end)}</Text>,
              <Status color={hi ? th.buy : th.gold} text={info.tag} />,
              OV_PAIRS[key],
            ];
          })} min={640} />
        <Text style={{ color: P.body, fontSize: 13.5, lineHeight: 21 }}>The right hours also depend on the pair. A pair trades most when both of its currencies’ home sessions are open: AUD/JPY when Sydney and Tokyo overlap, and EUR/USD when London and New York overlap.</Text>
        <View style={{ gap: 8 }}>
          {BULLETS.map((b) => <View key={b} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: P.blue, marginTop: 8 }} /><Text style={{ flex: 1, color: P.head, fontSize: 13.5, lineHeight: 21 }}>{b}</Text></View>)}
        </View>
      </Box>

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
