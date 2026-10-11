import { frame, makeLayout, cd, bucketHex, BUCKETS, Vr, N } from '../src/splashMath';
let fails = 0;
const ok = (c: unknown, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };

for (const [W, H, ti, bi] of [[360, 640, 24, 0], [390, 844, 47, 34], [430, 932, 54, 34], [320, 568, 20, 0]]) {
  const L = makeLayout(W, H, ti, bi);
  ok(L.y1 - L.y0 >= 100 && L.y0 > L.top + L.lh, `layout ${W}x${H}: chart sits below the logo and has room`);
  const vr: Vr = { lo: 0, hi: 0, set: false, t: 0 };
  let bad = 0, maxCandles = 0, last = '';
  for (let t = 0; t <= 20000; t += 16) {
    const f = frame(t, L, vr);
    const s = JSON.stringify(f);
    if (/NaN|Infinity|null/.test(s)) bad++;
    maxCandles = Math.max(maxCandles, (f.bodyUp.match(/z/g) || []).length + (f.bodyDn.match(/z/g) || []).length);
    last = f.tag.txt;
  }
  ok(bad === 0, `${W}x${H}: 20 s of frames have no NaN / Infinity`);
  ok(maxCandles <= N + 14 && maxCandles >= N - 2, `${W}x${H}: about ${N} candles on screen (${maxCandles})`);
  ok(/^\d+\.\d\d$/.test(last), `${W}x${H}: live price tag is formatted (${last})`);
}
// price keeps moving up AND down over time (not a one-way script)
const closes = Array.from({ length: 400 }, (_, i) => cd(i).c);
const ups = closes.filter((c, i) => i && c > closes[i - 1]).length;
ok(ups > 150 && ups < 250, `price rises and falls (${ups} up of 399)`);
ok(closes.every((c) => c > 70 && c < 130), 'price stays in a sane range');
ok(Array.from({ length: 400 }, (_, i) => cd(i)).every((c) => c.h >= Math.max(c.o, c.c) && c.l <= Math.min(c.o, c.c)), 'wicks always cover the body');
ok(Array.from({ length: BUCKETS }, (_, b) => bucketHex(b)).every((h) => /^#[0-9a-f]{6}$/.test(h)), 'streak colours are valid hex');
// 20 flowing lines (10 per side)
const f0 = frame(3000, makeLayout(390, 844, 47, 34), { lo: 0, hi: 0, set: false, t: 0 });
ok(f0.flow.length === 20 && f0.flow.filter((s) => s.z === 0).length === 10, '10 lines on each side of the logo');
ok(f0.flow.every((s) => s.y >= 47 && s.y <= 47 + 300), 'flowing lines stay in the logo area');
console.log(fails ? `${fails} FAILED` : 'all splash tests pass');
process.exit(fails ? 1 : 0);
