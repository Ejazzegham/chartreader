// Signup map: finds the country and city of a new member from their IP address, and builds the PUBLIC summary the home page shows.
// Privacy: the IP address itself is never stored. Only the country, the city and the coordinates rounded to ~11 km are kept on the member's
// record (person.geo), and the public summary contains only counts per country and per city: no emails, no names, no ids.
// Lookups use free services that need no key (ipwho.is, then ipapi.co as a backup). The country sent by Cloudflare is used if both fail.
const PRIVATE = /^(127\.|10\.|0\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/;
const r1 = (n) => Math.round(n * 10) / 10;

module.exports = function makeGeo({ upstream }) {
  const cache = new Map(); // ip -> { at, g }  (one lookup per address per day, so a burst of signups never hits the free limits)
  const clean = (ip) => String(ip || '').trim().replace(/^::ffff:/i, '');
  const isLocal = (ip) => !ip || ip === '::1' || /^(fc|fd|fe80)/i.test(ip) || PRIVATE.test(ip);
  const pack = (cc, country, city, lat, lon) => {
    cc = String(cc || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(cc) || cc === 'XX' || cc === 'T1') return null;
    const g = { cc, country: String(country || cc).slice(0, 60), city: String(city || '').slice(0, 60) };
    if (Number.isFinite(+lat) && Number.isFinite(+lon) && lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) { g.lat = r1(+lat); g.lon = r1(+lon); }
    return g;
  };
  const json = async (u) => { const r = await upstream(u, { headers: { 'user-agent': 'ChartReader/1.0' } }, 8000); return r.ok ? r.json() : null; };
  const providers = [
    async (ip) => { const j = await json('https://ipwho.is/' + encodeURIComponent(ip) + '?fields=success,country,country_code,city,latitude,longitude'); return j && j.success !== false ? pack(j.country_code, j.country, j.city, j.latitude, j.longitude) : null; },
    async (ip) => { const j = await json('https://ipapi.co/' + encodeURIComponent(ip) + '/json/'); return j && !j.error ? pack(j.country_code, j.country_name, j.city, j.latitude, j.longitude) : null; },
  ];

  // Returns { cc, country, city, lat, lon } or null. Never throws.
  async function lookup(ip, headers = {}) {
    ip = clean(ip);
    const cf = pack(headers['cf-ipcountry'], '', '', null, null); // Cloudflare already knows the country: only used when the city lookup fails
    if (isLocal(ip)) return cf;
    const hit = cache.get(ip); if (hit && Date.now() - hit.at < 864e5) return hit.g;
    let g = null;
    for (const p of providers) { try { g = await p(ip); } catch { g = null; } if (g) break; }
    if (g) { cache.set(ip, { at: Date.now(), g }); if (cache.size > 2000) cache.delete(cache.keys().next().value); }
    return g || cf; // the Cloudflare fallback is not cached, so a later attempt can still find the city
  }

  // The public numbers for the home page. `people` is db.people; `skip(person)` returns true for accounts that must not be counted (deleted, admins).
  const memo = new Map(); // "from|to" -> { at, v }  (each date range is cached for 60 s)
  const pct = (now, prev) => (prev > 0 ? Math.round(((now - prev) / prev) * 100) : now > 0 ? 100 : 0);
  // "Anna K.": first name and the initial of the last name only. MAP_NAMES=0 hides names completely ("A trader").
  const initial = (w) => (Array.from(w)[0] || '').toUpperCase();
  const shortName = (full) => {
    if (process.env.MAP_NAMES === '0') return 'A trader';
    const w = String(full || '').replace(/[<>]/g, '').trim().split(/\s+/).filter(Boolean); if (!w.length) return 'New trader';
    const first = initial(w[0]) + Array.from(w[0]).slice(1).join('').toLowerCase();
    return (Array.from(first).slice(0, 14).join('')) + (w.length > 1 ? ' ' + initial(w[w.length - 1]) + '.' : '');
  };
  // range = { from, to } in ms (both optional). Only members who joined inside the range are counted; the growth badges always compare with 30 days ago.
  function summary(people, skip, range = {}) {
    const from = Number.isFinite(+range.from) && +range.from > 0 ? +range.from : 0;
    const to = Number.isFinite(+range.to) && +range.to > 0 ? +range.to : Infinity;
    const key = from + '|' + to, hit = memo.get(key);
    if (hit && Date.now() - hit.at < 60e3) return hit.v;
    const countries = {}, places = {}, recent = []; let total = 0;
    const cut = Date.now() - 30 * 864e5; let allNow = 0, allPrev = 0; const ccNow = new Set(), ccPrev = new Set();
    for (const p of Object.values(people)) {
      if (skip(p)) continue;
      const t = p.created || 0, g = p.geo;
      allNow++; if (g && g.cc) ccNow.add(g.cc);
      if (t < cut) { allPrev++; if (g && g.cc) ccPrev.add(g.cc); }
      if (t < from || t > to) continue;
      total++;
      if (!g || !g.cc) continue;
      recent.push({ t, name: shortName(p.name), cc: g.cc });
      const c = (countries[g.cc] ||= { cc: g.cc, name: g.country || g.cc, n: 0 }); c.n++;
      if (typeof g.lat === 'number' && typeof g.lon === 'number') {
        const k = g.cc + '|' + g.lat + '|' + g.lon, pl = (places[k] ||= { cc: g.cc, city: g.city || '', lat: g.lat, lon: g.lon, n: 0 }); pl.n++;
      }
    }
    const v = { total, located: Object.values(countries).reduce((a, c) => a + c.n, 0), countries: Object.values(countries).sort((a, b) => b.n - a.n), places: Object.values(places).sort((a, b) => b.n - a.n), recent: recent.sort((a, b) => b.t - a.t).slice(0, 12), growth: { members: pct(allNow, allPrev), countries: pct(ccNow.size, ccPrev.size) }, at: Date.now() };
    memo.set(key, { at: Date.now(), v });
    if (memo.size > 40) memo.delete(memo.keys().next().value);
    return v;
  }
  return { lookup, summary };
};
