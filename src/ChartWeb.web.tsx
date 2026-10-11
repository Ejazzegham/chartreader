import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useApp } from './store';

// Website version of ChartWeb: the TradingView / Deriv chart is shown in an iframe (the phone version uses a WebView).
// Same props as ChartWeb. A browser cannot read inside another site's frame, so onSymbol / onTouching do nothing here.
// Some sites refuse to be framed; the small "open in new tab" button is always there for chart pages given as a url.
export default function ChartWeb({ uri, html, height }: { uri?: string; html?: string; height?: number; onSymbol?: (raw: string) => void; fallbackHtml?: string; onAnalysis?: () => void; onTouching?: (on: boolean) => void }) {
  const { th, t } = useApp();
  const [n, setN] = useState(0);
  const box = { height, flex: height ? undefined : 1, backgroundColor: th.bg, borderRadius: 8, overflow: 'hidden' as const };
  return (
    <View style={box}>
      {React.createElement('iframe', {
        key: n, title: 'chart', srcDoc: html || undefined, src: html ? undefined : uri ?? 'about:blank',
        allow: 'fullscreen; clipboard-write', referrerPolicy: 'origin-when-cross-origin',
        style: { border: 0, width: '100%', height: '100%', display: 'block', backgroundColor: th.bg },
      })}
      <View style={{ position: 'absolute', right: 6, bottom: 6, flexDirection: 'row', gap: 6 }}>
        <Pressable onPress={() => setN(n + 1)} hitSlop={6} style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6, backgroundColor: th.panel2, borderWidth: 1, borderColor: th.line }}>
          <Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '700' }}>{t('retry')}</Text>
        </Pressable>
        {!!uri && (
          <Pressable onPress={() => { try { window.open(uri, '_blank', 'noopener'); } catch {} }} hitSlop={6} style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6, backgroundColor: th.panel2, borderWidth: 1, borderColor: th.line }}>
            <Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '700' }}>{t('openBrowser')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
