import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useApp } from './store';
import { Icon } from './ui';
import { useNews, newsRisk, currenciesOf, fmtIn, localTime } from './news';

// Shows only when a High/Medium impact release is close for this market. Tap it to open the News page.
// symId omitted = any major currency (used on Home).
export default function NewsBanner({ symId, active = true }: { symId?: string; active?: boolean }) {
  const { th, setTab } = useApp();
  const { events } = useNews(active);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!active) return; const i = setInterval(() => setNow(Date.now()), 20000); return () => clearInterval(i); }, [active]);
  const cur = symId ? currenciesOf(symId) : null;
  const r = newsRisk(cur, events, now);
  if (r.level === 'clear' || !r.event) return null;
  const danger = r.level === 'danger', col = danger ? th.sell : th.gold, e = r.event;
  return (
    <Pressable onPress={() => setTab(13)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: col + '1A', borderColor: col + '77', borderWidth: 1, borderRadius: 8, padding: 12 }}>
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: col, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={danger ? 'warning' : 'newspaper'} size={20} color={th.dark ? '#16110A' : '#FFFFFF'} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: col, fontWeight: '900', fontSize: 12, letterSpacing: 0.8 }}>{danger ? 'NEWS WARNING: AVOID NEW TRADES' : 'NEWS COMING UP'} · {e.impact.toUpperCase()}</Text>
        <Text style={{ color: th.text, fontWeight: '700', fontSize: 13.5, marginTop: 1 }} numberOfLines={2}>{e.cur} {e.title}</Text>
        <Text style={{ color: th.dim, fontSize: 11.5, marginTop: 1 }}>{fmtIn(r.mins)} · {localTime(e.t)} your time{danger ? ' · spreads can widen and stops can slip' : ''}</Text>
      </View>
      <Icon name="chevron-forward" size={16} color={th.dim} />
    </Pressable>
  );
}
