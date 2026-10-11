import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Image } from 'react-native';
import { useApp } from './store';
import { Icon, LiveDot, Card, Dim, Body } from './ui';
import { LogoMark } from './Brand';
import { NAV } from './nav';
import { useLayout } from './win';
import { useFeed, chg, nameOf, setWatch, symOf, Sym, SYMBOLS } from './markets';
import { Sessions, SymbolSheet } from './MarketWidgets';
import NewsBanner from './NewsBanner';

// The desktop website: [ sidebar ] [ page ] [ market watch ]. The pages themselves are the same screens as on the phone.
export const useDesktop = () => useLayout().mode === 'desktop';

const GROUPS: { title: string; items: number[] }[] = [
  { title: 'TRADE', items: [0, 1, 2, 3, 4, 5] },
  { title: 'PRO TOOLS', items: [8, 9, 11, 13] },
  { title: 'MORE', items: [6, 14, 15] },
];

function Sidebar({ width }: { width: number }) {
  const { th, t, tab, setTab, account, avatar, lic } = useApp();
  return (
    <View style={{ width, backgroundColor: th.panel, borderRightWidth: 1, borderRightColor: th.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, paddingBottom: 14 }}>
        <LogoMark size={44} radius={10} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: th.accent, fontSize: 19, fontWeight: '900', letterSpacing: -0.4 }} numberOfLines={1}>Chart Reader</Text>
          <Text style={{ color: th.dim, fontSize: 9, fontWeight: '700', letterSpacing: 0.7 }} numberOfLines={1}>ANALYZE • LEARN • TRADE</Text>
        </View>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
        {GROUPS.map((g) => (
          <View key={g.title} style={{ marginTop: 14 }}>
            <Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '800', letterSpacing: 1.4, paddingHorizontal: 10, marginBottom: 6 }}>{g.title}</Text>
            {g.items.map((i) => {
              const n = NAV[i], on = tab === i;
              return (
                <Pressable key={n.key} accessibilityRole="button" onPress={() => setTab(i)}
                  style={((s: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, height: 42, paddingHorizontal: 10, borderRadius: 10, marginBottom: 2, cursor: 'pointer', backgroundColor: on ? th.accent + '22' : s.hovered ? th.accent + '10' : 'transparent' })) as any}>
                  <View style={{ position: 'absolute', left: 0, top: 9, bottom: 9, width: 3, borderRadius: 2, backgroundColor: on ? th.accent : 'transparent' }} />
                  <Icon name={n.icon} size={19} color={on ? th.accent : th.dim} />
                  <Text style={{ color: on ? th.accent : th.text, fontSize: 14, fontWeight: on ? '800' : '600' }} numberOfLines={1}>{t(n.key)}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>
      <Pressable onPress={() => setTab(6)} style={((s: any) => ({ margin: 12, padding: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10, cursor: 'pointer', borderWidth: 1, borderColor: th.line, backgroundColor: s.hovered ? th.accent + '10' : th.panel2 })) as any}>
        {avatar ? <Image source={{ uri: avatar }} style={{ width: 38, height: 38, borderRadius: 19 }} /> : (
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: th.accent + '26', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: th.accent, fontSize: 16, fontWeight: '900' }}>{(account?.name ?? '?').trim().charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ color: th.text, fontSize: 13.5, fontWeight: '800' }} numberOfLines={1}>{account?.name ?? ''}</Text>
          <Text style={{ color: th.dim, fontSize: 11 }} numberOfLines={1}>{lic.admin ? 'Admin' : lic.status === 'paid' ? 'PRO plan' : lic.status === 'trial' ? 'Free trial' : 'Account'}</Text>
        </View>
        <Icon name="settings-outline" size={17} color={th.dim} />
      </Pressable>
    </View>
  );
}

const MAJORS = ['cryBTCUSD', 'cryETHUSD', 'frxXAUUSD', 'frxXAGUSD', 'frxEURUSD', 'frxGBPUSD', 'frxUSDJPY', 'frxUSDCAD', 'frxDXY'];

function Rail({ width }: { width: number }) {
  const { th, t, setTab } = useApp();
  const { quotes, db } = useFeed(true);
  const [sel, setSel] = useState<Sym | null>(null);
  const ids = Array.from(new Set([...db.favs.slice(0, 8), ...MAJORS.filter((id) => SYMBOLS.some((x) => x.id === id))])).slice(0, 14);
  useEffect(() => { setWatch('rail', ids); return () => setWatch('rail', []); }, [ids.join(',')]);
  return (
    <View style={{ width, backgroundColor: th.panel, borderLeftWidth: 1, borderLeftColor: th.line }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: th.text, fontSize: 16, fontWeight: '900' }}>Market watch</Text>
          <LiveDot />
        </View>
        <Card style={{ padding: 6 }}>
          {ids.length === 0 ? <View style={{ padding: 10 }}><Body color={th.dim}>Waiting for live prices...</Body></View> : ids.map((id, i) => {
            const x = quotes[id], c = chg(id), col = c >= 0 ? th.buy : th.sell;
            return (
              <Pressable key={id} onPress={() => setSel(symOf(id))} style={((s: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 8, cursor: 'pointer', borderTopWidth: i ? 1 : 0, borderTopColor: th.line, backgroundColor: s.hovered ? th.accent + '10' : 'transparent' })) as any}>
                <Text style={{ flex: 1, color: th.text, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>{nameOf(id)}</Text>
                <Text style={{ color: th.text, fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{x ? x.price.toFixed(x.dec) : '—'}</Text>
                <View style={{ minWidth: 62, alignItems: 'flex-end' }}>
                  <Text style={{ color: col, fontSize: 12, fontWeight: '800' }}>{x ? `${c >= 0 ? '+' : '−'}${Math.abs(c).toFixed(2)}%` : '—'}</Text>
                </View>
              </Pressable>
            );
          })}
        </Card>
        <Pressable onPress={() => setTab(2)} style={{ alignSelf: 'flex-end', cursor: 'pointer' } as any}><Text style={{ color: th.accent, fontSize: 12.5, fontWeight: '800' }}>{t('tabMarkets')} ›</Text></Pressable>
        <NewsBanner />
        <Sessions />
        <Dim>Educational tool, not financial advice.</Dim>
      </ScrollView>
      <SymbolSheet sym={sel} onClose={() => setSel(null)} />
    </View>
  );
}

export function DesktopShell({ children }: { children: React.ReactNode }) {
  const L = useLayout();
  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <Sidebar width={L.sidebar} />
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
      {L.rail > 0 && <Rail width={L.rail} />}
    </View>
  );
}
