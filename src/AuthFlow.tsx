import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, Switch, ScrollView, KeyboardAvoidingView, Platform, Animated, Easing, Linking } from 'react-native';
import { showAlert } from './dialog';
import { useApp } from './store';
import { WaveHeader, Btn, Field, Icon, Card } from './ui';
import PinScreen from './PinScreen';
import { LogoFull } from './Brand';
import { useDesktop } from './Desktop';
import Landing from './Landing';
import AuthBrand from './AuthBrand';
import { useLayout } from './win';

const Logo = () => <LogoFull width={150} radius={8} />;

// Each panel slides in from its own side when a screen opens, so Log in <-> Sign up feels like the two halves swapping places.
function Slide({ dx, style, children }: { dx: number; style?: any; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(v, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(); }, []);
  return <Animated.View style={[style, { opacity: v, transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [dx, 0] }) }] }]}>{children}</Animated.View>;
}

// side = where the brand panel sits on a wide screen: left for log in, right for sign up (the form takes the other half)
const Page = ({ h = 230, title, subtitle, side = 'left', children }: { h?: number; title: string; subtitle?: string; side?: 'left' | 'right'; children: React.ReactNode }) => {
  const { th } = useApp();
  const desk = useDesktop(), narrow = useLayout().full < 900;
  if (desk && narrow) return ( // website on a phone: logo, the form, then the front-page sections under it (one scrolling page)
    <ScrollView style={{ flex: 1, backgroundColor: th.bg }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={{ padding: 16, paddingTop: 28, paddingBottom: 32, alignItems: 'center' }}>
        <Logo />
        <View style={{ width: '100%', maxWidth: 440 }}>
          <Text accessibilityRole="header" style={{ color: th.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.6, textAlign: 'center', marginVertical: 16 }}>{title}</Text>
          <Card style={{ padding: 18 }}>{children}</Card>
        </View>
      </View>
      <Landing stacked />
    </ScrollView>
  );
  if (desk) { // website on a wide screen: brand panel on one half, the form on the other
    const dir = side === 'left' ? -1 : 1;
    const brand = <Slide dx={dir * 70} style={{ flex: 1.05, minWidth: 0 }}><AuthBrand mode={side === 'left' ? 'login' : 'signup'} /></Slide>;
    const form = (
      <Slide dx={-dir * 36} style={{ flex: 1, minWidth: 420 }}>
        <KeyboardAvoidingView style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={{ width: '100%', maxWidth: 440 }}>
              <Text accessibilityRole="header" style={{ color: th.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.8, marginBottom: subtitle ? 6 : 18 }}>{title}</Text>
              {!!subtitle && <Text style={{ color: th.dim, fontSize: 14.5, lineHeight: 21, marginBottom: 20 }}>{subtitle}</Text>}
              <Card style={{ padding: 26 }}>{children}</Card>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Slide>
    );
    return <View style={{ flex: 1, flexDirection: 'row', backgroundColor: th.bg, overflow: 'hidden' }}>{side === 'left' ? <>{brand}{form}</> : <>{form}{brand}</>}</View>;
  }
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
  const [agree, setAgree] = useState(false); // sign up: Terms of Service + Privacy Policy accepted
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

  const AGREE_MSG = 'Please tick the box to accept the Terms of Service and Privacy Policy.';
  const doGoogle = async () => {
    if (step === 'signup' && !agree) { setErr(AGREE_MSG); return; }
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
    if (!agree) { setErr(AGREE_MSG); return; }
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
      <Page key="welcome" h={300} title={t('welcome')} subtitle="Create an account or log in to continue.">
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
      <Page key="forgot" h={210} title={t('forgotTitle')}>
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
      <Page key="login" title={t('login')} subtitle="Welcome back. Log in to continue to your charts.">
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
    <Page key="signup" side="right" title={t('signup')} subtitle="Create your account in under a minute and start your free trial.">
      <Field label={t('fullName')} value={name} onChangeText={setName} />
      <Field label={t('email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Field label={t('password')} value={pw} onChangeText={setPw} secureTextEntry={!show} autoCapitalize="none" right={eye} />
      <Text style={{ color: th.dim, fontSize: 12, marginTop: -4, marginBottom: 12 }}>Use at least 6 characters.</Text>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: agree }} onPress={() => { setAgree(!agree); if (!agree) setErr(''); }} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14, cursor: 'pointer' } as any}>
        <View style={{ width: 20, height: 20, marginTop: 1, borderRadius: 5, borderWidth: 1.5, borderColor: agree ? th.accent : th.dim, backgroundColor: agree ? th.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {agree && <Icon name="checkmark" size={14} color={th.onAccent} />}
        </View>
        <Text style={{ flex: 1, color: th.dim, fontSize: 12.5, lineHeight: 18 }}>
          I agree to the{' '}
          <Text onPress={() => Linking.openURL('/terms.html')} style={{ color: th.accent, fontWeight: '600' }}>Terms of Service</Text> and{' '}
          <Text onPress={() => Linking.openURL('/privacy.html')} style={{ color: th.accent, fontWeight: '600' }}>Privacy Policy</Text>.
        </Text>
      </Pressable>
      {error}
      <Btn label={t('signup')} onPress={doSignup} busy={busy} />
      {google}
      {link(t('haveAcct'), t('login'), () => setStep('login'))}
    </Page>
  );
}
