import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useWindowDimensions } from './win';
import { useApp } from './store';
import { LogoMark } from './Brand';
import { WaveHeader, Btn, Icon } from './ui';
import { bioAvailable, bioAuth } from './native';

// Lock screen. Unlock: fingerprint / face first (when turned on in Settings), the 4-digit PIN as the other way in.
// Setup: choose a 4-digit PIN.
export default function PinScreen({ mode, onDone, onSkip }: { mode: 'setup' | 'unlock'; onDone: () => void; onSkip?: () => void }) {
  const { th, t, setPin, checkPin, pinWait, logout, settings, account, bioUnlock } = useApp();
  const { width } = useWindowDimensions();
  const [pin, setP] = useState('');
  const [first, setFirst] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [bioOk, setBioOk] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  const tried = useRef(false);

  const hasPin = !!account?.pinHash;
  const useBio = mode === 'unlock' && settings.bio && bioOk;
  const bioOnly = mode === 'unlock' && !hasPin; // fingerprint is the only lock: no keypad

  const scan = async () => {
    if (bioBusy) return;
    setBioBusy(true); setErr('');
    const ok = await bioAuth('Unlock Chart Reader');
    setBioBusy(false);
    if (ok) { bioUnlock(); onDone(); } else setErr(hasPin ? 'Fingerprint not recognised. Try again or use your PIN.' : 'Fingerprint not recognised. Try again.');
  };

  // check the phone once, then ask for the fingerprint straight away
  useEffect(() => {
    if (mode !== 'unlock' || !settings.bio) return;
    let alive = true;
    bioAvailable().then((ok) => {
      if (!alive) return;
      setBioOk(ok);
      if (ok && !tried.current) { tried.current = true; setTimeout(() => { if (alive) scan(); }, 350); }
      if (!ok && !hasPin) setErr('Fingerprint is not set up on this phone. Add a fingerprint in the phone settings, or log out.');
    });
    return () => { alive = false; };
  }, []);

  const press = (d: string) => { if (pin.length < 4) { setP(pin + d); setErr(''); } };
  const submit = async () => {
    if (pin.length < 4) return;
    if (mode === 'unlock') {
      if (await checkPin(pin)) onDone(); else { const w = pinWait(); setErr(w > 0 ? `Too many attempts. Wait ${w}s.` : t('pinWrong')); setP(''); }
      return;
    }
    if (first === null) { setFirst(pin); setP(''); return; }
    if (first === pin) { await setPin(pin); onDone(); }
    else { setErr(t('pinMismatch')); setFirst(null); setP(''); }
  };

  const title = mode === 'unlock' ? (bioOnly ? 'Unlock with fingerprint' : t('pinEnter')) : first === null ? t('pinSetupTitle') : t('pinConfirm');
  const key = Math.min((Math.min(width, 420) - 48 - 24) / 3, 92);
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '<'];

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <WaveHeader height={200}>
        <LogoMark size={92} radius={8} />
      </WaveHeader>
      <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 24 }}>
        <Text style={{ color: th.text, fontSize: 22, fontWeight: '700' }}>{title}</Text>
        <Text style={{ color: th.dim, marginTop: 6, textAlign: 'center', minHeight: 20 }}>{mode === 'setup' && first === null ? t('pinSetupSub') : bioOnly ? 'Touch the fingerprint sensor to open the app.' : ''}</Text>

        {bioOnly ? (
          <Pressable onPress={scan} accessibilityRole="button" accessibilityLabel="Use fingerprint" style={({ pressed }) => ({ marginTop: 26, width: 112, height: 112, borderRadius: 56, backgroundColor: th.accent + '1F', borderWidth: 2, borderColor: th.accent + '88', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}>
            <Icon name="finger-print" size={64} color={th.accent} />
          </Pressable>
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: 14, marginVertical: 18 }}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: pin.length === i ? th.accent : th.line, backgroundColor: th.panel, alignItems: 'center', justifyContent: 'center' }}>
                  {i < pin.length && <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: th.text }} />}
                </View>
              ))}
            </View>
          </>
        )}
        <Text style={{ color: th.sell, minHeight: 20, marginVertical: 6, textAlign: 'center' }}>{err}</Text>

        {!bioOnly && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: key * 3 + 24, gap: 12, direction: 'ltr' }}>
            {keys.map((k, i) => (
              <Pressable key={i} disabled={!k && !(useBio && i === 9)} onPress={() => (i === 9 ? scan() : k === '<' ? setP(pin.slice(0, -1)) : press(k))}
                style={{ width: key, height: 52, borderRadius: 8, backgroundColor: k || (useBio && i === 9) ? th.panel : 'transparent', borderWidth: k || (useBio && i === 9) ? 1 : 0, borderColor: th.line, alignItems: 'center', justifyContent: 'center' }}>
                {i === 9 ? (useBio ? <Icon name="finger-print" size={26} color={th.accent} /> : null) : k === '<' ? <Icon name="backspace-outline" /> : <Text style={{ color: th.text, fontSize: 20, fontWeight: '600' }}>{k}</Text>}
              </Pressable>
            ))}
          </View>
        )}
        <View style={{ width: '100%', marginTop: 18, gap: 8 }}>
          {!bioOnly && <Btn label={t('verify')} onPress={submit} disabled={pin.length < 4} />}
          {bioOnly && <Btn icon="finger-print" label="Use fingerprint" onPress={scan} busy={bioBusy} />}
          {onSkip && <Pressable onPress={onSkip} style={{ padding: 8, alignItems: 'center' }}><Text style={{ color: th.accent }}>{t('skip')}</Text></Pressable>}
          {mode === 'unlock' && <Pressable onPress={logout} style={{ padding: 8, alignItems: 'center' }}><Text style={{ color: th.dim }}>{t('logout')}</Text></Pressable>}
        </View>
      </View>
    </View>
  );
}
