// Demo account maths (no React, so it can be tested on its own).
// The demo account is paper money. Its numbers come from the closed Demo trades in the Journal plus the open positions.
// "Reset" does not delete anything: it only moves `resetAt` forward, so the statistics start again from the new balance while old trades stay in the Journal.
export type DemoAcct = { id: string; name: string; start: number; leverage: number; createdAt: number; resetAt: number };
export const LEVERAGES = [30, 50, 100, 200, 500];
export const START_PRESETS = [1000, 5000, 10000, 50000, 100000];
export const MIN_START = 100, MAX_START = 10_000_000;
export const newAcct = (now = Date.now()): DemoAcct => ({ id: String(10_000_000 + Math.floor(Math.random() * 89_999_999)), name: 'Demo Account', start: 1000, leverage: 100, createdAt: now, resetAt: 0 });
/** make a saved value safe to use (old or damaged data falls back to the defaults) */
export const cleanAcct = (x: Partial<DemoAcct> | null | undefined, now = Date.now()): DemoAcct => {
  const d = newAcct(now), o = x && typeof x === 'object' ? x : {};
  return {
    id: typeof o.id === 'string' && o.id ? o.id : d.id, name: typeof o.name === 'string' && o.name.trim() ? o.name.trim().slice(0, 30) : d.name,
    start: isFinite(Number(o.start)) && Number(o.start) >= MIN_START && Number(o.start) <= MAX_START ? Number(o.start) : d.start,
    leverage: LEVERAGES.includes(Number(o.leverage)) ? Number(o.leverage) : d.leverage,
    createdAt: isFinite(Number(o.createdAt)) && Number(o.createdAt) > 0 ? Number(o.createdAt) : d.createdAt, resetAt: isFinite(Number(o.resetAt)) && Number(o.resetAt) > 0 ? Number(o.resetAt) : 0,
  };
};
/** a typed starting balance -> number, or null when it is not allowed */
export const parseStart = (s: string): number | null => { const n = parseFloat(s.replace(/,/g, '').trim()); return isFinite(n) && n >= MIN_START && n <= MAX_START ? Math.round(n * 100) / 100 : null; };

export type DTrade = { date: number; pnl: number; side: 'buy' | 'sell'; symbol: string; openedAt?: number };
export type SideStat = { n: number; wins: number; net: number };
export type SymStat = { symbol: string; n: number; wins: number; net: number };
export type DemoStats = {
  n: number; wins: number; losses: number; even: number; net: number; grossWin: number; grossLoss: number;
  winRate: number; lossRate: number; avgWin: number; avgLoss: number; payoff: number; profitFactor: number; expectancy: number;
  best: number; worst: number; maxWinStreak: number; maxLossStreak: number; streak: number; // streak: + wins in a row, - losses in a row (right now)
  maxDD: number; maxDDPct: number; avgHoldMs: number; returnPct: number;
  buy: SideStat; sell: SideStat; bySymbol: SymStat[]; curve: number[];
  today: number; week: number; month: number;
};
const EPS = 0.005;
export function demoStats(list: DTrade[], start: number, now = Date.now()): DemoStats {
  const t = [...list].sort((a, b) => a.date - b.date);
  let wins = 0, losses = 0, even = 0, gw = 0, gl = 0, best = 0, worst = 0, ws = 0, ls = 0, mws = 0, mls = 0, cur = 0, bal = start, peak = start, dd = 0, ddp = 0, hold = 0, holdN = 0;
  const curve = [start], buy: SideStat = { n: 0, wins: 0, net: 0 }, sell: SideStat = { n: 0, wins: 0, net: 0 }, sym = new Map<string, SymStat>();
  const d0 = new Date(now); d0.setHours(0, 0, 0, 0);
  const dayStart = d0.getTime(), weekStart = now - 7 * 86400e3, monthStart = new Date(d0.getFullYear(), d0.getMonth(), 1).getTime();
  let today = 0, week = 0, month = 0;
  for (const x of t) {
    const win = x.pnl > EPS, loss = x.pnl < -EPS;
    if (win) { wins++; gw += x.pnl; ws++; ls = 0; cur = cur > 0 ? cur + 1 : 1; } else if (loss) { losses++; gl += -x.pnl; ls++; ws = 0; cur = cur < 0 ? cur - 1 : -1; } else { even++; ws = 0; ls = 0; cur = 0; }
    mws = Math.max(mws, ws); mls = Math.max(mls, ls); best = Math.max(best, x.pnl); worst = Math.min(worst, x.pnl);
    bal += x.pnl; curve.push(bal); peak = Math.max(peak, bal);
    const drop = peak - bal; if (drop > dd) { dd = drop; ddp = peak > 0 ? (drop / peak) * 100 : 0; }
    const sd = x.side === 'buy' ? buy : sell; sd.n++; sd.net += x.pnl; if (win) sd.wins++;
    const s = sym.get(x.symbol) ?? { symbol: x.symbol, n: 0, wins: 0, net: 0 }; s.n++; s.net += x.pnl; if (win) s.wins++; sym.set(x.symbol, s);
    if (x.openedAt && x.date > x.openedAt) { hold += x.date - x.openedAt; holdN++; }
    if (x.date >= dayStart) today += x.pnl; if (x.date >= weekStart) week += x.pnl; if (x.date >= monthStart) month += x.pnl;
  }
  const n = t.length, net = gw - gl, avgWin = wins ? gw / wins : 0, avgLoss = losses ? gl / losses : 0;
  return {
    n, wins, losses, even, net, grossWin: gw, grossLoss: gl,
    winRate: n ? (wins / n) * 100 : 0, lossRate: n ? (losses / n) * 100 : 0, avgWin, avgLoss, payoff: avgLoss ? avgWin / avgLoss : 0,
    profitFactor: gl ? gw / gl : gw > 0 ? Infinity : 0, expectancy: n ? net / n : 0, best, worst, maxWinStreak: mws, maxLossStreak: mls, streak: cur,
    maxDD: dd, maxDDPct: ddp, avgHoldMs: holdN ? hold / holdN : 0, returnPct: start > 0 ? (net / start) * 100 : 0,
    buy, sell, bySymbol: [...sym.values()].sort((a, b) => b.net - a.net), curve, today, week, month,
  };
}
export const fmtPF = (pf: number, n: number) => (pf === Infinity ? '∞' : n === 0 ? '-' : pf.toFixed(2));
export const fmtHold = (ms: number) => { if (!ms) return '-'; const m = Math.round(ms / 60000); return m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`; };
