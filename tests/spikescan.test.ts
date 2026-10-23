// Server scan with the "spike pairs only" switch: only Boom / Crash are analysed, and a trade against the spike is never listed.
// Synthetic candles, so this checks the rules and the plumbing, not accuracy.
const alertsModule: any = require('../server/alerts.js');
const os: any = require('os'), path: any = require('path');
let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) fails++; };
let seed = 9; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const mk = (n: number, g: number, end: number) => { let p = 100, tr = 0; return Array.from({ length: n }, (_, i) => { const o = p; if (i % 90 === 0) tr = (rnd() - 0.5) * 0.4; p += tr + Math.sin(i / 8) * 0.35 + (rnd() - 0.5) * 0.5; return { t: end - (n - i) * g, o, c: p, h: Math.max(o, p) + rnd() * 0.3, l: Math.min(o, p) - rnd() * 0.3, v: 800 + rnd() * 900 }; }); };
const ITEMS = [['BOOM1000', 'Boom 1000'], ['BOOM500', 'Boom 500'], ['BOOM300N', 'Boom 300'], ['BOOM600', 'Boom 600'], ['CRASH1000', 'Crash 1000'], ['CRASH500', 'Crash 500'], ['CRASH300N', 'Crash 300'], ['CRASH900', 'Crash 900'], ['R_100', 'Volatility 100'], ['R_75', 'Volatility 75'], ['R_50', 'Volatility 50'], ['stpRNG', 'Step Index 100']].map(([id, name]) => ({ id, name, sess: false }));
(async () => {
  for (const spikeOnly of [true, false]) {
    const logs: string[] = [], sent: any[] = [];
    const nowSec = Math.floor(Date.now() / 1000), end = nowSec - (nowSec % 900);
    const feed = { price: async () => 100, candles: async (_id: string, g: number) => mk(g === 900 ? 300 : 120, g, end) };
    const a = alertsModule({ file: path.join(os.tmpdir(), 'sp-' + spikeOnly + Date.now() + '.json'), live: () => true, feed, fetchFn: async (_u: string, o: any) => { sent.push(...JSON.parse(o.body)); return { ok: true, json: async () => ({ data: [{ status: 'ok', id: 'x' }] }) }; }, log: (m: string) => logs.push(m) });
    a._test.state().users['p1'] = { tokens: ['ExponentPushToken[abc]'], alerts: [], fired: [], sent: {}, inbox: [], seq: 0, ack: 0, pending: [], receipts: [], scan: { on: true, watch: true, digest: true, spikeOnly, minProb: 75, tf: 900, mute: [], items: ITEMS } };
    await a._test.runScan();
    const text = sent.map((m) => m.body).join('\n'), lines = text.split('\n');
    const tag = spikeOnly ? '[spike only] ' : '[all pairs]   ';
    ok(tag + 'pairs analysed: ' + (spikeOnly ? 8 : 12), logs.some((l) => new RegExp('scan: ' + (spikeOnly ? 8 : 12) + ' analysed').test(l)));
    ok(tag + 'never a SELL on Boom or a BUY on Crash', !lines.some((l) => /^Boom \d+ SELL/.test(l) || /^Crash \d+ BUY/.test(l)));
    if (spikeOnly) ok(tag + 'no Volatility / Step pair in any push', !/Volatility|Step Index/.test(text));
    console.log(`${tag}pushes: ${sent.length}; setup lines: ${lines.filter((l) => /^(Boom|Crash|Volatility|Step)/.test(l)).length}; ${logs.filter((l) => l.startsWith('scan:')).join(' // ')}`);
  }
  console.log(fails ? fails + ' FAILED' : 'spike scan test passed'); process.exit(fails ? 1 : 0);
})();
