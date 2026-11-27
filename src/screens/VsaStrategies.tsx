import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Switch, TextInput, Platform } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { useWindowDimensions } from '../win';
import { useApp } from '../store';
import { Card, Dim, Body, Btn, Badge, SectionTitle, Segment, TimeframeBar } from '../ui';
import IndicatorChart from '../IndicatorChart';
import { BodyProps } from '../embed';
import { Candle, symOf, watchCandles, quotes } from '../markets';
import { Bar, ExitMode, defaultParams, parseOhlcvCsv, resample, runBacktest, summarize } from '../vsaStrategy';
import { ScalpExit, defaultScalpParams, runScalp } from '../vsaScalpM1';

// Two volume-spread-analysis methods, run on the pair chosen on the Analysis page (or on a CSV the person loads):
//   vsazone = Strategy 1: H1 VSA zone (FVG on an ultra-volume candle / order block on a no-supply candle) + lower-timeframe confirmation (src/vsaStrategy.ts)
//   vsam1   = Strategy 2: 1-minute retracement scalp (src/vsaScalpM1.ts)
// Both are back-tests: they list every trade the rules would have taken in the loaded candles, with the result in R, and flag a fresh signal on the latest candles.
// Educational tool, not financial advice.
type Row = { time: number; exit: number; side: string; label: string; entry: number; sl: number; target: number; R: number; status: string };
const LIVE_COUNT = 1000;
const ZONE_TFS = [{ k: '60', label: 'M1' }, { k: '180', label: 'M3' }, { k: '300', label: 'M5' }];
const toBars = (c: Candle[]): Bar[] => c.map((x) => ({ time: x.t * 1000, open: x.o, high: x.h, low: x.l, close: x.c, volume: x.v ?? 0 }));
const fmtT = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');

// website only: a file picker that returns the text of one CSV
function pickCsv(): Promise<{ name: string; text: string } | null> {
  return new Promise((res) => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return res(null);
    const el = document.createElement('input');
    el.type = 'file'; el.accept = '.csv,text/csv';
    el.onchange = async () => { const f = el.files?.[0]; res(f ? { name: f.name, text: await f.text() } : null); };
    el.click();
  });
}

function Equity({ r, color }: { r: number[]; color: string }) {
  if (r.length < 2) return null;
  const eq = r.reduce<number[]>((a, x) => (a.push((a[a.length - 1] ?? 0) + x), a), [0]);
  const mn = Math.min(...eq), mx = Math.max(...eq), W = 600, H = 90;
  const pts = eq.map((v, i) => `${(i / (eq.length - 1)) * W},${H - 6 - ((v - mn) / (mx - mn || 1)) * (H - 12)}`).join(' ');
  return <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"><Polyline points={pts} fill="none" stroke={color} strokeWidth={2} /></Svg>;
}

export default function VsaStrategies({ on, symId = 'frxEURUSD', method = 'vsazone' }: BodyProps) {
  const { th } = useApp();
  const { width } = useWindowDimensions();
  const m1 = method === 'vsam1';
  const [tf, setTf] = useState('300');
  const [data, setData] = useState<Candle[]>([]);
  const [err, setErr] = useState('');
  const [nonce, setNonce] = useState(0);
  const [csv, setCsv] = useState<{ name: string; bars: Bar[] } | null>(null);
  const [csvErr, setCsvErr] = useState('');
  // strategy 1
  const [zExit, setZExit] = useState<ExitMode>('partial');
  const [noBias, setNoBias] = useState(false);
  // strategy 2
  const [sExit, setSExit] = useState<ScalpExit>('be_rr');
  const [sess, setSess] = useState(true), [htf, setHtf] = useState(true), [ema, setEma] = useState(false), [one, setOne] = useState(false);
  const [spread, setSpread] = useState('0'), [off, setOff] = useState('0');

  const gran = m1 ? 60 : Number(tf);
  const live = !csv;

  // live candles only while this method is open; a new pair, timeframe or method restarts the stream
  useEffect(() => {
    if (!on || csv) return;
    setData([]); setErr('');
    return watchCandles(symId, gran, (c) => { setErr(''); setData(c); }, setErr, undefined, LIVE_COUNT);
  }, [on, symId, gran, nonce, !!csv]);

  const bars = useMemo(() => (csv ? csv.bars : toBars(data)), [csv, data]);
  const withVol = bars.length ? bars.filter((b) => b.volume > 0).length / bars.length : 0;
  const noVol = bars.length > 20 && withVol < 0.5;

  const { rows, fail } = useMemo((): { rows: Row[]; fail: string } => {
    if (bars.length < 120) return { rows: [], fail: '' };
    try {
      if (m1) {
        const p = defaultScalpParams({ exitMode: sExit, dataUtcOffset: csv ? Number(off) || 0 : 0, sessionOnly: sess, useHtfTrend: htf, useEma: ema, spread: Number(spread) || 0, allowOverlap: !one });
        return { fail: '', rows: runScalp(bars, p).map((x) => ({ time: x.entryTime, exit: x.exitTime, side: x.side, label: x.exitReason, entry: x.entry, sl: x.sl, target: x.tp, R: x.R, status: x.exitReason === 'open' ? 'open' : 'closed' })) };
      }
      const p = defaultParams({ exitMode: zExit, useBias: !noBias });
      return { fail: '', rows: runBacktest(resample(bars), bars, p).map((x) => ({ time: x.entryTime, exit: x.exitTime, side: x.side ?? 'BUY', label: `${x.mode} · ${x.zone}`, entry: x.entry, sl: x.sl, target: x.target, R: x.R, status: x.status })) };
    } catch (e: any) { return { rows: [], fail: e?.message ?? 'Could not run the strategy on this data.' }; }
  }, [bars, m1, zExit, noBias, sExit, sess, htf, ema, one, spread, off, csv]);

  const sum = useMemo(() => summarize(rows), [rows]);
  const sym = symOf(symId);
  const dec = quotes[symId]?.dec ?? (data.length && data[data.length - 1].c >= 100 ? 2 : 5);
  const f = (n: number) => (isFinite(n) ? (Math.abs(n) < 10 ? n.toFixed(Math.max(dec, 4)) : n.toFixed(2)) : '-');

  // a signal is "fresh" when its entry is within the last 3 candles of live data
  const lastMs = bars.length ? bars[bars.length - 1].time : 0;
  const fresh = live && rows.length ? rows.filter((r) => r.time >= lastMs - 3 * gran * 1000).slice(-1)[0] : undefined;
  const levels = fresh ? [{ label: 'Entry', price: fresh.entry, color: th.accent }, { label: 'SL', price: fresh.sl, color: th.sell }, { label: 'Target', price: fresh.target, color: th.buy }] : [];

  const title = m1 ? 'Strategy 2 · 1-minute VSA retracement scalp' : 'Strategy 1 · VSA zone + lower-timeframe confirmation';
  const how = m1
    ? 'Bullish structure with a protected low. Price pulls back (a body close under the last buy candle low). The biggest-volume candle of the pullback must be a sell candle. Then a low-volume momentum candle closes above its high. Stop under the pullback low. Exit: breakeven at 1R, target 1:2. Sells are the mirror image.'
    : 'The H1 structure gives the bias. H1 zones: a fair value gap touched by an ultra-high-volume candle, or an order block on a no-supply candle. Wait for price to return into the zone, then confirm on the lower timeframe (VSA break, no-supply sweep or CISD). Stop under the confirmation low. Exits: fixed 1:2, H1 structure or partial. Sells are the mirror image.';

  const loadCsv = async () => {
    setCsvErr('');
    const file = await pickCsv();
    if (!file) return;
    try {
      const b = parseOhlcvCsv(file.text);
      if (b.length < 120) throw new Error('The file needs at least 120 candles.');
      setCsv({ name: file.name, bars: b });
    } catch (e: any) { setCsvErr(e?.message ?? 'Could not read this CSV.'); }
  };

  const toggle = (label: string, v: boolean, set: (b: boolean) => void) => (
    <View key={label} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 6 }}>
      <Text style={{ flex: 1, color: th.text, fontSize: 13 }}>{label}</Text>
      <Switch value={v} onValueChange={set} trackColor={{ true: th.accent, false: th.line }} thumbColor="#FFFFFF" />
    </View>
  );
  const input = (label: string, v: string, set: (s: string) => void) => (
    <View key={label} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 4 }}>
      <Text style={{ flex: 1, color: th.text, fontSize: 13 }}>{label}</Text>
      <TextInput value={v} onChangeText={set} keyboardType="numeric" style={{ width: 90, height: 34, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: th.line, backgroundColor: th.panel2, color: th.text, textAlign: 'right' }} />
    </View>
  );

  const kpis: [string, string][] = [
    ['Trades', String(sum.trades)], ['Win rate', sum.winRatePct !== undefined ? `${sum.winRatePct}%` : '-'], ['Average R', sum.avgR !== undefined ? String(sum.avgR) : '-'],
    ['Total R', sum.totalR !== undefined ? String(sum.totalR) : '-'], ['Profit factor', sum.profitFactor !== undefined ? (isFinite(sum.profitFactor) ? String(sum.profitFactor) : '∞') : '-'], ['Max drawdown (R)', sum.maxDrawdownR !== undefined ? String(sum.maxDrawdownR) : '-'],
  ];
  const latest = rows.slice(-15).reverse();

  return (
    <View style={{ gap: 12 }}>
      <Card style={{ gap: 6 }}>
        <SectionTitle icon="bar-chart-outline">{title}</SectionTitle>
        <Dim>{how}</Dim>
      </Card>

      {!m1 && !csv && <TimeframeBar value={tf} options={ZONE_TFS} onChange={setTf} />}

      <Card style={{ gap: 4 }}>
        <SectionTitle icon="options-outline">Settings</SectionTitle>
        {m1 ? (
          <>
            <Segment value={sExit} onChange={(k) => setSExit(k as ScalpExit)} options={[{ k: 'be_rr', label: 'BE at 1R + 1:2' }, { k: 'fixed', label: 'Fixed 1:2' }, { k: 'runner', label: 'Runner' }]} />
            {toggle('New York session only (13:00-21:00 UTC)', sess, setSess)}
            {toggle('Require 10-minute trend', htf, setHtf)}
            {toggle('Require close above EMA', ema, setEma)}
            {toggle('One trade at a time', one, setOne)}
            {input('Spread (price units)', spread, setSpread)}
            {csv && input('CSV time = UTC + N hours', off, setOff)}
          </>
        ) : (
          <>
            <Segment value={zExit} onChange={(k) => setZExit(k as ExitMode)} options={[{ k: 'partial', label: 'Partial' }, { k: 'fixed', label: 'Fixed 1:2' }, { k: 'structure', label: 'H1 structure' }]} />
            {toggle('Trade both directions regardless of H1 bias', noBias, setNoBias)}
          </>
        )}
      </Card>

      {/* chart + fresh signal (live data only) */}
      {live && (
        <Card style={{ padding: 8, direction: 'ltr', overflow: 'hidden' }}>
          {err ? (
            <View style={{ gap: 12, padding: 8 }}><Body color={th.sell}>{err}</Body><Btn ghost label="Retry" onPress={() => setNonce((n) => n + 1)} /></View>
          ) : (
            <IndicatorChart data={data} width={width - 48} dec={dec} levels={levels} gran={gran} />
          )}
        </Card>
      )}
      {live && noVol && <Card><Body color={th.gold}>{`${sym.name} has no real volume on this timeframe, and both methods need volume. Try a crypto pair, or load a CSV that has a volume column.`}</Body></Card>}
      {live && !noVol && data.length > 0 && data.length < 120 && <Card><Dim>Waiting for more candles ({data.length} of 120 needed).</Dim></Card>}
      {!!fail && <Card><Body color={th.sell}>{fail}</Body></Card>}

      {live && fresh && (
        <Card glow style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: th.dim, fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>LATEST SIGNAL</Text>
            <Badge label={fresh.side} color={fresh.side === 'BUY' ? th.buy : th.sell} />
          </View>
          <Text style={{ color: fresh.side === 'BUY' ? th.buy : th.sell, fontSize: 20, fontWeight: '900' }}>{fresh.side} · {fresh.label}</Text>
          <Text style={{ color: th.text, fontSize: 13 }}>Entry {f(fresh.entry)}   Stop {f(fresh.sl)}   Target {f(fresh.target)}</Text>
          <Dim>{fmtT(fresh.time)} UTC</Dim>
        </Card>
      )}
      {live && !fresh && !noVol && rows.length > 0 && <Card><Dim>No fresh signal on the latest candles. The list below is what the rules would have traded in the loaded history.</Dim></Card>}

      {/* CSV */}
      {Platform.OS === 'web' && (
        <Card style={{ gap: 8 }}>
          <SectionTitle icon="document-text-outline">Test on your own data</SectionTitle>
          <Dim>{m1 ? 'Load a 1-minute CSV (time, open, high, low, close, volume).' : 'Load an M1, M3 or M5 CSV (time, open, high, low, close, volume). The H1 candles are built from it.'} The file stays in your browser.</Dim>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Btn ghost label={csv ? 'Load another CSV' : 'Load CSV'} onPress={loadCsv} icon="cloud-upload-outline" />
            {csv && <Btn ghost label="Back to live data" onPress={() => { setCsv(null); setCsvErr(''); }} />}
          </View>
          {csv && <Dim>{`${csv.name} · ${csv.bars.length} candles`}</Dim>}
          {!!csvErr && <Body color={th.sell}>{csvErr}</Body>}
        </Card>
      )}

      {/* results */}
      {bars.length >= 120 && !fail && (
        <Card style={{ gap: 10 }}>
          <SectionTitle icon="stats-chart-outline">Back-test result</SectionTitle>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {kpis.map(([k, v]) => (
              <View key={k} style={{ flexGrow: 1, flexBasis: 110, padding: 10, borderRadius: 6, borderWidth: 1, borderColor: th.line, backgroundColor: th.panel2 }}>
                <Text style={{ color: th.dim, fontSize: 10.5 }}>{k}</Text>
                <Text style={{ color: th.text, fontSize: 17, fontWeight: '800' }}>{v}</Text>
              </View>
            ))}
          </View>
          {rows.length > 1 && <View style={{ borderRadius: 6, borderWidth: 1, borderColor: th.line, padding: 6 }}><Equity r={rows.map((r) => r.R)} color={th.accent} /></View>}
          {rows.length === 0 && <Dim>No trades found in these candles. That is normal: the rules are strict. Try a longer history (load a CSV) or relax a filter.</Dim>}
          {latest.map((t, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, borderTopWidth: 1, borderTopColor: th.hair }}>
              <Text style={{ width: 40, color: t.side === 'BUY' ? th.buy : th.sell, fontWeight: '800', fontSize: 12 }}>{t.side}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: th.text, fontSize: 12 }} numberOfLines={1}>{fmtT(t.time)} · {t.label}</Text>
                <Text style={{ color: th.dim, fontSize: 11 }} numberOfLines={1}>{f(t.entry)} → SL {f(t.sl)} · TP {f(t.target)}</Text>
              </View>
              <Text style={{ color: t.R >= 0 ? th.buy : th.sell, fontWeight: '800', fontSize: 13 }}>{t.R >= 0 ? '+' : ''}{t.R.toFixed(2)}R</Text>
            </View>
          ))}
          {rows.length > 15 && <Dim>{`Showing the latest 15 of ${rows.length} trades.`}</Dim>}
        </Card>
      )}
      <Dim>Past results do not predict future results. Educational tool, not financial advice.</Dim>
    </View>
  );
}
