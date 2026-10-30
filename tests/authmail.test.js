// Branded account emails: templates, sending, one-time link requests, limits. Run: node tests/authmail.test.js
const crypto = require('crypto'), fs = require('fs'), path = require('path');
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };

const mailPath = path.join(__dirname, '../server/mail.js'), amPath = path.join(__dirname, '../server/authmail.js');
const fresh = () => { delete require.cache[mailPath]; delete require.cache[amPath]; return require(amPath); };
const mail = require(mailPath);

// ---- templates ----
const names = Object.keys(mail.SUBJECT);
ok(names.length === 3 && names.every((n) => fs.existsSync(path.join(__dirname, '../server/emails', n + '.html'))), 'three templates exist: confirm-signup, reset-password, change-email');
const vars = { ConfirmationURL: 'https://s.netlify.app/?mode=x&oobCode=A', Email: 'a@b.com', NewEmail: 'n@b.com', Token: '123456', SiteURL: 'https://s.netlify.app' };
ok(names.every((n) => { const m = mail.render(n, vars); return !/\{\{/.test(m.html) && m.html.includes('Chart') && m.subject; }), 'every template renders with no placeholder left');
ok(mail.render('change-email', vars).html.includes('n@b.com'), 'new-email placeholder is filled');
const evil = mail.render('reset-password', { ...vars, Email: '<script>alert(1)</script>' }).html;
ok(!evil.includes('<script>') && evil.includes('&lt;script&gt;'), 'values are HTML-escaped (no markup injection)');
ok(mail.render('reset-password', vars).html.includes('href="https://s.netlify.app/?mode=x&amp;oobCode=A"'), 'link is placed in the button, & escaped for HTML');

(async () => {
  // ---- not configured ----
  for (const k of ['FIREBASE_SERVICE_ACCOUNT', 'AUTH_PAGE_URL', 'MAIL_FROM', 'RESEND_API_KEY', 'BREVO_API_KEY']) delete process.env[k];
  let sent = [], calls = [], fbUsers = { 'x@y.com': true };
  const upstream = async (url, o) => {
    calls.push({ url, o });
    if (url === 'https://oauth2.googleapis.com/token') {
      const a = new URLSearchParams(o.body).get('assertion').split('.');
      const good = crypto.createVerify('RSA-SHA256').update(a[0] + '.' + a[1]).verify(publicKey, Buffer.from(a[2], 'base64url'));
      const c = JSON.parse(Buffer.from(a[1], 'base64url'));
      return { ok: good && c.iss === 'svc@p.iam.gserviceaccount.com' && c.aud === 'https://oauth2.googleapis.com/token', json: async () => ({ access_token: 'AT1', expires_in: 3600 }) };
    }
    const body = JSON.parse(o.body);
    if (!fbUsers[body.email]) return { ok: false, json: async () => ({ error: { message: 'EMAIL_NOT_FOUND' } }) };
    return { ok: true, json: async () => ({ email: body.email, oobLink: 'https://p.firebaseapp.com/__/auth/action?mode=x&oobCode=CODE123&apiKey=k' }) };
  };
  const verifyFirebase = async (t) => { const p = JSON.parse(t); if (p.bad) throw new Error('Login expired'); return p; };
  let am = fresh()({ verifyFirebase, upstream, project: 'proj' });
  let r = await am.handle('/auth/reset', { email: 'x@y.com' }, '1.1.1.1');
  ok(r.status === 503 && r.body.error === 'MAIL_NOT_SET_UP', 'not configured: 503 MAIL_NOT_SET_UP (the app then uses the Firebase email)');

  // ---- configured: Resend ----
  process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ client_email: 'svc@p.iam.gserviceaccount.com', private_key: pem });
  process.env.AUTH_PAGE_URL = 'https://site.netlify.app/'; process.env.MAIL_FROM = 'Chart Reader <no-reply@site.com>'; process.env.RESEND_API_KEY = 're_x';
  const realFetch = global.fetch;
  global.fetch = async (url, o) => { sent.push({ url, h: o.headers, b: JSON.parse(o.body) }); return { ok: true, status: 200, json: async () => ({}) }; };
  am = fresh()({ verifyFirebase, upstream, project: 'proj' });
  r = await am.handle('/auth/reset', { email: ' X@Y.com ' }, '1.1.1.1');
  const tokenCall = calls.find((c) => c.url.includes('oauth2')), oob = calls.find((c) => c.url.includes('sendOobCode'));
  ok(r.status === 200 && sent.length === 1 && sent[0].url === 'https://api.resend.com/emails' && sent[0].b.to[0] === 'x@y.com' && sent[0].h.authorization === 'Bearer re_x', 'reset: one email sent through Resend to the (cleaned) address');
  ok(!!tokenCall && !!oob && oob.url.includes('/projects/proj/accounts:sendOobCode') && oob.o.headers.authorization === 'Bearer AT1' && JSON.parse(oob.o.body).requestType === 'PASSWORD_RESET' && JSON.parse(oob.o.body).returnOobLink === true, 'Firebase asked for a code only (returnOobLink), with a correctly signed service-account token');
  ok(sent[0].b.html.includes('https://site.netlify.app/?mode=resetPassword&amp;oobCode=CODE123&amp;lang=en') && /Reset/.test(sent[0].b.subject), 'the email links to the Netlify page with mode + code');
  const before = sent.length;
  r = await am.handle('/auth/reset', { email: 'nobody@y.com' }, '2.2.2.2');
  ok(r.status === 200 && sent.length === before, 'unknown email: same answer, nothing sent (nobody can probe which emails exist)');
  await am.handle('/auth/reset', { email: 'x@y.com' }, '3.3.3.3'); await am.handle('/auth/reset', { email: 'x@y.com' }, '3.3.3.3');
  r = await am.handle('/auth/reset', { email: 'x@y.com' }, '3.3.3.3');
  ok(r.status === 429, 'the 4th reset for one mailbox within an hour is refused');
  r = await am.handle('/auth/reset', { email: 'not-an-email' }, '4.4.4.4'); ok(r.status === 400, 'bad address refused');

  // ---- verify + change email ----
  sent.length = 0; fbUsers['u@y.com'] = true; fbUsers['u2@y.com'] = true;
  const idt = (o) => JSON.stringify({ sub: 'uid1', email: 'u@y.com', email_verified: false, auth_time: Date.now() / 1000, ...o });
  r = await am.handle('/auth/verify', { idToken: idt({ email_verified: true }) }, '5.5.5.5');
  ok(r.body.already && sent.length === 0, 'verify: already verified, no email');
  r = await am.handle('/auth/verify', { idToken: idt() }, '5.5.5.5');
  ok(r.status === 200 && sent[0].b.to[0] === 'u@y.com' && /Confirm your Chart Reader account/.test(sent[0].b.subject), 'verify: confirmation email to the logged-in address');
  sent.length = 0;
  r = await am.handle('/auth/change-email', { idToken: idt({ auth_time: Date.now() / 1000 - 4000 }), newEmail: 'u2@y.com' }, '6.6.6.6');
  ok(r.status === 401 && sent.length === 0, 'change email: an old login is refused (password must be re-entered first)');
  r = await am.handle('/auth/change-email', { idToken: idt({ sub: 'uid9' }), newEmail: 'u2@y.com' }, '6.6.6.6');
  const rq = JSON.parse(calls[calls.length - 1].o.body);
  ok(r.status === 200 && sent[0].b.to[0] === 'u2@y.com' && rq.requestType === 'VERIFY_AND_CHANGE_EMAIL' && rq.newEmail === 'u2@y.com' && sent[0].b.html.includes('u@y.com'), 'change email: the confirmation goes to the NEW address and names both');
  r = await am.handle('/auth/change-email', { idToken: idt({ sub: 'uid8' }), newEmail: 'u@y.com' }, '7.7.7.7'); ok(r.status === 400, 'change email to the same address refused');
  let threw = false; try { await am.handle('/auth/verify', { idToken: JSON.stringify({ bad: 1 }) }, '8.8.8.8'); } catch { threw = true; } ok(threw, 'a bad login token is rejected');

  // ---- Brevo ----
  delete process.env.RESEND_API_KEY; process.env.BREVO_API_KEY = 'xkeysib'; sent.length = 0;
  am = fresh()({ verifyFirebase, upstream, project: 'proj' });
  await am.handle('/auth/reset', { email: 'x@y.com' }, '9.9.9.9');
  ok(sent[0]?.url === 'https://api.brevo.com/v3/smtp/email' && sent[0].h['api-key'] === 'xkeysib' && sent[0].b.sender.email === 'no-reply@site.com' && sent[0].b.sender.name === 'Chart Reader' && sent[0].b.htmlContent.includes('CODE123'), 'Brevo works too (sender parsed from MAIL_FROM)');
  global.fetch = realFetch;
  console.log(fails ? `\n${fails} FAILED` : '\nall account email tests passed'); process.exit(fails ? 1 : 0);
})();
