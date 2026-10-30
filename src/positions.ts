// Manual positions, MetaTrader 5 style (no React, so it can be tested).
// One click opens a position at the live price with a size in lots. Stop loss and take profit are OPTIONAL and are added later from the
// chart (tap the profit / loss tag of the position). A position can be closed in parts (by %), its stop can be moved to break-even,
// and it closes by itself when its stop or its target is touched. Money is paper money: P&L = lots x money per 1.0 move x price move.
import type { LotSpec } from './lots';

export type Side = 'buy' | 'sell';
export type Position = {
  id: string; symId: string; name: string; side: Side; tf: string; dec: number;
  lots0: number;        // size when it was opened
  lots: number;         // size still open
  perLot: number;       // money per 1.0 price move for ONE lot (fixed when the position opened)
  open: number;         // fill price
  openedAt: number;
  sl?: number; tp?: number;
  realized: number;     // money already booked by partial closes
  note?: string;
};
export type Reason = 'sl' | 'be' | 'tp' | 'manual';
export type Closed = { exit: number; pnl: number; lots: number; reason: Reason };

export const dirP = (p: { side: Side }) => (p.side === 'buy' ? 1 : -1);
const cents = (n: number) => Math.round(n * 100) / 100;
const clean = (n: number) => Number(n.toPrecision(10));

// money the OPEN part floats at, and the whole position (booked + floating)
export const floating = (p: Position, price: number) => cents(dirP(p) * (price - p.open) * p.lots * p.perLot);
export const totalPnl = (p: Position, price: number) => cents(p.realized + floating(p, price));
// distance to the entry in price units (positive = in profit)
export const inProfit = (p: Position, price: number) => dirP(p) * (price - p.open) > 0;

export function openPosition(n: { id: string; symId: string; name: string; side: Side; lots: number; perLot: number; price: number; tf: string; dec: number; now?: number }): Position {
  return { id: n.id, symId: n.symId, name: n.name, side: n.side, tf: n.tf, dec: n.dec, lots0: n.lots, lots: n.lots, perLot: n.perLot, open: n.price, openedAt: n.now ?? Date.now(), realized: 0 };
}

// Stops are checked against the live price like MT5 does: a buy stop sits below the market, a buy target above it (sell: the other way round).
// `null` removes the level. Returns an error text or '' when the pair of levels is fine.
export function checkLevels(p: Position, price: number | undefined, sl: number | null | undefined, tp: number | null | undefined): string {
  const k = dirP(p), buy = p.side === 'buy';
  if (sl !== null && sl !== undefined) {
    if (!isFinite(sl) || sl <= 0) return 'Enter a valid stop loss price.';
    if (price !== undefined && k * (price - sl) <= 0) return `For a ${p.side.toUpperCase()} the stop loss must be ${buy ? 'below' : 'above'} the current price.`;
  }
  if (tp !== null && tp !== undefined) {
    if (!isFinite(tp) || tp <= 0) return 'Enter a valid take profit price.';
    if (price !== undefined && k * (tp - price) <= 0) return `For a ${p.side.toUpperCase()} the take profit must be ${buy ? 'above' : 'below'} the current price.`;
  }
  return '';
}

// Set / change / remove the levels. `undefined` = leave as it is, `null` = remove.
export function setLevels(p: Position, price: number | undefined, sl: number | null | undefined, tp: number | null | undefined): { pos?: Position; err?: string } {
  const err = checkLevels(p, price, sl, tp);
  if (err) return { err };
  const n: Position = { ...p };
  if (sl === null) delete n.sl; else if (sl !== undefined) n.sl = sl;
  if (tp === null) delete n.tp; else if (tp !== undefined) n.tp = tp;
  return { pos: n };
}

// Stop to the entry price. Only while the price is in profit, otherwise the stop would sit on the wrong side of the market and close the trade at once.
export function toBreakEven(p: Position, price: number | undefined): { pos?: Position; err?: string } {
  if (price === undefined) return { err: 'No live price yet.' };
  if (p.sl !== undefined && Math.abs(p.sl - p.open) < 1e-12) return { err: 'The stop is already at break-even.' };
  if (p.sl !== undefined && dirP(p) * (p.sl - p.open) > 0) return { err: 'The stop is already past break-even. Nothing to move.' };
  if (!inProfit(p, price)) return { err: 'The price must be in profit before the stop can move to break-even.' };
  return { pos: { ...p, sl: p.open } };
}

// Lots a "close X %" button closes: a share of what is open now, rounded DOWN to the lot step (like MT5, volume has a step).
// When what would stay open is below the minimum lot, everything is closed. A share too small for the minimum lot returns lots = 0.
export function lotsForPct(p: Position, pct: number, spec: Pick<LotSpec, 'min' | 'step'>): { lots: number; all: boolean } {
  if (!(pct > 0)) return { lots: 0, all: false };
  if (pct >= 99.999) return { lots: p.lots, all: true };
  const raw = (p.lots * pct) / 100, part = clean(Math.floor(raw / spec.step + 1e-9) * spec.step);
  if (part < spec.min - 1e-12) return { lots: 0, all: false };
  const left = clean(p.lots - part);
  if (left < spec.min - 1e-12) return { lots: p.lots, all: true };
  return { lots: part, all: false };
}

// Close `lots` of the position at `price`. Everything closed (or the rest below 1e-9) returns `closed` with the whole result of the position.
export function closeLots(p: Position, price: number, lots: number, reason: Reason = 'manual'): { pos?: Position; closed?: Closed; booked: number } {
  const take = Math.min(p.lots, Math.max(0, lots));
  if (!isFinite(price) || price <= 0 || take <= 0) return { pos: p, booked: 0 };
  const got = cents(dirP(p) * (price - p.open) * take * p.perLot);
  if (take >= p.lots - 1e-9) {
    const pnl = cents(p.realized + got), per = p.lots0 * p.perLot, exit = per ? p.open + (dirP(p) * pnl) / per : price; // average exit over every part that was closed
    return { closed: { exit, pnl, lots: p.lots0, reason }, booked: got };
  }
  return { pos: { ...p, lots: clean(p.lots - take), realized: cents(p.realized + got) }, booked: got };
}

// One price tick. The stop or the target closes the whole open part at its own price (stop first, the careful way round).
export function stepPosition(p: Position, price: number): { pos: Position; closed?: Closed; hit?: 'sl' | 'tp' } {
  if (!isFinite(price) || price <= 0) return { pos: p };
  const k = dirP(p);
  if (p.sl !== undefined && k * (price - p.sl) <= 0) {
    const r = closeLots(p, p.sl, p.lots, 'sl'), c = r.closed!;
    c.reason = Math.abs(p.sl - p.open) < 1e-12 && Math.abs(c.pnl - p.realized) < 0.005 ? 'be' : c.pnl > 0.005 ? 'tp' : 'sl';
    return { pos: p, closed: c, hit: 'sl' };
  }
  if (p.tp !== undefined && k * (price - p.tp) >= 0) return { pos: p, closed: closeLots(p, p.tp, p.lots, 'tp').closed!, hit: 'tp' };
  return { pos: p };
}

