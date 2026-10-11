import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useApp } from './store';
import { Card, Icon, Badge } from './ui';
import { VSA, VSA_NAMES, VSA_RULE, VSA_HELP, VsaTag } from './vsa';

const STAGES = ['Pattern', 'Low-vol breakout', 'Retest', 'Confirm'];
const LEGEND: VsaTag[] = ['BC', 'SC', 'NS', 'ND', 'SP', 'UT'];

// The VSA reversal entry model on one card: which of the four steps are done, what to wait for next, and what each setup means.
export default function VsaCard({ vsa, f }: { vsa: VSA; f: (n: number) => string }) {
  const { th } = useApp();
  const [help, setHelp] = useState(false);
  const r = vsa.reversal;
  const col = !r ? th.dim : r.side === 'buy' ? th.buy : th.sell;
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: col + '22', borderWidth: 1, borderColor: col + '66', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="git-compare-outline" size={19} color={col} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: th.text, fontWeight: '900', fontSize: 15 }}>VSA reversal entry</Text>
          <Text style={{ color: th.dim, fontSize: 11.5 }} numberOfLines={1}>{r ? `${VSA_NAMES[r.tag]} · ${r.side.toUpperCase()}` : 'No structure in play'}</Text>
        </View>
        {r && <Badge label={r.stage === 'confirmed' ? 'EXECUTE' : 'WAIT'} color={r.stage === 'confirmed' ? th.buy : th.gold} />}
      </View>

      <View style={{ backgroundColor: th.accent + '12', borderColor: th.accent + '44', borderWidth: 1, borderRadius: 8, padding: 10 }}>
        <Text style={{ color: th.text, fontSize: 12.5, lineHeight: 18, fontWeight: '700' }}>{VSA_RULE}</Text>
      </View>

      {r ? (
        <>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {STAGES.map((n, i) => {
              const done = r.stageNo > i, cur = r.stageNo === i + 1 && r.stage !== 'confirmed';
              return (
                <View key={n} style={{ flex: 1, gap: 4 }}>
                  <View style={{ height: 5, borderRadius: 3, backgroundColor: done || r.stage === 'confirmed' ? col : cur ? col + '88' : th.line }} />
                  <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: done ? th.text : th.dim, fontSize: 10, fontWeight: '800', textAlign: 'center' }}>{n}</Text>
                </View>
              );
            })}
          </View>
          <View style={{ gap: 8 }}>
            {r.steps.map((s, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <Icon name={s.ok ? 'checkmark-circle' : 'ellipse-outline'} size={17} color={s.ok ? th.buy : r.badBreakout && i === 1 ? th.sell : th.dim} />
                <Text style={{ flex: 1, color: s.ok ? th.text : th.dim, fontSize: 13, lineHeight: 18 }}>{s.text}</Text>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1, backgroundColor: th.bg, borderRadius: 8, borderWidth: 1, borderColor: th.line, padding: 8 }}>
              <Text style={{ color: th.dim, fontSize: 9.5, fontWeight: '900', letterSpacing: 0.6 }}>KEY LEVEL</Text>
              <Text style={{ color: th.gold, fontWeight: '900', fontSize: 14 }}>{f(r.level)}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: th.bg, borderRadius: 8, borderWidth: 1, borderColor: th.line, padding: 8 }}>
              <Text style={{ color: th.dim, fontSize: 9.5, fontWeight: '900', letterSpacing: 0.6 }}>SETUP FAILS AT</Text>
              <Text style={{ color: th.sell, fontWeight: '900', fontSize: 14 }}>{f(r.invalidAt)}</Text>
            </View>
          </View>
          <Text style={{ color: r.stage === 'confirmed' ? th.buy : th.text, fontSize: 13, lineHeight: 19, fontWeight: '800' }}>{r.next}</Text>
        </>
      ) : (
        <Text style={{ color: th.dim, fontSize: 13, lineHeight: 19 }}>No selling climax, buying climax, no supply, no demand, shakeout or upthrust is active in the last 40 candles. Nothing to wait for yet.</Text>
      )}

      <Pressable onPress={() => setHelp(!help)} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name={help ? 'chevron-up' : 'chevron-down'} size={16} color={th.accent} />
        <Text style={{ color: th.accent, fontWeight: '800', fontSize: 12.5 }}>{help ? 'Hide setup guide' : 'What each VSA setup means'}</Text>
      </Pressable>
      {help && (
        <View style={{ gap: 8 }}>
          {LEGEND.map((k) => <Text key={k} style={{ color: th.dim, fontSize: 12.5, lineHeight: 18 }}><Text style={{ color: th.text, fontWeight: '800' }}>{VSA_NAMES[k]}. </Text>{VSA_HELP[k].replace(/^[^:]+: /, '')}</Text>)}
        </View>
      )}
    </Card>
  );
}
