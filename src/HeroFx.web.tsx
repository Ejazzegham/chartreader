import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';

// Animated background for every hero section (HeroBanner, the call-to-action band, the sign-in panel).
// Deep navy base, a vivid blue / violet / pink / cyan aurora, flowing wave lines and a faint candle stream, with a dark scrim on the text side.
// All hero canvases share ONE animation loop and only the ones actually on screen are drawn (every page stays mounted, so hidden pages cost nothing).
type Item = { cv: HTMLCanvasElement; cx: CanvasRenderingContext2D; W: number; H: number; D: number; seed: number; c: number[] };
const items = new Set<Item>();
let raf = 0, sy = 0, target = 0, listening = false;
const last = new WeakMap<object, number>();
const still = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const fit = (it: Item) => {
  const r = it.cv.getBoundingClientRect(), D = Math.min(window.devicePixelRatio || 1, 1.5);
  if (!r.width || !r.height) return;
  it.W = r.width; it.H = r.height; it.D = D;
  it.cv.width = Math.round(r.width * D); it.cv.height = Math.round(r.height * D);
  it.cx.setTransform(D, 0, 0, D, 0, 0);
};
const onScroll = (e: Event) => {
  const el: any = e.target, y = el === document ? window.scrollY : (el?.scrollTop ?? 0), o = last.get(el) ?? y;
  last.set(el, y); if (!still()) target += y - o;
};
function draw(it: Item, t: number) {
  const { cx, W, H } = it;
  const g = cx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#0A1030'); g.addColorStop(0.55, '#141245'); g.addColorStop(1, '#1B1050');
  cx.fillStyle = g; cx.fillRect(0, 0, W, H);
  [[59, 130, 246], [168, 85, 247], [236, 72, 153], [34, 211, 238]].forEach((c, i) => {
    const x = W * (0.5 + 0.45 * Math.sin(t * 0.00025 * (i + 1) + i * 1.7 + sy * 0.0008));
    const y = H * (0.5 + 0.4 * Math.cos(t * 0.0003 * (i + 1) + i * 2.1));
    const r = Math.max(W * 0.55, H * 1.2), rg = cx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `rgba(${c},0.62)`); rg.addColorStop(1, `rgba(${c},0)`);
    cx.fillStyle = rg; cx.fillRect(0, 0, W, H);
  });
  for (let i = 0; i < 5; i++) { // flowing wave lines
    cx.beginPath();
    const base = H * (0.25 + i * 0.14), amp = 14 + i * 6, f = 0.006 + i * 0.001;
    for (let x = 0; x <= W; x += 10) { const y = base + Math.sin(x * f + t * 0.0007 * (1 + i * 0.2) + sy * 0.004) * amp + Math.sin(x * f * 2.2 - t * 0.0005 + i) * amp * 0.4; x ? cx.lineTo(x, y) : cx.moveTo(x, y); }
    cx.strokeStyle = `rgba(${i % 2 ? '244,114,182' : '147,197,253'},${0.26 + i * 0.04})`; cx.lineWidth = 1.5; cx.stroke();
  }
  const sp = 16, off = t * 0.018 + sy * 0.4, n = Math.ceil(W / sp) + 2, s0 = Math.floor(off / sp); // faint candle stream along the bottom
  for (let i = 0; i < n; i++) {
    const k = (s0 + i) % it.c.length, o = it.c[k], c = it.c[(k + 1) % it.c.length], x = i * sp - (off % sp), m = H * 0.82, up = c >= o;
    cx.fillStyle = cx.strokeStyle = up ? 'rgba(52,211,153,0.28)' : 'rgba(251,113,133,0.28)';
    cx.beginPath(); cx.moveTo(x + 4, m + Math.min(o, c) * 0.5 - 6); cx.lineTo(x + 4, m + Math.max(o, c) * 0.5 + 6); cx.stroke();
    cx.fillRect(x, m + Math.min(o, c) * 0.5, 8, Math.max(2, Math.abs(c - o) * 0.5));
  }
  const sc = cx.createLinearGradient(0, 0, W, 0); // keep the text side calm and readable
  sc.addColorStop(0, 'rgba(6,10,30,0.6)'); sc.addColorStop(0.65, 'rgba(6,10,30,0.15)'); sc.addColorStop(1, 'rgba(6,10,30,0)');
  cx.fillStyle = sc; cx.fillRect(0, 0, W, H);
}
const loop = (t: number) => {
  sy += (target - sy) * 0.12;
  if (!document.hidden) items.forEach((it) => {
    if (!it.W) fit(it);
    if (!it.W || it.cv.offsetParent === null) return; // hidden page
    const r = it.cv.getBoundingClientRect(); if (r.bottom < 0 || r.top > window.innerHeight) return; // off screen
    draw(it, t);
  });
  raf = requestAnimationFrame(loop);
};

export default function HeroFx() {
  const ref = useRef<any>(null);
  useEffect(() => {
    const cv = ref.current as HTMLCanvasElement | null, cx = cv?.getContext('2d');
    if (!cv || !cx) return;
    let v = 0;
    const it: Item = { cv, cx, W: 0, H: 0, D: 1, seed: Math.random(), c: Array.from({ length: 300 }, () => (v += (Math.random() - 0.5) * 30)) };
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { fit(it); if (still()) draw(it, 0); }) : null;
    ro?.observe(cv); fit(it); items.add(it);
    if (!listening) { window.addEventListener('scroll', onScroll, true); listening = true; }
    if (still()) draw(it, 0); else if (!raf) raf = requestAnimationFrame(loop);
    return () => { ro?.disconnect(); items.delete(it); if (!items.size) { cancelAnimationFrame(raf); raf = 0; window.removeEventListener('scroll', onScroll, true); listening = false; } };
  }, []);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
      {React.createElement('canvas', { ref, style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'block' } })}
    </View>
  );
}
