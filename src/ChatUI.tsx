import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput, Image, ActivityIndicator, Keyboard, Linking, Platform, StatusBar } from 'react-native';
import Modal from './Modal';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from './store';
import { Icon } from './ui';
import { ChatMsg, ChatMedia, mediaUrl, MEDIA_HEADERS } from './license';
import { ChatTr, TrBody } from './ChatTranslate';

// The look of the support chat (user Help screen and admin Chats tab): message bubbles, day dividers, photo / video attachments, and the
// message box. It only draws; the sending and translating logic stays in Help.tsx / AdminPanel.tsx / ChatTranslate.tsx.
// Chat bubbles are rounder than the rest of the app (R = 8): change BUBBLE_R to 8 to make them match the cards again.
const BUBBLE_R = 18, TAIL_R = 5, MB = 1048576, MAX_IMAGE = 8 * MB, MAX_VIDEO = 25 * MB;
const clock = (at: number) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
export const dayKey = (at: number) => new Date(at).toDateString();
export const mbText = (n: number) => (n >= MB ? (n / MB).toFixed(n >= 10 * MB ? 0 : 1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');

// "Today", "Yesterday" or the date, in the app language.
export function dayLabel(at: number, lang: string, t: (k: string) => string) {
  const d = new Date(at), n = new Date(), y = new Date(n); y.setDate(n.getDate() - 1);
  if (d.toDateString() === n.toDateString()) return t('chToday');
  if (d.toDateString() === y.toDateString()) return t('chYesterday');
  try { return d.toLocaleDateString(lang, { day: 'numeric', month: 'short', ...(d.getFullYear() === n.getFullYear() ? {} : { year: 'numeric' as const }) }); } catch { return d.toLocaleDateString(); }
}

export function DayDivider({ at }: { at: number }) {
  const { th, t, settings } = useApp();
  return (
    <View style={{ alignItems: 'center', marginVertical: 6 }}>
      <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, backgroundColor: th.panel2, borderWidth: 1, borderColor: th.hair }}>
        <Text style={{ color: th.dim, fontSize: 11, fontWeight: '800', letterSpacing: 0.3 }}>{dayLabel(at, settings.lang, t)}</Text>
      </View>
    </View>
  );
}

// A round badge with the first letter of a name or email.
export function Avatar({ label, size = 40 }: { label: string; size?: number }) {
  const { th } = useApp();
  const ch = (label.trim()[0] || '?').toUpperCase();
  return (
    <LinearGradient colors={[th.accent, th.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: th.onAccent, fontWeight: '900', fontSize: size * 0.42 }}>{ch}</Text>
    </LinearGradient>
  );
}

// ---- a photo or video inside a bubble ----
const TILE_W = 232;
function MediaTile({ media }: { media: ChatMedia }) {
  const { th, t, rtl } = useApp();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false), [bad, setBad] = useState(false);
  const url = mediaUrl(media);
  if (media.kind === 'video') {
    return (
      <Pressable onPress={() => Linking.openURL(url).catch(() => {})} accessibilityRole="button" accessibilityLabel={t('chVideo')} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
        <LinearGradient colors={['#0B1220', '#1B2A4A']} style={{ width: TILE_W, height: 132, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFFFFF2E', borderWidth: 1, borderColor: '#FFFFFF55', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="play" size={24} color="#FFFFFF" />
          </View>
          <Text style={{ color: '#FFFFFFCC', fontSize: 12, fontWeight: '700' }}>{t('chVideo')} · {mbText(media.size)} · {t('chOpenVideo')}</Text>
        </LinearGradient>
      </Pressable>
    );
  }
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="imagebutton" accessibilityLabel={t('chPhoto')} style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}>
        {bad ? (
          <View style={{ width: TILE_W, height: 120, borderRadius: 12, backgroundColor: th.panel2, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Icon name="image-outline" size={28} color={th.dim} /><Text style={{ color: th.dim, fontSize: 12 }}>{t('chPhoto')} · {mbText(media.size)}</Text>
          </View>
        ) : (
          <Image source={{ uri: url, headers: MEDIA_HEADERS }} onError={() => setBad(true)} resizeMode="cover" style={{ width: TILE_W, height: 172, borderRadius: 12, backgroundColor: th.panel2 }} />
        )}
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: '#000000F2', justifyContent: 'center' }}>
          <Image source={{ uri: url, headers: MEDIA_HEADERS }} resizeMode="contain" style={{ width: '100%', height: '82%' }} />
          <Pressable onPress={() => setOpen(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('thClose')}
            style={{ position: 'absolute', top: Math.max(insets.top, StatusBar.currentHeight ?? 0, 24) + 8, [rtl ? 'left' : 'right']: 16, width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF26', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={24} color="#FFFFFF" />
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

// ---- one message ----
// `mine` = written by the person using this screen (user on Help, admin in Chats). `sender` is the small caption on the other side's bubbles.
export function Bubble({ m, mine, tr, sender }: { m: ChatMsg; mine: boolean; tr: ChatTr; sender?: string }) {
  const { th, t } = useApp();
  const shape = { borderRadius: BUBBLE_R, ...(mine ? { borderBottomEndRadius: TAIL_R } : { borderBottomStartRadius: TAIL_R }) };
  const inner = (
    <View style={{ gap: 5 }}>
      {!!sender && !mine && <Text style={{ color: th.accent, fontSize: 10.5, fontWeight: '900', letterSpacing: 0.8 }}>{sender.toUpperCase()}</Text>}
      {!!m.media && <MediaTile media={m.media} />}
      {!!m.text && <TrBody m={m} tr={tr} me={mine} />}
      <Text style={{ alignSelf: 'flex-end', color: mine ? th.onAccent : th.dim, opacity: mine ? 0.78 : 1, fontSize: 10.5, fontWeight: '600' }}>
        {clock(m.at)}{m.via === 'email' ? ` · ${t('helpViaMail')}` : ''}
      </Text>
    </View>
  );
  const pad = { paddingHorizontal: m.media && !m.text ? 6 : 13, paddingTop: m.media && !m.text ? 6 : 9, paddingBottom: 7 };
  return mine ? (
    <LinearGradient colors={[th.accent, th.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ alignSelf: 'flex-end', maxWidth: '86%', ...shape, ...pad, shadowColor: th.accent, shadowOpacity: 0.28, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 }}>{inner}</LinearGradient>
  ) : (
    <View style={{ alignSelf: 'flex-start', maxWidth: '86%', backgroundColor: th.panel, borderWidth: 1, borderColor: th.hair, ...shape, ...pad }}>{inner}</View>
  );
}

// ---- picking a file ----
export type Pending = { uri: string; kind: 'image' | 'video'; name: string; size: number; id?: string };

// Returns the pick (or null when cancelled). Throws an Error with a readable message. No new native module: expo-image-picker is already in the app.
async function pickFile(source: 'gallery' | 'camera', t: (k: string) => string): Promise<Pending | null> {
  if (source === 'camera') {
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted) throw new Error(t('chNoPerm'));
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: source === 'camera' ? ['images'] : ['images', 'videos'], quality: 0.75, allowsMultipleSelection: false };
  const r = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0], kind: 'image' | 'video' = a.type === 'video' ? 'video' : 'image', size = a.fileSize ?? 0;
  if (size && size > (kind === 'video' ? MAX_VIDEO : MAX_IMAGE)) throw new Error(t('chTooBig'));
  return { uri: a.uri, kind, size, name: a.fileName || (kind === 'video' ? t('chVideo') : t('chPhoto')) };
}

// State + the bottom sheet of the attach button. `sheet` goes anywhere in the screen's tree; `open()` shows it.
export function useAttach(onError: (m: string) => void) {
  const { th, t } = useApp();
  const insets = useSafeAreaInsets();
  const [pending, setPending] = useState<Pending | null>(null), [show, setShow] = useState(false);
  const pick = useCallback(async (src: 'gallery' | 'camera') => {
    setShow(false);
    try { const p = await pickFile(src, t); if (p) { setPending(p); onError(''); } } catch (e: any) { onError(e?.message ?? 'Error'); }
  }, [t, onError]);
  const row = (icon: string, label: string, on: () => void) => (
    <Pressable onPress={on} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, backgroundColor: pressed ? th.panel2 : 'transparent' })}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: th.accent + '22', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={20} color={th.accent} /></View>
      <Text style={{ color: th.text, fontSize: 15.5, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
  const sheet = (
    <Modal visible={show} transparent animationType="fade" onRequestClose={() => setShow(false)} statusBarTranslucent>
      <Pressable onPress={() => setShow(false)} style={{ flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: th.solid, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: th.hair, paddingTop: 10, paddingHorizontal: 10, paddingBottom: Math.max(insets.bottom, 12) + 6 }}>
          <View style={{ alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: th.line, marginBottom: 8 }} />
          {row('images-outline', t('chGallery'), () => pick('gallery'))}
          {row('camera-outline', t('chCamera'), () => pick('camera'))}
          {row('close-outline', t('chCancel'), () => setShow(false))}
        </Pressable>
      </Pressable>
    </Modal>
  );
  return { pending, setPending, clear: () => setPending(null), open: () => { Keyboard.dismiss(); setShow(true); }, sheet };
}

// True while the on-screen keyboard is up (the bottom safe-area padding is not needed then).
function useKeyboardUp() {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const a = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setUp(true));
    const b = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setUp(false));
    return () => { a.remove(); b.remove(); };
  }, []);
  return up;
}

// ---- the message box ----
// It keeps clear of the phone's navigation bar (the old box sat under it) and has the attach button on the left and a round send button on the right.
export function Composer({ top, text, setText, placeholder, busy, busyLabel, pending, onAttach, onClear, onSend, disabled }: {
  top?: React.ReactNode; text: string; setText: (v: string) => void; placeholder: string; busy: boolean; busyLabel?: string;
  pending: Pending | null; onAttach: () => void; onClear: () => void; onSend: () => void; disabled?: boolean;
}) {
  const { th, t } = useApp();
  const insets = useSafeAreaInsets(), kb = useKeyboardUp();
  const can = !busy && !disabled && (!!text.trim() || !!pending);
  return (
    <View style={{ backgroundColor: th.solid, borderTopWidth: 1, borderTopColor: th.hair, shadowColor: '#000', shadowOpacity: th.dark ? 0.3 : 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -4 }, elevation: 8 }}>
      {top}
      {!!pending && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 12, marginTop: 10, padding: 8, borderRadius: 14, backgroundColor: th.panel2, borderWidth: 1, borderColor: th.hair }}>
          {pending.kind === 'image'
            ? <Image source={{ uri: pending.uri }} style={{ width: 52, height: 52, borderRadius: 10, backgroundColor: th.panel }} />
            : <LinearGradient colors={['#0B1220', '#1B2A4A']} style={{ width: 52, height: 52, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}><Icon name="play" size={22} color="#FFFFFF" /></LinearGradient>}
          <View style={{ flex: 1 }}>
            <Text style={{ color: th.text, fontSize: 13.5, fontWeight: '800' }} numberOfLines={1}>{pending.kind === 'video' ? t('chVideo') : t('chPhoto')}{pending.size ? ` · ${mbText(pending.size)}` : ''}</Text>
            <Text style={{ color: th.dim, fontSize: 12 }} numberOfLines={1}>{busy && busyLabel ? busyLabel : pending.name}</Text>
          </View>
          {!busy && (
            <Pressable onPress={onClear} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('chRemove')} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: th.panel, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={18} color={th.dim} />
            </Pressable>
          )}
        </View>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 10, paddingTop: 10, paddingBottom: kb ? 10 : Math.max(insets.bottom, 12) }}>
        <Pressable onPress={onAttach} disabled={busy || disabled} accessibilityRole="button" accessibilityLabel={t('chAttach')}
          style={({ pressed }) => ({ width: 46, height: 46, borderRadius: 23, backgroundColor: th.panel2, borderWidth: 1, borderColor: th.hair, alignItems: 'center', justifyContent: 'center', opacity: busy || disabled ? 0.4 : pressed ? 0.75 : 1 })}>
          <Icon name="attach" size={24} color={th.accent} />
        </Pressable>
        <TextInput value={text} onChangeText={setText} placeholder={placeholder} placeholderTextColor={th.dim} multiline maxLength={2000}
          style={{ flex: 1, maxHeight: 130, minHeight: 46, backgroundColor: th.panel2, borderColor: th.hair, borderWidth: 1, borderRadius: 23, color: th.text, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontSize: 15.5, textAlignVertical: 'center' }} />
        <Pressable onPress={onSend} disabled={!can} accessibilityRole="button" accessibilityLabel={t('helpSend')} style={({ pressed }) => ({ opacity: !can ? 0.4 : pressed ? 0.85 : 1 })}>
          <LinearGradient colors={[th.accent, th.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', shadowColor: th.accent, shadowOpacity: can ? 0.4 : 0, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: can ? 3 : 0 }}>
            {busy ? <ActivityIndicator color={th.onAccent} /> : <Icon name="send" size={20} color={th.onAccent} />}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}
