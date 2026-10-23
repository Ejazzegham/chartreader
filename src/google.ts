// "Continue with Google". The Google account chooser is the phone's own (native), the result is a Google ID token that Firebase turns into a normal Firebase login,
// so the server, the license, the backup and the alerts see exactly the same kind of account as an email + password one.
//
// The native module is loaded only when the button is pressed. A phone that still has the OLD app build (without the module) therefore does not crash when it
// receives this update: the button just says the app needs the new version.

// The Web client ID of this Firebase project (Firebase console > Authentication > Sign-in method > Google > Web SDK configuration; also in google-services.json as client_type 3).
export const GOOGLE_WEB_CLIENT_ID = '745148948540-k9cs0495i50v4o774c0k4k6mbbcenqkj.apps.googleusercontent.com';

type GS = typeof import('@react-native-google-signin/google-signin');
let mod: GS | undefined;
const load = (): GS | null => {
  if (mod) return mod;
  try {
    const m = require('@react-native-google-signin/google-signin') as GS;
    m.GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
    mod = m;
    return m;
  } catch { return null; } // not in this build of the app
};

export type GoogleToken = { token: string } | { cancelled: true } | { err: string };

// Opens the Google account chooser and returns the ID token. `err` is a translation key (errGoogle...).
export async function googleIdToken(): Promise<GoogleToken> {
  const m = load();
  if (!m) return { err: 'errGoogleBuild' };
  try {
    await m.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    try { await m.GoogleSignin.signOut(); } catch { /* nothing signed in yet */ } // always show the chooser, so another Google account can be picked
    const r = await m.GoogleSignin.signIn();
    if (r.type !== 'success') return { cancelled: true };
    return r.data.idToken ? { token: r.data.idToken } : { err: 'errGoogle' };
  } catch (e: any) {
    if (e?.code === m.statusCodes.SIGN_IN_CANCELLED) return { cancelled: true };
    const text = `${e?.code ?? ''} ${e?.message ?? ''}`;
    if (/DEVELOPER_ERROR|\b10\b/.test(text)) return { err: 'errGoogleSetup' }; // the app's SHA-1 is not registered in Firebase
    return { err: /network/i.test(text) ? 'errNetwork' : 'errGoogle' };
  }
}
