import React, { useEffect } from 'react';
import { useApp } from './store';

// The website backdrop: a colourful multi-colour mesh (four soft colour glows on a deep base) that drifts very slowly,
// with a fine film grain on top. Each theme has its own colour style so the backdrop matches the theme.
// To change a theme's look, change its name in THEME_STYLE (aurora | sunset | emerald | royal | cyber | northern).
// Slow motion is skipped for people who ask their device for reduced motion.
export const STYLES: Record<string, { base: string; glows: string[] }> = {
  aurora:   { base: '#070A1F', glows: ['#2563EB', '#22D3EE', '#A855F7', '#EC4899'] },
  sunset:   { base: '#12061C', glows: ['#F97316', '#EC4899', '#8B5CF6', '#FACC15'] },
  emerald:  { base: '#03121A', glows: ['#10B981', '#06B6D4', '#3B82F6', '#84CC16'] },
  royal:    { base: '#0B0724', glows: ['#6366F1', '#A855F7', '#F59E0B', '#2563EB'] },
  cyber:    { base: '#050509', glows: ['#F43F5E', '#D946EF', '#06B6D4', '#6366F1'] },
  northern: { base: '#04101A', glows: ['#34D399', '#6366F1', '#22D3EE', '#C084FC'] },
};
export const THEME_STYLE: Record<string, string> = { light: 'royal', dark: 'aurora' };
const ANIMATE = true; // false = still picture
const GRAIN = true;   // false = no film grain

const POS = ['15% 20%', '85% 15%', '20% 90%', '90% 85%'];
const buildCss = () => {
  const one = (name: string) => {
    const s = STYLES[name];
    const img = s.glows.map((c, i) => `radial-gradient(circle at ${POS[i]}, ${c}cc 0, transparent 46%)`).join(',');
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
  const name = THEME_STYLE[th.dark ? 'dark' : 'light'];
  return React.createElement('div', { className: `cr-bg cr-bg-${STYLES[name] ? name : 'aurora'}`, 'aria-hidden': true });
}
