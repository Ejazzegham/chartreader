import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { drawHero, heroKind, heroState, HeroKind } from './heroScenes';

// Animated background for every hero section (HeroBanner, the call-to-action band, the sign-in panel).
// Every page has its OWN scene and palette (src/heroScenes.ts): pass the page's kind, e.g. <HeroFx kind="killzones" />. No kind = the brand aurora.
// All hero canvases share ONE animation loop and only the ones actually on screen are drawn (every page stays mounted, so hidden pages cost nothing).
type Item = { cv: HTMLCanvasElement; cx: CanvasRenderingContext2D; W: number; H: number; D: number; kind: HeroKind; st: any };
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
const draw = (it: Item, t: number) => drawHero(it.cx, it.W, it.H, t, sy, it.kind, it.st);
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

export default function HeroFx({ kind }: { kind?: string }) {
  const ref = useRef<any>(null);
  useEffect(() => {
    const cv = ref.current as HTMLCanvasElement | null, cx = cv?.getContext('2d');
    if (!cv || !cx) return;
    const k = heroKind(kind);
    const it: Item = { cv, cx, W: 0, H: 0, D: 1, kind: k, st: heroState(k) };
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { fit(it); if (still()) draw(it, 0); }) : null;
    ro?.observe(cv); fit(it); items.add(it);
    if (!listening) { window.addEventListener('scroll', onScroll, true); listening = true; }
    if (still()) draw(it, 0); else if (!raf) raf = requestAnimationFrame(loop);
    return () => { ro?.disconnect(); items.delete(it); if (!items.size) { cancelAnimationFrame(raf); raf = 0; window.removeEventListener('scroll', onScroll, true); listening = false; } };
  }, [kind]);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
      {React.createElement('canvas', { ref, style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'block' } })}
    </View>
  );
}
