import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Linking, StatusBar } from 'react-native';
import Modal from './Modal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from './store';
import { Icon } from './ui';
import { SUPPORT_EMAIL, supportPull, supportSend, supportRead, uploadChatMedia, isNetworkError, ChatMsg } from './license';
import { loadOutbox, enqueue, flushOutbox, Queued } from './chatOutbox';
import { useChatTr, TrBar, TrCompose } from './ChatTranslate';
import { Bubble, Composer, DayDivider, dayKey, useAttach } from './ChatUI';

// The Help screen: chat with the admin + the support email. It is mounted outside the locked / unlocked branches (App.tsx),
// so it opens from the lock page after the trial ended, too. Replies from the admin arrive here and as a notification.

export default function Help() {
  const { th, t, rtl, helpOpen, setHelpOpen, setSupportUnread, covered, lic, live, settings } = useApp();
  const insets = useSafeAreaInsets();
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [text, setText] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState(''), [offline, setOffline] = useState(false), [upl, setUpl] = useState(false), [queued, setQueued] = useState<Queued[]>([]); // queued: written while the server was off, sent by themselves later
  const att = useAttach(setErr); // photo / video button
  const since = useRef(0), scroller = useRef<any>(null);
  const tr = useChatTr(lic.token, msgs, 'admin', settings.lang); // translate the admin's answers into the user's language; the user's own words into the admin's before sending

  const load = useCallback(async () => {
    if (!lic.token) { setOffline(true); return; } // no session yet (the server was off at sign-up): messages can still be written, they wait in the outbox
    try {
      if ((await loadOutbox()).length) { await flushOutbox(lic.token); setQueued(await loadOutbox()); } // messages written while the server was off go first, in order
      const r = await supportPull(lic.token, since.current); setOffline(false);
      if (r.msgs.length) {
        since.current = Math.max(since.current, ...r.msgs.map((m) => m.id));
        setMsgs((cur) => { const have = new Set(cur.map((m) => m.id)); return [...cur, ...r.msgs.filter((m) => !have.has(m.id))]; });
      }
      if (r.unread > 0 || r.msgs.length) { supportRead(lic.token).catch(() => {}); }
      setSupportUnread(0);
    } catch { setOffline(true); }
  }, [lic.token]);

  useEffect(() => {
    if (!helpOpen) return;
    loadOutbox().then(setQueued);
    load(); const i = setInterval(load, 5000);
    return () => clearInterval(i);
  }, [helpOpen, load]);
  useEffect(() => { setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 60); }, [msgs.length, helpOpen]);

  const send = async () => {
    const x = text.trim(); if ((!x && !att.pending) || busy) return;
    setBusy(true); setErr('');
    // No server session (the server is off): text goes to the outbox and is sent by itself later. A photo / video needs the server.
    if (!lic.token) {
      if (att.pending) { setErr(t('chNeedServerMedia')); setBusy(false); return; }
      setQueued(await enqueue(x)); setText(''); setBusy(false); return;
    }
    try {
      let mid = att.pending?.id ?? '';
      if (att.pending && !mid) { setUpl(true); mid = (await uploadChatMedia(lic.token, att.pending.uri)).id; att.setPending({ ...att.pending, id: mid }); setUpl(false); } // uploaded once; a failed send does not upload it again
      const r = await supportSend(lic.token, x, mid); setText(''); att.clear(); since.current = Math.max(since.current, r.message.id); setMsgs((cur) => (cur.some((m) => m.id === r.message.id) ? cur : [...cur, r.message]));
    } catch (e: any) {
      // The server went away while sending a plain text message: keep it, it will be sent when the server is back.
      if (isNetworkError(e) && !att.pending) { setQueued(await enqueue(x)); setText(''); setOffline(true); }
      else setErr(e?.message ?? 'Error');
    }
    setUpl(false); setBusy(false);
  };
  const mail = () => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Chart Reader support')}`).catch(() => setErr(`${t('helpNoMail')} ${SUPPORT_EMAIL}`));
  const close = () => setHelpOpen(false);
  const quick = [t('helpQ1'), t('helpQ2'), t('helpQ3')];

  return (
    <Modal visible={helpOpen && !covered} animationType="slide" onRequestClose={close} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: th.bg, direction: rtl ? 'rtl' : 'ltr' }} behavior="padding">
        <View style={{ paddingTop: Math.max(insets.top, StatusBar.currentHeight ?? 0, 24) + 14, paddingBottom: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: th.line, backgroundColor: th.panel, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable onPress={close} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('thClose')} style={{ width: 38, height: 38, borderRadius: 8, borderWidth: 1, borderColor: th.line, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={rtl ? 'arrow-forward' : 'arrow-back'} size={20} color={th.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={{ color: th.text, fontSize: 18, fontWeight: '900' }} numberOfLines={1}>{t('helpTitle')}</Text>
            <Text style={{ color: th.dim, fontSize: 11.5 }} numberOfLines={1}>{t('helpSub')}</Text>
          </View>
        </View>

        <ScrollView ref={scroller} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 14, gap: 10 }}>
          {!live && (
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: th.gold + '14', borderColor: th.gold + '55', borderWidth: 1, borderRadius: 8, padding: 12 }}>
              <Icon name="lock-closed-outline" size={18} color={th.gold} /><Text style={{ flex: 1, color: th.text, fontSize: 13, lineHeight: 19 }}>{t('helpEnded')}</Text>
            </View>
          )}
          <View style={{ backgroundColor: th.panel, borderWidth: 1, borderColor: th.line, borderRadius: 8, padding: 12, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name="mail-outline" size={20} color={th.accent} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: th.dim, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 }}>{t('helpEmailTitle').toUpperCase()}</Text>
                <Text selectable style={{ color: th.text, fontSize: 14, fontWeight: '800', marginTop: 1 }}>{SUPPORT_EMAIL}</Text>
              </View>
              <Pressable onPress={mail} accessibilityRole="button" style={({ pressed }) => ({ paddingHorizontal: 12, height: 36, borderRadius: 8, backgroundColor: th.accent, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}>
                <Text style={{ color: th.onAccent, fontWeight: '800', fontSize: 12.5 }}>{t('helpEmailBtn')}</Text>
              </Pressable>
            </View>
            <Text style={{ color: th.dim, fontSize: 12, lineHeight: 17 }}>{t('helpEmailNote')}</Text>
          </View>

          {!!lic.token && <TrBar tr={tr} />}
          {offline && <Text style={{ color: th.sell, fontSize: 13, lineHeight: 19 }}>{t('helpNoServer')}</Text>}
          {!msgs.length && !offline && (
            <View style={{ alignItems: 'center', gap: 8, paddingVertical: 22, paddingHorizontal: 18 }}>
              <Icon name="chatbubbles-outline" size={34} color={th.accent} />
              <Text style={{ color: th.dim, fontSize: 13.5, lineHeight: 20, textAlign: 'center' }}>{t('helpEmpty')}</Text>
              <View style={{ gap: 8, alignSelf: 'stretch', marginTop: 6 }}>
                {quick.map((q) => (
                  <Pressable key={q} onPress={() => setText(q)} accessibilityRole="button" style={({ pressed }) => ({ borderWidth: 1, borderColor: th.line, backgroundColor: th.panel, borderRadius: 8, padding: 11, opacity: pressed ? 0.8 : 1 })}>
                    <Text style={{ color: th.text, fontSize: 13, fontWeight: '600' }}>{q}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          {msgs.map((m, i) => (
            <React.Fragment key={m.id}>
              {(i === 0 || dayKey(m.at) !== dayKey(msgs[i - 1].at)) && <DayDivider at={m.at} />}
              <Bubble m={m} mine={m.from === 'user'} tr={tr} sender={t('helpSupport')} />
            </React.Fragment>
          ))}
          {queued.map((q) => (
            <View key={q.qid} style={{ alignItems: 'flex-end', gap: 2 }}>
              <Bubble m={{ id: -1, from: 'user', text: q.text, at: q.at }} mine tr={tr} sender={t('helpSupport')} />
              <Text style={{ color: th.dim, fontSize: 11 }}>{t('chWaiting')}</Text>
            </View>
          ))}
        </ScrollView>

        {!!err && <Text style={{ color: th.sell, fontSize: 12.5, lineHeight: 18, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: th.solid }}>{err}</Text>}
        <Composer top={<TrCompose token={lic.token} text={text} setText={setText} out={tr.prefs.out} setOut={(c) => tr.setPrefs({ out: c })} />}
          text={text} setText={setText} placeholder={t('helpPlaceholder')} busy={busy} busyLabel={upl ? t('chUploading') : t('chSending')}
          pending={att.pending} onAttach={att.open} onClear={att.clear} onSend={send} />
        {att.sheet}
      </KeyboardAvoidingView>
    </Modal>
  );
}
