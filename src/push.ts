// Push notifications: how the phone is told about a reached price or a strong setup while the app is closed and the screen is locked.
// expo-notifications is loaded lazily: on a build that does not contain it the app still works and this feature reports "unsupported".
import { Platform } from 'react-native';
import { pushRegister, pushUnregister } from './license';

export const CHANNEL = 'alarm_v1'; // the server sends to this channel (server/alerts.js)
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
    bypassDnd: true, audioAttributes: { usage: n.AndroidAudioUsage?.ALARM ?? 4, contentType: n.AndroidAudioContentType?.SONIFICATION ?? 4 },
  });
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
