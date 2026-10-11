import { Alert, Share, Platform } from 'react-native';

// Pop-ups, sharing and notifications that work on the phone AND in a browser (react-native-web ignores Alert and Share).
type Btn = { text?: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void };

export function showAlert(title: string, message?: string, buttons?: Btn[]) {
  if (Platform.OS !== 'web') { Alert.alert(title, message, buttons as any); return; }
  const text = message ? `${title}\n\n${message}` : title;
  if (buttons && buttons.length > 1) { // question: OK runs the first action button, Cancel runs the cancel button
    const cancel = buttons.find((b) => b.style === 'cancel'), act = buttons.find((b) => b.style !== 'cancel');
    (window.confirm(text) ? act : cancel)?.onPress?.();
  } else { window.alert(text); buttons?.[0]?.onPress?.(); }
}

// A short message that must be seen (price alert hit). Phone: a normal alert. Browser: a desktop notification when allowed, else a pop-up.
export function notify(title: string, body: string) {
  if (Platform.OS !== 'web') { Alert.alert(title, body); return; }
  try {
    const N = (window as any).Notification;
    if (N && N.permission === 'granted') { new N(title, { body }); return; }
  } catch {}
  setTimeout(() => window.alert(`${title}\n\n${body}`), 0);
}
// Ask once for permission to show desktop notifications (call it when the person turns alerts on, not at start-up).
export function askNotifyPermission() {
  if (Platform.OS !== 'web') return;
  try { const N = (window as any).Notification; if (N && N.permission === 'default') N.requestPermission(); } catch {}
}

export async function shareText(message: string, title?: string) {
  if (Platform.OS !== 'web') { await Share.share({ message, title }).catch(() => {}); return; }
  const nav: any = navigator;
  try { if (nav.share) { await nav.share({ title, text: message }); return; } } catch (e: any) { if (e?.name === 'AbortError') return; }
  try { await nav.clipboard.writeText(message); window.alert('Copied to the clipboard.'); }
  catch { window.prompt('Copy this text:', message); }
}
