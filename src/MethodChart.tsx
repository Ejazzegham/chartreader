import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import Svg, { Line, Rect, G, Circle, Polygon, Polyline, Defs, LinearGradient as SvgGrad, Stop, Text as SvgText } from 'react-native-svg';
import { ink } from './theme';
import { useApp } from './store';
import type { Candle } from './markets';
import type { All } from './refine';
import { useZoom, ZoomBar, CrossLayer, Readout, fmtTime } from './ChartZoom';
import { candleMarks } from './candles';

// Heikin Ashi candles (same length as the input, so analysis indexes still line up)
export function heikin(c: Candle[]): Candle[] {
  const out: Candle[] = [];
  c.forEach((x, i) => {
    const cl = (x.o + x.h + x.l + x.c) / 4, op = i ? (out[i - 1].o + out[i - 1].c) / 2 : (x.o + x.c) / 2;
    out.push({ ...x, o: op, c: cl, h: Math.max(x.h, op, cl), l: Math.min(x.l, op, cl) });
  });
  return out;
}

export type Method = 'ict' | 'smc' | 'vsa' | 'pat' | 'candle' | 'scalp' | 'all';
export type ChartLine = { v: number[]; color: string; label: string };
export type ChartPlan = { entry: number; sl: number; tps: number[]; tag: string };
type Lv = { v: number; color: string; label: string; dash?: string; w?: number };

// One candle chart for every method. Zoom and pan built in. The overlay changes with the selected method.
export default function MethodChart({ data, all, method, width, dec, height = 330, lines, plan, marks, patterns, gran }: { data: Candle[]; all: All; method: Method; width: number; dec: number; height?: number; patterns?: boolean; gran?: number; lines?: ChartLine[]; plan?: ChartPlan | null; marks?: { v: number; color: string; label: string }[] }) {
  const { th } = useApp();
  const z = useZoom(data.length, width - 62);
  const showPat = method === 'candle' || !!patterns;
  const cmarks = React.useMemo(() => (showPat ? candleMarks(data) : []), [showPat, data]);
  if (data.length < 2) return <View style={{ height, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={th.accent} /></View>;

  const { ict, smc, vsa, pat, cdl, scalp, combo } = all;
  const padR = 62, W = width - padR, s0 = z.start, vis = data.slice(z.start, z.end), n = z.slots; // slots = candles + empty space on the right
  const volOn = method === 'vsa' && vsa.hasVolume;
  const plotH = height - 16 - (volOn ? height * 0.16 : 0);

  // entry / stop / targets for the selected method
  const pick = plan ? plan : method === 'scalp' ? (scalp.setup && { entry: scalp.setup.entry, sl: scalp.setup.sl, tps: scalp.setup.tps, tag: 'SCALP' })
    : method === 'ict' ? (ict.setup && { entry: ict.setup.entry, sl: ict.setup.sl, tps: ict.setup.tps, tag: 'ICT' })
    : method === 'smc' ? (smc.setup && { entry: smc.setup.entry, sl: smc.setup.sl, tps: smc.setup.tps, tag: 'SMC' })
    : method === 'vsa' ? (vsa.setup && { entry: vsa.setup.entry, sl: vsa.setup.sl, tps: vsa.setup.tps, tag: 'VSA' })
    : method === 'candle' ? (cdl.setup && { entry: cdl.setup.entry, sl: cdl.setup.sl, tps: cdl.setup.tps, tag: cdl.setup.state === 'armed' ? 'WAIT' : 'CANDLE' })
    : method === 'pat' ? (pat.setup && { entry: pat.setup.entry, sl: pat.setup.sl, tps: pat.setup.tps, tag: 'PAT' })
    : (combo && { entry: combo.entry, sl: combo.sl, tps: combo.tps, tag: 'ENTRY' });
  const lv: Lv[] = pick ? [
    { v: pick.sl, color: th.sell, label: 'SL' },
    ...pick.tps.map((p, k) => ({ v: p, color: th.buy, label: `TP${k + 1}` })),
    { v: pick.entry, color: th.accent, label: pick.tag, dash: '0', w: 1.8 },
  ] : [];
  const patTarget = method === 'pat' && pat.best ? pat.best.target : undefined;

  const hi = Math.max(...vis.map((c) => c.h), ...lv.map((l) => l.v)), lo = Math.min(...vis.map((c) => c.l), ...lv.map((l) => l.v)), rng = hi - lo || 1;
  const y = (v: number) => 8 + (1 - (v - lo) / rng) * plotH;
  const step = W / n, bw = Math.max(1, step * 0.62), X = (i: number) => (i - s0) * step + step / 2;
  const maxV = volOn ? Math.max(...vis.map((c) => c.v ?? 0), 1) : 1;

  const box = (top: number, bottom: number, i: number, color: string, label: string, k: string) => {
    if (i >= z.end) return null;
    const x0 = Math.max(0, X(i) - step / 2);
    return (
      <G key={k}>
        <Rect x={x0} y={y(Math.max(top, bottom))} width={Math.max(4, W - x0)} height={Math.max(2, Math.abs(y(top) - y(bottom)))} fill={color + '28'} stroke={color} strokeWidth={0.8} />
        <SvgText x={Math.min(W - 80, x0 + 3)} y={y(Math.max(top, bottom)) + 9} fontSize={8.5} fontWeight="700" fill={color}>{label}</SvgText>
      </G>
    );
  };
  const hline = (l: Lv, k: string) => (
    <G key={k}>
      <Line x1={0} x2={W} y1={y(l.v)} y2={y(l.v)} stroke={l.color} strokeWidth={l.w ?? 1.2} strokeDasharray={l.dash ?? '6 3'} />
      <Rect x={W + 1} y={y(l.v) - 7.5} width={padR - 2} height={15} rx={4} fill={l.color} />
      <SvgText x={W + 5} y={y(l.v) + 3.2} fontSize={8.5} fontWeight="800" fill={ink(l.color)}>{l.label} {l.v.toFixed(dec)}</SvgText>
    </G>
  );
  const seg = (i1: number, p1: number, i2: number, p2: number, color: string, k: string, dash?: string) => {
    const a = Math.max(i1, s0), slope = i2 === i1 ? 0 : (p2 - p1) / (i2 - i1);
    const pa = p1 + slope * (a - i1);
    if (a >= i2 && i2 !== i1) return null;
    return <Line key={k} x1={X(a)} y1={y(pa)} x2={X(Math.min(i2, z.end - 1))} y2={y(p1 + slope * (Math.min(i2, z.end - 1) - i1))} stroke={color} strokeWidth={1.4} strokeDasharray={dash} />;
  };
  const last = data[data.length - 1], lc = last.c >= last.o ? th.buy : th.sell;
  const zx = (i: number) => i >= s0 && i < z.end;

  return (
    <View {...z.handlers} style={{ direction: 'ltr' }}>
      <Svg width={width} height={height} style={{ overflow: 'hidden' }}>
        <Defs>
          <SvgGrad id="plotWash" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={th.accent} stopOpacity={th.dark ? 0.10 : 0.07} />
            <Stop offset="1" stopColor={th.accent} stopOpacity={0} />
          </SvgGrad>
        </Defs>
        <Rect x={0} y={0} width={W} height={height} fill="url(#plotWash)" />
        <Line x1={W} x2={W} y1={0} y2={height} stroke={th.hair} strokeWidth={1} />
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => { const v = lo + f * rng; return <G key={i}><Line x1={0} x2={W} y1={y(v)} y2={y(v)} stroke={th.line} strokeOpacity={0.55} strokeWidth={0.6} strokeDasharray="1 4" /><SvgText x={W + 6} y={y(v) + 3} fontSize={9} fontWeight="600" fill={th.dim}>{v.toFixed(dec)}</SvgText></G>; })}
        {pick && (() => {
          // shaded trade plan: reward (entry to the last target) in green, risk (entry to the stop) in red
          const far = pick.tps.length ? pick.tps[pick.tps.length - 1] : pick.entry;
          return (
            <G>
              <Rect x={0} y={Math.min(y(pick.entry), y(far))} width={W} height={Math.max(1, Math.abs(y(far) - y(pick.entry)))} fill={th.buy} fillOpacity={0.09} />
              <Rect x={0} y={Math.min(y(pick.entry), y(pick.sl))} width={W} height={Math.max(1, Math.abs(y(pick.sl) - y(pick.entry)))} fill={th.sell} fillOpacity={0.09} />
            </G>
          );
        })()}

        {/* ---------- ICT ---------- */}
        {method === 'ict' && ict.ote && <Rect x={0} y={Math.min(y(ict.ote.top), y(ict.ote.bottom))} width={W} height={Math.max(2, Math.abs(y(ict.ote.top) - y(ict.ote.bottom)))} fill={th.gold + '1F'} />}
        {method === 'ict' && ict.ote && <SvgText x={4} y={Math.min(y(ict.ote.top), y(ict.ote.bottom)) + 9} fontSize={8.5} fontWeight="800" fill={th.gold}>OTE 62-79%</SvgText>}
        {method === 'ict' && ict.range && <Line x1={0} x2={W} y1={y(ict.range.eq)} y2={y(ict.range.eq)} stroke={th.accent2} strokeWidth={1} strokeDasharray="2 4" />}
        {method === 'ict' && ict.range && <SvgText x={4} y={y(ict.range.eq) - 3} fontSize={8.5} fill={th.accent2} fontWeight="700">EQ 50%</SvgText>}
        {method === 'ict' && ict.fvgs.map((q, k) => box(q.top, q.bottom, q.i, q.side === 'bullish' ? th.buy : th.sell, 'FVG', `f${k}`))}
        {method === 'ict' && ict.orderBlocks.map((q, k) => box(q.top, q.bottom, q.i, q.side === 'bullish' ? th.gold : th.poi, q.side === 'bullish' ? 'Bull OB' : 'Bear OB', `o${k}`))}
        {method === 'ict' && ict.liquidity.filter((l) => !l.swept && l.i < z.end).slice(-6).map((l, k) => (
          <G key={`l${k}`}>
            <Line x1={Math.max(0, X(l.i))} x2={W} y1={y(l.price)} y2={y(l.price)} stroke={th.dim} strokeWidth={0.9} strokeDasharray="3 3" />
            <SvgText x={W - 54} y={y(l.price) - 2} fontSize={8} fill={th.dim} fontWeight="700">{l.label ?? `${l.side}${l.equal ? ' EQ' : ''}`}</SvgText>
          </G>
        ))}

        {method === 'ict' && (ict.breakers ?? []).map((q, k) => box(q.top, q.bottom, q.i, th.poi, q.unicorn ? 'Unicorn' : 'Breaker', `b${k}`))}
        {method === 'ict' && ict.levels?.filter((l) => l.key === 'MO').map((l) => (
          <G key="mo">
            <Line x1={0} x2={W} y1={y(l.price)} y2={y(l.price)} stroke={th.accent2} strokeWidth={0.9} strokeDasharray="1 4" />
            <SvgText x={4} y={y(l.price) - 3} fontSize={8} fill={th.accent2} fontWeight="700">Midnight open</SvgText>
          </G>
        ))}
        {method === 'ict' && ict.sweep && zx(ict.sweep.i) && (
          <G>
            <Circle cx={X(ict.sweep.i)} cy={y(ict.sweep.extreme)} r={4} fill="none" stroke={th.gold} strokeWidth={1.6} />
            <SvgText x={Math.min(W - 60, X(ict.sweep.i) + 6)} y={y(ict.sweep.extreme) + (ict.sweep.side === 'SSL' ? 12 : -6)} fontSize={8.5} fontWeight="800" fill={th.gold}>Sweep</SvgText>
          </G>
        )}
        {method === 'ict' && ict.mss && zx(ict.mss.i) && (
          <G>
            <Line x1={Math.max(0, X(Math.max(s0, ict.sweep ? ict.sweep.i : ict.mss.i - 8)))} x2={X(ict.mss.i)} y1={y(ict.mss.level)} y2={y(ict.mss.level)} stroke={ict.mss.displaced ? th.accent : th.dim} strokeWidth={1.4} />
            <SvgText x={Math.max(2, X(ict.mss.i) - 40)} y={y(ict.mss.level) + (ict.mss.dir === 'bullish' ? -4 : 11)} fontSize={9} fontWeight="900" fill={ict.mss.displaced ? th.accent : th.dim}>MSS{ict.mss.displaced ? '' : ' (weak)'}</SvgText>
          </G>
        )}

        {/* ---------- SMC ---------- */}
        {method === 'smc' && smc.range && <Line x1={0} x2={W} y1={y(smc.range.eq)} y2={y(smc.range.eq)} stroke={th.accent2} strokeWidth={1} strokeDasharray="2 4" />}
        {method === 'smc' && smc.zones.map((q, k) => box(q.top, q.bottom, q.i, q.kind === 'BRK' ? th.poi : q.side === 'bullish' ? th.buy : th.sell, q.label, `z${k}`))}
        {method === 'smc' && smc.idm && zx(smc.idm.i) && (
          <G>
            <Line x1={X(smc.idm.i)} x2={W} y1={y(smc.idm.price)} y2={y(smc.idm.price)} stroke={th.gold} strokeWidth={1} strokeDasharray="3 3" />
            <SvgText x={Math.min(W - 70, X(smc.idm.i) + 3)} y={y(smc.idm.price) - 3} fontSize={8.5} fontWeight="800" fill={th.gold}>IDM {smc.idm.taken ? '✓' : '…'}</SvgText>
          </G>
        )}
        {method === 'smc' && smc.swing && zx(smc.swing.i) && (
          <G>
            <Line x1={Math.max(0, X(Math.max(s0, smc.swing.i - 14)))} x2={X(smc.swing.i)} y1={y(smc.swing.level)} y2={y(smc.swing.level)} stroke={th.accent} strokeWidth={1.3} />
            <SvgText x={Math.max(2, X(Math.max(s0, smc.swing.i - 14)))} y={y(smc.swing.level) - 3} fontSize={9} fontWeight="800" fill={th.accent}>{smc.swing.kind} (swing)</SvgText>
          </G>
        )}
        {method === 'smc' && smc.internal && zx(smc.internal.i) && (!smc.swing || smc.internal.i !== smc.swing.i) && (
          <G>
            <Line x1={Math.max(0, X(Math.max(s0, smc.internal.i - 8)))} x2={X(smc.internal.i)} y1={y(smc.internal.level)} y2={y(smc.internal.level)} stroke={th.dim} strokeWidth={1} strokeDasharray="2 2" />
            <SvgText x={Math.max(2, X(Math.max(s0, smc.internal.i - 8)))} y={y(smc.internal.level) + 9} fontSize={8} fontWeight="700" fill={th.dim}>{smc.internal.kind} (int)</SvgText>
          </G>
        )}

        {/* ---------- Patterns ---------- */}
        {method === 'pat' && pat.best && pat.best.lines.map((l, k) => seg(l.i1, l.p1, l.i2, l.p2, l.kind === 'neck' ? th.gold : l.kind === 'upper' ? th.sell : th.buy, `pl${k}`))}
        {method === 'pat' && pat.best && pat.best.points.filter((p) => zx(p.i)).map((p, k) => (
          <G key={`pp${k}`}>
            <Circle cx={X(p.i)} cy={y(p.p)} r={3} fill={th.gold} />
            {!!p.label && <SvgText x={X(p.i) - 6} y={y(p.p) + (pat.best!.dir === 'bearish' && p.label !== 'RS' ? -6 : 12)} fontSize={8.5} fontWeight="800" fill={th.gold}>{p.label}</SvgText>}
          </G>
        ))}
        {patTarget !== undefined && (
          <G>
            <Line x1={0} x2={W} y1={y(patTarget)} y2={y(patTarget)} stroke={th.poi} strokeWidth={1} strokeDasharray="2 4" />
            <SvgText x={4} y={y(patTarget) - 3} fontSize={8.5} fontWeight="800" fill={th.poi}>Target {patTarget.toFixed(dec)}</SvgText>
          </G>
        )}

        {/* ---------- Combined: the refined zone ---------- */}
        {method === 'all' && combo && box(combo.zoneTop, combo.zoneBottom, Math.max(s0, data.length - 30), combo.side === 'buy' ? th.buy : th.sell, 'Refined zone', 'cz')}

        {/* moving averages (EMA 9 / 21 / 50 for scalping, EMA 200 for top-down) */}
        {(lines ?? []).map((ln, k) => {
          const pts = vis.map((_, i) => ({ i, v: ln.v[s0 + i] })).filter((q) => isFinite(q.v)).map((q) => `${X(s0 + q.i)},${y(q.v)}`).join(' ');
          return pts ? <Polyline key={`ln${k}`} points={pts} fill="none" stroke={ln.color} strokeWidth={1.4} /> : null;
        })}
        {(lines ?? []).map((ln, k) => {
          const v = ln.v[z.end - 1];
          return isFinite(v) ? <SvgText key={`lt${k}`} x={4} y={12 + k * 11} fontSize={8.5} fontWeight="800" fill={ln.color}>{ln.label} {v.toFixed(dec)}</SvgText> : null;
        })}

        {/* candles */}
        {volOn && vis.map((c, i) => <Rect key={`v${i}`} x={i * step + step / 2 - bw / 2} y={height - 6 - ((c.v ?? 0) / maxV) * height * 0.14} width={bw} height={((c.v ?? 0) / maxV) * height * 0.14} fill={(c.c >= c.o ? th.buy : th.sell) + '66'} />)}
        {vis.map((c, i) => {
          const col = c.c >= c.o ? th.buy : th.sell, x = i * step + step / 2;
          return <G key={`${c.t}-${i}`}><Line x1={x} x2={x} y1={y(c.h)} y2={y(c.l)} stroke={col} strokeWidth={1} /><Rect x={x - bw / 2} y={Math.min(y(c.o), y(c.c))} width={bw} height={Math.max(1, Math.abs(y(c.o) - y(c.c)))} rx={Math.min(1.6, bw / 3)} fill={col} /></G>;
        })}

        {/* ICT structure break sits above the candles */}
        {method === 'ict' && ict.lastBreak && zx(ict.lastBreak.i) && (
          <G>
            <Line x1={Math.max(0, X(Math.max(s0, ict.lastBreak.i - 12)))} x2={X(ict.lastBreak.i)} y1={y(ict.lastBreak.level)} y2={y(ict.lastBreak.level)} stroke={th.accent} strokeWidth={1.2} />
            <SvgText x={Math.max(2, X(Math.max(s0, ict.lastBreak.i - 12)))} y={y(ict.lastBreak.level) - 3} fontSize={9} fontWeight="800" fill={th.accent}>{ict.lastBreak.kind === 'CHoCH' ? 'CHoCH / MSS' : 'BOS'}</SvgText>
          </G>
        )}

        {/* VSA signal markers */}
        {method === 'vsa' && vsa.signals.filter((g) => zx(g.i)).map((g, k) => {
          const c = data[g.i], x = X(g.i), bull = g.dir === 'bull', col = bull ? th.buy : th.sell;
          const yy = bull ? y(c.l) + 5 : y(c.h) - 5;
          return (
            <G key={`vs${k}`}>
              <Polygon points={bull ? `${x},${yy} ${x - 4},${yy + 7} ${x + 4},${yy + 7}` : `${x},${yy} ${x - 4},${yy - 7} ${x + 4},${yy - 7}`} fill={col} />
              <SvgText x={x} y={bull ? yy + 17 : yy - 10} fontSize={8} fontWeight="800" fill={col} textAnchor="middle">{g.tag}</SvgText>
            </G>
          );
        })}
        {method === 'vsa' && vsa.setup && zx(vsa.setup.i) && box(vsa.setup.zoneTop, vsa.setup.zoneBottom, vsa.setup.i, vsa.setup.side === 'buy' ? th.buy : th.sell, 'Confirm', 'vz')}
        {/* VSA reversal: the key level and a P / B / R / C marker on the pattern, breakout, retest and confirmation candles */}
        {method === 'vsa' && vsa.reversal && (() => {
          const r = vsa.reversal, col = r.side === 'buy' ? th.buy : th.sell, lvl = r.level;
          const pts = ([['P', r.patternI], ['B', r.breakoutI], ['R', r.retestI], ['C', r.confirmI]] as const).filter(([, i]) => i !== undefined && zx(i as number));
          return (
            <G>
              {lvl >= lo && lvl <= hi && <Line x1={Math.max(0, X(Math.max(r.patternI, s0)))} x2={W} y1={y(lvl)} y2={y(lvl)} stroke={th.gold} strokeWidth={1.2} strokeDasharray="2 3" />}
              {pts.map(([k, i]) => {
                const c = data[i as number], x = X(i as number), above = r.side === 'buy' ? k !== 'P' : k === 'P';
                const yy = above ? y(c.h) - 12 : y(c.l) + 12;
                return (
                  <G key={`rv${k}`}>
                    <Circle cx={x} cy={yy} r={7} fill={k === 'C' ? col : th.panel} stroke={k === 'C' ? col : th.gold} strokeWidth={1.2} />
                    <SvgText x={x} y={yy + 3} fontSize={8.5} fontWeight="900" fill={k === 'C' ? ink(col) : th.gold} textAnchor="middle">{k}</SvgText>
                  </G>
                );
              })}
            </G>
          );
        })()}

        {showPat && cdl.best && zx(cdl.best.i) && (
          <Rect x={X(cdl.best.from) - step / 2} y={8} width={(cdl.best.i - cdl.best.from + 1) * step} height={plotH} fill={(cdl.best.dir === 'bullish' ? th.buy : th.sell) + '16'} stroke={(cdl.best.dir === 'bullish' ? th.buy : th.sell) + '66'} strokeWidth={0.8} strokeDasharray="3 3" />
        )}
        {showPat && cmarks.filter((m) => zx(m.i)).map((m, k) => {
          const bu = m.dir === 'bullish', cx = X(m.i), cy = bu ? y(data[m.i].l) + 13 : y(data[m.i].h) - 13, col = bu ? th.buy : th.sell;
          return (
            <G key={`cm${k}`}>
              <Polygon points={bu ? `${cx},${cy - 9} ${cx - 3.5},${cy - 4} ${cx + 3.5},${cy - 4}` : `${cx},${cy + 9} ${cx - 3.5},${cy + 4} ${cx + 3.5},${cy + 4}`} fill={col} />
              <SvgText x={cx} y={bu ? cy + 6 : cy - 1} fontSize={8} fontWeight="900" fill={col} textAnchor="middle">{m.label}</SvgText>
            </G>
          );
        })}
        {(marks ?? []).filter((m) => isFinite(m.v) && m.v >= lo - rng * 0.2 && m.v <= hi + rng * 0.2).map((m, k) => hline({ v: m.v, color: m.color, label: m.label, dash: '2 4', w: 1 }, `mk${k}`))}
        {lv.map((l, k) => hline(l, `lv${k}`))}
        <Line x1={0} x2={W} y1={y(last.c)} y2={y(last.c)} stroke={lc} strokeWidth={0.8} strokeDasharray="4 3" />
        <Rect x={W + 1} y={y(last.c) - 8.5} width={padR - 2} height={17} rx={4} fill={lc} />
        <SvgText x={W + 6} y={y(last.c) + 4} fontSize={10} fontWeight="800" fill={ink(lc)}>{last.c.toFixed(dec)}</SvgText>
        {z.cross && (() => {
          const ci = z.idxAt(z.cross.x), cx = X(ci) , cy = Math.max(8, Math.min(8 + plotH, z.cross.y)), price = lo + (1 - (cy - 8) / plotH) * rng;
          return <CrossLayer x={cx} y={cy} W={W} H={height - 2} padR={padR} price={price.toFixed(dec)} time={fmtTime(data[ci].t, gran)} />;
        })()}
      </Svg>
      {z.cross && <Readout c={data[z.idxAt(z.cross.x)]} prev={data[z.idxAt(z.cross.x) - 1]?.c} dec={dec} onClose={z.clearCross} />}
      <ZoomBar z={z} />
    </View>
  );
}
