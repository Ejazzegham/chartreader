// Daily high / low breaks and news alerts (server/alerts.js). Run: node tests/daylevels.test.js
const alertsModule = require('../server/alerts.js');
const os = require('os'), path = require('path');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };

const file = path.join(os.tmpdir(), 'daylevels-test-' + process.pid + '.json');
let sent = [], calendar = [];
const fetchFn = async (u, o) => {
  if (u.includes('faireconomy')) return { ok: true, status: 200, json: async () => calendar };
  const msgs = JSON.parse(o.body); sent.push(...msgs);
  return { ok: true, status: 200, json: async () => ({ data: msgs.map(() => ({ status: 'ok', id: 'tk' + Math.random() })) }) };
};
const dayStart = Math.floor(Date.now() / 864e5) * 86400;
const prices = {}, fetched = [];
// yesterday: high 110, low 90 (every pair)
const feed = { price: async (id) => prices[id], candles: async () => [], rawCandles: async (id) => { fetched.push(id); return [{ t: dayStart - 86400, o: 100, h: 110, l: 90, c: 100 }, { t: dayStart, o: 100, h: 101, l: 99, c: 100 }]; } };
const S = { pid: 'p1' }, TOKEN = 'ExponentPushToken[abc123]';
const items = [{ id: 'BOOM1000', name: 'Boom 1000' }, { id: 'CRASH500', name: 'Crash 500' }, { id: 'frxEURUSD', name: 'EUR/USD', sess: true }];

(async () => {
  const a = alertsModule({ file, live: () => true, feed, fetchFn, log: () => {} });
  await a.handle('/push/register', S, { token: TOKEN });
  await a.handle('/alerts/sync', S, { scan: { on: false, dayBreaks: true, news: true, items, tf: 900, minProb: 75 } });
  const u = () => a._test.state().users.p1;
  ok(u().scan.dayBreaks === true && u().scan.news === true, 'server keeps the two new switches');

  // 1. the first look only remembers the price: nothing rings for a break that already happened
  Object.assign(prices, { BOOM1000: 120, CRASH500: 95, frxEURUSD: 100 });
  await a._test.checkDayBreaks();
  ok(sent.length === 0, 'first look after start: no alert');

  // 2. spike pairs are checked like every other pair. Boom stays above, EURUSD breaks the high, Crash breaks the low
  Object.assign(prices, { BOOM1000: 121, CRASH500: 95, frxEURUSD: 111 });
  await a._test.checkDayBreaks();
  ok(sent.length === 0 || sent.length === 1, 'one push for the whole check');
  const day = sent.find((m) => m.data?.type === 'level');
  ok(!!day && /EUR\/USD/.test(day.body) && /above/.test(day.body), 'EURUSD high break named in the push (' + (day && day.title) + ')');
  ok(day && day.data.symId === 'frxEURUSD' && day.channelId === 'info_v1' && day.sound === 'default', 'level push opens the pair and uses the normal-sound channel');
  ok(fetched.includes('BOOM1000') && fetched.includes('CRASH500'), 'Boom and Crash daily levels were fetched');

  // 3. Boom/Crash really break: Crash drops under yesterday low, Boom was already above (no second alert)
  sent = []; Object.assign(prices, { CRASH500: 89, BOOM1000: 125 });
  await a._test.checkDayBreaks();
  ok(sent.length === 1 && /Crash 500/.test(sent[0].body) && /below/.test(sent[0].body), 'Crash 500 low break rings');
  ok(!/Boom/.test(sent[0].body), 'Boom did not ring again (it did not cross, it was already above)');

  // 4. the same level does not ring twice in a day, even if price goes back and crosses again
  sent = []; Object.assign(prices, { frxEURUSD: 109 }); await a._test.checkDayBreaks();
  Object.assign(prices, { frxEURUSD: 112 }); await a._test.checkDayBreaks();
  ok(sent.length === 0, 'same level, same day: once');

  // 5. switch off = silence
  await a.handle('/alerts/sync', S, { scan: { on: false, dayBreaks: false, news: false, items, tf: 900, minProb: 75 } });
  sent = []; Object.assign(prices, { frxEURUSD: 80 }); await a._test.checkDayBreaks(); Object.assign(prices, { frxEURUSD: 130 }); await a._test.checkDayBreaks();
  ok(sent.length === 0, 'switch off: no daily break alerts');

  // 5b. "spike pairs only" limits the SETUP alerts, not the daily breaks: EURUSD still rings
  await a.handle('/alerts/sync', S, { scan: { on: false, dayBreaks: true, spikeOnly: true, news: false, items, tf: 900, minProb: 75 } });
  ok(u().scan.spikeOnly === true, 'server keeps the spike-only switch');
  Object.assign(prices, { frxEURUSD: 100 }); await a._test.checkDayBreaks();
  sent = []; Object.assign(prices, { frxEURUSD: 89 }); await a._test.checkDayBreaks(); // its HIGH already rang today (once per level per day), so the LOW is tested here
  ok(sent.length === 1 && /EUR\/USD/.test(sent[0].body) && /below/.test(sent[0].body), 'spike-only on: daily high/low alerts still cover every pair');

  // 6. news: a HIGH impact release in 10 minutes rings once; medium and far-away ones do not
  await a.handle('/alerts/sync', S, { scan: { on: false, dayBreaks: false, news: true, items, tf: 900, minProb: 75 } }); // (news switch on)
  const at = (min) => new Date(Date.now() + min * 60e3).toISOString();
  calendar = [
    { title: 'Non-Farm Employment Change', country: 'USD', date: at(10), impact: 'High', forecast: '180K', previous: '150K' },
    { title: 'Retail Sales', country: 'GBP', date: at(10), impact: 'Medium', forecast: '', previous: '' },
    { title: 'CPI y/y', country: 'EUR', date: at(90), impact: 'High', forecast: '', previous: '' },
  ];
  sent = []; await a._test.checkNews();
  ok(sent.length === 1 && sent[0].data.type === 'news', 'exactly one news push (' + sent.length + ')');
  ok(/Non-Farm/.test(sent[0].title) && /EUR\/USD/.test(sent[0].body) && !/Boom/.test(sent[0].body), 'names the release and the pairs it moves, not the synthetics');
  sent = []; await a._test.checkNews();
  ok(sent.length === 0, 'the same release does not ring twice');

  // 7. a feed that is down changes nothing and does not crash
  calendar = null;
  await a._test.checkNews(); ok(true, 'news check survives a bad feed');

  console.log(fails ? fails + ' FAILED' : 'all passed');
  process.exit(fails ? 1 : 0);
})();
