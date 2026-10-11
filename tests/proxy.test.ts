// @ts-nocheck  (uses Node http / Buffer; the app itself has no Node typings)
// The website's server proxy: allowlist, redirects, cache, size limit, CORS. Runs against a tiny local "upstream" server.
// @ts-ignore plain JS module
import makeProxy from '../server/proxy.js';
import http from 'http';
let fails = 0;
const ok = (c: unknown, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
let hitsUp = 0;
const up = http.createServer((req, res) => {
  hitsUp++;
  if (req.url === '/json') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{"a":1}'); }
  if (req.url === '/redir-bad') { res.writeHead(302, { location: 'http://evil.example/x' }); return res.end(); }
  if (req.url === '/big') { res.writeHead(200); return res.end(Buffer.alloc(3000)); }
  if (req.url === '/429') { res.writeHead(429); return res.end('slow down'); }
  res.writeHead(404); res.end();
}).listen(0, '127.0.0.1', async () => {
  const port = (up.address() as any).port;
  const proxy = makeProxy({ hosts: ['127.0.0.1'], allowHttp: true, maxBytes: 2000, perMin: 9 });
  const front = http.createServer(async (req, res) => { if (!(await proxy(req, res))) { res.writeHead(404); res.end('not proxy'); } }).listen(0, '127.0.0.1', async () => {
    const fp = (front.address() as any).port, call = (u: string) => fetch(`http://127.0.0.1:${fp}/proxy?u=${encodeURIComponent(u)}`);
    let r = await call(`http://127.0.0.1:${port}/json`);
    ok(r.status === 200 && (await r.json()).a === 1, 'allowed site is read and returned');
    ok(r.headers.get('access-control-allow-origin') === '*', 'browser (CORS) header is set');
    const before = hitsUp; await call(`http://127.0.0.1:${port}/json`); ok(hitsUp === before, 'second request is served from the 20 s cache');
    r = await call('http://localhost/json'); ok(r.status === 403, 'a site that is not on the list is refused');
    r = await call('https://example.com/'); ok(r.status === 403, 'another site is refused');
    r = await call('file:///etc/passwd'); ok(r.status === 403 || r.status === 400, 'file: address is refused');
    r = await call('not a url'); ok(r.status === 400, 'bad address gives 400');
    r = await call(`http://127.0.0.1:${port}/redir-bad`); ok(r.status === 502, 'redirect to a site that is not allowed is stopped');
    r = await call(`http://127.0.0.1:${port}/big`); ok(r.status === 502, 'answer over the size limit is refused');
    r = await call(`http://127.0.0.1:${port}/429`); ok(r.status === 429, "the site's own error status is passed on (so the app can say rate-limited)");
    r = await call(`http://127.0.0.1:${port}/json`); ok(r.status === 429, 'one visitor is limited to 120 per minute (9 in this test)');
    const o = await fetch(`http://127.0.0.1:${fp}/other`); ok(o.status === 404, 'other paths are left to the main server');
    console.log(fails ? `${fails} FAILED` : 'all proxy tests pass'); up.close(); front.close(); process.exit(fails ? 1 : 0);
  });
});
