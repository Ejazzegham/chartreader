// Walk-forward backtest of the app's combined setup (analyzeAll). At each step it sees ONLY candles up to that moment,
// takes the setup the app would show, places the order the way the entry plan says, then manages it with the app's own 3 targets
// (close 50% / 30% / 20%, stop moved to break-even after TP1). Stop is checked before targets inside one candle (the pessimistic case).
const { analyzeAll } = require('./analysis/refine');
const W = [0.5, 0.3, 0.2], EXPIRE = 20, MAX_BARS = 120;
const HTF = { 60: 900, 180: 900, 300: 3600, 900: 3600, 1800: 14400, 3600: 14400, 7200: 86400, 14400: 86400 };
exports.HTF = HTF;

function manage(c, from, side, fill, sl, tps, costR) {
  const buy = side === 'buy', d = buy ? 1 : -1, risk = Math.abs(fill - sl);
  if (!(risk > 0)) return null;
  let cur = sl, rem = 1, R = 0, k = 0, end = Math.min(c.length - 1, from + MAX_BARS);
  for (let j = from; j <= end; j++) {
    const x = c[j];
    if (buy ? x.l <= cur : x.h >= cur) { R += rem * ((cur - fill) * d) / risk; return { R: R - costR, bars: j - from, exit: 'stop', end: j }; }
    while (k < 3 && (buy ? x.h >= tps[k] : x.l <= tps[k])) { R += W[k] * ((tps[k] - fill) * d) / risk; rem -= W[k]; if (k === 0) cur = fill; k++; }
    if (k === 3) return { R: R - costR, bars: j - from, exit: 'tp3', end: j };
  }
  R += rem * ((c[end].c - fill) * d) / risk;
  return { R: R - costR, bars: end - from, exit: 'timeout', end };
}

// c: candles oldest first. htf: higher timeframe candles (optional). gran: seconds per candle. Returns the list of trades.
exports.simulate = function simulate(c, htf, gran, o = {}) {
  const { step = 3, warm = 220, sess = false, cost = 0.03, minScore = 0 } = o, hg = HTF[gran] || 0, trades = [];
  let last = '', lastAt = -999, i = warm;
  while (i < c.length - 2) {
    const win = c.slice(i - 199, i + 1), t = c[i].t;
    let h; if (htf && hg) { h = htf.filter((x) => x.t + hg <= t + gran).slice(-150); if (h.length < 40) h = undefined; }
    const a = analyzeAll(win, new Date(t * 1000), { sessions: sess, htf: h }), cb = a.combo;
    if (!cb || cb.score < minScore) { i += step; continue; }
    const key = cb.side + cb.entry.toFixed(5);
    if (key === last && i - lastAt < EXPIRE) { i += step; continue; }
    last = key; lastAt = i;
    const buy = cb.side === 'buy', atrv = Math.abs(cb.entry - cb.sl);
    let fillIdx = -1, fill = 0, cancelled = '';
    if (cb.plan.status === 'enter-now') { fillIdx = i + 1; fill = c[i + 1].o; }
    else {
      for (let j = i + 1; j <= Math.min(c.length - 1, i + EXPIRE); j++) {
        const x = c[j];
        if (buy ? x.l <= cb.entry : x.h >= cb.entry) { fillIdx = j; fill = buy ? Math.min(cb.entry, x.o) : Math.max(cb.entry, x.o); break; }
        if (buy ? x.h >= cb.tps[0] : x.l <= cb.tps[0]) { cancelled = 'tp1-first'; break; }
        if (buy ? x.c <= cb.sl : x.c >= cb.sl) { cancelled = 'stop-first'; break; }
      }
      if (fillIdx < 0 && !cancelled) cancelled = 'expired';
    }
    const base = { i, t, side: cb.side, score: cb.score, grade: cb.grade, status: cb.plan.status, htf: cb.htf || 'none', basis: cb.basis };
    if (fillIdx < 0) { trades.push({ ...base, filled: false, why: cancelled }); i += step; continue; }
    const r = manage(c, fillIdx, cb.side, fill, cb.sl, cb.tps, cost * (a.ict.atr || 0) / Math.max(1e-9, Math.abs(fill - cb.sl)));
    if (!r) { i += step; continue; }
    trades.push({ ...base, filled: true, R: r.R, bars: r.bars, exit: r.exit });
    i = Math.max(i + step, r.end + 1);
  }
  return trades;
};

const pct = (n, d) => (d ? Math.round((100 * n) / d) + '%' : '-');
function stats(ts) {
  const f = ts.filter((t) => t.filled), n = f.length;
  if (!n) return { orders: ts.length, trades: 0 };
  const wins = f.filter((t) => t.R > 0), loss = f.filter((t) => t.R <= 0);
  const gp = wins.reduce((s, t) => s + t.R, 0), gl = -loss.reduce((s, t) => s + t.R, 0);
  let eq = 0, peak = 0, dd = 0; f.forEach((t) => { eq += t.R; peak = Math.max(peak, eq); dd = Math.max(dd, peak - eq); });
  return { orders: ts.length, trades: n, fill: pct(n, ts.length), win: pct(wins.length, n), avgR: +(f.reduce((s, t) => s + t.R, 0) / n).toFixed(2), pf: gl > 0 ? +(gp / gl).toFixed(2) : Infinity, maxDD_R: +dd.toFixed(1) };
}
exports.stats = stats;
exports.report = function report(trades) {
  const out = { all: stats(trades), byScore: {}, byStatus: {}, byHtf: {}, bySide: {} };
  const bucket = (s) => (s >= 90 ? '90+' : s >= 80 ? '80-89' : s >= 70 ? '70-79' : s >= 60 ? '60-69' : s >= 50 ? '50-59' : '<50');
  for (const [k, fn] of [['byScore', (t) => bucket(t.score)], ['byStatus', (t) => t.status], ['byHtf', (t) => t.htf], ['bySide', (t) => t.side]]) {
    const g = {}; trades.forEach((t) => (g[fn(t)] ||= []).push(t));
    Object.keys(g).sort().forEach((key) => { out[k][key] = stats(g[key]); });
  }
  return out;
};
