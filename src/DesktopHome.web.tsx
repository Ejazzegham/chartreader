import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from './store';
import { Icon, Card } from './ui';
import { Coin, CandleChart } from './MarketWidgets';
import { MethodIcon, MDEFS, mdef } from './MethodArt';
import LiveCandles from './LiveCandles';
import ChartWeb from './ChartWeb';
import { useFeed, chg, symOf, SYMBOLS, watchCandles, toggleFav, setWatch, Candle, Sym, TFS } from './markets';
import { tvSymbol, tvHtml, TV_INTERVAL } from './tv';
import { analyzeAll } from './refine';
import { qualify } from './verdict';
import { totalR, money, todayPnl } from './trades';
import { MANUAL_TAB } from './manualTarget';
import { useWindowDimensions } from './win';
import { useDash, setDash, listFor, TF_BUTTONS, MarketTab } from './dash';

// The website's home: a trading dashboard (hero, analysis methods, market + chart, today's analysis, quick tools, risk).
// It uses the same live data as the phone app. The sidebar, search bar and market-watch panel are in Desktop.web.tsx.
const METHODS = ['ict', 'smc', 'topdown', 'scanner', 'vsa', 'candle'];
const SUB: Record<string, string> = { ict: 'Smart Money Concepts', smc: 'Smart Money', topdown: 'Multi Timeframe', scanner: 'Find Opportunities', vsa: 'Volume Analysis', candle: 'Price Action' };
const SHORT: Record<string, string> = { ict: 'ICT', smc: 'SMC', topdown: 'Top-Down', scanner: 'Market Scanner', vsa: 'VSA', candle: 'Candlestick' };
const MARKETS: { k: MarketTab; label: string; icon: string }[] = [
  { k: 'favs', label: 'Watchlist', icon: 'star' }, { k: 'forex', label: 'Forex', icon: 'swap-horizontal' }, { k: 'crypto', label: 'Crypto', icon: 'logo-bitcoin' }, { k: 'deriv', label: 'Deriv', icon: 'pulse' },
];

const Chip = ({ on, icon, label, onPress }: { on: boolean; icon?: string; label: string; onPress: () => void }) => {
  const { th } = useApp();
  return (
    <Pressable onPress={onPress} style={((s: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 7, height: 38, paddingHorizontal: 14, borderRadius: 10, cursor: 'pointer', borderWidth: 1, borderColor: on ? th.accent : th.line, backgroundColor: on ? th.accent : s.hovered ? th.accent + '14' : th.panel2 })) as any}>
      {!!icon && <Icon name={icon} size={16} color={on ? th.onAccent : th.dim} />}
      <Text style={{ color: on ? th.onAccent : th.text, fontSize: 13, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
};

export default function DesktopHome() {
  const { th, t, lic, setTab, setAmethod, setAsym, signals, journal, desk } = useApp();
  const { width } = useWindowDimensions();
  const inner = Math.max(520, width - 40);
  const d = useDash();
  const { quotes, db } = useFeed(true);
  const [q, setQ] = useState('');
  const [mode, setMode] = useState<'pro' | 'quick'>('pro');
  const [data, setData] = useState<Candle[]>([]);
  const [err, setErr] = useState('');
  const sym = symOf(d.sym), tv = tvSymbol(sym), quote = quotes[sym.id];
  const m = mdef(d.method)!;
  const list = (q.trim() ? SYMBOLS.filter((s) => (s.name + ' ' + s.id).toLowerCase().includes(q.trim().toLowerCase())) : listFor(d.market, db.favs)).slice(0, 40);
  useEffect(() => { setWatch('dash', Array.from(new Set([sym.id, ...list.slice(0, 14).map((s) => s.id)]))); return () => setWatch('dash', []); }, [sym.id, list.map((s) => s.id).join(',')]);
  useEffect(() => { // candles for "Today's analysis" and the quick chart
    setData([]); setErr('');
    return watchCandles(sym.id, Number(d.tf), (c) => { setErr(''); setData(c); }, setErr);
  }, [sym.id, d.tf]);
  const useTv = mode === 'pro' && !!tv;
  const c = chg(sym.id), col = c >= 0 ? th.buy : th.sell, fav = db.favs.includes(sym.id);
  // The same one answer as the phone: TRADE (every rule passed) or WAIT (with the reason), from the quality gate
  const land = useMemo(() => (data.length > 40 ? analyzeAll(data, new Date()) : null), [data]);
  const qual = useMemo(() => (land ? qualify(land, { id: sym.id, cat: sym.cat, now: new Date(), c: data }) : null), [land, data, sym.id]);
  const side = land?.combo?.side;
  const verdict = !qual ? { l: 'Waiting for data', c: th.dim } : qual.trade ? { l: `TRADE ${side === 'buy' ? 'BUY' : 'SELL'}`, c: side === 'buy' ? th.buy : th.sell } : { l: 'WAIT', c: th.gold };
  const why = qual && !qual.trade ? (qual.reasons[0] ?? '') : '';
  // trade desk numbers (same as Home on the phone)
  const waiting = signals.filter((x) => x.status === 'signal'), runningT = signals.filter((x) => x.status !== 'signal');
  const floatMoney = runningT.reduce((acc, x) => (x.status === 'open' && quotes[x.symId]?.price ? acc + totalR(x, quotes[x.symId].price) * x.risk : acc), 0);
  const todayMoney = todayPnl(journal);
  const tfLabel = TFS.find((x) => x.k === d.tf)?.label ?? d.tf;
  const open = (k = d.method) => { setAsym(sym.id); setAmethod(k); setTab(1); };
  const goTool = (key: string, tab: number) => { if (key) setAmethod(key); setTab(tab); };
  const nMethods = MDEFS.filter((x) => x.host !== 'tab').length;
  const tileW = (inner - 32 - 50) / 6, tileRow = tileW >= 150;
  const stat = (icon: string, color: string, v: string, l: string) => (
    <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={17} color="#FFFFFF" /></View>
      <View><Text style={{ color: th.text, fontSize: 16, fontWeight: '900' }}>{v}</Text><Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '600' }}>{l}</Text></View>
    </View>
  );
  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16, width: '100%', maxWidth: width, alignSelf: 'center' }} showsVerticalScrollIndicator={false}>
      {/* hero */}
      <View style={{ borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: th.line, backgroundColor: th.panel }}>
        <LinearGradient colors={[th.accent + '26', th.accent2 + '10', th.accent + '00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <View style={{ padding: 24, gap: 10, paddingRight: inner >= 760 ? 328 : 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="git-network" size={15} color={th.accent} /><Text style={{ color: th.accent, fontSize: 11.5, fontWeight: '800', letterSpacing: 1.3 }}>SMART MONEY CONCEPTS</Text></View>
          <Text style={{ color: th.text, fontSize: 34, fontWeight: '900', letterSpacing: -1 }}>Analyze <Text style={{ color: th.accent }}>•</Text> Plan <Text style={{ color: th.accent }}>•</Text> Execute</Text>
          <Text style={{ color: th.dim, fontSize: 14.5, lineHeight: 21, maxWidth: 440 }}>Professional trading tools and analysis methods for Forex, Crypto and Deriv, with an entry, stop loss and three take profits on every setup.</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 8 }}>
            {stat('flash', '#4C8DFF', String(nMethods), 'Analysis methods')}
            {stat('pulse', '#34D399', String(SYMBOLS.length), 'Live markets')}
            {stat('time', '#FFB62E', '24/7', 'Crypto & Deriv')}
            {stat('flag', '#8B5CF6', '3 TPs', 'On every setup')}
          </View>
        </View>
        {inner >= 760 && (
          <View style={{ position: 'absolute', right: 20, top: 20, width: 300, height: 170, borderRadius: 14, backgroundColor: '#FFFFFF', padding: 4, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } }}>
            <LiveCandles width={292} height={162} />
          </View>
        )}
      </View>

      {/* analysis methods */}
      <Card style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: th.accent + '22', alignItems: 'center', justifyContent: 'center' }}><Icon name="checkmark" size={16} color={th.accent} /></View>
            <Text style={{ color: th.text, fontSize: 17, fontWeight: '900' }}>Choose Analysis Method</Text>
          </View>
          <Pressable onPress={() => { setAmethod(''); setTab(1); }} style={{ cursor: 'pointer' } as any}><Text style={{ color: th.accent, fontSize: 12.5, fontWeight: '800' }}>View all methods →</Text></Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {METHODS.map((k) => {
            const def = mdef(k)!, on = d.method === k;
            return (
              <Pressable key={k} onPress={() => setDash({ method: k })} style={((s: any) => ({ flex: 1, minWidth: 0, flexDirection: tileRow ? 'row' : 'column', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, cursor: 'pointer', borderWidth: 1, borderColor: on ? th.accent : th.line, backgroundColor: on ? th.accent : s.hovered ? th.accent + '12' : th.panel2 })) as any}>
                <View style={on ? { borderRadius: 12, backgroundColor: '#FFFFFF33', padding: 2 } : undefined}><MethodIcon def={def} size={tileRow ? 38 : 36} /></View>
                <View style={{ flex: tileRow ? 1 : undefined, minWidth: 0, alignItems: tileRow ? 'flex-start' : 'center' }}>
                  <Text style={{ color: on ? th.onAccent : th.text, fontSize: 13, fontWeight: '800' }} numberOfLines={1}>{SHORT[k]}</Text>
                  <Text style={{ color: on ? th.onAccent + 'CC' : th.dim, fontSize: 10.5 }} numberOfLines={1}>{SUB[k]}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {/* market + chart */}
      <Card style={{ padding: 16, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: th.accent + '22', alignItems: 'center', justifyContent: 'center' }}><Icon name="globe-outline" size={16} color={th.accent} /></View>
          <Text style={{ color: th.text, fontSize: 17, fontWeight: '900' }}>Select Market</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          {MARKETS.map((x) => <Chip key={x.k} on={!q && d.market === x.k} icon={x.icon} label={x.label} onPress={() => { setQ(''); setDash({ market: x.k }); }} />)}
          <View style={{ flex: 1, minWidth: 180, flexDirection: 'row', alignItems: 'center', gap: 8, height: 38, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: th.line, backgroundColor: th.panel2 }}>
            <Icon name="search" size={16} color={th.dim} />
            <TextInput value={q} onChangeText={setQ} placeholder="Search symbol..." placeholderTextColor={th.dim} style={{ flex: 1, color: th.text, fontSize: 13, outlineStyle: 'none' } as any} />
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {list.length === 0 ? <Text style={{ color: th.dim, fontSize: 13, paddingVertical: 14 }}>{d.market === 'favs' && !q ? 'Star a market to keep it here.' : 'No market found.'}</Text> : list.map((s: Sym) => {
            const x = quotes[s.id], cc = chg(s.id), on = s.id === sym.id;
            return (
              <Pressable key={s.id} onPress={() => setDash({ sym: s.id })} style={((st: any) => ({ width: 176, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 12, cursor: 'pointer', borderWidth: on ? 2 : 1, borderColor: on ? th.accent : th.line, backgroundColor: on ? th.accent + '14' : st.hovered ? th.accent + '0C' : th.panel2 })) as any}>
                <Coin s={s} size={36} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: th.text, fontSize: 12.5, fontWeight: '800' }} numberOfLines={1}>{s.name}</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                    <Text style={{ color: th.dim, fontSize: 11.5, fontVariant: ['tabular-nums'] }}>{x ? x.price.toFixed(x.dec) : '—'}</Text>
                    <Text style={{ color: cc >= 0 ? th.buy : th.sell, fontSize: 11.5, fontWeight: '800' }}>{x ? `${cc >= 0 ? '+' : '−'}${Math.abs(cc).toFixed(2)}%` : ''}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={{ borderRadius: 14, borderWidth: 1, borderColor: th.line, overflow: 'hidden', backgroundColor: th.panel2 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: 10, borderBottomWidth: 1, borderBottomColor: th.line }}>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {TF_BUTTONS.map((x) => (
                <Pressable key={x.k} onPress={() => setDash({ tf: x.k })} style={{ paddingHorizontal: 11, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backgroundColor: d.tf === x.k ? th.accent + '26' : 'transparent' } as any}>
                  <Text style={{ color: d.tf === x.k ? th.accent : th.dim, fontSize: 12.5, fontWeight: '800' }}>{x.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flex: 1 }} />
            <Text style={{ color: th.text, fontSize: 14, fontWeight: '900' }}>{sym.name}</Text>
            <Text style={{ color: th.text, fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{quote ? quote.price.toFixed(quote.dec) : '—'}</Text>
            <Text style={{ color: col, fontSize: 12.5, fontWeight: '800' }}>{quote ? `${c >= 0 ? '+' : '−'}${Math.abs(c).toFixed(2)}%` : ''}</Text>
            <Pressable onPress={() => toggleFav(sym.id)} hitSlop={6} style={{ cursor: 'pointer' } as any}><Icon name={fav ? 'star' : 'star-outline'} size={19} color={fav ? th.gold : th.dim} /></Pressable>
            {!!tv && (
              <View style={{ flexDirection: 'row', borderRadius: 8, borderWidth: 1, borderColor: th.line, overflow: 'hidden' }}>
                {([['pro', 'Pro chart'], ['quick', 'Quick']] as const).map(([k, l]) => (
                  <Pressable key={k} onPress={() => setMode(k)} style={{ paddingHorizontal: 10, height: 28, justifyContent: 'center', cursor: 'pointer', backgroundColor: mode === k ? th.accent : 'transparent' } as any}><Text style={{ color: mode === k ? th.onAccent : th.dim, fontSize: 11.5, fontWeight: '800' }}>{l}</Text></Pressable>
                ))}
              </View>
            )}
            <Pressable onPress={() => open()} style={((s: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 13, borderRadius: 9, cursor: 'pointer', backgroundColor: th.accent, opacity: s.hovered ? 0.9 : 1 })) as any}>
              <Text style={{ color: th.onAccent, fontSize: 12.5, fontWeight: '800' }}>Open {SHORT[d.method]} analysis</Text><Icon name="arrow-forward" size={14} color={th.onAccent} />
            </Pressable>
          </View>
          {useTv
            ? <ChartWeb key={`tv-${sym.id}-${d.tf}-${th.dark}`} height={430} html={tvHtml(tv!, TV_INTERVAL[d.tf] ?? '15', th.dark, th.bg, [], '1')} />
            : (
              <View style={{ minHeight: 330, padding: 8, justifyContent: 'center' }}>
                {data.length ? <CandleChart data={data} width={inner - 54} dec={quote?.dec ?? 4} height={330} gran={Number(d.tf)} /> : <Text style={{ color: th.dim, textAlign: 'center', padding: 30 }}>{err || 'Loading candles...'}</Text>}
              </View>
            )}
        </View>
      </Card>

      {/* today's analysis, quick tools, risk */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <Card style={{ flex: 1, minWidth: 250, padding: 16, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="trending-up" size={17} color={th.accent} /><Text style={{ color: th.text, fontSize: 15, fontWeight: '900' }}>Today's Analysis</Text></View>
          <Pressable onPress={() => open()} style={((s: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 12, cursor: 'pointer', borderWidth: 1, borderColor: th.line, backgroundColor: s.hovered ? th.accent + '10' : th.panel2 })) as any}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: th.text, fontSize: 14, fontWeight: '900' }}>{sym.name}</Text>
              <Text style={{ color: th.dim, fontSize: 11.5 }}>{tfLabel} · {SHORT[d.method]}</Text>
              {!!why && <Text style={{ color: th.dim, fontSize: 11 }} numberOfLines={2}>{why}</Text>}
            </View>
            <View style={{ paddingHorizontal: 11, paddingVertical: 5, borderRadius: 14, backgroundColor: verdict.c + '22' }}><Text style={{ color: verdict.c, fontSize: 12, fontWeight: '800' }}>{verdict.l}</Text></View>
            <Icon name="chevron-forward" size={16} color={th.dim} />
          </Pressable>
        </Card>
        <Card style={{ flex: 1.4, minWidth: 300, padding: 16, gap: 10 }}>
          <Text style={{ color: th.text, fontSize: 15, fontWeight: '900' }}>Quick Tools</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {([['Scanner', 'search', 'scanner', 1], ['Planner', 'calculator', '', 4], ['Killzones', 'alarm', '', 8], ['News', 'newspaper', '', 13]] as [string, string, string, number][]).map(([l, ic, key, tab]) => (
              <Pressable key={l} onPress={() => goTool(key, tab)} style={((s: any) => ({ flex: 1, alignItems: 'center', gap: 6, paddingVertical: 11, borderRadius: 12, cursor: 'pointer', borderWidth: 1, borderColor: th.line, backgroundColor: s.hovered ? th.accent + '12' : th.panel2 })) as any}>
                <Icon name={ic} size={19} color={th.accent} /><Text style={{ color: th.text, fontSize: 12, fontWeight: '700' }}>{l}</Text>
              </Pressable>
            ))}
          </View>
        </Card>
        <Card style={{ flex: 1.3, minWidth: 300, padding: 16, gap: 10 }}>
          <Pressable onPress={() => setTab(3)} style={{ gap: 10, cursor: 'pointer' } as any}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="briefcase-outline" size={17} color={th.accent} /><Text style={{ color: th.text, fontSize: 15, fontWeight: '900', flex: 1 }}>Trade desk</Text><Text style={{ color: th.accent, fontSize: 12, fontWeight: '800' }}>Journal ›</Text></View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {([['SETUPS', String(waiting.length), waiting.length ? th.gold : th.dim, 'Waiting for you'], ['RUNNING', desk.maxOpen > 0 ? `${runningT.length}/${desk.maxOpen}` : String(runningT.length), runningT.length ? th.buy : th.dim, floatMoney ? money(floatMoney) : 'Live trades'], ['TODAY', money(todayMoney), todayMoney > 0 ? th.buy : todayMoney < 0 ? th.sell : th.dim, 'Closed result']] as [string, string, string, string][]).map(([k, v, c, sub]) => (
                <View key={k} style={{ flex: 1, backgroundColor: th.bg, borderRadius: 8, borderWidth: 1, borderColor: th.line, padding: 10 }}>
                  <Text style={{ color: th.dim, fontSize: 9.5, fontWeight: '900', letterSpacing: 0.7 }}>{k}</Text>
                  <Text style={{ color: c, fontSize: 18, fontWeight: '900', marginTop: 2 }} numberOfLines={1}>{v}</Text>
                  <Text style={{ color: th.dim, fontSize: 10.5 }} numberOfLines={1}>{sub}</Text>
                </View>
              ))}
            </View>
          </Pressable>
        </Card>
        <Card style={{ flex: 1, minWidth: 260, padding: 16, gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="swap-vertical" size={17} color={th.accent} /><Text style={{ color: th.text, fontSize: 15, fontWeight: '900' }}>Demo Trade</Text></View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ flex: 1, color: th.dim, fontSize: 12.5, lineHeight: 18 }}>Practise on live prices with a Buy / Sell ticket, stop loss, take profit and partial close. No real money.</Text>
            <Pressable onPress={() => setTab(MANUAL_TAB)} style={((st: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 14, borderRadius: 9, cursor: 'pointer', backgroundColor: th.accent, opacity: st.hovered ? 0.88 : 1 })) as any}>
              <Text style={{ color: th.onAccent, fontSize: 12.5, fontWeight: '800' }}>Open</Text><Icon name="arrow-forward" size={14} color={th.onAccent} />
            </Pressable>
          </View>
        </Card>
        <Card style={{ flex: 1.2, minWidth: 280, padding: 16, gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="shield-checkmark" size={17} color={th.accent} /><Text style={{ color: th.text, fontSize: 15, fontWeight: '900' }}>Risk Management</Text></View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ flex: 1, color: th.dim, fontSize: 12.5, lineHeight: 18 }}>Protect your capital. Trade with a plan.</Text>
            <Pressable onPress={() => setTab(4)} style={((s: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 14, borderRadius: 9, cursor: 'pointer', backgroundColor: th.accent, opacity: s.hovered ? 0.9 : 1 })) as any}>
              <Text style={{ color: th.onAccent, fontSize: 12.5, fontWeight: '800' }}>Open Planner</Text><Icon name="arrow-forward" size={14} color={th.onAccent} />
            </Pressable>
          </View>
        </Card>
      </View>
      <Text style={{ color: th.dim, fontSize: 11.5, textAlign: 'center', paddingBottom: 8 }}>Educational tool, not financial advice. Prices are live from Deriv, Binance and backup feeds.</Text>
    </ScrollView>
  );
}
