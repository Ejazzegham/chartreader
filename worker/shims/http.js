// A stand-in for Node's `http`: server.js calls http.createServer(handler). The Durable Object feeds each incoming Request to that handler
// through a Node-style request / response pair and turns what the handler writes back into a Response.
let handler = null;
exports.createServer = (h) => { handler = h; return { listen(_port, cb) { if (cb) queueMicrotask(cb); return this; }, close() {} }; };

class Req {
  constructor(request, ip) {
    this.method = request.method;
    const u = new URL(request.url); this.url = u.pathname + u.search;
    this.headers = {}; request.headers.forEach((v, k) => { this.headers[k.toLowerCase()] = v; });
    this.socket = { remoteAddress: ip || '' };
    this._body = request.body; this._used = false;
  }
  async *[Symbol.asyncIterator]() {
    if (!this._body || this._used) return; this._used = true;
    const rd = this._body.getReader();
    try { for (;;) { const { done, value } = await rd.read(); if (done) break; yield Buffer.from(value); } } finally { try { rd.releaseLock(); } catch {} }
  }
  async buffer(limit = Infinity) { const parts = []; let n = 0; for await (const c of this) { n += c.length; if (n > limit) throw Object.assign(new Error('Too large'), { status: 413 }); parts.push(c); } return Buffer.concat(parts); }
  resume() { this._used = true; try { this._body && this._body.cancel(); } catch {} }
  destroy() { this.resume(); }
  on() { return this; } once() { return this; }
}
class Res {
  constructor(head) {
    this.status = 200; this.headers = new Headers(); this.chunks = []; this.head = head;
    this.done = new Promise((r) => { this._r = r; });
  }
  writeHead(code, h = {}) { this.status = code; for (const [k, v] of Object.entries(h)) this.headers.set(k, String(v)); return this; }
  setHeader(k, v) { this.headers.set(k, String(v)); }
  write(c) { if (c != null) this.chunks.push(typeof c === 'string' ? Buffer.from(c) : c); return true; }
  end(c) { this.write(c); const body = Buffer.concat(this.chunks); const bodyless = this.status === 204 || this.status === 304 || this.head; this._r(new Response(bodyless ? null : body, { status: this.status, headers: this.headers })); }
  destroy() { this.end(); }
  on() { return this; } once() { return this; }
}
exports.__handle = async (request, ip) => {
  if (!handler) throw new Error('server not started');
  const res = new Res(request.method === 'HEAD');
  Promise.resolve(handler(new Req(request, ip), res)).catch((e) => { try { res.writeHead(500, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); res.end(JSON.stringify({ error: 'Server error: ' + e.message })); } catch {} });
  return res.done;
};
