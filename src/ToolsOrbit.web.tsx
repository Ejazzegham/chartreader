import React from 'react';
import { Icon } from './ui';
import { useRealWindow } from './win';
import type { Theme } from './theme';

// The website's Tools menu: a floating, radial arrangement of glass tool cards around a glowing Tools button.
// Everything takes its colours from the active theme (Light / Dark) and its corners from the app's one 8 px radius,
// so it matches the rest of the site. Opened from the "Tools" link in the top bar (Desktop.web.tsx).
export type OrbitItem = { id: string; label: string; icon: string; on: boolean; badge: number; go: () => void };

const SW = 1280, SH = 690, CX = SW / 2, CY = SH / 2 - 6; // stage size and its centre
const INNER = { rx: 262, ry: 150, n: 6, a0: -120 }, OUTER = { rx: 540, ry: 300, n: 8, a0: -112.5 };
const CSS = `
.to{position:fixed;left:0;right:0;bottom:0;z-index:40;overflow:hidden;direction:ltr;font-family:Inter,system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;animation:to-in .22s ease-out both}
.to *{box-sizing:border-box}
@keyframes to-in{from{opacity:0}to{opacity:1}}
.to-st{position:absolute;left:50%;top:50%;width:${SW}px;height:${SH}px}
.to-ring,.to-svg{position:absolute;left:0;top:0;pointer-events:none}
.to-c{position:absolute;display:flex;align-items:center;gap:11px;width:188px;height:62px;padding:0 12px 0 10px;margin:-31px 0 0 -94px;border-radius:8px;border:1px solid var(--line);background:var(--card);backdrop-filter:blur(14px) saturate(160%);-webkit-backdrop-filter:blur(14px) saturate(160%);color:var(--ink);cursor:pointer;text-align:left;font:inherit;
  transform:perspective(900px) rotateX(var(--rx)) rotateY(var(--ry)) scale(var(--s));box-shadow:0 22px 34px -18px var(--sh),0 4px 10px -4px var(--sh),inset 0 1px 0 var(--hi);
  transition:transform .3s cubic-bezier(.2,.8,.2,1),box-shadow .3s,border-color .2s;animation:to-pop .45s cubic-bezier(.2,.8,.2,1) both,to-fl 6s ease-in-out infinite;animation-delay:var(--e),var(--d)}
.to-c.o{box-shadow:0 14px 26px -16px var(--sh),0 3px 8px -4px var(--sh),inset 0 1px 0 var(--hi)}
.to-c:hover,.to-c:focus-visible{outline:none;border-color:var(--acc2);transform:perspective(900px) rotateX(0) rotateY(0) scale(calc(var(--s)*1.07)) translateZ(30px);box-shadow:0 30px 44px -16px var(--sh),0 0 0 1px var(--acc2),inset 0 1px 0 var(--hi)}
.to-c.on{border-color:var(--acc2)}
@keyframes to-pop{from{opacity:0;transform:perspective(900px) scale(.7)}}
@keyframes to-fl{0%,100%{translate:0 0}50%{translate:0 -6px}}
.to-t{position:relative;flex:none;width:40px;height:40px;border-radius:6px;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 1px 0 rgba(255,255,255,.4),inset 0 -4px 7px rgba(0,0,0,.16),0 7px 12px -6px var(--sh)}
.to-t.b{background:linear-gradient(150deg,color-mix(in srgb,var(--acc) 70%,#fff),var(--acc))}
.to-t.p{background:linear-gradient(150deg,color-mix(in srgb,var(--poi) 70%,#fff),var(--poi))}
.to-l{font-size:13px;font-weight:600;line-height:1.2;letter-spacing:-.05px}
.to-bd{position:absolute;top:-6px;right:-6px;min-width:17px;height:17px;padding:0 4px;border-radius:9px;background:var(--sell);color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center}
.to-core{position:absolute;left:${CX - 60}px;top:${CY - 60}px;width:120px;height:120px;border-radius:50%;border:0;cursor:pointer;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 34% 26%,color-mix(in srgb,var(--poi) 55%,#fff) 0%,var(--poi) 42%,color-mix(in srgb,var(--poi) 55%,var(--acc)) 100%);
  box-shadow:0 0 0 9px var(--halo1),0 0 0 20px var(--halo2),0 0 70px 14px var(--glow),0 26px 40px -12px var(--sh),inset 0 3px 6px rgba(255,255,255,.5),inset 0 -14px 20px rgba(10,16,40,.35);animation:to-pu 4s ease-in-out infinite}
@keyframes to-pu{50%{transform:scale(1.04)}}
.to-ct{position:absolute;left:${CX - 60}px;top:${CY + 76}px;width:120px;text-align:center;font-size:11px;font-weight:700;letter-spacing:.3em;color:var(--brass);padding-left:.3em}
@media (prefers-reduced-motion:reduce){.to,.to-c,.to-core{animation:none}}
`;

export default function ToolsOrbit({ th, top, items, onClose }: { th: Theme; top: number; items: OrbitItem[]; onClose: () => void }) {
  const { width, height } = useRealWindow();
  const k = Math.max(0.55, Math.min(1, (width - 24) / SW, (height - top - 14) / SH));
  const pos = items.map((_, i) => {
    const r = i < INNER.n ? INNER : OUTER, j = i < INNER.n ? i : i - INNER.n, a = ((r.a0 + (360 / r.n) * j) * Math.PI) / 180;
    return { x: CX + r.rx * Math.cos(a), y: CY + r.ry * Math.sin(a), s: i < INNER.n ? 1 : 0.93, o: i >= INNER.n };
  });
  const dk = th.dark, v: any = {
    '--ink': th.text, '--line': th.line, '--acc': th.accent, '--acc2': th.accent2, '--poi': th.poi, '--sell': th.sell, '--brass': '#C8A96A',
    '--card': dk ? 'rgba(18,22,52,0.78)' : 'rgba(255,255,255,0.84)', '--hi': dk ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.95)',
    '--sh': dk ? 'rgba(0,0,0,0.55)' : 'rgba(27,42,80,0.28)', '--glow': th.poi + '66', '--halo1': th.poi + '24', '--halo2': th.poi + '12',
  };
  return (
    <div className="to" role="dialog" aria-label="Tools" onClick={onClose} style={{ ...v, top, background: dk ? 'rgba(6,10,31,0.66)' : 'rgba(228,234,252,0.7)', backdropFilter: 'blur(7px)', WebkitBackdropFilter: 'blur(7px)' }}>
      <style>{CSS}</style>
      <div className="to-st" style={{ transform: `translate(-50%,-50%) scale(${k})` }}>
        <svg className="to-svg" width={SW} height={SH} viewBox={`0 0 ${SW} ${SH}`} aria-hidden="true">
          <defs>
            <radialGradient id="to-lg" cx={CX} cy={CY} r="560" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor={th.poi} stopOpacity=".6" /><stop offset="1" stopColor={th.accent} stopOpacity=".22" /></radialGradient>
            <filter id="to-gl" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="2.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          <ellipse cx={CX} cy={CY} rx={INNER.rx} ry={INNER.ry} fill="none" stroke={th.poi} strokeOpacity=".32" strokeDasharray="3 7" />
          <ellipse cx={CX} cy={CY} rx={OUTER.rx} ry={OUTER.ry} fill="none" stroke={th.poi} strokeOpacity=".24" strokeDasharray="3 9" />
          {pos.map((p, i) => (<g key={i}><line x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="url(#to-lg)" strokeWidth="1.3" /><circle cx={p.x} cy={p.y} r="3.2" fill={dk ? '#fff' : th.solid} stroke={th.poi} strokeWidth="1.5" filter="url(#to-gl)" /></g>))}
        </svg>
        {items.map((it, i) => {
          const p = pos[i], ry = (-(p.x - CX) / 540) * 14, rx = ((p.y - CY) / 300) * 10;
          return (
            <button key={it.id} type="button" className={`to-c${p.o ? ' o' : ''}${it.on ? ' on' : ''}`} aria-label={it.label} aria-current={it.on ? 'page' : undefined}
              onClick={(e) => { e.stopPropagation(); it.go(); }}
              style={{ left: p.x, top: p.y, '--s': p.s, '--ry': `${ry.toFixed(1)}deg`, '--rx': `${rx.toFixed(1)}deg`, '--d': `${(-i * 0.45).toFixed(2)}s`, '--e': `${(0.04 * i).toFixed(2)}s` } as any}>
              <span className={`to-t ${i % 2 ? 'p' : 'b'}`}>
                <Icon name={it.icon} size={19} color={th.onAccent} />
                {it.badge > 0 && <span className="to-bd">{it.badge > 99 ? '99+' : it.badge}</span>}
              </span>
              <span className="to-l">{it.label}</span>
            </button>
          );
        })}
        <button type="button" className="to-core" aria-label="Close tools menu" onClick={(e) => { e.stopPropagation(); onClose(); }}><Icon name="construct" size={46} color={dk ? th.onAccent : "#FFFFFF"} /></button>
        <div className="to-ct">TOOLS</div>
      </div>
    </div>
  );
}
