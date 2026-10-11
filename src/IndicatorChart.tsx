import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import Svg, { Line, Rect, G, Polyline, Polygon, Circle, Defs, LinearGradient as SvgGrad, Stop, Text as SvgText } from 'react-native-svg';
import { ink } from './theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from './store';
import { Icon } from './ui';
import type { Candle } from './markets';
import { candleLeft, fmtLeft } from './markets';
import { useZoom, ZoomBar, CrossLayer, Readout, fmtTime } from './ChartZoom';
import * as I from './indicators';
import { candleMarks } from './candles';
import { IndId, INDICATORS, GROUPS } from './indicators';

export type Level = { label: string; price: number; color: string };
type ChartType = 'candle' | 'ha' | 'line';
type Saved = { on: IndId[]; hidden: boolean; type: ChartType };
const KEY = 'chart_ind_v2';
const DEFAULT: Saved = { on: ['ema20', 'ema50'], hidden: false, type: 'candle' };
const C = { ema200: '#38BDF8', sma20: '#FB923C', sma50: '#A3E635', boll: '#60A5FA', vwap: '#F472B6', tenkan: '#38BDF8', kijun: '#F43F5E', ma: '#C084FC' };
const PANE_H = 92;

// Candle chart for the Analysis View: indicators drawn on the price (overlays) and under it (panes). Every one can be switched on or off,
// and the eye button hides or shows all of them at once without losing the selection.
export default function IndicatorChart({ data: all, width, dec, height = 300, levels = [], gran, onAlert }: { data: Candle[]; width: number; dec: number; height?: number; levels?: Level[]; gran?: number; onAlert?: (price: number) => void }) {
  const { th } = useApp();
  const [st, setSt] = useState<Saved>(DEFAULT);
  const [panel, setPanel] = useState(false);
  const loaded = useRef(false);
  useEffect(() => { AsyncStorage.getItem(KEY).then((v) => { if (v) { try { setSt({ ...DEFAULT, ...JSON.parse(v) }); } catch {} } }).catch(() => {}).finally(() => { loaded.current = true; }); }, []);
  const save = (n: Saved) => { setSt(n); AsyncStorage.setItem(KEY, JSON.stringify(n)).catch(() => {}); };
  const has = (id: IndId) => !st.hidden && st.on.includes(id);
  const toggle = (id: IndId) => save({ ...st, hidden: false, on: st.on.includes(id) ? st.on.filter((x) => x !== id) : [...st.on, id] });

  const z = useZoom(all.length, width - 62);
  const [tick, setTick] = useState(Date.now());
  useEffect(() => { if (!gran) return; const id = setInterval(() => setTick(Date.now()), 1000); return () => clearInterval(id); }, [gran]);

  const vol = useMemo(() => I.hasVolume(all), [all.length > 0 ? all[0].t : 0, all.length]);
  const off = st.hidden;

  // ---- indicator maths over ALL candles, recomputed only for what is switched on ----
  const ind = useMemo(() => {
    const cl = all.map((x) => x.c), o: any = {};
    if (off || all.length < 3) return o;
    const on = (id: IndId) => st.on.includes(id);
    if (on('ema20')) o.ema20 = I.emaS(cl, 20);
    if (on('ema50')) o.ema50 = I.emaS(cl, 50);
    if (on('ema200')) o.ema200 = I.emaS(cl, 200);
    if (on('sma20')) o.sma20 = I.sma(cl, 20);
    if (on('sma50')) o.sma50 = I.sma(cl, 50);
    if (on('boll')) o.boll = I.bollinger(cl);
    if (on('vwap') && vol) o.vwap = I.vwap(all);
    if (on('supertrend')) o.st = I.supertrend(all);
    if (on('psar')) o.psar = I.psar(all);
    if (on('ichimoku')) o.ichi = I.ichimoku(all);
    if (on('fib')) o.fib = I.fibonacci(all);
    if (on('sr')) o.sr = I.supportResistance(all);
    if (on('cdl')) o.cdl = candleMarks(all);
    if (on('rsi')) o.rsi = I.rsiSeries(cl);
    if (on('macd')) o.macd = I.macdSeries(cl);
    if (on('stoch')) o.stoch = I.stoch(all);
    if (on('adx')) o.adx = I.adxSeries(all);
    if (on('cci')) o.cci = I.cci(all);
    if (on('wpr')) o.wpr = I.williamsR(all);
    if (on('atr')) o.atr = I.atrSeries(all);
    if (on('obv') && vol) o.obv = I.obv(all);
    return o;
  }, [all, st.on, off, vol]);
  const ha = useMemo(() => (st.type === 'ha' ? I.heikinAshi(all) : all), [all, st.type]);

  const Toolbar = (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 8, direction: 'ltr' }}>
      {([['candle', 'stats-chart-outline'], ['ha', 'layers-outline'], ['line', 'trending-up']] as [ChartType, string][]).map(([k, ic]) => (
        <Pressable key={k} onPress={() => save({ ...st, type: k })} style={{ width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: st.type === k ? th.accent + '26' : 'transparent', borderWidth: 1, borderColor: st.type === k ? th.accent : th.line }}>
          <Icon name={ic} size={16} color={st.type === k ? th.accent : th.dim} />
        </Pressable>
      ))}
      <Pressable onPress={() => save({ ...st, hidden: !st.hidden })} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 34, paddingHorizontal: 9, borderRadius: 8, borderWidth: 1, borderColor: st.hidden ? th.gold : th.line, backgroundColor: st.hidden ? th.gold + '1F' : 'transparent' }}>
        <Icon name={st.hidden ? 'eye-off-outline' : 'eye-outline'} size={16} color={st.hidden ? th.gold : th.text} />
        <Text style={{ color: st.hidden ? th.gold : th.text, fontWeight: '800', fontSize: 12 }}>{st.hidden ? 'Show' : 'Hide'}</Text>
      </Pressable>
      <Pressable onPress={() => setPanel(!panel)} style={{ flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 5, height: 34, paddingHorizontal: 10, borderRadius: 8, backgroundColor: panel ? th.accent : th.accent + '22' }}>
        <Icon name="options-outline" size={16} color={panel ? th.onAccent : th.accent} />
        <Text style={{ color: panel ? th.onAccent : th.accent, fontWeight: '900', fontSize: 12 }} numberOfLines={1}>{st.on.length ? `Indicators (${st.on.length})` : 'Indicators'}</Text>
      </Pressable>
    </View>
  );

  const Panel = panel ? (
    <View style={{ borderWidth: 1, borderColor: th.line, borderRadius: 8, padding: 12, marginBottom: 10, backgroundColor: th.bg, gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[['Select all', () => save({ ...st, hidden: false, on: INDICATORS.filter((d) => !d.needsVolume || vol).map((d) => d.id) })], ['Clear all', () => save({ ...st, on: [] })], ['Reset', () => save(DEFAULT)]].map(([l, f]: any) => (
          <Pressable key={l} onPress={f} style={{ flex: 1, height: 34, borderRadius: 8, borderWidth: 1, borderColor: th.line, alignItems: 'center', justifyContent: 'center', backgroundColor: th.panel }}>
            <Text style={{ color: th.text, fontWeight: '800', fontSize: 12 }}>{l}</Text>
          </Pressable>
        ))}
      </View>
      {GROUPS.map((g) => (
        <View key={g}>
          <Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '900', letterSpacing: 1.2, marginBottom: 6 }}>{g.toUpperCase()}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {INDICATORS.filter((d) => d.group === g).map((d) => {
              const a = st.on.includes(d.id), dis = !!d.needsVolume && !vol;
              return (
                <Pressable key={d.id} onPress={() => !dis && toggle(d.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, height: 34, borderRadius: 8, borderWidth: 1, borderColor: a ? th.accent : th.line, backgroundColor: a ? th.accent + '22' : th.panel, opacity: dis ? 0.4 : 1 }}>
                  {a && <Icon name="checkmark" size={13} color={th.accent} />}
                  <Text style={{ color: a ? th.text : th.dim, fontWeight: '700', fontSize: 12 }}>{d.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      {!vol && <Text style={{ color: th.dim, fontSize: 11.5 }}>Volume, VWAP and OBV need a feed with volume. Crypto pairs have it; Deriv forex and synthetic indices do not.</Text>}
    </View>
  ) : null;

  if (all.length < 2) return <View>{Toolbar}{Panel}<View style={{ height, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={th.accent} /></View></View>;

  // ---- geometry ----
  const padR = 62, W = width - padR, s0 = z.start, e0 = z.end, n = z.slots, step = W / n, bw = Math.max(1, step * 0.66);
  const vis = ha.slice(s0, e0), real = all.slice(s0, e0);
  const lv = levels.filter((l) => isFinite(l.price));
  const hi = Math.max(...vis.map((c) => c.h), ...lv.map((l) => l.price)), lo = Math.min(...vis.map((c) => c.l), ...lv.map((l) => l.price));
  const rng = hi - lo || 1, y = (v: number) => 8 + (1 - (v - lo) / rng) * (height - 16);
  const X = (i: number) => (i - s0) * step + step / 2;   // i = index into the FULL arrays
  const last = all[all.length - 1], lc = last.c >= last.o ? th.buy : th.sell;
  const path = (arr?: number[]) => { if (!arr) return ''; const p: string[] = []; for (let i = s0; i < e0; i++) if (isFinite(arr[i])) p.push(`${X(i)},${y(arr[i])}`); return p.join(' '); };
  const legend: { t: string; c: string }[] = [];
  const val = (arr?: number[]) => { const v = arr?.[e0 - 1]; return v !== undefined && isFinite(v) ? v.toFixed(dec) : '-'; };
  const clip = (v: number) => v >= lo - rng * 0.35 && v <= hi + rng * 0.35;

  const lines: [string, number[] | undefined, string][] = [['EMA 20', ind.ema20, th.gold], ['EMA 50', ind.ema50, th.poi], ['EMA 200', ind.ema200, C.ema200], ['SMA 20', ind.sma20, C.sma20], ['SMA 50', ind.sma50, C.sma50], ['VWAP', ind.vwap, C.vwap]];
  lines.forEach(([l, a, c]) => { if (a) legend.push({ t: `${l} ${val(a)}`, c }); });
  if (ind.boll) legend.push({ t: `BB ${val(ind.boll.up)} / ${val(ind.boll.lo)}`, c: C.boll });
  if (ind.st) legend.push({ t: `Supertrend ${val(ind.st.line)}`, c: ind.st.dir[e0 - 1] === 1 ? th.buy : th.sell });
  if (ind.psar) legend.push({ t: `SAR ${val(ind.psar.v)}`, c: ind.psar.dir[e0 - 1] === 1 ? th.buy : th.sell });
  if (ind.ichi) legend.push({ t: 'Ichimoku', c: C.tenkan });

  // Supertrend coloured by direction: one polyline per run of the same direction.
  const stRuns: { pts: string; up: boolean }[] = [];
  if (ind.st) {
    let cur: { pts: string[]; up: boolean } | null = null;
    for (let i = s0; i < e0; i++) {
      const d = ind.st.dir[i], v = ind.st.line[i];
      if (!isFinite(v)) continue;
      if (!cur || (d === 1) !== cur.up) { if (cur) stRuns.push({ pts: cur.pts.join(' '), up: cur.up }); cur = { pts: [], up: d === 1 }; }
      cur.pts.push(`${X(i)},${y(v)}`);
    }
    if (cur) stRuns.push({ pts: cur.pts.join(' '), up: cur.up });
  }
  // Ichimoku cloud: a small quad per candle, green when span A is above span B.
  const cloud: { pts: string; up: boolean }[] = [];
  if (ind.ichi) {
    for (let i = s0; i < e0 - 1; i++) {
      const a1 = ind.ichi.spanA[i], b1 = ind.ichi.spanB[i], a2 = ind.ichi.spanA[i + 1], b2 = ind.ichi.spanB[i + 1];
      if (![a1, b1, a2, b2].every(isFinite)) continue;
      cloud.push({ pts: `${X(i)},${y(a1)} ${X(i + 1)},${y(a2)} ${X(i + 1)},${y(b2)} ${X(i)},${y(b1)}`, up: a2 >= b2 });
    }
  }
  const bollFill = (() => {
    if (!ind.boll) return '';
    const up: string[] = [], dn: string[] = [];
    for (let i = s0; i < e0; i++) if (isFinite(ind.boll.up[i])) { up.push(`${X(i)},${y(ind.boll.up[i])}`); dn.unshift(`${X(i)},${y(ind.boll.lo[i])}`); }
    return up.length ? [...up, ...dn].join(' ') : '';
  })();

  // ---- panes ----
  type PaneDef = { id: IndId; title: string; value: string; min: number; max: number; draw: (py: (v: number) => number, W: number) => React.ReactNode; guides?: { v: number; label?: string }[] };
  const vals = (a?: number[]) => { const o: number[] = []; if (a) for (let i = s0; i < e0; i++) if (isFinite(a[i])) o.push(a[i]); return o; };
  const f2 = (a?: number[]) => { const v = a?.[e0 - 1]; return v !== undefined && isFinite(v) ? v.toFixed(2) : '-'; };
  const pl = (a: number[] | undefined, py: (v: number) => number, color: string, w = 1.4) => { const p: string[] = []; if (a) for (let i = s0; i < e0; i++) if (isFinite(a[i])) p.push(`${X(i)},${py(a[i])}`); return p.length ? <Polyline key={color + w} points={p.join(' ')} fill="none" stroke={color} strokeWidth={w} /> : null; };
  const panes: PaneDef[] = [];
  if (ind.rsi) panes.push({ id: 'rsi', title: 'RSI 14', value: f2(ind.rsi), min: 0, max: 100, guides: [{ v: 70 }, { v: 50 }, { v: 30 }], draw: (py) => <G><Rect x={0} y={py(100)} width={W} height={py(70) - py(100)} fill={th.sell + '12'} /><Rect x={0} y={py(30)} width={W} height={py(0) - py(30)} fill={th.buy + '12'} />{pl(ind.rsi, py, th.accent, 1.6)}</G> });
  if (ind.macd) {
    const hv = [...vals(ind.macd.hist), ...vals(ind.macd.line), ...vals(ind.macd.signal)], m = Math.max(...hv.map(Math.abs), 1e-12);
    panes.push({ id: 'macd', title: 'MACD 12 26 9', value: `${(ind.macd.line[e0 - 1] ?? NaN).toFixed(dec + 1)}`, min: -m, max: m, guides: [{ v: 0 }], draw: (py) => <G>
      {Array.from({ length: n }, (_, k) => { const i = s0 + k, h = ind.macd.hist[i]; if (!isFinite(h)) return null; const up = h >= 0; return <Rect key={k} x={X(i) - bw / 2} y={Math.min(py(0), py(h))} width={bw} height={Math.max(1, Math.abs(py(h) - py(0)))} fill={(up ? th.buy : th.sell) + 'AA'} />; })}
      {pl(ind.macd.line, py, th.accent)}{pl(ind.macd.signal, py, th.gold)}</G> });
  }
  if (ind.stoch) panes.push({ id: 'stoch', title: 'Stoch 14 3 3', value: `${f2(ind.stoch.k)} / ${f2(ind.stoch.d)}`, min: 0, max: 100, guides: [{ v: 80 }, { v: 20 }], draw: (py) => <G>{pl(ind.stoch.k, py, th.accent)}{pl(ind.stoch.d, py, th.gold)}</G> });
  if (ind.adx) panes.push({ id: 'adx', title: 'ADX 14 (+DI / -DI)', value: f2(ind.adx.adx), min: 0, max: Math.max(60, ...vals(ind.adx.pdi), ...vals(ind.adx.mdi), ...vals(ind.adx.adx)), guides: [{ v: 25 }], draw: (py) => <G>{pl(ind.adx.pdi, py, th.buy, 1)}{pl(ind.adx.mdi, py, th.sell, 1)}{pl(ind.adx.adx, py, th.text, 1.7)}</G> });
  if (ind.cci) { const m = Math.max(150, ...vals(ind.cci).map(Math.abs)); panes.push({ id: 'cci', title: 'CCI 20', value: f2(ind.cci), min: -m, max: m, guides: [{ v: 100 }, { v: 0 }, { v: -100 }], draw: (py) => pl(ind.cci, py, th.poi, 1.5) }); }
  if (ind.wpr) panes.push({ id: 'wpr', title: 'Williams %R 14', value: f2(ind.wpr), min: -100, max: 0, guides: [{ v: -20 }, { v: -80 }], draw: (py) => pl(ind.wpr, py, C.ma, 1.5) });
  if (ind.atr) { const v = vals(ind.atr); panes.push({ id: 'atr', title: 'ATR 14', value: (ind.atr[e0 - 1] ?? NaN).toFixed(dec), min: Math.min(...v, 0), max: Math.max(...v, 1e-12) * 1.1, draw: (py) => pl(ind.atr, py, th.gold, 1.5) }); }
  if (has('vol') && vol) { const mv = Math.max(...real.map((c) => c.v ?? 0), 1); panes.push({ id: 'vol', title: 'Volume', value: real.length ? String(Math.round(real[real.length - 1].v ?? 0)) : '-', min: 0, max: mv * 1.1, draw: (py) => <G>{real.map((c, k) => <Rect key={k} x={X(s0 + k) - bw / 2} y={py(c.v ?? 0)} width={bw} height={Math.max(1, py(0) - py(c.v ?? 0))} fill={(c.c >= c.o ? th.buy : th.sell) + '99'} />)}</G> }); }
  if (ind.obv) { const v = vals(ind.obv); panes.push({ id: 'obv', title: 'OBV', value: String(Math.round(ind.obv[e0 - 1] ?? 0)), min: Math.min(...v), max: Math.max(...v) + 1e-9, draw: (py) => pl(ind.obv, py, C.vwap, 1.5) }); }

  const lastReal = real[real.length - 1] ?? last, firstReal = real[0] ?? last;
  const dChg = lastReal.c - firstReal.o, dCol = lastReal.c >= lastReal.o ? th.buy : th.sell;
  const fib: I.Fib | null | undefined = ind.fib;
  const fibCol = (r: number) => (r === 0.618 ? th.accent : r === 0.5 ? th.gold : r === 0.786 || r === 0.705 ? th.poi : r >= 1.27 ? th.sell : th.dim);

  return (
    <View>
      {Toolbar}
      {Panel}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 6, direction: 'ltr' }}>
        {[['O', lastReal.o], ['H', lastReal.h], ['L', lastReal.l], ['C', lastReal.c]].map(([k, v]: any) => <Text key={k} style={{ color: th.dim, fontSize: 11 }}>{k} <Text style={{ color: dCol, fontWeight: '800' }}>{v.toFixed(dec)}</Text></Text>)}
        <Text style={{ color: dCol, fontSize: 11, fontWeight: '800' }}>{dChg >= 0 ? '+' : ''}{dChg.toFixed(dec)}</Text>
      </View>
      <View {...z.handlers} style={{ direction: 'ltr' }}>
        <Svg width={width} height={height} style={{ overflow: 'hidden' }}>
          <Defs>
            <SvgGrad id="plotWashI" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={th.accent} stopOpacity={th.dark ? 0.10 : 0.07} />
              <Stop offset="1" stopColor={th.accent} stopOpacity={0} />
            </SvgGrad>
          </Defs>
          <Rect x={0} y={0} width={W} height={height} fill="url(#plotWashI)" />
          <Line x1={W} x2={W} y1={0} y2={height} stroke={th.hair} strokeWidth={1} />
          {[0, 0.25, 0.5, 0.75, 1].map((f, i) => { const v = lo + f * rng; return <G key={i}><Line x1={0} x2={W} y1={y(v)} y2={y(v)} stroke={th.line} strokeOpacity={0.55} strokeWidth={0.6} strokeDasharray="1 4" /><SvgText x={W + 6} y={y(v) + 3} fontSize={9} fontWeight="600" fill={th.dim}>{v.toFixed(dec)}</SvgText></G>; })}

          {cloud.map((q, i) => <Polygon key={`cl${i}`} points={q.pts} fill={(q.up ? th.buy : th.sell) + '22'} />)}
          {!!bollFill && <Polygon points={bollFill} fill={C.boll + '14'} />}

          {/* price: candles, Heikin Ashi or line */}
          {st.type === 'line' ? (
            <Polyline points={vis.map((c, i) => `${i * step + step / 2},${y(c.c)}`).join(' ')} fill="none" stroke={th.accent} strokeWidth={2} />
          ) : vis.map((c, i) => {
            const col = c.c >= c.o ? th.buy : th.sell, x = i * step + step / 2;
            return <G key={`${c.t}-${i}`}><Line x1={x} x2={x} y1={y(c.h)} y2={y(c.l)} stroke={col} strokeWidth={1} /><Rect x={x - bw / 2} y={Math.min(y(c.o), y(c.c))} width={bw} height={Math.max(1, Math.abs(y(c.o) - y(c.c)))} rx={Math.min(1.6, bw / 3)} fill={col} /></G>;
          })}

          {lines.map(([l, a, c]) => (a ? <Polyline key={l} points={path(a)} fill="none" stroke={c} strokeWidth={1.4} /> : null))}
          {ind.boll && <><Polyline points={path(ind.boll.up)} fill="none" stroke={C.boll} strokeWidth={1.1} /><Polyline points={path(ind.boll.lo)} fill="none" stroke={C.boll} strokeWidth={1.1} /><Polyline points={path(ind.boll.mid)} fill="none" stroke={C.boll} strokeWidth={0.9} strokeDasharray="3 3" /></>}
          {ind.ichi && <><Polyline points={path(ind.ichi.tenkan)} fill="none" stroke={C.tenkan} strokeWidth={1.1} /><Polyline points={path(ind.ichi.kijun)} fill="none" stroke={C.kijun} strokeWidth={1.1} /></>}
          {stRuns.map((r, i) => <Polyline key={`st${i}`} points={r.pts} fill="none" stroke={r.up ? th.buy : th.sell} strokeWidth={1.8} />)}
          {ind.psar && Array.from({ length: n }, (_, k) => { const i = s0 + k, v = ind.psar.v[i]; return isFinite(v) ? <Circle key={`ps${k}`} cx={X(i)} cy={y(v)} r={1.6} fill={ind.psar.dir[i] === 1 ? th.buy : th.sell} /> : null; })}

          {ind.sr && ind.sr.filter((s: I.SR) => clip(s.price)).map((s: I.SR, k: number) => (
            <G key={`sr${k}`}><Line x1={0} x2={W} y1={y(s.price)} y2={y(s.price)} stroke={s.kind === 'support' ? th.buy : th.sell} strokeWidth={1} strokeDasharray="2 4" /><SvgText x={W - 4} y={y(s.price) - 2} fontSize={8.5} fontWeight="800" fill={s.kind === 'support' ? th.buy : th.sell} textAnchor="end">{s.kind === 'support' ? 'S' : 'R'} x{s.touches}</SvgText></G>
          ))}
          {fib && (
            <G>
              <Line x1={Math.max(0, X(fib.up ? fib.loI : fib.hiI))} y1={y(fib.up ? fib.lo : fib.hi)} x2={Math.max(0, X(fib.up ? fib.hiI : fib.loI))} y2={y(fib.up ? fib.hi : fib.lo)} stroke={th.dim} strokeWidth={1} strokeDasharray="4 3" />
              {fib.levels.filter((l) => clip(l.price)).map((l, k) => (
                <G key={`fb${k}`}>
                  <Line x1={Math.max(0, X(Math.min(fib.hiI, fib.loI)))} x2={W} y1={y(l.price)} y2={y(l.price)} stroke={fibCol(l.r)} strokeWidth={l.r === 0.618 || l.r === 0.5 ? 1.2 : 0.8} strokeDasharray={l.ext ? '2 3' : undefined} opacity={0.9} />
                  <SvgText x={W - 4} y={y(l.price) - 2} fontSize={8.5} fontWeight="800" fill={fibCol(l.r)} textAnchor="end">{l.r} · {l.price.toFixed(dec)}</SvgText>
                </G>
              ))}
            </G>
          )}

          {ind.cdl && ind.cdl.filter((m: any) => m.i >= s0 && m.i < e0).map((m: any, k: number) => {
            const bu = m.dir === 'bullish', cx = X(m.i), cy = bu ? y(all[m.i].l) + 13 : y(all[m.i].h) - 13, col = bu ? th.buy : th.sell;
            return (
              <G key={`cd${k}`}>
                <Polygon points={bu ? `${cx},${cy - 9} ${cx - 3.5},${cy - 4} ${cx + 3.5},${cy - 4}` : `${cx},${cy + 9} ${cx - 3.5},${cy + 4} ${cx + 3.5},${cy + 4}`} fill={col} />
                <SvgText x={cx} y={bu ? cy + 6 : cy - 1} fontSize={8} fontWeight="900" fill={col} textAnchor="middle">{m.label}</SvgText>
              </G>
            );
          })}
          {lv.map((l, i) => (
            <G key={`lv${i}`}><Line x1={0} x2={W} y1={y(l.price)} y2={y(l.price)} stroke={l.color} strokeWidth={1.4} strokeDasharray={l.color === th.accent ? undefined : '6 3'} /><Rect x={W + 1} y={y(l.price) - 7.5} width={padR - 2} height={15} rx={4} fill={l.color} /><SvgText x={W + 5} y={y(l.price) + 3.2} fontSize={8.5} fontWeight="800" fill={ink(l.color)}>{l.label} {l.price.toFixed(dec)}</SvgText></G>
          ))}
          {legend.slice(0, 7).map((g, k) => <SvgText key={`lg${k}`} x={4} y={12 + k * 11} fontSize={8.5} fontWeight="800" fill={g.c}>{g.t}</SvgText>)}

          <Line x1={0} x2={W} y1={y(last.c)} y2={y(last.c)} stroke={lc} strokeWidth={1} strokeDasharray="4 3" />
          <Rect x={W + 1} y={y(last.c) - 8.5} width={padR - 2} height={17} rx={4} fill={lc} />
          <SvgText x={W + 6} y={y(last.c) + 4} fontSize={10} fontWeight="800" fill={ink(lc)}>{last.c.toFixed(dec)}</SvgText>
          {!!gran && (() => {
            const left = candleLeft(gran, tick), ty = y(last.c) + 25 > height ? y(last.c) - 24 : y(last.c) + 9;
            return <G><Rect x={W + 1} y={ty} width={padR - 2} height={16} rx={4} fill={th.solid} stroke={lc} strokeWidth={1} /><SvgText x={W + padR / 2} y={ty + 11.5} fontSize={10} fontWeight="800" fill={lc} textAnchor="middle">{fmtLeft(left)}</SvgText></G>;
          })()}
          {z.cross && (() => {
            const ci = z.idxAt(z.cross.x), cy = Math.max(8, Math.min(height - 8, z.cross.y)), price = lo + (1 - (cy - 8) / (height - 16)) * rng;
            return <CrossLayer x={X(ci)} y={cy} W={W} H={height - 2} padR={padR} price={price.toFixed(dec)} time={fmtTime(all[ci].t, gran)} />;
          })()}
        </Svg>
        {z.cross && (() => {
          const ci = z.idxAt(z.cross.x), cy = Math.max(8, Math.min(height - 8, z.cross.y)), price = lo + (1 - (cy - 8) / (height - 16)) * rng;
          return <Readout c={all[ci]} prev={all[ci - 1]?.c} dec={dec} onClose={z.clearCross} onAlert={onAlert ? () => { onAlert(price); z.clearCross(); } : undefined} />;
        })()}

        {panes.map((p) => {
          const py = (v: number) => 14 + (1 - (v - p.min) / (p.max - p.min || 1)) * (PANE_H - 22);
          return (
            <View key={p.id} style={{ marginTop: 6, borderTopWidth: 1, borderColor: th.line }}>
              <Svg width={width} height={PANE_H} style={{ overflow: 'hidden' }}>
                <SvgText x={4} y={10} fontSize={9} fontWeight="800" fill={th.dim}>{p.title}  <SvgText fill={th.text}>{p.value}</SvgText></SvgText>
                {(p.guides ?? []).map((g, k) => <G key={k}><Line x1={0} x2={W} y1={py(g.v)} y2={py(g.v)} stroke={th.line} strokeWidth={0.8} strokeDasharray="3 3" /><SvgText x={W + 4} y={py(g.v) + 3} fontSize={8.5} fill={th.dim}>{g.v}</SvgText></G>)}
                {p.draw(py, W)}
              </Svg>
            </View>
          );
        })}
      </View>
      <ZoomBar z={z} />
    </View>
  );
}
