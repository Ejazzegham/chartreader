import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, PanResponder, Platform } from 'react-native';
import { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { useApp } from './store';
import { Icon } from './ui';
import { useScrollLock } from './scrollLock';
import { fmtVol } from './volume';
import { ZF, clampZ, freeZ, windowF, zoomAroundF, pinchF, panByF, setVisF, centerAtF, indexAtF, minimapF, minVis, offRange, rubber, stepMotion, velocityOf, lerpZ, easeOutCubic } from './smoothZoom';
import { VZ, VZ0, normV, isFit, applyV, zoomV, thumb, fromThumbTop, fromThumbCenter, panByPixels } from './vzoomMath';

export type Cross = { x: number; y: number };
export type ZoomOpts = {
  initial?: number;                              // candles shown at first (default: all of them)
  shift?: number;                                // empty space on the right at first, as a fraction of the screen (default 0.08 when not showing everything)
  onTap?: (x: number, y: number) => void;        // a short tap on the plot (MT5 opens the quick wheel with it)
};

const nowMs = () => ((globalThis as any).performance?.now?.() ?? Date.now()) as number;

// MT5-style smooth zoom for the candle charts.
//  - pinch zooms around the point between your two fingers and moves with them (zoom + pan together). Nothing is rounded to whole
//    candles, so the candle width changes continuously and the candle under your fingers never slips
//  - one render per screen frame at most, no matter how many touch events arrive
//  - drag pans; a flick glides on with real inertia; dragging past the end resists like a rubber band and bounces back
//  - touch and hold (or the crosshair button) shows a crosshair; drag to read any candle
//  - price scale: drag on the price axis, or pinch with the fingers above each other; double tap the axis = fit again;
//    with a manual price scale a one finger drag moves the chart up and down too (like MT5). Auto-fit eases instead of jumping.
//  - buttons, presets and "latest" animate (ease-out) instead of snapping
// Same shape as before (start, end, count, handlers ...) plus step / shift / startF for pixel exact drawing: candle i is centred
// at  (i - start) * step + step / 2 + shift.
export function useZoom(total: number, width: number, height = 300, opts: ZoomOpts = {}) {
  const [st, setSt] = useState<ZF>({ vis: 0, off: NaN });
  const [vz, setVzS] = useState<VZ>(VZ0);
  const [cross, setCrossS] = useState<Cross | null>(null);
  const [crossMode, setCrossModeS] = useState(false);
  const [, setEase] = useState(0);
  const ref = useRef<View>(null);
  const lockPage = useScrollLock();
  const lockRef = useRef(lockPage); lockRef.current = lockPage;
  const optRef = useRef(opts); optRef.current = opts;
  const R = useRef({
    total, width, height, cur: { vis: 0, off: 0 } as ZF, vcur: VZ0 as VZ, dirty: false, vdirty: false, cdirty: false, crossXY: null as Cross | null,
    flush: 0 as any, raf: 0 as any, eraf: 0 as any, ey: null as null | { hi: number; lo: number; t: number },
    base: { vis: 0, off: 0 } as ZF, vbase: VZ0 as VZ, d0: 0, f0: 0.5, vd0: 0, vfrac: 0.5, vmode: false, pinched: false, pan: false, axis: false, axMoved: false, lastAx: 0,
    left: 0, top: 0, crossOn: false, crossMode: false, timer: null as any, sx: 0, sy: 0, tapT: 0, moved: false, hadCross: false, samples: [] as { t: number; off: number }[], prevTotal: total,
  });
  const r = R.current;
  r.total = total; r.width = width; r.height = height; r.crossMode = crossMode;

  const dflt = (tot: number): ZF => {
    const o = optRef.current, vis = o.initial && o.initial > 0 ? Math.min(tot, o.initial) : tot;
    return { vis, off: vis < tot ? -vis * (o.shift ?? 0.08) : 0 };
  };
  const resolve = (s: ZF, tot: number): ZF => (!(s.vis > 0) ? clampZ(dflt(tot), tot) : freeZ({ vis: s.vis, off: isFinite(s.off) ? s.off : 0 }, tot));
  const cur = resolve(st, total);
  if (!r.dirty) r.cur = cur;
  const cv = normV(vz);
  if (!r.vdirty) r.vcur = cv;

  // ---- one render per frame
  const flush = () => {
    r.flush = 0;
    if (r.dirty) { r.dirty = false; setSt(r.cur); }
    if (r.vdirty) { r.vdirty = false; setVzS(r.vcur); }
    if (r.cdirty) { r.cdirty = false; setCrossS(r.crossXY); }
  };
  const kick = () => { if (!r.flush) r.flush = requestAnimationFrame(flush); };
  const put = (n: ZF, free = false) => { r.cur = free ? freeZ(n, r.total) : clampZ(n, r.total); r.dirty = true; kick(); };
  const putNow = (n: ZF, free = false) => { r.cur = free ? freeZ(n, r.total) : clampZ(n, r.total); r.dirty = false; setSt(r.cur); };
  const setVz = (n: VZ) => { r.vcur = normV(n); r.vdirty = true; kick(); };
  const stopMotion = () => { if (r.raf) { cancelAnimationFrame(r.raf); r.raf = 0; } };
  const measure = () => { ref.current?.measure?.((_x, _y, _w, _h, px, py) => { r.left = px; r.top = py; }); };
  const place = (pageX: number, pageY: number) => { r.crossXY = { x: Math.max(0, Math.min(r.width, pageX - r.left)), y: Math.max(0, pageY - r.top) }; r.cdirty = true; kick(); };
  const clearCross = () => { r.crossOn = false; r.crossXY = null; r.cdirty = false; setCrossS(null); };
  useEffect(() => () => { stopMotion(); cancelAnimationFrame(r.flush); cancelAnimationFrame(r.eraf); clearTimeout(r.timer); lockRef.current(false); }, []);

  // Website: the mouse wheel zooms around the pointer and moving the mouse over the chart shows the crosshair
  // (the phone uses pinch / touch and hold). Same chart maths as the phone, so the zoom stays smooth.
  const webOff = useRef<null | (() => void)>(null), webEl = useRef<any>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el: any = ref.current;
    if (!el || !el.addEventListener || el === webEl.current) return;
    webOff.current?.(); webEl.current = el;
    const wheel = (e: WheelEvent) => {
      e.preventDefault(); stopMotion();
      const rc = el.getBoundingClientRect(), a = Math.min(1, Math.max(0, (e.clientX - rc.left) / Math.max(1, Math.min(rc.width, r.width))));
      put(pinchF(r.cur, r.total, e.deltaY < 0 ? 0.85 : 1 / 0.85, a, a));
    };
    const move = (e: MouseEvent) => {
      if (e.buttons) return;
      const rc = el.getBoundingClientRect();
      r.crossXY = { x: Math.max(0, Math.min(r.width, e.clientX - rc.left)), y: Math.max(0, e.clientY - rc.top) }; r.cdirty = true; kick();
    };
    const leave = () => { if (!r.crossOn) { r.crossXY = null; r.cdirty = false; setCrossS(null); } };
    el.addEventListener('wheel', wheel, { passive: false }); el.addEventListener('mousemove', move); el.addEventListener('mouseleave', leave);
    webOff.current = () => { el.removeEventListener('wheel', wheel); el.removeEventListener('mousemove', move); el.removeEventListener('mouseleave', leave); };
  });
  useEffect(() => () => { webOff.current?.(); }, []);

  // new candle arrives: when you look at older candles the view stays on the same candles; a different history (new market / timeframe) is clamped
  useEffect(() => {
    const p = r.prevTotal; r.prevTotal = total;
    setSt((s) => (!(s.vis > 0) ? s : clampZ({ vis: s.vis, off: total > p && total - p <= 3 && s.off > 0.5 ? s.off + (total - p) : s.off }, total)));
  }, [total]);

  // ---- animation: ease-out tween of the zoom state
  const animateTo = (to: ZF, ms = 280) => {
    stopMotion();
    const from = { ...r.cur }, target = clampZ(to, r.total), t0 = nowMs();
    const tick = () => {
      const p = Math.min(1, (nowMs() - t0) / ms);
      putNow(lerpZ(from, target, easeOutCubic(p)));
      r.raf = p < 1 ? requestAnimationFrame(tick) : 0;
    };
    r.raf = requestAnimationFrame(tick);
  };
  // ---- inertia + bounce
  const glide = (v0: number) => {
    stopMotion();
    let m = { off: r.cur.off, v: v0 }, last = nowMs();
    const tick = () => {
      const t = nowMs(), rg = offRange(r.cur.vis, r.total), s = stepMotion(m, t - last, rg.lo, rg.hi);
      last = t; m = s.m;
      putNow({ vis: r.cur.vis, off: m.off }, true);
      if (s.done) { r.raf = 0; putNow(clampZ(r.cur, r.total)); } else r.raf = requestAnimationFrame(tick);
    };
    r.raf = requestAnimationFrame(tick);
  };

  const canPan = () => !isFit(r.vcur);
  const pr = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (e, g) => r.crossOn || e.nativeEvent.touches.length >= 2 || (r.axis && Math.abs(g.dy) > 6) || (canPan() && (Math.abs(g.dx) > 8 || Math.abs(g.dy) > 8)) || (Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5),
    onMoveShouldSetPanResponderCapture: (e, g) => r.crossOn || e.nativeEvent.touches.length >= 2 || (r.axis && Math.abs(g.dy) > 6) || (canPan() && (Math.abs(g.dx) > 10 || Math.abs(g.dy) > 10)) || (Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 2),
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { stopMotion(); r.base = { ...r.cur }; r.vbase = { ...r.vcur }; r.d0 = 0; r.vd0 = 0; r.vmode = false; r.pan = false; r.pinched = false; r.samples = []; },
    onPanResponderMove: (e, g) => {
      const t = e.nativeEvent.touches;
      if (r.crossOn && t.length < 2) return; // the crosshair follows through onTouchMove
      if (r.axis && t.length === 1) { r.axMoved = true; setVz(zoomV(r.vbase, Math.exp(g.dy / 140), 0.5)); return; } // price axis: drag down stretches the scale
      if (t.length >= 2) {
        if (r.crossOn) clearCross();
        r.pinched = true;
        const dxx = Math.abs(t[0].pageX - t[1].pageX), dyy = Math.abs(t[0].pageY - t[1].pageY), d = Math.hypot(dxx, dyy);
        const fx = ((t[0].pageX + t[1].pageX) / 2 - r.left) / Math.max(1, r.width), fy = ((t[0].pageY + t[1].pageY) / 2 - r.top) / Math.max(1, r.height);
        if (!r.d0) { // first frame of this pinch: remember where it started
          r.d0 = d; r.base = { ...r.cur }; r.vbase = { ...r.vcur }; r.f0 = fx;
          r.vmode = dyy > dxx * 1.3; r.vd0 = Math.max(dyy, 10); r.vfrac = Math.max(0, Math.min(1, fy));
          return;
        }
        if (r.vmode) { setVz(zoomV(r.vbase, Math.max(dyy, 10) / r.vd0, r.vfrac)); return; } // fingers above each other: zoom the PRICE scale
        put(pinchF(r.base, r.total, r.d0 / Math.max(d, 1), r.f0, fx));
        return;
      }
      if (r.pinched) return; // one finger left after a pinch: wait until all fingers lift
      r.pan = true;
      const vis = r.base.vis, step = r.width / Math.max(vis, 1e-9), rg = offRange(vis, r.total);
      const off = rubber(r.base.off + g.dx / Math.max(step, 1e-9), rg.lo, rg.hi, vis * 0.35);
      const tt = nowMs(); r.samples.push({ t: tt, off }); if (r.samples.length > 8) r.samples.shift();
      put({ vis, off }, true);
      if (canPan() && !r.axis) setVz(panByPixels(r.vbase, g.dy, r.height)); // manual price scale: the chart also moves up and down
    },
    onPanResponderRelease: () => {
      if (r.crossOn || !r.pan || r.pinched) return;
      glide(velocityOf(r.samples, nowMs(), 100)); // also springs back when you let go past the end
    },
  })).current;

  const handlers: any = {
    ...pr.panHandlers,
    ref,
    onLayout: () => measure(),
    onTouchStart: (e: any) => {
      const t = e.nativeEvent.touches;
      lockRef.current(true); // the page must not scroll while a finger is on the chart
      clearTimeout(r.timer); measure();
      r.hadCross = r.crossOn; // the tap that dismisses the crosshair must not also open the wheel
      if (r.crossOn && !r.crossMode) clearCross();
      r.axis = t.length === 1 && t[0].pageX - r.left > r.width + 2; // the touch began on the price axis strip
      r.axMoved = false; r.moved = t.length > 1;
      if (t.length !== 1 || r.axis) return;
      r.sx = t[0].pageX; r.sy = t[0].pageY; r.tapT = nowMs();
      if (r.crossMode) { r.crossOn = true; place(r.sx, r.sy); return; } // crosshair mode: the finger IS the crosshair
      r.timer = setTimeout(() => { r.crossOn = true; place(r.sx, r.sy); }, 400);
    },
    onTouchMove: (e: any) => {
      const t = e.nativeEvent.touches;
      if (r.crossOn && t.length === 1) { place(t[0].pageX, t[0].pageY); return; }
      if (t.length >= 2 || Math.abs(t[0].pageX - r.sx) > 8 || Math.abs(t[0].pageY - r.sy) > 8) { clearTimeout(r.timer); r.moved = true; }
    },
    onTouchEnd: (e: any) => {
      clearTimeout(r.timer);
      const n = e.nativeEvent.touches?.length ?? 0, t = nowMs();
      if (n < 2) r.d0 = 0;
      if (n) return;
      if (r.axis && !r.axMoved) { if (t - r.lastAx < 330) { setVz(VZ0); r.lastAx = 0; } else r.lastAx = t; } // double tap on the price axis: fit the price scale
      else if (!r.axis && !r.moved && !r.crossOn && !r.hadCross && t - r.tapT < 260 && optRef.current.onTap) optRef.current.onTap(r.sx - r.left, r.sy - r.top);
      r.axis = false; lockRef.current(false);
    },
    onTouchCancel: () => { clearTimeout(r.timer); lockRef.current(false); },
  };

  // ---- the window to draw
  const w = windowF(cur, total, width, true), mm = minimapF(cur, total);
  const lat = (c: ZF) => (c.off <= 0.5 ? 1 : 0.5);
  const sh = optRef.current.shift;
  // price auto-fit eases toward the new range instead of jumping when candles enter or leave the screen
  const fitY = (hi: number, lo: number) => {
    const tg = applyV(lo, hi, cv), t = nowMs(), e = r.ey, rng = tg.hi - tg.lo || 1;
    const snap = !e || !isFinite(e.hi) || !isFinite(e.lo) || !isFit(cv) || Math.abs(tg.hi - e.hi) > 2 * rng || Math.abs(tg.lo - e.lo) > 2 * rng;
    if (snap) { r.ey = { hi: tg.hi, lo: tg.lo, t }; return { hi: tg.hi, lo: tg.lo }; }
    const dt = Math.min(64, t - e.t), a = dt <= 0 ? 0 : 1 - Math.exp(-dt / 70);
    const hi2 = e.hi + (tg.hi - e.hi) * a, lo2 = e.lo + (tg.lo - e.lo) * a;
    const done = Math.abs(tg.hi - hi2) < rng * 0.0015 && Math.abs(tg.lo - lo2) < rng * 0.0015;
    r.ey = done ? { hi: tg.hi, lo: tg.lo, t } : { hi: hi2, lo: lo2, t };
    if (!done && !r.eraf) r.eraf = requestAnimationFrame(() => { r.eraf = 0; setEase((n) => n + 1); });
    return { hi: r.ey.hi, lo: r.ey.lo };
  };

  return {
    start: w.start, end: w.end, pad: w.pad, slots: Math.max(1, w.vis), count: Math.round(cur.vis), total, zoomed: cur.vis < total - 0.5 || Math.abs(cur.off) > 0.5, handlers,
    atLatest: cur.off <= 0.5, mm, cross, clearCross,
    step: w.step, shift: w.shift, startF: w.startF,
    idxAt: (x: number) => indexAtF(r.cur, total, x, r.width),
    zoomIn: () => animateTo(zoomAroundF(r.cur, r.total, 0.7, lat(r.cur))),
    zoomOut: () => animateTo(zoomAroundF(r.cur, r.total, 1 / 0.7, lat(r.cur))),
    setCount: (n: number) => animateTo(setVisF(r.cur, r.total, n)),
    latest: () => animateTo({ vis: r.cur.vis, off: r.cur.vis < r.total ? -r.cur.vis * (sh ?? 0.08) : 0 }),
    centerAt: (frac: number) => { stopMotion(); put(centerAtF(r.cur, r.total, frac)); },
    panLeft: () => animateTo(panByF(r.cur, r.total, Math.max(1, r.cur.vis * 0.25))),
    panRight: () => animateTo(panByF(r.cur, r.total, -Math.max(1, r.cur.vis * 0.25))),
    reset: (anim = true) => { stopMotion(); setVz(VZ0); r.ey = null; if (anim) animateTo(dflt(r.total), 320); else { r.dirty = false; setSt({ vis: 0, off: NaN }); } }, // reset(false) = back to the default view at once (new market / timeframe)
    canIn: cur.vis > minVis(total) + 0.5, canOut: cur.vis < total - 0.5,
    crossMode, setCrossMode: (on: boolean) => { setCrossModeS(on); r.crossMode = on; if (!on) clearCross(); },
    // ---- vertical (price) zoom and scroll
    vz: cv, vzoomed: !isFit(cv), plotH: height,
    fitY, // pass the fitted range, get the zoomed / scrolled range (eased)
    vIn: () => setVz(zoomV(r.vcur, 1.5, 0.5)),
    vOut: () => setVz(zoomV(r.vcur, 1 / 1.5, 0.5)),
    vFit: () => setVz(VZ0),
    vTop: (top: number) => setVz(fromThumbTop(r.vcur, top)),
    vCenter: (frac: number) => setVz(fromThumbCenter(r.vcur, frac)),
  };
}

export type Zoom = ReturnType<typeof useZoom>;

// ---------------------------------------------------------------- floating chart buttons (no scroll bars)
// MetaTrader has no scroll bars on the chart: you pinch to zoom, drag to move, drag the price axis to scale the price and double tap the axis to fit it.
// The only thing it adds is a small round arrow that brings you back to the newest candle once you have scrolled away. This is that button
// (plus an optional Volume switch). `top` / `right` place it inside the plot, above the time labels.
export function ChartHud({ z, top, right = 8, vol }: { z: Zoom; top: number; right?: number; vol?: { on: boolean; toggle: () => void } }) {
  const { th } = useApp();
  const away = !(z.atLatest && z.pad < 0.5);
  if (!away && !vol) return null;
  const stop = (e: any) => e.stopPropagation();
  return (
    <View onTouchStart={stop} onTouchEnd={stop} style={{ position: 'absolute', top, right, flexDirection: 'row', alignItems: 'center', gap: 6, direction: 'ltr' }}>
      {!!vol && (
        <Pressable onPress={vol.toggle} hitSlop={6} accessibilityRole="button" accessibilityLabel="Volume" style={{ height: 28, paddingHorizontal: 9, borderRadius: 14, borderWidth: 1, borderColor: vol.on ? th.accent : th.line, backgroundColor: vol.on ? th.accent : th.solid + 'E6', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: vol.on ? th.onAccent : th.dim, fontSize: 11, fontWeight: '900' }}>Vol</Text>
        </Pressable>
      )}
      {away && (
        <Pressable onPress={z.latest} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go to the latest candle" style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: th.accent, backgroundColor: th.solid + 'F0', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4 }}>
          <Icon name="play-forward" size={16} color={th.accent} />
        </Pressable>
      )}
    </View>
  );
}

// ---------------------------------------------------------------- vertical scroll bar
export const VBAR = 26; // width of the column the bar needs on the right of a chart

// Vertical scroll bar for the price scale. Thumb = the part of the price range you see: drag it to move up and down,
// tap the track to jump, + / - zoom the price scale, double tap the track to fit the candles again.
export function VScroll({ z, height }: { z: Zoom; height: number }) {
  const { th } = useApp();
  const lock = useScrollLock();
  const BTN = 22, trackH = Math.max(40, height - 2 * BTN - 6);
  const zr = useRef(z), tr = useRef({ y0: 0, top0: 0, last: 0, moved: false, h: trackH });
  zr.current = z; tr.current.h = trackH;
  const pr = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true, onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => {
      lock(true);
      const T = tr.current, th0 = thumb(zr.current.vz), y = e.nativeEvent.locationY / Math.max(1, T.h);
      T.moved = false; T.y0 = y; T.top0 = th0.top;
      const hit = y >= th0.top && y <= th0.top + th0.size;
      if (!hit) { zr.current.vCenter(y); T.top0 = thumb(zr.current.vz).top; }
    },
    onPanResponderMove: (_e, g) => { const T = tr.current; if (Math.abs(g.dy) > 3) T.moved = true; zr.current.vTop(T.top0 + g.dy / Math.max(1, T.h)); },
    onPanResponderRelease: () => {
      lock(false);
      const T = tr.current, now = Date.now();
      if (!T.moved) { if (now - T.last < 320) zr.current.vFit(); T.last = now; }
    },
    onPanResponderTerminate: () => lock(false),
  })).current;
  const t = thumb(z.vz);
  const Btn = ({ icon, on, off }: { icon: string; on: () => void; off?: boolean }) => (
    <Pressable onPress={on} disabled={off} hitSlop={4} style={({ pressed }) => ({ width: BTN, height: BTN, borderRadius: 6, borderWidth: 1, borderColor: th.line, backgroundColor: th.bg, alignItems: 'center', justifyContent: 'center', opacity: off ? 0.35 : pressed ? 0.7 : 1 })}>
      <Icon name={icon} size={14} color={th.text} />
    </Pressable>
  );
  return (
    <View style={{ width: VBAR, height, alignItems: 'center', justifyContent: 'center', gap: 3, direction: 'ltr' }}>
      <Btn icon="add" on={z.vIn} />
      <View {...pr.panHandlers} style={{ width: VBAR - 4, height: trackH, alignItems: 'center' }}>
        <View pointerEvents="none" style={{ width: 8, height: trackH, borderRadius: 4, backgroundColor: th.line.slice(0, 7) + 'AA', overflow: 'hidden' }}>
          <View style={{ position: 'absolute', left: 0, right: 0, top: `${t.top * 100}%`, height: `${t.size * 100}%`, borderRadius: 4, backgroundColor: z.vzoomed ? th.accent : th.dim + '88' }} />
        </View>
      </View>
      <Btn icon="remove" on={z.vOut} />
    </View>
  );
}

// ---------------------------------------------------------------- toolbar under the chart
export function ZoomBar({ z, vol }: { z: Zoom; vol?: { on: boolean; toggle: () => void } }) {
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
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 6, rowGap: 6 }}>
        <B icon="remove" on={z.zoomOut} off={!z.canOut} />
        <B icon="add" on={z.zoomIn} off={!z.canIn} />
        <B icon="locate" on={() => z.setCrossMode(!z.crossMode)} hot={z.crossMode} />
        {presets.map((n) => <Chip key={n} label={String(n)} on={z.count === n} press={() => z.setCount(n)} />)}
        <Chip label="All" on={z.count >= z.total} press={() => z.setCount(z.total)} />
        {z.vzoomed && <Chip label="Fit price" on={false} press={z.vFit} />}
        {!!vol && <Chip label="Vol" on={vol.on} press={vol.toggle} />}
        <Pressable onPress={z.latest} hitSlop={4} style={{ marginLeft: 'auto', height: 30, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: z.atLatest && z.pad < 0.5 ? th.line : th.accent, backgroundColor: z.atLatest && z.pad < 0.5 ? th.bg : th.accent }}>
          <Icon name="play-forward" size={13} color={z.atLatest && z.pad < 0.5 ? th.dim : th.onAccent} />
          <Text style={{ color: z.atLatest && z.pad < 0.5 ? th.dim : th.onAccent, fontSize: 11.5, fontWeight: '900' }}>Latest</Text>
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
export function Readout({ c, prev, dec, vol, onAlert, onClose }: { c: { o: number; h: number; l: number; c: number }; prev?: number; dec: number; vol?: number; onAlert?: () => void; onClose: () => void }) {
  const { th } = useApp();
  const up = c.c >= c.o, col = up ? th.buy : th.sell, base = prev ?? c.o, pct = base ? ((c.c - base) / base) * 100 : 0;
  const cell = (k: string, v: number) => <Text key={k} style={{ color: th.dim, fontSize: 10.5, fontWeight: '700' }}>{k} <Text style={{ color: col, fontWeight: '900' }}>{v.toFixed(dec)}</Text></Text>;
  return (
    <View onTouchStart={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 4, left: 4, right: 4, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: th.solid + 'F2', borderColor: th.line, borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8 }}>
      <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 1 }}>
        {cell('O', c.o)}{cell('H', c.h)}{cell('L', c.l)}{cell('C', c.c)}
        {vol !== undefined && vol > 0 && <Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '700' }}>V <Text style={{ color: col, fontWeight: '900' }}>{fmtVol(vol)}</Text></Text>}
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
