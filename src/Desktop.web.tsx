import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Image, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from './store';
import MarketsPanel from './MarketsPanel';
import { Icon, LiveDot, BellButton, Card } from './ui';
import { LogoMark } from './Brand';
import { NAV } from './nav';
import { APP_VERSION } from './version';
import { MDEFS } from './MethodArt';
import { Coin } from './MarketWidgets';
import NewsBanner from './NewsBanner';
import { useLayout, useRealWindow } from './win';
import { useFeed, chg, setWatch, toggleFav, SYMBOLS, SESSIONS, sessionOpen, fxWeekendClosed, Sym } from './markets';
import { useDash, setDash, listFor, groupOf, MarketTab } from './dash';

// The desktop website: [ sidebar ] [ top bar over ( page | market watch ) ]. The pages are the same screens as on the phone;
// Home is a dashboard (DesktopHome.web.tsx).
export const useDesktop = () => useLayout().mode === 'desktop';

const LINKS: [string, number][] = [['Home', 0], ['Analysis', 1], ['Markets', 2], ['Journal', 3], ['Risk & TP Planner', 4]];
const TOOLS: [number, string][] = [[8, 'alarm'], [9, 'stats-chart'], [11, 'shield-checkmark'], [13, 'newspaper'], [5, 'time'], [14, 'help-circle'], [15, 'information-circle'], [6, 'settings']];

// The website's top navigation (replaces the old left sidebar): logo, main pages, a Tools menu, search, live status, alerts and the account menu.
function TopNav() {
  const { th, t, tab, setTab, account, avatar, lic, setAdminOpen, setHelpOpen, setHistOpen, supportUnread, adminBadge } = useApp();
  const L = useLayout();
  const [menu, setMenu] = useState<'' | 'tools' | 'user'>(''), [searchOpen, setSearchOpen] = useState(false), [q, setQ] = useState('');
  const ref = useRef<TextInput>(null);
  const paid = lic.admin || lic.status === 'paid', slim = L.full < 1120;
  const bar = th.dark ? th.panel : '#FFFFFF', toolTabs = [...TOOLS.map((x) => x[0]), 16];
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(true); setTimeout(() => ref.current?.focus(), 30); } if (e.key === 'Escape') { setSearchOpen(false); setMenu(''); } };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);
  const hits = q.trim().length ? SYMBOLS.filter((s) => (s.name + ' ' + s.id).toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8) : [];
  const pick = (s: Sym) => { setDash({ sym: s.id, market: groupOf(s.cat) }); setTab(0); setQ(''); setSearchOpen(false); };
  const link = (label: string, on: boolean, onPress: () => void, chevron?: boolean) => (
    <Pressable key={label} accessibilityRole="button" onPress={onPress} style={((s: any) => ({ height: 64, paddingHorizontal: slim ? 10 : 15, flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'center', cursor: 'pointer', opacity: s.hovered && !on ? 0.75 : 1 })) as any}>
      <Text style={{ color: on ? th.accent : th.dark ? th.text : '#23325A', fontSize: 14.5, fontWeight: on ? '700' : '500' }} numberOfLines={1}>{label}</Text>
      {chevron && <Icon name="chevron-down" size={14} color={on ? th.accent : th.dim} />}
      <View style={{ position: 'absolute', left: slim ? 10 : 15, right: slim ? 10 : 15, bottom: 0, height: 3, borderRadius: 2, backgroundColor: on ? th.accent : 'transparent' }} />
    </Pressable>
  );
  const item = (icon: string, label: string, onPress: () => void, badge = 0) => (
    <Pressable key={label} accessibilityRole="button" onPress={() => { setMenu(''); onPress(); }} style={((s: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 11, height: 38, paddingHorizontal: 12, borderRadius: 9, cursor: 'pointer', backgroundColor: s.hovered ? th.accent + '12' : 'transparent' })) as any}>
      <Icon name={icon} size={17} color={th.dim} />
      <Text style={{ flex: 1, color: th.text, fontSize: 13.5, fontWeight: '600' }} numberOfLines={1}>{label}</Text>
      {badge > 0 && <View style={{ minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: th.sell, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 10.5, fontWeight: '900' }}>{badge > 99 ? '99+' : badge}</Text></View>}
    </Pressable>
  );
  const drop = { position: 'absolute', top: 60, padding: 6, minWidth: 220, borderRadius: 12, borderWidth: 1, borderColor: th.line, backgroundColor: th.solid, shadowColor: '#0B1B3F', shadowOpacity: 0.16, shadowRadius: 26, shadowOffset: { width: 0, height: 12 }, zIndex: 40 } as any;
  const name = account?.name ?? '';
  return (
    <View style={{ zIndex: 30 }}>
      {(menu !== '' || searchOpen) && <Pressable onPress={() => { setMenu(''); setSearchOpen(false); }} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 29 } as any} />}
      <View style={{ height: 64, backgroundColor: bar, borderBottomWidth: 1, borderBottomColor: th.dark ? th.line : '#E8EDF6', zIndex: 31 }}>
        <View style={{ flex: 1, width: '100%', maxWidth: 1360, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', paddingHorizontal: slim ? 16 : 28, gap: slim ? 4 : 10 }}>
          <Pressable onPress={() => setTab(0)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginRight: slim ? 8 : 26, cursor: 'pointer' } as any}>
            <LogoMark size={38} radius={10} />
            <View>
              <Text style={{ color: th.dark ? th.text : '#0B1B3F', fontSize: 19, fontWeight: '800', letterSpacing: -0.4 }} numberOfLines={1}>Chart Reader</Text>
              {!slim && <Text style={{ color: th.dim, fontSize: 8, fontWeight: '700', letterSpacing: 0.7 }} numberOfLines={1}>TRADING ANALYSIS PLATFORM</Text>}
            </View>
          </Pressable>
          {LINKS.map(([label, i]) => link(label, tab === i, () => { setMenu(''); setTab(i); }))}
          <View>
            {link('Tools', menu === 'tools' || toolTabs.includes(tab), () => setMenu(menu === 'tools' ? '' : 'tools'), true)}
            {menu === 'tools' && (
              <View style={{ ...drop, left: 0 }}>
                {TOOLS.map(([i, icon]) => item(icon, t(NAV[i].key), () => setTab(i)))}
                {item('receipt', 'Trade History', () => setHistOpen(true))}
                {item('swap-vertical', 'Demo Trade', () => setTab(16))}
                {item('chatbubbles-outline', 'Help chat', () => setHelpOpen(true), supportUnread)}
              </View>
            )}
          </View>
          <View style={{ flex: 1 }} />
          <Pressable accessibilityRole="button" accessibilityLabel="Search" onPress={() => { setSearchOpen((v) => !v); setMenu(''); setTimeout(() => ref.current?.focus(), 30); }} style={((s: any) => ({ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backgroundColor: s.hovered || searchOpen ? th.accent + '14' : 'transparent' })) as any}>
            <Icon name="search" size={19} color={th.dark ? th.text : '#23325A'} />
          </Pressable>
          <LiveDot />
          <BellButton />
          {lic.admin && (
            <Pressable accessibilityRole="button" onPress={() => setAdminOpen(true)} style={((s: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, borderColor: th.accent + '66', backgroundColor: s.hovered ? th.accent + '26' : th.accent + '14', cursor: 'pointer' })) as any}>
              <Icon name="shield-checkmark" size={15} color={th.accent} />{!slim && <Text style={{ color: th.accent, fontSize: 12.5, fontWeight: '800' }}>Admin</Text>}
              {adminBadge.chats + adminBadge.pays > 0 && <View style={{ minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: th.sell, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 10.5, fontWeight: '900' }}>{adminBadge.chats + adminBadge.pays}</Text></View>}
            </Pressable>
          )}
          {!paid && <Pressable onPress={() => setTab(6)} style={{ height: 34, paddingHorizontal: 14, borderRadius: 17, justifyContent: 'center', backgroundColor: th.accent, cursor: 'pointer' } as any}><Text style={{ color: th.onAccent, fontSize: 12.5, fontWeight: '800' }}>Upgrade</Text></Pressable>}
          <View>
            <Pressable accessibilityRole="button" onPress={() => setMenu(menu === 'user' ? '' : 'user')} style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginLeft: 6, cursor: 'pointer' } as any}>
              {avatar ? <Image source={{ uri: avatar }} style={{ width: 36, height: 36, borderRadius: 18 }} /> : (
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: th.accent, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: th.onAccent, fontSize: 15, fontWeight: '800' }}>{(name || '?').trim().charAt(0).toUpperCase()}</Text></View>
              )}
              {!slim && <Text style={{ color: th.dark ? th.text : '#0B1B3F', fontSize: 14, fontWeight: '700', maxWidth: 110 }} numberOfLines={1}>{name}</Text>}
              <Icon name="chevron-down" size={15} color={th.dim} />
            </Pressable>
            {menu === 'user' && (
              <View style={{ ...drop, right: 0 }}>
                <View style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
                  <Text style={{ color: th.text, fontSize: 13.5, fontWeight: '800' }} numberOfLines={1}>{name}</Text>
                  <Text style={{ color: th.dim, fontSize: 11.5 }}>{lic.admin ? 'Admin' : paid ? 'Premium Trader' : lic.status === 'trial' ? 'Free trial' : 'Account'}</Text>
                </View>
                <View style={{ height: 1, backgroundColor: th.line, marginVertical: 4 }} />
                {item('settings', 'Settings', () => setTab(6))}
                {item('chatbubbles-outline', 'Help chat', () => setHelpOpen(true), supportUnread)}
                {lic.admin && item('shield-checkmark-outline', 'Admin panel', () => setAdminOpen(true), adminBadge.chats + adminBadge.pays)}
              </View>
            )}
          </View>
        </View>
        {searchOpen && (
          <View style={{ position: 'absolute', top: 58, right: slim ? 16 : 28, width: 420, zIndex: 41 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: th.accent, backgroundColor: th.solid, shadowColor: '#0B1B3F', shadowOpacity: 0.16, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } }}>
              <Icon name="search" size={17} color={th.dim} />
              <TextInput ref={ref} value={q} onChangeText={setQ} placeholder="Search for symbols, pairs, or instruments..." placeholderTextColor={th.dim} style={{ flex: 1, color: th.text, fontSize: 13.5, outlineStyle: 'none' } as any} />
              <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: th.line }}><Text style={{ color: th.dim, fontSize: 10.5, fontWeight: '700' }}>Esc</Text></View>
            </View>
            {hits.length > 0 && (
              <View style={{ marginTop: 6, borderRadius: 12, borderWidth: 1, borderColor: th.line, backgroundColor: th.solid, padding: 6, shadowColor: '#0B1B3F', shadowOpacity: 0.16, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } }}>
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
        )}
      </View>
    </View>
  );
}

const QUOTES = ['Plan the trade. Trade the plan.', 'Protect your capital first. Profits follow.', 'Patience pays more than prediction.', 'One good setup beats ten forced trades.', 'Risk small. Think long.', 'Discipline turns a good analysis into a good result.'];
const S_COL = ['#0EA5E9', '#EF4444', '#8B5CF6', '#F59E0B'], S_ABBR = ['SY', 'TK', 'LN', 'NY'];

function Rail({ width }: { width: number }) {
  const { th, setTab } = useApp();
  const winH = useRealWindow().height;
  const { quotes, db } = useFeed(true);
  const d = useDash();
  const [tab, setRailTab] = useState<MarketTab>('forex');
  const [now, setNow] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(i); }, []);
  const closed = fxWeekendClosed(now), h = now.getUTCHours(), tzo = -now.getTimezoneOffset() / 60;
  const hh = (x: number) => String(((x + tzo) % 24 + 24) % 24).padStart(2, '0') + ':00';
  const quote = QUOTES[Math.floor(now.getTime() / 86400000) % QUOTES.length];
  return (
    <View style={{ width, backgroundColor: th.panel, borderLeftWidth: 1, borderLeftColor: th.line }}>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 14 }} showsVerticalScrollIndicator={false}>
        <MarketsPanel height={Math.max(460, Math.min(640, winH - 150))} goHome />

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

// A slim strip under the top bar for the two things that need the person: the server cannot be reached, or the email is not confirmed yet.
export function Notices({ flush }: { flush?: boolean }) {
  const { th, t, lic, licErr, refreshLic, emailVerified, sendVerify, googleOnly, account, toast } = useApp();
  const [busy, setBusy] = useState(''), [sent, setSent] = useState(false);
  const run = async (k: string, f: () => Promise<any>) => { setBusy(k); try { await f(); } finally { setBusy(''); } };
  const rows: { key: string; tone: string; icon: string; text: string; btns: [string, () => void][] }[] = [];
  if (licErr && /reach|server|internet|connect|too long|not running/i.test(licErr) && !/Firebase/i.test(licErr)) rows.push({ key: 'srv', tone: th.sell, icon: 'cloud-offline-outline', text: 'Cannot reach the Chart Reader server right now, so alerts, backup and chat are paused. Charts and analysis still work.', btns: [[busy === 'srv' ? 'Trying…' : 'Try again', () => run('srv', async () => { const ok = await refreshLic(); toast(ok ? 'Connected to the server.' : 'Still cannot reach the server.', ok ? 'good' : 'info'); })]] });
  if (!emailVerified && !googleOnly) rows.push({ key: 'mail', tone: th.gold, icon: 'mail-unread-outline', text: sent ? `We sent a confirmation link to ${account?.email ?? 'your email'}. Tap it, then come back here: this page notices by itself.` : `Please confirm your email address${account?.email ? ` (${account.email})` : ''}. It keeps your account safe and unlocks all features.`, btns: [[busy === 'mail' ? 'Sending…' : sent ? 'Send again' : 'Send confirmation email', () => run('mail', async () => { const e = await sendVerify(); if (e) toast(t(String(e)), 'bad'); else { setSent(true); toast('Confirmation email sent. Check your inbox and spam.', 'good'); } })], [busy === 'chk' ? 'Checking…' : 'I confirmed it', () => run('chk', async () => { await refreshLic(); toast('Checked.', 'info'); })]] });
  if (!rows.length) return null;
  return (
    <View style={{ gap: 8, paddingHorizontal: flush ? 0 : 20, paddingTop: flush ? 0 : 10 }}>
      {rows.map((r) => (
        <View key={r.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: r.tone + '55', backgroundColor: r.tone + '14' }}>
          <Icon name={r.icon} size={19} color={r.tone} />
          <Text style={{ flex: 1, color: th.text, fontSize: 13, lineHeight: 18 }}>{r.text}</Text>
          {r.btns.map(([l, f]) => (
            <Pressable key={l} onPress={f} style={((st: any) => ({ height: 32, paddingHorizontal: 14, borderRadius: 9, alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backgroundColor: r.tone, opacity: st.hovered ? 0.9 : 1 })) as any}><Text style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' }}>{l}</Text></Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

export function DesktopShell({ children }: { children: React.ReactNode }) {
  const L = useLayout();
  const { tab } = useApp(); // no side panels on any page: every page uses the full width under the top bar
  return (
    <View style={{ flex: 1 }}>
      <TopNav />
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <View style={{ flex: 1, minWidth: 0 }}>{tab !== 13 && tab !== 4 && <Notices />}{children}</View>
      </View>
    </View>
  );
}
