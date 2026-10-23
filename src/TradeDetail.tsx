import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StatusBar, ActivityIndicator } from 'react-native';
import { useWindowDimensions } from './win';
import Modal from './Modal';
import Svg, { Line, Rect, G, Circle, Polygon, Defs, ClipPath, Text as SvgText } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp, Trade } from './store';
import { Icon, confirmAction } from './ui';
import { fmtR, money, sourceName } from './trades';
import { fmtLots } from './lots';
import { Candle, SYMBOLS, TFS, watchCandles } from './markets';
import { useZoom, ChartHud, CrossLayer, Readout, fmtTime } from './ChartZoom';
import { MDEFS } from './MethodArt';
import { RadialWheel, Mt5Bar, WheelAction } from './Mt5Wheel';
import { niceTicks, niceEvery } from './smoothZoom';
import { ink } from './theme';

// Full trade view opened from Trade history: the method behind the trade, the plan (entry / stop / targets with R),
// the result, and a complete chart of the trade (entry, stop loss, take profits, exit, risk and reward areas).
const held = (a?: number, b?: number) => { if (!a || !b || b <= a) return ''; const m = Math.max(1, Math.round((b - a) / 60000)); return m < 60 ? `${m} min` : m < 1440 ? `${(m / 60).toFixed(1)} h` : `${(m / 1440).toFixed(1)} days`; };

// the method card (name, colours, description) that matches the saved source text, e.g. "ICT · OTE" -> ICT Analysis
const methodDef = (src?: string) => {
  const s = (src ?? '').toLowerCase();
  if (!s) return undefined;
  const key = s.includes('scalp') || s.includes('crt') || s.includes('s/d') || s.includes('divergence') ? 'scalp'
    : s.includes('smc') ? 'smc' : s.includes('ict') ? 'ict' : s.includes('vsa') ? 'vsa' : s.includes('candle') ? 'candle'
    : s.includes('pattern') || s.includes('pat') ? 'pat' : s.includes('top') ? 'topdown' : s.includes('scan') ? 'scanner'
    : s.includes('entry') ? 'entry' : s.includes('planner') ? 'planner' : s.includes('combined') || s.includes('all') ? 'all' : '';
  return MDEFS.find((m) => m.k === key);
};

function useTradeCandles(symId: string | undefined, gran: number, fromSec: number) {
  const [c, setC] = useState<Candle[]>([]);
  const [err, setErr] = useState(false);
  useEffect(() => {
    if (!symId || !isFinite(gran) || gran <= 0) { setErr(true); return; }
    let un: (() => void) | undefined, done = false;
    const count = Math.max(150, Math.min(2500, Math.ceil((Date.now() / 1000 - fromSec) / gran) + 10));
    const stop = () => { try { un?.(); } catch {} un = undefined; };
    setC([]); setErr(false);
    try {
      un = watchCandles(symId, gran, (x) => { if (done) return; if (x.length > 5) { done = true; setC(x); setErr(false); setTimeout(stop, 0); } }, () => { if (!done) setErr(true); }, undefined, count);
    } catch { setErr(true); }
    const to = setTimeout(() => { if (!done) setErr(true); }, 20000);
    return () => { done = true; clearTimeout(to); stop(); };
  }, [symId, gran, fromSec]);
  return { c, err };
}

export default function TradeDetail({ j, onClose }: { j: Trade; onClose: () => void }) {
  const { th, t, rtl, settings, removeTrade } = useApp();
  const insets = useSafeAreaInsets();
  const { width: sw } = useWindowDimensions();
  const d = j.dec ?? (j.entry >= 100 ? 2 : 5), f = (v: number) => v.toFixed(d);
  const buy = j.side === 'buy', c = j.pnl > 0 ? th.buy : j.pnl < 0 ? th.sell : th.dim;
  const def = methodDef(j.source);
  const symId = j.symId ?? SYMBOLS.find((x) => x.name.toLowerCase() === j.symbol.toLowerCase() || x.id.toLowerCase().endsWith(j.symbol.toLowerCase().replace(/[^a-z0-9]/g, '')))?.id;
  const baseGran = Number(j.tf) > 0 ? Number(j.tf) : 3600;
  const [gran, setGran] = useState(baseGran); // the MT5 wheel switches the timeframe of the replay
  const openMs = j.openedAt ?? j.date, closeMs = j.date, openT = openMs / 1000, closeT = closeMs / 1000;
  const span = Math.max(closeT - openT, gran * 3);
  const ctxBefore = Math.max(gran * 40, span * 1.2), ctxAfter = Math.max(gran * 14, span * 0.5);
  const { c: all, err } = useTradeCandles(symId, gran, openT - ctxBefore);

  // keep only the stretch of candles around the trade
  const data = useMemo(() => all.filter((x) => x.t >= openT - ctxBefore && x.t <= closeT + ctxAfter), [all, openT, closeT, ctxBefore, ctxAfter]);
  const covered = all.length > 0 && all[0].t <= openT + gran; // the saved candle history reaches back to the entry
  const at = (sec: number) => { let k = -1; data.forEach((x, i) => { if (x.t <= sec) k = i; }); return k; };
  const eI = data.length ? Math.max(0, at(openT)) : -1, xI = data.length ? Math.max(0, at(closeT)) : -1;

  const sl = j.sl, tps = j.tps ?? [], hits = j.hits ?? 0;
  const hasPlan = sl !== undefined && isFinite(sl);
  const risk = hasPlan ? Math.abs(j.entry - (sl as number)) : 0;
  const kdir = buy ? 1 : -1;
  const rOf = (p: number) => (risk ? (kdir * (p - j.entry)) / risk : 0);
  const moved = j.stopEnd !== undefined && hasPlan && Math.abs(j.stopEnd - (sl as number)) > 1e-9;
  const whyTxt = t(j.why === 'tp' ? 'thWhyTp' : j.why === 'sl' ? 'thWhySl' : j.why === 'be' ? 'thWhyBe' : j.why === 'manual' ? 'thWhyManual' : 'thWhyEntry');

  const chartW = Math.min(sw - 28, 760), height = 380;

  return (
    <Modal animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: th.bg, direction: rtl ? 'rtl' : 'ltr' }}>
        {/* header */}
        <View style={{ paddingTop: Math.max(insets.top, StatusBar.currentHeight ?? 0, 24) + 14, paddingBottom: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: th.line, backgroundColor: th.panel, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('thClose')} style={{ width: 38, height: 38, borderRadius: 8, borderWidth: 1, borderColor: th.line, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={rtl ? 'arrow-forward' : 'arrow-back'} size={20} color={th.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={{ color: th.text, fontSize: 18, fontWeight: '900' }} numberOfLines={1}>{j.symbol} · <Text style={{ color: buy ? th.buy : th.sell }}>{t(j.side).toUpperCase()}</Text></Text>
            <Text style={{ color: th.dim, fontSize: 11.5 }} numberOfLines={1}>{new Date(closeMs).toLocaleString(settings.lang, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: c, fontSize: 18, fontWeight: '900' }}>{money(j.pnl)}</Text>
            {j.r !== undefined && <Text style={{ color: c, fontSize: 12, fontWeight: '800' }}>{fmtR(j.r)}</Text>}
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 14, gap: 14, paddingBottom: insets.bottom + 32 }}>
          {/* result banner */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: c + '66', backgroundColor: c + '14' }}>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: c, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={j.pnl > 0 ? 'trending-up' : j.pnl < 0 ? 'trending-down' : 'remove'} size={20} color={ink(c)} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: th.text, fontWeight: '900', fontSize: 15 }}>{j.pnl > 0 ? 'Winning trade' : j.pnl < 0 ? 'Losing trade' : 'Break-even trade'}</Text>
              <Text style={{ color: th.dim, fontSize: 12.5, marginTop: 1 }}>{whyTxt}{held(j.openedAt, j.date) ? ` · held ${held(j.openedAt, j.date)}` : ''}{hits ? ` · ${hits} of ${tps.length || hits} targets hit` : ''}</Text>
            </View>
          </View>

          {/* ---------- trade method ---------- */}
          <View style={{ backgroundColor: th.panel, borderWidth: 1, borderColor: th.line, borderRadius: 10, padding: 14, gap: 10 }}>
            <Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8 }}>TRADE METHOD</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: def ? def.colors[0] : th.accent, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={buy ? 'trending-up' : 'trending-down'} size={22} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: th.text, fontSize: 16, fontWeight: '900' }} numberOfLines={2}>{sourceName(j.source)}</Text>
                <Text style={{ color: th.dim, fontSize: 12.5, lineHeight: 18, marginTop: 2 }}>{def ? def.desc : 'Entered by hand. No method was attached to this trade.'}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {!!j.grade && chip('Grade', j.grade, th.accent)}
              {j.score !== undefined && chip('Score', `${Math.round(j.score)}/100`, th.gold)}
              {!!j.tf && chip('Timeframe', TFS.find((x) => x.k === String(j.tf))?.label ?? String(j.tf), th.text)}
              {chip('Direction', t(j.side).toUpperCase(), buy ? th.buy : th.sell)}
            </View>
            {!!j.reasons?.length && (
              <View style={{ gap: 6, marginTop: 2 }}>
                <Text style={{ color: th.text, fontWeight: '800', fontSize: 13 }}>Why this trade was taken</Text>
                {j.reasons.map((r, k) => (
                  <View key={k} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                    <Icon name="checkmark-circle" size={15} color={th.accent} />
                    <Text style={{ flex: 1, color: th.text, fontSize: 13, lineHeight: 19 }}>{r}</Text>
                  </View>
                ))}
              </View>
            )}
            {!!j.zone && <Text style={{ color: th.dim, fontSize: 12.5 }}>Entry zone: <Text style={{ color: th.text, fontWeight: '800' }}>{f(Math.min(...j.zone))} – {f(Math.max(...j.zone))}</Text></Text>}
          </View>

          {/* ---------- full chart ---------- */}
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8 }}>TRADE CHART</Text>
              <Text style={{ color: th.dim, fontSize: 11 }}>Pinch · tap for wheel · hold for crosshair</Text>
            </View>
            {!symId || err ? (
              <View style={{ height: 150, alignItems: 'center', justifyContent: 'center', backgroundColor: th.panel, borderRadius: 10, borderWidth: 1, borderColor: th.line, padding: 18, gap: 6 }}>
                <Icon name="analytics-outline" size={26} color={th.dim} />
                <Text style={{ color: th.dim, textAlign: 'center', fontSize: 12.5, lineHeight: 18 }}>{!symId ? 'This market is not in the chart list, so no candles can be drawn. The levels are listed below.' : 'Candles for this trade are not available (the data source could not be reached or the trade is older than its history). The levels are listed below.'}</Text>
              </View>
            ) : data.length < 5 ? (
              <View style={{ height: 150, alignItems: 'center', justifyContent: 'center', backgroundColor: th.panel, borderRadius: 10, borderWidth: 1, borderColor: th.line }}><ActivityIndicator color={th.accent} /></View>
            ) : (
              <View style={{ backgroundColor: th.panel, borderRadius: 10, borderWidth: 1, borderColor: th.line, paddingVertical: 8, alignItems: 'center' }}>
                <ReplayChart data={data} width={chartW} height={height} dec={d} gran={gran} j={j} eI={eI} xI={xI} onGran={(k) => setGran(Number(k))} />
              </View>
            )}
            {data.length >= 5 && !covered && <Text style={{ color: th.gold, fontSize: 11.5, lineHeight: 16 }}>The data source does not go back to the exact entry candle, so the entry marker is placed at the oldest candle shown.</Text>}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {legend(th.accent, 'Entry')}{hasPlan && legend(th.sell, 'Stop loss')}{tps.length > 0 && legend(th.buy, 'Take profit')}{legend(c, 'Exit')}
            </View>
          </View>

          {/* ---------- trade plan ---------- */}
          <View style={{ backgroundColor: th.panel, borderWidth: 1, borderColor: th.line, borderRadius: 10, padding: 14, gap: 2 }}>
            <Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8, marginBottom: 6 }}>TRADE PLAN</Text>
            {planRow('Entry', f(j.entry), th.accent, 'filled')}
            {hasPlan && planRow('Stop loss', f(sl as number), th.sell, `-1R${moved ? ' · moved' : ''}`)}
            {moved && planRow('Final stop', f(j.stopEnd as number), th.gold, fmtR(rOf(j.stopEnd as number)))}
            {tps.map((p, k) => planRow(`Take profit ${k + 1}`, f(p), th.buy, `${fmtR(rOf(p))}${k < hits ? ' ✓ hit' : ''}`, k < hits))}
            {planRow('Exit', f(j.exit), c, `${j.r !== undefined ? fmtR(j.r) : ''} · ${whyTxt}`)}
          </View>

          {/* ---------- stats ---------- */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {stat('Result', money(j.pnl), c)}
            {j.r !== undefined && stat('R multiple', fmtR(j.r), c)}
            {j.risk ? stat('Risked', money(-Math.abs(j.risk)).replace('-', ''), th.text) : null}
            {j.lots ? stat('Size', `${fmtLots(j.lots)} lots`, th.text) : null}
            {j.mfe !== undefined ? stat('Best (MFE)', fmtR(j.mfe), th.buy) : null}
            {j.mae !== undefined ? stat('Worst (MAE)', fmtR(j.mae), th.sell) : null}
            {held(j.openedAt, j.date) ? stat('Held for', held(j.openedAt, j.date), th.text) : null}
            {j.openedAt ? stat('Opened', new Date(j.openedAt).toLocaleString(settings.lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), th.text) : null}
          </View>

          {!!j.tag && <Text style={{ color: th.dim, fontSize: 13 }}>{t('thReview')}: <Text style={{ color: th.text, fontWeight: '800' }}>{j.tag}</Text></Text>}
          {!!j.note && (
            <View style={{ backgroundColor: th.panel, borderWidth: 1, borderColor: th.line, borderRadius: 10, padding: 14 }}>
              <Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8, marginBottom: 4 }}>NOTE</Text>
              <Text style={{ color: th.text, fontSize: 13.5, lineHeight: 20 }}>{j.note}</Text>
            </View>
          )}

          <Pressable onPress={() => confirmAction(t('thDeleteQ'), t('thDeleteText'), () => { removeTrade(j.id); onClose(); }, t('delete'), t('cancel'))} hitSlop={8} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
            <Icon name="trash-outline" size={14} color={th.sell} />
            <Text style={{ color: th.sell, fontSize: 12.5, fontWeight: '800' }}>{t('thDelete')}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );

  function chip(k: string, v: string, col: string) {
    return (
      <View key={k} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: th.line, backgroundColor: th.bg }}>
        <Text style={{ color: th.dim, fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6 }}>{k.toUpperCase()}</Text>
        <Text style={{ color: col, fontSize: 13.5, fontWeight: '900', marginTop: 1 }}>{v}</Text>
      </View>
    );
  }
  function legend(col: string, label: string) {
    return <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={{ width: 14, height: 4, borderRadius: 2, backgroundColor: col }} /><Text style={{ color: th.dim, fontSize: 11.5, fontWeight: '700' }}>{label}</Text></View>;
  }
  function planRow(k: string, v: string, col: string, tag: string, dim = false) {
    return (
      <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: th.line, opacity: dim ? 0.95 : 1 }}>
        <View style={{ width: 4, height: 22, borderRadius: 2, backgroundColor: col }} />
        <Text style={{ flex: 1, color: th.text, fontSize: 13.5, fontWeight: '700' }}>{k}</Text>
        <Text style={{ color: th.dim, fontSize: 12, fontWeight: '700' }}>{tag}</Text>
        <Text style={{ color: col, fontSize: 14.5, fontWeight: '900', minWidth: 84, textAlign: 'right' }}>{v}</Text>
      </View>
    );
  }
  function stat(k: string, v: string, col: string) {
    return (
      <View key={k} style={{ flexBasis: '31%', flexGrow: 1, backgroundColor: th.panel, borderWidth: 1, borderColor: th.line, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12 }}>
        <Text style={{ color: th.dim, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 }} numberOfLines={1}>{k.toUpperCase()}</Text>
        <Text style={{ color: col, fontSize: 15.5, fontWeight: '900', marginTop: 4 }} numberOfLines={1} adjustsFontSizeToFit>{v}</Text>
      </View>
    );
  }
}

// The candle chart of one finished trade. Zoom / pan / crosshair come from ChartZoom (same as the analysis charts).
function ReplayChart({ data, width: fullW, height, dec, gran, j, eI, xI, onGran }: { data: Candle[]; width: number; height: number; dec: number; gran: number; j: Trade; eI: number; xI: number; onGran: (k: string) => void }) {
  const { th } = useApp();
  const width = fullW, padR = 66, W = width - padR, padB = 18; // no scroll bars (MT5 style)
  const [wheel, setWheel] = useState(false), [showLv, setShowLv] = useState(true);
  const z = useZoom(data.length, W, height, { onTap: () => setWheel((w) => !w) });
  const s0 = z.start, vis = data.slice(z.start, z.end), n = z.slots;
  const buy = j.side === 'buy', k = buy ? 1 : -1, win = j.pnl > 0 ? th.buy : j.pnl < 0 ? th.sell : th.dim;
  const sl = j.sl, tps = j.tps ?? [], hits = j.hits ?? 0, last = tps.length ? tps[tps.length - 1] : undefined;
  const hasSl = sl !== undefined && isFinite(sl as number);
  const moved = hasSl && j.stopEnd !== undefined && Math.abs((j.stopEnd as number) - (sl as number)) > 1e-9;

  const lv: number[] = [j.entry, j.exit, ...(hasSl ? [sl as number] : []), ...tps, ...(j.zone ?? []), ...(j.level ? [j.level] : [])];
  const fit = { hi: Math.max(...vis.map((c) => c.h), ...lv), lo: Math.min(...vis.map((c) => c.l), ...lv) };
  const pad = (fit.hi - fit.lo) * 0.05;
  const { hi, lo } = z.fitY(fit.hi + pad, fit.lo - pad), rng = hi - lo || 1;
  const plotH = height - padB - 8;
  const y = (v: number) => 8 + (1 - (v - lo) / rng) * plotH;
  const step = W / n, bw = Math.max(1, step * 0.62), X = (i: number) => (i - s0) * step + step / 2 + z.shift;
  const inView = (i: number) => i >= s0 && i < z.end;
  const clampX = (i: number) => Math.max(0, Math.min(W, X(i)));

  const level = (v: number, color: string, label: string, key: string, dash = '6 3', w = 1.2) => {
    if (!showLv && key !== 'en') return null;
    if (v < lo - rng * 0.05 || v > hi + rng * 0.05) return null;
    return (
      <G key={key}>
        <Line x1={0} x2={W} y1={y(v)} y2={y(v)} stroke={color} strokeWidth={w} strokeDasharray={dash} />
        <Rect x={W + 1} y={y(v) - 7.5} width={padR - 2} height={15} rx={4} fill={color} />
        <SvgText x={W + 4} y={y(v) + 3.2} fontSize={8.5} fontWeight="800" fill={ink(color)}>{label} {v.toFixed(dec)}</SvgText>
      </G>
    );
  };

  // position-tool areas run from the entry candle to the exit candle
  const ax0 = clampX(Math.max(eI, s0)), ax1 = clampX(Math.min(xI, z.end - 1) + 0.5);
  const showArea = ax1 > ax0 && xI >= s0 && eI < z.end;
  const sameTime = eI === xI;

  const every = niceEvery(step, 80), ticks: { c: Candle; i: number }[] = []; // time labels sit on fixed candles, so they do not jump while you scroll
  for (let i = Math.ceil(Math.max(0, z.startF) / every) * every; i < z.end && i < data.length; i += every) if (X(i) > 22 && X(i) < W - 22) ticks.push({ c: data[i], i });
  const mine = j.pnl >= 0 ? '+' : '-', posTag = `${buy ? 'BUY' : 'SELL'}${j.lots ? ` ${fmtLots(j.lots)}` : ''}, ${mine}${Math.abs(j.pnl).toFixed(2)} USD`;

  const wheelActions: WheelAction[] = [
    { key: 'cross', icon: 'locate', label: 'Crosshair', on: z.crossMode, press: () => z.setCrossMode(!z.crossMode) },
    { key: 'obj', icon: 'shapes-outline', label: 'Trade levels', on: showLv, press: () => setShowLv(!showLv) },
    { key: 'fit', icon: 'copy-outline', label: 'Fit the chart', press: () => z.reset() },
  ];

  return (
    <View style={{ direction: 'ltr' }}>
      <View style={{ paddingHorizontal: 4, paddingBottom: 8 }}>
        <Mt5Bar tfLabel={TFS.find((x) => x.k === String(gran))?.label ?? `${Math.round(gran / 60)}m`} onWheel={() => setWheel(true)} crossMode={z.crossMode} onCross={() => z.setCrossMode(!z.crossMode)} onFit={() => z.reset()} fitOn={z.vzoomed} />
      </View>
      <View style={{ flexDirection: 'row' }}>
        <View {...z.handlers} style={{ width }}>
          <Svg width={width} height={height} style={{ overflow: 'hidden' }}>
            <Defs><ClipPath id="plotClipR"><Rect x={0} y={0} width={W} height={height} /></ClipPath></Defs>
            {niceTicks(lo, hi, Math.max(3, Math.round(height / 52))).map((v) => <G key={`g${v}`}><Line x1={0} x2={W} y1={y(v)} y2={y(v)} stroke={th.line} strokeWidth={0.5} strokeDasharray="1 4" opacity={0.8} /><SvgText x={W + 5} y={y(v) + 3} fontSize={9} fontWeight="600" fill={th.dim}>{v.toFixed(dec)}</SvgText></G>)}
            {/* entry zone */}
            {showLv && j.zone && (() => { const top = y(Math.max(...j.zone)), h = Math.max(2, Math.abs(y(j.zone[0]) - y(j.zone[1]))); return (<G><Rect x={0} y={top} width={W} height={h} fill={th.accent + '1A'} stroke={th.accent + '55'} strokeWidth={0.8} /><SvgText x={4} y={top + 10} fontSize={8.5} fontWeight="800" fill={th.accent}>ENTRY ZONE</SvgText></G>); })()}
            {/* risk and reward areas */}
            {showArea && showLv && hasSl && <Rect x={ax0} y={Math.min(y(j.entry), y(sl as number))} width={ax1 - ax0} height={Math.max(1, Math.abs(y(j.entry) - y(sl as number)))} fill={th.sell + '26'} stroke={th.sell + '55'} strokeWidth={0.6} />}
            {showArea && showLv && last !== undefined && <Rect x={ax0} y={Math.min(y(j.entry), y(last))} width={ax1 - ax0} height={Math.max(1, Math.abs(y(j.entry) - y(last)))} fill={th.buy + '22'} stroke={th.buy + '55'} strokeWidth={0.6} />}
            {/* candles */}
            {vis.map((x, i) => {
              const up = x.c >= x.o, col = up ? th.buy : th.sell, cx = X(s0 + i), top = y(Math.max(x.o, x.c)), bot = y(Math.min(x.o, x.c));
              return (<G key={i} clipPath="url(#plotClipR)"><Line x1={cx} x2={cx} y1={y(x.h)} y2={y(x.l)} stroke={col} strokeWidth={1} /><Rect x={cx - bw / 2} y={top} width={bw} height={Math.max(1, bot - top)} fill={col} /></G>);
            })}
            {/* levels */}
            {j.level !== undefined && level(j.level, th.gold, 'LEVEL', 'lvl', '2 3', 1)}
            {tps.map((p, i) => level(p, th.buy, `TP${i + 1}${i < hits ? ' ✓' : ''}`, `tp${i}`))}
            {hasSl && level(sl as number, th.sell, 'SL', 'sl')}
            {moved && level(j.stopEnd as number, th.gold, 'STOP', 'se', '3 3')}
            {level(j.entry, th.accent, 'ENTRY', 'en', '0', 1.6)}
            <SvgText x={4} y={y(j.entry) - 4} fontSize={9.5} fontWeight="800" fill={win}>{posTag}</SvgText>
            {/* path entry -> exit */}
            {!sameTime && inView(eI) && inView(xI) && <Line x1={X(eI)} y1={y(j.entry)} x2={X(xI)} y2={y(j.exit)} stroke={win} strokeWidth={1.4} strokeDasharray="4 3" />}
            {/* entry marker */}
            {inView(eI) && (() => { const cx = X(eI), cy = y(j.entry), up = buy; return (
              <G>
                <Line x1={cx} x2={cx} y1={8} y2={8 + plotH} stroke={th.accent} strokeWidth={0.8} strokeDasharray="2 3" />
                <Circle cx={cx} cy={cy} r={5.5} fill={th.accent} stroke={th.panel} strokeWidth={1.5} />
                <Polygon points={up ? `${cx},${cy + 9} ${cx - 5},${cy + 18} ${cx + 5},${cy + 18}` : `${cx},${cy - 9} ${cx - 5},${cy - 18} ${cx + 5},${cy - 18}`} fill={th.accent} />
                <SvgText x={Math.min(W - 54, cx + 8)} y={8 + 11} fontSize={9} fontWeight="900" fill={th.accent}>{buy ? 'BUY' : 'SELL'} {j.entry.toFixed(dec)}</SvgText>
              </G>); })()}
            {/* exit marker */}
            {inView(xI) && (() => { const cx = X(xI), cy = y(j.exit), lab = `EXIT ${j.exit.toFixed(dec)}`, left = cx > W * 0.6; return (
              <G>
                <Line x1={cx} x2={cx} y1={8} y2={8 + plotH} stroke={win} strokeWidth={0.8} strokeDasharray="2 3" />
                <Circle cx={cx} cy={cy} r={6} fill={win} stroke={th.panel} strokeWidth={1.5} />
                <Rect x={left ? cx - 86 : cx + 8} y={cy - 9} width={78} height={17} rx={4} fill={win} />
                <SvgText x={left ? cx - 82 : cx + 12} y={cy + 3} fontSize={9} fontWeight="900" fill={ink(win)}>{lab}</SvgText>
              </G>); })()}
            {/* time axis */}
            {ticks.map(({ c, i }) => <SvgText key={i} x={X(i)} y={height - 5} fontSize={8.5} fill={th.dim} textAnchor="middle">{fmtTime(c.t, gran)}</SvgText>)}
            {z.cross && (() => {
              const ci = Math.max(0, Math.min(data.length - 1, z.idxAt(z.cross.x))), cx = X(ci), cy = Math.max(8, Math.min(8 + plotH, z.cross.y)), price = lo + (1 - (cy - 8) / plotH) * rng;
              return <CrossLayer x={cx} y={cy} W={W} H={height - 2} padR={padR} price={price.toFixed(dec)} time={fmtTime(data[ci].t, gran)} />;
            })()}
          </Svg>
          {wheel && (
            <View onTouchStart={(e) => e.stopPropagation()} style={{ position: 'absolute', left: 0, top: 0, width, height }}>
              <RadialWheel w={width} h={height} tfs={TFS} current={String(gran)} onTf={onGran} onClose={() => setWheel(false)} actions={wheelActions} />
            </View>
          )}
          {z.cross && (() => { const ci = Math.max(0, Math.min(data.length - 1, z.idxAt(z.cross.x))); return <Readout c={data[ci]} prev={data[ci - 1]?.c} dec={dec} vol={data[ci].v} onClose={z.clearCross} />; })()}
          <ChartHud z={z} top={height - 50} right={padR + 8} />
        </View>
      </View>
    </View>
  );
}
