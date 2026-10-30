import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Image, TextInput } from 'react-native';
import { useApp } from './store';
import { Icon, LiveDot, BellButton } from './ui';
import { LogoMark } from './Brand';
import { NAV } from './nav';
import { Coin } from './MarketWidgets';
import { useLayout } from './win';
import { SYMBOLS, Sym } from './markets';
import { setDash, groupOf } from './dash';

// The desktop website: [ sidebar ] [ top bar over ( page | market watch ) ]. The pages are the same screens as on the phone;
// Home is a dashboard (DesktopHome.web.tsx).
export const useDesktop = () => useLayout().mode === 'desktop';

const LINKS: [string, number][] = [['Home', 0], ['Analysis', 1], ['Markets', 2], ['Journal', 3], ['Risk & TP Planner', 4]];
const TOOLS: [number, string][] = [[8, 'globe'], [17, 'briefcase'], [18, 'business'], [19, 'logo-bitcoin'], [9, 'stats-chart'], [11, 'shield-checkmark'], [13, 'newspaper'], [5, 'time'], [14, 'help-circle'], [15, 'information-circle'], [6, 'settings']];

// The website's top navigation: logo, main pages, a Tools menu, search, live status, alerts and the account menu.
// Quiet and professional: a white bar with a hairline, small restrained type, a brass underline on the open page, hairline buttons (no pills, no glows).
export const NAV_H = 72;
function TopNav() {
  const { th, t, tab, setTab, account, avatar, lic, setAdminOpen, setHelpOpen, setHistOpen, supportUnread, adminBadge } = useApp();
  const L = useLayout();
  const [menu, setMenu] = useState<'' | 'tools' | 'user'>(''), [searchOpen, setSearchOpen] = useState(false), [q, setQ] = useState('');
  const ref = useRef<TextInput>(null);
  const paid = lic.admin || lic.status === 'paid', slim = L.full < 1120;
  const ink = th.dark ? th.text : '#0F1B33', mute = th.dark ? th.dim : '#5B6577', rule = th.dark ? th.line : '#E6E9EF';
  const bar = th.dark ? th.panel : '#FFFFFF', toolTabs = [...TOOLS.map((x) => x[0]), 16];
  const padX = slim ? 16 : 32;
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(true); setTimeout(() => ref.current?.focus(), 30); } if (e.key === 'Escape') { setSearchOpen(false); setMenu(''); } };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);
  const hits = q.trim().length ? SYMBOLS.filter((s) => (s.name + ' ' + s.id).toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8) : [];
  const pick = (s: Sym) => { setDash({ sym: s.id, market: groupOf(s.cat) }); setTab(0); setQ(''); setSearchOpen(false); };
  const link = (label: string, on: boolean, onPress: () => void, chevron?: boolean) => (
    <Pressable key={label} accessibilityRole="button" onPress={onPress} style={((s: any) => ({ height: NAV_H, paddingHorizontal: slim ? 9 : 14, flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'center', cursor: 'pointer' })) as any}>
      {(s: any) => (<>
        <Text style={{ color: on || s.hovered ? ink : mute, fontSize: 13.5, fontWeight: on ? '600' : '500', letterSpacing: 0.15 }} numberOfLines={1}>{label}</Text>
        {chevron && <Icon name="chevron-down" size={13} color={on ? ink : mute} />}
        <View style={{ position: 'absolute', left: slim ? 9 : 14, right: slim ? 9 : 14, bottom: -1, height: 2, backgroundColor: on ? th.accent2 : 'transparent' }} />
      </>)}
    </Pressable>
  );
  const item = (icon: string, label: string, onPress: () => void, badge = 0) => (
    <Pressable key={label} accessibilityRole="button" onPress={() => { setMenu(''); onPress(); }} style={((s: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, height: 38, paddingHorizontal: 12, borderRadius: 6, cursor: 'pointer', backgroundColor: s.hovered ? th.panel2 : 'transparent' })) as any}>
      <Icon name={icon} size={16} color={mute} />
      <Text style={{ flex: 1, color: ink, fontSize: 13.5, fontWeight: '500' }} numberOfLines={1}>{label}</Text>
      {badge > 0 && <View style={{ minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: th.sell, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 10.5, fontWeight: '700' }}>{badge > 99 ? '99+' : badge}</Text></View>}
    </Pressable>
  );
  const drop = { position: 'absolute', top: NAV_H - 8, padding: 6, minWidth: 224, borderRadius: 10, borderWidth: 1, borderColor: rule, backgroundColor: th.solid, shadowColor: '#0F1B33', shadowOpacity: 0.1, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, zIndex: 40 } as any;
  const name = account?.name ?? '';
  const ghost = (s: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 7, height: 34, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: rule, backgroundColor: s.hovered ? th.panel2 : 'transparent', cursor: 'pointer' }) as any;
  const count = adminBadge.chats + adminBadge.pays;
  return (
    <View style={{ zIndex: 30 }}>
      {(menu !== '' || searchOpen) && <Pressable onPress={() => { setMenu(''); setSearchOpen(false); }} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 29 } as any} />}
      <View style={{ height: NAV_H, backgroundColor: bar, borderBottomWidth: 1, borderBottomColor: rule, zIndex: 31 }}>
        <View style={{ flex: 1, width: '100%', maxWidth: 1280, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', paddingHorizontal: padX, gap: slim ? 2 : 4 }}>
          <Pressable onPress={() => setTab(0)} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, cursor: 'pointer' } as any}>
            <LogoMark size={34} radius={8} />
            <View>
              <Text style={{ color: ink, fontSize: 17, fontWeight: '700', letterSpacing: -0.2 }} numberOfLines={1}>Chart Reader</Text>
              {!slim && <Text style={{ color: mute, fontSize: 9, fontWeight: '600', letterSpacing: 2 }} numberOfLines={1}>TRADING ANALYSIS</Text>}
            </View>
          </Pressable>
          <View style={{ width: 1, height: 28, backgroundColor: rule, marginHorizontal: slim ? 12 : 28 }} />
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
          <Pressable accessibilityRole="button" accessibilityLabel="Search" onPress={() => { setSearchOpen((v) => !v); setMenu(''); setTimeout(() => ref.current?.focus(), 30); }} style={((s: any) => ({ width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: rule, alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backgroundColor: s.hovered ? th.panel2 : 'transparent' })) as any}>
            <Icon name="search" size={16} color={mute} />
          </Pressable>
          <View style={{ marginLeft: 6 }}><LiveDot /></View>
          <BellButton />
          {lic.admin && (
            <Pressable accessibilityRole="button" onPress={() => setAdminOpen(true)} style={ghost}>
              <Icon name="shield-checkmark-outline" size={15} color={ink} />{!slim && <Text style={{ color: ink, fontSize: 12.5, fontWeight: '600' }}>Admin</Text>}
              {count > 0 && <View style={{ minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: th.sell, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 10.5, fontWeight: '700' }}>{count}</Text></View>}
            </Pressable>
          )}
          {!paid && <Pressable onPress={() => setTab(6)} style={{ height: 34, paddingHorizontal: 16, borderRadius: 8, justifyContent: 'center', backgroundColor: th.accent, cursor: 'pointer' } as any}><Text style={{ color: th.onAccent, fontSize: 12.5, fontWeight: '600' }}>Upgrade</Text></Pressable>}
          <View style={{ marginLeft: 8 }}>
            <Pressable accessibilityRole="button" onPress={() => setMenu(menu === 'user' ? '' : 'user')} style={{ flexDirection: 'row', alignItems: 'center', gap: 9, cursor: 'pointer' } as any}>
              {avatar ? <Image source={{ uri: avatar }} style={{ width: 32, height: 32, borderRadius: 16 }} /> : (
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: th.accent, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: th.onAccent, fontSize: 13.5, fontWeight: '600' }}>{(name || '?').trim().charAt(0).toUpperCase()}</Text></View>
              )}
              {!slim && <Text style={{ color: ink, fontSize: 13.5, fontWeight: '600', maxWidth: 110 }} numberOfLines={1}>{name}</Text>}
              <Icon name="chevron-down" size={14} color={mute} />
            </Pressable>
            {menu === 'user' && (
              <View style={{ ...drop, right: 0 }}>
                <View style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
                  <Text style={{ color: ink, fontSize: 13.5, fontWeight: '600' }} numberOfLines={1}>{name}</Text>
                  <Text style={{ color: mute, fontSize: 11.5 }}>{lic.admin ? 'Admin' : paid ? 'Premium Trader' : lic.status === 'trial' ? 'Free trial' : 'Account'}</Text>
                </View>
                <View style={{ height: 1, backgroundColor: rule, marginVertical: 4 }} />
                {item('settings-outline', 'Settings', () => setTab(6))}
                {item('chatbubbles-outline', 'Help chat', () => setHelpOpen(true), supportUnread)}
                {lic.admin && item('shield-checkmark-outline', 'Admin panel', () => setAdminOpen(true), count)}
              </View>
            )}
          </View>
        </View>
        {searchOpen && (
          <View style={{ position: 'absolute', top: NAV_H - 12, right: padX, width: 420, zIndex: 41 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: th.accent, backgroundColor: th.solid, shadowColor: '#0F1B33', shadowOpacity: 0.1, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } }}>
              <Icon name="search" size={16} color={mute} />
              <TextInput ref={ref} value={q} onChangeText={setQ} placeholder="Search symbols, pairs or instruments" placeholderTextColor={mute} style={{ flex: 1, color: ink, fontSize: 13.5, outlineStyle: 'none' } as any} />
              <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5, borderWidth: 1, borderColor: rule }}><Text style={{ color: mute, fontSize: 10.5, fontWeight: '600' }}>Esc</Text></View>
            </View>
            {hits.length > 0 && (
              <View style={{ marginTop: 6, borderRadius: 10, borderWidth: 1, borderColor: rule, backgroundColor: th.solid, padding: 6, shadowColor: '#0F1B33', shadowOpacity: 0.1, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } }}>
                {hits.map((s) => (
                  <Pressable key={s.id} onPress={() => pick(s)} style={((x: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 6, cursor: 'pointer', backgroundColor: x.hovered ? th.panel2 : 'transparent' })) as any}>
                    <Coin s={s} size={28} />
                    <Text style={{ flex: 1, color: ink, fontSize: 13.5, fontWeight: '600' }} numberOfLines={1}>{s.name}</Text>
                    <Text style={{ color: mute, fontSize: 10.5, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' }}>{groupOf(s.cat)}</Text>
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

// A slim strip under the top bar for the two things that need the person: the server cannot be reached, or the email is not confirmed yet.
export function Notices({ flush }: { flush?: boolean }) {
  const { th, t, licErr, refreshLic, emailVerified, sendVerify, googleOnly, account, toast } = useApp();
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
