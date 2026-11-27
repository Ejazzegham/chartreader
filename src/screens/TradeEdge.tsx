import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useApp } from '../store';
import { Icon } from '../ui';
import Checklist from './Checklist';
import Performance from './Performance';

// "Trade Edge": the Trade Checklist (before the trade) and Performance (after the trade) on one page.
// Tab 9 is this page. The old Checklist slot (tab 11) forwards here and opens the Checklist view.
export type EdgeView = 'checklist' | 'performance';
let want: EdgeView | null = null;
const subs = new Set<(v: EdgeView) => void>();
export function openEdge(v: EdgeView) { want = v; subs.forEach((f) => f(v)); }

export const GoEdgeChecklist = function GoEdgeChecklist() {
  const { tab, setTab } = useApp();
  useEffect(() => { if (tab === 11) { openEdge('checklist'); setTab(9); } }, [tab]);
  return null;
};

export default function TradeEdge() {
  const { th } = useApp();
  const [view, setView] = useState<EdgeView>('performance');
  useEffect(() => {
    if (want) { setView(want); want = null; }
    subs.add(setView);
    return () => { subs.delete(setView); };
  }, []);

  const seg = (k: EdgeView, icon: string, label: string) => {
    const on = view === k;
    return (
      <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setView(k)}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, borderRadius: 6, backgroundColor: on ? th.accent : 'transparent', cursor: 'pointer' } as any}>
        <Icon name={icon} size={16} color={on ? th.onAccent : th.dim} />
        <Text style={{ color: on ? th.onAccent : th.text, fontWeight: '800', fontSize: 14 }}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
        <View style={{ flexDirection: 'row', gap: 4, padding: 4, maxWidth: 520, alignSelf: 'center', width: '100%', borderRadius: 8, borderWidth: 1, borderColor: th.line, backgroundColor: th.panel2 }}>
          {seg('checklist', 'shield-checkmark', 'Trade Checklist')}
          {seg('performance', 'stats-chart', 'Performance')}
        </View>
      </View>
      <View style={{ flex: 1, display: view === 'checklist' ? 'flex' : 'none' }}><Checklist /></View>
      <View style={{ flex: 1, display: view === 'performance' ? 'flex' : 'none' }}><Performance /></View>
    </View>
  );
}
