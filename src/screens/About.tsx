import React from 'react';
import { View, Text, Linking } from 'react-native';
import { useApp } from '../store';
import { Screen, Card, Body, Btn, SectionTitle, Icon, Group } from '../ui';
import { LogoMark, PoweredBy } from '../Brand';
import { CONTENT, CONTACT_EMAIL } from '../guideContent';

export default function About() {
  const { th, t, settings } = useApp();
  const c = (CONTENT[settings.lang] ?? CONTENT.en).about;
  const mail = () => Linking.openURL(`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Chart Reader')}`).catch(() => {});

  return (
    <Screen icon="information-circle" title={t('tabAbout')} subtitle={t('navDescAbout')}>
      <View style={{ gap: 14 }}>
        <Card glow style={{ alignItems: 'center', gap: 10, paddingVertical: 22 }}>
          <LogoMark size={72} radius={8} />
          <Text style={{ color: th.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 }}>Chart Reader</Text>
          <Text style={{ color: th.dim, fontSize: 13.5, lineHeight: 20, textAlign: 'center' }}>{c.tagline}</Text>
        </Card>

        <Card style={{ gap: 10 }}>
          {c.paragraphs.map((p, i) => <Body key={i}>{p}</Body>)}
        </Card>

        <Group title={c.featuresTitle}>
          {c.features.map((f, i) => (
            <Card key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: th.accent + '22', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={f.icon} size={20} color={th.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: th.text, fontWeight: '800', fontSize: 14.5 }}>{f.title}</Text>
                <Text style={{ color: th.dim, fontSize: 12.5, lineHeight: 18, marginTop: 2 }}>{f.text}</Text>
              </View>
            </Card>
          ))}
        </Group>

        <Group title={c.contactTitle}>
          <Card glow style={{ gap: 12 }}>
            <SectionTitle icon="mail">{c.contactTitle}</SectionTitle>
            <Body>{c.contactText}</Body>
            <Text selectable style={{ color: th.accent, fontWeight: '800', fontSize: 15, textAlign: 'center' }}>{CONTACT_EMAIL}</Text>
            <Btn label={c.emailBtn} icon="mail-outline" onPress={mail} />
          </Card>
        </Group>

        <Card style={{ gap: 6, borderColor: th.gold + '66' }}>
          <SectionTitle icon="alert-circle">{c.discTitle}</SectionTitle>
          <Text style={{ color: th.dim, fontSize: 12.5, lineHeight: 19 }}>{c.disc}</Text>
        </Card>

        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: th.dim, fontSize: 12 }}>{c.madeBy}</Text>
          <PoweredBy />
        </View>
      </View>
    </Screen>
  );
}
