import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, FlatList, TextInput, ScrollView } from 'react-native';
import Modal from '../Modal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../store';
import { Card, Field, Dim, Btn, Segment, Icon, Badge, StatTile } from '../ui';
import { adminStats, adminGrant, saveServerKey, AdminStats, AdminUser, AdminPay } from '../license';

const date = (ms: number) => (ms ? new Date(ms).toLocaleDateString() : '-');
const dateTime = (ms: number) => (ms ? new Date(ms).toLocaleString() : '-');
const short = (s: string) => (s.length > 20 ? s.slice(0, 10) + '…' + s.slice(-8) : s);

type Tab = 'overview' | 'subs' | 'pays' | 'tools' | 'setup';

export default function AdminPanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { th, t, rtl, lic, settings, setSettings } = useApp();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'paid' | 'trial' | 'expired'>('all');
  const [gEmail, setGEmail] = useState('');
  const [gDays, setGDays] = useState('30');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState('');
  const [keyMsg, setKeyMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try { setStats(await adminStats(lic.token)); } catch (e: any) { setErr(e.message ?? 'Error'); }
    setLoading(false);
  }, [lic.token]);

  useEffect(() => { if (visible && lic.admin) load(); }, [visible, lic.admin, load]);

  const users = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (stats?.list ?? []).filter((u) => (filter === 'all' || u.status === filter) && (!s || u.email.toLowerCase().includes(s)));
  }, [stats, q, filter]);

  const pays = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (stats?.pays ?? []).filter((p) => !s || p.email.toLowerCase().includes(s) || p.txid.toLowerCase().includes(s));
  }, [stats, q]);

  const grant = async () => {
    const days = Number(gDays);
    if (!/^\S+@\S+\.\S+$/.test(gEmail.trim()) || !isFinite(days) || !days) { setMsg('Enter a valid email and a number of days (use a minus number to take days away).'); return; }
    setBusy(true); setMsg('');
    try {
      await adminGrant(lic.token, gEmail.trim(), days);
      setMsg(`Done: ${gDays} days for ${gEmail}`); setGEmail(''); load();
    } catch (e: any) { setMsg(e.message ?? 'Error'); }
    setBusy(false);
  };

  const saveKey = async () => {
    setBusy(true); setKeyMsg('');
    try { await saveServerKey(lic.token, key.trim(), settings.model.trim()); setKey(''); setKeyMsg(t('keySaved')); load(); } catch (e: any) { setKeyMsg(e.message ?? 'Error'); }
    setBusy(false);
  };

  const statusColor = (s: string) => (s === 'paid' ? th.buy : s === 'trial' ? th.gold : th.sell);

  const UserRow = ({ u }: { u: AdminUser }) => (
    <Pressable onPress={() => { setGEmail(u.email); setMsg(''); setTab('tools'); }}>
      <Card style={{ marginBottom: 8, padding: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text selectable style={{ color: th.text, flex: 1, fontWeight: '700' }} numberOfLines={1}>{u.email}</Text>
          <Badge label={u.status.toUpperCase()} color={statusColor(u.status)} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 6 }}>
          <Text style={{ color: th.dim, fontSize: 12 }}>Joined: {date(u.created)}</Text>
          <Text style={{ color: th.dim, fontSize: 12 }}>{u.status === 'paid' ? `Paid until: ${date(u.paidUntil)}` : `Trial end: ${date(u.trialEnd)}`}</Text>
          <Text style={{ color: th.dim, fontSize: 12 }}>Last seen: {date(u.last)}</Text>
        </View>
      </Card>
    </Pressable>
  );

  const PayRow = ({ p }: { p: AdminPay }) => (
    <Card style={{ marginBottom: 8, padding: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text selectable style={{ color: th.text, flex: 1, fontWeight: '700' }} numberOfLines={1}>{p.email}</Text>
        <Text style={{ color: th.buy, fontWeight: '800' }}>{p.usd ? `$${p.usd}` : '?'}</Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 6 }}>
        <Badge label={p.network} />
        <Text style={{ color: th.dim, fontSize: 12 }}>{p.days ? `${p.days} days` : ''}</Text>
        <Text style={{ color: th.dim, fontSize: 12 }}>{dateTime(p.at)}</Text>
      </View>
      <Text selectable style={{ color: th.dim, fontSize: 11, marginTop: 6 }}>TxID: {short(p.txid)}</Text>
    </Card>
  );

  const tabs = (
    <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
      <Segment value={tab} onChange={(k) => { setTab(k as Tab); setQ(''); }} options={[
        { k: 'overview', label: 'Overview' },
        { k: 'subs', label: 'Users' },
        { k: 'pays', label: 'Pay' },
        { k: 'tools', label: 'Grant' },
        { k: 'setup', label: 'Setup' },
      ]} />
    </View>
  );

  const search = (
    <View style={{ paddingHorizontal: 16, paddingBottom: 8, gap: 8 }}>
      <TextInput value={q} onChangeText={setQ} placeholder="Search email…" placeholderTextColor={th.dim} autoCapitalize="none" autoCorrect={false}
        style={{ backgroundColor: th.panel, borderColor: th.line, borderWidth: 1, borderRadius: 8, color: th.text, padding: 12 }} />
      {tab === 'subs' && (
        <Segment value={filter} onChange={(k) => setFilter(k as any)} options={[
          { k: 'all', label: 'All' }, { k: 'paid', label: 'Paid' }, { k: 'trial', label: 'Trial' }, { k: 'expired', label: 'Expired' },
        ]} />
      )}
    </View>
  );

  const empty = <Text style={{ color: th.dim, textAlign: 'center', marginTop: 30 }}>{loading ? 'Loading…' : err ? 'Could not load. Pull down to try again.' : 'Nothing here yet.'}</Text>;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: th.bg, direction: rtl ? 'rtl' : 'ltr', paddingTop: Math.max(insets.top, 24) + 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12, gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: th.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.6 }}>Admin panel</Text>
            <Text style={{ color: th.dim, fontSize: 12.5, marginTop: 2 }}>{stats ? `${stats.users} users · ${stats.paid} paid · $${stats.revenue} revenue` : 'Users, payments and access'}</Text>
          </View>
          <Pressable onPress={load} hitSlop={10} style={{ padding: 8 }}><Icon name="refresh" size={22} color={th.accent} /></Pressable>
          <Pressable onPress={onClose} hitSlop={10} style={{ padding: 8 }}><Icon name="close" size={26} color={th.text} /></Pressable>
        </View>
        {tabs}
        {!!err && <Text style={{ color: th.sell, paddingHorizontal: 16, marginBottom: 8 }}>{err}</Text>}

        {tab === 'overview' && (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
            {stats ? (
              <>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <StatTile label="Users" value={String(stats.users)} icon="people-outline" />
                  <StatTile label="Paid now" value={String(stats.paid)} color={th.buy} icon="card-outline" />
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <StatTile label="On trial" value={String(stats.trial)} color={th.gold} icon="time-outline" />
                  <StatTile label="Expired" value={String(stats.expired)} color={th.sell} icon="close-circle-outline" />
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <StatTile label="New (24h)" value={String(stats.new24h)} icon="person-add-outline" />
                  <StatTile label="Payments" value={String(stats.payments)} icon="receipt-outline" />
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <StatTile label="Revenue (USDT)" value={`$${stats.revenue}`} color={th.buy} icon="cash-outline" />
                </View>
                <Card>
                  <Dim>{stats.keySet ? 'Gemini key: set' : 'Gemini key: NOT set (analysis is off for everyone)'}{stats.model ? ` · model ${stats.model}` : ''}</Dim>
                </Card>
              </>
            ) : empty}
          </ScrollView>
        )}

        {tab === 'subs' && (
          <>
            {search}
            <FlatList data={users} keyExtractor={(u) => u.id ?? u.email} renderItem={({ item }) => <UserRow u={item} />} ListEmptyComponent={empty}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} refreshing={loading} onRefresh={load} />
          </>
        )}

        {tab === 'pays' && (
          <>
            {search}
            <FlatList data={pays} keyExtractor={(p) => p.txid} renderItem={({ item }) => <PayRow p={item} />} ListEmptyComponent={empty}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} refreshing={loading} onRefresh={load} />
          </>
        )}

        {tab === 'setup' && (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
            <Card>
              <Text style={{ color: th.text, fontWeight: '700', marginBottom: 4 }}>Gemini</Text>
              <Dim>{stats ? (stats.keySet ? 'A key is saved on the server.' : 'No key is saved yet: "Analysis of this chart" is off for everyone.') : 'Loading…'}</Dim>
              <View style={{ height: 8 }} />
              <Field label={t('adminKey')} value={key} onChangeText={setKey} secureTextEntry autoCapitalize="none" autoCorrect={false} />
              <Dim>{t('apiHint')}</Dim>
              <View style={{ height: 8 }} />
              <Field label={t('model')} value={settings.model} onChangeText={(v) => setSettings({ model: v })} autoCapitalize="none" autoCorrect={false} />
              <View style={{ height: 8 }} />
              <Btn label={t('saveKey')} onPress={saveKey} busy={busy} disabled={key.trim().length < 10 && !settings.model.trim()} />
              {!!keyMsg && <View style={{ marginTop: 10 }}><Dim>{keyMsg}</Dim></View>}
            </Card>
          </ScrollView>
        )}

        {tab === 'tools' && (
          <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
            <Card>
              <Text style={{ color: th.text, fontWeight: '700', marginBottom: 8 }}>Grant access</Text>
              <Field label="User email" value={gEmail} onChangeText={setGEmail} autoCapitalize="none" keyboardType="email-address" />
              <Field label="Days to add (negative removes)" value={gDays} onChangeText={setGDays} keyboardType="numbers-and-punctuation" />
              <Btn label="Grant access" onPress={grant} busy={busy} disabled={!/^\S+@\S+\.\S+$/.test(gEmail.trim()) || !Number(gDays)} />
              {!!msg && <View style={{ marginTop: 10 }}><Dim>{msg}</Dim></View>}
            </Card>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}
