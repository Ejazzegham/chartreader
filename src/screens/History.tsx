import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useApp } from '../store';
import { Screen, Card, Body, Btn, Badge, Icon, EmptyState, confirmAction } from '../ui';
import { TP_SPLIT } from '../gemini';
import { TradeHistoryView } from '../TradeHistory';

// Saved "Analysis of this chart" results (the market screen saves each one automatically).
function AnalysisList() {
  const { th, t, history, removeItem, clearHistory, settings, setTab } = useApp();
  const [open, setOpen] = useState<string | null>(null);
  const dec = (n: number) => (Math.abs(n) >= 100 ? 2 : Math.abs(n) >= 1 ? 4 : 5);
  const f = (n: number) => (isFinite(n) ? n.toFixed(dec(n)) : '-');
  const row = (k: string, v: string, c?: string) => <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, paddingVertical: 3 }}><Text style={{ flex: 1, minWidth: 0, color: th.dim, fontSize: 13 }}>{k}</Text><Text style={{ flexShrink: 1, maxWidth: '62%', textAlign: 'right', color: c ?? th.text, fontWeight: '800', fontSize: 13.5 }}>{v}</Text></View>;

  return (
    <>
      {history.length === 0 && <EmptyState icon="time-outline" title={settings.lang === 'en' ? 'No saved analyses yet' : t('tabHistory')} body="Open a pair in Markets and tap the analysis button. Every result is saved here." action={t('tabMarkets')} onAction={() => setTab(2)} />}
      <View style={{ gap: 12 }}>
        {history.map((i) => {
          const r = i.result, bc = r.bias === 'buy' ? th.buy : r.bias === 'sell' ? th.sell : th.gold, isOpen = open === i.id;
          return (
            <Card key={i.id} style={{ padding: 14 }}>
              <Pressable accessibilityRole="button" onPress={() => setOpen(isOpen ? null : i.id)} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Badge label={t(r.bias).toUpperCase()} color={bc} />
                  <Text style={{ color: th.text, fontWeight: '800', fontSize: 15, flex: 1 }} numberOfLines={1}>{i.symbol || t(r.trend.direction)}{i.tf ? ` · ${i.tf}` : ''}</Text>
                  <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={th.dim} />
                </View>
                <Text style={{ color: th.dim, fontSize: 12 }}>{new Date(i.date).toLocaleString(settings.lang)} · {t(r.trend.direction)}</Text>
                <Body>{r.trend.summary}</Body>
              </Pressable>
              {isOpen && (
                <View style={{ marginTop: 12, gap: 2 }}>
                  {r.bias !== 'wait' && row('Entry', f(r.entry), th.accent)}
                  {r.bias !== 'wait' && row('Stop loss', f(r.stopLoss), th.sell)}
                  {r.bias !== 'wait' && r.takeProfits.map((p, k) => row(`TP${k + 1} · close ${TP_SPLIT[k]}%`, f(p), th.buy))}
                  {!!r.riskReward && row('Reward : risk', r.riskReward)}
                  {!!r.support.length && row('Support', r.support.map(f).join(' · '), th.buy)}
                  {!!r.resistance.length && row('Resistance', r.resistance.map(f).join(' · '), th.sell)}
                  {!!r.reasoning && <View style={{ marginTop: 8 }}><Body>{r.reasoning}</Body></View>}
                  {r.warnings.map((w, k) => <Body key={k} color={th.gold}>• {w}</Body>)}
                </View>
              )}
              <Pressable accessibilityRole="button" onPress={() => confirmAction(t('delete') + '?', 'This analysis is removed from your history.', () => removeItem(i.id), t('delete'), t('cancel'))} hitSlop={8} style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
                <Icon name="trash-outline" size={14} color={th.sell} />
                <Text style={{ color: th.sell, fontSize: 13, fontWeight: '700' }}>{t('delete')}</Text>
              </Pressable>
            </Card>
          );
        })}
        {history.length > 0 && <Btn ghost danger icon="trash-outline" label={t('clearAll')} onPress={() => confirmAction(t('clearAll') + '?', 'All saved analyses are removed from this phone.', clearHistory, t('clearAll'), t('cancel'))} />}
      </View>
    </>
  );
}

// One History page: closed trades and saved chart analyses, switched with the tabs at the top.
export default function History() {
  const { th, t, history, journal, settings } = useApp();
  const [view, setView] = useState<'trades' | 'analyses'>('trades');
  const en = settings.lang === 'en';
  const seg = (k: 'trades' | 'analyses', label: string, n: number, icon: string) => {
    const on = view === k;
    return (
      <Pressable key={k} onPress={() => setView(k)} accessibilityRole="button" accessibilityState={{ selected: on }}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: 6, borderWidth: 1, borderColor: on ? th.accent : th.line, backgroundColor: on ? th.accent : th.panel }}>
        <Icon name={icon} size={17} color={on ? th.onAccent : th.dim} />
        <Text style={{ color: on ? th.onAccent : th.text, fontWeight: '800', fontSize: 14 }}>{label}</Text>
        <Text style={{ color: on ? th.onAccent : th.dim, fontWeight: '800', fontSize: 12.5 }}>{n}</Text>
      </Pressable>
    );
  };
  return (
    <Screen fx="history" icon="time" tag="Chart Reader" title={en ? 'History' : t('tabHistory')}
      subtitle={en ? `Everything you have done, in one place. Trades shows every closed trade with totals, filters, daily results and CSV export. Analyses shows each chart analysis you ran, with its bias, entry, stop loss and targets · ${journal.length} closed ${journal.length === 1 ? 'trade' : 'trades'} · ${history.length} saved ${history.length === 1 ? 'analysis' : 'analyses'}.` : `${journal.length} ${t('closedTradesWord')} · ${history.length}`}
      features={en ? [{ icon: 'receipt-outline', title: 'Trade history', sub: 'Closed trades, filters and CSV export' }, { icon: 'analytics-outline', title: 'Analysis history', sub: 'Every saved setup with its levels' }, { icon: 'git-compare-outline', title: 'Review and compare', sub: 'See how past setups played out' }] : undefined}>
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {seg('trades', en ? 'Trades' : t('tabTradeHistory'), journal.length, 'receipt-outline')}
          {seg('analyses', en ? 'Analyses' : t('statAnalyses'), history.length, 'analytics-outline')}
        </View>
        {view === 'trades' ? <TradeHistoryView embedded /> : <AnalysisList />}
      </View>
    </Screen>
  );
}
