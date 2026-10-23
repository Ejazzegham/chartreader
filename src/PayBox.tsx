import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import * as SecureStore from './secureStore';
import { useApp } from './store';
import { Btn, Field, Badge, Dim } from './ui';
import { submitPayment, myPayments, MyPay } from './license';

// The payment claim: the user sends the TxID and the wallet it was sent FROM. The admin approves it (nothing is unlocked by the app itself).
// Used on the lock page (Paywall) and in Settings. It also shows the state of every payment this user sent, and opens the app by itself once one is approved.
export default function PayBox({ plan, net }: { plan: 'weekly' | 'monthly'; net: 'TRON' | 'BSC' }) {
  const { th, t, lic, refreshLic } = useApp();
  const [wallet, setWallet] = useState(''), [tx, setTx] = useState('');
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState(''), [bad, setBad] = useState(false);
  const [pays, setPays] = useState<MyPay[]>([]);
  const prevReview = useRef(0), beat = useRef(0);

  useEffect(() => { SecureStore.getItemAsync('pay_wallet').then((w) => { if (w) setWallet((cur) => cur || w); }).catch(() => {}); }, []);

  const load = useCallback(async () => {
    if (!lic.token) return;
    try {
      const r = await myPayments(lic.token); setPays(r.pays);
      const review = r.pays.filter((p) => p.status === 'review').length;
      beat.current++;
      if ((prevReview.current > 0 && review === 0) || beat.current % 4 === 0) refreshLic(); // a payment was decided (or once a minute): ask the server whether access is open now
      prevReview.current = review;
    } catch {}
  }, [lic.token]);
  useEffect(() => { load(); const i = setInterval(load, 15000); return () => clearInterval(i); }, [load]);

  const send = async () => {
    setBusy(true); setMsg(''); setBad(false);
    try {
      await submitPayment(lic.token, net, tx.trim(), wallet.trim(), plan);
      SecureStore.setItemAsync('pay_wallet', wallet.trim()).catch(() => {});
      setTx(''); setMsg(t('paySent')); await load();
    } catch (e: any) { setMsg(e?.message ?? 'Error'); setBad(true); }
    setBusy(false);
  };

  const col = (s: MyPay['status']) => (s === 'approved' ? th.buy : s === 'rejected' ? th.sell : th.gold);
  const lab = (s: MyPay['status']) => (s === 'approved' ? t('payApproved') : s === 'rejected' ? t('payRejected') : t('payReview'));
  return (
    <View style={{ gap: 10 }}>
      <Field label={t('payWallet')} value={wallet} onChangeText={setWallet} placeholder={net === 'TRON' ? 'T...' : '0x...'} autoCapitalize="none" autoCorrect={false} />
      <Field label={t('payTx')} value={tx} onChangeText={setTx} placeholder={net === 'TRON' ? '64-character hash' : '0x... (66 characters)'} autoCapitalize="none" autoCorrect={false} />
      <Dim>{t('pwWarnOnce')}</Dim>
      <Btn icon="paper-plane-outline" label={t('paySubmit')} onPress={send} busy={busy} disabled={tx.trim().length < 32 || wallet.trim().length < 20} />
      {!!msg && <Text style={{ color: bad ? th.sell : th.buy, fontSize: 13, lineHeight: 19, textAlign: 'center', fontWeight: '600' }}>{msg}</Text>}
      {pays.length > 0 && (
        <View style={{ gap: 8, marginTop: 4 }}>
          <Text style={{ color: th.dim, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>{t('payMine').toUpperCase()}</Text>
          {pays.map((p) => (
            <View key={p.txid} style={{ backgroundColor: th.panel2, borderWidth: 1, borderColor: col(p.status) + '55', borderRadius: 8, padding: 10, gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Badge label={lab(p.status)} color={col(p.status)} />
                <Text style={{ color: th.dim, fontSize: 12, flex: 1, textAlign: 'right' }}>{p.network} · {new Date(p.at).toLocaleDateString()}</Text>
              </View>
              <Text selectable numberOfLines={1} style={{ color: th.dim, fontSize: 11.5 }}>{p.txid.length > 24 ? p.txid.slice(0, 12) + '…' + p.txid.slice(-10) : p.txid}</Text>
              {p.status === 'approved' && !!p.days && <Text style={{ color: th.buy, fontSize: 12.5, fontWeight: '700' }}>+{p.days} {t('payDays')}</Text>}
              {p.status === 'rejected' && !!p.note && <Text style={{ color: th.sell, fontSize: 12.5 }}>{p.note}</Text>}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
