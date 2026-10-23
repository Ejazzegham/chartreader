// Decides which price readings may move a trade. A reading that sits far from the last accepted one is held back until a SECOND, different reading
// agrees with it, so one bad tick (or a feed that switched to another price level) cannot fill an order or hit a target by itself.
export const JUMP = 0.0015; // 0.15% between two readings (gold: about 6 points). Real ticks never move that far at once, except over a weekend gap, which the second reading confirms.
export function makeGuard(jump = JUMP) {
  const lastOk: Record<string, number> = {}, pend: Record<string, number> = {}, lastObj: Record<string, unknown> = {}, held: Record<string, unknown> = {};
  // `reading` is the quote object itself: the same object seen again is the same reading (not a confirmation); it keeps returning the accepted price, or nothing while it is held back.
  return (id: string, reading: unknown, price: number): number | undefined => {
    if (!(price > 0) || !isFinite(price)) return undefined;
    if (lastObj[id] === reading) return held[id] === reading ? undefined : lastOk[id];
    lastObj[id] = reading;
    const prev = lastOk[id];
    if (prev && Math.abs(price - prev) / prev > jump) {
      const w = pend[id];
      if (!(w && Math.abs(price - w) / w < jump / 3)) { pend[id] = price; held[id] = reading; return undefined; }
    }
    delete pend[id]; delete held[id]; lastOk[id] = price;
    return price;
  };
}
