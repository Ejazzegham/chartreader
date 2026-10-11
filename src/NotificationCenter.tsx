import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StatusBar } from 'react-native';
import Modal from './Modal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from './store';
import { Icon, confirmAction } from './ui';

// The bell's window: every alert (order filled, take profit, stop, break-even, scanner setups) in one list, newest first.
// Opening it marks everything as read, so the red badge on the bell disappears. "Clear all" empties the list.
export default function NotificationCenter() {
  const { th, t, rtl, notes, notesOpen, setNotesOpen, markNotesRead, clearNotes, removeNote } = useApp();
  const insets = useSafeAreaInsets();
  const [fresh, setFresh] = useState<Set<string>>(new Set()); // what was unread when the window opened, so those lines can be marked NEW while you read them
  useEffect(() => {
    if (!notesOpen) return;
    setFresh(new Set(notes.filter((n) => !n.read).map((n) => n.id)));
    markNotesRead();
  }, [notesOpen]);
  if (!notesOpen) return null;

  const close = () => { markNotesRead(); setNotesOpen(false); };
  const ago = (at: number) => { const m = Math.max(0, Math.round((Date.now() - at) / 60000)); return m < 1 ? t('notifJustNow') : m < 60 ? `${m} ${t('notifMin')}` : m < 1440 ? `${Math.round(m / 60)} ${t('notifHour')}` : `${Math.round(m / 1440)} ${t('notifDay')}`; };
  const colOf = (k: string) => (k === 'good' ? th.buy : k === 'bad' ? th.sell : th.accent);
  const iconOf = (k: string) => (k === 'good' ? 'checkmark-circle' : k === 'bad' ? 'close-circle' : 'notifications');

  return (
    <Modal animationType="slide" onRequestClose={close} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: th.bg, direction: rtl ? 'rtl' : 'ltr' }}>
        <View style={{ paddingTop: Math.max(insets.top, StatusBar.currentHeight ?? 0, 24) + 14, paddingBottom: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: th.line, backgroundColor: th.panel, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable onPress={close} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('thClose')} style={{ width: 38, height: 38, borderRadius: 8, borderWidth: 1, borderColor: th.line, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={rtl ? 'arrow-forward' : 'arrow-back'} size={20} color={th.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={{ color: th.text, fontSize: 18, fontWeight: '900' }} numberOfLines={1}>{t('tabNotifications')}</Text>
            <Text style={{ color: th.dim, fontSize: 11.5 }}>{notes.length}</Text>
          </View>
          {notes.length > 0 && (
            <Pressable onPress={() => confirmAction(t('notifClearQ'), t('notifClearText'), clearNotes, t('notifClear'), t('cancel'))} hitSlop={6} accessibilityRole="button" accessibilityLabel={t('notifClear')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: th.sell + '88', backgroundColor: th.sell + '14' }}>
              <Icon name="trash-outline" size={16} color={th.sell} />
              <Text style={{ color: th.sell, fontWeight: '800', fontSize: 12.5 }}>{t('notifClear')}</Text>
            </Pressable>
          )}
        </View>

        <ScrollView contentContainerStyle={{ padding: 14, gap: 8, paddingBottom: insets.bottom + 28 }}>
          {notes.length === 0 ? (
            <View style={{ alignItems: 'center', gap: 10, paddingVertical: 56, paddingHorizontal: 24 }}>
              <View style={{ width: 60, height: 60, borderRadius: 8, backgroundColor: th.accent + '1F', alignItems: 'center', justifyContent: 'center' }}><Icon name="notifications-off-outline" size={28} color={th.accent} /></View>
              <Text style={{ color: th.text, fontSize: 17, fontWeight: '900', textAlign: 'center' }}>{t('notifEmpty')}</Text>
              <Text style={{ color: th.dim, fontSize: 13.5, lineHeight: 20, textAlign: 'center' }}>{t('notifEmptyText')}</Text>
            </View>
          ) : notes.map((n) => {
            const c = colOf(n.kind), isNew = fresh.has(n.id);
            return (
              <View key={n.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: isNew ? c + '12' : th.panel, borderWidth: 1, borderColor: isNew ? c + '66' : th.line, borderRadius: 8, padding: 12 }}>
                <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: c }} />
                <Icon name={iconOf(n.kind)} size={22} color={c} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: th.text, fontSize: 13.5, lineHeight: 19, fontWeight: isNew ? '800' : '600' }}>{n.text}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
                    <Text style={{ color: th.dim, fontSize: 11.5 }}>{ago(n.at)}</Text>
                    {isNew && <Text style={{ color: c, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 }}>{t('notifNew')}</Text>}
                  </View>
                </View>
                <Pressable onPress={() => removeNote(n.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('notifRemove')}>
                  <Icon name="close" size={18} color={th.dim} />
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}
