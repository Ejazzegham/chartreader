import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useApp } from './store';
import { Card, Dim, Btn, Icon, IconTile } from './ui';

// One place that explains and opens admin. No passcode: an admin is an admin email that has been confirmed.
//  - admin already unlocked  -> a card that opens the admin panel
//  - admin email, not yet confirmed -> a short card: send the email, tap the link, come back (the app re-checks by itself)
//  - everybody else -> nothing
export default function AdminAccess() {
  const { th, lic, emailVerified, sendVerify, refreshLic, setAdminOpen, t } = useApp();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  if (lic.admin) {
    return (
      <Pressable onPress={() => setAdminOpen(true)} accessibilityRole="button" accessibilityLabel="Open admin panel" style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderColor: th.accent + '88' }}>
          <IconTile icon="shield-checkmark" size={46} colors={[th.accent, th.accent2]} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: th.text, fontSize: 16, fontWeight: '900' }}>Admin panel</Text>
            <Text style={{ color: th.dim, fontSize: 12.5, lineHeight: 18, marginTop: 2 }}>Users, payments, grant access and the Gemini key.</Text>
          </View>
          <Icon name="chevron-forward" size={20} color={th.dim} />
        </Card>
      </Pressable>
    );
  }
  if (!lic.adminEmail) return null;

  const send = async () => { setBusy(true); setMsg(''); const k = await sendVerify(); setBusy(false); setMsg(k ? t(k) : 'Email sent. Open it and tap the link, then come back here. Check spam too.'); };
  const check = async () => {
    setBusy(true); setMsg('');
    const ok = await refreshLic(); setBusy(false);
    setMsg(ok ? 'Checked. If the link was just tapped and admin is still locked, wait a few seconds and press again.' : 'Could not reach the server. Check the server address in Settings.');
  };
  return (
    <Card style={{ gap: 8, borderColor: th.gold + '88' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Icon name="lock-closed-outline" size={20} color={th.gold} />
        <Text style={{ color: th.text, fontSize: 15.5, fontWeight: '900', flex: 1 }}>Admin is waiting for you</Text>
      </View>
      <Dim>{emailVerified ? 'Your email is confirmed. Press the button to unlock admin.' : 'This email is an admin email. Confirm it once (tap the link we email you) and admin opens by itself when you come back to the app.'}</Dim>
      {!emailVerified && <Btn icon="mail-outline" label="Send confirmation email" onPress={send} busy={busy} />}
      <Btn ghost icon="lock-open-outline" label={emailVerified ? 'Unlock admin' : 'I confirmed it, unlock admin'} onPress={check} busy={busy} />
      {!!msg && <Dim>{msg}</Dim>}
    </Card>
  );
}
