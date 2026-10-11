// Background alerts. The phone sends its price alerts and scanner settings here; this server watches the markets 24/7 and
// sends a PUSH notification when a price level is reached or the scanner finds a setup at or above the chosen probability.
// A push reaches the phone even when the app is closed and the screen is locked (the app itself cannot run in that state).
const fs = require('fs');
const GRANS = [60, 180, 300, 900, 1800, 3600, 7200, 14400, 86400];
const PRICE_MS = Number(process.env.PRICE_CHECK_MS || 10000), SCAN_MS = Number(process.env.SCAN_MS || 90000);
const RESEND_MS = 4 * 3600e3;               // the same setup (symbol + side) rings again only after this long
const CHANNEL = 'alarm_v1';                 // must match the channel the app creates (src/push.ts)
const PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const LEVEL = { entry: 'entry now', near: 'near entry, wait for the reaction' };
const okSym = (x) => typeof x === 'string' && /^[\w.\-]{2,30}$/.test(x);

let analyze = null, judge = null, session = null, yahoo = null, bn = null, HTF_OF = {};
try { analyze = require('./analysis/refine').analyzeAll; judge = require('./analysis/verdict').judge; session = require('./analysis/session'); HTF_OF = require('./analysis/entry').HTF_OF || {}; yahoo = require('./analysis/fallback'); bn = require('./analysis/crypto'); }
catch (e) { console.log('alerts: analysis files missing (run: node build-analysis.js). Price alerts work, the scanner is off. ' + e.message); }

// ---- market data: Deriv public socket (forex, metals, synthetics, crypto), Binance for bn* pairs, Yahoo as backup / for DXY ----
const EPS = ['wss://api.derivws.com/trading/v1/options/ws/public', 'wss://ws.derivws.com/websockets/v3?app_id=1089', 'wss://ws.binaryws.com/websockets/v3?app_id=1089'];
function derivClient() {
  let ws = null, ready = null, nid = 1, ep = 0; const pend = new Map();
  const connect = () => ready || (ready = new Promise((res, rej) => {
    if (typeof WebSocket === 'undefined') { ready = null; return rej(new Error('Node 22+ is needed for the Deriv feed')); }
    let w; try { w = new WebSocket(EPS[ep % EPS.length]); } catch (e) { ready = null; ep++; return rej(e); }
    const t = setTimeout(() => { try { w.close(); } catch {} }, 10000);
    w.onopen = () => { clearTimeout(t); ws = w; res(w); };
    w.onmessage = (m) => { let d; try { d = JSON.parse(m.data); } catch { return; } const h = pend.get(d.req_id); if (h) { pend.delete(d.req_id); clearTimeout(h.t); h.res(d); } };
    w.onerror = () => {};
    w.onclose = () => { clearTimeout(t); if (ws === w) ws = null; ready = null; ep++; for (const h of pend.values()) { clearTimeout(h.t); h.rej(new Error('Deriv socket closed')); } pend.clear(); rej(new Error('Deriv socket down')); };
  }));
  const ask = async (msg) => {
    await connect();
    return new Promise((res, rej) => {
      const id = nid++, t = setTimeout(() => { pend.delete(id); rej(new Error('Deriv timeout')); }, 15000);
      pend.set(id, { res, rej, t }); ws.send(JSON.stringify({ ...msg, req_id: id }));
    });
  };
  return {
    price: async (id) => { const d = await ask({ ticks_history: id, count: 1, end: 'latest', style: 'ticks' }); if (d.error) throw new Error(d.error.message); return Number(d.history?.prices?.[0]); },
    candles: async (id, gran, count = 150) => {
      const d = await ask({ ticks_history: id, style: 'candles', granularity: gran, count, end: 'latest' }); if (d.error) throw new Error(d.error.message);
      return (d.candles || []).map((c) => ({ t: c.epoch, o: +c.open, h: +c.high, l: +c.low, c: +c.close }));
    },
  };
}
function realFeed() {
  const dv = derivClient();
  const isBn = (id) => bn && bn.isBn(id);
  return {
    async price(id) {
      if (isBn(id)) { const raw = bn.bnRaw(id), r = await bn.bnTickers([raw]); return r[raw]?.price; }
      if (yahoo && yahoo.yahooOnly(id)) return (await yahoo.yahooQuote(id))?.price;
      try { const p = await dv.price(id); if (isFinite(p) && p > 0) return p; } catch {}
      if (yahoo && yahoo.yahooId(id)) return (await yahoo.yahooQuote(id).catch(() => null))?.price;
    },
    async candles(id, gran, count = 150) {
      if (isBn(id)) return bn.bnCandles(bn.bnRaw(id), gran, count);
      if (yahoo && yahoo.yahooOnly(id)) return yahoo.yahooCandles(id, gran, count);
      try { const c = await dv.candles(id, gran, count); if (c.length) return c; } catch {}
      return yahoo && yahoo.yahooId(id) ? yahoo.yahooCandles(id, gran, count).catch(() => []) : [];
    },
  };
}
const pool = async (items, n, fn) => { const q = [...items]; await Promise.all(Array.from({ length: Math.min(n, q.length) }, async () => { while (q.length) { const x = q.shift(); try { await fn(x); } catch (e) { if (process.env.DEBUG_POOL) console.log('pool error:', e.message); } } })); };

module.exports = alertsModule;
module.exports.realFeed = realFeed;
function alertsModule({ file, live, feed = realFeed(), fetchFn = fetch, log = console.log }) {
  let st = { users: {} };
  try { st = { users: {}, ...JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch {}
  let saveT = null;
  const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { fs.writeFileSync(file + '.tmp', JSON.stringify(st)); fs.renameSync(file + '.tmp', file); } catch (e) { log('alerts save failed: ' + e.message); } }, 1500); };
  const me = (pid) => (st.users[pid] ||= { tokens: [], alerts: [], scan: null, fired: [], sent: {} });

  // ---- push (Expo push service -> Google FCM / Apple APNs) ----
  async function push(pid, title, body, data = {}) {
    const u = st.users[pid]; if (!u || !u.tokens.length) return 0;
    const msgs = u.tokens.map((t) => ({ to: t, title, body, data, sound: 'alarm.wav', channelId: CHANNEL, priority: 'high', ttl: 900 }));
    try {
      const r = await fetchFn(PUSH_URL, { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json', ...(process.env.EXPO_ACCESS_TOKEN ? { authorization: 'Bearer ' + process.env.EXPO_ACCESS_TOKEN } : {}) }, body: JSON.stringify(msgs), signal: AbortSignal.timeout(15000) });
      const j = await r.json().catch(() => ({}));
      (j.data || []).forEach((tk, i) => { if (tk?.status === 'error' && tk.details?.error === 'DeviceNotRegistered') u.tokens = u.tokens.filter((x) => x !== msgs[i].to); else if (tk?.status === 'error') log('push error: ' + tk.message); });
      save(); return msgs.length;
    } catch (e) { log('push failed: ' + e.message); return 0; }
  }

  // ---- price alerts ----
  let priceBusy = false;
  async function checkPrices() {
    if (priceBusy) return; priceBusy = true;
    try {
      const users = Object.entries(st.users).filter(([pid, u]) => u.alerts.length && u.tokens.length && live(pid));
      const syms = [...new Set(users.flatMap(([, u]) => u.alerts.map((a) => a.sym)))], px = new Map();
      await pool(syms, 5, async (s) => { const p = Number(await feed.price(s)); if (isFinite(p) && p > 0) px.set(s, p); });
      for (const [pid, u] of users) {
        const hit = u.alerts.filter((a) => { const p = px.get(a.sym); return p !== undefined && (a.dir === 'above' ? p >= a.level : p <= a.level); });
        if (!hit.length) continue;
        u.alerts = u.alerts.filter((a) => !hit.includes(a));
        u.fired = [...u.fired, ...hit.map((a) => a.id)].slice(-300); save();
        for (const a of hit) await push(pid, `${a.name || a.sym} price alert`, `Price reached ${px.get(a.sym)} (your level ${a.dir === 'above' ? '≥' : '≤'} ${a.level})`, { type: 'price', id: a.id, sym: a.sym });
      }
    } catch (e) { log('price check: ' + e.message); } finally { priceBusy = false; }
  }

  // ---- scanner ----
  let scanBusy = false;
  async function runScan() {
    if (!analyze || !judge || !session || scanBusy) return; scanBusy = true;
    try {
      const users = Object.entries(st.users).filter(([pid, u]) => u.scan?.on && u.scan.items.length && u.tokens.length && live(pid));
      const want = new Map(); // one fetch + one analysis per symbol/timeframe, shared by every user
      for (const [, u] of users) for (const it of u.scan.items) want.set(`${it.id}|${u.scan.tf}|${it.sess ? 1 : 0}`, { id: it.id, tf: u.scan.tf, sess: it.sess });
      const res = new Map(); let errs = 0, lastErr = '';
      await pool([...want.entries()], 6, async ([k, w]) => { try {
        const now = new Date(), cat = w.id.startsWith('frx') ? 'forex' : w.sess ? 'indices' : undefined;
        if (!session.scheduleState(w.id, cat, now).open) return;                      // weekend: do not even download candles
        const c = await feed.candles(w.id, w.tf);
        if (!c || c.length < 45) return;
        if (!session.marketState(c, w.tf, w.id, cat, now).open) return;               // stale candles: market closed or feed not live
        const hg = HTF_OF[w.tf], h = hg ? await feed.candles(w.id, hg).catch(() => []) : []; // higher timeframe trend filter, same as the app
        const a = analyze(c, now, { sessions: !!w.sess, htf: h && h.length >= 40 ? h : undefined }), cb = a.combo;
        // the same entry gate as the app (score 70%+, 3+ methods agree, nothing against, price in the zone or within 1 ATR, risk:reward, thin hours)
        if (cb && cb.side) { const v = judge(a, { id: w.id, cat, now, c }); if (v.level) res.set(k, { side: cb.side, score: cb.score, level: v.level, agree: v.agree }); }
      } catch (e) { errs++; lastErr = e.message; } });
      if (errs) log(`scan: ${errs} of ${want.size} symbols failed (${lastErr})`);
      const now = Date.now();
      for (const [pid, u] of users) {
        for (const k of Object.keys(u.sent)) if (now - u.sent[k] > RESEND_MS) delete u.sent[k];
        const strong = u.scan.items.map((it) => ({ it, r: res.get(`${it.id}|${u.scan.tf}|${it.sess ? 1 : 0}`) })).filter((x) => x.r && x.r.score >= u.scan.minProb && x.r.level);
        const mute = u.scan.mute || [];
        const fresh = strong.filter((x) => !u.sent[`${x.it.id}:${x.r.side}:${x.r.level}`] && !mute.includes(`${x.it.id}:${x.r.side}`)); // near -> entry now rings again, the same level does not
        if (!fresh.length) continue;
        fresh.forEach((x) => { u.sent[`${x.it.id}:${x.r.side}:${x.r.level}`] = now; }); save();
        fresh.sort((a, b) => b.r.score - a.r.score);
        const now1 = fresh.filter((x) => x.r.level === 'entry').length;
        await push(pid, now1 ? `${now1} setup${now1 > 1 ? 's' : ''}: enter now` : `${fresh.length} setup${fresh.length > 1 ? 's' : ''} near entry`,
          fresh.slice(0, 4).map((x) => `${x.it.name} ${x.r.side.toUpperCase()} ${Math.round(x.r.score)}% (${LEVEL[x.r.level]}; ${x.r.agree.length}/5 methods)`).join(', ') + (fresh.length > 4 ? '…' : ''), { type: 'setup', symId: fresh[0].it.id });
      }
    } catch (e) { log('scan: ' + e.message); } finally { scanBusy = false; }
  }

  // ---- requests from the app ----
  const cleanAlerts = (l, skip) => (Array.isArray(l) ? l : []).slice(0, 50).map((a) => ({ id: String(a?.id || '').slice(0, 40), sym: a?.sym, level: Number(a?.level), dir: a?.dir === 'below' ? 'below' : 'above', name: String(a?.name || '').slice(0, 40) }))
    .filter((a) => a.id && okSym(a.sym) && isFinite(a.level) && !skip.includes(a.id));
  const cleanScan = (x) => {
    if (!x || typeof x !== 'object') return null;
    const tf = GRANS.includes(Number(x.tf)) ? Number(x.tf) : 900;
    const items = (Array.isArray(x.items) ? x.items : []).slice(0, 100).map((i) => ({ id: i?.id, name: String(i?.name || i?.id || '').slice(0, 30), sess: !!i?.sess })).filter((i) => okSym(i.id));
    const mute = (Array.isArray(x.mute) ? x.mute : []).slice(0, 80).map((m) => String(m).slice(0, 60));
    return { on: !!x.on, minProb: Math.max(70, Math.min(95, Number(x.minProb) || 75)), tf, items, mute };
  };
  async function handle(u, s, b) {
    if (!s) return null;
    if (u === '/push/register') {
      const t = String(b.token || '');
      if (!/^(Exponent|Expo)PushToken\[[\w\-]+\]$/.test(t)) throw new Error('Bad push token');
      const us = me(s.pid); us.tokens = [t, ...us.tokens.filter((x) => x !== t)].slice(0, 5); save(); return { ok: true };
    }
    if (u === '/push/unregister') { const us = me(s.pid); us.tokens = us.tokens.filter((x) => x !== String(b.token || '')); save(); return { ok: true }; }
    if (u === '/push/test') { const n = await push(s.pid, 'Test alarm', 'Background alerts are working on this phone.', { type: 'test' }); if (!n) throw new Error('No phone is registered for alerts yet. Open the app once with notifications allowed.'); return { ok: true }; }
    if (u === '/alerts/sync') {
      const us = me(s.pid);
      if ('alerts' in b) us.alerts = cleanAlerts(b.alerts, us.fired);
      if ('scan' in b) us.scan = cleanScan(b.scan);
      save(); return { ok: true, fired: us.fired, scanner: !!analyze };
    }
    return null;
  }
  const timers = [];
  return {
    handle, drop: (pid) => { delete st.users[pid]; save(); },
    start() { timers.push(setInterval(checkPrices, PRICE_MS), setInterval(runScan, SCAN_MS)); log(`background alerts on: prices every ${PRICE_MS / 1000}s, scanner every ${SCAN_MS / 1000}s${analyze ? '' : ' (scanner off)'}`); },
    stop() { timers.forEach(clearInterval); },
    _test: { checkPrices, runScan, state: () => st },
  };
}

