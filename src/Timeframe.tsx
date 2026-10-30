import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import Modal from './Modal';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from './FlatGradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from './store';

type Opt = { k: string; label: string };

// Pinned timeframes are shared by every picker in the app and remembered on the phone.
const KEY = 'tf_favs_v1';
let favs: string[] = ['60', '300', '900', '3600', '14400', '86400'];
let loaded = false;
const subs = new Set<() => void>();
const loadFavs = () => {
  if (loaded) return; loaded = true;
  AsyncStorage.getItem(KEY).then((v) => { if (v) { try { const a = JSON.parse(v); if (Array.isArray(a)) { favs = a.map(String); subs.forEach((f) => f()); } } catch {} } }).catch(() => {});
};
const toggleFav = (k: string) => { favs = favs.includes(k) ? favs.filter((x) => x !== k) : [...favs, k]; AsyncStorage.setItem(KEY, JSON.stringify(favs)).catch(() => {}); subs.forEach((f) => f()); };
function useFavs() {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force((n) => n + 1); subs.add(f); loadFavs(); return () => { subs.delete(f); }; }, []);
  return favs;
}

// a list of options is a timeframe list when every key is a number of seconds (60, 300 ... 86400)
export const isTfList = (o: Opt[]) => o.length > 1 && o.every((x) => /^\d+$/.test(x.k) && Number(x.k) >= 60);

const GROUPS = [
  { name: 'Minutes', hint: 'Scalping and precise entries', test: (s: number) => s < 3600, icon: 'flash-outline' },
  { name: 'Hours', hint: 'Intraday structure and zones', test: (s: number) => s >= 3600 && s < 86400, icon: 'time-outline' },
  { name: 'Days', hint: 'Swing trades and the big picture', test: (s: number) => s >= 86400, icon: 'calendar-outline' },
];
const groupOf = (s: number) => GROUPS.findIndex((g) => g.test(s));
const perDay = (s: number) => (s >= 86400 ? '1 candle / day' : `${Math.round(86400 / s).toLocaleString()} candles / day`);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const fullName = (s: number) => (s < 3600 ? plural(Math.round(s / 60), 'minute') : s < 86400 ? plural(+(s / 3600).toFixed(2), 'hour') : plural(Math.round(s / 86400), 'day'));
const useFor = (s: number) => (s <= 300 ? 'Scalping' : s <= 1800 ? 'Intraday entries' : s <= 14400 ? 'Structure and zones' : 'Swing and trend');

export function TfBar({ value, options, onChange }: { value: string; options: Opt[]; onChange: (k: string) => void }) {
  const { th } = useApp();
  const fav = useFavs();
  const [open, setOpen] = useState(false);
  const sc = useRef<ScrollView>(null), xs = useRef<Record<string, number>>({}), wRef = useRef(0);
  const sorted = [...options].sort((a, b) => Number(a.k) - Number(b.k));
  let quick = sorted.filter((o) => fav.includes(o.k) || o.k === value);
  if (quick.length < 2) quick = sorted;
  const cur = options.find((o) => o.k === value);
  const curS = Number(value);

  // keep the active timeframe in view
  useEffect(() => { const x = xs.current[value]; if (x !== undefined) sc.current?.scrollTo({ x: Math.max(0, x - wRef.current / 2 + 30), animated: true }); }, [value, quick.length]);

  return (
    <View style={{ gap: 6, direction: 'ltr' }}>
      {/* one dock: quick timeframes (grouped by a thin divider) + a More button */}
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: th.panel2, borderWidth: 1, borderColor: th.hair, borderRadius: 8, padding: 3, gap: 4 }}>
        <ScrollView ref={sc} horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" onLayout={(e) => { wRef.current = e.nativeEvent.layout.width; }} contentContainerStyle={{ alignItems: 'center', gap: 3, paddingRight: 4 }} style={{ flex: 1 }}>
          {quick.map((o, i) => {
            const on = value === o.k, newGroup = i > 0 && groupOf(Number(o.k)) !== groupOf(Number(quick[i - 1].k));
            return (
              <React.Fragment key={o.k}>
                {newGroup && <View style={{ width: 1, height: 18, backgroundColor: th.line, marginHorizontal: 3, opacity: 0.8 }} />}
                <Pressable onLayout={(e) => { xs.current[o.k] = e.nativeEvent.layout.x; }} onPress={() => onChange(o.k)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={fullName(Number(o.k))} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
                  {on ? (
                    <LinearGradient colors={[th.accent, th.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ minWidth: 48, height: 36, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 8, shadowColor: th.accent, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 }}>
                      <Text style={{ color: th.onAccent, fontWeight: '900', fontSize: 13, letterSpacing: 0.3 }}>{o.label}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={{ minWidth: 44, height: 36, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}>
                      <Text style={{ color: th.dim, fontWeight: '700', fontSize: 13, letterSpacing: 0.3 }}>{o.label}</Text>
                    </View>
                  )}
                </Pressable>
              </React.Fragment>
            );
          })}
        </ScrollView>
        <Pressable onPress={() => setOpen(true)} hitSlop={6} accessibilityRole="button" accessibilityLabel="All timeframes" style={({ pressed }) => ({ height: 36, paddingHorizontal: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: th.accent + '66', backgroundColor: th.accent + '1A', opacity: pressed ? 0.8 : 1 })}>
          <Ionicons name="grid-outline" size={15} color={th.accent} />
          <Text style={{ color: th.accent, fontWeight: '900', fontSize: 12 }}>More</Text>
        </Pressable>
      </View>
      {/* what the chosen timeframe means, in one quiet line */}
      {!!cur && isFinite(curS) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 }}>
          <Ionicons name={GROUPS[Math.max(0, groupOf(curS))].icon as any} size={12} color={th.accent} />
          <Text numberOfLines={1} style={{ color: th.dim, fontSize: 11.5, flex: 1 }}>
            <Text style={{ color: th.text, fontWeight: '800' }}>{fullName(curS)}</Text>{'  ·  '}{perDay(curS)}{'  ·  '}{useFor(curS)}
          </Text>
        </View>
      )}

      {open && (
        <Modal transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#000A' }}>
            <Pressable style={{ flex: 1 }} onPress={() => setOpen(false)} />
            <View style={{ backgroundColor: th.solid, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderWidth: 1, borderColor: th.line, padding: 18, paddingBottom: 30, maxHeight: '84%' }}>
              <View style={{ alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: th.line, marginBottom: 12 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <View>
                  <Text style={{ color: th.text, fontSize: 19, fontWeight: '900' }}>Timeframe</Text>
                  {!!cur && <Text style={{ color: th.dim, fontSize: 12, marginTop: 2 }}>Now showing <Text style={{ color: th.accent, fontWeight: '800' }}>{fullName(curS)}</Text></Text>}
                </View>
                <Pressable onPress={() => setOpen(false)} hitSlop={10} style={{ width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: th.panel2, borderWidth: 1, borderColor: th.hair }}><Ionicons name="close" size={18} color={th.dim} /></Pressable>
              </View>
              <Text style={{ color: th.dim, fontSize: 12, marginTop: 8, marginBottom: 12 }}>Tap one to switch. Tap the star to pin it to the quick bar.</Text>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
                {GROUPS.map((g) => {
                  const list = sorted.filter((o) => g.test(Number(o.k)));
                  if (!list.length) return null;
                  return (
                    <View key={g.name}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                        <View style={{ width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: th.accent + '22' }}><Ionicons name={g.icon as any} size={13} color={th.accent} /></View>
                        <Text style={{ color: th.text, fontWeight: '900', fontSize: 13.5 }}>{g.name}</Text>
                        <Text style={{ color: th.dim, fontSize: 11.5, flex: 1 }} numberOfLines={1}>{g.hint}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {list.map((o) => {
                          const on = value === o.k, pin = fav.includes(o.k), sec = Number(o.k);
                          return (
                            <Pressable key={o.k} onPress={() => { onChange(o.k); setOpen(false); }} style={{ width: '31%', flexGrow: 1, borderRadius: 8, overflow: 'hidden' }}>
                              <LinearGradient colors={on ? [th.accent, th.accent2] : [th.panel2, th.panel2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingVertical: 11, paddingHorizontal: 12, borderWidth: 1, borderColor: on ? th.accent : th.hair, borderRadius: 8 }}>
                                <Text style={{ color: on ? th.onAccent : th.text, fontWeight: '900', fontSize: 19, letterSpacing: 0.3 }}>{o.label}</Text>
                                <Text style={{ color: on ? th.onAccent : th.dim, opacity: on ? 0.9 : 1, fontSize: 11, marginTop: 1, fontWeight: '700' }} numberOfLines={1}>{fullName(sec)}</Text>
                                <Text style={{ color: on ? th.onAccent : th.dim, opacity: on ? 0.75 : 0.85, fontSize: 10, marginTop: 4 }} numberOfLines={1}>{useFor(sec)}</Text>
                                <Pressable onPress={() => toggleFav(o.k)} hitSlop={10} style={{ position: 'absolute', top: 8, right: 8 }}>
                                  <Ionicons name={pin ? 'star' : 'star-outline'} size={16} color={pin ? (on ? th.onAccent : th.gold) : on ? th.onAccent : th.dim} />
                                </Pressable>
                              </LinearGradient>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
                <Pressable onPress={() => { favs = ['60', '300', '900', '3600', '14400', '86400']; AsyncStorage.setItem(KEY, JSON.stringify(favs)).catch(() => {}); subs.forEach((f) => f()); }} style={{ alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 10 }}>
                  <Text style={{ color: th.dim, fontSize: 12, fontWeight: '700' }}>Reset pinned timeframes</Text>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}
