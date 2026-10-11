import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import { shareText } from '../dialog';
import Modal from '../Modal';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp, Trade } from '../store';
import { Screen, Card, Field, Btn, ActionBtn, Segment, Dim, Body, Icon, Badge, SectionTitle, confirmAction } from '../ui';
import EquityCurve from '../Equity';
import GuardBanner from '../Guard';
import { useFeed, setWatch, quotes } from '../markets';
import { riskFor, fmtIn } from '../news';
import { TradeSheet } from '../TradeSheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { perPoint, suggestLots, parseLots, lotsError, fmtLots, lotSpec, lotInfo, lotMarket } from '../lots';
import { Signal, Desk, CloseSetup, PLAN_PRESETS, defaultPlanPct, planFromPct, guard, totalR, fmtR, money, riskMoney, todayPnl, dirOf, deskReady } from '../trades';

const num = (s: string) => parseFloat(s.replace(',', '.'));
const ago = (t: number) => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`; };
const dur = (a?: number, b?: number) => { if (!a || !b) return ''; const m = Math.max(1, Math.round((b - a) / 60000)); return m < 60 ? `${m}m` : m < 1440 ? `${(m / 60).toFixed(1)}h` : `${(m / 1440).toFixed(1)}d`; };
const tfName = (k: string) => { const n = Number(k); return !isFinite(n) || k.includes('/') ? k : n >= 86400 ? 'D1' : n >= 3600 ? `H${n / 3600}` : `M${n / 60}`; };
const TAGS = ['Followed plan', 'Early exit', 'Late entry', 'FOMO', 'Moved stop'];
const methodOf = (j: Trade) => (j.source ? j.source.split(' · ')[0] : 'Manual');
const gradeCol = (th: any, g: string) => (g === 'A+' || g === 'A' ? th.buy : g === 'B' ? th.gold : th.dim);

type TabKey = 'signals' | 'open' | 'closed' | 'insights';

// ---------------------------------------------------------------- small pieces
// Journal tab: icon over a short label, one accent for the open tab, a small count badge on the corner.
// `live` puts a green status dot next to the label when something is running.
function Pill({ label, icon, on, onPress, count, live }: { label: string; icon: string; on: boolean; onPress: () => void; count?: number; live?: boolean }) {
  const { th } = useApp();
  const fg = on ? th.onAccent : th.dim;
  const body = (
    <>
      <Icon name={icon} size={18} color={fg} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Text numberOfLines={1} style={{ color: fg, fontWeight: on ? '900' : '700', fontSize: 11.5, letterSpacing: 0.2 }}>{label}</Text>
        {live && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: on ? th.onAccent : th.buy }} />}
      </View>
    </>
  );
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: on }} style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.85 : 1 })}>
      {on ? (
        <LinearGradient colors={[th.accent, th.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 54, borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 3, shadowColor: th.accent, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 }}>{body}</LinearGradient>
      ) : (
        <View style={{ height: 54, borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 3 }}>{body}</View>
      )}
      {count !== undefined && count > 0 && (
        <View style={{ position: 'absolute', top: 4, right: 6, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? th.onAccent + '33' : th.accent }}>
          <Text style={{ color: th.onAccent, fontSize: 9.5, fontWeight: '900' }}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </Pressable>
  );
}

function Level({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  const { th } = useApp();
  return (
    <View style={{ flex: 1, minWidth: 0, backgroundColor: th.bg, borderRadius: 8, borderWidth: 1, borderColor: th.line, paddingVertical: 8, paddingHorizontal: 8 }}>
      <Text style={{ color: th.dim, fontSize: 9.5, fontWeight: '900', letterSpacing: 0.6 }}>{label}</Text>
      <Text style={{ color, fontWeight: '900', fontSize: 13, marginTop: 1 }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {!!sub && <Text style={{ color: th.dim, fontSize: 9.5 }} numberOfLines={1}>{sub}</Text>}
    </View>
  );
}

function Head({ s, right }: { s: Signal; right?: React.ReactNode }) {
  const { th } = useApp();
  const bc = s.side === 'buy' ? th.buy : th.sell;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: bc + '22', borderWidth: 1, borderColor: bc + '66', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={s.side === 'buy' ? 'trending-up' : 'trending-down'} size={20} color={bc} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: th.text, fontSize: 16, fontWeight: '900', flexShrink: 1 }} numberOfLines={1}>{s.name}</Text>
          <Text style={{ color: bc, fontWeight: '900', fontSize: 12 }}>{s.side.toUpperCase()}</Text>
        </View>
        <Text style={{ color: th.dim, fontSize: 11.5 }} numberOfLines={1}>{s.source} · {tfName(s.tf)} · {ago(s.date)}</Text>
      </View>
      {right}
    </View>
  );
}

// ---------------------------------------------------------------- take sheet
let lastClose = { auto: true, autoBe: false }; // the automatic-close and break-even choices are offered again next time
const lastLots: Record<string, string> = {}; // the size used last time is offered again, kept per market (a forex size means nothing on Deriv or crypto)

export function TakeSheet({ s, price, desk, equity, running, today, journalRows, onClose, onConfirm }: { s: Signal; price?: number; desk: Desk; equity: number; running: number; today: number; journalRows: { date: number; pnl: number }[]; onClose: () => void; onConfirm: (mode: 'market' | 'limit', lots: number, perPt: number, setup: CloseSetup) => void }) {
  const { th, rtl, t } = useApp();
  const insets = useSafeAreaInsets();
  const nTp = s.tps.length;
  const [pct, setPct] = useState<string[]>(() => defaultPlanPct(nTp).map(String));
  const [auto, setAuto] = useState(lastClose.auto), [autoBe, setAutoBe] = useState(lastClose.autoBe);
  const pctNum = pct.map((x) => (x.trim() === '' ? 0 : Number(x.replace(',', '.'))));
  const planSum = pctNum.reduce((a, b) => a + (isFinite(b) ? b : 0), 0), plan = planFromPct(pctNum);
  const setPctAt = (i: number, v: string) => setPct((l) => l.map((x, k) => (k === i ? v.replace(/[^0-9.,]/g, '').slice(0, 5) : x)));
  const [mode, setMode] = useState<'market' | 'limit'>('limit');
  const mk = lotMarket(s.symId), px0 = price ?? s.entry, spec = lotSpec(s.symId, px0);
  const [lotsTxt, setLotsTxt] = useState(lastLots[mk] && lotsError(parseLots(lastLots[mk]), spec) === '' ? lastLots[mk] : '');
  const f = (n: number) => n.toFixed(s.dec);
  const k = dirOf(s), rate = (id: string) => quotes[id]?.price;
  const fill = mode === 'market' && price ? price : s.entry, dist = Math.abs(fill - s.sl);
  const lots = parseLots(lotsTxt), lotsOk = lotsError(lots, spec) === '';
  const pp = perPoint(lotsOk ? lots : 0, s.symId, price ?? s.entry, rate), risk = pp * dist;
  const rr = s.tps.map((p) => (k * (p - fill)) / (dist || 1));
  const sugg = deskReady(desk) ? suggestLots(riskMoney(desk, equity), dist, s.symId, price ?? s.entry, rate) : 0;
  const minRisk = perPoint(spec.min, s.symId, price ?? s.entry, rate) * dist, minPct = desk.balance > 0 && equity > 0 ? (minRisk / equity) * 100 : 0;
  const nr = riskFor(s.symId);
  const g = guard(journalRows, desk, running), limitHit = desk.balance > 0 && desk.dailyLossPct > 0 && today <= -(desk.balance * desk.dailyLossPct) / 100, maxHit = desk.maxOpen > 0 && running >= desk.maxOpen;
  const mktBad = !price || k * (s.sl - price) >= 0 || k * (price - s.tps[0]) >= 0;
  const riskPct = desk.balance > 0 && equity > 0 ? (risk / equity) * 100 : 0;
  const warns: { t: string; c: string }[] = [];
  if (lotsOk && deskReady(desk) && riskPct > desk.riskPct * 1.001) warns.push({ t: `This size risks ${riskPct.toFixed(1)}% of your equity. Your rule is ${desk.riskPct}%.${sugg > 0 ? ` ${fmtLots(sugg)} lots would match it.` : ''}`, c: riskPct > desk.riskPct * 3 ? th.sell : th.gold });
  if (limitHit) warns.push({ t: `Daily loss limit (${desk.dailyLossPct}%) is used up. Your rules say stop for today.`, c: th.sell });
  if (maxHit) warns.push({ t: `You already have ${running} trades running (limit ${desk.maxOpen}).`, c: th.sell });
  if (g.until) warns.push({ t: `${g.title}. ${g.text}`, c: th.sell });
  else if (g.level === 'warn' && !maxHit) warns.push({ t: `${g.title}. ${g.text}`, c: th.gold });
  if (nr.level !== 'clear') warns.push({ t: `${nr.level === 'danger' ? 'High-impact news' : 'News soon'}: ${nr.event?.title ?? ''} ${nr.mins >= 0 ? 'in ' + fmtIn(nr.mins) : 'just released'}.`, c: nr.level === 'danger' ? th.sell : th.gold });
  if (s.armed) warns.push({ t: 'This setup is still waiting for its confirmation candle. A limit order at the entry is safer than market.', c: th.gold });
  if (s.grade === 'C') warns.push({ t: 'Grade C setup. Consider skipping or using a smaller size.', c: th.gold });
  const row = (a: string, b: string, c?: string, key?: string) => <View key={key ?? a} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}><Text style={{ color: th.dim, fontSize: 13 }}>{a}</Text><Text style={{ color: c ?? th.text, fontWeight: '800', fontSize: 13.5 }}>{b}</Text></View>;
  const chips = [...(sugg > 0 ? [sugg] : []), ...spec.chips].filter((v, i, a) => a.indexOf(v) === i).slice(0, 5);
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#000A', direction: rtl ? 'rtl' : 'ltr' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={{ backgroundColor: th.solid, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderWidth: 1, borderColor: th.line, padding: 18, paddingBottom: Math.max(insets.bottom, 12) + 16, maxHeight: '92%' }}>
          <View style={{ alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: th.line, marginBottom: 14 }} />
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12 }}>
            <Head s={s} />
            <Segment value={mode} onChange={(m) => setMode(m as any)} options={[{ k: 'limit', label: 'Limit at entry' }, { k: 'market', label: 'Market now' }]} />
            {mode === 'market' && mktBad && <Text style={{ color: th.gold, fontSize: 12.5, lineHeight: 18 }}>{!price ? 'No live price yet for this pair.' : 'Price is outside the plan (through the stop or past TP1). Use a limit order.'}</Text>}

            {/* ---------- execution amount ---------- */}
            <View style={{ gap: 8 }}>
              <Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '900', letterSpacing: 0.8 }}>HOW MUCH DO YOU WANT TO TRADE? ({spec.label.toUpperCase()} LOTS)</Text>
              <TextInput value={lotsTxt} onChangeText={(v) => { setLotsTxt(v); }} placeholder={`Lots, e.g. ${fmtLots(spec.chips[1] ?? spec.min)}`} placeholderTextColor={th.dim} keyboardType="decimal-pad" autoFocus={!lastLots[mk]}
                style={{ height: 54, backgroundColor: th.bg, borderColor: lotsTxt && !lotsOk ? th.sell : th.accent, borderWidth: 1.5, borderRadius: 8, color: th.text, paddingHorizontal: 14, fontSize: 22, fontWeight: '900' }} />
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {chips.map((v) => (
                  <Pressable key={v} onPress={() => setLotsTxt(String(v))} style={{ paddingHorizontal: 12, height: 32, borderRadius: 8, justifyContent: 'center', borderWidth: 1, borderColor: v === sugg ? th.buy : th.line, backgroundColor: v === sugg ? th.buy + '18' : th.bg }}>
                    <Text style={{ color: v === sugg ? th.buy : th.dim, fontWeight: '800', fontSize: 12 }}>{fmtLots(v)}{v === sugg ? `  · ${desk.riskPct}% risk` : ''}</Text>
                  </Pressable>
                ))}
              </View>
              {!!lotsTxt && !lotsOk && <Text style={{ color: th.sell, fontSize: 12.5 }}>{lotsError(lots, spec)}</Text>}
              <Text style={{ color: th.dim, fontSize: 11.5, lineHeight: 16 }}>{lotInfo(s.symId, px0, rate)}</Text>
              {deskReady(desk) && sugg === 0 && minPct > 0 && <Text style={{ color: th.gold, fontSize: 12, lineHeight: 17 }}>Even the minimum lot ({fmtLots(spec.min)}) risks ${minRisk.toFixed(2)} ({minPct.toFixed(1)}% of equity) with this stop. Your rule is {desk.riskPct}%.</Text>}
            </View>

            {/* ---------- take profit plan: how much to close at TP1, TP2, TP3 ---------- */}
            <View style={{ gap: 10, backgroundColor: th.bg, borderRadius: 8, borderWidth: 1, borderColor: th.line, padding: 12 }}>
              <Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '900', letterSpacing: 0.8 }}>{t('cpTitle').toUpperCase()}</Text>
              <Text style={{ color: th.dim, fontSize: 12, lineHeight: 17 }}>{t('cpHint')}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {s.tps.map((p, i) => (
                  <View key={i} style={{ flex: 1, gap: 4 }}>
                    <Text style={{ color: th.buy, fontSize: 11.5, fontWeight: '900' }}>TP{i + 1}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', height: 46, borderRadius: 8, borderWidth: 1.5, borderColor: plan ? th.line : th.sell, backgroundColor: th.solid, paddingHorizontal: 10 }}>
                      <TextInput value={pct[i]} onChangeText={(v) => setPctAt(i, v)} keyboardType="decimal-pad" selectTextOnFocus accessibilityLabel={`TP${i + 1} %`} style={{ flex: 1, color: th.text, fontSize: 18, fontWeight: '900', paddingVertical: 0, textAlign: 'center' }} />
                      <Text style={{ color: th.dim, fontWeight: '800' }}>%</Text>
                    </View>
                    <Text style={{ color: th.dim, fontSize: 10.5, textAlign: 'center' }} numberOfLines={1}>{lotsOk && isFinite(pctNum[i]) ? `${fmtLots(lots * (pctNum[i] / 100))} lots` : f(p)}</Text>
                  </View>
                ))}
              </View>
              {nTp === 3 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  <Text style={{ color: th.dim, fontSize: 11.5, fontWeight: '800' }}>{t('cpPresets')}:</Text>
                  {PLAN_PRESETS.map((pr) => { const on = pr.every((v, i) => pctNum[i] === v); return (
                    <Pressable key={pr.join('/')} onPress={() => setPct(pr.map(String))} accessibilityRole="button" style={{ paddingHorizontal: 10, height: 30, borderRadius: 8, justifyContent: 'center', borderWidth: 1, borderColor: on ? th.accent : th.line, backgroundColor: on ? th.accent : th.solid }}>
                      <Text style={{ color: on ? th.onAccent : th.dim, fontSize: 12, fontWeight: '800' }}>{pr.join(' / ')}</Text>
                    </Pressable>
                  ); })}
                </View>
              )}
              <Text style={{ color: plan ? th.buy : th.sell, fontSize: 12.5, fontWeight: '800' }}>{t('cpTotal')}: {isFinite(planSum) ? Math.round(planSum * 100) / 100 : 0}%{plan ? '' : `  ·  ${t('cpNeed100')}`}</Text>
              {([[auto, setAuto, 'cpAuto', auto ? 'cpAutoOn' : 'cpAutoOff', 'flash-outline'], [autoBe, setAutoBe, 'cpBe', autoBe ? 'cpBeOn' : 'cpBeOff', 'shield-checkmark-outline']] as const).map(([on, set, title, sub, ic]) => (
                <Pressable key={title} onPress={() => (set as (v: boolean) => void)(!on)} accessibilityRole="switch" accessibilityState={{ checked: on }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
                  <Icon name={ic} size={20} color={on ? th.accent : th.dim} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: th.text, fontWeight: '800', fontSize: 14 }}>{t(title)}</Text>
                    <Text style={{ color: th.dim, fontSize: 11.5, lineHeight: 16, marginTop: 1 }}>{t(sub)}</Text>
                  </View>
                  <View style={{ width: 46, height: 26, borderRadius: 13, backgroundColor: on ? th.accent : th.line, padding: 3, alignItems: on ? 'flex-end' : 'flex-start' }}>
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: on ? th.onAccent : th.dim }} />
                  </View>
                </Pressable>
              ))}
            </View>

            <View style={{ backgroundColor: th.bg, borderRadius: 8, borderWidth: 1, borderColor: th.line, padding: 12 }}>
              {row(mode === 'market' ? 'Entry (live)' : 'Entry (limit)', f(fill), th.accent)}
              {row('Stop loss', f(s.sl), th.sell)}
              {row('Execution amount', lotsOk ? `${fmtLots(lots)} lots` : '-')}
              {row('Loss if the stop is hit', lotsOk ? `-$${risk.toFixed(2)}${riskPct ? `  (${riskPct.toFixed(1)}%)` : ''}` : '-', th.sell)}
              <View style={{ height: 1, backgroundColor: th.line, marginVertical: 6 }} />
              {s.tps.map((p, i) => row(`TP${i + 1}  (${rr[i].toFixed(1)}R)${plan ? `  ·  ${pctNum[i]}%` : ''}`, lotsOk ? `+$${(pp * Math.abs(p - fill)).toFixed(2)}   ${f(p)}` : f(p), th.buy, `tp${i}`))}
            </View>
            {warns.map((w, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 8, backgroundColor: w.c + '16', borderColor: w.c + '55', borderWidth: 1, borderRadius: 8, padding: 10 }}>
                <Icon name="warning-outline" size={16} color={w.c} />
                <Text style={{ flex: 1, color: th.text, fontSize: 12.5, lineHeight: 18 }}>{w.t}</Text>
              </View>
            ))}
            <Text style={{ color: th.dim, fontSize: 11.5, lineHeight: 17 }}>{t('cpNote')}</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Btn ghost label="Back" onPress={onClose} /></View>
              <View style={{ flex: 1.6 }}><Btn icon="checkmark-circle" label={limitHit || maxHit || !!g.until ? 'Take anyway' : 'Take trade'} disabled={!lotsOk || !plan || (mode === 'market' && mktBad)} onPress={() => { lastLots[mk] = String(lots); lastClose = { auto, autoBe }; onConfirm(mode, lots, pp, { plan: plan as number[], auto, autoBe }); }} /></View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------- cards
function SignalCard({ s, price, onTake, onCancel, onRisk }: { s: Signal; price?: number; onTake: () => void; onCancel: () => void; onRisk: () => void }) {
  const { th } = useApp();
  const f = (n: number) => n.toFixed(s.dec), k = dirOf(s), d = Math.abs(s.entry - s.sl) || 1;
  const away = price ? ((price - s.entry) / s.entry) * 100 : undefined, near = price !== undefined && Math.abs(price - s.entry) <= d * 0.25;
  return (
    <Card glow={near} style={{ gap: 12 }}>
      <Head s={s} right={
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <View style={{ backgroundColor: gradeCol(th, s.grade) + '22', borderColor: gradeCol(th, s.grade) + '77', borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ color: gradeCol(th, s.grade), fontWeight: '900', fontSize: 12 }}>{s.grade} · {s.score}</Text>
          </View>
          {s.armed && <Badge label="WAIT" color={th.gold} />}
        </View>
      } />
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <Level label="ENTRY" value={f(s.entry)} color={th.accent} />
        <Level label="STOP" value={f(s.sl)} color={th.sell} />
        {s.tps.map((p, i) => <Level key={i} label={`TP${i + 1}`} value={f(p)} color={th.buy} sub={`${((k * (p - s.entry)) / d).toFixed(1)}R`} />)}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: price ? th.buy : th.dim }} />
        <Text style={{ color: th.dim, fontSize: 12, flex: 1 }}>{price ? `Live ${f(price)} · ${Math.abs(away!).toFixed(2)}% ${away! > 0 ? 'above' : 'below'} entry${near ? ' · at the entry zone' : ''}` : 'Waiting for a live price'}</Text>
        <Pressable onPress={onRisk} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="calculator-outline" size={15} color={th.accent} /><Text style={{ color: th.accent, fontWeight: '800', fontSize: 12 }}>Calc</Text></Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable onPress={onCancel} style={({ pressed }) => ({ flex: 1, height: 48, borderRadius: 8, borderWidth: 1, borderColor: th.sell + '88', backgroundColor: th.sell + '14', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, opacity: pressed ? 0.8 : 1 })}>
          <Icon name="close" size={18} color={th.sell} /><Text style={{ color: th.sell, fontWeight: '900' }}>Cancel</Text>
        </Pressable>
        <Pressable onPress={onTake} style={({ pressed }) => ({ flex: 1.5, opacity: pressed ? 0.88 : 1 })}>
          <LinearGradient colors={[th.buy, th.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 48, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
            <Icon name="checkmark" size={19} color={th.dark ? '#06130E' : '#fff'} /><Text style={{ color: th.dark ? '#06130E' : '#fff', fontWeight: '900' }}>Take trade</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </Card>
  );
}

// progress bar from stop to the last take profit with the live price on it
function Ladder({ s, price }: { s: Signal; price?: number }) {
  const { th } = useApp();
  const fill = s.fill ?? s.entry, last = s.tps[s.tps.length - 1], lo = Math.min(s.sl, last), hi = Math.max(s.sl, last), rng = hi - lo || 1;
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - lo) / rng) * 100));
  const pos = (v: number) => `${pct(v)}%` as any;
  const mark = (v: number, c: string, key: string) => <View key={key} style={{ position: 'absolute', left: pos(v), top: 5, height: 24, width: 2, marginLeft: -1, backgroundColor: c }} />;
  return (
    <View style={{ height: 34, justifyContent: 'center', direction: 'ltr' }}>
      <View style={{ height: 10, borderRadius: 5, backgroundColor: th.line, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', left: pos(Math.min(fill, s.sl)), width: `${Math.abs(fill - s.sl) / rng * 100}%` as any, top: 0, bottom: 0, backgroundColor: th.sell + '55' }} />
        <View style={{ position: 'absolute', left: pos(Math.min(fill, last)), width: `${Math.abs(last - fill) / rng * 100}%` as any, top: 0, bottom: 0, backgroundColor: th.buy + '55' }} />
        {s.status === 'open' && s.stop === fill && <View style={{ position: 'absolute', left: pos(fill), width: 3, marginLeft: -1, top: 0, bottom: 0, backgroundColor: th.gold }} />}
      </View>
      {mark(s.sl, th.sell, 'sl')}
      {mark(fill, th.text, 'en')}
      {s.tps.map((p, i) => mark(p, s.hits > i ? th.buy : th.buy + '99', `tp${i}`))}
      {price !== undefined && <View style={{ position: 'absolute', left: pos(price), marginLeft: -7, width: 14, height: 14, borderRadius: 7, backgroundColor: th.accent, borderWidth: 2, borderColor: th.panel, top: 10 }} />}
    </View>
  );
}

function OpenCard({ s, price, onManage, onClose, onBE, onCancel }: { s: Signal; price?: number; onManage: () => void; onClose: () => void; onBE: () => void; onCancel: () => void }) {
  const { th, t } = useApp();
  const f = (n: number) => n.toFixed(s.dec), running = s.status === 'open';
  const r = running && price ? totalR(s, price) : s.banked, pnl = r * s.risk, c = r >= 0 ? th.buy : th.sell;
  return (
    <Card glow={running} style={{ gap: 12 }}>
      <Head s={s} right={<Badge label={running ? (s.tpAlert ? `TP${s.tpAlert} · DECIDE` : 'RUNNING') : 'PENDING'} color={running ? (s.tpAlert ? th.gold : th.buy) : th.gold} />} />
      {running && !!s.tpAlert && (
        <Pressable onPress={onManage} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: th.gold + '18', borderColor: th.gold + '88', borderWidth: 1, borderRadius: 8, padding: 10 }}>
          <Icon name="notifications" size={18} color={th.gold} />
          <Text style={{ flex: 1, color: th.text, fontSize: 12.5, lineHeight: 18, fontWeight: '700' }}>TP{s.tpAlert} was reached. The trade is still open. Tap to close all, close part, move the stop or hold.</Text>
        </Pressable>
      )}
      {running ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '900', letterSpacing: 0.8 }}>FLOATING RESULT</Text>
            <Text style={{ color: c, fontSize: 30, fontWeight: '900', letterSpacing: -0.5 }}>{money(pnl)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: c, fontSize: 20, fontWeight: '900' }}>{fmtR(r)}</Text>
            <Text style={{ color: th.dim, fontSize: 11.5 }}>{s.banked ? `${fmtR(s.banked)} banked` : 'nothing banked yet'}</Text>
          </View>
        </View>
      ) : (
        <Text style={{ color: th.dim, fontSize: 13, lineHeight: 19 }}>Limit order at {f(s.entry)}. {price ? `Live ${f(price)}.` : ''} It fills by itself when the price gets there and is cancelled if the stop is hit first.</Text>
      )}
      <Ladder s={s} price={price} />
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <Level label={running ? 'FILLED' : 'ENTRY'} value={f(s.fill ?? s.entry)} color={th.accent} />
        <Level label={running && s.stop === s.fill ? 'STOP · BE' : 'STOP'} value={f(running ? s.stop : s.sl)} color={running && s.stop === s.fill ? th.gold : th.sell} />
        {s.tps.map((p, i) => (
          <Level key={i} label={`TP${i + 1}${s.hits > i ? ' ✓' : ''}`} value={f(p)} color={s.hits > i ? th.buy : th.dim} />
        ))}
      </View>
      {!!s.plan && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: th.dim, fontSize: 11.5, fontWeight: '800' }}>{t('cpPlanLine')}:</Text>
          {s.plan.map((p, i) => <Text key={i} style={{ color: s.hits > i ? th.buy : th.text, fontSize: 11.5, fontWeight: '800' }}>TP{i + 1} {Math.round(p * 100)}%{s.hits > i ? ' ✓' : ''}</Text>)}
          {!!s.auto && <Badge label={t('cpAutoBadge')} color={th.accent} />}
          {!!s.autoBe && s.stop !== s.fill && <Badge label={t('cpBeBadge')} color={th.gold} />}
        </View>
      )}
      <Text style={{ color: th.dim, fontSize: 11.5 }}>{s.lots ? `${fmtLots(s.lots)} lots · ` : ''}Risk ${s.risk.toFixed(2)} · {running ? `opened ${ago(s.filledAt ?? s.date)}` : `placed ${ago(s.takenAt ?? s.date)}`}{running && s.done > 0 ? ` · ${Math.round(s.done * 100)}% closed` : ''}</Text>
      {running ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <ActionBtn label="Manage" icon="stats-chart" onPress={onManage} />
          <ActionBtn label={s.stop === s.fill ? t('cpBeDone') : t('cpBeBtn')} icon={s.stop === s.fill ? 'shield-checkmark' : 'shield-half-outline'} tone={s.stop === s.fill ? 'done' : 'warn'} disabled={s.stop === s.fill || !price} onPress={onBE} />
          <ActionBtn label={price ? 'Close all' : 'Waiting'} icon="close-circle-outline" tone="danger" disabled={!price} onPress={onClose} />
        </View>
      ) : <Btn ghost label="Cancel order" icon="close" onPress={onCancel} />}
    </Card>
  );
}

function ClosedCard({ j, onTag, onDelete }: { j: Trade; onTag: (t: string) => void; onDelete: () => void }) {
  const { th, updateTrade } = useApp();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(j.note);
  const win = j.pnl > 0, c = win ? th.buy : j.pnl < 0 ? th.sell : th.dim, d = j.dec ?? (j.entry >= 100 ? 2 : 5);
  const why = j.why === 'tp' ? 'Target' : j.why === 'sl' ? 'Stopped' : j.why === 'be' ? 'Break-even' : j.why === 'manual' ? 'Closed by hand' : 'Manual entry';
  return (
    <Card style={{ gap: 8, padding: 14 }}>
      <Pressable onPress={() => setOpen(!open)} style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: c }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: th.text, fontWeight: '900', fontSize: 15 }} numberOfLines={1}>{j.symbol} · <Text style={{ color: j.side === 'buy' ? th.buy : th.sell }}>{j.side.toUpperCase()}</Text></Text>
            <Text style={{ color: th.dim, fontSize: 11.5 }} numberOfLines={1}>{why}{j.source ? ` · ${j.source}` : ''} · {new Date(j.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}{dur(j.openedAt, j.date) ? ` · ${dur(j.openedAt, j.date)}` : ''}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: c, fontWeight: '900', fontSize: 16 }}>{money(j.pnl)}</Text>
            {j.r !== undefined && <Text style={{ color: c, fontSize: 12, fontWeight: '800' }}>{fmtR(j.r)}</Text>}
          </View>
        </View>
      </Pressable>
      {open && (
        <View style={{ gap: 10, borderTopWidth: 1, borderTopColor: th.line, paddingTop: 10 }}>
          <Dim>{j.lots ? `${fmtLots(j.lots)} lots · ` : ''}{j.entry.toFixed(d)} → {j.exit.toFixed(d)}{j.hits ? ` · ${j.hits} take profit${j.hits > 1 ? 's' : ''} hit` : ''}{j.mfe !== undefined ? ` · best ${fmtR(j.mfe)} / worst ${fmtR(j.mae ?? 0)}` : ''}</Dim>
          {j.r !== undefined && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {TAGS.map((tg) => { const on = j.tag === tg; return (
              <Pressable key={tg} onPress={() => onTag(on ? '' : tg)} style={{ paddingHorizontal: 10, height: 30, borderRadius: 8, justifyContent: 'center', borderWidth: 1, borderColor: on ? th.accent : th.line, backgroundColor: on ? th.accent : th.bg }}>
                <Text style={{ color: on ? th.onAccent : th.dim, fontSize: 11.5, fontWeight: '800' }}>{tg}</Text>
              </Pressable>
            ); })}
          </View>}
          <TextInput value={note} onChangeText={setNote} onEndEditing={() => updateTrade(j.id, { note: note.trim() })} placeholder="Add a note: what did you learn?" placeholderTextColor={th.dim} multiline
            style={{ minHeight: 44, backgroundColor: th.bg, borderColor: th.line, borderWidth: 1, borderRadius: 8, color: th.text, padding: 10, fontSize: 13.5 }} />
          <Pressable onPress={onDelete} style={{ alignSelf: 'flex-start' }}><Text style={{ color: th.sell, fontSize: 12.5, fontWeight: '800' }}>Delete this trade</Text></Pressable>
        </View>
      )}
    </Card>
  );
}

function Empty({ icon, title, text, children }: { icon: string; title: string; text: string; children?: React.ReactNode }) {
  const { th } = useApp();
  return (
    <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 28 }}>
      <View style={{ width: 56, height: 56, borderRadius: 8, backgroundColor: th.accent + '1F', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={26} color={th.accent} /></View>
      <Text style={{ color: th.text, fontSize: 16, fontWeight: '900' }}>{title}</Text>
      <Text style={{ color: th.dim, fontSize: 13, lineHeight: 19, textAlign: 'center' }}>{text}</Text>
      {children}
    </Card>
  );
}

// ---------------------------------------------------------------- screen
export default function Journal() {
  const { th, t, tab, journal, signals, desk, setDesk, takeSignal, cancelSignal, closeSignal, breakEven, clearSignals, updateTrade, removeTrade, addTrade, toast, setPrefill, setTab, setHistOpen } = useApp();
  const active = tab === 3;
  useFeed(active);
  const [view, setView] = useState<TabKey>('signals');
  const [filter, setFilter] = useState<'all' | 'buy' | 'sell'>('all');
  const [taking, setTaking] = useState<string | null>(null);
  const [managing, setManaging] = useState<string | null>(null);
  const [showSet, setShowSet] = useState(false);
  const [manual, setManual] = useState(false);
  const ids = useMemo(() => [...new Set(signals.map((x) => x.symId))].slice(0, 20), [signals]);
  useEffect(() => { setWatch('journal', active ? ids : []); return () => setWatch('journal', []); }, [active, ids.join(',')]);

  const sigs = signals.filter((x) => x.status === 'signal'), live = signals.filter((x) => x.status !== 'signal');
  const running = live.filter((x) => x.status === 'open');
  const px = (id: string) => quotes[id]?.price;
  const floating = running.reduce((a, x) => (px(x.symId) ? a + totalR(x, px(x.symId)!) * x.risk : a + x.banked * x.risk), 0);
  const closedPnl = journal.reduce((a, j) => a + j.pnl, 0), equity = desk.balance + closedPnl + floating;
  const ready = deskReady(desk), today = todayPnl(journal), limit = (desk.balance * desk.dailyLossPct) / 100, used = limit > 0 ? Math.max(0, Math.min(1, -today / limit)) : 0;
  const n = journal.length, wins = journal.filter((j) => j.pnl > 0).length, rate = n ? Math.round((wins / n) * 100) : 0;
  const shownSigs = sigs.filter((x) => filter === 'all' || x.side === filter);
  const takingSig = signals.find((x) => x.id === taking);

  const hero = (
    <LinearGradient colors={[th.accent + (th.dark ? '55' : '33'), th.panel]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 8, borderWidth: 1, borderColor: th.accent + '55', padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View>
          <Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '900', letterSpacing: 1 }}>{desk.balance > 0 ? 'PAPER EQUITY' : 'CLOSED + OPEN RESULT'}</Text>
          {desk.balance > 0 ? (
            <>
              <Text style={{ color: th.text, fontSize: 32, fontWeight: '900', letterSpacing: -0.8 }}>${equity.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</Text>
              <Text style={{ color: equity - desk.balance >= 0 ? th.buy : th.sell, fontWeight: '800', fontSize: 12.5 }}>{money(equity - desk.balance)} · {(((equity - desk.balance) / desk.balance) * 100).toFixed(2)}% since start</Text>
            </>
          ) : (
            <Text style={{ color: closedPnl + floating >= 0 ? th.buy : th.sell, fontSize: 32, fontWeight: '900', letterSpacing: -0.8 }}>{money(closedPnl + floating)}</Text>
          )}
        </View>
        <Pressable onPress={() => setShowSet(!showSet)} hitSlop={8} style={{ width: 40, height: 40, borderRadius: 8, borderWidth: 1, borderColor: th.line, backgroundColor: th.panel, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={showSet ? 'close' : 'options-outline'} size={19} color={th.accent} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {([['TODAY', money(today), today >= 0 ? th.buy : th.sell], ['WIN RATE', `${rate}%`, th.accent], ['RUNNING', desk.maxOpen > 0 ? `${running.length}/${desk.maxOpen}` : String(running.length), desk.maxOpen > 0 && running.length >= desk.maxOpen ? th.gold : th.text], ['TRADES', String(n), th.text]] as const).map(([k, v, c]) => (
          <View key={k} style={{ flex: 1, backgroundColor: th.bg + 'CC', borderRadius: 8, borderWidth: 1, borderColor: th.line, padding: 8 }}>
            <Text style={{ color: th.dim, fontSize: 9, fontWeight: '900', letterSpacing: 0.6 }}>{k}</Text>
            <Text style={{ color: c, fontWeight: '900', fontSize: 14 }} numberOfLines={1} adjustsFontSizeToFit>{v}</Text>
          </View>
        ))}
      </View>
      {limit > 0 ? (
      <View style={{ gap: 5 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: th.dim, fontSize: 11, fontWeight: '800' }}>Daily loss limit ({desk.dailyLossPct}%)</Text>
          <Text style={{ color: used >= 1 ? th.sell : th.dim, fontSize: 11, fontWeight: '800' }}>{used >= 1 ? 'LIMIT REACHED' : `${Math.round(used * 100)}% used`}</Text>
        </View>
        <View style={{ height: 7, borderRadius: 4, backgroundColor: th.line, overflow: 'hidden' }}>
          <View style={{ width: `${used * 100}%`, height: 7, backgroundColor: used >= 1 ? th.sell : used > 0.6 ? th.gold : th.buy }} />
        </View>
      </View>
      ) : (
        <Pressable onPress={() => setShowSet(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 8, borderWidth: 1, borderColor: th.accent + '66', backgroundColor: th.accent + '14', padding: 10 }}>
          <Icon name="options-outline" size={16} color={th.accent} />
          <Text style={{ flex: 1, color: th.text, fontSize: 12.5, lineHeight: 18 }}>{ready ? 'Optional: set a daily loss limit and a trade limit.' : 'Enter your account balance and risk % to size trades and track your equity.'}</Text>
          <Icon name="chevron-forward" size={16} color={th.dim} />
        </Pressable>
      )}
    </LinearGradient>
  );

  const settings = (
    <Card style={{ gap: 4 }}>
      <SectionTitle icon="options-outline">Trading account</SectionTitle>
      <View style={{ height: 8 }} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Field label="Starting balance ($)" defaultValue={desk.balance ? String(desk.balance) : ''} placeholder="Your balance" keyboardType="decimal-pad" onEndEditing={(e) => { const v = num(e.nativeEvent.text); setDesk({ balance: v > 0 ? v : 0 }); }} /></View>
        <View style={{ flex: 1 }}><Field label="Risk per trade (%)" defaultValue={desk.riskPct ? String(desk.riskPct) : ''} placeholder="e.g. 1" keyboardType="decimal-pad" onEndEditing={(e) => { const v = num(e.nativeEvent.text); setDesk({ riskPct: v > 0 && v <= 10 ? v : 0 }); }} /></View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Field label="Daily loss limit (%)" defaultValue={desk.dailyLossPct ? String(desk.dailyLossPct) : ''} placeholder="Optional" keyboardType="decimal-pad" onEndEditing={(e) => { const v = num(e.nativeEvent.text); setDesk({ dailyLossPct: v > 0 && v <= 20 ? v : 0 }); }} /></View>
        <View style={{ flex: 1 }}><Field label="Max trades at once" defaultValue={desk.maxOpen ? String(desk.maxOpen) : ''} placeholder="No limit" keyboardType="number-pad" onEndEditing={(e) => { const v = Math.round(num(e.nativeEvent.text)); setDesk({ maxOpen: v >= 1 && v <= 20 ? v : 0 }); }} /></View>
      </View>
      <Dim>Auto-log: analysis pages save their setups here</Dim>
      <Segment value={desk.autoLog ? 'on' : 'off'} onChange={(k) => setDesk({ autoLog: k === 'on' })} options={[{ k: 'on', label: 'On' }, { k: 'off', label: 'Off' }]} />
      <View style={{ height: 10 }} />
      <Dim>Only save setups with a score of at least</Dim>
      <Segment value={String(desk.minScore)} onChange={(k) => setDesk({ minScore: Number(k) })} options={[40, 50, 60, 70, 80].map((x) => ({ k: String(x), label: String(x) }))} />
    </Card>
  );

  // ----- insights
  const insights = () => {
    if (!n) return <Empty icon="analytics-outline" title="No closed trades yet" text="Take a signal and let it finish. Your stats, methods and calendar fill in here." />;
    const rs = journal.filter((j) => j.r !== undefined);
    const gw = journal.filter((j) => j.pnl > 0).reduce((a, j) => a + j.pnl, 0), gl = Math.abs(journal.filter((j) => j.pnl < 0).reduce((a, j) => a + j.pnl, 0));
    const pf = gl ? gw / gl : gw ? Infinity : 0, avgR = rs.length ? rs.reduce((a, j) => a + (j.r as number), 0) / rs.length : 0;
    const by = (key: (j: Trade) => string) => { const m: Record<string, { n: number; w: number; pnl: number }> = {}; journal.forEach((j) => { const e = (m[key(j)] ??= { n: 0, w: 0, pnl: 0 }); e.n++; e.pnl += j.pnl; if (j.pnl > 0) e.w++; }); return Object.entries(m).sort((a, b) => b[1].pnl - a[1].pnl); };
    const meth = by(methodOf), maxAbs = Math.max(1e-9, ...meth.map(([, v]) => Math.abs(v.pnl)));
    const tagged = rs.filter((j) => j.tag).length;
    const day = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const map: Record<string, number> = {}; journal.forEach((j) => { const k = day(new Date(j.date)); map[k] = (map[k] ?? 0) + j.pnl; });
    const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - 28);
    const cells = Array.from({ length: 35 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return { d, v: map[day(d)], future: d.getTime() > Date.now() }; });
    const mx = Math.max(1e-9, ...cells.map((c) => Math.abs(c.v ?? 0)));
    return (
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {([['Profit factor', pf === Infinity ? '∞' : pf.toFixed(2), pf >= 1.5 ? th.buy : pf >= 1 ? th.gold : th.sell], ['Avg R / trade', rs.length ? fmtR(avgR) : '-', avgR >= 0 ? th.buy : th.sell], ['Reviewed', rs.length ? `${Math.round((tagged / rs.length) * 100)}%` : '-', th.accent]] as const).map(([k, v, c]) => (
            <Card key={k} style={{ flex: 1, padding: 12 }}><Dim>{k}</Dim><Text style={{ color: c, fontWeight: '900', fontSize: 16 }} numberOfLines={1} adjustsFontSizeToFit>{v}</Text></Card>
          ))}
        </View>
        <EquityCurve />
        <Card>
          <SectionTitle icon="calendar-outline">Daily results (5 weeks)</SectionTitle>
          <View style={{ height: 10 }} />
          <View style={{ flexDirection: 'row', marginBottom: 4 }}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <Text key={i} style={{ flex: 1, textAlign: 'center', color: th.dim, fontSize: 10, fontWeight: '800' }}>{d}</Text>)}</View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', direction: 'ltr' }}>
            {cells.map((c, i) => {
              const col = c.v === undefined ? th.line.slice(0, 7) + '66' : (c.v >= 0 ? th.buy : th.sell) + Math.round(40 + (Math.abs(c.v) / mx) * 190).toString(16).padStart(2, '0');
              return (
                <View key={i} style={{ width: `${100 / 7}%`, padding: 2 }}>
                  <View style={{ height: 34, borderRadius: 8, backgroundColor: col, alignItems: 'center', justifyContent: 'center', opacity: c.future ? 0.35 : 1 }}>
                    <Text style={{ color: c.v === undefined ? th.dim : th.text, fontSize: 9.5, fontWeight: '800' }}>{c.d.getDate()}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </Card>
        <Card>
          <SectionTitle icon="git-branch-outline">Results by method</SectionTitle>
          <View style={{ height: 8 }} />
          {meth.map(([k, v]) => (
            <View key={k} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: th.text, fontWeight: '800', flexShrink: 1 }}>{k} <Text style={{ color: th.dim, fontWeight: '600', fontSize: 12 }}>· {v.n} trade{v.n > 1 ? 's' : ''} · {Math.round((v.w / v.n) * 100)}% wins</Text></Text>
                <Text style={{ color: v.pnl >= 0 ? th.buy : th.sell, fontWeight: '900' }}>{money(v.pnl)}</Text>
              </View>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: th.line, marginTop: 5, overflow: 'hidden' }}><View style={{ width: `${(Math.abs(v.pnl) / maxAbs) * 100}%`, height: 6, backgroundColor: v.pnl >= 0 ? th.buy : th.sell }} /></View>
            </View>
          ))}
        </Card>
        <Card>
          <SectionTitle icon="swap-vertical-outline">By pair</SectionTitle>
          <View style={{ height: 8 }} />
          {by((j) => j.symbol).slice(0, 8).map(([k, v]) => (
            <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
              <Body>{k} <Text style={{ color: th.dim, fontSize: 12 }}>· {v.n}</Text></Body>
              <Text style={{ color: v.pnl >= 0 ? th.buy : th.sell, fontWeight: '800' }}>{money(v.pnl)}</Text>
            </View>
          ))}
        </Card>
      </View>
    );
  };

  // ----- closed list + manual form + export
  const [sym, setSym] = useState(''), [side, setSide] = useState<'buy' | 'sell'>('buy'), [entry, setEntry] = useState(''), [exit, setExit] = useState(''), [size, setSize] = useState(''), [note, setNote] = useState(''), [err, setErr] = useState('');
  const addManual = () => {
    const e = num(entry), x = num(exit), s = num(size);
    if (!sym.trim() || ![e, x, s].every(isFinite)) { setErr(t('fillAll')); return; }
    setErr(''); addTrade({ symbol: sym.trim().toUpperCase(), side, entry: e, exit: x, size: s, pnl: (x - e) * s * (side === 'buy' ? 1 : -1), note: note.trim() });
    setEntry(''); setExit(''); setNote(''); setManual(false);
  };
  const exportCsv = () => {
    const head = 'date,symbol,side,method,grade,entry,exit,R,pnl,result,tag,note';
    const rows = [...journal].sort((a, b) => a.date - b.date).map((j) => [new Date(j.date).toISOString(), j.symbol, j.side, j.source ?? 'Manual', j.grade ?? '', j.entry, j.exit, j.r?.toFixed(2) ?? '', j.pnl.toFixed(2), j.why ?? '', j.tag ?? '', `"${(j.note ?? '').replace(/"/g, "'")}"`].join(','));
    shareText([head, ...rows].join('\n'), 'Trading journal');
  };

  return (
    <Screen icon="book" title={t('tabJournal')} subtitle="Setups from your analysis land here. Take or cancel them, the app tracks the rest.">
      <View style={{ gap: 12 }}>
        {hero}
        <GuardBanner />
        {showSet && settings}

        <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: th.panel, borderRadius: 8, borderWidth: 1, borderColor: th.line, padding: 4, gap: 4 }}>
          <Pill label="Signals" icon="radio-outline" on={view === 'signals'} onPress={() => setView('signals')} count={sigs.length} />
          <Pill label="Live" icon="pulse-outline" on={view === 'open'} onPress={() => setView('open')} count={live.length} live={running.length > 0} />
          <Pill label="Closed" icon="checkmark-done-outline" on={view === 'closed'} onPress={() => setView('closed')} />
          <Pill label="Insights" icon="analytics-outline" on={view === 'insights'} onPress={() => setView('insights')} />
        </View>

        {view === 'signals' && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {(['all', 'buy', 'sell'] as const).map((k) => {
                const on = filter === k, c = k === 'buy' ? th.buy : k === 'sell' ? th.sell : th.accent;
                return <Pressable key={k} onPress={() => setFilter(k)} style={{ paddingHorizontal: 14, height: 34, borderRadius: 8, justifyContent: 'center', borderWidth: 1, borderColor: on ? c : th.line, backgroundColor: on ? c + '22' : th.panel }}><Text style={{ color: on ? c : th.dim, fontWeight: '900', fontSize: 12 }}>{k === 'all' ? 'All' : k === 'buy' ? 'Buy' : 'Sell'}</Text></Pressable>;
              })}
              <View style={{ flex: 1 }} />
              {sigs.length > 0 && <Pressable onPress={() => confirmAction('Clear all setups?', 'Setups that are still waiting will be removed. Trades you already took are not touched.', clearSignals, 'Clear')} hitSlop={8}><Text style={{ color: th.sell, fontWeight: '800', fontSize: 12.5 }}>Clear all</Text></Pressable>}
            </View>
            {!desk.autoLog && <Card style={{ borderColor: th.gold }}><Body color={th.gold}>Auto-log is off. Turn it on with the settings button above to receive setups.</Body></Card>}
            {shownSigs.length === 0 && (
              <Empty icon="radio-outline" title="Waiting for setups" text={`Open Analysis (Scanner, Top-Down, ICT, SMC, VSA, candlesticks, scalping). Any setup scoring ${desk.minScore}+ is saved here with its entry, stop and targets. No typing needed.`}>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                  <View><Btn ghost label="Analysis" icon="analytics" onPress={() => setTab(1)} /></View>
                  <View><Btn ghost label="Scanner" icon="radio" onPress={() => setTab(12)} /></View>
                </View>
              </Empty>
            )}
            {shownSigs.map((x) => (
              <SignalCard key={x.id} s={x} price={px(x.symId)} onTake={() => setTaking(x.id)} onCancel={() => cancelSignal(x.id)}
                onRisk={() => { setPrefill({ entry: x.entry, sl: x.sl, tps: [...x.tps], symbol: x.name }); setTab(4); }} />
            ))}
          </>
        )}

        {view === 'open' && (
          <>
            {live.length === 0 && <Empty icon="pulse-outline" title="No live trades" text="When you take a signal it shows here with the live result, take-profit progress and a break-even stop." />}
            {live.map((x) => <OpenCard key={x.id} s={x} price={px(x.symId)} onManage={() => setManaging(x.id)} onClose={() => closeSignal(x.id, px(x.symId)!)} onBE={() => { const e = breakEven(x.id, px(x.symId)); if (e) toast(e, 'bad'); }} onCancel={() => cancelSignal(x.id)} />)}
          </>
        )}

        {view === 'closed' && (
          <>
            <Pressable onPress={() => setHistOpen(true)} accessibilityRole="button" accessibilityLabel={t('tabTradeHistory')} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: th.accent + '66', backgroundColor: pressed ? th.accent + '26' : th.accent + '14' })}>
              <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: th.accent, alignItems: 'center', justifyContent: 'center' }}><Icon name="receipt" size={19} color={th.onAccent} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: th.text, fontWeight: '900', fontSize: 14.5 }}>{t('tabTradeHistory')}</Text>
                <Text style={{ color: th.dim, fontSize: 11.5, marginTop: 1 }} numberOfLines={1}>{n} {t('closedTradesWord')} · {t('navDescTradeHistory')}</Text>
              </View>
              <Icon name="chevron-forward" size={18} color={th.accent} />
            </Pressable>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Btn ghost label="Add manual trade" icon="create-outline" onPress={() => setManual(!manual)} /></View>
              {n > 0 && <View style={{ flex: 1 }}><Btn ghost label="Export CSV" icon="share-outline" onPress={exportCsv} /></View>}
            </View>
            {manual && (
              <Card>
                <Text style={{ color: th.text, fontSize: 16, fontWeight: '800', marginBottom: 10 }}>{t('addTrade')}</Text>
                <Field label={t('symbol')} value={sym} onChangeText={setSym} autoCapitalize="characters" />
                <View style={{ marginBottom: 12 }}><Segment value={side} onChange={(k) => setSide(k as any)} options={[{ k: 'buy', label: t('buy') }, { k: 'sell', label: t('sell') }]} /></View>
                <Field label={t('entryP')} value={entry} onChangeText={setEntry} keyboardType="decimal-pad" />
                <Field label={t('exitP')} value={exit} onChangeText={setExit} keyboardType="decimal-pad" />
                <Field label={t('sizeL')} value={size} onChangeText={setSize} keyboardType="decimal-pad" />
                <Field label={t('note')} value={note} onChangeText={setNote} />
                {!!err && <Text style={{ color: th.sell, marginBottom: 8 }}>{err}</Text>}
                <Btn label={t('add')} onPress={addManual} />
              </Card>
            )}
            {n === 0 && !manual && <Empty icon="checkmark-done-outline" title="No closed trades yet" text="Finished trades are written here automatically with their result in R and money." />}
            {journal.map((j) => <ClosedCard key={j.id} j={j} onTag={(tg) => updateTrade(j.id, { tag: tg })} onDelete={() => confirmAction('Delete this trade?', 'It is removed from your journal and your performance numbers. This cannot be undone.', () => removeTrade(j.id))} />)}
          </>
        )}

        {view === 'insights' && insights()}
        <Dim>Paper trading on live prices. Results are a study tool, not financial advice.</Dim>
      </View>

      {takingSig && (
        <TakeSheet s={takingSig} price={px(takingSig.symId)} desk={desk} equity={desk.balance + closedPnl} running={live.length} today={today} journalRows={journal}
          onClose={() => setTaking(null)}
          onConfirm={(mode, lots, perPt, setup) => {
            const e = takeSignal(takingSig.id, mode, px(takingSig.symId), lots, perPt, setup);
            if (e) { toast(e, 'bad'); return; }
            setTaking(null); setView('open');
            toast(mode === 'market' ? `${takingSig.name} ${takingSig.side.toUpperCase()} opened at the live price.` : `${takingSig.name}: limit order placed at ${takingSig.entry.toFixed(takingSig.dec)}.`, 'good');
          }} />
      )}
      {signals.find((x) => x.id === managing && x.status === 'open') && <TradeSheet s={signals.find((x) => x.id === managing)!} price={px(signals.find((x) => x.id === managing)!.symId)} onClose={() => setManaging(null)} />}
    </Screen>
  );
}
