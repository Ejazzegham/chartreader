// One email = one phone + one computer at a time (the website counts as a computer). Spawns the real server with a fake Firebase.
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

  // one person (uid1 / u1@x.com) on different devices. kind: 'mobile' | 'web'; fresh: true = typed the password just now, false = background renewal
  const dev = async (device, kind, fresh, who = 1) => { const r = await fetch(`http://127.0.0.1:${PORT}/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken: token('uid' + who, `u${who}@x.com`), deviceId: device, ...(kind ? { kind } : {}), ...(fresh === undefined ? {} : { fresh }) }) }); return { status: r.status, j: await r.json() }; };
  const status = async (tok) => { const r = await fetch(`http://127.0.0.1:${PORT}/status`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: '{}' }); return { status: r.status, j: await r.json() }; };

  const phoneA = await dev('phone-A-device', 'mobile', true), webA = await dev('laptop-A-device', 'web', true);
  await ok('a phone and a computer can be signed in at the same time', async () => { assert.equal(phoneA.status, 200); assert.equal(webA.status, 200); assert.equal((await status(phoneA.j.token)).status, 200); assert.equal((await status(webA.j.token)).status, 200); });

  const phoneB = await dev('phone-B-device', 'mobile', true);
  await ok('a second phone signs in: it works', async () => { assert.equal(phoneB.status, 200); assert.equal((await status(phoneB.j.token)).status, 200); });
  await ok('...and the FIRST phone is signed out (clear message, code replaced)', async () => { const r = await status(phoneA.j.token); assert.equal(r.status, 401); assert.equal(r.j.code, 'replaced'); assert.match(r.j.error, /another phone/); });
  await ok('...the computer is not touched by the new phone', async () => { assert.equal((await status(webA.j.token)).status, 200); });
  await ok('the signed-out phone cannot slip back in by a background renewal', async () => { const r = await dev('phone-A-device', 'mobile', false); assert.equal(r.status, 401); assert.equal(r.j.code, 'replaced'); });
  await ok('...an older app (no kind / fresh) cannot ping-pong either', async () => { const r = await dev('phone-A-device', undefined, undefined); assert.equal(r.status, 401); assert.equal(r.j.code, 'replaced'); });
  await ok('...and the phone that is signed in keeps working after a background renewal', async () => { const r = await dev('phone-B-device', 'mobile', false); assert.equal(r.status, 200); assert.equal((await status(r.j.token)).status, 200); });

  const webB = await dev('laptop-B-device', 'web', true);
  await ok('a second computer signs in: the first computer is signed out, the phone stays', async () => { assert.equal(webB.status, 200); const old = await status(webA.j.token); assert.equal(old.status, 401); assert.equal(old.j.code, 'replaced'); assert.match(old.j.error, /another computer/); assert.equal((await status(phoneB.j.token)).status, 200); assert.equal((await status(webB.j.token)).status, 200); });

  await ok('the person types the password again on the signed-out phone: it comes back (and the other phone goes out)', async () => { const r = await dev('phone-A-device', 'mobile', true); assert.equal(r.status, 200); assert.equal((await status(r.j.token)).status, 200); assert.equal((await status(phoneB.j.token)).j.code, 'replaced'); });

  await ok('a different email is never affected', async () => { const other = await dev('phone-A-device-2', 'mobile', true, 2); assert.equal(other.status, 200); assert.equal((await status(phoneA.j.token)).status, 200); assert.equal((await status(other.j.token)).status, 200); });

  await ok('a background renewal from a brand-new phone cannot take the place of the signed-in phone', async () => { const r = await dev('phone-C-device', 'mobile', false); assert.equal(r.status, 401); assert.equal(r.j.code, 'replaced'); assert.equal((await status(phoneA.j.token)).status, 200); });

  srv.kill(); certs.close();
  if (fails) { console.log(fails + ' FAILED'); process.exit(1); }
  console.log('device limit test passed'); process.exit(0);
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
