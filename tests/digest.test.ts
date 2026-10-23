// The optional "analysis every 90 s" notification: quiet channel, not in the bell, only when something was analysed, off unless switched on.
const alertsModule: any = require('../server/alerts.js');
const os: any = require('os'), path: any = require('path');
let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) fails++; };
let seed = 5; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const mk = (n: number, g: number, end: number) => { let p = 100, tr = 0; return Array.from({ length: n }, (_, i) => { const o = p; if (i % 90 === 0) tr = (rnd() - 0.5) * 0.4; p += tr + Math.sin(i / 8) * 0.35 + (rnd() - 0.5) * 0.5; return { t: end - (n - i) * g, o, c: p, h: Math.max(o, p) + rnd() * 0.3, l: Math.min(o, p) - rnd() * 0.3, v: 100 }; }); };
const nowSec = Math.floor(Date.now() / 1000), end = nowSec - (nowSec % 900);
const items = Array.from({ length: 12 }, (_, i) => ({ id: 'R_' + (10 + i), name: 'V' + i, sess: false }));
const setup = (digest: boolean, candles: (g: number) => any[]) => {
  const sent: any[] = [];
  const a = alertsModule({ file: path.join(os.tmpdir(), 'dg-' + Math.random() + '.json'), live: () => true, feed: { price: async () => 100, candles: async (_id: string, g: number) => candles(g) }, fetchFn: async (_u: string, o: any) => { sent.push(...JSON.parse(o.body)); return { ok: true, json: async () => ({ data: [{ status: 'ok', id: 'x' }] }) }; }, log: () => {} });
  a._test.state().users['p1'] = { tokens: ['ExponentPushToken[abc]'], alerts: [], fired: [], sent: {}, inbox: [], seq: 0, ack: 0, pending: [], receipts: [], scan: { on: true, watch: false, digest, minProb: 75, tf: 900, mute: [], items } };
  return { a, sent };
};
(async () => {
  const live = (g: number) => mk(g === 900 ? 300 : 120, g, end);
  const on = setup(true, live); await on.a._test.runScan();
  const d = on.sent.filter((m) => m.channelId === 'digest_v1');
  ok('digest ON: one silent notification per scan', d.length === 1);
  ok('it uses the quiet channel and no alarm sound', d[0]?.sound === null && d[0]?.channelId === 'digest_v1');
  ok('title says how many pairs were checked (12) and how many setups', /^Analysis: 12 pairs checked, \d+ setups?$/.test(d[0]?.title || ''));
  ok('a short TTL: a stale digest is dropped, not delivered late', d[0]?.ttl === 120);
  ok('it is NOT written to the bell / inbox', on.a._test.state().users.p1.inbox.every((i: any) => i.type !== 'digest'));
  ok('a tap on it opens the best pair (data.type setup + symId) when there is one', /No setup/.test(d[0]?.body) || (d[0]?.data?.type === 'setup' && /^R_/.test(d[0]?.data?.symId)));
  ok('weak setups (under 50%) are not listed', (d[0]?.body.match(/(\d+)%/g) || []).every((x: string) => parseInt(x) >= 50));
  ok('digest is a normal-priority push (it does not wake the phone)', d[0]?.priority === 'normal');
  ok('the body lists at most 3 setups with entry, stop and TP1', (d[0]?.body.split('\n').filter((l: string) => /Entry/.test(l)).length || 0) <= 3);

  const off = setup(false, live); await off.a._test.runScan();
  ok('digest OFF (default): no digest is ever sent', off.sent.every((m) => m.channelId !== 'digest_v1'));

  const closed = setup(true, () => mk(300, 900, end - 5 * 86400)); // candles are 5 days old: market closed / feed not live
  await closed.a._test.runScan();
  ok('nothing analysed (closed market, stale feed): no empty digest every 90 s', closed.sent.every((m) => m.channelId !== 'digest_v1'));
  if (fails) { console.log(fails + ' FAILED'); process.exit(1); }
  console.log('digest test passed');
})();
