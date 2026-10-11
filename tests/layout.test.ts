import { layoutFor, SIDEBAR_W, RAIL_W, PHONE_MAX } from '../src/win.web';
let fails = 0;
const ok = (c: unknown, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };

let L = layoutFor(390); ok(L.mode === 'phone' && L.content === 390 && L.sidebar === 0 && L.rail === 0, 'phone browser: phone layout, full width');
L = layoutFor(768); ok(L.mode === 'phone' && L.content === PHONE_MAX, `tablet: phone layout in a ${PHONE_MAX}px column`);
L = layoutFor(899); ok(L.mode === 'phone', '899 px is still the phone layout');
L = layoutFor(900); ok(L.mode === 'desktop' && L.sidebar === SIDEBAR_W && L.rail === 0, '900 px: desktop with sidebar, no right panel yet');
ok(L.content >= 560 && L.content <= 900 - SIDEBAR_W, `900 px: page fits next to the sidebar (${L.content})`);
L = layoutFor(1280); ok(L.rail === RAIL_W && L.content === 1280 - SIDEBAR_W - RAIL_W, `1280 px: sidebar + page + market watch (${L.content})`);
L = layoutFor(1920); ok(L.content === 980 && L.sidebar + L.content + L.rail <= 1920, 'big monitor: page stops at 980 px and is centred');
for (const w of [900, 1000, 1100, 1239, 1240, 1366, 1440, 1600, 1920, 2560]) {
  const l = layoutFor(w); ok(l.sidebar + l.content + l.rail <= w || l.content === 560, `${w} px: sidebar + page + panel fit in the window`);
}
console.log(fails ? `${fails} FAILED` : 'all layout tests pass'); process.exit(fails ? 1 : 0);
