import React, { useEffect, useRef, useState } from 'react';
import Svg, { Defs, LinearGradient, Stop, Path, Rect, Line, G, Text as SText } from 'react-native-svg';
import { Platform } from 'react-native';
import { frame, Vr, UP, DN } from './splashMath';

const BLUE = '#2F5BFF', MUTE = '#8A93A6', INK = '#1E3778';
const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

// The same endless live candle chart as the start screen (maths in splashMath.ts), drawn on a light card. Used on the website's landing page.
export default function LiveCandles({ width, height }: { width: number; height: number }) {
  const [t, setT] = useState(2200);
  const vr = useRef<Vr>({ lo: 0, hi: 0, set: false, t: 0 }).current;
  useEffect(() => {
    let raf = 0; const t0 = Date.now();
    const loop = () => { setT(2200 + Date.now() - t0); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const W = Math.max(280, width), H = Math.max(160, height);
  const f = frame(t, { W, H, top: 0, lh: 0, y0: 14, y1: H - 6, shift: 0, bottom: 0 }, vr);
  return (
    <Svg width={W} height={H}>
      <Defs>
        <LinearGradient id="lcfade" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <G>
        <Path d={f.grid} stroke={INK} strokeOpacity={0.07} strokeWidth={1} fill="none" />
        <Path d={f.vgrid} stroke={INK} strokeOpacity={0.05} strokeWidth={1} fill="none" />
        <Line x1={0} x2={W} y1={f.y1 + 0.5} y2={f.y1 + 0.5} stroke={INK} strokeOpacity={0.14} strokeWidth={1} />
        <Path d={f.volUp} fill={UP} fillOpacity={0.23} />
        <Path d={f.volDn} fill={DN} fillOpacity={0.23} />
        <Path d={f.ema} stroke={BLUE} strokeOpacity={0.85} strokeWidth={1.8} strokeLinejoin="round" fill="none" />
        <Path d={f.wickUp} stroke={UP} strokeWidth={1.4} fill="none" />
        <Path d={f.wickDn} stroke={DN} strokeWidth={1.4} fill="none" />
        <Path d={f.bodyUp} fill={UP} />
        <Path d={f.bodyDn} fill={DN} />
        <Rect x={0} y={f.y0 - 6} width={f.x0 + f.sw * 4} height={f.y1 - f.y0 + 10} fill="url(#lcfade)" />
        {f.labels.map((l) => <SText key={l.txt} x={f.x1 + 8} y={l.y + 3.5} fontSize={9.5} fill={MUTE} fontFamily={MONO}>{l.txt}</SText>)}
        <Line x1={f.tag.x} x2={f.x1 + 4} y1={f.tag.y} y2={f.tag.y} stroke={f.tag.col} strokeOpacity={0.6} strokeWidth={1.2} strokeDasharray="5,4" />
        <Rect x={f.x1 + 2} y={f.tag.y - 9} width={W - f.x1 - 8} height={18} rx={4} fill={f.tag.col} />
        <SText x={f.x1 + 2 + (W - f.x1 - 8) / 2} y={f.tag.y + 3.5} fontSize={10} fontWeight="700" fill="#FFFFFF" textAnchor="middle" fontFamily={MONO}>{f.tag.txt}</SText>
      </G>
    </Svg>
  );
}
