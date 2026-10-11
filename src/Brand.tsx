import React from 'react';
import { View, Image, Text, Pressable, Linking } from 'react-native';
import { useApp } from './store';

const MARK = require('../assets/logo-mark.png');
const FULL = require('../assets/logo-full.png');

// The logo has dark navy parts, so it always sits on a white tile (readable on every theme).
export const LogoMark = ({ size = 72, radius = 8 }: { size?: number; radius?: number }) => (
  <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', padding: size * 0.12 }}>
    <Image source={MARK} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
  </View>
);

export const LogoFull = ({ width = 150, radius = 8 }: { width?: number; radius?: number }) => (
  <View style={{ width, height: width * 0.86, borderRadius: radius, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', padding: width * 0.06 }}>
    <Image source={FULL} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
  </View>
);

export const BAHU_URL = 'https://bahutechnology.vercel.app/';
// Footer credit. Tap opens the Bahu Technology website.
export const PoweredBy = ({ compact = false }: { compact?: boolean }) => {
  const { th } = useApp();
  return (
    <Pressable onPress={() => Linking.openURL(BAHU_URL).catch(() => {})} hitSlop={8} style={{ alignItems: 'center', paddingVertical: compact ? 4 : 14 }}>
      <Text style={{ color: th.dim, fontSize: 11, letterSpacing: 0.4 }}>
        Powered by <Text style={{ color: th.accent, fontWeight: '800' }}>Bahu Technology</Text>
      </Text>
    </Pressable>
  );
};

// Round profile picture. Shows the uploaded photo, or the initials when there is none.
export const Avatar = ({ size = 44, name = '', bg, fg, ring }: { size?: number; name?: string; bg?: string; fg?: string; ring?: string }) => {
  const { th, avatar } = useApp();
  const initials = (name.trim() || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: bg ?? th.accent + '22', borderWidth: ring ? 2 : 0, borderColor: ring }}>
      {avatar ? <Image source={{ uri: avatar }} style={{ width: '100%', height: '100%' }} /> : <Text style={{ color: fg ?? th.accent, fontWeight: '900', fontSize: size * 0.38 }}>{initials}</Text>}
    </View>
  );
};
