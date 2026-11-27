// The Durable Object: ONE instance runs your whole old server (server/server.js) inside Cloudflare. It keeps the database in memory,
// saves it to its own storage after every request, and runs the background alerts / scanner from alarms (a Worker has no setInterval).
import { DurableObject } from 'cloudflare:workers';
import fsShim from '../shims/fs.js';
import httpShim from '../shims/http.js';

// Workers cannot call `new WebSocket()` to an outside server the Node way; they open it with fetch + Upgrade. Same API for alerts.js (Deriv price feed).
const sockets = new Set();
class FetchWS {
  constructor(url) {
    this.url = url; this.readyState = 0; this.onopen = this.onmessage = this.onclose = this.onerror = null; sockets.add(this);
    (async () => {
      try {
        const r = await fetch(url.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:'), { headers: { Upgrade: 'websocket' } });
        const ws = r.webSocket; if (!ws) throw new Error('no websocket');
        ws.accept(); this._ws = ws; this.readyState = 1;
        ws.addEventListener('message', (e) => this.onmessage && this.onmessage({ data: e.data }));
        ws.addEventListener('close', () => { this.readyState = 3; sockets.delete(this); this.onclose && this.onclose({}); });
        ws.addEventListener('error', () => this.onerror && this.onerror({}));
        this.onopen && this.onopen({});
      } catch (e) { this.readyState = 3; sockets.delete(this); this.onerror && this.onerror(e); this.onclose && this.onclose({}); }
    })();
  }
  send(d) { this._ws.send(d); }
  close() { try { this._ws && this._ws.close(1000, 'done'); } catch {} this.readyState = 3; sockets.delete(this); }
}
const TICK_MS = 10000;

export class Hub extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.lastHourly = Date.now();
    this.booting = null;
  }
  // The server code starts on the first REAL request, not when the object is created, so the one-time data import can run before it.
  boot() {
    return (this.booting ||= this.ctx.blockConcurrencyWhile(async () => {
      for (const [k, v] of Object.entries(this.env)) if (typeof v === 'string') process.env[k] = v;
      fsShim.__load(this.ctx.storage.kv);
      globalThis.WebSocket = FetchWS;
      await import('./server/server.js'); // reads the saved database, registers the request handler
    }));
  }

  flushAll() {
    for (const f of globalThis.__flushers || []) { try { f(); } catch {} }
    try { globalThis.__CR && globalThis.__CR.alerts.flush(); } catch {}
    if (Date.now() - this.lastHourly > 36e5) { this.lastHourly = Date.now(); for (const f of globalThis.__hourly || []) { try { f(); } catch {} } }
  }
  async arm() {
    const cr = globalThis.__CR;
    if (cr && cr.alerts.active() && (await this.ctx.storage.getAlarm()) == null) await this.ctx.storage.setAlarm(Date.now() + TICK_MS);
  }
  async alarm() {
    await this.boot();
    try { if (globalThis.__CR) await globalThis.__CR.alerts.tick(); } catch (e) { console.log('tick failed: ' + e.message); }
    for (const s of [...sockets]) s.close(); // never keep a socket open between alarms
    this.flushAll(); await this.arm();
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/__import') return this.importData(request); // before boot(): the server must not be running yet
    await this.boot();
    if (url.pathname === '/__wake') { await this.arm(); return new Response('ok'); }
    const res = await httpShim.__handle(request, request.headers.get('cf-connecting-ip') || '');
    this.flushAll(); await this.arm();
    return res;
  }

  // One-time copy of your old server's files (db.json, *.sync/*, *.alerts.json, ...) into this Durable Object. Protected by the IMPORT_SECRET secret.
  async importData(request) {
    const secret = this.env.IMPORT_SECRET || '';
    if (!secret || request.headers.get('x-import-secret') !== secret) return new Response('Not found', { status: 404 });
    // Only before the server has started: an import into a running server would be overwritten by what it holds in memory.
    if (this.booting || globalThis.__CR) return Response.json({ error: 'The server is already running, so importing now could overwrite live data. The import is a one-time step done right after the first deploy.' }, { status: 409 });
    const { files = {} } = await request.json();
    let n = 0;
    fsShim.__load(this.ctx.storage.kv);
    for (const [path, v] of Object.entries(files)) { fsShim.writeFileSync(path, v.b64 ? Buffer.from(v.b64, 'base64') : v.text); n++; }
    return Response.json({ ok: true, files: n });
  }
}
