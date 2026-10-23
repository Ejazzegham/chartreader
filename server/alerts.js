// Background alerts. The phone sends its price alerts and scanner settings here; this server watches the markets 24/7 and
// sends a PUSH notification when a price level is reached or the scanner finds a setup at or above the chosen probability.
// A push reaches the phone even when the app is closed and the screen is locked (the app itself cannot run in that state).
const fs = require('fs');
const GRANS = [60, 180, 300, 900, 1800, 3600, 7200, 14400, 86400];
const PRICE_MS = Number(process.env.PRICE_CHECK_MS || 10000), SCAN_MS = Number(process.env.SCAN_MS || 90000);
const DAY_MS = Number(process.env.DAYLEVEL_CHECK_MS || 60000), NEWS_MS = Number(process.env.NEWS_CHECK_MS || 60000); // daily high / low breaks and news are checked once a minute
const NEWS_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json', NEWS_LEAD_MIN = 15; // same free economic calendar the app uses; the heads-up goes out 15 minutes before a HIGH impact release
const INFO_CHANNEL = 'info_v1';       // news and daily high / low breaks: a normal notification sound, so they do not ring like the trading alarm (src/push.ts creates it)
const DIGEST_MIN = 50;                    // the 90 s digest lists only setups scoring at least this (weaker ones are noise)
const RESEND_MS = 15 * 60e3;   // 15 minutes
// Must match the channels the app creates (src/push.ts). Chat / payment messages use a normal notification sound, not the trading alarm.
// digest = the quiet "analysis every 90 s" notification: its own low-importance channel, no alarm sound.
const CHANNEL = 'alarm_v1', CHAT_CHANNEL = 'support_v1', DIGEST_CHANNEL = 'digest_v1';
const PUSH_URL = 'https://exp.host/--/api/v2/push/send', RECEIPT_URL = 'https://exp.host/--/api/v2/push/getReceipts';
// How long the push service keeps a message for a phone that is off or has no signal (seconds). It used to be 15 minutes, so anything sent
// while the phone was switched off or out of coverage longer than that was lost for good.
const TTL = { price: 86400, setup: 7200, test: 300, support: 7 * 86400, digest: 120, level: 3600, news: 900 }; // a digest older than two scans is worth nothing: it is dropped, not delivered late
const INBOX_MAX = 50, INBOX_AGE = 7 * 864e5; // every notification is also kept here, so the app can show the ones it missed
const RETRY_MS = 30000, RETRY_MAX = 6;       // a push that did not go through is tried again (6 times, 30 s apart)
const LEVEL = { entry: 'entry now', near: 'near entry, wait for the reaction' };
const okSym = (x) => typeof x === 'string' && /^[\w.\-]{2,30}$/.test(x);

// Deriv spike pairs: Boom = BUY only, Crash = SELL only (the same rule as src/verdict.ts, which the gate itself uses)
let spikeSide = (id) => { const m = /^(BOOM|CRASH)\d+N?$/.exec(id || ''); return m ? (m[1] === 'BOOM' ? 'buy' : 'sell') : null; };
let analyze = null, judge = null, session = null, yahoo = null, bn = null, vol = null, HTF_OF = {};
try { vol = require('./analysis/volume'); } catch {}
try { analyze = require('./analysis/refine').analyzeAll; judge = require('./analysis/verdict').qualify; spikeSide = require('./analysis/verdict').spikeSide || spikeSide; /* same TRADE / WAIT rule as the app */ session = require('./analysis/session'); HTF_OF = require('./analysis/entry').HTF_OF || {}; yahoo = require('./analysis/fallback'); bn = require('./analysis/crypto'); }
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
  const dv = derivClient(), volCache = new Map();
  const isBn = (id) => bn && bn.isBn(id);
  const toBn = (id) => (bn && bn.bnId ? bn.bnId(id) : undefined); // cryBTCUSD -> bnBTCUSDT: crypto alerts use the Binance price, same as the app
  return {
    async price(id) {
      const bid = toBn(id);
      if (bid) { const raw = bn.bnRaw(bid), r = await bn.bnTickers([raw]); return r[raw]?.price; }
      if (yahoo && yahoo.yahooOnly(id)) return (await yahoo.yahooQuote(id))?.price;
      try { const p = await dv.price(id); if (isFinite(p) && p > 0) { if (yahoo?.noteSpot) yahoo.noteSpot(id, p); return p; } } catch {}
      if (yahoo && yahoo.yahooId(id)) { if (yahoo.futAligned && !yahoo.futAligned(id)) return undefined; return (await yahoo.yahooQuote(id).catch(() => null))?.price; } // gold / silver backup = futures: only once its gap to spot is known
    },
    async candles(id, gran, count = 150) {
      const c = await rawCandles(id, gran, count);
      return withVolume(id, gran, count, c);
    },
    rawCandles: (id, gran, count = 150) => rawCandles(id, gran, count), // daily levels need no volume
  };
  async function rawCandles(id, gran, count) {
    const bid = toBn(id);
    if (bid) return bn.bnCandles(bn.bnRaw(bid), gran, count);
    if (yahoo && yahoo.yahooOnly(id)) return yahoo.yahooCandles(id, gran, count);
    try { const c = await dv.candles(id, gran, count); if (c.length) { if (yahoo?.noteSpot) yahoo.noteSpot(id, c[c.length - 1].c); return c; } } catch {}
    if (yahoo && yahoo.futAligned && !yahoo.futAligned(id)) return []; // futures candles that are not matched to spot would put the entry about $10 off
    return yahoo && yahoo.yahooId(id) ? yahoo.yahooCandles(id, gran, count).catch(() => []) : [];
  }
  // Deriv / Yahoo spot candles carry no volume: real exchange volume (Binance spot, CME / COMEX / ICE futures) is merged in, same as in the app (volume.ts)
  async function withVolume(id, gran, count, c) {
    if (!vol || !c.length) return c;
    const src = vol.volumeSource(id);
    if (!src || vol.feedHasVolume(id)) return c;
    const key = id + ':' + gran, hit = volCache.get(key);
    try {
      let bars = hit && Date.now() - hit.at < 60000 ? hit.bars : null;
      if (!bars) { bars = src.kind === 'binance' ? await bn.bnCandles(src.raw, gran, Math.max(count, 300)) : await yahoo.yahooVolumeMulti(src.y2 ? [src.y, src.y2] : [src.y], gran); volCache.set(key, { at: Date.now(), bars }); }
      return vol.attachVolume(c, bars, gran);
    } catch { return c; }
  }
}
const pool = async (items, n, fn) => { const q = [...items]; await Promise.all(Array.from({ length: Math.min(n, q.length) }, async () => { while (q.length) { const x = q.shift(); try { await fn(x); } catch (e) { if (process.env.DEBUG_POOL) console.log('pool error:', e.message); } } })); };

module.exports = alertsModule;
module.exports.realFeed = realFeed;
function alertsModule({ file, live, feed = realFeed(), fetchFn = fetch, log = console.log }) {
  let st = { users: {} };
  try { st = { users: {}, ...JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch {}
  let saveT = null;
  const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { fs.writeFileSync(file + '.tmp', JSON.stringify(st)); fs.renameSync(file + '.tmp', file); } catch (e) { log('alerts save failed: ' + e.message); } }, 1500); };
  // inbox: what was sent to this person (newest last). seq = last id given, ack = last id the person has read in the app. pending = pushes that failed and will be retried.
  const me = (pid) => { const u = (st.users[pid] ||= { tokens: [], alerts: [], scan: null, fired: [], sent: {} }); u.inbox ||= []; u.pending ||= []; u.receipts ||= []; u.nsent ||= {}; u.dsent ||= {}; u.seq ||= 0; u.ack ||= 0; return u; };
  const unread = (u) => u.inbox.filter((i) => i.id > u.ack).length;

  // ---- push (Expo push service -> Google FCM / Apple APNs) ----
  // One send to every phone of this person. Returns how many phones the push service ACCEPTED (0 = nothing went out, the caller may retry).
  async function deliver(pid, item, data) {
    const u = me(pid); if (!u.tokens.length) return 0;
    const badge = unread(u); // the number shown on the app icon (iPhone shows it exactly; on Android the phone's launcher decides)
    const msgs = u.tokens.map((t) => ({ to: t, title: item.title, body: item.body, data: { ...data, nid: item.id }, ...(item.type === 'support' ? { sound: 'default', channelId: CHAT_CHANNEL } : item.type === 'digest' ? { sound: null, channelId: DIGEST_CHANNEL } : (item.type === 'news' || item.type === 'level') ? { sound: 'default', channelId: INFO_CHANNEL } : { sound: 'alarm.wav', channelId: CHANNEL }), priority: item.type === 'digest' ? 'normal' : 'high', ttl: TTL[item.type] || TTL.price, badge })); // the silent digest does not need to wake the phone at once
    try {
      const r = await fetchFn(PUSH_URL, { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json', ...(process.env.EXPO_ACCESS_TOKEN ? { authorization: 'Bearer ' + process.env.EXPO_ACCESS_TOKEN } : {}) }, body: JSON.stringify(msgs), signal: AbortSignal.timeout(15000) });
      if (!r.ok) { log('push http ' + r.status); return 0; } // used to count as sent, so a busy push service silently lost the alert
      const j = await r.json().catch(() => ({}));
      let ok = 0;
      (j.data || []).forEach((tk, i) => {
        if (tk?.status === 'ok') { ok++; if (tk.id) u.receipts.push({ id: tk.id, to: msgs[i].to, at: Date.now() }); }
        else if (tk?.status === 'error') { if (tk.details?.error === 'DeviceNotRegistered') u.tokens = u.tokens.filter((x) => x !== msgs[i].to); else log('push error: ' + tk.message); }
      });
      save(); return ok;
    } catch (e) { log('push failed: ' + e.message); return 0; }
  }
  // Writes the notification into the inbox FIRST (so the app can always show it), then sends it. A failed send is queued and retried.
  async function push(pid, title, body, data0 = {}) {
    const { setups, ...data } = data0; // setups: full A / A+ setups for the Journal. They travel in the inbox, not in the push payload.
    const u = st.users[pid]; if (!u || !u.tokens.length) return 0;
    const us = me(pid), now = Date.now();
    const item = { id: ++us.seq, at: now, title, body, type: data.type || 'info', ...((data.sym || data.symId) ? { sym: data.sym || data.symId } : {}) , ...(setups?.length ? { setups } : {}) }; // sym: the pair the line opens when tapped (price alerts send sym, scanner setups send symId)
    us.inbox = [...us.inbox, item].filter((i) => now - i.at < INBOX_AGE).slice(-INBOX_MAX); save();
    const n = await deliver(pid, item, data);
    if (!n && item.type !== 'test' && us.tokens.length) { us.pending.push({ item, data, tries: 1, until: now + (TTL[item.type] || TTL.price) * 1000 }); save(); }
    return n;
  }
  // The "analysis every 90 s" notification. It is NOT written to the inbox (the bell would fill with 960 lines a day) and is never retried (the next one is 90 s away).
  // badge stays the unread count of the real alerts. Returns how many phones the push service accepted.
  async function pushDigest(pid, title, body, data = {}) {
    const u = st.users[pid]; if (!u || !u.tokens.length) return 0;
    return deliver(pid, { id: 0, title, body, type: 'digest' }, data); // data.type / symId decide where a tap goes (the best pair in Analysis)
  }
  // The push service answers "accepted" at once. Whether Google / Apple really took the message is only known minutes later, in a receipt.
  // Without this check a wrong Firebase key or a dead phone looked like success and nothing ever reached the phone. Now the reason is written to the server log.
  let receiptBusy = false;
  async function checkReceipts() {
    if (receiptBusy) return; receiptBusy = true;
    try {
      for (const [pid, u] of Object.entries(st.users)) {
        const now = Date.now(), due = (u.receipts || []).filter((r) => now - r.at > 120e3).slice(0, 300);
        if (!due.length) continue;
        const rr = await fetchFn(RECEIPT_URL, { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify({ ids: due.map((r) => r.id) }), signal: AbortSignal.timeout(15000) });
        if (!rr.ok) continue;
        const got = (await rr.json().catch(() => ({}))).data || {};
        for (const r of due) {
          const x = got[r.id];
          if (x) {
            if (x.status === 'error') { if (x.details?.error === 'DeviceNotRegistered') u.tokens = u.tokens.filter((t) => t !== r.to); else log(`push NOT delivered (${String(pid).slice(0, 8)}): ${x.details?.error || 'error'} ${x.message || ''}`); }
            u.receipts = u.receipts.filter((y) => y.id !== r.id);
          } else if (now - r.at > 3600e3) u.receipts = u.receipts.filter((y) => y.id !== r.id); // no receipt after an hour: stop asking
        }
        save();
      }
    } catch (e) { log('receipts: ' + e.message); } finally { receiptBusy = false; }
  }
  let retryBusy = false;
  async function flushPending() {
    if (retryBusy) return; retryBusy = true;
    try {
      for (const [pid, u] of Object.entries(st.users)) {
        if (!u.pending?.length) continue;
        const keep = [];
        for (const p of u.pending) {
          if (Date.now() > p.until || !u.tokens.length) continue; // too old to matter, or the phone is gone
          p.tries++;
          const n = await deliver(pid, p.item, p.data);
          if (!n && p.tries < RETRY_MAX) keep.push(p);
        }
        u.pending = keep; save();
      }
    } catch (e) { log('retry: ' + e.message); } finally { retryBusy = false; }
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
  const px = (v) => (typeof v === 'number' && isFinite(v) ? v.toFixed(Math.abs(v) >= 100 ? 2 : Math.abs(v) >= 10 ? 3 : 5) : '-');
  let scanBusy = false;
  const itemsOf = (u) => (u.scan.spikeOnly ? u.scan.items.filter((it) => spikeSide(it.id)) : u.scan.items); // "spike pairs only": the setup alerts cover Boom and Crash and nothing else
  async function runScan() {
    if (!analyze || !judge || !session || scanBusy) return; scanBusy = true;
    try {
      const users = Object.entries(st.users).filter(([pid, u]) => u.scan?.on && itemsOf(u).length && u.tokens.length && live(pid));
      const want = new Map(); // one fetch + one analysis per symbol/timeframe, shared by every user
      for (const [, u] of users) for (const it of itemsOf(u)) want.set(`${it.id}|${u.scan.tf}|${it.sess ? 1 : 0}`, { id: it.id, tf: u.scan.tf, sess: it.sess });
      const res = new Map(), resW = new Map(), all = new Map(), done = new Set(); let errs = 0, lastErr = '', seen = 0, withSetup = 0; const why = {};
      await pool([...want.entries()], 6, async ([k, w]) => { try {
        const now = new Date(), cat = w.id.startsWith('frx') ? 'forex' : w.sess ? 'indices' : undefined;
        if (!session.scheduleState(w.id, cat, now).open) return;                      // weekend: do not even download candles
        const c = await feed.candles(w.id, w.tf);
        if (!c || c.length < 45) return;
        if (!session.marketState(c, w.tf, w.id, cat, now).open) return;               // stale candles: market closed or feed not live
        const hg = HTF_OF[w.tf], h = hg ? await feed.candles(w.id, hg).catch(() => []) : []; // higher timeframe trend filter, same as the app
        const a = analyze(c, now, { sessions: !!w.sess, htf: h && h.length >= 40 ? h : undefined }), cb = a.combo; seen++; done.add(k);
        // the same entry gate as the app (score 70%+, 3+ methods agree, nothing against, price in the zone or within 1 ATR, risk:reward, thin hours)
        if (cb && cb.side && spikeSide(w.id) && cb.side !== spikeSide(w.id)) { // never trade against the spike: no alert, no digest line, no heads-up
          const t = 'Spike pair: ' + (spikeSide(w.id) === 'buy' ? 'Boom = BUY only' : 'Crash = SELL only') + ' (setup was the other way)'; why[t] = (why[t] || 0) + 1;
        } else if (cb && cb.side) {
          withSetup++; const q = judge(a, { id: w.id, cat, now, c });
          const info = { side: cb.side, score: cb.score, agree: q.verdict.agree, entry: cb.plan.status === 'enter-now' ? c[c.length - 1].c : cb.entry, sl: cb.sl, tp1: cb.tps[0], atPoi: !!cb.plan.inZone,
            grade: q.grade, tps: cb.tps.slice(0, 3), basis: cb.basis, zone: [cb.zoneBottom, cb.zoneTop], // the full setup: the app copies A / A+ ones into the Journal (Take / Skip)
            why: [cb.plan.trigger, cb.plan.cancelIf, ...(cb.checks || []).filter((x) => x.ok).slice(0, 5).map((x) => x.text)].filter(Boolean).map((x) => String(x).slice(0, 140)) };
          all.set(k, { ...info, status: cb.plan.status, a: !!q.level }); // every setup, for the optional 90 s digest
          if (q.level) res.set(k, { ...info, level: q.level });
          else {
            q.reasons.slice(0, 2).forEach((r) => { const t = r.replace(/[0-9.]+/g, '#').slice(0, 70); why[t] = (why[t] || 0) + 1; });
            // heads-up tier: a valid setup that is AT or within 1 ATR of its POI but is not A-grade (for users who switched it on)
            if (cb.score >= 65 && (cb.htf !== 'against' || spikeSide(w.id)) && ['enter-now', 'wait-trigger', 'limit'].includes(cb.plan.status) && (cb.plan.inZone || cb.plan.distAtr <= 1)) resW.set(k, { ...info, level: 'watch' });
          }
        }
      } catch (e) { errs++; lastErr = e.message; } });
      if (errs) log(`scan: ${errs} of ${want.size} symbols failed (${lastErr})`);
      { const top = Object.entries(why).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, n]) => `${n}x ${t}`).join(' | '); log(`scan: ${seen} analysed, ${withSetup} with a setup, ${res.size} A-grade at the POI, ${resW.size} heads-up. Main blockers: ${top || 'none'}`); }
      const now = Date.now();
      for (const [pid, u] of users) {
        for (const k of Object.keys(u.sent)) if (now - u.sent[k] > RESEND_MS) delete u.sent[k];
        const strong = itemsOf(u).map((it) => ({ it, r: res.get(`${it.id}|${u.scan.tf}|${it.sess ? 1 : 0}`) })).filter((x) => x.r && x.r.score >= u.scan.minProb && x.r.level);
        const mute = u.scan.mute || [];
        const fresh = strong.filter((x) => !u.sent[`${x.it.id}:${x.r.side}:${x.r.level}`] && !mute.includes(`${x.it.id}:${x.r.side}`)); // near -> entry now rings again, the same level does not
        // heads-up tier (optional per user): not A-grade, so quieter wording
        if (u.scan.watch) {
          const wk = itemsOf(u).map((it) => ({ it, r: resW.get(`${it.id}|${u.scan.tf}|${it.sess ? 1 : 0}`) })).filter((x) => x.r && !res.has(`${x.it.id}|${u.scan.tf}|${x.it.sess ? 1 : 0}`) && !u.sent[`${x.it.id}:${x.r.side}:watch`] && !mute.includes(`${x.it.id}:${x.r.side}`));
          if (wk.length) {
            wk.forEach((x) => { u.sent[`${x.it.id}:${x.r.side}:watch`] = now; }); save(); wk.sort((a, b) => b.r.score - a.r.score);
            await push(pid, `${wk.length} setup${wk.length > 1 ? 's' : ''} forming at the POI (not A-grade)`, wk.slice(0, 3).map((x) => `${x.it.name} ${x.r.side.toUpperCase()} ${Math.round(x.r.score)}%: ${x.r.atPoi ? 'price is AT the POI' : 'approaching the POI'}. Entry ${px(x.r.entry)}, stop ${px(x.r.sl)}, TP1 ${px(x.r.tp1)}. Lower accuracy: wait for the reaction.`).join('\n'), { type: 'setup', symId: wk[0].it.id, side: wk[0].r.side, tf: u.scan.tf });
          }
        }
        if (!fresh.length) continue;
        fresh.forEach((x) => { u.sent[`${x.it.id}:${x.r.side}:${x.r.level}`] = now; }); save();
        fresh.sort((a, b) => b.r.score - a.r.score);
        const now1 = fresh.filter((x) => x.r.level === 'entry').length;
        const gl = [...new Set(fresh.map((x) => x.r.grade || 'A'))].sort().join('/'); // "A", "A+" or "A/A+"
        await push(pid, now1 ? `${now1} ${gl} setup${now1 > 1 ? 's' : ''}: enter now` : `${fresh.length} ${gl} setup${fresh.length > 1 ? 's' : ''} near entry`,
          fresh.slice(0, 3).map((x) => `${x.it.name} ${x.r.side.toUpperCase()} ${x.r.grade || 'A'} ${Math.round(x.r.score)}%: ${x.r.atPoi ? 'price is AT the POI' : 'approaching the POI'} (${LEVEL[x.r.level]}). Entry ${px(x.r.entry)}, stop ${px(x.r.sl)}, TP1 ${px(x.r.tp1)}`).join('\n') + (fresh.length > 3 ? `\n+${fresh.length - 3} more` : ''), { type: 'setup', symId: fresh[0].it.id, side: fresh[0].r.side, tf: u.scan.tf,
          setups: fresh.slice(0, 8).map((x) => ({ symId: x.it.id, name: x.it.name, side: x.r.side, entry: x.r.entry, sl: x.r.sl, tps: x.r.tps, score: Math.round(x.r.score), grade: x.r.grade || 'A', basis: x.r.basis, zone: x.r.zone, why: x.r.why, tf: u.scan.tf })) });
      }
      // Optional "analysis every 90 s" notification (switch in the app). Quiet channel, not kept in the bell. Skipped when nothing was analysed (market closed / feed down).
      for (const [pid, u] of users) {
        if (!u.scan.digest) continue;
        const key = (it) => `${it.id}|${u.scan.tf}|${it.sess ? 1 : 0}`, mute = u.scan.mute || [];
        const n = itemsOf(u).filter((it) => done.has(key(it))).length; if (!n) continue;
        const rows = itemsOf(u).map((it) => ({ it, r: all.get(key(it)) })).filter((x) => x.r && x.r.score >= DIGEST_MIN && !mute.includes(`${x.it.id}:${x.r.side}`)).sort((a, b) => b.r.score - a.r.score);
        const nice = { 'enter-now': 'enter now', 'wait-trigger': 'wait for the trigger', limit: 'limit order' };
        const body = rows.length ? rows.slice(0, 3).map((x) => `${x.it.name} ${x.r.side.toUpperCase()} ${Math.round(x.r.score)}%${x.r.a ? ' A-grade' : ''}: ${nice[x.r.status] || x.r.status}. Entry ${px(x.r.entry)}, stop ${px(x.r.sl)}, TP1 ${px(x.r.tp1)}`).join('\n') + (rows.length > 3 ? `\n+${rows.length - 3} more` : '') : `No setup scoring ${DIGEST_MIN}%+ right now. Next analysis in 90 s.`;
        await pushDigest(pid, `Analysis: ${n} pair${n > 1 ? 's' : ''} checked, ${rows.length} setup${rows.length === 1 ? '' : 's'}`, body, rows.length ? { type: 'setup', symId: rows[0].it.id, side: rows[0].r.side, tf: u.scan.tf } : { type: 'digest' });
      }
    } catch (e) { log('scan: ' + e.message); } finally { scanBusy = false; }
  }

  // ---- daily high / low breaks (every pair in the person's list) ----
  // Level = the high and low of the PREVIOUS finished day (candles open at 00:00 UTC). An alert goes out when the live price CROSSES one of them,
  // once per pair, per level, per day. The first look at a pair after a restart only remembers the price, so nothing rings for a break that already happened.
  const dayLv = new Map(), lastPx = new Map();
  async function dayLevels(id, nowMs) {
    const day = Math.floor(nowMs / 864e5) * 86400, hit = dayLv.get(id);
    if (hit && hit.day === day && nowMs - hit.at < (hit.ok ? 3600e3 : 600e3)) return hit;
    const c = await (feed.rawCandles || feed.candles)(id, 86400, 4);
    const prev = (c || []).filter((x) => x.t < day && isFinite(x.h) && isFinite(x.l)).pop();
    const v = prev ? { ok: true, day, at: nowMs, hi: prev.h, lo: prev.l } : { ok: false, day, at: nowMs };
    dayLv.set(id, v); return v;
  }
  let dayBusy = false;
  async function checkDayBreaks() {
    if (dayBusy) return; dayBusy = true;
    try {
      const now = new Date(), nowMs = now.getTime();
      const users = Object.entries(st.users).filter(([pid, u]) => u.scan?.dayBreaks && u.scan.items.length && u.tokens.length && live(pid));
      if (!users.length) return;
      const syms = new Map(); for (const [, u] of users) for (const it of u.scan.items) syms.set(it.id, it);
      const brk = new Map();
      await pool([...syms.values()], 6, async (it) => {
        if (session && !session.scheduleState(it.id, it.id.startsWith('frx') ? 'forex' : it.sess ? 'indices' : undefined, now).open) { lastPx.delete(it.id); return; } // weekend: nothing moves
        const lv = await dayLevels(it.id, nowMs); if (!lv.ok) return;
        const p = Number(await feed.price(it.id)); if (!isFinite(p) || p <= 0) return;
        const before = lastPx.get(it.id); lastPx.set(it.id, p);
        if (before === undefined) return;
        if (before <= lv.hi && p > lv.hi) brk.set(it.id, { side: 'high', level: lv.hi, px: p, day: lv.day });
        else if (before >= lv.lo && p < lv.lo) brk.set(it.id, { side: 'low', level: lv.lo, px: p, day: lv.day });
      });
      for (const [pid, u] of users) {
        for (const k of Object.keys(u.dsent)) if (nowMs - u.dsent[k] > 3 * 864e5) delete u.dsent[k];
        const rows = u.scan.items.map((it) => ({ it, b: brk.get(it.id) })).filter((x) => x.b && !u.dsent[`${x.it.id}:${x.b.day}:${x.b.side}`]);
        if (!rows.length) continue;
        rows.forEach((x) => { u.dsent[`${x.it.id}:${x.b.day}:${x.b.side}`] = nowMs; }); save();
        const line = (x) => `${x.it.name}: price ${px(x.b.px)} broke ${x.b.side === 'high' ? 'above' : 'below'} the previous day's ${x.b.side} (${px(x.b.level)})`;
        await push(pid, rows.length === 1 ? `${rows[0].it.name}: previous day's ${rows[0].b.side} broken` : `${rows.length} pairs broke the previous day's high or low`,
          rows.slice(0, 4).map(line).join('\n') + (rows.length > 4 ? `\n+${rows.length - 4} more` : ''), { type: 'level', symId: rows[0].it.id, side: rows[0].b.side });
      }
    } catch (e) { log('day levels: ' + e.message); } finally { dayBusy = false; }
  }

  // ---- news alerts: a HIGH impact economic release, 15 minutes before it ----
  // Same free calendar as the News page. Shared by every user and cached (the feed is rate limited); an older copy is kept when the feed is down.
  let cal = { at: 0, events: [] };
  async function loadCalendar() {
    if (cal.events.length && Date.now() - cal.at < 30 * 60e3) return cal.events;
    if (!cal.events.length && Date.now() - cal.at < 5 * 60e3) return cal.events; // empty and failed a moment ago: do not hammer the feed
    try {
      const r = await fetchFn(NEWS_URL, { headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error('calendar http ' + r.status);
      const raw = await r.json(); if (!Array.isArray(raw)) throw new Error('calendar: unexpected answer');
      cal = { at: Date.now(), events: raw.map((x) => ({ title: String(x?.title || '').slice(0, 80), cur: String(x?.country || '').toUpperCase().slice(0, 4), t: Date.parse(x?.date), impact: x?.impact, forecast: String(x?.forecast || ''), previous: String(x?.previous || '') })).filter((e) => isFinite(e.t) && e.title) };
    } catch (e) { log('news: ' + e.message); cal.at = Date.now() - 25 * 60e3; } // try again in about 5 minutes
    return cal.events;
  }
  // which currencies move a pair (same rule as the app, src/news.ts). Synthetic indices ignore news.
  const curOf = (id) => { const m = /^frx([A-Z]{3})([A-Z]{3})$/.exec(id); if (m) return [m[1], m[2]]; return /^frx/.test(id) || /^cry|^bn/i.test(id) ? ['USD'] : []; };
  let newsBusy = false;
  async function checkNews() {
    if (newsBusy) return; newsBusy = true;
    try {
      const users = Object.entries(st.users).filter(([pid, u]) => u.scan?.news && u.tokens.length && live(pid));
      if (!users.length) return;
      const nowMs = Date.now(), soon = (await loadCalendar()).filter((e) => e.impact === 'High' && e.t > nowMs && e.t - nowMs <= NEWS_LEAD_MIN * 60e3);
      if (!soon.length) return;
      for (const [pid, u] of users) {
        for (const k of Object.keys(u.nsent)) if (nowMs - u.nsent[k] > 3 * 864e5) delete u.nsent[k];
        for (const e of soon) {
          const key = `${e.cur}|${e.t}|${e.title}`; if (u.nsent[key]) continue;
          u.nsent[key] = nowMs; save();
          const mins = Math.max(1, Math.round((e.t - nowMs) / 60e3)), hit = (u.scan.items || []).filter((it) => curOf(it.id).includes(e.cur)).map((it) => it.name);
          await push(pid, `News in ${mins} min: ${e.cur} ${e.title}`,
            `High impact.${e.forecast ? ' Forecast ' + e.forecast + '.' : ''}${e.previous ? ' Previous ' + e.previous + '.' : ''}${hit.length ? ' Fast moves possible on ' + hit.slice(0, 5).join(', ') + (hit.length > 5 ? ` +${hit.length - 5} more` : '') + '.' : ''} Spreads widen around the release: wait for the spike to settle.`, { type: 'news' });
        }
      }
    } catch (e) { log('news check: ' + e.message); } finally { newsBusy = false; }
  }

  // ---- requests from the app ----
  const cleanAlerts = (l, skip) => (Array.isArray(l) ? l : []).slice(0, 50).map((a) => ({ id: String(a?.id || '').slice(0, 40), sym: a?.sym, level: Number(a?.level), dir: a?.dir === 'below' ? 'below' : 'above', name: String(a?.name || '').slice(0, 40) }))
    .filter((a) => a.id && okSym(a.sym) && isFinite(a.level) && !skip.includes(a.id));
  const cleanScan = (x) => {
    if (!x || typeof x !== 'object') return null;
    const tf = GRANS.includes(Number(x.tf)) ? Number(x.tf) : 900;
    const items = (Array.isArray(x.items) ? x.items : []).slice(0, 100).map((i) => ({ id: i?.id, name: String(i?.name || i?.id || '').slice(0, 30), sess: !!i?.sess })).filter((i) => okSym(i.id));
    const mute = (Array.isArray(x.mute) ? x.mute : []).slice(0, 80).map((m) => String(m).slice(0, 60));
    return { on: !!x.on, watch: !!x.watch, digest: !!x.digest, dayBreaks: !!x.dayBreaks, news: !!x.news, spikeOnly: !!x.spikeOnly, minProb: Math.max(70, Math.min(95, Number(x.minProb) || 75)), tf, items, mute };
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
    if (u === '/inbox/pull') { const us = me(s.pid), since = Number(b.since) || 0; return { items: us.inbox.filter((i) => i.id > since), seq: us.seq, ack: us.ack, unread: unread(us) }; }
    if (u === '/inbox/ack') { const us = me(s.pid); us.ack = Math.max(us.ack, Math.min(us.seq, Number(b.upTo) || 0)); save(); return { ok: true, unread: unread(us) }; }
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
    handle, push, pushDigest, drop: (pid) => { delete st.users[pid]; save(); },
    start() { timers.push(setInterval(checkPrices, PRICE_MS), setInterval(runScan, SCAN_MS), setInterval(flushPending, RETRY_MS), setInterval(checkReceipts, 300000), setInterval(checkDayBreaks, DAY_MS), setInterval(checkNews, NEWS_MS)); log(`background alerts on: prices every ${PRICE_MS / 1000}s, scanner every ${SCAN_MS / 1000}s${analyze ? '' : ' (scanner off)'}, daily high/low breaks every ${DAY_MS / 1000}s, news every ${NEWS_MS / 1000}s`); },
    stop() { timers.forEach(clearInterval); },
    _test: { checkPrices, runScan, flushPending, checkReceipts, checkDayBreaks, checkNews, state: () => st },
  };
}

