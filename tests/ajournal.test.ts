// A and A+ scanner setups: the server's push says the grade and carries the full setup, and the app copies only fresh A / A+ ones into the Journal.
// The analysis is replaced by a fixed answer (synthetic candles cannot reliably make an A+ setup), so this checks the rules and the plumbing.
const os: any = require('os'), path: any = require('path');
const refine: any = require('../server/analysis/refine'), verdict: any = require('../server/analysis/verdict');
refine.analyzeAll = () => ({ combo: { side: 'buy', score: 88, entry: 100, sl: 99, tps: [101, 102, 103], zoneBottom: 99.5, zoneTop: 100, htf: 'with', basis: 'ICT zone', plan: { status: 'limit', inZone: true, distAtr: 0.2, trigger: 'Buy limit at 100', cancelIf: 'Cancel above 101' }, checks: [{ ok: true, text: 'Order block' }, { ok: false, text: 'nope' }] } });
verdict.qualify = (_a: any, o: any) => (o.id === 'R_50' ? { trade: false, level: null, grade: null, reasons: ['weak'], verdict: { agree: [] } } : { trade: true, level: 'near', grade: o.id === 'BOOM1000' ? 'A+' : 'A', reasons: [], verdict: { agree: ['ICT', 'SMC', 'VSA'] } });
const alertsModule: any = require('../server/alerts.js');
import { setupsToLog, SETUP_MAX_AGE } from '../src/inboxSetups';
let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) fails++; };
const mk = (n: number, g: number, end: number) => { let p = 100; return Array.from({ length: n }, (_, i) => { const o = p; p += Math.sin(i / 8) * 0.3; return { t: end - (n - i) * g, o, c: p, h: Math.max(o, p) + 0.1, l: Math.min(o, p) - 0.1 }; }); };
(async () => {
  const sent: any[] = [], nowSec = Math.floor(Date.now() / 1000), end = nowSec - (nowSec % 900);
  const feed = { price: async () => 100, candles: async (_id: string, g: number) => mk(g === 900 ? 300 : 120, g, end) };
  const a = alertsModule({ file: path.join(os.tmpdir(), 'aj-' + Date.now() + '.json'), live: () => true, feed, fetchFn: async (_u: string, o: any) => { sent.push(...JSON.parse(o.body)); return { ok: true, json: async () => ({ data: [{ status: 'ok', id: 'x' }] }) }; }, log: () => {} });
  const ITEMS = [['BOOM1000', 'Boom 1000'], ['R_75', 'Volatility 75'], ['R_50', 'Volatility 50']].map(([id, name]) => ({ id, name, sess: false }));
  a._test.state().users['p1'] = { tokens: ['ExponentPushToken[abc]'], alerts: [], fired: [], sent: {}, inbox: [], seq: 0, ack: 0, pending: [], receipts: [], scan: { on: true, watch: false, digest: false, minProb: 75, tf: 900, mute: [], items: ITEMS } };
  await a._test.runScan();
  const u = a._test.state().users['p1'], item = u.inbox[0];
  ok('one notification for the two qualified setups', u.inbox.length === 1 && sent.length === 1);
  ok('title says the grades (A/A+)', /A\/A\+ setups/.test(item.title));
  ok('each line says its grade', /Boom 1000 BUY A\+ 88%/.test(item.body) && /Volatility 75 BUY A 88%/.test(item.body));
  ok('the setup that did not pass is not in it', !/Volatility 50/.test(item.body) && item.setups.length === 2);
  const s0 = item.setups.find((x: any) => x.symId === 'BOOM1000');
  ok('full setup attached: entry, stop, 3 targets, grade, method, why', s0.entry === 100 && s0.sl === 99 && s0.tps.length === 3 && s0.grade === 'A+' && s0.basis === 'ICT zone' && s0.why.includes('Order block') && !s0.why.includes('nope'));
  ok('the phone push itself carries no setup list (size limit)', !sent[0].data.setups);
  // app side
  const log = setupsToLog(item);
  ok('app copies both A / A+ setups to the Journal', log.length === 2 && log.every((x) => x.source === 'Scanner · ICT zone' && x.tf === '900'));
  ok('a B setup is not copied', setupsToLog({ at: Date.now(), setups: [{ ...s0, grade: 'B' }] }).length === 0);
  ok('an old notification is not copied', setupsToLog({ at: Date.now() - SETUP_MAX_AGE - 1000, setups: [s0] }).length === 0);
  ok('a setup with the stop on the wrong side is not copied', setupsToLog({ at: Date.now(), setups: [{ ...s0, sl: 101 }] }).length === 0);
  ok('a notification without setups gives nothing', setupsToLog({ at: Date.now() }).length === 0);
  console.log(fails ? fails + ' FAILED' : 'A / A+ journal test passed'); process.exit(fails ? 1 : 0);
})();
