import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, PanResponder, Platform } from 'react-native';
import { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { useApp } from './store';
import { Icon } from './ui';
import { useScrollLock } from './scrollLock';
import { Z, norm, win, zoomAround, panBy, setVis, centerAt, indexAt, minimap } from './zoomMath';

export type Cross = { x: number; y: number };

// Premium zoom for the candle charts.
//  - pinch zooms around the point between your two fingers (the candle under them stays put)
//  - drag pans, and a flick keeps gliding (inertia)
//  - you can pan a little past the newest candle, so the last candle is not glued to the price axis
//  - touch and hold shows a crosshair; drag to read any candle (O H L C, time, price)
//  - the bar under the chart: minimap, zoom buttons, quick presets, jump to newest
// Same shape as before (start, end, count, handlers ...) plus `slots` / `pad` for the empty space and `cross`.
export function useZoom(total: number, width: number) {
  const [st, setSt] = useState<Z>({ vis: 0, off: 0 });
  const [cross, setCrossS] = useState<Cross | null>(null);
  const ref = useRef<View>(null);
  const lockPage = useScrollLock();
  const lockRef = useRef(lockPage); lockRef.current = lockPage;
  const R = useRef({ total, width, cur: { vis: 0, off: 0 } as Z, base: { vis: 0, off: 0 } as Z, d0: 0, anchor: 0.5, left: 0, top: 0, crossOn: false, timer: null as any, sx: 0, sy: 0, raf: 0 as any, pan: false });
  R.current.total = total; R.current.width = width;
  const cur = norm(st, total);
  R.current.cur = cur;

  const upd = (fn: (c: Z) => Z) => setSt((p) => { const n = norm(fn(norm(p, R.current.total)), R.current.total); R.current.cur = n; return n; });
  const stopGlide = () => { if (R.current.raf) { cancelAnimationFrame(R.current.raf); R.current.raf = 0; } };
  const measure = () => { ref.current?.measure?.((_x, _y, _w, _h, px, py) => { R.current.left = px; R.current.top = py; }); };
  const place = (pageX: number, pageY: number) => setCrossS({ x: Math.max(0, Math.min(R.current.width, pageX - R.current.left)), y: Math.max(0, pageY - R.current.top) });
  const clearCross = () => { R.current.crossOn = false; setCrossS(null); };
  useEffect(() => () => { stopGlide(); clearTimeout(R.current.timer); lockRef.current(false); }, []);
  // Website: mouse wheel zooms around the pointer, and moving the mouse over the chart shows the crosshair (the phone uses pinch / touch and hold).
  const webOff = useRef<null | (() => void)>(null), webEl = useRef<any>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el: any = ref.current;
    if (!el || !el.addEventListener || el === webEl.current) return;
    webOff.current?.(); webEl.current = el;
    const wheel = (e: WheelEvent) => { e.preventDefault(); const rc = el.getBoundingClientRect(); const a = Math.min(1, Math.max(0, (e.clientX - rc.left) / Math.max(1, rc.width))); upd((c) => zoomAround(c, R.current.total, e.deltaY < 0 ? 0.85 : 1 / 0.85, a)); };
    const move = (e: MouseEvent) => { if (e.buttons) return; const rc = el.getBoundingClientRect(); setCrossS({ x: Math.max(0, Math.min(R.current.width, e.clientX - rc.left)), y: Math.max(0, e.clientY - rc.top) }); };
    const leave = () => setCrossS(null);
    el.addEventListener('wheel', wheel, { passive: false }); el.addEventListener('mousemove', move); el.addEventListener('mouseleave', leave);
    webOff.current = () => { el.removeEventListener('wheel', wheel); el.removeEventListener('mousemove', move); el.removeEventListener('mouseleave', leave); };
  });
  useEffect(() => () => { webOff.current?.(); }, []);

  const pr = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (e, g) => R.current.crossOn || e.nativeEvent.touches.length >= 2 || (Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5),
    onMoveShouldSetPanResponderCapture: (e, g) => R.current.crossOn || e.nativeEvent.touches.length >= 2 || (Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 2),
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { stopGlide(); R.current.base = { ...R.current.cur }; R.current.d0 = 0; R.current.pan = false; },
    onPanResponderMove: (e, g) => {
      const r = R.current, t = e.nativeEvent.touches;
      if (r.crossOn) return; // the crosshair follows through onTouchMove
      if (t.length >= 2) {
        const d = Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
        if (!r.d0) { r.d0 = d; r.base = { ...r.cur }; r.anchor = Math.max(0, Math.min(1, ((t[0].pageX + t[1].pageX) / 2 - r.left) / Math.max(1, r.width))); return; }
        const n = zoomAround(r.base, r.total, r.d0 / Math.max(d, 1), r.anchor);
        r.cur = n; setSt(n);
      } else if (!r.d0) {
        r.pan = true;
        const step = r.width / Math.max(r.base.vis, 1);
        const n = panBy(r.base, r.total, Math.round(g.dx / Math.max(step, 1)));
        r.cur = n; setSt(n);
      }
    },
    onPanResponderRelease: (_e, g) => {
      const r = R.current;
      if (r.crossOn || !r.pan || r.d0 || Math.abs(g.vx) < 0.12) return;
      // inertia: candles per frame, friction every frame
      let v = (g.vx * 16) / Math.max(r.width / Math.max(r.cur.vis, 1), 1), acc = r.cur.off, frames = 0;
      const tick = () => {
        v *= 0.93; acc += v; frames++;
        const n = norm({ vis: r.cur.vis, off: acc }, r.total), hitEnd = Math.abs(n.off - acc) > 0.5;
        r.cur = n; setSt(n);
        if (Math.abs(v) > 0.03 && frames < 90 && !hitEnd) r.raf = requestAnimationFrame(tick); else r.raf = 0;
      };
      r.raf = requestAnimationFrame(tick);
    },
  })).current;

  const handlers: any = {
    ...pr.panHandlers,
    ref,
    // touch and hold (about 0.4 s without moving) switches the crosshair on
    onTouchStart: (e: any) => {
      const r = R.current, t = e.nativeEvent.touches;
      lockRef.current(true); // the page must not scroll while a finger is on the chart
      if (r.crossOn) clearCross();
      clearTimeout(r.timer); measure();
      if (t.length !== 1) return;
      r.sx = t[0].pageX; r.sy = t[0].pageY;
      r.timer = setTimeout(() => { r.crossOn = true; place(r.sx, r.sy); }, 400);
    },
    onTouchMove: (e: any) => {
      const r = R.current, t = e.nativeEvent.touches;
      if (r.crossOn) { place(t[0].pageX, t[0].pageY); return; }
      if (t.length >= 2 || Math.abs(t[0].pageX - r.sx) > 10 || Math.abs(t[0].pageY - r.sy) > 10) clearTimeout(r.timer);
    },
    onTouchEnd: (e: any) => { clearTimeout(R.current.timer); if (!e.nativeEvent.touches?.length) lockRef.current(false); },
    onTouchCancel: () => { clearTimeout(R.current.timer); lockRef.current(false); },
  };

  const w = win(cur, total), mm = minimap(cur, total);
  return {
    start: w.start, end: w.end, pad: w.pad, slots: Math.max(1, w.slots), count: cur.vis, total, zoomed: cur.vis < total || cur.off !== 0, handlers,
    atLatest: cur.off <= 0, mm, cross, clearCross,
    idxAt: (x: number) => indexAt(cur, total, x, R.current.width),
    zoomIn: () => upd((c) => zoomAround(c, R.current.total, 0.7, 1)),
    zoomOut: () => upd((c) => zoomAround(c, R.current.total, 1 / 0.7, 1)),
    setCount: (n: number) => upd((c) => setVis(c, R.current.total, n)),
    latest: () => { stopGlide(); upd((c) => ({ vis: c.vis, off: 0 })); },
    centerAt: (frac: number) => upd((c) => centerAt(c, R.current.total, frac)),
    panLeft: () => upd((c) => panBy(c, R.current.total, Math.max(1, Math.round(c.vis * 0.25)))),
    panRight: () => upd((c) => panBy(c, R.current.total, -Math.max(1, Math.round(c.vis * 0.25)))),
    reset: () => { stopGlide(); setSt({ vis: 0, off: 0 }); },
    canIn: cur.vis > Math.min(12, total), canOut: cur.vis < total,
  };
}

export type Zoom = ReturnType<typeof useZoom>;

// ---------------------------------------------------------------- toolbar under the chart
export function ZoomBar({ z }: { z: Zoom }) {
  const { th } = useApp();
  const [tw, setTw] = useState(0);
  const left = useRef(0), zr = useRef(z);
  zr.current = z;
  const trackRef = useRef<View>(null);
  const pr = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true, onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e, g) => { trackRef.current?.measure?.((_x, _y, w, _h, px) => { left.current = px; zr.current.centerAt((g.x0 - px) / Math.max(1, w)); }); },
    onPanResponderMove: (_e, g) => zr.current.centerAt((g.moveX - left.current) / Math.max(1, tw)),
  })).current;

  const B = ({ icon, on, off, hot }: { icon: string; on: () => void; off?: boolean; hot?: boolean }) => (
    <Pressable onPress={on} disabled={off} hitSlop={5} style={({ pressed }) => ({ width: 34, height: 30, borderRadius: 8, borderWidth: 1, borderColor: hot ? th.accent : th.line, backgroundColor: hot ? th.accent + '22' : th.bg, alignItems: 'center', justifyContent: 'center', opacity: off ? 0.35 : pressed ? 0.7 : 1 })}>
      <Icon name={icon} size={16} color={hot ? th.accent : th.text} />
    </Pressable>
  );
  const presets = [30, 60, 120].filter((n) => n < z.total - 5);
  const Chip = ({ label, on, press }: { label: string; on: boolean; press: () => void }) => (
    <Pressable onPress={press} hitSlop={4} style={{ height: 30, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: on ? th.accent : th.line, backgroundColor: on ? th.accent : th.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: on ? th.onAccent : th.dim, fontSize: 11.5, fontWeight: '900' }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ paddingTop: 8, gap: 8, direction: 'ltr' }}>
      {/* minimap: the thumb is the part of the history you see. Drag it or tap the track to jump. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View ref={trackRef} onLayout={(e) => setTw(e.nativeEvent.layout.width)} {...pr.panHandlers} style={{ flex: 1, height: 22, justifyContent: 'center' }}>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: th.line.slice(0, 7) + 'AA', overflow: 'hidden' }}>
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: `${z.mm.left * 100}%`, width: `${Math.max(4, z.mm.width * 100)}%`, borderRadius: 4, backgroundColor: th.accent }} />
          </View>
        </View>
        <Text style={{ color: th.dim, fontSize: 11, fontWeight: '700', minWidth: 62, textAlign: 'right' }}>{z.count} candles</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <B icon="remove" on={z.zoomOut} off={!z.canOut} />
        <B icon="add" on={z.zoomIn} off={!z.canIn} />
        {presets.map((n) => <Chip key={n} label={String(n)} on={z.count === n} press={() => z.setCount(n)} />)}
        <Chip label="All" on={z.count >= z.total} press={() => z.setCount(z.total)} />
        <View style={{ flex: 1 }} />
        <Pressable onPress={z.latest} hitSlop={4} style={{ height: 30, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: z.atLatest && z.pad === 0 ? th.line : th.accent, backgroundColor: z.atLatest && z.pad === 0 ? th.bg : th.accent }}>
          <Icon name="play-forward" size={13} color={z.atLatest && z.pad === 0 ? th.dim : th.onAccent} />
          <Text style={{ color: z.atLatest && z.pad === 0 ? th.dim : th.onAccent, fontSize: 11.5, fontWeight: '900' }}>Latest</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- crosshair
export const fmtTime = (t: number, gran?: number) => {
  const d = new Date(t * 1000), mon = d.toLocaleString(undefined, { month: 'short' }), dd = String(d.getDate()).padStart(2, '0');
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return gran && gran >= 86400 ? `${dd} ${mon} ${d.getFullYear()}` : `${dd} ${mon} ${hm}`;
};

// SVG layer: dashed cross lines, price tag on the axis, time tag at the bottom
export function CrossLayer({ x, y, W, H, padR, price, time }: { x: number; y: number; W: number; H: number; padR: number; price: string; time: string }) {
  const { th } = useApp();
  const tw = Math.max(86, time.length * 6.4), tx = Math.max(0, Math.min(W - tw, x - tw / 2));
  return (
    <G>
      <Line x1={x} x2={x} y1={0} y2={H} stroke={th.text} strokeOpacity={0.55} strokeWidth={0.8} strokeDasharray="3 3" />
      <Line x1={0} x2={W} y1={y} y2={y} stroke={th.text} strokeOpacity={0.55} strokeWidth={0.8} strokeDasharray="3 3" />
      <Rect x={W} y={y - 8} width={padR} height={16} fill={th.text} />
      <SvgText x={W + 4} y={y + 4} fontSize={10} fontWeight="800" fill={th.bg}>{price}</SvgText>
      <Rect x={tx} y={H - 17} width={tw} height={16} rx={3} fill={th.text} />
      <SvgText x={tx + tw / 2} y={H - 5.5} fontSize={9.5} fontWeight="800" fill={th.bg} textAnchor="middle">{time}</SvgText>
    </G>
  );
}

// Card that floats over the top of the chart while the crosshair is on.
export function Readout({ c, prev, dec, onAlert, onClose }: { c: { o: number; h: number; l: number; c: number }; prev?: number; dec: number; onAlert?: () => void; onClose: () => void }) {
  const { th } = useApp();
  const up = c.c >= c.o, col = up ? th.buy : th.sell, base = prev ?? c.o, pct = base ? ((c.c - base) / base) * 100 : 0;
  const cell = (k: string, v: number) => <Text key={k} style={{ color: th.dim, fontSize: 10.5, fontWeight: '700' }}>{k} <Text style={{ color: col, fontWeight: '900' }}>{v.toFixed(dec)}</Text></Text>;
  return (
    <View onTouchStart={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 4, left: 4, right: 4, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: th.solid + 'F2', borderColor: th.line, borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8 }}>
      <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 1 }}>
        {cell('O', c.o)}{cell('H', c.h)}{cell('L', c.l)}{cell('C', c.c)}
        <Text style={{ color: col, fontSize: 10.5, fontWeight: '900' }}>{pct >= 0 ? '+' : ''}{pct.toFixed(2)}%</Text>
      </View>
      {!!onAlert && (
        <Pressable onPress={onAlert} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 26, paddingHorizontal: 8, borderRadius: 8, backgroundColor: th.gold + '26', borderWidth: 1, borderColor: th.gold + '88' }}>
          <Icon name="notifications-outline" size={13} color={th.gold} /><Text style={{ color: th.gold, fontSize: 10.5, fontWeight: '900' }}>Alert</Text>
        </Pressable>
      )}
      <Pressable onPress={onClose} hitSlop={8}><Icon name="close" size={16} color={th.dim} /></Pressable>
    </View>
  );
}
