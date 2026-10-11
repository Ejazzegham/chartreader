import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useApp } from './store';
import { Icon } from './ui';
import { guard } from './trades';

// Shows only when a rule is broken or close to it. Counts the cooldown down by itself.
export default function GuardBanner() {
  const { th, journal, desk, signals } = useApp();
  const [now, setNow] = useState(Date.now());
  const g = guard(journal, desk, signals.filter((x) => x.status !== 'signal').length, now);
  useEffect(() => { if (!g.until) return; const i = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(i); }, [g.until]);
  if (g.level === 'ok') return null;
  const c = g.level === 'stop' ? th.sell : th.gold;
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: c + '16', borderColor: c + '66', borderWidth: 1, borderRadius: 8, padding: 12 }}>
      <View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: c + '26', alignItems: 'center', justifyContent: 'center' }}><Icon name={g.level === 'stop' ? 'hand-left' : 'alert-circle'} size={18} color={c} /></View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c, fontWeight: '900', fontSize: 13.5 }}>{g.title}</Text>
        <Text style={{ color: th.text, fontSize: 12.5, lineHeight: 18, marginTop: 1 }}>{g.text}</Text>
      </View>
    </View>
  );
}
