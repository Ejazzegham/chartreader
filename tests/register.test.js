// /register end to end: a trial that already ran on the phone while the server was off is not started again from zero.
// Spawns the real server. A fake Firebase "certificate" server and a signed token stand in for Google. Run: node tests/register.test.js
const assert = require('assert'), http = require('http'), crypto = require('crypto'), os = require('os'), path = require('path'), { spawn } = require('child_process');
const DAY = 864e5, PROJECT = 'test-project', PORT = 18000 + Math.floor(Math.random() * 1000), CERT_PORT = PORT + 1000;
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const token = (uid, email) => { const now = Math.floor(Date.now() / 1000), h = b64({ alg: 'RS256', kid: 'k1' }), p = b64({ aud: PROJECT, iss: 'https://securetoken.google.com/' + PROJECT, sub: uid, email, email_verified: true, iat: now - 5, exp: now + 3600 }); return h + '.' + p + '.' + crypto.createSign('RSA-SHA256').update(h + '.' + p).sign(privateKey).toString('base64url'); };
let fails = 0; const ok = async (n, f) => { try { await f(); console.log('ok  ', n); } catch (e) { fails++; console.log('FAIL', n, '-', e.message); } };

(async () => {
  const certs = http.createServer((_q, r) => { r.setHeader('content-type', 'application/json'); r.end(JSON.stringify({ k1: publicKey.export({ type: 'spki', format: 'pem' }) })); }).listen(CERT_PORT);
  const srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT: String(PORT), DB_FILE: path.join(os.tmpdir(), 'reg-' + Date.now() + '.json'), FIREBASE_PROJECT_ID: PROJECT, FIREBASE_CERTS_URL: `http://127.0.0.1:${CERT_PORT}/`, TRIALS_PER_IP_DAY: '99' }, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((res, rej) => { srv.stdout.on('data', (d) => /license server on/.test(String(d)) && res()); srv.on('exit', () => rej(new Error('server did not start'))); setTimeout(() => rej(new Error('server start timeout')), 8000); });
  const reg = async (n, extra = {}) => { const r = await fetch(`http://127.0.0.1:${PORT}/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken: token('uid' + n, `u${n}@x.com`), deviceId: 'device-number-' + n, ...extra }) }); return { status: r.status, j: await r.json() }; };
  const left = (j) => (j.trialEnd - j.now) / DAY;

  await ok('no claim (normal online signup): a full 3-day trial, as before', async () => { const { j } = await reg(1); assert.equal(j.status, 'trial'); assert.ok(Math.abs(left(j) - 3) < 0.01, 'left ' + left(j)); });
  await ok('signed up 1 day ago while the server was off: only 2 days are left', async () => { const { j } = await reg(2, { accountCreated: Date.now() - DAY }); assert.equal(j.status, 'trial'); assert.ok(Math.abs(left(j) - 2) < 0.01, 'left ' + left(j)); });
  await ok('claim older than a whole trial (long outage, locked out): a fresh trial instead of nothing', async () => { const { j } = await reg(3, { accountCreated: Date.now() - 10 * DAY }); assert.equal(j.status, 'trial'); assert.ok(Math.abs(left(j) - 3) < 0.01); });
  await ok('claim in the future cannot lengthen the trial', async () => { const { j } = await reg(4, { accountCreated: Date.now() + 5 * DAY }); assert.ok(left(j) <= 3.001, 'left ' + left(j)); });
  await ok('junk claim is ignored', async () => { const { j } = await reg(5, { accountCreated: 'tomorrow' }); assert.equal(j.status, 'trial'); assert.ok(left(j) <= 3.001); });
  await ok('a known account logging in again keeps its record (the claim is not used twice)', async () => { const a = (await reg(2, { accountCreated: Date.now() - 0.1 * DAY })).j; assert.ok(Math.abs(left(a) - 2) < 0.02, 'left ' + left(a)); });

  srv.kill(); certs.close();
  if (fails) { console.log(fails + ' FAILED'); process.exit(1); }
  console.log('register test passed'); process.exit(0);
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
