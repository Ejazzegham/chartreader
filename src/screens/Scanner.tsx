import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Switch } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../store';
import { Screen, Card, Dim, Body, Btn, Badge, Icon, TimeframeBar, Row } from '../ui';
import { analyzeAll } from '../refine';
import { priceDec, Candle, SYMBOLS, TFS, symOf, isBad, isClosed, useFeed, watchCandles } from '../markets';
import { useNews, riskFor, currenciesOf, fmtIn, localTime } from '../news';
import NewsBanner from '../NewsBanner';
import TakeSkip from '../TakeSkip';
import { BodyProps } from '../embed';
import { remote } from '../remote';
import { HTF_OF } from '../entry';
import { scheduleState, marketState } from '../session';
import { judge, levelText, AlertLevel } from '../verdict';
import { methodSetups, MethodSetup, SETUP_MIN } from '../methodSetups';
import { liveSame, muteKeys } from '../trades';

const TAB = 12;
const GROUPS = [{ k: 'favs', label: 'Watchlist' }, { k: 'forex', label: 'Forex' }, { k: 'crypto', label: 'Crypto' }, { k: 'deriv', label: 'Synthetic' }];
const CRYPTO_MAX = 60, BATCH = 6, TIMEOUT = 10000, AUTO_MS = 90000; // the whole market is scanned; crypto has hundreds of pairs, so the 60 most traded

type Hit = {
  id: string; name: string; price: number; dec: number; trend: 'bullish' | 'bearish' | 'range';
  side: 'buy' | 'sell' | null; score: number; grade: string; entry?: number; sl?: number; tps?: number[]; basis?: string;
  scalp: 'buy' | 'sell' | null; rsi: number | null; why?: string; ok: boolean; plan?: { label: string; trigger: string; cancelIf: string }; htf?: string; zone?: [number, number]; checks?: string[];
  setups?: MethodSetup[];                             // every method's own setup scoring 70+ (ICT, SMC, VSA, pattern, candle, scalp, combined), best first
  closed?: boolean;                                   // the market is shut or the feed is not live: nothing is analysed, nothing rings
  alert?: AlertLevel; agree?: string[]; blocked?: string[]; // result of the entry gate (src/verdict.ts)
};

const closedHit = (id: string, name: string, why: string, reopens?: string, price = NaN): Hit =>
  ({ id, name, price, dec: 5, trend: 'range', side: null, score: 0, grade: '-', scalp: null, rsi: null, ok: false, closed: true, why: `Market closed. ${why}${reopens ? ` Reopens ${reopens}.` : ''}` });

// Grab the first batch of candles for a symbol, then stop the subscription. Never rejects.
function candlesOnce(id: string, gran: number): Promise<Candle[]> {
  return new Promise((resolve) => {
    let finished = false, un: (() => void) | null = null, timer: any;
    const fin = (c: Candle[]) => {
      if (finished) return; finished = true; clearTimeout(timer);
      if (un) { try { un(); } catch {} }
      resolve(c);
    };
    timer = setTimeout(() => fin([]), TIMEOUT);
    un = watchCandles(id, gran, (c) => fin(c), () => fin([]), undefined, 150);
    if (finished) { try { un(); } catch {} }
  });
}

export default function Scanner({ embedded, on, onOpen, group: groupProp, cfg }: BodyProps = {}) {
  const { th, t, tab, setPrefill, setTab, logSignal, toast, raiseAlarm, signals, setupHandled } = useApp();
  const active = embedded ? !!on : tab === TAB;
  const { db } = useFeed(active);
  const { events } = useNews(active);
  const [groupLocal, setGroup] = useState('forex');
  const group = groupProp ?? groupLocal;
  const [tf, setTf] = useState('900');
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
    setBusy(true); setDone(0); setTotal(list.length); setOpen('');
    const out: Hit[] = [];
    for (let i = 0; i < list.length; i += BATCH) {
      const part = list.slice(i, i + BATCH);
      const res = await Promise.all(part.map(async (id) => {
        const s = symOf(id), now = new Date();
        // 1. The weekly schedule first: a closed market needs no download and no analysis.
        const sched = scheduleState(id, s.cat, now);
        if (!sched.open) return closedHit(id, s.name, sched.reason, sched.reopens);
        const hg = HTF_OF[gran];
        const [c, h] = await Promise.all([candlesOnce(id, gran), hg ? candlesOnce(id, hg) : Promise.resolve([] as Candle[])]);
        const dec = !c.length ? 5 : s.quote ? priceDec(c[c.length - 1].c) : c[c.length - 1].c >= 100 ? 2 : 5;
        if (c.length < 45) return { id, name: s.name, price: c.length ? c[c.length - 1].c : NaN, dec, trend: 'range', side: null, score: 0, grade: '-', scalp: null, rsi: null, why: c.length ? 'Not enough candles' : 'No data', ok: false } as Hit;
        // 2. Fresh data: the newest candle must be recent. Friday's candles on a Saturday are not a market.
        const ms = marketState(c, gran, id, s.cat, now, isClosed(id));
        if (!ms.open) return closedHit(id, s.name, ms.reason, ms.reopens, c[c.length - 1].c);
        const a = analyzeAll(c, now, { sessions: ['forex', 'indices'].includes(s.cat), htf: h.length >= 40 ? h : undefined });
        const cb = a.combo, floor = Math.max(SETUP_MIN, minProb);
        // 3. The entry gate: score, ICT/SMC location, 3+ methods agreeing, nothing against, timing, risk, news.
        const v = cb ? judge(a, { id, cat: s.cat, now, c, minProb, newsDanger: riskFor(id).level === 'danger' }) : null;
        return {
          id, name: s.name, price: c[c.length - 1].c, dec, trend: a.ict.trend, side: cb?.side ?? null, score: cb?.score ?? 0, grade: cb?.grade ?? '-',
          entry: cb?.entry, sl: cb?.sl, tps: cb ? [...cb.tps] : undefined, basis: cb?.basis, plan: cb ? { label: cb.plan.label, trigger: cb.plan.trigger, cancelIf: cb.plan.cancelIf } : undefined, htf: cb?.htf, zone: cb ? [cb.zoneBottom, cb.zoneTop] : undefined, checks: cb ? cb.checks.filter((x) => x.ok).slice(0, 5).map((x) => x.text) : undefined, scalp: a.scalp.setup?.side ?? null,
          rsi: isFinite(a.scalp.rsi7) ? a.scalp.rsi7 : null, why: a.why ?? (cb && cb.score < floor ? `Best setup (${cb.basis}) scores ${cb.score}%, under ${floor}%.` : undefined), ok: true, alert: v?.level ?? null, agree: v?.agree, blocked: v?.blocked,
          setups: methodSetups(a, c, floor),
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
    remote.setScan({ on: cfg.auto && cfg.alarm, minProb: cfg.minProb, tf: Number(tf), mute, items: ids(group).map((id) => ({ id, name: symOf(id).name, sess: ['forex', 'indices'].includes(symOf(id).cat) })) });
  }, [cfg?.auto, cfg?.alarm, cfg?.minProb, group, tf, db.favs.join(','), mute.join(',')]);
  // opening the page or changing market / timeframe starts a fresh scan (an older one is dropped by runId)
  useEffect(() => { if (!active) return; setHits([]); setAt(0); scan(); }, [active, group, tf]);
  useEffect(() => {
    if (!active || !auto) return;
    const i = setInterval(() => { if (!busyRef.current) scan(); }, AUTO_MS);
    return () => clearInterval(i);
  }, [active, auto, group, tf]);

  // when a scan finishes, the setups that passed the entry gate are saved in the Journal (the store drops weak and duplicate ones)
  useEffect(() => {
    if (!active || busy || !at) return;
    hits.filter((h) => h.alert && h.side && h.entry !== undefined && h.sl !== undefined && h.tps?.length && !gone(h)).slice(0, 5).forEach((h) => logSignal({ symId: h.id, name: h.name, tf, dec: h.dec, side: h.side!, entry: h.entry!, sl: h.sl!, tps: [...h.tps!], score: h.score, grade: h.grade, source: srcOf(h), why: whyOf(h), zone: h.zone }));
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
    const now = strong.filter((h) => h.alert === 'entry').length, lead = now ? `${now} entry now` : `${strong.length} near entry`;
    toast(`Scanner: ${lead}: ${strong.slice(0, 3).map((h) => `${h.name} ${h.side!.toUpperCase()} ${h.score}%`).join(', ')}${strong.length > 3 ? '…' : ''}`, 'good');
    raiseAlarm({ id: `scan:${at}`, kind: 'setup', title: now ? `${now} setup${now > 1 ? 's' : ''}: enter now` : `${strong.length} setup${strong.length > 1 ? 's' : ''} near entry`, text: strong.slice(0, 4).map((h) => `${h.name} ${h.side!.toUpperCase()} ${h.score}% (${levelText(h.alert!).toLowerCase()})`).join(', '), items: strong.slice(0, 6).map((h) => ({ symId: h.id, name: h.name, side: h.side!, score: h.score, grade: h.grade, entry: h.entry!, dec: h.dec })) });
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

        <Btn label={busy ? `Scanning ${done}/${total}…` : 'Scan now'} icon="radio" onPress={scan} busy={busy} />

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
                    ) : <Body color={th.dim}>{h.why ?? (h.scalp ? 'Only a scalp trigger on this timeframe. Open Scalping for the full plan.' : 'No setup right now.')}</Body>}
                  </View>
                )}
              </Card>
            </Pressable>
          );
        })}
        {!busy && at > 0 && weak > 0 && <Dim>{`${weak} weaker setup${weak > 1 ? 's' : ''} hidden: under ${floorP}%.`}</Dim>}
        {!busy && at > 0 && shown.length === 0 && closedHits.length < hits.length && <Card><Body color={th.dim}>{only ? 'No setups on this list right now. Turn off "Only show setups" to see every market, or try another timeframe.' : 'Nothing to show.'}</Body></Card>}
        <Dim>The scanner checks every pair of the selected market (crypto: the 60 most traded). It skips closed markets and stale data, then runs ICT, SMC, VSA, candlestick, chart pattern and scalping on each pair. Any method that finds a setup scoring 70+ is listed with its entry, stop and targets, and the same trade found by several methods is merged. A notification only rings for the combined setup when 3+ methods agree, none is against, and price is in the entry zone or within 1 ATR of it. Educational tool, not financial advice.</Dim>
      </View>
  );
  return embedded ? body : <Screen icon="radio" title={t('tabScanner')} subtitle={t('navDescScanner')} right={<Badge label="PRO" color={th.gold} />}>{body}</Screen>;
}
