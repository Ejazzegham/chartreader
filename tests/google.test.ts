// Google sign-in wrapper: every outcome of the native module becomes a clean result (a token, a cancel, or a translation key).
import { googleIdToken, GOOGLE_WEB_CLIENT_ID } from '../src/google';
const Mod = require('module');

let fails = 0;
const ok = (c: unknown, m: string) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };

(async () => {
  // 1. the native module is not in this build of the app (an old install that got the update): no crash, a clear key
  let r: any = await googleIdToken();
  ok(r.err === 'errGoogleBuild', 'module missing (old app build): errGoogleBuild, no crash');

  // 2. fake native module
  let behaviour: () => Promise<any> = async () => ({ type: 'success', data: { idToken: 'tok123' } });
  let configured: any = null, signedOut = 0;
  const fake = {
    GoogleSignin: { configure: (o: any) => { configured = o; }, hasPlayServices: async () => true, signOut: async () => { signedOut++; }, signIn: () => behaviour() },
    statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
  };
  const orig = Mod._load;
  Mod._load = function (req: string, ...a: any[]) { return req === '@react-native-google-signin/google-signin' ? fake : orig.call(this, req, ...a); };

  r = await googleIdToken();
  ok(r.token === 'tok123' && configured?.webClientId === GOOGLE_WEB_CLIENT_ID && signedOut === 1, 'success: ID token returned, web client id configured, chooser reset first');
  behaviour = async () => ({ type: 'cancelled' }); r = await googleIdToken(); ok(r.cancelled === true, 'closing the chooser = cancelled, not an error');
  behaviour = async () => { throw { code: 'SIGN_IN_CANCELLED' }; }; r = await googleIdToken(); ok(r.cancelled === true, 'cancel thrown as an error = cancelled');
  behaviour = async () => ({ type: 'success', data: { idToken: null } }); r = await googleIdToken(); ok(r.err === 'errGoogle', 'no ID token: errGoogle');
  behaviour = async () => { throw { code: '10', message: 'DEVELOPER_ERROR' }; }; r = await googleIdToken(); ok(r.err === 'errGoogleSetup', 'DEVELOPER_ERROR (SHA-1 not registered): errGoogleSetup');
  behaviour = async () => { throw new Error('A network error has occurred'); }; r = await googleIdToken(); ok(r.err === 'errNetwork', 'network error: errNetwork');
  behaviour = async () => { throw new Error('boom'); }; r = await googleIdToken(); ok(r.err === 'errGoogle', 'anything else: errGoogle');
  Mod._load = orig;

  console.log(fails ? `\n${fails} FAILED` : '\nall google sign-in tests passed');
  process.exit(fails ? 1 : 0);
})();
