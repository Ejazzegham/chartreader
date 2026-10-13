// Read-only proxy for the website. Browsers block most third-party sites (CORS), so the website asks this server
// (GET /proxy?u=<https url>) and the server reads the page for it. Only the sites listed below are allowed, over https,
// so it cannot be used to reach anything else. Answers are cached for 20 s and each visitor gets 240 requests per minute.
const HOSTS = [
  'query1.finance.yahoo.com', 'query2.finance.yahoo.com',   // backup prices (forex, metals, DXY, crypto)
  'nfs.faireconomy.media',                                  // economic calendar
  'api.alternative.me',                                     // fear & greed
  'min-api.cryptocompare.com', 'www.coindesk.com', 'cointelegraph.com', 'news.google.com', 'www.fxstreet.com', 'www.investing.com', // headlines
];
const UA = 'Mozilla/5.0 (compatible; ChartReader/1.0)';

module.exports = function makeProxy({ hosts = HOSTS, allowHttp = false, ttl = 20e3, maxBytes = 2e6, perMin = 240 } = {}) {
  const cache = new Map(), hits = new Map();
  const ok = (u) => (u.protocol === 'https:' || (allowHttp && u.protocol === 'http:')) && hosts.includes(u.hostname);
  setInterval(() => { const n = Date.now(); for (const [k, v] of cache) if (n - v.at > ttl) cache.delete(k); hits.clear(); }, 60e3).unref();

  // Returns true when it answered the request (so the caller stops), false when the request is not for the proxy.
  return async function proxy(req, res) {
    if (!req.url.startsWith('/proxy?') || (req.method !== 'GET' && req.method !== 'HEAD')) return false;
    const out = (code, type, body, extra = {}) => { res.writeHead(code, { 'content-type': type, 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=10', ...extra }); res.end(body); return true; };
    const fail = (code, msg) => out(code, 'application/json', JSON.stringify({ error: msg }));
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    const n = (hits.get(ip) || 0) + 1; hits.set(ip, n);
    if (n > perMin) return fail(429, 'Too many requests. Wait a minute.');
    let u; try { u = new URL(new URL(req.url, 'http://x').searchParams.get('u') || ''); } catch { return fail(400, 'Bad address'); }
    if (!ok(u)) return fail(403, 'This site is not allowed');
    const key = u.href, hit = cache.get(key);
    if (hit && Date.now() - hit.at < ttl) return out(200, hit.type, hit.body);
    try {
      let r, url = u; // follow up to 3 redirects, checking every hop against the list
      for (let i = 0; i <= 3; i++) {
        r = await fetch(url, { redirect: 'manual', headers: { 'user-agent': UA, accept: 'application/json, application/rss+xml, application/xml, text/xml, */*' }, signal: AbortSignal.timeout(10000) });
        if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { url = new URL(r.headers.get('location'), url); if (!ok(url)) return fail(502, 'Redirected to a site that is not allowed'); continue; }
        break;
      }
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > maxBytes) return fail(502, 'Answer too large');
      const type = r.headers.get('content-type') || 'text/plain';
      if (r.ok) { cache.set(key, { at: Date.now(), type, body: buf }); if (cache.size > 300) cache.delete(cache.keys().next().value); }
      return out(r.status, type, buf);
    } catch (e) { return fail(504, e.name === 'TimeoutError' ? 'The site took too long to answer' : 'Could not reach the site'); }
  };
};
