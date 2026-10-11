import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../store';
import { Screen, Card, Dim, Btn, Badge, SectionTitle, Icon } from '../ui';
import { ScoreRing } from '../ProUI';

const KEY = 'pretrade.v1';
const DEFAULTS = [
  'Higher timeframe direction agrees with my trade',
  'Entry is at a clear zone (order block, FVG, support or resistance)',
  'Stop loss is placed and risk is 1% or less',
  'Reward is at least 2R to the first target',
  'No high-impact news in the next 30 minutes',
  'I am inside an active session or killzone',
  'I am calm: no revenge trading, no FOMO',
];
type Saved = { items: string[]; checked: boolean[]; day: string; streak: number; lastDay: string };
const today = () => new Date().toISOString().slice(0, 10);
const yesterday = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10);

export default function Checklist() {
  const { th, t } = useApp();
  const [items, setItems] = useState<string[]>(DEFAULTS);
  const [checked, setChecked] = useState<boolean[]>(DEFAULTS.map(() => false));
  const [streak, setStreak] = useState(0);
  const [lastDay, setLastDay] = useState('');
  const [text, setText] = useState('');
  const [edit, setEdit] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((raw) => {
      if (raw) {
        try {
          const s: Saved = JSON.parse(raw);
          setItems(s.items); setStreak(s.streak); setLastDay(s.lastDay);
          setChecked(s.day === today() ? s.checked : s.items.map(() => false)); // new day, fresh list
        } catch {}
      }
      loaded.current = true;
    }).catch(() => { loaded.current = true; });
  }, []);

  const save = (n: Partial<Saved>) => {
    const s: Saved = { items, checked, day: today(), streak, lastDay, ...n };
    AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => {});
  };

  const done = checked.filter(Boolean).length, total = items.length;
  const score = total ? Math.round((done / total) * 100) : 0;
  const go = score === 100, near = score >= 70;
  const col = go ? th.buy : near ? th.gold : th.sell;
  const verdict = go ? 'GO: all rules passed' : near ? 'CAUTION: finish the remaining rules' : 'NO TRADE: setup does not meet your rules';

  const toggle = (i: number) => { const c = checked.map((v, k) => (k === i ? !v : v)); setChecked(c); save({ checked: c }); };
  const reset = () => { const c = items.map(() => false); setChecked(c); save({ checked: c }); };
  const add = () => {
    const v = text.trim(); if (!v) return;
    const it = [...items, v], c = [...checked, false];
    setItems(it); setChecked(c); setText(''); save({ items: it, checked: c });
  };
  const remove = (i: number) => {
    const it = items.filter((_, k) => k !== i), c = checked.filter((_, k) => k !== i);
    setItems(it); setChecked(c); save({ items: it, checked: c });
  };
  const restore = () => { setItems(DEFAULTS); const c = DEFAULTS.map(() => false); setChecked(c); save({ items: DEFAULTS, checked: c }); };
  // Count a disciplined day once: the first time the full list is passed that day.
  const confirm = () => {
    const td = today();
    if (lastDay === td) return;
    const ns = lastDay === yesterday() ? streak + 1 : 1;
    setStreak(ns); setLastDay(td); save({ streak: ns, lastDay: td });
  };

  return (
    <Screen icon="shield-checkmark" title={t('tabChecklist')} subtitle={t('navDescChecklist')} right={<Badge label="PRO" color={th.gold} />}>
      <View style={{ gap: 12 }}>
        <LinearGradient colors={[col + '33', th.panel]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 8, borderWidth: 1, borderColor: col + '66', padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <ScoreRing score={score} color={col} label={`${done}/${total}`} size={78} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: col, fontWeight: '900', fontSize: 15, lineHeight: 20 }}>{verdict}</Text>
              <Dim>Discipline score {score}/100</Dim>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: th.bg, borderRadius: 8, borderWidth: 1, borderColor: th.line, paddingHorizontal: 12, paddingVertical: 8 }}>
              <Icon name="flame" size={18} color={th.gold} />
              <View>
                <Text style={{ color: th.text, fontWeight: '900', fontSize: 16 }}>{streak}</Text>
                <Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '700' }}>DAY STREAK</Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Btn label={lastDay === today() ? 'Done today' : 'Confirm day'} icon="shield-checkmark-outline" onPress={confirm} disabled={!go || lastDay === today()} />
            </View>
          </View>
        </LinearGradient>

        <Card style={{ padding: 8 }}>
          {items.map((it, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Pressable onPress={() => toggle(i)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 }}>
                <View style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 1.5, borderColor: checked[i] ? th.buy : th.line, backgroundColor: checked[i] ? th.buy : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  {checked[i] && <Icon name="checkmark" size={16} color={th.dark ? '#08110E' : '#FFFFFF'} />}
                </View>
                <Text style={{ flex: 1, color: checked[i] ? th.text : th.dim, fontSize: 14, lineHeight: 20, fontWeight: checked[i] ? '700' : '500' }}>{it}</Text>
              </Pressable>
              {edit && <Pressable onPress={() => remove(i)} hitSlop={8} style={{ padding: 8 }}><Icon name="trash-outline" size={18} color={th.sell} /></Pressable>}
            </View>
          ))}
          {items.length === 0 && <View style={{ padding: 12 }}><Dim>No rules yet. Add your first one below.</Dim></View>}
        </Card>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Btn ghost label="Reset ticks" icon="refresh-outline" onPress={reset} /></View>
          <View style={{ flex: 1 }}><Btn ghost label={edit ? 'Done editing' : 'Edit rules'} icon={edit ? 'checkmark' : 'create-outline'} onPress={() => setEdit((e) => !e)} /></View>
        </View>

        {edit && (
          <Card>
            <SectionTitle icon="add-circle-outline">Add your own rule</SectionTitle>
            <View style={{ height: 8 }} />
            <TextInput value={text} onChangeText={setText} placeholder="e.g. Wait for the 15m candle close" placeholderTextColor={th.dim} onSubmitEditing={add}
              style={{ backgroundColor: th.bg, borderColor: th.line, borderWidth: 1, borderRadius: 8, color: th.text, padding: 13 }} />
            <View style={{ height: 8 }} />
            <Btn label="Add rule" icon="add" onPress={add} disabled={!text.trim()} />
            <View style={{ height: 8 }} />
            <Pressable onPress={restore}><Text style={{ color: th.accent, fontWeight: '700', textAlign: 'center' }}>Restore default rules</Text></Pressable>
          </Card>
        )}
        <Dim>A trade that fails your own rules is a trade you planned not to take. Educational tool, not financial advice.</Dim>
      </View>
    </Screen>
  );
}
