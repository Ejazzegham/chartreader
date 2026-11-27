import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useApp } from '../store';
import { Icon } from '../ui';
import Guide from './Guide';
import About from './About';

// "Help & About": How to use (Guide) and About us on one page.
// Tab 14 is this page. The old About slot (tab 15) forwards here and opens the About view.
export type HelpView = 'guide' | 'about';
let want: HelpView | null = null;
const subs = new Set<(v: HelpView) => void>();
export function openHelp(v: HelpView) { want = v; subs.forEach((f) => f(v)); }

export const GoHelpAbout = function GoHelpAbout() {
  const { tab, setTab } = useApp();
  useEffect(() => { if (tab === 15) { openHelp('about'); setTab(14); } }, [tab]);
  return null;
};

export default function HelpAbout() {
  const { th, t, settings } = useApp();
  const [view, setView] = useState<HelpView>('guide');
  useEffect(() => {
    if (want) { setView(want); want = null; }
    subs.add(setView);
    return () => { subs.delete(setView); };
  }, []);

  const seg = (k: HelpView, icon: string, label: string) => {
    const on = view === k;
    return (
      <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setView(k)}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, borderRadius: 6, backgroundColor: on ? th.accent : 'transparent', cursor: 'pointer' } as any}>
        <Icon name={icon} size={16} color={on ? th.onAccent : th.dim} />
        <Text style={{ color: on ? th.onAccent : th.text, fontWeight: '800', fontSize: 14 }} numberOfLines={1}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
        <View style={{ flexDirection: 'row', gap: 4, padding: 4, maxWidth: 520, alignSelf: 'center', width: '100%', borderRadius: 8, borderWidth: 1, borderColor: th.line, backgroundColor: th.panel2 }}>
          {seg('guide', 'help-circle', t('tabGuide'))}
          {seg('about', 'information-circle', t('tabAbout'))}
        </View>
      </View>
      <View style={{ flex: 1, display: view === 'guide' ? 'flex' : 'none' }}><Guide /></View>
      <View style={{ flex: 1, display: view === 'about' ? 'flex' : 'none' }}><About /></View>
    </View>
  );
}
