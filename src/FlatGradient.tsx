import React from 'react';
import { View } from 'react-native';

// Drop-in for expo-linear-gradient's LinearGradient that draws ONE flat colour (the first stop, or the last when the first is transparent).
// The whole site is flat and calm: no gradients anywhere. Every screen keeps using <LinearGradient>, so nothing else had to change.
const clear = (c: any) => typeof c !== 'string' || /^transparent$/i.test(c) || /^#[0-9a-f]{6}00$/i.test(c) || /^#[0-9a-f]{3}0$/i.test(c) || /^rgba\(.*,\s*0(\.0+)?\)$/i.test(c);
export function LinearGradient({ colors, style, children, start: _s, end: _e, locations: _l, ...rest }: any) {
  const list: any[] = Array.isArray(colors) ? colors : [];
  const pick = list.find((c) => !clear(c)) ?? 'transparent';
  return <View {...rest} style={[{ backgroundColor: pick }, style]}>{children}</View>;
}
