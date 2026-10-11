import React, { createContext, useContext, useState } from 'react';
import { View } from 'react-native';
import { useLayout, PHONE_MAX } from './win';

// The website's outer frame. Desktop (900 px and wider): the whole browser window (the desktop shell lives inside, see Desktop.web.tsx).
// Narrower: the phone layout in a centred column. Pop-ups (Modal.web.tsx) are drawn inside this frame.
const Host = createContext<any>(null);
export const useFrameHost = () => useContext(Host);

export default function Frame({ children }: { children: React.ReactNode }) {
  const [host, setHost] = useState<any>(null);
  const L = useLayout();
  const phone = L.mode === 'phone';
  return (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#05070F' }}>
      <View ref={setHost as any} style={{ flex: 1, width: '100%', maxWidth: phone ? PHONE_MAX : undefined, position: 'relative', overflow: 'hidden', ...(phone && L.full > PHONE_MAX ? { borderColor: '#FFFFFF14', borderLeftWidth: 1, borderRightWidth: 1 } : null) }}>
        <Host.Provider value={host}>{children}</Host.Provider>
      </View>
    </View>
  );
}
