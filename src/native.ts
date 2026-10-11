// Thin wrappers around native modules that were added after the first release (alarm sound, fingerprint).
// Everything is loaded lazily inside try/catch: on a build that does not contain a module the app keeps working and the feature quietly turns off.
import { Vibration, Platform } from 'react-native';

// ---------------------------------------------------------------- alarm
let player: any = null;
let webAudio: any = null; // browser: a plain <audio> (public/alarm.wav)
let ringing = false;

export function startAlarm() {
  if (ringing) return;
  ringing = true;
  try { Vibration.vibrate([0, 600, 350, 600, 350, 600, 900], true); } catch {}
  if (Platform.OS === 'web') { try { webAudio = new (window as any).Audio('/alarm.wav'); webAudio.loop = true; webAudio.play().catch(() => {}); } catch { webAudio = null; } return; }
  try {
    const A = require('expo-audio');
    A.setAudioModeAsync?.({ playsInSilentMode: true, shouldPlayInBackground: false }).catch?.(() => {});
    player = A.createAudioPlayer(require('../assets/alarm.wav'));
    player.loop = true; player.volume = 1; player.play();
  } catch { player = null; }
}
export function silenceSound() { try { player?.pause?.(); player?.remove?.(); } catch {} player = null; try { webAudio?.pause?.(); } catch {} webAudio = null; }
export function stopAlarm() {
  ringing = false;
  silenceSound();
  try { Vibration.cancel(); } catch {}
}
export const isRinging = () => ringing;

// ---------------------------------------------------------------- fingerprint / face
export async function bioAvailable(): Promise<boolean> {
  try {
    const L = require('expo-local-authentication');
    return !!(await L.hasHardwareAsync()) && !!(await L.isEnrolledAsync());
  } catch { return false; }
}
// true = the person proved it is them (fingerprint, face, or the phone's own PIN / pattern as the fallback)
export async function bioAuth(reason: string): Promise<boolean> {
  try {
    const L = require('expo-local-authentication');
    const r = await L.authenticateAsync({ promptMessage: reason, cancelLabel: 'Cancel', disableDeviceFallback: false });
    return !!r?.success;
  } catch { return false; }
}
