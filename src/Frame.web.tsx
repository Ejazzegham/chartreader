import React, { createContext, useContext, useState } from 'react';
import { View } from 'react-native';
import { MAX_W } from './win';

// The website: the app keeps its phone layout in a centred column on wide screens (full width on a phone browser).
// Pop-ups (Modal.web.tsx) are drawn inside this column, so they never stretch across a wide monitor.
const Host = createContext<any>(null);
export const useFrameHost = () => useContext(Host);

export default function Frame({ children }: { children: React.ReactNode }) {
  const [host, setHost] = useState<any>(null);
  return (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#05070F' }}>
      <View ref={setHost as any} style={{ flex: 1, width: '100%', maxWidth: MAX_W, position: 'relative', overflow: 'hidden', borderColor: '#FFFFFF14', borderLeftWidth: 1, borderRightWidth: 1 }}>
        <Host.Provider value={host}>{children}</Host.Provider>
      </View>
    </View>
  );
}
