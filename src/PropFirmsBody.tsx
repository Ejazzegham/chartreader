import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Platform } from 'react-native';
import DirectoryBody, { DirectoryCfg, usePal } from './DirectoryBody';
import { PROP_FIRMS, toggleCompare } from './propFirms';
import { FeaturedTab, CompareTab, GuideTab } from './PropFirmsTabs';
import { Icon } from './ui';

// Prop Firms: four tabs like BabyPips (Featured, Directory, Compare, Guide). Data and guide text live in src/propFirms.ts.
const CFG: DirectoryCfg = {
  items: PROP_FIRMS, ranked: true, noun: 'prop firm', nouns: 'firms', icon: 'trophy-outline', listTitle: 'Prop Firms', noChoose: true,
  intro: `A proprietary (prop) trading firm gives you a funded account after you pass its evaluation. Below are ${PROP_FIRMS.length} prop firms in ranked order, each with a direct link to its official website. Always read a firm’s current rules and fees on its own site before you pay.`,
  chooseTitle: '', chooseSub: '', checks: [],
  disclaimer: 'Rankings show the order chosen by Chart Reader and are not financial advice or a guarantee of any firm’s service or payouts. Prop firms charge fees, and trading carries a high risk of loss. Rules, prices and availability change, so confirm every detail on the firm’s official website. Links open external sites that we do not control.',
};
const TABS = [
  { id: 'featured', label: 'Featured', icon: 'star-outline' },
  { id: 'directory', label: 'Directory', icon: 'list-outline' },
  { id: 'compare', label: 'Compare', icon: 'git-compare-outline' },
  { id: 'guide', label: 'Guide', icon: 'book-outline' },
] as const;
type TabId = typeof TABS[number]['id'];
const hand: any = Platform.OS === 'web' ? { cursor: 'pointer' } : null;

export default function PropFirmsBody({ w }: { w: number }) {
  const P = usePal();
  const [tab, setTab] = useState<TabId>('featured'), [sel, setSel] = useState<string[]>([]);
  const addCompare = (name: string) => { setSel((s) => (s.includes(name) ? s : toggleCompare(s, name))); setTab('compare'); };
  return (
    <View style={{ gap: 20 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        <View accessibilityRole={'tablist' as any} style={{ flexDirection: 'row', gap: 8, padding: 6, borderRadius: 14, borderWidth: 1, borderColor: P.border, backgroundColor: P.card, flexGrow: 1 }}>
          {TABS.map((t) => { const on = tab === t.id; return (
            <Pressable key={t.id} onPress={() => setTab(t.id)} accessibilityRole={'tab' as any} accessibilityState={{ selected: on }}
              style={((s: any) => ({ flex: 1, minWidth: 96, height: 42, borderRadius: 10, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? P.blue : s.hovered ? P.soft : 'transparent', ...hand })) as any}>
              <Icon name={t.icon} size={16} color={on ? P.th.onAccent : P.head} />
              <Text style={{ color: on ? P.th.onAccent : P.head, fontSize: 14, fontWeight: '800' }}>{t.label}</Text>
            </Pressable>); })}
        </View>
      </ScrollView>
      {tab === 'featured' && <FeaturedTab P={P} w={w} onCompare={addCompare} />}
      {tab === 'directory' && <DirectoryBody w={w} cfg={CFG} />}
      {tab === 'compare' && <CompareTab P={P} w={w} sel={sel} setSel={setSel} />}
      {tab === 'guide' && <GuideTab P={P} w={w} />}
      {tab !== 'directory' && (
        <View style={{ flexDirection: 'row', gap: 12, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: P.th.gold + '66', backgroundColor: P.th.gold + '14' }}>
          <Icon name="warning-outline" size={20} color={P.th.gold} />
          <Text style={{ flex: 1, color: P.head, fontSize: 12.5, lineHeight: 19 }}>{CFG.disclaimer}</Text>
        </View>
      )}
    </View>
  );
}
