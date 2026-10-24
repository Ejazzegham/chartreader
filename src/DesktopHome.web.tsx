import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useApp } from './store';
import { Icon } from './ui';
import { Coin, CandleChart } from './MarketWidgets';
import MethodChart from './MethodChart';
import MarketsPanel from './MarketsPanel';
import ChartWeb from './ChartWeb';
import { useFeed, chg, symOf, watchCandles, toggleFav, setWatch, Candle } from './markets';
import { tvSymbol, tvHtml, TV_INTERVAL } from './tv';
import { analyzeAll } from './refine';
import { qualify } from './verdict';
import { useRealWindow, useLayout } from './win';
import { useDash, setDash } from './dash';
import { useHeadlines } from './headlines';
import { localTime } from './news';

// The website's home. Calm and quiet on purpose: a welcome line, the chart (drag it with the hand, scroll to zoom), today's setup with its
// plan, a short row of analysis methods, the trade desk and the news. All pairs live in the panel on the right. Same live data as the phone app.
// The sidebar and the top bar are in Desktop.web.tsx.
const TFB: [string, string][] = [['60', '1m'], ['300', '5m'], ['900', '15m'], ['1800', '30m'], ['3600', '1h'], ['14400', '4h'], ['86400', '1D']];
const METHODS: { k: string; label: string; vote: string | null }[] = [
  { k: 'ict', label: 'ICT', vote: 'ICT' }, { k: 'smc', label: 'SMC', vote: 'SMC' }, { k: 'vsa', label: 'VSA', vote: 'VSA' },
  { k: 'pat', label: 'Patterns', vote: 'PAT' }, { k: 'candle', label: 'Candles', vote: 'CDL' }, { k: 'topdown', label: 'Top-Down', vote: null },
];
const METALS = ['frxXAUUSD', 'frxXAGUSD', 'frxWTI', 'frxBRENT', 'frxDXY'];
const CAT_LABEL: Record<string, string> = { forex: 'Forex', crypto: 'Crypto', deriv: 'Deriv synthetic index' };
const pipOf = (id: string) => (id.startsWith('frx') && !METALS.includes(id) ? (id.endsWith('JPY') ? 0.01 : 0.0001) : 0);
const pipsText = (id: string, from: number, to: number) => { const p = pipOf(id); return p ? `${Math.round(Math.abs(to - from) / p)} pips` : ''; };

function Panel({ children, style }: { children: React.ReactNode; style?: any }) {
  const { th } = useApp();
  return <View style={[{ backgroundColor: th.dark ? th.panel : '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: th.line, shadowColor: '#101828', shadowOpacity: 0.05, shadowRadius: 18, shadowOffset: { width: 0, height: 6 } }, style]}>{children}</View>;
}
function Label({ text, right, onRight }: { text: string; right?: string; onRight?: () => void }) {
  const { th } = useApp();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Text style={{ flex: 1, color: th.dim, fontSize: 11, fontWeight: '700', letterSpacing: 1.3 }}>{text}</Text>
      {!!right && <Pressable onPress={onRight} style={{ cursor: 'pointer' } as any}><Text style={{ color: th.accent, fontSize: 12, fontWeight: '600' }}>{right}</Text></Pressable>}
    </View>
  );
}
const Hair = () => { const { th } = useApp(); return <View style={{ height: 1, backgroundColor: th.line }} />; };

export default function DesktopHome() {
  const { th, account, setTab, setAmethod, setAsym, signals, history, logSetup, toast, desk } = useApp();
  const L = useLayout(), real = useRealWindow();
  const pageW = Math.min(real.width - L.sidebar, 1560) - 56;
  const two = pageW >= 1000, RIGHT = 336, mainW = two ? pageW - RIGHT - 24 : pageW;
  const d = useDash();
  const { quotes, db } = useFeed(true);
  const [mode, setMode] = useState<'analysis' | 'pro'>('analysis');
  const [data, setData] = useState<Candle[]>([]);
  const [err, setErr] = useState('');
  const sym = symOf(d.sym), tv = tvSymbol(sym), quote = quotes[sym.id];

  useEffect(() => { setWatch('dash', [sym.id]); return () => setWatch('dash', []); }, [sym.id]);
  useEffect(() => { setData([]); setErr(''); return watchCandles(sym.id, Number(d.tf), (c) => { setErr(''); setData(c); }, setErr); }, [sym.id, d.tf]);

  // the answer, from the same quality gate as the phone: a trade only when every rule passes, otherwise wait
  const land = useMemo(() => (data.length > 40 ? analyzeAll(data, new Date()) : null), [data]);
  const qual = useMemo(() => (land ? qualify(land, { id: sym.id, cat: sym.cat, now: new Date(), c: data }) : null), [land, data, sym.id]);
  const cb = land?.combo, dec = quote?.dec ?? 4, fx = (v: number) => v.toFixed(dec);
  const isTrade = !!qual?.trade, side = cb?.side;
  const vcol = !qual ? th.dim : isTrade ? (side === 'sell' ? th.sell : th.buy) : th.gold;
  const verdict = !qual ? 'Reading the chart' : isTrade ? (side === 'sell' ? 'Sell setup' : 'Buy setup') : 'Wait';
  const why = !qual ? 'Reading the candles…' : isTrade ? 'Every condition is met. The analysis methods and the higher timeframe agree on this setup.' : (qual.reasons[0] ?? 'The conditions are not all met yet.');
  const trend = land?.confirm?.ema200 === 'above' ? 'Uptrend' : land?.confirm?.ema200 === 'below' ? 'Downtrend' : land?.ict?.trend === 'bullish' ? 'Uptrend' : land?.ict?.trend === 'bearish' ? 'Downtrend' : 'Sideways';
  const adx = land?.confirm?.adx ?? 0, momentum = !land ? '—' : adx >= 25 ? 'Strong' : adx >= 18 ? 'Moderate' : 'Weak';
  const volat = useMemo(() => { if (data.length < 60) return '—'; const r = (a: Candle[]) => a.reduce((s, c) => s + (c.h - c.l), 0) / a.length, k = r(data.slice(-14)) / (r(data.slice(-60)) || 1); return k > 1.3 ? 'High' : k < 0.75 ? 'Low' : 'Moderate'; }, [data]);
  const last = data[data.length - 1];
  const c = chg(sym.id), col = c >= 0 ? th.buy : th.sell, fav = db.favs.includes(sym.id);
  const absChg = quote ? quote.price - quote.price / (1 + c / 100) : 0;
  const tfLabel = TFB.find(([k]) => k === d.tf)?.[1] ?? d.tf;
  const open = (k = 'all') => { setAsym(sym.id); setAmethod(k); setTab(1); };
  const addJournal = () => {
    if (!cb) { toast('No setup to add yet.', 'info'); return; }
    logSetup({ symId: sym.id, name: sym.name, tf: d.tf, dec, side: cb.side, entry: cb.entry, sl: cb.sl, tps: [...cb.tps], score: cb.score, grade: cb.grade, source: 'Combined', why: cb.checks.filter((x) => x.ok).map((x) => x.text).slice(0, 5), zone: [cb.zoneBottom, cb.zoneTop] });
    toast('Setup added to your Journal.', 'good');
  };

  // trade desk + news (a short look; the full pages are one click away)
  const waiting = signals.filter((x) => x.status === 'signal'), live = signals.filter((x) => x.status !== 'signal');
  const deskRows = [...live, ...waiting].slice(0, 4);
  const fxN = useHeadlines('forex'), crN = useHeadlines('crypto');
  const news = useMemo(() => [...fxN.items.map((h) => ({ ...h, tag: 'Forex' })), ...crN.items.map((h) => ({ ...h, tag: 'Crypto' }))].sort((a, b) => b.t - a.t).slice(0, 5), [fxN.items, crN.items]);
  const hr = new Date().getHours(), greet = hr < 5 ? 'Good night' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  const first = (account?.name ?? '').trim().split(/\s+/)[0];
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const chartW = mainW - 40;
  const fact = (k: string, v: string, cc?: string) => (
    <View key={k} style={{ gap: 2 }}><Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '600', letterSpacing: 0.4 }}>{k}</Text><Text style={{ color: cc ?? th.text, fontSize: 13, fontWeight: '600' }}>{v}</Text></View>
  );
  const planRow = (k: string, v: number | undefined, color: string, extra: string) => (
    <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: th.line }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ flex: 1, color: th.dim, fontSize: 13 }}>{k}</Text>
      <Text style={{ color: th.text, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{v == null ? '—' : fx(v)}</Text>
      <Text style={{ color: th.dim, fontSize: 11.5, width: 64, textAlign: 'right' }}>{extra}</Text>
    </View>
  );
  const sectionGap = 24;

  return (
    <ScrollView contentContainerStyle={{ padding: 28, paddingTop: 24, width: '100%', maxWidth: pageW + 56, alignSelf: 'center' }} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: two ? 'row' : 'column', alignItems: 'flex-start', gap: 24 }}>
        <View style={{ width: mainW, gap: sectionGap }}>
          {/* welcome */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: th.dim, fontSize: 11, fontWeight: '700', letterSpacing: 1.3 }}>{today.toUpperCase()}</Text>
              <Text style={{ color: th.text, fontSize: 28, fontWeight: '600', letterSpacing: -0.6 }}>{greet}{first ? `, ${first}` : ''}</Text>
              <Text style={{ color: th.dim, fontSize: 14 }}>One clear answer per chart: a trade with its plan, or a reason to wait.</Text>
            </View>
          </View>

          {/* chart */}
          <Panel style={{ padding: 20, gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Coin s={sym} size={38} />
              <View style={{ gap: 1 }}>
                <Text style={{ color: th.text, fontSize: 16, fontWeight: '700' }}>{sym.name}</Text>
                <Text style={{ color: th.dim, fontSize: 11.5 }}>{sym.sub ?? CAT_LABEL[sym.cat] ?? sym.cat}</Text>
              </View>
              <Text style={{ color: th.text, fontSize: 24, fontWeight: '600', marginLeft: 10, fontVariant: ['tabular-nums'] }}>{quote ? quote.price.toFixed(dec) : '—'}</Text>
              {!!quote && <Text style={{ color: col, fontSize: 13, fontWeight: '600' }}>{`${absChg >= 0 ? '+' : '−'}${Math.abs(absChg).toFixed(dec)}  ${c >= 0 ? '+' : '−'}${Math.abs(c).toFixed(2)}%`}</Text>}
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => toggleFav(sym.id)} hitSlop={6} style={{ cursor: 'pointer' } as any}><Icon name={fav ? 'star' : 'star-outline'} size={19} color={fav ? th.gold : th.dim} /></Pressable>
              <View style={{ flexDirection: 'row', borderRadius: 10, borderWidth: 1, borderColor: th.line, padding: 2 }}>
                {TFB.map(([k, l]) => (
                  <Pressable key={k} onPress={() => setDash({ tf: k })} style={{ paddingHorizontal: 10, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backgroundColor: d.tf === k ? th.accent + '1A' : 'transparent' } as any}>
                    <Text style={{ color: d.tf === k ? th.accent : th.dim, fontSize: 12, fontWeight: d.tf === k ? '700' : '500' }}>{l}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={{ borderRadius: 10, overflow: 'hidden' }}>
              {mode === 'pro' && !!tv
                ? <ChartWeb key={`tv-${sym.id}-${d.tf}-${th.dark}`} height={440} html={tvHtml(tv, TV_INTERVAL[d.tf] ?? '15', th.dark, th.bg, [], '1')} />
                : (
                  <View style={{ minHeight: 360, justifyContent: 'center' }}>
                    {data.length > 40 && land
                      ? <MethodChart data={data} all={land} method="ict" width={chartW} dec={dec} height={430} gran={Number(d.tf)} symId={sym.id} plan={cb ? { entry: cb.entry, sl: cb.sl, tps: [...cb.tps], tag: cb.side === 'buy' ? 'BUY' : 'SELL' } : null} />
                      : data.length ? <CandleChart data={data} width={chartW} dec={dec} height={380} gran={Number(d.tf)} /> : <Text style={{ color: th.dim, textAlign: 'center', padding: 30 }}>{err || 'Loading candles...'}</Text>}
                  </View>
                )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              {!!last && mode === 'analysis' && <Text style={{ color: th.dim, fontSize: 11.5, fontVariant: ['tabular-nums'] }}>O {fx(last.o)}   H {fx(last.h)}   L {fx(last.l)}   C {fx(last.c)}</Text>}
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 220 }}>
                <Icon name="hand-left-outline" size={14} color={th.dim} />
                <Text style={{ color: th.dim, fontSize: 11.5 }}>Hold and drag to move the chart. Scroll to zoom. Double-click to reset.</Text>
              </View>
              {!!tv && (
                <View style={{ flexDirection: 'row', gap: 14 }}>
                  {([['analysis', 'Analysis'], ['pro', 'Pro chart']] as const).map(([k, l]) => (
                    <Pressable key={k} onPress={() => setMode(k)} style={{ cursor: 'pointer' } as any}><Text style={{ color: mode === k ? th.accent : th.dim, fontSize: 12, fontWeight: mode === k ? '700' : '500' }}>{l}</Text></Pressable>
                  ))}
                </View>
              )}
              <Pressable onPress={() => open()} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, cursor: 'pointer' } as any}><Text style={{ color: th.accent, fontSize: 12, fontWeight: '600' }}>Open full chart</Text><Icon name="arrow-forward" size={12} color={th.accent} /></Pressable>
            </View>
          </Panel>

          {/* today's setup + plan */}
          <Panel style={{ flexDirection: mainW >= 760 ? 'row' : 'column' }}>
            <View style={{ flex: 1, padding: 24, gap: 14 }}>
              <Label text={`TODAY'S SETUP  ·  ${sym.name.toUpperCase()}  ·  ${tfLabel.toUpperCase()}`} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: vcol }} />
                <Text style={{ color: vcol, fontSize: 30, fontWeight: '600', letterSpacing: -0.6 }}>{verdict}</Text>
              </View>
              <Text style={{ color: th.dim, fontSize: 13.5, lineHeight: 21 }}>{why}</Text>
              {!!cb && (
                <View style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: th.dim, fontSize: 11.5 }}>Confluence</Text><Text style={{ color: th.text, fontSize: 11.5, fontWeight: '700' }}>{Math.round(cb.score)}%</Text></View>
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: th.line, overflow: 'hidden' }}><View style={{ width: `${Math.max(2, Math.min(100, cb.score))}%`, height: 4, backgroundColor: vcol }} /></View>
                </View>
              )}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 22, marginTop: 2 }}>
                {fact('TREND', trend, trend === 'Uptrend' ? th.buy : trend === 'Downtrend' ? th.sell : th.gold)}{fact('MOMENTUM', momentum)}{fact('VOLATILITY', volat)}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 6 }}>
                <Pressable onPress={addJournal} style={((st: any) => ({ height: 40, paddingHorizontal: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backgroundColor: th.accent, opacity: !cb ? 0.45 : st.hovered ? 0.9 : 1 })) as any}><Text style={{ color: th.onAccent, fontSize: 13, fontWeight: '600' }}>Add to Journal</Text></Pressable>
                <Pressable onPress={() => open()} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, cursor: 'pointer' } as any}><Text style={{ color: th.text, fontSize: 13, fontWeight: '600' }}>Full analysis</Text><Icon name="arrow-forward" size={13} color={th.text} /></Pressable>
              </View>
            </View>
            <View style={mainW >= 760 ? { width: 1, backgroundColor: th.line } : { height: 1, backgroundColor: th.line }} />
            <View style={{ flex: 1, padding: 24, gap: 8 }}>
              <Label text="TRADE PLAN" />
              <View>
                {planRow('Entry', cb?.entry, th.accent, '')}
                {planRow('Stop loss', cb?.sl, th.sell, cb ? pipsText(sym.id, cb.entry, cb.sl) : '')}
                {planRow('Take profit 1', cb?.tps[0], th.buy, cb ? pipsText(sym.id, cb.entry, cb.tps[0]) : '')}
                {planRow('Take profit 2', cb?.tps[1], th.buy, cb ? pipsText(sym.id, cb.entry, cb.tps[1]) : '')}
                {planRow('Take profit 3', cb?.tps[2], th.buy, cb ? pipsText(sym.id, cb.entry, cb.tps[2]) : '')}
              </View>
              <View style={{ flexDirection: 'row', gap: 30, marginTop: 6 }}>
                {fact('RISK / REWARD', cb ? `1 : ${cb.rr[2].toFixed(1)}` : '—')}
                {desk.riskPct > 0 ? fact('POSITION SIZE', `${desk.riskPct}% of balance`) : (
                  <Pressable onPress={() => setTab(3)} style={{ gap: 2, cursor: 'pointer' } as any}><Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '600', letterSpacing: 0.4 }}>POSITION SIZE</Text><Text style={{ color: th.accent, fontSize: 13, fontWeight: '600' }}>Set your risk</Text></Pressable>
                )}
              </View>
            </View>
          </Panel>

          {/* methods: one quiet row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <Text style={{ color: th.dim, fontSize: 11, fontWeight: '700', letterSpacing: 1.3, marginRight: 6 }}>ANALYSE WITH</Text>
            {METHODS.map(({ k, label, vote }) => {
              const v = vote ? land?.votes.find((x) => x.method === vote)?.side : cb?.htf === 'with' ? cb.side : null;
              const dot = v === 'buy' ? th.buy : v === 'sell' ? th.sell : th.dim + '88';
              return (
                <Pressable key={k} onPress={() => open(k)} style={((st: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 7, height: 34, paddingHorizontal: 14, borderRadius: 17, borderWidth: 1, cursor: 'pointer', borderColor: st.hovered ? th.accent : th.line, backgroundColor: th.dark ? th.panel : '#FFFFFF' })) as any}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }} />
                  <Text style={{ color: th.text, fontSize: 12.5, fontWeight: '600' }}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* trade desk + news */}
          <View style={{ flexDirection: mainW >= 760 ? 'row' : 'column', gap: 24 }}>
            <Panel style={{ flex: 1, padding: 22, gap: 10 }}>
              <Label text="TRADE DESK" right="Open journal →" onRight={() => setTab(3)} />
              <View style={{ flexDirection: 'row', gap: 22, paddingVertical: 4 }}>
                {fact('WAITING', String(waiting.length), waiting.length ? th.gold : undefined)}{fact('RUNNING', String(live.length), live.length ? th.buy : undefined)}
              </View>
              {deskRows.length === 0 && <Text style={{ color: th.dim, fontSize: 12.5, lineHeight: 19, paddingVertical: 6 }}>No setups yet. Good setups from the scanner and the analysis pages are added here for you.</Text>}
              {deskRows.map((x) => (
                <Pressable key={x.id} onPress={() => setTab(3)} style={((st: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: th.line, cursor: 'pointer', opacity: st.hovered ? 0.8 : 1 })) as any}>
                  <Coin s={symOf(x.symId)} size={24} />
                  <Text style={{ flex: 1, color: th.text, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{x.name}</Text>
                  <Text style={{ color: x.side === 'buy' ? th.buy : th.sell, fontSize: 12, fontWeight: '700' }}>{x.side === 'buy' ? 'Buy' : 'Sell'}</Text>
                  <Text style={{ color: th.dim, fontSize: 12, width: 62, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{x.entry.toFixed(x.dec)}</Text>
                  <Text style={{ color: x.status === 'open' ? th.buy : th.dim, fontSize: 11.5, width: 56, textAlign: 'right' }}>{x.status === 'signal' ? 'Waiting' : x.status === 'pending' ? 'Pending' : 'Live'}</Text>
                </Pressable>
              ))}
            </Panel>
            <Panel style={{ flex: 1, padding: 22, gap: 8 }}>
              <Label text="LATEST NEWS" right="All news →" onRight={() => setTab(13)} />
              {news.length === 0 && <Text style={{ color: th.dim, fontSize: 12.5, paddingVertical: 10 }}>{fxN.loading || crN.loading ? 'Loading news…' : 'No news right now.'}</Text>}
              {news.map((n, i) => (
                <View key={n.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: th.line }}>
                  <Text style={{ color: th.dim, fontSize: 11.5, width: 38, fontVariant: ['tabular-nums'] }}>{localTime(n.t)}</Text>
                  <Text style={{ flex: 1, color: th.text, fontSize: 13 }} numberOfLines={1}>{n.title}</Text>
                  <Text style={{ color: th.dim, fontSize: 11 }}>{n.tag}</Text>
                </View>
              ))}
            </Panel>
          </View>

          <Text style={{ color: th.dim, fontSize: 11.5, textAlign: 'center', paddingVertical: 4 }}>Educational tool, not financial advice. Trading involves risk.</Text>
        </View>

        {/* every pair, kept in view while the page scrolls */}
        <View style={{ width: two ? RIGHT : '100%', alignSelf: 'stretch' }}>
          <View style={{ position: 'sticky', top: 20 } as any}>
            <MarketsPanel height={Math.max(500, Math.min(real.height - 110, 880))} />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
