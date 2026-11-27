export type Theme = {
  dark: boolean; bg: string; panel: string; line: string; text: string; dim: string;
  accent: string; accent2: string; onAccent: string; buy: string; sell: string; gold: string; poi: string;
  panel2: string; // raised surface: inputs, tiles and chips that sit ON a card
  hair: string;   // very soft divider, lighter than `line`
  glass: boolean;                       // always false now: every box is solid
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

// Two themes only: Light and Dark. Plain, professional palettes: a flat page background, solid panels, and one blue accent.
//  Light: soft grey-white page, white panels, slate text, blue accent.
//  Dark : deep navy-black page, slightly lighter navy panels, light slate text, blue accent.
// STYLES keeps the page base colour (src/LiveBackdrop.web.tsx paints it flat) and two swatch shades used by the Settings theme picker.
// buy / sell / gold / poi stay as trading colours (green, red, amber, violet) so a buy never looks like a sell.
export const STYLES: Record<string, { name: string; base: string; glows: string[]; light: [string, string]; dark: [string, string] }> = {
  light: { name: 'Light', base: '#F4F6FA', glows: ['#FFFFFF', '#E2E8F0'], light: ['#2563EB', '#1D4ED8'], dark: ['#2563EB', '#1D4ED8'] },
  dark:  { name: 'Dark',  base: '#0B0F17', glows: ['#121826', '#1A2233'], light: ['#3B82F6', '#60A5FA'], dark: ['#3B82F6', '#60A5FA'] },
};
const TRADE = { light: { buy: '#059669', sell: '#E11D48', gold: '#B7791F', poi: '#7C3AED' }, dark: { buy: '#34D399', sell: '#FB7185', gold: '#F8D06A', poi: '#C084FC' } };
const BASE: Record<string, Base> = {
  light: { dark: false, glass: false, style: 'light', back: STYLES.light.base, bg: '#F4F6FA', panel: '#FFFFFF', solid: '#FFFFFF', panel2: '#F1F4F9', hair: '#E8ECF3', line: '#D8DEE9', text: '#0F172A', dim: '#475569', accent: STYLES.light.dark[0], accent2: STYLES.light.dark[1], onAccent: '#FFFFFF', ...TRADE.light },
  dark:  { dark: true,  glass: false, style: 'dark',  back: STYLES.dark.base,  bg: '#0B0F17', panel: '#121826', solid: '#121826', panel2: '#1A2233', hair: '#1F2937', line: '#2A3447', text: '#F1F5F9', dim: '#94A3B8', accent: STYLES.dark.dark[0], accent2: STYLES.dark.dark[1], onAccent: '#FFFFFF', ...TRADE.dark },
};

export const THEMES: Record<string, Theme> = Object.fromEntries(Object.entries(BASE).map(([k, v]) => [k, build(v)]));
export const themeLabel = (id: string) => (id === 'dark' ? 'Dark' : 'Light');

// Saved choices from the old 12 themes: anything dark (…-dark, "dark", midnight, ocean…) becomes Dark, everything else becomes Light.
export const themeId = (id?: string) => (id === 'dark' || id === 'light' ? id : id && (id.endsWith('-dark') || ['midnight', 'ocean', 'graphite', 'sunset', 'forest', 'glassNight', 'glassAurora', 'glassObsidian'].includes(id)) ? 'dark' : 'light');
export const themeFor = (id?: string): Theme => THEMES[themeId(id)];

// Text colour that stays readable on top of a given background colour (price tags, chart labels, chips).
export const ink = (bg: string, light = '#FFFFFF', dark = '#0B1220') => {
  const [r, g, b] = hex(bg).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.38 ? dark : light;
};
