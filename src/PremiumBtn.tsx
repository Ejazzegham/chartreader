import React from 'react';
import { View, Text, Pressable, ActivityIndicator, Platform } from 'react-native';
import { useApp } from './store';
import { Icon } from './ui';

// Premium action buttons used under every setup (Take BUY/SELL, Skip) and for "Refine with all methods".
// The old buttons used a faint tint or a flat pastel fill, so on top of the animated backdrop their labels were hard to read.
// These are solid and opaque: rich gradient (web) with white bold text, a soft glow and a thin light edge for Take / Refine,
// and an opaque glass surface with a coloured edge for Skip. On the phone the gradient falls back to the first colour.
export type PremiumKind = 'buy' | 'sell' | 'skip' | 'refine' | 'take';

const GRAD: Record<'buy' | 'sell' | 'refine', [string, string, string?]> = {
  buy: ['#10B981', '#047857'],
  sell: ['#F43F5E', '#BE123C'],
  refine: ['#2563EB', '#7C3AED', '#C026D3'],
};

export default function PremiumBtn({ kind, label, icon, onPress, disabled, busy, height = 52, flex, accessibilityLabel }: {
  kind: PremiumKind; label: string; icon?: string; onPress: () => void; disabled?: boolean; busy?: boolean; height?: number; flex?: number; accessibilityLabel?: string;
}) {
  const { th } = useApp();
  const web = Platform.OS === 'web';
  const off = !!(disabled || busy);

  if (kind === 'skip') {
    const edge = th.sell;
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} disabled={off} onPress={onPress}
        style={((st: any) => ({
          ...(flex ? { flex } : null), height, minWidth: 96, borderRadius: 12, borderWidth: 1.5, borderColor: st.hovered ? edge : edge + 'CC',
          backgroundColor: th.dark ? (st.hovered ? '#1B2150' : '#141943') : (st.hovered ? '#FFF1F4' : '#FFFFFF'),
          alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 16, opacity: off ? 0.5 : st.pressed ? 0.85 : 1,
          cursor: 'pointer', ...(web ? { boxShadow: th.dark ? '0 10px 24px -14px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.08)' : '0 10px 24px -16px rgba(11,27,63,0.45)', transition: 'all 140ms ease' } : null),
        })) as any}>
        <Icon name={icon ?? 'close'} size={19} color={edge} />
        <Text numberOfLines={1} style={{ color: th.text, fontWeight: '800', fontSize: 15, letterSpacing: 0.3 }}>{label}</Text>
      </Pressable>
    );
  }

  const g = GRAD[kind === 'take' ? 'buy' : kind];
  const glow = g[0];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled: off, busy: !!busy }} disabled={off} onPress={onPress}
      style={((st: any) => ({
        ...(flex ? { flex } : null), height, borderRadius: 12, overflow: 'hidden', backgroundColor: g[1], borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
        opacity: off ? 0.55 : st.pressed ? 0.9 : 1, cursor: 'pointer', transform: [{ scale: st.pressed ? 0.985 : 1 }],
        ...(web ? {
          backgroundImage: `linear-gradient(135deg, ${g.join(', ')})`,
          boxShadow: `0 12px 28px -12px ${glow}CC, 0 2px 0 rgba(255,255,255,0.22) inset`,
          filter: st.hovered && !off ? 'brightness(1.08)' : 'none', transition: 'filter 140ms ease, transform 120ms ease',
        } : null),
      })) as any}>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 18 }}>
        {busy ? <ActivityIndicator color="#FFFFFF" /> : !!icon && <Icon name={icon} size={20} color="#FFFFFF" />}
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}
          style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 15.5, letterSpacing: 0.4, flexShrink: 1, ...(web ? { textShadow: '0 1px 2px rgba(0,0,0,0.35)' } : null) } as any}>{label}</Text>
      </View>
    </Pressable>
  );
}
