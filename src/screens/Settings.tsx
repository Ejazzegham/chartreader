import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Switch } from 'react-native';
import { shareText } from '../dialog';

import Modal from '../Modal';
import { useApp } from '../store';
import { Screen, Card, Field, Dim, Btn, Segment, Icon, Group, confirmAction, Cols } from '../ui';
import { THEMES, themeId } from '../theme';
import { LANGS } from '../i18n';
import { PAY, PLANS, getServer, setServer, pushTest, APP_DOWNLOAD_URL } from '../license';
import PayBox from '../PayBox';
import AdminAccess from '../AdminAccess';
import { PoweredBy, Avatar } from '../Brand';
import { pickAvatar } from '../avatar';
import PinScreen from '../PinScreen';
import EditProfile from '../EditProfile';
import { bioAvailable, bioAuth } from '../native';
import { inExpoGo } from '../push';

// One settings line: tinted icon tile, title + helper text, then a switch / value / chevron on the right.
const SetRow = ({ icon, tint, title, sub, right, onPress, last }: { icon: string; tint?: string; title: string; sub?: string; right?: React.ReactNode; onPress?: () => void; last?: boolean }) => {
  const { th } = useApp();
  const c = tint ?? th.accent;
  return (
    <Pressable disabled={!onPress} onPress={onPress} accessibilityRole={onPress ? 'button' : undefined} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: last ? 0 : 1, borderBottomColor: th.hair, opacity: pressed ? 0.8 : 1 })}>
      <View style={{ width: 38, height: 38, borderRadius: 8, backgroundColor: c + '22', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={19} color={c} /></View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: th.text, fontSize: 14.5, fontWeight: '800' }} numberOfLines={1}>{title}</Text>
        {!!sub && <Text style={{ color: th.dim, fontSize: 12, lineHeight: 17, marginTop: 1 }} numberOfLines={3}>{sub}</Text>}
      </View>
      {right ?? (onPress ? <Icon name="chevron-forward" size={18} color={th.dim} /> : null)}
    </Pressable>
  );
};
const Panel = ({ children }: { children: React.ReactNode }) => <Card style={{ paddingVertical: 2, paddingHorizontal: 14 }}>{children}</Card>;
const Pill = ({ text, color }: { text: string; color: string }) => (
  <View style={{ backgroundColor: color + '22', borderColor: color + '66', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}><Text style={{ color, fontSize: 11, fontWeight: '900', letterSpacing: 0.4 }}>{text}</Text></View>
);

export default function Settings() {
  const { th, t, rtl, settings, setSettings, lic, licErr, setLic, refreshLic, account, setPin, logout, avatar, setAvatar, changePassword, googleOnly, emailVerified, sendVerify, lockNow, pushState, startPush, setHelpOpen, supportUnread } = useApp();
  const [testMsg, setTestMsg] = useState('');
  const [vMsg, setVMsg] = useState('');
  const [vBusy, setVBusy] = useState(false);
  const doVerify = async () => { setVBusy(true); setVMsg(''); const k = await sendVerify(); setVBusy(false); setVMsg(k ? t(k) : 'Email sent. Open it, tap the link, then come back and press the second button. Check spam too.'); };
  const doCheckVerified = async () => { setVBusy(true); setVMsg(''); const ok = await refreshLic(); setVBusy(false); setVMsg(ok ? 'Checked.' : 'Could not check right now. Try again.'); };
  const [pw, setPw] = useState({ cur: '', nw: '', again: '', show: false });
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);
  const doChangePw = async () => {
    setPwMsg(null);
    if (pw.nw !== pw.again) { setPwMsg({ ok: false, text: 'The two new passwords do not match.' }); return; }
    setPwBusy(true);
    const k = await changePassword(pw.cur, pw.nw);
    setPwBusy(false);
    if (k) setPwMsg({ ok: false, text: t(k) });
    else { setPwMsg({ ok: true, text: 'Password changed. Use the new one next time you log in.' }); setPw({ cur: '', nw: '', again: '', show: false }); }
  };
  const [sheet, setSheet] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [picBusy, setPicBusy] = useState(false);
  const [picErr, setPicErr] = useState('');
  const choose = async (src: 'gallery' | 'camera') => {
    setSheet(false); setPicErr(''); setPicBusy(true);
    try { const u = await pickAvatar(src); if (u) setAvatar(u); } catch (e: any) { setPicErr(e.message ?? 'Could not load the photo'); }
    setPicBusy(false);
  };
  const [pinModal, setPinModal] = useState(false);
  const [net, setNet] = useState<'TRON' | 'BSC'>('TRON');
  const [plan, setPlan] = useState<'weekly' | 'monthly'>('weekly');
  const [tx, setTx] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [srv, setSrv] = useState(getServer());
  const [srvMsg, setSrvMsg] = useState('');
  const saveSrv = async (reset = false) => {
    setSrvMsg('');
    const e = await setServer(reset ? '' : srv);
    if (e) { setSrvMsg(e); return; }
    setSrv(getServer()); setSrvMsg('Saved. Checking the server...');
    const ok = await refreshLic();
    setSrvMsg(ok ? 'Connected.' : 'Saved, but the server did not answer. Check the address and that the server and tunnel are running.');
  };
  const fmt = (ms: number) => new Date(ms).toLocaleDateString();
  const [pwOpen, setPwOpen] = useState(false);
  const [bioHw, setBioHw] = useState<boolean | null>(null);
  const [bioMsg, setBioMsg] = useState('');
  useEffect(() => { bioAvailable().then(setBioHw); }, []);
  const toggleBio = async (on: boolean) => {
    setBioMsg('');
    if (on) {
      if (!(await bioAvailable())) { setBioMsg('No fingerprint found. Add one in your phone settings first. If you already did, install the newest build of the app: fingerprint needs it.'); return; }
      if (!(await bioAuth('Confirm your fingerprint to turn on the lock'))) { setBioMsg('Fingerprint not confirmed, so the lock was not turned on.'); return; }
      setSettings({ bio: true });
    } else {
      const hw = await bioAvailable();
      if (hw && !(await bioAuth('Confirm to turn off the fingerprint lock'))) { setBioMsg('Fingerprint not confirmed, so the lock stays on.'); return; }
      setSettings({ bio: false });
    }
  };
  const lockOn = !!account?.pinHash || settings.bio;
  const statusText = lic.status === 'admin' ? t('adminOnly') : lic.status === 'paid' ? `${t('paidActive')} ${fmt(lic.paidUntil)}` : lic.status === 'trial' ? `${t('trialLeft')}: ${Math.max(1, Math.ceil((lic.trialEnd - Date.now()) / 864e5))}d${lic.provisional ? ' (offline)' : ''}` : t('expired');
  const statusCol = lic.status === 'expired' ? th.sell : lic.status === 'trial' ? th.gold : th.buy;

  const sw = (v: boolean, f: (b: boolean) => void) => <Switch value={v} onValueChange={f} trackColor={{ true: th.accent, false: th.line }} thumbColor="#FFFFFF" />;

  const chip = (active: boolean) => ({
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8,
    borderWidth: 1.5, borderColor: active ? th.accent : th.line, borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 14, backgroundColor: active ? th.accent + '22' : 'transparent',
  });

  return (
    <Screen icon="settings" title={t('tabSettings')} subtitle="Account, subscription, look and security in one place.">
      <EditProfile visible={editOpen} onClose={() => setEditOpen(false)} />
      <Cols>
        <Group title="Account">
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Pressable onPress={() => setSheet(true)} disabled={picBusy}>
                <Avatar size={72} name={account?.name || account?.email} ring={th.accent} />
                <View style={{ position: 'absolute', right: -2, bottom: -2, width: 26, height: 26, borderRadius: 13, backgroundColor: th.accent, borderWidth: 2, borderColor: th.panel, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={picBusy ? 'hourglass-outline' : 'camera'} size={13} color={th.onAccent} />
                </View>
              </Pressable>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ color: th.text, fontSize: 18, fontWeight: '900', letterSpacing: -0.3 }} numberOfLines={1}>{account?.name || 'Your account'}</Text>
                <Text style={{ color: th.dim, fontSize: 13 }} numberOfLines={1}>{account?.email}</Text>
                {!!account?.phone && <Text style={{ color: th.dim, fontSize: 12.5 }} numberOfLines={1}>{account.phone}</Text>}
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                  <Pill text={lic.status === 'admin' ? 'ADMIN' : lic.status === 'paid' ? 'PRO' : lic.status === 'trial' ? 'TRIAL' : 'EXPIRED'} color={statusCol} />
                  <Pill text={emailVerified ? 'EMAIL VERIFIED' : 'EMAIL NOT VERIFIED'} color={emailVerified ? th.buy : th.gold} />
                </View>
              </View>
            </View>
            <View style={{ height: 1, backgroundColor: th.hair, marginVertical: 14 }} />
            <Btn icon="create-outline" label="Edit profile" onPress={() => setEditOpen(true)} />
            <View style={{ height: 10 }} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={() => setSheet(true)} style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: 8, borderWidth: 1, borderColor: th.line, backgroundColor: th.panel2, opacity: pressed ? 0.8 : 1 })}>
                <Icon name="image-outline" size={16} color={th.accent} /><Text style={{ color: th.text, fontWeight: '800', fontSize: 13 }}>{avatar ? 'Edit photo' : 'Add photo'}</Text>
              </Pressable>
              <Pressable onPress={logout} style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: 8, borderWidth: 1, borderColor: th.sell + '66', backgroundColor: th.sell + '10', opacity: pressed ? 0.8 : 1 })}>
                <Icon name="log-out-outline" size={16} color={th.sell} /><Text style={{ color: th.sell, fontWeight: '800', fontSize: 13 }}>{t('logout')}</Text>
              </Pressable>
            </View>
            {!!picErr && <Text style={{ color: th.sell, marginTop: 10, lineHeight: 20 }}>{picErr}</Text>}
          </Card>

          {!emailVerified && (
            <Card glow>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <Icon name="mail-unread-outline" size={20} color={th.gold} />
                <Text style={{ color: th.text, fontWeight: '900', fontSize: 15 }}>Confirm your email</Text>
              </View>
              <Dim>{lic.adminEmail ? 'Admin tools stay locked until this email address is confirmed.' : 'Confirming your email protects your subscription: nobody else can sign up with your address and take it over.'}</Dim>
              <View style={{ height: 8 }} />
              <Btn icon="mail-outline" label="Send confirmation email" onPress={doVerify} busy={vBusy} />
              <View style={{ height: 8 }} />
              <Btn ghost label="I confirmed it, check again" onPress={doCheckVerified} busy={vBusy} />
              {!!vMsg && <View style={{ marginTop: 8 }}><Dim>{vMsg}</Dim></View>}
            </Card>
          )}
        </Group>

        <Group title="Subscription">
          {!lic.token && !!licErr && (
            <Card>
              <Text style={{ color: th.sell, fontWeight: '800', marginBottom: 4 }}>License server problem</Text>
              <Dim>{licErr}</Dim>
              <View style={{ height: 8 }} />
              <Btn ghost label="Try again" onPress={() => refreshLic()} />
            </Card>
          )}
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: statusCol + '22', alignItems: 'center', justifyContent: 'center' }}><Icon name="diamond-outline" size={22} color={statusCol} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: th.dim, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>{t('subscription').toUpperCase()}</Text>
                <Text style={{ color: th.text, fontSize: 16, fontWeight: '900', marginTop: 2 }} numberOfLines={2}>{statusText}</Text>
              </View>
            </View>
            {lic.status !== 'admin' && (
              <View style={{ gap: 10, marginTop: 14 }}>
                <View style={{ height: 1, backgroundColor: th.hair }} />
                <Segment value={plan} onChange={(k) => setPlan(k as any)} options={[{ k: 'weekly', label: `${t('weekly')} $${PLANS.weekly}` }, { k: 'monthly', label: `${t('monthly')} $${PLANS[ 'monthly' ]}` }]} />
                <Segment value={net} onChange={(k) => setNet(k as any)} options={[{ k: 'TRON', label: 'TRON (TRC20)' }, { k: 'BSC', label: 'BSC (BEP20)' }]} />
                <View style={{ borderWidth: 1, borderColor: th.line, borderRadius: 8, padding: 14, backgroundColor: th.panel2, alignItems: 'center' }}>
                  <Text style={{ color: th.dim, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>{t('amountLabel').toUpperCase()}</Text>
                  <Text style={{ color: th.accent, fontSize: 30, fontWeight: '900', marginTop: 2 }}>${PLANS[plan]} <Text style={{ fontSize: 15 }}>USDT</Text></Text>
                </View>
                <Dim>{t('sendUsdt')}</Dim>
                <View style={{ borderWidth: 1, borderColor: th.line, borderRadius: 8, padding: 12, backgroundColor: th.panel2 }}>
                  <Text selectable style={{ color: th.text, fontWeight: '700', fontSize: 13, lineHeight: 20, textAlign: 'center' }}>{PAY[net]}</Text>
                </View>
                <Dim>{t('addrTap')}</Dim>
                <PayBox plan={plan} net={net} />
              </View>
            )}
            {!!msg && <View style={{ marginTop: 8 }}><Dim>{msg}</Dim></View>}
          </Card>
        </Group>

        <Group title={t('helpTitle')}>
          <Panel>
            <SetRow icon="people-outline" title="Invite friends" sub="Send the app download link to a friend." onPress={() => { shareText(`I use Chart Reader to read charts and plan trades. Get the app here: ${APP_DOWNLOAD_URL}`); }} />
            <SetRow icon="chatbubbles-outline" title={t('helpTitle')} sub={t('helpSub')} onPress={() => setHelpOpen(true)} last
              right={supportUnread > 0 ? <View style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: th.sell, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>{supportUnread}</Text></View> : undefined} />
          </Panel>
        </Group>

        <Group title="Appearance">
          <Card>
            <Text style={{ color: th.text, fontSize: 14.5, fontWeight: '800', marginBottom: 10 }}>{t('theme')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {Object.entries(THEMES).map(([id, tm]) => {
                const on = themeId(settings.theme) === id;
                return (
                  <Pressable key={id} onPress={() => setSettings({ theme: id })} accessibilityRole="button" accessibilityState={{ selected: on }} style={({ pressed }) => ({ width: '48%', flexGrow: 1, borderRadius: 8, borderWidth: on ? 2 : 1, borderColor: on ? th.accent : th.line, backgroundColor: th.panel2, padding: 10, gap: 8, opacity: pressed ? 0.85 : 1 })}>
                    <LinearGradient colors={tm.glass ? tm.grad : [tm.bg, tm.bg, tm.bg]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 52, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, direction: 'ltr', borderWidth: 1, borderColor: th.hair, overflow: 'hidden' }}>
                      {[tm.panel, tm.accent, tm.accent2].map((c, i) => <View key={i} style={{ width: i ? 18 : 30, height: 18, borderRadius: 8, backgroundColor: c, borderWidth: i ? 0 : 1, borderColor: tm.line }} />)}
                    </LinearGradient>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ color: th.text, fontWeight: '800', fontSize: 13 }} numberOfLines={1}>{t('th_' + id)}</Text>
                      {on && <Icon name="checkmark-circle" size={18} color={th.accent} />}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Card>
          <Card>
            <Text style={{ color: th.text, fontSize: 14.5, fontWeight: '800', marginBottom: 10 }}>{t('language')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {LANGS.map((l) => (
                <Pressable key={l.code} onPress={() => setSettings({ lang: l.code })} style={chip(settings.lang === l.code)}>
                  <Text style={{ color: th.text, fontWeight: settings.lang === l.code ? '800' : '600' }}>{l.name}</Text>
                </Pressable>
              ))}
            </View>
          </Card>
        </Group>

        <Group title="Background alerts">
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <Icon name="notifications-outline" size={18} color={th.accent} />
              <Text style={{ color: th.text, fontWeight: '900', fontSize: 15 }}>Alarm when the app is closed</Text>
            </View>
            <Dim>{pushState.state === 'on' ? 'On. Price alerts and strong scanner setups ring this phone even when the app is closed and the screen is locked.'
              : pushState.state === 'denied' ? 'Notifications are blocked. Allow notifications for Chart Reader in the phone settings, then tap Enable.'
              : pushState.state === 'unsupported' ? (inExpoGo() ? 'Background alerts do not work inside Expo Go. Use the installed APK or a development build (eas build --profile preview). Alerts still show while the app is open.' : 'This app build does not include notifications yet. Install the latest build.')
              : pushState.state === 'error' ? 'Could not turn on: ' + (pushState.msg || 'unknown error')
              : 'Not enabled yet.'}</Dim>
            <View style={{ height: 8 }} />
            {pushState.state !== 'on' && <Btn label="Enable background alerts" onPress={() => { setTestMsg(''); startPush(); }} />}
            {pushState.state === 'on' && <Btn ghost label="Send a test alarm" onPress={async () => { setTestMsg('Sending...'); try { await pushTest(lic.token); setTestMsg('Sent. Lock the phone and wait a few seconds.'); } catch (e: any) { setTestMsg(String(e?.message || e)); } }} />}
            {!!testMsg && <View style={{ marginTop: 8 }}><Dim>{testMsg}</Dim></View>}
          </Card>
        </Group>

        <Group title="Security">
          <Panel>
            <SetRow icon="finger-print" tint={th.buy} title="Fingerprint lock" sub={bioHw === false ? 'Needs a fingerprint saved on this phone.' : 'Unlock the app with your fingerprint instead of typing.'} right={sw(settings.bio, toggleBio)} />
            <SetRow icon="keypad-outline" title={t('pinLock')} sub={account?.pinHash ? 'A 4-digit PIN is asked when you open the app.' : 'Protect the app with a 4-digit PIN.'}
              right={account?.pinHash ? <Pill text="ON" color={th.buy} /> : undefined}
              onPress={() => (account?.pinHash ? confirmAction('Remove PIN lock?', 'The app will open without asking for your PIN.', () => setPin(null), 'Remove') : setPinModal(true))} />
            <SetRow icon="lock-closed-outline" tint={th.gold} title="Lock app now" sub={lockOn ? 'Ask for the fingerprint or PIN right away.' : 'Turn on the fingerprint or a PIN first.'} onPress={lockOn ? lockNow : undefined} right={lockOn ? undefined : <View />} />
            {!googleOnly && <SetRow icon="key-outline" tint={th.accent2} title="Change password" sub="Use a new password the next time you log in." onPress={() => setPwOpen(!pwOpen)} last right={<Icon name={pwOpen ? 'chevron-up' : 'chevron-down'} size={18} color={th.dim} />} />}
          </Panel>
          {!!bioMsg && <Text style={{ color: th.sell, lineHeight: 20, marginHorizontal: 4 }}>{bioMsg}</Text>}
          {pwOpen && (
            <Card>
              <Field label="Current password" value={pw.cur} onChangeText={(v) => setPw({ ...pw, cur: v })} secureTextEntry={!pw.show} autoCapitalize="none" autoCorrect={false}
                right={<Pressable onPress={() => setPw({ ...pw, show: !pw.show })}><Icon name={pw.show ? 'eye-off-outline' : 'eye-outline'} color={th.dim} /></Pressable>} />
              <Field label="New password (6+ characters)" value={pw.nw} onChangeText={(v) => setPw({ ...pw, nw: v })} secureTextEntry={!pw.show} autoCapitalize="none" autoCorrect={false} />
              <Field label="Repeat new password" value={pw.again} onChangeText={(v) => setPw({ ...pw, again: v })} secureTextEntry={!pw.show} autoCapitalize="none" autoCorrect={false} />
              {!!pwMsg && <Text style={{ color: pwMsg.ok ? th.buy : th.sell, marginBottom: 10, lineHeight: 20 }}>{pwMsg.text}</Text>}
              <Btn label="Update password" icon="key-outline" onPress={doChangePw} busy={pwBusy} disabled={!pw.cur || pw.nw.length < 6 || !pw.again} />
            </Card>
          )}
        </Group>

        {(lic.admin || lic.adminEmail || !!licErr) && (
          <Group title="Server & admin">
            <AdminAccess />
            {(lic.admin || !!licErr) && (
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <Icon name="server-outline" size={18} color={th.accent} />
                  <Text style={{ color: th.text, fontWeight: '900', fontSize: 15 }}>Server address</Text>
                </View>
                <Dim>Paste the new address here when your tunnel or host changes. No app update needed.</Dim>
                <View style={{ height: 8 }} />
                <Field label="Server URL" value={srv} onChangeText={setSrv} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
                <Btn label="Save and connect" onPress={() => saveSrv(false)} />
                <View style={{ height: 8 }} />
                <Btn ghost label="Use the built-in address" onPress={() => saveSrv(true)} />
                {!!srvMsg && <View style={{ marginTop: 8 }}><Dim>{srvMsg}</Dim></View>}
              </Card>
            )}
          </Group>
        )}
        <View style={{ height: 4 }} />
        <PoweredBy />
      </Cols>

      <Modal visible={pinModal} animationType="slide" onRequestClose={() => setPinModal(false)}>
        <View style={{ flex: 1, direction: rtl ? 'rtl' : 'ltr', backgroundColor: th.bg }}>
          <PinScreen mode="setup" onDone={() => setPinModal(false)} onSkip={() => setPinModal(false)} />
        </View>
      </Modal>
      <Modal visible={sheet} transparent animationType="fade" onRequestClose={() => setSheet(false)}>
        <Pressable onPress={() => setSheet(false)} style={{ flex: 1, backgroundColor: '#0009', justifyContent: 'flex-end' }}>
          <Pressable style={{ backgroundColor: th.solid, borderTopLeftRadius: 8, borderTopRightRadius: 8, padding: 16, paddingBottom: 30, gap: 8, direction: rtl ? 'rtl' : 'ltr' }}>
            <Text style={{ color: th.text, fontSize: 17, fontWeight: '800', marginBottom: 6 }}>Profile photo</Text>
            <Btn icon="images-outline" label={avatar ? 'Choose a new photo (crop)' : 'Choose from gallery'} onPress={() => choose('gallery')} />
            <Btn icon="camera-outline" ghost label="Take a photo" onPress={() => choose('camera')} />
            {!!avatar && <Btn icon="trash-outline" ghost label="Remove photo" onPress={() => { setAvatar(null); setSheet(false); }} />}
            <Btn ghost label="Cancel" onPress={() => setSheet(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}
