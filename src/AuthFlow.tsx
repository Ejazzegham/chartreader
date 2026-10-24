import React, { useState } from 'react';
import { View, Text, Pressable, Switch, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { showAlert } from './dialog';
import { useApp } from './store';
import { WaveHeader, Btn, Field, Icon, Card } from './ui';
import PinScreen from './PinScreen';
import { LogoFull } from './Brand';
import { useDesktop } from './Desktop';
import Landing from './Landing';

const Logo = () => <LogoFull width={150} radius={8} />;

const Page = ({ h = 230, title, children }: { h?: number; title: string; children: React.ReactNode }) => {
  const { th } = useApp();
  const desk = useDesktop();
  if (desk) return ( // website on a wide screen: the front page on the left, the form on the right
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: th.bg }}>
      <Landing />
      <KeyboardAvoidingView style={{ flex: 0.85, minWidth: 420 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ width: '100%', maxWidth: 440 }}>
            <Text accessibilityRole="header" style={{ color: th.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.8, textAlign: 'center', marginBottom: 18 }}>{title}</Text>
            <Card style={{ padding: 24 }}>{children}</Card>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: th.bg }}>
      <WaveHeader height={h}><Logo /></WaveHeader>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text accessibilityRole="header" style={{ color: th.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.6, textAlign: 'center', marginBottom: 16 }}>{title}</Text>
        <Card style={{ padding: 18 }}>{children}</Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default function AuthFlow() {
  const { th, t, account, signup, login, resetPassword, enter, resetAccount, googleLogin } = useApp();
  const [step, setStep] = useState<'welcome' | 'login' | 'signup' | 'pin' | 'forgot'>(account ? 'login' : 'welcome');
  const [name, setName] = useState('');
  const [email, setEmail] = useState(account?.email ?? '');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0); // seconds before another reset email can be requested
  React.useEffect(() => { if (wait <= 0) return; const id = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(id); }, [wait]);

  const startSignup = () => {
    if (!account) { setStep('signup'); return; }
    showAlert(t('createAccount'), t('replaceWarn'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('cont'), onPress: async () => { await resetAccount(); setEmail(''); setPw(''); setStep('signup'); } },
    ]);
  };

  const doLogin = async () => {
    setBusy(true); setErr(''); setInfo('');
    const k = await login(email, pw, remember);
    setBusy(false);
    if (k) setErr(t(k));
  };

  const doGoogle = async () => {
    setBusy(true); setErr(''); setInfo('');
    const r = await googleLogin();
    setBusy(false);
    if (r.err) setErr(t(r.err)); else if (r.isNew) { if (Platform.OS === 'web') enter(); else setStep('pin'); } // an existing account is already logged in; a new one sets its PIN first
  };

  const doReset = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setErr(t('errFields')); return; }
    setBusy(true); setErr(''); setInfo('');
    const k = await resetPassword(email);
    setBusy(false);
    if (k) setErr(t(k)); else { setInfo(t('resetSent') + ' Check your spam folder too.'); setWait(45); }
  };

  const doSignup = async () => {
    if (name.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(email.trim()) || pw.length < 6) { setErr(t('errFields')); return; }
    setBusy(true); setErr('');
    const k = await signup(name, email, pw);
    setBusy(false);
    if (k) { setErr(t(k)); return; }
    if (Platform.OS === 'web') enter(); else setStep('pin'); // the website has no PIN
  };

  const google = (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 16 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: th.line }} /><Text style={{ color: th.dim, fontSize: 12.5 }}>{t('orWord')}</Text><View style={{ flex: 1, height: 1, backgroundColor: th.line }} />
      </View>
      <Btn ghost label={t('continueGoogle')} icon="logo-google" onPress={doGoogle} busy={busy} />
    </View>
  );
  const eye = <Pressable onPress={() => setShow(!show)}><Icon name={show ? 'eye-off-outline' : 'eye-outline'} color={th.dim} /></Pressable>;
  const infoMsg = !!info && <Text style={{ color: th.accent, marginBottom: 10, textAlign: 'center' }}>{info}</Text>;
  const error = !!err && <Text style={{ color: th.sell, marginBottom: 10, textAlign: 'center' }}>{err}</Text>;
  const link = (a: string, b: string, go: () => void) => (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 18 }}>
      <Text style={{ color: th.dim }}>{a}</Text>
      <Pressable onPress={go}><Text style={{ color: th.accent, fontWeight: '700' }}>{b}</Text></Pressable>
    </View>
  );

  if (step === 'pin') return <PinScreen mode="setup" onDone={enter} onSkip={enter} />;

  if (step === 'welcome')
    return (
      <Page h={300} title={t('welcome')}>
        <View style={{ gap: 12 }}>
          <Btn label={t('createAccount')} onPress={startSignup} />
          <Btn ghost label={t('login')} onPress={() => setStep('login')} />
        </View>
        {error}
        {google}
      </Page>
    );

  if (step === 'forgot')
    return (
      <Page h={210} title={t('forgotTitle')}>
        <Text style={{ color: th.dim, textAlign: 'center', lineHeight: 21, marginBottom: 18 }}>{t('forgotSub')}</Text>
        <Field label={t('email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoFocus />
        {error}{infoMsg}
        <Btn label={wait > 0 ? `${t('sendLink')} (${wait}s)` : info ? 'Send again' : t('sendLink')} icon="mail-outline" onPress={doReset} busy={busy} disabled={wait > 0} />
        {!!info && <Text style={{ color: th.dim, textAlign: 'center', fontSize: 12.5, lineHeight: 19, marginTop: 12 }}>Open the email, tap the link, choose a new password, then come back here and log in with it.</Text>}
        <View style={{ height: 10 }} />
        <Btn ghost label={t('backLogin')} icon="arrow-back" onPress={() => { setErr(''); setInfo(''); setStep('login'); }} />
      </Page>
    );

  if (step === 'login')
    return (
      <Page title={t('login')}>
        <Field label={t('email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Field label={t('password')} value={pw} onChangeText={setPw} secureTextEntry={!show} autoCapitalize="none" right={eye} />
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          <Switch value={remember} onValueChange={setRemember} trackColor={{ true: th.accent, false: th.line }} />
          <Text style={{ color: th.dim, marginStart: 8 }}>{t('remember')}</Text>
        </View>
        {error}{infoMsg}
        <Btn label={t('login')} onPress={doLogin} busy={busy} />
        <Pressable onPress={() => { setErr(''); setInfo(''); setStep('forgot'); }} disabled={busy} style={{ padding: 10, alignItems: 'center', marginTop: 6 }}><Text style={{ color: th.accent, fontWeight: '700' }}>{t('forgotPw')}</Text></Pressable>
        {google}
        {link(t('newUser'), t('signup'), startSignup)}
      </Page>
    );

  return (
    <Page title={t('signup')}>
      <Field label={t('fullName')} value={name} onChangeText={setName} />
      <Field label={t('email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Field label={t('password')} value={pw} onChangeText={setPw} secureTextEntry={!show} autoCapitalize="none" right={eye} />
      {error}
      <Btn label={t('signup')} onPress={doSignup} busy={busy} />
      {google}
      {link(t('haveAcct'), t('login'), () => setStep('login'))}
    </Page>
  );
}
