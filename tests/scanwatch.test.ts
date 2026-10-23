// The server scan loop: summary log line, and the optional heads-up tier. Uses synthetic candles on a weekday, so it checks plumbing and rules, not accuracy.
const alertsModule: any = require('../server/alerts.js');
const os: any = require('os'), path: any = require('path');
let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) fails++; };
let seed = 5; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const mk = (n: number, g: number, end: number) => { let p = 100, tr = 0; return Array.from({ length: n }, (_, i) => { const o = p; if (i % 90 === 0) tr = (rnd() - 0.5) * 0.4; p += tr + Math.sin(i / 8) * 0.35 + (rnd() - 0.5) * 0.5; return { t: end - (n - i) * g, o, c: p, h: Math.max(o, p) + rnd() * 0.3, l: Math.min(o, p) - rnd() * 0.3, v: 100 }; }); };
(async () => {
  const logs: string[] = [], sent: any[] = [];
  const nowSec = Math.floor(Date.now() / 1000), end = nowSec - (nowSec % 900);
  const feed = { price: async () => 100, candles: async (_id: string, g: number) => mk(g === 900 ? 300 : 120, g, end) };
  const a = alertsModule({ file: path.join(os.tmpdir(), 'sw-' + Date.now() + '.json'), live: () => true, feed, fetchFn: async (_u: string, o: any) => { sent.push(JSON.parse(o.body)); return { ok: true, json: async () => ({ data: [{ status: 'ok', id: 'x' }] }) }; }, log: (m: string) => logs.push(m) });
  const st = a._test.state(); st.users['p1'] = { tokens: ['ExponentPushToken[abc]'], alerts: [], fired: [], sent: {}, inbox: [], seq: 0, ack: 0, pending: [], receipts: [], scan: { on: true, watch: true, minProb: 75, tf: 900, mute: [], items: Array.from({ length: 12 }, (_, i) => ({ id: 'R_' + (10 + i), name: 'V' + i, sess: false })) } };
  await a._test.runScan();
  ok('a summary line is logged every scan', logs.some((l) => /^scan: \d+ analysed, \d+ with a setup, \d+ A-grade at the POI, \d+ heads-up/.test(l)));
  ok('every pair was analysed', logs.some((l) => /scan: 12 analysed/.test(l)));
  ok('server did not crash and pushes are well formed', sent.every((m: any[]) => m.every((x) => x.channelId && x.title && x.data?.symId)));
  ok('heads-up wording is never "enter now" without the grade', sent.flat().filter((x: any) => /not A-grade/.test(x.title)).every((x: any) => /Lower accuracy/.test(x.body)));
  console.log(`scan summary: ${logs.filter((l) => l.startsWith('scan:')).join(' // ')}; pushes: ${sent.flat().length}`);
  if (fails) { console.log(fails + ' FAILED'); process.exit(1); }
})();
