import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { LogoMark } from './Brand';
import { useRealWindow } from './win';
import { mapDots, MAP_COLS, MAP_ROWS } from './splashMap';

// The website's start screen, built from "Chart Reader Animated Splash Screen.gif":
//  1. a dotted world map fades in over deep navy, a bright horizon glow breathes at the bottom
//  2. a light streak sweeps across the sky
//  3. the logo tile pops in with a glow while a ring of light swirls under it
//  4. candlesticks rise on both sides and two glowing waves draw in
//  5. "Chart Reader", the gold tagline and a progress bar (with a flare at its tip) fill in; the disclaimer fades in last
// Pure DOM + CSS (the map is one small canvas drawn from src/splashMap.ts), so nothing has to download while the app starts.
// The artwork is laid out on a 507 x 335 stage (the GIF's own size) that is scaled to the window, so the proportions are exactly the GIF's.

const SW = 507, SH = 335;
const FILL_FROM = 2.1; // seconds: when the progress bar starts to fill

const RIGHT = Array.from({ length: 11 }, (_, i) => ({ x: 366 + i * 12.4, b: 258 - i * 11.5, h: 13 + (i % 3) * 5 + i * 1.7, w: 5.5, wk: 8 + (i % 4) * 2 }));
const LEFT = Array.from({ length: 6 }, (_, i) => ({ x: 2 + i * 10.5, b: 214 - i * 7 + (i % 2) * 5, h: 12 + (i % 3) * 5, w: 5, wk: 8 }));

const CSS = `
.sp{position:absolute;inset:0;overflow:hidden;background:#02061A;color:#fff;direction:ltr;font-family:Inter,system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
.sp *{box-sizing:border-box}
.sp-bg{position:absolute;inset:0;background:radial-gradient(ellipse 75% 60% at 50% 86%,#0B2460 0%,#071641 32%,#040C2A 58%,#02061A 85%)}
.sp-map{position:absolute;left:50%;top:43%;width:min(88vw,185vh);transform:translate(-50%,-50%);opacity:0;animation:sp-map 1.3s .1s ease-out forwards,sp-mapb 7s 1.4s ease-in-out infinite;-webkit-mask-image:radial-gradient(ellipse 62% 60% at 50% 52%,#000 45%,transparent 100%);mask-image:radial-gradient(ellipse 62% 60% at 50% 52%,#000 45%,transparent 100%)}
.sp-map canvas{display:block;width:100%;height:auto}
@keyframes sp-map{to{opacity:1}}
@keyframes sp-mapb{50%{opacity:.72}}
.sp-rays{position:absolute;left:${SW / 2 - 190}px;width:380px;top:182px;height:84px;opacity:0;background:repeating-conic-gradient(from -75deg at 50% 100%,rgba(90,160,255,.16) 0 .5deg,transparent .5deg 2.6deg);-webkit-mask-image:radial-gradient(ellipse 50% 100% at 50% 100%,#000,transparent 80%);mask-image:radial-gradient(ellipse 50% 100% at 50% 100%,#000,transparent 80%);animation:sp-fade 1.4s .3s forwards}
.sp-hz{position:absolute;left:${SW / 2 - 110}px;width:220px;top:261px;height:2px;opacity:0;background:linear-gradient(90deg,transparent,#4C9BFF 25%,#CFE8FF 50%,#4C9BFF 75%,transparent);box-shadow:0 0 22px 4px rgba(60,140,255,.7),0 0 70px 14px rgba(40,110,255,.35);animation:sp-fade .9s .15s forwards,sp-breathe 4.5s 1.2s ease-in-out infinite}
.sp-halo{position:absolute;left:${SW / 2 - 260}px;width:520px;top:224px;height:100px;opacity:0;background:radial-gradient(ellipse at 50% 55%,rgba(50,130,255,.45),rgba(30,90,230,.12) 45%,transparent 70%);animation:sp-fade 1.4s .2s forwards,sp-breathe 4.5s 1.2s ease-in-out infinite}
@keyframes sp-fade{to{opacity:1}}
@keyframes sp-breathe{50%{opacity:.6}}
.sp-stage{position:absolute;left:50%;top:50%;width:${SW}px;height:${SH}px;margin:${-SH / 2}px 0 0 ${-SW / 2}px;transform-origin:50% 50%}
.sp-svg{position:absolute;left:0;top:0;overflow:visible}
.sp-comet,.sp-tail{fill:none;stroke-linecap:round;stroke-dasharray:.3 3;stroke-dashoffset:.3;opacity:0}
.sp-comet{stroke:#CFE9FF;stroke-width:2.4;filter:drop-shadow(0 0 5px #4C9BFF) drop-shadow(0 0 12px #2F7BFF);animation:sp-sweep 1.1s .2s cubic-bezier(.45,.05,.3,1) forwards}
.sp-tail{stroke:#5CA8FF;stroke-width:1.2;stroke-dasharray:.8 3;stroke-dashoffset:.8;filter:drop-shadow(0 0 4px #2F7BFF);animation:sp-sweept 1.1s .2s cubic-bezier(.45,.05,.3,1) forwards}
.sp-tail.w{stroke:#3C8CFF;stroke-width:6;filter:blur(5px)}
@keyframes sp-sweep{0%{opacity:1;stroke-dashoffset:.3}85%{opacity:1}100%{opacity:0;stroke-dashoffset:-1}}
@keyframes sp-sweept{0%{opacity:.8;stroke-dashoffset:.8}85%{opacity:.7}100%{opacity:0;stroke-dashoffset:-1}}
.sp-ring{fill:none;stroke-linecap:round;stroke-dasharray:1 1;stroke-dashoffset:1;opacity:0;filter:drop-shadow(0 0 4px #5CB0FF) drop-shadow(0 0 10px #2F7BFF)}
.sp-ring.a{stroke:#DDF0FF;stroke-width:2.2;animation:sp-ring 1.9s 1.3s cubic-bezier(.3,.6,.3,1) forwards}
.sp-ring.b{stroke:#4C9BFF;stroke-width:1;animation:sp-ring 1.9s 1.42s cubic-bezier(.3,.6,.3,1) forwards}
@keyframes sp-ring{0%{opacity:0;stroke-dashoffset:1}20%{opacity:1}60%{stroke-dashoffset:0;opacity:1}100%{stroke-dashoffset:0;opacity:0}}
.sp-wave{fill:none;stroke-linecap:round;stroke-width:1.3;stroke-dasharray:1 1;stroke-dashoffset:1;filter:drop-shadow(0 0 3px #3C8CFF);animation:sp-draw 1.3s 1.75s cubic-bezier(.3,.6,.3,1) forwards}
.sp-wave.s2{stroke-width:.8;opacity:.6;animation-delay:1.9s}
@keyframes sp-draw{to{stroke-dashoffset:0}}
.sp-logo{position:absolute;left:${SW / 2 - 49}px;top:76px;width:98px;height:98px;opacity:0;border-radius:22px;animation:sp-pop .85s 1.15s cubic-bezier(.2,.9,.3,1.2) forwards}
.sp-logo>div{box-shadow:0 0 22px 3px rgba(120,185,255,.8),0 0 60px 12px rgba(50,130,255,.55),0 0 120px 30px rgba(30,100,255,.3);animation:sp-glow 3.6s 2.1s ease-in-out infinite}
@keyframes sp-pop{0%{opacity:0;transform:scale(.55)}65%{opacity:1;transform:scale(1.07)}100%{opacity:1;transform:scale(1)}}
@keyframes sp-glow{50%{box-shadow:0 0 16px 2px rgba(120,185,255,.6),0 0 46px 8px rgba(50,130,255,.4),0 0 100px 22px rgba(30,100,255,.22)}}
.sp-c{position:absolute;opacity:0;transform-origin:50% 100%;animation:sp-grow .55s cubic-bezier(.2,.8,.3,1) forwards;animation-delay:var(--e)}
.sp-c i{position:absolute;left:50%;width:1px;margin-left:-.5px;background:#6FB3FF;top:calc(var(--wk)*-1px);bottom:calc(var(--wk)*-1px);opacity:.9}
.sp-c b{position:absolute;inset:0;border-radius:1.2px;background:linear-gradient(#58B6FF,#1E5CFF);box-shadow:0 0 8px rgba(60,140,255,.85),0 0 18px rgba(40,110,255,.4)}
@keyframes sp-grow{from{opacity:0;transform:scaleY(.1)}to{opacity:1;transform:scaleY(1)}}
.sp-t{position:absolute;left:0;width:${SW}px;text-align:center;opacity:0;animation:sp-up .7s both;animation-delay:var(--e)}
.sp-title{top:188px;font-size:29px;font-weight:700;letter-spacing:-.015em;line-height:1.1;color:#F4F8FF;text-shadow:0 2px 18px rgba(40,100,255,.45)}
.sp-tag{top:228px;font-size:9.5px;font-weight:700;letter-spacing:.3em;color:#F5B83D;padding-left:.3em}
@keyframes sp-up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.sp-bar{position:absolute;left:${SW / 2 - 113}px;top:273px;width:226px;height:5px;border-radius:3px;background:rgba(60,110,230,.22);border:1px solid rgba(110,160,255,.28);opacity:0;animation:sp-fade .5s 2s forwards}
.sp-fill{position:absolute;left:0;top:-1px;bottom:-1px;width:0;border-radius:3px;background:linear-gradient(90deg,#1F5CFF,#4EB4FF 70%,#BDE6FF);box-shadow:0 0 10px rgba(70,160,255,.9);animation:sp-w var(--fd) ${FILL_FROM}s cubic-bezier(.35,.15,.25,1) forwards}
@keyframes sp-w{to{width:calc(100% + 2px)}}
.sp-fl{position:absolute;right:-1px;top:50%;width:0;height:0;opacity:0;animation:sp-fade .6s calc(${FILL_FROM}s + var(--fd)*.45) forwards}
.sp-fl::before{content:'';position:absolute;left:-16px;top:-16px;width:32px;height:32px;border-radius:50%;background:radial-gradient(circle,#fff 0,rgba(150,210,255,.95) 14%,rgba(60,140,255,.45) 40%,transparent 70%)}
.sp-fl::after{content:'';position:absolute;left:-60px;top:-1px;width:120px;height:2px;background:linear-gradient(90deg,transparent,#CFE9FF,transparent);box-shadow:0 0 10px 1px rgba(100,180,255,.8)}
.sp-foot{position:absolute;left:0;right:0;bottom:22px;text-align:center;font-size:11.5px;color:#8E9BB8;opacity:0;animation:sp-fade .8s 2.5s forwards}
@media (prefers-reduced-motion:reduce){.sp *,.sp *::before,.sp *::after{animation-duration:.01ms!important;animation-delay:0s!important;animation-iteration-count:1!important}}
`;

const inject = () => {
  if (typeof document === 'undefined' || document.getElementById('sp-css')) return;
  const s = document.createElement('style'); s.id = 'sp-css'; s.textContent = CSS; document.head.appendChild(s);
};
inject();

// The dotted map: drawn once on a canvas, brighter and dimmer dots in a stable pattern so it has the GIF's fine, textured look.
function MapCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current, cx = cv?.getContext('2d'); if (!cv || !cx) return;
    const draw = () => {
      const w = cv.getBoundingClientRect().width || 1200, D = Math.min(window.devicePixelRatio || 1, 2), pitch = w / MAP_COLS;
      cv.width = Math.round(w * D); cv.height = Math.round(pitch * MAP_ROWS * D); cx.setTransform(D, 0, 0, D, 0, 0); cx.clearRect(0, 0, w, pitch * MAP_ROWS);
      for (const [c, r] of mapDots()) {
        const n = ((c * 73856093) ^ (r * 19349663)) >>> 0, v = (n % 100) / 100;
        cx.fillStyle = `rgba(${50 + Math.round(v * 40)},${120 + Math.round(v * 60)},255,${0.5 + v * 0.5})`;
        cx.beginPath(); cx.arc((c + 0.5) * pitch, (r + 0.5) * pitch, Math.max(0.7, pitch * 0.2), 0, 6.2832); cx.fill();
      }
    };
    draw();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(draw) : null; ro?.observe(cv);
    return () => ro?.disconnect();
  }, []);
  return <div className="sp-map" aria-hidden="true"><canvas ref={ref} /></div>;
}

export default function GifSplash({ done, onGone, duration }: { done: boolean; onGone: () => void; duration: number }) {
  const out = useRef(new Animated.Value(1)).current;
  const { width, height } = useRealWindow();
  const s = Math.max(0.9, Math.min(2, Math.min(width / SW, height / SH)));
  const fd = Math.max(0.8, duration / 1000 - FILL_FROM - 0.1);

  useEffect(() => { inject(); }, []);
  useEffect(() => {
    if (!done) return;
    Animated.timing(out, { toValue: 0, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => onGone());
  }, [done]);

  return (
    <Animated.View pointerEvents={done ? 'none' : 'auto'} onLayout={() => SplashScreen.hideAsync().catch(() => {})}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, opacity: out, direction: 'ltr' }}>
      <div className="sp" role="img" aria-label="Chart Reader is loading">
        <div className="sp-bg" />
        <MapCanvas />
        <div className="sp-stage" style={{ transform: `scale(${s})`, ['--fd' as any]: `${fd}s` }}>
          <div className="sp-halo" /><div className="sp-rays" /><div className="sp-hz" />
          <svg className="sp-svg" width={SW} height={SH} viewBox={`0 0 ${SW} ${SH}`} aria-hidden="true">
            <defs>
              <linearGradient id="spwl" gradientUnits="userSpaceOnUse" x1="-160" y1="0" x2="150" y2="0"><stop offset="0" stopColor="#2F7BFF" stopOpacity="0" /><stop offset=".45" stopColor="#4C9BFF" stopOpacity=".95" /><stop offset="1" stopColor="#8FD0FF" stopOpacity="0" /></linearGradient>
              <linearGradient id="spwr" gradientUnits="userSpaceOnUse" x1="380" y1="0" x2="700" y2="0"><stop offset="0" stopColor="#8FD0FF" stopOpacity="0" /><stop offset=".55" stopColor="#4C9BFF" stopOpacity=".95" /><stop offset="1" stopColor="#2F7BFF" stopOpacity="0" /></linearGradient>
            </defs>
            <path className="sp-tail w" pathLength={1} d="M-340 236C-170 150 130 78 300 92C380 98 440 112 470 122" />
            <path className="sp-tail" pathLength={1} d="M-340 236C-170 150 130 78 300 92C380 98 440 112 470 122" />
            <path className="sp-comet" pathLength={1} d="M-340 236C-170 150 130 78 300 92C380 98 440 112 470 122" />
            <path className="sp-ring a" pathLength={1} d="M150 132C130 182 215 210 300 192C360 179 392 154 384 124" />
            <path className="sp-ring b" pathLength={1} d="M138 140C124 196 222 222 312 202C376 186 410 156 398 118" />
            <path className="sp-wave" pathLength={1} stroke="url(#spwl)" d="M-160 262C-60 256 30 214 138 168" />
            <path className="sp-wave s2" pathLength={1} stroke="url(#spwl)" d="M-160 276C-50 270 40 232 150 190" />
            <path className="sp-wave" pathLength={1} stroke="url(#spwr)" d="M380 268C450 262 500 222 700 150" />
            <path className="sp-wave s2" pathLength={1} stroke="url(#spwr)" d="M380 280C450 276 510 242 700 176" />
          </svg>
          {[...LEFT, ...RIGHT].map((c, i) => (
            <div key={i} className="sp-c" style={{ left: c.x, top: c.b - c.h, width: c.w, height: c.h, ['--e' as any]: `${1.65 + (i < LEFT.length ? i : i - LEFT.length) * 0.07}s`, ['--wk' as any]: c.wk }}><i /><b /></div>
          ))}
          <div className="sp-logo"><LogoMark size={98} radius={22} /></div>
          <div className="sp-t sp-title" style={{ ['--e' as any]: '1.8s' }}>Chart Reader</div>
          <div className="sp-t sp-tag" style={{ ['--e' as any]: '1.97s' }}>ANALYZE · LEARN · TRADE</div>
          <div className="sp-bar"><div className="sp-fill"><div className="sp-fl" /></div></div>
        </div>
        <div className="sp-foot">Educational tool, not financial advice.</div>
      </div>
    </Animated.View>
  );
}
