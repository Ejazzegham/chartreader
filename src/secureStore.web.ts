// Browsers have no Keychain. On the website the same values (login, licence, PIN counters) are kept in this browser's localStorage,
// which only this site can read. Same three functions as expo-secure-store, so the rest of the app does not change.
const ls = (): Storage | null => { try { return window.localStorage; } catch { return null; } };
export async function getItemAsync(key: string): Promise<string | null> { return ls()?.getItem('sec_' + key) ?? null; }
export async function setItemAsync(key: string, value: string): Promise<void> { ls()?.setItem('sec_' + key, value); }
export async function deleteItemAsync(key: string): Promise<void> { ls()?.removeItem('sec_' + key); }
