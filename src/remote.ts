// Keeps the server's copy of the price alerts and scanner settings up to date, so the server can ring the phone when the app is closed.
// Every change is sent after a short pause (many taps = one request). If the server is unreachable it tries again a bit later.
import { alertsSync } from './license';

type Item = { id: string; name: string; sess: boolean };
export type RemoteScan = { on: boolean; minProb: number; tf: number; items: Item[]; mute?: string[] }; // mute: "symId:side" of trades that already run, the server stays quiet about them

let token = '', getAlerts: () => any[] = () => [], scan: RemoteScan | undefined, timer: any = null, retry = 0;
let onFired: (ids: string[]) => void = () => {};

async function flush() {
  timer = null;
  if (!token) return;
  try {
    const r = await alertsSync(token, { alerts: getAlerts(), ...(scan ? { scan } : {}) });
    retry = 0;
    if (r.fired?.length) onFired(r.fired); // alerts the server already rang while the app was closed: remove them here too
  } catch {
    if (retry++ < 5) timer = setTimeout(flush, 20000);
  }
}
export const remote = {
  setToken(t: string) { const changed = t !== token; token = t; if (t && changed) remote.queue(); },
  source(fn: () => any[]) { getAlerts = fn; },
  fired(fn: (ids: string[]) => void) { onFired = fn; },
  setScan(s: RemoteScan) { scan = s; remote.queue(); },
  queue() { if (!token) return; clearTimeout(timer); timer = setTimeout(flush, 1500); },
};
