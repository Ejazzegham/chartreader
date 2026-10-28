import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from './secureStore';
import { showAlert } from './dialog';
import * as Crypto from 'expo-crypto';
import { themeFor, Theme } from './theme';
import { STR, Lang } from './i18n';
import type { MarketAI } from './gemini';
import { flushChatOutbox } from './chatOutbox';
import { setupsToLog } from './inboxSetups';
import { setReplacedHandler, Lic, NO_LIC, localTrial, isNetworkError, registerLic, loadServer, cloudGet, cloudPut, profilePut, accountDelete, trustedNow, syncClock, loadClock, saveClock, inboxPull, inboxAck, supportPull, adminBadge as fetchAdminBadge, authMail, AUTH_MAIL_FIREBASE_FALLBACK } from './license';
import { auth } from './firebase';
import { authReady as waitAuth } from './authReady';
import { futAligned } from './fallback';
import { remote } from './remote';
import { initPush, registerPush, unregisterPush, setBadge, onPushEvent, PushState } from './push';
import { notifTarget, NotifData } from './notifTarget';
import { Signal, Desk, DESK0, Ev, CloseSetup, step, closeNow, partialClose as partialClosePos, isDuplicate, isOldDemoDesk, liveOpposite, dropOpposite, reconcile, Skipped, isSkipped, pruneSkipped, liveSame, wasTaken, TAKEN_HOURS, money, stopAtBE } from './trades';
import { Position, Closed, openPosition as newPosition, closeLots, setLevels as setPosLevels, toBreakEven as posBreakEven, stepPosition } from './positions';
import { Vibration, AppState, Platform } from 'react-native';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, sendPasswordResetEmail, reauthenticateWithCredential, EmailAuthProvider, updatePassword, verifyBeforeUpdateEmail, deleteUser, sendEmailVerification, GoogleAuthProvider, signInWithCredential, getAdditionalUserInfo } from 'firebase/auth';
import { googleIdToken } from './google';
import type { User } from 'firebase/auth';

export type Item = { id: string; date: number; result: MarketAI; symbol?: string; tf?: string }; // a saved "Analysis of this chart"
export type Prefill = { entry: number; sl: number; tps: number[]; symbol?: string };
// Closed trades. Rows made by the trade desk also carry the extra fields (r, source, grade ...). Old hand-typed rows have none of them.
export type Trade = { id: string; date: number; symbol: string; side: 'buy' | 'sell'; entry: number; exit: number; size: number; pnl: number; note: string;
  lots?: number; r?: number; source?: string; grade?: string; tf?: string; openedAt?: number; hits?: number; risk?: number; mfe?: number; mae?: number; why?: 'sl' | 'be' | 'tp' | 'manual'; tag?: string; dec?: number;
  // Saved when the trade closes so Trade history can redraw the whole trade (chart with entry, stop and targets) and show the method behind it.
  symId?: string; sl?: number; tps?: number[]; stopEnd?: number; score?: number; zone?: [number, number]; level?: number; reasons?: string[] };
export type Toast = { id: string; text: string; kind: 'good' | 'bad' | 'info'; go?: NotifData | true }; // go: a tap on the banner opens this (true = the bell list). Without it a tap only closes the banner
// One line in the bell's notification list. `read` turns true the moment the list has been opened.
export type Note = { id: string; text: string; kind: 'good' | 'bad' | 'info'; at: number; read: boolean; type?: string; sym?: string }; // type / sym (from the server push): what a tap on the line opens
// A loud alert that rings until the trader answers it. 'tp': a take profit was reached. 'setup': the scanner found strong setups.
export type AlarmItem = { symId: string; name: string; side: 'buy' | 'sell'; score: number; grade: string; entry: number; dec: number };
export type Alarm = { id: string; kind: 'tp' | 'setup'; title: string; text: string; symId?: string; sigId?: string; items?: AlarmItem[]; at: number };
export type NewSignal = Pick<Signal, 'symId' | 'name' | 'side' | 'entry' | 'sl' | 'tps' | 'tf' | 'dec' | 'source' | 'grade' | 'score' | 'armed'> & Partial<Pick<Signal, 'why' | 'zone' | 'level'>>;
// salt/hash are only present on accounts created before Firebase; they are used once to upgrade the account, then removed.
type Account = { name: string; email: string; phone?: string; uid?: string; salt?: string; hash?: string; pinSalt?: string; pinHash?: string };
const errKey = (code?: string) => code === 'auth/email-already-in-use' ? 'errInUse' : code === 'auth/network-request-failed' ? 'errNetwork' : code === 'auth/too-many-requests' ? 'errMany' : code === 'auth/requires-recent-login' ? 'errRecent' : code === 'auth/weak-password' || code === 'auth/invalid-email' ? 'errFields' : 'errLogin';
type Settings = { theme: string; lang: Lang; model: string; nav: 'bottom' | 'side'; bio: boolean };
// A fresh install opens in Glass Frost (the bright glass theme). People who already picked a theme keep it (it is saved in their settings).
const DEFAULTS: Settings = { theme: Platform.OS === 'web' ? 'glassClean' : 'glassFrost', // the website starts in the bright white and blue theme; the choice in Settings is kept
  lang: 'en', model: 'gemini-3.8-flash', nav: 'bottom', bio: false };

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
  helpOpen: boolean; setHelpOpen: (v: boolean) => void; supportUnread: number; setSupportUnread: (n: number) => void; adminBadge: { chats: number; pays: number }; refreshBadges: () => void; // Help & chat screen: unread admin replies (user) and new chats / payments to review (admin)
  adminOpen: boolean; setAdminOpen: (v: boolean) => void; // the admin panel can be opened from the sidebar, Home or Settings
  history: Item[]; addItem: (r: MarketAI, symbol?: string, tf?: string) => void; removeItem: (id: string) => void; clearHistory: () => void;
  journal: Trade[]; addTrade: (t: Omit<Trade, 'id' | 'date'>) => void; removeTrade: (id: string) => void; updateTrade: (id: string, p: Partial<Trade>) => void;
  // Trade desk: analysis screens log setups, the Journal lets the user take or cancel them, the tracker follows live prices.
  signals: Signal[]; desk: Desk; setDesk: (p: Partial<Desk>) => void;
  logSignal: (n: NewSignal) => void; logSetup: (n: NewSignal) => void; proposeSignal: (n: NewSignal) => { id: string | null; err?: string }; skipSetup: (n: NewSignal) => void; unskipSetup: (n: NewSignal) => void; skippedCount: number; setupHandled: (n: Pick<NewSignal, 'symId' | 'source' | 'side' | 'entry' | 'sl'>) => 'taken' | 'skipped' | null;
  takeSignal: (id: string, mode: 'market' | 'limit', price: number | undefined, lots: number, perPt: number, setup?: CloseSetup) => string | null;
  // Manual positions (MT5 style one-click trading): open at the live price, add stop / target later, close in parts, break-even.
  positions: Position[];
  openPos: (n: { symId: string; name: string; side: 'buy' | 'sell'; lots: number; perLot: number; price: number; tf: string; dec: number }) => string | null;
  closePos: (id: string, price: number, lots?: number) => string | null; // lots omitted = close everything
  setPosLevels: (id: string, price: number | undefined, sl: number | null | undefined, tp: number | null | undefined) => string | null; // null removes a level, undefined keeps it
  posBreakEven: (id: string, price: number | undefined) => string | null;
  notes: Note[]; notesOpen: boolean; setNotesOpen: (v: boolean) => void; openNote: (d: NotifData) => void; markNotesRead: () => void; clearNotes: () => void; removeNote: (id: string) => void; // the bell: every alert, kept until cleared
  partialClose: (id: string, price: number, part: number) => void; ackTp: (id: string) => void;
  pushState: { state: PushState | 'off'; msg?: string }; startPush: () => Promise<{ state: PushState; msg?: string }>;
  alarms: Alarm[]; raiseAlarm: (a: Omit<Alarm, 'at'>) => void; dismissAlarm: (id: string) => void; cancelSignal: (id: string) => void;
  closeSignal: (id: string, price: number) => void; breakEven: (id: string, price?: number) => string | null; clearSignals: () => void; track: (prices: Record<string, number>) => void;
  toasts: Toast[]; toast: (text: string, kind?: Toast['kind'], go?: NotifData | true) => void; dismissToast: (id: string) => void;
  account: Account | null; loggedIn: boolean; locked: boolean; covered: boolean;
  emailVerified: boolean; sendVerify: () => Promise<string | null>;
  // signup / login / resetPassword return null on success, or the key of an error message.
  signup: (name: string, email: string, pw: string) => Promise<string | null>; enter: () => void;
  login: (email: string, pw: string, remember: boolean) => Promise<string | null>;
  resetPassword: (email: string) => Promise<string | null>;
  changePassword: (current: string, next: string) => Promise<string | null>;
  googleLogin: () => Promise<{ err: string | null; isNew: boolean }>; googleOnly: boolean; // Continue with Google; googleOnly = signed in with Google and has no password of its own
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
  const [positions, _pos] = useState<Position[]>([]);
  const posRef = useRef<Position[]>([]);
  const [desk, _desk] = useState<Desk>(DESK0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const sgRef = useRef<Signal[]>([]), jrRef = useRef<Trade[]>([]), deskRef = useRef<Desk>(DESK0), seen = useRef<Set<string>>(new Set());
  const histRef = useRef<Item[]>([]), setRef = useRef<Settings>(DEFAULTS);
  const pinFails = useRef({ n: 0, until: 0 });
  const pushRef = useRef<(now?: boolean) => void>(() => {}), syncEmailRef = useRef<() => Promise<void>>(async () => {});
  const refreshRef = useRef<() => Promise<boolean>>(async () => false), watchRef = useRef({ in: false, verified: true, adminEmail: false, admin: false });
  const liveRef = useRef(false), pullRef = useRef<() => Promise<void>>(async () => {}), sinceRef = useRef(0), pullBusy = useRef(false); // liveRef: does the person have access right now. sinceRef: newest server notification already in the bell
  const [, setTick] = useState(0); // bumped every 30 s so the access check is repeated while the app stays open (a trial can end while you are using it)
  // ---- cloud backup: a copy of the journal, setups, desk, history and settings lives on the server, tied to the person.
  // After an uninstall + reinstall the data comes back at login. Nothing is pushed until the first pull of this login has finished,
  // so an empty fresh install can never overwrite the real backup.
  const accRef = useRef<Account | null>(null), avatarRef = useRef('');
  const cloudOk = useRef(false), pushTimer = useRef<any>(null), tokRef = useRef(''), licRef = useRef<Lic>(NO_LIC), restoring = useRef(false);
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
  const [helpOpen, setHelpOpen] = useState(false), [supportUnread, setSupportUnread] = useState(0), [adminBadge, setAdminBadge] = useState({ chats: 0, pays: 0 });
  const supRef = useRef({ since: 0, init: false, chats: 0, pays: 0, binit: false }), helpRef = useRef(false), badgeRef = useRef<() => void>(() => {});
  const [histOpen, setHistOpen] = useState(false);
  const [notes, _notes] = useState<Note[]>([]);
  const notesRef = useRef<Note[]>([]);
  const [notesOpen, setNotesOpen] = useState(false);
  const [pendingTap, setPendingTap] = useState<{ d: NotifData; at: number } | null>(null); // a tapped notification waiting until the app is unlocked and ready
  const [prefill, setPrefill] = useState<Prefill | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const st = await load<Partial<Settings> | null>('settings', null);
        if (st && typeof st === 'object') { const n = { ...DEFAULTS, ...st }; setRef.current = n; _set(n); }
        const h = await load<Item[]>('history', []); if (Array.isArray(h)) { const ok = h.filter((i) => i?.result && typeof (i.result as any).bias === 'string' && Array.isArray(i.result.takeProfits)); histRef.current = ok; _hist(ok); } // old screenshot analyses have another shape and are dropped
        const j = await load<Trade[]>('journal', []); if (Array.isArray(j)) { _jr(j); jrRef.current = j; }
        const sg = await load<Signal[]>('signals', []); if (Array.isArray(sg)) { const clean = reconcile(sg); _sg(clean); sgRef.current = clean; if (clean.length !== sg.length) AsyncStorage.setItem('signals', JSON.stringify(clean)).catch(() => {}); }
        const ps = await load<Position[]>('positions', []); if (Array.isArray(ps)) { const ok = ps.filter((x) => x && typeof x.id === 'string' && isFinite(x.open) && x.lots > 0); posRef.current = ok; _pos(ok); }
        const nt = await load<Note[]>('notes', []); if (Array.isArray(nt)) { const ok = nt.filter((x) => x && typeof x.text === 'string').slice(0, 60); notesRef.current = ok; _notes(ok); }
        const sk = await load<Skipped[]>('skipped', []); if (Array.isArray(sk)) { const k = pruneSkipped(sk); skipRef.current = k; _skip(k); }
        const dk = await load<Partial<Desk> | null>('desk', null); if (dk && typeof dk === 'object') { const x = isOldDemoDesk(dk) ? { ...DESK0, ...dk, balance: 0, riskPct: 0, dailyLossPct: 0, maxOpen: 0 } : { ...DESK0, ...dk }; _desk(x); deskRef.current = x; } // old pre-filled demo numbers are cleared
        try { const av = await AsyncStorage.getItem('avatar'); if (av) { _avatar(av); avatarRef.current = av; } } catch {}
        SecureStore.deleteItemAsync('gemini_key').catch(() => {}); // old local key is no longer used
        SecureStore.deleteItemAsync('admin_code').catch(() => {}); // the admin passcode no longer exists
        await loadServer(); // a server address typed in Settings wins over the built-in one
        await loadClock(); // the newest time ever seen: moving the phone's date back cannot extend a trial
        const sn = await load<number>('inbox_since', 0); if (typeof sn === 'number' && isFinite(sn)) sinceRef.current = sn;
        const lc = await load<Lic | null>('lic', null, true); if (lc && typeof lc === 'object') { licRef.current = lc; _lic(lc); }
        const a = await load<Account | null>('account', null, true); if (a && typeof a === 'object') _acc(a);
        const pf = await load<{ n: number; until: number }>(PIN_FAILS_KEY, { n: 0, until: 0 }, true); if (pf && isFinite(pf.n) && isFinite(pf.until)) pinFails.current = pf;
        await waitAuth(auth as any); // Firebase restores the saved login from the phone
        if (a && auth.currentUser && (await SecureStore.getItemAsync('remember')) === '1') { setLoggedIn(true); setLocked(Platform.OS !== 'web' && (!!a.pinHash || !!setRef.current.bio)); accRef.current = a; syncEmailRef.current().finally(() => refreshLic()); }
      } catch {}
      setReady(true);
    })();
  }, []);

  tokRef.current = lic.token; accRef.current = account;
  watchRef.current = { in: loggedIn, verified: emailVerified, adminEmail: !!lic.adminEmail, admin: lic.admin };
  // Ask for the PIN again when the app comes back after a while in the background.
  lockInfo.current = { pin: Platform.OS !== 'web' && (!!account?.pinHash || settings.bio), in: loggedIn }; // a PIN or the fingerprint lock
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'background') { if (!bgAt.current) bgAt.current = Date.now(); pushRef.current(true); return; }
      if (st !== 'active') return;
      const away = bgAt.current ? Date.now() - bgAt.current : 0; bgAt.current = 0;
      // Back from the mailbox after tapping the confirmation link: check again, so admin unlocks by itself.
      if (watchRef.current.in) syncEmailRef.current();
      const w = watchRef.current; if (w.in && (!w.verified || (w.adminEmail && !w.admin) || !liveRef.current || licRef.current.provisional)) refreshRef.current(); // no access: ask again, a payment may have been confirmed meanwhile
      if (w.in) { pullRef.current(); badgeRef.current(); } // bring in the notifications that arrived while the app was closed
      setTick((x) => x + 1);
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
  const setLic = (l: Lic) => { syncClock(l.now); licRef.current = l; _lic(l); SecureStore.setItemAsync('lic', JSON.stringify(l)).catch(() => {}); saveClock(); };
  // Asks the server who this account is. Admin rights come from a confirmed admin email: no code to type.
  const refreshLic = async (fresh = false) => { // fresh = the person has just typed their password / used Google on THIS device (that signs the other device of the same kind out)
    try {
      const u = auth.currentUser;
      // Bug fix (kept): remember "unverified" BEFORE reload(), otherwise the token is not refreshed after the link was tapped and the server keeps seeing email_verified=false.
      const wasUnverified = !!u && !u.emailVerified;
      if (wasUnverified) await u!.reload().catch(() => {});
      const idToken = await u?.getIdToken(wasUnverified); // a fresh token carries the new "email confirmed" flag
      if (!idToken) throw new Error('Please log in again');
      setEmailVerified(!!u?.emailVerified);
      const created = Date.parse(u?.metadata?.creationTime || ''); // Firebase's own date for the account: lets the server count a trial that already ran offline
      const l = await registerLic(idToken, isFinite(created) ? created : undefined, fresh === true); // === true: a button press passes an event here, which must not count as a sign-in
      setLic(l); setLicErr(''); tokRef.current = l.token;
      if (!cloudOk.current) restoreCloud(); // first contact of this login: bring the backup back
      flushChatOutbox(l.token); // messages written to support while the server was off
      return true;
    } catch (e) {
      setLicErr(String((e as Error).message || 'Cannot reach the license server')); // shown in Settings so a wrong SERVER url or a down server is visible
      if (isNetworkError(e)) await grantLocalTrial(); // server off: the account still gets its trial (provisional until the server answers)
      return false;
    }
  };
  // The license server is not reachable (it is off, the tunnel changed, no route). Signing up already worked (Firebase), so the trial must start anyway.
  // Never replaces a license the server issued before (paid, admin, or an expired one): only fills the empty case.
  const grantLocalTrial = async () => {
    const u = auth.currentUser, cur = licRef.current;
    if (!u || cur.provisional || cur.token || cur.status === 'paid' || cur.status === 'admin' || cur.entitled) return; // provisional already: its end date is fixed, nothing to redo each minute
    try { const r = await u.getIdTokenResult(true); const iat = Date.parse(r.issuedAtTime); if (isFinite(iat) && iat > 1e12) syncClock(iat); } catch {} // Google's clock, so a wrong phone date cannot stretch the trial
    const l = localTrial(Date.parse(u.metadata?.creationTime || ''), trustedNow());
    if (l) { setLic(l); toast(l.entitled ? 'Free trial started. It will sync when the server is back.' : 'The free trial of this account has ended.', 'info'); }
  };
  refreshRef.current = refreshLic;
  // Re-check the dates on the phone too, so an expired trial stops working even offline. The server checks again.
  const live = lic.status === 'admin' || (lic.entitled && trustedNow() < Math.max(lic.trialEnd, lic.paidUntil));
  liveRef.current = live;
  // A provisional trial (server was off at sign-up): keep asking every minute until the server answers, then its record takes over.
  useEffect(() => {
    if (!loggedIn || !lic.provisional) return;
    const i = setInterval(() => refreshRef.current(), 60000);
    return () => clearInterval(i);
  }, [loggedIn, lic.provisional]);
  useEffect(() => { const i = setInterval(() => { setTick((x) => x + 1); saveClock(); }, 30000); return () => clearInterval(i); }, []);
  // Background alerts: once logged in with a valid session, register this phone for push and keep the server's copy of the alerts current.
  const [pushState, setPushState] = useState<{ state: PushState | 'off'; msg?: string }>({ state: 'off' });
  const startPush = async () => { const r = await registerPush(lic.token); setPushState(r); return r; };
  useEffect(() => {
    initPush();
    if (loggedIn && lic.token) registerPush(lic.token).then(setPushState); // also after the trial ended: chat replies and payment answers must reach the phone
    if (loggedIn && lic.token && live) remote.setToken(lic.token); else remote.setToken('');
  }, [loggedIn, lic.token, live]);
  const apiKey = live ? lic.token : ''; // session token for the server proxy; empty once the trial ends

  // ---- notifications that arrived while the app was closed ----
  // The server keeps every notification it sent (its inbox). Here they are copied into the bell, so nothing that was swiped away or missed is lost,
  // and the number on the app icon always equals the unread lines of the bell.
  const pullInbox = async () => {
    const tk = tokRef.current; if (!tk || pullBusy.current) return;
    pullBusy.current = true;
    try {
      let r = await inboxPull(tk, sinceRef.current);
      if (r.seq < sinceRef.current) { sinceRef.current = 0; r = await inboxPull(tk, 0); } // the server started its numbering again
      const have = new Set(notesRef.current.map((x) => x.id));
      const add: Note[] = r.items.filter((i) => !have.has('srv' + i.id)).map((i) => ({ id: 'srv' + i.id, text: `${i.title}. ${i.body}`, kind: 'info' as const, at: i.at, read: i.id <= r.ack, ...(i.type ? { type: i.type } : {}), ...(i.sym ? { sym: i.sym } : {}) }));
      if (add.length) saveNotes([...add, ...notesRef.current].sort((a, b) => b.at - a.at).slice(0, 60));
      // Setups the server found while the app was closed: A / A+ go to the Journal (Take / Skip). Only fresh ones (price moves on), each notification once.
      for (const i of r.items) if (!have.has('srv' + i.id)) for (const x of setupsToLog(i)) logSetup(x);
      sinceRef.current = r.seq; AsyncStorage.setItem('inbox_since', JSON.stringify(r.seq)).catch(() => {});
    } catch {} finally { pullBusy.current = false; }
  };
  pullRef.current = pullInbox;
  useEffect(() => { if (loggedIn && lic.token) pullRef.current(); }, [loggedIn, lic.token, live]);
  useEffect(() => {
    if (!loggedIn || !lic.token) return;
    return onPushEvent((tapped, data) => { pullRef.current(); badgeRef.current(); if (tapped) setPendingTap({ d: data, at: Date.now() }); }); // a notification arrived: copy it into the bell. It was tapped: open its own place (see openNote)
  }, [loggedIn, lic.token]);
  // While the app is open, look at the server's inbox every minute. A and A+ setups the background scanner found land in the Journal (Take / Skip) within about a minute,
  // even if the phone never delivered the push event. (Closed or in the background: the push and the next app open do the same job.)
  useEffect(() => {
    if (!loggedIn || !lic.token) return;
    const i = setInterval(() => { if (AppState.currentState === 'active') pullRef.current(); }, 60000);
    return () => clearInterval(i);
  }, [loggedIn, lic.token]);
  // Open what a notification is about: price alert / scanner setup -> that pair in Analysis, support or payment answer -> Help chat, anything else -> the bell list.
  // Used by a tap on the phone's notification and by a tap on a line of the bell list.
  const openNote = (d: NotifData) => {
    const tg = notifTarget(d);
    const wait = notesOpen ? 280 : 0; // the bell is a full-screen window: let it close before another window opens
    setMenu(false); setHistOpen(false); setNotesOpen(false);
    if (tg.kind === 'help') { setTimeout(() => setHelpOpen(true), wait); return; }
    setHelpOpen(false);
    if (tg.kind === 'admin') { setAdminOpen(true); return; }
    if (tg.kind === 'symbol') { setAsym(tg.sym); setTab(1); return; } // Analysis tab (index 1) reads store.asym and opens the pair
    setTimeout(() => setNotesOpen(true), wait);
  };
  // A tap that came from a notification waits here until it can be shown: signed in, past the PIN screen, app ready, access confirmed (Help also works when the trial ended).
  useEffect(() => {
    if (!pendingTap || !loggedIn || locked || !ready) return;
    if (Date.now() - pendingTap.at > 120000) { setPendingTap(null); return; } // too old: do not jump around long after the tap
    if (!live && !['help', 'admin'].includes(notifTarget(pendingTap.d).kind)) {
      // Access is not confirmed (yet). Give the first check up to 3 s. If the app is still locked behind the payment page, open the Help chat, as before.
      const left = 3000 - (Date.now() - pendingTap.at);
      if (left > 0) { const h = setTimeout(() => setPendingTap((p) => (p ? { ...p } : p)), left + 50); return () => clearTimeout(h); }
      setPendingTap(null); openNote({ type: 'support' }); return;
    }
    setPendingTap(null); openNote(pendingTap.d);
  }, [pendingTap, loggedIn, locked, ready, live]);
  // ---- Help chat + admin badges. Runs while the app is locked too. The first answer after login only sets the numbers; later increases raise a toast. ----
  helpRef.current = helpOpen;
  const refreshBadges = async () => {
    const tk = tokRef.current; if (!tk) return;
    const r = supRef.current;
    try {
      const p = await supportPull(tk, r.since);
      const fresh = p.msgs.filter((m) => m.from === 'admin');
      if (p.seq > r.since) r.since = p.seq;
      if (r.init && fresh.length && !helpRef.current) toast('Support: ' + fresh[fresh.length - 1].text.slice(0, 80), 'info', { type: 'support' });
      r.init = true; setSupportUnread(helpRef.current ? 0 : p.unread);
    } catch {}
    if (watchRef.current.admin) {
      try {
        const b = await fetchAdminBadge(tk);
        if (r.binit && b.chats > r.chats) toast('New support message', 'info', { type: 'admin' });
        else if (r.binit && b.pays > r.pays) toast('A payment is waiting for review', 'info', { type: 'admin' });
        r.binit = true; r.chats = b.chats; r.pays = b.pays; setAdminBadge({ chats: b.chats, pays: b.pays });
      } catch {}
    }
  };
  badgeRef.current = refreshBadges;
  useEffect(() => {
    if (!loggedIn || !lic.token) return;
    refreshBadges(); const i = setInterval(() => badgeRef.current(), 20000);
    return () => clearInterval(i);
  }, [loggedIn, lic.token, lic.admin]);
  const unreadCount = notes.reduce((n, x) => n + (x.read ? 0 : 1), 0);
  useEffect(() => {
    setBadge(loggedIn ? unreadCount : 0);
    if (loggedIn && unreadCount === 0 && tokRef.current && sinceRef.current) inboxAck(tokRef.current, sinceRef.current).catch(() => {}); // tell the server everything is read, so its next push starts counting from 1
  }, [unreadCount, loggedIn]);

  // ---- cloud backup (see the note near the refs) ----
  const snapshot = () => ({ v: 1, journal: jrRef.current, signals: sgRef.current, positions: posRef.current, desk: deskRef.current, history: histRef.current.slice(0, 30), skipped: skipRef.current, settings: { theme: setRef.current.theme, lang: setRef.current.lang, nav: setRef.current.nav }, avatar: avatarRef.current });
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
        const ps = union<Position>(posRef.current, d.positions).filter((x) => x && isFinite(x.open) && x.lots > 0);
        if (ps.length !== posRef.current.length) savePos(ps);
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
  const savePos = (l: Position[]) => { posRef.current = l; _pos(l); AsyncStorage.setItem('positions', JSON.stringify(l)).catch(() => {}); schedulePush(); };
  const setDesk = (p: Partial<Desk>) => { const n = { ...deskRef.current, ...p }; deskRef.current = n; _desk(n); AsyncStorage.setItem('desk', JSON.stringify(n)).catch(() => {}); schedulePush(); };
  const toast = (text: string, kind: Toast['kind'] = 'info', go?: NotifData | true) => {
    const id = String(Date.now()) + Math.floor(Math.random() * 1000);
    setToasts((l) => [...l.slice(-2), { id, text, kind, ...(go ? { go } : {}) }]);
    setTimeout(() => setToasts((l) => l.filter((x) => x.id !== id)), 5200);
  };
  const dismissToast = (id: string) => setToasts((l) => l.filter((x) => x.id !== id));
  // The bell list. Newest first, 60 at most, kept on this phone until the person clears it.
  const saveNotes = (l: Note[]) => { notesRef.current = l; _notes(l); AsyncStorage.setItem('notes', JSON.stringify(l)).catch(() => {}); };
  const note = (text: string, kind: Note['kind'] = 'info', sym?: string) => saveNotes([{ id: String(Date.now()) + Math.floor(Math.random() * 1000), text, kind, at: Date.now(), read: false, ...(sym ? { type: 'trade', sym } : {}) }, ...notesRef.current].slice(0, 60));
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
    if (!d.autoLog || n.score < d.minScore || isSkipped(skipRef.current, n) || !futAligned(n.symId)) return; // gold / silver on the backup feed only count once the spot gap is known
    add(n);
  };
  // A and A+ setups from the scanner (in the app, or found by the server while the app was closed): ALWAYS listed in the Journal for Take / Skip,
  // even when auto-log is off or the score is under the Journal minimum. A setup you skipped (or already took) stays out for a few hours.
  const logSetup = (n: NewSignal) => { if (isSkipped(skipRef.current, n) || !futAligned(n.symId)) return; add(n); };
  // The Take button: works even when auto-log is off or the score is under the minimum.
  const proposeSignal = (n: NewSignal) => { if (!futAligned(n.symId)) return { id: null, err: 'The live gold / silver price is still being matched to the spot price. Try again in a minute.' }; saveSkip(skipRef.current.filter((x) => !(x.symId === n.symId && x.source === n.source && x.source !== '*' && x.side === n.side && Math.abs(x.entry - n.entry) <= (Math.abs(n.entry - n.sl) || 1e-9) * 0.4))); return add(n); };
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
    if (r.closed) { const m = `${s.name} closed. Trade result ${money(r.closed.pnl)}`, k = r.closed.r >= 0 ? 'good' : 'bad'; toJournal(s, r.closed); toast(m, k, true); note(m, k, s.symId); saveSg(sgRef.current.filter((x) => x.id !== id)); }
    else { const got = (r.sig.banked - s.banked) * s.risk, m = `${s.name}: ${Math.round(Math.min(part, 1 - s.done) * 100)}% of the trade closed, ${money(got)} booked.`; saveSg(sgRef.current.map((x) => (x.id === id ? r.sig : x))); toast(m, got >= 0 ? 'good' : 'bad', true); note(m, got >= 0 ? 'good' : 'bad'); }
  };
  const ackTp = (id: string) => saveSg(sgRef.current.map((x) => (x.id === id && x.tpAlert ? { ...x, tpAlert: 0 } : x)));
  const raiseAlarm = (a0: Omit<Alarm, 'at'>) => {
    let a = a0;
    if (a.kind === 'setup' && a.items) { // never ring for a setup that already runs, waits as an order, was taken before, or was skipped
      const items = a.items.filter((x) => !liveSame(sgRef.current, x.symId, x.side));
      if (!items.length) return;
      a = items.length === a.items.length ? { ...a, items } : { ...a, items, title: `${items.length} setup${items.length > 1 ? 's' : ''} to act on` };
    }
    if (a.kind === 'setup' && !seen.current.has('al:' + a.id)) { seen.current.add('al:' + a.id); note(`${a.title}. ${a.text}`, 'info', a.symId ?? a.items?.[0]?.symId); } setAlarms((l) => (l.some((x) => x.id === a.id) ? l : [...l, { ...a, at: Date.now() }].slice(-6))); };
  const dismissAlarm = (id: string) => setAlarms((l) => l.filter((x) => x.id !== id));
  const cancelSignal = (id: string) => saveSg(sgRef.current.filter((x) => x.id !== id));
  const clearSignals = () => saveSg(sgRef.current.filter((x) => x.status !== 'signal'));
  // Move the stop to the fill price. Refused while price is not yet in profit (the stop would sit on the wrong side of the market and close the trade at once).
  const breakEven = (id: string, price?: number): string | null => {
    const s = sgRef.current.find((x) => x.id === id);
    if (!s || s.status !== 'open') return null;
    if (stopAtBE(s)) return s.stop === s.fill ? 'The stop is already at break-even.' : 'The stop is already past break-even. Nothing to move.';
    const k = s.side === 'buy' ? 1 : -1;
    if (!price) return 'No live price yet.';
    if (k * (price - (s.fill as number)) <= 0) return 'Price must be in profit before the stop can move to break-even.';
    saveSg(sgRef.current.map((x) => (x.id === id ? { ...x, stop: x.fill as number } : x)));
    const m = `${s.name}: stop moved to break-even.`; toast(m, 'good', true); note(m, 'good', s.symId);
    return null;
  };

  const toJournal = (s: Signal, c: ReturnType<typeof closeNow>) => addTrade({
    symbol: s.name, side: s.side, entry: s.fill as number, exit: c.exit, size: c.size, pnl: c.pnl, note: s.note ?? '',
    r: c.r, source: s.source, grade: s.grade, tf: s.tf, openedAt: s.filledAt, hits: s.hits, risk: s.risk, lots: s.lots, mfe: s.mfe, mae: s.mae, why: c.reason, dec: s.dec,
    symId: s.symId, sl: s.sl, tps: s.tps, stopEnd: s.stop, score: s.score, zone: s.zone, level: s.level, reasons: s.why,
  });
  const closeSignal = (id: string, price: number) => {
    const s = sgRef.current.find((x) => x.id === id);
    if (!s) return;
    if (s.status === 'open') { const c = closeNow(s, price), m = `${s.name} closed. Trade result ${money(c.pnl)}`; toJournal(s, c); toast(m, c.r >= 0 ? 'good' : 'bad', true); note(m, c.r >= 0 ? 'good' : 'bad', s.symId); }
    saveSg(sgRef.current.filter((x) => x.id !== id));
  };

  // ---- manual positions (one-click, MT5 style) ----
  const posToJournal = (p: Position, c: Closed) => addTrade({
    symbol: p.name, side: p.side, entry: p.open, exit: c.exit, size: p.lots0, pnl: c.pnl, note: p.note ?? '', lots: p.lots0, source: 'Demo', grade: 'M', tf: p.tf, openedAt: p.openedAt, why: c.reason, dec: p.dec, symId: p.symId,
    ...(p.sl !== undefined ? { sl: p.sl, stopEnd: p.sl } : {}), ...(p.tp !== undefined ? { tps: [p.tp] } : {}),
  });
  const openPos = (n: { symId: string; name: string; side: 'buy' | 'sell'; lots: number; perLot: number; price: number; tf: string; dec: number }): string | null => {
    if (!isFinite(n.lots) || n.lots <= 0 || !isFinite(n.perLot) || n.perLot <= 0) return 'Enter a lot size first.';
    if (!isFinite(n.price) || n.price <= 0) return 'No live price yet for this pair. Wait a moment.';
    if (posRef.current.length >= 30) return 'You have 30 open positions. Close some first.';
    const id = String(Date.now()) + Math.floor(Math.random() * 1000);
    savePos([newPosition({ id, ...n }), ...posRef.current]);
    return null;
  };
  const closePos = (id: string, price: number, lots?: number): string | null => {
    const p = posRef.current.find((x) => x.id === id);
    if (!p) return 'That position is already closed.';
    if (!price) return 'No live price yet.';
    const r = closeLots(p, price, lots ?? p.lots, 'manual');
    if (r.closed) { posToJournal(p, r.closed); const m = `${p.name} ${p.side.toUpperCase()} closed. Result ${money(r.closed.pnl)}`, k = r.closed.pnl >= 0 ? 'good' : 'bad'; toast(m, k, true); note(m, k, p.symId); savePos(posRef.current.filter((x) => x.id !== id)); }
    else if (r.pos) { const m = `${p.name}: ${r.booked >= 0 ? '+' : '-'}$${Math.abs(r.booked).toFixed(2)} booked, ${r.pos.lots} lots still open.`; savePos(posRef.current.map((x) => (x.id === id ? r.pos! : x))); toast(m, r.booked >= 0 ? 'good' : 'bad', true); note(m, r.booked >= 0 ? 'good' : 'bad', p.symId); }
    return null;
  };
  const setPosLevelsFn = (id: string, price: number | undefined, sl: number | null | undefined, tp: number | null | undefined): string | null => {
    const p = posRef.current.find((x) => x.id === id);
    if (!p) return 'That position is already closed.';
    const r = setPosLevels(p, price, sl, tp);
    if (r.err || !r.pos) return r.err ?? 'Could not change the levels.';
    savePos(posRef.current.map((x) => (x.id === id ? r.pos! : x)));
    return null;
  };
  const posBreakEvenFn = (id: string, price: number | undefined): string | null => {
    const p = posRef.current.find((x) => x.id === id);
    if (!p) return 'That position is already closed.';
    const r = posBreakEven(p, price);
    if (r.err || !r.pos) return r.err ?? 'Could not move the stop.';
    savePos(posRef.current.map((x) => (x.id === id ? r.pos! : x)));
    const m = `${p.name}: stop moved to break-even.`; toast(m, 'good', true); note(m, 'good', p.symId);
    return null;
  };
  // the stop or the target of a manual position was touched
  const trackPositions = (prices: Record<string, number>) => {
    let changed = false; const out: Position[] = [];
    for (const p of posRef.current) {
      const px = prices[p.symId];
      if (!px) { out.push(p); continue; }
      const r = stepPosition(p, px);
      if (!r.closed) { out.push(p); continue; }
      changed = true; posToJournal(p, r.closed);
      const m = r.hit === 'tp' ? `${p.name}: take profit hit. Result ${money(r.closed.pnl)}.` : r.closed.reason === 'be' ? `${p.name}: stopped out at break-even. Result ${money(r.closed.pnl)}.` : r.closed.pnl > 0 ? `${p.name}: stop hit in profit. Result ${money(r.closed.pnl)}.` : `${p.name}: stop loss hit. Result ${money(r.closed.pnl)}.`;
      const k = r.closed.pnl >= 0 ? 'good' : 'bad';
      if (!seen.current.has('pos:' + p.id)) { seen.current.add('pos:' + p.id); toast(m, k, true); note(m, k, p.symId); Vibration.vibrate(k === 'bad' ? [0, 250, 100, 250] : 200); }
    }
    if (changed) savePos(out);
  };

  // Called by the tracker with live prices. Fills orders, moves stops, banks take profits, closes trades into the journal.
  const track = (prices: Record<string, number>) => {
    trackPositions(prices);
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
      toast(e.text, nk, true); note(e.text, nk);
      if (e.kind === 'tp' || e.kind === 'tp3') { // a take profit rings an alarm until the trader decides
        const sg = fresh.find((x) => x.id === e.id.split(':')[0]), n = e.id.split(':tp')[1];
        if (sg) raiseAlarm({ id: e.id, kind: 'tp', title: `${sg.name} · TP${n} reached`, text: e.text, symId: sg.symId, sigId: sg.id });
      } else if (e.kind !== 'near' && e.kind !== 'fill') Vibration.vibrate(e.kind === 'sl' ? [0, 250, 100, 250] : 200); // auto closes and stop moves just vibrate: nothing to decide
    });
  };

  // A new account on the same phone must not inherit the old one's history, journal, license or admin rights.
  const wipeUserData = async () => {
    cloudOk.current = false; clearTimeout(pushTimer.current); pushTimer.current = null; tokRef.current = ''; setCloud({ status: 'idle', at: 0 });
    saveHist([]); saveJr([]); saveSg([]); savePos([]); saveSkip([]); clearNotes(); setLic(NO_LIC); setAvatar(null);
    sinceRef.current = 0; AsyncStorage.removeItem('inbox_since').catch(() => {});
    await SecureStore.deleteItemAsync('lic').catch(() => {});
  };
  const saveAcc = async (a: Account) => { _acc(a); await SecureStore.setItemAsync('account', JSON.stringify(a)); };
  const signup = async (name: string, email: string, pw: string) => {
    const em = email.trim().toLowerCase();
    try {
      const cred = await createUserWithEmailAndPassword(auth, em, pw);
      await updateProfile(cred.user, { displayName: name.trim() }).catch(() => {});
      sendVerifyMail(cred.user).catch(() => {}); // proves the address is theirs (needed for admin rights and for taking over an existing license)
    } catch (e: any) { return errKey(e.code); }
    if (account && account.email !== em) await wipeUserData();
    await saveAcc({ name: name.trim(), email: em, uid: auth.currentUser?.uid });
    await SecureStore.setItemAsync('remember', '1');
    await refreshLic(true);
    return null;
  };
  const bioUnlock = () => { pinFails.current = { n: 0, until: 0 }; SecureStore.deleteItemAsync(PIN_FAILS_KEY).catch(() => {}); setLocked(false); setCovered(false); };
  const lockNow = () => { if (lockInfo.current.pin && lockInfo.current.in) setCovered(true); };
  const enter = () => { setLoggedIn(true); setLocked(false); setCovered(false); };
  // The confirmation email: our own design, sent by the Netlify Function (not the license server).
  const sendVerifyMail = async (u: User): Promise<string | null> => {
    const idToken = await u.getIdToken().catch(() => '');
    if (idToken) { const r = await authMail('verify', { idToken }); if (r === 'sent') return null; if (r === 'limited') return 'errMany'; }
    if (!AUTH_MAIL_FIREBASE_FALLBACK) return 'errNetwork';
    try { await sendEmailVerification(u); return null; } catch (e: any) { return errKey(e.code); }
  };
  const sendVerify = async () => { const u = auth.currentUser; if (!u) return 'errLogin'; return sendVerifyMail(u); };
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
    refreshLic(true);
    return null;
  };
  // ---- Continue with Google (sign up and log in are the same button) ----
  const isGoogleOnly = () => { const pd = auth.currentUser?.providerData ?? []; return pd.some((p) => p.providerId === 'google.com') && !pd.some((p) => p.providerId === 'password'); };
  const googleLogin = async (): Promise<{ err: string | null; isNew: boolean }> => {
    const g = await googleIdToken();
    if ('cancelled' in g) return { err: null, isNew: false };
    if ('err' in g) return { err: g.err, isNew: false };
    let isNew = false;
    try {
      const cred = await signInWithCredential(auth, GoogleAuthProvider.credential(g.token));
      isNew = getAdditionalUserInfo(cred)?.isNewUser === true;
    } catch (e: any) { return { err: errKey(e.code) === 'errLogin' ? 'errGoogle' : errKey(e.code), isNew: false }; }
    const u = auth.currentUser;
    if (!u) return { err: 'errGoogle', isNew: false };
    const em = (u.email || '').toLowerCase(), uid = u.uid, samePerson = !!account && (account.email === em || (!!account.uid && account.uid === uid));
    if (account && !samePerson) await wipeUserData(); // another person on this phone: nothing of the old account stays
    if (!account || !samePerson) await saveAcc({ name: u.displayName ?? '', email: em, uid });
    else if (account.hash || account.email !== em || !account.uid) { const { salt, hash, ...rest } = account; await saveAcc({ ...rest, email: em, uid }); }
    await SecureStore.setItemAsync('remember', '1');
    if (isNew) { await refreshLic(true); return { err: null, isNew: true }; } // a new account goes on to set its PIN, like a normal sign up
    setLoggedIn(true); setLocked(false);
    refreshLic(true);
    return { err: null, isNew: false };
  };
  const resetPassword = async (email: string) => {
    const em = email.trim().toLowerCase(), r = await authMail('reset', { email: em }); // our own email design, sent by Netlify
    if (r === 'sent') return null;
    if (r === 'limited') return 'errMany';
    if (!AUTH_MAIL_FIREBASE_FALLBACK) return 'errNetwork';
    try { await sendPasswordResetEmail(auth, em); return null; } catch (e: any) { return errKey(e.code); }
  };
  // Logged-in user changes the password: confirm the current one first (Firebase requires a recent login), then set the new one.
  const changePassword = async (current: string, next: string) => {
    const u = auth.currentUser;
    if (!u || !u.email) return 'errLogin';
    if (isGoogleOnly()) return 'errGoogleAcct';
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
    if (isGoogleOnly()) return 'errGoogleAcct';
    const em = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return 'Enter a valid email address.';
    if (em === u.email.toLowerCase()) return 'That is already your email address.';
    try {
      await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, currentPw));
      const r = await authMail('change-email', { idToken: await u.getIdToken(true), newEmail: em });
      if (r === 'limited') return 'errMany';
      if (r !== 'sent') { if (!AUTH_MAIL_FIREBASE_FALLBACK) return 'errNetwork'; await verifyBeforeUpdateEmail(u, em); }
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
      if (isGoogleOnly()) { // no password: confirm with the Google account instead
        const g = await googleIdToken();
        if ('cancelled' in g) return 'errGoogleCancel';
        if ('err' in g) return g.err;
        await reauthenticateWithCredential(u, GoogleAuthProvider.credential(g.token));
      } else await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, currentPw));
      const idToken = await u.getIdToken(true);
      await accountDelete(tokRef.current, idToken);
      await deleteUser(u);
    } catch (e: any) { return e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential' ? 'errCurrentPw' : e.code ? errKey(e.code) : String(e?.message || 'Could not delete the account. Try again.'); }
    await wipeUserData(); await signOut(auth).catch(() => {});
    await SecureStore.deleteItemAsync('account').catch(() => {}); await SecureStore.deleteItemAsync('remember').catch(() => {});
    _acc(null); setLoggedIn(false); setLocked(false); setCovered(false); setTab(0); setMenu(false); setHistOpen(false); setNotesOpen(false);
    return null;
  };
  const logout = () => { unregisterPush(tokRef.current); remote.setToken(''); if (cloudOk.current && tokRef.current) { const tk = tokRef.current, snap = snapshot(); cloudPut(tk, snap).catch(() => {}); } cloudOk.current = false; clearTimeout(pushTimer.current); pushTimer.current = null; setLoggedIn(false); setCovered(false); setTab(0); setMenu(false); setAdminOpen(false); setHelpOpen(false); setSupportUnread(0); setAdminBadge({ chats: 0, pays: 0 }); supRef.current = { since: 0, init: false, chats: 0, pays: 0, binit: false }; setHistOpen(false); setNotesOpen(false); SecureStore.deleteItemAsync('remember').catch(() => {}); signOut(auth).catch(() => {}); };
  // This email was signed in on another phone / another computer: this device is signed out and told why (one email = one phone + one computer at a time).
  const logoutRef = useRef<() => void>(() => {}); logoutRef.current = logout;
  useEffect(() => { setReplacedHandler((msg) => { showAlert('Signed out', msg); logoutRef.current(); }); return () => setReplacedHandler(null); }, []);
  // Website: after the person taps the link in the confirmation email, this tab notices by itself (no need to press a button or reload).
  useEffect(() => {
    if (Platform.OS !== 'web' || !loggedIn || emailVerified) return;
    const iv = setInterval(() => { if (typeof document === 'undefined' || document.visibilityState === 'visible') refreshRef.current(); }, 6000);
    return () => clearInterval(iv);
  }, [loggedIn, emailVerified]);
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
    <C.Provider value={{ googleLogin, googleOnly: isGoogleOnly(), th, t, rtl, ready, settings, setSettings, apiKey, live, avatar, setAvatar, lic, licErr, setLic, refreshLic, adminOpen, setAdminOpen, helpOpen, setHelpOpen, supportUnread, setSupportUnread, adminBadge, refreshBadges, histOpen, setHistOpen, notes, notesOpen, setNotesOpen, openNote, markNotesRead, clearNotes, removeNote, history, addItem, removeItem, clearHistory, journal, addTrade, removeTrade, updateTrade, signals, positions, openPos, closePos, setPosLevels: setPosLevelsFn, posBreakEven: posBreakEvenFn, desk, setDesk, logSignal, logSetup, proposeSignal, skipSetup, unskipSetup, skippedCount: skipped.length, setupHandled, takeSignal, partialClose, ackTp, pushState, startPush, alarms, raiseAlarm, dismissAlarm, cancelSignal, closeSignal, breakEven, clearSignals, track, toasts, toast, dismissToast, account, loggedIn, locked, covered, emailVerified, sendVerify, signup, enter, login, resetPassword, changePassword, logout, resetAccount, cloud, syncNow, saveProfile, changeEmail, deleteAccount, setPin, checkPin, pinWait, tab, setTab, menu, setMenu, prefill, setPrefill, amethod, setAmethod, asym, setAsym, bioUnlock, lockNow }}>
      {children}
    </C.Provider>
  );
}
