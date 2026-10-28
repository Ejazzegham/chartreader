import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import Svg, { Polyline, Defs, LinearGradient as SvgGrad, Stop, Path, Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../store';
import { Icon } from '../ui';
import { Coin } from '../MarketWidgets';
import TerminalChart, { Hit } from '../TerminalChart';
import PositionSheet from '../PositionSheet';
import { PageFooter } from '../SiteFooter';
import { useRealWindow } from '../win';
import { SYMBOLS, EXTRA, db, quotes, setWatch, useFeed, symOf, TFS, chg, priceDec, loadCrypto, toggleFav, isClosed } from '../markets';
import { futAligned } from '../fallback';
import { perPoint, usdPerQuote, lotUnits, lotSpec, parseLots, lotsError, fmtLots } from '../lots';
import { totalPnl, Position } from '../positions';
import { sourceName } from '../trades';
import { manualTarget, MANUAL_TAB } from '../manualTarget';

// DEMO TRADING dashboard for the website: hero, live chart with timeframes, market watch, open positions / recent trades,
// a trade panel (volume, stop loss, take profit, estimated P/L), live account stats and the feature strip.
// Same paper-trading engine as the phone terminal: orders fill at the live price, closed trades go to the Journal and Trade history.
const START = 1000, LEVERAGE = 100;
const WATCH_TABS: { k: string; label: string; ids: (s: { id: string; cat: string }) => boolean }[] = [
  { k: 'forex', label: 'Forex', ids: (s) => s.id.startsWith('frx') && !/XAU|XAG|WTI|BRENT|DXY/.test(s.id) && s.cat !== 'indices' },
  { k: 'crypto', label: 'Crypto', ids: (s) => s.cat === 'crypto' },
  { k: 'indices', label: 'Indices', ids: (s) => s.cat === 'indices' || s.id === 'frxDXY' },
  { k: 'metals', label: 'Metals', ids: (s) => /XAU|XAG/.test(s.id) },
];
const usd = (n: number, sign = true) => `${n < 0 ? '-' : sign && n > 0 ? '+' : ''}$${Math.abs(n).toFixed(2)}`;
const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const clean = (n: number) => Number(n.toPrecision(10));

export default function ManualTradeDesk() {
  const { th, tab, positions, openPos, closePos, setPosLevels, journal, setHistOpen, toast } = useApp();
  const W = useRealWindow().width;
  const active = tab === MANUAL_TAB;
  useFeed(active);
  const dark = th.dark;
  const card = dark ? th.panel : '#FFFFFF', border = dark ? th.line : '#E8EDF6', soft = dark ? th.panel2 : '#F5F8FE', ink = dark ? th.text : '#0B1B3F';
  const cardSt = { backgroundColor: card, borderRadius: 16, borderWidth: 1, borderColor: border, shadowColor: '#0B1B3F', shadowOpacity: 0.05, shadowRadius: 18, shadowOffset: { width: 0, height: 6 } } as any;

  const [symId, setSymId] = useState(manualTarget.sym || db.favs[0] || 'frxEURUSD');
  const [gran, setGran] = useState(60);
  const [wTab, setWTab] = useState('forex');
  const [picker, setPicker] = useState(false), [pq, setPq] = useState('');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [lotsBy, setLotsBy] = useState<Record<string, string>>({});
  const [slTxt, setSlTxt] = useState(''), [tpTxt, setTpTxt] = useState('');
  const [sheet, setSheet] = useState<{ id: string; focus?: 'sl' | 'tp' | 'pos' } | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const lastSend = useRef(0);

  useEffect(() => { if (active && manualTarget.sym) { setSymId(manualTarget.sym); manualTarget.sym = ''; } }, [active]);
  useEffect(() => { loadCrypto().catch(() => {}); }, []);
  const watchList = useMemo(() => { const t = WATCH_TABS.find((x) => x.k === wTab)!; return SYMBOLS.filter(t.ids).slice(0, 8); }, [wTab, SYMBOLS.length]);
  const watchIds = useMemo(() => [...new Set([symId, ...positions.map((p) => p.symId), ...watchList.map((s) => s.id)])], [symId, positions, watchList]);
  useEffect(() => { setWatch('manual', active ? watchIds : []); return () => setWatch('manual', []); }, [active, watchIds.join(',')]);
  useEffect(() => { setSlTxt(''); setTpTxt(''); }, [symId]);

  const sym = symOf(symId), q = quotes[symId];
  const bid = q?.bid ?? q?.price, ask = q?.ask ?? q?.price, dec = q?.dec ?? (q?.price ? priceDec(q.price) : 5);
  const spec = lotSpec(symId, bid ?? 0);
  const lotsTxt = lotsBy[symId] ?? String(spec.min), lots = parseLots(lotsTxt), lotsErr = lotsError(lots, spec);
  const setLots = (v: string) => setLotsBy({ ...lotsBy, [symId]: v });
  const bump = (d: 1 | -1) => { const b = isFinite(lots) && lots > 0 ? lots : spec.min; setLots(String(clean(Math.min(spec.max, Math.max(spec.min, Math.round(b / spec.step) * spec.step + d * spec.step))))); };
  const rate = (id: string) => quotes[id]?.price;
  const mark = (p: Position) => { const x = quotes[p.symId]; return p.side === 'buy' ? (x?.bid ?? x?.price) : (x?.ask ?? x?.price); };

  const px = side === 'buy' ? ask : bid, num = (s: string) => parseFloat(s.replace(',', '.'));
  const slV = num(slTxt), tpV = num(tpTxt);
  const estPnl = px && isFinite(tpV) && isFinite(lots) ? (side === 'buy' ? 1 : -1) * (tpV - px) * perPoint(lots, symId, px, rate) : undefined;

  const place = () => {
    const now = Date.now(); if (now - lastSend.current < 700) return; lastSend.current = now;
    if (isClosed(symId)) { toast(`${sym.name}: the market is closed right now.`, 'bad'); return; }
    if (!futAligned(symId)) { toast('The live gold / silver price is still being matched to spot. Try again in a minute.', 'bad'); return; }
    if (!px) { toast('Waiting for the live price of this pair…', 'bad'); return; }
    if (lotsErr) { toast(lotsErr, 'bad'); return; }
    const before = new Set(positions.map((p) => p.id));
    const e = openPos({ symId, name: sym.name, side, lots, perLot: perPoint(1, symId, px, rate), price: px, tf: String(gran), dec });
    if (e) { toast(e, 'bad'); return; }
    toast(`${side.toUpperCase()} ${fmtLots(lots)} ${sym.name} at ${px.toFixed(dec)}`, 'good');
    if (isFinite(slV) || isFinite(tpV)) pending.current = { before, symId, px, sl: isFinite(slV) ? slV : undefined, tp: isFinite(tpV) ? tpV : undefined }; // attached once the new position appears
  };
  const pending = useRef<{ before: Set<string>; symId: string; px: number; sl?: number; tp?: number } | null>(null);
  useEffect(() => {
    const pd = pending.current; if (!pd) return;
    const np = positions.find((p) => !pd.before.has(p.id) && p.symId === pd.symId); if (!np) return;
    pending.current = null;
    const err = setPosLevels(np.id, pd.px, pd.sl, pd.tp); if (err) toast(err, 'bad');
  }, [positions]);

  // ---- account numbers
  const demoTrades = journal.filter((j) => sourceName(j.source) === 'Demo').sort((a, b) => a.date - b.date);
  const realized = demoTrades.reduce((a, j) => a + j.pnl, 0), balance = START + realized;
  const floatTotal = positions.reduce((a, p) => { const m = mark(p); return a + (m !== undefined ? totalPnl(p, m) : p.realized); }, 0);
  const equity = balance + floatTotal;
  const used = positions.reduce((a, p) => a + (p.lots * lotUnits(p.symId) * p.open * usdPerQuote(p.symId, p.open, rate)) / LEVERAGE, 0);
  const free = equity - used, level = used > 0 ? (equity / used) * 100 : 0;
  const curve = useMemo(() => { let b = START; const c = [b]; demoTrades.forEach((j) => { b += j.pnl; c.push(b); }); c.push(equity); return c; }, [journal, equity]);

  const chgV = q ? chg(symId) : 0, up = chgV >= 0;
  const stack = W < 1180;
  const pill = (label: string, on: boolean, f: () => void, key?: string) => (
    <Pressable key={key ?? label} onPress={f} style={((s: any) => ({ height: 32, paddingHorizontal: 15, borderRadius: 8, alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backgroundColor: on ? th.accent : s.hovered ? th.accent + '14' : 'transparent' })) as any}>
      <Text style={{ color: on ? th.onAccent : th.dim, fontSize: 12.5, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );
  const head = (icon: string, title: string, right?: React.ReactNode) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: th.accent + '1A', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={17} color={th.accent} /></View>
      <Text style={{ flex: 1, color: ink, fontSize: 15, fontWeight: '800' }}>{title}</Text>{right}
    </View>
  );
  const th_ = (label: string, flex = 1, right = false) => <Text style={{ flex, color: th.dim, fontSize: 11.5, fontWeight: '700', textAlign: right ? 'right' : 'left' }}>{label}</Text>;
  const badge = (s: string) => { const b = s === 'buy'; return <View style={{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, backgroundColor: (b ? th.buy : th.sell) + '1F' }}><Text style={{ color: b ? th.buy : th.sell, fontSize: 11.5, fontWeight: '800' }}>{b ? 'Buy' : 'Sell'}</Text></View>; };

  const pool = useMemo(() => [...SYMBOLS, ...EXTRA.filter((e) => !SYMBOLS.some((s) => s.id === e.id))], [SYMBOLS.length]);
  const hits = pool.filter((s) => !pq.trim() || (s.name + s.id).toLowerCase().includes(pq.trim().toLowerCase())).slice(0, 8);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: dark ? th.bg : '#F5F8FE' }} contentContainerStyle={{ alignItems: 'center' }}>
      <View style={{ width: '100%', maxWidth: 1360, padding: 24, gap: 20 }}>

        {/* ---- hero */}
        <View style={{ borderRadius: 20, overflow: 'hidden', minHeight: 226, justifyContent: 'center', paddingHorizontal: 36, paddingVertical: 30 }}>
          <LinearGradient colors={['#17216B', '#3A2FB8', '#5A3FD9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1, gap: 12 }}>
              <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#FFFFFF1F' }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#2DE3B0' }} /><Text style={{ color: '#2DE3B0', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>LIVE TRADING</Text>
              </View>
              <Text style={{ color: '#FFFFFF', fontSize: 40, fontWeight: '900', letterSpacing: -1 }}>Trade Live with Confidence</Text>
              <Text style={{ color: '#E3E8FF', fontSize: 15, lineHeight: 22, maxWidth: 520 }}>Watch the markets in real-time, analyze price action, and make smarter trading decisions with our professional trading platform.</Text>
              <View style={{ flexDirection: 'row', gap: 26, marginTop: 8, flexWrap: 'wrap' }}>
                {[['stats-chart', 'Real-time Charts', 'MTS Powered'], ['pulse', 'Live Market Data', 'Forex, Crypto, Indices'], ['construct', 'Advanced Tools', 'For Better Decisions']].map(([ic, t1, t2]) => (
                  <View key={t1} style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: '#FFFFFF55', alignItems: 'center', justifyContent: 'center' }}><Icon name={ic} size={19} color="#FFFFFF" /></View>
                    <View><Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800' }}>{t1}</Text><Text style={{ color: '#C9D2FF', fontSize: 11.5 }}>{t2}</Text></View>
                  </View>
                ))}
              </View>
            </View>
            {W > 1000 && (
              <View style={{ width: 380, height: 180, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 300, height: 170, borderRadius: 14, backgroundColor: '#0E1238', borderWidth: 2, borderColor: '#FFFFFF33', padding: 12, transform: [{ rotate: '-3deg' }] }}>
                  <Svg width="100%" height="100%" viewBox="0 0 276 146">
                    {Array.from({ length: 22 }).map((_, i) => { const x = 6 + i * 12.4, h = 14 + ((i * 37) % 26) + i * 2.2, y = 120 - i * 4.4 - h / 2, g = i % 4 !== 3; return <Rect key={i} x={x} y={y} width={6} height={h} rx={1} fill={g ? '#2DE3B0' : '#FF6B87'} />; })}
                  </Svg>
                </View>
                <View style={{ position: 'absolute', top: 0, left: 10, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: '#19C48B' }}><Icon name="star-outline" size={13} color="#fff" /><Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>BUY</Text></View>
                <View style={{ position: 'absolute', top: 36, right: 0, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: '#F0455F' }}><Icon name="star-outline" size={13} color="#fff" /><Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>SELL</Text></View>
              </View>
            )}
          </View>
        </View>

        {/* ---- chart + market watch */}
        <View style={{ flexDirection: stack ? 'column' : 'row', gap: 20, alignItems: 'flex-start' }}>
          <View style={{ ...cardSt, flex: 1, width: stack ? '100%' : undefined, minWidth: 0, padding: 16, zIndex: 5 } as any}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, flexWrap: 'wrap', zIndex: 6 }}>
              <View style={{ zIndex: 7 }}>
                <Pressable onPress={() => setPicker((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: border, backgroundColor: soft, cursor: 'pointer', minWidth: 230 } as any}>
                  <Coin s={sym} size={36} />
                  <View style={{ flex: 1 }}><Text style={{ color: ink, fontSize: 16, fontWeight: '800' }}>{sym.name}</Text><Text style={{ color: th.dim, fontSize: 11.5 }} numberOfLines={1}>{sym.sub ?? sym.cat}</Text></View>
                  {q && <Text style={{ color: up ? th.buy : th.sell, fontSize: 12, fontWeight: '800' }}>{up ? '+' : ''}{chgV.toFixed(2)}%</Text>}
                  <Icon name="chevron-down" size={16} color={th.dim} />
                </Pressable>
                {picker && (
                  <View style={{ position: 'absolute', top: 62, left: 0, width: 300, padding: 8, borderRadius: 12, borderWidth: 1, borderColor: border, backgroundColor: th.solid, zIndex: 50, shadowColor: '#0B1B3F', shadowOpacity: 0.16, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } } as any}>
                    <TextInput autoFocus value={pq} onChangeText={setPq} placeholder="Search any pair…" placeholderTextColor={th.dim} style={{ height: 38, paddingHorizontal: 10, color: th.text, fontSize: 13.5, borderRadius: 8, borderWidth: 1, borderColor: border, outlineStyle: 'none' } as any} />
                    {hits.map((s) => (
                      <Pressable key={s.id} onPress={() => { setSymId(s.id); setPicker(false); setPq(''); }} style={((x: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, marginTop: 4, borderRadius: 8, cursor: 'pointer', backgroundColor: x.hovered ? th.accent + '14' : 'transparent' })) as any}>
                        <Coin s={s} size={26} /><Text style={{ flex: 1, color: th.text, fontSize: 13, fontWeight: '700' }}>{s.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
              <View>
                <Text style={{ color: ink, fontSize: 24, fontWeight: '800' }}>{bid !== undefined ? bid.toFixed(dec) : '…'}</Text>
                <Text style={{ color: up ? th.buy : th.sell, fontSize: 12.5, fontWeight: '700' }}>{q ? `${up ? '+' : ''}${(q.price - q.open).toFixed(dec)} (${up ? '+' : ''}${chgV.toFixed(2)}%)` : ''}</Text>
              </View>
              <View style={{ flex: 1 }} />
              <View style={{ flexDirection: 'row', gap: 2, padding: 3, borderRadius: 10, backgroundColor: soft }}>
                {TFS.filter((x) => ['60', '300', '900', '1800', '3600', '14400', '86400'].includes(x.k)).map((x) => pill(x.label, String(gran) === x.k, () => setGran(Number(x.k))))}
              </View>
            </View>
            <View onLayout={(e) => setBox({ w: Math.round(e.nativeEvent.layout.width), h: Math.round(e.nativeEvent.layout.height) })} style={{ height: 460, marginTop: 14, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: border }}>
              {active && box.w > 0 && <TerminalChart key={symId} symId={symId} name={sym.name} dec={dec} gran={gran} onGran={(k) => setGran(Number(k))} positions={positions.filter((p) => p.symId === symId)} bid={bid} ask={ask} mark={mark} width={box.w} height={box.h} onManage={(h: Hit) => setSheet({ id: h.id, focus: h.part })} />}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
              <Text style={{ color: ink, fontSize: 14, fontWeight: '900' }}>Trade</Text><View style={{ flex: 1 }} />
              <Text style={{ color: th.dim, fontSize: 11.5, marginRight: 8 }}>Floating P/L</Text>
              <Text style={{ color: floatTotal >= 0 ? th.buy : th.sell, fontSize: 15, fontWeight: '900' }}>{usd(floatTotal, false)}</Text>
            </View>
          </View>

          <View style={{ width: stack ? '100%' : 340, gap: 20 }}>
            <View style={{ ...cardSt, padding: 16 } as any}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Text style={{ color: ink, fontSize: 16, fontWeight: '800' }}>Market Watch</Text>
                <View style={{ flex: 1 }} />
                <Pressable onPress={() => { toggleFav(symId); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, cursor: 'pointer' } as any}><Icon name="add" size={14} color={th.accent} /><Text style={{ color: th.accent, fontSize: 12, fontWeight: '800' }}>Add</Text></Pressable>
              </View>
              <View style={{ flexDirection: 'row', gap: 4, borderBottomWidth: 1, borderBottomColor: border, marginBottom: 6 }}>
                {WATCH_TABS.map((x) => (
                  <Pressable key={x.k} onPress={() => setWTab(x.k)} style={{ paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 2, borderBottomColor: wTab === x.k ? th.accent : 'transparent', cursor: 'pointer' } as any}>
                    <Text style={{ color: wTab === x.k ? th.accent : th.dim, fontSize: 12.5, fontWeight: '800' }}>{x.label}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ flexDirection: 'row', paddingVertical: 6 }}>{th_('Symbol', 1.6)}{th_('Price', 1, true)}{th_('Change', 1, true)}<View style={{ width: 26 }} /></View>
              {watchList.map((s) => {
                const lq = quotes[s.id], c = chg(s.id), on = s.id === symId;
                return (
                  <Pressable key={s.id} onPress={() => setSymId(s.id)} style={((x: any) => ({ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderTopWidth: 1, borderTopColor: border, cursor: 'pointer', backgroundColor: on ? th.accent + '10' : x.hovered ? th.accent + '08' : 'transparent' })) as any}>
                    <View style={{ flex: 1.6, flexDirection: 'row', alignItems: 'center', gap: 9 }}><Coin s={s} size={26} /><Text style={{ color: ink, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>{s.name}</Text></View>
                    <Text style={{ flex: 1, color: ink, fontSize: 13, textAlign: 'right' }}>{lq ? lq.price.toFixed(lq.dec) : '…'}</Text>
                    <Text style={{ flex: 1, color: c >= 0 ? th.buy : th.sell, fontSize: 12.5, fontWeight: '700', textAlign: 'right' }}>{lq ? `${c >= 0 ? '+' : ''}${c.toFixed(2)}%` : ''}</Text>
                    <Pressable onPress={() => toggleFav(s.id)} style={{ width: 26, alignItems: 'flex-end' }}><Icon name={db.favs.includes(s.id) ? 'star' : 'star-outline'} size={15} color={db.favs.includes(s.id) ? th.gold : th.dim} /></Pressable>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ borderRadius: 16, overflow: 'hidden', padding: 20, minHeight: 170, justifyContent: 'center' }}>
              <LinearGradient colors={['#2A2D9B', '#4B3FD6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>Trade Smarter, Not Harder</Text>
              <Text style={{ color: '#DDE3FF', fontSize: 12.5, lineHeight: 18, marginTop: 8, maxWidth: 230 }}>Use our advanced tools, real-time data and expert analysis to stay ahead in the markets.</Text>
              <ExploreBtn />
            </View>
          </View>
        </View>

        {/* ---- positions / trade panel / stats */}
        <View style={{ flexDirection: stack ? 'column' : 'row', gap: 20, alignItems: 'flex-start' }}>
          <View style={{ flex: 1.5, width: stack ? '100%' : undefined, minWidth: 0, gap: 20 }}>
            <View style={{ ...cardSt, padding: 16 } as any}>
              {head('trending-up', 'Open Positions', positions.length > 1 ? <Pressable onPress={() => positions.forEach((p) => { const m = mark(p); if (m) closePos(p.id, m); })} style={{ cursor: 'pointer' } as any}><Text style={{ color: th.sell, fontSize: 12, fontWeight: '800' }}>Close all</Text></Pressable> : undefined)}
              <View style={{ flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: soft }}>{th_('Symbol', 1.3)}{th_('Type')}{th_('Lots')}{th_('Open Price')}{th_('Current Price')}{th_('P/L', 1, true)}<View style={{ width: 34 }} /></View>
              {positions.length === 0 && <Text style={{ color: th.dim, fontSize: 13, textAlign: 'center', padding: 22 }}>No open positions. Choose BUY or SELL in the Trade Panel and press Place Order.</Text>}
              {positions.map((p) => {
                const m = mark(p), pnl = m !== undefined ? totalPnl(p, m) : p.realized, c = pnl >= 0 ? th.buy : th.sell, s = symOf(p.symId);
                return (
                  <Pressable key={p.id} onPress={() => setSheet({ id: p.id })} style={((x: any) => ({ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: border, cursor: 'pointer', backgroundColor: x.hovered ? th.accent + '08' : 'transparent' })) as any}>
                    <View style={{ flex: 1.3, flexDirection: 'row', alignItems: 'center', gap: 9 }}><Coin s={s} size={26} /><Text style={{ color: ink, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>{p.name}</Text></View>
                    <View style={{ flex: 1 }}>{badge(p.side)}</View>
                    <Text style={{ flex: 1, color: ink, fontSize: 13 }}>{fmtLots(p.lots)}</Text>
                    <Text style={{ flex: 1, color: ink, fontSize: 13 }}>{p.open.toFixed(p.dec)}</Text>
                    <Text style={{ flex: 1, color: ink, fontSize: 13 }}>{m !== undefined ? m.toFixed(p.dec) : '…'}</Text>
                    <Text style={{ flex: 1, color: c, fontSize: 13, fontWeight: '800', textAlign: 'right' }}>{usd(pnl)}</Text>
                    <Pressable onPress={() => { if (m) closePos(p.id, m); }} accessibilityLabel={`Close ${p.name}`} style={{ width: 34, alignItems: 'flex-end', cursor: 'pointer' } as any}><Icon name="close-circle-outline" size={19} color={th.dim} /></Pressable>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ ...cardSt, padding: 16 } as any}>
              {head('receipt-outline', 'Recent Trades', <Pressable onPress={() => setHistOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, cursor: 'pointer' } as any}><Text style={{ color: th.accent, fontSize: 12, fontWeight: '800' }}>View All</Text><Icon name="arrow-forward" size={12} color={th.accent} /></Pressable>)}
              <View style={{ flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: soft }}>{th_('Symbol', 1.3)}{th_('Type')}{th_('Lots')}{th_('Open Price')}{th_('Close Price')}{th_('P/L', 1, true)}</View>
              {demoTrades.length === 0 && <Text style={{ color: th.dim, fontSize: 13, textAlign: 'center', padding: 22 }}>Closed demo trades appear here.</Text>}
              {[...demoTrades].reverse().slice(0, 4).map((j) => {
                const s = SYMBOLS.find((x) => x.name === j.symbol) ?? symOf(j.symbol), c = j.pnl >= 0 ? th.buy : th.sell, d = Math.max(2, priceDec(j.exit || j.entry || 1));
                return (
                  <View key={j.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: border }}>
                    <View style={{ flex: 1.3, flexDirection: 'row', alignItems: 'center', gap: 9 }}><Coin s={s} size={26} /><Text style={{ color: ink, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>{j.symbol}</Text></View>
                    <View style={{ flex: 1 }}>{badge(j.side)}</View>
                    <Text style={{ flex: 1, color: ink, fontSize: 13 }}>{j.lots !== undefined ? fmtLots(j.lots) : '-'}</Text>
                    <Text style={{ flex: 1, color: ink, fontSize: 13 }}>{Number(j.entry).toFixed(d)}</Text>
                    <Text style={{ flex: 1, color: ink, fontSize: 13 }}>{Number(j.exit).toFixed(d)}</Text>
                    <Text style={{ flex: 1, color: c, fontSize: 13, fontWeight: '800', textAlign: 'right' }}>{usd(j.pnl)}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={{ ...cardSt, width: stack ? '100%' : 330, padding: 16 } as any}>
            {head('swap-vertical', 'Trade Panel')}
            <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: border, marginBottom: 14 }}>
              {[['Market', true], ['Pending', false], ['Stop', false]].map(([l, on]) => (
                <View key={String(l)} style={{ flex: 1, alignItems: 'center', paddingVertical: 9, borderBottomWidth: 2, borderBottomColor: on ? th.accent : 'transparent', opacity: on ? 1 : 0.45 }}>
                  <Text style={{ color: on ? th.accent : th.dim, fontSize: 12.5, fontWeight: '800' }}>{String(l)}</Text>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {(['buy', 'sell'] as const).map((s) => {
                const on = side === s, c = s === 'buy' ? th.buy : th.sell;
                return (
                  <Pressable key={s} onPress={() => setSide(s)} style={((x: any) => ({ flex: 1, height: 62, borderRadius: 10, alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backgroundColor: on ? c : c + '1A', borderWidth: 1, borderColor: c, opacity: x.hovered ? 0.92 : 1 })) as any}>
                    <Text style={{ color: on ? '#fff' : c, fontSize: 14, fontWeight: '900' }}>{s.toUpperCase()}</Text>
                    <Text style={{ color: on ? '#fff' : c, fontSize: 14, fontWeight: '700' }}>{(s === 'buy' ? ask : bid)?.toFixed(dec) ?? '…'}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ color: th.dim, fontSize: 12, marginTop: 14, marginBottom: 6 }}>Volume (Lots)</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', height: 42, borderRadius: 10, borderWidth: 1, borderColor: lotsErr ? th.sell : border }}>
              <Pressable onPress={() => bump(-1)} style={{ width: 42, alignItems: 'center', cursor: 'pointer' } as any}><Icon name="remove-circle-outline" size={20} color={th.dim} /></Pressable>
              <TextInput value={lotsTxt} onChangeText={(v) => setLots(v.replace(/[^0-9.,]/g, '').slice(0, 8))} style={{ flex: 1, textAlign: 'center', color: ink, fontSize: 15, fontWeight: '700', outlineStyle: 'none' } as any} />
              <Pressable onPress={() => bump(1)} style={{ width: 42, alignItems: 'center', cursor: 'pointer' } as any}><Icon name="add" size={20} color={th.dim} /></Pressable>
            </View>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
              {spec.chips.slice(0, 5).map((c) => <Pressable key={c} onPress={() => setLots(String(c))} style={{ flex: 1, height: 28, borderRadius: 7, borderWidth: 1, borderColor: lots === c ? th.accent : border, backgroundColor: lots === c ? th.accent + '14' : 'transparent', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' } as any}><Text style={{ color: lots === c ? th.accent : th.dim, fontSize: 11.5, fontWeight: '700' }}>{fmtLots(c)}</Text></Pressable>)}
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
              {([['Stop Loss (Price)', slTxt, setSlTxt], ['Take Profit (Price)', tpTxt, setTpTxt]] as const).map(([l, v, f]) => (
                <View key={l} style={{ flex: 1 }}>
                  <Text style={{ color: th.dim, fontSize: 12, marginBottom: 6 }}>{l}</Text>
                  <TextInput value={v} onChangeText={(x) => f(x.replace(/[^0-9.,]/g, ''))} placeholder={px ? px.toFixed(dec) : ''} placeholderTextColor={th.dim + '99'} style={{ height: 40, borderRadius: 10, borderWidth: 1, borderColor: border, textAlign: 'center', color: ink, fontSize: 13.5, outlineStyle: 'none' } as any} />
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}>
              <Text style={{ flex: 1, color: th.dim, fontSize: 12.5 }}>Estimated P/L</Text>
              <Text style={{ color: estPnl === undefined ? th.dim : estPnl >= 0 ? th.buy : th.sell, fontSize: 14, fontWeight: '800' }}>{estPnl === undefined ? '-' : usd(estPnl)}</Text>
              {estPnl !== undefined && <Text style={{ color: th.dim, fontSize: 11, marginLeft: 4 }}>at take profit</Text>}
            </View>
            <Pressable onPress={place} accessibilityRole="button" style={((x: any) => ({ marginTop: 16, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, cursor: 'pointer', opacity: x.hovered ? 0.92 : 1 })) as any}>
              <LinearGradient colors={['#5B3FD9', '#7B4DF0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 12 }} />
              <Icon name="flash" size={17} color="#fff" /><Text style={{ color: '#fff', fontSize: 14.5, fontWeight: '800' }}>Place Order</Text>
            </Pressable>
          </View>

          <View style={{ ...cardSt, width: stack ? '100%' : 300, padding: 16 } as any}>
            {head('stats-chart', 'Live Stats', <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 6, backgroundColor: th.buy + '1F' }}><Text style={{ color: th.buy, fontSize: 11, fontWeight: '800' }}>● Live</Text></View>)}
            {([['Balance', money(balance), ink], ['Equity', money(equity), ink], ['Free Margin', money(free), ink], ['Used Margin', money(used), ink], ['Margin Level', used > 0 ? `${level.toFixed(2)}%` : '-', used > 0 ? (level >= 100 ? th.buy : th.sell) : th.dim]] as const).map(([l, v, c]) => (
              <View key={l} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 10, marginBottom: 6, borderRadius: 8, backgroundColor: soft }}>
                <Text style={{ flex: 1, color: th.dim, fontSize: 12.5 }}>{l}</Text><Text style={{ color: c, fontSize: 13.5, fontWeight: '800' }}>{v}</Text>
              </View>
            ))}
            <Sparkline data={curve} color={th.accent} />
          </View>
        </View>

        {/* ---- feature strip */}
        <View style={{ ...cardSt, flexDirection: 'row', flexWrap: 'wrap', padding: 18, gap: 18 }}>
          {[['flash-outline', 'Real-Time Execution', 'Ultra-fast trade execution with low slippage.'], ['bar-chart-outline', 'Advanced Charts', 'Professional tools for technical analysis.'], ['layers-outline', 'Multi-Asset Access', 'Forex, Crypto, Indices, Metals and more.'], ['shield-checkmark-outline', 'Secure & Reliable', 'Your data and funds are always protected.']].map(([ic, t1, t2]) => (
            <View key={t1} style={{ flex: 1, minWidth: 220, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: th.accent + '1A', alignItems: 'center', justifyContent: 'center' }}><Icon name={ic} size={20} color={th.accent} /></View>
              <View style={{ flex: 1 }}><Text style={{ color: ink, fontSize: 13, fontWeight: '800' }}>{t1}</Text><Text style={{ color: th.dim, fontSize: 11.5, lineHeight: 16 }}>{t2}</Text></View>
            </View>
          ))}
        </View>
      </View>
      <PageFooter />
      {sheet && <PositionSheet posId={sheet.id} focus={sheet.focus} onClose={() => setSheet(null)} />}
    </ScrollView>
  );
}

function ExploreBtn() {
  const { setTab } = useApp();
  return (
    <Pressable onPress={() => setTab(1)} style={((x: any) => ({ alignSelf: 'flex-start', marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 8, height: 38, paddingHorizontal: 16, borderRadius: 9, backgroundColor: '#FFFFFF', cursor: 'pointer', opacity: x.hovered ? 0.92 : 1 })) as any}>
      <Text style={{ color: '#3A2FB8', fontSize: 13, fontWeight: '800' }}>Explore Analysis</Text><Icon name="arrow-forward" size={14} color="#3A2FB8" />
    </Pressable>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 268, h = 110, lo = Math.min(...data), hi = Math.max(...data), span = hi - lo || 1;
  const pts = data.map((v, i) => [data.length > 1 ? (i / (data.length - 1)) * w : 0, h - 8 - ((v - lo) / span) * (h - 22)]);
  const line = pts.map((p) => p.join(',')).join(' '), area = `M0,${h} L${pts.map((p) => p.join(',')).join(' L')} L${w},${h} Z`;
  return (
    <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} style={{ marginTop: 10 }}>
      <Defs><SvgGrad id="sg" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={color} stopOpacity="0.28" /><Stop offset="1" stopColor={color} stopOpacity="0" /></SvgGrad></Defs>
      <Path d={area} fill="url(#sg)" /><Polyline points={line} fill="none" stroke={color} strokeWidth={2} />
    </Svg>
  );
}
