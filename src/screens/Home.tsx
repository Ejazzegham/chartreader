import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import DesktopHome from '../DesktopHome';
import { useDesktop } from '../Desktop';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../store';
import { Screen, Card, Body, Icon, IconTile, SectionHeader, Badge } from '../ui';
import { useFeed, chg, nameOf, setWatch, symOf, Sym, SYMBOLS } from '../markets';
import { Sessions, SymbolSheet } from '../MarketWidgets';
import EquityCurve from '../Equity';
import NewsBanner from '../NewsBanner';
import GuardBanner from '../Guard';
import AdminAccess from '../AdminAccess';
import { totalR, money, todayPnl } from '../trades';
import { totalPnl } from '../positions';
import { MANUAL_TAB } from '../manualTarget';
import { NAV } from '../nav';
import { CONTENT } from '../guideContent';

const MAJORS = ['cryBTCUSD', 'cryETHUSD', 'frxXAUUSD', 'frxXAGUSD', 'frxEURUSD', 'frxGBPUSD', 'frxUSDJPY', 'frxUSDCAD'];
const TIPS = [
  'Risk a fixed small percent of the account on every trade. Position size comes from the stop distance, not from a feeling.',
  'A setup that needs to be forced is not a setup. Wait for the sweep, the structure shift and the retest, then act.',
  'Trade the killzones: London open and the New York open carry most of the day\'s real moves.',
  'Write down why you took each trade. The Journal turns your mistakes into patterns you can fix.',
  'Never move a stop loss further away. Move it to break-even only after price has done its job.',
  'Check the news calendar before you trade. Red-folder events can wipe out a good setup in seconds.',
  'Higher timeframe first: mark the direction and key levels on the 4H, then look for the entry on the lower ones.',
];

type Tool = { key: string; icon: string; tab: number; desc: string; tint: [string, string] };

function PhoneHome() {
  const { th, t, account, history, journal, signals, positions, desk, setTab, setAmethod, tab, settings, setHistOpen, setHelpOpen, supportUnread } = useApp();
  const guide = (CONTENT[settings.lang] ?? CONTENT.en).guide;
  const guideTab = NAV.findIndex((n) => n.key === 'tabGuide');
  const gradeCol: Record<string, string> = { 'A+': th.buy, A: th.accent, B: th.gold, C: th.sell };
  const { quotes, db } = useFeed(tab === 0);
  const [sel, setSel] = useState<Sym | null>(null);
  const shown = db.favs.slice(0, 10);
  // liquid pairs the Top movers card always follows (only the ones this feed lists), plus the watch list
  const majors = MAJORS.filter((id) => SYMBOLS.some((x) => x.id === id));
  const followed = Array.from(new Set([...shown, ...majors]));
  useEffect(() => { setWatch('home', tab === 0 ? followed : []); return () => setWatch('home', []); }, [tab === 0, followed.join(',')]);
  const moving = followed.filter((id) => quotes[id] && isFinite(chg(id))).map((id) => ({ id, c: chg(id) })).sort((a, b) => b.c - a.c);
  const gainers = moving.filter((m) => m.c > 0).slice(0, 3), losers = [...moving].reverse().filter((m) => m.c < 0).slice(0, 3);
  const recent = [...signals].sort((a, b) => b.date - a.date).slice(0, 3);
  // performance snapshot from the journal
  const gross = journal.filter((j) => j.pnl > 0).reduce((a, j) => a + j.pnl, 0), lossAbs = Math.abs(journal.filter((j) => j.pnl < 0).reduce((a, j) => a + j.pnl, 0));
  const pf = lossAbs > 0 ? gross / lossAbs : gross > 0 ? Infinity : 0;
  const best = journal.length ? Math.max(...journal.map((j) => j.pnl)) : 0;
  const avg = journal.length ? journal.reduce((a, j) => a + j.pnl, 0) / journal.length : 0;
  const tip = TIPS[Math.floor(Date.now() / 864e5) % TIPS.length];
  const go = (method: string) => { if (method) setAmethod(method); else setAmethod(''); setTab(1); };
  const actions: { label: string; icon: string; colors: [string, string]; onPress: () => void }[] = [
    { label: 'Analysis', icon: 'analytics', colors: ['#8B5CF6', '#5B2EFF'], onPress: () => go('') },
    { label: 'Scanner', icon: 'search', colors: ['#FF5CA8', '#E11D74'], onPress: () => go('scanner') },
    { label: 'Scalping', icon: 'speedometer', colors: ['#4C8DFF', '#1D4ED8'], onPress: () => go('scalp') },
    { label: 'Top-Down', icon: 'layers', colors: ['#FFB62E', '#FF7A18'], onPress: () => go('topdown') },
    { label: 'Planner', icon: 'calculator', colors: ['#9D6BFF', '#6D28D9'], onPress: () => setTab(4) },
    { label: 'Journal', icon: 'book', colors: ['#34D399', '#0F9D63'], onPress: () => setTab(3) },
    { label: 'Killzones', icon: 'alarm', colors: ['#FF6B7A', '#E0314B'], onPress: () => setTab(8) },
    { label: 'News', icon: 'newspaper', colors: ['#2DD4BF', '#0E9F8E'], onPress: () => setTab(13) },
  ];

  const wins = journal.filter((j) => j.pnl > 0).length;
  const rate = journal.length ? Math.round((wins / journal.length) * 100) : 0;
  const total = journal.reduce((a, j) => a + j.pnl, 0);
  // trade desk numbers (setups waiting, trades running, result today)
  const waiting = signals.filter((x) => x.status === 'signal'), runningT = signals.filter((x) => x.status !== 'signal');
  const floatMoney = runningT.reduce((acc, x) => (x.status === 'open' && quotes[x.symId]?.price ? acc + totalR(x, quotes[x.symId].price) * x.risk : acc), 0);
  const todayMoney = todayPnl(journal);
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  // Pro tools: one featured card (Analysis: scanner, top-down, ICT, SMC, VSA, candlesticks, scalping) and a clean 2-column grid for the rest.
  const grid: Tool[] = [
    { key: 'tabNews', icon: 'newspaper', tab: 13, desc: 'navDescNews', tint: [th.gold, th.sell] },
    { key: 'tabKillzones', icon: 'alarm', tab: 8, desc: 'navDescKz', tint: [th.sell, th.gold] },
    { key: 'tabPerf', icon: 'stats-chart', tab: 9, desc: 'navDescPerf', tint: [th.buy, th.accent2] },
    { key: 'tabChecklist', icon: 'shield-checkmark', tab: 11, desc: 'navDescChecklist', tint: [th.accent, th.buy] },
  ];
  const pairs: Tool[][] = [];
  for (let i = 0; i < grid.length; i += 2) pairs.push(grid.slice(i, i + 2));

  const stat = (icon: string, label: string, value: string, color: string) => (
    <Card style={{ flex: 1, padding: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name={icon} size={13} color={th.dim} />
        <Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8 }} numberOfLines={1}>{label.toUpperCase()}</Text>
      </View>
      <Text style={{ color, fontSize: 22, fontWeight: '900', marginTop: 6, letterSpacing: -0.4 }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </Card>
  );

  return (
    <Screen icon="home" title={`${t('hello')}, ${account?.name.split(' ')[0] ?? ''}`} subtitle={today}>
      <View style={{ gap: 16 }}>
        <NewsBanner active={tab === 0} />
        <AdminAccess />
        {supportUnread > 0 && (
          <Pressable onPress={() => setHelpOpen(true)} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderColor: th.accent + '88' }}>
              <IconTile icon="chatbubbles" size={42} colors={[th.accent, th.accent2]} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: th.text, fontSize: 15, fontWeight: '900' }}>{t('helpNew')}</Text>
                <Text style={{ color: th.dim, fontSize: 12.5, marginTop: 2 }}>{t('helpTitle')}</Text>
              </View>
              <Badge label={String(supportUnread)} color={th.sell} />
            </Card>
          </Pressable>
        )}
        <GuardBanner />

        {/* ---------- quick actions ---------- */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 14, justifyContent: 'space-between' }}>
          {actions.map((a) => (
            <Pressable key={a.label} onPress={a.onPress} accessibilityRole="button" accessibilityLabel={a.label} style={({ pressed }) => ({ width: '23.5%', alignItems: 'center', gap: 7, opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] })}>
              <LinearGradient colors={a.colors} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={{ width: 56, height: 56, borderRadius: 8, alignItems: 'center', justifyContent: 'center', shadowColor: a.colors[1], shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3, direction: 'ltr' }}>
                <Icon name={a.icon} size={26} color="#FFFFFF" />
              </LinearGradient>
              <Text style={{ color: th.text, fontSize: 11.5, fontWeight: '800' }} numberOfLines={1}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* ---------- manual trade: one-click SELL / BUY like MetaTrader 5 ---------- */}
        {(() => {
          const flo = positions.reduce((a, p) => { const x = quotes[p.symId], m = p.side === 'buy' ? (x?.bid ?? x?.price) : (x?.ask ?? x?.price); return a + (m !== undefined ? totalPnl(p, m) : p.realized); }, 0);
          return (
            <Pressable onPress={() => setTab(MANUAL_TAB)} accessibilityRole="button" accessibilityLabel="Demo Trade" style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderColor: th.accent + '77' }}>
                <LinearGradient colors={[th.buy, th.sell]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 48, height: 48, borderRadius: 8, alignItems: 'center', justifyContent: 'center', direction: 'ltr' }}>
                  <Icon name="swap-vertical" size={26} color="#FFFFFF" />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: th.text, fontSize: 16, fontWeight: '900' }}>Demo Trade</Text>
                  <Text style={{ color: th.dim, fontSize: 12.5, lineHeight: 17, marginTop: 2 }}>{positions.length ? `${positions.length} running · floating ${money(flo)}` : 'Practice SELL / BUY on any pair with virtual money, like MetaTrader 5.'}</Text>
                </View>
                {positions.length > 0 && <Badge label={String(positions.length)} color={flo >= 0 ? th.buy : th.sell} />}
                <Icon name="chevron-forward" size={18} color={th.dim} />
              </Card>
            </Pressable>
          );
        })()}

        {/* ---------- hero ---------- */}
        <Pressable onPress={() => setTab(1)} style={({ pressed }) => ({ opacity: pressed ? 0.94 : 1 })}>
          <LinearGradient colors={[th.accent, th.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 8, padding: 20, overflow: 'hidden', shadowColor: th.accent, shadowOpacity: 0.45, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 8 }}>
            <View style={{ position: 'absolute', right: -40, top: -40, width: 170, height: 170, borderRadius: 85, backgroundColor: th.onAccent + '14' }} />
            <View style={{ position: 'absolute', right: 30, bottom: -60, width: 130, height: 130, borderRadius: 65, backgroundColor: th.onAccent + '0E' }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ backgroundColor: th.onAccent + '26', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: th.onAccent, fontSize: 10.5, fontWeight: '900', letterSpacing: 1 }}>LIVE SIGNALS</Text>
              </View>
              <View style={{ backgroundColor: th.onAccent, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ color: th.accent, fontSize: 10.5, fontWeight: '900', letterSpacing: 1 }}>CRT</Text>
              </View>
            </View>
            <Text style={{ color: th.onAccent, fontSize: 28, fontWeight: '900', marginTop: 12, letterSpacing: -0.6 }}>Trade analysis</Text>
            <Text style={{ color: th.onAccent + 'D0', lineHeight: 20, marginTop: 4 }}>Scanner, Top-Down, ICT, SMC, VSA, candlesticks and scalping. Every setup has an entry, stop loss and 3 take profits, and you choose Take or Skip.</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 }}>
              <Text style={{ color: th.onAccent, fontWeight: '900' }}>Open Analysis</Text>
              <Icon name="arrow-forward" size={16} color={th.onAccent} />
            </View>
          </LinearGradient>
        </Pressable>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          {stat('analytics-outline', t('statAnalyses'), String(history.length), th.text)}
          {stat('trophy-outline', t('statWinRate'), `${rate}%`, th.accent)}
          {stat('wallet-outline', t('statPnl'), total.toFixed(2), total >= 0 ? th.buy : th.sell)}
        </View>

        <Pressable onPress={() => setHistOpen(true)} accessibilityRole="button" accessibilityLabel={t('tabTradeHistory')} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
            <View style={{ width: 38, height: 38, borderRadius: 8, backgroundColor: th.gold + '26', alignItems: 'center', justifyContent: 'center' }}><Icon name="receipt" size={20} color={th.gold} /></View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: th.text, fontWeight: '900', fontSize: 14.5 }}>{t('tabTradeHistory')}</Text>
              <Text style={{ color: th.dim, fontSize: 11.5, marginTop: 1 }} numberOfLines={1}>{journal.length} {t('closedTradesWord')}</Text>
            </View>
            <Icon name="chevron-forward" size={18} color={th.dim} />
          </Card>
        </Pressable>

        {/* ---------- trade desk ---------- */}
        <Pressable onPress={() => setTab(3)} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
          <Card glow={waiting.length > 0 || runningT.length > 0} style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="briefcase-outline" size={16} color={th.accent} />
                <Text style={{ color: th.text, fontSize: 16, fontWeight: '900' }}>Trade desk</Text>
              </View>
              <Text style={{ color: th.accent, fontWeight: '800', fontSize: 12.5 }}>{t('tabJournal')} ›</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {([['SETUPS', String(waiting.length), waiting.length ? th.gold : th.dim, 'Waiting for you'], ['RUNNING', desk.maxOpen > 0 ? `${runningT.length}/${desk.maxOpen}` : String(runningT.length), runningT.length ? th.buy : th.dim, floatMoney ? money(floatMoney) : 'Live trades'], ['TODAY', money(todayMoney), todayMoney >= 0 ? th.buy : th.sell, 'Closed result']] as const).map(([k, v, c, sub]) => (
                <View key={k} style={{ flex: 1, backgroundColor: th.bg, borderRadius: 8, borderWidth: 1, borderColor: th.line, padding: 10 }}>
                  <Text style={{ color: th.dim, fontSize: 9.5, fontWeight: '900', letterSpacing: 0.7 }}>{k}</Text>
                  <Text style={{ color: c, fontSize: 18, fontWeight: '900', marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit>{v}</Text>
                  <Text style={{ color: th.dim, fontSize: 10.5 }} numberOfLines={1}>{sub}</Text>
                </View>
              ))}
            </View>
            {waiting[0] && <Text style={{ color: th.dim, fontSize: 12.5 }} numberOfLines={1}>Latest: <Text style={{ color: waiting[0].side === 'buy' ? th.buy : th.sell, fontWeight: '900' }}>{waiting[0].side.toUpperCase()}</Text> {waiting[0].name} · {waiting[0].source} · grade {waiting[0].grade}</Text>}
          </Card>
        </Pressable>

        {/* ---------- market pulse ---------- */}
        <SectionHeader title={t('pulse')} icon="pulse" action={t('tabMarkets')} onAction={() => setTab(2)} />
        {shown.length === 0 ? (
          <Card><Body color={th.dim}>{t('noFav')}</Body></Card>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }} style={{ marginHorizontal: -16 }}>
            {shown.map((id) => {
              const x = quotes[id], c = chg(id), col = c >= 0 ? th.buy : th.sell;
              return (
                <Pressable key={id} onPress={() => setSel(symOf(id))} style={({ pressed }) => ({ width: 142, opacity: pressed ? 0.85 : 1 })}>
                  <Card style={{ padding: 14 }}>
                    <Text style={{ color: th.dim, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }} numberOfLines={1}>{nameOf(id).toUpperCase()}</Text>
                    <Text style={{ color: th.text, fontSize: 19, fontWeight: '900', marginTop: 6, letterSpacing: -0.3 }} numberOfLines={1} adjustsFontSizeToFit>{x ? x.price.toFixed(x.dec) : '—'}</Text>
                    <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 8, backgroundColor: col + '1F', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }}>
                      <Icon name={c >= 0 ? 'caret-up' : 'caret-down'} size={11} color={col} />
                      <Text style={{ color: col, fontSize: 11.5, fontWeight: '800' }}>{x ? `${Math.abs(c).toFixed(2)}%` : '—'}</Text>
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* ---------- top movers ---------- */}
        <SectionHeader title="Top movers" icon="trending-up" action={t('tabMarkets')} onAction={() => setTab(2)} />
        <Card style={{ padding: 14 }}>
          {moving.length === 0 ? (
            <Body color={th.dim}>Waiting for live prices...</Body>
          ) : (
            <View style={{ flexDirection: 'row', gap: 14 }}>
              {([['GAINERS', gainers, th.buy, 'caret-up'], ['LOSERS', losers, th.sell, 'caret-down']] as [string, { id: string; c: number }[], string, string][]).map(([label, list, col, ic]) => (
                <View key={label} style={{ flex: 1, gap: 8 }}>
                  <Text style={{ color: th.dim, fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>{label}</Text>
                  {list.length === 0 && <Text style={{ color: th.dim, fontSize: 12 }}>None right now</Text>}
                  {list.map((m) => (
                    <Pressable key={m.id} onPress={() => setSel(symOf(m.id))} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                      <Text style={{ color: th.text, fontSize: 13, fontWeight: '800' }} numberOfLines={1}>{nameOf(m.id)}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Icon name={ic} size={11} color={col} />
                        <Text style={{ color: col, fontSize: 12, fontWeight: '800' }}>{Math.abs(m.c).toFixed(2)}%</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* ---------- recent setups ---------- */}
        <SectionHeader title="Recent setups" icon="flash-outline" action={t('tabJournal')} onAction={() => setTab(3)} />
        {recent.length === 0 ? (
          <Card><Body color={th.dim}>No setups yet. Open Analysis, pick a method and the setups you analyze land here.</Body></Card>
        ) : (
          <Card style={{ paddingVertical: 4, paddingHorizontal: 14 }}>
            {recent.map((x, i) => {
              const buy = x.side === 'buy', c = buy ? th.buy : th.sell;
              return (
                <Pressable key={x.id} onPress={() => setTab(3)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: i === recent.length - 1 ? 0 : 1, borderBottomColor: th.hair, opacity: pressed ? 0.8 : 1 })}>
                  <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: c + '22', alignItems: 'center', justifyContent: 'center' }}><Icon name={buy ? 'trending-up' : 'trending-down'} size={20} color={c} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: th.text, fontSize: 14, fontWeight: '800' }} numberOfLines={1}>{x.name}</Text>
                    <Text style={{ color: th.dim, fontSize: 11.5 }} numberOfLines={1}>{x.source} · {new Date(x.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 3 }}>
                    <Text style={{ color: c, fontSize: 12, fontWeight: '900' }}>{buy ? 'BUY' : 'SELL'}</Text>
                    <Text style={{ color: th.dim, fontSize: 11 }}>Grade {x.grade} · {Math.round(x.score)}%</Text>
                  </View>
                </Pressable>
              );
            })}
          </Card>
        )}

        {/* ---------- performance snapshot ---------- */}
        <SectionHeader title="Performance snapshot" icon="stats-chart" action={t('tabPerf')} onAction={() => setTab(9)} />
        <Card style={{ padding: 14 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {([['TRADES', String(journal.length), th.text], ['PROFIT FACTOR', journal.length ? (isFinite(pf) ? pf.toFixed(2) : '∞') : '-', pf >= 1 ? th.buy : th.sell], ['AVG TRADE', journal.length ? money(avg) : '-', avg >= 0 ? th.buy : th.sell], ['BEST', journal.length ? money(best) : '-', th.buy]] as [string, string, string][]).map(([k, v, c]) => (
              <View key={k} style={{ flex: 1, backgroundColor: th.panel2, borderRadius: 8, borderWidth: 1, borderColor: th.hair, paddingVertical: 10, paddingHorizontal: 8 }}>
                <Text style={{ color: th.dim, fontSize: 8.5, fontWeight: '900', letterSpacing: 0.6 }} numberOfLines={1}>{k}</Text>
                <Text style={{ color: c, fontSize: 15, fontWeight: '900', marginTop: 3 }} numberOfLines={1} adjustsFontSizeToFit>{v}</Text>
              </View>
            ))}
          </View>
        </Card>

        <EquityCurve />

        {/* ---------- pro tools ---------- */}
        <SectionHeader title={t('navProTools').charAt(0) + t('navProTools').slice(1).toLowerCase()} icon="diamond-outline" />

        <Pressable onPress={() => setTab(1)} style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] })}>
          <Card glow style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
            <IconTile icon="analytics" size={54} colors={[th.gold, th.sell]} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: th.text, fontSize: 17, fontWeight: '900' }}>{t('tabScalp')}</Text>
                <Badge label="ALL" color={th.gold} />
              </View>
              <Text style={{ color: th.dim, fontSize: 12.5, lineHeight: 18, marginTop: 3 }} numberOfLines={3}>{t('navDescScalp')}</Text>
            </View>
            <Icon name="chevron-forward" size={20} color={th.dim} />
          </Card>
        </Pressable>

        <Pressable onPress={() => setTab(2)} style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] })}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
            <IconTile icon="pulse" size={54} colors={[th.accent, th.accent2]} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: th.text, fontSize: 17, fontWeight: '900' }}>Analysis of this chart</Text>
              <Text style={{ color: th.dim, fontSize: 12.5, lineHeight: 18, marginTop: 3 }} numberOfLines={3}>Open any pair in Markets and tap the analysis button. Gemini reads its live candles and draws entry, stop loss and 3 take profits.</Text>
            </View>
            <Icon name="chevron-forward" size={20} color={th.dim} />
          </Card>
        </Pressable>

        {pairs.map((pair, r) => (
          <View key={r} style={{ flexDirection: 'row', gap: 12 }}>
            {pair.map((x) => (
              <Pressable key={x.key} onPress={() => setTab(x.tab)} style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
                <Card style={{ padding: 14, minHeight: 142 }}>
                  <IconTile icon={x.icon} size={42} colors={x.tint} />
                  <Text style={{ color: th.text, fontWeight: '900', fontSize: 15, marginTop: 12 }} numberOfLines={1}>{t(x.key)}</Text>
                  <Text style={{ color: th.dim, fontSize: 11.5, lineHeight: 16, marginTop: 3 }} numberOfLines={3}>{t(x.desc)}</Text>
                </Card>
              </Pressable>
            ))}
            {pair.length === 1 && <View style={{ flex: 1 }} />}
          </View>
        ))}

        <Sessions />

        {/* ---------- how to use ---------- */}
        <SectionHeader title={t('quickStart')} icon="help-circle-outline" action={t('openGuide')} onAction={() => setTab(guideTab)} />
        <Pressable onPress={() => setTab(guideTab)} style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}>
          <Card glow style={{ gap: 12 }}>
            {guide.steps.map((s, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: th.accent + '22', alignItems: 'center', justifyContent: 'center' }}><Icon name={s.icon} size={15} color={th.accent} /></View>
                <Text style={{ flex: 1, color: th.text, fontSize: 13.5, fontWeight: '700' }}>{s.title}</Text>
              </View>
            ))}
            <View style={{ height: 1, backgroundColor: th.line }} />
            <Text style={{ color: th.dim, fontSize: 12, fontWeight: '800', letterSpacing: 0.6 }}>{guide.gradeTitle}</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {guide.grades.map((g) => (
                <View key={g.grade} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8, backgroundColor: (gradeCol[g.grade] ?? th.accent) + '1A', borderWidth: 1, borderColor: (gradeCol[g.grade] ?? th.accent) + '66' }}>
                  <Text style={{ color: gradeCol[g.grade] ?? th.accent, fontWeight: '900', fontSize: 15 }}>{g.grade}</Text>
                  <Text style={{ color: th.text, fontSize: 10.5, fontWeight: '700', marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit>{g.label}</Text>
                  <Text style={{ color: th.dim, fontSize: 9.5, fontVariant: ['tabular-nums'] }} numberOfLines={1}>{g.range}</Text>
                </View>
              ))}
            </View>
          </Card>
        </Pressable>

        {/* ---------- shortcuts ---------- */}
        <SectionHeader title={t('quick')} icon="flash-outline" />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {([['tabTools', 'calculator', 4], ['tabJournal', 'book', 3], ['tabHistory', 'time', 5]] as [string, string, number][]).map(([k, ic, i]) => (
            <Pressable key={k} onPress={() => setTab(i)} style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.85 : 1 })}>
              <Card style={{ alignItems: 'center', paddingVertical: 16, paddingHorizontal: 6, gap: 8 }}>
                <Icon name={ic + '-outline'} size={24} color={th.accent} />
                <Text style={{ color: th.text, fontWeight: '800', fontSize: 12.5 }} numberOfLines={1} adjustsFontSizeToFit>{t(k)}</Text>
              </Card>
            </Pressable>
          ))}
        </View>
        <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: th.gold + '22', alignItems: 'center', justifyContent: 'center' }}><Icon name="bulb-outline" size={20} color={th.gold} /></View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: th.text, fontSize: 14, fontWeight: '900' }}>Trading tip of the day</Text>
            <Text style={{ color: th.dim, fontSize: 12.5, lineHeight: 18, marginTop: 3 }}>{tip}</Text>
          </View>
        </Card>
        <SymbolSheet sym={sel} onClose={() => setSel(null)} />
      </View>
    </Screen>
  );
}

export default function Home() {
  const desk = useDesktop(); // website on a wide screen: the dashboard
  return desk ? <DesktopHome /> : <PhoneHome />;
}
