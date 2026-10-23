import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { showAlert } from './dialog';
import Modal from './Modal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from './store';
import { Card, Field, Btn, Dim, Icon } from './ui';
import { Avatar } from './Brand';

// Edit profile: name, phone, email (confirmed by a link sent to the new address), cloud backup status, delete account.
export default function EditProfile({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { th, t, account, avatar, cloud, syncNow, saveProfile, changeEmail, deleteAccount, emailVerified, googleOnly } = useApp();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(''), [phone, setPhone] = useState('');
  const [pBusy, setPBusy] = useState(false), [pMsg, setPMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [em, setEm] = useState(''), [emPw, setEmPw] = useState(''), [eBusy, setEBusy] = useState(false), [eMsg, setEMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [delPw, setDelPw] = useState(''), [dBusy, setDBusy] = useState(false), [dMsg, setDMsg] = useState('');
  const [open, setOpen] = useState(false);
  useEffect(() => { if (visible) { setName(account?.name ?? ''); setPhone(account?.phone ?? ''); setPMsg(null); setEMsg(null); setDMsg(''); setEm(''); setEmPw(''); setDelPw(''); setOpen(false); } }, [visible]);
  const msg = (k: string) => (k.startsWith('err') ? t(k) : k); // 'errXyz' keys are translated, other messages are shown as they are
  const dirty = name.trim() !== (account?.name ?? '') || phone.trim() !== (account?.phone ?? '');

  const doSave = async () => {
    setPMsg(null); setPBusy(true);
    const k = await saveProfile(name, phone);
    setPBusy(false);
    setPMsg(k ? { ok: false, text: msg(k) } : { ok: true, text: 'Profile saved.' });
  };
  const doEmail = async () => {
    setEMsg(null); setEBusy(true);
    const k = await changeEmail(em, emPw);
    setEBusy(false);
    if (k) setEMsg({ ok: false, text: msg(k) });
    else { setEMsg({ ok: true, text: `We sent a confirmation link to ${em.trim().toLowerCase()}. Open it and tap the link. Your email changes after that, and all your data stays with your account.` }); setEm(''); setEmPw(''); }
  };
  const doDelete = () => {
    if (!delPw) { setDMsg('Enter your password to confirm.'); return; }
    showAlert('Delete your account?', 'Your account, your paper-trading history and your cloud backup are erased for good. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete forever', style: 'destructive', onPress: async () => { setDMsg(''); setDBusy(true); const k = await deleteAccount(delPw); setDBusy(false); if (k) setDMsg(msg(k)); else onClose(); } },
    ]);
  };
  const status = cloud.status === 'saving' ? 'Saving…' : cloud.status === 'restoring' ? 'Restoring…' : cloud.status === 'error' ? 'Could not reach the server' : cloud.status === 'saved' && cloud.at ? `Backed up ${new Date(cloud.at).toLocaleString()}` : 'Not backed up yet';
  const sCol = cloud.status === 'error' ? th.sell : cloud.status === 'saved' ? th.buy : th.dim;
  const Note = ({ m }: { m: { ok: boolean; text: string } | null }) => (m ? <Text style={{ color: m.ok ? th.buy : th.sell, fontSize: 12.5, lineHeight: 18, marginTop: 4 }}>{m.text}</Text> : null);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: th.glass ? th.solid : th.bg, paddingTop: insets.top }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: th.hair }}>
          <Pressable onPress={onClose} hitSlop={10} style={{ width: 38, height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: th.panel2, borderWidth: 1, borderColor: th.hair }}><Icon name="chevron-back" size={20} color={th.text} /></Pressable>
          <Text style={{ flex: 1, color: th.text, fontSize: 18, fontWeight: '900' }}>Edit profile</Text>
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 40 }}>
            <View style={{ alignItems: 'center', gap: 8, paddingVertical: 6 }}>
              <Avatar size={84} name={name || account?.email} ring={th.accent} />
              <Text style={{ color: th.dim, fontSize: 12.5 }}>{account?.email}</Text>
            </View>

            <Card>
              <Text style={{ color: th.text, fontSize: 15, fontWeight: '900', marginBottom: 10 }}>Personal details</Text>
              <Field label="Full name" value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" maxLength={60} />
              <Field label="Phone number" value={phone} onChangeText={setPhone} placeholder="+92 300 1234567" keyboardType="phone-pad" maxLength={22} />
              <Btn label="Save changes" icon="checkmark" onPress={doSave} busy={pBusy} disabled={!dirty} />
              <Note m={pMsg} />
            </Card>

            <Card>
              <Text style={{ color: th.text, fontSize: 15, fontWeight: '900', marginBottom: 2 }}>Email address</Text>
              {googleOnly ? <Dim>{account?.email}. You signed in with Google, so this email comes from your Google account and cannot be changed here.</Dim> : <>
              <Dim>{emailVerified ? 'Your email is verified.' : 'Your email is not verified yet.'} To change it, enter the new address and your current password. We send a confirmation link to the new address.</Dim>
              <View style={{ height: 10 }} />
              <Field label="New email" value={em} onChangeText={setEm} placeholder="new@email.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
              <Field label="Current password" value={emPw} onChangeText={setEmPw} secureTextEntry autoCapitalize="none" placeholder="Your password" />
              <Btn ghost label="Send confirmation link" icon="mail-outline" onPress={doEmail} busy={eBusy} disabled={!em.trim() || !emPw} />
              <Note m={eMsg} /></>}
            </Card>

            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: th.accent + '22' }}><Icon name="cloud-done-outline" size={21} color={th.accent} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: th.text, fontSize: 15, fontWeight: '900' }}>Cloud backup</Text>
                  <Text style={{ color: sCol, fontSize: 12.5, marginTop: 2 }}>{status}</Text>
                </View>
              </View>
              <View style={{ height: 8 }} />
              <Dim>Your journal, setups, paper balance and history are saved to your account automatically. If you uninstall and reinstall the app, log in again and everything comes back. It is erased only when you delete your account.</Dim>
              <View style={{ height: 10 }} />
              <Btn ghost label="Back up now" icon="cloud-upload-outline" onPress={() => { syncNow(); }} busy={cloud.status === 'saving' || cloud.status === 'restoring'} />
            </Card>

            <Card style={{ borderColor: th.sell + '66' }}>
              <Pressable onPress={() => setOpen(!open)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Icon name="trash-outline" size={19} color={th.sell} />
                <Text style={{ flex: 1, color: th.sell, fontSize: 15, fontWeight: '900' }}>Delete account</Text>
                <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color={th.dim} />
              </Pressable>
              {open && (
                <View style={{ marginTop: 10 }}>
                  <Dim>This erases your account, your paper-trading history and your cloud backup from this phone and from the server. It cannot be undone.</Dim>
                  <View style={{ height: 10 }} />
                  {googleOnly ? <Dim>You will be asked to confirm with your Google account.</Dim> : <Field label="Password" value={delPw} onChangeText={setDelPw} secureTextEntry autoCapitalize="none" placeholder="Your password" />}
                  <Btn danger label="Delete my account" icon="trash-outline" onPress={doDelete} busy={dBusy} />
                  {!!dMsg && <Text style={{ color: th.sell, fontSize: 12.5, marginTop: 6 }}>{dMsg}</Text>}
                </View>
              )}
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
