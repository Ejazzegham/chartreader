import { clampZ, windowF, zoomAroundF, pinchF, panByF, centerAtF, indexAtF, minimapF, lerpZ, rubber, stepMotion, velocityOf, niceTicks, niceEvery, offRange, easeToward } from '../src/smoothZoom';
let fails = 0;
const ok = (c: unknown, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e;
const T = 200, W = 300;

ok(clampZ({ vis: 2, off: 0 }, T).vis === 6, 'cannot zoom closer than 6 candles');
ok(clampZ({ vis: 9999, off: 0 }, T).vis === 200, 'cannot zoom out past all candles');
ok(near(clampZ({ vis: 100, off: -999 }, T).off, -45), 'future space limited to 45%');
ok(near(clampZ({ vis: 100, off: 999 }, T).off, 100), 'cannot pan past the oldest candle');
ok(clampZ({ vis: 10, off: 0 }, 0).vis === 0, 'empty history');
ok(clampZ({ vis: NaN, off: NaN }, T).vis === 200, 'NaN falls back to everything');
ok(Math.abs(clampZ({ vis: 63.42, off: 3.7 }, T).vis - 63.42) < 1e-9, 'vis keeps its fraction (no rounding)');

// X(i) formula matches the exact geometry for fractional states
const s = { vis: 63.42, off: 3.7 }, w = windowF(s, T, W);
const X = (i: number) => (i - w.start) * w.step + w.step / 2 + w.shift;
ok(near(X(T - 1), (T - 1 - w.startF + 0.5) * w.step), 'X(i) with shift equals exact position');
ok(w.start <= w.startF && w.end >= w.endF - 1e-9 && w.end - w.start <= Math.ceil(w.vis) + 1, 'window includes the partly visible edge candles');
ok(near(X(T - 1) + w.step / 2, W + w.off * w.step), 'newest candle ends where off says');

// the point under the finger does not move, for many fractional zooms
for (const f of [0, 0.31, 0.5, 0.87, 1]) for (const k of [0.97, 0.8, 1.13, 0.4]) {
  const b = { vis: 80.5, off: 7.25 }, wb = windowF(b, T, W), anchor = wb.startF + f * b.vis;
  const a = zoomAroundF(b, T, k, f), wa = windowF(a, T, W);
  if (a.vis > 6.001 && a.vis < 199.9 && a.off > -a.vis * 0.45 + 1e-6 && a.off < T - a.vis - 1e-6)
    ok(near(wa.startF + f * a.vis, anchor, 1e-6), `zoom x${k} keeps the point under ${f}`);
}
// pinch with moving fingers: anchor follows the focal point
{
  const b = { vis: 100, off: 10 }, wb = windowF(b, T, W), anchor = wb.startF + 0.5 * 100;
  const a = pinchF(b, T, 0.5, 0.5, 0.7), wa = windowF(a, T, W);
  ok(near(wa.startF + 0.7 * a.vis, anchor, 1e-6), 'pinch + pan: candle follows the moving fingers');
}
// zooming in and back out returns to the same state
{ const b = { vis: 90, off: 5 }, r = zoomAroundF(zoomAroundF(b, T, 0.6, 0.4), T, 1 / 0.6, 0.4); ok(near(r.vis, 90, 1e-6) && near(r.off, 5, 1e-6), 'zoom in then out is reversible'); }
ok(panByF({ vis: 50, off: 0 }, T, 15.5).off === 15.5, 'pan keeps fractions');
ok(near(panByF({ vis: 50, off: 0 }, T, -99).off, -22.5), 'pan clamps future space');
{ const c = centerAtF({ vis: 40, off: 0 }, T, 0.5), wc = windowF(c, T, W); ok(near(wc.startF, 80) && near(wc.endF, 120), 'minimap centre'); }
ok(indexAtF({ vis: 100, off: 0 }, T, W - 0.1, W) === 199 && indexAtF({ vis: 100, off: 0 }, T, 0, W) === 100, 'indexAt at both edges');
{ const m = minimapF({ vis: 50, off: 0 }, T); ok(near(m.left, 0.75) && near(m.width, 0.25), 'minimap thumb'); }
{ const l = lerpZ({ vis: 100, off: 0 }, { vis: 25, off: 10 }, 0.5); ok(near(l.vis, 50) && near(l.off, 5), 'geometric zoom tween'); }
{ const r = offRange(100, T); ok(near(r.lo, -45) && near(r.hi, 100), 'offRange'); }

// rubber band
ok(rubber(5, 0, 10, 20) === 5, 'inside limits untouched');
ok(rubber(-50, 0, 10, 20) < 0 && rubber(-50, 0, 10, 20) > -20, 'rubber band resists past the end');
ok(rubber(-100, 0, 10, 20) < rubber(-50, 0, 10, 20), 'and keeps resisting more');

// inertia glides then stops; past the end it springs back inside
{
  let m = { off: 50, v: 0.05 }, n = 0, done = false;
  while (!done && n < 2000) { const r = stepMotion(m, 16, 0, 100); m = r.m; done = r.done; n++; }
  ok(done && n < 400 && m.off > 50 && m.off < 100, `glide stops by itself (${n} frames, off ${m.off.toFixed(1)})`);
  m = { off: 99, v: 0.2 }; n = 0; done = false; let peak = 0;
  while (!done && n < 2000) { const r = stepMotion(m, 16, 0, 100); m = r.m; done = r.done; peak = Math.max(peak, m.off); n++; }
  ok(done && m.off <= 100 && m.off >= 99.9 && peak > 100, `flick past the end bounces back (peak ${peak.toFixed(2)}, frames ${n})`);
  const big = stepMotion({ off: 50, v: 0.05 }, 500, 0, 100); ok(big.m.off - 50 < 0.05 * 34 + 1e-9, 'a long frame is capped (no jump)');
}
ok(near(velocityOf([{ t: 0, off: 0 }, { t: 50, off: 5 }, { t: 100, off: 10 }], 100), 0.1), 'velocity from samples');
ok(velocityOf([{ t: 0, off: 0 }], 10) === 0 && velocityOf([{ t: 0, off: 0 }, { t: 5, off: 3 }], 1000) === 0, 'old / single samples give 0');
ok(near(easeToward(0, 10, 16, 80), 10 * (1 - Math.exp(-0.2))), 'easeToward');

// ticks
{
  const t = niceTicks(3840.6, 3883.1, 6);
  ok(t.length >= 4 && t.length <= 10 && t.every((v) => v >= 3840.6 && v <= 3883.1), `nice ticks inside range (${t.join(', ')})`);
  const d = t[1] - t[0]; ok([1, 2, 5, 10].some((q) => near(d, q) || near(d, q / 10) || near(d, q * 10)), 'step is 1/2/5');
  ok(niceTicks(1, 1).length === 0 && niceTicks(NaN, 3).length === 0, 'degenerate range');
  ok(niceEvery(3, 60) === 20 && niceEvery(40, 60) === 2 && niceEvery(100, 60) === 1, 'time label spacing');
}
console.log(fails ? `\n${fails} FAILED` : '\nall passed'); process.exit(fails ? 1 : 0);
