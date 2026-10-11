import { useEffect } from 'react';
import { useApp } from './store';
import { scheduleState } from './session';
import { symOf } from './markets';

export type Logged = { side: 'buy' | 'sell'; entry: number; sl: number; tps: number[]; score: number; grade: string; source: string; armed?: boolean; why?: string[]; zone?: [number, number]; level?: number };

// Every analysis screen calls this with the setup it is showing. The setup lands in the Journal as a signal
// (only while that screen is open, so hidden pages never fill the list). Duplicates are merged by the store.
export function useSignalLog(a: { active: boolean; symId: string; name: string; tf: string; dec: number; setup?: Logged | null }) {
  const { logSignal } = useApp();
  const s = a.setup;
  const key = s ? `${a.symId}|${a.tf}|${s.source}|${s.side}|${s.entry.toFixed(a.dec)}|${s.sl.toFixed(a.dec)}|${s.grade}|${s.armed ? 1 : 0}` : '';
  useEffect(() => {
    if (!a.active || !s) return;
    if (!scheduleState(a.symId, symOf(a.symId).cat, new Date()).open) return; // weekend: Friday's candles are not a live setup
    logSignal({ symId: a.symId, name: a.name, tf: a.tf, dec: a.dec, side: s.side, entry: s.entry, sl: s.sl, tps: [...s.tps], score: s.score, grade: s.grade, source: s.source, armed: s.armed, why: s.why, zone: s.zone, level: s.level });
  }, [a.active, key]);
}
