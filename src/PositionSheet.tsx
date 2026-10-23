import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import Modal from './Modal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from './store';
import { Icon } from './ui';
import { useFeed, quotes } from './markets';
import { totalPnl, floating, dirP, lotsForPct, closeLots, inProfit, Position } from './positions';
import { lotSpec, fmtLots } from './lots';
import { ink } from './theme';

// What opens when you tap the profit / loss tag of a running trade (on the chart or in the list): the same things MetaTrader 5 offers on a
// position, in one sheet - stop loss, take profit, move the stop to break-even, and cut the trade by a percentage (or close it all).
const num = (s: string) => parseFloat(String(s).replace(',', '.'));
const usd = (n: number) => `${n >= 0 ? '+' : '-'}$${Math.abs(n).toFixed(2)}`;
const DIST = [0.1, 0.25, 0.5, 1];      // quick stop / target distances, % of the price
const CUT = [10, 25, 50, 75];          // quick "cut the trade" shares, % of what is open

export default function PositionSheet({ posId, focus, onClose }: { posId: string; focus?: 'sl' | 'tp' | 'pos'; onClose: () => void }) {
  const { th, rtl, positions, closePos, setPosLevels, posBreakEven, toast } = useApp();
  const insets = useSafeAreaInsets();
  useFeed(true); // the numbers move with the market
  const p = positions.find((x) => x.id === posId);
  const [slTxt, setSlTxt] = useState(''), [tpTxt, setTpTxt] = useState(''), [cut, setCut] = useState('50');
  const [seed, setSeed] = useState('');
  useEffect(() => { if (!p) onClose(); }, [!!p]); // the trade closed by itself (stop or target): the sheet goes away
  useEffect(() => { if (p && seed !== p.id) { setSeed(p.id); setSlTxt(p.sl !== undefined ? p.sl.toFixed(p.dec) : ''); setTpTxt(p.tp !== undefined ? p.tp.toFixed(p.dec) : ''); } }, [p?.id]);
  if (!p) return null;

  const q = quotes[p.symId], bid = q?.bid ?? q?.price, ask = q?.ask ?? q?.price, mark = p.side === 'buy' ? bid : ask; // a buy closes at the bid, a sell at the ask
  const k = dirP(p), dec = p.dec, f = (v: number) => v.toFixed(dec);
  const spec = lotSpec(p.symId, mark ?? p.open);
  const pnl = mark !== undefined ? totalPnl(p, mark) : p.realized, flo = mark !== undefined ? floating(p, mark) : 0, pc = pnl >= 0 ? th.buy : th.sell;
  const sideC = p.side === 'buy' ? th.buy : th.sell;

  const slV = num(slTxt), tpV = num(tpTxt);
  const levelHint = (v: number) => (isFinite(v) ? `at this price: ${usd(totalPnl(p, v))}` : '');
  const fromPct = (pct: number, kind: 'sl' | 'tp') => { if (mark === undefined) return; const d = mark * (pct / 100), v = kind === 'sl' ? mark - k * d : mark + k * d; (kind === 'sl' ? setSlTxt : setTpTxt)(f(v)); };

  const apply = () => {
    const sl = slTxt.trim() === '' ? null : slV, tp = tpTxt.trim() === '' ? null : tpV;
    const e = setPosLevels(p.id, mark, sl === null ? (p.sl !== undefined ? null : undefined) : sl, tp === null ? (p.tp !== undefined ? null : undefined) : tp);
    if (e) toast(e, 'bad'); else toast('Stop loss / take profit saved.', 'good');
  };
  const removeLevel = (kind: 'sl' | 'tp') => { const e = setPosLevels(p.id, mark, kind === 'sl' ? null : undefined, kind === 'tp' ? null : undefined); if (e) toast(e, 'bad'); else (kind === 'sl' ? setSlTxt : setTpTxt)(''); };
  const be = () => { const e = posBreakEven(p.id, mark); if (e) toast(e, 'bad'); else setSlTxt(f(p.open)); };
  const beNow = p.sl !== undefined && k * (p.sl - p.open) >= -1e-12; // the stop already sits on the entry or beyond it
  const beReady = mark !== undefined && inProfit(p, mark) && !beNow;

  const pct = num(cut), cl = isFinite(pct) ? lotsForPct(p, pct, spec) : { lots: 0, all: false };
  const prev = cl.lots > 0 && mark !== undefined ? closeLots(p, mark, cl.lots) : null, stay = prev?.pos ? prev.pos.lots : 0;
  const doCut = () => { if (mark === undefined) { toast('No live price yet.', 'bad'); return; } if (cl.lots <= 0) { toast(`That share is below the minimum lot (${fmtLots(spec.min)}).`, 'bad'); return; } const e = closePos(p.id, mark, cl.lots); if (e) toast(e, 'bad'); else if (cl.all) onClose(); };
  const doAll = () => { if (mark === undefined) { toast('No live price yet.', 'bad'); return; } const e = closePos(p.id, mark); if (e) toast(e, 'bad'); else onClose(); };

  const lab = (t: string, c?: string) => <Text style={{ color: c ?? th.dim, fontSize: 10.5, fontWeight: '900', letterSpacing: 0.8 }}>{t}</Text>;
  const input = (value: string, set: (v: string) => void, ok: boolean, ph: string, autoFocus?: boolean) => (
    <TextInput value={value} onChangeText={set} placeholder={ph} placeholderTextColor={th.dim} keyboardType="decimal-pad" autoFocus={autoFocus} style={{ flex: 1, height: 46, backgroundColor: th.bg, borderColor: ok ? th.line : th.sell, borderWidth: 1.5, borderRadius: 8, color: th.text, paddingHorizontal: 12, fontSize: 16, fontWeight: '800' }} />
  );
  const chip = (key: string, label: string, on: boolean, press: () => void, color?: string) => (
    <Pressable key={key} onPress={press} hitSlop={4} style={{ minWidth: 54, paddingHorizontal: 11, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: on ? (color ?? th.accent) : th.line, backgroundColor: on ? (color ?? th.accent) + '26' : th.panel }}>
      <Text style={{ color: on ? (color ?? th.accent) : th.dim, fontWeight: '800', fontSize: 12.5 }}>{label}</Text>
    </Pressable>
  );
  const levelBlock = (kind: 'sl' | 'tp') => {
    const isSl = kind === 'sl', c = isSl ? th.sell : th.buy, txt = isSl ? slTxt : tpTxt, v = isSl ? slV : tpV, cur = isSl ? p.sl : p.tp;
    const bad = txt.trim() !== '' && (!isFinite(v) || (mark !== undefined && (isSl ? k * (mark - v) <= 0 : k * (v - mark) <= 0)));
    return (
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {lab(isSl ? 'STOP LOSS' : 'TAKE PROFIT', c)}
          <View style={{ flex: 1 }} />
          {cur !== undefined && <Pressable onPress={() => removeLevel(kind)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="close-circle" size={15} color={th.dim} /><Text style={{ color: th.dim, fontWeight: '800', fontSize: 11.5 }}>Remove</Text></Pressable>}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>{input(txt, isSl ? setSlTxt : setTpTxt, !bad, isSl ? 'Not set' : 'Not set', focus === kind)}</View>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <Text style={{ color: th.dim, fontSize: 11.5, fontWeight: '700' }}>Distance:</Text>
          {DIST.map((d) => chip(`${kind}${d}`, `${d}%`, false, () => fromPct(d, kind)))}
        </View>
        <Text style={{ color: bad ? th.sell : th.dim, fontSize: 11.5 }}>{bad ? `For a ${p.side.toUpperCase()} the ${isSl ? 'stop loss' : 'take profit'} must be ${(isSl ? p.side === 'buy' : p.side === 'sell') ? 'below' : 'above'} the current price.` : levelHint(v)}</Text>
      </View>
    );
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#000A', direction: rtl ? 'rtl' : 'ltr' }}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />
          <View style={{ backgroundColor: th.solid, borderTopLeftRadius: 12, borderTopRightRadius: 12, borderWidth: 1, borderColor: th.line, paddingHorizontal: 16, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 12) + 10, maxHeight: '92%' }}>
            <View style={{ alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: th.line, marginBottom: 12 }} />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14, paddingBottom: 6 }}>
              {/* the trade */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ backgroundColor: sideC, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 4 }}><Text style={{ color: ink(sideC), fontWeight: '900', fontSize: 12, letterSpacing: 0.6 }}>{p.side.toUpperCase()}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: th.text, fontSize: 16.5, fontWeight: '900' }} numberOfLines={1}>{p.name}</Text>
                  <Text style={{ color: th.dim, fontSize: 11.5 }} numberOfLines={1}>{fmtLots(p.lots)}{p.lots < p.lots0 ? ` of ${fmtLots(p.lots0)}` : ''} lots · {f(p.open)} → {mark !== undefined ? f(mark) : '…'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: pc, fontSize: 22, fontWeight: '900', letterSpacing: -0.4 }}>{usd(pnl)}</Text>
                  {p.realized !== 0 && <Text style={{ color: th.dim, fontSize: 10.5 }}>{usd(p.realized)} booked · {usd(flo)} open</Text>}
                </View>
              </View>

              {levelBlock('sl')}
              {levelBlock('tp')}
              <Pressable onPress={apply} accessibilityRole="button" style={({ pressed }) => ({ height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: th.accent, opacity: pressed ? 0.85 : 1 })}>
                <Text style={{ color: th.onAccent, fontWeight: '900', fontSize: 15 }}>Save stop loss / take profit</Text>
              </Pressable>

              {/* break-even */}
              <Pressable onPress={be} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: beReady ? th.gold : th.line, backgroundColor: beReady ? th.gold + '1A' : th.panel, opacity: pressed ? 0.85 : 1 })}>
                <Icon name="shield-checkmark" size={20} color={beReady ? th.gold : th.dim} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: th.text, fontWeight: '900', fontSize: 14 }}>Break-even</Text>
                  <Text style={{ color: th.dim, fontSize: 11.5 }}>{beNow ? 'The stop is already at the entry or better.' : beReady ? `Move the stop loss to the entry ${f(p.open)}.` : 'Available once the trade is in profit.'}</Text>
                </View>
                <Icon name={rtl ? 'chevron-back' : 'chevron-forward'} size={16} color={th.dim} />
              </Pressable>

              {/* cut by percentage */}
              <View style={{ gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: th.line, backgroundColor: th.panel }}>
                {lab('CUT THE TRADE BY PERCENTAGE')}
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  {CUT.map((c) => chip(`c${c}`, `${c}%`, num(cut) === c, () => setCut(String(c))))}
                  <View style={{ flexDirection: 'row', alignItems: 'center', height: 34, minWidth: 76, borderRadius: 8, borderWidth: 1, borderColor: CUT.includes(num(cut)) ? th.line : th.accent, backgroundColor: th.bg, paddingHorizontal: 8 }}>
                    <TextInput value={cut} onChangeText={(v) => setCut(v.replace(/[^0-9.,]/g, '').slice(0, 5))} keyboardType="decimal-pad" style={{ flex: 1, color: th.text, fontWeight: '800', fontSize: 14, paddingVertical: 0 }} />
                    <Text style={{ color: th.dim, fontWeight: '800' }}>%</Text>
                  </View>
                </View>
                <Text style={{ color: cl.lots > 0 ? th.text : th.gold, fontSize: 12.5, lineHeight: 18 }}>
                  {!isFinite(pct) || pct <= 0 ? 'Enter a percentage from 1 to 100.' : cl.lots <= 0 ? `${pct}% of ${fmtLots(p.lots)} lots is below the minimum lot (${fmtLots(spec.min)}). Pick a bigger share.` : cl.all ? `Closes the whole trade (${fmtLots(p.lots)} lots)${spec.min > 0 && pct < 99.9 ? ', what would stay is below the minimum lot' : ''}${prev ? `, result ${usd(prev.closed!.pnl)}` : ''}.` : `Closes ${fmtLots(cl.lots)} lots${prev ? ` (${usd(prev.booked)})` : ''} and keeps ${fmtLots(stay)} lots running.`}
                </Text>
                <Pressable onPress={doCut} disabled={cl.lots <= 0} accessibilityRole="button" style={({ pressed }) => ({ height: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: th.gold, opacity: cl.lots <= 0 ? 0.4 : pressed ? 0.85 : 1 })}>
                  <Text style={{ color: ink(th.gold), fontWeight: '900', fontSize: 14.5 }}>{cl.all ? 'Close trade' : `Close ${isFinite(pct) ? pct : ''}% now`}</Text>
                </Pressable>
              </View>

              <Pressable onPress={doAll} accessibilityRole="button" style={({ pressed }) => ({ height: 50, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, backgroundColor: th.sell, opacity: pressed ? 0.85 : 1 })}>
                <Icon name="close-circle" size={20} color={ink(th.sell)} />
                <Text style={{ color: ink(th.sell), fontWeight: '900', fontSize: 15 }}>Close position · {usd(pnl)}</Text>
              </Pressable>
              <Text style={{ color: th.dim, fontSize: 11, lineHeight: 16, textAlign: 'center' }}>Paper trade on live prices. Nothing is sent to a broker.</Text>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
