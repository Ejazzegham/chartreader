import type { Candle } from './markets';
import { volumeSource, feedHasVolume, attachVolume, setVolState, getVolState, tickVolOk, volCover, setVolUsed, setTickState, getTickState } from './volume';
import { yahooVolumeMulti } from './fallback';
import { bnCandles } from './crypto';

// Counts the Deriv ticks inside each candle (markets.ts): returns bars { t: candle start, v: tick count } for the candles that are fully covered.
export type TickLoader = (sym: string, gran: number, fromT: number, alive: () => boolean, count?: number, onPart?: (b: Candle[]) => void) => Promise<Candle[]>;

const share = (c: Candle[]) => { const k = volCover(c); return k.of ? k.have / k.of : 0; };

// Wraps a candle callback: every time candles arrive, real volume (see volume.ts) is merged in before they reach the charts and the analysis.
//  1. Exchange volume first: Binance spot (crypto) or CME / COMEX / NYMEX / ICE futures (forex majors, gold, silver, oil), polled every 20 s.
//  2. Deriv TICK volume when the futures volume does not load, has too many empty candles, or the pair has no futures contract (crosses).
//     Only one of the two is used for all candles at a time (never mixed inside one chart) and the VSA screen says which one.
// If neither can be reached the candles still flow, just without volume (VSA then says so and gives no signal).
export function withVolume(sym: string, gran: number, count: number, cb: (c: Candle[]) => void, ticks?: TickLoader) {
  const src = feedHasVolume(sym) ? null : volumeSource(sym);
  const tk = !!ticks && !feedHasVolume(sym) && tickVolOk(sym, gran);
  if (!src && !tk) return { push: cb, stop: () => {} };
  let bars: Candle[] = [], last: Candle[] = [], dead = false, timer: any = null, busy = false, futTried = false;
  let tTimer: any = null, tStarted = false, mode: 'futures' | 'ticks' = 'futures';
  const tmap = new Map<number, number>();
  if (src && getVolState(sym, gran) !== 'ok') setVolState(sym, gran, 'loading');
  if (tk && getTickState(sym, gran) !== 'ok') setTickState(sym, gran, 'loading');
  const tickBars = (): Candle[] => [...tmap.entries()].map(([t, v]) => ({ t, o: 0, h: 0, l: 0, c: 0, v }));

  const emit = () => {
    if (dead || !last.length) return;
    const fut = bars.length ? attachVolume(last, bars, gran) : null;
    let out: Candle[] = fut ?? last, used: 'futures' | 'ticks' | null = fut ? 'futures' : null;
    // ticks take over when futures volume is missing or thin (95% needed to go back, so the source does not flip on every poll)
    if (tk && tmap.size && (!fut || share(fut) < (mode === 'ticks' ? 0.95 : 0.85))) {
      const t = attachVolume(last, tickBars(), gran);
      if (!fut || share(t) > share(fut)) { out = t; used = 'ticks'; }
    }
    if (used) { mode = used; setVolUsed(sym, gran, used); }
    cb(out === last ? last.slice() : out); // always a new array, so screens re-render when only the volume state changed
    // start counting ticks when there is no futures contract, or the futures volume failed / is thin
    if (tk && !tStarted && (!src || (futTried && (!fut || share(fut) < 0.85)))) { tStarted = true; loadTicks(); }
  };

  // ---- exchange volume ----
  const miss = () => { if (bars.length) return true; futTried = true; setVolState(sym, gran, 'failed'); emit(); return false; };
  const load = async () => {
    timer = null;
    if (dead) return;
    let healthy = true;
    if (!busy) {
      busy = true;
      try {
        const b = src!.kind === 'binance' ? await bnCandles(src!.raw, gran, Math.max(count, 300)) : await yahooVolumeMulti(src!.y2 ? [src!.y, src!.y2] : [src!.y], gran);
        if (!dead && b.length) { bars = b; futTried = true; setVolState(sym, gran, 'ok'); emit(); } else if (!dead) healthy = miss();
      } catch { healthy = miss(); } finally { busy = false; }
    }
    if (!dead) timer = setTimeout(load, healthy ? 20000 : 8000);
  };

  // ---- Deriv tick volume ----
  const loadTicks = async () => {
    tTimer = null;
    if (dead) return;
    const first = tmap.size === 0, n = last.length;
    if (!n) { tTimer = setTimeout(loadTicks, 2000); return; }
    // first load: back to the oldest candle of the chart (as far as the page budget reaches, newest first, shown while loading);
    // later loads: only the newest candles (older counts never change)
    const fromT = first ? last[0].t : Math.floor(Date.now() / 1000) - 3 * gran;
    const take = (bars: Candle[]) => { bars.forEach((x) => { if (x.v !== undefined) tmap.set(x.t, x.v); }); if (bars.length) { setTickState(sym, gran, 'ok'); emit(); } };
    try {
      const b = await ticks!(sym, gran, fromT, () => !dead, first ? 5000 : 600, first ? (part) => { if (!dead) take(part); } : undefined);
      if (!dead && b.length) take(b);
      else if (!dead && !tmap.size) { setTickState(sym, gran, 'failed'); emit(); }
    } catch { if (!dead && !tmap.size) { setTickState(sym, gran, 'failed'); emit(); } }
    if (!dead) tTimer = setTimeout(loadTicks, tmap.size ? 15000 : 10000);
  };

  if (src) load();
  return { push: (c: Candle[]) => { last = c; emit(); }, stop: () => { dead = true; clearTimeout(timer); clearTimeout(tTimer); } };
}
