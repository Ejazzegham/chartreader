// A tiny stand-in for Node's `fs`, backed by the Durable Object's SQLite key-value storage.
// Small files (db.json, alerts, community, visits, sync backups) live in memory AND in storage; anything under a ".media" folder is
// read from storage only when needed (photos / videos of the support chat), so memory stays small.
// A value is split into 1 MB pieces because one storage value may not be larger than 2 MB.
const CHUNK = 1024 * 1024;
const V = () => { if (!globalThis.__VFS) throw new Error('storage not ready'); return globalThis.__VFS; };
const norm = (p) => String(p).replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+/g, '/');
const lazy = (k) => k.includes('.media/');
const volatile = (k) => k.endsWith('.tmp') || k.endsWith('.part');
const enoent = (p) => Object.assign(new Error(`ENOENT: no such file or directory, '${p}'`), { code: 'ENOENT' });

function kvPut(k, data) {
  const { kv } = V();
  const buf = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const isStr = typeof data === 'string', n = Math.max(1, Math.ceil(buf.length / CHUNK));
  const old = kv.get('m:' + k);
  kv.put('m:' + k, { n, len: buf.length, str: isStr, at: Date.now() });
  for (let i = 0; i < n; i++) kv.put(`d:${k}#${i}`, buf.slice(i * CHUNK, (i + 1) * CHUNK));
  if (old) for (let i = n; i < old.n; i++) kv.delete(`d:${k}#${i}`);
}
function kvGet(k) {
  const { kv } = V(), m = kv.get('m:' + k);
  if (!m) return undefined;
  const out = new Uint8Array(m.len); let o = 0;
  for (let i = 0; i < m.n; i++) { const c = kv.get(`d:${k}#${i}`); if (c) { const u = c instanceof Uint8Array ? c : new Uint8Array(c); out.set(u, o); o += u.length; } }
  return m.str ? new TextDecoder().decode(out) : Buffer.from(out);
}
function kvDel(k) {
  const { kv } = V(), m = kv.get('m:' + k);
  if (!m) return;
  for (let i = 0; i < m.n; i++) kv.delete(`d:${k}#${i}`);
  kv.delete('m:' + k);
}
// Called once when the Durable Object wakes up: loads every small file into memory.
exports.__load = (kv) => {
  const files = new Map(), meta = new Map();
  for (const [key, m] of kv.list({ prefix: 'm:' })) {
    const k = key.slice(2); meta.set(k, m);
    if (!lazy(k)) { globalThis.__VFS = { kv, files, meta }; files.set(k, kvGet(k)); }
  }
  globalThis.__VFS = { kv, files, meta };
};
exports.readFileSync = (p, enc) => {
  const k = norm(p), { files } = V();
  let v = lazy(k) ? kvGet(k) : files.get(k);
  if (v === undefined) throw enoent(p);
  if (enc) return typeof v === 'string' ? v : Buffer.from(v).toString(typeof enc === 'string' ? enc : enc.encoding || 'utf8');
  return typeof v === 'string' ? Buffer.from(v) : v;
};
exports.writeFileSync = (p, data) => {
  const k = norm(p), { files, meta } = V();
  if (data && typeof data !== 'string' && !(data instanceof Uint8Array)) data = Buffer.from(data);
  if (!lazy(k)) files.set(k, data);
  if (!volatile(k)) { kvPut(k, data); meta.set(k, { len: data.length }); }
  else if (lazy(k)) files.set(k, data); // a half-uploaded file waits in memory
};
exports.renameSync = (a, b) => {
  const ka = norm(a), kb = norm(b), { files, meta } = V();
  const v = files.has(ka) ? files.get(ka) : kvGet(ka);
  if (v === undefined) throw enoent(a);
  files.delete(ka); if (!volatile(ka)) { kvDel(ka); meta.delete(ka); }
  exports.writeFileSync(kb, v);
};
exports.unlinkSync = (p) => { const k = norm(p), { files, meta } = V(); const had = files.delete(k) || meta.delete(k); kvDel(k); if (!had) throw enoent(p); };
exports.existsSync = (p) => { const k = norm(p), { files, meta } = V(); return files.has(k) || meta.has(k); };
exports.mkdirSync = () => {};
exports.statSync = (p) => { const k = norm(p), { files, meta } = V(); const m = meta.get(k); if (m) return { size: m.len, mtimeMs: m.at || Date.now() }; const v = files.get(k); if (v === undefined) throw enoent(p); return { size: v.length, mtimeMs: Date.now() }; };
exports.readdirSync = (d) => { const pre = norm(d).replace(/\/?$/, '/'), { files, meta } = V(), out = new Set(); for (const k of [...files.keys(), ...meta.keys()]) if (k.startsWith(pre)) out.add(k.slice(pre.length).split('/')[0]); return [...out]; };
exports.__list = () => { const { files, meta } = V(); return [...new Set([...files.keys(), ...meta.keys()])]; };
exports.promises = {};
