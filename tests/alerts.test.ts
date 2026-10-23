// Server background alerts: nothing may be lost when the push service is down, and every push carries the unread number for the app icon.
// Run: npx tsx --tsconfig tests/tsconfig.json tests/alerts.test.ts
declare const require: any;
declare const process: any;
const alertsModule: any = require('../server/alerts.js');
const os: any = require('os'), path: any = require('path'), fs: any = require('fs');

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };

const file = path.join(os.tmpdir(), 'alerts-test-' + process.pid + '.json');
let sent: any[] = [], mode: 'ok' | 'down' | 'badtoken' = 'ok';
let receipts: Record<string, any> = {}, logs: string[] = [];
const fetchFn = async (u: string, o: any) => {
  if (u.includes('getReceipts')) return { ok: true, status: 200, json: async () => ({ data: receipts }) };
  const msgs = JSON.parse(o.body); sent.push(...msgs);
  if (mode === 'down') return { ok: false, status: 503, json: async () => ({}) };
  if (mode === 'badtoken') return { ok: true, status: 200, json: async () => ({ data: msgs.map(() => ({ status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } })) }) };
  return { ok: true, status: 200, json: async () => ({ data: msgs.map(() => ({ status: 'ok', id: 'tk' + Math.random().toString(36).slice(2) })) }) };
};
let price = 100;
const feed = { price: async () => price, candles: async () => [] };
const mk = () => alertsModule({ file, live: () => true, feed, fetchFn, log: (m: string) => logs.push(m) });
const S = { pid: 'p1' }, TOKEN = 'ExponentPushToken[abc123]';

(async () => {
  const a = mk();
  await a.handle('/push/register', S, { token: TOKEN });
  await a.handle('/alerts/sync', S, { alerts: [{ id: 'a1', sym: 'frxXAUUSD', level: 105, dir: 'above', name: 'Gold' }, { id: 'a2', sym: 'frxXAUUSD', level: 106, dir: 'above', name: 'Gold' }] });

  // 1. a reached price level: push carries badge 1, a long ttl, and lands in the inbox
  price = 105.5; await a._test.checkPrices();
  ok(sent.length === 1 && sent[0].badge === 1, 'first push carries badge 1 (' + sent.map((x) => x.badge) + ')');
  ok(sent[0].ttl >= 3600 * 6, 'ttl is hours, not 15 minutes (' + sent[0]?.ttl + ')');
  let r = await a.handle('/inbox/pull', S, { since: 0 });
  ok(r.items.length === 1 && r.unread === 1 && r.items[0].id === 1, 'inbox has the notification');
  ok(sent[0].data.nid === 1, 'push data carries the inbox id (the app uses it to avoid a duplicate line)');
  ok(r.items[0].type === 'price' && r.items[0].sym === 'frxXAUUSD', 'price alert line in the inbox keeps its type and pair (the app opens that pair on a tap)');
  ok(sent[0].data.type === 'price' && sent[0].data.sym === 'frxXAUUSD', 'price push data carries type and sym (tap on the phone notification)');
  await a.push('p1', 'New setups', 'XAUUSD BUY 80%', { type: 'setup', symId: 'frxXAUUSD' });
  r = await a.handle('/inbox/pull', S, { since: 1 });
  ok(r.items.length === 1 && r.items[0].type === 'setup' && r.items[0].sym === 'frxXAUUSD', 'scanner setup line in the inbox keeps its pair (push sends symId)');
  ok(sent[sent.length - 1].data.symId === 'frxXAUUSD', 'setup push data carries symId');
  await a.handle('/inbox/ack', S, { upTo: 0 });
  // the checks below were written for exactly one earlier line: remove the extra setup line again
  { const u = a._test.state().users.p1; u.inbox = u.inbox.filter((i: any) => i.type !== 'setup'); u.seq -= 1; sent.pop(); }

  // 2. second alert: badge counts up
  price = 107; await a._test.checkPrices();
  ok(sent[1].badge === 2, 'second push carries badge 2');

  // 3. reading in the app resets the number
  r = await a.handle('/inbox/ack', S, { upTo: 2 });
  ok(r.unread === 0, 'ack clears the unread number');
  await a.handle('/alerts/sync', S, { alerts: [{ id: 'a3', sym: 'frxXAUUSD', level: 120, dir: 'above', name: 'Gold' }] });
  price = 121; sent = []; await a._test.checkPrices();
  ok(sent[0].badge === 1, 'badge starts again from 1 after reading');

  // 4. push service down: the alert is NOT lost, it is retried and arrives once
  await a.handle('/alerts/sync', S, { alerts: [{ id: 'a4', sym: 'frxXAUUSD', level: 130, dir: 'above', name: 'Gold' }] });
  price = 131; sent = []; mode = 'down'; await a._test.checkPrices();
  ok(sent.length === 1, 'first attempt was made');
  const before = a._test.state().users.p1.inbox.length;
  mode = 'ok'; sent = []; await a._test.flushPending();
  ok(sent.length === 1, 'the failed push was sent again');
  ok(a._test.state().users.p1.inbox.length === before, 'retry does not add a second inbox line');
  sent = []; await a._test.flushPending();
  ok(sent.length === 0, 'delivered once: nothing left to retry');

  // 5. a dead phone token is dropped and not retried forever
  await a.handle('/alerts/sync', S, { alerts: [{ id: 'a5', sym: 'frxXAUUSD', level: 140, dir: 'above', name: 'Gold' }] });
  price = 141; mode = 'badtoken'; await a._test.checkPrices();
  ok(a._test.state().users.p1.tokens.length === 0, 'unregistered phone token removed');
  sent = []; await a._test.flushPending();
  ok(sent.length === 0, 'no retry to a phone that is gone');

  // 6. pulling only what is new, and ids are kept in order
  r = await a.handle('/inbox/pull', S, { since: 2 });
  ok(r.items.every((i: any) => i.id > 2) && r.seq >= 5, 'pull returns only newer items');

  // 7. receipts: a failure that only shows up later (wrong Firebase key) is written to the log instead of being invisible
  await a.handle('/push/register', S, { token: TOKEN });
  await a.handle('/alerts/sync', S, { alerts: [{ id: 'a6', sym: 'frxXAUUSD', level: 150, dir: 'above', name: 'Gold' }] });
  price = 151; mode = 'ok'; await a._test.checkPrices();
  const rc = a._test.state().users.p1.receipts;
  ok(rc.length >= 1, 'receipt ids are remembered (' + rc.length + ')');
  await a._test.checkReceipts(); ok(a._test.state().users.p1.receipts.length === rc.length, 'too early to ask: receipts kept');
  rc.forEach((x: any) => { x.at -= 5 * 60e3; });
  receipts = Object.fromEntries(rc.map((x: any) => [x.id, { status: 'error', message: 'Unable to retrieve the FCM server key', details: { error: 'InvalidCredentials' } }]));
  await a._test.checkReceipts();
  ok(logs.some((m) => m.includes('NOT delivered') && m.includes('InvalidCredentials')), 'a delivery error found in a receipt is logged');
  ok(a._test.state().users.p1.receipts.length === 0, 'receipts are cleared once answered');

  try { fs.unlinkSync(file); } catch {}
  console.log(fails ? fails + ' FAILED' : 'alerts test passed');
  process.exit(fails ? 1 : 0);
})();
