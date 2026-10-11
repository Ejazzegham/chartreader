import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from './store';
import { Card, Dim, Body, SectionTitle, Row, Badge, Icon, Btn } from './ui';
import { ScoreRing } from './ProUI';
import { ICT, ICT_STEPS, ICT_DEFAULTS, IctParams, mergeIct, nextKillzone, nyClock, isEntryWindow } from './ict';
import { ICT_LESSONS, ICT_GLOSSARY, ICT_GUIDE_INTRO } from './ictGuide';

// Panels of the ICT method. They show the "ICT Trading: A to Z" process (src/ict.ts) step by step.

// ---------------------------------------------------------------------------------------------- rule settings (saved on the phone)
const KEY = 'ict_params';
export function useIctParams() {
  const [p, setP] = useState<IctParams>(ICT_DEFAULTS);
  useEffect(() => { AsyncStorage.getItem(KEY).then((v) => { if (v) { try { setP(mergeIct(JSON.parse(v))); } catch {} } }).catch(() => {}); }, []);
  const set = (n: Partial<IctParams>) => setP((o) => { const m = mergeIct({ ...o, ...n }); AsyncStorage.setItem(KEY, JSON.stringify(m)).catch(() => {}); return m; });
  const reset = () => { setP(ICT_DEFAULTS); AsyncStorage.removeItem(KEY).catch(() => {}); };
  return { params: p, set, reset, custom: JSON.stringify(p) !== JSON.stringify(ICT_DEFAULTS) };
}

// ---------------------------------------------------------------------------------------------- the 8 steps as rows
type StepRow = { title: string; ok: boolean | null; text: string };
export function stepRows(ict: ICT): StepRow[] {
  const s = ict.setup;
  if (s) return ICT_STEPS.map((title, i) => ({ title, ok: s.confluence[i].ok, text: s.confluence[i].text }));
  const b = ict.bias, buy = b?.dir === 'bullish', has = !!b && b.dir !== 'none';
  const sweepOk = has && !!ict.sweep && ict.sweep.side === (buy ? 'SSL' : 'BSL');
  return [
    { title: ICT_STEPS[0], ok: has, text: has ? `Bias is ${b!.dir} (${b!.source === 'htf' ? 'higher timeframe' : 'chart only'})` : 'No clear bias: no bias means no trade' },
    { title: ICT_STEPS[1], ok: null, text: 'Checked once an entry zone exists' },
    { title: ICT_STEPS[2], ok: isEntryWindow(ict.killzone), text: ict.killzone ? (ict.killzone.key === 'asia' ? 'Asian range: liquidity is being built, not an entry window' : `Inside ${ict.killzone.name}`) : 'Outside every killzone' },
    { title: ICT_STEPS[3], ok: has ? sweepOk : null, text: has ? (sweepOk ? `${ict.sweep!.label} swept, price closed back` : `No ${buy ? 'sell-side' : 'buy-side'} sweep against the bias yet`) : 'Needs a bias first' },
    { title: ICT_STEPS[4], ok: has ? !!ict.mss && ict.mss.displaced : null, text: has ? (ict.mss ? (ict.mss.displaced ? 'MSS with displacement' : 'Break without displacement: weak') : 'No market structure shift after the sweep yet') : 'Needs a bias first' },
    { title: ICT_STEPS[5], ok: has ? false : null, text: has ? 'No unfilled fair value gap, order block or breaker to enter from yet' : 'Needs a bias first' },
    { title: ICT_STEPS[6], ok: null, text: 'Checked once there is an entry and a stop' },
    { title: ICT_STEPS[7], ok: null, text: 'Checked once there is an entry and a stop' },
  ];
}

export function IctVerdict({ ict, f }: { ict: ICT; f: (n: number) => string }) {
  const { th } = useApp();
  const s = ict.setup, v = ict.verdict ?? 'no-trade';
  const col = v === 'trade' ? th.buy : v === 'wait' ? th.gold : th.sell;
  const label = v === 'trade' ? 'TRADE READY' : v === 'wait' ? 'WAIT' : 'NO TRADE';
  const rows = stepRows(ict), passed = rows.filter((r) => r.ok === true).length;
  return (
    <Card style={{ borderColor: col + '88' }} glow>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <ScoreRing score={s ? s.score : (passed / 8) * 100} color={col} label={s ? s.grade : `${passed}/8`} size={78} />
        <View style={{ flex: 1 }}>
          <Dim>ICT verdict</Dim>
          <Text style={{ color: col, fontSize: 24, fontWeight: '900', letterSpacing: 0.4 }}>{label}</Text>
          {s ? <Text style={{ color: th.text, fontWeight: '700' }}>{s.side === 'buy' ? 'Buy' : 'Sell'} · {s.model}</Text> : <Text style={{ color: th.dim }}>{ict.bias && ict.bias.dir !== 'none' ? `Bias ${ict.bias.dir}` : 'No bias'}</Text>}
        </View>
      </View>
      <View style={{ height: 10 }} />
      <Body color={th.dim}>{ict.next ?? ''}</Body>
      {!!s && s.missing.length > 0 && (
        <View style={{ marginTop: 8, gap: 3 }}>
          {s.missing.map((m, i) => <Text key={i} style={{ color: th.gold, fontSize: 12.5, lineHeight: 18 }}>○ {m}</Text>)}
        </View>
      )}
    </Card>
  );
}

export function IctSteps({ ict }: { ict: ICT }) {
  const { th } = useApp();
  const rows = stepRows(ict);
  return (
    <Card>
      <SectionTitle icon="list-outline">The 8 questions before a trade</SectionTitle>
      <View style={{ height: 10 }} />
      <View style={{ gap: 10 }}>
        {rows.map((r, i) => {
          const c = r.ok === true ? th.buy : r.ok === false ? th.sell : th.dim;
          return (
            <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c + '22', borderWidth: 1, borderColor: c + '88', alignItems: 'center', justifyContent: 'center' }}>
                {r.ok === true ? <Icon name="checkmark" size={14} color={c} /> : <Text style={{ color: c, fontWeight: '900', fontSize: 12 }}>{r.ok === false ? '✕' : i + 1}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: th.text, fontWeight: '800', fontSize: 13.5 }}>{i + 1}. {r.title}</Text>
                <Text style={{ color: r.ok === null ? th.dim : th.text, fontSize: 12.5, lineHeight: 18 }}>{r.text}</Text>
              </View>
            </View>
          );
        })}
      </View>
      <View style={{ height: 8 }} />
      <Dim>If any answer is no, there is no trade.</Dim>
    </Card>
  );
}

export function IctBiasCard({ ict, htfLabel, f }: { ict: ICT; htfLabel: string; f: (n: number) => string }) {
  const { th } = useApp();
  const b = ict.bias;
  if (!b) return null;
  const col = b.dir === 'bullish' ? th.buy : b.dir === 'bearish' ? th.sell : th.gold;
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <SectionTitle icon="compass-outline">Bias and draw on liquidity</SectionTitle>
        <Badge label={b.source === 'htf' ? htfLabel : 'CHART ONLY'} color={b.source === 'htf' ? th.accent : th.gold} />
      </View>
      <Text style={{ color: col, fontSize: 22, fontWeight: '900', marginTop: 8, textTransform: 'capitalize' }}>{b.dir === 'none' ? 'No clear bias' : b.dir}</Text>
      {b.source === 'ltf' && <Text style={{ color: th.gold, fontSize: 12.5, lineHeight: 18, marginTop: 2 }}>The higher timeframe is still loading or unavailable, so this bias is read from the chart only.</Text>}
      <View style={{ height: 8 }} />
      {b.reasons.map((r, i) => <Body key={i} color={th.dim}>• {r}</Body>)}
      <View style={{ height: 8 }} />
      {b.draw ? <Row k="Draw on liquidity" v={`${b.draw.label} ${f(b.draw.price)}`} color={b.draw.side === 'BSL' ? th.buy : th.sell} /> : <Row k="Draw on liquidity" v="none in range" />}
      {ict.leg && <Row k="Leg (for OTE)" v={`${f(ict.leg.low)} → ${f(ict.leg.high)}`} />}
      {ict.ote && <Row k="OTE 62-79%" v={`${f(ict.ote.bottom)} - ${f(ict.ote.top)}`} color={th.gold} />}
      {ict.ote?.sweet !== undefined && <Row k="OTE sweet spot 70.5%" v={f(ict.ote.sweet)} color={th.gold} />}
      {!!ict.notes?.length && <View style={{ marginTop: 6 }}>{ict.notes.map((n, i) => <Dim key={i}>{n}</Dim>)}</View>}
    </Card>
  );
}

export function IctTime({ ict }: { ict: ICT }) {
  const { th } = useApp();
  const [now, setNow] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(i); }, []);
  const ny = nyClock(now), nx = nextKillzone(now), pad = (n: number) => String(n).padStart(2, '0');
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const kz = ict.killzone, on = isEntryWindow(kz);
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <SectionTitle icon="time-outline">Time: killzone</SectionTitle>
        <Badge label={on ? 'LIVE' : 'WAITING'} color={on ? th.buy : th.gold} />
      </View>
      <View style={{ height: 8 }} />
      <Row k="New York time" v={`${days[ny.dow]} ${pad(ny.hour)}:${pad(ny.min)}`} />
      <Row k="Now" v={kz ? kz.name : 'Outside every killzone'} color={on ? th.buy : th.dim} />
      <Row k="Next" v={`${nx.k.name} in ${Math.floor(nx.mins / 60)}h ${pad(nx.mins % 60)}m`} color={th.accent} />
    </Card>
  );
}

export function IctLevels({ ict, f }: { ict: ICT; f: (n: number) => string }) {
  const { th } = useApp();
  const lv = ict.levels ?? [];
  if (!lv.length && !ict.sweep && !ict.mss) return null;
  return (
    <Card>
      <SectionTitle icon="flag-outline">Key levels, sweep and shift</SectionTitle>
      <View style={{ height: 8 }} />
      {lv.map((l) => <Row key={l.key} k={`${l.name}${l.swept ? '  ✓ swept' : ''}`} v={f(l.price)} color={l.swept ? th.dim : l.key === 'MO' ? th.accent2 : l.key.endsWith('H') ? th.buy : l.key.endsWith('L') ? th.sell : th.text} />)}
      {ict.sweep && <Row k={`Last sweep: ${ict.sweep.label}`} v={`${ict.sweep.side === 'SSL' ? 'sell-side' : 'buy-side'} at ${f(ict.sweep.price)}`} color={th.gold} />}
      {ict.mss && <Row k={`MSS ${ict.mss.dir}${ict.mss.displaced ? ' with displacement' : ' (weak)'}`} v={f(ict.mss.level)} color={ict.mss.displaced ? th.accent : th.gold} />}
      {!lv.length && <Dim>Previous day, Asian and London levels appear when the loaded candles cover them.</Dim>}
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------- rule settings
const FIELDS: { k: keyof IctParams; label: string; step: number; dec: number; help: string }[] = [
  { k: 'swingN', label: 'Swing size (candles each side)', step: 1, dec: 0, help: 'A swing high / low must beat this many candles on both sides. 2 to 5.' },
  { k: 'dispMult', label: 'Displacement (x average body)', step: 0.25, dec: 2, help: 'A displacement candle has a body this many times the average and closes near its extreme.' },
  { k: 'eqTol', label: 'Equal highs / lows (ATR)', step: 0.05, dec: 2, help: 'Two swing points this close (in ATR) count as equal highs / lows.' },
  { k: 'sweepWindow', label: 'Sweep closes back within (candles)', step: 1, dec: 0, help: 'After trading beyond a level, price must close back inside within this many candles. 1 to 3.' },
  { k: 'minRR', label: 'Minimum reward : risk (target 2)', step: 0.5, dec: 1, help: 'The guide asks for at least 1:2.' },
  { k: 'maxRiskAtr', label: 'Widest stop (ATR)', step: 0.5, dec: 1, help: 'A wider stop fails the risk check: reduce the size or skip.' },
];
export function IctSettings({ params, set, reset, custom }: ReturnType<typeof useIctParams>) {
  const { th } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable onPress={() => setOpen(!open)}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <SectionTitle icon="options-outline">ICT rules (adjustable)</SectionTitle>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {custom && <Badge label="CUSTOM" color={th.gold} />}
            <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color={th.dim} />
          </View>
        </Card>
      </Pressable>
      {open && (
        <Card style={{ marginTop: 8, gap: 12 }}>
          <Dim>These rules change how the ICT tab reads the chart. Combined analysis and the scanner always use the defaults.</Dim>
          {FIELDS.map((x) => {
            const v = params[x.k];
            const btn = (sign: 1 | -1) => (
              <Pressable onPress={() => set({ [x.k]: Math.round((v + sign * x.step) * 100) / 100 } as Partial<IctParams>)} hitSlop={8} style={{ width: 38, height: 38, borderRadius: 8, borderWidth: 1, borderColor: th.line, backgroundColor: th.panel2, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: th.text, fontSize: 20, fontWeight: '800', marginTop: -2 }}>{sign > 0 ? '+' : '−'}</Text>
              </Pressable>
            );
            return (
              <View key={x.k}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: th.text, fontWeight: '700', fontSize: 13.5 }}>{x.label}</Text>
                    <Text style={{ color: th.dim, fontSize: 11.5, lineHeight: 16 }}>{x.help}</Text>
                  </View>
                  {btn(-1)}
                  <Text style={{ color: th.accent, fontWeight: '900', fontSize: 16, minWidth: 44, textAlign: 'center', fontVariant: ['tabular-nums'] }}>{v.toFixed(x.dec)}</Text>
                  {btn(1)}
                </View>
              </View>
            );
          })}
          <Btn ghost label="Reset to the guide's defaults" icon="refresh" onPress={reset} disabled={!custom} />
        </Card>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------- the A to Z guide
export function IctGuide() {
  const { th } = useApp();
  const [open, setOpen] = useState(false);
  const [lesson, setLesson] = useState<string>('');
  const [gloss, setGloss] = useState(false);
  return (
    <View>
      <Pressable onPress={() => setOpen(!open)}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <SectionTitle icon="school-outline">ICT guide: A to Z</SectionTitle>
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color={th.dim} />
        </Card>
      </Pressable>
      {open && (
        <View style={{ marginTop: 8, gap: 8 }}>
          <Card style={{ borderColor: th.gold + '66' }}><Text style={{ color: th.dim, fontSize: 12.5, lineHeight: 19 }}>{ICT_GUIDE_INTRO}</Text></Card>
          {ICT_LESSONS.map((l) => {
            const on = lesson === l.id;
            return (
              <Card key={l.id} style={{ padding: 0 }}>
                <Pressable onPress={() => setLesson(on ? '' : l.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}>
                  <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: th.accent + '22', alignItems: 'center', justifyContent: 'center' }}><Icon name={l.icon} size={16} color={th.accent} /></View>
                  <Text style={{ flex: 1, color: th.text, fontWeight: '800', fontSize: 14 }}>{l.title}</Text>
                  <Icon name={on ? 'chevron-up' : 'chevron-down'} size={18} color={th.dim} />
                </Pressable>
                {on && (
                  <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 8 }}>
                    {l.blocks.map((b, i) => (
                      <View key={i} style={{ gap: 5 }}>
                        {!!b.h && <Text style={{ color: th.accent, fontWeight: '800', fontSize: 13 }}>{b.h}</Text>}
                        {!!b.p && <Text style={{ color: th.text, fontSize: 13, lineHeight: 20 }}>{b.p}</Text>}
                        {b.list?.map((x, k) => (
                          <View key={k} style={{ flexDirection: 'row', gap: 8 }}>
                            <Text style={{ color: th.accent, fontWeight: '900' }}>•</Text>
                            <Text style={{ flex: 1, color: th.text, fontSize: 13, lineHeight: 20 }}>{x}</Text>
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                )}
              </Card>
            );
          })}
          <Card style={{ padding: 0 }}>
            <Pressable onPress={() => setGloss(!gloss)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}>
              <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: th.accent + '22', alignItems: 'center', justifyContent: 'center' }}><Icon name="book-outline" size={16} color={th.accent} /></View>
              <Text style={{ flex: 1, color: th.text, fontWeight: '800', fontSize: 14 }}>13. A to Z glossary</Text>
              <Icon name={gloss ? 'chevron-up' : 'chevron-down'} size={18} color={th.dim} />
            </Pressable>
            {gloss && (
              <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 8 }}>
                {ICT_GLOSSARY.map(([k, d]) => (
                  <View key={k}>
                    <Text style={{ color: th.text, fontSize: 13, lineHeight: 19 }}><Text style={{ fontWeight: '800', color: th.accent }}>{k}</Text>  {d}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
          <Dim>ICT is a method taught by Michael J. Huddleston (Inner Circle Trader). This guide is a short summary in our own words. His paid courses are his work: learn from him directly.</Dim>
        </View>
      )}
    </View>
  );
}
