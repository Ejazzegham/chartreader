import { scheduleState, marketState, thinLiquidity, fxClosedAt } from '../src/session';
import { judge, ALERT_MIN } from '../src/verdict';
import { analyzeAll } from '../src/refine';

let fails = 0;
const ok = (name: string, cond: boolean) => { console.log((cond ? 'PASS ' : 'FAIL ') + name); if (!cond) fails++; };
const D = (s: string) => new Date(s);

// ---------- weekly schedule (US summer time: forex week is Sun 21:00 UTC to Fri 21:00 UTC) ----------
ok('Saturday 10 Oct 2026: EUR/USD closed', !scheduleState('frxEURUSD', 'forex', D('2026-10-10T10:00:00Z')).open);
ok('Saturday: gold (forex group) closed', !scheduleState('frxXAUUSD', 'forex', D('2026-10-10T10:00:00Z')).open);
ok('Friday 20:59 UTC (summer): still open', scheduleState('frxEURUSD', 'forex', D('2026-10-09T20:59:00Z')).open);
ok('Friday 21:01 UTC (summer): closed', !scheduleState('frxEURUSD', 'forex', D('2026-10-09T21:01:00Z')).open);
ok('Sunday 20:59 UTC (summer): closed', !scheduleState('frxEURUSD', 'forex', D('2026-10-11T20:59:00Z')).open);
ok('Sunday 21:01 UTC (summer): open', scheduleState('frxEURUSD', 'forex', D('2026-10-11T21:01:00Z')).open);
ok('Winter: Friday 21:30 UTC still open (closes 22:00)', scheduleState('frxEURUSD', 'forex', D('2026-12-04T21:30:00Z')).open);
ok('Winter: Sunday 21:30 UTC still closed (opens 22:00)', !scheduleState('frxEURUSD', 'forex', D('2026-12-06T21:30:00Z')).open);
ok('Crypto trades on Saturday', scheduleState('cryBTCUSD', 'crypto', D('2026-10-10T10:00:00Z')).open);
ok('Synthetic index trades on Saturday', scheduleState('R_100', 'deriv', D('2026-10-10T10:00:00Z')).open);
ok('Stock indices closed on Saturday', !scheduleState('OTC_SPC', 'indices', D('2026-10-10T10:00:00Z')).open);
ok('fxClosedAt matches', fxClosedAt(D('2026-10-10T00:00:00Z')) && !fxClosedAt(D('2026-10-12T09:00:00Z')));

// ---------- stale candles (Friday candles on a Saturday must not count, even for a market the schedule thinks is open) ----------
const mk = (n: number, gran: number, endT: number, p0 = 100) => { let p = p0, seed = 7; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  return Array.from({ length: n }, (_, i) => { const o = p; p += Math.sin(i / 14) * 0.35 + (r() - 0.5) * 0.5; return { t: endT - (n - 1 - i) * gran, o, c: p, h: Math.max(o, p) + r() * 0.3, l: Math.min(o, p) - r() * 0.3 }; }); };
const now = D('2026-10-10T10:00:00Z'), nowS = now.getTime() / 1000;
ok('Crypto with 2 h old candles = stale', !marketState(mk(260, 900, nowS - 7200), 900, 'cryBTCUSD', 'crypto', now).open);
ok('Crypto with live candles = open', marketState(mk(260, 900, nowS - 300), 900, 'cryBTCUSD', 'crypto', now).open);
ok('Exchange "closed" flag wins', !marketState(mk(260, 900, nowS - 300), 900, 'R_100', 'deriv', now, true).open);
ok('Empty candles = not open', !marketState([], 900, 'R_100', 'deriv', now).open);
ok('Thin hour before the weekly close', !!thinLiquidity('frxEURUSD', 'forex', D('2026-10-09T20:30:00Z')));
ok('Thin hour after the Sunday open', !!thinLiquidity('frxEURUSD', 'forex', D('2026-10-11T21:30:00Z')));
ok('Normal Tuesday: no thin-hour block', thinLiquidity('frxEURUSD', 'forex', D('2026-10-06T13:00:00Z')) === null);
ok('Crypto never has the weekend thin hour', thinLiquidity('cryBTCUSD', 'crypto', D('2026-10-09T20:30:00Z')) === null);

// ---------- alert gate on many synthetic markets (trend legs + pullbacks): every alert must satisfy every rule ----------
let seed = 5; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const T = D('2026-10-07T13:00:00Z');
let nCombo = 0, nAlert = 0, bad = 0, found: { a: any; c: any[] } | null = null;
for (let k = 0; k < 1500; k++) {
  const len = 240, gran = 900; let p = 100, dir = rnd() < 0.5 ? 1 : -1, leg = 0; const c: any[] = [];
  for (let i = 0; i < len; i++) {
    if (leg <= 0) { dir = rnd() < 0.62 ? dir : -dir; leg = 8 + Math.floor(rnd() * 25); }
    leg--; const o = p, vol = 0.25 + rnd() * 0.5; p += dir * vol * (0.4 + rnd() * 0.9) + (rnd() - 0.5) * vol;
    c.push({ t: nowS - 60 - (len - 1 - i) * gran, o, c: p, h: Math.max(o, p) + rnd() * vol * 0.6, l: Math.min(o, p) - rnd() * vol * 0.6, v: 800 + rnd() * 1500 });
  }
  const a = analyzeAll(c, T); if (!a.combo) continue; nCombo++;
  const v = judge(a, { id: 'R_100', cat: 'deriv', now: T, c });
  if (!v.level) continue;
  nAlert++; if (!found) found = { a, c };
  const cb = a.combo, price = c[len - 1].c, buy = cb.side === 'buy';
  const rules = cb.score >= ALERT_MIN && v.agree.length >= 3 && v.oppose.length === 0 && cb.htf !== 'against' && cb.rr[0] >= 1.39
    && v.agree.some((m) => m === 'ICT' || m === 'SMC') && v.agree.some((m) => m === 'VSA' || m === 'Pattern' || m === 'Candle')
    && (v.level === 'entry' ? cb.plan.status === 'enter-now' && cb.plan.inZone && cb.plan.reaction : cb.plan.inZone || (buy ? price - cb.zoneTop : cb.zoneBottom - price) <= 1.01 * (Math.abs(price - cb.entry) / cb.plan.distAtr || Infinity));
  if (!rules) bad++;
}
console.log(`synthetic markets: ${nCombo} setups, ${nAlert} alerts`);
ok('at least one real alert is produced (the gate is not shut for good)', nAlert >= 1);
ok('no alert ever breaks a gate rule', bad === 0);
ok('the gate blocks most setups (it is not a pass-through)', nAlert < nCombo / 2);

// ---------- take the real alert and break one rule at a time: each must block it ----------
if (found) {
  const { a, c } = found, base = { id: 'R_100', cat: 'deriv', now: T, c };
  const withCombo = (o: any) => ({ ...a, combo: { ...a.combo, ...o } }) as any;
  ok('the untouched setup alerts', judge(a, base).level !== null);
  ok('score 65 blocks', judge(withCombo({ score: 65 }), base).level === null);
  ok('minProb 40 cannot lower the bar below 70', judge(withCombo({ score: 65 }), { ...base, minProb: 40 }).level === null);
  ok('minProb 90 raises the bar', a.combo.score >= 90 || judge(a, { ...base, minProb: 90 }).level === null);
  ok('higher timeframe against blocks', judge(withCombo({ htf: 'against' }), base).level === null);
  ok('thin first target blocks', judge(withCombo({ rr: [1.0, 2, 3] }), base).level === null);
  ok('high-impact news blocks', judge(a, { ...base, newsDanger: true }).level === null);
  ok('a far-away zone blocks (status far)', judge(withCombo({ plan: { ...a.combo.plan, status: 'far', inZone: false } }), base).level === null);
  ok('a method pointing the other way blocks', judge({ ...a, vsa: { ...a.vsa, ok: true, bias: a.combo.side === 'buy' ? 'bearish' : 'bullish' } } as any, base).level === null);
  ok('forex in the first hour of the week blocks', judge(a, { id: 'frxEURUSD', cat: 'forex', now: D('2026-10-11T21:30:00Z'), c }).level === null);
}

if (fails) { console.log(fails + ' FAILED'); process.exit(1); }
console.log('gate tests passed');
