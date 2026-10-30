import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Linking } from 'react-native';
import { shareText } from './dialog';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from './store';
import { Icon, Btn, Field } from './ui';
import { LogoMark, PoweredBy } from './Brand';
import { PAY, PLANS, SUPPORT_EMAIL, getServer, setServer } from './license';
import PayBox from './PayBox';

// =====================================================================================
// The lock page. Shown INSTEAD of the whole app when the free trial or the paid plan has ended
// (App.tsx decides; see `live` in store.tsx). Nothing else in the app can be reached from here.
// It shows: a clear message, the plans, the payment details, the steps, and a place to paste the TxID.
// Three situations:
//   checking: the server has not answered yet, so access is not known. A short wait.
//   error:    the server could not be reached, so access cannot be confirmed. Retry, and fix the server address if it changed.
//   expired:  the normal case. Pay and the app opens by itself.
// =====================================================================================
export default function Paywall() {
  const { th, t, lic, licErr, refreshLic, logout, emailVerified, sendVerify, setHelpOpen, supportUnread } = useApp();
  const insets = useSafeAreaInsets();
  const [plan, setPlan] = useState<'weekly' | 'monthly'>('monthly');
  const [net, setNet] = useState<'TRON' | 'BSC'>('TRON');
  const [chk, setChk] = useState(false);
  const [msg, setMsg] = useState(''), [bad, setBad] = useState(false);
  const [showSrv, setShowSrv] = useState(false), [srv, setSrv] = useState(getServer());

  const known = !!lic.token;                  // the server has told us who this is
  const renewal = lic.paidUntil > 0;          // had a paid plan before: say "renew", not "trial ended"
  const pad = { paddingTop: Math.max(insets.top, 24) + 12, paddingBottom: insets.bottom + 28, paddingHorizontal: 18 };
  const say = (m: string, isBad = false) => { setMsg(m); setBad(isBad); };

  const recheck = async () => { setChk(true); say(''); const ok = await refreshLic(); setChk(false); say(ok ? t('pwChecked') : 'Could not reach the server. Check your connection and try again.', !ok); };
  const saveSrv = async () => { const e = await setServer(srv); if (e) { say(e, true); return; } setSrv(getServer()); await recheck(); };
  const writeUs = () => { Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Chart Reader support')}`).catch(() => say(`${t('helpNoMail')} ${SUPPORT_EMAIL}`, true)); };
  const sendMail = async () => { setChk(true); const k = await sendVerify(); setChk(false); say(k ? t(k) : 'Email sent. Open it, tap the link, then come back and press Try again. Check spam too.', !!k); };

  // ---------------------------------------------------------------- checking
  if (!known && !licErr) {
    return (
      <View style={{ flex: 1, backgroundColor: th.bg, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <LogoMark size={64} />
        <ActivityIndicator color={th.accent} />
        <Text style={{ color: th.dim, fontSize: 13.5, fontWeight: '600' }}>{t('pwChecking')}</Text>
      </View>
    );
  }

  const box = { backgroundColor: th.panel, borderWidth: 1, borderColor: th.line, borderRadius: 8, padding: 14 } as const;
  // a plain function, not a component: a component declared inside render is rebuilt on every keystroke and the TxID field would lose focus
  const shell = (children: React.ReactNode) => (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: th.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ ...pad, gap: 14 }}>
        <View style={{ alignItems: 'center', gap: 10 }}>
          <LogoMark size={60} />
          <Text style={{ color: th.text, fontSize: 15, fontWeight: '900', letterSpacing: 0.4 }}>Chart Reader</Text>
        </View>
        {children}
        {/* help: chat with the admin (needs a known account) and the support email. Always reachable on the lock page. */}
        <View style={{ ...box, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name="chatbubbles-outline" size={22} color={th.accent} />
            <Text style={{ flex: 1, color: th.text, fontSize: 15, fontWeight: '900' }}>{t('pwContactTitle')}</Text>
          </View>
          <Text style={{ color: th.dim, fontSize: 13, lineHeight: 19 }}>{t('pwContactText')}</Text>
          {known && <Btn icon="chatbubbles-outline" label={supportUnread > 0 ? `${t('helpOpenBtn')} (${supportUnread})` : t('helpOpenBtn')} onPress={() => setHelpOpen(true)} />}
          <Btn ghost icon="mail-outline" label={SUPPORT_EMAIL} onPress={writeUs} />
        </View>
        <Pressable onPress={logout} hitSlop={8} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 16 }}>
          <Text style={{ color: th.dim, fontSize: 13, fontWeight: '700' }}>{t('logout')}</Text>
        </Pressable>
        <PoweredBy />
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // ---------------------------------------------------------------- error: access cannot be confirmed
  if (!known) {
    return shell(
      <>
        <View style={{ ...box, gap: 10, alignItems: 'center' }}>
          <View style={{ width: 52, height: 52, borderRadius: 8, backgroundColor: th.gold + '22', alignItems: 'center', justifyContent: 'center' }}><Icon name="cloud-offline-outline" size={26} color={th.gold} /></View>
          <Text accessibilityRole="header" style={{ color: th.text, fontSize: 19, fontWeight: '900', textAlign: 'center' }}>{t('pwErrTitle')}</Text>
          <Text style={{ color: th.dim, fontSize: 13.5, lineHeight: 20, textAlign: 'center' }}>{licErr}</Text>
          <View style={{ alignSelf: 'stretch', gap: 8, marginTop: 4 }}>
            <Btn icon="refresh" label={t('pwRetry')} onPress={recheck} busy={chk} />
            {!emailVerified && <Btn ghost icon="mail-outline" label={t('pwConfirmMail')} onPress={sendMail} busy={chk} />}
            <Btn ghost icon="settings-outline" label={t('pwConn')} onPress={() => setShowSrv((v) => !v)} />
            {showSrv && (
              <View style={{ gap: 8 }}>
                <Field label={t('pwSrv')} value={srv} onChangeText={setSrv} placeholder="https://..." autoCapitalize="none" autoCorrect={false} keyboardType="url" />
                <Btn label={t('pwSrvSave')} onPress={saveSrv} busy={chk} />
              </View>
            )}
          </View>
          {!!msg && <Text style={{ color: bad ? th.sell : th.dim, fontSize: 13, lineHeight: 19, textAlign: 'center' }}>{msg}</Text>}
        </View>
      </>
    );
  }

  // ---------------------------------------------------------------- expired: pay to continue
  const plans: { k: 'weekly' | 'monthly'; label: string; sub: string; best?: boolean }[] = [
    { k: 'weekly', label: t('weekly'), sub: t('pwPlanWeekly') },
    { k: 'monthly', label: t('monthly'), sub: t('pwPlanMonthly'), best: true },
  ];
  return shell(
    <>
      {/* the message */}
      <View style={{ ...box, borderColor: th.sell + '66', gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: th.sell + '22', alignItems: 'center', justifyContent: 'center' }}><Icon name="lock-closed" size={22} color={th.sell} /></View>
          <View style={{ backgroundColor: th.sell + '22', borderColor: th.sell + '66', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: th.sell, fontSize: 11, fontWeight: '900', letterSpacing: 0.6 }}>{renewal ? t('pwBadgeExpired') : t('pwBadgeTrial')}</Text>
          </View>
        </View>
        <Text accessibilityRole="header" style={{ color: th.text, fontSize: 24, fontWeight: '900', lineHeight: 30 }}>{renewal ? t('pwTitleExpired') : t('pwTitleTrial')}</Text>
        <Text style={{ color: th.text, fontSize: 14.5, lineHeight: 22 }}>{renewal ? t('pwLeadExpired') : t('pwLeadTrial')}</Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 2 }}>
          <Icon name="shield-checkmark-outline" size={18} color={th.buy} />
          <Text style={{ flex: 1, color: th.dim, fontSize: 12.5, lineHeight: 19 }}>{t('pwSafe')}</Text>
        </View>
      </View>

      {/* plan */}
      <Text style={{ color: th.dim, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 4 }}>{t('pwPlan').toUpperCase()}</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {plans.map((p) => {
          const on = plan === p.k;
          return (
            <Pressable key={p.k} onPress={() => setPlan(p.k)} accessibilityRole="button" accessibilityState={{ selected: on }}
              style={({ pressed }) => ({ flex: 1, borderRadius: 8, borderWidth: on ? 2 : 1, borderColor: on ? th.accent : th.line, backgroundColor: on ? th.accent + '14' : th.panel, padding: 12, gap: 2, opacity: pressed ? 0.85 : 1 })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: th.text, fontSize: 13.5, fontWeight: '800' }}>{p.label}</Text>
                {on && <Icon name="checkmark-circle" size={18} color={th.accent} />}
              </View>
              <Text style={{ color: th.accent, fontSize: 26, fontWeight: '900' }}>${PLANS[p.k]}</Text>
              <Text style={{ color: th.dim, fontSize: 11.5, lineHeight: 16 }}>{p.sub}</Text>
              {p.best && <Text style={{ color: th.buy, fontSize: 10, fontWeight: '900', letterSpacing: 0.8, marginTop: 2 }}>{t('pwBest')}</Text>}
            </Pressable>
          );
        })}
      </View>

      {/* payment details */}
      <Text style={{ color: th.dim, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 4 }}>{t('pwPayTitle').toUpperCase()}</Text>
      <View style={{ ...box, gap: 12 }}>
        <View>
          <Text style={{ color: th.dim, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: 6 }}>{t('pwNetwork').toUpperCase()}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {([['TRON', 'TRON (TRC20)'], ['BSC', 'BSC (BEP20)']] as const).map(([k, label]) => {
              const on = net === k;
              return (
                <Pressable key={k} onPress={() => setNet(k)} accessibilityRole="button" accessibilityState={{ selected: on }}
                  style={{ flex: 1, height: 42, borderRadius: 8, borderWidth: on ? 2 : 1, borderColor: on ? th.accent : th.line, backgroundColor: on ? th.accent + '14' : th.panel2, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: th.text, fontWeight: on ? '900' : '700', fontSize: 13 }}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={{ alignItems: 'center', backgroundColor: th.panel2, borderRadius: 8, borderWidth: 1, borderColor: th.line, paddingVertical: 12 }}>
          <Text style={{ color: th.dim, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>{t('amountLabel').toUpperCase()}</Text>
          <Text style={{ color: th.accent, fontSize: 32, fontWeight: '900', marginTop: 2 }}>${PLANS[plan]} <Text style={{ fontSize: 15 }}>USDT</Text></Text>
        </View>
        <View>
          <Text style={{ color: th.dim, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: 6 }}>{t('pwAddress').toUpperCase()}</Text>
          <View style={{ backgroundColor: th.panel2, borderRadius: 8, borderWidth: 1, borderColor: th.line, padding: 12 }}>
            <Text selectable style={{ color: th.text, fontWeight: '700', fontSize: 13, lineHeight: 20, textAlign: 'center' }}>{PAY[net]}</Text>
          </View>
          <Text style={{ color: th.dim, fontSize: 11.5, textAlign: 'center', marginTop: 6 }}>{t('addrTap')}</Text>
        </View>
        <Btn ghost icon="share-outline" label={t('pwShare')} onPress={() => { shareText(PAY[net]); }} />
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: th.gold + '14', borderColor: th.gold + '55', borderWidth: 1, borderRadius: 8, padding: 10 }}>
          <Icon name="warning-outline" size={18} color={th.gold} />
          <Text style={{ flex: 1, color: th.text, fontSize: 12.5, lineHeight: 18 }}>{t('pwWarn')}</Text>
        </View>
      </View>

      {/* steps + TxID */}
      <Text style={{ color: th.dim, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 4 }}>{t('pwSteps').toUpperCase()}</Text>
      <View style={{ ...box, gap: 12 }}>
        {[t('pwStepA'), t('pwStepB'), t('pwStepC')].map((x, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: th.accent + '22', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: th.accent, fontWeight: '900', fontSize: 12.5 }}>{i + 1}</Text></View>
            <Text style={{ flex: 1, color: th.text, fontSize: 13.5, lineHeight: 20 }}>{x}</Text>
          </View>
        ))}
        <PayBox plan={plan} net={net} />
        {!!msg && <Text style={{ color: bad ? th.sell : th.dim, fontSize: 13, lineHeight: 19, textAlign: 'center' }}>{msg}</Text>}
      </View>

      <Btn ghost icon="refresh" label={t('pwPaid')} onPress={recheck} busy={chk} />
    </>
  );
}
