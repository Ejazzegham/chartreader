import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, Linking, Platform } from 'react-native';
import { useApp } from './store';
import { Icon } from './ui';
import { PropFirm, domainOf, searchFirms } from './propFirms';

// One directory page for any list of companies with a website (Prop Firms, Forex Brokers): optional top-three cards, a table with a Visit website link,
// search, sort, a "how to choose" section and a risk note. The text and lists come from the page that uses it (PropFirmsBody.tsx, BrokersBody.tsx).
export type DirectoryCfg = { items: PropFirm[]; ranked: boolean; noun: string; nouns: string; icon: string; listTitle: string; intro: string; chooseTitle: string; chooseSub: string; checks: { icon: string; title: string; body: string }[]; disclaimer: string };
const WEB = Platform.OS === 'web';
const hand: any = WEB ? { cursor: 'pointer' } : null;

function usePal() {
  const { th } = useApp();
  const d = th.dark;
  return { th, dark: d, alt: d ? th.panel2 : '#F5F8FE', card: d ? th.panel : '#FFFFFF', border: d ? th.line : '#E5EBF5', head: d ? th.text : '#0B1B3F', body: d ? th.dim : '#5A6B89', blue: th.accent, soft: th.accent + (d ? '26' : '14'), shadow: d ? '#000000' : '#1B3A7A' };
}
type Pal = ReturnType<typeof usePal>;

const MEDAL = ['#F5B93A', '#B6C0D1', '#D08A52'];
const lum = (h: string) => { const n = parseInt(h.slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255].map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }).reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0); };
const txtOn = (bg: string) => { const l = lum(bg); return 1.05 / (l + 0.05) >= (l + 0.05) / (lum('#0B1220') + 0.05) ? '#FFFFFF' : '#0B1220'; };
const initials = (n: string) => { const w = n.split(/\s+/).filter((x) => /[A-Za-z0-9]/.test(x)); return (w.length > 1 ? w[0][0] + w[1][0] : n.slice(0, 2)).toUpperCase(); };

function Panel({ P, children, style }: { P: Pal; children: React.ReactNode; style?: any }) {
  return <View style={[{ backgroundColor: P.card, borderRadius: 14, borderWidth: 1, borderColor: P.border, padding: 20, gap: 16, shadowColor: P.shadow, shadowOpacity: P.dark ? 0.3 : 0.07, shadowRadius: 22, shadowOffset: { width: 0, height: 8 } }, style]}>{children}</View>;
}
function Head({ P, icon, title, sub, right }: { P: Pal; icon: string; title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1, minWidth: 200 }}>
        <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: P.soft, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={20} color={P.blue} /></View>
        <View style={{ flexShrink: 1 }}>
          <Text accessibilityRole="header" style={{ color: P.head, fontSize: 16, fontWeight: '800' }}>{title}</Text>
          {!!sub && <Text style={{ color: P.body, fontSize: 12.5, lineHeight: 18, marginTop: 1 }}>{sub}</Text>}
        </View>
      </View>
      {right}
    </View>
  );
}
function Chip({ P, label, on, onPress }: { P: Pal; label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole={'radio' as any} accessibilityState={{ selected: on, checked: on }}
      style={((s: any) => ({ height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center', borderWidth: 1, borderColor: on ? P.blue : P.border, backgroundColor: on ? P.blue : s.hovered ? P.soft : P.alt, ...hand })) as any}>
      <Text style={{ color: on ? P.th.onAccent : P.head, fontSize: 13, fontWeight: on ? '800' : '600' }}>{label}</Text>
    </Pressable>
  );
}

// a real link: on the website it is an <a> that opens a new tab (so right-click and copy link work); in the app it opens the browser
function FirmLink({ f, style, children }: { f: PropFirm; style: (hovered: boolean) => any; children: React.ReactNode }) {
  const extra: any = WEB ? { href: f.url, hrefAttrs: { target: '_blank', rel: 'noopener noreferrer' } } : { onPress: () => { Linking.openURL(f.url).catch(() => {}); } };
  return <Pressable accessibilityRole="link" accessibilityLabel={`Visit ${f.name} website, ${domainOf(f.url)}`} {...extra} style={((s: any) => style(!!s.hovered)) as any}>{children}</Pressable>;
}
function VisitBtn({ P, f, compact }: { P: Pal; f: PropFirm; compact?: boolean }) {
  return (
    <FirmLink f={f} style={(h) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: compact ? 38 : 44, paddingHorizontal: compact ? 14 : 20, borderRadius: 10, backgroundColor: h ? P.blue + '30' : P.soft, borderWidth: 1, borderColor: P.blue + '55', ...hand })}>
      <Text style={{ color: P.blue, fontSize: 13.5, fontWeight: '800' }}>Visit website</Text>
      <Icon name="open-outline" size={compact ? 14 : 15} color={P.blue} />
    </FirmLink>
  );
}
function Avatar({ P, f, size = 40 }: { P: Pal; f: PropFirm; size?: number }) {
  const th = P.th, cols = [th.accent, th.accent2, th.buy, th.gold, '#D77CF2', '#2F6BFF'], c = cols[(f.rank - 1) % cols.length];
  return <View style={{ width: size, height: size, borderRadius: size / 3, backgroundColor: c + '22', borderWidth: 1, borderColor: c + '55', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: P.dark ? c : P.head, fontSize: size * 0.34, fontWeight: '900' }}>{initials(f.name)}</Text></View>;
}
function Rank({ f, size = 34, medal = true }: { f: PropFirm; size?: number; medal?: boolean }) {
  const m = medal && f.rank <= 3 ? MEDAL[f.rank - 1] : null;
  return <View accessible accessibilityLabel={`Rank ${f.rank}`} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: m ?? 'transparent', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: m ? txtOn(m) : '#7C8AA8', fontSize: size * 0.42, fontWeight: '900', fontVariant: ['tabular-nums'] } as any}>{f.rank}</Text></View>;
}

export default function DirectoryBody({ w, cfg }: { w: number; cfg: DirectoryCfg }) {
  const P = usePal(), th = P.th;
  const [q, setQ] = useState(''), [sort, setSort] = useState<'rank' | 'az'>('rank');
  const { items, ranked } = cfg;
  const wide = w >= 760, three = w >= 900;
  const found = useMemo(() => { const r = searchFirms(q, items); return sort === 'az' ? [...r].sort((a, b) => a.name.localeCompare(b.name)) : r; }, [q, sort, items]);
  const podium = ranked && sort === 'rank' && !q.trim() && three;
  const rows = podium ? found.filter((f) => f.rank > 3) : found;
  const top = items.slice(0, 3);

  return (
    <View style={{ gap: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 12, backgroundColor: P.soft, borderWidth: 1, borderColor: P.blue + '33' }}>
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: P.blue, alignItems: 'center', justifyContent: 'center' }}><Icon name="information" size={20} color={th.onAccent} /></View>
        <Text style={{ color: P.head, fontSize: 13, lineHeight: 20, flex: 1 }}>{cfg.intro}</Text>
      </View>

      {podium && (
        <View style={{ flexDirection: 'row', gap: 16 }}>
          {top.map((f) => (
            <View key={f.name} style={{ flex: 1, minWidth: 0, borderRadius: 14, borderWidth: 1, borderColor: MEDAL[f.rank - 1] + '88', backgroundColor: P.card, padding: 20, gap: 14, overflow: 'hidden', shadowColor: P.shadow, shadowOpacity: P.dark ? 0.3 : 0.07, shadowRadius: 22, shadowOffset: { width: 0, height: 8 } }}>
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: MEDAL[f.rank - 1] }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Avatar P={P} f={f} size={52} />
                <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}><Text style={{ color: P.body, fontSize: 12.5, fontWeight: '700' }}>Rank</Text><Rank f={f} size={38} medal={ranked} /></View>
              </View>
              <View style={{ gap: 2 }}>
                <Text style={{ color: P.head, fontSize: 22, fontWeight: '900', letterSpacing: -0.4 }} numberOfLines={1}>{f.name}</Text>
                <Text style={{ color: P.body, fontSize: 13 }} numberOfLines={1}>{domainOf(f.url)}</Text>
              </View>
              <VisitBtn P={P} f={f} />
            </View>
          ))}
        </View>
      )}

      <Panel P={P}>
        <Head P={P} icon={cfg.icon} title={podium ? `More ${cfg.listTitle}` : `All ${cfg.listTitle}`} sub={`${found.length} of ${items.length} ${cfg.nouns}${q.trim() ? ` match “${q.trim()}”` : ranked ? ', ranked' : ''}`}
          right={<View style={{ flexDirection: 'row', gap: 8 }}><Chip P={P} label={ranked ? 'By rank' : 'Listed order'} on={sort === 'rank'} onPress={() => setSort('rank')} /><Chip P={P} label="A to Z" on={sort === 'az'} onPress={() => setSort('az')} /></View>} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: P.border, backgroundColor: P.alt }}>
          <Icon name="search" size={18} color={P.body} />
          <TextInput value={q} onChangeText={setQ} placeholder={`Search a ${cfg.noun} or website`} placeholderTextColor={P.body} accessibilityLabel={`Search ${cfg.nouns}`} autoCapitalize="none" autoCorrect={false}
            style={{ flex: 1, color: P.head, fontSize: 14, outlineStyle: 'none' } as any} />
          {!!q && <Pressable onPress={() => setQ('')} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8} style={hand}><Icon name="close-circle" size={18} color={P.body} /></Pressable>}
        </View>

        {wide && rows.length > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 14 }}>
            <Text style={{ width: 34, color: P.body, fontSize: 12, fontWeight: '700', textAlign: 'center' }}>{ranked ? 'Rank' : 'No.'}</Text>
            <Text style={{ flex: 1.2, color: P.body, fontSize: 12, fontWeight: '700', marginLeft: 56 }}>{cfg.noun.charAt(0).toUpperCase() + cfg.noun.slice(1)}</Text>
            <Text style={{ flex: 1, color: P.body, fontSize: 12, fontWeight: '700' }}>Website</Text>
            <View style={{ width: 150 }} />
          </View>
        )}
        <View style={{ gap: 8 }}>
          {rows.map((f) => (
            <View key={f.name} style={{ flexDirection: 'row', alignItems: 'center', gap: wide ? 16 : 12, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: ranked && f.rank <= 3 ? MEDAL[f.rank - 1] + '88' : P.border, backgroundColor: P.card }}>
              <Rank f={f} medal={ranked} />
              <Avatar P={P} f={f} />
              {wide ? (
                <>
                  <Text style={{ flex: 1.2, color: P.head, fontSize: 14.5, fontWeight: '800' }} numberOfLines={1}>{f.name}</Text>
                  <Text style={{ flex: 1, color: P.body, fontSize: 13.5 }} numberOfLines={1}>{domainOf(f.url)}</Text>
                  <View style={{ width: 150 }}><VisitBtn P={P} f={f} compact /></View>
                </>
              ) : (
                <>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: P.head, fontSize: 14.5, fontWeight: '800' }} numberOfLines={2}>{f.name}</Text>
                    <Text style={{ color: P.body, fontSize: 12.5 }} numberOfLines={1}>{domainOf(f.url)}</Text>
                  </View>
                  <FirmLink f={f} style={(h) => ({ width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: h ? P.blue + '30' : P.soft, ...hand })}><Icon name="open-outline" size={18} color={P.blue} /></FirmLink>
                </>
              )}
            </View>
          ))}
          {rows.length === 0 && (
            <View style={{ alignItems: 'center', gap: 8, padding: 28 }}>
              <Text style={{ color: P.head, fontSize: 15, fontWeight: '800' }}>No {cfg.noun} matches “{q.trim()}”</Text>
              <Text style={{ color: P.body, fontSize: 13 }}>Check the spelling or search by part of the website name.</Text>
              <Pressable onPress={() => setQ('')} accessibilityRole="button" style={((s: any) => ({ height: 40, paddingHorizontal: 18, borderRadius: 10, justifyContent: 'center', backgroundColor: s.hovered ? P.blue + '30' : P.soft, ...hand })) as any}><Text style={{ color: P.blue, fontWeight: '800', fontSize: 13.5 }}>Clear search</Text></Pressable>
            </View>
          )}
        </View>
      </Panel>

      <Panel P={P} style={{ backgroundColor: P.dark ? th.panel : th.accent2 + '0A' }}>
        <Head P={P} icon="shield-checkmark-outline" title={cfg.chooseTitle} sub={cfg.chooseSub} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {cfg.checks.map((c) => (
            <View key={c.title} style={{ flexGrow: 1, flexBasis: w >= 1000 ? '23%' : w >= 640 ? '47%' : '100%', minWidth: 0, flexDirection: 'row', gap: 14, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: P.border, backgroundColor: P.card }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: th.accent2 + '1A', alignItems: 'center', justifyContent: 'center' }}><Icon name={c.icon} size={22} color={th.accent2} /></View>
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <Text style={{ color: P.head, fontSize: 14, fontWeight: '800' }}>{c.title}</Text>
                <Text style={{ color: P.body, fontSize: 12.5, lineHeight: 18 }}>{c.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </Panel>

      <View style={{ flexDirection: 'row', gap: 12, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: th.gold + '66', backgroundColor: th.gold + '14' }}>
        <Icon name="warning-outline" size={20} color={th.gold} />
        <Text style={{ flex: 1, color: P.head, fontSize: 12.5, lineHeight: 19 }}>{cfg.disclaimer}</Text>
      </View>
    </View>
  );
}
