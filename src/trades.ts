// Trade desk logic (no React). A "signal" is an analysis result the app logged by itself.
// Lifecycle: signal -> (user takes it) -> pending (limit order waiting) or open (running) -> closed (moves to the journal).
// Money is paper money: every trade risks `risk` (account balance x risk %), so P&L = R multiple x risk.
// Take profits never close anything by themselves. Reaching one rings an alarm and the trader decides: close all, close part, move the stop, or hold.
// The stop loss still closes the trade by itself. The trader chooses the size (lots) when taking the trade.

export const SPLIT = [0.5, 0.3, 0.2];

export type Desk = {
  balance: number;      // starting paper balance (0 = not set yet)
  riskPct: number;      // % of balance risked per trade (0 = not set yet)
  dailyLossPct: number; // stop taking trades after this much loss in one day (0 = no limit)
  maxOpen: number;      // max trades running at once (0 = no limit)
  autoLog: boolean;     // analysis screens add setups to the journal by themselves
  minScore: number;     // only log setups with at least this score
  scanAlarm: boolean;   // the scanner rings an alarm when an auto re-scan finds a strong setup
  scanScore: number;    // ... scoring at least this much
};
// Nothing is pre-filled: the trader enters their own account numbers (Journal > options). Until then no money figures or limits are shown.
export const DESK0: Desk = { balance: 0, riskPct: 0, dailyLossPct: 0, maxOpen: 0, autoLog: true, minScore: 50, scanAlarm: true, scanScore: 70 };
export const deskReady = (d: Desk) => d.balance > 0 && d.riskPct > 0;
export const isOldDemoDesk = (d: Partial<Desk>) => d.balance === 10000 && d.riskPct === 1 && d.dailyLossPct === 3 && d.maxOpen === 3; // the made-up numbers earlier versions saved

export type Status = 'signal' | 'pending' | 'open';
export type Signal = {
  id: string; date: number; symId: string; name: string; side: 'buy' | 'sell';
  entry: number; sl: number; tps: number[]; tf: string; dec: number;
  source: string; grade: string; score: number; armed?: boolean;
  status: Status;
  // set when the user takes the trade
  risk: number;      // money lost if the stop is hit (lots x contract size x stop distance)
  lots?: number; perPt?: number; // size chosen by the trader, and money per 1.0 price move at that size
  tpAlert?: number;  // highest take profit reached that the trader has not answered yet (0 / undefined = none)
  takenAt?: number; mode?: 'market' | 'limit'; from?: 'above' | 'below';
  fill?: number; filledAt?: number;
  stop: number;      // the stop now (moves to the fill price after TP1)
  hits: number;      // take profits reached
  done: number;      // fraction of the position already closed (0..1)
  banked: number;    // R already locked in by partial closes
  mfe: number; mae: number; // best / worst R seen while open
  alerted?: boolean; // "price reached the entry zone" shown once
  note?: string;
  // How the setup was found, kept so the Manage screen can draw it: the reason lines, the entry zone [bottom, top] and a key level (VSA: the broken level)
  why?: string[]; zone?: [number, number]; level?: number;
  // Take-profit plan chosen when the trade was taken: share of the ORIGINAL position to close at TP1, TP2, TP3 (adds up to 1).
  plan?: number[];
  auto?: boolean;    // true: each planned share is closed by itself the moment its take profit is reached. false: the plan is only a suggestion in the alarm.
  autoBe?: boolean;  // true: the stop moves to the fill price (break-even) by itself when TP1 is reached
};

export type CloseSetup = { plan: number[]; auto: boolean; autoBe: boolean };
// Ready-made splits for three targets (TP1 / TP2 / TP3, in percent)
export const PLAN_PRESETS: number[][] = [[50, 30, 20], [40, 30, 30], [34, 33, 33], [100, 0, 0]];
export const defaultPlanPct = (n: number) => shares(n).map((x) => Math.round(x * 100));
// Percent boxes -> shares of the position. Returns null unless every box is a number from 0 to 100 and they add up to 100.
export function planFromPct(pct: number[]): number[] | null {
  if (!pct.length || pct.some((x) => !isFinite(x) || x < 0 || x > 100)) return null;
  const sum = pct.reduce((a, b) => a + b, 0);
  return Math.abs(sum - 100) < 0.01 ? pct.map((x) => x / 100) : null;
}

export type ClosedInfo = { exit: number; r: number; pnl: number; size: number; reason: 'sl' | 'be' | 'tp' | 'manual' };
export type Ev = { id: string; kind: 'fill' | 'tp' | 'sl' | 'be' | 'tp3' | 'near' | 'invalid' | 'missed' | 'auto' | 'bemove'; text: string };

export const dirOf = (s: { side: 'buy' | 'sell' }) => (s.side === 'buy' ? 1 : -1);
export const riskDist = (s: Signal) => Math.abs((s.fill ?? s.entry) - s.sl);
const fr = (s: Signal) => 1 - s.done;

// floating result in R of what is still open
export function floatR(s: Signal, price: number) {
  const d = riskDist(s);
  if (s.status !== 'open' || !d) return 0;
  return (dirOf(s) * (price - (s.fill as number))) / d;
}
export const totalR = (s: Signal, price: number) => s.banked + fr(s) * floatR(s, price);

// shares of the position closed at each TP (normalised when fewer than three targets exist)
export function shares(n: number) {
  const a = SPLIT.slice(0, n), sum = a.reduce((x, y) => x + y, 0) || 1;
  return a.map((x) => x / sum);
}

export const fmtR = (r: number) => `${r >= 0 ? '+' : ''}${r.toFixed(2)}R`;
export const money = (n: number) => `${n >= 0 ? '+' : '-'}$${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;

// risk in money for a new trade
export const riskMoney = (d: Desk, equity = d.balance) => Math.max(0, (equity * d.riskPct) / 100);

// Position size in units for a stop distance (same maths as the Risk planner)
export const unitsFor = (risk: number, dist: number) => (dist > 0 ? risk / dist : 0);

// Build the closed-trade record (journal row)
function finish(s: Signal, price: number, reason: ClosedInfo['reason']): ClosedInfo {
  const d = riskDist(s), r = s.banked + fr(s) * (d ? (dirOf(s) * (price - (s.fill as number))) / d : 0);
  const size = unitsFor(s.risk, d);
  const exit = (s.fill as number) + dirOf(s) * d * r; // weighted average exit so (exit - entry) x size = pnl
  return { exit, r, pnl: r * s.risk, size, reason };
}

export type Step = { sig: Signal; ev: Ev[]; closed?: ClosedInfo; drop?: boolean };

// Advance one signal with a new price. Pure: returns the new signal, events, and a result when it closed.
export function step(s0: Signal, price: number, now: number): Step {
  if (!isFinite(price) || price <= 0) return { sig: s0, ev: [] };
  const s: Signal = { ...s0 }, ev: Ev[] = [], k = dirOf(s), tag = `${s.id}:`;
  const hitSL = (p: number, lvl: number) => (k === 1 ? p <= lvl : p >= lvl);
  const hitUp = (p: number, lvl: number) => (k === 1 ? p >= lvl : p <= lvl); // reached a target

  if (s.status === 'signal') {
    const d = Math.abs(s.entry - s.sl);
    if (hitSL(price, s.sl)) return { sig: s, ev: [{ id: tag + 'inv', kind: 'invalid', text: `${s.name}: price went through the stop before entry. Setup removed.` }], drop: true };
    if (hitUp(price, s.tps[0])) return { sig: s, ev: [{ id: tag + 'miss', kind: 'missed', text: `${s.name}: TP1 was reached without entry. Setup removed.` }], drop: true };
    if (!s.alerted && Math.abs(price - s.entry) <= d * 0.25) { s.alerted = true; ev.push({ id: tag + 'near', kind: 'near', text: `${s.name} is at the entry zone (${s.side.toUpperCase()}). Take it or skip it in the Journal.` }); }
    return { sig: s, ev };
  }

  if (s.status === 'pending') {
    if (hitSL(price, s.sl)) return { sig: s, ev: [{ id: tag + 'inv', kind: 'invalid', text: `${s.name}: order cancelled, price hit the stop before filling.` }], drop: true };
    const crossed = s.from === 'above' ? price <= s.entry : price >= s.entry;
    if (!crossed) return { sig: s, ev: [] };
    s.status = 'open'; s.fill = s.entry; s.filledAt = now; s.stop = s.sl;
    ev.push({ id: tag + 'fill', kind: 'fill', text: `${s.name} ${s.side.toUpperCase()} filled at ${s.entry.toFixed(s.dec)}.` });
  }

  // open trade
  const d = riskDist(s);
  if (!d) return { sig: s, ev };
  const r = (p: number) => (k * (p - (s.fill as number))) / d;
  s.mfe = Math.max(s.mfe, r(price)); s.mae = Math.min(s.mae, r(price));

  // stop first (conservative): a tick that crosses the stop closes what is left
  if (hitSL(price, s.stop)) {
    const c = finish(s, s.stop, 'sl');
    c.reason = c.r > 0.05 ? 'tp' : s.stop === s.fill ? 'be' : 'sl';
    ev.push({ id: tag + 'sl', kind: c.r >= -0.05 ? 'be' : 'sl', text: c.r >= -0.05 ? `${s.name}: stopped out near break-even. ${fmtR(c.r)}` : `${s.name}: stop loss hit. ${fmtR(c.r)}` });
    return { sig: s, ev, closed: c };
  }
  // A take profit was reached. Three ways it can go:
  //  - auto plan: the planned share is closed at the TP price right away (the last share closes the whole trade),
  //  - alarm only: nothing closes, the trader decides (close all, close part, move the stop, hold),
  //  - in both cases the stop can move to break-even by itself after TP1 when that option was chosen.
  while (s.hits < s.tps.length && hitUp(price, s.tps[s.hits])) {
    const i = s.hits, tp = s.tps[i];
    s.hits = i + 1;
    if (s.autoBe && i === 0 && s.stop !== s.fill) {
      s.stop = s.fill as number;
      ev.push({ id: `${tag}bemove`, kind: 'bemove', text: `${s.name}: TP1 reached, stop moved to break-even.` });
    }
    const left = 1 - s.done, share = s.auto && s.plan ? Math.min(s.plan[i] ?? 0, left) : 0;
    if (share > 1e-9) {
      s.banked += share * r(tp); s.done += share;
      if (share >= left - 1e-6) { // that was the last open share: the trade is finished
        s.done = 1;
        const c = finish(s, tp, 'tp');
        ev.push({ id: `${tag}tp${i + 1}`, kind: 'auto', text: `${s.name}: TP${i + 1} reached, last ${Math.round(share * 100)}% closed. Trade finished ${fmtR(c.r)}.` });
        return { sig: s, ev, closed: c };
      }
      ev.push({ id: `${tag}tp${i + 1}`, kind: 'auto', text: `${s.name}: TP${i + 1} reached, ${Math.round(share * 100)}% closed at ${tp.toFixed(s.dec)}.` });
    } else {
      s.tpAlert = s.hits;
      const hint = s.plan && s.plan[i] ? ` Your plan: close ${Math.round(s.plan[i] * 100)}% now.` : '';
      ev.push({ id: `${tag}tp${i + 1}`, kind: i === s.tps.length - 1 ? 'tp3' : 'tp', text: `${s.name}: TP${i + 1} reached at ${price.toFixed(s.dec)}.${hint} Close all, close part, move the stop or hold?` });
    }
  }
  return { sig: s, ev };
}

// Close part of the position at the current price. `part` is a share of the ORIGINAL size (0.5 = half the lots). Asking for more than is left closes everything.
export function partialClose(s: Signal, price: number, part: number): { sig: Signal; closed?: ClosedInfo } {
  const left = 1 - s.done, take = Math.min(left, Math.max(0, part));
  if (!isFinite(price) || price <= 0 || take <= 0) return { sig: s };
  if (take >= left - 1e-6) return { sig: s, closed: finish(s, price, 'manual') };
  const d = riskDist(s), r = d ? (dirOf(s) * (price - (s.fill as number))) / d : 0;
  return { sig: { ...s, banked: s.banked + take * r, done: s.done + take, tpAlert: 0 } };
}

// Close by hand at the current price
export function closeNow(s: Signal, price: number): ClosedInfo {
  return finish(s, price, 'manual');
}

// Is this a duplicate of something already in the list? Same pair + timeframe + method + side, entry within 40% of the stop distance.
export function isDuplicate(list: Signal[], n: Pick<Signal, 'symId' | 'tf' | 'source' | 'side' | 'entry' | 'sl'>) {
  const d = Math.abs(n.entry - n.sl) || 1e-9;
  return list.find((x) => x.symId === n.symId && x.tf === n.tf && x.source === n.source && x.side === n.side && Math.abs(x.entry - n.entry) <= d * 0.4);
}

// ---------------------------------------------------------------- one direction per pair
// A pair can never show BUY and SELL at the same time. Rules:
//  1. A running or pending trade owns the pair: a signal pointing the other way is not logged and cannot be taken (that would be a hedge that cancels itself out).
//  2. Untouched signals on the pair all point the same way: when a new analysis points the other way, the older untouched ones are replaced (newest analysis wins).
export type Side = 'buy' | 'sell';
export const liveOpposite = (list: Signal[], symId: string, side: Side) => list.find((x) => x.symId === symId && x.status !== 'signal' && x.side !== side);
export const dropOpposite = (list: Signal[], symId: string, side: Side) => list.filter((x) => !(x.symId === symId && x.status === 'signal' && x.side !== side));

// Clean a saved list (newest first). Fixes lists saved by older versions that already hold BUY and SELL for one pair.
export function reconcile(list: Signal[]): Signal[] {
  list = list.filter((x) => x.status !== 'signal' || !liveSame(list, x.symId, x.side)); // an untouched setup on a pair that already runs the same direction is hidden
  const live = new Map<string, Side>(), newest = new Map<string, Side>();
  for (const x of list) {
    if (x.status !== 'signal') { if (!live.has(x.symId)) live.set(x.symId, x.side); }
    else if (!newest.has(x.symId)) newest.set(x.symId, x.side);
  }
  return list.filter((x) => x.status !== 'signal' || x.side === (live.get(x.symId) ?? newest.get(x.symId)));
}

// ---------------------------------------------------------------- skipped setups
// "Skip" hides a setup so the next candle does not bring the same one back.
// A skipped entry hides a setup for SKIP_HOURS. A TAKEN entry (source '*', hrs 24) hides the setup you already traded, whatever method found it.
export type Skipped = { symId: string; source: string; side: Side; entry: number; sl: number; at: number; hrs?: number };
export const SKIP_HOURS = 6, TAKEN_HOURS = 24;
const hold = (x: Skipped) => (x.hrs ?? SKIP_HOURS) * 3600000;
const sameSetup = (x: Skipped, n: { symId: string; source: string; side: Side; entry: number }, d: number) => x.symId === n.symId && x.side === n.side && (x.source === '*' || x.source === n.source) && Math.abs(x.entry - n.entry) <= d * 0.4;
export function isSkipped(list: Skipped[], n: { symId: string; source: string; side: Side; entry: number; sl: number }, now = Date.now()) {
  const d = Math.abs(n.entry - n.sl) || 1e-9;
  return list.some((x) => now - x.at < hold(x) && sameSetup(x, n, d));
}
export const wasTaken = (list: Skipped[], n: { symId: string; source: string; side: Side; entry: number; sl: number }, now = Date.now()) => {
  const d = Math.abs(n.entry - n.sl) || 1e-9;
  return list.some((x) => x.source === '*' && now - x.at < hold(x) && sameSetup(x, n, d));
};
export const pruneSkipped = (list: Skipped[], now = Date.now()) => list.filter((x) => now - x.at < hold(x)).slice(0, 100);

// A trade (running or waiting for its entry) already exists on this pair in this direction: the same idea must not be offered again.
export const liveSame = (list: Signal[], symId: string, side: Side) => list.find((x) => x.symId === symId && x.status !== 'signal' && x.side === side);
// Keys "symId:side" of everything the scanner should stay quiet about (running / waiting trades), used by alarms and the server push.
export const muteKeys = (list: Signal[]) => [...new Set(list.filter((x) => x.status !== 'signal').map((x) => `${x.symId}:${x.side}`))];

// Daily result (closed trades since local midnight) in money
export function todayPnl(closed: { date: number; pnl: number }[], now = Date.now()) {
  const d = new Date(now); d.setHours(0, 0, 0, 0);
  return closed.filter((c) => c.date >= d.getTime()).reduce((a, c) => a + c.pnl, 0);
}

// ---------------------------------------------------------------- discipline guard
export type Guard = { level: 'ok' | 'warn' | 'stop'; title: string; text: string; until?: number };
export const COOLDOWN_MIN = 30;

// Checks the rules the app teaches: daily loss limit, 30 minute pause after two losses in a row, max trades at once, no revenge trading.
export function guard(closed: { date: number; pnl: number }[], desk: Desk, running: number, now = Date.now()): Guard {
  const today = todayPnl(closed, now), limit = (desk.balance * desk.dailyLossPct) / 100;
  if (limit > 0 && today <= -limit) return { level: 'stop', title: 'Daily loss limit reached', text: `You lost ${desk.dailyLossPct}% today. Close the charts. Tomorrow is a fresh start.` };
  const recent = [...closed].sort((a, b) => b.date - a.date);
  if (recent.length >= 2 && recent[0].pnl < 0 && recent[1].pnl < 0) {
    const until = recent[0].date + COOLDOWN_MIN * 60000;
    if (now < until) return { level: 'stop', title: 'Cooldown: two losses in a row', text: `Pause for ${Math.ceil((until - now) / 60000)} more min before the next trade. Review, do not chase.`, until };
  }
  const d = new Date(now); d.setHours(0, 0, 0, 0);
  const lossesToday = closed.filter((c) => c.date >= d.getTime() && c.pnl < 0).length;
  if (desk.maxOpen > 0 && running >= desk.maxOpen) return { level: 'warn', title: 'Trade limit reached', text: `${running} trades are running (limit ${desk.maxOpen}). Let them play out.` };
  if (lossesToday >= 3) return { level: 'warn', title: `${lossesToday} losses today`, text: 'Reduce size or stop. Three losses in a day is a signal to slow down.' };
  return { level: 'ok', title: '', text: '' };
}
