import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import Modal from '../Modal';
import Svg, { Polyline } from 'react-native-svg';
import { useApp } from '../store';
import { Screen, Card, Body, Dim, Icon, Btn, Chip, SectionHeader } from '../ui';
import { useLayout } from '../win';
import { SYMBOLS, Sym, useFeed, chg, isBad, isClosed, toggleFav, flags, catalog, setWatch, runDiagnostics, symOf, Diag, bnState, loadCrypto } from '../markets';
import { QUOTES } from '../crypto';
import { SymbolSheet, Coin } from '../MarketWidgets';
import MarketsHome from '../MarketsHome';

const CATS: [string, string][] = [['fav', 'watchlist'], ['forex', 'catForex'], ['deriv', 'catDeriv'], ['crypto', 'catCrypto'], ['indices', 'catIndices']];
const PAGE = 60;

const Spark = ({ pts, color }: { pts: number[]; color: string }) => {
  if (pts.length < 2) return <View style={{ width: 70, height: 28 }} />;
  const min = Math.min(...pts), max = Math.max(...pts), rng = max - min || 1;
  const p = pts.map((v, i) => `${(i / (pts.length - 1)) * 70},${26 - ((v - min) / rng) * 24}`).join(' ');
  return <Svg width={70} height={28}><Polyline points={p} fill="none" stroke={color} strokeWidth={1.6} /></Svg>;
};

function Diagnostics({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { th, t } = useApp();
  const [res, setRes] = useState<Diag[] | null>(null);
  const run = () => { setRes(null); runDiagnostics().then(setRes); };
  useEffect(() => { if (open) run(); }, [open]);
  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' }}>
        <View style={{ backgroundColor: th.bg, padding: 20, gap: 12, borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>
          <Text style={{ color: th.text, fontSize: 18, fontWeight: '700' }}>{t('diag')}</Text>
          {!res && <ActivityIndicator color={th.accent} />}
          {res?.map((r) => (
            <View key={r.name} style={{ flexDirection: 'row', gap: 10 }}>
              <Text style={{ color: r.ok ? th.buy : th.sell, fontSize: 18, fontWeight: '800' }}>{r.ok ? '✓' : '✗'}</Text>
              <View style={{ flex: 1 }}><Body bold>{r.name}</Body><Dim>{r.detail}</Dim></View>
            </View>
          ))}
          <Btn ghost label={t('runAgain')} onPress={run} />
          <Btn label={t('close')} onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

export default function Markets() {
  const { th, t, tab } = useApp();
  const { quotes, db, status } = useFeed(tab === 2);
  const [cat, setCat] = useState('forex');
  const [quote, setQuote] = useState('USDT');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Sym | null>(null);
  const [diag, setDiag] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => { setLimit(PAGE); }, [cat, quote, q]);

  const term = q.trim().toLowerCase();
  const crypto = cat === 'crypto' && !term;
  const all = (!term && cat === 'fav'
    ? db.favs.map(symOf)
    : SYMBOLS.filter((s) => !isBad(s.id) && (term ? (s.name + s.id).toLowerCase().includes(term) : s.cat === cat && (!crypto || (quote === 'ALL' ? true : quote === 'DERIV' ? !s.quote : s.quote === quote))))
  );
  const list = all.slice(0, limit);
  const key = list.map((s) => s.id).join(',');
  const favIds = db.favs;
  const favKey = favIds.join(',');
  useEffect(() => {
    setWatch('markets', tab === 2 ? [...new Set([...list.map((s) => s.id), ...favIds])] : []);
    return () => setWatch('markets', []);
  }, [tab === 2, key, favKey]);
  const live = status === 'live';
  const count = (c: string) => (c === 'fav' ? db.favs.length : SYMBOLS.filter((s) => s.cat === c && !isBad(s.id)).length);
  const desk = useLayout().mode === 'desktop';
  const nCrypto = SYMBOLS.filter((s) => s.cat === 'crypto').length;

  // website: the Global Markets page (src/MarketsHome.web.tsx); the phone keeps the list below
  if (desk) return <><MarketsHome active={tab === 2} onSelect={setSel} /><SymbolSheet sym={sel} onClose={() => setSel(null)} /></>;

  return (
    <Screen icon="pulse" title={t('tabMarkets')} subtitle={`${catalog.loaded ? catalog.count : 0} Deriv · ${bnState.loaded ? bnState.count : 0} crypto pairs`}>
      <Pressable onPress={() => setDiag(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, alignSelf: 'flex-start', backgroundColor: th.panel, borderWidth: 1, borderColor: th.line, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: live ? th.buy : status === 'connecting' ? th.gold : th.sell }} />
        <Text style={{ color: live ? th.buy : th.dim, fontWeight: '800', fontSize: 12 }}>{live ? t('live') : status === 'connecting' ? t('connecting') : t('offline')}</Text>
        <Text style={{ color: th.dim }}>·</Text>
        <Icon name="wifi" size={13} color={th.accent} />
        <Text style={{ color: th.accent, fontSize: 12, fontWeight: '800' }}>{t('diag')}</Text>
      </Pressable>
      {flags.backup && <Dim>{t('backupFeed')}</Dim>}
      {!live && Object.keys(quotes).length === 0 && <Dim>{t('noConn')}</Dim>}
      {cat === 'deriv' && !live && !term && <Dim>{t('derivDown')}</Dim>}

      {favIds.length > 0 && !term && cat !== 'fav' && (
        <View style={{ marginBottom: 6 }}>
          <SectionHeader title={t('watchlist')} icon="star" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 12, paddingHorizontal: 16 }} style={{ marginHorizontal: -16 }}>
            {favIds.map((id) => {
              const x = quotes[id], c = chg(id), col = c >= 0 ? th.buy : th.sell;
              return (
                <Pressable key={id} onPress={() => setSel(symOf(id))} style={{ width: 142 }}>
                  <Card style={{ padding: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text numberOfLines={1} style={{ color: th.text, fontWeight: '800', flex: 1 }}>{symOf(id).name}</Text>
                      <Pressable onPress={() => toggleFav(id)} hitSlop={10}><Icon name="star" size={16} color={th.gold} /></Pressable>
                    </View>
                    <Text style={{ color: x?.dir ? (x.dir > 0 ? th.buy : th.sell) : th.text, fontWeight: '900', fontSize: 17, marginTop: 6 }} numberOfLines={1} adjustsFontSizeToFit>{x ? x.price.toFixed(x.dec) : '—'}</Text>
                    <Text style={{ color: x ? col : th.dim, fontSize: 12, fontWeight: '700' }}>{x ? `${c >= 0 ? '+' : ''}${c.toFixed(2)}%` : ' '}</Text>
                  </Card>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: th.panel, borderColor: th.line, borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, marginBottom: 12 }}>
        <Icon name="search" size={18} color={th.dim} />
        <TextInput value={q} onChangeText={setQ} placeholder={`${t('search')} (${SYMBOLS.length})`} placeholderTextColor={th.dim} autoCapitalize="none" style={{ flex: 1, color: th.text, padding: 13 }} />
        {!!q && <Pressable onPress={() => setQ('')} hitSlop={10}><Icon name="close-circle" size={18} color={th.dim} /></Pressable>}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10, flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
        {CATS.map(([k, label]) => <Chip key={k} label={t(label)} icon={k === 'fav' ? 'star' : undefined} on={cat === k && !term} count={k === 'crypto' ? nCrypto : undefined} onPress={() => { setCat(k); setQ(''); }} />)}
      </ScrollView>

      {crypto && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12, flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
          {['ALL', ...QUOTES, 'DERIV'].map((k) => (
            <Pressable key={k} onPress={() => setQuote(k)} style={{ paddingHorizontal: 12, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: quote === k ? th.accent + '26' : 'transparent', borderWidth: 1, borderColor: quote === k ? th.accent : th.line }}>
              <Text style={{ color: quote === k ? th.accent : th.dim, fontWeight: '800', fontSize: 12 }}>{k === 'ALL' ? 'All pairs' : k === 'DERIV' ? 'Deriv crypto' : k}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {cat === 'crypto' && !bnState.loaded && (
        <Card style={{ marginBottom: 12 }}>
          <Body color={bnState.err ? th.sell : th.dim}>{bnState.err || 'Loading every crypto pair…'}</Body>
          {!!bnState.err && <><View style={{ height: 8 }} /><Btn ghost label={t('retry')} icon="refresh" onPress={() => loadCrypto(true)} /></>}
        </Card>
      )}

      {list.length === 0 && <Body color={th.dim}>{cat === 'fav' && !term ? t('noFav') : t('noMatch')}</Body>}
      <View style={{ gap: 10, ...(desk ? { flexDirection: 'row', flexWrap: 'wrap' } : null) }}>
        {list.map((s, i) => {
          const x = quotes[s.id];
          const c = chg(s.id), col = c >= 0 ? th.buy : th.sell, fav = db.favs.includes(s.id);
          const head = !crypto && s.sub && s.sub !== list[i - 1]?.sub;
          return (
            <React.Fragment key={s.id}>
              {head && <Text style={{ width: '100%', color: th.dim, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginTop: i ? 8 : 0 }}>{s.sub!.toUpperCase()}</Text>}
              <View style={{ gap: 10, ...(desk ? { width: '48.9%' } : null) }}>
              <Pressable onPress={() => setSel(s)} style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}>
                <Card style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 }}>
                  <Coin s={s} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: th.text, fontWeight: '800', fontSize: 15 }} numberOfLines={1}>{s.name}</Text>
                    <Text style={{ color: th.dim, fontSize: 11.5 }} numberOfLines={1}>{isClosed(s.id) && !x?.pts.length ? t('closed') : s.sub && s.quote ? `${s.sub} · 24h` : s.id}</Text>
                  </View>
                  <View style={{ direction: 'ltr' }}><Spark pts={x?.pts ?? []} color={col} /></View>
                  <View style={{ alignItems: 'flex-end', minWidth: 84 }}>
                    <Text style={{ color: x?.dir ? (x.dir > 0 ? th.buy : th.sell) : th.text, fontWeight: '900', fontSize: 15.5 }} numberOfLines={1}>{x ? x.price.toFixed(x.dec) : '—'}</Text>
                    {x && <View style={{ backgroundColor: col + '1F', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, marginTop: 3 }}><Text style={{ color: col, fontSize: 11.5, fontWeight: '800' }}>{c >= 0 ? '+' : ''}{c.toFixed(2)}%</Text></View>}
                  </View>
                  <Pressable onPress={() => toggleFav(s.id)} hitSlop={10}>
                    <Icon name={fav ? 'star' : 'star-outline'} size={20} color={fav ? th.gold : th.dim} />
                  </Pressable>
                </Card>
              </Pressable>
              </View>
            </React.Fragment>
          );
        })}
      </View>
      {all.length > list.length && (
        <View style={{ marginTop: 14 }}>
          <Btn ghost icon="chevron-down" label={`Show more (${all.length - list.length} left)`} onPress={() => setLimit(limit + PAGE)} />
        </View>
      )}
      <SymbolSheet sym={sel} onClose={() => setSel(null)} />
      <Diagnostics open={diag} onClose={() => setDiag(false)} />
    </Screen>
  );
}
