import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Platform } from 'react-native';
import { Icon } from './ui';
import { Panel, Head, VisitBtn, Avatar, Rank, Chip, Pal } from './DirectoryBody';
import { PROP_FIRMS, PropFirm, domainOf, searchFirms, DETAILS, featuredFirms, COMPARE_ROWS, MAX_COMPARE, toggleCompare, GUIDES, Guide } from './propFirms';

const hand: any = Platform.OS === 'web' ? { cursor: 'pointer' } : null;
const NA = 'Check website';

// ---------- Featured ----------
export function FeaturedTab({ P, w, onCompare }: { P: Pal; w: number; onCompare: (name: string) => void }) {
  const list = featuredFirms(), cols = w >= 960 ? 3 : w >= 620 ? 2 : 1;
  return (
    <View style={{ gap: 16 }}>
      <Head P={P} icon="star-outline" title="Featured Prop Firms" sub="Hand-picked firms to start your research. Always confirm current rules and fees on the official site." />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        {list.map((f) => {
          const d = DETAILS[f.name] ?? {};
          return (
            <View key={f.name} style={{ flexGrow: 1, flexBasis: `${Math.floor(100 / cols) - 3}%`, minWidth: 0 }}>
              <Panel P={P} style={{ gap: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Avatar P={P} f={f} size={52} />
                  <View style={{ paddingHorizontal: 10, height: 26, borderRadius: 13, justifyContent: 'center', backgroundColor: P.soft }}><Text style={{ color: P.blue, fontSize: 12, fontWeight: '800' }}>{d.badge ?? `Rank #${f.rank}`}</Text></View>
                </View>
                <View style={{ gap: 2 }}>
                  <Text style={{ color: P.head, fontSize: 20, fontWeight: '900' }} numberOfLines={1}>{f.name}</Text>
                  <Text style={{ color: P.body, fontSize: 13 }} numberOfLines={1}>{domainOf(f.url)}</Text>
                </View>
                <Text style={{ color: P.body, fontSize: 13, lineHeight: 19 }}>{d.tagline ?? f.note ?? 'Funded trading program. Read the current rules, fees and payout terms on the official website.'}</Text>
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <View style={{ flex: 1 }}><VisitBtn P={P} f={f} /></View>
                  <Pressable onPress={() => onCompare(f.name)} accessibilityRole="button" accessibilityLabel={`Compare ${f.name}`} style={((s: any) => ({ height: 44, paddingHorizontal: 16, borderRadius: 10, justifyContent: 'center', borderWidth: 1, borderColor: P.border, backgroundColor: s.hovered ? P.soft : P.alt, ...hand })) as any}>
                    <Text style={{ color: P.head, fontSize: 13.5, fontWeight: '800' }}>Compare</Text>
                  </Pressable>
                </View>
              </Panel>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ---------- Compare ----------
export function CompareTab({ P, w, sel, setSel }: { P: Pal; w: number; sel: string[]; setSel: (s: string[]) => void }) {
  const [q, setQ] = useState('');
  const picks = sel.map((n) => PROP_FIRMS.find((f) => f.name === n)).filter(Boolean) as PropFirm[];
  const found = useMemo(() => searchFirms(q).slice(0, 12), [q]);
  const cell = (f: PropFirm, key: string) => key === 'rank' ? `#${f.rank}` : key === 'site' ? domainOf(f.url) : ((DETAILS[f.name] as any)?.[key] ?? NA);
  const colW = w >= 900 ? undefined : 150;
  return (
    <View style={{ gap: 16 }}>
      <Panel P={P}>
        <Head P={P} icon="git-compare-outline" title="Compare Prop Firms" sub={`Pick up to ${MAX_COMPARE} firms to see them side by side. ${sel.length} / ${MAX_COMPARE} selected.`}
          right={sel.length > 0 ? <Chip P={P} label="Clear" on={false} onPress={() => setSel([])} /> : undefined} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: P.border, backgroundColor: P.alt }}>
          <Icon name="search" size={18} color={P.body} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search a prop firm to add" placeholderTextColor={P.body} accessibilityLabel="Search prop firms to compare" autoCapitalize="none" autoCorrect={false} style={{ flex: 1, color: P.head, fontSize: 14, outlineStyle: 'none' } as any} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {found.map((f) => <Chip key={f.name} P={P} label={f.name} on={sel.includes(f.name)} onPress={() => setSel(toggleCompare(sel, f.name))} />)}
        </View>
      </Panel>
      {picks.length < 2 ? (
        <Panel P={P} style={{ alignItems: 'center', padding: 32 }}>
          <Text style={{ color: P.head, fontSize: 15, fontWeight: '800' }}>Select at least two firms</Text>
          <Text style={{ color: P.body, fontSize: 13, textAlign: 'center' }}>Tap firm names above. You can also press Compare on any Featured card.</Text>
        </Panel>
      ) : (
        <Panel P={P} style={{ padding: 0, overflow: 'hidden' }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ minWidth: '100%' as any }}>
              <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: P.border }}>
                <View style={{ width: 150, padding: 14 }} />
                {picks.map((f) => (
                  <View key={f.name} style={{ flex: 1, width: colW, minWidth: 150, padding: 14, gap: 8, alignItems: 'flex-start' }}>
                    <Avatar P={P} f={f} size={44} />
                    <Text style={{ color: P.head, fontSize: 15, fontWeight: '900' }} numberOfLines={1}>{f.name}</Text>
                    <VisitBtn P={P} f={f} compact />
                    <Pressable onPress={() => setSel(sel.filter((n) => n !== f.name))} accessibilityRole="button" accessibilityLabel={`Remove ${f.name}`} style={hand}><Text style={{ color: P.body, fontSize: 12, fontWeight: '700' }}>Remove</Text></Pressable>
                  </View>
                ))}
              </View>
              {COMPARE_ROWS.map((r, i) => (
                <View key={r.key} style={{ flexDirection: 'row', backgroundColor: i % 2 ? P.alt : P.card }}>
                  <Text style={{ width: 150, padding: 14, color: P.body, fontSize: 12.5, fontWeight: '700' }}>{r.label}</Text>
                  {picks.map((f) => { const v = cell(f, r.key); return <Text key={f.name} style={{ flex: 1, width: colW, minWidth: 150, padding: 14, color: v === NA ? P.body : P.head, fontSize: 13, fontWeight: v === NA ? '500' : '700' }}>{v}</Text>; })}
                </View>
              ))}
            </View>
          </ScrollView>
        </Panel>
      )}
      <Text style={{ color: P.body, fontSize: 12, lineHeight: 18 }}>Rules and prices change often. Where a value says “{NA}”, open the firm’s official site and read its current terms before you buy.</Text>
    </View>
  );
}

// ---------- Guide ----------
export function GuideTab({ P, w }: { P: Pal; w: number }) {
  const [open, setOpen] = useState<string | null>(null);
  const g = GUIDES.find((x) => x.id === open);
  if (g) {
    const firms = g.top ? PROP_FIRMS.slice(0, g.top) : [];
    return (
      <View style={{ gap: 16 }}>
        <Pressable onPress={() => setOpen(null)} accessibilityRole="button" style={[{ flexDirection: 'row', alignItems: 'center', gap: 6 }, hand]}><Icon name="arrow-back" size={16} color={P.blue} /><Text style={{ color: P.blue, fontSize: 13.5, fontWeight: '800' }}>Back to guides</Text></Pressable>
        <Panel P={P}>
          <Head P={P} icon={g.icon} title={g.title} sub={g.sub} />
          {g.sections.map((s) => (
            <View key={s.h} style={{ gap: 4 }}>
              <Text style={{ color: P.head, fontSize: 15, fontWeight: '800' }}>{s.h}</Text>
              <Text style={{ color: P.body, fontSize: 13.5, lineHeight: 21 }}>{s.p}</Text>
            </View>
          ))}
          {firms.map((f) => (
            <View key={f.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: P.border, backgroundColor: P.card }}>
              <Rank f={f} /><Avatar P={P} f={f} />
              <View style={{ flex: 1, minWidth: 0 }}><Text style={{ color: P.head, fontSize: 14.5, fontWeight: '800' }} numberOfLines={1}>{f.name}</Text><Text style={{ color: P.body, fontSize: 12.5 }} numberOfLines={1}>{domainOf(f.url)}</Text></View>
              <VisitBtn P={P} f={f} compact />
            </View>
          ))}
        </Panel>
      </View>
    );
  }
  const cols = w >= 900 ? 3 : w >= 600 ? 2 : 1;
  return (
    <View style={{ gap: 16 }}>
      <Head P={P} icon="book-outline" title="Prop Firm Guides" sub="Plain-language guides to help you pick and use a funded account wisely." />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        {GUIDES.map((x: Guide) => (
          <Pressable key={x.id} onPress={() => setOpen(x.id)} accessibilityRole="button" accessibilityLabel={x.title} style={{ flexGrow: 1, flexBasis: `${Math.floor(100 / cols) - 3}%`, minWidth: 0, ...hand }}>
            <Panel P={P} style={{ gap: 10, height: '100%' as any }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: P.soft, alignItems: 'center', justifyContent: 'center' }}><Icon name={x.icon} size={20} color={P.blue} /></View>
                <View style={{ paddingHorizontal: 10, height: 24, borderRadius: 12, justifyContent: 'center', backgroundColor: P.alt, borderWidth: 1, borderColor: P.border }}><Text style={{ color: P.body, fontSize: 11.5, fontWeight: '800' }}>{x.tag}</Text></View>
              </View>
              <Text style={{ color: P.head, fontSize: 16, fontWeight: '800' }}>{x.title}</Text>
              <Text style={{ color: P.body, fontSize: 13, lineHeight: 19 }}>{x.sub}</Text>
              <Text style={{ color: P.blue, fontSize: 13, fontWeight: '800' }}>Read guide</Text>
            </Panel>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
