import React from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Rect, Line, Circle } from 'react-native-svg';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

// Every analysis method: name, one-line help, its colour pair and its glyph. The icon is a glossy gradient tile with a white glyph.
export type MKey = 'all' | 'cr' | 'ict' | 'smc' | 'topdown' | 'scanner' | 'vsa' | 'candle' | 'pat' | 'scalp' | 'liquidity' | 'entry' | 'momentum' | 'planner' | 'settings';
export type Host = 'ict' | 'cr' | 'scalp' | 'topdown' | 'scanner' | 'insight' | 'tab';
type Glyph = { t: 'ion' | 'mci'; n: string } | { t: 'candles' } | { t: 'candles2' } | { t: 'bars' };
export type MDef = { k: MKey; label: string; desc: string; colors: [string, string]; glyph: Glyph; host: Host; tab?: number; score?: boolean };

export const MDEFS: MDef[] = [
  { k: 'all', label: 'Combined Analysis', desc: 'All-in-one analysis using trend, liquidity, order blocks, FVG, sessions and more.', colors: ['#8B5CF6', '#5B2EFF'], glyph: { t: 'candles' }, host: 'ict', score: true },
  { k: 'cr', label: 'CR (Chart Reader) Analysis', desc: 'Chart Reader reads the live candles with every method and gives entry, stop loss and 3 take profits, drawn on the chart.', colors: ['#22D3EE', '#0E7490'], glyph: { t: 'mci', n: 'chart-areaspline' }, host: 'cr' },
  { k: 'ict', label: 'ICT Analysis', desc: 'Smart money concepts, liquidity sweeps, FVG, order blocks, killzones, OTE & more.', colors: ['#4C8DFF', '#2457E6'], glyph: { t: 'ion', n: 'locate' }, host: 'ict', score: true },
  { k: 'smc', label: 'SMC Analysis', desc: 'Market structure, BOS/CHoCH, demand/supply zones, liquidity pools.', colors: ['#34D399', '#0F9D63'], glyph: { t: 'mci', n: 'sitemap' }, host: 'ict', score: true },
  { k: 'topdown', label: 'Top-Down Analysis', desc: 'Multi-timeframe approach with trend, key levels and confluence.', colors: ['#FFB62E', '#FF7A18'], glyph: { t: 'ion', n: 'layers' }, host: 'topdown', score: true },
  { k: 'scanner', label: 'Market Scanner', desc: 'Scan multiple markets for high probability setups with smart filters.', colors: ['#FF5CA8', '#E11D74'], glyph: { t: 'ion', n: 'search' }, host: 'scanner', score: true },
  { k: 'vsa', label: 'VSA Analysis', desc: 'Volume spread analysis for stronger confirmation and valid setups.', colors: ['#2DD4BF', '#0E9F8E'], glyph: { t: 'bars' }, host: 'ict', score: true },
  { k: 'candle', label: 'Candlestick Patterns', desc: 'Identify classic and advanced candlestick patterns with confirmation.', colors: ['#FF6B7A', '#E0314B'], glyph: { t: 'candles2' }, host: 'ict', score: true },
  { k: 'pat', label: 'Chart Patterns', desc: 'Triangles, flags, channels, head & shoulders and more with target projection.', colors: ['#8B6BFF', '#5B3FE0'], glyph: { t: 'mci', n: 'triangle-outline' }, host: 'ict', score: true },
  { k: 'scalp', label: 'Scalping', desc: 'Supply / demand zone, then a reversal candle, then a confirmation candle. M1 to H1. Entry, stop and exit rule.', colors: ['#4C8DFF', '#1D4ED8'], glyph: { t: 'mci', n: 'speedometer' }, host: 'scalp', score: true },
  { k: 'liquidity', label: 'Liquidity Map', desc: 'Find liquidity zones, sweeps, equal highs/lows and institutional levels.', colors: ['#19D3C0', '#0A9D8A'], glyph: { t: 'ion', n: 'water' }, host: 'insight' },
  { k: 'entry', label: 'Entry Finder', desc: 'Precision entries using order blocks, FVG, retracements and confluence.', colors: ['#FFC83D', '#FF9500'], glyph: { t: 'mci', n: 'crosshairs-gps' }, host: 'insight', score: true },
  { k: 'momentum', label: 'Momentum & Volume', desc: 'Trend strength, volume, volatility and momentum indicators.', colors: ['#FF5C7A', '#E11D48'], glyph: { t: 'mci', n: 'chart-line-variant' }, host: 'insight', score: true },
  { k: 'planner', label: 'Trade Planner', desc: 'Calculate entry, SL, targets, position size, risk/reward and trade management.', colors: ['#9D6BFF', '#6D28D9'], glyph: { t: 'ion', n: 'clipboard' }, host: 'tab', tab: 4 },
];
export const mdef = (k: string) => MDEFS.find((x) => x.k === k);

// Hand-drawn glyphs that the icon fonts do not have (candles and volume bars).
function Art({ g, size }: { g: Glyph; size: number }) {
  const w = '#FFFFFF';
  if (g.t === 'ion') return <Ionicons name={g.n as any} size={size} color={w} />;
  if (g.t === 'mci') return <MaterialCommunityIcons name={g.n as any} size={size} color={w} />;
  if (g.t === 'candles') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Line x1="5" y1="3" x2="5" y2="21" stroke={w} strokeWidth="1.6" strokeLinecap="round" />
        <Rect x="2.6" y="8" width="4.8" height="8" rx="1.2" fill={w} />
        <Line x1="12" y1="2" x2="12" y2="19" stroke={w} strokeWidth="1.6" strokeLinecap="round" />
        <Rect x="9.6" y="5" width="4.8" height="10" rx="1.2" fill={w} />
        <Line x1="19" y1="1" x2="19" y2="16" stroke={w} strokeWidth="1.6" strokeLinecap="round" />
        <Rect x="16.6" y="3.5" width="4.8" height="7.5" rx="1.2" fill={w} />
      </Svg>
    );
  }
  if (g.t === 'candles2') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Line x1="7" y1="2" x2="7" y2="22" stroke={w} strokeWidth="1.8" strokeLinecap="round" />
        <Rect x="3.8" y="6" width="6.4" height="11" rx="1.6" fill={w} />
        <Line x1="17" y1="3" x2="17" y2="21" stroke={w} strokeWidth="1.8" strokeLinecap="round" />
        <Rect x="13.8" y="9" width="6.4" height="9" rx="1.6" fill={w} />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="2.5" y="12" width="3.8" height="9" rx="1.2" fill={w} />
      <Rect x="8.2" y="8" width="3.8" height="13" rx="1.2" fill={w} />
      <Rect x="13.9" y="10" width="3.8" height="11" rx="1.2" fill={w} />
      <Rect x="19.4" y="4" width="3.2" height="17" rx="1.2" fill={w} />
      <Circle cx="4.4" cy="8" r="1.5" fill={w} />
      <Circle cx="10.1" cy="4" r="1.5" fill={w} />
      <Circle cx="15.8" cy="6" r="1.5" fill={w} />
    </Svg>
  );
}

// Glossy gradient tile with a white glyph: the icon style of the Analysis page.
export function MethodIcon({ def, size = 52 }: { def: MDef; size?: number }) {
  const r = 8;
  return (
    <LinearGradient colors={def.colors} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
      style={{ width: size, height: size, borderRadius: r, alignItems: 'center', justifyContent: 'center', shadowColor: def.colors[1], shadowOpacity: 0.32, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3, direction: 'ltr' }}>
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: size * 0.5, borderTopLeftRadius: r, borderTopRightRadius: r, backgroundColor: '#FFFFFF', opacity: 0.16 }} />
      <Art g={def.glyph} size={size * 0.52} />
    </LinearGradient>
  );
}

// Small circular score: the ring fills with the score, the number sits next to it.
export function MiniRing({ score, color, track, text, size = 26 }: { score: number | null; color: string; track: string; text: string; size?: number }) {
  const r = (size - 5) / 2, c = 2 * Math.PI * r, v = score == null ? 0 : Math.max(0, Math.min(100, score));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, direction: 'ltr' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={3.2} fill="none" />
        {score != null && <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={3.2} fill="none" strokeLinecap="round" strokeDasharray={`${(c * v) / 100} ${c}`} />}
      </Svg>
      <Text style={{ color: score == null ? track : color, fontWeight: '900', fontSize: 12 }}>{score == null ? '--' : `${Math.round(v)}%`}</Text>
      {!!text && <Text style={{ color: track, fontSize: 10.5 }}>{text}</Text>}
    </View>
  );
}
