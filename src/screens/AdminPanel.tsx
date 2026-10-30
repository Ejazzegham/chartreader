import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, FlatList, TextInput, ScrollView, KeyboardAvoidingView } from 'react-native';
import Modal from '../Modal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../store';
import { Card, Field, Dim, Btn, Segment, Icon, Badge, StatTile } from '../ui';
import { adminStats, adminGrant, saveServerKey, adminPayDecide, adminChats, adminChat, adminChatReply, uploadChatMedia, AdminStats, AdminUser, AdminPay, ChatThread, ChatMsg } from '../license';
import { useChatTr, TrBar, TrCompose, TR_LANGS, itemKey } from '../ChatTranslate';
import { Avatar, Bubble, Composer, DayDivider, dayKey, useAttach } from '../ChatUI';

const date = (ms: number) => (ms ? new Date(ms).toLocaleDateString() : '-');
const dateTime = (ms: number) => (ms ? new Date(ms).toLocaleString() : '-');

type Tab = 'overview' | 'subs' | 'pays' | 'chats' | 'tools' | 'setup';

const when = (at: number) => { const d = new Date(at), n = new Date(); return d.toDateString() === n.toDateString() ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString(); };

// One payment claim. A claim waiting for review has Approve / Reject; days are filled from the amount found on the blockchain and can be changed.
// (Top-level components, not declared inside AdminPanel: a component declared inside render is rebuilt on every refresh and the fields would lose focus.)
function PayCard({ p, token, onDone }: { p: AdminPay; token: string; onDone: () => void }) {
  const { th } = useApp();
  const [days, setDays] = useState(p.suggest ? String(p.suggest) : p.plan === 'weekly' ? '7' : '30');
  const [note, setNote] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const col = p.status === 'approved' ? th.buy : p.status === 'rejected' ? th.sell : th.gold;
  const decide = async (action: 'approve' | 'reject') => {
    setBusy(true); setErr('');
    try { await adminPayDecide(token, p.txid, action, action === 'approve' ? Number(days) : undefined, action === 'reject' ? note.trim() : undefined); onDone(); }
    catch (e: any) { setErr(e?.message ?? 'Error'); }
    setBusy(false);
  };
  return (
    <Card style={{ marginBottom: 8, padding: 12, borderColor: p.status === 'review' ? th.gold + '88' : th.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text selectable style={{ color: th.text, flex: 1, fontWeight: '700' }} numberOfLines={1}>{p.email}</Text>
        <Badge label={p.status === 'review' ? 'TO REVIEW' : p.status.toUpperCase()} color={col} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 6 }}>
        <Text style={{ color: th.buy, fontWeight: '800' }}>{p.usd ? `$${p.usd}` : 'amount unknown'}</Text>
        <Badge label={p.network} />
        {!!p.plan && <Text style={{ color: th.dim, fontSize: 12 }}>chose {p.plan}</Text>}
        {p.status === 'approved' && !!p.days && <Text style={{ color: th.dim, fontSize: 12 }}>{p.days} days</Text>}
        <Text style={{ color: th.dim, fontSize: 12 }}>{dateTime(p.at)}</Text>
      </View>
      {!!p.wallet && <Text selectable style={{ color: th.dim, fontSize: 11, marginTop: 6 }}>From wallet: {p.wallet}</Text>}
      <Text selectable style={{ color: th.dim, fontSize: 11, marginTop: 4 }}>TxID: {p.txid}</Text>
      {p.status === 'review' && <Text style={{ color: p.verified ? th.buy : th.gold, fontSize: 12, fontWeight: '700', marginTop: 6 }}>{p.verified ? 'Found on the blockchain: sent to us from this wallet.' : 'NOT verified on the blockchain (the lookup was not possible). Check the TxID in an explorer before approving.'}</Text>}
      {p.status === 'rejected' && !!p.note && <Text style={{ color: th.sell, fontSize: 12, marginTop: 6 }}>{p.note}</Text>}
      {p.status === 'review' && (
        <View style={{ marginTop: 10, gap: 8 }}>
          <Field label="Days to give" value={days} onChangeText={setDays} keyboardType="number-pad" />
          <Btn icon="checkmark-circle-outline" label="Approve and give access" onPress={() => decide('approve')} busy={busy} disabled={!(Number(days) >= 1)} />
          <Field label="Reason if you reject (the user sees it)" value={note} onChangeText={setNote} />
          <Btn ghost danger icon="close-circle-outline" label="Reject" onPress={() => decide('reject')} busy={busy} />
          {!!err && <Text style={{ color: th.sell, fontSize: 12.5 }}>{err}</Text>}
        </View>
      )}
    </Card>
  );
}

// One conversation: the messages of a user (or of an email sender with no account) and the reply box.
function ChatView({ k, token, onBack, onChanged }: { k: string; token: string; onBack: () => void; onChanged: () => void }) {
  const { th, settings } = useApp();
  const [info, setInfo] = useState<{ email: string; name: string; phone: string; guest: boolean } | null>(null);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [text, setText] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState(''), [upl, setUpl] = useState(false);
  const att = useAttach(setErr); // photo / video button
  // Translation: the person's messages are shown in your language; your reply can be translated into THEIR language (found from what they wrote) before you send it.
  const tr = useChatTr(token, msgs, 'user', settings.lang), [outPick, setOutPick] = useState('');
  let detected = ''; for (let i = msgs.length - 1; i >= 0 && !detected; i--) { const it = msgs[i].from === 'user' ? tr.items[itemKey(msgs[i].id, tr.prefs.to)] : undefined; if (it && it.s === 'done' && it.from) detected = TR_LANGS.find((l) => l[1].toLowerCase() === (it.from as string).toLowerCase())?.[0] ?? ''; }
  const out = outPick || detected || tr.prefs.out;
  const sc = useRef<any>(null);
  const pull = useCallback(async () => {
    try { const r = await adminChat(token, k); setInfo({ email: r.email, name: r.name, phone: r.phone, guest: r.guest }); setMsgs(r.msgs); onChanged(); } catch (e: any) { setErr(e?.message ?? 'Error'); }
  }, [token, k]);
  useEffect(() => { pull(); const i = setInterval(pull, 6000); return () => clearInterval(i); }, [pull]);
  useEffect(() => { setTimeout(() => sc.current?.scrollToEnd({ animated: true }), 60); }, [msgs.length]);
  const send = async () => {
    const x = text.trim(); if ((!x && !att.pending) || busy) return;
    setBusy(true); setErr('');
    try {
      let mid = att.pending?.id ?? '';
      if (att.pending && !mid) { setUpl(true); mid = (await uploadChatMedia(token, att.pending.uri)).id; att.setPending({ ...att.pending, id: mid }); setUpl(false); } // uploaded once; a failed send does not upload it again
      await adminChatReply(token, k, x, mid); setText(''); att.clear(); await pull();
    } catch (e: any) { setErr(e?.message ?? 'Error'); }
    setUpl(false); setBusy(false);
  };
  const who = info?.name || info?.email || '...';
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: th.hair }}>
        <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: th.panel2, alignItems: 'center', justifyContent: 'center' }}><Icon name="arrow-back" size={21} color={th.accent} /></Pressable>
        <Avatar label={who} size={42} />
        <View style={{ flex: 1 }}>
          <Text selectable style={{ color: th.text, fontWeight: '900', fontSize: 15.5 }} numberOfLines={1}>{info?.name || info?.email || '...'}</Text>
          <Text selectable style={{ color: th.dim, fontSize: 12 }} numberOfLines={1}>{info?.name ? info.email : ''}{info?.phone ? `${info?.name ? ' · ' : ''}${info.phone}` : ''}</Text>
        </View>
      </View>
      {info?.guest && <Text style={{ color: th.gold, fontSize: 12.5, paddingHorizontal: 16, paddingTop: 8 }}>No account in the app: this came by email. Reply by email.</Text>}
      <View style={{ paddingHorizontal: 12, paddingVertical: 8 }}><TrBar tr={tr} /></View>
      <ScrollView ref={sc} contentContainerStyle={{ padding: 14, gap: 8 }} keyboardShouldPersistTaps="handled">
        {msgs.map((m, i) => (
          <React.Fragment key={m.id}>
            {(i === 0 || dayKey(m.at) !== dayKey(msgs[i - 1].at)) && <DayDivider at={m.at} />}
            <Bubble m={m} mine={m.from === 'admin'} tr={tr} />
          </React.Fragment>
        ))}
      </ScrollView>
      {!!err && <Text style={{ color: th.sell, fontSize: 12.5, lineHeight: 18, paddingHorizontal: 16, paddingVertical: 6, backgroundColor: th.solid }}>{err}</Text>}
      {!info?.guest && (
        <Composer top={<TrCompose token={token} text={text} setText={setText} out={out} setOut={setOutPick} />}
          text={text} setText={setText} placeholder="Write a reply..." busy={busy} busyLabel={upl ? 'Uploading...' : 'Sending...'}
          pending={att.pending} onAttach={att.open} onClear={att.clear} onSend={send} />
      )}
      {att.sheet}
    </KeyboardAvoidingView>
  );
}

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
  const [threads, setThreads] = useState<ChatThread[]>([]), [openKey, setOpenKey] = useState(''), [pfilter, setPfilter] = useState<'all' | 'review' | 'approved' | 'rejected'>('review');

  const fetchAll = useCallback(async () => {
    setStats(await adminStats(lic.token));
    try { setThreads((await adminChats(lic.token)).threads); } catch {}
  }, [lic.token]);
  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try { await fetchAll(); } catch (e: any) { setErr(e.message ?? 'Error'); }
    setLoading(false);
  }, [fetchAll]);

  useEffect(() => { if (visible && lic.admin) load(); }, [visible, lic.admin, load]);
  useEffect(() => { // new payments and messages show up by themselves
    if (!visible || !lic.admin) return;
    const i = setInterval(() => { fetchAll().catch(() => {}); }, 15000);
    return () => clearInterval(i);
  }, [visible, lic.admin, fetchAll]);

  const users = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (stats?.list ?? []).filter((u) => (filter === 'all' || u.status === filter) && (!s || u.email.toLowerCase().includes(s)));
  }, [stats, q, filter]);

  const pays = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (stats?.pays ?? []).filter((p) => (pfilter === 'all' || p.status === pfilter) && (!s || p.email.toLowerCase().includes(s) || p.txid.toLowerCase().includes(s) || (p.wallet || '').toLowerCase().includes(s)));
  }, [stats, q, pfilter]);

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

  const tabs = (
    <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
      <Segment value={tab} onChange={(k) => { setTab(k as Tab); setQ(''); setOpenKey(''); }} options={[
        { k: 'overview', label: 'Stats' },
        { k: 'subs', label: 'Users' },
        { k: 'pays', label: stats?.pending ? `Pay ${stats.pending}` : 'Pay' },
        { k: 'chats', label: stats?.chats ? `Chats ${stats.chats}` : 'Chats' },
        { k: 'tools', label: 'Grant' },
        { k: 'setup', label: 'Setup' },
      ]} />
    </View>
  );

  const search = (
    <View style={{ paddingHorizontal: 16, paddingBottom: 8, gap: 8 }}>
      <TextInput value={q} onChangeText={setQ} placeholder="Search email…" placeholderTextColor={th.dim} autoCapitalize="none" autoCorrect={false}
        style={{ backgroundColor: th.panel, borderColor: th.line, borderWidth: 1, borderRadius: 8, color: th.text, padding: 12 }} />
      {tab === 'pays' && (
        <Segment value={pfilter} onChange={(k) => setPfilter(k as any)} options={[
          { k: 'review', label: 'To review' }, { k: 'approved', label: 'Approved' }, { k: 'rejected', label: 'Rejected' }, { k: 'all', label: 'All' },
        ]} />
      )}
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
                  <StatTile label="To review" value={String(stats.pending)} color={stats.pending ? th.gold : undefined} icon="hourglass-outline" />
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <StatTile label="New messages" value={String(stats.chats)} color={stats.chats ? th.sell : undefined} icon="chatbubbles-outline" />
                </View>
                <Card>
                  <Dim>{stats.keySet ? 'Analysis key: set' : 'Analysis key: NOT set (analysis is off for everyone)'}{stats.model ? ` · model ${stats.model}` : ''}</Dim>
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
            <FlatList data={pays} keyExtractor={(p) => p.txid + p.status} renderItem={({ item }) => <PayCard p={item} token={lic.token} onDone={load} />} ListEmptyComponent={empty}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} refreshing={loading} onRefresh={load} />
          </>
        )}

        {tab === 'chats' && (openKey ? (
          <ChatView k={openKey} token={lic.token} onBack={() => { setOpenKey(''); load(); }} onChanged={() => { fetchAll().catch(() => {}); }} />
        ) : (
          <FlatList data={threads} keyExtractor={(x) => x.key} refreshing={loading} onRefresh={load} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
            ListEmptyComponent={<Text style={{ color: th.dim, textAlign: 'center', marginTop: 30 }}>{loading ? 'Loading...' : 'No messages yet. When a user writes in the app or emails the support address, it appears here.'}</Text>}
            renderItem={({ item }) => (
              <Pressable onPress={() => setOpenKey(item.key)}>
                <Card style={{ marginBottom: 8, padding: 12, borderColor: item.unread ? th.accent + '99' : th.line }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Avatar label={item.name || item.email} size={44} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ color: th.text, flex: 1, fontWeight: item.unread ? '900' : '700', fontSize: 14.5 }} numberOfLines={1}>{item.name || item.email}</Text>
                        <Text style={{ color: item.unread ? th.accent : th.dim, fontSize: 11, fontWeight: '700' }}>{when(item.last.at)}</Text>
                      </View>
                      {!!item.name && <Text style={{ color: th.dim, fontSize: 11.5 }} numberOfLines={1}>{item.email}</Text>}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
                        <Text style={{ color: item.unread ? th.text : th.dim, fontSize: 13, flex: 1 }} numberOfLines={1}>{item.last.from === 'admin' ? 'You: ' : ''}{item.last.text}</Text>
                        {item.guest && <Badge label="EMAIL ONLY" color={th.gold} />}
                        {item.unread > 0 && <Badge label={`${item.unread} NEW`} color={th.sell} />}
                      </View>
                    </View>
                  </View>
                </Card>
              </Pressable>
            )} />
        ))}

        {tab === 'setup' && (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
            <Card>
              <Text style={{ color: th.text, fontWeight: '700', marginBottom: 4 }}>Analysis key</Text>
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
