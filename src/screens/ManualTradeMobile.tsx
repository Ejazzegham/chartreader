import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Vibration, LayoutChangeEvent } from 'react-native';
import Modal from '../Modal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../store';
import { Icon, confirmAction } from '../ui';
import TerminalChart, { Hit } from '../TerminalChart';
import PositionSheet from '../PositionSheet';
import { SYMBOLS, EXTRA, db, quotes, setWatch, useFeed, symOf, TFS, chg, priceDec, loadCrypto, toggleFav, isClosed, Cat } from '../markets';
import { futAligned } from '../fallback';
import { perPoint, lotSpec, parseLots, lotsError, fmtLots } from '../lots';
import { totalPnl, Position } from '../positions';
import { todayPnl } from '../trades';
import { manualTarget, MANUAL_TAB } from '../manualTarget';

// MANUAL TRADE: a MetaTrader 5 style terminal for trading any pair by hand.
//  - the bar on top is the MT5 one-click bar: SELL price | lot size (type it or use the arrows) | BUY price. One tap sends the order at the live price.
//    There is NO ticket and NO question about stop loss / take profit: you add them afterwards.
//  - the chart has no scroll bars (pinch, drag, drag the price axis, double tap the axis), and every running trade is drawn on it with a tag
//    "BUY 0.25, +12.40 USD". Tap that tag (or the profit in the list) to set the stop loss / take profit, move to break-even, cut the trade by %, or close it.
//  - paper trading on live prices: nothing is sent to a broker. Closed trades go to the Journal (Closed) and Trade history, source "Manual".
const MT5_BLUE = '#2D7DF6';
const KEY = 'manual_trade_v1';
const CATS: { k: 'all' | Cat; label: string }[] = [{ k: 'all', label: 'All' }, { k: 'forex', label: 'Forex & metals' }, { k: 'crypto', label: 'Crypto' }, { k: 'deriv', label: 'Synthetic' }, { k: 'indices', label: 'Indices' }];
const clean = (n: number) => Number(n.toPrecision(10));
const usd = (n: number) => `${n >= 0 ? '+' : '-'}$${Math.abs(n).toFixed(2)}`;

type Saved = { sym?: string; gran?: number; lots?: Record<string, string> };

export default function ManualTrade() {
  const { th, rtl, tab, setTab, positions, openPos, closePos, journal, toast } = useApp();
  const insets = useSafeAreaInsets();
  const active = tab === MANUAL_TAB;
  useFeed(active);
  const [symId, setSymId] = useState(manualTarget.sym || db.favs[0] || 'frxEURUSD');
  const [gran, setGran] = useState(60);
  const [lotsBy, setLotsBy] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState(false);
  const [sheet, setSheet] = useState<{ id: string; focus?: 'sl' | 'tp' | 'pos' } | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [wheelKey, setWheelKey] = useState(0);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const loaded = useRef(false), lastSend = useRef(0), prevBid = useRef<number | undefined>(undefined), up = useRef(true);

  // remember the last pair, timeframe and lot sizes
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => { if (v) { try { const o = JSON.parse(v) as Saved; if (o.sym && !manualTarget.sym) setSymId(o.sym); if (o.gran) setGran(o.gran); if (o.lots) setLotsBy(o.lots); } catch {} } }).catch(() => {}).finally(() => { loaded.current = true; });
  }, []);
  const save = (p: Saved) => { if (loaded.current) AsyncStorage.setItem(KEY, JSON.stringify({ sym: symId, gran, lots: lotsBy, ...p })).catch(() => {}); };
  // another page (Markets, ...) asked for a pair
  useEffect(() => { if (active && manualTarget.sym) { setSymId(manualTarget.sym); save({ sym: manualTarget.sym }); manualTarget.sym = ''; } }, [active]);
  useEffect(() => { loadCrypto().catch(() => {}); }, []);

  const watchIds = useMemo(() => [...new Set([symId, ...positions.map((p) => p.symId)])], [symId, positions]);
  useEffect(() => { setWatch('manual', active ? watchIds : []); return () => setWatch('manual', []); }, [active, watchIds.join(',')]);

  const sym = symOf(symId), q = quotes[symId];
  const bid = q?.bid ?? q?.price, ask = q?.ask ?? q?.price, dec = q?.dec ?? (q?.price ? priceDec(q.price) : 5);
  if (bid !== undefined && prevBid.current !== undefined && bid !== prevBid.current) up.current = bid > prevBid.current;
  prevBid.current = bid;
  const spec = lotSpec(symId, bid ?? 0);
  const lotsTxt = lotsBy[symId] ?? String(spec.min);
  const lots = parseLots(lotsTxt), lotsErr = lotsError(lots, spec);
  const setLots = (v: string) => { const n = { ...lotsBy, [symId]: v }; setLotsBy(n); save({ lots: n }); };
  const bump = (dir: 1 | -1) => {
    const base = isFinite(lots) && lots > 0 ? lots : spec.min, n = Math.min(spec.max, Math.max(spec.min, clean(Math.round(base / spec.step) * spec.step + dir * spec.step)));
    setLots(String(clean(n)));
  };
  const fixLots = () => { // typed size: round to the step, keep it between the minimum and the maximum
    if (!isFinite(lots) || lots <= 0) { setLots(String(spec.min)); return; }
    const n = Math.min(spec.max, Math.max(spec.min, clean(Math.round(lots / spec.step) * spec.step)));
    setLots(String(clean(n)));
  };

  const rate = (id: string) => quotes[id]?.price;
  const send = (side: 'buy' | 'sell') => {
    const now = Date.now();
    if (now - lastSend.current < 700) return; // a double tap must not send two orders
    lastSend.current = now;
    if (isClosed(symId)) { toast(`${sym.name}: the market is closed right now.`, 'bad'); return; }
    if (!futAligned(symId)) { toast('The live gold / silver price is still being matched to the spot price. Try again in a minute.', 'bad'); return; }
    const price = side === 'buy' ? ask : bid;
    if (!price) { toast('Waiting for the live price of this pair…', 'bad'); return; }
    if (lotsErr) { toast(lotsErr, 'bad'); return; }
    const e = openPos({ symId, name: sym.name, side, lots, perLot: perPoint(1, symId, price, rate), price, tf: String(gran), dec });
    if (e) { toast(e, 'bad'); return; }
    Vibration.vibrate(35);
    toast(`${side.toUpperCase()} ${fmtLots(lots)} ${sym.name} at ${price.toFixed(dec)}`, 'good');
  };

  const mark = (p: Position) => { const x = quotes[p.symId]; return p.side === 'buy' ? (x?.bid ?? x?.price) : (x?.ask ?? x?.price); }; // a buy is worth the bid, a sell the ask
  const here = positions.filter((p) => p.symId === symId);
  const floatTotal = positions.reduce((a, p) => { const m = mark(p); return m !== undefined ? a + totalPnl(p, m) : a + p.realized; }, 0);
  const manage = (h: Hit) => setSheet({ id: h.id, focus: h.part });
  const closeAll = () => confirmAction('Close all positions?', `${positions.length} position${positions.length > 1 ? 's' : ''} will be closed at the live price. Total ${usd(floatTotal)}.`, () => { positions.forEach((p) => { const m = mark(p); if (m) closePos(p.id, m); }); }, 'Close all');

  const onLayout = (e: LayoutChangeEvent) => setBox({ w: Math.round(e.nativeEvent.layout.width), h: Math.round(e.nativeEvent.layout.height) });
  const boxColor = () => (up.current ? MT5_BLUE : th.sell); // MT5: blue after an up tick, red after a down tick
  const priceBox = (side: 'sell' | 'buy', p?: number) => {
    const c = boxColor();
    return (
      <Pressable onPress={() => send(side)} accessibilityRole="button" accessibilityLabel={`${side} ${p ? p.toFixed(dec) : ''}`} style={({ pressed }) => ({ flex: 1, height: 58, backgroundColor: c, opacity: pressed ? 0.8 : 1, justifyContent: 'center', paddingHorizontal: 10 })}>
        <Text style={{ color: '#FFFFFFD9', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6 }}>{side.toUpperCase()}</Text>
        <Text style={{ color: '#FFFFFF', fontSize: 21, fontWeight: '800', textAlign: 'center', marginTop: -2 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{p ? p.toFixed(dec) : '…'}</Text>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: th.bg, paddingTop: Math.max(insets.top, 8), direction: 'ltr' }}>
      {/* ---- top bar */}
      <View style={{ height: 46, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, backgroundColor: th.panel, borderBottomWidth: 1, borderBottomColor: th.line }}>
        <Pressable onPress={() => setTab(0)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back to Home" style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={rtl ? 'chevron-forward' : 'chevron-back'} size={24} color={th.text} />
        </Pressable>
        <Pressable onPress={() => setPicker(true)} accessibilityRole="button" accessibilityLabel="Choose a pair" style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, height: 40 }}>
          <Text style={{ color: th.text, fontSize: 16, fontWeight: '900', flexShrink: 1 }} numberOfLines={1}>{sym.name}</Text>
          {q && <Text style={{ color: chg(symId) >= 0 ? th.buy : th.sell, fontSize: 11.5, fontWeight: '800' }}>{chg(symId) >= 0 ? '+' : ''}{chg(symId).toFixed(2)}%</Text>}
          <Icon name="chevron-down" size={16} color={th.dim} />
        </Pressable>
        <Pressable onPress={() => toggleFav(symId)} hitSlop={6} accessibilityRole="button" accessibilityLabel="Watchlist" style={{ width: 38, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={db.favs.includes(symId) ? 'star' : 'star-outline'} size={20} color={db.favs.includes(symId) ? th.gold : th.dim} />
        </Pressable>
        <Pressable onPress={() => setWheelKey((k) => k + 1)} hitSlop={6} accessibilityRole="button" accessibilityLabel="Timeframe" style={{ height: 34, minWidth: 48, paddingHorizontal: 8, marginRight: 4, borderRadius: 8, borderWidth: 1, borderColor: th.line, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 }}>
          <Icon name="radio-button-on-outline" size={14} color={th.accent} />
          <Text style={{ color: th.text, fontWeight: '900', fontSize: 13 }}>{TFS.find((t) => t.k === String(gran))?.label ?? `${gran}s`}</Text>
        </Pressable>
      </View>

      {/* ---- one-click bar: SELL | lots | BUY */}
      <View style={{ flexDirection: 'row', alignItems: 'stretch', backgroundColor: th.solid }}>
        {priceBox('sell', bid)}
        <View style={{ width: '38%', minWidth: 124, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: th.solid, borderTopWidth: 1, borderBottomWidth: 1, borderColor: lotsErr ? th.sell : th.line }}>
          <Pressable onPress={() => bump(-1)} hitSlop={6} accessibilityRole="button" accessibilityLabel="Less lots" style={{ width: 36, height: 58, alignItems: 'center', justifyContent: 'center' }}><Icon name="chevron-down" size={22} color={th.text} /></Pressable>
          <TextInput value={lotsTxt} onChangeText={(v) => setLots(v.replace(/[^0-9.,]/g, '').slice(0, 8))} onEndEditing={fixLots} keyboardType="decimal-pad" selectTextOnFocus accessibilityLabel="Lot size" style={{ flex: 1, minWidth: 40, textAlign: 'center', color: lotsErr ? th.sell : th.text, fontSize: 18, fontWeight: '700', paddingVertical: 0 }} />
          <Pressable onPress={() => bump(1)} hitSlop={6} accessibilityRole="button" accessibilityLabel="More lots" style={{ width: 36, height: 58, alignItems: 'center', justifyContent: 'center' }}><Icon name="chevron-up" size={22} color={th.text} /></Pressable>
        </View>
        {priceBox('buy', ask)}
      </View>

      {/* ---- chart */}
      <View style={{ flex: 1 }} onLayout={onLayout}>
        {active && box.w > 0 && box.h > 0 && (
          <TerminalChart key={symId} symId={symId} name={sym.name} dec={dec} gran={gran} onGran={(k) => { setGran(Number(k)); save({ gran: Number(k) }); }} positions={here}
            bid={bid} ask={ask} mark={mark} width={box.w} height={box.h} onManage={manage} openWheel={wheelKey} />
        )}
      </View>

      {/* ---- trade list (like the Trade tab of MT5) */}
      <View style={{ backgroundColor: th.panel, borderTopWidth: 1, borderTopColor: th.line }}>
        <Pressable onPress={() => setListOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: listOpen }} style={{ height: 42, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 }}>
          <Icon name="swap-vertical" size={17} color={th.accent} />
          <Text style={{ color: th.text, fontWeight: '900', fontSize: 13.5 }}>Trade</Text>
          {positions.length > 0 && <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: th.accent, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: th.onAccent, fontSize: 11, fontWeight: '900' }}>{positions.length}</Text></View>}
          <View style={{ flex: 1 }} />
          <Text style={{ color: th.dim, fontSize: 11, fontWeight: '700' }}>{positions.length ? 'Floating' : `Today ${usd(todayPnl(journal))}`}</Text>
          {positions.length > 0 && <Text style={{ color: floatTotal >= 0 ? th.buy : th.sell, fontSize: 15, fontWeight: '900' }}>{usd(floatTotal)}</Text>}
          <Icon name={listOpen ? 'chevron-down' : 'chevron-up'} size={16} color={th.dim} />
        </Pressable>
        {listOpen && (
          <View style={{ borderTopWidth: 1, borderTopColor: th.line }}>
            {positions.length === 0 ? (
              <Text style={{ color: th.dim, fontSize: 12.5, lineHeight: 18, padding: 14, textAlign: 'center' }}>No open positions. Tap SELL or BUY to trade {sym.name} at the live price. Add the stop loss and take profit afterwards by tapping the trade's tag on the chart.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 230 }} showsVerticalScrollIndicator={false}>
                {positions.map((p) => {
                  const m = mark(p), pnl = m !== undefined ? totalPnl(p, m) : p.realized, c = pnl >= 0 ? th.buy : th.sell, sc = p.side === 'buy' ? th.buy : th.sell, d = p.dec;
                  return (
                    <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: th.line, backgroundColor: p.symId === symId ? th.accent + '10' : 'transparent' }}>
                      <Pressable onPress={() => { setSymId(p.symId); save({ sym: p.symId }); }} style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ color: th.text, fontWeight: '900', fontSize: 13.5, flexShrink: 1 }} numberOfLines={1}>{p.name}</Text>
                          <Text style={{ color: sc, fontWeight: '900', fontSize: 11.5 }}>{p.side} {fmtLots(p.lots)}</Text>
                        </View>
                        <Text style={{ color: th.dim, fontSize: 11 }} numberOfLines={1}>{p.open.toFixed(d)} → {m !== undefined ? m.toFixed(d) : '…'}{p.sl !== undefined ? `  SL ${p.sl.toFixed(d)}` : ''}{p.tp !== undefined ? `  TP ${p.tp.toFixed(d)}` : ''}</Text>
                      </Pressable>
                      <Pressable onPress={() => setSheet({ id: p.id })} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Manage ${p.name}`} style={{ minWidth: 92, height: 36, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: c, backgroundColor: c + '1A', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 }}>
                        <Text style={{ color: c, fontWeight: '900', fontSize: 13.5 }}>{usd(pnl)}</Text>
                        <Icon name="options-outline" size={13} color={c} />
                      </Pressable>
                    </View>
                  );
                })}
                {positions.length > 1 && (
                  <Pressable onPress={closeAll} style={{ height: 40, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: th.sell, fontWeight: '900', fontSize: 12.5 }}>Close all · {usd(floatTotal)}</Text></Pressable>
                )}
              </ScrollView>
            )}
          </View>
        )}
      </View>

      {picker && <PairPicker onClose={() => setPicker(false)} onPick={(id) => { setSymId(id); save({ sym: id }); setPicker(false); }} />}
      {sheet && <PositionSheet posId={sheet.id} focus={sheet.focus} onClose={() => setSheet(null)} />}
    </View>
  );
}

// ---------------------------------------------------------------- pair list (any pair: forex, metals, crypto, synthetic, indices)
function PairPicker({ onClose, onPick }: { onClose: () => void; onPick: (id: string) => void }) {
  const { th, rtl } = useApp();
  const insets = useSafeAreaInsets();
  useFeed(true);
  const [q, setQ] = useState(''), [cat, setCat] = useState<'all' | Cat>('all');
  const pool = useMemo(() => [...SYMBOLS, ...EXTRA.filter((e) => !SYMBOLS.some((s) => s.id === e.id))], [SYMBOLS.length]);
  const qq = q.trim().toLowerCase();
  const list = pool.filter((s) => (cat === 'all' || s.cat === cat) && (!qq || s.name.toLowerCase().includes(qq) || s.id.toLowerCase().includes(qq))).sort((a, b) => Number(db.favs.includes(b.id)) - Number(db.favs.includes(a.id))).slice(0, 80);
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#000A', direction: rtl ? 'rtl' : 'ltr' }}>
        <Pressable style={{ flex: 0.08 }} onPress={onClose} />
        <View style={{ flex: 0.92, backgroundColor: th.solid, borderTopLeftRadius: 12, borderTopRightRadius: 12, borderWidth: 1, borderColor: th.line, padding: 14, paddingBottom: Math.max(insets.bottom, 12) + 8, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1, color: th.text, fontSize: 18, fontWeight: '900' }}>Choose a pair</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close"><Icon name="close" size={24} color={th.dim} /></Pressable>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, borderRadius: 8, borderWidth: 1, borderColor: th.line, backgroundColor: th.bg, paddingHorizontal: 12 }}>
            <Icon name="search" size={18} color={th.dim} />
            <TextInput value={q} onChangeText={setQ} placeholder="Search any pair, e.g. EURUSD, gold, BTC, Step Index" placeholderTextColor={th.dim} autoCapitalize="none" autoCorrect={false} style={{ flex: 1, color: th.text, fontSize: 15, paddingVertical: 0 }} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ flexGrow: 0 }}>
            {CATS.map((c) => { const on = cat === c.k; return <Pressable key={c.k} onPress={() => setCat(c.k)} style={{ paddingHorizontal: 12, height: 34, borderRadius: 8, justifyContent: 'center', borderWidth: 1, borderColor: on ? th.accent : th.line, backgroundColor: on ? th.accent + '26' : th.panel }}><Text style={{ color: on ? th.accent : th.dim, fontWeight: '800', fontSize: 12.5 }}>{c.label}</Text></Pressable>; })}
          </ScrollView>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 12 }}>
            {list.map((s) => {
              const lq = quotes[s.id], star = db.favs.includes(s.id);
              return (
                <Pressable key={s.id} onPress={() => onPick(s.id)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: th.line, backgroundColor: pressed ? th.accent + '18' : th.panel })}>
                  {star ? <Icon name="star" size={15} color={th.gold} /> : <View style={{ width: 15 }} />}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: th.text, fontWeight: '800', fontSize: 14.5 }} numberOfLines={1}>{s.name}</Text>
                    <Text style={{ color: th.dim, fontSize: 11 }} numberOfLines={1}>{s.sub ?? s.cat}</Text>
                  </View>
                  {lq && <Text style={{ color: chg(s.id) >= 0 ? th.buy : th.sell, fontWeight: '800', fontSize: 13 }}>{lq.price.toFixed(lq.dec)}</Text>}
                </Pressable>
              );
            })}
            {list.length === 0 && <Text style={{ color: th.dim, textAlign: 'center', padding: 20 }}>No pair matches. Crypto and synthetic lists load from the feeds, give them a moment.</Text>}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
