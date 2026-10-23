// Push notifications: how the phone is told about a reached price or a strong setup while the app is closed and the screen is locked.
// expo-notifications is loaded lazily: on a build that does not contain it the app still works and this feature reports "unsupported".
import { Platform } from 'react-native';
import { pushRegister, pushUnregister } from './license';

export const CHANNEL = 'alarm_v1'; // the server sends to this channel (server/alerts.js)
export const CHAT_CHANNEL = 'support_v1'; // chat replies and payment answers: normal notification sound, not the trading alarm
export const DIGEST_CHANNEL = 'digest_v1'; // the "analysis every 90 s" notification: silent, low importance, so it never rings like an alarm (server/alerts.js)
export const INFO_CHANNEL = 'info_v1'; // news and daily high / low breaks: normal notification sound, not the trading alarm (server/alerts.js)
export type PushState = 'on' | 'denied' | 'unsupported' | 'error';

let N: any = null, token = '';
// Expo Go (Android, SDK 53 and newer) removed remote push, and importing expo-notifications there logs an error on every start.
// So in Expo Go the module is never loaded: the app runs normally and background alerts report "unsupported". A development build or the APK has it.
export const inExpoGo = (): boolean => { try { const C = require('expo-constants').default; return C?.executionEnvironment === 'storeClient' || C?.appOwnership === 'expo'; } catch { return false; } };
const mod = () => { if (N) return N; if (Platform.OS === 'web' || inExpoGo()) return null; // push needs a phone; browsers use the in-page alerts instead
  try { N = require('expo-notifications'); } catch { N = null; } return N; };

// Call once at app start. A notification that arrives while the app is open is still shown, with the alarm sound.
export function initPush() {
  const n = mod(); if (!n) return;
  try { n.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) }); } catch {}
}

async function makeChannel(n: any) {
  if (Platform.OS !== 'android') return;
  await n.setNotificationChannelAsync(CHANNEL, {
    name: 'Alarms (price alerts and setups)', importance: n.AndroidImportance.MAX, sound: 'alarm.wav',
    vibrationPattern: [0, 600, 350, 600, 350, 600, 900], enableVibrate: true, lockscreenVisibility: n.AndroidNotificationVisibility?.PUBLIC ?? 1,
    showBadge: true, bypassDnd: true, audioAttributes: { usage: n.AndroidAudioUsage?.ALARM ?? 4, contentType: n.AndroidAudioContentType?.SONIFICATION ?? 4 },
  });
  await n.setNotificationChannelAsync(DIGEST_CHANNEL, { name: 'Analysis every 90 s (silent)', importance: n.AndroidImportance.LOW, sound: null, enableVibrate: false, showBadge: false });
  await n.setNotificationChannelAsync(INFO_CHANNEL, { name: 'News and daily high / low breaks', importance: n.AndroidImportance.HIGH, sound: 'default', enableVibrate: true, showBadge: true });
  await n.setNotificationChannelAsync(CHAT_CHANNEL, { name: 'Support messages', importance: n.AndroidImportance.HIGH, sound: 'default', enableVibrate: true, showBadge: true });
}

export async function registerPush(session: string): Promise<{ state: PushState; msg?: string }> {
  const n = mod(); if (!n) return { state: 'unsupported' };
  try {
    await makeChannel(n); // on Android 13+ the channel must exist before the permission question
    let p = await n.getPermissionsAsync();
    if (p.status !== 'granted') p = await n.requestPermissionsAsync();
    if (p.status !== 'granted') return { state: 'denied' };
    let projectId: string | undefined;
    try { const C = require('expo-constants').default; projectId = C?.expoConfig?.extra?.eas?.projectId ?? C?.easConfig?.projectId; } catch {}
    const t = (await n.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data as string;
    token = t;
    await pushRegister(session, t);
    return { state: 'on' };
  } catch (e: any) { return { state: 'error', msg: String(e?.message || e) }; }
}
export async function unregisterPush(session: string) { if (token && session) { try { await pushUnregister(session, token); } catch {} } }

// The number on the app icon. iPhone: exact. Android: shown by phones whose launcher supports numbers (Samsung, Xiaomi, Oppo, Huawei ...); a Pixel / stock launcher shows a dot instead, that is the phone's choice.
export async function setBadge(n: number) { const m = mod(); if (!m) return; try { await m.setBadgeCountAsync(Math.max(0, Math.round(n))); } catch {} }

// Tells the app a notification arrived (while it is open) or was tapped. A tap that opened the app from closed is delivered too, once.
let handledTap = '';
// A tap is told apart by the notification's id AND its time (a remote push can come without an id).
const tapKey = (r: any) => String(r?.notification?.request?.identifier || '') + '|' + String(r?.notification?.date || '');
// On a tap the second argument is the data the server put into the push (type, sym / symId ...), so the app can open the right place.
export function onPushEvent(cb: (tapped: boolean, data?: any) => void): () => void {
  const m = mod(); if (!m) return () => {};
  let a: any, b: any;
  try {
    const dataOf = (r: any) => r?.notification?.request?.content?.data;
    const clear = () => { try { if (m.clearLastNotificationResponse) m.clearLastNotificationResponse(); else m.clearLastNotificationResponseAsync?.(); } catch {} }; // handled once: never replayed when this listener is set up again
    a = m.addNotificationReceivedListener(() => cb(false));
    b = m.addNotificationResponseReceivedListener((r: any) => { handledTap = tapKey(r); cb(true, dataOf(r)); clear(); });
    // The app was closed and the tap started it: the tap happened before this listener existed, so ask for it. Newer expo-notifications has the plain function, older ones the Async one.
    let last: any = null;
    try { last = m.getLastNotificationResponse ? m.getLastNotificationResponse() : null; } catch {}
    Promise.resolve(last ?? m.getLastNotificationResponseAsync?.()).then((r: any) => { if (!r?.notification) return; const k = tapKey(r); if (k !== handledTap) { handledTap = k; cb(true, dataOf(r)); clear(); } }).catch(() => {});
  } catch {}
  return () => { try { a?.remove?.(); b?.remove?.(); } catch {} };
}
