// Waits until Firebase has finished reading the saved login from the phone, so `auth.currentUser` can be trusted.
// Firebase 10+ has auth.authStateReady(); Firebase 9 (the version this project is locked to) does not, and calling it threw
// "authStateReady is not a function" on every start. That error was swallowed, the app thought nobody was logged in and asked for the password again.
type AuthLike = { authStateReady?: () => Promise<void>; onAuthStateChanged: (cb: (u: unknown) => void, err?: (e: unknown) => void) => () => void };
export function authReady(a: AuthLike, maxMs = 5000): Promise<void> {
  if (typeof a.authStateReady === 'function') return a.authStateReady().catch(() => {});
  return new Promise<void>((resolve) => {
    let done = false, off: (() => void) | null = null;
    const fin = () => { if (done) return; done = true; clearTimeout(t); try { off?.(); } catch {} resolve(); };
    const t = setTimeout(fin, maxMs);                       // never block the start for ever
    try { off = a.onAuthStateChanged(fin, fin); if (done) off?.(); } catch { fin(); } // the first callback comes once the saved login is read (user or null)
  });
}
