import React, { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, Pressable, Switch } from 'react-native';
import { LinearGradient } from '../FlatGradient';
import { useApp } from '../store';
import { Screen, Card, Dim, Body, Btn, Badge, Icon, TimeframeBar, Row } from '../ui';
import { analyzeAll } from '../refine';
import { hasVolumePath, feedHasVolume } from '../volume';
import { hasRealVolume } from '../vsa';
import { priceDec, Candle, SYMBOLS, TFS, symOf, isBad, isClosed, useFeed, watchCandles } from '../markets';
import { useNews, riskFor, currenciesOf, fmtIn, localTime } from '../news';
import NewsBanner from '../NewsBanner';
import TakeSkip from '../TakeSkip';
import { BodyProps } from '../embed';
import { remote } from '../remote';
import { HTF_OF } from '../entry';
import { scheduleState, marketState } from '../session';
import { qualify, levelText, AlertLevel } from '../verdict';
import { methodSetups, topDownSetup, MethodSetup, SETUP_MIN } from '../methodSetups';
import { topDownAnalyze } from '../topdown';
import { liveSame, muteKeys } from '../trades';

const TAB = 12;
const GROUPS = [{ k: 'favs', label: 'Watchlist' }, { k: 'forex', label: 'Forex' }, { k: 'crypto', label: 'Crypto' }, { k: 'deriv', label: 'Synthetic' }];
// The methods the person can tick. `name` is the MethodSetup.method it produces.
// Top-Down has its own engine and always reads 4H, 1H and 15m, whatever timeframe is chosen above.
const METHODS = [
  { k: 'ict', label: 'ICT', name: 'ICT' }, { k: 'smc', label: 'SMC', name: 'SMC' }, { k: 'pat', label: 'Chart pattern', name: 'Pattern' },
  { k: 'topdown', label: 'Top-Down', name: 'TopDown' }, { k: 'vsa', label: 'VSA', name: 'VSA' }, { k: 'candle', label: 'Candlestick', name: 'Candle' },
] as const;
type MKey = typeof METHODS[number]['k'];
const ALL_M: MKey[] = METHODS.map((m) => m.k);
const COMBO_M: MKey[] = ['ict', 'smc', 'vsa', 'pat', 'candle']; // the combined entry and its alert gate merge these five, so they only exist when all five are ticked
const TD_TFS = [14400, 3600, 900], TD_COUNT = 320;              // Top-Down: 4H, 1H, 15m, 320 candles for a real EMA 200
const BG_MAX = 100; // pairs the server scans while the app is closed (the server accepts 100)
const isSpike = (id: string) => /^(BOOM|CRASH)\d+N?$/.test(id); // Deriv spike pairs (Boom / Crash): ALWAYS in the background list, they must never be cut off by the cap
const CRYPTO_MAX = 60, BATCH = 6, TIMEOUT = 10000, AUTO_MS = 90000; // the whole market is scanned; crypto has hundreds of pairs, so the 60 most traded

type Hit = {
  id: string; name: string; price: number; dec: number; trend: 'bullish' | 'bearish' | 'range';
  side: 'buy' | 'sell' | null; score: number; grade: string; entry?: number; sl?: number; tps?: number[]; basis?: string;
  scalp: 'buy' | 'sell' | null; rsi: number | null; why?: string; ok: boolean; plan?: { label: string; trigger: string; cancelIf: string }; htf?: string; zone?: [number, number]; checks?: string[];
  setups?: MethodSetup[];                             // every method's own setup scoring 70+ (ICT, SMC, VSA, pattern, candle, scalp, combined), best first
  closed?: boolean;                                   // the market is shut or the feed is not live: nothing is analysed, nothing rings
  alert?: AlertLevel; qgrade?: 'A+' | 'A' | null; agree?: string[]; blocked?: string[]; // result of the entry gate (src/verdict.ts): qgrade is A+ (score 85+) or A for every setup that passed it
};

const closedHit = (id: string, name: string, why: string, reopens?: string, price = NaN): Hit =>
  ({ id, name, price, dec: 5, trend: 'range', side: null, score: 0, grade: '-', scalp: null, rsi: null, ok: false, closed: true, why: `Market closed. ${why}${reopens ? ` Reopens ${reopens}.` : ''}` });

// Grab the first batch of candles for a symbol, then stop the subscription. Never rejects.
function candlesOnce(id: string, gran: number, count = 150, wantVol = true): Promise<Candle[]> {
  return new Promise((resolve) => {
    let finished = false, un: (() => void) | null = null, timer: any;
    const fin = (c: Candle[]) => {
      if (finished) return; finished = true; clearTimeout(timer);
      if (un) { try { un(); } catch {} }
      resolve(c);
    };
    let latest: Candle[] = [], grace: any = null;
    timer = setTimeout(() => fin(latest), TIMEOUT);
    // Deriv candles arrive first and the real volume (Binance / futures) a moment later: wait for it, but never longer than 4 s
    const needVol = wantVol && hasVolumePath(id, gran) && !feedHasVolume(id);
    const withVol = (c: Candle[]) => hasRealVolume(c); // same rule as the VSA engine
    un = watchCandles(id, gran, (c) => {
      latest = c;
      if (!needVol || withVol(c)) { clearTimeout(grace); fin(c); return; }
      if (!grace) grace = setTimeout(() => fin(latest), 4000);
    }, () => fin([]), undefined, count);
    if (finished) { try { un(); } catch {} }
  });
}

export default function Scanner({ embedded, on, onOpen, group: groupProp, cfg }: BodyProps = {}) {
  const { th, t, tab, setPrefill, setTab, logSetup, toast, raiseAlarm, signals, setupHandled, settings } = useApp();
  const active = embedded ? !!on : tab === TAB;
  const { db } = useFeed(active);
  useNews(active);
  const [groupLocal, setGroup] = useState('forex');
  const group = groupProp ?? groupLocal;
  const [tf, setTf] = useState(settings.defTf || '900');
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [only, setOnly] = useState(false);
  const [autoLocal, setAuto] = useState(false);
  const auto = cfg ? cfg.auto : autoLocal; // from the Scanner Setup card when this runs inside the Analysis page
  const minProb = cfg ? cfg.minProb : 0;
  const alerted = useRef('');
  const [open, setOpen] = useState('');
  const [at, setAt] = useState(0);
  // the methods to scan: ticked in the card below, remembered, and applied after a short pause so several taps start only one scan
  const [picked, setPicked] = useState<MKey[]>(ALL_M);
  const [sel, setSel] = useState<MKey[]>(ALL_M);
  const [mReady, setMReady] = useState(false);
  const selKey = sel.join(), full = COMBO_M.every((k) => sel.includes(k));
  const runId = useRef(0), busyRef = useRef(false);
  busyRef.current = busy;

  const ids = (g: string) => {
    let list = g === 'favs' ? db.favs : SYMBOLS.filter((s) => s.cat === g).map((s) => s.id);
    if (g === 'crypto') { const top = SYMBOLS.filter((s) => s.cat === 'crypto' && s.quote === 'USDT').map((s) => s.id); if (top.length) list = top; } // most traded USDT pairs first
    list = list.filter((x) => !isBad(x));
    return g === 'crypto' ? list.slice(0, CRYPTO_MAX) : list; // forex, synthetic, indices and the watchlist: every pair
  };

  const scan = async () => {
    const my = ++runId.current, list = ids(group), gran = Number(tf);
    if (!sel.length) { setHits([]); setDone(0); setTotal(0); setAt(0); setBusy(false); return; } // nothing ticked: nothing to scan
    // only the ticked methods are read; the combined entry needs all five of the methods it merges
    const only = [...METHODS.filter((m) => sel.includes(m.k)).map((m) => m.name), ...(full ? ['Combined'] : [])] as MethodSetup['method'][];
    const engine = sel.some((k) => k !== 'topdown'); // ICT, SMC, VSA, pattern or candle ticked: run the shared engine
    setBusy(true); setDone(0); setTotal(list.length); setOpen('');
    const out: Hit[] = [];
    for (let i = 0; i < list.length; i += BATCH) {
      const part = list.slice(i, i + BATCH);
      const res = await Promise.all(part.map(async (id) => {
        const s = symOf(id), now = new Date();
        // 1. The weekly schedule first: a closed market needs no download and no analysis.
        const sched = scheduleState(id, s.cat, now);
        if (!sched.open) return closedHit(id, s.name, sched.reason, sched.reopens);
        const hg = engine ? HTF_OF[gran] : undefined;
        const [c, h] = await Promise.all([candlesOnce(id, gran), hg ? candlesOnce(id, hg) : Promise.resolve([] as Candle[])]);
        const dec = !c.length ? 5 : s.quote ? priceDec(c[c.length - 1].c) : c[c.length - 1].c >= 100 ? 2 : 5;
        if (c.length < 45) return { id, name: s.name, price: c.length ? c[c.length - 1].c : NaN, dec, trend: 'range', side: null, score: 0, grade: '-', scalp: null, rsi: null, why: c.length ? 'Not enough candles' : 'No data', ok: false } as Hit;
        // 2. Fresh data: the newest candle must be recent. Friday's candles on a Saturday are not a market.
        const ms = marketState(c, gran, id, s.cat, now, isClosed(id));
        if (!ms.open) return closedHit(id, s.name, ms.reason, ms.reopens, c[c.length - 1].c);
        const floor = Math.max(SETUP_MIN, minProb);
        const a = engine ? analyzeAll(c, now, { sessions: ['forex', 'indices'].includes(s.cat), htf: h.length >= 40 ? h : undefined }) : null;
        const cb = full ? a?.combo : undefined;
        // 3. The entry gate: score, ICT/SMC location, 3+ methods agreeing, nothing against, timing, risk, news. It judges the combined setup, so it only runs when all five methods are ticked.
        const v = a && cb ? (() => { const q = qualify(a, { id, cat: s.cat, now, c, minProb, newsDanger: riskFor(id).level === 'danger' }); return { ...q.verdict, level: q.level, grade: q.grade, blocked: q.reasons }; })() : null;
        // Top-Down reads its own three timeframes (4H, 1H, 15m)
        let extra: MethodSetup[] = [], tdTrend: Hit['trend'] | undefined;
        if (sel.includes('topdown')) {
          const [c4, c1, c15] = await Promise.all(TD_TFS.map((g) => candlesOnce(id, g, TD_COUNT, false)));
          const td = topDownAnalyze(c4, c1, c15, now), x = topDownSetup(td, c15, floor);
          if (x) extra = [x];
          if (td.ok) tdTrend = td.h4.trend;
        }
        return {
          id, name: s.name, price: c[c.length - 1].c, dec, trend: a?.ict.trend ?? tdTrend ?? 'range', side: cb?.side ?? null, score: cb?.score ?? 0, grade: cb?.grade ?? '-',
          entry: cb?.entry, sl: cb?.sl, tps: cb ? [...cb.tps] : undefined, basis: cb?.basis, plan: cb ? { label: cb.plan.label, trigger: cb.plan.trigger, cancelIf: cb.plan.cancelIf } : undefined, htf: cb?.htf, zone: cb ? [cb.zoneBottom, cb.zoneTop] : undefined, checks: cb ? cb.checks.filter((x) => x.ok).slice(0, 5).map((x) => x.text) : undefined,
          scalp: null, // Scalping is not one of the scanner methods
          rsi: a && isFinite(a.scalp.rsi7) ? a.scalp.rsi7 : null,
          why: full ? (a?.why ?? (cb && cb.score < floor ? `Best setup (${cb.basis}) scores ${cb.score}%, under ${floor}%.` : undefined)) : 'No setup from the ticked methods on this pair right now.',
          ok: true, alert: v?.level ?? null, qgrade: v?.grade ?? null, agree: v?.agree, blocked: v?.blocked,
          setups: a ? methodSetups(a, c, floor, only, extra) : extra,
        } as Hit;
      }));
      if (my !== runId.current) return; // a newer scan started, drop this one
      out.push(...res);
      setHits([...out].sort((x, y) => (y.setups?.[0]?.score ?? 0) - (x.setups?.[0]?.score ?? 0) || y.score - x.score || Number(!!y.scalp) - Number(!!x.scalp)));
      setDone(Math.min(list.length, i + BATCH));
    }
    setAt(Date.now()); setBusy(false);
  };

  // A setup that already runs (or waits as an order) on this pair and side, that you already traded, or that you skipped is not shown again.
  const whyOf = (h: Hit) => [...(h.plan ? [h.plan.trigger, h.plan.cancelIf] : []), ...(h.checks ?? [])].filter(Boolean);
  const srcOf = (h: Hit) => `Scanner · ${h.basis ?? 'Combined'}`;
  const gone = (h: Hit) => !!h.side && h.entry !== undefined && h.sl !== undefined && (!!liveSame(signals, h.id, h.side) || !!setupHandled({ symId: h.id, source: srcOf(h), side: h.side, entry: h.entry, sl: h.sl }));
  const keyOf = (m: string) => `Scanner · ${m}`;
  const goneS = (h: Hit, x: MethodSetup) => !!liveSame(signals, h.id, x.side) || !!setupHandled({ symId: h.id, source: keyOf(x.method), side: x.side, entry: x.entry, sl: x.sl });
  const vis = (h: Hit) => (h.setups ?? []).filter((x) => !goneS(h, x));
  const floorP = Math.max(SETUP_MIN, minProb);
  const mute = muteKeys(signals);
  // The server runs the same scan every 90 s and sends a push when a setup reaches the chosen probability, even if the app is closed.
  useEffect(() => {
    if (!cfg) return;
    // The server watches a FIXED list, not just the market tab that is open: your watch list first, then forex, crypto and Deriv. (It used to follow the open tab, so switching tabs changed what was scanned while the app was closed.)
    const seen = new Set<string>(), list: string[] = [];
    // Spike pairs go first: forex + 60 crypto pairs used to fill the list, so Boom / Crash fell past the cap and were never scanned while the app was closed.
    const spikes = SYMBOLS.filter((s) => s.cat === 'deriv' && isSpike(s.id)).map((s) => s.id);
    // The server gets the FULL list and scans every pair. The Boom / Crash switch is gone from the Analysis page; the server still never alerts AGAINST the spike (Boom = BUY, Crash = SELL).
    for (const id of [...spikes, ...ids('favs'), ...ids('forex'), ...ids('crypto'), ...ids('deriv')]) if (!seen.has(id)) { seen.add(id); list.push(id); }
    remote.setScan({ on: cfg.auto && cfg.alarm && full, watch: (cfg as any).watch !== false, digest: !!(cfg as any).digest, dayBreaks: cfg.auto && cfg.alarm && (cfg as any).dayBreaks !== false, news: cfg.auto && cfg.alarm && (cfg as any).news !== false, minProb: cfg.minProb, tf: Number(tf), mute, items: list.slice(0, BG_MAX).map((id) => ({ id, name: symOf(id).name, sess: ['forex', 'indices'].includes(symOf(id).cat) })) });
  }, [cfg?.auto, cfg?.alarm, (cfg as any)?.watch, (cfg as any)?.digest, (cfg as any)?.dayBreaks, (cfg as any)?.news, cfg?.minProb, full, tf, db.favs.join(','), mute.join(',')]);
  // the ticked methods are remembered
  useEffect(() => {
    AsyncStorage.getItem('scan_methods').then((v) => {
      if (v) { const l = (JSON.parse(v) as string[]).filter((k): k is MKey => (ALL_M as string[]).includes(k)); setPicked(l); setSel(l); }
    }).catch(() => {}).finally(() => setMReady(true));
  }, []);
  const toggle = (k: MKey) => setPicked((o) => {
    const n = ALL_M.filter((x) => (x === k ? !o.includes(x) : o.includes(x)));
    AsyncStorage.setItem('scan_methods', JSON.stringify(n)).catch(() => {});
    return n;
  });
  useEffect(() => { if (picked.join() === selKey) return; const i = setTimeout(() => setSel(picked), 600); return () => clearTimeout(i); }, [picked.join()]);
  // opening the page or changing market / timeframe / ticked methods starts a fresh scan (an older one is dropped by runId)
  useEffect(() => { if (!active || !mReady) return; setHits([]); setAt(0); scan(); }, [active, mReady, group, tf, selKey]);
  useEffect(() => {
    if (!active || !auto) return;
    const i = setInterval(() => { if (!busyRef.current) scan(); }, AUTO_MS);
    return () => clearInterval(i);
  }, [active, auto, group, tf, selKey]);

  // When a scan finishes, EVERY A and A+ setup (all that passed the entry gate) goes to the Journal for Take / Skip. No limit on how many, and it does not
  // depend on the Journal's auto-log switch. A setup you skipped or already took is not added again (the store checks).
  useEffect(() => {
    if (!active || busy || !at) return;
    hits.filter((h) => h.alert && h.qgrade && h.side && h.entry !== undefined && h.sl !== undefined && h.tps?.length && !gone(h))
      .forEach((h) => logSetup({ symId: h.id, name: h.name, tf, dec: h.dec, side: h.side!, entry: h.entry!, sl: h.sl!, tps: [...h.tps!], score: h.score, grade: h.qgrade!, source: srcOf(h), why: whyOf(h), zone: h.zone }));
  }, [at, busy, active]);
  // Probability filter (Analysis page): setups scoring under the chosen level are hidden. Rows with no setup stay unless "Only show setups" is on.
  const liveHits = hits.filter((h) => !h.closed), closedHits = hits.filter((h) => h.closed);
  const weak = liveHits.filter((h) => !h.setups?.length && h.side && h.score < floorP && !gone(h)).length;
  const shown = liveHits.filter((h) => (h.setups?.length ? vis(h).length > 0 : only ? !!h.scalp : true));
  // Alarm: only for setups that passed the full entry gate (score 70%+, 3+ methods agree, nothing against, price in the zone or within 1 ATR).
  // A setup that is still far away, or that the methods do not confirm, is listed but never rings.
  useEffect(() => {
    if (!active || busy || !at || !cfg?.alarm) return;
    const strong = hits.filter((h) => h.alert && h.side && h.entry !== undefined && !gone(h));
    const key = strong.map((h) => `${h.id}:${h.side}:${h.alert}`).sort().join(',');
    if (!key || key === alerted.current) return;
    alerted.current = key;
    const now = strong.filter((h) => h.alert === 'entry').length, lead = now ? `${now} entry now` : `${strong.length} near entry`, gl = [...new Set(strong.map((h) => h.qgrade || 'A'))].sort().join('/'); // "A", "A+" or "A/A+"
    toast(`Scanner ${gl}: ${lead}: ${strong.slice(0, 3).map((h) => `${h.name} ${h.side!.toUpperCase()} ${h.qgrade || 'A'} ${h.score}%`).join(', ')}${strong.length > 3 ? '…' : ''}`, 'good', strong.length === 1 ? { type: 'setup', sym: strong[0].id } : true); // tap: the one pair, or the bell when there are several
    raiseAlarm({ id: `scan:${at}`, kind: 'setup', title: now ? `${now} ${gl} setup${now > 1 ? 's' : ''}: enter now` : `${strong.length} ${gl} setup${strong.length > 1 ? 's' : ''} near entry`, text: strong.slice(0, 4).map((h) => `${h.name} ${h.side!.toUpperCase()} ${h.qgrade || 'A'} ${h.score}% (${levelText(h.alert!).toLowerCase()})`).join(', '), items: strong.slice(0, 6).map((h) => ({ symId: h.id, name: h.name, side: h.side!, score: h.score, grade: h.grade, entry: h.entry!, dec: h.dec })) });
  }, [at, busy, active]);
  const nBuy = liveHits.filter((h) => vis(h)[0]?.side === 'buy').length, nSell = liveHits.filter((h) => vis(h)[0]?.side === 'sell').length;
  const tfLabel = TFS.find((x) => x.k === tf)?.label ?? tf;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const f = (h: Hit, n?: number) => (n === undefined || !isFinite(n) ? '-' : n.toFixed(h.dec));
  const sc = (n: number) => (n >= 70 ? th.buy : n >= 50 ? th.gold : th.sell);

  const body = (
      <View style={{ gap: 12 }}>
        <NewsBanner active={active} />

        <Card>
          {!groupProp && <><Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '800', letterSpacing: 1, marginBottom: 6 }}>MARKETS</Text>
          <TimeframeBar value={group} options={GROUPS} onChange={setGroup} /></>}
          <Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '800', letterSpacing: groupProp ? 1 : 1, marginTop: groupProp ? 0 : 10, marginBottom: 6 }}>TIMEFRAME</Text>
          <TimeframeBar value={tf} options={TFS} onChange={setTf} />
        </Card>

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '800', letterSpacing: 1 }}>METHODS TO SCAN · {picked.length}/{METHODS.length}</Text>
            <View style={{ flexDirection: 'row', gap: 14 }}>
              <Pressable onPress={() => { setPicked(ALL_M); AsyncStorage.setItem('scan_methods', JSON.stringify(ALL_M)).catch(() => {}); }} accessibilityRole="button" hitSlop={8}><Text style={{ color: th.accent, fontSize: 11.5, fontWeight: '800' }}>All</Text></Pressable>
              <Pressable onPress={() => { setPicked([]); AsyncStorage.setItem('scan_methods', '[]').catch(() => {}); }} accessibilityRole="button" hitSlop={8}><Text style={{ color: th.accent, fontSize: 11.5, fontWeight: '800' }}>None</Text></Pressable>
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {METHODS.map((m) => {
              const on = picked.includes(m.k);
              return (
                <Pressable key={m.k} onPress={() => toggle(m.k)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={m.label}
                  style={{ width: '48%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 8, borderWidth: on ? 1.5 : 1, borderColor: on ? th.accent : th.line, backgroundColor: on ? th.accent + '18' : th.bg }}>
                  <Icon name={on ? 'checkbox' : 'square-outline'} size={20} color={on ? th.accent : th.dim} />
                  <Text style={{ color: th.text, fontSize: 13, fontWeight: on ? '800' : '600', flexShrink: 1 }} numberOfLines={1}>{m.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {picked.includes('topdown') && <Dim>Top-Down always reads 4H, 1H and 15m, whatever timeframe is chosen above.</Dim>}
          {!full && picked.length > 0 && <Dim>The combined entry and its alarm need ICT, SMC, VSA, chart pattern and candlestick all ticked. With fewer, you get each ticked method's own setups and no alarm or push.</Dim>}
        </Card>

        <LinearGradient colors={[th.accent + '33', th.panel]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 8, borderWidth: 1, borderColor: th.accent + '55', padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: th.dim, fontWeight: '800', fontSize: 11, letterSpacing: 1.2 }}>{GROUPS.find((g) => g.k === group)?.label.toUpperCase()} · {tfLabel}</Text>
            {busy ? <Badge label={`SCANNING ${pct}%`} color={th.accent} /> : at ? <Badge label={`DONE ${localTime(at)}`} color={th.buy} /> : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            {[['BUY', nBuy, th.buy], ['SELL', nSell, th.sell], ['LIVE', liveHits.length, th.text]].map(([k, v, c]) => (
              <View key={String(k)} style={{ flex: 1, backgroundColor: th.bg, borderRadius: 8, borderWidth: 1, borderColor: th.line, padding: 10 }}>
                <Text style={{ color: th.dim, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 }}>{String(k)}</Text>
                <Text style={{ color: String(c), fontSize: 22, fontWeight: '900' }}>{String(v)}</Text>
              </View>
            ))}
          </View>
          {busy && <View style={{ height: 4, borderRadius: 2, backgroundColor: th.line, marginTop: 12, overflow: 'hidden' }}><View style={{ width: `${pct}%`, height: 4, backgroundColor: th.accent }} /></View>}
        </LinearGradient>

        <Btn label={busy ? `Scanning ${done}/${total}…` : picked.length ? 'Scan now' : 'Tick at least one method'} icon="radio" onPress={scan} busy={busy} disabled={!picked.length} />

        <Card style={{ paddingVertical: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
            <Body bold>Only show setups</Body>
            <Switch value={only} onValueChange={setOnly} trackColor={{ true: th.accent, false: th.line }} thumbColor="#FFFFFF" />
          </View>
          {!cfg && (          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
            <View style={{ flex: 1 }}><Body bold>Auto re-scan every 90 s</Body><Dim>Runs while this page is open</Dim></View>
            <Switch value={auto} onValueChange={setAuto} trackColor={{ true: th.accent, false: th.line }} thumbColor="#FFFFFF" />
          </View>)}
        </Card>

        {!busy && at > 0 && closedHits.length > 0 && (
          <Card style={{ borderColor: th.gold + '66' }}>
            <Body bold color={th.gold}>{closedHits.length === hits.length ? 'Market closed' : `${closedHits.length} market${closedHits.length > 1 ? 's' : ''} closed`}</Body>
            <Dim>{closedHits[0].why}</Dim>
            <Dim>{closedHits.slice(0, 8).map((h) => h.name).join(', ')}{closedHits.length > 8 ? '…' : ''}</Dim>
            {closedHits.length === hits.length && <Dim>Crypto and Synthetic indices trade 24/7. Switch the market above to scan them.</Dim>}
          </Card>
        )}

        {shown.map((h) => {
          const list = vis(h), top = list[0];
          const bias = top?.side ?? (h.trend === 'bullish' ? 'buy' : h.trend === 'bearish' ? 'sell' : null);
          const bc = bias === 'buy' ? th.buy : bias === 'sell' ? th.sell : th.gold;
          const nr = riskFor(h.id), isOpen = open === h.id, hasNews = currenciesOf(h.id).length > 0 && nr.level !== 'clear';
          return (
            <Pressable key={h.id} onPress={() => setOpen(isOpen ? '' : h.id)}>
              <Card style={{ padding: 12, borderColor: top ? bc + '88' : th.line }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: bc + '22', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={bias === 'buy' ? 'trending-up' : bias === 'sell' ? 'trending-down' : 'remove'} size={22} color={bc} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ color: th.text, fontWeight: '800', fontSize: 15 }} numberOfLines={1}>{h.name}</Text>
                      {hasNews && <Icon name="warning" size={14} color={nr.level === 'danger' ? th.sell : th.gold} />}
                    </View>
                    <Text style={{ color: th.dim, fontSize: 11.5 }} numberOfLines={1}>
                      {h.ok ? `${isFinite(h.price) ? h.price.toFixed(h.dec) : '-'} · ${h.trend === 'range' ? 'Sideways' : h.trend === 'bullish' ? 'Bullish' : 'Bearish'}${h.rsi !== null ? ` · RSI7 ${h.rsi.toFixed(0)}` : ''}` : h.why}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 3 }}>
                    {top ? <Text style={{ color: bc, fontWeight: '900', fontSize: 13 }}>{top.side === 'buy' ? 'BUY' : 'SELL'} · {top.grade}</Text> : <Text style={{ color: th.dim, fontWeight: '800', fontSize: 12 }}>{h.ok ? 'WAIT' : '-'}</Text>}
                    {top ? <Text style={{ color: sc(top.score), fontWeight: '800', fontSize: 11.5 }}>{top.score}/100</Text> : null}
                    {top ? <Text style={{ color: h.alert === 'entry' ? th.buy : h.alert === 'near' ? th.gold : th.dim, fontWeight: '900', fontSize: 10, letterSpacing: 0.6 }}>{h.alert ? levelText(h.alert).toUpperCase() : (top.method + (top.also.length ? ` +${top.also.length}` : '')).toUpperCase()}</Text> : null}
                    {!top && h.scalp && <Text style={{ color: th.gold, fontWeight: '800', fontSize: 10.5 }}>⚡ SCALP {h.scalp.toUpperCase()}</Text>}
                  </View>
                </View>

                {isOpen && h.ok && (
                  <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderColor: th.line }}>
                    {hasNews && nr.event && <Body color={nr.level === 'danger' ? th.sell : th.gold}>News: {nr.event.cur} {nr.event.title} {fmtIn(nr.mins)}. {nr.level === 'danger' ? 'Avoid new trades until it passes.' : 'Plan around it.'}</Body>}
                    {list.length ? (
                      <>
                        {h.side ? (
                          <View style={{ marginBottom: 4 }}>
                            <Dim>{`Combined read: ${h.agree?.length ?? 0}/5 methods agree${h.agree?.length ? ` (${h.agree.join(', ')})` : ''}${h.htf === 'with' ? ' · with the higher timeframe' : h.htf === 'against' ? ' · AGAINST the higher timeframe' : ''}`}</Dim>
                            {h.alert ? <Body color={th.buy}>{h.alert === 'entry' ? 'Alert: entry now. Passed every entry check.' : 'Alert: near the entry. Passed every entry check, wait for the reaction.'}</Body>
                              : h.blocked?.length ? <Dim>{`No alert (the combined setup did not pass every check): ${h.blocked.join(' ')}`}</Dim> : null}
                          </View>
                        ) : null}
                        {list.map((x, n) => {
                          const xc = x.side === 'buy' ? th.buy : th.sell;
                          return (
                            <View key={x.method + x.entry} style={{ marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderColor: th.line }}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Body bold color={xc}>{x.method === 'Combined' ? 'Combined' : x.method}: {x.side === 'buy' ? 'BUY' : 'SELL'} · {x.grade}</Body>
                                <Text style={{ color: sc(x.score), fontWeight: '900', fontSize: 13 }}>{x.score}/100</Text>
                              </View>
                              <Dim>{x.label}{x.also.length ? ` · same trade also found by: ${x.also.join(', ')}` : ''}</Dim>
                              <View style={{ marginTop: 6 }}><Body color={th.accent}>{x.plan.label}</Body><Dim>{x.plan.trigger}</Dim><Dim>{x.plan.cancelIf}</Dim></View>
                              {x.why.slice(0, 4).map((w, k) => <Dim key={k}>• {w}</Dim>)}
                              <Row k="Entry" v={f(h, x.entry)} color={th.accent} />
                              <Row k="Stop loss" v={f(h, x.sl)} color={th.sell} />
                              {x.tps.map((pp, i) => <Row key={i} k={`TP${i + 1}`} v={f(h, pp)} color={th.buy} />)}
                              <View style={{ height: 10 }} />
                              <TakeSkip symId={h.id} name={h.name} tf={tf} dec={h.dec} setup={{ side: x.side, entry: x.entry, sl: x.sl, tps: [...x.tps], score: x.score, grade: x.grade, source: keyOf(x.method), why: [x.plan.trigger, x.plan.cancelIf, ...x.why], zone: x.zone }} />
                              {n === 0 && <>
                                <View style={{ height: 10 }} />
                                {onOpen && <><Btn ghost label="Open full analysis" icon="analytics-outline" onPress={() => onOpen(h.id, tf)} /><View style={{ height: 10 }} /></>}
                                <Btn ghost label="Send to Risk planner" icon="calculator-outline" onPress={() => { setPrefill({ entry: x.entry, sl: x.sl, tps: [...x.tps], symbol: h.name }); setTab(4); }} />
                              </>}
                            </View>
                          );
                        })}
                      </>
                    ) : <Body color={th.dim}>{h.why ?? (h.scalp ? 'Only a supply/demand reversal-candle scalp signal on this timeframe. Open Scalping for the full plan.' : 'No setup right now.')}</Body>}
                  </View>
                )}
              </Card>
            </Pressable>
          );
        })}
        {!busy && at > 0 && weak > 0 && <Dim>{`${weak} weaker setup${weak > 1 ? 's' : ''} hidden: under ${floorP}%.`}</Dim>}
        {!sel.length && <Card><Body color={th.dim}>No method is ticked. Tick one or more methods above and the scan starts.</Body></Card>}
        {!busy && at > 0 && shown.length === 0 && closedHits.length < hits.length && <Card><Body color={th.dim}>{only ? 'No setups on this list right now. Turn off "Only show setups" to see every market, or try another timeframe.' : 'Nothing to show.'}</Body></Card>}
        <Dim>The scanner checks every pair of the selected market (crypto: the 60 most traded). It skips closed markets and stale data, then runs only the methods you ticked above (ICT, SMC, chart pattern, Top-Down, VSA, candlestick) on each pair. Any ticked method that finds a setup scoring 70+ is listed with its entry, stop and targets, and the same trade found by several methods is merged. A notification only rings for the combined setup (all five engine methods ticked) when 3+ methods agree, none is against, and price is in the entry zone or within 1 ATR of it. Educational tool, not financial advice.</Dim>
      </View>
  );
  return embedded ? body : <Screen icon="radio" title={t('tabScanner')} subtitle={t('navDescScanner')} right={<Badge label="PRO" color={th.gold} />}>{body}</Screen>;
}
