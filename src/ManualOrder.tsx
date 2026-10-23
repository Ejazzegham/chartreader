import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import Modal from './Modal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp, NewSignal } from './store';
import { Icon, Btn, Segment } from './ui';
import { ink } from './theme';
import { buildTicket, numOf as num } from './manualOrderMath';
import { SYMBOLS, EXTRA, db, quotes, setWatch, useFeed, symOf, TFS, chg, priceDec, loadCrypto, Cat } from './markets';

// Manual order ticket: pick ANY pair, press SELL or BUY like in MetaTrader, set the stop and the targets, then the Take sheet asks for
// the size and executes it (market = now at the live price, limit = waits for your price). It is a paper trade on live prices: it
// appears in Journal > Live, is tracked with live prices (stop, targets, break-even) and is written to Closed / Trade history.
export const pendingTake: { id: string | null; mode: 'market' | 'limit' } = { id: null, mode: 'market' }; // the Journal opens the Take sheet for this order when it is shown

const CATS: { k: 'all' | Cat; label: string }[] = [{ k: 'all', label: 'All' }, { k: 'forex', label: 'Forex & metals' }, { k: 'crypto', label: 'Crypto' }, { k: 'deriv', label: 'Synthetic' }, { k: 'indices', label: 'Indices' }];
const TF_CHIPS = ['60', '300', '900', '3600', '14400'];
const PRESETS: number[][] = [[1, 2, 3], [1, 1.5, 2], [1.5, 3, 4.5]];
const SL_PCT = [0.1, 0.25, 0.5, 1];
let lastSym = '', lastSide: 'buy' | 'sell' = 'buy', lastTf = '900';

export default function ManualOrder({ onClose, onReady, initialSym, initialSide }: { onClose: () => void; onReady: (id: string, mode: 'market' | 'limit') => void; initialSym?: string; initialSide?: 'buy' | 'sell' }) {
  const { th, rtl, signals, proposeSignal, toast } = useApp();
  const insets = useSafeAreaInsets();
  useFeed(true); // the prices on the ticket move with the market
  const [symId, setSymId] = useState(initialSym ?? lastSym), [side, setSide] = useState<'buy' | 'sell'>(initialSide ?? lastSide);
  const [mode, setMode] = useState<'market' | 'limit'>('market'), [tf, setTf] = useState(lastTf);
  const [q, setQ] = useState(''), [cat, setCat] = useState<'all' | Cat>('all');
  const [entryTxt, setEntryTxt] = useState(''), [slTxt, setSlTxt] = useState('');
  const [rr, setRr] = useState<number[]>(PRESETS[0]), [tpTxt, setTpTxt] = useState<(string | null)[]>([null, null, null]);

  useEffect(() => { loadCrypto().catch(() => {}); }, []);
  useEffect(() => { if (symId) { setWatch('ticket', [symId]); lastSym = symId; } return () => setWatch('ticket', []); }, [symId]);

  const quote = symId ? quotes[symId] : undefined, price = quote?.price, sym = symId ? symOf(symId) : undefined;
  const dec = quote?.dec ?? (price ? priceDec(price) : 5), f = (v: number) => v.toFixed(dec);
  const bid = quote?.bid ?? price, ask = quote?.ask ?? price;
  const k = side === 'buy' ? 1 : -1, buyC = th.buy, sellC = th.sell, sc = side === 'buy' ? buyC : sellC;

  // ---- the numbers on the ticket
  const T = buildTicket({ side, mode, price, entryTxt, slTxt, tpTxt, rr });
  const { entry, sl, tps, dist, autoTp, tpVal } = T;
  const pct = entry && dist ? (dist / entry) * 100 : 0;
  let err = !symId ? 'Pick a pair first.' : T.err;
  const running = symId ? signals.find((x) => x.symId === symId && x.status !== 'signal') : undefined;
  if (!err && running) err = running.side === side ? `You already have a ${side.toUpperCase()} ${running.status === 'open' ? 'running' : 'order waiting'} on ${sym?.name}.` : `You already have a ${running.side.toUpperCase()} ${running.status === 'open' ? 'running' : 'order waiting'} on ${sym?.name}. Close or cancel it first.`;

  const go = () => {
    if (err || !symId || entry === undefined) return;
    lastSide = side; lastTf = tf;
    const n: NewSignal = { symId, name: sym!.name, side, entry, sl, tps, tf, dec, source: 'Manual', grade: 'M', score: 0 };
    const r = proposeSignal(n);
    if (!r.id) { toast(r.err ?? 'Could not create the order.', 'bad'); return; }
    onReady(r.id, mode);
  };
  const slFromPct = (p: number) => { if (entry !== undefined && isFinite(entry)) setSlTxt(f(entry - k * entry * (p / 100))); };

  // ---- pair list
  const pool = useMemo(() => [...SYMBOLS, ...EXTRA.filter((e) => !SYMBOLS.some((s) => s.id === e.id))], [SYMBOLS.length]);
  const qq = q.trim().toLowerCase();
  const list = pool.filter((s) => (cat === 'all' || s.cat === cat) && (!qq || s.name.toLowerCase().includes(qq) || s.id.toLowerCase().includes(qq))).sort((a, b) => Number(db.favs.includes(b.id)) - Number(db.favs.includes(a.id))).slice(0, 60);
  const pick = (id: string) => { setSymId(id); setSlTxt(''); setEntryTxt(''); setTpTxt([null, null, null]); setQ(''); };

  const inp = (ok = true) => ({ height: 48, backgroundColor: th.bg, borderColor: ok ? th.line : th.sell, borderWidth: 1.5, borderRadius: 8, color: th.text, paddingHorizontal: 12, fontSize: 17, fontWeight: '800' as const });
  const lab = (t: string) => <Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '900', letterSpacing: 0.8 }}>{t}</Text>;
  const chip = (key: string, label: string, on: boolean, press: () => void) => (
    <Pressable key={key} onPress={press} style={{ paddingHorizontal: 12, height: 34, borderRadius: 8, justifyContent: 'center', borderWidth: 1, borderColor: on ? th.accent : th.line, backgroundColor: on ? th.accent + '26' : th.panel }}>
      <Text style={{ color: on ? th.accent : th.dim, fontWeight: '800', fontSize: 12.5 }}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#000A', direction: rtl ? 'rtl' : 'ltr' }}>
        <Pressable style={{ flex: 0.08 }} onPress={onClose} />
        <View style={{ flex: 0.92, backgroundColor: th.solid, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderWidth: 1, borderColor: th.line, padding: 16, paddingBottom: Math.max(insets.bottom, 12) + 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ flex: 1, color: th.text, fontSize: 19, fontWeight: '900' }}>{symId ? 'New order' : 'Choose a pair'}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close"><Icon name="close" size={24} color={th.dim} /></Pressable>
          </View>

          {!symId ? (
            <View style={{ flex: 1, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, borderRadius: 8, borderWidth: 1, borderColor: th.line, backgroundColor: th.bg, paddingHorizontal: 12 }}>
                <Icon name="search" size={18} color={th.dim} />
                <TextInput value={q} onChangeText={setQ} placeholder="Search any pair, e.g. EURUSD, gold, BTC, Volatility" placeholderTextColor={th.dim} autoCapitalize="none" autoCorrect={false} style={{ flex: 1, color: th.text, fontSize: 15, paddingVertical: 0 }} />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ flexGrow: 0 }}>{CATS.map((c) => chip(c.k, c.label, cat === c.k, () => setCat(c.k)))}</ScrollView>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 12 }}>
                {list.map((s) => {
                  const lq = quotes[s.id], star = db.favs.includes(s.id);
                  return (
                    <Pressable key={s.id} onPress={() => pick(s.id)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: th.line, backgroundColor: pressed ? th.accent + '18' : th.panel })}>
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
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 8 }}>
              {/* pair + live price */}
              <Pressable onPress={() => setSymId('')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: th.line, backgroundColor: th.panel }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: th.text, fontSize: 17, fontWeight: '900' }} numberOfLines={1}>{sym?.name}</Text>
                  <Text style={{ color: th.dim, fontSize: 11.5 }}>{price ? `Live ${f(price)}  ·  ${chg(symId) >= 0 ? '+' : ''}${chg(symId).toFixed(2)}% today` : 'Waiting for the live price…'}</Text>
                </View>
                <Text style={{ color: th.accent, fontWeight: '800', fontSize: 12.5 }}>Change</Text>
                <Icon name="chevron-forward" size={16} color={th.dim} />
              </Pressable>

              {/* SELL / BUY, like the MetaTrader bar */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {([['sell', 'SELL', bid, sellC], ['buy', 'BUY', ask, buyC]] as const).map(([s, label, p, c]) => {
                  const on = side === s;
                  return (
                    <Pressable key={s} onPress={() => setSide(s)} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ flex: 1, height: 70, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c, backgroundColor: on ? c : c + '14' }}>
                      <Text style={{ color: on ? ink(c) : c, fontSize: 11.5, fontWeight: '900', letterSpacing: 1 }}>{label}</Text>
                      <Text style={{ color: on ? ink(c) : th.text, fontSize: 22, fontWeight: '900' }}>{p ? f(p) : '…'}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Segment value={mode} onChange={(m) => setMode(m as any)} options={[{ k: 'market', label: 'Market (now)' }, { k: 'limit', label: 'Limit / pending' }]} />
              {mode === 'limit' && (
                <View style={{ gap: 6 }}>
                  {lab('ENTRY PRICE')}
                  <TextInput value={entryTxt} onChangeText={setEntryTxt} placeholder={price ? f(price) : 'Price'} placeholderTextColor={th.dim} keyboardType="decimal-pad" style={inp(!entryTxt || isFinite(num(entryTxt)))} />
                  <Text style={{ color: th.dim, fontSize: 11.5 }}>The order waits and fills by itself when the price reaches it.</Text>
                </View>
              )}

              {/* stop loss */}
              <View style={{ gap: 6 }}>
                {lab('STOP LOSS')}
                <TextInput value={slTxt} onChangeText={setSlTxt} placeholder={entry !== undefined && isFinite(entry) ? `e.g. ${f(entry - k * entry * 0.005)}` : 'Price'} placeholderTextColor={th.dim} keyboardType="decimal-pad" style={inp(!slTxt || isFinite(sl))} />
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Text style={{ color: th.dim, fontSize: 11.5, fontWeight: '700' }}>Distance:</Text>
                  {SL_PCT.map((p) => chip(`p${p}`, `${p}%`, false, () => slFromPct(p)))}
                </View>
                {dist > 0 && <Text style={{ color: th.dim, fontSize: 11.5 }}>{f(dist)} price distance ({pct.toFixed(2)}% of price)</Text>}
              </View>

              {/* targets */}
              <View style={{ gap: 6 }}>
                {lab('TAKE PROFITS (EMPTY BOX = NOT USED)')}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {[0, 1, 2].map((i) => {
                    const shown = tpTxt[i] === null ? (isFinite(autoTp(i)) ? f(autoTp(i)) : '') : (tpTxt[i] as string), v = tpVal(i);
                    return (
                      <View key={i} style={{ flex: 1, gap: 4 }}>
                        <Text style={{ color: th.buy, fontSize: 11.5, fontWeight: '900' }}>TP{i + 1}{dist > 0 && isFinite(v) ? `  ${(k * (v - (entry as number)) / dist).toFixed(1)}R` : ''}</Text>
                        <TextInput value={shown} onChangeText={(t) => setTpTxt((l) => l.map((x, n) => (n === i ? t : x)))} keyboardType="decimal-pad" placeholder="-" placeholderTextColor={th.dim} style={{ ...inp(!shown || isFinite(v)), height: 44, fontSize: 14.5, paddingHorizontal: 8 }} />
                      </View>
                    );
                  })}
                </View>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Text style={{ color: th.dim, fontSize: 11.5, fontWeight: '700' }}>Auto:</Text>
                  {PRESETS.map((p) => chip(p.join('-'), p.map((x) => `${x}R`).join(' · '), tpTxt.every((x) => x === null) && p.every((x, i) => rr[i] === x), () => { setRr(p); setTpTxt([null, null, null]); }))}
                </View>
              </View>

              {/* chart timeframe the trade is shown on */}
              <View style={{ gap: 6 }}>
                {lab('CHART TIMEFRAME FOR THIS TRADE')}
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>{TF_CHIPS.map((x) => chip(x, TFS.find((t) => t.k === x)?.label ?? x, tf === x, () => setTf(x)))}</View>
              </View>

              {!!err && (
                <View style={{ flexDirection: 'row', gap: 8, backgroundColor: th.gold + '16', borderColor: th.gold + '66', borderWidth: 1, borderRadius: 8, padding: 10 }}>
                  <Icon name="information-circle-outline" size={16} color={th.gold} />
                  <Text style={{ flex: 1, color: th.text, fontSize: 12.5, lineHeight: 18 }}>{err}</Text>
                </View>
              )}
              <Text style={{ color: th.dim, fontSize: 11.5, lineHeight: 17 }}>Paper trade on live prices: nothing is sent to a broker. Next you choose the size and confirm.</Text>
              <Btn icon="arrow-forward-circle" label={`${side.toUpperCase()} ${sym?.name ?? ''} · choose size`} disabled={!!err} onPress={go} />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

// SELL | BUY bar for the live chart (like the one at the top of MetaTrader). Tapping a side opens the ticket for this pair; after
// the ticket the Journal opens the Take sheet.
export function QuickTradeBar({ symId, dec }: { symId: string; dec: number }) {
  const { th, setTab } = useApp();
  const [open, setOpen] = useState<null | 'buy' | 'sell'>(null);
  const qt = quotes[symId], bid = qt?.bid ?? qt?.price, ask = qt?.ask ?? qt?.price;
  const btn = (s: 'sell' | 'buy', label: string, p?: number) => {
    const c = s === 'sell' ? th.sell : th.buy;
    return (
      <Pressable key={s} onPress={() => setOpen(s)} accessibilityRole="button" accessibilityLabel={`${label} ${p ? p.toFixed(dec) : ''}`} style={{ flex: 1, height: 52, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: c }}>
        <Text style={{ color: ink(c), fontSize: 10.5, fontWeight: '900', letterSpacing: 1 }}>{label}</Text>
        <Text style={{ color: ink(c), fontSize: 18, fontWeight: '900' }}>{p ? p.toFixed(dec) : '…'}</Text>
      </Pressable>
    );
  };
  return (
    <>
      <View style={{ flexDirection: 'row', gap: 8, direction: 'ltr' }}>{btn('sell', 'SELL', bid)}{btn('buy', 'BUY', ask)}</View>
      {open && <ManualOrder initialSym={symId} initialSide={open} onClose={() => setOpen(null)} onReady={(id, mode) => { pendingTake.id = id; pendingTake.mode = mode; setOpen(null); setTab(3); }} />}
    </>
  );
}
