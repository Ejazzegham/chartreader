import React, { useEffect, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { useWindowDimensions } from '../win';
import { useApp } from '../store';
import { Card, Dim, Body, Btn, Badge, SectionTitle, TimeframeBar } from '../ui';
import { Tile, Checklist, ScoreRing, SetupCard } from '../ProUI';
import NewsBanner from '../NewsBanner';
import { analyzeAll } from '../refine';
import MethodChart from '../MethodChart';
import { fibonacci, fin } from '../indicators';
import { momentum } from '../momentum';
import { Logged } from '../signalLog';
import TakeSkip from '../TakeSkip';
import { BodyProps } from '../embed';
import { Candle, TFS, symOf, watchCandles, quotes } from '../markets';

// ---------------------------------------------------------------- the screen
export default function Insight({ on, symId = 'frxEURUSD', method = 'liquidity' }: BodyProps) {
  const { th, setPrefill, setTab } = useApp();
  const { width } = useWindowDimensions();
  const [tf, setTf] = useState('900');
  const [data, setData] = useState<Candle[]>([]);
  const [err, setErr] = useState('');
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!on) return;
    setData([]); setErr('');
    return watchCandles(symId, Number(tf), (c) => { setErr(''); setData(c); }, setErr);
  }, [on, symId, tf, nonce]);

  const sym = symOf(symId), dec = quotes[symId]?.dec ?? (data.length && data[data.length - 1].c >= 100 ? 2 : 5);
  const sessions = ['forex', 'indices'].includes(sym.cat);
  const all = useMemo(() => analyzeAll(data, new Date(), { sessions }), [data, sessions]);
  const mom = useMemo(() => momentum(data), [data]);
  const f = (v: number) => v.toFixed(dec);
  const ict = all.ict, last = data.length ? data[data.length - 1].c : NaN, atr = ict.atr;
  const away = (d: number) => (atr > 0 ? `${(Math.abs(d) / atr).toFixed(1)} ATR` : `${f(Math.abs(d))}`);

  // ---- liquidity
  const pools = ict.ok ? ict.liquidity.map((l) => ({ ...l, d: l.price - last })).sort((a, b) => Math.abs(a.d) - Math.abs(b.d)) : [];
  const resting = pools.filter((p) => !p.swept);
  const above = resting.find((p) => p.d > 0), below = resting.find((p) => p.d < 0);
  const equalN = resting.filter((p) => p.equal).length;

  // ---- entry
  const fib = useMemo(() => (data.length > 40 ? fibonacci(data) : null), [data]);
  const fibLv = fib ? fib.levels.filter((l) => !l.ext && [0.5, 0.618, 0.705, 0.786].includes(l.r)) : [];
  const zones = (ict.ok ? [...ict.orderBlocks, ...ict.fvgs] : [])
    .filter((z) => z.fresh && (z.side === 'bullish' ? z.bottom <= last : z.top >= last))
    .map((z) => {
      const inside = last <= z.top && last >= z.bottom, d = inside ? 0 : last > z.top ? last - z.top : z.bottom - last, pad = atr > 0 ? atr * 0.1 : 0;
      const why: string[] = [];
      if (ict.ote && ict.ote.bottom <= z.top + pad && ict.ote.top >= z.bottom - pad && ((z.side === 'bullish') === (ict.ote.side === 'buy'))) why.push('OTE 62-79%');
      const fl = fibLv.filter((l) => l.price <= z.top + pad && l.price >= z.bottom - pad);
      if (fl.length) why.push(`Fib ${fl.map((l) => l.r).join('/')}`);
      const other = (z.kind === 'OB' ? ict.fvgs : ict.orderBlocks).some((o) => o.side === z.side && o.fresh && o.bottom <= z.top && o.top >= z.bottom);
      if (other) why.push(z.kind === 'OB' ? 'FVG overlap' : 'OB overlap');
      if ((z.side === 'bullish' && ict.trend === 'bullish') || (z.side === 'bearish' && ict.trend === 'bearish')) why.push('With the trend');
      if (ict.killzone) why.push('Killzone open');
      return { ...z, inside, d, why };
    })
    .sort((a, b) => a.d - b.d || b.why.length - a.why.length)
    .slice(0, 6);
  const plan: Logged | null = all.combo
    ? { side: all.combo.side, entry: all.combo.entry, sl: all.combo.sl, tps: [...all.combo.tps], score: all.combo.score, grade: all.combo.grade, source: 'Entry Finder' }
    : ict.setup ? { side: ict.setup.side, entry: ict.setup.entry, sl: ict.setup.sl, tps: [...ict.setup.tps], score: ict.setup.score, grade: ict.setup.grade, source: 'Entry Finder' } : null;
  const planRr = all.combo ? all.combo.rr : ict.setup?.rr;
  const planModel = all.combo ? all.combo.basis : ict.setup?.model ?? '';

  const biasCol = mom.bias === 'bullish' ? th.buy : mom.bias === 'bearish' ? th.sell : th.gold;
  const chartMethod = method === 'momentum' ? (all.vsa.hasVolume ? 'vsa' : 'all') : 'ict';

  return (
    <View style={{ gap: 12 }}>
      <NewsBanner symId={symId} active={!!on} />
      <TimeframeBar value={tf} options={TFS} onChange={setTf} />
      <Card style={{ padding: 8, direction: 'ltr' }}>
        {err ? (
          <View style={{ gap: 12, padding: 8 }}><Body color={th.sell}>{err}</Body><Btn ghost label="Retry" onPress={() => setNonce((x) => x + 1)} /></View>
        ) : <MethodChart data={data} all={all} method={chartMethod} width={width - 48} dec={dec} gran={Number(tf)} />}
      </Card>

      {/* ============================ Liquidity Map ============================ */}
      {method === 'liquidity' && (
        <>
          {!ict.ok ? <Card><Body color={th.gold}>{ict.reason ?? 'Waiting for chart data.'}</Body></Card> : (
            <>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Tile label="Nearest above" value={above ? f(above.price) : 'None'} color={th.sell} sub={above ? `${away(above.d)} · buy-side` : 'no resting pool'} />
                <Tile label="Nearest below" value={below ? f(below.price) : 'None'} color={th.buy} sub={below ? `${away(below.d)} · sell-side` : 'no resting pool'} />
                <Tile label="Equal levels" value={String(equalN)} sub="highs / lows" />
              </View>
              {ict.sweep && (
                <Card style={{ borderColor: th.gold }}>
                  <SectionTitle icon="flash-outline">Latest sweep</SectionTitle>
                  <View style={{ height: 6 }} />
                  <Body>{ict.sweep.side === 'BSL' ? 'Buy-side' : 'Sell-side'} liquidity was taken at {f(ict.sweep.price)}.</Body>
                  <Dim>{ict.sweep.side === 'BSL' ? 'If price closes back below it, sellers may take over. Wait for a CHoCH before acting.' : 'If price closes back above it, buyers may take over. Wait for a CHoCH before acting.'}</Dim>
                </Card>
              )}
              {above && below && (
                <Card>
                  <Body>{Math.abs(above.d) < Math.abs(below.d) ? `Price is closer to the liquidity above (${away(above.d)}) than below (${away(below.d)}).` : `Price is closer to the liquidity below (${away(below.d)}) than above (${away(above.d)}).`}</Body>
                  <Dim>Resting stops often act like a magnet. This is context, not a signal: use it with a method that gives an entry and a stop.</Dim>
                </Card>
              )}
              <Card>
                <SectionTitle icon="water-outline">Liquidity pools near price</SectionTitle>
                <View style={{ height: 8 }} />
                {pools.length === 0 && <Dim>No clear pools in the visible candles.</Dim>}
                {pools.slice(0, 8).map((p, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: th.hair }}>
                    <Badge label={p.side} color={p.side === 'BSL' ? th.sell : th.buy} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: th.text, fontWeight: '800', fontSize: 14 }}>{f(p.price)}</Text>
                      <Text style={{ color: th.dim, fontSize: 11 }}>{p.equal ? (p.side === 'BSL' ? 'Equal highs' : 'Equal lows') : p.side === 'BSL' ? 'Swing high' : 'Swing low'} · {away(p.d)} {p.d > 0 ? 'above' : 'below'}</Text>
                    </View>
                    <Badge label={p.swept ? 'SWEPT' : 'RESTING'} color={p.swept ? th.dim : th.accent} />
                  </View>
                ))}
              </Card>
              <Dim>BSL = buy-side liquidity (stops above highs). SSL = sell-side liquidity (stops below lows). Educational tool, not financial advice.</Dim>
            </>
          )}
        </>
      )}

      {/* ============================ Entry Finder ============================ */}
      {method === 'entry' && (
        <>
          {!ict.ok && <Card><Body color={th.gold}>{ict.reason ?? 'Waiting for chart data.'}</Body></Card>}
          {ict.ok && plan && planRr && (
            <>
              <SetupCard side={plan.side} model={planModel} score={plan.score} grade={plan.grade} entry={plan.entry} sl={plan.sl} tps={plan.tps} rr={[...planRr]} f={f}
                onSend={() => { setPrefill({ entry: plan.entry, sl: plan.sl, tps: [...plan.tps], symbol: sym.name }); setTab(4); }} note="Best entry from all methods together." />
              <TakeSkip symId={symId} name={sym.name} tf={tf} dec={dec} setup={plan} />
            </>
          )}
          {ict.ok && !plan && <Card><SectionTitle icon="hourglass-outline">No clean entry yet</SectionTitle><View style={{ height: 6 }} /><Body color={th.dim}>Price is not at a zone with enough confluence. The zones below show where to watch.</Body></Card>}
          {ict.ok && (
            <Card>
              <SectionTitle icon="locate-outline">Entry zones</SectionTitle>
              <View style={{ height: 8 }} />
              {zones.length === 0 && <Dim>No fresh order blocks or fair value gaps on the correct side of price.</Dim>}
              {zones.map((z, i) => {
                const c = z.side === 'bullish' ? th.buy : th.sell;
                return (
                  <View key={i} style={{ paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: th.hair, gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Badge label={z.side === 'bullish' ? 'BUY ZONE' : 'SELL ZONE'} color={c} />
                      <Text style={{ color: th.text, fontWeight: '800', flex: 1 }}>{z.kind === 'OB' ? 'Order block' : 'Fair value gap'}</Text>
                      {z.inside ? <Badge label="PRICE INSIDE" color={th.gold} /> : <Text style={{ color: th.dim, fontSize: 11.5 }}>{away(z.d)} away</Text>}
                    </View>
                    <Text style={{ color: th.text, fontSize: 13 }}>{f(z.bottom)} to {f(z.top)}</Text>
                    {z.why.length > 0 && <Text style={{ color: th.dim, fontSize: 11.5 }}>{z.why.length} confluence: {z.why.join(', ')}</Text>}
                  </View>
                );
              })}
            </Card>
          )}
          {fibLv.length > 0 && fib && (
            <Card>
              <SectionTitle icon="git-branch-outline">Retracement levels</SectionTitle>
              <Dim>{fib.up ? 'Pullback levels after the last up leg (buy side)' : 'Pullback levels after the last down leg (sell side)'}</Dim>
              <View style={{ height: 6 }} />
              {fibLv.map((l, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderTopColor: th.hair }}>
                  <Text style={{ color: th.dim }}>{(l.r * 100).toFixed(1)}%</Text>
                  <Text style={{ color: th.text, fontWeight: '700' }}>{f(l.price)}</Text>
                  <Text style={{ color: th.dim, fontSize: 12 }}>{away(l.price - last)}</Text>
                </View>
              ))}
            </Card>
          )}
          <Dim>Zones are candidates, not signals. A trade needs your own stop and size. Educational tool, not financial advice.</Dim>
        </>
      )}

      {/* ============================ Momentum & Volume ============================ */}
      {method === 'momentum' && (
        <>
          {!mom.ok ? <Card><Body color={th.gold}>Not enough candles yet for momentum. Pick a smaller timeframe or wait a moment.</Body></Card> : (
            <>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <ScoreRing score={mom.score} color={biasCol} size={78} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: biasCol, fontWeight: '900', fontSize: 18 }}>{mom.bias === 'bullish' ? 'Bullish momentum' : mom.bias === 'bearish' ? 'Bearish momentum' : 'Mixed momentum'}</Text>
                  <Text style={{ color: th.dim, fontSize: 12, marginTop: 2 }}>{mom.strength}{mom.strength && mom.volatility ? ' · ' : ''}{mom.volatility ? `Volatility ${mom.volatility.toLowerCase()}` : ''}</Text>
                  <Text style={{ color: th.dim, fontSize: 11, marginTop: 2 }}>{mom.checks.filter((x) => x.ok).length} of {mom.checks.length} checks agree</Text>
                </View>
              </Card>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Tile label="RSI 14" value={fin(mom.rsi) ? mom.rsi.toFixed(0) : '-'} color={mom.rsi > 70 ? th.sell : mom.rsi < 30 ? th.buy : th.text} sub={mom.rsi > 70 ? 'overbought' : mom.rsi < 30 ? 'oversold' : 'normal'} />
                <Tile label="ADX" value={fin(mom.adx) ? mom.adx.toFixed(0) : '-'} sub={mom.strength || undefined} />
                <Tile label="Stochastic" value={fin(mom.stochK) ? mom.stochK.toFixed(0) : '-'} />
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Tile label="MACD hist" value={fin(mom.macd) ? (mom.macd > 0 ? 'Positive' : 'Negative') : '-'} color={mom.macd > 0 ? th.buy : th.sell} />
                <Tile label="Volatility" value={fin(mom.atrPct) ? `${mom.atrPct.toFixed(2)}%` : '-'} sub={mom.volatility.toLowerCase()} />
                <Tile label="Volume" value={mom.volRatio == null ? 'No data' : `${mom.volRatio.toFixed(1)}x`} sub={mom.volRatio == null ? 'no volume feed' : 'vs average'} />
              </View>
              <Card>
                <SectionTitle icon="checkmark-done-outline">What agrees</SectionTitle>
                <View style={{ height: 8 }} />
                <Checklist items={mom.checks} />
              </Card>
              <Dim>A momentum reading, not a trade signal. It has no entry or stop: use it to confirm a setup from another method. Educational tool, not financial advice.</Dim>
            </>
          )}
        </>
      )}
    </View>
  );
}
