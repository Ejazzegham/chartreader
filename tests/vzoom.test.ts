import { VZ0, normV, applyV, zoomV, panV, thumb, fromThumbTop, fromThumbCenter, panByPixels, isFit, K_MIN, K_MAX } from '../src/vzoomMath';
let fails = 0;
const ok = (c: unknown, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const near = (a: number, b: number, e = 1e-9) => Math.abs(a - b) < e;

let r = applyV(100, 110, VZ0);
ok(near(r.lo, 100) && near(r.hi, 110), 'fit state keeps the fitted range');
ok(isFit(VZ0) && !isFit({ k: 2, c: 0 }), 'fit detection');
r = applyV(100, 110, { k: 2, c: 0 });
ok(near(r.hi - r.lo, 5) && near((r.hi + r.lo) / 2, 105), 'zoom 2x shows half the range around the middle');
r = applyV(100, 110, { k: 0.5, c: 0 });
ok(near(r.hi - r.lo, 20), 'zoom 0.5x shows twice the range');
ok(normV({ k: 999, c: 0 }).k === K_MAX && normV({ k: 0, c: 0 }).k === K_MIN && normV({ k: NaN, c: NaN }).k === 1, 'zoom is limited and NaN safe');
ok(Math.abs(normV({ k: 1, c: 5 }).c) <= 0.35 + 1e-9, 'cannot scroll far away from the candles');

// zoom keeps the price under the finger fixed
for (const f of [0, 0.3, 0.5, 0.9]) {
  const v0 = { k: 1.7, c: 0.1 }, a0 = applyV(100, 110, v0), p0 = a0.hi - f * (a0.hi - a0.lo);
  const v1 = zoomV(v0, 2.2, f), a1 = applyV(100, 110, v1), p1 = a1.hi - f * (a1.hi - a1.lo);
  ok(near(p0, p1, 1e-6), `price under the finger stays fixed when zooming (anchor ${f})`);
}
// scroll bar
let t = thumb(VZ0);
ok(t.size < 1 && t.size > 0.5 && near(t.top, (1 - t.size) / 2), 'at fit the thumb sits in the middle of the track');
const z4 = { k: 4, c: 0 }; t = thumb(z4);
ok(t.size < thumb(VZ0).size, 'zoomed in = smaller thumb');
const top = fromThumbTop(z4, 0), bot = fromThumbTop(z4, 1);
ok(top.c > 0 && bot.c < 0 && near(top.c, -bot.c), 'thumb to the top shows higher prices, to the bottom lower prices');
ok(near(thumb(top).top, 0, 1e-6) && near(thumb(bot).top + thumb(bot).size, 1, 1e-6), 'thumb position round-trips');
const mid = fromThumbCenter(z4, 0.5);
ok(near(mid.c, 0, 1e-9), 'tap in the middle centres the window');
ok(near(fromThumbTop(z4, 0.3).k, 4), 'dragging the thumb keeps the zoom');
const dn = panByPixels(z4, 40, 300);
ok(dn.c > 0, 'dragging down shows higher prices');
ok(panV(z4, 100).c <= 0.85 - 0.5 / 4 + 1e-9, 'pan is clamped');
console.log(fails ? `${fails} FAILED` : 'vertical zoom test passed');
process.exit(fails ? 1 : 0);
