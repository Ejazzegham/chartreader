import { analyzeMarket, reviewPlan } from '../src/gemini';
import { setServer, getServer } from '../src/license';

let fails = 0;
const ok = (c: unknown, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const calls: string[] = [];
const reply = (status: number, body: any) => { (globalThis as any).fetch = async (url: string) => { calls.push(url); return { ok: status < 400, status, json: async () => { if (body === '__html__') throw new Error('not json'); return body; } }; }; };
const gem = (obj: any) => ({ candidates: [{ content: { parts: [{ text: typeof obj === 'string' ? obj : JSON.stringify(obj) }] } }] });
const rejects = async (p: Promise<any>) => { try { await p; return ''; } catch (e: any) { return String(e.message); } };
const candles = Array.from({ length: 30 }, (_, i) => ({ o: 1 + i / 100, h: 1.02 + i / 100, l: 0.99 + i / 100, c: 1.01 + i / 100 }));
const good = { trend: { direction: 'bullish', strength: 's', summary: 'sum' }, bias: 'buy', entry: 1.1, stopLoss: 1.05, takeProfits: [1.2], support: [1], resistance: [1.3], riskReward: '1:2', reasoning: 'r', warnings: [] };
const chart = (m = 'm') => analyzeMarket('k', m, 'English', 'EURUSD', 'M15', candles, 5); // "Analysis of this chart" is the only Gemini call that reads a chart now

(async () => {
  // the server address typed in Settings must be the one used (this was a bug: a fixed constant was used)
  await setServer('https://my-new-tunnel.example.com');
  reply(200, gem(good));
  await chart('gemini-x');
  ok(calls[0] === 'https://my-new-tunnel.example.com/gemini/gemini-x', 'uses the server address from Settings: ' + calls[0]);

  const a = await chart();
  ok(a.takeProfits.length === 3, 'always exactly 3 take profits');
  ok(Array.isArray(a.support) && Array.isArray(a.warnings), 'missing lists stay lists');

  // server style errors ({error: 'text'}) used to show only "HTTP 402"
  reply(402, { error: 'Free trial ended. Subscribe to unlock analysis.' });
  ok((await rejects(chart())).startsWith('Free trial ended'), 'server error text is shown to the user');
  reply(401, {});
  ok((await rejects(chart())).includes('Session expired'), '401 without a body still gives a clear message');
  reply(400, { error: { message: 'API key not valid' } });
  ok((await rejects(chart())) === 'API key not valid', 'Google style error objects still work');
  reply(502, '__html__');
  ok((await rejects(chart())).includes('HTTP 502'), 'an HTML error page (dead tunnel) does not crash');
  (globalThis as any).fetch = async () => { throw new TypeError('Network request failed'); };
  ok((await rejects(chart())).includes('Cannot reach the server'), 'network failure message');

  // model output problems
  reply(200, gem('```json\n' + JSON.stringify(good) + '\n```'));
  ok(!(await rejects(chart())), 'fenced JSON is accepted');
  reply(200, gem('Sure! Here is the analysis: ' + JSON.stringify(good) + ' Hope it helps.'));
  ok(!(await rejects(chart())), 'JSON with chatter around it is accepted');
  reply(200, gem('this is not json at all'));
  ok((await rejects(chart())).includes('unexpected format'), 'garbage gives a friendly error');
  reply(200, { candidates: [], promptFeedback: { blockReason: 'SAFETY' } });
  ok((await rejects(chart())).includes('could not be analyzed'), 'blocked answer gives a friendly error');
  // live-candle analysis + plan review
  reply(200, gem(good));
  const mk = await chart();
  ok(mk.takeProfits.length === 3, 'market analysis fills 3 take profits');
  reply(200, gem({ trend: {}, bias: 'buy', entry: 'n/a', stopLoss: 1.05, takeProfits: [] }));
  ok((await rejects(analyzeMarket('k', 'm', 'English', 'EURUSD', 'M15', candles, 5))).includes('unusable'), 'buy with no entry price is refused');
  reply(200, gem({ verdict: 'great', summary: 'x', improvements: ['a'], betterEntry: 0 }));
  const rv = await reviewPlan('k', 'm', 'English', 'EURUSD', 'M15', candles, 5, { entry: 1, sl: 0.9, tps: [1.1] }, 'engine');
  ok(rv.verdict === 'okay' && rv.betterEntry === undefined, 'plan review repairs unknown verdict');

  // REAL volume reaches the AI: a volume column and real-volume VSA wording when the candles carry it, the old spread-only wording when not
  const bodyOf = async (cs: any[]) => { let body = ''; (globalThis as any).fetch = async (_u: string, init: any) => { body = String(init?.body ?? ''); return { ok: true, status: 200, json: async () => gem(good) }; }; await analyzeMarket('k', 'm', 'English', 'XAUUSD', 'M15', cs, 2); return JSON.parse(body).contents[0].parts[0].text as string; };
  const many = Array.from({ length: 60 }, (_, i) => ({ o: 2000 + i, h: 2002 + i, l: 1999 + i, c: 2001 + i }));
  const withV = await bodyOf(many.map((x, i) => ({ ...x, v: 1000 + i })));
  ok(withV.includes('"open high low close volume"') && withV.includes('2059.00 2061.00 2058.00 2060.00 1059') && withV.includes('real traded volume') && !withV.includes('no volume is supplied'), 'candles with volume: volume column + real-volume VSA wording');
  const noV = await bodyOf(many);
  ok(noV.includes('"open high low close"') && noV.includes('no volume is supplied') && !noV.includes('real traded volume'), 'candles without volume: spread-only wording kept');
  { let body = ''; (globalThis as any).fetch = async (_u: string, init: any) => { body = String(init?.body ?? ''); return { ok: true, status: 200, json: async () => gem(good) }; };
    await analyzeMarket('k', 'm', 'English', 'EURJPY', 'M5', many.map((x, i) => ({ ...x, v: 10 + i })), 2, '', 'Deriv tick volume (price updates per candle)');
    ok(JSON.parse(body).contents[0].parts[0].text.includes('volume (Deriv tick volume (price updates per candle))'), 'the AI is told when the volume is tick volume'); }
  const patchy = await bodyOf(many.map((x, i) => ({ ...x, v: i % 2 ? 50 : undefined })));
  ok(patchy.includes('no volume is supplied'), 'volume on only half the candles is not sent as real volume');

  await setServer('');
  ok(getServer().startsWith('https://'), 'server address can be reset');
  console.log(fails ? 'SOME FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
