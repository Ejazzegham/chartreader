import { Platform } from 'react-native';
import * as SecureStore from './secureStore';
import * as Crypto from 'expo-crypto';

// Put the public URL of server/server.js here (must be https for release builds).
export const SERVER = 'https://hardhat-unfasten-overture.ngrok-free.dev';
export const PAY = { TRON: 'TKvEQSzioWQGZBHdrzSLGWUnmQhJsEHUhA', BSC: '0xd7065772295fb0d563c1c6b00e4464bcd4b03f81' };
export const PLANS = { weekly: 8, monthly: 20 };
// The address people can write to. Emails sent here reach the admin panel (see EMAIL_TO_APP.md in the server folder).
export const SUPPORT_EMAIL = 'bahutechnology@gmail.com';
// The link friends get from "Invite friends" (Settings). Change it to your store page / website.
export const APP_DOWNLOAD_URL = 'https://play.google.com/store/apps/details?id=com.chartreader.app';

export type Lic = { token: string; admin: boolean; adminEmail?: boolean; status: 'trial' | 'paid' | 'expired' | 'admin'; entitled: boolean; trialEnd: number; paidUntil: number; now?: number; provisional?: boolean };
export const TRIAL_MS = 3 * 864e5; // same length as the server's TRIAL (server/server.js)
export const NO_LIC: Lic = { token: '', admin: false, status: 'expired', entitled: false, trialEnd: 0, paidUntil: 0 };

// ---- trial without the license server ----
// Signing up is done by Firebase (Google), not by our server. When our server is off, the account is created but the server never issued a trial,
// so the app stayed locked. Now the trial is also worked out on the phone from the date Firebase says the account was created (a Google clock,
// not the phone's). It is marked `provisional`: as soon as the server answers, its record replaces it (see refreshLic in store.tsx).
// A provisional license has no session token, so nothing that needs the server (cloud backup, background push, AI proxy) runs until the server is back.
export function localTrial(createdMs: number, now: number): Lic | null {
  if (!isFinite(createdMs) || createdMs <= 0 || !isFinite(now)) return null;
  const start = Math.min(createdMs, now); // an account cannot be created in the future. (A phone clock that is behind is corrected from Firebase's time right after sign-in, see grantLocalTrial in store.tsx.)
  const end = start + TRIAL_MS, left = now < end;
  return { token: '', admin: false, status: left ? 'trial' : 'expired', entitled: left, trialEnd: end, paidUntil: 0, provisional: true };
}
// An error that means "the server could not be reached or is broken" (not "the server said no"). Only these may start a provisional trial.
export const isNetworkError = (e: unknown): boolean => !!(e as any)?.network;

const deviceId = async () => {
  let d = await SecureStore.getItemAsync('device_id');
  if (!d) { d = Crypto.randomUUID(); await SecureStore.setItemAsync('device_id', d); }
  return d;
};
// ---- trusted clock ----
// The trial end is a date. If the app simply trusted the phone's clock, moving the date back would give free days.
// So: (1) the server's clock is used whenever the server answered, (2) the newest time ever seen is remembered and time never runs backwards.
let skew = 0, seen = 0;
const SEEN_KEY = 'seen_at';
export const trustedNow = (): number => { const n = Date.now() + skew; if (n > seen) seen = n; return seen; };
export const syncClock = (serverNow?: number) => { if (typeof serverNow === 'number' && serverNow > 1e12) { skew = serverNow - Date.now(); seen = serverNow; } }; // the server is the authority, also when the phone clock was wrong in the other direction
export async function loadClock() { const v = Number(await SecureStore.getItemAsync(SEEN_KEY).catch(() => '')); if (v > seen) seen = v; }
export const saveClock = () => { SecureStore.setItemAsync(SEEN_KEY, String(trustedNow())).catch(() => {}); };

// The address can be changed inside the app (Settings > Server address), so a new tunnel or host never needs an app update.
// The website does NOT call the server address directly: browsers block that (CORS, and the free ngrok page that stops browsers). Its calls go to the
// same address as the page (/srv/...), and Vercel / Netlify pass them on to the server (see vercel.json / netlify.toml). A custom address set in
// Settings still works and is called directly. The phone calls the server directly as before.
export const IS_WEB_APP = Platform.OS === 'web';
export const WEB_BASE = '/srv';
const DEFAULT_BASE = IS_WEB_APP ? WEB_BASE : SERVER;
export const deviceKind: 'web' | 'mobile' = IS_WEB_APP ? 'web' : 'mobile'; // one email may be signed in on one phone and one computer at a time
let base = DEFAULT_BASE;
// Called when the server says this device was signed out because the same email signed in on another device of the same kind.
let onReplaced: ((msg: string) => void) | null = null, replacedFired = 0;
export const setReplacedHandler = (f: ((msg: string) => void) | null) => { onReplaced = f; };
const SERVER_KEY = 'server_url';
export const getServer = () => base;
export async function loadServer() {
  const v = await SecureStore.getItemAsync(SERVER_KEY).catch(() => null);
  if (v) base = v;
}
// Returns an error message, or '' when saved. An empty string resets to the built-in address.
export async function setServer(raw: string): Promise<string> {
  const v = raw.trim().replace(/\/+$/, '');
  if (!v) { base = DEFAULT_BASE; await SecureStore.deleteItemAsync(SERVER_KEY).catch(() => {}); return ''; }
  if (!/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(v) && !/^https?:\/\/localhost/i.test(v)) return 'Enter the full address, for example https://your-name.trycloudflare.com';
  base = v; await SecureStore.setItemAsync(SERVER_KEY, v).catch(() => {});
  return '';
}
async function post(path: string, body: any, token = '', ms = 25000) {
  const net = (m: string) => Object.assign(new Error(m), { network: true }); // marks "server not reachable" so the app can carry on offline (see localTrial)
  if (base.includes('YOUR-SERVER-URL')) throw net('License server is not set up yet. Set the server address in Settings.');
  // A dead tunnel used to leave every screen waiting forever. Give up after 25 s with a message the user can act on.
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), ms);
  let r: Response;
  try {
    r = await fetch(base + path, { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
  } catch (e: any) {
    throw net(e?.name === 'AbortError' ? 'The server took too long to answer. Check your connection and try again.' : 'Cannot reach the server. Check your internet connection and try again.');
  } finally { clearTimeout(to); }
  const j = await r.json().catch(() => null);
  // Our server always answers in JSON. An HTML page (ngrok "tunnel offline", a proxy error) or a 5xx means the server itself is not there.
  if (j === null || r.status >= 500) throw net(r.status >= 500 ? 'The server is having a problem. Try again in a minute.' : 'The server is not running right now. Try again in a minute.');
  if (!r.ok) {
    const err = Object.assign(new Error(j.error || 'Server error'), j.code ? { code: String(j.code) } : {});
    if (r.status === 401 && j.code === 'replaced' && onReplaced && Date.now() - replacedFired > 10000) { replacedFired = Date.now(); onReplaced(err.message); } // signs this device out once, with the reason
    throw err;
  }
  return j;
}
// Account emails (reset password, confirm email, change email) in our own design. They are sent by a Netlify Function,
// NOT by the license server, so they work even when your server is switched off.
export const AUTH_MAIL_URL = 'https://genuine-pika-2ac700.netlify.app/.netlify/functions/auth-mail';
// false = never use Firebase's own plain email. If Netlify cannot send, the person sees an error and can try again.
// Website: if our own email design cannot be sent (function not reachable from the browser, server mail not set up), Firebase sends its built-in email instead,
// so "Reset password" and "Confirm email" always work. The phone keeps showing an error (it never needed the fallback).
export const AUTH_MAIL_FIREBASE_FALLBACK = IS_WEB_APP;
// 'fallback' = Netlify is not set up / not reachable; the caller decides what to do (see AUTH_MAIL_FIREBASE_FALLBACK).
export const authMail = async (kind: 'reset' | 'verify' | 'change-email', body: any): Promise<'sent' | 'limited' | 'fallback'> => {
  if (AUTH_MAIL_URL.includes('YOUR-SITE')) return 'fallback';
  // The website calls /mailer on its own address (Vercel / Netlify pass it on to the Netlify function), because a browser may not call
  // another site's function unless that function allows it. The phone calls the function directly.
  const url = IS_WEB_APP ? '/mailer' : AUTH_MAIL_URL;
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(url, { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, ...body }) });
    if (r.status === 429) return 'limited';
    if (r.ok) return 'sent';
  } catch { /* the function could not be reached: try the licence server's own mail route below */ } finally { clearTimeout(to); }
  try { await post('/auth/' + kind, body, '', 12000); return 'sent'; } // the server sends the same email when it is set up for it (server/BRANDED_EMAILS.md)
  catch (e: any) { return /too many|limit/i.test(String(e?.message)) ? 'limited' : 'fallback'; }
};
// idToken = the Firebase ID token of the signed-in user; the server verifies it and reads the email from it.
// accountCreated = when Firebase created the account (ms). The server uses it so a trial that already ran offline is not started again from zero.
export const registerLic = async (idToken: string, accountCreated?: number, fresh = false): Promise<Lic> => post('/register', { idToken, deviceId: await deviceId(), kind: deviceKind, fresh, ...(accountCreated && accountCreated > 0 ? { accountCreated } : {}) }); // fresh = the person has just typed their password / used Google here
export type AdminUser = { id?: string; email: string; status: 'paid' | 'trial' | 'expired'; trialEnd: number; paidUntil: number; created: number; last: number };
export type PayStatus = 'review' | 'approved' | 'rejected';
export type AdminPay = { txid: string; pid?: string; email: string; network: string; usd: number; days: number; at: number; status: PayStatus; wallet: string; plan: string; suggest: number; verified: boolean; from: string; note: string; decidedAt: number };
export type AdminStats = { users: number; paid: number; trial: number; expired: number; new24h: number; payments: number; pending: number; chats: number; revenue: number; keySet: boolean; model: string; list: AdminUser[]; pays: AdminPay[] };
export const adminStats = (token: string): Promise<AdminStats> => post('/admin/stats', {}, token);
export const adminGrant = (token: string, email: string, days: number) => post('/admin/grant', { email, days }, token);
// A payment is a CLAIM: the TxID and the wallet it was sent from. The admin approves it; only then are days added.
export const submitPayment = (token: string, network: 'TRON' | 'BSC', txid: string, wallet: string, plan: 'weekly' | 'monthly'): Promise<{ status: 'review'; txid: string }> => post('/pay', { network, txid, wallet, plan }, token);
export type MyPay = { txid: string; network: 'TRON' | 'BSC'; status: PayStatus; usd: number; days: number; at: number; plan: string; note: string };
export const myPayments = (token: string): Promise<{ pays: MyPay[] }> => post('/pay/mine', {}, token);
export const adminPayDecide = (token: string, txid: string, action: 'approve' | 'reject', days?: number, note?: string) => post('/admin/pay/decide', { txid, action, days, note }, token);

// ---- support chat (works while the app is locked, too) ----
export type ChatMedia = { id: string; kind: 'image' | 'video'; mime: string; size: number };
export type ChatMsg = { id: number; from: 'user' | 'admin'; text: string; at: number; via?: string; media?: ChatMedia };
export const supportSend = (token: string, text: string, media = ''): Promise<{ message: ChatMsg }> => post('/support/send', { text, media }, token);
// Photo / video of the chat. The file is sent as raw bytes (not base64 inside JSON), so a video of 25 MB does not become 33 MB of text.
export const mediaUrl = (m: ChatMedia) => `${base}/media/${m.id}`;
export const MEDIA_HEADERS = { 'ngrok-skip-browser-warning': '1' };
export async function uploadChatMedia(token: string, uri: string): Promise<ChatMedia> {
  if (base.includes('YOUR-SERVER-URL')) throw new Error('License server is not set up yet. Set the server address in Settings.');
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 180000); // a video on a slow mobile line can take minutes
  try {
    const blob = await (await fetch(uri)).blob();
    const r = await fetch(base + '/support/upload', { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/octet-stream', Authorization: 'Bearer ' + token, ...MEDIA_HEADERS }, body: blob });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || (r.status >= 500 ? 'The server is having a problem. Try again in a minute.' : 'Upload failed'));
    return j.media;
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error('The upload took too long. Check your connection and try again.');
    if (e instanceof TypeError || /Network request failed/i.test(e?.message ?? '')) throw new Error('Cannot reach the server. Check your internet connection and try again.');
    throw e;
  } finally { clearTimeout(to); }
}
export const supportPull = (token: string, since: number): Promise<{ msgs: ChatMsg[]; unread: number; seq: number }> => post('/support/pull', { since }, token);
export const supportRead = (token: string) => post('/support/read', {}, token);
export type Translated = { text: string; from: string; to: string; same: boolean };  // from = English name of the language the text was written in; same = it was already in the target language
export const translateText = (token: string, text: string, to: string): Promise<Translated> => post('/translate', { text, to }, token);
export type ChatThread = { key: string; email: string; name: string; guest: boolean; unread: number; last: { from: 'user' | 'admin'; text: string; at: number } };
export const adminBadge = (token: string): Promise<{ chats: number; pays: number }> => post('/admin/badge', {}, token);
export const adminChats = (token: string): Promise<{ threads: ChatThread[]; unread: number }> => post('/admin/support/list', {}, token);
export const adminChat = (token: string, key: string): Promise<{ key: string; email: string; name: string; phone: string; guest: boolean; msgs: ChatMsg[] }> => post('/admin/support/thread', { key }, token);
export const adminChatReply = (token: string, key: string, text: string, media = ''): Promise<{ message: ChatMsg }> => post('/admin/support/reply', { key, text, media }, token);
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

// ---- notification inbox: everything the server sent, so a push that arrived while the app was closed (or was swiped away) is still in the bell ----
// setups: the A / A+ setups behind a scanner notification (entry, stop, 3 targets). The app copies them into the Journal.
export type InboxSetup = { symId: string; name: string; side: 'buy' | 'sell'; entry: number; sl: number; tps: number[]; score: number; grade: string; basis?: string; zone?: [number, number]; why?: string[]; tf?: number | string };
export type InboxItem = { id: number; at: number; title: string; body: string; type: string; sym?: string; setups?: InboxSetup[] };
export const inboxPull = (token: string, since: number): Promise<{ items: InboxItem[]; seq: number; ack: number; unread: number }> => post('/inbox/pull', { since }, token);
export const inboxAck = (token: string, upTo: number): Promise<{ ok: boolean; unread: number }> => post('/inbox/ack', { upTo }, token);
