import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DemoAcct, cleanAcct, newAcct } from './demoAccount';

// The demo account settings (name, starting balance, leverage, reset point) are kept on this device.
const KEY = 'demo_account_v1';
export function useDemoAcct() {
  const [acct, setA] = useState<DemoAcct>(() => newAcct()), ready = useRef(false);
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => { if (v) { try { setA(cleanAcct(JSON.parse(v))); } catch {} } else AsyncStorage.setItem(KEY, JSON.stringify(acct)).catch(() => {}); }).catch(() => {}).finally(() => { ready.current = true; });
  }, []);
  const setAcct = (p: Partial<DemoAcct>) => setA((o) => { const n = cleanAcct({ ...o, ...p }); AsyncStorage.setItem(KEY, JSON.stringify(n)).catch(() => {}); return n; });
  return { acct, setAcct };
}
