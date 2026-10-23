import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import Modal from './Modal';
import { useWindowDimensions } from './win';
import Svg, { Line, Rect, G, Polyline, Text as SvgText } from 'react-native-svg';
import { useApp } from './store';
import { Card, Dim, Body, Btn, Field, Segment, Icon, SectionHeader, Badge } from './ui';
import GlassBackdrop from './Glass';
import { signal } from './ta';
import { useZoom, ChartHud } from './ChartZoom';
import { ScrollLockContext } from './scrollLock';
import ChartWeb from './ChartWeb';
import TradingViewPanel from './TradingViewPanel';
import { tvSymbol, tvHtml, matchSymbol, TV_INTERVAL, DERIV_CHARTS, TV_STUDIES } from './tv';
import { manualTarget, MANUAL_TAB } from './manualTarget';
import { Sym, Candle, SYMBOLS, symOf, isBad, TFS, candleLeft, fmtLeft, useFeed, watchCandles, setWatch, chg, toggleFav, addAlert, removeAlert, SESSIONS, sessionOpen, fxWeekendClosed, spreadOf } from './markets';

export function Sessions() {
  const { th, t } = useApp();
  const [now, setNow] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(i); }, []);
  const h = now.getUTCHours(), closed = fxWeekendClosed(now);
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        <Dim>{t('sessions')}</Dim>
        <Text style={{ color: closed ? th.sell : th.buy, fontSize: 12, fontWeight: '700' }}>{closed ? t('fxClosed') : t('fxOpen')}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {SESSIONS.map((s) => {
          const on = !closed && sessionOpen(h, s.s, s.e);
          return (
            <View key={s.n} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: on ? th.buy : th.line, backgroundColor: on ? th.buy + '22' : 'transparent' }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: on ? th.buy : th.dim, marginBottom: 6 }} />
              <Text style={{ color: on ? th.text : th.dim, fontSize: 11, fontWeight: '700' }}>{s.n}</Text>
            </View>
          );
        })}
      </View>
      <View style={{ height: 6 }} />
      <Dim>{t('sessionsNote')}</Dim>
    </Card>
  );
}

type Level = { label: string; price: number; color: string };

// One tap from a pair's chart to the Manual Trade screen (MT5 style SELL / BUY bar) with this pair already chosen. The chart window closes behind it.
function TradeThisPair({ symId, onClose }: { symId: string; onClose: () => void }) {
  const { th, setTab } = useApp();
  return (
    <Pressable onPress={() => { manualTarget.sym = symId; onClose(); setTab(MANUAL_TAB); }} accessibilityRole="button" accessibilityLabel="Trade this pair" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, borderRadius: 8, paddingHorizontal: 14, backgroundColor: th.accent + '1A', borderWidth: 1, borderColor: th.accent + '77', opacity: pressed ? 0.85 : 1 })}>
      <Icon name="swap-vertical" size={20} color={th.accent} />
      <Text style={{ flex: 1, color: th.text, fontWeight: '900', fontSize: 14 }}>Trade this pair · SELL / BUY</Text>
      <Icon name="chevron-forward" size={16} color={th.dim} />
    </Pressable>
  );
}

export function CandleChart({ data: all, width: fullW, dec, height = 270, ema20: e20all, ema50: e50all, levels = [], gran }: { data: Candle[]; width: number; dec: number; height?: number; ema20?: number[]; ema50?: number[]; levels?: Level[]; gran?: number }) {
  const { th } = useApp();
  const width = fullW; // no scroll bars: zoom like MT5 (pinch, drag, drag the price axis)
  const z = useZoom(all.length, width - 62, height);
  // Candle timer: ticks every second so the time left on the running candle counts down live.
  const [tick, setTick] = useState(Date.now());
  useEffect(() => { if (!gran) return; const id = setInterval(() => setTick(Date.now()), 1000); return () => clearInterval(id); }, [gran]);
  if (all.length < 2) return <View style={{ height, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={th.accent} /></View>;
  const data = all.slice(z.start, z.end), ema20 = e20all?.slice(z.start, z.end), ema50 = e50all?.slice(z.start, z.end);
  const padR = 62, W = width - padR;
  const lv = levels.filter((l) => isFinite(l.price));
  const { hi, lo } = z.fitY(Math.max(...data.map((c) => c.h), ...lv.map((l) => l.price)), Math.min(...data.map((c) => c.l), ...lv.map((l) => l.price))), rng = hi - lo || 1;
  const y = (v: number) => 8 + (1 - (v - lo) / rng) * (height - 16);
  const step = W / z.slots, bw = Math.max(1, step * 0.66);
  const last = all[all.length - 1], lc = last.c >= last.o ? th.buy : th.sell;
  const line = (v?: number[]) => (v ?? []).map((n, i) => (isFinite(n) ? `${i * step + step / 2},${y(n)}` : '')).filter(Boolean).join(' ');
  return (
    <View style={{ direction: 'ltr' }}>
     <View style={{ flexDirection: 'row' }}>
      <View {...z.handlers} style={{ width }}>
      <Svg width={width} height={height} style={{ overflow: 'hidden' }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
          const v = lo + f * rng;
          return (
            <G key={i}>
              <Line x1={0} x2={W} y1={y(v)} y2={y(v)} stroke={th.line} strokeWidth={0.6} />
              <SvgText x={W + 4} y={y(v) + 3} fontSize={9} fill={th.dim}>{v.toFixed(dec)}</SvgText>
            </G>
          );
        })}
        {data.map((c, i) => {
          const col = c.c >= c.o ? th.buy : th.sell, x = i * step + step / 2;
          return (
            <G key={`${c.t}-${i}`}>
              <Line x1={x} x2={x} y1={y(c.h)} y2={y(c.l)} stroke={col} strokeWidth={1} />
              <Rect x={x - bw / 2} y={Math.min(y(c.o), y(c.c))} width={bw} height={Math.max(1, Math.abs(y(c.o) - y(c.c)))} fill={col} />
            </G>
          );
        })}
        {ema20 && <Polyline points={line(ema20)} fill="none" stroke={th.gold} strokeWidth={1.5} />}
        {ema50 && <Polyline points={line(ema50)} fill="none" stroke={th.poi} strokeWidth={1.5} />}
        {lv.map((l, i) => (
          <G key={i}>
            <Line x1={0} x2={W} y1={y(l.price)} y2={y(l.price)} stroke={l.color} strokeWidth={1.2} strokeDasharray="6 3" />
            <SvgText x={4} y={y(l.price) - 3} fontSize={9} fontWeight="700" fill={l.color}>{l.label} {l.price.toFixed(dec)}</SvgText>
          </G>
        ))}
        <Line x1={0} x2={W} y1={y(last.c)} y2={y(last.c)} stroke={lc} strokeWidth={1} strokeDasharray="4 3" />
        <Rect x={W} y={y(last.c) - 8} width={padR} height={16} fill={lc} />
        <SvgText x={W + 4} y={y(last.c) + 4} fontSize={10} fontWeight="700" fill="#0E1116">{last.c.toFixed(dec)}</SvgText>
        {!!gran && (() => {
          const left = candleLeft(gran, tick), ty = y(last.c) + 9 + 16 > height ? y(last.c) - 8 - 16 : y(last.c) + 9;
          return (
            <G>
              <Rect x={W} y={ty} width={padR} height={16} fill={th.panel} stroke={lc} strokeWidth={1} />
              <SvgText x={W + padR / 2} y={ty + 11.5} fontSize={10} fontWeight="800" fill={lc} textAnchor="middle">{fmtLeft(left)}</SvgText>
            </G>
          );
        })()}
      </Svg>
      <ChartHud z={z} top={height - 46} right={padR + 8} />
      </View>
     </View>
    </View>
  );
}

const Chip = ({ label, on, color, onPress }: { label: string; on: boolean; color: string; onPress: () => void }) => {
  const { th } = useApp();
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: on ? color : th.line, backgroundColor: on ? color + '22' : 'transparent' }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ color: on ? th.text : th.dim, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
};

const TINTS = ['#6366F1', '#F59E0B', '#10B981', '#EC4899', '#06B6D4', '#8B5CF6', '#F97316', '#14B8A6'];
const tint = (s: string) => TINTS[[...s].reduce((a, ch) => a + ch.charCodeAt(0), 0) % TINTS.length];

// Round coin / pair badge: the base asset letters on a tinted tile. Used by the Markets list and the pair screen.
export const Coin = ({ s, size = 42 }: { s: Sym; size?: number }) => {
  const base = s.name.split('/')[0].replace(/[^A-Za-z0-9]/g, '') || s.id, c = tint(base);
  const label = s.cat === 'deriv' ? base.slice(0, 1) + (s.name.match(/\d+/)?.[0]?.slice(0, 3) ?? '') : base.slice(0, 4).toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: 8, backgroundColor: c + '22', borderWidth: 1, borderColor: c + '55', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: c, fontWeight: '900', fontSize: label.length > 3 ? size * 0.25 : size * 0.3 }} numberOfLines={1} adjustsFontSizeToFit>{label}</Text>
    </View>
  );
};

// Small glass square button (back, star, full screen) used in the pair screen header.
const GlassTile = ({ icon, onPress, color, disabled }: { icon: string; onPress: () => void; color?: string; disabled?: boolean }) => {
  const { th } = useApp();
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={6} style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: th.panel, borderWidth: 1, borderColor: th.line, opacity: pressed ? 0.8 : 1 })}>
      <Icon name={icon} size={22} color={color ?? th.text} />
    </Pressable>
  );
};

// Little price line for the hero card.
const HeroSpark = ({ pts, color, w = 120, h = 52 }: { pts: number[]; color: string; w?: number; h?: number }) => {
  if (pts.length < 2) return <View style={{ width: w, height: h }} />;
  const min = Math.min(...pts), max = Math.max(...pts), rng = max - min || 1;
  const p = pts.map((v, i) => `${(i / (pts.length - 1)) * w},${h - 3 - ((v - min) / rng) * (h - 6)}`).join(' ');
  return <Svg width={w} height={h}><Polyline points={`0,${h} ${p} ${w},${h}`} fill={color + '18'} stroke="none" /><Polyline points={p} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" /></Svg>;
};

// One stat in the 2x2 grid under the chart: icon tile, small caps label, value.
const Stat = ({ icon, label, value, color }: { icon: string; label: string; value: string; color?: string }) => {
  const { th } = useApp();
  return (
    <Card style={{ flex: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: (color ?? th.accent) + '22' }}><Icon name={icon} size={17} color={color ?? th.accent} /></View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8 }} numberOfLines={1}>{label.toUpperCase()}</Text>
        <Text style={{ color: color ?? th.text, fontSize: 16.5, fontWeight: '900', fontVariant: ['tabular-nums'] }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      </View>
    </Card>
  );
};

// Full-screen pair picker (an overlay, not a nested Modal). Star any pair here; tap a row to switch the sheet to it.
function PairPicker({ current, onPick, onClose }: { current: string; onPick: (s: Sym) => void; onClose: () => void }) {
  const { th, t } = useApp();
  const { db } = useFeed(true);
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const ok = (s: Sym) => !isBad(s.id);
  const list = (term
    ? SYMBOLS.filter((s) => ok(s) && (s.name + s.id).toLowerCase().includes(term))
    : [...db.favs.map(symOf).filter(ok), ...SYMBOLS.filter((s) => ok(s) && !db.favs.includes(s.id))]
  ).slice(0, 80);
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: th.bg, paddingTop: 52, paddingHorizontal: 16 }}>
      <GlassBackdrop />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <GlassTile icon="chevron-back" onPress={onClose} />
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: th.panel, borderColor: th.line, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, height: 42 }}>
          <Icon name="search" size={18} color={th.dim} />
          <TextInput autoFocus value={q} onChangeText={setQ} placeholder={t('search')} placeholderTextColor={th.dim} autoCapitalize="none" style={{ flex: 1, color: th.text, paddingHorizontal: 10, paddingVertical: 0 }} />
          {!!q && <Pressable onPress={() => setQ('')} hitSlop={10}><Icon name="close-circle" size={18} color={th.dim} /></Pressable>}
        </View>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 40 }}>
        {list.length === 0 && <Body color={th.dim}>{t('noMatch')}</Body>}
        {list.map((s) => {
          const fav = db.favs.includes(s.id), on = s.id === current;
          return (
            <Pressable key={s.id} onPress={() => onPick(s)} style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}>
              <Card glow={on} style={{ flexDirection: 'row', alignItems: 'center', padding: 10, gap: 12 }}>
                <Coin s={s} size={38} />
                <View style={{ flex: 1 }}><Text style={{ color: th.text, fontWeight: '800', fontSize: 14.5 }} numberOfLines={1}>{s.name}</Text><Text style={{ color: th.dim, fontSize: 11.5 }} numberOfLines={1}>{s.id}</Text></View>
                {on && <Badge label="OPEN" />}
                <Pressable onPress={() => toggleFav(s.id)} hitSlop={10}><Icon name={fav ? 'star' : 'star-outline'} size={20} color={fav ? th.gold : th.dim} /></Pressable>
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function SymbolSheet({ sym: picked, onClose }: { sym: Sym | null; onClose: () => void }) {
  const { th, t, rtl } = useApp();
  const { width, height } = useWindowDimensions();
  // `picked` is the market that was tapped in the list. `ov` is the pair the user switched to afterwards (picker, or the chart's own
  // symbol box). The header, price, star, candles and alerts all use `sym`, the pair that is active right now.
  const [ov, setOv] = useState<{ from: string; sym: Sym } | null>(null);
  const [pick, setPick] = useState(false);
  const [note, setNote] = useState('');
  const [flash, setFlash] = useState('');
  const sym = picked ? (ov && ov.from === picked.id ? ov.sym : picked) : null;
  useEffect(() => { if (!picked) { setOv(null); setPick(false); setNote(''); setFlash(''); } }, [picked?.id]);
  const { quotes, db } = useFeed(!!sym);
  const [mode, setMode] = useState('tv');
  const [full, setFull] = useState(false);
  const [tf, setTf] = useState('900');
  const [data, setData] = useState<Candle[]>([]);
  const [err, setErr] = useState('');
  const [src, setSrc] = useState('');
  const [nonce, setNonce] = useState(0);
  const [lvl, setLvl] = useState('');
  const [studies, setStudies] = useState<string[]>(['vol']); // TradingView volume study on by default
  const [cstyle, setCstyle] = useState('1'); // TradingView chart style (candles, hollow, Heikin Ashi, bars, line, area)
  const [lock, setLock] = useState(false); // a finger is on a web chart: the page must not scroll, so pinch zoom and drag go to the chart

  useEffect(() => {
    if (!sym) return;
    setWatch('sheet', [sym.id]);
    return () => setWatch('sheet', []);
  }, [sym?.id]);
  useEffect(() => { setFull(false); }, [picked?.id]);

  useEffect(() => {
    if (!sym) return;
    setData([]); setErr(''); setSrc('');
    return watchCandles(sym.id, Number(tf), (c) => { setErr(''); setData(c); }, setErr, setSrc);
  }, [sym?.id, tf, nonce]);

  // Hooks must run on EVERY render. This call used to sit below the early returns, so opening a pair (null -> pair) or
  // toggling full screen changed the hook count and React crashed: that was the black screen.

  if (!sym || !picked) return null;
  const switchTo = (s: Sym) => { if (s.id === sym.id) return; setOv({ from: picked.id, sym: s }); setNote(''); };
  // The pair named inside a Deriv / My chart page. Unknown names never touch the header (they would break price and star).
  const follow = (raw: string) => {
    const m = matchSymbol(raw) ?? (mode === 'deriv' && /^[A-Za-z0-9_]{3,24}$/.test(raw) ? symOf(raw) : null);
    if (m) switchTo(m); else setNote(raw);
  };
  const canPick = mode === 'tv';
  // TV pages are rebuilt for each pair, so they re-key on it. Page charts (Deriv, My chart) must NOT reload when the header follows them.
  const wkey = mode === 'tv' ? sym.id + studies.join('') + cstyle + tf : picked.id;
  const tv = tvSymbol(sym);
  const web = mode === 'tv' ? (tv ? { html: tvHtml(tv, TV_INTERVAL[tf] ?? '15', th.dark, th.bg, TV_STUDIES.filter((x) => studies.includes(x.k)).map((x) => x.id), cstyle) } : null) : mode === 'deriv' ? { uri: DERIV_CHARTS } : null;
  // Deriv's own chart site can fail to load on some networks (net::ERR_NAME_NOT_RESOLVED). Then show the same market on TradingView,.
  const fbHtml = mode === 'deriv' && tv ? tvHtml(tv, TV_INTERVAL[tf] ?? '15', th.dark, th.bg, []) : undefined;
  const webExtra = mode === 'deriv' ? { fallbackHtml: fbHtml } : {};
  if (full && web) {
    return (
      <Modal visible animationType="fade" onRequestClose={() => setFull(false)}>
        <View style={{ flex: 1, backgroundColor: th.bg, paddingTop: 44 }}>
          <GlassBackdrop />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingBottom: 10 }}>
            <GlassTile icon="chevron-back" onPress={() => setFull(false)} />
            <Coin s={sym} size={34} />
            <Text style={{ color: th.text, fontWeight: '900', fontSize: 17, flex: 1 }} numberOfLines={1}>{sym.name}</Text>
          </View>
          <ChartWeb key={`f-${wkey}-${mode}`} {...web} {...webExtra} onSymbol={follow} />
        </View>
      </Modal>
    );
  }
  const q = quotes[sym.id], dec = q?.dec ?? 4, c = chg(sym.id), col = c >= 0 ? th.buy : th.sell;
  const hi = data.length ? Math.max(...data.map((x) => x.h)) : undefined, lo = data.length ? Math.min(...data.map((x) => x.l)) : undefined;
  const mine = db.alerts.filter((a) => a.sym === sym.id);
  const fav = db.favs.includes(sym.id);
  const closes = data.map((x) => x.c);
  const sig = data.length > 20 ? signal(data) : null;
  const sc = sig ? (sig.dir === 'buy' ? th.buy : sig.dir === 'sell' ? th.sell : th.gold) : th.dim;
  const setAlert = (dir: 'above' | 'below') => {
    const v = parseFloat(lvl.replace(',', '.'));
    if (!isFinite(v)) return;
    addAlert(sym.id, v, dir); setLvl('');
  };

  const up = c >= 0, last = closes.length ? closes[closes.length - 1] : undefined;
  const shownPrice = q ? q.price.toFixed(dec) : last !== undefined ? last.toFixed(dec) : '—';
  const live = !!q, spr = spreadOf(sym.id);
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: th.bg, direction: rtl ? 'rtl' : 'ltr' }}>
        <GlassBackdrop />

        {/* header: back, pair (tap to switch), star */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 48, paddingBottom: 10 }}>
          <GlassTile icon="chevron-back" onPress={onClose} />
          <Pressable disabled={!canPick} onPress={() => setPick(true)} style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, height: 42, paddingHorizontal: 8, borderRadius: 8, backgroundColor: th.panel, borderWidth: 1, borderColor: th.line, opacity: pressed ? 0.85 : 1 })}>
            <Coin s={sym} size={28} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: th.text, fontSize: 15.5, fontWeight: '900', letterSpacing: -0.2 }}>{sym.name}</Text>
              <Text numberOfLines={1} style={{ color: th.dim, fontSize: 10.5 }}>{sym.id}</Text>
            </View>
            {canPick && <Icon name="chevron-down" size={18} color={th.accent} />}
          </Pressable>
          <GlassTile icon={fav ? 'star' : 'star-outline'} color={fav ? th.gold : th.dim} onPress={() => toggleFav(sym.id)} />
        </View>

        <ScrollLockContext.Provider value={setLock}>
        <ScrollView scrollEnabled={!lock} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingTop: 6, paddingBottom: 48, gap: 14 }} keyboardShouldPersistTaps="handled">
          {/* hero: price, change, mini line, status */}
          <Card glow style={{ padding: 16, gap: 12, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: live ? th.buy : th.gold }} />
                <Text style={{ color: live ? th.buy : th.gold, fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>{live ? t('live').toUpperCase() : '···'}</Text>
              </View>
              {!!sym.sub && <Badge label={sym.sub.toUpperCase()} color={th.accent2} />}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
              <View style={{ flex: 1, gap: 8 }}>
                <Text style={{ color: th.text, fontSize: 36, fontWeight: '900', letterSpacing: -1, fontVariant: ['tabular-nums'] }} numberOfLines={1} adjustsFontSizeToFit>{shownPrice}</Text>
                {!!spr && <Text style={{ color: th.dim, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] }} numberOfLines={1}>Bid {q!.bid!.toFixed(dec)} · Ask {q!.ask!.toFixed(dec)} · Spread {spr.text}</Text>}
                <View style={{ flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 4, backgroundColor: col + '24', borderColor: col + '55', borderWidth: 1, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 }}>
                  <Icon name={up ? 'trending-up' : 'trending-down'} size={15} color={col} />
                  <Text style={{ color: col, fontWeight: '900', fontSize: 13 }}>{up ? '+' : ''}{c.toFixed(2)}%</Text>
                </View>
              </View>
              <View style={{ direction: 'ltr' }}><HeroSpark pts={closes.slice(-60)} color={col} /></View>
            </View>
          </Card>

          {!!note && <Card style={{ padding: 10 }}><Text style={{ color: th.dim, fontSize: 12.5 }}>{t('chartShows')}: {note}</Text></Card>}
          {!!flash && <Card style={{ padding: 10 }}><Text style={{ color: th.text, fontSize: 12.5 }}>🔔 {flash}</Text></Card>}

          {/* chart */}
          <Segment value={mode} options={[{ k: 'tv', label: 'TradingView' }, { k: 'deriv', label: 'Deriv' }]} onChange={setMode} />
          <TradeThisPair symId={sym.id} onClose={onClose} />
          <View style={{ gap: 10 }}>
            {web ? (
              mode === 'tv' && tv ? (
                <TradingViewPanel symbol={tv} symId={sym.id} tf={tf} onTf={setTf} studies={studies} onStudies={setStudies} cstyle={cstyle} onStyle={setCstyle}
                  height={Math.round(height * 0.66)} onFull={() => setFull(true)} onSymbol={follow} onTouching={setLock} />
              ) : (
                <>
                  <View style={{ borderRadius: 8, borderWidth: 1, borderColor: th.line, overflow: 'hidden', backgroundColor: th.panel }}>
                    <ChartWeb key={`${wkey}-${mode}-${th.bg}`} {...web} {...webExtra} onSymbol={follow} onTouching={setLock} height={Math.round(height * 0.62)} />
                  </View>
                  <Btn ghost icon="expand-outline" label={t('fullScreen')} onPress={() => setFull(true)} />
                  <Text style={{ color: th.dim, fontSize: 11.5 }}>{t('derivHint')}</Text>
                </>
              )
            ) : (
              <Card><Body color={th.gold}>{t('noTv')}</Body></Card>
            )}
          </View>

          {/* stats */}
          <SectionHeader title={t('signal')} icon="pulse" />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Stat icon={sig?.dir === 'sell' ? 'arrow-down-circle' : sig?.dir === 'buy' ? 'arrow-up-circle' : 'remove-circle'} label={t('signal')} value={sig ? t(sig.dir) : '—'} color={sc} />
            <Stat icon="speedometer-outline" label="RSI 14" value={sig && isFinite(sig.rsi) ? sig.rsi.toFixed(1) : '—'} color={sig && sig.rsi > 70 ? th.sell : sig && sig.rsi < 30 ? th.buy : th.text} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Stat icon="arrow-up" label={t('rangeHi')} value={hi?.toFixed(dec) ?? '—'} color={th.buy} />
            <Stat icon="arrow-down" label={t('rangeLo')} value={lo?.toFixed(dec) ?? '—'} color={th.sell} />
          </View>

          {/* price alerts */}
          <SectionHeader title={t('alerts')} icon="notifications-outline" />
          <Card style={{ gap: 4 }}>
            <Field label={t('alertPrice')} value={lvl} onChangeText={setLvl} keyboardType="decimal-pad" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Btn ghost icon="arrow-up" label={t('alertAbove')} onPress={() => setAlert('above')} /></View>
              <View style={{ flex: 1 }}><Btn ghost icon="arrow-down" label={t('alertBelow')} onPress={() => setAlert('below')} /></View>
            </View>
            {mine.map((a) => (
              <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: 12, height: 42, borderRadius: 8, backgroundColor: th.panel2, borderWidth: 1, borderColor: th.hair }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Icon name={a.dir === 'above' ? 'arrow-up' : 'arrow-down'} size={16} color={a.dir === 'above' ? th.buy : th.sell} />
                  <Text style={{ color: th.text, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{a.level}</Text>
                </View>
                <Pressable onPress={() => removeAlert(a.id)} hitSlop={10}><Icon name="close-circle-outline" size={22} color={th.dim} /></Pressable>
              </View>
            ))}
            <View style={{ height: 6 }} />
            <Text style={{ color: th.dim, fontSize: 11.5 }}>{t('alertNote')}</Text>
          </Card>
        </ScrollView>
        </ScrollLockContext.Provider>
        {pick && <PairPicker current={sym.id} onPick={(s) => { switchTo(s); setPick(false); }} onClose={() => setPick(false)} />}
      </View>
    </Modal>
  );
}
