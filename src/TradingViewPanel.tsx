import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Linking } from 'react-native';
import { useApp } from './store';
import { Card, Icon, Badge } from './ui';
import ChartWeb from './ChartWeb';
import { TFS } from './markets';
import { tvHtml, TV_INTERVAL, TV_STUDIES, TV_STYLES, TV_GROUPS } from './tv';

// The TradingView tab: a full TradingView advanced chart with a professional control deck around it.
//  - header: TradingView name, the exact TradingView symbol, interval, refresh and full screen
//  - timeframe strip (M1 ... D1), chart style (candles, hollow, Heikin Ashi, bars, line, area)
//  - indicators picker grouped by Trend / Momentum / Volatility / Volume, with a count and Clear
//  - two-finger pinch zooms the chart in and out, one finger drags it (the page stops scrolling while a finger is on the chart)
export default function TradingViewPanel({ symbol, symId, tf, onTf, studies, onStudies, cstyle, onStyle, height, onFull, onSymbol, onTouching }: {
  symbol: string; symId: string; tf: string; onTf: (k: string) => void; studies: string[]; onStudies: (s: string[]) => void;
  cstyle: string; onStyle: (k: string) => void; height: number; onFull: () => void; onSymbol?: (raw: string) => void; onTouching?: (on: boolean) => void;
}) {
  const { th } = useApp();
  const [open, setOpen] = useState(false);
  const [reload, setReload] = useState(0);
  const html = tvHtml(symbol, TV_INTERVAL[tf] ?? '15', th.dark, th.bg, TV_STUDIES.filter((x) => studies.includes(x.k)).map((x) => x.id), cstyle);
  const tfLabel = TFS.find((x) => x.k === tf)?.label ?? tf;
  const toggle = (k: string) => onStudies(studies.includes(k) ? studies.filter((x) => x !== k) : [...studies, k]);

  const IconBtn = ({ name, onPress, on }: { name: string; onPress: () => void; on?: boolean }) => (
    <Pressable onPress={onPress} hitSlop={6} style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? th.accent + '26' : th.panel2, borderWidth: 1, borderColor: on ? th.accent : th.hair, opacity: pressed ? 0.7 : 1 })}>
      <Icon name={name} size={18} color={on ? th.accent : th.text} />
    </Pressable>
  );

  return (
    <View style={{ gap: 10 }}>
      {/* header */}
      <Card style={{ padding: 12, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 38, height: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: th.accent + '22', borderWidth: 1, borderColor: th.accent + '66' }}>
            <Icon name="stats-chart" size={20} color={th.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: th.text, fontSize: 16, fontWeight: '900', letterSpacing: -0.2 }}>TradingView</Text>
            <Text numberOfLines={1} style={{ color: th.dim, fontSize: 11.5, fontWeight: '700' }}>Advanced chart · {symbol}</Text>
          </View>
          <Badge label={tfLabel} color={th.accent} />
          <IconBtn name="refresh" onPress={() => setReload((n) => n + 1)} />
          <IconBtn name="expand-outline" onPress={onFull} />
        </View>

        {/* timeframe */}
        <View style={{ gap: 6 }}>
          <Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '900', letterSpacing: 1 }}>TIMEFRAME</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {TFS.map((x) => {
              const on = x.k === tf;
              return (
                <Pressable key={x.k} onPress={() => onTf(x.k)} style={({ pressed }) => ({ minWidth: 46, height: 34, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? th.accent : th.panel2, borderWidth: 1, borderColor: on ? th.accent : th.hair, opacity: pressed ? 0.8 : 1 })}>
                  <Text style={{ color: on ? th.onAccent : th.text, fontWeight: '900', fontSize: 12.5 }}>{x.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* chart style */}
        <View style={{ gap: 6 }}>
          <Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '900', letterSpacing: 1 }}>CHART STYLE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {TV_STYLES.map((x) => {
              const on = x.k === cstyle;
              return (
                <Pressable key={x.k} onPress={() => onStyle(x.k)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 8, backgroundColor: on ? th.accent + '26' : th.panel2, borderWidth: 1, borderColor: on ? th.accent : th.hair, opacity: pressed ? 0.8 : 1 })}>
                  <Icon name={x.icon} size={15} color={on ? th.accent : th.dim} />
                  <Text style={{ color: on ? th.accent : th.text, fontWeight: '800', fontSize: 12.5 }}>{x.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Card>

      {/* the chart */}
      <View style={{ borderRadius: 8, borderWidth: 1, borderColor: th.line, overflow: 'hidden', backgroundColor: th.panel }}>
        <ChartWeb key={`${symbol}-${tf}-${cstyle}-${studies.join('')}-${th.bg}-${reload}`} html={html} height={height} onSymbol={onSymbol} onTouching={onTouching} />
      </View>

      {/* hint */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}>
        <Icon name="hand-left-outline" size={15} color={th.dim} />
        <Text style={{ flex: 1, color: th.dim, fontSize: 11.5 }}>Pinch with two fingers to zoom in and out. Drag to move through time. Use the toolbar on the left of the chart for drawing tools and Fibonacci.</Text>
      </View>

      {/* indicators */}
      <Card style={{ padding: 12, gap: 10 }}>
        <Pressable onPress={() => setOpen(!open)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="options-outline" size={17} color={th.accent} />
          <Text style={{ color: th.text, fontSize: 12.5, fontWeight: '900', letterSpacing: 1, flex: 1 }}>INDICATORS</Text>
          {studies.length > 0 && <Badge label={String(studies.length)} color={th.accent} />}
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color={th.dim} />
        </Pressable>

        {studies.length > 0 && !open && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {TV_STUDIES.filter((x) => studies.includes(x.k)).map((x) => (
              <Pressable key={x.k} onPress={() => toggle(x.k)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 30, paddingHorizontal: 10, borderRadius: 8, backgroundColor: th.accent + '22', borderWidth: 1, borderColor: th.accent + '66' }}>
                <Text style={{ color: th.accent, fontWeight: '800', fontSize: 12 }}>{x.label}</Text>
                <Icon name="close" size={13} color={th.accent} />
              </Pressable>
            ))}
          </ScrollView>
        )}

        {open && (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={() => onStudies(['rsi', 'macd', 'bb'])} style={{ flex: 1, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: th.panel2, borderWidth: 1, borderColor: th.hair }}>
                <Text style={{ color: th.text, fontWeight: '800', fontSize: 12.5 }}>Quick set · RSI, MACD, Bollinger</Text>
              </Pressable>
              <Pressable onPress={() => onStudies([])} disabled={!studies.length} style={{ width: 90, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: th.panel2, borderWidth: 1, borderColor: th.hair, opacity: studies.length ? 1 : 0.4 }}>
                <Text style={{ color: th.sell, fontWeight: '800', fontSize: 12.5 }}>Clear all</Text>
              </Pressable>
            </View>
            {TV_GROUPS.map((g) => (
              <View key={g.g} style={{ gap: 6 }}>
                <Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '900', letterSpacing: 1 }}>{g.label.toUpperCase()}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {TV_STUDIES.filter((x) => x.g === g.g).map((x) => {
                    const on = studies.includes(x.k);
                    return (
                      <Pressable key={x.k} onPress={() => toggle(x.k)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 5, height: 34, paddingHorizontal: 11, borderRadius: 8, backgroundColor: on ? th.accent : th.panel2, borderWidth: 1, borderColor: on ? th.accent : th.hair, opacity: pressed ? 0.8 : 1 })}>
                        {on && <Icon name="checkmark" size={14} color={th.onAccent} />}
                        <Text style={{ color: on ? th.onAccent : th.text, fontWeight: '800', fontSize: 12.5 }}>{x.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )}
      </Card>

      <Pressable onPress={() => Linking.openURL(`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`).catch(() => {})} style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}>
        <Icon name="open-outline" size={14} color={th.dim} />
        <Text style={{ color: th.dim, fontSize: 11.5, fontWeight: '700' }}>Open {symId} on tradingview.com</Text>
      </Pressable>
    </View>
  );
}
