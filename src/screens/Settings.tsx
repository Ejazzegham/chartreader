import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Switch, Platform, TextInput } from 'react-native';
import { shareText } from '../dialog';

import Modal from '../Modal';
import { useApp } from '../store';
import { Screen, Card, Field, Dim, Btn, Segment, Icon, confirmAction, AppHeader } from '../ui';
import { useWindowDimensions } from '../win';
import { auth } from '../firebase';
import { TFS } from '../markets';
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


// ---- Page building blocks (the account-settings look: light cards, blue icon tiles, bordered field tiles) ----
const BRAND_BLUE = ['#0A2A8F', '#1747D1', '#2B63F0'] as [string, string, string];

// One section card: round icon tile, title + helper line (and an optional action on the right), then the content.
const Section = ({ icon, title, sub, right, children }: { icon: string; title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode }) => {
  const { th } = useApp();
  return (
    <View style={{ backgroundColor: th.panel, borderColor: th.line, borderWidth: 1, borderRadius: 16, padding: 18, gap: 16, shadowColor: '#0B2A8F', shadowOpacity: th.dark ? 0.2 : 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: th.glass ? 0 : 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: th.accent + '1F', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={20} color={th.accent} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text accessibilityRole="header" style={{ color: th.text, fontSize: 17, fontWeight: '900', letterSpacing: -0.2 }} numberOfLines={1}>{title}</Text>
          {!!sub && <Text style={{ color: th.dim, fontSize: 12.5, marginTop: 1 }} numberOfLines={2}>{sub}</Text>}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
};

// Equal-width tiles in a row on a wide page, a plain stack on a phone.
const Grid = ({ wide, cols = 3, children }: { wide: boolean; cols?: 2 | 3 | 4; children: React.ReactNode }) => {
  const kids = React.Children.toArray(children).filter(Boolean);
  if (!wide) return <View style={{ gap: 10 }}>{kids}</View>;
  const basis = cols === 4 ? '23%' : cols === 3 ? '31.5%' : '48.5%';
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{kids.map((k, i) => <View key={i} style={{ flexBasis: basis, flexGrow: 1, minWidth: 200 }}>{k}</View>)}</View>;
};

// A bordered setting tile: icon on the left, small label, and the control under it.
const Tile = ({ icon, label, children, row }: { icon: string; label: string; children: React.ReactNode; row?: boolean }) => {
  const { th } = useApp();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: th.line, borderRadius: 12, backgroundColor: th.panel2, padding: 12, minHeight: 72 }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: th.accent + '1A', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={20} color={th.accent} /></View>
      <View style={{ flex: 1, minWidth: 0, flexDirection: row ? 'row' : 'column', alignItems: row ? 'center' : 'stretch', justifyContent: 'space-between', gap: 4 }}>
        <Text style={{ color: th.dim, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>{label}</Text>
        {children}
      </View>
    </View>
  );
};

// Drop-down. Opens a short list right under the box (a native <select> does not exist in React Native).
const Pick = ({ value, options, onChange }: { value: string; options: { k: string; label: string }[]; onChange: (k: string) => void }) => {
  const { th } = useApp();
  const [open, setOpen] = useState(false);
  const cur = options.find((o) => o.k === value)?.label ?? value;
  return (
    <View>
      <Pressable accessibilityRole="button" accessibilityLabel={cur} onPress={() => setOpen(!open)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 28 }}>
        <Text style={{ color: th.text, fontSize: 15, fontWeight: '800' }} numberOfLines={1}>{cur}</Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} color={th.dim} />
      </Pressable>
      {open && (
        <View style={{ marginTop: 6, borderWidth: 1, borderColor: th.line, borderRadius: 10, backgroundColor: th.solid, overflow: 'hidden' }}>
          {options.map((o) => (
            <Pressable key={o.k} onPress={() => { onChange(o.k); setOpen(false); }} style={({ pressed }) => ({ paddingVertical: 10, paddingHorizontal: 12, backgroundColor: o.k === value ? th.accent + '1A' : pressed ? th.panel2 : 'transparent', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' })}>
              <Text style={{ color: th.text, fontWeight: o.k === value ? '900' : '600', fontSize: 14 }}>{o.label}</Text>
              {o.k === value && <Icon name="checkmark" size={16} color={th.accent} />}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
};

// A number box that saves when the person leaves it. `clean` turns the typed text into the value to keep (0 = not set).
const NumBox = ({ value, placeholder, onSave, suffix }: { value: number; placeholder: string; onSave: (text: string) => void; suffix?: string }) => {
  const { th } = useApp();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <TextInput defaultValue={value ? String(value) : ''} placeholder={placeholder} placeholderTextColor={th.dim} keyboardType="decimal-pad" onEndEditing={(e) => onSave(e.nativeEvent.text)} onSubmitEditing={(e) => onSave(e.nativeEvent.text)}
        style={{ flex: 1, minWidth: 0, color: th.text, fontSize: 15, fontWeight: '800', paddingVertical: 2, paddingHorizontal: 0, outlineStyle: 'none' as any }} />
      {!!suffix && <Text style={{ color: th.dim, fontWeight: '700', fontSize: 13 }}>{suffix}</Text>}
    </View>
  );
};

const Flat = ({ label, icon, onPress, color, busy }: { label: string; icon?: string; onPress: () => void; color?: string; busy?: boolean }) => {
  const { th } = useApp();
  const c = color ?? th.accent;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={busy} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, height: 40, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: c + '66', backgroundColor: c + '12', opacity: pressed || busy ? 0.75 : 1 })}>
      {!!icon && <Icon name={icon} size={16} color={c} />}
      <Text style={{ color: c, fontWeight: '800', fontSize: 13.5 }}>{label}</Text>
    </Pressable>
  );
};

const FEATURES = [
  { icon: 'shield-checkmark-outline', title: 'Secure account', sub: 'Your data is protected' },
  { icon: 'card-outline', title: 'Flexible plan', sub: 'Choose your subscription' },
  { icon: 'color-palette-outline', title: 'Personalized', sub: 'Customize your experience' },
  { icon: 'help-buoy-outline', title: 'Help center', sub: 'Answers and support' },
];

const MARKETS = [{ k: 'forex', label: 'Forex & metals' }, { k: 'crypto', label: 'Crypto' }, { k: 'deriv', label: 'Synthetic indices' }, { k: 'indices', label: 'Stock indices' }];
const joined = () => { try { const d = new Date(auth.currentUser?.metadata?.creationTime || ''); return isNaN(+d) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return ''; } };
const shortId = (uid?: string) => { if (!uid) return ''; let h = 0; for (const ch of uid) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return 'CR-' + String(h % 1000000).padStart(6, '0'); };

export default function Settings() {
  const { th, t, rtl, settings, setSettings, lic, licErr, setLic, refreshLic, account, setPin, logout, avatar, setAvatar, changePassword, googleOnly, emailVerified, sendVerify, lockNow, pushState, startPush, setHelpOpen, supportUnread, desk, setDesk } = useApp();
  const { width } = useWindowDimensions();
  const wide = width >= 640;
  const [payOpen, setPayOpen] = useState(false);
  const num = (s: string) => { const v = parseFloat(String(s).replace(',', '.')); return isFinite(v) ? v : 0; };
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

  const planName = lic.status === 'admin' ? 'Admin' : lic.status === 'paid' ? 'Pro' : lic.status === 'trial' ? 'Free trial' : 'Expired';
  const since = joined();
  const sectionGap = 16;

  return (
    <Screen bare title={t('tabSettings')}>
      <EditProfile visible={editOpen} onClose={() => setEditOpen(false)} />
      <View style={{ gap: sectionGap }}>
        <AppHeader />

        {/* ---------- Hero ---------- */}
        <View style={{ borderRadius: 18, overflow: 'hidden', direction: 'ltr' }}>
          <LinearGradient colors={BRAND_BLUE} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: wide ? 28 : 20, gap: 18 }}>
            <View pointerEvents="none" style={{ position: 'absolute', right: -30, top: -40, width: 260, height: 260, borderRadius: 130, backgroundColor: '#FFFFFF10' }} />
            <View pointerEvents="none" style={{ position: 'absolute', right: wide ? 70 : 10, top: wide ? 30 : 14, opacity: 0.22 }}><Icon name="settings" size={wide ? 150 : 84} color="#FFFFFF" /></View>
            <View style={{ gap: 6, direction: rtl ? 'rtl' : 'ltr' }}>
              <Text accessibilityRole="header" style={{ color: '#FFFFFF', fontSize: wide ? 34 : 26, fontWeight: '900', letterSpacing: -0.8 }}>{t('tabSettings')}</Text>
              <Text style={{ color: '#DCE6FF', fontSize: 14.5, lineHeight: 21, maxWidth: 480 }}>Manage your account, subscription, security, appearance and preferences in one place.</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {FEATURES.map((f) => (
                <View key={f.title} style={{ flexBasis: wide ? '23%' : '47%', flexGrow: 1, minWidth: 150, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF1A', borderColor: '#FFFFFF2E', borderWidth: 1, borderRadius: 12, padding: 10 }}>
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#FFFFFF24', alignItems: 'center', justifyContent: 'center' }}><Icon name={f.icon} size={18} color="#FFFFFF" /></View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }} numberOfLines={1}>{f.title}</Text>
                    <Text style={{ color: '#C9D8FF', fontSize: 11.5 }} numberOfLines={1}>{f.sub}</Text>
                  </View>
                </View>
              ))}
            </View>
          </LinearGradient>
        </View>

        {/* ---------- Account profile ---------- */}
        <Section icon="person-outline" title="Account profile" sub="Manage your personal information and account details."
          right={wide ? <Flat icon="create-outline" label="Edit profile" onPress={() => setEditOpen(true)} /> : undefined}>
          <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: wide ? 'center' : 'flex-start', gap: wide ? 24 : 14, borderWidth: 1, borderColor: th.line, borderRadius: 14, backgroundColor: th.panel2, padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flexShrink: 0 }}>
              <Pressable onPress={() => setSheet(true)} disabled={picBusy} accessibilityRole="button" accessibilityLabel={avatar ? 'Edit photo' : 'Add photo'}>
                <Avatar size={72} name={account?.name || account?.email} ring={th.accent} />
                <View style={{ position: 'absolute', right: -2, bottom: -2, width: 26, height: 26, borderRadius: 13, backgroundColor: th.accent, borderWidth: 2, borderColor: th.panel, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={picBusy ? 'hourglass-outline' : 'camera'} size={13} color={th.onAccent} />
                </View>
              </Pressable>
              <View style={{ gap: 3, minWidth: 0, maxWidth: wide ? 260 : undefined }}>
                <Text style={{ color: th.text, fontSize: 18, fontWeight: '900', letterSpacing: -0.3 }} numberOfLines={1}>{account?.name || 'Your account'}</Text>
                <Text style={{ color: th.dim, fontSize: 13 }} numberOfLines={1}>{account?.email}</Text>
                {!!account?.phone && <Text style={{ color: th.dim, fontSize: 12.5 }} numberOfLines={1}>{account.phone}</Text>}
                <View style={{ alignSelf: 'flex-start', marginTop: 3 }}><Pill text={emailVerified ? 'VERIFIED ACCOUNT' : 'EMAIL NOT VERIFIED'} color={emailVerified ? th.buy : th.gold} /></View>
              </View>
            </View>
            <View style={{ flex: wide ? 1 : undefined, alignSelf: 'stretch', flexDirection: 'row', flexWrap: 'wrap', gap: 18, justifyContent: wide ? 'space-around' : 'flex-start' }}>
              {!!shortId(account?.uid) && <View><Text style={{ color: th.dim, fontSize: 12 }}>Account ID</Text><Text style={{ color: th.text, fontSize: 15, fontWeight: '800', marginTop: 2 }}>{shortId(account?.uid)}</Text></View>}
              {!!since && <View><Text style={{ color: th.dim, fontSize: 12 }}>Member since</Text><Text style={{ color: th.text, fontSize: 15, fontWeight: '800', marginTop: 2 }}>{since}</Text></View>}
              <View><Text style={{ color: th.dim, fontSize: 12 }}>Plan</Text><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}><Text style={{ color: th.text, fontSize: 15, fontWeight: '800' }}>{planName}</Text><Pill text={lic.status === 'expired' ? 'EXPIRED' : 'ACTIVE'} color={statusCol} /></View></View>
            </View>
          </View>
          {!wide && <Btn icon="create-outline" label="Edit profile" onPress={() => setEditOpen(true)} />}
          {!!picErr && <Text style={{ color: th.sell, lineHeight: 20 }}>{picErr}</Text>}
          {!emailVerified && (
            <View style={{ borderWidth: 1, borderColor: th.gold + '66', backgroundColor: th.gold + '12', borderRadius: 12, padding: 14, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Icon name="mail-unread-outline" size={20} color={th.gold} /><Text style={{ color: th.text, fontWeight: '900', fontSize: 15 }}>Confirm your email</Text></View>
              <Dim>{lic.adminEmail ? 'Admin tools stay locked until this email address is confirmed.' : 'Confirming your email protects your subscription: nobody else can sign up with your address and take it over.'}</Dim>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                <Btn icon="mail-outline" label="Send confirmation email" onPress={doVerify} busy={vBusy} />
                <Btn ghost label="I confirmed it, check again" onPress={doCheckVerified} busy={vBusy} />
              </View>
              {!!vMsg && <Dim>{vMsg}</Dim>}
            </View>
          )}
        </Section>

        {/* ---------- Subscription & billing ---------- */}
        <Section icon="diamond-outline" title="Subscription & billing" sub="View your current plan and manage your subscription.">
          {!lic.token && !!licErr && (
            <View style={{ borderWidth: 1, borderColor: th.sell + '66', backgroundColor: th.sell + '10', borderRadius: 12, padding: 14, gap: 6 }}>
              <Text style={{ color: th.sell, fontWeight: '800' }}>License server problem</Text>
              <Dim>{licErr}</Dim>
              <View style={{ alignSelf: 'flex-start' }}><Btn ghost label="Try again" onPress={() => refreshLic()} /></View>
            </View>
          )}
          <View style={{ flexDirection: wide ? 'row' : 'column', gap: 12 }}>
            <View style={{ flex: wide ? 2 : undefined, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: th.line, borderRadius: 14, backgroundColor: th.panel2, padding: 16 }}>
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: statusCol + '22', alignItems: 'center', justifyContent: 'center' }}><Icon name="diamond-outline" size={24} color={statusCol} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: th.text, fontSize: 16, fontWeight: '900' }} numberOfLines={2}>{statusText}</Text>
                <Text style={{ color: th.dim, fontSize: 12.5, marginTop: 2 }}>{lic.status === 'paid' ? 'Thank you for being a Pro member.' : lic.status === 'admin' ? 'Admin accounts never expire.' : 'Upgrade to unlock live data, more features and remove restrictions.'}</Text>
              </View>
              {lic.status !== 'admin' && <View style={{ flexShrink: 0 }}><Btn icon="diamond-outline" label={payOpen ? 'Hide plans' : lic.status === 'paid' ? 'Extend plan' : 'Upgrade plan'} onPress={() => setPayOpen(!payOpen)} /></View>}
            </View>
            <View style={{ flex: wide ? 1 : undefined, borderWidth: 1, borderColor: th.line, borderRadius: 14, backgroundColor: th.panel2, padding: 16, gap: 4, justifyContent: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="wallet-outline" size={18} color={th.accent} /><Text style={{ color: th.text, fontWeight: '900', fontSize: 14.5 }}>Payment method</Text></View>
              <Text style={{ color: th.dim, fontSize: 12.5 }}>USDT on TRON (TRC20) or BSC (BEP20)</Text>
            </View>
          </View>
          {lic.status !== 'admin' && (payOpen || lic.status === 'expired') && (
            <View style={{ gap: 10, borderTopWidth: 1, borderTopColor: th.hair, paddingTop: 14 }}>
              <Segment value={plan} onChange={(k) => setPlan(k as any)} options={[{ k: 'weekly', label: `${t('weekly')} $${PLANS.weekly}` }, { k: 'monthly', label: `${t('monthly')} $${PLANS['monthly']}` }]} />
              <Segment value={net} onChange={(k) => setNet(k as any)} options={[{ k: 'TRON', label: 'TRON (TRC20)' }, { k: 'BSC', label: 'BSC (BEP20)' }]} />
              <View style={{ borderWidth: 1, borderColor: th.line, borderRadius: 12, padding: 14, backgroundColor: th.panel2, alignItems: 'center' }}>
                <Text style={{ color: th.dim, fontSize: 11.5, fontWeight: '800' }}>{t('amountLabel')}</Text>
                <Text style={{ color: th.accent, fontSize: 30, fontWeight: '900', marginTop: 2 }}>${PLANS[plan]} <Text style={{ fontSize: 15 }}>USDT</Text></Text>
              </View>
              <Dim>{t('sendUsdt')}</Dim>
              <View style={{ borderWidth: 1, borderColor: th.line, borderRadius: 12, padding: 12, backgroundColor: th.panel2 }}>
                <Text selectable style={{ color: th.text, fontWeight: '700', fontSize: 13, lineHeight: 20, textAlign: 'center' }}>{PAY[net]}</Text>
              </View>
              <Dim>{t('addrTap')}</Dim>
              <PayBox plan={plan} net={net} />
            </View>
          )}
          {!!msg && <Dim>{msg}</Dim>}
        </Section>

        {/* ---------- Trading settings (saved in the Journal desk: the same numbers the Journal and the risk checks use) ---------- */}
        <Section icon="options-outline" title="Trading settings" sub="Your account numbers and defaults. Leave a box empty for no limit.">
          <Grid wide={wide} cols={3}>
            <Tile icon="globe-outline" label="Default market"><Pick value={settings.defMarket} options={MARKETS} onChange={(k) => setSettings({ defMarket: k })} /></Tile>
            <Tile icon="shield-checkmark-outline" label="Risk per trade"><NumBox value={desk.riskPct} placeholder="e.g. 1" suffix="%" onSave={(x) => { const v = num(x); setDesk({ riskPct: v > 0 && v <= 10 ? v : 0 }); }} /></Tile>
            <Tile icon="trending-down-outline" label="Daily loss limit"><NumBox value={desk.dailyLossPct} placeholder="Optional" suffix="%" onSave={(x) => { const v = num(x); setDesk({ dailyLossPct: v > 0 && v <= 20 ? v : 0 }); }} /></Tile>
            <Tile icon="wallet-outline" label="Account balance"><NumBox value={desk.balance} placeholder="Your balance" suffix="USD" onSave={(x) => { const v = num(x); setDesk({ balance: v > 0 ? v : 0 }); }} /></Tile>
            <Tile icon="flash-outline" label="Auto-log setups" row>{sw(desk.autoLog, (b) => setDesk({ autoLog: b }))}</Tile>
            <Tile icon="layers-outline" label="Max open trades"><NumBox value={desk.maxOpen} placeholder="No limit" onSave={(x) => { const v = Math.round(num(x)); setDesk({ maxOpen: v >= 1 && v <= 20 ? v : 0 }); }} /></Tile>
          </Grid>
        </Section>

        {/* ---------- Appearance ---------- */}
        <Section icon="color-palette-outline" title="Appearance" sub="Customize the look and feel of your platform.">
          <Grid wide={wide} cols={2}>
            <Tile icon="contrast-outline" label={t('theme')}><Pick value={themeId(settings.theme)} options={Object.keys(THEMES).map((id) => ({ k: id, label: t('th_' + id) }))} onChange={(k) => setSettings({ theme: k })} /></Tile>
            <Tile icon="time-outline" label="Default timeframe"><Pick value={settings.defTf} options={TFS} onChange={(k) => setSettings({ defTf: k })} /></Tile>
          </Grid>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {Object.entries(THEMES).map(([id, tm]) => {
              const on = themeId(settings.theme) === id;
              return (
                <Pressable key={id} onPress={() => setSettings({ theme: id })} accessibilityRole="button" accessibilityState={{ selected: on }} style={({ pressed }) => ({ flexBasis: wide ? '13%' : '47%', flexGrow: 1, minWidth: 110, borderRadius: 12, borderWidth: on ? 2 : 1, borderColor: on ? th.accent : th.line, backgroundColor: th.panel2, padding: 8, gap: 8, opacity: pressed ? 0.85 : 1 })}>
                  <LinearGradient colors={tm.glass ? tm.grad : [tm.bg, tm.bg, tm.bg]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 52, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, direction: 'ltr', borderWidth: 1, borderColor: th.hair, overflow: 'hidden' }}>
                    {[tm.panel, tm.accent, tm.accent2].map((c, i) => <View key={i} style={{ width: i ? 14 : 26, height: 16, borderRadius: 6, backgroundColor: c, borderWidth: i ? 0 : 1, borderColor: tm.line }} />)}
                  </LinearGradient>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ color: th.text, fontWeight: '800', fontSize: 12.5 }} numberOfLines={1}>{t('th_' + id)}</Text>
                    {on && <Icon name="checkmark-circle" size={17} color={th.accent} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Section>

        {/* ---------- Language ---------- */}
        <Section icon="language-outline" title={t('language')} sub="Choose your preferred language for the platform.">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {LANGS.map((l) => {
              const on = settings.lang === l.code;
              return (
                <Pressable key={l.code} onPress={() => setSettings({ lang: l.code })} accessibilityRole="button" accessibilityState={{ selected: on }} style={({ pressed }) => ({ flexBasis: wide ? '15%' : '30%', flexGrow: 1, minWidth: 96, alignItems: 'center', gap: 6, paddingVertical: 14, borderRadius: 12, borderWidth: on ? 2 : 1, borderColor: on ? th.accent : th.line, backgroundColor: on ? th.accent + '12' : th.panel2, opacity: pressed ? 0.85 : 1 })}>
                  <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: th.accent + '1F', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: th.accent, fontWeight: '900', fontSize: 13 }}>{l.code.toUpperCase()}</Text></View>
                  <Text style={{ color: th.text, fontWeight: on ? '900' : '700', fontSize: 14 }}>{l.name}</Text>
                  {on && <View style={{ position: 'absolute', top: 6, right: 6 }}><Icon name="checkmark-circle" size={16} color={th.accent} /></View>}
                </Pressable>
              );
            })}
          </View>
        </Section>

        {/* ---------- Notifications & alerts ---------- */}
        <Section icon="notifications-outline" title="Notifications & alerts" sub="Control how you receive alerts and notifications.">
          <View>
            <SetRow icon="notifications-outline" title="Alarm when the app is closed"
              sub={pushState.state === 'on' ? 'On. Price alerts and strong scanner setups ring this device even when the app is closed.'
                : pushState.state === 'denied' ? 'Notifications are blocked. Allow notifications for Chart Reader in the device settings, then tap Enable.'
                : pushState.state === 'unsupported' ? (inExpoGo() ? 'Background alerts do not work inside Expo Go. Use the installed APK or a development build. Alerts still show while the app is open.' : 'This build does not include notifications yet. Install the latest build.')
                : pushState.state === 'error' ? 'Could not turn on: ' + (pushState.msg || 'unknown error')
                : 'Not enabled yet.'}
              right={pushState.state === 'on' ? <Pill text="ON" color={th.buy} /> : <Flat label="Enable" onPress={() => { setTestMsg(''); startPush(); }} />} />
            <SetRow icon="radio-outline" title="Scanner alarm" sub="Ring an alarm when an automatic re-scan finds a strong setup." right={sw(desk.scanAlarm, (b) => setDesk({ scanAlarm: b }))} last={pushState.state !== 'on'} />
            {pushState.state === 'on' && <SetRow icon="paper-plane-outline" title="Send a test alarm" sub="Lock the device and wait a few seconds." onPress={async () => { setTestMsg('Sending...'); try { await pushTest(lic.token); setTestMsg('Sent. Lock the device and wait a few seconds.'); } catch (e: any) { setTestMsg(String(e?.message || e)); } }} last />}
          </View>
          {!!testMsg && <Dim>{testMsg}</Dim>}
        </Section>

        {/* ---------- Security ---------- */}
        {!(Platform.OS === 'web' && googleOnly) && (
          <Section icon="lock-closed-outline" title="Security settings" sub="Keep your account safe and secure.">
            <View>
              {Platform.OS !== 'web' && (<>
                <SetRow icon="finger-print" tint={th.buy} title="Fingerprint lock" sub={bioHw === false ? 'Needs a fingerprint saved on this phone.' : 'Unlock the app with your fingerprint instead of typing.'} right={sw(settings.bio, toggleBio)} />
                <SetRow icon="keypad-outline" title={t('pinLock')} sub={account?.pinHash ? 'A 4-digit PIN is asked when you open the app.' : 'Protect the app with a 4-digit PIN.'}
                  right={account?.pinHash ? <Pill text="ON" color={th.buy} /> : undefined}
                  onPress={() => (account?.pinHash ? confirmAction('Remove PIN lock?', 'The app will open without asking for your PIN.', () => setPin(null), 'Remove') : setPinModal(true))} />
                <SetRow icon="lock-closed-outline" tint={th.gold} title="Lock app now" sub={lockOn ? 'Ask for the fingerprint or PIN right away.' : 'Turn on the fingerprint or a PIN first.'} onPress={lockOn ? lockNow : undefined} right={lockOn ? undefined : <View />} />
              </>)}
              {!googleOnly && <SetRow icon="key-outline" tint={th.accent2} title="Change password" sub="Use a new password the next time you log in." onPress={() => setPwOpen(!pwOpen)} last right={<Icon name={pwOpen ? 'chevron-up' : 'chevron-down'} size={18} color={th.dim} />} />}
            </View>
            {!!bioMsg && <Text style={{ color: th.sell, lineHeight: 20 }}>{bioMsg}</Text>}
            {pwOpen && (
              <View style={{ borderWidth: 1, borderColor: th.line, borderRadius: 12, backgroundColor: th.panel2, padding: 14 }}>
                <Field label="Current password" value={pw.cur} onChangeText={(v) => setPw({ ...pw, cur: v })} secureTextEntry={!pw.show} autoCapitalize="none" autoCorrect={false}
                  right={<Pressable onPress={() => setPw({ ...pw, show: !pw.show })}><Icon name={pw.show ? 'eye-off-outline' : 'eye-outline'} color={th.dim} /></Pressable>} />
                <Field label="New password (6+ characters)" value={pw.nw} onChangeText={(v) => setPw({ ...pw, nw: v })} secureTextEntry={!pw.show} autoCapitalize="none" autoCorrect={false} />
                <Field label="Repeat new password" value={pw.again} onChangeText={(v) => setPw({ ...pw, again: v })} secureTextEntry={!pw.show} autoCapitalize="none" autoCorrect={false} />
                {!!pwMsg && <Text style={{ color: pwMsg.ok ? th.buy : th.sell, marginBottom: 10, lineHeight: 20 }}>{pwMsg.text}</Text>}
                <Btn label="Update password" icon="key-outline" onPress={doChangePw} busy={pwBusy} disabled={!pw.cur || pw.nw.length < 6 || !pw.again} />
              </View>
            )}
          </Section>
        )}

        {/* ---------- Support & help ---------- */}
        <Section icon="headset-outline" title="Support & help" sub="Get help, share the app or sign out.">
          <Grid wide={wide} cols={3}>
            <Tile icon="book-outline" label={t('helpTitle')} row>
              <Flat label={supportUnread > 0 ? `Open (${supportUnread})` : 'Open'} onPress={() => setHelpOpen(true)} />
            </Tile>
            <Tile icon="people-outline" label="Invite friends" row>
              <Flat label="Share link" onPress={() => { shareText(`I use Chart Reader to read charts and plan trades. Get the app here: ${APP_DOWNLOAD_URL}`); }} />
            </Tile>
            <Tile icon="log-out-outline" label="Sign out of this device" row>
              <Flat label={t('logout')} color={th.sell} onPress={logout} />
            </Tile>
          </Grid>
        </Section>

        {(lic.admin || lic.adminEmail || !!licErr) && (
          <Section icon="server-outline" title="Server & admin" sub="Paste the new address here when your tunnel or host changes. No app update needed.">
            <AdminAccess />
            {(lic.admin || !!licErr) && (
              <View style={{ gap: 8 }}>
                <Field label="Server URL" value={srv} onChangeText={setSrv} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
                <Btn label="Save and connect" onPress={() => saveSrv(false)} />
                <Btn ghost label="Use the built-in address" onPress={() => saveSrv(true)} />
                {!!srvMsg && <Dim>{srvMsg}</Dim>}
              </View>
            )}
          </Section>
        )}
        <PoweredBy />
      </View>

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
