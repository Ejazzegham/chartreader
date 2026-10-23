// A and A+ setups that the server's background scanner found while the app was closed. They travel inside the notification (inbox item);
// when the app opens it copies them into the Journal for Take / Skip. This file is plain logic (no React) so it is tested on its own.
import type { Signal } from './trades';
import type { InboxItem } from './license';

export const SETUP_MAX_AGE = 4 * 3600 * 1000; // older than this the price has moved on: the setup is not copied

export type JournalSetup = Pick<Signal, 'symId' | 'name' | 'side' | 'entry' | 'sl' | 'tps' | 'tf' | 'dec' | 'source' | 'grade' | 'score'> & Partial<Pick<Signal, 'why' | 'zone'>>;

// The setups of one notification that belong in the Journal: grade A or A+, a valid entry / stop / targets, and fresh.
export function setupsToLog(item: Pick<InboxItem, 'at' | 'setups'>, now = Date.now()): JournalSetup[] {
  if (!item.setups?.length || now - item.at > SETUP_MAX_AGE) return [];
  const out: JournalSetup[] = [];
  for (const x of item.setups) {
    if (!x || !['A', 'A+'].includes(x.grade) || !x.symId || !isFinite(x.entry) || !isFinite(x.sl) || x.entry === x.sl || !x.tps?.length) continue;
    if (x.side === 'buy' ? x.sl >= x.entry : x.sl <= x.entry) continue; // stop on the wrong side
    out.push({ symId: x.symId, name: x.name || x.symId, tf: String(x.tf ?? 900), dec: x.entry >= 100 ? 2 : x.entry >= 10 ? 3 : 5, side: x.side, entry: x.entry, sl: x.sl, tps: x.tps.slice(0, 3), score: x.score, grade: x.grade, source: `Scanner · ${x.basis ?? 'Combined'}`, why: x.why, zone: x.zone });
  }
  return out;
}
