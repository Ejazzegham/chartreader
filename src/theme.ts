export type Theme = {
  dark: boolean; bg: string; panel: string; line: string; text: string; dim: string;
  accent: string; accent2: string; onAccent: string; buy: string; sell: string; gold: string; poi: string;
  panel2: string; // raised surface: inputs, tiles and chips that sit ON a card
  hair: string;   // very soft divider, lighter than `line`
  glass: boolean;                       // translucent-panel themes (the backdrop is a calm flat colour: no gradients or glows)
  back: string;                         // base colour of the page backdrop (both themes use the same deep dark base)
  solid: string;                        // opaque version of `panel`: bottom sheets and pop-ups must not be see-through
  style?: string;                       // which colourful backdrop this theme uses (a key of STYLES)
};
type Opt = 'panel2' | 'hair' | 'glass' | 'solid' | 'back' | 'style';
type Base = Omit<Theme, Opt> & Partial<Pick<Theme, Opt>>;

// Shared design tokens, so every screen uses the same spacing, corner and type scale.
export const R = { sm: 4, md: 6, lg: 6, xl: 6, inner: 4, box: 6, pill: 6 }; // Big shapes (cards, panels, banners, buttons, inputs, sheets) use 6. Small shapes (chips, tags, bars) use 3 or 4. Only true circles (dots, avatars) stay round
export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 }; // font sizes

const hex = (h: string) => { const n = parseInt(h.slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
// mix(a, b, t): t = 0 gives a, t = 1 gives b
const mix = (a: string, b: string, t: number) => { const x = hex(a), y = hex(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const build = (b: Base): Theme => ({
  ...b,
  style: b.style ?? 'aurora',
  glass: !!b.glass,
  solid: b.solid ?? b.panel,
  back: b.back ?? b.bg,
  panel2: b.panel2 ?? mix(b.panel, b.dark ? '#FFFFFF' : b.text, b.dark ? 0.045 : 0.035),
  hair: b.hair ?? mix(b.panel, b.dark ? '#FFFFFF' : b.text, b.dark ? 0.08 : 0.08),
});

// 12 themes = 6 colourful backdrop styles x 2 panel looks (light panels / dark panels).
// The backdrop (src/LiveBackdrop.web.tsx) is a drifting multi-colour mesh; the style decides its colours.
// buy / sell / gold / poi stay as trading colours (green, red, amber, violet) so a buy never looks like a sell.
export const STYLES: Record<string, { name: string; base: string; glows: string[]; light: [string, string]; dark: [string, string] }> = {
  //            name              backdrop base  four glows                                       accent + accent2 on light panels   on dark panels
  aurora:   { name: 'Aurora',   base: '#070A1F', glows: ['#2563EB', '#22D3EE', '#A855F7', '#EC4899'], light: ['#2563EB', '#C026D3'], dark: ['#60A5FA', '#22D3EE'] },
  sunset:   { name: 'Sunset',   base: '#12061C', glows: ['#F97316', '#EC4899', '#8B5CF6', '#FACC15'], light: ['#EA580C', '#DB2777'], dark: ['#FB923C', '#F472B6'] },
  emerald:  { name: 'Emerald',  base: '#03121A', glows: ['#10B981', '#06B6D4', '#3B82F6', '#84CC16'], light: ['#059669', '#0891B2'], dark: ['#34D399', '#22D3EE'] },
  royal:    { name: 'Royal',    base: '#0B0724', glows: ['#6366F1', '#A855F7', '#F59E0B', '#2563EB'], light: ['#4F46E5', '#D97706'], dark: ['#818CF8', '#FBBF24'] },
  cyber:    { name: 'Cyber',    base: '#050509', glows: ['#F43F5E', '#D946EF', '#06B6D4', '#6366F1'], light: ['#C026D3', '#0891B2'], dark: ['#E879F9', '#22D3EE'] },
  northern: { name: 'Northern', base: '#04101A', glows: ['#34D399', '#6366F1', '#22D3EE', '#C084FC'], light: ['#0D9488', '#7C3AED'], dark: ['#2DD4BF', '#C084FC'] },
};
const TRADE = { light: { buy: '#059669', sell: '#E11D48', gold: '#B7791F', poi: '#7C3AED' }, dark: { buy: '#34D399', sell: '#FB7185', gold: '#F8D06A', poi: '#C084FC' } };
const mk = (style: string, dark: boolean): Base => {
  const s = STYLES[style], [accent, accent2] = dark ? s.dark : s.light;
  if (!dark) return { dark: false, glass: true, style, back: s.base, bg: '#F4F6FF', panel: '#FFFFFFD6', solid: '#FFFFFF', panel2: '#1B2A5012', hair: '#1B2A5018', line: '#C9D2E8', text: '#0A1022', dim: '#2B364D', accent, accent2, onAccent: '#FFFFFF', ...TRADE.light };
  const solid = mix(s.base, '#FFFFFF', 0.11); // dark panels are tinted with the backdrop's own colour
  return { dark: true, glass: true, style, back: s.base, bg: mix(s.base, '#FFFFFF', 0.03), panel: solid + 'DB', solid, panel2: '#FFFFFF1A', hair: '#FFFFFF26', line: '#FFFFFF40', text: '#FFFFFF', dim: '#C7D0EA', accent, accent2, onAccent: '#06102A', ...TRADE.dark };
};
const BASE: Record<string, Base> = {};
Object.keys(STYLES).forEach((k) => { BASE[k + '-light'] = mk(k, false); BASE[k + '-dark'] = mk(k, true); });

export const THEMES: Record<string, Theme> = Object.fromEntries(Object.entries(BASE).map(([k, v]) => [k, build(v)]));
export const themeLabel = (id: string) => { const [s, m] = id.split('-'); return (STYLES[s]?.name ?? id) + ' · ' + (m === 'dark' ? 'Dark panels' : 'Light panels'); };

// Saved choices from before the 12 themes: "light" -> Royal light, "dark" (and the older dark themes) -> Aurora dark.
const OLD_DARK = ['dark', 'royal', 'midnight', 'ocean', 'graphite', 'sunset', 'forest', 'glassNight', 'glassAurora', 'glassObsidian'];
export const themeId = (id?: string) => (id && THEMES[id] ? id : id && OLD_DARK.includes(id) ? 'aurora-dark' : 'royal-light');
export const themeFor = (id?: string): Theme => THEMES[themeId(id)];

// Text colour that stays readable on top of a given background colour (price tags, chart labels, chips).
export const ink = (bg: string, light = '#FFFFFF', dark = '#0B1220') => {
  const [r, g, b] = hex(bg).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.38 ? dark : light;
};
