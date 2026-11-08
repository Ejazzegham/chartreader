import React from 'react';
import { Icon } from './ui';
import { useRealWindow } from './win';
import type { Theme } from './theme';

// The website's Tools hub, in Liquid Glass: a glowing Tools sphere in the middle, 14 frosted-glass tool cards around it (five rows, two cards
// per side of the hub) joined by soft glowing lines, on a lavender-to-ice-blue backdrop with silky glass waves and small floating bubbles.
// It fills the whole screen UNDER the floating top bar (the bar sits above it, z-index 31) and is opened from "Tools" in Desktop.web.tsx.
export type OrbitItem = { id: string; label: string; icon: string; on: boolean; badge: number; go: () => void };

const SW = 1480, SH = 720, CX = SW / 2, CY = SH / 2 - 2; // stage size and its centre
const BLUE = '#1677FF', VIOLET = '#773BFF';
// Where each card sits, as an offset from the hub centre (keyed by the item id from Desktop.web.tsx).
const POS: Record<string, [number, number]> = {
  '13': [-238, -274], '19': [242, -272],                                          // News, Crypto Exchanges
  help: [-578, -130], '4': [-163, -132], '11': [162, -132], '18': [587, -128],    // Help Chat, Risk & TP Planner, Trade Checklist, Forex Brokers
  '8': [-323, 0], '9': [322, 0],                                                  // Forex Market Hours, Performance
  '6': [-598, 130], hist: [-163, 138], '5': [162, 138], '17': [592, 132],          // Settings, Trade History, Analysis History, Prop Firms
  '15': [-243, 296], '14': [242, 296],                                            // About Us, How to Use
};
const ARCS: [string, string][] = [['13', 'help'], ['19', '18'], ['6', '15'], ['17', '14']]; // soft curves between the outer cards
// Solid white icons for each tool, and which cards get the violet / the blue icon orb.
const GLYPH: Record<string, string> = { 'help-circle': 'play-circle', 'chatbubbles-outline': 'chatbubble-ellipses', receipt: 'document-text' };
const VIOLET_IDS = new Set(['19', 'help', '11', '5', '17', '15']); // Crypto, Help Chat, Checklist, Analysis History, Prop Firms, About Us; the rest are blue

const CSS = `
.to{position:fixed;left:0;right:0;top:0;bottom:0;z-index:30;overflow:hidden;direction:ltr;font-family:Inter,Geist,'SF Pro Display',system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;animation:to-in .25s ease-out both}
.to *{box-sizing:border-box}
@keyframes to-in{from{opacity:0}to{opacity:1}}
.to-bg{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none}
.to-bub{position:absolute;border-radius:50%;pointer-events:none;border:1px solid var(--bubb);
  background:radial-gradient(circle at 30% 26%,rgba(255,255,255,.95) 0 6%,rgba(255,255,255,.22) 22%,rgba(255,255,255,.04) 60%,var(--bub2) 100%);
  box-shadow:inset 0 -5px 9px var(--bub3),inset 0 2px 5px rgba(255,255,255,.6),0 8px 16px -8px var(--sh);animation:to-bf 9s ease-in-out infinite}
@keyframes to-bf{0%,100%{translate:0 0}50%{translate:0 -14px}}
.to-area{position:absolute;left:0;right:0;bottom:0}
.to-st{position:absolute;left:50%;top:50%;width:${SW}px;height:${SH}px}
.to-svg{position:absolute;left:0;top:0;pointer-events:none}
.to-c{position:absolute;display:flex;align-items:center;gap:14px;width:216px;height:72px;padding:0 16px 0 12px;margin:-36px 0 0 -108px;border-radius:30px;border:1px solid var(--cb);
  background:var(--card);backdrop-filter:blur(22px) saturate(180%);-webkit-backdrop-filter:blur(22px) saturate(180%);color:var(--ink);cursor:pointer;text-align:left;font:inherit;
  box-shadow:0 22px 30px -16px var(--sh),0 4px 12px -6px var(--sh),inset 0 0 0 1px var(--inner),inset 0 1px 0 var(--hi),inset 0 -10px 18px var(--low);
  transition:transform .3s cubic-bezier(.2,.8,.2,1),box-shadow .3s,border-color .2s,background .2s;animation:to-pop .5s cubic-bezier(.2,.8,.2,1) both,to-fl 7s ease-in-out infinite;animation-delay:var(--e),var(--d)}
.to-c::before{content:"";position:absolute;left:3px;right:3px;top:2px;height:46%;border-radius:28px 28px 50% 50%/28px 28px 16px 16px;background:linear-gradient(180deg,var(--gloss),rgba(255,255,255,0));pointer-events:none}
.to-c:hover,.to-c:focus-visible{outline:none;background:var(--cardh);border-color:rgba(119,59,255,.5);transform:translateY(-5px) scale(1.04);box-shadow:0 30px 40px -16px var(--sh),0 0 0 3px rgba(119,59,255,.16),inset 0 0 0 1px var(--inner),inset 0 1px 0 var(--hi),inset 0 -10px 18px var(--low)}
.to-c.on{border-color:rgba(119,59,255,.6);box-shadow:0 22px 30px -16px var(--sh),0 0 0 3px rgba(119,59,255,.18),inset 0 0 0 1px var(--inner),inset 0 1px 0 var(--hi),inset 0 -10px 18px var(--low)}
@keyframes to-pop{from{opacity:0;transform:scale(.75)}}
@keyframes to-fl{0%,100%{translate:0 0}50%{translate:0 -6px}}
.to-t{position:relative;flex:none;width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  box-shadow:0 0 0 4px var(--orb),inset 0 2px 1px rgba(255,255,255,.7),inset 0 -7px 10px rgba(0,10,80,.28),0 10px 16px -4px var(--tg)}
.to-t::after{content:"";position:absolute;left:18%;top:7%;width:64%;height:38%;border-radius:50%;background:linear-gradient(180deg,rgba(255,255,255,.65),rgba(255,255,255,0));pointer-events:none}
.to-t svg,.to-t .ion{position:relative;z-index:1;filter:drop-shadow(0 2px 3px rgba(0,20,100,.35))}
.to-t.b{--tg:rgba(22,119,255,.7);background:radial-gradient(circle at 32% 24%,#9CCBFF 0%,#3C86FF 42%,#1747DD 100%)}
.to-t.p{--tg:rgba(119,59,255,.7);background:radial-gradient(circle at 32% 24%,#CDB9FF 0%,#8452FF 42%,#4B22D8 100%)}
.to-l{position:relative;font-size:16px;font-weight:600;line-height:1.25;letter-spacing:-.1px}
.to-bd{position:absolute;top:-4px;right:-4px;z-index:2;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:var(--sell);color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px rgba(255,255,255,.9)}
.to-core{position:absolute;left:${CX - 68}px;top:${CY - 68}px;width:136px;height:136px;border-radius:50%;border:0;padding:0;cursor:pointer;display:flex;align-items:center;justify-content:center;
  background:radial-gradient(circle at 32% 24%,#C2AAFF 0%,${VIOLET} 40%,#2F5BEA 100%);
  box-shadow:0 0 0 3px rgba(255,255,255,.35),0 0 80px 18px rgba(110,70,255,.42),0 28px 44px -12px rgba(60,40,160,.6),inset 0 4px 8px rgba(255,255,255,.65),inset 0 -18px 26px rgba(20,20,130,.4);
  transition:transform .35s cubic-bezier(.2,.8,.2,1),box-shadow .35s}
.to-core::before{content:"";position:absolute;inset:-14px;border-radius:50%;border:1.5px solid rgba(255,255,255,.7);background:radial-gradient(circle,rgba(255,255,255,0) 60%,rgba(255,255,255,.3));
  box-shadow:0 0 0 10px rgba(119,59,255,.08),0 0 0 24px rgba(22,119,255,.05),inset 0 2px 6px rgba(255,255,255,.6);animation:to-pu 5s ease-in-out infinite;pointer-events:none}
.to-core::after{content:"";position:absolute;left:16%;top:6%;width:68%;height:42%;border-radius:50%;background:linear-gradient(180deg,rgba(255,255,255,.72),rgba(255,255,255,0));pointer-events:none}
.to-core:hover,.to-core:focus-visible{outline:none;transform:scale(1.07);box-shadow:0 0 0 3px rgba(255,255,255,.45),0 0 100px 24px rgba(110,70,255,.52),0 32px 50px -12px rgba(60,40,160,.65),inset 0 4px 8px rgba(255,255,255,.7),inset 0 -18px 26px rgba(20,20,130,.4)}
.to-core span{position:relative;z-index:1;display:flex;filter:drop-shadow(0 3px 5px rgba(20,10,90,.5))}
@keyframes to-pu{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.04);opacity:.85}}
.to-ct{position:absolute;left:0;top:${CY + 90}px;width:${SW}px;display:flex;align-items:center;justify-content:center;gap:16px;font-size:13px;font-weight:700;letter-spacing:.36em;color:var(--tl);pointer-events:none}
.to-ct span{margin-right:-.36em}
.to-ct::before,.to-ct::after{content:"";width:40px;height:1.5px;border-radius:1px}
.to-ct::before{background:linear-gradient(90deg,rgba(119,59,255,0),var(--tl))}.to-ct::after{background:linear-gradient(270deg,rgba(119,59,255,0),var(--tl))}
@media (prefers-reduced-motion:reduce){.to,.to-c,.to-core::before,.to-bub{animation:none}.to-c,.to-core{transition:none}}
`;

// Silky glass waves along the edges (bottom-left, upper-right, right and bottom-right): soft translucent bands with fine highlight lines, drawn once as SVG.
function Waves({ dk }: { dk: boolean }) {
  const hi = dk ? 'rgba(255,255,255,.34)' : 'rgba(255,255,255,.9)', hi2 = dk ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.55)';
  const band = (id: string, a: string, b: string, x2 = 1, y2 = 1) => <linearGradient id={id} x1="0" y1="0" x2={x2} y2={y2}><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient>;
  const w = dk ? ['rgba(150,120,255,.3)', 'rgba(60,90,220,.06)', 'rgba(110,150,255,.26)'] : ['rgba(255,255,255,.7)', 'rgba(170,150,255,.12)', 'rgba(255,255,255,.55)'];
  return (
    <svg className="to-bg" viewBox="0 0 1440 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        {band('tw1', w[0], w[1])}{band('tw2', w[2], w[1], 0, 1)}
        <filter id="tws" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation=".8" /></filter>
        <filter id="twb" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="14" /></filter>
      </defs>
      <g filter="url(#twb)" opacity={dk ? 0.6 : 0.7}><ellipse cx="120" cy="720" rx="360" ry="130" fill={dk ? '#6F4BFF' : '#B9A0FF'} /><ellipse cx="1380" cy="90" rx="260" ry="110" fill={dk ? '#2F6BFF' : '#9CC2FF'} /><ellipse cx="1330" cy="740" rx="320" ry="120" fill={dk ? '#2F6BFF' : '#8FB8FF'} /></g>
      <path d="M0 560 C 160 520, 300 610, 470 640 S 760 720, 860 800 L0 800 Z" fill="url(#tw1)" />
      <path d="M0 620 C 150 580, 270 670, 420 700 S 620 760, 690 800 L0 800 Z" fill="url(#tw2)" />
      <g fill="none" filter="url(#tws)">
        <path d="M0 540 C 170 500, 310 600, 490 630 S 770 700, 880 800" stroke={hi} strokeWidth="1.8" />
        <path d="M0 585 C 160 545, 290 640, 450 670 S 700 735, 790 800" stroke={hi2} strokeWidth="1.3" />
        <path d="M0 640 C 140 600, 250 690, 400 718 S 590 770, 650 800" stroke={hi2} strokeWidth="1.1" />
        <path d="M0 500 C 120 470, 230 540, 350 560" stroke={hi2} strokeWidth="1" />
      </g>
      <path d="M1440 40 C 1380 90, 1300 150, 1210 150 S 1030 130, 960 40 L1020 0 L1440 0 Z" fill="url(#tw1)" />
      <path d="M1440 330 C 1370 300, 1290 230, 1180 240 S 1000 220, 930 120" fill="none" stroke={hi2} strokeWidth="1.2" filter="url(#tws)" />
      <path d="M1440 150 C 1380 190, 1310 180, 1240 130 S 1120 40, 1060 0" fill="none" stroke={hi} strokeWidth="1.6" filter="url(#tws)" />
      <path d="M1440 420 C 1350 450, 1290 520, 1180 560 S 1000 640, 900 800 L1440 800 Z" fill="url(#tw2)" />
      <path d="M1440 560 C 1360 590, 1290 650, 1210 690 S 1100 760, 1060 800 L1440 800 Z" fill="url(#tw1)" />
      <g fill="none" filter="url(#tws)">
        <path d="M1440 400 C 1350 430, 1280 510, 1170 550 S 990 630, 880 800" stroke={hi} strokeWidth="1.8" />
        <path d="M1440 470 C 1350 500, 1290 570, 1200 610 S 1050 690, 970 800" stroke={hi2} strokeWidth="1.3" />
        <path d="M1440 545 C 1360 575, 1300 640, 1220 680 S 1110 750, 1070 800" stroke={hi2} strokeWidth="1.1" />
      </g>
    </svg>
  );
}
const BUBBLES: [number, number, number, number][] = [[10.8, 28, 22, 0], [8.4, 55, 38, -3], [88.8, 29, 32, -5], [92.6, 74, 40, -2], [30, 90, 20, -6], [62, 8, 16, -4]]; // [left %, top %, size px, delay s]

export default function ToolsOrbit({ th, top, items, onClose }: { th: Theme; top: number; items: OrbitItem[]; onClose: () => void }) {
  const { width, height } = useRealWindow();
  const k = Math.max(0.5, Math.min(1, (width - 24) / SW, (height - top - 14) / SH));
  const pos = items.map((it, i) => {
    const o = POS[it.id];
    if (o) return { x: CX + o[0], y: CY + o[1] };
    const a = ((-100 + (360 / items.length) * i) * Math.PI) / 180; // any unknown item goes on a ring
    return { x: CX + 560 * Math.cos(a), y: CY + 300 * Math.sin(a) };
  });
  const at = (id: string) => { const i = items.findIndex((x) => x.id === id); return i < 0 ? null : pos[i]; };
  const dk = th.dark, v: any = {
    '--ink': dk ? '#FFFFFF' : '#1B2250', '--sell': th.sell, '--tl': dk ? '#C9B8FF' : '#3B32D0',
    '--card': dk ? 'linear-gradient(180deg,rgba(60,64,130,.56),rgba(36,40,100,.46))' : 'linear-gradient(180deg,rgba(255,255,255,.7),rgba(255,255,255,.4))',
    '--cardh': dk ? 'linear-gradient(180deg,rgba(74,78,150,.66),rgba(46,50,114,.56))' : 'linear-gradient(180deg,rgba(255,255,255,.84),rgba(255,255,255,.56))',
    '--cb': dk ? 'rgba(255,255,255,0.26)' : 'rgba(255,255,255,0.9)', '--inner': dk ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.45)', '--hi': dk ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,1)',
    '--gloss': dk ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.6)', '--low': dk ? 'rgba(120,130,255,0.12)' : 'rgba(150,160,255,0.2)', '--orb': dk ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.55)',
    '--sh': dk ? 'rgba(0,0,0,0.5)' : 'rgba(80,80,170,0.38)',
    '--bub2': dk ? 'rgba(80,140,255,.3)' : 'rgba(120,170,255,.3)', '--bub3': dk ? 'rgba(119,59,255,.4)' : 'rgba(119,59,255,.2)', '--bubb': dk ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.85)',
  };
  const bg = dk
    ? 'radial-gradient(55% 55% at 50% 50%,rgba(119,59,255,.3),rgba(119,59,255,0) 72%),radial-gradient(40% 45% at 6% 90%,rgba(140,90,255,.3),rgba(140,90,255,0) 70%),linear-gradient(110deg,#1B1450,#14205A 55%,#0C1238)'
    : 'radial-gradient(60% 45% at 45% 8%,rgba(255,255,255,.55),rgba(255,255,255,0) 75%),radial-gradient(45% 45% at 8% 88%,rgba(176,140,255,.55),rgba(176,140,255,0) 72%),radial-gradient(45% 50% at 50% 52%,rgba(119,59,255,.14),rgba(119,59,255,0) 75%),linear-gradient(105deg,#E3D8FF 0%,#CFC8FF 34%,#BCD0FF 68%,#A9C9FF 100%)';
  const lineA = dk ? '#B9A6FF' : '#8D7BFF', glow = dk ? '#A98BFF' : '#FFFFFF';
  const arc = (a: { x: number; y: number }, b: { x: number; y: number }) => `M${a.x} ${a.y} Q ${(a.x + b.x) / 2 + (b.x - a.x) * 0.02} ${(a.y + b.y) / 2 + (a.y < CY ? -1 : 1) * 70 * (Math.abs(b.y - a.y) < 200 ? 0.4 : 1)} ${b.x} ${b.y}`;
  return (
    <div className="to" role="dialog" aria-label="Tools" onClick={onClose} style={{ ...v, backgroundImage: bg }}>
      <style>{CSS}</style>
      <Waves dk={dk} />
      {BUBBLES.map(([l, t, s, d], i) => <span key={i} className="to-bub" style={{ left: `${l}%`, top: `${t}%`, width: s, height: s, animationDelay: `${d}s` }} />)}
      <div className="to-area" style={{ top }}>
        <div className="to-st" style={{ transform: `translate(-50%,-50%) scale(${k})` }}>
          <svg className="to-svg" width={SW} height={SH} viewBox={`0 0 ${SW} ${SH}`} aria-hidden="true">
            <defs>
              <filter id="to-gl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" /></filter>
            </defs>
            <g fill="none" strokeLinecap="round">
              {ARCS.map(([a, b]) => { const A = at(a), B = at(b); if (!A || !B) return null; const d = arc(A, B); return <g key={a + b}><path d={d} stroke={glow} strokeOpacity=".55" strokeWidth="4" filter="url(#to-gl)" /><path d={d} stroke={lineA} strokeOpacity=".5" strokeWidth="1.2" /></g>; })}
              {pos.map((p, i) => (<g key={i}><line x1={CX} y1={CY} x2={p.x} y2={p.y} stroke={glow} strokeOpacity=".7" strokeWidth="5" filter="url(#to-gl)" /><line x1={CX} y1={CY} x2={p.x} y2={p.y} stroke={lineA} strokeOpacity=".55" strokeWidth="1.2" /></g>))}
            </g>
          </svg>
          {items.map((it, i) => {
            const p = pos[i];
            return (
              <button key={it.id} type="button" className={`to-c${it.on ? ' on' : ''}`} aria-label={it.label} aria-current={it.on ? 'page' : undefined}
                onClick={(e) => { e.stopPropagation(); it.go(); }}
                style={{ left: p.x, top: p.y, '--d': `${(-i * 0.5).toFixed(2)}s`, '--e': `${(0.04 * i).toFixed(2)}s` } as any}>
                <span className={`to-t ${VIOLET_IDS.has(it.id) ? 'p' : 'b'}`}>
                  <Icon name={GLYPH[it.icon] ?? it.icon} size={24} color="#FFFFFF" />
                  {it.badge > 0 && <span className="to-bd">{it.badge > 99 ? '99+' : it.badge}</span>}
                </span>
                <span className="to-l">{it.label}</span>
              </button>
            );
          })}
          <button type="button" className="to-core" aria-label="Close tools menu" onClick={(e) => { e.stopPropagation(); onClose(); }}><span><Icon name="construct" size={56} color="#FFFFFF" /></span></button>
          <div className="to-ct"><span>TOOLS</span></div>
        </div>
      </div>
    </div>
  );
}
