// Builds public/world-map.json (country shapes for the signup map). Optional: the finished file is already in the project.
// Run only if you want to rebuild it:   npm i --no-save world-atlas topojson-client d3-geo i18n-iso-countries && node scripts/build-world-map.js
const fs = require('fs'), path = require('path');
const topo = require('topojson-client'), simp = require('topojson-simplify'), d3 = require('d3-geo'), iso = require('i18n-iso-countries');
let world = JSON.parse(fs.readFileSync(require.resolve('world-atlas/countries-50m.json'), 'utf8'));
const SIMPLIFY = Number(process.env.SIMPLIFY || 0.85); // 0 to 1: higher = simpler shapes and a smaller file
const pre = simp.presimplify(world);
world = simp.simplify(pre, simp.quantile(pre, 1 - SIMPLIFY)); // borders stay shared between neighbours, tiny wiggles are removed
const W = 1000, TOP = 84, BOTTOM = -57; // crop the sphere: no Antarctica, so the countries get more room
const proj = d3.geoEqualEarth().fitWidth(W, { type: 'Sphere' });
const y0 = proj([0, TOP])[1], y1 = proj([0, BOTTOM])[1], H = Math.round((y1 - y0) * 10) / 10;
proj.translate([proj.translate()[0], proj.translate()[1] - y0]);
const r1 = (n) => Math.round(n * 10) / 10;
const gp = d3.geoPath(proj).digits(1);
const EXTRA = { Kosovo: 'XK' }; // no numeric id in the data
const out = {}, feats = topo.feature(world, world.objects.countries).features;
for (const f of feats) {
  const id = f.id != null ? String(f.id).padStart(3, '0') : '';
  const cc = (id && iso.numericToAlpha2(id)) || EXTRA[f.properties.name];
  if (!cc || id === '010') continue; // skip Antarctica and shapes without a country code
  const d = gp(f); if (!d) continue;
  const polys = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates.map((c) => ({ type: 'Polygon', coordinates: c })) : [f.geometry];
  let best = null, bestA = -1;
  for (const g of polys) { const a = gp.area(g); if (a > bestA) { bestA = a; best = g; } }
  const [[a, b], [c, e]] = gp.bounds(best);
  if (gp.area(best) < 0.15 && polys.length === 1) { /* keep tiny single-island countries so they can still be selected */ }
  out[cc] = { n: f.properties.name, d, b: [r1(a), r1(b), r1(c), r1(e)] };
}
const [tx, ty] = proj.translate();
const json = { v: 1, w: W, h: H, p: { s: proj.scale(), tx: r1(tx * 1000) / 1000, ty: r1(ty * 1000) / 1000 }, c: out };
fs.writeFileSync(path.join(process.env.OUT || path.join(__dirname, '..', 'public'), 'world-map.json'), JSON.stringify(json));
console.log(Object.keys(out).length + ' countries, ' + Math.round(JSON.stringify(json).length / 1024) + ' KB, map ' + W + 'x' + H);
