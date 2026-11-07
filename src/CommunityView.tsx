import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, Platform, Image, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useApp } from './store';
import { Icon } from './ui';
import { SYMBOLS } from './markets';
import { showAlert } from './dialog';
import * as C from './community';

// The Community: members discuss the markets, ask questions and share trade ideas. Light and dark themes, phone to wide monitor.
//   wide screens: the feed (composer, filters, posts) on the left and a side panel (numbers, trending pairs, top members, guidelines) on the right
//   narrow screens: one column. Same component on the website and in the phone app (the flags only show on the website).
// All rules (spam, limits, levels that must match the direction, reports) are enforced by the server: server/community.js.

function usePalC() {
  const { th } = useApp();
  const d = th.dark;
  return {
    th, dark: d, bg: d ? th.bg : '#F6F7F9', card: d ? th.panel : '#FFFFFF', alt: d ? th.panel2 : '#F6F8FB', border: d ? th.line : '#E2E5EB',
    head: d ? th.text : '#0F1B33', body: d ? th.dim : '#5B6577', blue: th.accent, brass: th.accent2, buy: th.buy, sell: th.sell,
    soft: th.accent + (d ? '26' : '14'), shadow: d ? '#000000' : '#0F1B33',
  };
}
const card = (P: ReturnType<typeof usePalC>, extra?: any) => ({ backgroundColor: P.card, borderRadius: 12, borderWidth: 1, borderColor: P.border, shadowColor: P.shadow, shadowOpacity: P.dark ? 0.3 : 0.035, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, ...extra });
const ptr: any = { cursor: 'pointer' };
const noOutline: any = Platform.OS === 'web' ? { outlineStyle: 'none' } : {};

function Avatar({ name, size = 38 }: { name: string; size?: number }) {
  const c = C.avatarColor(name);
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c + '22', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: c, fontWeight: '800', fontSize: size * 0.42 }}>{C.initialOf(name)}</Text></View>;
}
function Flag({ cc }: { cc: string }) {
  const [bad, setBad] = useState(false);
  if (Platform.OS !== 'web' || !cc || bad) return null;
  return <Image source={{ uri: '/flags/' + cc.toLowerCase() + '.svg' }} onError={() => setBad(true)} resizeMode="cover" style={{ width: 18, height: 12, borderRadius: 2, borderWidth: 1, borderColor: '#00000018' }} />;
}
function Tag({ text, color, icon }: { text: string; color: string; icon?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999, backgroundColor: color + '1F' }}>
      {icon ? <Icon name={icon} size={12} color={color} /> : null}
      <Text style={{ color, fontSize: 11, fontWeight: '700', letterSpacing: 0.2 }}>{text}</Text>
    </View>
  );
}
function Ghost({ icon, label, onPress, color, busy }: { icon: string; label?: string; onPress: () => void; color?: string; busy?: boolean }) {
  const P = usePalC();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={busy} style={((s: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 8, backgroundColor: s.hovered ? P.alt : 'transparent', opacity: busy ? 0.5 : 1, ...ptr })) as any}>
      <Icon name={icon} size={16} color={color || P.body} />
      {label ? <Text style={{ color: color || P.body, fontSize: 12.5, fontWeight: '600' }}>{label}</Text> : null}
    </Pressable>
  );
}
function Button({ label, onPress, ghost, disabled, busy, small }: { label: string; onPress: () => void; ghost?: boolean; disabled?: boolean; busy?: boolean; small?: boolean }) {
  const P = usePalC();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled || busy} style={((s: any) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: small ? 36 : 42, paddingHorizontal: small ? 14 : 20, borderRadius: 8, borderWidth: 1, borderColor: ghost ? P.border : P.blue, backgroundColor: ghost ? (s.hovered ? P.alt : 'transparent') : P.blue, opacity: disabled ? 0.45 : s.hovered ? 0.92 : 1, ...ptr })) as any}>
      {busy ? <ActivityIndicator size="small" color={ghost ? P.head : P.th.onAccent} /> : <Text style={{ color: ghost ? P.head : P.th.onAccent, fontSize: 13.5, fontWeight: '700' }}>{label}</Text>}
    </Pressable>
  );
}
function Field(props: any) {
  const P = usePalC();
  return <TextInput placeholderTextColor={P.body + 'AA'} {...props} style={[{ backgroundColor: P.alt, borderWidth: 1, borderColor: P.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: P.head, fontSize: 14, ...noOutline }, props.style]} />;
}

// ---------- a shared trade idea
function AnalysisCard({ a, symbol }: { a: C.CAnalysis; symbol: C.CSymbol | null }) {
  const P = usePalC(), buy = a.side === 'buy', col = buy ? P.buy : P.sell;
  const rows: { k: string; v: number; c: string; r?: number }[] = [{ k: 'Entry', v: a.entry, c: P.head }, { k: 'Stop loss', v: a.sl, c: P.sell }, ...a.tps.map((t, i) => ({ k: 'Take profit ' + (i + 1), v: t, c: P.buy, r: C.rr(a, t) }))];
  return (
    <View style={{ borderWidth: 1, borderColor: P.border, borderRadius: 12, backgroundColor: P.alt, overflow: 'hidden' }}>
      <View style={{ height: 3, backgroundColor: col }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: 12, paddingBottom: 8 }}>
        <Icon name="stats-chart" size={16} color={P.blue} />
        <Text style={{ color: P.head, fontSize: 14.5, fontWeight: '800' }}>{symbol?.name || 'Trade idea'}</Text>
        <View style={{ paddingVertical: 2, paddingHorizontal: 9, borderRadius: 6, backgroundColor: col }}><Text style={{ color: '#FFFFFF', fontSize: 11.5, fontWeight: '800', letterSpacing: 0.6 }}>{buy ? 'BUY' : 'SELL'}</Text></View>
        {a.tf ? <Tag text={a.tf} color={P.body} /> : null}
        {a.grade ? <Tag text={'Grade ' + a.grade} color={P.brass} /> : null}
        {a.source ? <Tag text={a.source} color={P.blue} /> : null}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12, paddingTop: 4 }}>
        {rows.map((r) => (
          <View key={r.k} style={{ flexGrow: 1, flexBasis: 120, minWidth: 110, backgroundColor: P.card, borderRadius: 8, borderWidth: 1, borderColor: P.border, paddingVertical: 8, paddingHorizontal: 10 }}>
            <Text style={{ color: P.body, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.5 }}>{r.k.toUpperCase()}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
              <Text style={{ color: r.c, fontSize: 15, fontWeight: '800' }}>{C.fmtLevel(r.v, a.dec)}</Text>
              {r.r ? <Text style={{ color: P.body, fontSize: 11, fontWeight: '600' }}>{r.r.toFixed(1)}R</Text> : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ---------- comments under a post
function Thread({ post, token, me, onCount, flash }: { post: C.CPost; token: string; me: C.CFeed['me'] | null; onCount: (n: number) => void; flash: (m: string, k?: 'ok' | 'err') => void }) {
  const P = usePalC();
  const [list, setList] = useState<C.CComment[] | null>(null);
  const [draft, setDraft] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { let on = true; C.commComments(token, post.id).then((r) => on && setList(r.comments)).catch((e) => { if (on) { setList([]); flash(e.message, 'err'); } }); return () => { on = false; }; }, [post.id]);
  const send = async () => {
    const body = draft.trim(); if (body.length < 2 || busy) return; setBusy(true);
    try { const r = await C.commComment(token, post.id, body); setList((l) => [...(l || []), r.comment]); setDraft(''); onCount(r.comments); } catch (e: any) { flash(e.message, 'err'); }
    setBusy(false);
  };
  const like = async (c: C.CComment) => {
    if (c.mine) return; const was = c.liked;
    setList((l) => (l || []).map((x) => (x.id === c.id ? { ...x, liked: !was, likes: x.likes + (was ? -1 : 1) } : x)));
    try { const r = await C.commLike(token, 'comment', c.id); setList((l) => (l || []).map((x) => (x.id === c.id ? { ...x, liked: r.liked, likes: r.likes } : x))); }
    catch (e: any) { setList((l) => (l || []).map((x) => (x.id === c.id ? c : x))); flash(e.message, 'err'); }
  };
  const del = (c: C.CComment) => showAlert('Delete this comment?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { try { const r = await C.commCommentDelete(token, c.id); setList((l) => (l || []).filter((x) => x.id !== c.id)); onCount(r.comments); } catch (e: any) { flash(e.message, 'err'); } } }]);
  const report = (c: C.CComment) => showAlert('Report this comment?', 'Our moderators will review it.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Report', style: 'destructive', onPress: async () => { try { await C.commReport(token, 'comment', c.id); flash('Thank you. Our moderators will review it.'); } catch (e: any) { flash(e.message, 'err'); } } }]);
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: P.border, paddingTop: 12, gap: 12 }}>
      {list === null ? <ActivityIndicator color={P.blue} /> : list.length === 0 ? <Text style={{ color: P.body, fontSize: 13 }}>No comments yet. Start the conversation.</Text> : list.map((c) => (
        <View key={c.id} style={{ flexDirection: 'row', gap: 10, opacity: c.hidden ? 0.55 : 1 }}>
          <Avatar name={c.author.name} size={30} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ backgroundColor: P.alt, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                <Text style={{ color: P.head, fontSize: 13, fontWeight: '700' }}>{c.author.name}</Text>
                <Flag cc={c.author.cc} />
                {c.author.role === 'admin' ? <Tag text="Team" color={P.brass} icon="shield-checkmark" /> : null}
                <Text style={{ color: P.body, fontSize: 11.5 }}>{C.ago(c.created)}</Text>
                {c.hidden ? <Tag text={`Hidden · ${c.reports} reports`} color={P.sell} /> : null}
              </View>
              <Text selectable style={{ color: P.head, fontSize: 13.5, lineHeight: 20, marginTop: 3 }}>{c.body}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 2, marginTop: 2, alignItems: 'center' }}>
              <Ghost icon={c.liked ? 'heart' : 'heart-outline'} color={c.liked ? P.sell : undefined} label={c.likes ? String(c.likes) : c.mine ? undefined : 'Like'} onPress={() => like(c)} busy={c.mine} />
              {c.mine || me?.admin ? <Ghost icon="trash-outline" label="Delete" onPress={() => del(c)} /> : <Ghost icon="flag-outline" label="Report" onPress={() => report(c)} />}
            </View>
          </View>
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
        <Avatar name={me?.name || '?'} size={30} />
        <Field value={draft} onChangeText={setDraft} placeholder="Write a comment…" multiline maxLength={1000} style={{ flex: 1, minHeight: 40, maxHeight: 120 }} onSubmitEditing={send} />
        <Button label="Send" small onPress={send} disabled={draft.trim().length < 2} busy={busy} />
      </View>
    </View>
  );
}

// ---------- one post
function PostCard({ post, token, me, onChange, onGone, flash, onSymbol }: { post: C.CPost; token: string; me: C.CFeed['me'] | null; onChange: (p: C.CPost) => void; onGone: (id: number) => void; flash: (m: string, k?: 'ok' | 'err') => void; onSymbol: (id: string) => void }) {
  const P = usePalC();
  const [open, setOpen] = useState(false), [full, setFull] = useState(false), [editing, setEditing] = useState(false);
  const [eTitle, setETitle] = useState(post.title), [eBody, setEBody] = useState(post.body), [busy, setBusy] = useState(false);
  const long = post.body.length > 340, shown = full || !long ? post.body : post.body.slice(0, 340).trimEnd() + '…';
  const like = async () => {
    if (post.mine) return; const was = post.liked;
    onChange({ ...post, liked: !was, likes: post.likes + (was ? -1 : 1) });
    try { const r = await C.commLike(token, 'post', post.id); onChange({ ...post, liked: r.liked, likes: r.likes }); } catch (e: any) { onChange(post); flash(e.message, 'err'); }
  };
  const del = () => showAlert('Delete this post?', 'The post and its comments will be removed for good.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { try { await C.commDelete(token, post.id); onGone(post.id); flash('Post deleted.'); } catch (e: any) { flash(e.message, 'err'); } } }]);
  const report = () => showAlert('Report this post?', 'Our moderators will review it. Three reports hide it until they decide.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Report', style: 'destructive', onPress: async () => { try { await C.commReport(token, 'post', post.id); flash('Thank you. Our moderators will review it.'); } catch (e: any) { flash(e.message, 'err'); } } }]);
  const pin = async () => { try { const r = await C.commPin(token, post.id, !post.pinned); onChange({ ...post, ...r.post }); } catch (e: any) { flash(e.message, 'err'); } };
  const hide = async () => { try { await C.commHide(token, 'post', post.id, !post.hidden); onChange({ ...post, hidden: !post.hidden, reports: post.hidden ? 0 : post.reports }); } catch (e: any) { flash(e.message, 'err'); } };
  const save = async () => { setBusy(true); try { const r = await C.commEdit(token, post.id, eTitle, eBody); onChange({ ...post, ...r.post }); setEditing(false); } catch (e: any) { flash(e.message, 'err'); } setBusy(false); };
  return (
    <View style={card(P, { padding: 16, gap: 12, opacity: post.hidden ? 0.75 : 1, borderColor: post.pinned ? P.brass + '88' : P.border })}>
      {post.hidden ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: P.sell + '18', borderRadius: 8, padding: 10 }}>
          <Icon name="eye-off-outline" size={16} color={P.sell} />
          <Text style={{ flex: 1, color: P.sell, fontSize: 12.5, fontWeight: '600' }}>Hidden after {post.reports} reports. Only moderators can see this post.</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
        <Avatar name={post.author.name} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <Text style={{ color: P.head, fontSize: 14.5, fontWeight: '800' }}>{post.author.name}</Text>
            <Flag cc={post.author.cc} />
            {post.author.role === 'admin' ? <Tag text="Team" color={P.brass} icon="shield-checkmark" /> : null}
          </View>
          <Text style={{ color: P.body, fontSize: 12, marginTop: 1 }}>{C.ago(post.created)}{post.edited ? ' · edited' : ''}</Text>
        </View>
        {post.pinned ? <Tag text="Pinned" color={P.brass} icon="pin" /> : null}
        <Tag text={C.KIND_LABEL[post.kind]} color={C.KIND_COLOR[post.kind]} icon={C.KIND_ICON[post.kind]} />
      </View>

      {editing ? (
        <View style={{ gap: 8 }}>
          <Field value={eTitle} onChangeText={setETitle} maxLength={120} />
          <Field value={eBody} onChangeText={setEBody} multiline maxLength={3000} style={{ minHeight: 110, textAlignVertical: 'top' }} />
          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}><Button ghost small label="Cancel" onPress={() => { setEditing(false); setETitle(post.title); setEBody(post.body); }} /><Button small label="Save" onPress={save} busy={busy} /></View>
        </View>
      ) : (
        <View style={{ gap: 7 }}>
          <Text selectable style={{ color: P.head, fontSize: 16.5, fontWeight: '800', lineHeight: 23, letterSpacing: -0.2 }}>{post.title}</Text>
          {post.symbol ? (
            <Pressable onPress={() => onSymbol(post.symbol!.id)} accessibilityRole="button" style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999, backgroundColor: P.soft, ...ptr } as any}>
              <Icon name="pricetag" size={12} color={P.blue} /><Text style={{ color: P.blue, fontSize: 12, fontWeight: '700' }}>{post.symbol.name}</Text>
            </Pressable>
          ) : null}
          {post.body ? <Text selectable style={{ color: P.head, opacity: 0.88, fontSize: 14, lineHeight: 21.5 }}>{shown}</Text> : null}
          {long ? <Pressable onPress={() => setFull(!full)} style={ptr}><Text style={{ color: P.blue, fontSize: 13, fontWeight: '700' }}>{full ? 'Show less' : 'Read more'}</Text></Pressable> : null}
        </View>
      )}

      {post.analysis ? <AnalysisCard a={post.analysis} symbol={post.symbol} /> : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 2, borderTopWidth: 1, borderTopColor: P.border, paddingTop: 8, marginHorizontal: -4 }}>
        <Ghost icon={post.liked ? 'heart' : 'heart-outline'} color={post.liked ? P.sell : undefined} label={post.likes ? String(post.likes) : post.mine ? '0' : 'Like'} onPress={like} busy={post.mine} />
        <Ghost icon={open ? 'chatbubble' : 'chatbubble-outline'} color={open ? P.blue : undefined} label={post.comments ? `${post.comments} ${post.comments === 1 ? 'comment' : 'comments'}` : 'Comment'} onPress={() => setOpen(!open)} />
        <View style={{ flex: 1 }} />
        {me?.admin ? <><Ghost icon={post.pinned ? 'pin' : 'pin-outline'} label={post.pinned ? 'Unpin' : 'Pin'} onPress={pin} /><Ghost icon={post.hidden ? 'eye-outline' : 'eye-off-outline'} label={post.hidden ? 'Restore' : 'Hide'} onPress={hide} /></> : null}
        {post.mine ? <Ghost icon="create-outline" label="Edit" onPress={() => setEditing(!editing)} /> : null}
        {post.mine || me?.admin ? <Ghost icon="trash-outline" label="Delete" onPress={del} /> : <Ghost icon="flag-outline" label="Report" onPress={report} />}
      </View>
      {open ? <Thread post={post} token={token} me={me} onCount={(n) => onChange({ ...post, comments: n })} flash={flash} /> : null}
    </View>
  );
}

// ---------- the composer
const TFS = ['1m', '5m', '15m', '30m', '1h', '4h', '1D'];
function SymbolPicker({ value, onChange }: { value: C.CSymbol | null; onChange: (s: C.CSymbol | null) => void }) {
  const P = usePalC();
  const [open, setOpen] = useState(false), [q, setQ] = useState('');
  const list = SYMBOLS.filter((s) => !q || (s.name + ' ' + s.id).toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  return (
    <View style={{ gap: 6 }}>
      <Pressable accessibilityRole="button" onPress={() => setOpen(!open)} style={{ flexDirection: 'row', alignItems: 'center', gap: 9, height: 42, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: P.border, backgroundColor: P.alt, ...ptr } as any}>
        <Icon name="pricetag-outline" size={16} color={P.blue} />
        <Text style={{ flex: 1, color: value ? P.head : P.body, fontSize: 14, fontWeight: value ? '700' : '400' }}>{value ? value.name : 'Pair (optional)'}</Text>
        {value ? <Pressable onPress={() => onChange(null)} hitSlop={8}><Icon name="close-circle" size={17} color={P.body} /></Pressable> : <Icon name="chevron-down" size={14} color={P.body} />}
      </Pressable>
      {open ? (
        <View style={{ borderWidth: 1, borderColor: P.border, borderRadius: 8, backgroundColor: P.card, padding: 6, gap: 4 }}>
          <Field value={q} onChangeText={setQ} placeholder="Search pair…" autoCapitalize="none" style={{ paddingVertical: 8 }} />
          {list.map((s) => <Pressable key={s.id} onPress={() => { onChange({ id: s.id, name: s.name }); setOpen(false); setQ(''); }} style={((st: any) => ({ paddingVertical: 8, paddingHorizontal: 10, borderRadius: 6, backgroundColor: st.hovered ? P.alt : 'transparent', ...ptr })) as any}><Text style={{ color: P.head, fontSize: 13.5 }}>{s.name}</Text></Pressable>)}
          {!list.length ? <Text style={{ color: P.body, fontSize: 13, padding: 8 }}>No pair found.</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

function Composer({ token, me, onPosted, flash, startKind, onClose }: { token: string; me: C.CFeed['me'] | null; onPosted: (p: C.CPost) => void; flash: (m: string, k?: 'ok' | 'err') => void; startKind: C.CKind; onClose: () => void }) {
  const P = usePalC();
  const { signals } = useApp();
  const [kind, setKind] = useState<C.CKind>(startKind);
  const [title, setTitle] = useState(''), [body, setBody] = useState(''), [sym, setSym] = useState<C.CSymbol | null>(null);
  const [side, setSide] = useState<'buy' | 'sell'>('buy'), [lv, setLv] = useState({ entry: '', sl: '', tp1: '', tp2: '', tp3: '' }), [tf, setTf] = useState('15m');
  const [meta, setMeta] = useState<{ grade?: string; score?: number; source?: string }>({}), [busy, setBusy] = useState(false), [msg, setMsg] = useState('');
  const mine = (signals || []).slice().sort((a: any, b: any) => b.date - a.date).slice(0, 6);
  const pick = (s: any) => {
    setKind('analysis'); setSym({ id: s.symId, name: s.name }); setSide(s.side); setTf(s.tf || '15m');
    const d = (n: number) => Number(n).toFixed(s.dec ?? 5);
    setLv({ entry: d(s.entry), sl: d(s.sl), tp1: s.tps?.[0] != null ? d(s.tps[0]) : '', tp2: s.tps?.[1] != null ? d(s.tps[1]) : '', tp3: s.tps?.[2] != null ? d(s.tps[2]) : '' });
    setMeta({ grade: s.grade, score: s.score, source: s.source });
    if (!title.trim()) setTitle(`${s.name} ${s.side === 'buy' ? 'long' : 'short'} idea`);
  };
  const set = (k: string) => (v: string) => setLv((x) => ({ ...x, [k]: v.replace(',', '.') }));
  const submit = async () => {
    setMsg(''); setBusy(true);
    try {
      let analysis: any = null;
      const tps = [lv.tp1, lv.tp2, lv.tp3].filter((x) => x.trim() !== '');
      if (kind === 'analysis' && (lv.entry || lv.sl || tps.length)) {
        const dec = Math.min(8, Math.max(...[lv.entry, lv.sl, ...tps].map((x) => (x.split('.')[1] || '').length), 0));
        analysis = { side, entry: Number(lv.entry), sl: Number(lv.sl), tps: tps.map(Number), tf, dec, ...meta };
      }
      const r = await C.commPost(token, { kind, title, body, symbol: sym, analysis });
      onPosted(r.post); flash('Your post is live.');
    } catch (e: any) { setMsg(e.message || 'Could not post.'); }
    setBusy(false);
  };
  const KINDS: C.CKind[] = ['analysis', 'discussion', 'question'];
  return (
    <View style={card(P, { padding: 16, gap: 14 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
        <Avatar name={me?.name || '?'} />
        <View style={{ flex: 1 }}><Text style={{ color: P.head, fontSize: 14.5, fontWeight: '800' }}>{me?.name || 'You'}</Text><Text style={{ color: P.body, fontSize: 12 }}>Posting to the community</Text></View>
        <Pressable onPress={onClose} accessibilityLabel="Close" hitSlop={8} style={ptr}><Icon name="close" size={20} color={P.body} /></Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {KINDS.map((k) => { const on = kind === k, col = C.KIND_COLOR[k]; return (
          <Pressable key={k} onPress={() => setKind(k)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: on ? col : P.border, backgroundColor: on ? col + '1A' : 'transparent', ...ptr } as any}>
            <Icon name={C.KIND_ICON[k]} size={15} color={on ? col : P.body} /><Text style={{ color: on ? col : P.body, fontSize: 13, fontWeight: '700' }}>{C.KIND_LABEL[k]}</Text>
          </Pressable>); })}
      </View>
      <View style={{ gap: 4 }}>
        <Field value={title} onChangeText={setTitle} maxLength={120} placeholder={kind === 'analysis' ? 'Title, e.g. “Gold: sweep of Asia low, long idea”' : kind === 'question' ? 'Your question' : 'What is on your mind?'} style={{ fontWeight: '700', fontSize: 15 }} />
        <Text style={{ color: P.body, fontSize: 11, alignSelf: 'flex-end' }}>{title.length}/120</Text>
      </View>
      <View style={{ gap: 4 }}>
        <Field value={body} onChangeText={setBody} multiline maxLength={3000} placeholder={kind === 'analysis' ? 'Explain your reasoning: structure, liquidity, confirmation, what invalidates the idea…' : 'Write your post…'} style={{ minHeight: 120, textAlignVertical: 'top', lineHeight: 21 }} />
        <Text style={{ color: P.body, fontSize: 11, alignSelf: 'flex-end' }}>{body.length}/3000</Text>
      </View>
      <SymbolPicker value={sym} onChange={setSym} />
      {kind === 'analysis' ? (
        <View style={{ gap: 12, borderWidth: 1, borderColor: P.border, borderRadius: 12, padding: 12, backgroundColor: P.alt }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="trending-up" size={16} color={P.blue} /><Text style={{ color: P.head, fontSize: 13.5, fontWeight: '800' }}>Trade levels</Text><Text style={{ color: P.body, fontSize: 12 }}>(recommended)</Text></View>
          {mine.length ? (
            <View style={{ gap: 6 }}>
              <Text style={{ color: P.body, fontSize: 11.5, fontWeight: '700', letterSpacing: 0.4 }}>IMPORT FROM MY ANALYSES</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {mine.map((s: any) => <Pressable key={s.id} onPress={() => pick(s)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, backgroundColor: P.card, borderWidth: 1, borderColor: P.border, ...ptr } as any}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: s.side === 'buy' ? P.buy : P.sell }} /><Text style={{ color: P.head, fontSize: 12, fontWeight: '600' }}>{s.name} · {s.side === 'buy' ? 'BUY' : 'SELL'} · {s.tf}</Text></Pressable>)}
              </View>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['buy', 'sell'] as const).map((s) => { const on = side === s, col = s === 'buy' ? P.buy : P.sell; return <Pressable key={s} onPress={() => setSide(s)} accessibilityRole="button" style={{ flex: 1, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: on ? col : P.border, backgroundColor: on ? col : 'transparent', ...ptr } as any}><Text style={{ color: on ? '#FFFFFF' : P.body, fontWeight: '800', fontSize: 13.5, letterSpacing: 0.6 }}>{s === 'buy' ? 'BUY' : 'SELL'}</Text></Pressable>; })}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {([['entry', 'Entry'], ['sl', 'Stop loss'], ['tp1', 'Take profit 1'], ['tp2', 'TP 2 (optional)'], ['tp3', 'TP 3 (optional)']] as const).map(([k, l]) => (
              <View key={k} style={{ flexGrow: 1, flexBasis: 130, minWidth: 120, gap: 4 }}>
                <Text style={{ color: P.body, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 }}>{l.toUpperCase()}</Text>
                <Field value={(lv as any)[k]} onChangeText={set(k)} keyboardType="decimal-pad" placeholder="0.00" />
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {TFS.map((x) => <Pressable key={x} onPress={() => setTf(x)} accessibilityRole="button" style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: tf === x ? P.blue : P.card, borderWidth: 1, borderColor: tf === x ? P.blue : P.border, ...ptr } as any}><Text style={{ color: tf === x ? P.th.onAccent : P.body, fontSize: 12.5, fontWeight: '700' }}>{x}</Text></Pressable>)}
          </View>
        </View>
      ) : null}
      {msg ? <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: P.sell + '14', borderRadius: 8, padding: 10 }}><Icon name="alert-circle" size={16} color={P.sell} /><Text style={{ flex: 1, color: P.sell, fontSize: 13, fontWeight: '600', lineHeight: 18 }}>{msg}</Text></View> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Text style={{ flex: 1, minWidth: 200, color: P.body, fontSize: 11.5, lineHeight: 16 }}>Educational discussion only, not financial advice. No signal selling, groups or guaranteed profits.</Text>
        <Button ghost small label="Cancel" onPress={onClose} />
        <Button label="Post" onPress={submit} busy={busy} disabled={title.trim().length < 4} />
      </View>
    </View>
  );
}

// ---------- the page
export default function CommunityView({ tabIndex = 20 }: { tabIndex?: number }) {
  const P = usePalC();
  const { lic, tab } = useApp();
  const { width } = useWindowDimensions();
  const wide = width >= 1000, token = lic.token, active = tab === tabIndex;
  const [posts, setPosts] = useState<C.CPost[]>([]), [more, setMore] = useState(false);
  const [side, setSide] = useState<C.CFeed | null>(null);
  const [loading, setLoading] = useState(true), [err, setErr] = useState(''), [loaded, setLoaded] = useState(false);
  const [f, setF] = useState({ kind: '' as C.CKind | '', sort: 'new' as 'new' | 'top', symbol: '', mine: false }), [text, setText] = useState(''), [qd, setQd] = useState('');
  const [composer, setComposer] = useState<C.CKind | null>(null);
  const [note, setNote] = useState<{ m: string; k: 'ok' | 'err' } | null>(null);
  const postsRef = useRef<C.CPost[]>([]); postsRef.current = posts;
  const req = useRef(0), noteT = useRef<any>(null);

  const flash = useCallback((m: string, k: 'ok' | 'err' = 'ok') => { setNote({ m, k }); clearTimeout(noteT.current); noteT.current = setTimeout(() => setNote(null), 4500); }, []);
  useEffect(() => { const t = setTimeout(() => setQd(text), 400); return () => clearTimeout(t); }, [text]);

  const load = useCallback(async (reset: boolean) => {
    if (!token) return; const id = ++req.current; setLoading(true);
    try {
      const r = await C.commFeed(token, { kind: f.kind, sort: f.sort, symbol: f.symbol, q: qd, mine: f.mine, offset: reset ? 0 : postsRef.current.length, limit: 15 });
      if (id !== req.current) return;
      setErr(''); setLoaded(true);
      setPosts((prev) => (reset ? r.posts : [...prev, ...r.posts.filter((p) => !prev.some((x) => x.id === p.id))])); setMore(r.more);
      if (r.stats) setSide(r); else if (reset) setSide((s) => (s ? { ...s, me: r.me } : s));
    } catch (e: any) { if (id === req.current) setErr(e.message || 'Could not load the community.'); }
    if (id === req.current) setLoading(false);
  }, [token, f.kind, f.sort, f.symbol, f.mine, qd]);
  const loadRef = useRef(load); loadRef.current = load;
  useEffect(() => { if (active) load(true); }, [active, load]);
  useEffect(() => { if (!active) return; const t = setInterval(() => { if (postsRef.current.length <= 15) loadRef.current(true); }, 60000); return () => clearInterval(t); }, [active]); // new posts appear by themselves

  const me = side?.me || null;
  const upd = (p: C.CPost) => setPosts((l) => l.map((x) => (x.id === p.id ? p : x)));
  const gone = (id: number) => setPosts((l) => l.filter((x) => x.id !== id));
  const posted = (p: C.CPost) => { setComposer(null); if (!f.mine && !f.symbol && (!f.kind || f.kind === p.kind)) setPosts((l) => [p, ...l.filter((x) => x.id !== p.id)]); load(true); };
  const pill = (label: string, on: boolean, onPress: () => void, icon?: string) => (
    <Pressable key={label} onPress={onPress} accessibilityRole="button" style={((s: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 13, borderRadius: 999, backgroundColor: on ? P.blue : s.hovered ? P.alt : 'transparent', borderWidth: 1, borderColor: on ? P.blue : P.border, ...ptr })) as any}>
      {icon ? <Icon name={icon} size={14} color={on ? P.th.onAccent : P.body} /> : null}<Text style={{ color: on ? P.th.onAccent : P.body, fontSize: 13, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );

  const feedCol = (
    <View style={{ flex: wide ? 1 : undefined, minWidth: 0, width: wide ? undefined : '100%', gap: 14 }}>
      {note ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12, borderRadius: 10, backgroundColor: note.k === 'ok' ? P.buy + '1A' : P.sell + '16', borderWidth: 1, borderColor: note.k === 'ok' ? P.buy + '55' : P.sell + '55' }}><Icon name={note.k === 'ok' ? 'checkmark-circle' : 'alert-circle'} size={18} color={note.k === 'ok' ? P.buy : P.sell} /><Text style={{ flex: 1, color: P.head, fontSize: 13.5, fontWeight: '600' }}>{note.m}</Text></View> : null}

      {composer ? <Composer token={token} me={me} onPosted={posted} flash={flash} startKind={composer} onClose={() => setComposer(null)} /> : (
        <View style={card(P, { padding: 14, gap: 12 })}>
          <Pressable onPress={() => setComposer('discussion')} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, ...ptr } as any}>
            <Avatar name={me?.name || '?'} />
            <View style={{ flex: 1, height: 44, borderRadius: 22, borderWidth: 1, borderColor: P.border, backgroundColor: P.alt, justifyContent: 'center', paddingHorizontal: 16 }}><Text style={{ color: P.body, fontSize: 14 }} numberOfLines={1}>Share an idea, an analysis or a question…</Text></View>
          </Pressable>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(['analysis', 'discussion', 'question'] as C.CKind[]).map((k) => <Pressable key={k} onPress={() => setComposer(k)} accessibilityRole="button" style={((s: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 8, backgroundColor: s.hovered ? C.KIND_COLOR[k] + '22' : C.KIND_COLOR[k] + '12', ...ptr })) as any}><Icon name={C.KIND_ICON[k]} size={15} color={C.KIND_COLOR[k]} /><Text style={{ color: C.KIND_COLOR[k], fontSize: 12.5, fontWeight: '700' }}>{k === 'analysis' ? 'Share analysis' : k === 'question' ? 'Ask a question' : 'Start a discussion'}</Text></Pressable>)}
          </View>
        </View>
      )}

      <View style={card(P, { padding: 12, gap: 10, zIndex: 1 })}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          {pill('All', !f.kind && !f.mine, () => setF({ ...f, kind: '', mine: false }))}
          {(['analysis', 'discussion', 'question'] as C.CKind[]).map((k) => pill(k === 'question' ? 'Questions' : C.KIND_LABEL[k], f.kind === k, () => setF({ ...f, kind: f.kind === k ? '' : k, mine: false }), C.KIND_ICON[k]))}
          <View style={{ flex: 1 }} />
          {pill('My posts', f.mine, () => setF({ ...f, mine: !f.mine, kind: '' }), 'person')}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <View style={{ flex: 1, minWidth: 180, flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: P.border, backgroundColor: P.alt }}>
            <Icon name="search" size={16} color={P.body} />
            <TextInput value={text} onChangeText={setText} placeholder="Search posts…" placeholderTextColor={P.body + 'AA'} style={{ flex: 1, color: P.head, fontSize: 14, ...noOutline }} />
            {text ? <Pressable onPress={() => setText('')} hitSlop={8}><Icon name="close-circle" size={16} color={P.body} /></Pressable> : null}
          </View>
          {f.symbol ? <Pressable onPress={() => setF({ ...f, symbol: '' })} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: P.soft, ...ptr } as any}><Icon name="pricetag" size={13} color={P.blue} /><Text style={{ color: P.blue, fontSize: 12.5, fontWeight: '700' }}>{side?.trending?.find((t) => t.id === f.symbol)?.name || posts.find((p) => p.symbol?.id === f.symbol)?.symbol?.name || f.symbol}</Text><Icon name="close" size={13} color={P.blue} /></Pressable> : null}
          <View style={{ flexDirection: 'row', borderRadius: 8, borderWidth: 1, borderColor: P.border, overflow: 'hidden' }}>
            {(['new', 'top'] as const).map((s) => <Pressable key={s} onPress={() => setF({ ...f, sort: s })} accessibilityRole="button" style={{ paddingVertical: 9, paddingHorizontal: 14, backgroundColor: f.sort === s ? P.soft : 'transparent', ...ptr } as any}><Text style={{ color: f.sort === s ? P.blue : P.body, fontSize: 13, fontWeight: '700' }}>{s === 'new' ? 'Latest' : 'Top'}</Text></Pressable>)}
          </View>
        </View>
        {!wide && side?.trending?.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{side.trending.map((t) => <Pressable key={t.id} onPress={() => setF({ ...f, symbol: f.symbol === t.id ? '' : t.id })} accessibilityRole="button" style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: f.symbol === t.id ? P.blue : P.soft, ...ptr } as any}><Text style={{ color: f.symbol === t.id ? P.th.onAccent : P.blue, fontSize: 12, fontWeight: '700' }}>{t.name}</Text></Pressable>)}</View> : null}
      </View>

      {err && !posts.length ? (
        <View style={card(P, { padding: 22, alignItems: 'center', gap: 10 })}><Icon name="cloud-offline-outline" size={30} color={P.body} /><Text style={{ color: P.head, fontSize: 14.5, fontWeight: '700', textAlign: 'center' }}>{err}</Text><Button ghost small label="Try again" onPress={() => load(true)} /></View>
      ) : !loaded ? (
        [0, 1, 2].map((i) => <View key={i} style={card(P, { padding: 16, gap: 12 })}><View style={{ flexDirection: 'row', gap: 11, alignItems: 'center' }}><View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: P.alt }} /><View style={{ gap: 6 }}><View style={{ width: 120, height: 11, borderRadius: 6, backgroundColor: P.alt }} /><View style={{ width: 70, height: 9, borderRadius: 5, backgroundColor: P.alt }} /></View></View><View style={{ width: '70%', height: 14, borderRadius: 7, backgroundColor: P.alt }} /><View style={{ width: '95%', height: 10, borderRadius: 5, backgroundColor: P.alt }} /><View style={{ width: '60%', height: 10, borderRadius: 5, backgroundColor: P.alt }} /></View>)
      ) : posts.length === 0 ? (
        <View style={card(P, { padding: 30, alignItems: 'center', gap: 10 })}>
          <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: P.soft, alignItems: 'center', justifyContent: 'center' }}><Icon name="chatbubbles" size={26} color={P.blue} /></View>
          <Text style={{ color: P.head, fontSize: 16, fontWeight: '800' }}>{f.kind || f.symbol || qd || f.mine ? 'Nothing matches yet' : 'No posts yet'}</Text>
          <Text style={{ color: P.body, fontSize: 13.5, textAlign: 'center', lineHeight: 20, maxWidth: 380 }}>{f.kind || f.symbol || qd || f.mine ? 'Try another filter, or share the first post on this topic.' : 'Be the first to share a trade idea or start a discussion with other traders.'}</Text>
          <Button small label="Create a post" onPress={() => setComposer('discussion')} />
        </View>
      ) : (
        <>
          {posts.map((p) => <PostCard key={p.id} post={p} token={token} me={me} onChange={upd} onGone={gone} flash={flash} onSymbol={(id) => { setF({ ...f, symbol: id, mine: false }); }} />)}
          {more ? <View style={{ alignItems: 'center', paddingVertical: 4 }}><Button ghost label="Load more" onPress={() => load(false)} busy={loading} /></View> : null}
        </>
      )}
    </View>
  );

  const stat = (icon: string, color: string, v: number, l: string) => <View key={l} style={{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: 10, borderRadius: 10, backgroundColor: color + '14' }}><Icon name={icon} size={16} color={color} /><Text style={{ color: P.head, fontSize: 18, fontWeight: '800' }}>{v.toLocaleString('en-US')}</Text><Text style={{ color: P.body, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.4 }}>{l}</Text></View>;
  const sideCol = (
    <View style={{ width: 320, gap: 14 }}>
      <View style={card(P, { padding: 16, gap: 12 })}>
        <Text style={{ color: P.head, fontSize: 14.5, fontWeight: '800' }}>Community</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>{stat('document-text', '#2F6FED', side?.stats?.posts ?? 0, 'POSTS')}{stat('flash', '#D98A00', side?.stats?.today ?? 0, 'TODAY')}{stat('chatbubbles', '#7C4DDB', side?.stats?.comments ?? 0, 'COMMENTS')}</View>
      </View>
      {side?.trending?.length ? (
        <View style={card(P, { padding: 16, gap: 10 })}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="trending-up" size={16} color={P.blue} /><Text style={{ color: P.head, fontSize: 14.5, fontWeight: '800' }}>Trending pairs</Text></View>
          {side.trending.map((t, i) => (
            <Pressable key={t.id} onPress={() => setF({ ...f, symbol: f.symbol === t.id ? '' : t.id, mine: false })} accessibilityRole="button" style={((s: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingHorizontal: 6, borderRadius: 8, backgroundColor: f.symbol === t.id ? P.soft : s.hovered ? P.alt : 'transparent', ...ptr })) as any}>
              <Text style={{ width: 18, color: P.body, fontSize: 12, fontWeight: '800' }}>{i + 1}</Text>
              <Text style={{ flex: 1, color: P.head, fontSize: 13.5, fontWeight: '600' }} numberOfLines={1}>{t.name}</Text>
              <Text style={{ color: P.body, fontSize: 12 }}>{t.n} {t.n === 1 ? 'post' : 'posts'}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {side?.top?.length ? (
        <View style={card(P, { padding: 16, gap: 10 })}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="trophy" size={16} color={P.brass} /><Text style={{ color: P.head, fontSize: 14.5, fontWeight: '800' }}>Top contributors</Text></View>
          {side.top.map((m, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar name={m.name} size={32} />
              <View style={{ flex: 1, minWidth: 0 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Text style={{ color: P.head, fontSize: 13.5, fontWeight: '700' }} numberOfLines={1}>{m.name}</Text><Flag cc={m.cc} /></View><Text style={{ color: P.body, fontSize: 11.5 }}>{m.posts} {m.posts === 1 ? 'post' : 'posts'} · {m.likes} {m.likes === 1 ? 'like' : 'likes'}</Text></View>
              <Text style={{ color: P.brass, fontSize: 12, fontWeight: '800' }}>#{i + 1}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <View style={card(P, { padding: 16, gap: 9 })}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="shield-checkmark" size={16} color={P.buy} /><Text style={{ color: P.head, fontSize: 14.5, fontWeight: '800' }}>Community guidelines</Text></View>
        {['Be respectful. Disagree with ideas, not people.', 'Explain your reasoning. A trade idea without a why is not useful.', 'No signal selling, Telegram / WhatsApp groups or guaranteed profits.', 'Nothing here is financial advice. Manage your own risk.', 'Report posts that break these rules. Three reports hide a post for review.'].map((t, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 8 }}><Text style={{ color: P.blue, fontWeight: '800', fontSize: 12.5 }}>{i + 1}.</Text><Text style={{ flex: 1, color: P.body, fontSize: 12.5, lineHeight: 18 }}>{t}</Text></View>
        ))}
      </View>
    </View>
  );

  return <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: 'flex-start', gap: 20, width: '100%' }}>{feedCol}{wide ? sideCol : null}</View>;
}
