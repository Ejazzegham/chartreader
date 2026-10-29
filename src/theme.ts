export type Theme = {
  dark: boolean; bg: string; panel: string; line: string; text: string; dim: string;
  accent: string; accent2: string; onAccent: string; buy: string; sell: string; gold: string; poi: string;
  panel2: string; // raised surface: inputs, tiles and chips that sit ON a card
  hair: string;   // very soft divider, lighter than `line`
  glass: boolean;                       // glass themes: translucent panels over a gradient backdrop
  grad: [string, string, string];       // backdrop gradient (glass themes; flat themes repeat bg)
  orbs: [string, string, string];       // soft colour glows drawn on the backdrop (glass themes)
  solid: string;                        // opaque version of `panel`: bottom sheets and pop-ups must not be see-through
  sheen: number;                        // 0 to 1: a faint light across the top of the glass backdrop (the premium themes use it; 0 = none)
};
type Opt = 'panel2' | 'hair' | 'glass' | 'grad' | 'orbs' | 'solid' | 'sheen';
type Base = Omit<Theme, Opt> & Partial<Pick<Theme, Opt>>;

// Shared design tokens, so every screen uses the same spacing, corner and type scale.
export const R = { sm: 8, md: 8, lg: 8, xl: 8, inner: 8, box: 8, pill: 999 }; // ONE corner radius for the whole app: cards, panels, banners, buttons, inputs, chips and sheets all use 8. Only true circles (dots, avatars, count badges) stay round
export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };           // spacing scale
export const FS = { micro: 10, small: 12, body: 14, lead: 16, title: 20, hero: 28 }; // font sizes

const hex = (h: string) => { const n = parseInt(h.slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
// mix(a, b, t): t = 0 gives a, t = 1 gives b
const mix = (a: string, b: string, t: number) => { const x = hex(a), y = hex(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const build = (b: Base): Theme => ({
  ...b,
  glass: !!b.glass,
  grad: b.grad ?? [b.bg, b.bg, b.bg],
  orbs: b.orbs ?? [b.accent, b.accent2, b.accent],
  solid: b.solid ?? b.panel,
  sheen: b.sheen ?? 0,
  panel2: b.panel2 ?? mix(b.panel, b.dark ? '#FFFFFF' : b.text, b.dark ? 0.045 : 0.035),
  hair: b.hair ?? mix(b.panel, b.dark ? '#FFFFFF' : b.text, b.dark ? 0.08 : 0.08),
});

// Six themes, all glass: Glass Night, Glass Frost, Glass Aurora, Glass Rose and the two premium ones, Glass Obsidian (dark) and Glass Pearl (light).
// Glass = translucent panels (8-digit hex colours) over a gradient backdrop with soft colour glows (src/Glass.tsx). No native blur module, so it ships with a normal `eas update`.
// buy / sell / gold / poi stay as trading colours (green, red, amber, violet) so a buy never looks like a sell.
const BASE: Record<string, Base> = {
  glassNight: { dark: true, glass: true, bg: '#0A0F2C', grad: ['#2A1B6B', '#10307A', '#0A5A6B'], orbs: ['#7C5CFF', '#2FA8FF', '#18E0C0'], panel: '#26368AB0', solid: '#1D2B66', panel2: '#FFFFFF18', hair: '#FFFFFF26', line: '#FFFFFF40', text: '#F5F8FF', dim: '#D0D9F7', accent: '#4A82FF', accent2: '#A678FF', onAccent: '#FFFFFF', buy: '#34E3B5', sell: '#FF7390', gold: '#FAD068', poi: '#C3A8FF' },
  glassFrost: { dark: false, glass: true, bg: '#E6EEFB', grad: ['#CFE0FF', '#E4D9FF', '#CDEFE8'], orbs: ['#7AA7FF', '#B58CFF', '#5FD8C0'], panel: '#FFFFFFB8', solid: '#F6F9FF', panel2: '#FFFFFF8C', hair: '#8FA6D838', line: '#8FA6D85C', text: '#0B1B3F', dim: '#475B85', accent: '#2B63F0', accent2: '#7C45EC', onAccent: '#FFFFFF', buy: '#0C9A74', sell: '#D92D3F', gold: '#B27414', poi: '#7C3AED' },
  // Glass Aurora: deep ocean-teal backdrop with emerald, sky and violet light. Dark text sits on the bright sky accent.
  glassAurora: { dark: true, glass: true, bg: '#04141C', grad: ['#062A33', '#0B4048', '#1A2B63'], orbs: ['#14E3B0', '#3DB8FF', '#8B6CFF'], panel: '#0F3A4AA8', solid: '#0B2F3C', panel2: '#FFFFFF16', hair: '#BFF6FF22', line: '#BFF6FF3A', text: '#F2FCFF', dim: '#B5D8E2', accent: '#3DB8FF', accent2: '#8B7CFF', onAccent: '#04141E', buy: '#3EE6A5', sell: '#FF7A92', gold: '#F8D06A', poi: '#C2A8FF' },
  // Glass Rose: soft blush, lilac and sky light for the day. Orchid accent with white text.
  glassRose: { dark: false, glass: true, bg: '#F6E9F2', grad: ['#FFE0EA', '#EBDDFB', '#D9E8FF'], orbs: ['#FF9CBB', '#B79CFF', '#8CC4FF'], panel: '#FFFFFFB8', solid: '#FFF7FB', panel2: '#FFFFFF90', hair: '#B48ACC2E', line: '#B48ACC55', text: '#2A1236', dim: '#6A4F7C', accent: '#8E3FDB', accent2: '#D63D79', onAccent: '#FFFFFF', buy: '#0C9A74', sell: '#D92D3F', gold: '#A86A12', poi: '#7C3AED' },
  // Glass Obsidian (premium, dark): warm black glass with champagne-gold light and a hint of sapphire. Gold accent, dark text on the buttons.
  glassObsidian: { dark: true, glass: true, sheen: 0.07, bg: '#0B0A0E', grad: ['#1D150D', '#15121C', '#0A1520'], orbs: ['#D9A441', '#B8743A', '#3556C8'], panel: '#2C241EB4', solid: '#221C17', panel2: '#FFFFFF14', hair: '#F5E1B81C', line: '#F5E1B83C', text: '#FBF6EC', dim: '#CFC1A9', accent: '#DDB058', accent2: '#F2D89B', onAccent: '#1A1206', buy: '#3EE0A8', sell: '#FF7A8A', gold: '#F8D06A', poi: '#C9A8FF' },
  // Glass Pearl (premium, light): ivory and pearl glass with champagne and blush light. Sapphire navy accent with bronze-gold as the second colour.
  glassClean: { dark: false, bg: '#F5F7FA', panel: '#FFFFFF', solid: '#FFFFFF', panel2: '#F4F6FA', hair: '#EAEDF2', line: '#DFE4EC', text: '#0F1B33', dim: '#5B6780', accent: '#1E40AF', accent2: '#3A55B4', onAccent: '#FFFFFF', buy: '#13A06B', sell: '#E5484D', gold: '#D98A0B', poi: '#6D3FD0' }, // flat, bright: the website's default
  glassPearl: { dark: false, glass: true, sheen: 0.5, bg: '#F4F0EA', grad: ['#FBF2E3', '#ECEFF8', '#F5E3E5'], orbs: ['#E6C285', '#9DB2EA', '#E8A8B0'], panel: '#FFFFFFC4', solid: '#FFFDF9', panel2: '#FFFFFF96', hair: '#A08C6E2C', line: '#A08C6E56', text: '#1B1F33', dim: '#5C5E74', accent: '#27408B', accent2: '#9A6428', onAccent: '#FFFFFF', buy: '#0C9A74', sell: '#D92D3F', gold: '#A86A12', poi: '#6D3FD0' },
};

export const THEMES: Record<string, Theme> = Object.fromEntries(Object.entries(BASE).map(([k, v]) => [k, build(v)]));

// Anyone who still has the removed Dark Blue / Light theme (or an even older one) saved lands on the closest glass theme:
// dark ones -> Glass Night, light ones -> Glass Frost.
const OLD_DARK = ['dark', 'royal', 'midnight', 'ocean', 'graphite', 'sunset', 'forest'];
export const themeId = (id?: string) => (id && THEMES[id] ? id : id && OLD_DARK.includes(id) ? 'glassNight' : 'glassFrost');
export const themeFor = (id?: string): Theme => THEMES[themeId(id)];

// Text colour that stays readable on top of a given background colour (price tags, chart labels, chips).
export const ink = (bg: string, light = '#FFFFFF', dark = '#0B1220') => {
  const [r, g, b] = hex(bg).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.38 ? dark : light;
};
