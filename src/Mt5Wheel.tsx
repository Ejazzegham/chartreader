import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { useApp } from './store';
import { Icon } from './ui';

// The round quick menu of MetaTrader 5 on a phone: a blue ring with the timeframes around the top and right, and the tools
// (line, crosshair, indicators, objects, windows) around the lower left. Tap a segment to use it, tap the middle or outside to close.
export type WheelTf = { k: string; label: string };
export type WheelAction = { key: string; icon: string; label: string; on?: boolean; press: () => void };

const MT5_BLUE = '#2D7DF6';
const DEG = Math.PI / 180;

export function RadialWheel({ w, h, tfs, current, onTf, actions, onClose }: { w: number; h: number; tfs: WheelTf[]; current?: string; onTf?: (k: string) => void; actions: WheelAction[]; onClose: () => void }) {
  const S = Math.max(190, Math.min(270, Math.min(w, h) - 16)), c = S / 2, R = c - 2, r = R * 0.56, rm = (R + r) / 2;
  const slots = tfs.length + actions.length, sl = 360 / Math.max(1, slots), a0 = -64; // M1 sits at about ten o'clock, like MT5
  const mid = (i: number) => a0 + i * sl;
  const pt = (a: number, rad: number) => ({ x: c + rad * Math.sin(a * DEG), y: c - rad * Math.cos(a * DEG) });
  const sector = (i: number) => {
    const s = mid(i) - sl / 2, e = mid(i) + sl / 2, p1 = pt(s, R), p2 = pt(e, R), p3 = pt(e, r), p4 = pt(s, r);
    return `M${p1.x} ${p1.y} A${R} ${R} 0 0 1 ${p2.x} ${p2.y} L${p3.x} ${p3.y} A${r} ${r} 0 0 0 ${p4.x} ${p4.y} Z`;
  };
  const ring = `M${c - R} ${c} A${R} ${R} 0 1 1 ${c + R} ${c} A${R} ${R} 0 1 1 ${c - R} ${c} Z M${c - r} ${c} A${r} ${r} 0 1 0 ${c + r} ${c} A${r} ${r} 0 1 0 ${c - r} ${c} Z`;

  const sc = useRef(new Animated.Value(0.6)).current, op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([Animated.spring(sc, { toValue: 1, friction: 7, tension: 140, useNativeDriver: true }), Animated.timing(op, { toValue: 1, duration: 120, useNativeDriver: true })]).start();
  }, []);

  const hit = (x: number, y: number) => {
    const dx = x - c, dy = y - c, d = Math.hypot(dx, dy);
    if (d > R + 4 || d < r) return onClose();
    const ang = Math.atan2(dx, -dy) / DEG, rel = (((ang - (a0 - sl / 2)) % 360) + 360) % 360, i = Math.min(slots - 1, Math.floor(rel / sl));
    if (i < tfs.length) onTf?.(tfs[i].k); else actions[i - tfs.length]?.press();
    onClose();
  };

  return (
    <Pressable onPress={onClose} style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.08)', direction: 'ltr' }}>
      <Animated.View style={{ width: S, height: S, opacity: op, transform: [{ scale: sc }] }}>
        <Pressable onPress={(e) => hit(e.nativeEvent.locationX, e.nativeEvent.locationY)} style={{ width: S, height: S }}>
          <Svg width={S} height={S} pointerEvents="none">
            <Path d={ring} fill={MT5_BLUE} fillRule="evenodd" />
            {tfs.map((t, i) => t.k === current && <Path key={`cur${t.k}`} d={sector(i)} fill="#FFFFFF" fillOpacity={0.26} />)}
            {tfs.map((t, i) => {
              const a = mid(i), p = pt(a, rm), flip = Math.abs(((a + 180) % 360) - 180) > 90, rot = flip ? a + 180 : a;
              return <SvgText key={t.k} x={p.x} y={p.y + 4.5} fontSize={t.k === current ? 15 : 13.5} fontWeight={t.k === current ? '900' : '700'} fill="#FFFFFF" textAnchor="middle" transform={`rotate(${rot} ${p.x} ${p.y})`}>{t.label}</SvgText>;
            })}
          </Svg>
          {actions.map((a, i) => {
            const p = pt(mid(tfs.length + i), rm);
            return (
              <View key={a.key} pointerEvents="none" accessibilityLabel={a.label} style={{ position: 'absolute', left: p.x - 15, top: p.y - 15, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: a.on ? 'rgba(255,255,255,0.30)' : 'transparent' }}>
                <Icon name={a.icon} size={19} color="#FFFFFF" />
              </View>
            );
          })}
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}

// The small bar above the chart: timeframe chip (opens the wheel), crosshair mode, fit / reset. Extra buttons go in `extra`.
export function Mt5Bar({ tfLabel, onWheel, crossMode, onCross, onFit, fitOn, extra }: { tfLabel?: string; onWheel: () => void; crossMode: boolean; onCross: () => void; onFit?: () => void; fitOn?: boolean; extra?: React.ReactNode }) {
  const { th } = useApp();
  const btn = (on: boolean) => ({ height: 34, minWidth: 34, paddingHorizontal: 8, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const, flexDirection: 'row' as const, gap: 5, borderWidth: 1, borderColor: on ? th.accent : th.line, backgroundColor: on ? th.accent + '26' : 'transparent' });
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', direction: 'ltr' }}>
      {!!tfLabel && (
        <Pressable onPress={onWheel} accessibilityRole="button" accessibilityLabel="Timeframe wheel" style={btn(false)}>
          <Icon name="radio-button-on-outline" size={15} color={th.accent} />
          <Text style={{ color: th.text, fontWeight: '900', fontSize: 13 }}>{tfLabel}</Text>
        </Pressable>
      )}
      <Pressable onPress={onCross} accessibilityRole="button" accessibilityLabel="Crosshair" style={btn(crossMode)}>
        <Icon name="locate" size={17} color={crossMode ? th.accent : th.text} />
      </Pressable>
      {!!onFit && (
        <Pressable onPress={onFit} accessibilityRole="button" accessibilityLabel="Fit chart" style={btn(!!fitOn)}>
          <Icon name="scan-outline" size={17} color={fitOn ? th.accent : th.text} />
        </Pressable>
      )}
      {extra}
    </View>
  );
}
