import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp, NewSignal } from './store';
import { Icon } from './ui';
import { Logged } from './signalLog';
import { isDuplicate, liveOpposite, liveSame, todayPnl } from './trades';
import { quotes } from './markets';
import { TakeSheet } from './screens/Journal';

// Shown under every setup: Take it (paper trade, opens the Take sheet) or Skip it (hidden for a few hours).
// A pair never gets BUY and SELL together: if the other side is already running or waiting, the bar says so instead of offering the trade.
export default function TakeSkip({ symId, name, tf, dec, setup }: { symId: string; name: string; tf: string; dec: number; setup?: Logged | null }) {
  const { th, signals, desk, journal, proposeSignal, skipSetup, unskipSetup, takeSignal, toast, setTab, setupHandled } = useApp();
  const [taking, setTaking] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(false);
  const key = setup ? `${symId}|${tf}|${setup.source}|${setup.side}|${setup.entry.toFixed(dec)}|${setup.sl.toFixed(dec)}` : '';
  useEffect(() => { setSkipped(false); }, [key]);
  if (!setup) return null;

  const n: NewSignal = { symId, name, tf, dec, side: setup.side, entry: setup.entry, sl: setup.sl, tps: [...setup.tps], score: setup.score, grade: setup.grade, source: setup.source, armed: setup.armed, why: setup.why, zone: setup.zone, level: setup.level };
  const mine = isDuplicate(signals, n);
  const opp = liveOpposite(signals, symId, setup.side);
  const takingSig = signals.find((x) => x.id === taking);
  const price = quotes[symId]?.price;
  const sideCol = setup.side === 'buy' ? th.buy : th.sell;
  const closedPnl = journal.reduce((a, j) => a + j.pnl, 0);
  const live = signals.filter((x) => x.status !== 'signal').length;

  const box = (c: string, icon: string, text: string, action?: { label: string; onPress: () => void }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c + '14', borderColor: c + '66', borderWidth: 1, borderRadius: 8, padding: 12 }}>
      <Icon name={icon} size={20} color={c} />
      <Text style={{ flex: 1, color: th.text, fontSize: 13, lineHeight: 18, fontWeight: '600' }}>{text}</Text>
      {action && <Pressable onPress={action.onPress} hitSlop={8}><Text style={{ color: c, fontWeight: '900', fontSize: 12.5 }}>{action.label}</Text></Pressable>}
    </View>
  );

  const run = mine && mine.status !== 'signal' ? mine : liveSame(signals, symId, setup.side);
  if (run) {
    return box(th.buy, 'checkmark-circle', run.status === 'open' ? `${name} ${setup.side.toUpperCase()} is already running. This setup is not shown again.` : `${name} ${setup.side.toUpperCase()} order is already waiting at the entry.`, { label: 'Journal', onPress: () => setTab(3) });
  }
  if (setupHandled(n) === 'taken') return box(th.dim, 'checkmark-done-outline', 'You already traded this setup. A new one will show when the market forms it.');
  if (opp) {
    return box(th.gold, 'warning-outline', `You already have a ${opp.side.toUpperCase()} ${opp.status === 'open' ? 'running' : 'order waiting'} on ${name}. This ${setup.side.toUpperCase()} is blocked until you close or cancel it.`, { label: 'Journal', onPress: () => setTab(3) });
  }
  if (skipped) {
    return box(th.dim, 'close-circle-outline', 'Skipped. It will not come back for 6 hours.', { label: 'Undo', onPress: () => { unskipSetup(n); setSkipped(false); } });
  }

  return (
    <>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Skip this trade" onPress={() => { skipSetup(n); setSkipped(true); }} style={({ pressed }) => ({ flex: 1, height: 50, borderRadius: 8, borderWidth: 1, borderColor: th.sell + '88', backgroundColor: th.sell + '14', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, opacity: pressed ? 0.8 : 1 })}>
          <Icon name="close" size={18} color={th.sell} /><Text style={{ color: th.sell, fontWeight: '900' }}>Skip</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Take this trade" onPress={() => { const r = proposeSignal(n); if (r.err || !r.id) { toast(r.err ?? 'Could not add this setup.', 'bad'); return; } setTaking(r.id); }} style={({ pressed }) => ({ flex: 1.6, opacity: pressed ? 0.88 : 1 })}>
          <LinearGradient colors={[sideCol, th.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 50, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
            <Icon name="checkmark" size={19} color={th.dark ? '#06130E' : '#fff'} /><Text style={{ color: th.dark ? '#06130E' : '#fff', fontWeight: '900' }}>Take {setup.side === 'buy' ? 'BUY' : 'SELL'}</Text>
          </LinearGradient>
        </Pressable>
      </View>
      {takingSig && takingSig.status === 'signal' && (
        <TakeSheet s={takingSig} price={price} desk={desk} equity={desk.balance + closedPnl} running={live} today={todayPnl(journal)} journalRows={journal}
          onClose={() => setTaking(null)}
          onConfirm={(mode, lots, perPt, closeSetup) => {
            const e = takeSignal(takingSig.id, mode, price, lots, perPt, closeSetup);
            if (e) { toast(e, 'bad'); return; }
            setTaking(null);
            toast(mode === 'market' ? `${name} ${setup.side.toUpperCase()} opened at the live price.` : `${name}: limit order placed at ${setup.entry.toFixed(dec)}.`, 'good');
          }} />
      )}
    </>
  );
}
