// "Continue with Google" in the browser. The phone uses Google's native chooser (src/google.ts); a website opens Google's own pop-up instead.
// The pop-up runs on a SECOND, throw-away Firebase instance so it never changes the app's real login. It only produces the Google ID token,
// which src/store.tsx then turns into a normal Firebase login, exactly as on the phone (same server, licence, backup and alerts).
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { FIREBASE_CONFIG } from './firebase';

export const GOOGLE_WEB_CLIENT_ID = '745148948540-k9cs0495i50v4o774c0k4k6mbbcenqkj.apps.googleusercontent.com';
export type GoogleToken = { token: string } | { cancelled: true } | { err: string };

export async function googleIdToken(): Promise<GoogleToken> {
  try {
    const NAME = 'google-popup';
    const sec = getApps().some((a) => a.name === NAME) ? getApp(NAME) : initializeApp(FIREBASE_CONFIG, NAME);
    const auth = getAuth(sec);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' }); // always show the chooser, so another Google account can be picked
    const res = await signInWithPopup(auth, provider);
    const idToken = GoogleAuthProvider.credentialFromResult(res)?.idToken;
    try { await signOut(auth); } catch { /* nothing to clean up */ }
    return idToken ? { token: idToken } : { err: 'errGoogle' };
  } catch (e: any) {
    const c = String(e?.code ?? '');
    if (c.includes('popup-closed') || c.includes('cancelled-popup') || c.includes('user-cancelled')) return { cancelled: true };
    if (c.includes('popup-blocked')) return { err: 'errGooglePopup' };
    if (c.includes('unauthorized-domain') || c.includes('operation-not-allowed')) return { err: 'errGoogleSetup' };
    return { err: /network/i.test(String(e?.message)) ? 'errNetwork' : 'errGoogle' };
  }
}
