// Chart Reader license server. Zero dependencies (Node 18+):  FIREBASE_PROJECT_ID=your-project ADMIN_EMAILS=you@x.com GEMINI_API_KEY=... node server.js
// Login is done by Firebase Auth in the app; this server only verifies the Firebase ID token and then handles trials, payments, admin and the Gemini proxy.
const http = require('http'), fs = require('fs'), crypto = require('crypto');
const PORT = process.env.PORT || 8080, DBF = process.env.DB_FILE || './db.json';
// Admin = an email on this list AND confirmed by Firebase (the owner clicked the link in the mailbox). No passcode.
const ADMINS = ['bahutechnology@gmail.com', ...(process.env.ADMIN_EMAILS || '').toLowerCase().split(',')].map((s) => s.trim()).filter(Boolean);
const FB_PROJECT = process.env.FIREBASE_PROJECT_ID || '';                 // Firebase console > Project settings > Project ID
const REQUIRE_VERIFIED = process.env.REQUIRE_VERIFIED_EMAIL === '1';      // optional: only accept emails the user has confirmed
const FB_CERTS_URL = process.env.FIREBASE_CERTS_URL || 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const MAX_BODY = 12 * 1024 * 1024, DAILY_AI = Number(process.env.DAILY_AI_LIMIT || 60), TRIALS_PER_IP_DAY = Number(process.env.TRIALS_PER_IP_DAY || 5); // mobile carriers share one IP between many phones: raise this if real users get blocked
const TRIAL = 3 * 864e5, DAY = 864e5;
const TRON = 'TKvEQSzioWQGZBHdrzSLGWUnmQhJsEHUhA', BSC = '0xd7065772295fb0d563c1c6b00e4464bcd4b03f81';
const USDT_TRON = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', USDT_BSC = '0x55d398326f99059ff775485246999027b3197955';
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

let db = { people: {}, emails: {}, ipTrials: {}, devices: {}, sessions: {}, tx: {}, usage: {}, geminiKey: process.env.GEMINI_API_KEY || '', model: '', secret: '' };
try { db = { ...db, ...JSON.parse(fs.readFileSync(DBF, 'utf8')) }; } catch {}
for (const [em, pid] of Object.entries(db.emails || {})) { const p = db.people[pid]; if (p && !p.email) p.email = em; } // old records: the email lived only in db.emails, so the admin list showed "?"
if (!db.secret) db.secret = process.env.TOKEN_SECRET || crypto.randomBytes(32).toString('hex');
const SECRET = db.secret;
const save = () => { const t = DBF + '.tmp'; fs.writeFileSync(t, JSON.stringify(db)); fs.renameSync(t, DBF); }; // atomic write: a crash never leaves a half-written db
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
// Behind a tunnel / reverse proxy (Cloudflare, ngrok, nginx) every request comes from the proxy's own address, so set TRUST_PROXY=1 to read the real client IP.
// Without it the per-IP trial limit would treat ALL users as one person.
const TRUST = ['1', 'true', 'yes'].includes(String(process.env.TRUST_PROXY || '').toLowerCase()); // TRUST_PROXY=0 used to count as ON
const ipOf = (req) => (TRUST ? String(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '') || req.socket.remoteAddress;
// Cloud backup of each person's paper-trading data (journal, setups, desk, history, settings). One file per person in <DB_FILE>.sync/, so db.json stays small.
// It survives an app uninstall because it lives here, tied to the person (Firebase uid / email), not to the phone. It is removed only when the person deletes the account.
const SYNC_DIR = DBF + '.sync', MAX_SYNC = 4 * 1024 * 1024;
const syncFile = (pid) => { if (!/^[\w-]+$/.test(String(pid))) throw new Error('Bad id'); return SYNC_DIR + '/' + pid + '.json'; };
const syncRead = (pid) => { try { return JSON.parse(fs.readFileSync(syncFile(pid), 'utf8')); } catch { return null; } };
const syncWrite = (pid, rec) => { fs.mkdirSync(SYNC_DIR, { recursive: true }); const f = syncFile(pid), t = f + '.tmp'; fs.writeFileSync(t, JSON.stringify(rec)); fs.renameSync(t, f); };
const byUid = (uid) => Object.keys(db.people).find((k) => db.people[k].uid === uid && !db.people[k].deleted);
const cleanPhone = (v) => { const x = String(v || '').trim(); if (!x) return ''; if (!/^\+?[0-9][0-9 ()\-]{5,18}[0-9]$/.test(x)) throw new Error('Enter a valid phone number, for example +92 300 1234567'); return x; };
const cleanName = (v) => String(v || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 60);
const proxy = require('./proxy')(); // GET /proxy?u=... for the website (browsers block most sites)
const upstream = (u, o = {}, ms = 30000) => fetch(u, { ...o, signal: AbortSignal.timeout(ms) }); // every outgoing call has a time limit

// Background alerts (price levels + scanner) delivered as push notifications. See alerts.js
const alerts = require('./alerts')({ file: DBF + '.alerts.json', live: (pid) => { const p = db.people[pid], n = Date.now(); return !!p && !p.deleted && (n < Math.max(p.paidUntil || 0, p.trialEnd || 0) || ADMINS.includes(p.email)); } });

const lic = (pid, admin, token, email) => {
  const p = db.people[pid], now = Date.now();
  const status = admin ? 'admin' : now < p.paidUntil ? 'paid' : now < p.trialEnd ? 'trial' : 'expired';
  return { token, admin, status, entitled: status !== 'expired', trialEnd: p.trialEnd, paidUntil: p.paidUntil, adminEmail: !!email && ADMINS.includes(email) && !admin };
};
const session = (req, body) => {
  const tok = (req.headers.authorization || '').replace('Bearer ', '') || body?.token, s = db.sessions[tok];
  return s && db.people[s.pid] ? { ...s, admin: !!s.admin && ADMINS.includes(s.email), token: tok } : null; // removed from the admin list = admin rights end at once
};

// --- Firebase ID token check (RS256 JWT signed by Google). No SDK needed: we check the signature against Google's public certs. ---
let certs = { at: 0, keys: {} };
async function fbCert(kid) {
  const age = Date.now() - certs.at;
  // refresh hourly, or when an unknown key id shows up (Google rotates keys) - but never more than once a minute, so junk tokens cannot make us hammer Google
  if ((!certs.keys[kid] && age > 60e3) || age > 36e5) { certs = { at: Date.now(), keys: await (await upstream(FB_CERTS_URL, {}, 10000)).json() }; }
  return certs.keys[kid];
}
async function verifyFirebase(idToken) {
  if (!FB_PROJECT) throw new Error('Server is missing FIREBASE_PROJECT_ID');
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) throw new Error('Please log in again');
  let h, p;
  try { h = JSON.parse(Buffer.from(parts[0], 'base64url')); p = JSON.parse(Buffer.from(parts[1], 'base64url')); } catch { throw new Error('Please log in again'); }
  const pem = h.alg === 'RS256' && h.kid ? await fbCert(h.kid) : null, now = Date.now() / 1000;
  const ok = !!pem && crypto.createVerify('RSA-SHA256').update(parts[0] + '.' + parts[1]).verify(crypto.createPublicKey(pem), Buffer.from(parts[2], 'base64url'));
  if (!ok || p.aud !== FB_PROJECT || p.iss !== 'https://securetoken.google.com/' + FB_PROJECT || !p.sub || !(p.exp > now) || p.iat > now + 300) throw new Error('Login expired, please log in again');
  if (!p.email) throw new Error('This account has no email');
  if (REQUIRE_VERIFIED && !p.email_verified) throw new Error('Please confirm your email address first');
  return p;
}

async function register(req, b) {
  const dev = String(b.deviceId || ''), ip = ipOf(req);
  const fb = await verifyFirebase(b.idToken), uid = String(fb.sub), verified = fb.email_verified === true;
  const email = String(fb.email).trim().toLowerCase(); // the email comes from the verified Firebase token, not from the client
  if (dev.length < 8) throw new Error('Invalid request');
  // One person = one trial. A known email or known device is the same person. A shared IP (mobile carriers share one address between thousands of phones) is NOT, otherwise strangers would share a trial or a paid plan.
  let pid = byUid(uid) || db.emails[email] || db.devices[dev];
  if (!pid) {
    const day = new Date().toISOString().slice(0, 10), k = ip + ':' + day;
    db.ipTrials[k] = (db.ipTrials[k] || 0) + 1;
    for (const x of Object.keys(db.ipTrials)) if (!x.endsWith(day)) delete db.ipTrials[x];
    if (db.ipTrials[k] > TRIALS_PER_IP_DAY) throw new Error('Too many new accounts from this network today. Try again tomorrow.');
    pid = crypto.randomUUID(); db.people[pid] = { trialEnd: Date.now() + TRIAL, paidUntil: 0, created: Date.now(), email };
  }
  // Firebase lets anybody sign up with ANY email address without proving they own it. So the first Firebase account to claim a record owns it (uid),
  // and a different uid may only take it over after proving the email by clicking the verification link.
  const person = db.people[pid];
  if (person.deleted) { person.uid = uid; person.deleted = 0; } // an account that was deleted may be created again by whoever signs up with that email
  if (person.uid && person.uid !== uid) {
    if (!verified) throw new Error('This email is already registered with another login. Confirm your email address first (check your inbox), then try again.');
    person.uid = uid;
  }
  person.uid ||= uid;
  if (person.uid === uid) person.email = email; // the person changed their email in the app: keep the record in step
  db.emails[email] = pid; db.devices[dev] = pid;
  person.email ||= email; person.last = Date.now();
  // Admin needs an email on the admin list that is CONFIRMED. Anyone can type an admin's address into the sign-up form; only the owner can click the link in the mailbox.
  const admin = ADMINS.includes(email) && verified;
  const token = crypto.createHmac('sha256', SECRET).update(pid + ':' + dev + ':' + admin).digest('hex');
  db.sessions[token] = { pid, admin, email }; save();
  return { ...lic(pid, admin, token, email), emailVerified: verified };
}

const jf = async (u, o) => (await upstream(u, o, 15000)).json();
async function verify(network, txid) {
  if (network === 'TRON') {
    const r = await jf(`https://api.trongrid.io/v1/accounts/${TRON}/transactions/trc20?only_to=true&limit=200&contract_address=${USDT_TRON}`);
    const t = (r.data || []).find((x) => x.transaction_id === txid && x.to === TRON);
    return t ? Number(t.value) / 10 ** Number(t.token_info.decimals) : 0;
  }
  const r = (await jf('https://bsc-dataseed.binance.org', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionReceipt', params: [txid] }) })).result;
  if (!r || r.status !== '0x1') return 0;
  const l = r.logs.find((x) => x.address.toLowerCase() === USDT_BSC && x.topics[0] === TRANSFER && x.topics[2]?.toLowerCase().endsWith(BSC.slice(2)));
  return l ? Number(BigInt(l.data) / 10n ** 14n) / 1e4 : 0;
}
async function pay(s, b) {
  const network = b.network === 'TRON' ? 'TRON' : 'BSC', txid = String(b.txid || '').trim().toLowerCase().replace(/^([0-9a-f]{64})$/, network === 'BSC' ? '0x$1' : '$1');
  if (txid.length < 32) throw new Error('Enter the transaction hash (TxID)');
  if (db.tx[txid] && !(db.tx[txid].pending && Date.now() - db.tx[txid].at > 120e3)) throw new Error(db.tx[txid].pending ? 'This payment is being checked. Wait a moment.' : 'This transaction was already used');
  db.tx[txid] = { pid: s.pid, email: s.email, network, usd: 0, days: 0, at: Date.now(), pending: true }; // reserve it BEFORE the slow lookup, so two quick taps cannot both be paid
  let usd = 0;
  try { usd = await verify(network, txid); } catch (e) { delete db.tx[txid]; throw e; }
  if (usd < 7.9) { delete db.tx[txid]; throw new Error('No matching USDT payment found yet. Wait 1-2 minutes after sending and try again.'); }
  const months = Math.floor((usd + 0.1) / 20), days = months * 30 + Math.floor((usd + 0.1 - months * 20) / 8) * 7;
  const p = db.people[s.pid]; p.paidUntil = Math.max(Date.now(), p.paidUntil) + days * DAY;
  db.tx[txid] = { pid: s.pid, email: s.email, network, usd, days, at: Date.now() }; save();
  return lic(s.pid, s.admin, s.token, s.email);
}

http.createServer(async (req, res) => {
  const send = (c, o) => { res.writeHead(c, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type, ngrok-skip-browser-warning', 'access-control-allow-methods': 'GET, POST, OPTIONS' }); res.end(JSON.stringify(o)); };
  if (req.method === 'OPTIONS') return send(204, {});
  if (await proxy(req, res)) return; // the website's read-only proxy (server/proxy.js)
  if (req.method === 'GET' && req.url === '/health') return send(200, { ok: true, time: Date.now(), firebase: !!FB_PROJECT, geminiKey: !!db.geminiKey });
  const chunks = []; let size = 0;
  try { for await (const c of req) { size += c.length; if (size > MAX_BODY) { send(413, { error: 'Image too large' }); return req.destroy(); } chunks.push(c); } } catch { return send(400, { error: 'Bad request' }); }
  const raw = Buffer.concat(chunks).toString('utf8'); // joining Buffers first keeps multi-byte characters intact
  try {
    const b = raw ? JSON.parse(raw) : {}, s = session(req, b), u = req.url;
    if (u === '/register') return send(200, await register(req, b));
    if (!s) return send(401, { error: 'Session expired, please log in again' });
    if (u === '/status') return send(200, lic(s.pid, s.admin, s.token, s.email));
    if (u === '/pay') return send(200, await pay(s, b));
    if (u.startsWith('/push/') || u.startsWith('/alerts/')) { const r = await alerts.handle(u, s, b); if (r) return send(200, r); }
    if (u === '/sync/get') { const r = syncRead(s.pid), p = db.people[s.pid]; return send(200, { data: r ? r.data : null, updatedAt: r ? r.updatedAt : 0, profile: { name: p.name || '', phone: p.phone || '' } }); }
    if (u === '/sync/put') {
      const text = JSON.stringify(b.data ?? null);
      if (!b.data || typeof b.data !== 'object' || Array.isArray(b.data)) return send(400, { error: 'Nothing to save' });
      if (text.length > MAX_SYNC) return send(413, { error: 'Backup is too large' });
      const rec = { data: b.data, updatedAt: Date.now() }; syncWrite(s.pid, rec); return send(200, { ok: true, updatedAt: rec.updatedAt });
    }
    if (u === '/profile/put') { const p = db.people[s.pid]; const name = cleanName(b.name), phone = cleanPhone(b.phone); p.name = name; p.phone = phone; save(); return send(200, { ok: true, name, phone }); }
    if (u === '/account/delete') { // the person deletes the account: the backup, name and phone are erased. The trial / plan record stays (but is marked deleted) so a new trial cannot be farmed.
      const fb = await verifyFirebase(b.idToken), p = db.people[s.pid];
      if (p.uid && p.uid !== String(fb.sub)) return send(403, { error: 'Not your account' });
      try { fs.unlinkSync(syncFile(s.pid)); } catch {}
      alerts.drop(s.pid); delete p.name; delete p.phone; p.deleted = Date.now(); for (const [k, v] of Object.entries(db.sessions)) if (v.pid === s.pid) delete db.sessions[k];
      save(); return send(200, { ok: true });
    }
    if (u.startsWith('/admin/') && !s.admin) return send(403, { error: 'Admin only' });
    if (u === '/admin/key') { if (b.key) db.geminiKey = String(b.key).trim(); if (b.model) db.model = String(b.model).trim(); save(); return send(200, { ok: true, keySet: !!db.geminiKey, model: db.model }); }
    if (u === '/admin/stats') {
      const now = Date.now(), ps = Object.values(db.people), day = now - DAY;
      const st = (p) => (now < p.paidUntil ? 'paid' : now < p.trialEnd ? 'trial' : 'expired');
      const byPid = {}; for (const [em, pid] of Object.entries(db.emails)) byPid[pid] ||= em;
      const list = Object.entries(db.people).map(([id, p]) => ({ id, ...p })).sort((a, b) => (b.created || 0) - (a.created || 0)).map((p) => ({ id: p.id, email: p.email || byPid[p.id] || '(no email)', status: st(p), trialEnd: p.trialEnd, paidUntil: p.paidUntil, created: p.created || 0, last: p.last || 0 }));
      const pays = Object.entries(db.tx).filter(([, v]) => !v.pending).map(([txid, v]) => (typeof v === 'string'
        ? { txid, email: db.people[v]?.email || '?', network: '?', usd: 0, days: 0, at: 0 }
        : { txid, email: v.email || db.people[v.pid]?.email || '?', network: v.network || '?', usd: v.usd || 0, days: v.days || 0, at: v.at || 0 })).sort((a, b) => b.at - a.at);
      return send(200, { users: ps.length, paid: ps.filter((p) => now < p.paidUntil).length, trial: ps.filter((p) => now >= p.paidUntil && now < p.trialEnd).length, expired: ps.filter((p) => now >= p.paidUntil && now >= p.trialEnd).length, new24h: ps.filter((p) => p.created > day).length, payments: pays.length, revenue: Math.round(pays.reduce((a, x) => a + x.usd, 0) * 100) / 100, keySet: !!db.geminiKey, model: db.model, list, pays });
    }
    if (u === '/admin/grant') { // give free days to an email (support, gifts, refunds)
      const pid = db.emails[String(b.email || '').trim().toLowerCase()], days = Math.max(-365, Math.min(365, Number(b.days) || 0));
      if (!pid) return send(404, { error: 'No user with that email' });
      const p = db.people[pid]; p.paidUntil = Math.max(Date.now(), p.paidUntil) + days * DAY; if (days < 0) p.paidUntil = Math.max(0, p.paidUntil); save();
      return send(200, { ok: true, paidUntil: p.paidUntil });
    }
    if (u.startsWith('/gemini/')) {
      if (!lic(s.pid, s.admin, s.token).entitled) return send(402, { error: 'Free trial ended. Subscribe to unlock analysis.' });
      const model = db.model || decodeURIComponent(u.slice(8).split('?')[0]);
      if (!/^[\w.\-]+$/.test(model)) return send(400, { error: 'Bad model' });
      if (!db.geminiKey) return send(503, { error: 'Analysis is not available right now. Please try again later.' });
      const day = new Date().toISOString().slice(0, 10), uk = s.pid + ':' + day;
      if (!s.admin && (db.usage[uk] || 0) >= DAILY_AI) return send(429, { error: `Daily analysis limit (${DAILY_AI}) reached. Try again tomorrow.` });
      db.usage[uk] = (db.usage[uk] || 0) + 1; for (const x of Object.keys(db.usage)) if (!x.endsWith(day)) delete db.usage[x];
      let g;
      try { g = await upstream(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': db.geminiKey }, body: raw }, 90000); }
      catch (e) { db.usage[uk] = Math.max(0, db.usage[uk] - 1); return send(504, { error: e.name === 'TimeoutError' ? 'The analysis took too long. Try again.' : 'Could not reach the analysis service.' }); }
      if (!g.ok) db.usage[uk] = Math.max(0, (db.usage[uk] || 1) - 1); // a failed call does not use up the user's daily allowance
      const body = await g.text();
      if (!g.ok) { let m = ''; try { m = JSON.parse(body)?.error?.message || ''; } catch {} return send(g.status === 429 ? 429 : 502, { error: m || 'The analysis service returned an error (' + g.status + ').' }); }
      res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); return res.end(body);
    }
    send(404, { error: 'Not found' });
  } catch (e) { send(400, { error: e.message }); }
}).listen(PORT, () => { console.log('license server on ' + PORT); alerts.start(); });
