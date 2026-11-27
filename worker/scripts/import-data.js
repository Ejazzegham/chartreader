// Copies the data of your OLD server into the Worker (one time).
//   node scripts/import-data.js <old server folder, e.g. ../server> <worker url, e.g. https://chart-reader-api.YOURNAME.workers.dev> <IMPORT_SECRET>
// Reads db.json, db.json.sync/*, db.json.alerts.json, db.json.visits.json, db.json.community.json and db.json.media/*.
const fs = require('fs'), path = require('path');
const [dir, url, secret] = process.argv.slice(2);
if (!dir || !url || !secret) { console.log('usage: node scripts/import-data.js <old server folder> <worker url> <IMPORT_SECRET>'); process.exit(1); }
const files = {};
const add = (rel, binary) => { const f = path.join(dir, rel); if (!fs.existsSync(f)) return; files[rel] = binary ? { b64: fs.readFileSync(f).toString('base64') } : { text: fs.readFileSync(f, 'utf8') }; };
for (const f of ['db.json', 'db.json.alerts.json', 'db.json.visits.json', 'db.json.community.json']) add(f, false);
for (const sub of ['db.json.sync', 'db.json.media']) { const d = path.join(dir, sub); if (fs.existsSync(d)) for (const n of fs.readdirSync(d)) if (!n.endsWith('.part') && !n.endsWith('.tmp')) add(sub + '/' + n, sub.endsWith('media')); }
const keys = Object.keys(files); if (!files['db.json']) { console.log('db.json not found in ' + dir); process.exit(1); }
(async () => {
  // several small requests: one request may not be too big
  let batch = {}, size = 0, sent = 0;
  const flush = async () => { if (!Object.keys(batch).length) return; const r = await fetch(url.replace(/\/$/, '') + '/__import', { method: 'POST', headers: { 'content-type': 'application/json', 'x-import-secret': secret }, body: JSON.stringify({ files: batch }) }); const t = await r.text(); if (!r.ok) throw new Error('import failed: HTTP ' + r.status + ' ' + t); sent += Object.keys(batch).length; batch = {}; size = 0; };
  // db.json goes LAST so a half-finished import never leaves a database without its files
  for (const k of keys.filter((k) => k !== 'db.json')) { const n = JSON.stringify(files[k]).length; if (size + n > 8e6) await flush(); batch[k] = files[k]; size += n; }
  await flush(); batch = { 'db.json': files['db.json'] }; await flush();
  console.log(`done: ${sent} files imported (${keys.length} found)`);
})().catch((e) => { console.log(e.message); process.exit(1); });
