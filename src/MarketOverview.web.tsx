import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Icon } from './ui';
import { Coin } from './MarketWidgets';
import { SYMBOLS, Sym, chg, isBad, useFeed, setWatch, symOf } from './markets';
import { useRealWindow } from './win';
import { useHeadlines, ago, tone, safeHttpUrl } from './headlines';
import { usePal, Panel, useGo } from './DesktopHome.web';
import { Sessions } from './AnalysisHome.web';

// Market overview for the TradingView page (website). It holds only what the chart workspace does not already have:
// sessions, forex sentiment, top movers, heatmap, news and today's facts. The market list, watchlist, search, categories and
// the chart itself live in the TradingView workspace above, so nothing is shown twice. Every number comes from the live feed.
const GOLD_SILVER = ['frxXAUUSD', 'frxXAGUSD'], OIL = ['frxWTI', 'frxBRENT'];
const FX_FIRST = ['frxEURUSD', 'frxGBPUSD', 'frxUSDJPY', 'frxAUDUSD', 'frxUSDCAD', 'frxDXY', 'frxXAUUSD', 'frxXAGUSD', 'frxWTI', 'frxBRENT', 'cryBTCUSD', 'cryETHUSD'];
type CatKey = 'forex' | 'crypto' | 'indices' | 'commodities' | 'metals' | 'deriv';
const GROUPS: { k: CatKey; label: string }[] = [{ k: 'forex', label: 'Forex' }, { k: 'crypto', label: 'Crypto' }, { k: 'indices', label: 'Indices' }, { k: 'metals', label: 'Metals' }, { k: 'commodities', label: 'Commodities' }];
const catOf = (s: Sym): CatKey => (GOLD_SILVER.includes(s.id) ? 'metals' : OIL.includes(s.id) ? 'commodities' : s.cat === 'indices' ? 'indices' : s.cat === 'crypto' ? 'crypto' : s.cat === 'deriv' ? 'deriv' : 'forex');

function Gauge({ pct, color, track }: { pct: number; color: string; track: string }) {
  const len = Math.PI * 70, p = Math.max(0, Math.min(1, pct / 100));
  return (
    <Svg width={170} height={96} viewBox="0 0 170 96">
      <Path d="M 15 88 A 70 70 0 0 1 155 88" stroke={track} strokeWidth={13} fill="none" strokeLinecap="round" />
      <Path d="M 15 88 A 70 70 0 0 1 155 88" stroke={color} strokeWidth={13} fill="none" strokeLinecap="round" strokeDasharray={`${len * p} ${len}`} />
    </Svg>
  );
}

function Head({ icon, title, sub, right, onRight }: { icon: string; title: string; sub?: string; right?: string; onRight?: () => void }) {
  const P = usePal();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Icon name={icon} size={19} color={P.blue} />
      <Text style={{ color: P.head, fontSize: 17, fontWeight: '800', letterSpacing: -0.2 }}>{title}</Text>
      {!!sub && <Text style={{ color: P.body, fontSize: 11.5, marginLeft: 6 }}>{sub}</Text>}
      <View style={{ flex: 1 }} />
      {!!right && <Pressable onPress={onRight} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, cursor: 'pointer' } as any}><Text style={{ color: P.blue, fontSize: 12, fontWeight: '600' }}>{right}</Text><Icon name="arrow-forward" size={12} color={P.blue} /></Pressable>}
    </View>
  );
}

export default function MarketOverview({ active, onPick }: { active: boolean; onPick: (id: string) => void }) {
  const P = usePal(), th = P.th, go = useGo();
  const w = useRealWindow().width;
  const { quotes, status } = useFeed(active);
  const live = status === 'live';
  const [mover, setMover] = useState<'gain' | 'lose'>('gain');
  const heads = useHeadlines('forex', active);

  // quotes are only fetched for pairs somebody watches: a spread of every market feeds movers, sentiment and the heatmap
  const all = useMemo(() => SYMBOLS.filter((s) => !isBad(s.id)), [Object.keys(quotes).length]);
  const spread = useMemo(() => [...new Set([...FX_FIRST, ...all.filter((s) => catOf(s) !== 'deriv').slice(0, 40).map((s) => s.id)])].filter((id) => !isBad(id)), [all]);
  const watchKey = spread.join(',');
  useEffect(() => { if (active) setWatch('mk-overview', watchKey.split(',')); return () => setWatch('mk-overview', []); }, [active, watchKey]);

  const withQ = spread.map(symOf).filter((s) => quotes[s.id]);
  const forexSet = withQ.filter((s) => catOf(s) === 'forex');
  const upPct = forexSet.length ? Math.round((forexSet.filter((s) => chg(s.id) > 0).length / forexSet.length) * 100) : 50;
  const senti = upPct >= 60 ? { l: 'Bullish', c: th.buy } : upPct <= 40 ? { l: 'Bearish', c: th.sell } : { l: 'Neutral', c: th.gold };
  const movers = useMemo(() => [...withQ].sort((a, b) => (mover === 'gain' ? chg(b.id) - chg(a.id) : chg(a.id) - chg(b.id))).slice(0, 5), [withQ.map((s) => s.id).join(','), mover, Object.values(quotes).length]);
  const heat = GROUPS.map((g) => {
    const l = withQ.filter((s) => catOf(s) === g.k);
    return { k: g.k, label: g.label, v: l.length ? l.reduce((a, s) => a + chg(s.id), 0) / l.length : null };
  }).filter((h) => h.v != null);
  const best = [...withQ].sort((a, b) => chg(b.id) - chg(a.id))[0], worst = [...withQ].sort((a, b) => chg(a.id) - chg(b.id))[0];
  const dxy = quotes['frxDXY'] ? chg('frxDXY') : null;
  const pm = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}%`;
  const insights: { s?: Sym; t: string; d: string }[] = [];
  if (best && chg(best.id) > 0) insights.push({ s: best, t: `${best.name} leads the gainers`, d: `${pm(chg(best.id))} today among the markets tracked.` });
  if (worst && chg(worst.id) < 0) insights.push({ s: worst, t: `${worst.name} is the weakest`, d: `${pm(chg(worst.id))} today among the markets tracked.` });
  if (dxy != null) insights.push({ s: symOf('frxDXY'), t: `US Dollar Index is ${dxy >= 0 ? 'higher' : 'lower'}`, d: `${pm(dxy)} today. A stronger dollar often weighs on EUR/USD, gold and crypto.` });
  if (forexSet.length) insights.push({ t: `${forexSet.filter((s) => chg(s.id) > 0).length} of ${forexSet.length} forex pairs are up`, d: 'Share of tracked forex pairs trading above their daily open.' });

  const cell = { flexGrow: 1, flexBasis: w >= 1180 ? 360 : 300, minWidth: 0 } as const;
  return (
    <View style={{ gap: 16, marginTop: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Icon name="globe-outline" size={19} color={P.blue} />
        <Text style={{ color: P.head, fontSize: 17, fontWeight: '800', letterSpacing: -0.2 }}>Market Overview</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 6 }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: live ? th.buy : P.body }} /><Text style={{ color: live ? th.buy : P.body, fontSize: 11.5, fontWeight: '700' }}>{live ? 'Live' : status === 'connecting' ? 'Connecting…' : 'Offline'}</Text></View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'stretch' }}>
        <View style={cell}><Sessions go={(t) => go(t)} style={{ flex: 0, minWidth: 0, padding: 20 }} /></View>

        <View style={cell}>
          <Panel style={{ padding: 20, gap: 8, flexGrow: 1 }}>
            <Head icon="shield-checkmark" title="Forex Market Sentiment" right="News" onRight={() => go(13)} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 170, height: 96, alignItems: 'center' }}>
                <Gauge pct={upPct} color={senti.c} track={P.dark ? th.panel2 : '#EEF2F8'} />
                <Text style={{ position: 'absolute', bottom: 0, color: P.head, fontSize: 26, fontWeight: '800' }}>{forexSet.length ? `${upPct}%` : '—'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: senti.c, fontSize: 17, fontWeight: '800' }}>{forexSet.length ? senti.l : 'Loading'}</Text>
                <Text style={{ color: P.body, fontSize: 11.5, lineHeight: 16 }}>Share of forex pairs trading above today’s open.</Text>
              </View>
            </View>
          </Panel>
        </View>

        <View style={cell}>
          <Panel style={{ padding: 20, gap: 10, flexGrow: 1 }}>
            <Head icon="trending-up" title="Top Movers" />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {([['gain', 'Gainers', 'arrow-up', th.buy], ['lose', 'Losers', 'arrow-down', th.sell]] as const).map(([k, l, ic, c]) => (
                <Pressable key={k} onPress={() => setMover(k)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 34, borderRadius: 6, backgroundColor: mover === k ? c + '1F' : P.alt, cursor: 'pointer' } as any}>
                  <Icon name={ic} size={13} color={c} /><Text style={{ color: mover === k ? c : P.body, fontSize: 12.5, fontWeight: '700' }}>{l}</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: 'row', paddingHorizontal: 4 }}>
              <Text style={{ flex: 1.6, color: P.body, fontSize: 11 }}>Symbol</Text><Text style={{ flex: 1, color: P.body, fontSize: 11, textAlign: 'right' }}>Price</Text><Text style={{ flex: 1, color: P.body, fontSize: 11, textAlign: 'right' }}>Change</Text>
            </View>
            {movers.length === 0 && <Text style={{ color: P.body, fontSize: 12.5 }}>Waiting for prices…</Text>}
            {movers.map((m) => {
              const c = chg(m.id), col = c >= 0 ? th.buy : th.sell, x = quotes[m.id];
              return (
                <Pressable key={m.id} onPress={() => onPick(m.id)} style={((st: any) => ({ flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingHorizontal: 4, borderRadius: 6, cursor: 'pointer', backgroundColor: st.hovered ? P.alt : 'transparent' })) as any}>
                  <View style={{ flex: 1.6, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 }}><Coin s={m} size={22} /><Text style={{ color: P.head, fontSize: 12.5, fontWeight: '600', flex: 1 }} numberOfLines={1}>{m.name}</Text></View>
                  <Text style={{ flex: 1, color: P.head, fontSize: 12.5, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{x ? x.price.toFixed(x.dec) : '—'}</Text>
                  <Text style={{ flex: 1, color: col, fontSize: 12.5, fontWeight: '700', textAlign: 'right' }}>{pm(c)}</Text>
                </Pressable>
              );
            })}
          </Panel>
        </View>

        <View style={cell}>
          <Panel style={{ padding: 20, gap: 12, flexGrow: 1 }}>
            <Head icon="grid" title="Market Heatmap" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {heat.length === 0 && <Text style={{ color: P.body, fontSize: 12.5 }}>Waiting for prices…</Text>}
              {heat.map((h) => {
                const up = (h.v ?? 0) >= 0, a = Math.min(1, Math.abs(h.v ?? 0) / 2), base = up ? th.buy : th.sell;
                return (
                  <View key={h.k} style={{ width: '31.5%', height: 58, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: base + (Math.round(40 + a * 120)).toString(16).padStart(2, '0') } as any}>
                    <Text style={{ color: P.head, fontSize: 12, fontWeight: '700' }}>{h.label}</Text>
                    <Text style={{ color: up ? th.buy : th.sell, fontSize: 12, fontWeight: '800' }}>{pm(h.v as number)}</Text>
                  </View>
                );
              })}
            </View>
            <Text style={{ color: P.body, fontSize: 11 }}>Average daily change of the markets tracked in each group.</Text>
          </Panel>
        </View>

        <View style={cell}>
          <Panel style={{ padding: 20, gap: 12, flexGrow: 1 }}>
            <Head icon="newspaper" title="Latest Market News" right="View All" onRight={() => go(13)} />
            {heads.items.length === 0 && <Text style={{ color: P.body, fontSize: 12.5 }}>{heads.loading ? 'Loading headlines…' : heads.err || 'No headlines right now.'}</Text>}
            {heads.items.slice(0, 5).map((h) => {
              const t = tone(h.title), c = t === 'up' ? th.buy : t === 'down' ? th.sell : P.blue, url = safeHttpUrl(h.link);
              return (
                <Pressable key={h.id} onPress={() => url && Linking.openURL(url).catch(() => {})} style={{ flexDirection: 'row', gap: 10, cursor: 'pointer' } as any}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c, marginTop: 6 }} />
                  <View style={{ flex: 1 }}><Text style={{ color: P.head, fontSize: 12.5, fontWeight: '600', lineHeight: 17 }} numberOfLines={2}>{h.title}</Text><Text style={{ color: P.body, fontSize: 11 }}>{h.source} · {ago(h.t)}</Text></View>
                </Pressable>
              );
            })}
          </Panel>
        </View>

        <View style={cell}>
          <Panel style={{ padding: 20, gap: 12, flexGrow: 1 }}>
            <Head icon="bulb-outline" title="Today’s Market Facts" />
            {insights.length === 0 && <Text style={{ color: P.body, fontSize: 12.5 }}>Waiting for prices…</Text>}
            {insights.map((i, k) => (
              <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {i.s ? <Coin s={i.s} size={34} /> : <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: P.soft, alignItems: 'center', justifyContent: 'center' }}><Icon name="pie-chart" size={16} color={P.blue} /></View>}
                <View style={{ flex: 1 }}><Text style={{ color: P.head, fontSize: 12.5, fontWeight: '700' }} numberOfLines={1}>{i.t}</Text><Text style={{ color: P.body, fontSize: 11.5, lineHeight: 16 }} numberOfLines={2}>{i.d}</Text></View>
              </View>
            ))}
          </Panel>
        </View>
      </View>
    </View>
  );
}
