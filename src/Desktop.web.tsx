import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Image, TextInput, ScrollView } from 'react-native';
import { useApp } from './store';
import { Icon, BellButton } from './ui';
import { LogoMark } from './Brand';
import { NAV } from './nav';
import { Coin } from './MarketWidgets';
import { useLayout, useRealWindow } from './win';
import { SYMBOLS, Sym, flags, subscribeFeed } from './markets';
import { setDash, groupOf } from './dash';
import { sheet } from './sheet';
import EditProfile from './EditProfile';
import ToolsOrbit, { OrbitItem } from './ToolsOrbit.web';

// The desktop website: [ sidebar ] [ top bar over ( page | market watch ) ]. The pages are the same screens as on the phone;
// Home is a dashboard (DesktopHome.web.tsx).
export const useDesktop = () => useLayout().mode === 'desktop';

const LINKS: [string, number, string][] = [['Home', 0, 'home-outline'], ['Analysis', 1, 'analytics-outline'], ['TradingView', 22, 'stats-chart-outline'], ['News', 13, 'newspaper-outline'], ['Community', 20, 'people-outline'], ['Paper Trade', 16, 'swap-vertical']]; // 16 = Paper Trade (tabManual), which also holds the Journal; Risk & TP Planner (4) is the first entry of the Tools menu
const TOOLS: [number, string][] = [[4, 'calculator'], [8, 'globe'], [17, 'briefcase'], [18, 'business'], [19, 'logo-bitcoin'], [9, 'stats-chart'], [5, 'time'], [14, 'help-circle'], [15, 'information-circle'], [6, 'settings']];

const TOOL_GROUPS: [string, (number | string)[]][] = [['TRADE', [4, 9, 5]], ['MARKETS', [8, 19, 18, 17]], ['SUPPORT', [14, 6, 'help']]]; // tab numbers from NAV; 'help' opens Help chat
const toolIcon: Record<number, string> = Object.fromEntries(TOOLS);

// Premium Liquid Glass top bar: a floating frosted-glass bar (94% wide, 82 px tall, 26 px corners) with the brand on the left, the page links
// in the middle (an animated gradient underline on the open page) and search, live status, alerts, Admin and the account menu on the right.
// The glass itself is a separate background layer (not the bar), so the dropdowns that open from the bar can blur the page behind them too.
export const NAV_H = 64;
const BLUE = '#3B82F6', VIOLET = '#2563EB', NAVY = '#0F172A';
const TRANS = { transitionProperty: 'background-color, border-color, box-shadow, color, transform', transitionDuration: '180ms', transitionTimingFunction: 'ease' } as any;
function TopNav() {
  const { th, t, tab, setTab, account, avatar, lic, setAdminOpen, setHelpOpen, setHistOpen, supportUnread, adminBadge, logout, settings } = useApp(), lang = settings.lang;
  const L = useLayout();
  const compact = L.full < 1280, H = useRealWindow().height, navH = compact ? 54 : NAV_H; // compact = phone / tablet / small laptop: logo, icons and a menu button
  const [menu, setMenu] = useState<'' | 'tools' | 'user' | 'nav'>(''), [searchOpen, setSearchOpen] = useState(false), [q, setQ] = useState(''), [editOpen, setEditOpen] = useState(false);
  const ref = useRef<TextInput>(null);
  const paid = lic.admin || lic.status === 'paid', slim = L.full < 1400, wide = L.full >= 1700; // slim: icons only on the right; wide: Admin label + Upgrade button too
  const dk = th.dark, ink = dk ? '#FFFFFF' : NAVY, mute = dk ? '#94A3B8' : '#475569', rule = dk ? '#2A3447' : '#D8DEE9', soft = dk ? 'rgba(255,255,255,0.14)' : 'rgba(17,26,58,0.1)';
  // Frosted glass. Lavender + ice-blue tint under the white sheen keeps the dark navy text readable on the site's backdrop; the dark theme uses a deep-violet glass instead.
  const glassFill = dk ? 'linear-gradient(#121826, #121826)' : 'linear-gradient(#FFFFFF, #FFFFFF)'; // solid box: dark (Dark theme) or white (Light theme)
  const glassFx: any = {};
  const chip = (s: any, extra: any = {}) => ({ backgroundColor: s.hovered ? (dk ? '#243044' : '#EEF2F8') : (dk ? '#1A2233' : '#F4F6FA'), borderWidth: 1, borderColor: dk ? '#2A3447' : '#D8DEE9', boxShadow: dk ? 'inset 0 1px 0 rgba(255,255,255,0.06)' : '0 6px 16px -10px rgba(15,23,42,0.3)', cursor: 'pointer', ...TRANS, ...extra }) as any;
  const toolTabs = TOOLS.map((x) => x[0]);
  const padX = compact ? 12 : slim ? 14 : wide ? 28 : 20, radius = 6;
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(true); setTimeout(() => ref.current?.focus(), 30); } if (e.key === 'Escape') { setSearchOpen(false); setMenu(''); } };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);
  const hits = q.trim().length ? SYMBOLS.filter((s) => (s.name + ' ' + s.id).toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8) : [];
  const pick = (s: Sym) => { setDash({ sym: s.id, market: groupOf(s.cat) }); setTab(0); setQ(''); setSearchOpen(false); };
  const ACTIVE = dk ? '#60A5FA' : '#2563EB'; // open page label: lime on the dark box, deep indigo on the white box
  // Active page = no box, no pill. Just a clean label with a thin blue-to-violet underline that grows out from the centre (scaleX with an
  // ease-out curve); on hover a fainter underline previews it, and it retracts smoothly when the page changes. Same size/weight on every link
  // so nothing shifts, and a keyboard-visible focus underline comes for free through the hovered/focused state.
  const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const link = (label: string, on: boolean, onPress: () => void, chevron?: boolean) => (
    <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress} style={((s: any) => ({
      height: 40, paddingHorizontal: slim ? 11 : wide ? 20 : 14, flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'center', cursor: 'pointer',
      backgroundColor: 'transparent', borderWidth: 0, outlineStyle: 'none',
    })) as any}>
      {(s: any) => {
        const hot = s.hovered || s.focused;
        return (<>
          <Text style={{ color: on ? ACTIVE : ink, opacity: on || hot ? 1 : 0.78, fontSize: slim ? 14 : 15, fontWeight: '600', letterSpacing: 0.2, transitionProperty: 'color, opacity', transitionDuration: '220ms', transitionTimingFunction: 'ease' } as any} numberOfLines={1}>{label}</Text>
          {chevron && <Icon name="chevron-down" size={13} color={on ? ACTIVE : mute} />}
          <View pointerEvents="none" style={{
            position: 'absolute', left: slim ? 11 : wide ? 20 : 14, right: slim ? 11 : wide ? 20 : 14, bottom: 3, height: 2.5, borderRadius: 3,
            backgroundImage: `linear-gradient(90deg, ${BLUE} 0%, ${VIOLET} 100%)`,
            opacity: on ? 1 : hot ? 0.45 : 0,
            transform: [{ scaleX: on ? 1 : hot ? 0.55 : 0 }],
            boxShadow: on ? '0 2px 10px -1px rgba(37,99,235,0.65)' : 'none',
            transitionProperty: 'transform, opacity, box-shadow', transitionDuration: '320ms', transitionTimingFunction: EASE,
          } as any} />
        </>);
      }}
    </Pressable>
  );
  // A menu row: a small gradient icon tile, the label and an optional red badge. Alternates blue / violet like the tool cards.
  const item = (icon: string, label: string, onPress: () => void, badge = 0, on = false, danger = false, tone = 0) => {
    const c1 = danger ? '#FF6B8A' : tone % 2 ? VIOLET : BLUE, c2 = danger ? '#E11D48' : tone % 2 ? '#3B82F6' : '#60A5FA';
    return (
      <Pressable key={label} accessibilityRole="button" onPress={() => { setMenu(''); onPress(); }} style={((s: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, height: compact ? 44 : 40, paddingHorizontal: 8, borderRadius: 6, cursor: 'pointer', borderWidth: 1,
        borderColor: on ? 'rgba(37,99,235,0.35)' : s.hovered ? (dk ? '#2A3447' : '#D8DEE9') : 'transparent',
        backgroundColor: s.hovered && !on ? (dk ? '#1A2233' : '#EEF2F8') : 'transparent',
        backgroundImage: on ? 'linear-gradient(135deg, rgba(37,99,235,0.16), rgba(22,119,255,0.14))' : undefined, ...TRANS })) as any}>
        <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundImage: `linear-gradient(150deg, ${c2}, ${c1})`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), 0 6px 12px -6px ' + c1 } as any}>
          <Icon name={icon} size={14} color="#FFFFFF" />
        </View>
        <Text style={{ flex: 1, color: danger ? (dk ? '#FF8FA8' : '#E11D48') : ink, fontSize: 14, fontWeight: on || danger ? '600' : '500' }} numberOfLines={1}>{label}</Text>
        {badge > 0 && <View style={{ minWidth: 20, height: 20, borderRadius: 6, paddingHorizontal: 6, backgroundColor: th.sell, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 10.5, fontWeight: '700' }}>{badge > 99 ? '99+' : badge}</Text></View>}
      </Pressable>
    );
  };
  const name = account?.name ?? '';
  const sep = <View style={{ height: 1, backgroundColor: soft, marginVertical: 6, marginHorizontal: 8 }} />;
  const dropFill = dk ? 'linear-gradient(#121826, #121826)' : 'linear-gradient(#FFFFFF, #FFFFFF)';
  const dropBox = { position: 'absolute', zIndex: 40, borderRadius: 6, borderWidth: 1, borderColor: rule, backgroundImage: dropFill, ...glassFx, boxShadow: dk ? '0 30px 60px -20px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.16)' : '0 30px 60px -22px rgba(15,23,42,0.45), 0 8px 20px -10px rgba(15,23,42,0.2), inset 0 1px 0 rgba(255,255,255,0.95)', padding: 8 } as any;
  const avatarEl = (size: number) => avatar ? <Image source={{ uri: avatar }} style={{ width: size, height: size, borderRadius: size / 2 }} /> : (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundImage: `linear-gradient(150deg, ${BLUE}, ${VIOLET})`, alignItems: 'center', justifyContent: 'center' } as any}><Text style={{ color: '#fff', fontSize: size * 0.42, fontWeight: '700' }}>{(name || '?').trim().charAt(0).toUpperCase()}</Text></View>
  );
  const ring = (size: number) => ({ width: size + 6, height: size + 6, borderRadius: (size + 6) / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.9)', boxShadow: '0 0 0 2px rgba(37,99,235,0.35), 0 6px 16px -6px rgba(37,99,235,0.7)' }) as any;
  const role = lic.admin ? 'Admin' : paid ? 'Premium Trader' : lic.status === 'trial' ? 'Free trial' : 'Account';
  const count = adminBadge.chats + adminBadge.pays;
  const plain = (s: any) => ({ width: 38, height: 38, borderRadius: 6, alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backgroundColor: s.hovered ? (dk ? '#1A2233' : '#EEF2F8') : 'transparent', ...TRANS }) as any;
  const vdiv = <View style={{ width: 1, height: 26, backgroundColor: dk ? 'rgba(255,255,255,0.22)' : 'rgba(15,23,42,0.18)', marginHorizontal: slim ? 4 : 10 }} />;
  return (
    <View style={{ zIndex: 30, paddingTop: 12, paddingBottom: 8, alignItems: 'center' }}>
      <EditProfile visible={editOpen} onClose={() => setEditOpen(false)} />
      {(menu !== '' || searchOpen) && <Pressable onPress={() => { setMenu(''); setSearchOpen(false); }} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 29 } as any} />}
      <View style={{ height: navH, width: compact ? '96%' : '94%', borderRadius: radius, zIndex: 31 }}>
        {/* glass layer: frosted fill, white rim, soft ambient shadow and a glossy top highlight */}
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius, borderWidth: 1, borderColor: rule, backgroundImage: glassFill, ...glassFx, boxShadow: dk ? '0 20px 50px -20px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.18)' : '0 22px 48px -20px rgba(15,23,42,0.45), 0 4px 14px -6px rgba(15,23,42,0.18), inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -1px 0 rgba(255,255,255,0.4)', overflow: 'hidden' } as any}>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '55%', backgroundImage: dk ? 'linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0))' : 'linear-gradient(180deg, rgba(255,255,255,0.5), rgba(255,255,255,0))' } as any} />
        </View>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: padX, gap: slim ? 2 : 6 }}>
          <Pressable onPress={() => setTab(0)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, cursor: 'pointer' } as any}>
            <LogoMark size={40} radius={0} bare />
            {L.full >= 350 && <View>
              <Text style={{ color: ink, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 }} numberOfLines={1}>Chart Reader</Text>
              {!slim && <Text style={{ color: dk ? '#94A3B8' : '#64748B', fontSize: 9, fontWeight: '600', letterSpacing: 2.4, marginTop: 0 }} numberOfLines={1}>TRADING ANALYSIS</Text>}
            </View>}
          </Pressable>
          {!compact && (<>
          <View style={{ width: 1, height: 30, backgroundColor: dk ? 'rgba(255,255,255,0.25)' : 'rgba(15,23,42,0.3)', marginLeft: slim ? 10 : 22, marginRight: slim ? 6 : wide ? 22 : 12 }} />
          {LINKS.map(([label, i]) => link(label, tab === i, () => { setMenu(''); setTab(i); }))}
          <View>
            {link('Tools', menu === 'tools' || toolTabs.includes(tab), () => setMenu(menu === 'tools' ? '' : 'tools'), true)}
          </View>
          </>)}
          <View style={{ flex: 1, minWidth: 8 }} />
          <Pressable accessibilityRole="button" accessibilityLabel="Search" onPress={() => { setSearchOpen((v) => !v); setMenu(''); setTimeout(() => ref.current?.focus(), 30); }} style={plain}>
            <Icon name="search-outline" size={20} color={ink} />
          </Pressable>
          {L.full >= 640 && <>{!compact && vdiv}<LivePill dk={dk} ink={ink} slim={slim} /></>}
          <View style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center', marginLeft: 2 }}><BellButton /></View>
          {lic.admin && !compact && <>{vdiv}
            <Pressable accessibilityRole="button" accessibilityLabel="Admin" onPress={() => setAdminOpen(true)} style={((s: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 7, height: 38, paddingHorizontal: slim ? 9 : 11, borderRadius: 6, cursor: 'pointer', backgroundColor: s.hovered ? (dk ? '#1A2233' : '#EEF2F8') : 'transparent', ...TRANS })) as any}>
              <Icon name="shield-outline" size={18} color={ink} />{wide && <Text style={{ color: ink, fontSize: 15, fontWeight: '700' }}>Admin</Text>}
              {count > 0 && <View style={{ minWidth: 18, height: 18, borderRadius: 6, paddingHorizontal: 5, backgroundColor: th.sell, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 10.5, fontWeight: '700' }}>{count}</Text></View>}
              <Icon name="chevron-down" size={13} color={mute} />
            </Pressable></>}
          {!compact && vdiv}
          {!paid && wide && <Pressable onPress={() => setTab(6)} style={((s: any) => ({ height: 36, paddingHorizontal: 16, borderRadius: 6, justifyContent: 'center', marginRight: 6, backgroundImage: `linear-gradient(135deg, ${BLUE}, ${VIOLET})`, boxShadow: s.hovered ? '0 10px 24px -8px rgba(37,99,235,0.85), inset 0 1px 0 rgba(255,255,255,0.4)' : '0 8px 20px -10px rgba(37,99,235,0.7), inset 0 1px 0 rgba(255,255,255,0.35)', cursor: 'pointer', ...TRANS })) as any}><Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600' }}>Upgrade</Text></Pressable>}
          <View>
            <Pressable accessibilityRole="button" accessibilityLabel="Account menu" onPress={() => setMenu(menu === 'user' ? '' : 'user')} style={((s: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 9, height: 44, paddingLeft: 4, paddingRight: compact ? 4 : 9, borderRadius: 6, cursor: 'pointer', backgroundColor: s.hovered ? (dk ? '#1A2233' : '#EEF2F8') : 'transparent', ...TRANS })) as any}>
              <View style={ring(32)}>{avatarEl(32)}<View style={{ position: 'absolute', right: 0, bottom: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: '#16C784', borderWidth: 2, borderColor: '#FFFFFF' }} /></View>
              {!slim && !compact && <Text style={{ color: ink, fontSize: 15, fontWeight: '700', maxWidth: wide ? 170 : 110 }} numberOfLines={1}>{name}</Text>}
              {!compact && <Icon name="chevron-down" size={14} color={mute} />}
            </Pressable>
            {menu === 'user' && (
              <View style={{ ...dropBox, right: 0, top: 44 + 8, width: 288, maxWidth: L.full - 24 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 6, borderWidth: 1, borderColor: dk ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.9)', backgroundImage: dk ? 'linear-gradient(135deg, rgba(37,99,235,0.28), rgba(22,119,255,0.2))' : 'linear-gradient(135deg, rgba(220,208,255,0.75), rgba(191,217,255,0.7))', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)' } as any}>
                  <View style={ring(44)}>{avatarEl(44)}</View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: ink, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{name || 'Account'}</Text>
                    {!!account?.email && <Text style={{ color: mute, fontSize: 11.5, marginTop: 1 }} numberOfLines={1}>{account.email}</Text>}
                    <View style={{ alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 8, height: 18, borderRadius: 6, justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(37,99,235,0.35)', backgroundColor: dk ? 'rgba(37,99,235,0.3)' : 'rgba(255,255,255,0.6)' }}><Text style={{ color: dk ? '#E4D9FF' : VIOLET, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.3 }}>{role}</Text></View>
                  </View>
                </View>
                <View style={{ height: 6 }} />
                {item('person-outline', 'Edit profile', () => setEditOpen(true), 0, false, false, 0)}
                {item('settings-outline', 'Settings', () => setTab(6), 0, false, false, 1)}
                {item('chatbubbles-outline', 'Help chat', () => setHelpOpen(true), supportUnread, false, false, 0)}
                {lic.admin && item('shield-checkmark-outline', 'Admin panel', () => setAdminOpen(true), count, false, false, 1)}
                {!paid && item('sparkles-outline', 'Upgrade', () => setTab(6), 0, false, false, 0)}
                {sep}
                {item('log-out-outline', t('logout'), () => logout(), 0, false, true)}
              </View>
            )}
          </View>
          {compact && (
            <Pressable accessibilityRole="button" accessibilityLabel="Menu" onPress={() => { setMenu(menu === 'nav' ? '' : 'nav'); setSearchOpen(false); }} style={((s: any) => chip(s, { width: 38, height: 38, marginLeft: 4, borderRadius: 6, alignItems: 'center', justifyContent: 'center', ...(menu === 'nav' ? { backgroundColor: 'rgba(37,99,235,0.18)', borderColor: 'rgba(37,99,235,0.4)' } : {}) }))}>
              <Icon name={menu === 'nav' ? 'close' : 'menu'} size={20} color={ink} />
            </Pressable>
          )}
        </View>
        {compact && menu === 'nav' && (
          <View style={{ ...dropBox, left: 0, right: 0, top: navH + 10, maxHeight: Math.max(240, H - navH - 40) }}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {LINKS.map(([label, i, icon], n) => item(icon, label, () => setTab(i), 0, tab === i, false, n))}
              {lic.admin && item('shield-checkmark-outline', 'Admin panel', () => setAdminOpen(true), count, false, false, 1)}
              {sep}
              <Text style={{ color: mute, fontSize: 11, fontWeight: '700', letterSpacing: 1.4, paddingHorizontal: 12, paddingVertical: 4 }}>TOOLS</Text>
              {TOOLS.map(([i, icon], n) => item(icon, t(NAV[i].key), () => setTab(i), 0, tab === i, false, n))}
              {item('chatbubbles-outline', 'Help chat', () => setHelpOpen(true), supportUnread, false, false, 0)}
              {!paid && item('sparkles-outline', 'Upgrade', () => setTab(6), 0, false, false, 1)}
            </ScrollView>
          </View>
        )}
        {searchOpen && (
          <View style={{ position: 'absolute', top: navH + 10, right: padX, width: Math.min(440, L.full - 2 * padX), zIndex: 41 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 42, paddingHorizontal: 14, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(37,99,235,0.45)', backgroundImage: dropFill, ...glassFx, boxShadow: '0 24px 50px -22px rgba(15,23,42,0.5), 0 0 0 3px rgba(37,99,235,0.1), inset 0 1px 0 rgba(255,255,255,0.9)' } as any}>
              <Icon name="search" size={17} color={mute} />
              <TextInput ref={ref} value={q} onChangeText={setQ} placeholder="Search symbols, pairs or instruments" placeholderTextColor={mute} style={{ flex: 1, color: ink, fontSize: 14, outlineStyle: 'none' } as any} />
              <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: soft }}><Text style={{ color: mute, fontSize: 10.5, fontWeight: '600' }}>Esc</Text></View>
            </View>
            {hits.length > 0 && (
              <View style={{ ...dropBox, position: 'relative', marginTop: 8 }}>
                {hits.map((s) => (
                  <Pressable key={s.id} onPress={() => pick(s)} style={((x: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 7, borderRadius: 6, cursor: 'pointer', backgroundColor: x.hovered ? (dk ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.65)') : 'transparent', ...TRANS })) as any}>
                    <Coin s={s} size={28} />
                    <Text style={{ flex: 1, color: ink, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{s.name}</Text>
                    <Text style={{ color: mute, fontSize: 10.5, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' }}>{groupOf(s.cat)}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}
      </View>
      {menu === 'tools' && !compact && <ToolsOrbit th={th} top={navH + 20} onClose={() => setMenu('')} items={TOOL_GROUPS.flatMap(([, ids]) => ids).map((id): OrbitItem => {
        const special = typeof id === 'string', icon = id === 'help' ? 'chatbubbles-outline' : toolIcon[id as number];
        const en = lang === 'en', label = id === 'help' ? 'Help Chat' : en && id === 5 ? 'History' : en && id === 4 ? 'Risk & TP Planner' : en && id === 14 ? 'Help & About' : t(NAV[id as number].key);
        const go = () => { setMenu(''); if (id === 'help') setHelpOpen(true); else setTab(id as number); };
        return { id: String(id), label, icon, on: !special && tab === id, badge: id === 'help' ? supportUnread : 0, go };
      })} />}
    </View>
  );
}

// "Live" status: a glowing dot (green = live, amber = connecting, red = offline) and, on wide screens, its label. No box around it, like the design reference.
function LivePill({ dk, ink, slim }: { dk: boolean; ink: string; slim: boolean }) {
  const { th } = useApp();
  const [st, setSt] = useState(flags.status);
  useEffect(() => subscribeFeed(() => setSt((p) => (flags.status === p ? p : flags.status))), []);
  const c = st === 'live' ? '#16C784' : st === 'offline' ? th.sell : th.gold;
  return (
    <View accessibilityLabel={st === 'live' ? 'Live' : st === 'offline' ? 'Offline' : 'Syncing'} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 38, paddingHorizontal: slim ? 8 : 10 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c, boxShadow: `0 0 0 3px ${c}2E, 0 0 10px ${c}` } as any} />
      {!slim && <Text style={{ color: ink, fontSize: 14, fontWeight: '500' }}>{st === 'live' ? 'Live' : st === 'offline' ? 'Offline' : 'Syncing'}</Text>}
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
        <View key={r.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 6, borderWidth: 1, borderColor: r.tone + '88', backgroundColor: th.solid }}>
          <Icon name={r.icon} size={19} color={r.tone} />
          <Text style={{ flex: 1, color: th.text, fontSize: 13, lineHeight: 18 }}>{r.text}</Text>
          {r.btns.map(([l, f]) => (
            <Pressable key={l} onPress={f} style={((st: any) => ({ height: 32, paddingHorizontal: 14, borderRadius: 6, alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backgroundColor: r.tone, opacity: st.hovered ? 0.9 : 1 })) as any}><Text style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' }}>{l}</Text></Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

export function DesktopShell({ children }: { children: React.ReactNode }) {
  const { tab, th } = useApp(); // no side panels on any page: every page uses the full width under the top bar
  return (
    <View style={{ flex: 1 }}>
      <TopNav />
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <View style={{ flex: 1, minWidth: 0, ...sheet(th) }}>{tab !== 13 && tab !== 4 && <Notices />}{children}</View>
      </View>
    </View>
  );
}
