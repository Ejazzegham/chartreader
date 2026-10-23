// Turns the app's own analysis code (src/refine.ts and what it uses) into plain JavaScript for the server, so the
// background scanner scores setups with exactly the same maths as the app. Run:  node build-analysis.js   (needs `typescript`, already a devDependency)
const fs = require('fs'), path = require('path');
let ts; try { ts = require('typescript'); } catch { ts = require(path.join(__dirname, '../node_modules/typescript')); }
const SRC = path.join(__dirname, '../src'), OUT = path.join(__dirname, 'analysis');
const seen = new Set();
const SKIP = new Set(['net', 'license']); // phone / website only (net.ts uses react-native); the server gets a plain-fetch stand-in below
SKIP.forEach((f) => seen.add(f));
const go = (f) => {
  if (seen.has(f)) return; seen.add(f);
  const code = fs.readFileSync(path.join(SRC, f + '.ts'), 'utf8');
  for (const m of code.matchAll(/^(?:import|export) (?!type)[^'"]*from '\.\/(\w+)'/gm)) go(m[1]);
};
['refine', 'fallback', 'crypto', 'entry', 'verdict', 'session'].forEach(go); // analysis maths + the price / candle sources the app already uses
fs.mkdirSync(OUT, { recursive: true });
for (const f of seen) {
  if (SKIP.has(f)) continue;
  const code = fs.readFileSync(path.join(SRC, f + '.ts'), 'utf8');
  const js = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  fs.writeFileSync(path.join(OUT, f + '.js'), js);
}
fs.writeFileSync(path.join(OUT, 'net.js'), "// server stand-in for src/net.ts: the server is not a browser, so it reads the sites directly\nexports.xfetch = (url, init) => fetch(url, init);\n");
console.log('built ' + seen.size + ' files into server/analysis: ' + [...seen].join(', '));
