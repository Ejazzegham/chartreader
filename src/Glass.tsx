import React from 'react';
import { View } from 'react-native';
import { useWindowDimensions } from './win';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { useApp } from './store';

// Backdrop of the glass themes: a diagonal gradient plus three soft colour glows. The translucent panels sit on top of it, which is what makes them look like frosted glass.
export default function GlassBackdrop() {
  const { th } = useApp();
  const { width, height } = useWindowDimensions();
  if (!th.glass) return null;
  const o = th.dark ? 0.6 : 0.55, r = Math.max(width, 320) * 0.75;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <LinearGradient colors={th.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} />
      <Svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Defs>
          {th.orbs.map((c, i) => (
            <RadialGradient key={i} id={`orb${i}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={c} stopOpacity={o} />
              <Stop offset="1" stopColor={c} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        <Circle cx={width * 0.88} cy={height * 0.1} r={r} fill="url(#orb0)" />
        <Circle cx={width * 0.02} cy={height * 0.5} r={r} fill="url(#orb1)" />
        <Circle cx={width * 0.85} cy={height * 0.95} r={r} fill="url(#orb2)" />
      </Svg>
    </View>
  );
}
