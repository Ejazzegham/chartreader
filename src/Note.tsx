import React from 'react';
import { View, Text, Platform } from 'react-native';
import { useApp } from './store';
import { Icon } from './ui';
import { glassWeb } from './sheet';
import type { Theme } from './theme';

// A readable surface for notes, tips, call-to-action strips and fine print.
// The website draws an animated backdrop behind every page, so a box with only a faint tint (accent + 8% alpha) or no fill at all lets the backdrop
// show through and dark text on a dark patch cannot be read. Every note therefore sits on a near-opaque frosted card with a coloured edge.
export const noteSurface = (th: Theme, tone?: string): any => ({
  backgroundColor: th.dark ? 'rgba(16,20,52,0.92)' : 'rgba(255,255,255,0.93)',
  borderWidth: 1, borderColor: th.line, borderLeftWidth: 3, borderLeftColor: tone || th.accent, borderRadius: 8,
  ...glassWeb,
  ...(Platform.OS === 'web' ? { boxShadow: th.dark ? '0 14px 30px -20px rgba(0,0,0,0.7)' : '0 14px 30px -22px rgba(11,27,63,0.35)' } : null),
});

// A note with an icon, a title and a line of text. `right` is an optional action (a button).
export function Note({ icon, title, children, tone, right, style }: { icon?: string; title?: string; children?: React.ReactNode; tone?: string; right?: React.ReactNode; style?: any }) {
  const { th } = useApp(), c = tone || th.accent;
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14, padding: 16 }, noteSurface(th, c), style]}>
      {!!icon && <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: c + '22' }}><Icon name={icon} size={19} color={c} /></View>}
      <View style={{ flex: 1, minWidth: 200, gap: 2 }}>
        {!!title && <Text style={{ color: th.text, fontSize: 14.5, fontWeight: '800' }}>{title}</Text>}
        {typeof children === 'string' ? <Text style={{ color: th.dim, fontSize: 13, lineHeight: 20 }}>{children}</Text> : children}
      </View>
      {right}
    </View>
  );
}

// Fine print / disclaimer line under a page: a small centred frosted pill instead of loose text on the backdrop.
export function Fineprint({ children, style }: { children: React.ReactNode; style?: any }) {
  const { th } = useApp();
  return (
    <View style={[{ alignSelf: 'center', maxWidth: 820, paddingVertical: 9, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: th.line, backgroundColor: th.dark ? 'rgba(16,20,52,0.88)' : 'rgba(255,255,255,0.9)', ...glassWeb }, style]}>
      <Text style={{ color: th.dim, fontSize: 11.5, lineHeight: 17, textAlign: 'center' }}>{children}</Text>
    </View>
  );
}
