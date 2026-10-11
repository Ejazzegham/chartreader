import { analyzeAll } from '../src/refine';
let seed = 3; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
let p = 100; const t0 = 1_760_000_000;
const c = Array.from({ length: 260 }, (_, i) => { const o = p; p += Math.sin(i / 14) * 0.35 + (rnd() - 0.5) * 0.5; return { t: t0 + i * 900, o, c: p, h: Math.max(o, p) + rnd() * 0.3, l: Math.min(o, p) - rnd() * 0.3 }; });
const r = analyzeAll(c, new Date('2026-10-05T13:00:00Z'));
console.log(r.combo ? [r.combo.side, r.combo.score, r.combo.grade] : r.why, r.confirm);
console.log(r.combo?.checks.map((x) => (x.ok ? '✓ ' : '○ ') + x.text).join('\n'));
