import React, { useEffect, useMemo, useRef, useState } from 'react';

// The website's HOME hero, built from the "B6 · Annotated" design (Horizon): a navy sky with a gold horizon glow, a skyline of pulsing candles
// that a scanning beam lights up one by one, a gold market wave that draws itself with a runner dot, three pop-in annotations
// (Liquidity Sweep, Order Block, Fair Value Gap), a moving perspective grid floor and a ticker strip along the bottom.
// Pure DOM + CSS (no canvas, no images). Every position is computed from the real width, so it is sharp and well-proportioned at any window size.
// Only the home page uses it; every other page keeps the shared HeroBanner (src/ui.tsx).

const GOLD = '#C8A96A';
const NAVY = '#0F1E3D';
const BARS = [30, 44, 38, 58, 50, 70, 60, 80, 66, 88, 76, 96, 82, 100, 86, 98, 78, 92, 70, 84, 62, 74, 54, 66, 46, 58, 40, 50, 34, 44, 30, 38, 26, 32];
const MARQUEE = ['ICT', 'SMC', 'TOP-DOWN', 'SCANNER', 'VSA', 'CANDLESTICK', 'FOREX', 'GOLD', 'CRYPTO', 'SYNTHETIC INDICES'];

// The wave and the annotation points, in the design's 1280-wide units (x) and "pixels above the horizon" (y). They are scaled to the real size below.
const WAVE: [string, number[]][] = [['M', [-20, 28]], ['C', [140, 50, 220, 10, 360, 40]], ['S', [560, 100, 680, 60]], ['S', [900, 10, 1020, 75]], ['S', [1200, 120, 1300, 95]]];
const TAGS: { x: number; up: number; label: string; e: string; min: number }[] = [
  { x: 360, up: 40, label: 'LIQUIDITY SWEEP', e: '1.9s', min: 560 },
  { x: 680, up: 60, label: 'ORDER BLOCK', e: '2.6s', min: 0 },
  { x: 1020, up: 75, label: 'FAIR VALUE GAP', e: '3.4s', min: 760 },
];

const CSS = `
.hh{position:relative;overflow:hidden;background:${NAVY};color:#fff;direction:ltr;text-align:left;font-family:Inter,system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
.hh *{box-sizing:border-box}
.hh-bg{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 80%,#1B2F5E 0%,#0A1530 55%,#060D20 100%)}
.hh-sun{position:absolute;left:10%;width:80%;height:200px;background:radial-gradient(ellipse at 50% 100%,rgba(200,169,106,.5),rgba(200,169,106,0) 65%);animation:hh-breathe 6s ease-in-out infinite}
@keyframes hh-breathe{50%{opacity:.55;transform:scale(1.06)}}
.hh-sk{position:absolute;display:flex;align-items:flex-end;justify-content:space-between;animation:hh-fade 1.4s .3s both}
.hh-sb{display:block;width:12px;height:calc(var(--h)*1px);border-radius:2px 2px 0 0;background:linear-gradient(rgba(52,211,153,.55),rgba(52,211,153,0));border:1px solid rgba(255,255,255,.1);border-bottom:0;animation:hh-lit 8s linear infinite;animation-delay:calc(var(--p)*8s)}
.hh-sb:nth-child(3n){background:linear-gradient(rgba(251,113,133,.55),rgba(251,113,133,0))}
@keyframes hh-lit{0%,100%{opacity:.4;filter:brightness(1)}2%{opacity:1;filter:brightness(1.9)}14%{opacity:.4;filter:brightness(1)}}
.hh-bm{position:absolute;left:0;width:1px;background:linear-gradient(transparent,#E6D3A3);box-shadow:0 0 12px 1px rgba(200,169,106,.7);animation:hh-beam 8s linear infinite}
@keyframes hh-beam{from{transform:translateX(var(--bx0))}to{transform:translateX(var(--bx1))}}
.hh-wv{position:absolute;left:0;top:0;overflow:visible}
.hh-wv path{stroke-dasharray:1;stroke-dashoffset:1;animation:hh-draw 3s .8s ease-out forwards;filter:drop-shadow(0 0 8px rgba(200,169,106,.95))}
@keyframes hh-draw{to{stroke-dashoffset:0}}
.hh-pt{position:absolute;left:0;top:0;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:#fff;box-shadow:0 0 18px 6px rgba(200,169,106,.8);offset-rotate:0deg;animation:hh-run 9s linear infinite}
@keyframes hh-run{from{offset-distance:0%}to{offset-distance:100%}}
.hh-hz{position:absolute;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,${GOLD},transparent);box-shadow:0 0 24px 2px rgba(200,169,106,.6)}
.hh-fw{position:absolute;left:0;right:0;bottom:0;overflow:hidden;perspective:600px;perspective-origin:50% 0;-webkit-mask-image:linear-gradient(transparent,#000 45%);mask-image:linear-gradient(transparent,#000 45%)}
.hh-fg{position:absolute;left:-50%;width:200%;top:0;height:420px;transform-origin:50% 0;transform:rotateX(70deg);background-image:linear-gradient(rgba(200,169,106,.55) 1px,transparent 1px),linear-gradient(90deg,rgba(96,165,250,.45) 1px,transparent 1px);background-size:70px 70px;animation:hh-flow 2.4s linear infinite}
@keyframes hh-flow{to{background-position:0 70px}}
.hh-tg{position:absolute;width:0;height:0;animation:hh-pop .6s both;animation-delay:var(--e)}
.hh-tg i{position:absolute;left:-5px;top:-5px;width:10px;height:10px;border-radius:50%;border:1.5px solid #fff;background:#0A1530;box-shadow:0 0 10px rgba(255,255,255,.6)}
.hh-tg b{position:absolute;left:14px;top:10px;white-space:nowrap;padding:4px 9px;border-radius:3px;background:rgba(6,13,32,.9);border:1px solid rgba(200,169,106,.55);color:#E6D3A3;font:600 10.5px ui-monospace,Menlo,Consolas,monospace;letter-spacing:.14em}
@keyframes hh-pop{0%{opacity:0;transform:scale(.6)}70%{transform:scale(1.08)}100%{opacity:1;transform:scale(1)}}
.hh-ctr{position:absolute;left:0;right:0;display:flex;flex-direction:column;align-items:center;text-align:center;padding:0 20px}
.hh-chip{display:inline-flex;align-items:center;gap:10px;padding:7px 16px;border-radius:999px;border:1px solid rgba(200,169,106,.45);background:rgba(200,169,106,.08);font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#E6D3A3;max-width:100%}
.hh-chip i{flex:none;width:8px;height:8px;border-radius:50%;background:#34D399;animation:hh-beat 1.8s infinite}
@keyframes hh-beat{0%{box-shadow:0 0 0 0 rgba(52,211,153,.7)}70%{box-shadow:0 0 0 9px rgba(52,211,153,0)}100%{box-shadow:0 0 0 0 rgba(52,211,153,0)}}
.hh h1{margin:0;font-weight:800;line-height:1.06;letter-spacing:-.035em;white-space:nowrap;color:#fff}
.hh-l{display:block;overflow:hidden;padding-bottom:.14em;margin-bottom:-.14em}
.hh-l>span{display:block;animation:hh-rise .9s cubic-bezier(.2,.8,.2,1) both;animation-delay:var(--d)}
@keyframes hh-rise{from{transform:translateY(105%)}to{transform:none}}
.hh-hl{background:linear-gradient(90deg,${GOLD},#fff 45%,${GOLD});background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:hh-sheen 5s linear infinite}
@keyframes hh-sheen{to{background-position:-200% 0}}
.hh-s{margin:0;line-height:1.55;color:#B4C0D8;max-width:580px}
.hh-fi{animation:hh-up .8s both;animation-delay:var(--d,.5s)}
@keyframes hh-up{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
@keyframes hh-fade{from{opacity:0}to{opacity:1}}
.hh-btns{display:flex;flex-wrap:wrap;justify-content:center;gap:14px}
.hh-b{display:inline-flex;align-items:center;gap:10px;height:48px;padding:0 24px;border-radius:8px;font:600 14.5px Inter,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;cursor:pointer;transition:transform .2s,box-shadow .2s,background .2s}
.hh-b1{background:#fff;color:${NAVY};border:0}.hh-b1:hover{transform:translateY(-2px);box-shadow:0 10px 30px -8px rgba(200,169,106,.8)}
.hh-b2{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.4)}.hh-b2:hover{background:rgba(255,255,255,.09);transform:translateY(-2px)}
.hh-b:focus-visible{outline:2px solid ${GOLD};outline-offset:3px}
.hh-mq{position:absolute;left:0;right:0;bottom:0;height:48px;border-top:1px solid rgba(255,255,255,.12);background:rgba(6,13,32,.6);overflow:hidden;display:flex;align-items:center;-webkit-mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent);mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)}
.hh-mt{display:flex;align-items:center;gap:36px;padding-right:36px;white-space:nowrap;width:max-content;animation:hh-mq 34s linear infinite;font-size:12px;font-weight:700;letter-spacing:.2em;color:#C9D4EA}
.hh-mt i{width:6px;height:6px;background:${GOLD};transform:rotate(45deg)}
@keyframes hh-mq{to{transform:translateX(-50%)}}
.hh-sm .hh-chip{font-size:10px!important;letter-spacing:.07em;padding:6px 12px;white-space:nowrap}
.hh-sm .hh-tg b{font-size:9.5px;letter-spacing:.1em;padding:3px 7px}
.hh-sm .hh-btns{flex-direction:column;align-items:center;gap:10px}
.hh-sm .hh-b{width:224px;justify-content:center;height:46px}
.hh[data-off="1"] *{animation-play-state:paused!important}
@media (prefers-reduced-motion:reduce){.hh *,.hh *::before,.hh *::after{animation-duration:.01ms!important;animation-delay:0s!important;animation-iteration-count:1!important}.hh-pt{display:none}}
`;

const inject = () => {
  if (typeof document === 'undefined' || document.getElementById('hh-css')) return;
  const s = document.createElement('style'); s.id = 'hh-css'; s.textContent = CSS; document.head.appendChild(s);
};
inject();

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const f1 = (n: number) => Math.round(n * 10) / 10;

export default function HomeHero({ go }: { go: (t: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(1216);
  const [off, setOff] = useState(false);

  useEffect(() => {
    inject();
    const el = ref.current; if (!el) return;
    const measure = () => { const w = Math.round(el.getBoundingClientRect().width); if (w > 0) setW((o) => (o === w ? o : w)); };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null; ro?.observe(el);
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([e]) => setOff(!e.isIntersecting)) : null; io?.observe(el); // off screen: pause the animations
    return () => { ro?.disconnect(); io?.disconnect(); };
  }, []);

  // Size: a little bigger than the old banner, scaled to the window. The hero is the page's first impression, so it gets real presence without pushing the content far down.
  const big = W >= 1020, mid = W >= 640;
  const H = big ? 540 : mid ? 520 : 560;
  const MQ = 48, hy = H - MQ - 64; // hy = the horizon line
  const k = big ? 0.82 : 0.7; // skyline + wave height scale
  const h1 = Math.round(clamp((W - 48) / 10.4, 28, 58));
  const pad = Math.round(W * 0.047);
  const barW = 12;

  const n = clamp(Math.round(W / 36), 14, 34);
  const bars = useMemo(() => Array.from({ length: n }, (_, i) => ({ h: Math.round(BARS[Math.round((i / (n - 1)) * (BARS.length - 1))] * k), p: (i / (n - 1)).toFixed(3) })), [n, k]);

  const fx = (x: number) => f1((x / 1280) * W), fy = (up: number) => f1(hy - up * k);
  const d = WAVE.map(([c, v]) => c + v.map((val, i) => (i % 2 === 0 ? fx(val) : fy(val))).join(' ')).join('');

  const rowTop = clamp(Math.round(H * 0.075), 28, 44);
  const gap = big ? 18 : 14;

  return (
    <div ref={ref} className={mid ? 'hh' : 'hh hh-sm'} data-off={off ? '1' : '0'} style={{ height: H, borderRadius: 8, border: '1px solid #1C2E56', boxShadow: '0 24px 50px -28px rgba(6,13,32,.9)' }}>
      <div className="hh-bg" />
      <div className="hh-sun" style={{ top: hy - 100 }} />
      <div className="hh-sk" aria-hidden="true" style={{ left: pad, right: pad, top: hy - Math.round(100 * k), height: Math.round(100 * k) }}>
        {bars.map((b, i) => <i key={i} className="hh-sb" style={{ '--h': b.h, '--p': b.p } as any} />)}
      </div>
      <div className="hh-bm" aria-hidden="true" style={{ top: hy - Math.round(108 * k), height: Math.round(110 * k), '--bx0': `${pad + barW / 2}px`, '--bx1': `${W - pad - barW / 2}px` } as any} />
      <svg className="hh-wv" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <path pathLength={1} d={d} fill="none" stroke={GOLD} strokeWidth={2.6} />
      </svg>
      <div className="hh-pt" aria-hidden="true" style={{ offsetPath: `path("${d}")` } as any} />
      <div className="hh-hz" style={{ top: hy }} />
      <div className="hh-fw" style={{ top: hy + 1, bottom: 0 }}><div className="hh-fg" /></div>
      {TAGS.filter((t) => W >= t.min).map((t) => (
        <div key={t.label} className="hh-tg" aria-hidden="true" style={{ left: fx(t.x), top: fy(t.up), '--e': t.e } as any}><i /><b>{t.label}</b></div>
      ))}

      <div className="hh-ctr" style={{ top: rowTop, gap }}>
        <div className="hh-chip hh-fi" style={{ '--d': '.1s', fontSize: mid ? 12 : 10.5 } as any}><i />Smarter analysis. Better decisions.</div>
        <h1 style={{ fontSize: h1 }}>
          <span className="hh-l"><span style={{ '--d': '.2s' } as any}>Trade with a plan.</span></span>
          <span className="hh-l"><span style={{ '--d': '.35s' } as any}><span className="hh-hl">Not a feeling.</span></span></span>
        </h1>
        <p className="hh-s hh-fi" style={{ '--d': '.55s', fontSize: mid ? 16.5 : 14.5 } as any}>Smart-money analysis for forex, gold, crypto and synthetic indices, with entry, stop loss and three take profits.</p>
        <div className="hh-btns hh-fi" style={{ '--d': '.7s' } as any}>
          <button type="button" className="hh-b hh-b1" onClick={() => go(1)}>
            Go to Analysis
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
          </button>
          <button type="button" className="hh-b hh-b2" onClick={() => go(2)}>Explore Markets</button>
        </div>
      </div>

      <div className="hh-mq" aria-hidden="true">
        <div className="hh-mt">
          {[0, 1].map((r) => MARQUEE.map((m) => <React.Fragment key={r + m}><span>{m}</span><i /></React.Fragment>))}
        </div>
      </div>
    </div>
  );
}
