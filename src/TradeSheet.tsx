import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import Modal from './Modal';
import { useWindowDimensions } from './win';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TradeChart from './TradeChart';
import { VSA_RULE } from './vsa';
import { useApp } from './store';
import { Btn, Icon } from './ui';
import { Signal, floatR, stopAtBE, money, sourceName } from './trades';
import { fmtLots, parseLots } from './lots';

// What the trader can do with a running trade. Used from the Journal ("Manage") and from the take-profit alarm.
// Taking profit is always the trader's decision: nothing closes by itself except the stop loss.
export function TradeActions({ s, price, onDone }: { s: Signal; price?: number; onDone: () => void }) {
  const { th, t, closeSignal, partialClose, breakEven, ackTp, toast } = useApp();
  const [custom, setCustom] = useState('');
  const f = (n: number) => n.toFixed(s.dec);
  const open = 1 - s.done, lotsOpen = (s.lots ?? 0) * open;
  // Money only (no R): what is still open floats, what the closed shares earned is booked.
  const leftPct = Math.round(open * 100), donePct = Math.round(s.done * 100), booked = s.banked * s.risk;
  const openPnl = price ? open * floatR(s, price) * s.risk : 0, c = openPnl >= 0 ? th.buy : th.sell;
  const beDone = stopAtBE(s);
  const planShare = s.tpAlert && s.plan ? s.plan[s.tpAlert - 1] ?? 0 : 0; // the share the trader chose for the take profit that just rang
  const row = (a: string, b: string, col?: string) => <View key={a} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, paddingVertical: 3 }}><Text style={{ flex: 1, minWidth: 0, color: th.dim, fontSize: 13 }}>{a}</Text><Text style={{ flexShrink: 1, maxWidth: '62%', textAlign: 'right', color: col ?? th.text, fontWeight: '800', fontSize: 13.5 }}>{b}</Text></View>;

  const closeShare = (share: number) => { // share of what is still open
    if (!price) { toast('No live price yet.', 'bad'); return; }
    partialClose(s.id, price, open * share); onDone();
  };
  const closeLots = () => {
    const n = parseLots(custom);
    if (!isFinite(n) || n <= 0) { toast('Enter how many lots to close, for example 0.10.', 'bad'); return; }
    if (!s.lots) { toast('This trade has no lot size saved. Use the percent buttons.', 'bad'); return; }
    if (n > lotsOpen + 1e-9) { toast(`Only ${fmtLots(lotsOpen)} lots are still open.`, 'bad'); return; }
    closeShare(n / lotsOpen);
  };
  const chip = (label: string, share: number) => (
    <Pressable key={label} onPress={() => closeShare(share)} disabled={!price} style={({ pressed }) => ({ flex: 1, height: 46, borderRadius: 8, borderWidth: 1, borderColor: th.accent + '88', backgroundColor: th.accent + '14', alignItems: 'center', justifyContent: 'center', opacity: !price ? 0.45 : pressed ? 0.8 : 1 })}>
      <Text style={{ color: th.accent, fontWeight: '900' }}>{label}</Text>
      {!!s.lots && <Text style={{ color: th.dim, fontSize: 10.5 }}>{fmtLots(lotsOpen * share)} lots</Text>}
    </Pressable>
  );

  return (
    <View style={{ gap: 12 }}>
      <View style={{ backgroundColor: th.bg, borderRadius: 8, borderWidth: 1, borderColor: th.line, padding: 12 }}>
        {row('Live price', price ? f(price) : '…')}
        {row(s.done > 0 ? `Remaining ${leftPct}% · floating` : 'Floating result', price ? money(openPnl) : '…', price ? c : th.dim)}
        {s.done > 0 && row(`Booked · ${donePct}% closed`, money(booked), booked >= 0 ? th.buy : th.sell)}
        {!!s.lots && row('Size', `${fmtLots(s.lots)} lots · ${fmtLots(lotsOpen)} still open`)}
        {row('Stop', `${f(s.stop)}${s.stop === s.fill ? '  (break-even)' : beDone ? '  (profit locked)' : ''}`, beDone ? th.gold : th.sell)}
        {s.tps.map((p, i) => row(`TP${i + 1}${s.hits > i ? '  ✓ reached' : ''}`, f(p), s.hits > i ? th.buy : th.dim))}
      </View>

      {planShare > 0 && (
        <Btn icon="checkmark-done" label={`${t('cpFollow')}: ${Math.round(planShare * 100)}% (TP${s.tpAlert})`} disabled={!price} onPress={() => { if (!price) return; partialClose(s.id, price, Math.min(planShare, open)); ackTp(s.id); onDone(); }} />
      )}
      <Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '900', letterSpacing: 0.8 }}>TAKE PROFIT NOW</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>{chip('25%', 0.25)}{chip('50%', 0.5)}{chip('75%', 0.75)}</View>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <TextInput value={custom} onChangeText={setCustom} placeholder="Lots to close, e.g. 0.10" placeholderTextColor={th.dim} keyboardType="decimal-pad"
          style={{ flex: 1, height: 46, backgroundColor: th.bg, borderColor: th.line, borderWidth: 1, borderRadius: 8, color: th.text, paddingHorizontal: 12 }} />
        <View style={{ width: 110 }}><Btn tone="danger" label="Close" onPress={closeLots} disabled={!custom.trim() || !price} /></View>
      </View>

      <Btn tone="danger" label={price ? (s.done > 0 ? `Close the remaining ${leftPct}% now  ${money(openPnl)}` : `Close ALL now  ${money(openPnl)}`) : 'Waiting for price'} icon="close-circle-outline" disabled={!price} onPress={() => { closeSignal(s.id, price!); onDone(); }} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {!beDone && <View style={{ flex: 1 }}><Btn tone="warn" label="Stop to break-even" icon="shield-half-outline" onPress={() => { const e = breakEven(s.id, price); if (e) toast(e, 'bad'); else onDone(); }} /></View>}
        <View style={{ flex: 1 }}><Btn ghost label={s.tpAlert ? 'Hold, keep running' : 'Back'} icon={s.tpAlert ? 'hourglass-outline' : 'arrow-back'} onPress={() => { if (s.tpAlert) ackTp(s.id); onDone(); }} /></View>
      </View>
      <Text style={{ color: th.dim, fontSize: 11.5, lineHeight: 17 }}>The stop loss still closes the trade by itself if price comes back to it. Everything else is your decision.</Text>
    </View>
  );
}

// Which method found the entry and how it is meant to be taken. `source` looks like "ICT", "Scanner · ICT zone", "Candle · Engulfing" ...
function methodInfo(s: Signal): { name: string; how: string } {
  const src = s.source || '', low = src.toLowerCase();
  if (low.startsWith('vsa')) return { name: 'VSA reversal entry', how: VSA_RULE };
  if (low.includes('smc')) return { name: 'Smart Money Concepts', how: 'Price returns to an order block / decisional zone after a structure break. The entry is the reaction from that zone, with the stop beyond the block.' };
  if (low.includes('ict')) return { name: 'ICT', how: 'Liquidity is swept, structure shifts, then price retraces into a fair value gap / order block (optimal trade entry). Enter on the reaction from the zone, stop beyond the sweep.' };
  if (low.startsWith('candle')) return { name: src, how: 'A candlestick pattern at a key level. Enter only after the confirmation candle closes, stop beyond the pattern.' };
  if (low.startsWith('pattern')) return { name: src, how: 'A chart pattern. Enter on the break and retest of its neckline / boundary, stop on the other side of the pattern.' };
  if (low.startsWith('scalp')) return { name: 'Scalp', how: 'A reversal candle (doji, hammer, shooting star, engulfing, tweezer, morning / evening star ...) on a supply / demand zone, entered on the confirmation candle. Stop beyond the pattern extreme. Close when price breaks the previous candle low (buy) or high (sell).' };
  if (low.startsWith('top')) return { name: 'Top-Down', how: 'The higher timeframe sets the direction, the lower timeframe gives the entry. Trade only with the higher-timeframe trend.' };
  if (low.startsWith('scanner') || low.startsWith('combined')) return { name: src.replace('Scanner · ', 'Scanner: '), how: 'ICT, SMC, VSA and pattern votes combined into one entry. The zone gives the location, the other methods confirm it.' };
  return { name: sourceName(src), how: 'Entry, stop and targets as planned when the trade was taken.' };
}

function WhyPanel({ s }: { s: Signal }) {
  const { th } = useApp();
  const m = methodInfo(s), isVsa = (s.source || '').toLowerCase().startsWith('vsa');
  const lines = (s.why ?? []).filter(Boolean);
  const f = (n: number) => n.toFixed(s.dec);
  return (
    <View style={{ backgroundColor: th.bg, borderRadius: 10, borderWidth: 1, borderColor: th.line, padding: 12, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="bulb-outline" size={17} color={th.accent} />
        <Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '900', letterSpacing: 0.8 }}>WHY THIS ENTRY</Text>
      </View>
      <Text style={{ color: th.text, fontWeight: '900', fontSize: 14 }}>{m.name}{s.grade ? `  ·  grade ${s.grade} (${s.score})` : ''}</Text>
      <Text style={{ color: th.dim, fontSize: 12.5, lineHeight: 18 }}>{m.how}</Text>
      {lines.length > 0 && (
        <View style={{ gap: 5, marginTop: 2 }}>
          {lines.map((l, i) => {
            const done = l.startsWith('✓'), wait = l.startsWith('…');
            return (
              <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                <Icon name={done ? 'checkmark-circle' : wait ? 'ellipse-outline' : 'chevron-forward-circle-outline'} size={15} color={done ? th.buy : th.dim} />
                <Text style={{ flex: 1, color: th.text, fontSize: 12.5, lineHeight: 18 }}>{l.replace(/^[✓…]\s*/, '')}</Text>
              </View>
            );
          })}
        </View>
      )}
      {isVsa && s.level !== undefined && <Text style={{ color: th.gold, fontSize: 12.5, fontWeight: '800' }}>Broken and retested level: {f(s.level)}</Text>}
      {!!s.zone && <Text style={{ color: th.dim, fontSize: 12 }}>Entry zone: {f(Math.min(...s.zone))} to {f(Math.max(...s.zone))}</Text>}
    </View>
  );
}

export function TradeSheet({ s, price, onClose }: { s: Signal; price?: number; onClose: () => void }) {
  const { th, rtl } = useApp();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bc = s.side === 'buy' ? th.buy : th.sell;
  const f = (n: number) => n.toFixed(s.dec);
  const cw = Math.min(width, 640) - 36;
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#000A', direction: rtl ? 'rtl' : 'ltr' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={{ backgroundColor: th.solid, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, borderColor: th.line, padding: 18, paddingBottom: Math.max(insets.bottom, 12) + 16, maxHeight: '94%' }}>
          <View style={{ alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: th.line, marginBottom: 14 }} />
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name={s.side === 'buy' ? 'trending-up' : 'trending-down'} size={22} color={bc} />
              <Text style={{ color: th.text, fontSize: 18, fontWeight: '900', flex: 1 }}>{s.name} <Text style={{ color: bc }}>{s.side.toUpperCase()}</Text></Text>
              <Pressable onPress={onClose} hitSlop={10}><Icon name="close" size={24} color={th.dim} /></Pressable>
            </View>
            <TradeChart s={s} price={price} width={cw} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingHorizontal: 2 }}>
              {([['Entry', f(s.fill ?? s.entry), th.accent], ['Stop', f(s.stop), th.sell], ...s.tps.map((p, i) => [`TP${i + 1}`, f(p), th.buy])] as [string, string, string][]).map(([k, v, c]) => (
                <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: c }} />
                  <Text style={{ color: th.dim, fontSize: 11.5, fontWeight: '700' }}>{k} <Text style={{ color: th.text }}>{v}</Text></Text>
                </View>
              ))}
            </View>
            <WhyPanel s={s} />
            <TradeActions s={s} price={price} onDone={onClose} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
