import * as SecureStore from './secureStore';
import * as Crypto from 'expo-crypto';

// Put the public URL of server/server.js here (must be https for release builds).
export const SERVER = 'https://mockup-borrowing-overprice.ngrok-free.dev';
export const PAY = { TRON: 'TKvEQSzioWQGZBHdrzSLGWUnmQhJsEHUhA', BSC: '0xd7065772295fb0d563c1c6b00e4464bcd4b03f81' };
export const PLANS = { weekly: 8, monthly: 20 };

export type Lic = { token: string; admin: boolean; adminEmail?: boolean; status: 'trial' | 'paid' | 'expired' | 'admin'; entitled: boolean; trialEnd: number; paidUntil: number };
export const NO_LIC: Lic = { token: '', admin: false, status: 'expired', entitled: false, trialEnd: 0, paidUntil: 0 };

const deviceId = async () => {
  let d = await SecureStore.getItemAsync('device_id');
  if (!d) { d = Crypto.randomUUID(); await SecureStore.setItemAsync('device_id', d); }
  return d;
};
// The address can be changed inside the app (Settings > Server address), so a new tunnel or host never needs an app update.
let base = SERVER;
const SERVER_KEY = 'server_url';
export const getServer = () => base;
export async function loadServer() {
  const v = await SecureStore.getItemAsync(SERVER_KEY).catch(() => null);
  if (v) base = v;
}
// Returns an error message, or '' when saved. An empty string resets to the built-in address.
export async function setServer(raw: string): Promise<string> {
  const v = raw.trim().replace(/\/+$/, '');
  if (!v) { base = SERVER; await SecureStore.deleteItemAsync(SERVER_KEY).catch(() => {}); return ''; }
  if (!/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(v) && !/^https?:\/\/localhost/i.test(v)) return 'Enter the full address, for example https://your-name.trycloudflare.com';
  base = v; await SecureStore.setItemAsync(SERVER_KEY, v).catch(() => {});
  return '';
}
async function post(path: string, body: any, token = '') {
  if (base.includes('YOUR-SERVER-URL')) throw new Error('License server is not set up yet. Set the server address in Settings.');
  // A dead tunnel used to leave every screen waiting forever. Give up after 25 s with a message the user can act on.
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 25000);
  let r: Response;
  try {
    r = await fetch(base + path, { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
  } catch (e: any) {
    throw new Error(e?.name === 'AbortError' ? 'The server took too long to answer. Check your connection and try again.' : 'Cannot reach the server. Check your internet connection and try again.');
  } finally { clearTimeout(to); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || (r.status >= 500 ? 'The server is having a problem. Try again in a minute.' : 'Server error'));
  return j;
}
// idToken = the Firebase ID token of the signed-in user; the server verifies it and reads the email from it.
export const registerLic = async (idToken: string): Promise<Lic> => post('/register', { idToken, deviceId: await deviceId() });
export type AdminUser = { id?: string; email: string; status: 'paid' | 'trial' | 'expired'; trialEnd: number; paidUntil: number; created: number; last: number };
export type AdminPay = { txid: string; email: string; network: string; usd: number; days: number; at: number };
export type AdminStats = { users: number; paid: number; trial: number; expired: number; new24h: number; payments: number; revenue: number; keySet: boolean; model: string; list: AdminUser[]; pays: AdminPay[] };
export const adminStats = (token: string): Promise<AdminStats> => post('/admin/stats', {}, token);
export const adminGrant = (token: string, email: string, days: number) => post('/admin/grant', { email, days }, token);
export const submitPayment = (token: string, network: 'TRON' | 'BSC', txid: string): Promise<Lic> => post('/pay', { network, txid }, token);
export const saveServerKey = (token: string, key: string, model = '') => post('/admin/key', { key, model }, token);


// ---- cloud backup + profile (stored on the server, tied to the person, so it survives an uninstall) ----
export type CloudGet = { data: any | null; updatedAt: number; profile: { name: string; phone: string } };
export const cloudGet = (token: string): Promise<CloudGet> => post('/sync/get', {}, token);
export const cloudPut = (token: string, data: any): Promise<{ ok: boolean; updatedAt: number }> => post('/sync/put', { data }, token);
export const profilePut = (token: string, name: string, phone: string): Promise<{ ok: boolean; name: string; phone: string }> => post('/profile/put', { name, phone }, token);
export const accountDelete = (token: string, idToken: string): Promise<{ ok: boolean }> => post('/account/delete', { idToken }, token);

// ---- background alerts (push notifications sent by the server while the app is closed) ----
export const pushRegister = (token: string, expoToken: string) => post('/push/register', { token: expoToken }, token);
export const pushUnregister = (token: string, expoToken: string) => post('/push/unregister', { token: expoToken }, token);
export const pushTest = (token: string) => post('/push/test', {}, token);
export const alertsSync = (token: string, body: { alerts?: any[]; scan?: any }): Promise<{ ok: boolean; fired: string[]; scanner: boolean }> => post('/alerts/sync', body, token);
