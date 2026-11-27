// Account emails in our own design. Firebase makes the one-time link (service account, REST), we send the email, and the link opens the email page (auth-page/, on Firebase Hosting).
// Nothing here is needed for the app to work: if it is not set up, the app falls back to Firebase's own emails.
//   FIREBASE_SERVICE_ACCOUNT  = the JSON of a service account key (Firebase console > Project settings > Service accounts > Generate new private key), or
//   FIREBASE_SERVICE_ACCOUNT_FILE = path to that file
//   AUTH_PAGE_URL = https://chart-reader-45c13.web.app      (the email page, no trailing slash)
const crypto = require('crypto'), fs = require('fs');
const mail = require('./mail');

module.exports = ({ verifyFirebase, upstream, project }) => {
  let sa = null;
  const account = () => {
    if (sa) return sa;
    try {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT || (process.env.FIREBASE_SERVICE_ACCOUNT_FILE ? fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_FILE, 'utf8') : '');
      const j = raw ? JSON.parse(raw) : null;
      if (j && j.client_email && j.private_key) sa = j;
    } catch {}
    return sa;
  };
  const pageUrl = () => String(process.env.AUTH_PAGE_URL || '').replace(/\/+$/, '');
  const ready = () => !!account() && !!pageUrl() && mail.configured() && !!project;

  // Google OAuth access token for the service account (signed JWT, valid ~1 h, kept until it is about to expire)
  let tok = { v: '', exp: 0 };
  async function accessToken() {
    if (tok.v && Date.now() < tok.exp - 60e3) return tok.v;
    const a = account(), now = Math.floor(Date.now() / 1000), b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const head = b64({ alg: 'RS256', typ: 'JWT' }), claim = b64({ iss: a.client_email, scope: 'https://www.googleapis.com/auth/identitytoolkit', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
    const sig = crypto.createSign('RSA-SHA256').update(head + '.' + claim).sign(a.private_key).toString('base64url');
    const r = await upstream('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: head + '.' + claim + '.' + sig }).toString() }, 15000);
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw new Error('Could not get a Google access token');
    tok = { v: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
    return tok.v;
  }

  const MODE = { PASSWORD_RESET: 'resetPassword', VERIFY_EMAIL: 'verifyEmail', VERIFY_AND_CHANGE_EMAIL: 'verifyAndChangeEmail' };
  // Asks Firebase for a one-time code (it sends nothing itself) and builds the link to our email page (auth-page/).
  async function makeLink(requestType, email, newEmail) {
    const r = await upstream(`https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(project)}/accounts:sendOobCode`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (await accessToken()) },
      body: JSON.stringify({ requestType, email, ...(newEmail ? { newEmail } : {}), returnOobLink: true }),
    }, 15000);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j?.error?.message || 'Firebase refused'), { fb: String(j?.error?.message || '') });
    let code = j.oobCode;
    if (!code && j.oobLink) { try { code = new URL(j.oobLink).searchParams.get('oobCode'); } catch {} }
    if (!code) throw new Error('Firebase sent no code');
    return `${pageUrl()}/?mode=${MODE[requestType]}&oobCode=${encodeURIComponent(code)}&lang=en`;
  }

  // limits (in memory): a mailbox can not be flooded, and nobody can use us to spam
  const hits = new Map();
  const limited = (key, max, ms = 3600e3) => { const n = Date.now(), a = (hits.get(key) || []).filter((t) => n - t < ms); if (a.length >= max) { hits.set(key, a); return true; } a.push(n); hits.set(key, a); if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => n - t < ms)) hits.delete(k); return false; };
  const TOO_MANY = { status: 429, body: { error: 'Too many requests. Try again in a while.' } };
  const NOT_SET = { status: 503, body: { error: 'MAIL_NOT_SET_UP' } };
  const OK = { status: 200, body: { ok: true } };
  const validEmail = (e) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(e) && e.length <= 254;

  async function handle(path, b, ip) {
    if (!ready()) return NOT_SET;
    if (path === '/auth/reset') { // public: the person is logged out. The answer is always the same, so nobody can find out which emails have an account.
      const email = String(b.email || '').trim().toLowerCase();
      if (!validEmail(email)) return { status: 400, body: { error: 'Enter a valid email address.' } };
      if (limited('ip:' + ip, 20) || limited('reset:' + email, 3)) return TOO_MANY;
      try { await mail.send(email, 'reset-password', { ConfirmationURL: await makeLink('PASSWORD_RESET', email), SiteURL: pageUrl() }); }
      catch (e) { if (!/EMAIL_NOT_FOUND|USER_NOT_FOUND/.test(e.fb || '')) { console.log('auth mail (reset) failed: ' + e.message); return { status: 502, body: { error: 'Could not send the email.' } }; } }
      return OK;
    }
    if (path === '/auth/verify' || path === '/auth/change-email') {
      const fb = await verifyFirebase(b.idToken, { allowUnverified: true }); // an unverified person must be able to ask for the link
      if (limited('uid:' + fb.sub, 6) || limited('ip:' + ip, 30)) return TOO_MANY;
      const email = String(fb.email).toLowerCase();
      if (path === '/auth/verify') {
        if (fb.email_verified) return { status: 200, body: { ok: true, already: true } };
        await mail.send(email, 'confirm-signup', { ConfirmationURL: await makeLink('VERIFY_EMAIL', email), SiteURL: pageUrl() });
        return OK;
      }
      const next = String(b.newEmail || '').trim().toLowerCase();
      if (!validEmail(next) || next === email) return { status: 400, body: { error: 'Enter a valid new email address.' } };
      if (!(Date.now() / 1000 - Number(fb.auth_time || 0) < 300)) return { status: 401, body: { error: 'Please confirm your password again.' } }; // the app re-checks the password just before this call
      await mail.send(next, 'change-email', { ConfirmationURL: await makeLink('VERIFY_AND_CHANGE_EMAIL', email, next), SiteURL: pageUrl(), Email: email, NewEmail: next });
      return OK;
    }
    return { status: 404, body: { error: 'Not found' } };
  }
  return { handle, ready };
};
