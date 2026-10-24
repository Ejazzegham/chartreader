import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Image, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from './store';
import { Icon, LiveDot, BellButton, Card } from './ui';
import { LogoMark } from './Brand';
import { NAV } from './nav';
import { MDEFS } from './MethodArt';
import { Coin } from './MarketWidgets';
import NewsBanner from './NewsBanner';
import { useLayout, useRealWindow } from './win';
import { useFeed, chg, setWatch, toggleFav, SYMBOLS, SESSIONS, sessionOpen, fxWeekendClosed, Sym } from './markets';
import { useDash, setDash, listFor, groupOf, MarketTab } from './dash';

// The desktop website: [ sidebar ] [ top bar over ( page | market watch ) ]. The pages are the same screens as on the phone;
// Home is a dashboard (DesktopHome.web.tsx).
export const useDesktop = () => useLayout().mode === 'desktop';

const MAIN = [0, 1, 2, 16, 3, 4, 5, 8, 9, 11, 13], MORE = [6, 14, 15];

function Sidebar({ width }: { width: number }) {
  const { th, t, tab, setTab, amethod, setAmethod, account, avatar, lic, setAdminOpen, setHelpOpen, supportUnread, adminBadge } = useApp();
  const { height } = useRealWindow();
  const [openA, setOpenA] = useState(false);
  const paid = lic.admin || lic.status === 'paid';
  const item = (i: number, extra?: React.ReactNode) => {
    const n = NAV[i], on = tab === i && !(i === 1 && openA && !!amethod);
    return (
      <View key={n.key}>
        <Pressable accessibilityRole="button" onPress={() => { setTab(i); if (i === 1) { setAmethod(''); setOpenA((v) => !v || tab !== 1); } }}
          style={((s: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, height: 42, paddingHorizontal: 12, borderRadius: 10, marginBottom: 2, cursor: 'pointer', backgroundColor: on ? th.accent + '1F' : s.hovered ? th.accent + '10' : 'transparent' })) as any}>
          <View style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: 2, backgroundColor: on ? th.accent : 'transparent' }} />
          <Icon name={n.icon} size={19} color={on ? th.accent : th.dim} />
          <Text style={{ flex: 1, color: on ? th.accent : th.text, fontSize: 14.5, fontWeight: on ? '800' : '600' }} numberOfLines={1}>{t(n.key)}</Text>
          {i === 1 && <Icon name={openA ? 'chevron-up' : 'chevron-down'} size={16} color={th.dim} />}
        </Pressable>
        {extra}
      </View>
    );
  };
  const methods = MDEFS.filter((d) => d.host !== 'tab');
  return (
    <View style={{ width, backgroundColor: th.panel, borderRightWidth: 1, borderRightColor: th.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 18, paddingBottom: 12 }}>
        <LogoMark size={42} radius={10} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: th.text, fontSize: 19, fontWeight: '900', letterSpacing: -0.4 }} numberOfLines={1}>Chart Reader</Text>
          <Text style={{ color: th.dim, fontSize: 8, fontWeight: '700', letterSpacing: 0.5 }} numberOfLines={1}>TRADING ANALYSIS PLATFORM</Text>
        </View>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 12, paddingTop: 6 }} showsVerticalScrollIndicator={false}>
        {MAIN.map((i) => item(i, i === 1 && openA ? (
          <View style={{ marginLeft: 22, marginBottom: 4, paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: th.line }}>
            {methods.map((m) => {
              const on = tab === 1 && amethod === m.k;
              return (
                <Pressable key={m.k} onPress={() => { setAmethod(m.k); setTab(1); }} style={((s: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 9, height: 34, paddingHorizontal: 10, borderRadius: 8, cursor: 'pointer', backgroundColor: on ? th.accent + '1F' : s.hovered ? th.accent + '10' : 'transparent' })) as any}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: m.colors[0] }} />
                  <Text style={{ color: on ? th.accent : th.dim, fontSize: 13, fontWeight: on ? '800' : '600' }} numberOfLines={1}>{m.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null))}
        <Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '800', letterSpacing: 1.4, paddingHorizontal: 12, marginTop: 14, marginBottom: 6 }}>MORE</Text>
        {MORE.map((i) => item(i))}
        {/* these two open as windows (not pages), so they were missing from the website's menu */}
        {([['Help chat', 'chatbubbles-outline', () => setHelpOpen(true), supportUnread, true], ['Admin panel', 'shield-checkmark-outline', () => setAdminOpen(true), adminBadge.chats + adminBadge.pays, !!lic.admin]] as [string, string, () => void, number, boolean][]).filter((r) => r[4]).map(([label, icon, go, n]) => (
          <Pressable key={label} accessibilityRole="button" onPress={go} style={((st: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, height: 42, paddingHorizontal: 12, borderRadius: 10, marginBottom: 2, cursor: 'pointer', backgroundColor: st.hovered ? th.accent + '10' : 'transparent' })) as any}>
            <Icon name={icon} size={19} color={th.dim} />
            <Text style={{ flex: 1, color: th.text, fontSize: 14.5, fontWeight: '600' }} numberOfLines={1}>{label}</Text>
            {n > 0 && <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: th.sell, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>{n > 99 ? '99+' : n}</Text></View>}
          </Pressable>
        ))}
      </ScrollView>
      {height >= 860 && (
        <View style={{ marginHorizontal: 14, marginBottom: 12, borderRadius: 16, overflow: 'hidden', padding: 16, gap: 8 }}>
          <LinearGradient colors={['#0B1B3F', '#14306B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '900', lineHeight: 21 }}>Trade Smarter{'\n'}With Better Analysis</Text>
          <Text style={{ color: '#FFFFFFB3', fontSize: 11.5, lineHeight: 16 }}>Professional tools for better decisions and consistent results.</Text>
          {paid ? <Text style={{ color: '#7CF0C4', fontSize: 12.5, fontWeight: '800', marginTop: 4 }}>✓ Your PRO plan is active</Text> : (
            <Pressable onPress={() => setTab(6)} style={((s: any) => ({ marginTop: 4, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 36, borderRadius: 9, cursor: 'pointer', backgroundColor: s.hovered ? '#FFFFFF' : '#F1F5FF' })) as any}>
              <Text style={{ color: '#14306B', fontSize: 12.5, fontWeight: '800' }}>Upgrade to Pro</Text><Icon name="arrow-forward" size={14} color="#14306B" />
            </Pressable>
          )}
        </View>
      )}
      <Pressable onPress={() => setTab(6)} style={((s: any) => ({ marginHorizontal: 14, marginBottom: 14, paddingTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10, cursor: 'pointer', borderTopWidth: 1, borderTopColor: th.line, opacity: s.hovered ? 0.85 : 1 })) as any}>
        {avatar ? <Image source={{ uri: avatar }} style={{ width: 38, height: 38, borderRadius: 19 }} /> : (
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: th.accent + '26', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: th.accent, fontSize: 16, fontWeight: '900' }}>{(account?.name ?? '?').trim().charAt(0).toUpperCase()}</Text></View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ color: th.text, fontSize: 13.5, fontWeight: '800' }} numberOfLines={1}>{account?.name ?? ''}</Text>
          <Text style={{ color: th.dim, fontSize: 11 }} numberOfLines={1}>{lic.admin ? 'Admin' : paid ? 'Premium Trader' : lic.status === 'trial' ? 'Free trial' : 'Account'}</Text>
        </View>
        <Icon name="settings-outline" size={18} color={th.dim} />
      </Pressable>
    </View>
  );
}

function TopBar() {
  const { th, setTab, account, avatar, lic, setAdminOpen, adminBadge } = useApp();
  const [q, setQ] = useState(''), [open, setOpen] = useState(false);
  const ref = useRef<TextInput>(null);
  const paid = lic.admin || lic.status === 'paid';
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ref.current?.focus(); } };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);
  const hits = q.trim().length ? SYMBOLS.filter((s) => (s.name + ' ' + s.id).toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8) : [];
  const pick = (s: Sym) => { setDash({ sym: s.id, market: groupOf(s.cat) }); setTab(0); setQ(''); setOpen(false); ref.current?.blur(); };
  return (
    <View style={{ height: 68, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, backgroundColor: th.panel, borderBottomWidth: 1, borderBottomColor: th.line, zIndex: 30 }}>
      <View style={{ flex: 1, maxWidth: 560, zIndex: 31 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 42, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: open ? th.accent : th.line, backgroundColor: th.panel2 }}>
          <Icon name="search" size={17} color={th.dim} />
          <TextInput ref={ref} value={q} onChangeText={(v) => { setQ(v); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 160)} placeholder="Search for symbols, pairs, or instruments..." placeholderTextColor={th.dim} style={{ flex: 1, color: th.text, fontSize: 13.5, outlineStyle: 'none' } as any} />
          <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: th.line }}><Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '700' }}>Ctrl + K</Text></View>
        </View>
        {open && hits.length > 0 && (
          <View style={{ position: 'absolute', top: 48, left: 0, right: 0, borderRadius: 12, borderWidth: 1, borderColor: th.line, backgroundColor: th.solid, padding: 6, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 22, shadowOffset: { width: 0, height: 10 } }}>
            {hits.map((s) => (
              <Pressable key={s.id} onPress={() => pick(s)} style={((x: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 8, cursor: 'pointer', backgroundColor: x.hovered ? th.accent + '14' : 'transparent' })) as any}>
                <Coin s={s} size={30} />
                <Text style={{ flex: 1, color: th.text, fontSize: 13.5, fontWeight: '700' }} numberOfLines={1}>{s.name}</Text>
                <Text style={{ color: th.dim, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>{groupOf(s.cat)}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
      <View style={{ flex: 1 }} />
      <LiveDot />
      {lic.admin && (
        <Pressable accessibilityRole="button" onPress={() => setAdminOpen(true)} style={((st: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, borderColor: th.accent + '66', backgroundColor: st.hovered ? th.accent + '26' : th.accent + '14', cursor: 'pointer' })) as any}>
          <Icon name="shield-checkmark" size={15} color={th.accent} /><Text style={{ color: th.accent, fontSize: 12.5, fontWeight: '800' }}>Admin</Text>
          {adminBadge.chats + adminBadge.pays > 0 && <View style={{ minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: th.sell, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 10.5, fontWeight: '900' }}>{adminBadge.chats + adminBadge.pays}</Text></View>}
        </Pressable>
      )}
      <BellButton />
      {paid ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 14, borderRadius: 17, borderWidth: 1, borderColor: th.gold + '88', backgroundColor: th.gold + '1F' }}><Icon name="ribbon" size={15} color={th.gold} /><Text style={{ color: th.gold, fontSize: 12.5, fontWeight: '900' }}>PRO</Text></View>
      ) : (
        <Pressable onPress={() => setTab(6)} style={{ height: 34, paddingHorizontal: 14, borderRadius: 17, justifyContent: 'center', backgroundColor: th.accent, cursor: 'pointer' } as any}><Text style={{ color: th.onAccent, fontSize: 12.5, fontWeight: '800' }}>Upgrade</Text></Pressable>
      )}
      <View style={{ width: 1, height: 32, backgroundColor: th.line }} />
      <Pressable onPress={() => setTab(6)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, cursor: 'pointer' } as any}>
        {avatar ? <Image source={{ uri: avatar }} style={{ width: 38, height: 38, borderRadius: 19 }} /> : (
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: th.accent, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: th.onAccent, fontSize: 16, fontWeight: '900' }}>{(account?.name ?? '?').trim().charAt(0).toUpperCase()}</Text></View>
        )}
        <View>
          <Text style={{ color: th.text, fontSize: 13.5, fontWeight: '800' }} numberOfLines={1}>{account?.name ?? ''}</Text>
          <Text style={{ color: th.dim, fontSize: 11 }}>{lic.admin ? 'Admin' : paid ? 'Premium Trader' : lic.status === 'trial' ? 'Free trial' : 'Account'}</Text>
        </View>
        <Icon name="chevron-down" size={16} color={th.dim} />
      </Pressable>
    </View>
  );
}

const QUOTES = ['Plan the trade. Trade the plan.', 'Protect your capital first. Profits follow.', 'Patience pays more than prediction.', 'One good setup beats ten forced trades.', 'Risk small. Think long.', 'Discipline turns a good analysis into a good result.'];
const S_COL = ['#0EA5E9', '#EF4444', '#8B5CF6', '#F59E0B'], S_ABBR = ['SY', 'TK', 'LN', 'NY'];

function Rail({ width }: { width: number }) {
  const { th, setTab } = useApp();
  const { quotes, db } = useFeed(true);
  const d = useDash();
  const [tab, setRailTab] = useState<MarketTab>('forex');
  const [now, setNow] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(i); }, []);
  const rows = listFor(tab, db.favs).slice(0, 9);
  useEffect(() => { setWatch('rail', rows.map((s) => s.id)); return () => setWatch('rail', []); }, [rows.map((s) => s.id).join(',')]);
  const closed = fxWeekendClosed(now), h = now.getUTCHours(), tzo = -now.getTimezoneOffset() / 60;
  const hh = (x: number) => String(((x + tzo) % 24 + 24) % 24).padStart(2, '0') + ':00';
  const quote = QUOTES[Math.floor(now.getTime() / 86400000) % QUOTES.length];
  return (
    <View style={{ width, backgroundColor: th.panel, borderLeftWidth: 1, borderLeftColor: th.line }}>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 14 }} showsVerticalScrollIndicator={false}>
        <Card style={{ padding: 12, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: th.text, fontSize: 16, fontWeight: '900' }}>Market Watch</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: th.buy }} /><Text style={{ color: th.buy, fontSize: 12, fontWeight: '800' }}>Live</Text></View>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {([['forex', 'Forex'], ['crypto', 'Crypto'], ['deriv', 'Deriv']] as [MarketTab, string][]).map(([k, l]) => (
              <Pressable key={k} onPress={() => setRailTab(k)} style={{ paddingHorizontal: 13, height: 30, borderRadius: 8, justifyContent: 'center', cursor: 'pointer', backgroundColor: tab === k ? th.accent : th.panel2, borderWidth: 1, borderColor: tab === k ? th.accent : th.line } as any}>
                <Text style={{ color: tab === k ? th.onAccent : th.dim, fontSize: 12, fontWeight: '800' }}>{l}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', paddingHorizontal: 6 }}>
            <Text style={{ flex: 1, color: th.dim, fontSize: 11, fontWeight: '700' }}>Symbol</Text>
            <Text style={{ width: 66, textAlign: 'right', color: th.dim, fontSize: 11, fontWeight: '700' }}>Price</Text>
            <Text style={{ width: 58, textAlign: 'right', color: th.dim, fontSize: 11, fontWeight: '700' }}>24H</Text>
            <View style={{ width: 24 }} />
          </View>
          {rows.map((s, i) => {
            const x = quotes[s.id], c = chg(s.id), on = d.sym === s.id, fav = db.favs.includes(s.id);
            return (
              <Pressable key={s.id} onPress={() => { setDash({ sym: s.id, market: groupOf(s.cat) }); setTab(0); }} style={((st: any) => ({ flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingHorizontal: 6, borderRadius: 8, cursor: 'pointer', backgroundColor: on ? th.accent + '16' : st.hovered ? th.accent + '0C' : 'transparent' })) as any}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <Coin s={s} size={24} />
                  <Text style={{ flex: 1, color: th.text, fontSize: 12, fontWeight: '800' }} numberOfLines={1}>{s.name}</Text>
                </View>
                <Text style={{ width: 66, textAlign: 'right', color: th.text, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{x ? x.price.toFixed(x.dec) : '—'}</Text>
                <Text style={{ width: 58, textAlign: 'right', color: c >= 0 ? th.buy : th.sell, fontSize: 11.5, fontWeight: '800' }}>{x ? `${c >= 0 ? '+' : '−'}${Math.abs(c).toFixed(2)}%` : ''}</Text>
                <Pressable onPress={() => toggleFav(s.id)} hitSlop={6} style={{ width: 24, alignItems: 'flex-end', cursor: 'pointer' } as any}><Icon name={fav ? 'star' : 'star-outline'} size={15} color={fav ? th.gold : th.dim} /></Pressable>
              </Pressable>
            );
          })}
        </Card>

        <Card style={{ padding: 14, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="shield-checkmark" size={17} color={th.accent} /><Text style={{ color: th.text, fontSize: 15, fontWeight: '900' }}>Forex Sessions</Text></View>
            <Pressable onPress={() => setTab(13)} style={{ cursor: 'pointer' } as any}><Text style={{ color: th.accent, fontSize: 12, fontWeight: '800' }}>News ›</Text></Pressable>
          </View>
          {SESSIONS.map((s, i) => {
            const on = !closed && sessionOpen(h, s.s, s.e);
            return (
              <View key={s.n} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: th.line, backgroundColor: th.panel2 }}>
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: S_COL[i] + '24', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: S_COL[i], fontSize: 12, fontWeight: '900' }}>{S_ABBR[i]}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: th.text, fontSize: 13.5, fontWeight: '800' }}>{s.n}</Text>
                  <Text style={{ color: th.dim, fontSize: 11.5 }}>{hh(s.s)} - {hh(s.e)}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, backgroundColor: (on ? th.buy : th.accent) + '1F' }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: on ? th.buy : closed ? th.dim : th.accent }} />
                  <Text style={{ color: on ? th.buy : closed ? th.dim : th.accent, fontSize: 11.5, fontWeight: '800' }}>{on ? 'Active' : closed ? 'Closed' : 'Upcoming'}</Text>
                </View>
              </View>
            );
          })}
          <Text style={{ color: th.dim, fontSize: 11, lineHeight: 15 }}>Times are in your local time. No daylight-saving adjustment. Forex closes for the weekend.</Text>
        </Card>

        <NewsBanner />
        <View style={{ borderRadius: 16, overflow: 'hidden', padding: 18, minHeight: 110, justifyContent: 'center' }}>
          <LinearGradient colors={[th.accent + '26', th.accent2 + '12']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <Text style={{ color: th.accent, fontSize: 38, fontWeight: '900', lineHeight: 34 }}>“</Text>
          <Text style={{ color: th.text, fontSize: 16, fontWeight: '800', lineHeight: 22 }}>{quote}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

export function DesktopShell({ children }: { children: React.ReactNode }) {
  const L = useLayout();
  const { tab } = useApp(); // Home has its own right column (watchlist, sentiment, key levels), so the market-watch panel is for the other pages
  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <Sidebar width={L.sidebar} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <TopBar />
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
          {L.rail > 0 && tab !== 0 && <Rail width={L.rail} />}
        </View>
      </View>
    </View>
  );
}
