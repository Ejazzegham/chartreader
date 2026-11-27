import React, { useEffect } from 'react';
import { useApp } from './store';
import { STYLES } from './theme';

// The website backdrop: a colourful multi-colour mesh (four soft colour glows on a deep base) that drifts very slowly,
// with a fine film grain on top. The chosen theme picks the colours: Light = purple + blue, Dark = light lime green + lime yellow (src/theme.ts, STYLES).
// Slow motion is skipped for people who ask their device for reduced motion.
const ANIMATE = true; // false = still picture
const GRAIN = true;   // false = no film grain

const POS = ['15% 20%', '85% 15%', '20% 90%', '90% 85%'];
const buildCss = () => {
  const one = (name: string) => {
    const s = STYLES[name];
    const img = s.glows.map((c, i) => `radial-gradient(circle at ${POS[i]}, ${c}ee 0, transparent 52%)`).join(',');
    return `.cr-bg-${name}{background-color:${s.base};background-image:${img}}`;
  };
  return `
.cr-bg{position:absolute;top:0;left:0;right:0;bottom:0;z-index:0;pointer-events:none;overflow:hidden;background-size:170% 170%;background-repeat:no-repeat;${ANIMATE ? 'animation:cr-drift 26s ease-in-out infinite alternate;' : ''}}
${Object.keys(STYLES).map(one).join('\n')}
@keyframes cr-drift{from{background-position:0% 0%,100% 0%,0% 100%,100% 100%}to{background-position:100% 100%,0% 100%,100% 0%,0% 0%}}
@media (prefers-reduced-motion:reduce){.cr-bg{animation:none}}
${GRAIN ? `.cr-bg::after{content:"";position:absolute;top:0;left:0;right:0;bottom:0;opacity:.16;mix-blend-mode:overlay;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}` : ''}`;
};

export default function LiveBackdrop() {
  const { th } = useApp();
  useEffect(() => {
    if (document.getElementById('cr-bg-style')) return;
    const el = document.createElement('style');
    el.id = 'cr-bg-style';
    el.textContent = buildCss();
    document.head.appendChild(el);
  }, []);
  const name = th.style && STYLES[th.style] ? th.style : 'light';
  return React.createElement('div', { className: `cr-bg cr-bg-${name}`, 'aria-hidden': true });
}
