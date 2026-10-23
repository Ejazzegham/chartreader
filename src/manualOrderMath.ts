// Pure maths of the manual order ticket (no React), so it can be tested.
export const numOf = (s: string) => parseFloat(String(s).replace(',', '.'));
export type TicketIn = { side: 'buy' | 'sell'; mode: 'market' | 'limit'; price?: number; entryTxt: string; slTxt: string; tpTxt: (string | null)[]; rr: number[] };
export type TicketOut = { entry?: number; sl: number; tps: number[]; dist: number; autoTp: (i: number) => number; tpVal: (i: number) => number; err: string };

export function buildTicket(i: TicketIn): TicketOut {
  const k = i.side === 'buy' ? 1 : -1;
  const entry = i.mode === 'market' ? i.price : numOf(i.entryTxt);
  const sl = numOf(i.slTxt), okE = entry !== undefined && isFinite(entry);
  const dist = okE && isFinite(sl) ? Math.abs((entry as number) - sl) : 0;
  const autoTp = (n: number) => (okE && dist > 0 ? (entry as number) + k * dist * (i.rr[n] ?? NaN) : NaN);
  const tpVal = (n: number) => (i.tpTxt[n] === null || i.tpTxt[n] === undefined ? autoTp(n) : numOf(i.tpTxt[n] as string));
  const tps = i.tpTxt.map((_, n) => tpVal(n)).filter((v) => isFinite(v)).sort((a, b) => k * (a - b));
  let err = '';
  if (i.mode === 'market' && !i.price) err = 'Waiting for the live price of this pair…';
  else if (!okE) err = 'Enter the limit price.';
  else if (!isFinite(sl)) err = 'Enter a stop loss.';
  else if (k * ((entry as number) - sl) <= 0) err = `For a ${i.side.toUpperCase()} the stop loss must be ${i.side === 'buy' ? 'below' : 'above'} the entry.`;
  else if (!tps.length) err = 'Add at least one take profit.';
  else if (tps.some((p) => k * (p - (entry as number)) <= 0)) err = `For a ${i.side.toUpperCase()} every take profit must be ${i.side === 'buy' ? 'above' : 'below'} the entry.`;
  else if (i.mode === 'market' && i.price && k * (i.price - tps[0]) >= 0) err = 'The live price is already past TP1. Move TP1 further away or use a limit order.';
  return { entry: okE ? (entry as number) : undefined, sl, tps, dist, autoTp, tpVal, err };
}
