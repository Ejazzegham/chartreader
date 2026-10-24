import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import { useApp } from './store';
import { Icon } from './ui';
import { Coin } from './MarketWidgets';
import { useFeed, chg, symOf, SYMBOLS, toggleFav, setWatch, Sym } from './markets';
import { useDash, setDash, groupOf } from './dash';

// Every market in one panel: all pairs, a search box and tabs. Used on the home page (right column) and on every other page (right panel).
// Tap a pair and the home chart switches to it. The star keeps a pair in the Favourites tab.
const METALS = ['frxXAUUSD', 'frxXAGUSD', 'frxWTI', 'frxBRENT'];
const FX_FIRST = ['frxDXY', 'frxEURUSD', 'frxGBPUSD', 'frxUSDJPY', 'frxAUDUSD', 'frxUSDCAD', 'frxUSDCHF', 'frxNZDUSD', 'frxEURJPY', 'frxGBPJPY'];
const kind = (s: Sym) => (s.cat === 'crypto' ? 'Crypto' : s.cat === 'deriv' ? 'Deriv' : METALS.includes(s.id) ? 'Metals' : 'Forex');
const TABS = ['All', 'Forex', 'Metals', 'Crypto', 'Deriv', 'Favourites'];

export default function MarketsPanel({ height, goHome = false }: { height: number; goHome?: boolean }) {
  const { th, setTab } = useApp();
  const { quotes, db } = useFeed(true);
  const d = useDash();
  const [tab, setT] = useState('All');
  const [q, setQ] = useState('');
  const ordered = useMemo(() => {
    const rank = (s: Sym) => { const i = FX_FIRST.indexOf(s.id); return i < 0 ? 99 : i; };
    const order = ['Forex', 'Metals', 'Crypto', 'Deriv'];
    return [...SYMBOLS].sort((a, b) => order.indexOf(kind(a)) - order.indexOf(kind(b)) || rank(a) - rank(b));
  }, []);
  const rows = useMemo(() => {
    const k = q.trim().toLowerCase();
    return ordered.filter((s) => (k ? (s.name + ' ' + s.id).toLowerCase().includes(k) : tab === 'All' ? true : tab === 'Favourites' ? db.favs.includes(s.id) : kind(s) === tab));
  }, [ordered, tab, q, db.favs.join(',')]);
  useEffect(() => { setWatch('panel', rows.slice(0, 70).map((s) => s.id)); return () => setWatch('panel', []); }, [rows.map((s) => s.id).join(',')]);

  return (
    <View style={{ height, borderRadius: 14, borderWidth: 1, borderColor: th.line, backgroundColor: th.dark ? th.panel : '#FFFFFF', overflow: 'hidden', shadowColor: '#101828', shadowOpacity: 0.05, shadowRadius: 18, shadowOffset: { width: 0, height: 6 } }}>
      <View style={{ padding: 16, paddingBottom: 10, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ flex: 1, color: th.text, fontSize: 15, fontWeight: '700', letterSpacing: 0.2 }}>Markets</Text>
          <Text style={{ color: th.dim, fontSize: 11.5 }}>{rows.length} pairs</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 36, paddingHorizontal: 11, borderRadius: 10, borderWidth: 1, borderColor: th.line, backgroundColor: th.dark ? th.panel2 : '#FAFAF8' }}>
          <Icon name="search" size={15} color={th.dim} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search a pair" placeholderTextColor={th.dim} style={{ flex: 1, color: th.text, fontSize: 13, outlineStyle: 'none' } as any} />
          {!!q && <Pressable onPress={() => setQ('')} hitSlop={6} style={{ cursor: 'pointer' } as any}><Icon name="close-circle" size={15} color={th.dim} /></Pressable>}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {TABS.map((k) => (
            <Pressable key={k} onPress={() => { setT(k); setQ(''); }} style={{ paddingBottom: 5, borderBottomWidth: 2, borderBottomColor: tab === k && !q ? th.accent : 'transparent', cursor: 'pointer' } as any}>
              <Text style={{ color: tab === k && !q ? th.text : th.dim, fontSize: 12.5, fontWeight: tab === k && !q ? '700' : '500' }}>{k === 'Favourites' ? '★' : k}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={{ height: 1, backgroundColor: th.line }} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 4 }} showsVerticalScrollIndicator={false}>
        {rows.length === 0 && <Text style={{ color: th.dim, fontSize: 12.5, padding: 18, lineHeight: 18 }}>{tab === 'Favourites' && !q ? 'Tap the star on a pair to keep it here.' : 'No pair found.'}</Text>}
        {rows.map((s) => {
          const x = quotes[s.id], c = chg(s.id), on = d.sym === s.id, fav = db.favs.includes(s.id);
          return (
            <Pressable key={s.id} onPress={() => { setDash({ sym: s.id, market: groupOf(s.cat) }); if (goHome) setTab(0); }} style={((st: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 16, cursor: 'pointer', borderLeftWidth: 3, borderLeftColor: on ? th.accent : 'transparent', backgroundColor: on ? th.accent + '12' : st.hovered ? th.accent + '08' : 'transparent' })) as any}>
              <Coin s={s} size={30} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: th.text, fontSize: 13, fontWeight: on ? '700' : '600' }} numberOfLines={1}>{s.name}</Text>
                <Text style={{ color: th.dim, fontSize: 10.5 }}>{kind(s)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: th.text, fontSize: 12.5, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{x ? x.price.toFixed(x.dec) : '—'}</Text>
                <Text style={{ color: x ? (c >= 0 ? th.buy : th.sell) : th.dim, fontSize: 11, fontWeight: '600' }}>{x ? `${c >= 0 ? '+' : '−'}${Math.abs(c).toFixed(2)}%` : ''}</Text>
              </View>
              <Pressable onPress={() => toggleFav(s.id)} hitSlop={6} style={{ cursor: 'pointer' } as any}><Icon name={fav ? 'star' : 'star-outline'} size={15} color={fav ? th.gold : th.dim + '88'} /></Pressable>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
