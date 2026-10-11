import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from './secureStore';
import * as Crypto from 'expo-crypto';
import { themeFor, Theme } from './theme';
import { STR, Lang } from './i18n';
import type { MarketAI } from './gemini';
import { Lic, NO_LIC, registerLic, loadServer, cloudGet, cloudPut, profilePut, accountDelete } from './license';
import { auth } from './firebase';
import { remote } from './remote';
import { initPush, registerPush, unregisterPush, PushState } from './push';
import { Signal, Desk, DESK0, Ev, CloseSetup, step, closeNow, partialClose as partialClosePos, isDuplicate, isOldDemoDesk, liveOpposite, dropOpposite, reconcile, Skipped, isSkipped, pruneSkipped, liveSame, wasTaken, TAKEN_HOURS } from './trades';
import { Vibration, AppState } from 'react-native';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, sendPasswordResetEmail, reauthenticateWithCredential, EmailAuthProvider, updatePassword, verifyBeforeUpdateEmail, deleteUser, sendEmailVerification } from 'firebase/auth';

export type Item = { id: string; date: number; result: MarketAI; symbol?: string; tf?: string }; // a saved "Analysis of this chart"
export type Prefill = { entry: number; sl: number; tps: number[]; symbol?: string };
// Closed trades. Rows made by the trade desk also carry the extra fields (r, source, grade ...). Old hand-typed rows have none of them.
export type Trade = { id: string; date: number; symbol: string; side: 'buy' | 'sell'; entry: number; exit: number; size: number; pnl: number; note: string;
  lots?: number; r?: number; source?: string; grade?: string; tf?: string; openedAt?: number; hits?: number; risk?: number; mfe?: number; mae?: number; why?: 'sl' | 'be' | 'tp' | 'manual'; tag?: string; dec?: number };
export type Toast = { id: string; text: string; kind: 'good' | 'bad' | 'info' };
// One line in the bell's notification list. `read` turns true the moment the list has been opened.
export type Note = { id: string; text: string; kind: 'good' | 'bad' | 'info'; at: number; read: boolean };
// A loud alert that rings until the trader answers it. 'tp': a take profit was reached. 'setup': the scanner found strong setups.
export type AlarmItem = { symId: string; name: string; side: 'buy' | 'sell'; score: number; grade: string; entry: number; dec: number };
export type Alarm = { id: string; kind: 'tp' | 'setup'; title: string; text: string; symId?: string; sigId?: string; items?: AlarmItem[]; at: number };
export type NewSignal = Pick<Signal, 'symId' | 'name' | 'side' | 'entry' | 'sl' | 'tps' | 'tf' | 'dec' | 'source' | 'grade' | 'score' | 'armed'> & Partial<Pick<Signal, 'why' | 'zone' | 'level'>>;
// salt/hash are only present on accounts created before Firebase; they are used once to upgrade the account, then removed.
type Account = { name: string; email: string; phone?: string; uid?: string; salt?: string; hash?: string; pinSalt?: string; pinHash?: string };
const errKey = (code?: string) => code === 'auth/email-already-in-use' ? 'errInUse' : code === 'auth/network-request-failed' ? 'errNetwork' : code === 'auth/too-many-requests' ? 'errMany' : code === 'auth/requires-recent-login' ? 'errRecent' : code === 'auth/weak-password' || code === 'auth/invalid-email' ? 'errFields' : 'errLogin';
type Settings = { theme: string; lang: Lang; model: string; nav: 'bottom' | 'side'; bio: boolean };
// A fresh install opens in Glass Frost (the bright glass theme). People who already picked a theme keep it (it is saved in their settings).
const DEFAULTS: Settings = { theme: 'glassFrost', lang: 'en', model: 'gemini-3.8-flash', nav: 'bottom', bio: false };

// Read one saved value. A damaged entry gives the fallback instead of stopping everything that loads after it
// (before, one bad value could leave the journal empty, and the next save would then overwrite the real journal).
async function load<T>(key: string, fallback: T, secure = false): Promise<T> {
  try {
    const raw = secure ? await SecureStore.getItemAsync(key) : await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}
const RELOCK_MS = 2 * 60 * 1000; // the PIN is asked again after the app was in the background this long
const PIN_FAILS_KEY = 'pin_fails';

const sha = (salt: string, v: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, salt + v);
const newSalt = () => Array.from(Crypto.getRandomBytes(16)).map((b) => b.toString(16).padStart(2, '0')).join('');

type Ctx = {
  th: Theme; t: (k: string) => string; rtl: boolean; ready: boolean;
  settings: Settings; setSettings: (p: Partial<Settings>) => void;
  apiKey: string; live: boolean; avatar: string; setAvatar: (uri: string | null) => void; lic: Lic; licErr: string; setLic: (l: Lic) => void; refreshLic: () => Promise<boolean>;
  histOpen: boolean; setHistOpen: (v: boolean) => void; // the Trade history window (sidebar, Home and Journal open it)
  adminOpen: boolean; setAdminOpen: (v: boolean) => void; // the admin panel can be opened from the sidebar, Home or Settings
  history: Item[]; addItem: (r: MarketAI, symbol?: string, tf?: string) => void; removeItem: (id: string) => void; clearHistory: () => void;
  journal: Trade[]; addTrade: (t: Omit<Trade, 'id' | 'date'>) => void; removeTrade: (id: string) => void; updateTrade: (id: string, p: Partial<Trade>) => void;
  // Trade desk: analysis screens log setups, the Journal lets the user take or cancel them, the tracker follows live prices.
  signals: Signal[]; desk: Desk; setDesk: (p: Partial<Desk>) => void;
  logSignal: (n: NewSignal) => void; proposeSignal: (n: NewSignal) => { id: string | null; err?: string }; skipSetup: (n: NewSignal) => void; unskipSetup: (n: NewSignal) => void; skippedCount: number; setupHandled: (n: Pick<NewSignal, 'symId' | 'source' | 'side' | 'entry' | 'sl'>) => 'taken' | 'skipped' | null;
  takeSignal: (id: string, mode: 'market' | 'limit', price: number | undefined, lots: number, perPt: number, setup?: CloseSetup) => string | null;
  notes: Note[]; notesOpen: boolean; setNotesOpen: (v: boolean) => void; markNotesRead: () => void; clearNotes: () => void; removeNote: (id: string) => void; // the bell: every alert, kept until cleared
  partialClose: (id: string, price: number, part: number) => void; ackTp: (id: string) => void;
  pushState: { state: PushState | 'off'; msg?: string }; startPush: () => Promise<{ state: PushState; msg?: string }>;
  alarms: Alarm[]; raiseAlarm: (a: Omit<Alarm, 'at'>) => void; dismissAlarm: (id: string) => void; cancelSignal: (id: string) => void;
  closeSignal: (id: string, price: number) => void; breakEven: (id: string, price?: number) => string | null; clearSignals: () => void; track: (prices: Record<string, number>) => void;
  toasts: Toast[]; toast: (text: string, kind?: Toast['kind']) => void; dismissToast: (id: string) => void;
  account: Account | null; loggedIn: boolean; locked: boolean; covered: boolean;
  emailVerified: boolean; sendVerify: () => Promise<string | null>;
  // signup / login / resetPassword return null on success, or the key of an error message.
  signup: (name: string, email: string, pw: string) => Promise<string | null>; enter: () => void;
  login: (email: string, pw: string, remember: boolean) => Promise<string | null>;
  resetPassword: (email: string) => Promise<string | null>;
  changePassword: (current: string, next: string) => Promise<string | null>;
  logout: () => void; resetAccount: () => Promise<void>;
  // Cloud backup of the paper-trading data, profile editing and account deletion. The three functions return null on success or a message to show.
  cloud: { status: 'idle' | 'restoring' | 'saving' | 'saved' | 'error'; at: number }; syncNow: () => Promise<void>;
  saveProfile: (name: string, phone: string) => Promise<string | null>; changeEmail: (newEmail: string, currentPw: string) => Promise<string | null>; deleteAccount: (currentPw: string) => Promise<string | null>;
  setPin: (pin: string | null) => Promise<void>; checkPin: (pin: string) => Promise<boolean>; pinWait: () => number;
  tab: number; setTab: (i: number) => void;
  menu: boolean; setMenu: (v: boolean) => void;
  prefill: Prefill | null; setPrefill: (p: Prefill | null) => void;
  asym: string | null; setAsym: (id: string | null) => void; // pair another page wants the Analysis tab to open
  bioUnlock: () => void; lockNow: () => void;
  amethod: string; setAmethod: (m: string) => void; // method open in the Analysis tab (lets other pages jump to it)
};
const C = createContext<Ctx>(null as any);
export const useApp = () => useContext(C);

export function Provider({ children }: { children: React.ReactNode }) {
  const [settings, _set] = useState<Settings>(DEFAULTS);
  const [lic, _lic] = useState<Lic>(NO_LIC);
  const [licErr, setLicErr] = useState('');
  const [avatar, _avatar] = useState('');
  const [history, _hist] = useState<Item[]>([]);
  const [journal, _jr] = useState<Trade[]>([]);
  const [signals, _sg] = useState<Signal[]>([]);
  const [desk, _desk] = useState<Desk>(DESK0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const sgRef = useRef<Signal[]>([]), jrRef = useRef<Trade[]>([]), deskRef = useRef<Desk>(DESK0), seen = useRef<Set<string>>(new Set());
  const histRef = useRef<Item[]>([]), setRef = useRef<Settings>(DEFAULTS);
  const pinFails = useRef({ n: 0, until: 0 });
  const pushRef = useRef<(now?: boolean) => void>(() => {}), syncEmailRef = useRef<() => Promise<void>>(async () => {});
  const refreshRef = useRef<() => Promise<boolean>>(async () => false), watchRef = useRef({ in: false, verified: true, adminEmail: false, admin: false });
  // ---- cloud backup: a copy of the journal, setups, desk, history and settings lives on the server, tied to the person.
  // After an uninstall + reinstall the data comes back at login. Nothing is pushed until the first pull of this login has finished,
  // so an empty fresh install can never overwrite the real backup.
  const accRef = useRef<Account | null>(null), avatarRef = useRef('');
  const cloudOk = useRef(false), pushTimer = useRef<any>(null), tokRef = useRef(''), restoring = useRef(false);
  const [cloud, setCloud] = useState<{ status: 'idle' | 'restoring' | 'saving' | 'saved' | 'error'; at: number }>({ status: 'idle', at: 0 });
  const bgAt = useRef(0), lockInfo = useRef<{ pin: boolean; in: boolean }>({ pin: false, in: false });
  const [account, _acc] = useState<Account | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [locked, setLocked] = useState(false);
  const [covered, setCovered] = useState(false); // PIN screen laid OVER the running app (after a while in the background), so charts and forms keep their state
  const [emailVerified, setEmailVerified] = useState(true); // true until we know better, so the reminder never flashes up
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState(0);
  const [menu, setMenu] = useState(false);
  const [amethod, setAmethod] = useState(''); // '' = the Analysis landing page, otherwise the open method
  const [asym, setAsym] = useState<string | null>(null);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [skipped, _skip] = useState<Skipped[]>([]);
  const skipRef = useRef<Skipped[]>([]);
  const [adminOpen, setAdminOpen] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [notes, _notes] = useState<Note[]>([]);
  const notesRef = useRef<Note[]>([]);
  const [notesOpen, setNotesOpen] = useState(false);
  const [prefill, setPrefill] = useState<Prefill | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const st = await load<Partial<Settings> | null>('settings', null);
        if (st && typeof st === 'object') { const n = { ...DEFAULTS, ...st }; setRef.current = n; _set(n); }
        const h = await load<Item[]>('history', []); if (Array.isArray(h)) { const ok = h.filter((i) => i?.result && typeof (i.result as any).bias === 'string' && Array.isArray(i.result.takeProfits)); histRef.current = ok; _hist(ok); } // old screenshot analyses have another shape and are dropped
        const j = await load<Trade[]>('journal', []); if (Array.isArray(j)) { _jr(j); jrRef.current = j; }
        const sg = await load<Signal[]>('signals', []); if (Array.isArray(sg)) { const clean = reconcile(sg); _sg(clean); sgRef.current = clean; if (clean.length !== sg.length) AsyncStorage.setItem('signals', JSON.stringify(clean)).catch(() => {}); }
        const nt = await load<Note[]>('notes', []); if (Array.isArray(nt)) { const ok = nt.filter((x) => x && typeof x.text === 'string').slice(0, 60); notesRef.current = ok; _notes(ok); }
        const sk = await load<Skipped[]>('skipped', []); if (Array.isArray(sk)) { const k = pruneSkipped(sk); skipRef.current = k; _skip(k); }
        const dk = await load<Partial<Desk> | null>('desk', null); if (dk && typeof dk === 'object') { const x = isOldDemoDesk(dk) ? { ...DESK0, ...dk, balance: 0, riskPct: 0, dailyLossPct: 0, maxOpen: 0 } : { ...DESK0, ...dk }; _desk(x); deskRef.current = x; } // old pre-filled demo numbers are cleared
        try { const av = await AsyncStorage.getItem('avatar'); if (av) { _avatar(av); avatarRef.current = av; } } catch {}
        SecureStore.deleteItemAsync('gemini_key').catch(() => {}); // old local key is no longer used
        SecureStore.deleteItemAsync('admin_code').catch(() => {}); // the admin passcode no longer exists
        await loadServer(); // a server address typed in Settings wins over the built-in one
        const lc = await load<Lic | null>('lic', null, true); if (lc && typeof lc === 'object') _lic(lc);
        const a = await load<Account | null>('account', null, true); if (a && typeof a === 'object') _acc(a);
        const pf = await load<{ n: number; until: number }>(PIN_FAILS_KEY, { n: 0, until: 0 }, true); if (pf && isFinite(pf.n) && isFinite(pf.until)) pinFails.current = pf;
        await auth.authStateReady(); // Firebase restores the saved login from the phone
        if (a && auth.currentUser && (await SecureStore.getItemAsync('remember')) === '1') { setLoggedIn(true); setLocked(!!a.pinHash || !!setRef.current.bio); accRef.current = a; syncEmailRef.current().finally(() => refreshLic()); }
      } catch {}
      setReady(true);
    })();
  }, []);

  tokRef.current = lic.token; accRef.current = account;
  watchRef.current = { in: loggedIn, verified: emailVerified, adminEmail: !!lic.adminEmail, admin: lic.admin };
  // Ask for the PIN again when the app comes back after a while in the background.
  lockInfo.current = { pin: !!account?.pinHash || settings.bio, in: loggedIn }; // a PIN or the fingerprint lock
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'background') { if (!bgAt.current) bgAt.current = Date.now(); pushRef.current(true); return; }
      if (st !== 'active') return;
      const away = bgAt.current ? Date.now() - bgAt.current : 0; bgAt.current = 0;
      // Back from the mailbox after tapping the confirmation link: check again, so admin unlocks by itself.
      if (watchRef.current.in) syncEmailRef.current();
      const w = watchRef.current; if (w.in && (!w.verified || (w.adminEmail && !w.admin))) refreshRef.current();
      if (away > RELOCK_MS && lockInfo.current.pin && lockInfo.current.in) setCovered(true);
    });
    return () => sub.remove();
  }, []);

  const setSettings = (p: Partial<Settings>) => {
    const n = { ...setRef.current, ...p };
    setRef.current = n;
    _set(n);
    AsyncStorage.setItem('settings', JSON.stringify(n)).catch(() => {}); schedulePush();
  };
  const setLic = (l: Lic) => { _lic(l); SecureStore.setItemAsync('lic', JSON.stringify(l)).catch(() => {}); };
  // Asks the server who this account is. Admin rights come from a confirmed admin email: no code to type.
  const refreshLic = async () => {
    try {
      const u = auth.currentUser;
      // Bug fix (kept): remember "unverified" BEFORE reload(), otherwise the token is not refreshed after the link was tapped and the server keeps seeing email_verified=false.
      const wasUnverified = !!u && !u.emailVerified;
      if (wasUnverified) await u!.reload().catch(() => {});
      const idToken = await u?.getIdToken(wasUnverified); // a fresh token carries the new "email confirmed" flag
      if (!idToken) throw new Error('Please log in again');
      setEmailVerified(!!u?.emailVerified);
      const l = await registerLic(idToken);
      setLic(l); setLicErr(''); tokRef.current = l.token;
      if (!cloudOk.current) restoreCloud(); // first contact of this login: bring the backup back
      return true;
    } catch (e) {
      setLicErr(String((e as Error).message || 'Cannot reach the license server')); // shown in Settings so a wrong SERVER url or a down server is visible
      return false;
    }
  };
  refreshRef.current = refreshLic;
  // Re-check the dates on the phone too, so an expired trial stops working even offline. The server checks again.
  const live = lic.status === 'admin' || (lic.entitled && Date.now() < Math.max(lic.trialEnd, lic.paidUntil));
  // Background alerts: once logged in with a valid session, register this phone for push and keep the server's copy of the alerts current.
  const [pushState, setPushState] = useState<{ state: PushState | 'off'; msg?: string }>({ state: 'off' });
  const startPush = async () => { const r = await registerPush(lic.token); setPushState(r); return r; };
  useEffect(() => {
    initPush();
    if (loggedIn && lic.token && live) { remote.setToken(lic.token); registerPush(lic.token).then(setPushState); }
    else remote.setToken('');
  }, [loggedIn, lic.token, live]);
  const apiKey = live ? lic.token : ''; // session token for the server proxy; empty once the trial ends

  // ---- cloud backup (see the note near the refs) ----
  const snapshot = () => ({ v: 1, journal: jrRef.current, signals: sgRef.current, desk: deskRef.current, history: histRef.current.slice(0, 30), skipped: skipRef.current, settings: { theme: setRef.current.theme, lang: setRef.current.lang, nav: setRef.current.nav }, avatar: avatarRef.current });
  const pushNow = async () => {
    clearTimeout(pushTimer.current); pushTimer.current = null;
    if (!tokRef.current) return;
    if (!cloudOk.current) { await restoreCloud(); if (!cloudOk.current) return; }
    setCloud((c) => ({ ...c, status: 'saving' }));
    try { await cloudPut(tokRef.current, snapshot()); setCloud({ status: 'saved', at: Date.now() }); } catch { setCloud((c) => ({ ...c, status: 'error' })); }
  };
  const schedulePush = () => { if (!tokRef.current) return; clearTimeout(pushTimer.current); pushTimer.current = setTimeout(pushNow, 2500); };
  pushRef.current = (now) => { if (now) { if (pushTimer.current) pushNow(); } else schedulePush(); };
  // Pull the backup. Anything already on this phone is kept: the two are merged by id (so nothing is lost either way).
  // A fresh install has nothing local, so it simply gets everything back, including the desk balance, theme, language and photo.
  async function restoreCloud() {
    const tok = tokRef.current;
    if (!tok || restoring.current) return;
    restoring.current = true; setCloud((c) => ({ ...c, status: 'restoring' }));
    try {
      const r = await cloudGet(tok), d = r.data;
      const fresh = !jrRef.current.length && !sgRef.current.length && !histRef.current.length && !(deskRef.current.balance > 0);
      if (d && typeof d === 'object') {
        const union = <T extends { id: string }>(local: T[], remote: any): T[] => { const m = new Map<string, T>(local.map((x) => [x.id, x])); (Array.isArray(remote) ? remote : []).forEach((x: any) => { if (x && typeof x.id === 'string' && !m.has(x.id)) m.set(x.id, x); }); return [...m.values()]; };
        const jr = union<Trade>(jrRef.current, d.journal).sort((a, b) => b.date - a.date);
        if (jr.length !== jrRef.current.length) saveJr(jr);
        const sg = reconcile(union<Signal>(sgRef.current, d.signals)).sort((a, b) => b.date - a.date);
        if (sg.length !== sgRef.current.length) saveSg(sg);
        const hs = union<Item>(histRef.current, d.history).filter((i) => i?.result && typeof (i.result as any).bias === 'string' && Array.isArray(i.result.takeProfits)).sort((a, b) => b.date - a.date).slice(0, 100);
        if (hs.length !== histRef.current.length) saveHist(hs);
        if (d.desk && typeof d.desk === 'object' && !(deskRef.current.balance > 0) && Number(d.desk.balance) > 0) setDesk({ ...DESK0, ...d.desk });
        if (fresh && d.settings && typeof d.settings === 'object') setSettings({ theme: d.settings.theme ?? setRef.current.theme, lang: d.settings.lang ?? setRef.current.lang, nav: d.settings.nav ?? setRef.current.nav });
        if (d.avatar && typeof d.avatar === 'string' && !avatarRef.current) setAvatar(d.avatar);
      }
      const a = accRef.current, pr = r.profile;
      if (a && pr && ((pr.name && pr.name !== a.name) || (pr.phone && pr.phone !== a.phone))) await saveAcc({ ...a, name: pr.name || a.name, phone: pr.phone || a.phone });
      cloudOk.current = true; setCloud({ status: 'saved', at: r.updatedAt || Date.now() });
      schedulePush(); // writes the merged result back (also fills the backup for people who had data before this feature existed)
    } catch { setCloud((c) => ({ ...c, status: 'error' })); }
    restoring.current = false;
  }
  const syncNow = async () => { if (!cloudOk.current) await restoreCloud(); else await pushNow(); };

  // Profile picture: a small square JPEG kept on this phone as a data uri. null removes it.
  const setAvatar = (uri: string | null) => { _avatar(uri ?? ''); avatarRef.current = uri ?? ''; schedulePush(); if (uri) AsyncStorage.setItem('avatar', uri).catch(() => {}); else AsyncStorage.removeItem('avatar').catch(() => {}); };
  const saveHist = (h: Item[]) => { histRef.current = h; _hist(h); AsyncStorage.setItem('history', JSON.stringify(h)).catch(() => {}); schedulePush(); };
  const addItem = (r: MarketAI, symbol?: string, tf?: string) => saveHist([{ id: String(Date.now()) + Math.floor(Math.random() * 1000), date: Date.now(), result: r, symbol, tf }, ...histRef.current].slice(0, 100)); // keep the newest 100 so storage never fills up
  const removeItem = (id: string) => saveHist(histRef.current.filter((i) => i.id !== id));
  const clearHistory = () => saveHist([]);

  const saveJr = (j: Trade[]) => { jrRef.current = j; _jr(j); AsyncStorage.setItem('journal', JSON.stringify(j)).catch(() => {}); schedulePush(); };
  const addTrade = (x: Omit<Trade, 'id' | 'date'>) => saveJr([{ ...x, id: String(Date.now()) + Math.floor(Math.random() * 1000), date: Date.now() }, ...jrRef.current]);
  const removeTrade = (id: string) => saveJr(jrRef.current.filter((x) => x.id !== id));
  const updateTrade = (id: string, p: Partial<Trade>) => saveJr(jrRef.current.map((x) => (x.id === id ? { ...x, ...p } : x)));

  // ---- trade desk ----
  const saveSg = (l: Signal[]) => { sgRef.current = l; _sg(l); AsyncStorage.setItem('signals', JSON.stringify(l)).catch(() => {}); schedulePush(); };
  const setDesk = (p: Partial<Desk>) => { const n = { ...deskRef.current, ...p }; deskRef.current = n; _desk(n); AsyncStorage.setItem('desk', JSON.stringify(n)).catch(() => {}); schedulePush(); };
  const toast = (text: string, kind: Toast['kind'] = 'info') => {
    const id = String(Date.now()) + Math.floor(Math.random() * 1000);
    setToasts((l) => [...l.slice(-2), { id, text, kind }]);
    setTimeout(() => setToasts((l) => l.filter((x) => x.id !== id)), 5200);
  };
  const dismissToast = (id: string) => setToasts((l) => l.filter((x) => x.id !== id));
  // The bell list. Newest first, 60 at most, kept on this phone until the person clears it.
  const saveNotes = (l: Note[]) => { notesRef.current = l; _notes(l); AsyncStorage.setItem('notes', JSON.stringify(l)).catch(() => {}); };
  const note = (text: string, kind: Note['kind'] = 'info') => saveNotes([{ id: String(Date.now()) + Math.floor(Math.random() * 1000), text, kind, at: Date.now(), read: false }, ...notesRef.current].slice(0, 60));
  const markNotesRead = () => { if (notesRef.current.some((x) => !x.read)) saveNotes(notesRef.current.map((x) => (x.read ? x : { ...x, read: true }))); };
  const clearNotes = () => saveNotes([]);
  const removeNote = (id: string) => saveNotes(notesRef.current.filter((x) => x.id !== id));
  const equityNow = () => deskRef.current.balance + jrRef.current.reduce((a, j) => a + j.pnl, 0);

  // Analysis screens call this with their best setup. Duplicates (same pair / method / side, nearly the same entry) only refresh the old one.
  const saveSkip = (l: Skipped[]) => { const k = pruneSkipped(l); skipRef.current = k; _skip(k); AsyncStorage.setItem('skipped', JSON.stringify(k)).catch(() => {}); };
  const valid = (n: NewSignal) => isFinite(n.entry) && isFinite(n.sl) && n.entry !== n.sl && !!n.tps.length && (n.side === 'buy' ? n.sl < n.entry : n.sl > n.entry);
  // Adds the setup (or refreshes the same one). One direction per pair: a trade already running or waiting for its entry blocks the other side,
  // and a newer analysis replaces older untouched setups that point the other way. Returns the id of the setup, or why it was refused.
  const add = (n: NewSignal): { id: string | null; err?: string } => {
    if (!valid(n)) return { id: null, err: 'This setup has no valid entry and stop.' };
    const same = liveSame(sgRef.current, n.symId, n.side);
    if (same) return { id: same.id }; // that trade is already running (or waiting): never list it again
    const opp = liveOpposite(sgRef.current, n.symId, n.side);
    if (opp) return { id: null, err: `You already have a ${opp.side.toUpperCase()} ${opp.status === 'open' ? 'running' : 'order waiting'} on ${n.name}. A ${n.side.toUpperCase()} on the same pair would work against it. Close or cancel it first.` };
    const list = dropOpposite(sgRef.current, n.symId, n.side), dup = isDuplicate(list, n);
    if (dup) {
      if (dup.status !== 'signal') return { id: dup.id };
      const next = list.map((x) => (x.id === dup.id ? { ...x, score: n.score, grade: n.grade, armed: n.armed } : x));
      if (next.length !== sgRef.current.length || dup.score !== n.score || dup.grade !== n.grade || dup.armed !== n.armed) saveSg(next);
      return { id: dup.id };
    }
    const sig: Signal = { ...n, id: String(Date.now()) + Math.floor(Math.random() * 1000), date: Date.now(), status: 'signal', risk: 0, stop: n.sl, hits: 0, done: 0, banked: 0, mfe: 0, mae: 0 };
    const fresh = list.filter((x) => x.status === 'signal');
    const keep = fresh.length >= 30 ? list.filter((x) => x.id !== fresh[fresh.length - 1].id) : list; // newest first, drop the oldest untouched one
    saveSg([sig, ...keep]);
    return { id: sig.id };
  };
  // Automatic logging by the analysis screens (respects the Journal options and skipped setups).
  const logSignal = (n: NewSignal) => {
    const d = deskRef.current;
    if (!d.autoLog || n.score < d.minScore || isSkipped(skipRef.current, n)) return;
    add(n);
  };
  // The Take button: works even when auto-log is off or the score is under the minimum.
  const proposeSignal = (n: NewSignal) => { saveSkip(skipRef.current.filter((x) => !(x.symId === n.symId && x.source === n.source && x.source !== '*' && x.side === n.side && Math.abs(x.entry - n.entry) <= (Math.abs(n.entry - n.sl) || 1e-9) * 0.4))); return add(n); };
  // The Skip button: removes the untouched setup and keeps it from coming back for a few hours.
  const skipSetup = (n: NewSignal) => {
    saveSkip([{ symId: n.symId, source: n.source, side: n.side, entry: n.entry, sl: n.sl, at: Date.now() }, ...skipRef.current]);
    const dup = isDuplicate(sgRef.current, n);
    if (dup && dup.status === 'signal') saveSg(sgRef.current.filter((x) => x.id !== dup.id));
  };
  const setupHandled = (n: Pick<NewSignal, 'symId' | 'source' | 'side' | 'entry' | 'sl'>): 'taken' | 'skipped' | null => (wasTaken(skipRef.current, n) ? 'taken' : isSkipped(skipRef.current, n) ? 'skipped' : null);
  const unskipSetup = (n: NewSignal) => saveSkip(skipRef.current.filter((x) => !(x.symId === n.symId && x.source === n.source && x.side === n.side && Math.abs(x.entry - n.entry) <= (Math.abs(n.entry - n.sl) || 1e-9) * 0.4)));

  // User picks a signal. 'market' fills now at the live price, 'limit' waits for the entry level. `lots` is the size the trader chose,
  // `perPt` the money one full 1.0 price move is worth at that size. Returns an error text or null.
  const takeSignal = (id: string, mode: 'market' | 'limit', price: number | undefined, lots: number, perPt: number, setup?: CloseSetup) => {
    const list = sgRef.current, s = list.find((x) => x.id === id);
    if (!s || s.status !== 'signal') return 'Already handled';
    if (!isFinite(lots) || lots <= 0 || !isFinite(perPt) || perPt <= 0) return 'Enter how many lots you want to trade first.';
    const opp = liveOpposite(list, s.symId, s.side);
    if (opp) return `You already have a ${opp.side.toUpperCase()} ${opp.status === 'open' ? 'running' : 'order waiting'} on ${s.name}. Close or cancel it first.`;
    const k = s.side === 'buy' ? 1 : -1;
    if (mode === 'market') {
      if (!price) return 'No live price yet. Wait a moment or use a limit order.';
      if (k * (s.sl - price) >= 0) return 'Price is already through the stop.';
      if (k * (price - s.tps[0]) >= 0) return 'Price is already past TP1.';
    } else if (price && k * (s.sl - price) >= 0) return 'Price is already through the stop.';
    const fillAt = mode === 'market' ? (price as number) : s.entry;
    const risk = perPt * Math.abs(fillAt - s.sl);
    const from = price ? (price < s.entry ? 'below' : 'above') : s.side === 'buy' ? 'above' : 'below'; // a buy limit normally waits below price, a sell limit above
    const plan = setup ? { plan: setup.plan, auto: setup.auto, autoBe: setup.autoBe } : {};
    const n: Signal = mode === 'market'
      ? { ...s, ...plan, status: 'open', mode, risk, lots, perPt, takenAt: Date.now(), fill: price, filledAt: Date.now(), stop: s.sl }
      : { ...s, ...plan, status: 'pending', mode, risk, lots, perPt, takenAt: Date.now(), from };
    // the other side's untouched setups on this pair are no longer valid, and neither are other untouched setups in the same direction (this one is running now)
    saveSg(dropOpposite(list.map((x) => (x.id === id ? n : x)), s.symId, s.side).filter((x) => x.id === id || !(x.status === 'signal' && x.symId === s.symId && x.side === s.side)));
    saveSkip([{ symId: s.symId, source: '*', side: s.side, entry: s.entry, sl: s.sl, at: Date.now(), hrs: TAKEN_HOURS }, ...skipRef.current]); // do not offer the same setup again, even after it closes
    return null;
  };
  // Close part of a running trade at the live price (part = share of the original size). Everything closed = the trade goes to the journal.
  const partialClose = (id: string, price: number, part: number) => {
    const s = sgRef.current.find((x) => x.id === id);
    if (!s || s.status !== 'open') return;
    const r = partialClosePos(s, price, part);
    if (r.closed) { const m = `${s.name} closed. ${r.closed.r >= 0 ? '+' : ''}${r.closed.r.toFixed(2)}R`, k = r.closed.r >= 0 ? 'good' : 'bad'; toJournal(s, r.closed); toast(m, k); note(m, k); saveSg(sgRef.current.filter((x) => x.id !== id)); }
    else { const m = `${s.name}: ${Math.round(Math.min(part, 1 - s.done) * 100)}% of the trade closed.`; saveSg(sgRef.current.map((x) => (x.id === id ? r.sig : x))); toast(m, 'good'); note(m, 'good'); }
  };
  const ackTp = (id: string) => saveSg(sgRef.current.map((x) => (x.id === id && x.tpAlert ? { ...x, tpAlert: 0 } : x)));
  const raiseAlarm = (a0: Omit<Alarm, 'at'>) => {
    let a = a0;
    if (a.kind === 'setup' && a.items) { // never ring for a setup that already runs, waits as an order, was taken before, or was skipped
      const items = a.items.filter((x) => !liveSame(sgRef.current, x.symId, x.side));
      if (!items.length) return;
      a = items.length === a.items.length ? { ...a, items } : { ...a, items, title: `${items.length} setup${items.length > 1 ? 's' : ''} to act on` };
    }
    if (a.kind === 'setup' && !seen.current.has('al:' + a.id)) { seen.current.add('al:' + a.id); note(`${a.title}. ${a.text}`, 'info'); } setAlarms((l) => (l.some((x) => x.id === a.id) ? l : [...l, { ...a, at: Date.now() }].slice(-6))); };
  const dismissAlarm = (id: string) => setAlarms((l) => l.filter((x) => x.id !== id));
  const cancelSignal = (id: string) => saveSg(sgRef.current.filter((x) => x.id !== id));
  const clearSignals = () => saveSg(sgRef.current.filter((x) => x.status !== 'signal'));
  // Move the stop to the fill price. Refused while price is not yet in profit (the stop would sit on the wrong side of the market and close the trade at once).
  const breakEven = (id: string, price?: number): string | null => {
    const s = sgRef.current.find((x) => x.id === id);
    if (!s || s.status !== 'open') return null;
    if (s.stop === s.fill) return 'The stop is already at break-even.';
    const k = s.side === 'buy' ? 1 : -1;
    if (!price) return 'No live price yet.';
    if (k * (price - (s.fill as number)) <= 0) return 'Price must be in profit before the stop can move to break-even.';
    saveSg(sgRef.current.map((x) => (x.id === id ? { ...x, stop: x.fill as number } : x)));
    const m = `${s.name}: stop moved to break-even.`; toast(m, 'good'); note(m, 'good');
    return null;
  };

  const toJournal = (s: Signal, c: ReturnType<typeof closeNow>) => addTrade({
    symbol: s.name, side: s.side, entry: s.fill as number, exit: c.exit, size: c.size, pnl: c.pnl, note: s.note ?? '',
    r: c.r, source: s.source, grade: s.grade, tf: s.tf, openedAt: s.filledAt, hits: s.hits, risk: s.risk, lots: s.lots, mfe: s.mfe, mae: s.mae, why: c.reason, dec: s.dec,
  });
  const closeSignal = (id: string, price: number) => {
    const s = sgRef.current.find((x) => x.id === id);
    if (!s) return;
    if (s.status === 'open') { const c = closeNow(s, price), m = `${s.name} closed. ${c.r >= 0 ? '+' : ''}${c.r.toFixed(2)}R`; toJournal(s, c); toast(m, c.r >= 0 ? 'good' : 'bad'); note(m, c.r >= 0 ? 'good' : 'bad'); }
    saveSg(sgRef.current.filter((x) => x.id !== id));
  };

  // Called by the tracker with live prices. Fills orders, moves stops, banks take profits, closes trades into the journal.
  const track = (prices: Record<string, number>) => {
    const now = Date.now(); let changed = false;
    const out: Signal[] = [], evs: Ev[] = [];
    for (const s of sgRef.current) {
      const p = prices[s.symId];
      if (!p) { out.push(s); continue; }
      const r = step(s, p, now);
      if (r.sig !== s && JSON.stringify(r.sig) !== JSON.stringify(s)) changed = true;
      evs.push(...r.ev);
      if (r.closed) { toJournal(r.sig, r.closed); changed = true; continue; }
      if (r.drop) { changed = true; continue; }
      out.push(r.sig);
    }
    // signals older than 24h that were never taken are stale
    const fresh = out.filter((x) => x.status !== 'signal' || now - x.date < 24 * 3600 * 1000);
    if (fresh.length !== out.length) changed = true;
    if (changed) saveSg(fresh);
    evs.filter((e) => !seen.current.has(e.id)).forEach((e) => {
      seen.current.add(e.id);
      const nk = e.kind === 'tp' || e.kind === 'tp3' || e.kind === 'fill' || e.kind === 'be' || e.kind === 'auto' || e.kind === 'bemove' ? 'good' : e.kind === 'sl' ? 'bad' : 'info';
      toast(e.text, nk); note(e.text, nk);
      if (e.kind === 'tp' || e.kind === 'tp3') { // a take profit rings an alarm until the trader decides
        const sg = fresh.find((x) => x.id === e.id.split(':')[0]), n = e.id.split(':tp')[1];
        if (sg) raiseAlarm({ id: e.id, kind: 'tp', title: `${sg.name} · TP${n} reached`, text: e.text, symId: sg.symId, sigId: sg.id });
      } else if (e.kind !== 'near' && e.kind !== 'fill') Vibration.vibrate(e.kind === 'sl' ? [0, 250, 100, 250] : 200); // auto closes and stop moves just vibrate: nothing to decide
    });
  };

  // A new account on the same phone must not inherit the old one's history, journal, license or admin rights.
  const wipeUserData = async () => {
    cloudOk.current = false; clearTimeout(pushTimer.current); pushTimer.current = null; tokRef.current = ''; setCloud({ status: 'idle', at: 0 });
    saveHist([]); saveJr([]); saveSg([]); saveSkip([]); clearNotes(); setLic(NO_LIC); setAvatar(null);
    await SecureStore.deleteItemAsync('lic').catch(() => {});
  };
  const saveAcc = async (a: Account) => { _acc(a); await SecureStore.setItemAsync('account', JSON.stringify(a)); };
  const signup = async (name: string, email: string, pw: string) => {
    const em = email.trim().toLowerCase();
    try {
      const cred = await createUserWithEmailAndPassword(auth, em, pw);
      await updateProfile(cred.user, { displayName: name.trim() }).catch(() => {});
      sendEmailVerification(cred.user).catch(() => {}); // proves the address is theirs (needed for admin rights and for taking over an existing license)
    } catch (e: any) { return errKey(e.code); }
    if (account && account.email !== em) await wipeUserData();
    await saveAcc({ name: name.trim(), email: em, uid: auth.currentUser?.uid });
    await SecureStore.setItemAsync('remember', '1');
    await refreshLic();
    return null;
  };
  const bioUnlock = () => { pinFails.current = { n: 0, until: 0 }; SecureStore.deleteItemAsync(PIN_FAILS_KEY).catch(() => {}); setLocked(false); setCovered(false); };
  const lockNow = () => { if (lockInfo.current.pin && lockInfo.current.in) setCovered(true); };
  const enter = () => { setLoggedIn(true); setLocked(false); setCovered(false); };
  const sendVerify = async () => { const u = auth.currentUser; if (!u) return 'errLogin'; try { await sendEmailVerification(u); return null; } catch (e: any) { return errKey(e.code); } };
  const login = async (email: string, pw: string, remember: boolean) => {
    const em = email.trim().toLowerCase();
    try {
      try { await signInWithEmailAndPassword(auth, em, pw); }
      catch (e: any) {
        // Accounts made before Firebase only existed on this phone. If the old local password matches, create the Firebase account once.
        const legacy = !!account?.hash && !!account.salt && em === account.email && (await sha(account.salt, pw)) === account.hash;
        if (!legacy || !['auth/invalid-credential', 'auth/user-not-found'].includes(e.code)) throw e;
        const cred = await createUserWithEmailAndPassword(auth, em, pw);
        if (account?.name) await updateProfile(cred.user, { displayName: account.name }).catch(() => {});
      }
    } catch (e: any) { return errKey(e.code); }
    const uid = auth.currentUser?.uid, samePerson = !!account && (account.email === em || (!!account.uid && account.uid === uid)); // the email may have been changed in the app: same uid = same person
    if (account && !samePerson) await wipeUserData();
    if (!account || !samePerson) await saveAcc({ name: auth.currentUser?.displayName ?? '', email: em, uid }); // first login on this phone (or after a reinstall)
    else if (account.hash || account.email !== em || !account.uid) { const { salt, hash, ...rest } = account; await saveAcc({ ...rest, email: em, uid }); } // old local password hash is no longer needed // old local password hash is no longer needed
    if (remember) await SecureStore.setItemAsync('remember', '1'); else await SecureStore.deleteItemAsync('remember');
    setLoggedIn(true); setLocked(false);
    refreshLic();
    return null;
  };
  const resetPassword = async (email: string) => {
    try { await sendPasswordResetEmail(auth, email.trim().toLowerCase()); return null; } catch (e: any) { return errKey(e.code); }
  };
  // Logged-in user changes the password: confirm the current one first (Firebase requires a recent login), then set the new one.
  const changePassword = async (current: string, next: string) => {
    const u = auth.currentUser;
    if (!u || !u.email) return 'errLogin';
    if (next.length < 6) return 'errWeak';
    try {
      await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, current));
      await updatePassword(u, next);
      return null;
    } catch (e: any) { return e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential' ? 'errCurrentPw' : errKey(e.code); }
  };
  // ---- profile: name, phone, email; delete account ----
  const PHONE_RE = /^\+?[0-9][0-9 ()\-]{5,18}[0-9]$/;
  const saveProfile = async (name: string, phone: string): Promise<string | null> => {
    const u = auth.currentUser, a = accRef.current;
    if (!u || !a) return 'errLogin';
    const nm = name.trim(), ph = phone.trim();
    if (!nm) return 'Enter your name.';
    if (ph && !PHONE_RE.test(ph)) return 'Enter a valid phone number, for example +92 300 1234567';
    if (!tokRef.current) return 'Connect to the internet and try again.';
    try { await profilePut(tokRef.current, nm, ph); } catch (e: any) { return String(e?.message || 'Could not save. Try again.'); }
    await updateProfile(u, { displayName: nm }).catch(() => {});
    await saveAcc({ ...a, name: nm, phone: ph });
    return null;
  };
  // Firebase sends a confirmation link to the NEW address; the email only changes after that link is tapped. The same account (same uid) keeps all its data.
  const changeEmail = async (newEmail: string, currentPw: string): Promise<string | null> => {
    const u = auth.currentUser;
    if (!u || !u.email) return 'errLogin';
    const em = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return 'Enter a valid email address.';
    if (em === u.email.toLowerCase()) return 'That is already your email address.';
    try {
      await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, currentPw));
      await verifyBeforeUpdateEmail(u, em);
      return null;
    } catch (e: any) { return e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential' ? 'errCurrentPw' : errKey(e.code); }
  };
  // Back from the mailbox: if the email was changed, pick up the new address (same uid, so the backup follows).
  const syncEmail = async () => {
    const u = auth.currentUser, a = accRef.current;
    if (!u || !a) return;
    await u.reload().catch(() => {});
    const em = (auth.currentUser?.email || '').toLowerCase();
    if (em && em !== a.email) { await saveAcc({ ...a, email: em, uid: u.uid }); await auth.currentUser?.getIdToken(true).catch(() => {}); refreshRef.current(); }
  };
  syncEmailRef.current = syncEmail;
  // Deleting the account is the ONLY thing that erases the backup (server) as well as the data on the phone.
  const deleteAccount = async (currentPw: string): Promise<string | null> => {
    const u = auth.currentUser;
    if (!u || !u.email) return 'errLogin';
    if (!tokRef.current) return 'Connect to the internet and try again.';
    try {
      await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, currentPw));
      const idToken = await u.getIdToken(true);
      await accountDelete(tokRef.current, idToken);
      await deleteUser(u);
    } catch (e: any) { return e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential' ? 'errCurrentPw' : e.code ? errKey(e.code) : String(e?.message || 'Could not delete the account. Try again.'); }
    await wipeUserData(); await signOut(auth).catch(() => {});
    await SecureStore.deleteItemAsync('account').catch(() => {}); await SecureStore.deleteItemAsync('remember').catch(() => {});
    _acc(null); setLoggedIn(false); setLocked(false); setCovered(false); setTab(0); setMenu(false); setHistOpen(false); setNotesOpen(false);
    return null;
  };
  const logout = () => { unregisterPush(tokRef.current); remote.setToken(''); if (cloudOk.current && tokRef.current) { const tk = tokRef.current, snap = snapshot(); cloudPut(tk, snap).catch(() => {}); } cloudOk.current = false; clearTimeout(pushTimer.current); pushTimer.current = null; setLoggedIn(false); setCovered(false); setTab(0); setMenu(false); setAdminOpen(false); setHistOpen(false); setNotesOpen(false); SecureStore.deleteItemAsync('remember').catch(() => {}); signOut(auth).catch(() => {}); };
  const resetAccount = async () => {
    if (cloudOk.current && tokRef.current) await cloudPut(tokRef.current, snapshot()).catch(() => {}); // keep the backup of the account that is being replaced on this phone
    await wipeUserData(); await signOut(auth).catch(() => {});
    await SecureStore.deleteItemAsync('account'); await SecureStore.deleteItemAsync('remember');
    _acc(null); setLoggedIn(false); setLocked(false); setCovered(false);
  };
  const setPin = async (pin: string | null) => {
    if (!account) return;
    const a: Account = { ...account };
    if (pin) { a.pinSalt = newSalt(); a.pinHash = await sha(a.pinSalt, pin); } else { delete a.pinSalt; delete a.pinHash; }
    await saveAcc(a);
  };
  // 5 wrong PINs lock the keypad for 30 seconds, doubling each time, so a 4-digit PIN cannot be brute-forced by hand.
  // The counter is kept in the secure store: closing and reopening the app no longer gives a fresh set of guesses.
  const pinWait = () => Math.max(0, Math.ceil((pinFails.current.until - Date.now()) / 1000));
  const checkPin = async (pin: string) => {
    if (pinWait() > 0) return false;
    if (!account?.pinSalt || (await sha(account.pinSalt, pin)) !== account.pinHash) {
      const f = pinFails.current; f.n += 1;
      if (f.n % 5 === 0) f.until = Date.now() + 30000 * 2 ** Math.min(10, f.n / 5 - 1);
      SecureStore.setItemAsync(PIN_FAILS_KEY, JSON.stringify(f)).catch(() => {});
      return false;
    }
    pinFails.current = { n: 0, until: 0 };
    SecureStore.deleteItemAsync(PIN_FAILS_KEY).catch(() => {});
    setLocked(false); setCovered(false);
    return true;
  };

  const th = themeFor(settings.theme);
  const t = (k: string) => STR[settings.lang]?.[k] ?? STR.en[k] ?? k;
  const rtl = settings.lang === 'ar' || settings.lang === 'ur';

  return (
    <C.Provider value={{ th, t, rtl, ready, settings, setSettings, apiKey, live, avatar, setAvatar, lic, licErr, setLic, refreshLic, adminOpen, setAdminOpen, histOpen, setHistOpen, notes, notesOpen, setNotesOpen, markNotesRead, clearNotes, removeNote, history, addItem, removeItem, clearHistory, journal, addTrade, removeTrade, updateTrade, signals, desk, setDesk, logSignal, proposeSignal, skipSetup, unskipSetup, skippedCount: skipped.length, setupHandled, takeSignal, partialClose, ackTp, pushState, startPush, alarms, raiseAlarm, dismissAlarm, cancelSignal, closeSignal, breakEven, clearSignals, track, toasts, toast, dismissToast, account, loggedIn, locked, covered, emailVerified, sendVerify, signup, enter, login, resetPassword, changePassword, logout, resetAccount, cloud, syncNow, saveProfile, changeEmail, deleteAccount, setPin, checkPin, pinWait, tab, setTab, menu, setMenu, prefill, setPrefill, amethod, setAmethod, asym, setAsym, bioUnlock, lockNow }}>
      {children}
    </C.Provider>
  );
}
