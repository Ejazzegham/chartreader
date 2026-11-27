export type Theme = {
  dark: boolean; bg: string; panel: string; line: string; text: string; dim: string;
  accent: string; accent2: string; onAccent: string; buy: string; sell: string; gold: string; poi: string;
  panel2: string; // raised surface: inputs, tiles and chips that sit ON a card
  hair: string;   // very soft divider, lighter than `line`
  glass: boolean;                       // translucent-panel themes (the backdrop is a calm flat colour: no gradients or glows)
  back: string;                         // base colour of the page backdrop (both themes use the same deep dark base)
  solid: string;                        // opaque version of `panel`: bottom sheets and pop-ups must not be see-through
};
type Opt = 'panel2' | 'hair' | 'glass' | 'solid' | 'back';
type Base = Omit<Theme, Opt> & Partial<Pick<Theme, Opt>>;

// Shared design tokens, so every screen uses the same spacing, corner and type scale.
export const R = { sm: 4, md: 6, lg: 6, xl: 6, inner: 4, box: 6, pill: 6 }; // Big shapes (cards, panels, banners, buttons, inputs, sheets) use 6. Small shapes (chips, tags, bars) use 3 or 4. Only true circles (dots, avatars) stay round
export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 }; // font sizes

const hex = (h: string) => { const n = parseInt(h.slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
// mix(a, b, t): t = 0 gives a, t = 1 gives b
const mix = (a: string, b: string, t: number) => { const x = hex(a), y = hex(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const build = (b: Base): Theme => ({
  ...b,
  glass: !!b.glass,
  solid: b.solid ?? b.panel,
  back: b.back ?? b.bg,
  panel2: b.panel2 ?? mix(b.panel, b.dark ? '#FFFFFF' : b.text, b.dark ? 0.045 : 0.035),
  hair: b.hair ?? mix(b.panel, b.dark ? '#FFFFFF' : b.text, b.dark ? 0.08 : 0.08),
});

// Two themes only. Both sit on one colourful drifting backdrop (src/LiveBackdrop.web.tsx).
// Light = light, frosted glass content on the backdrop. Dark = dark glass content on the same backdrop.
// buy / sell / gold / poi stay as trading colours (green, red, amber, violet) so a buy never looks like a sell.
const BASE: Record<string, Base> = {
  light: { dark: false, glass: true, back: '#0B0724', bg: '#F4F6FF', panel: '#FFFFFFD6', solid: '#FFFFFF', panel2: '#1B2A5012', hair: '#1B2A5018', line: '#C9D2E8', text: '#0A1022', dim: '#2B364D', accent: '#2563EB', accent2: '#C026D3', onAccent: '#FFFFFF', buy: '#059669', sell: '#E11D48', gold: '#B7791F', poi: '#7C3AED' },
  dark: { dark: true, glass: true, back: '#070A1F', bg: '#0A0D26', panel: '#171C48DB', solid: '#171C48', panel2: '#FFFFFF1A', hair: '#FFFFFF26', line: '#FFFFFF40', text: '#FFFFFF', dim: '#C7D0EA', accent: '#60A5FA', accent2: '#22D3EE', onAccent: '#06102A', buy: '#34D399', sell: '#FB7185', gold: '#F8D06A', poi: '#C084FC' },
};

export const THEMES: Record<string, Theme> = Object.fromEntries(Object.entries(BASE).map(([k, v]) => [k, build(v)]));

// Anyone who still has one of the removed themes saved lands on the closest one: dark ones -> Dark, everything else -> Light.
const OLD_DARK = ['dark', 'royal', 'midnight', 'ocean', 'graphite', 'sunset', 'forest', 'glassNight', 'glassAurora', 'glassObsidian'];
export const themeId = (id?: string) => (id && THEMES[id] ? id : id && OLD_DARK.includes(id) ? 'dark' : 'light');
export const themeFor = (id?: string): Theme => THEMES[themeId(id)];

// Text colour that stays readable on top of a given background colour (price tags, chart labels, chips).
export const ink = (bg: string, light = '#FFFFFF', dark = '#0B1220') => {
  const [r, g, b] = hex(bg).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.38 ? dark : light;
};
