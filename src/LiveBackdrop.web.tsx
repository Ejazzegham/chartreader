import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { useApp } from './store';

// The website's animated backdrop ("Premium": a slow aurora glow with fine flowing wave lines). It is the OPPOSITE of the content:
// Light theme = deep dark backdrop under light glass content. Dark theme = light backdrop under dark glass content.
// Scrolling any page makes the backdrop run with it. It is paused when the tab is hidden and drawn once (still) for people who ask their device for reduced motion.
export default function LiveBackdrop() {
  const { th } = useApp();
  const ref = useRef<any>(null);
  const cur = useRef({ back: th.back, dark: th.dark });
  cur.current = { back: th.back, dark: th.dark };

  useEffect(() => {
    const cv = ref.current as HTMLCanvasElement | null;
    const cx = cv?.getContext('2d');
    if (!cv || !cx) return;
    const still = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let W = 0, H = 0, raf = 0, sy = 0, target = 0;
    const last = new WeakMap<object, number>();

    const fit = () => {
      const D = Math.min(window.devicePixelRatio || 1, 2), r = cv.getBoundingClientRect();
      W = r.width; H = r.height;
      cv.width = Math.max(1, Math.round(W * D)); cv.height = Math.max(1, Math.round(H * D));
      cx.setTransform(D, 0, 0, D, 0, 0);
      if (still) draw(0);
    };
    const onScroll = (e: Event) => { // scroll events do not bubble, so this listens in the capture phase and works for every page's scroll view
      const el: any = e.target, y = el === document ? window.scrollY : (el?.scrollTop ?? 0), o = last.get(el) ?? y;
      last.set(el, y); if (!still) target += y - o;
    };

    const waves = (t: number, a: string, b: string) => {
      for (let i = 0; i < 6; i++) {
        cx.beginPath();
        const base = H * (0.2 + i * 0.13), amp = 26 + i * 9, f = 0.004 + i * 0.0008;
        for (let x = 0; x <= W; x += 10) {
          const y = base + Math.sin(x * f + t * 0.0006 * (1 + i * 0.2) + sy * 0.003 * (1 + i * 0.15)) * amp + Math.sin(x * f * 2.3 - t * 0.0004 + i) * amp * 0.4;
          x ? cx.lineTo(x, y) : cx.moveTo(x, y);
        }
        cx.strokeStyle = `rgba(${i % 3 === 2 ? b : a},${0.3 + i * 0.05})`; cx.lineWidth = 1.8; cx.stroke();
      }
    };
    const aurora = (t: number, a: string, b: string, dk: boolean) => {
      [a, b, '34,211,238', '168,85,247'].forEach((c, i) => {
        const x = W * (0.5 + 0.4 * Math.sin(t * 0.0002 * (i + 1) + i * 2 + sy * 0.0006));
        const y = ((H * (0.2 + 0.2 * i) + sy * 0.25 * (1 + i * 0.2) + Math.cos(t * 0.00025 * (i + 1)) * 80) % (H * 1.4)) - H * 0.2;
        const r = Math.max(W, H) * 0.5, g = cx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${c},${dk ? 0.8 : 0.62})`); g.addColorStop(1, `rgba(${c},0)`);
        cx.fillStyle = g; cx.fillRect(0, 0, W, H);
      });
    };
    function draw(t: number) {
      const { back, dark } = cur.current, onDark = !dark; // light theme -> dark backdrop
      const a = onDark ? '96,165,250' : '37,99,235', b = onDark ? '244,114,182' : '219,39,119';
      cx!.fillStyle = back; cx!.fillRect(0, 0, W, H);
      aurora(t, a, b, onDark); waves(t, a, b);
    }
    const loop = (t: number) => {
      sy += (target - sy) * 0.12;
      if (!W) fit();
      if (!document.hidden && W) draw(t);
      raf = requestAnimationFrame(loop);
    };

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(cv);
    fit();
    window.addEventListener('resize', fit);
    window.addEventListener('scroll', onScroll, true);
    if (still) draw(0); else raf = requestAnimationFrame(loop);
    return () => { ro?.disconnect(); cancelAnimationFrame(raf); window.removeEventListener('resize', fit); window.removeEventListener('scroll', onScroll, true); };
  }, []);

  useEffect(() => { // the theme changed: repaint at once (the loop picks it up on its own when animating)
    const cv = ref.current as HTMLCanvasElement | null;
    if (cv && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) window.dispatchEvent(new Event('resize'));
  }, [th.back]);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, backgroundColor: th.back }}>
      {React.createElement('canvas', { ref, style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'block' } })}
    </View>
  );
}
