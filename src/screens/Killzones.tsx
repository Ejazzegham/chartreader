import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useApp } from '../store';
import { Screen, Card, Dim, Body, Badge, SectionTitle, Cols } from '../ui';
import { Sessions } from '../MarketWidgets';
import { killzonesFor, killzoneAt, nextKillzone } from '../ict';
import { fxWeekendClosed } from '../markets';
import { useLayout } from '../win';
import KillzonesHome from '../KillzonesHome';

const pad = (n: number) => String(n).padStart(2, '0');
// UTC hour -> the phone's local time text
const local = (h: number) => { const d = new Date(); d.setUTCHours(Math.floor(h), Math.round((h % 1) * 60), 0, 0); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const utcTxt = (h: number) => `${pad(Math.floor(h))}:${pad(Math.round((h % 1) * 60))}`; // windows can start at half hours (New York PM)

export default function Killzones() {
  const { th, t, tab } = useApp();
  const [now, setNow] = useState(new Date());
  useEffect(() => { if (tab !== 8) return; const i = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(i); }, [tab]);
  // website: the Killzones page designed like the mockup (src/KillzonesHome.web.tsx); the phone keeps the layout below
  if (useLayout().mode === 'desktop') return <KillzonesHome active={tab === 8} />;
  const cur = killzoneAt(now), nx = nextKillzone(now), closed = fxWeekendClosed(now);
  const hh = Math.floor(nx.mins / 60), mm = nx.mins % 60;
  const utcPos = ((now.getUTCHours() * 60 + now.getUTCMinutes()) / 1440) * 100;
  const colors = [th.dim, th.accent2, th.buy, th.accent, th.poi, th.gold, th.gold, th.gold]; // same order as KILLZONES in src/ict.ts: Asia, London, NY AM, London Close, NY PM, three Silver Bullets

  return (
    <Screen icon="alarm" title={t('tabKillzones')} subtitle={t('navDescKz')}>
      <Cols>
        <Card style={{ borderColor: cur ? th.buy : th.line }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Dim>UTC {pad(now.getUTCHours())}:{pad(now.getUTCMinutes())}:{pad(now.getUTCSeconds())}</Dim>
            <Badge label={closed ? t('fxClosed') : cur ? 'LIVE' : t('kzWaiting')} color={closed ? th.sell : cur ? th.buy : th.gold} />
          </View>
          <Text style={{ color: th.text, fontSize: 24, fontWeight: '800', marginTop: 6 }}>{cur ? cur.name : t('kzNone')}</Text>
          <Body color={th.dim}>{cur ? cur.note : `${t('kzNext')}: ${nx.k.name}`}</Body>
          <View style={{ height: 10 }} />
          <Text style={{ color: th.accent, fontWeight: '800' }}>{t('kzNext')}: {nx.k.name} · {hh}h {pad(mm)}m</Text>
        </Card>

        <Card>
          <SectionTitle icon="analytics-outline">{t('kzTimeline')}</SectionTitle>
          <View style={{ height: 14 }} />
          <View style={{ height: 22, borderRadius: 5, backgroundColor: th.bg, borderWidth: 1, borderColor: th.line, overflow: 'hidden', direction: 'ltr' }}>
            {killzonesFor(new Date()).map((k, i) => (
              <View key={k.key} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(k.from / 24) * 100}%`, width: `${((k.to - k.from) / 24) * 100}%`, backgroundColor: colors[i] + (cur?.key === k.key ? 'CC' : '66') }} />
            ))}
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: `${utcPos}%`, width: 2, backgroundColor: th.text }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, direction: 'ltr' }}>
            {[0, 6, 12, 18, 24].map((h) => <Text key={h} style={{ color: th.dim, fontSize: 10 }}>{pad(h % 24)}</Text>)}
          </View>
          <Dim>{t('kzLocalNote')}</Dim>
        </Card>

        {killzonesFor(new Date()).map((k, i) => {
          const on = cur?.key === k.key;
          return (
            <Card key={k.key} style={{ borderColor: on ? colors[i] : th.line }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 10, height: 44, borderRadius: 5, backgroundColor: colors[i] }} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: th.text, fontWeight: '800', fontSize: 15 }}>{k.name}</Text>
                    {on && <Badge label="LIVE" color={th.buy} />}
                  </View>
                  <Text style={{ color: th.dim, fontSize: 12 }}>UTC {utcTxt(k.from)} - {utcTxt(k.to)} · {t('kzYourTime')} {local(k.from)} - {local(k.to)}</Text>
                </View>
              </View>
              <View style={{ height: 6 }} />
              <Body color={th.dim}>{k.note}</Body>
            </Card>
          );
        })}

        <Sessions />

        <Card>
          <SectionTitle icon="school-outline">{t('kzRules')}</SectionTitle>
          <View style={{ height: 8 }} />
          {[t('kzRule1'), t('kzRule2'), t('kzRule3'), t('kzRule4')].map((x, i) => <Body key={i}>• {x}</Body>)}
        </Card>
      </Cols>
    </Screen>
  );
}
