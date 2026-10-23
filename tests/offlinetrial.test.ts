// Trial without the license server: the pure rule (localTrial), the network-error tag, and the chat outbox.
import { localTrial, TRIAL_MS, isNetworkError, registerLic } from '../src/license';
let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? 'ok   ' : 'FAIL ') + n); if (!c) fails++; };
const DAY = 864e5, NOW = 1_800_000_000_000;

(async () => {
  const fresh = localTrial(NOW - 60_000, NOW)!;
  ok('a new account (1 minute old) gets a provisional trial', fresh.status === 'trial' && fresh.entitled && fresh.provisional === true && fresh.token === '');
  ok('the trial is 3 days counted from the account creation', Math.abs(fresh.trialEnd - (NOW - 60_000 + TRIAL_MS)) < 1);
  const day2 = localTrial(NOW - 2 * DAY, NOW)!;
  ok('signed up 2 days ago while the server was off: 1 day is left, not 3', day2.entitled && Math.round((day2.trialEnd - NOW) / DAY) === 1);
  const old = localTrial(NOW - 4 * DAY, NOW)!;
  ok('an account older than the trial is expired (not entitled)', !old.entitled && old.status === 'expired');
  ok('paidUntil stays 0: offline never grants a paid plan', fresh.paidUntil === 0 && !fresh.admin);
  const future = localTrial(NOW + 5 * DAY, NOW)!;
  ok('a creation date in the future cannot stretch the trial past 3 days from now', future.trialEnd <= NOW + TRIAL_MS);
  ok('junk dates give no license', localTrial(NaN, NOW) === null && localTrial(0, NOW) === null && localTrial(NOW, NaN) === null);
  ok('network errors are recognised, plain errors are not', isNetworkError(Object.assign(new Error('x'), { network: true })) && !isNetworkError(new Error('Too many new accounts')) && !isNetworkError(null));

  // ---- which failures count as "server not there" (the only ones that may start a provisional trial) ----
  const realFetch = (globalThis as any).fetch; const answer = (status: number, body: string) => { (globalThis as any).fetch = async () => ({ ok: status < 400, status, json: async () => JSON.parse(body) }); };
  const attempt = async () => { try { await registerLic('tok'); return null; } catch (e) { return e; } };
  answer(404, '<html>ngrok offline</html>'); ok('ngrok "tunnel offline" HTML page counts as server down', isNetworkError(await attempt()));
  answer(502, '{"error":"bad gateway"}'); ok('a 5xx counts as server down', isNetworkError(await attempt()));
  (globalThis as any).fetch = async () => { throw new TypeError('Network request failed'); }; ok('no connection counts as server down', isNetworkError(await attempt()));
  answer(400, '{"error":"Too many new accounts from this network today. Try again tomorrow."}'); ok('the server saying NO is not "down": no free provisional trial', !isNetworkError(await attempt()));
  (globalThis as any).fetch = realFetch;

  // ---- chat outbox (AsyncStorage is a stub here, so give it a memory) ----
  const store: Record<string, string> = {};
  const AS: any = require('@react-native-async-storage/async-storage').default;
  AS.getItem = async (k: string) => (k in store ? store[k] : null); AS.setItem = async (k: string, v: string) => { store[k] = v; };
  const { enqueue, loadOutbox, flushOutbox } = await import('../src/chatOutbox');
  await enqueue('first'); await enqueue('  second  '); await enqueue('   ');
  ok('messages are queued in order, blanks ignored, text trimmed', (await loadOutbox()).map((q) => q.text).join('|') === 'first|second');
  const sent: string[] = []; let down = true;
  const send = async (_t: string, text: string) => { if (down) throw Object.assign(new Error('x'), { network: true }); sent.push(text); return { message: { id: sent.length, from: 'user' as const, text, at: 1 } }; };
  ok('no session token: nothing is sent and nothing is lost', (await flushOutbox('', send)).length === 0 && (await loadOutbox()).length === 2);
  ok('server still down: nothing sent, queue kept', (await flushOutbox('tok', send)).length === 0 && (await loadOutbox()).length === 2);
  down = false;
  const done = await flushOutbox('tok', send);
  ok('server back: both are sent, in the order they were written', done.length === 2 && sent.join('|') === 'first|second');
  ok('queue is empty afterwards', (await loadOutbox()).length === 0);
  await enqueue('a'); await enqueue('b'); let n = 0;
  const flaky = async (_t: string, text: string) => { if (++n === 2) throw new Error('Too many messages in the last hour.'); return { message: { id: n, from: 'user' as const, text, at: 1 } }; };
  const part = await flushOutbox('tok', flaky);
  ok('a refused message stops the queue and stays queued (order kept)', part.length === 1 && (await loadOutbox()).map((q) => q.text).join() === 'b');
  if (fails) { console.log(fails + ' FAILED'); process.exit(1); }
  console.log('offline trial + outbox test passed');
})();
