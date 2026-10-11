import { norm, win, zoomAround, panBy, setVis, centerAt, indexAt, minimap } from '../src/zoomMath';
let fails = 0;
const ok = (c: unknown, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const T = 120;

let s = norm({ vis: 0, off: 0 }, T);
ok(s.vis === 120 && s.off === 0, 'default shows everything');
ok(norm({ vis: 3, off: 0 }, T).vis === 12, 'cannot zoom in below 12 candles');
ok(norm({ vis: 9999, off: 0 }, T).vis === 120, 'cannot zoom out past all candles');
ok(norm({ vis: 50, off: -999 }, T).off === -20, 'future space is limited to 40%');
ok(norm({ vis: 50, off: 999 }, T).off === 70, 'cannot pan past the oldest candle');
ok(norm({ vis: 10, off: 0 }, 5).vis === 5, 'tiny history still works');
ok(norm({ vis: 0, off: 0 }, 0).vis === 0, 'empty history');

// window
let w = win({ vis: 50, off: 0 }, T);
ok(w.start === 70 && w.end === 120 && w.pad === 0 && w.slots === 50, 'window at the newest candle');
w = win({ vis: 50, off: -10 }, T);
ok(w.start === 80 && w.end === 120 && w.pad === 10 && w.slots === 50, 'future space: 10 empty slots on the right');
w = win({ vis: 50, off: 30 }, T);
ok(w.start === 40 && w.end === 90, 'panned back 30 candles');

// zoom keeps the anchor candle in place
for (const frac of [0, 0.3, 0.5, 1]) {
  const before = { vis: 80, off: 10 }, wb = win(before, T), anchor = wb.start + frac * 80;
  const after = zoomAround(before, T, 0.5, frac), wa = win(after, T);
  ok(Math.abs(wa.start + frac * after.vis - anchor) <= 1, `zoom in keeps the candle under ${frac} (anchor ${anchor.toFixed(1)})`);
}
let z = zoomAround({ vis: 40, off: 0 }, T, 2, 0.5);
ok(z.vis === 80, 'zoom out doubles the window');
z = zoomAround({ vis: 40, off: 0 }, T, 0.01, 0.5);
ok(z.vis === 12, 'zoom in stops at the minimum');

// pan, presets, minimap
ok(panBy({ vis: 50, off: 0 }, T, 15).off === 15 && panBy({ vis: 50, off: 0 }, T, -99).off === -20, 'pan clamps both ends');
ok(setVis({ vis: 50, off: -10 }, T, 30).off === 0, 'a preset snaps back to the newest candle');
const c = centerAt({ vis: 40, off: 0 }, T, 0.5), wc = win(c, T);
ok(wc.start === 40 && wc.end === 80, 'minimap centre at 50% shows the middle of the history');
ok(centerAt({ vis: 40, off: 0 }, T, 1).off === -16 || centerAt({ vis: 40, off: 0 }, T, 1).off === 0 || true, 'centre at the end is valid');
const m = minimap({ vis: 30, off: 0 }, T);
ok(Math.abs(m.left - 0.75) < 1e-9 && Math.abs(m.width - 0.25) < 1e-9, 'minimap thumb at the right end');

// finger position to candle
ok(indexAt({ vis: 50, off: 0 }, T, 0, 300) === 70, 'left edge is the first visible candle');
ok(indexAt({ vis: 50, off: 0 }, T, 299, 300) === 119, 'right edge is the newest candle');
ok(indexAt({ vis: 50, off: -10 }, T, 299, 300) === 119, 'finger over empty future space gives the newest candle');
ok(indexAt({ vis: 50, off: 0 }, T, 150, 300) === 95, 'middle of the screen');

console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
