import React from 'react';
import { View, Text } from 'react-native';
import { useApp } from '../store';
import { Screen, Card, Body, SectionTitle, Icon, Group, Cols } from '../ui';
import { NAV } from '../nav';
import { CONTENT } from '../guideContent';

export default function Guide() {
  const { th, t, settings } = useApp();
  const c = (CONTENT[settings.lang] ?? CONTENT.en).guide;
  const gradeColor: Record<string, string> = { 'A+': th.buy, A: th.accent, B: th.gold, C: th.sell };

  return (
    <Screen icon="help-circle" title={t('tabGuide')} subtitle={t('navDescGuide')}>
      <Cols>
        <Card glow><Body>{c.intro}</Body></Card>

        <Group title={c.stepsTitle}>
          {c.steps.map((s, i) => (
            <Card key={i} style={{ gap: 6 }}>
              <SectionTitle icon={s.icon}>{s.title}</SectionTitle>
              <Text style={{ color: th.dim, fontSize: 13, lineHeight: 20 }}>{s.text}</Text>
            </Card>
          ))}
        </Group>

        <Group title={c.gradeTitle}>
          <Card style={{ gap: 12 }}>
            <Text style={{ color: th.dim, fontSize: 13, lineHeight: 20 }}>{c.gradeNote}</Text>
            {c.grades.map((g) => {
              const col = gradeColor[g.grade] ?? th.accent;
              return (
                <View key={g.grade} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: col + '14', borderColor: col + '55', borderWidth: 1, borderRadius: 8, padding: 10 }}>
                  <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: col, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: th.dark ? '#08110E' : '#FFFFFF', fontWeight: '900', fontSize: 16 }}>{g.grade}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: th.text, fontWeight: '800', fontSize: 14 }}>{g.label}  <Text style={{ color: col, fontVariant: ['tabular-nums'] }}>{g.range}</Text></Text>
                    <Text style={{ color: th.dim, fontSize: 12.5, lineHeight: 18, marginTop: 2 }}>{g.text}</Text>
                  </View>
                </View>
              );
            })}
          </Card>
        </Group>

        <Group title={c.confirmTitle}>
          {c.confirm.map((s, i) => (
            <Card key={i} style={{ gap: 6 }}>
              <SectionTitle icon={s.icon}>{s.title}</SectionTitle>
              <Text style={{ color: th.dim, fontSize: 13, lineHeight: 20 }}>{s.text}</Text>
            </Card>
          ))}
        </Group>

        <Group title={c.rulesTitle}>
          <Card style={{ gap: 10 }}>
            {c.rules.map((r, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                <Icon name="checkmark-circle" size={18} color={th.buy} />
                <Text style={{ flex: 1, color: th.text, fontSize: 13.5, lineHeight: 20 }}>{r}</Text>
              </View>
            ))}
          </Card>
        </Group>

        <Group title={c.featuresTitle}>
          <Card style={{ gap: 4 }}><Text style={{ color: th.dim, fontSize: 13, lineHeight: 20 }}>{c.featuresNote}</Text></Card>
          {c.features.map((f, i) => (
            <Card key={i} style={{ gap: 6 }}>
              <SectionTitle icon={f.icon}>{f.title}</SectionTitle>
              <Text style={{ color: th.dim, fontSize: 13, lineHeight: 20 }}>{f.text}</Text>
            </Card>
          ))}
        </Group>

        <Group title={c.pagesTitle}>
          <Card style={{ gap: 12 }}>
            {NAV.filter((n) => n.group !== 'hidden' && c.pages[n.key]).map((n) => (
              <View key={n.key} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: th.accent + '22', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={n.icon} size={16} color={th.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: th.text, fontWeight: '800', fontSize: 13.5 }}>{t(n.key)}</Text>
                  <Text style={{ color: th.dim, fontSize: 12, lineHeight: 17 }}>{c.pages[n.key]}</Text>
                </View>
              </View>
            ))}
          </Card>
        </Group>

        <Card style={{ borderColor: th.gold + '66' }}>
          <Text style={{ color: th.dim, fontSize: 12.5, lineHeight: 19 }}>{c.disc}</Text>
        </Card>
      </Cols>
    </Screen>
  );
}
