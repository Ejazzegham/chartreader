import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, StatusBar } from 'react-native';
import { shareText } from './dialog';
import Modal from './Modal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp, Trade } from './store';
import { Icon, confirmAction } from './ui';
import { fmtR, money } from './trades';
import { fmtLots } from './lots';

// Trade history: every closed trade in one place, with totals, filters, search, a per-day total and a CSV export.
// Trades come from the Journal (closed by the tracker or added by hand), so nothing is stored twice.
type Period = 'all' | 'today' | '7' | '30';
type Result = 'all' | 'win' | 'loss';
type Side = 'all' | 'buy' | 'sell';

const DAY = 864e5;
const startOfDay = (d: number) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
const held = (a?: number, b?: number) => { if (!a || !b || b <= a) return ''; const m = Math.max(1, Math.round((b - a) / 60000)); return m < 60 ? `${m}m` : m < 1440 ? `${(m / 60).toFixed(1)}h` : `${(m / 1440).toFixed(1)}d`; };

export default function TradeHistory() {
  const { th, t, rtl, histOpen, setHistOpen, journal, removeTrade, setTab, settings } = useApp();
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<Period>('all');
  const [result, setResult] = useState<Result>('all');
  const [side, setSide] = useState<Side>('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => {
    const now = Date.now(), term = q.trim().toLowerCase();
    const from = period === 'today' ? startOfDay(now) : period === '7' ? now - 7 * DAY : period === '30' ? now - 30 * DAY : 0;
    return [...journal]
      .filter((j) => j.date >= from && (result === 'all' || (result === 'win' ? j.pnl > 0 : j.pnl < 0)) && (side === 'all' || j.side === side) && (!term || j.symbol.toLowerCase().includes(term)))
      .sort((a, b) => b.date - a.date);
  }, [journal, period, result, side, q]);

  if (!histOpen) return null;

  const n = rows.length, wins = rows.filter((j) => j.pnl > 0).length, net = rows.reduce((a, j) => a + j.pnl, 0);
  const gw = rows.filter((j) => j.pnl > 0).reduce((a, j) => a + j.pnl, 0), gl = Math.abs(rows.filter((j) => j.pnl < 0).reduce((a, j) => a + j.pnl, 0));
  const rs = rows.filter((j) => j.r !== undefined), avgR = rs.length ? rs.reduce((a, j) => a + (j.r as number), 0) / rs.length : 0;
  const best = n ? Math.max(...rows.map((j) => j.pnl)) : 0, worst = n ? Math.min(...rows.map((j) => j.pnl)) : 0;
  const rate = n ? Math.round((wins / n) * 100) : 0, pf = gl ? gw / gl : gw ? Infinity : 0;
  const col = (v: number) => (v > 0 ? th.buy : v < 0 ? th.sell : th.dim);

  // group by calendar day (newest first)
  const days: { key: string; label: string; total: number; items: Trade[] }[] = [];
  rows.forEach((j) => {
    const k = String(startOfDay(j.date));
    let g = days[days.length - 1];
    if (!g || g.key !== k) { g = { key: k, label: new Date(j.date).toLocaleDateString(settings.lang, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }), total: 0, items: [] }; days.push(g); }
    g.items.push(j); g.total += j.pnl;
  });

  const why = (j: Trade) => t(j.why === 'tp' ? 'thWhyTp' : j.why === 'sl' ? 'thWhySl' : j.why === 'be' ? 'thWhyBe' : j.why === 'manual' ? 'thWhyManual' : 'thWhyEntry');

  const exportCsv = () => {
    const head = 'date,symbol,side,method,grade,entry,exit,lots,R,pnl,result,tag,note';
    const body = [...rows].sort((a, b) => a.date - b.date).map((j) => [new Date(j.date).toISOString(), j.symbol, j.side, j.source ?? 'Manual', j.grade ?? '', j.entry, j.exit, j.lots ?? '', j.r?.toFixed(2) ?? '', j.pnl.toFixed(2), j.why ?? '', j.tag ?? '', `"${(j.note ?? '').replace(/"/g, "'")}"`].join(','));
    shareText([head, ...body].join('\n'), t('tabTradeHistory'));
  };

  const chip = (label: string, on: boolean, press: () => void, c?: string) => {
    const cc = c ?? th.accent;
    return (
      <Pressable key={label} onPress={press} accessibilityRole="button" accessibilityState={{ selected: on }}
        style={{ paddingHorizontal: 12, height: 34, borderRadius: 8, justifyContent: 'center', borderWidth: 1, borderColor: on ? cc : th.line, backgroundColor: on ? cc : th.panel }}>
        <Text style={{ color: on ? th.onAccent : th.dim, fontSize: 12.5, fontWeight: '800' }}>{label}</Text>
      </Pressable>
    );
  };

  const stat = (label: string, value: string, c: string) => (
    <View key={label} style={{ flexBasis: '31%', flexGrow: 1, backgroundColor: th.panel, borderWidth: 1, borderColor: th.line, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12 }}>
      <Text style={{ color: th.dim, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 }} numberOfLines={1}>{label.toUpperCase()}</Text>
      <Text style={{ color: c, fontSize: 17, fontWeight: '900', marginTop: 4 }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );

  const close = () => setHistOpen(false);

  return (
    <Modal animationType="slide" onRequestClose={close} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: th.bg, direction: rtl ? 'rtl' : 'ltr' }}>
        {/* header */}
        <View style={{ paddingTop: Math.max(insets.top, StatusBar.currentHeight ?? 0, 24) + 14, paddingBottom: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: th.line, backgroundColor: th.panel, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable onPress={close} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('thClose')} style={{ width: 38, height: 38, borderRadius: 8, borderWidth: 1, borderColor: th.line, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={rtl ? 'arrow-forward' : 'arrow-back'} size={20} color={th.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={{ color: th.text, fontSize: 18, fontWeight: '900' }} numberOfLines={1}>{t('tabTradeHistory')}</Text>
            <Text style={{ color: th.dim, fontSize: 11.5 }} numberOfLines={1}>{journal.length} {t('closedTradesWord')}</Text>
          </View>
          {journal.length > 0 && (
            <Pressable onPress={exportCsv} hitSlop={6} accessibilityRole="button" accessibilityLabel={t('thExport')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: th.accent + '88', backgroundColor: th.accent + '1A' }}>
              <Icon name="share-outline" size={17} color={th.accent} />
              <Text style={{ color: th.accent, fontWeight: '800', fontSize: 12.5 }}>{t('thExport')}</Text>
            </Pressable>
          )}
        </View>

        <ScrollView contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: insets.bottom + 28 }} keyboardShouldPersistTaps="handled">
          {journal.length === 0 ? (
            <View style={{ alignItems: 'center', gap: 10, paddingVertical: 48, paddingHorizontal: 20 }}>
              <View style={{ width: 60, height: 60, borderRadius: 8, backgroundColor: th.accent + '1F', alignItems: 'center', justifyContent: 'center' }}><Icon name="receipt-outline" size={28} color={th.accent} /></View>
              <Text style={{ color: th.text, fontSize: 17, fontWeight: '900', textAlign: 'center' }}>{t('thEmpty')}</Text>
              <Text style={{ color: th.dim, fontSize: 13.5, lineHeight: 20, textAlign: 'center' }}>{t('thEmptyText')}</Text>
              <Pressable onPress={() => { close(); setTab(3); }} accessibilityRole="button" style={{ marginTop: 6, height: 44, paddingHorizontal: 20, borderRadius: 8, backgroundColor: th.accent, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
                <Icon name="book" size={17} color={th.onAccent} />
                <Text style={{ color: th.onAccent, fontWeight: '900' }}>{t('thOpenJournal')}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {/* totals for what is shown */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {stat(t('thNet'), n ? money(net) : '-', col(net))}
                {stat(t('thWin'), n ? `${rate}%` : '-', n && rate >= 50 ? th.buy : th.text)}
                {stat(t('thTrades'), String(n), th.text)}
                {stat(t('thBest'), n ? money(best) : '-', n ? col(best) : th.dim)}
                {stat(t('thWorst'), n ? money(worst) : '-', n ? col(worst) : th.dim)}
                {stat(t('thAvgR'), rs.length ? fmtR(avgR) : '-', rs.length ? col(avgR) : th.dim)}
              </View>
              {n > 0 && pf > 0 && <Text style={{ color: th.dim, fontSize: 12 }}>{t('thPF')}: <Text style={{ color: pf >= 1 ? th.buy : th.sell, fontWeight: '900' }}>{pf === Infinity ? '∞' : pf.toFixed(2)}</Text></Text>}

              {/* filters */}
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, borderRadius: 8, borderWidth: 1, borderColor: th.line, backgroundColor: th.panel, paddingHorizontal: 12 }}>
                  <Icon name="search" size={17} color={th.dim} />
                  <TextInput value={q} onChangeText={setQ} placeholder={t('thSearch')} placeholderTextColor={th.dim} autoCapitalize="none" autoCorrect={false}
                    style={{ flex: 1, color: th.text, fontSize: 14, paddingVertical: 0, textAlign: rtl ? 'right' : 'left' }} />
                  {!!q && <Pressable onPress={() => setQ('')} hitSlop={8} accessibilityLabel="Clear"><Icon name="close-circle" size={18} color={th.dim} /></Pressable>}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {chip(t('thAll'), period === 'all', () => setPeriod('all'))}
                  {chip(t('thToday'), period === 'today', () => setPeriod('today'))}
                  {chip(t('th7'), period === '7', () => setPeriod('7'))}
                  {chip(t('th30'), period === '30', () => setPeriod('30'))}
                </ScrollView>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {chip(t('thWins'), result === 'win', () => setResult(result === 'win' ? 'all' : 'win'), th.buy)}
                  {chip(t('thLosses'), result === 'loss', () => setResult(result === 'loss' ? 'all' : 'loss'), th.sell)}
                  {chip(t('buy'), side === 'buy', () => setSide(side === 'buy' ? 'all' : 'buy'), th.buy)}
                  {chip(t('sell'), side === 'sell', () => setSide(side === 'sell' ? 'all' : 'sell'), th.sell)}
                </ScrollView>
              </View>

              {n === 0 && <Text style={{ color: th.dim, textAlign: 'center', paddingVertical: 28, fontSize: 14 }}>{t('thNoMatch')}</Text>}

              {/* trades grouped by day */}
              {days.map((g) => (
                <View key={g.key} style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                    <Text style={{ color: th.dim, fontSize: 11.5, fontWeight: '800', letterSpacing: 0.6 }}>{g.label.toUpperCase()}</Text>
                    <Text style={{ color: col(g.total), fontSize: 12.5, fontWeight: '900' }}>{money(g.total)}</Text>
                  </View>
                  {g.items.map((j) => {
                    const c = col(j.pnl), d = j.dec ?? (j.entry >= 100 ? 2 : 5), isOpen = open === j.id, hd = held(j.openedAt, j.date);
                    return (
                      <View key={j.id} style={{ backgroundColor: th.panel, borderWidth: 1, borderColor: th.line, borderRadius: 8, overflow: 'hidden' }}>
                        <Pressable onPress={() => setOpen(isOpen ? null : j.id)} accessibilityRole="button" accessibilityState={{ expanded: isOpen }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}>
                          <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: c }} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: th.text, fontWeight: '900', fontSize: 14.5 }} numberOfLines={1}>{j.symbol} · <Text style={{ color: j.side === 'buy' ? th.buy : th.sell }}>{t(j.side).toUpperCase()}</Text></Text>
                            <Text style={{ color: th.dim, fontSize: 11.5, marginTop: 2 }} numberOfLines={1}>{why(j)}{j.source ? ` · ${j.source.split(' · ')[0]}` : ''} · {new Date(j.date).toLocaleTimeString(settings.lang, { hour: '2-digit', minute: '2-digit' })}</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ color: c, fontWeight: '900', fontSize: 15.5 }}>{money(j.pnl)}</Text>
                            {j.r !== undefined && <Text style={{ color: c, fontSize: 11.5, fontWeight: '800' }}>{fmtR(j.r)}</Text>}
                          </View>
                          <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={th.dim} />
                        </Pressable>
                        {isOpen && (
                          <View style={{ borderTopWidth: 1, borderTopColor: th.line, padding: 12, gap: 6 }}>
                            {([
                              [t('entry'), j.entry.toFixed(d)],
                              [t('exitP'), j.exit.toFixed(d)],
                              ...(j.lots ? [[t('sizeL'), `${fmtLots(j.lots)} lots`]] : []),
                              ...(j.grade ? [[t('thGrade'), j.grade]] : []),
                              ...(j.tf ? [[t('thTimeframe'), j.tf]] : []),
                              ...(hd ? [[t('thHeld'), hd]] : []),
                              ...(j.hits ? [[t('thTpHit'), String(j.hits)]] : []),
                              ...(j.tag ? [[t('thReview'), j.tag]] : []),
                            ] as string[][]).map(([k, v]) => (
                              <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ color: th.dim, fontSize: 13 }}>{k}</Text>
                                <Text style={{ color: th.text, fontSize: 13.5, fontWeight: '800' }}>{v}</Text>
                              </View>
                            ))}
                            {!!j.note && <Text style={{ color: th.text, fontSize: 13, lineHeight: 19, marginTop: 4 }}>{t('note')}: {j.note}</Text>}
                            <Pressable onPress={() => confirmAction(t('thDeleteQ'), t('thDeleteText'), () => removeTrade(j.id), t('delete'), t('cancel'))} hitSlop={8} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 6 }}>
                              <Icon name="trash-outline" size={14} color={th.sell} />
                              <Text style={{ color: th.sell, fontSize: 12.5, fontWeight: '800' }}>{t('thDelete')}</Text>
                            </Pressable>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
