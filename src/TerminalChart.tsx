import React, { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import Svg, { Line, Rect, G, Polyline, Defs, ClipPath, Text as SvgText } from 'react-native-svg';
import { useApp } from './store';
import { Candle, watchCandles, TFS, candleLeft, fmtLeft } from './markets';
import { useZoom, ChartHud, CrossLayer, Readout, fmtTime } from './ChartZoom';
import { RadialWheel, WheelAction } from './Mt5Wheel';
import { niceTicks, niceEvery } from './smoothZoom';
import { Position, totalPnl } from './positions';
import { fmtLots } from './lots';
import { ink } from './theme';

// The chart of the Manual Trade screen, laid out like the MetaTrader 5 phone chart:
//  - no scroll bars: pinch zooms, one finger drags, drag the price axis to scale the price, double tap the axis to fit it again
//  - the symbol and timeframe in blue at the top left, the live price tag with the candle countdown on the axis, a bid line and an ask line
//  - every open position of this symbol is drawn as a dashed line with a tag "BUY 0.25, +12.40 USD". TAP THE TAG to manage the trade
//    (stop loss, take profit, break-even, close by %). Stop loss / take profit lines have tags of their own with the money they stand for.
//  - tap an empty part of the chart for the round quick wheel (timeframes, crosshair, fit, chart type)
export type Hit = { id: string; part: 'pos' | 'sl' | 'tp' };
type Rect4 = { x: number; y: number; w: number; h: number; hit: Hit };

function useCandles(symId: string, gran: number) {
  const [c, setC] = useState<Candle[]>([]);
  const [err, setErr] = useState('');
  useEffect(() => {
    setC([]); setErr('');
    let un: (() => void) | undefined;
    try { un = watchCandles(symId, gran, (x) => { setC(x); setErr(''); }, (m) => setErr(m || 'No candles'), undefined, 300); } catch { setErr('No candles'); }
    return () => { try { un?.(); } catch {} };
  }, [symId, gran]);
  return { c, err };
}

const money = (n: number) => `${n >= 0 ? '+' : '-'}${Math.abs(n).toFixed(2)} USD`;

export default function TerminalChart({ symId, name, dec, gran, onGran, positions, bid, ask, mark, width, height, onManage, openWheel }: {
  openWheel?: number; symId: string; name: string; dec: number; gran: number; onGran: (k: string) => void; positions: Position[];
  bid?: number; ask?: number; mark: (p: Position) => number | undefined; width: number; height: number; onManage: (h: Hit) => void;
}) {
  const { th } = useApp();
  const { c: data, err } = useCandles(symId, gran);
  const [wheel, setWheel] = useState(false), [line, setLine] = useState(false);
  const rects = useRef<Rect4[]>([]);
  const padR = 62, padT = 34, padB = 18, W = width - padR, H = height - padT - padB;
  const z = useZoom(data.length, W, height, {
    initial: 80, shift: 0.12,
    onTap: (x, y) => { // a tap on a position tag manages that trade, anywhere else it opens / closes the wheel
      const hit = rects.current.find((r) => x >= r.x - 6 && x <= r.x + r.w + 6 && y >= r.y - 6 && y <= r.y + r.h + 6);
      if (hit) { setWheel(false); onManage(hit.hit); } else setWheel((w) => !w);
    },
  });
  useEffect(() => { z.reset(false); setWheel(false); }, [symId, gran]); // a new pair or timeframe starts from the default view
  useEffect(() => { if (openWheel) setWheel(true); }, [openWheel]); // the timeframe button above the chart opens the wheel
  const [tick, setTick] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setTick(Date.now()), 1000); return () => clearInterval(id); }, []);

  const tfLabel = TFS.find((t) => t.k === String(gran))?.label ?? `${gran}s`;
  if (data.length < 3) {
    return (
      <View style={{ width, height, alignItems: 'center', justifyContent: 'center', backgroundColor: th.bg, gap: 8, padding: 20 }}>
        {err ? <Text style={{ color: th.dim, textAlign: 'center', fontSize: 12.5, lineHeight: 18 }}>{err}. Candles are not available for this pair / timeframe right now. Try another timeframe.</Text> : <ActivityIndicator color={th.accent} />}
      </View>
    );
  }

  rects.current = [];
  const s0 = z.start, e0 = z.end, vis = data.slice(s0, e0), step = z.step, bw = Math.max(1, step * 0.62);
  const last = data[data.length - 1], lc = last.c >= last.o ? th.buy : th.sell, px = bid ?? last.c;
  const hi0 = Math.max(...vis.map((x) => x.h), px), lo0 = Math.min(...vis.map((x) => x.l), px), pad = (hi0 - lo0) * 0.05 || Math.abs(px) * 0.0005;
  const { hi, lo } = z.fitY(hi0 + pad, lo0 - pad);
  const rng = hi - lo || 1, y = (v: number) => padT + (1 - (v - lo) / rng) * H;
  const X = (i: number) => (i - s0) * step + step / 2 + z.shift;
  const inView = (v: number) => v >= lo && v <= hi;
  const yc = (v: number) => Math.max(padT + 10, Math.min(padT + H - 10, y(v))); // tags of levels outside the view stay on the edge
  const crossCandle = z.cross ? Math.max(0, Math.min(data.length - 1, z.idxAt(z.cross.x))) : -1;

  const wheelActions: WheelAction[] = [
    { key: 'type', icon: 'trending-up', label: 'Line / candles', on: line, press: () => setLine((v) => !v) },
    { key: 'cross', icon: 'locate', label: 'Crosshair', on: z.crossMode, press: () => z.setCrossMode(!z.crossMode) },
    { key: 'fit', icon: 'copy-outline', label: 'Fit the chart', press: () => z.reset() },
  ];

  // a pill (tag) with text; registers its rectangle so a tap on it opens the trade options
  const pill = (key: string, x: number, cy: number, text: string, color: string, hit: Hit, filled = false) => {
    const w = Math.max(54, text.length * 5.7 + 14), h = 17, yy = cy - h / 2;
    rects.current.push({ x, y: yy, w, h, hit });
    return (
      <G key={key}>
        <Rect x={x} y={yy} width={w} height={h} rx={4} fill={filled ? color : th.solid} fillOpacity={filled ? 1 : 0.94} stroke={color} strokeWidth={1.1} />
        <SvgText x={x + 7} y={yy + 12} fontSize={9.5} fontWeight="800" fill={filled ? ink(color) : color}>{text}</SvgText>
      </G>
    );
  };

  const overlay: React.ReactNode[] = [];
  positions.forEach((p) => {
    const m = mark(p), sideC = p.side === 'buy' ? th.buy : th.sell;
    const pnl = m !== undefined ? totalPnl(p, m) : p.realized, pc = pnl >= 0 ? th.buy : th.sell;
    const yo = yc(p.open), shown = inView(p.open);
    overlay.push(
      <G key={`pos${p.id}`}>
        {shown && <Line x1={0} x2={W} y1={y(p.open)} y2={y(p.open)} stroke={sideC} strokeWidth={1.1} strokeDasharray="5 4" />}
        {pill(`pp${p.id}`, 6, yo, `${shown ? '' : p.open > hi ? '▲ ' : '▼ '}${p.side.toUpperCase()} ${fmtLots(p.lots)}, ${money(pnl)}`, pc, { id: p.id, part: 'pos' })}
      </G>,
    );
    const levels: [number | undefined, 'sl' | 'tp'][] = [[p.sl, 'sl'], [p.tp, 'tp']];
    levels.forEach(([v, part]) => {
      if (v === undefined) return;
      const c = part === 'sl' ? th.sell : th.buy, at = totalPnl(p, v), txt = `${part.toUpperCase()} ${v.toFixed(dec)}  ${at >= 0 ? '+' : '-'}${Math.abs(at).toFixed(2)}`;
      const w = Math.max(54, txt.length * 5.7 + 14);
      overlay.push(
        <G key={`${part}${p.id}`}>
          {inView(v) && <Line x1={0} x2={W} y1={y(v)} y2={y(v)} stroke={c} strokeWidth={1} strokeDasharray="2 4" />}
          {pill(`${part}t${p.id}`, W - w - 6, yc(v), txt, c, { id: p.id, part })}
        </G>,
      );
    });
  });

  const pathLine = vis.map((c, i) => `${X(s0 + i)},${y(c.c)}`).join(' ');
  const everyT = niceEvery(step, 78);
  const left = candleLeft(gran, tick), ty = y(px) + 25 > padT + H ? y(px) - 24 : y(px) + 9;

  return (
    <View style={{ width, height, direction: 'ltr', backgroundColor: th.bg }}>
      <View {...z.handlers} style={{ width, height }}>
        <Svg width={width} height={height} style={{ overflow: 'hidden' }}>
          <Defs><ClipPath id="plotClipTerm"><Rect x={0} y={padT} width={W} height={H} /></ClipPath></Defs>
          <Line x1={W} x2={W} y1={0} y2={height} stroke={th.hair} strokeWidth={1} />
          {niceTicks(lo, hi, Math.max(4, Math.round(H / 46))).map((v) => (
            <G key={`g${v}`}>
              <Line x1={0} x2={W} y1={y(v)} y2={y(v)} stroke={th.line} strokeOpacity={0.6} strokeWidth={0.6} strokeDasharray="1 4" />
              <SvgText x={W + 6} y={y(v) + 3} fontSize={9.5} fontWeight="600" fill={th.dim}>{v.toFixed(dec)}</SvgText>
            </G>
          ))}
          {(() => { const out: React.ReactNode[] = []; for (let i = Math.ceil(Math.max(0, z.startF) / everyT) * everyT; i < e0 && i < data.length; i += everyT) { const x = X(i); if (x > 24 && x < W - 24) { out.push(<Line key={`vl${i}`} x1={x} x2={x} y1={padT} y2={padT + H} stroke={th.line} strokeOpacity={0.45} strokeWidth={0.6} strokeDasharray="1 4" />); out.push(<SvgText key={`tx${i}`} x={x} y={height - 4} fontSize={9} fontWeight="600" fill={th.dim} textAnchor="middle">{fmtTime(data[i].t, gran)}</SvgText>); } } return out; })()}

          <G clipPath="url(#plotClipTerm)">
            {line ? <Polyline points={pathLine} fill="none" stroke={th.accent} strokeWidth={1.8} /> : vis.map((c, i) => {
              const col = c.c >= c.o ? th.buy : th.sell, x = X(s0 + i);
              return (
                <G key={`${c.t}-${i}`}>
                  <Line x1={x} x2={x} y1={y(c.h)} y2={y(c.l)} stroke={col} strokeWidth={1} />
                  <Rect x={x - bw / 2} y={Math.min(y(c.o), y(c.c))} width={bw} height={Math.max(1, Math.abs(y(c.o) - y(c.c)))} fill={col} />
                </G>
              );
            })}
          </G>

          {/* header, like MT5: SYMBOL • TIMEFRAME, then the open / high / low / close of the newest candle */}
          <SvgText x={6} y={14} fontSize={11.5} fontWeight="800" fill={th.accent}>{name} <SvgText fill={th.dim} fontWeight="600">• {tfLabel}</SvgText></SvgText>
          <SvgText x={6} y={27} fontSize={9.5} fill={th.dim}>O {last.o.toFixed(dec)}  H {last.h.toFixed(dec)}  L {last.l.toFixed(dec)}  C {last.c.toFixed(dec)}</SvgText>

          {/* ask line, bid line */}
          {ask !== undefined && bid !== undefined && ask > bid && inView(ask) && <Line x1={0} x2={W} y1={y(ask)} y2={y(ask)} stroke={th.sell} strokeWidth={0.9} strokeOpacity={0.85} />}
          {inView(px) && <Line x1={0} x2={W} y1={y(px)} y2={y(px)} stroke={lc} strokeWidth={0.9} />}
          {inView(px) && (
            <G>
              <Rect x={W + 1} y={y(px) - 8.5} width={padR - 2} height={17} rx={3} fill={lc} />
              <SvgText x={W + 5} y={y(px) + 4} fontSize={10} fontWeight="800" fill={ink(lc)}>{px.toFixed(dec)}</SvgText>
              <Rect x={W + 1} y={ty} width={padR - 2} height={16} rx={3} fill={th.solid} stroke={lc} strokeWidth={1} />
              <SvgText x={W + padR / 2} y={ty + 11.5} fontSize={10} fontWeight="800" fill={lc} textAnchor="middle">{fmtLeft(left)}</SvgText>
            </G>
          )}

          {overlay}

          {z.cross && crossCandle >= 0 && (() => {
            const cy = Math.max(padT, Math.min(padT + H, z.cross.y)), price = lo + (1 - (cy - padT) / H) * rng;
            return <CrossLayer x={X(crossCandle)} y={cy} W={W} H={height - 2} padR={padR} price={price.toFixed(dec)} time={fmtTime(data[crossCandle].t, gran)} />;
          })()}
        </Svg>
        {z.cross && crossCandle >= 0 && <Readout c={data[crossCandle]} prev={data[crossCandle - 1]?.c} dec={dec} onClose={z.clearCross} />}
        <ChartHud z={z} top={height - 54} right={padR + 8} />
        {wheel && (
          <View onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()} style={{ position: 'absolute', left: 0, top: 0, width, height }}>
            <RadialWheel w={width} h={height} tfs={TFS} current={String(gran)} onTf={onGran} onClose={() => setWheel(false)} actions={wheelActions} />
          </View>
        )}
      </View>
    </View>
  );
}

