import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import Svg, { Line, Rect, G, Circle, Defs, ClipPath, Text as SvgText } from 'react-native-svg';
import { useApp } from './store';
import { Candle, watchCandles } from './markets';
import { Signal, dirOf, floatR } from './trades';
import { fmtLots } from './lots';
import { useZoom, ChartHud, CrossLayer, Readout, fmtTime } from './ChartZoom';
import { niceTicks } from './smoothZoom';
import { ink } from './theme';

// Professional position chart for a running trade (pinch / drag / flick / crosshair like MT5): candles, the entry zone, the entry (fill), stop, take profits with the
// risk / reward areas shaded (like a position tool), the candle where the trade was opened and the live price.
const SHOW = 70;

function useCandles(symId: string, tf: string) {
  const [c, setC] = useState<Candle[]>([]);
  const [err, setErr] = useState(false);
  const gran = Number(tf);
  useEffect(() => {
    if (!isFinite(gran) || gran <= 0 || tf.includes('/')) { setErr(true); return; }
    let un: (() => void) | undefined;
    try { un = watchCandles(symId, gran, (x) => { setC(x); setErr(false); }, () => setErr(true), undefined, 150); } catch { setErr(true); }
    return () => { try { un?.(); } catch {} };
  }, [symId, gran]);
  return { c, err };
}

export default function TradeChart({ s, price, width: fullW, height = 300 }: { s: Signal; price?: number; width: number; height?: number }) {
  const { th } = useApp();
  const { c, err } = useCandles(s.symId, s.tf);
  const data = c; // all the candles we have; the first view shows the last SHOW of them
  const width = fullW; // no scroll bars (MT5 style)
  const z = useZoom(data.length, width - 66, height, { initial: SHOW, shift: 0.1 });
  if (data.length < 5) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center', backgroundColor: th.bg, borderRadius: 10, borderWidth: 1, borderColor: th.line, gap: 8, padding: 16 }}>
        {err ? <Text style={{ color: th.dim, textAlign: 'center', fontSize: 12.5, lineHeight: 18 }}>Candles are not available for this timeframe. The levels are listed below.</Text> : <ActivityIndicator color={th.accent} />}
      </View>
    );
  }
  const dec = s.dec, k = dirOf(s), buy = k === 1;
  const fill = s.fill ?? s.entry, stopNow = s.status === 'open' ? s.stop : s.sl, last = s.tps[s.tps.length - 1];
  const padR = 66, padT = 10, padB = 18, W = width - padR, H = height - padT - padB;
  const s0 = z.start, vis = data.slice(s0, z.end);
  const lv = [s.sl, stopNow, fill, ...s.tps, ...(s.zone ?? []), ...(s.level ? [s.level] : []), ...(price ? [price] : [])];
  const hi0 = Math.max(...vis.map((x) => x.h), ...lv), lo0 = Math.min(...vis.map((x) => x.l), ...lv), pad = (hi0 - lo0) * 0.04, { hi, lo } = z.fitY(hi0 + pad, lo0 - pad), rng = hi - lo || 1;
  const y = (v: number) => padT + (1 - (v - lo) / rng) * H;
  const slot = z.step, bw = Math.max(1.5, slot * 0.62), X = (i: number) => (i - s0) * slot + slot / 2 + z.shift;
  const t0 = data[0].t, t1 = data[data.length - 1].t;
  // candle where the trade opened (or where the setup was logged)
  const at = (s.filledAt ?? s.takenAt ?? s.date) / 1000;
  const openI = at >= t0 && at <= t1 + (data[1].t - t0) ? data.reduce((b, x, i) => (Math.abs(x.t - at) < Math.abs(data[b].t - at) ? i : b), 0) : -1;
  const ladder = [
    { v: last, c: th.buy, label: `TP${s.tps.length}`, hit: s.hits >= s.tps.length },
    ...s.tps.slice(0, -1).map((p, i) => ({ v: p, c: th.buy, label: `TP${i + 1}`, hit: s.hits > i })),
  ];
  const tag = (v: number, color: string, label: string, key: string, dash = '5 3', w = 1.2) => (
    <G key={key}>
      <Line x1={0} x2={W} y1={y(v)} y2={y(v)} stroke={color} strokeWidth={w} strokeDasharray={dash} />
      <Rect x={W + 2} y={y(v) - 8} width={padR - 3} height={16} rx={4} fill={color} />
      <SvgText x={W + 5} y={y(v) + 3.5} fontSize={8.5} fontWeight="800" fill={ink(color)}>{label} {v.toFixed(dec)}</SvgText>
    </G>
  );
  const profitTop = Math.min(y(fill), y(last)), profitH = Math.abs(y(last) - y(fill)), riskTop = Math.min(y(fill), y(s.sl)), riskH = Math.abs(y(fill) - y(s.sl));
  const x0 = openI >= 0 ? Math.max(0, X(openI)) : W * 0.55;
  const beDone = s.status === 'open' && s.stop === s.fill;
  const open = s.status === 'open' && price !== undefined, pnl = open ? (1 - s.done) * floatR(s, price as number) * s.risk : 0;
  const posTag = `${buy ? 'BUY' : 'SELL'}${s.lots ? ` ${fmtLots(s.lots)}` : ''}${open ? `, ${pnl >= 0 ? '+' : '-'}${Math.abs(pnl).toFixed(2)} USD` : ''}`;

  return (
    <View style={{ direction: 'ltr' }}>
     <View style={{ flexDirection: 'row', borderRadius: 10, borderWidth: 1, borderColor: th.line, backgroundColor: th.bg, overflow: 'hidden' }}>
      <View {...z.handlers} style={{ width }}>
      <Svg width={width} height={height} style={{ overflow: 'hidden' }}>
        <Defs><ClipPath id="plotClipT"><Rect x={0} y={0} width={W} height={height} /></ClipPath></Defs>
        {/* grid */}
        {niceTicks(lo, hi, 5).map((v) => <Line key={`g${v}`} x1={0} x2={W} y1={y(v)} y2={y(v)} stroke={th.line} strokeWidth={0.5} strokeDasharray="1 4" opacity={0.8} />)}
        {/* entry zone (the area the method looked at) */}
        {s.zone && <G>
          <Rect x={0} y={y(Math.max(...s.zone))} width={W} height={Math.max(2, Math.abs(y(s.zone[0]) - y(s.zone[1])))} fill={th.accent + '1C'} stroke={th.accent + '66'} strokeWidth={0.8} />
          <SvgText x={4} y={y(Math.max(...s.zone)) + 10} fontSize={8.5} fontWeight="800" fill={th.accent}>ENTRY ZONE</SvgText>
        </G>}
        {/* position tool: loss area and profit area from the entry onwards */}
        <Rect x={x0} y={riskTop} width={Math.max(0, W - x0)} height={riskH} fill={th.sell + '22'} />
        <Rect x={x0} y={profitTop} width={Math.max(0, W - x0)} height={profitH} fill={th.buy + '1F'} />
        {/* candles */}
        {vis.map((x, k) => {
          const i = s0 + k, up = x.c >= x.o, col = up ? th.buy : th.sell, cx = X(i), top = y(Math.max(x.o, x.c)), bot = y(Math.min(x.o, x.c));
          return (
            <G key={i} clipPath="url(#plotClipT)">
              <Line x1={cx} x2={cx} y1={y(x.h)} y2={y(x.l)} stroke={col} strokeWidth={1} />
              <Rect x={cx - bw / 2} y={top} width={bw} height={Math.max(1, bot - top)} fill={col} />
            </G>
          );
        })}
        {/* key level (VSA: the broken level that was retested) */}
        {s.level !== undefined && tag(s.level, th.gold, 'LEVEL', 'lvl', '2 3', 1)}
        {/* levels */}
        {ladder.map((l) => tag(l.v, th.buy, `${l.label}${l.hit ? ' ✓' : ''}`, l.label))}
        {tag(s.sl, th.sell, 'SL', 'sl')}
        {beDone && tag(stopNow, th.gold, 'BE STOP', 'be', '3 3')}
        {tag(fill, th.accent, s.status === 'open' ? 'ENTRY' : 'LIMIT', 'en', '0', 1.8)}
        <SvgText x={4} y={y(fill) - 4} fontSize={9.5} fontWeight="800" fill={open ? (pnl >= 0 ? th.buy : th.sell) : th.accent}>{posTag}</SvgText>
        {/* opened here */}
        {openI >= s0 && openI < z.end && (
          <G>
            <Line x1={X(openI)} x2={X(openI)} y1={padT} y2={padT + H} stroke={th.accent} strokeWidth={0.8} strokeDasharray="2 3" />
            <Circle cx={X(openI)} cy={y(fill)} r={5} fill={th.accent} stroke={th.panel} strokeWidth={1.5} />
            <SvgText x={Math.min(W - 40, X(openI) + 7)} y={padT + 11} fontSize={8.5} fontWeight="800" fill={th.accent}>{buy ? 'BUY' : 'SELL'} HERE</SvgText>
          </G>
        )}
        {/* live price */}
        {price !== undefined && (
          <G>
            <Line x1={0} x2={W} y1={y(price)} y2={y(price)} stroke={th.text} strokeWidth={0.8} strokeDasharray="1 3" />
            <Rect x={W + 2} y={y(price) - 8} width={padR - 3} height={16} rx={4} fill={th.text} />
            <SvgText x={W + 5} y={y(price) + 3.5} fontSize={8.5} fontWeight="900" fill={th.bg}>{price.toFixed(dec)}</SvgText>
          </G>
        )}
        {z.cross && (() => {
          const ci = z.idxAt(z.cross.x), cy = Math.max(padT, Math.min(padT + H, z.cross.y)), pr = lo + (1 - (cy - padT) / H) * rng;
          return <CrossLayer x={X(ci)} y={cy} W={W} H={height - 2} padR={padR} price={pr.toFixed(dec)} time={fmtTime(data[ci].t, Number(s.tf))} />;
        })()}
      </Svg>
      {z.cross && <Readout c={data[z.idxAt(z.cross.x)]} prev={data[z.idxAt(z.cross.x) - 1]?.c} dec={dec} vol={data[z.idxAt(z.cross.x)].v} onClose={z.clearCross} />}
      <ChartHud z={z} top={height - 50} right={padR + 8} />
      </View>
     </View>
    </View>
  );
}
