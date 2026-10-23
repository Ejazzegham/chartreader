import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, FlatList, Switch, StatusBar } from 'react-native';
import Modal from './Modal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from './store';
import { Icon } from './ui';
import { translateText, ChatMsg } from './license';

// Chat translation (Help screen for the user, Chats tab for the admin).
//  - every message has a "Translate" link; "Auto" translates the newest messages of the other side by itself
//  - "Translate to ..." above the message box turns what you typed into the other person's language BEFORE you send it, so you can check it
// The text goes to the server (/translate, see server/translate.js), which uses the Gemini key. The app never holds a key.

// [code, English name, own name]: the picker shows both so people find their language by either name.
export const TR_LANGS: [string, string, string][] = [
  ['en', 'English', 'English'], ['ur', 'Urdu', 'اردو'], ['ar', 'Arabic', 'العربية'], ['hi', 'Hindi', 'हिन्दी'], ['bn', 'Bengali', 'বাংলা'], ['pa', 'Punjabi', 'ਪੰਜਾਬੀ'],
  ['fa', 'Persian', 'فارسی'], ['ps', 'Pashto', 'پښتو'], ['tr', 'Turkish', 'Türkçe'], ['es', 'Spanish', 'Español'], ['fr', 'French', 'Français'], ['de', 'German', 'Deutsch'],
  ['it', 'Italian', 'Italiano'], ['pt', 'Portuguese', 'Português'], ['nl', 'Dutch', 'Nederlands'], ['ru', 'Russian', 'Русский'], ['uk', 'Ukrainian', 'Українська'],
  ['pl', 'Polish', 'Polski'], ['ro', 'Romanian', 'Română'], ['el', 'Greek', 'Ελληνικά'], ['he', 'Hebrew', 'עברית'], ['zh', 'Chinese (Simplified)', '简体中文'],
  ['zh-TW', 'Chinese (Traditional)', '繁體中文'], ['ja', 'Japanese', '日本語'], ['ko', 'Korean', '한국어'], ['id', 'Indonesian', 'Bahasa Indonesia'], ['ms', 'Malay', 'Bahasa Melayu'],
  ['th', 'Thai', 'ไทย'], ['vi', 'Vietnamese', 'Tiếng Việt'], ['fil', 'Filipino', 'Filipino'], ['ta', 'Tamil', 'தமிழ்'], ['te', 'Telugu', 'తెలుగు'], ['ml', 'Malayalam', 'മലയാളം'],
  ['mr', 'Marathi', 'मराठी'], ['gu', 'Gujarati', 'ગુજરાતી'], ['ne', 'Nepali', 'नेपाली'], ['si', 'Sinhala', 'සිංහල'], ['sw', 'Swahili', 'Kiswahili'], ['am', 'Amharic', 'አማርኛ'],
  ['ha', 'Hausa', 'Hausa'], ['yo', 'Yoruba', 'Yorùbá'], ['zu', 'Zulu', 'isiZulu'], ['af', 'Afrikaans', 'Afrikaans'], ['sv', 'Swedish', 'Svenska'], ['no', 'Norwegian', 'Norsk'],
  ['da', 'Danish', 'Dansk'], ['fi', 'Finnish', 'Suomi'], ['cs', 'Czech', 'Čeština'], ['hu', 'Hungarian', 'Magyar'], ['bg', 'Bulgarian', 'Български'], ['sr', 'Serbian', 'Српски'],
  ['hr', 'Croatian', 'Hrvatski'], ['az', 'Azerbaijani', 'Azərbaycanca'], ['uz', 'Uzbek', 'Oʻzbekcha'], ['kk', 'Kazakh', 'Қазақша'],
];
const RTL_CODES = ['ar', 'ur', 'fa', 'he', 'ps'];
export const langLabel = (code: string) => TR_LANGS.find((l) => l[0] === code)?.[2] ?? code;
export const isRtlCode = (code: string) => RTL_CODES.includes(code.split('-')[0]);

type Prefs = { to: string; out: string; auto: boolean }; // to = language messages are shown in, out = language "Translate my message" writes in
type Item = { s: 'busy' | 'done' | 'err'; text?: string; from?: string; same?: boolean; err?: string };
export type ChatTr = {
  prefs: Prefs; setPrefs: (p: Partial<Prefs>) => void;
  items: Record<string, Item>; orig: Record<string, boolean>;
  go: (id: number, text: string) => void; flip: (k: string) => void;
};
export const itemKey = (id: number, to: string) => id + '|' + to;
const PK = 'chatTranslatePrefs', AUTO_MAX = 20; // auto translates only the newest messages of the other side; older ones have the link

export function useChatTr(token: string, msgs: ChatMsg[], other: 'user' | 'admin', dflt: string): ChatTr {
  const [prefs, _prefs] = useState<Prefs>({ to: dflt, out: 'en', auto: false });
  const [items, setItems] = useState<Record<string, Item>>({});
  const [orig, setOrig] = useState<Record<string, boolean>>({});
  const prefsRef = useRef(prefs), itemsRef = useRef(items), busy = useRef(new Set<string>());
  prefsRef.current = prefs; itemsRef.current = items;

  useEffect(() => {
    AsyncStorage.getItem(PK).then((v) => {
      if (!v) return;
      try { const j = JSON.parse(v); const n: Prefs = { to: typeof j.to === 'string' ? j.to : prefsRef.current.to, out: typeof j.out === 'string' ? j.out : prefsRef.current.out, auto: !!j.auto }; prefsRef.current = n; _prefs(n); } catch { /* a damaged value is ignored */ }
    }).catch(() => {});
  }, []);
  const setPrefs = useCallback((p: Partial<Prefs>) => {
    const n = { ...prefsRef.current, ...p }; prefsRef.current = n; _prefs(n);
    AsyncStorage.setItem(PK, JSON.stringify(n)).catch(() => {});
  }, []);

  const go = useCallback(async (id: number, text: string) => {
    const to = prefsRef.current.to, k = itemKey(id, to);
    if (busy.current.has(k)) return;
    busy.current.add(k);
    setItems((c) => ({ ...c, [k]: { s: 'busy' } }));
    try { const r = await translateText(token, text, to); setItems((c) => ({ ...c, [k]: { s: 'done', text: r.text, from: r.from, same: r.same } })); }
    catch (e: any) { setItems((c) => ({ ...c, [k]: { s: 'err', err: e?.message ?? 'Error' } })); }
    busy.current.delete(k);
  }, [token]);
  const flip = useCallback((k: string) => setOrig((c) => ({ ...c, [k]: !c[k] })), []);

  // Auto: one message after the other (kind to the server limit). A message that failed is NOT retried by itself: the person taps it.
  useEffect(() => {
    if (!prefs.auto || !token) return;
    const todo = msgs.filter((m) => m.from === other && !!m.text).slice(-AUTO_MAX).filter((m) => !itemsRef.current[itemKey(m.id, prefs.to)] && !busy.current.has(itemKey(m.id, prefs.to)));
    if (!todo.length) return;
    let dead = false;
    (async () => { for (const m of todo) { if (dead) return; await go(m.id, m.text); } })();
    return () => { dead = true; };
  }, [msgs, prefs.auto, prefs.to, token, other, go]);

  return { prefs, setPrefs, items, orig, go, flip };
}

// A full-screen list of languages with a search box.
export function LangPicker({ visible, value, title, onPick, onClose }: { visible: boolean; value: string; title: string; onPick: (code: string) => void; onClose: () => void }) {
  const { th, t, rtl } = useApp();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const list = useMemo(() => { const s = q.trim().toLowerCase(); return s ? TR_LANGS.filter((l) => l.some((x) => x.toLowerCase().includes(s))) : TR_LANGS; }, [q]);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: th.bg, direction: rtl ? 'rtl' : 'ltr', paddingTop: Math.max(insets.top, StatusBar.currentHeight ?? 0, 24) + 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 10 }}>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('thClose')} style={{ width: 38, height: 38, borderRadius: 8, borderWidth: 1, borderColor: th.line, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={rtl ? 'arrow-forward' : 'arrow-back'} size={20} color={th.text} />
          </Pressable>
          <Text accessibilityRole="header" style={{ flex: 1, color: th.text, fontSize: 17, fontWeight: '900' }} numberOfLines={1}>{title}</Text>
        </View>
        <TextInput value={q} onChangeText={setQ} placeholder={t('trSearch')} placeholderTextColor={th.dim} autoCorrect={false}
          style={{ marginHorizontal: 14, marginBottom: 8, height: 44, backgroundColor: th.panel, borderColor: th.line, borderWidth: 1, borderRadius: 10, color: th.text, paddingHorizontal: 12, fontSize: 15 }} />
        <FlatList data={list} keyExtractor={(l) => l[0]} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: Math.max(insets.bottom, 14) + 10 }}
          renderItem={({ item }) => {
            const on = item[0] === value;
            return (
              <Pressable onPress={() => { setQ(''); onPick(item[0]); }} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 12, marginBottom: 6, borderRadius: 8, borderWidth: 1, borderColor: on ? th.accent : th.line, backgroundColor: th.panel, opacity: pressed ? 0.8 : 1 })}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: th.text, fontSize: 15, fontWeight: '800' }}>{item[2]}</Text>
                  {item[2] !== item[1] && <Text style={{ color: th.dim, fontSize: 12.5, marginTop: 1 }}>{item[1]}</Text>}
                </View>
                {on && <Icon name="checkmark" size={20} color={th.accent} />}
              </Pressable>
            );
          }} />
      </View>
    </Modal>
  );
}

// The bar at the top of the chat: language messages are shown in + Auto switch.
export function TrBar({ tr }: { tr: ChatTr }) {
  const { th, t } = useApp();
  const [pick, setPick] = useState(false);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: th.panel, borderWidth: 1, borderColor: th.line, borderRadius: 8, padding: 10 }}>
      <Icon name="language-outline" size={22} color={th.accent} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: th.text, fontSize: 13.5, fontWeight: '800' }}>{t('trTitle')}</Text>
        <Pressable onPress={() => setPick(true)} hitSlop={6} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
          <Text style={{ color: th.accent, fontSize: 12.5, fontWeight: '700' }} numberOfLines={1}>{t('trTo')}: {langLabel(tr.prefs.to)}</Text>
          <Icon name="chevron-down" size={14} color={th.accent} />
        </Pressable>
      </View>
      <View style={{ alignItems: 'center', gap: 2 }}>
        <Switch value={tr.prefs.auto} onValueChange={(v) => tr.setPrefs({ auto: v })} trackColor={{ false: th.line, true: th.accent }} thumbColor="#fff" accessibilityLabel={t('trAuto')} />
        <Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '700' }}>{t('trAutoShort')}</Text>
      </View>
      <LangPicker visible={pick} value={tr.prefs.to} title={t('trTo')} onClose={() => setPick(false)} onPick={(c) => { tr.setPrefs({ to: c }); setPick(false); }} />
    </View>
  );
}

// The text of one chat bubble with its translation controls. Replaces the plain <Text> of the message.
export function TrBody({ m, tr, me }: { m: ChatMsg; tr: ChatTr; me: boolean }) {
  const { th, t } = useApp();
  const k = itemKey(m.id, tr.prefs.to), it = tr.items[k], showOrig = !!tr.orig[k];
  if (!m.text) return null; // a photo / video without words: nothing to translate
  const d = it && it.s === 'done' && !it.same ? it : null; // a real translation exists
  const shown = d && !showOrig ? d.text ?? m.text : m.text;
  const rtlText = !!d && !showOrig && isRtlCode(tr.prefs.to);
  const col = me ? th.onAccent : th.text, link = me ? th.onAccent : th.accent;
  const sub = { color: me ? th.onAccent : th.dim, opacity: me ? 0.8 : 1, fontSize: 11.5 } as const;
  return (
    <>
      <Text selectable style={{ color: col, fontSize: 14.5, lineHeight: 21, ...(rtlText ? { writingDirection: 'rtl' as const, textAlign: 'right' as const } : {}) }}>{shown}</Text>
      {d ? (
        <Pressable onPress={() => tr.flip(k)} hitSlop={6} accessibilityRole="button">
          <Text style={sub}>{showOrig ? t('trShowTr') : `${t('trFrom')} ${d.from || '?'} · ${t('trOrig')}`}</Text>
        </Pressable>
      ) : it?.s === 'busy' ? (
        <Text style={sub}>{t('trBusy')}</Text>
      ) : it?.s === 'err' ? (
        <Pressable onPress={() => tr.go(m.id, m.text)} hitSlop={6} accessibilityRole="button">
          <Text style={{ ...sub, color: me ? th.onAccent : th.sell }}>{it.err || t('trFail')} · {t('trRetry')}</Text>
        </Pressable>
      ) : it?.s === 'done' ? (
        <Text style={sub}>{t('trSame')}</Text>
      ) : (
        <Pressable onPress={() => tr.go(m.id, m.text)} hitSlop={6} accessibilityRole="button">
          <Text style={{ ...sub, color: link, fontWeight: '800', opacity: 1 }}>{t('trBtn')}</Text>
        </Pressable>
      )}
    </>
  );
}

// Above the message box: translate what you typed into `out` before sending. The translation replaces the text so you can read and edit it; Undo brings your words back.
export function TrCompose({ token, text, setText, out, setOut }: { token: string; text: string; setText: (v: string) => void; out: string; setOut: (code: string) => void }) {
  const { th, t } = useApp();
  const [busy, setBusy] = useState(false), [err, setErr] = useState(''), [undo, setUndo] = useState<string | null>(null), [pick, setPick] = useState(false);
  useEffect(() => { if (!text.trim()) { setUndo(null); setErr(''); } }, [text]); // sent or cleared: nothing to undo
  if (!text.trim() && undo === null) return null;
  const run = async () => {
    const x = text.trim(); if (!x || busy || !token) return;
    setBusy(true); setErr('');
    try {
      const r = await translateText(token, x, out);
      if (r.same) setErr(t('trSame')); else { setUndo(x); setText(r.text); }
    } catch (e: any) { setErr(e?.message ?? 'Error'); }
    setBusy(false);
  };
  const chip = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5, paddingHorizontal: 10, height: 32, borderRadius: 16, borderWidth: 1, borderColor: th.line, backgroundColor: th.bg };
  return (
    <View style={{ paddingHorizontal: 10, paddingTop: 8, gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Pressable onPress={run} disabled={busy || !text.trim()} accessibilityRole="button" style={({ pressed }) => ({ ...chip, borderColor: th.accent, opacity: busy || !text.trim() ? 0.5 : pressed ? 0.8 : 1 })}>
          <Icon name="language-outline" size={16} color={th.accent} />
          <Text style={{ color: th.accent, fontSize: 12.5, fontWeight: '800' }}>{busy ? t('trBusy') : `${t('trMine')} ${langLabel(out)}`}</Text>
        </Pressable>
        <Pressable onPress={() => setPick(true)} hitSlop={6} accessibilityRole="button" accessibilityLabel={t('trOut')} style={chip}>
          <Text style={{ color: th.text, fontSize: 12.5, fontWeight: '700' }}>{t('trOut')}</Text><Icon name="chevron-down" size={14} color={th.dim} />
        </Pressable>
        {undo !== null && (
          <Pressable onPress={() => { setText(undo); setUndo(null); setErr(''); }} hitSlop={6} accessibilityRole="button" style={chip}>
            <Text style={{ color: th.text, fontSize: 12.5, fontWeight: '700' }}>{t('trUndo')}</Text>
          </Pressable>
        )}
      </View>
      {!!err && <Text style={{ color: th.sell, fontSize: 12 }}>{err}</Text>}
      <LangPicker visible={pick} value={out} title={t('trOut')} onClose={() => setPick(false)} onPick={(c) => { setOut(c); setPick(false); }} />
    </View>
  );
}
