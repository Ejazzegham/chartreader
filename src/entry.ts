import type { Candle } from './markets';

// =====================================================================================
// Entry plan: turns a zone + stop + first target into something you can act on.
// It answers: is price in the zone already? did it react? is the trade already gone? when do I cancel?
// Pure maths, no imports from the app, so the server scanner uses the same rules.
// =====================================================================================
export type EntryStatus = 'enter-now' | 'wait-trigger' | 'limit' | 'far' | 'late' | 'invalid';
export type EntryPlan = {
  status: EntryStatus; label: string;
  inZone: boolean; reaction: boolean;       // price is inside the zone / the last candles rejected it in our direction
  distAtr: number;                          // distance from the current price to the entry, in ATR
  rrNow: number;                            // risk:reward to TP1 if you enter at the current price
  trigger: string; cancelIf: string; expireBars: number;
};

// Higher timeframe used as the trend filter for each scan timeframe (seconds).
export const HTF_OF: Record<number, number> = { 60: 900, 180: 900, 300: 3600, 900: 3600, 1800: 14400, 3600: 14400, 7200: 86400, 14400: 86400 };

const EXPIRE = 20; // an unfilled limit order is cancelled after this many candles

export function planEntry(c: Candle[], side: 'buy' | 'sell', entry: number, sl: number, zTop: number, zBot: number, tp1: number, a: number, f: (n: number) => string = (n) => n.toFixed(4), live?: number, zoneI?: number): EntryPlan {
  // c = CLOSED candles (a reaction is read from candles that have closed, so it cannot disappear), live = the current price (where we would actually enter)
  const buy = side === 'buy', n = c.length, last = c[n - 1], price = live !== undefined && isFinite(live) ? live : last.c, d = buy ? 1 : -1;
  const risk = Math.abs(entry - sl), dist = (price - entry) * d;       // > 0: price is already beyond the entry in the trade direction
  const distAtr = Math.abs(price - entry) / a;
  const pad = 0.1 * a;
  const inZone = buy ? price <= zTop + pad && price >= zBot - pad : price >= zBot - pad && price <= zTop + pad;

  // reaction: one of the last 2 candles reached the zone and closed back out of it in our direction (rejection wick, engulfing close)
  const react = (x: Candle, prev: Candle) => {
    const touched = buy ? x.l <= zTop + pad : x.h >= zBot - pad, rng = x.h - x.l || 1;
    const wick = buy ? (Math.min(x.o, x.c) - x.l) / rng : (x.h - Math.max(x.o, x.c)) / rng;
    const dirClose = buy ? x.c > x.o && x.c > (zBot + zTop) / 2 : x.c < x.o && x.c < (zBot + zTop) / 2;
    const engulf = buy ? x.c > prev.h : x.c < prev.l;
    return touched && dirClose && (wick >= 0.4 || engulf);
  };
  const reaction = n >= 3 && (react(last, c[n - 2]) || react(c[n - 2], c[n - 3]));

  // already invalidated: price closed through the stop
  const stopped = buy ? price <= sl : price >= sl;
  // already gone: price CAME BACK to the zone and then reached TP1, so the move happened without us.
  // The candles that formed the zone are not a return (a pending zone must not be called "too late" just because the impulse that made it ran past TP1),
  // and a zone price never came back to is still waiting, however far price ran from it.
  let tp1Hit = false;
  if (zoneI === undefined) tp1Hit = buy ? price >= tp1 : price <= tp1; // no zone memory (candle / pattern level): spent once price is past TP1
  else {
    // look only at candles AFTER the zone formed: the decline or rally that passed through the same price before the zone existed is not a return
    let away = false, ret = -1;
    for (let k = Math.max(zoneI + 3, n - 120, 0); k < n; k++) {
      const x = c[k], over = buy ? x.l <= zTop + pad && x.h >= zBot - pad : x.h >= zBot - pad && x.l <= zTop + pad, clear = buy ? x.l > zTop + pad : x.h < zBot - pad;
      if (clear) away = true; else if (over && away) ret = k;
    }
    if (ret >= 0) {
      let pk = price;
      for (let k = ret; k < n; k++) pk = buy ? Math.max(pk, c[k].h) : Math.min(pk, c[k].l);
      tp1Hit = buy ? pk >= tp1 : pk <= tp1;
    }
  }
  const rrNow = Math.abs(price - sl) > 0 ? ((tp1 - price) * d > 0 ? 1 : -1) * Math.abs(tp1 - price) / Math.abs(price - sl) : 0;

  const cancelIf = `Cancel if a candle closes ${buy ? 'below' : 'above'} ${f(sl)} before you are filled, if price reaches TP1 ${f(tp1)} first, or after ${EXPIRE} candles.`;
  let status: EntryStatus, label: string, trigger: string;
  if (stopped) { status = 'invalid'; label = 'Setup failed: price is through the stop'; trigger = 'Do not enter. Wait for a new setup.'; }
  else if (tp1Hit) { status = 'late'; label = 'Too late: price already reached the first target'; trigger = 'Do not chase. Wait for a pullback into a fresh zone or a new setup.'; }
  else if (inZone && reaction) { status = 'enter-now'; label = 'Enter now: price reacted from the zone'; trigger = `Enter at market (about ${f(price)}) with the stop at ${f(sl)}. Risk:reward to TP1 is 1:${Math.max(0, rrNow).toFixed(1)} from here.`; }
  else if (inZone) { status = 'wait-trigger'; label = 'In the zone: wait for the reaction'; trigger = `Wait for a candle that rejects the zone and closes ${buy ? 'above' : 'below'} ${f((zBot + zTop) / 2)} (wick back out of the zone or a close ${buy ? 'above the previous high' : 'below the previous low'}). Then enter.`; }
  else if (buy ? price < zBot - pad : price > zTop + pad) { status = 'wait-trigger'; label = 'Price is through the zone: not a buy/sell limit any more'; trigger = `Do NOT place an order at ${f(entry)}: price is already ${buy ? 'below' : 'above'} the zone. Wait for a candle to close back ${buy ? 'above' : 'below'} ${f(buy ? zBot : zTop)} (the zone is reclaimed) and then react from it. If price closes ${buy ? 'below' : 'above'} ${f(sl)} the idea is dead.`; }
  else if (distAtr > 2.5) { status = 'far'; label = `Far away (${distAtr.toFixed(1)} ATR): not close yet`; trigger = `Set an alert at ${f(buy ? zTop : zBot)}. Look for the reaction when price gets there.`; }
  else if (dist > 0) { status = 'wait-trigger'; label = 'Price is past the entry: wait for a pullback'; trigger = `Do not chase. Place the order at ${f(entry)} and wait for price to come back into ${f(zBot)} - ${f(zTop)}.`; }
  else { status = 'limit'; label = `Limit order: price is ${distAtr.toFixed(1)} ATR from the entry`; trigger = `Place a ${buy ? 'buy' : 'sell'} limit at ${f(entry)} (zone ${f(zBot)} - ${f(zTop)}) or wait for a reaction candle in the zone.`; }
  return { status, label, inZone, reaction, distAtr, rrNow: Math.max(0, rrNow), trigger, cancelIf, expireBars: EXPIRE };
}
