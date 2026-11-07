import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Platform, Image, PanResponder } from 'react-native';
import Svg, { Path, Circle, G, Rect, Text as SvgText } from 'react-native-svg';
import { getSignupMap, getSignupMapDiag, pingVisit, SignupMapData, VisitCounts } from './license';
import { MapData, VB, project, zoomBox } from './mapMath';

// "Our community around the world" (mockup version). Top: round icon, title, subtitle. Under it: the member and country counters with their 30-day growth badge, and the
// period filter (All / This Month / This Year / All Time / calendar range). Below: the latest members (flag, name, country, time) and the dark "Community Reach" map card
// with zoom buttons, every country in its own colour, a dot for every city. Tap a country (or a name / flag) to zoom in; drag to move the map once it is zoomed.
// Numbers come from the server (GET /public/signups?from=&to=, POST /public/visit); country shapes from public/world-map.json; flags from public/flags/xx.svg.
// Website only. To use the real background picture from the mockup, put it in public/community-bg.jpg and set HERO_BG below to '/community-bg.jpg'.

const HERO_BG = ''; // '' = a drawn blue background with a globe; '/community-bg.jpg' = your own picture
const INK = '#0B1B4D', MUTED = '#5B6B8C', LINE = '#E6ECF8', BLUE = '#1F4BFF', NAVY = '#071A45', DOT = '#FF4D6D';
const VIVID = ['#FF9F43', '#FFD93D', '#4CD97B', '#2FD3E0', '#5B9BFF', '#9B7BFF', '#E86BF0', '#FF6B8B'];
const tone = (cc: string) => (cc.charCodeAt(0) * 31 + cc.charCodeAt(1)) % 8;
const glass: any = { backgroundColor: 'rgba(255,255,255,0.74)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(14px)', boxShadow: '0 10px 30px rgba(40,70,160,0.14)' };
const fmt = (n: number) => n.toLocaleString('en-US');
const ago = (t: number) => {
  if (!t) return '';
  const m = Math.max(1, Math.round((Date.now() - t) / 60000)); if (m < 60) return m + 'm ago';
  const h = Math.round(m / 60); if (h < 24) return h + 'h ago';
  const d = Math.round(h / 24); if (d < 31) return d + 'd ago';
  const mo = Math.round(d / 30); return mo < 12 ? mo + 'mo ago' : Math.round(mo / 12) + 'y ago';
};

type Period = 'all' | 'month' | 'year' | 'alltime' | 'custom';
const PERIODS: [Period, string][] = [['all', 'All'], ['month', 'This Month'], ['year', 'This Year'], ['alltime', 'All Time']];
const rangeOf = (p: Period, c: { from: string; to: string }): { from?: number; to?: number } => {
  const now = new Date();
  if (p === 'month') return { from: new Date(now.getFullYear(), now.getMonth(), 1).getTime() };
  if (p === 'year') return { from: new Date(now.getFullYear(), 0, 1).getTime() };
  if (p === 'custom') return { from: c.from ? new Date(c.from + 'T00:00:00').getTime() : undefined, to: c.to ? new Date(c.to + 'T23:59:59').getTime() : undefined };
  return {}; // all, alltime
};

let mapCache: MapData | null = null, mapDiag = 'not asked yet';
async function loadMap(): Promise<MapData | null> {
  if (mapCache) return mapCache;
  try { const r = await fetch('/world-map.json'); if (!r.ok) { mapDiag = '/world-map.json answered HTTP ' + r.status + ' (the file is missing from the deployed site)'; return null; } const j = await r.json(); if (j && j.c && j.p) { mapCache = j; mapDiag = 'ok'; } else mapDiag = '/world-map.json is not the map file'; } catch (e: any) { mapDiag = '/world-map.json failed: ' + String(e?.message || e).slice(0, 80); }
  return mapCache;
}
// Open the website with ?mapdebug at the end of the address to see why the map is not showing.
const DEBUG = typeof location !== 'undefined' && /mapdebug/.test(location.search + location.hash);

// Small drawn icons, so this card does not depend on the icon set of the app.
function Ico({ n, s = 20, c = '#FFFFFF', w = 2, hole = BLUE }: { n: string; s?: number; c?: string; w?: number; hole?: string }) {
  const st: any = { stroke: c, strokeWidth: w, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' };
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24">
      {n === 'people' ? <><Circle cx={12} cy={8} r={3.5} fill={c} /><Path d="M5.2 20.5c0-4 3-6.4 6.8-6.4s6.8 2.4 6.8 6.4z" fill={c} /><Circle cx={4.8} cy={9.8} r={2.3} fill={c} opacity={0.8} /><Circle cx={19.2} cy={9.8} r={2.3} fill={c} opacity={0.8} /></> : null}
      {n === 'globe' ? <><Circle cx={12} cy={12} r={9} {...st} /><Path d="M3 12h18M4.6 7.5h14.8M4.6 16.5h14.8M12 3c3.2 3.2 3.2 14.8 0 18M12 3c-3.2 3.2-3.2 14.8 0 18" {...st} strokeWidth={w * 0.8} /></> : null}
      {n === 'bolt' ? <Path d="M13.5 2L4.5 13.5h6L9.5 22l9-11.5h-6z" fill={c} /> : null}
      {n === 'pin' ? <><Path d="M12 22.5s7.5-6.4 7.5-12.5a7.5 7.5 0 10-15 0c0 6.1 7.5 12.5 7.5 12.5z" fill={c} /><Circle cx={12} cy={10} r={2.8} fill={hole} /></> : null}
      {n === 'calendar' ? <><Rect x={3.5} y={5} width={17} height={15.5} rx={3.5} {...st} /><Path d="M3.5 10h17M8 3v4M16 3v4" {...st} /><Rect x={7.5} y={13} width={3} height={3} rx={0.8} fill={c} /></> : null}
      {n === 'chev' ? <Path d="M6 9l6 6 6-6" {...st} strokeWidth={2.6} /> : null}
      {n === 'right' ? <Path d="M5 12h14M13 6l6 6-6 6" {...st} /> : null}
      {n === 'up' ? <Path d="M12 19V5M6 11l6-6 6 6" {...st} strokeWidth={2.6} /> : null}
      {n === 'down' ? <Path d="M12 5v14M6 13l6 6 6-6" {...st} strokeWidth={2.6} /> : null}
      {n === 'plus' ? <Path d="M12 5v14M5 12h14" {...st} strokeWidth={2.6} /> : null}
      {n === 'minus' ? <Path d="M5 12h14" {...st} strokeWidth={2.6} /> : null}
      {n === 'locate' ? <><Circle cx={12} cy={12} r={6.5} {...st} /><Circle cx={12} cy={12} r={2.2} fill={c} /><Path d="M12 2v3M12 19v3M2 12h3M19 12h3" {...st} /></> : null}
    </Svg>
  );
}

function Flag({ cc, w = 40 }: { cc: string; w?: number }) {
  const [bad, setBad] = useState(false);
  if (bad) return <View style={{ width: w, height: w, borderRadius: w / 2, backgroundColor: '#E3E9F5' }} />;
  return <Image source={{ uri: '/flags/' + cc.toLowerCase() + '.svg' }} onError={() => setBad(true)} resizeMode="cover" style={{ width: w, height: w, borderRadius: w / 2, borderWidth: 1, borderColor: '#00000018' }} />;
}

// One big counter card (members / countries) with its growth badge.
function StatCard({ kind, value, label, pct, wide }: { kind: 'members' | 'countries'; value: string; label: string; pct?: number; wide: boolean }) {
  const m = kind === 'members';
  const col = m ? '#5B3FD6' : '#E85D00', bg = m ? 'linear-gradient(115deg,rgba(255,255,255,0.92) 0%,#E6DEFF 100%)' : 'linear-gradient(115deg,rgba(255,255,255,0.92) 0%,#FFE2C8 100%)';
  const up = (pct ?? 0) >= 0;
  return (
    <View style={{ flexGrow: 1, flexBasis: wide ? 330 : 150, maxWidth: wide ? 420 : undefined, flexDirection: 'row', alignItems: 'center', gap: wide ? 16 : 10, paddingVertical: wide ? 14 : 10, paddingHorizontal: wide ? 18 : 12, borderRadius: 22, backgroundImage: bg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.95)', boxShadow: '0 10px 28px rgba(60,70,170,0.16)' } as any}>
      <View style={{ width: wide ? 66 : 44, height: wide ? 66 : 44, borderRadius: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: m ? '#DDD3FF' : '#FF9A3D' }}>
        <Ico n={m ? 'people' : 'globe'} s={wide ? 32 : 22} c={m ? col : '#FFFFFF'} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: INK, fontSize: wide ? 38 : 26, fontWeight: '800', lineHeight: wide ? 42 : 30, letterSpacing: -0.5 }}>{value}</Text>
        <Text numberOfLines={1} style={{ color: INK, fontSize: wide ? 17 : 13, fontWeight: '500' }}>{label}</Text>
      </View>
      {typeof pct === 'number' ? (
        <View accessibilityLabel={'Change in the last 30 days'} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 11, borderRadius: 999, backgroundColor: m ? '#E7E0FF' : '#FFE4D0' }}>
          <Ico n={up ? 'up' : 'down'} s={14} c={col} w={2.4} />
          <Text style={{ color: col, fontSize: wide ? 16 : 13, fontWeight: '800' }}>{(up ? '+' : '') + pct + '%'}</Text>
        </View>
      ) : null}
    </View>
  );
}

function RoundBtn({ n, onPress, label }: { n: string; onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Ico n={n} s={22} c={INK} w={2.4} />
    </Pressable>
  );
}

const inputCss: any = { padding: '9px 11px', borderRadius: 10, border: '1px solid ' + LINE, fontSize: 14, color: INK, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', background: '#fff' };

function Inner() {
  const [map, setMap] = useState<MapData | null>(mapCache);
  const [data, setData] = useState<SignupMapData | null>(null);
  const [vc, setVc] = useState<VisitCounts | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [box, setBox] = useState<VB | null>(null); // a view the person made with the zoom buttons or by dragging (wins over the country view)
  const [period, setPeriod] = useState<Period>('all');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [draft, setDraft] = useState({ from: '', to: '' });
  const [picker, setPicker] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [W0, setW0] = useState(0); // width of the whole card: decides one column or two
  const [W, setW] = useState(0); // width of the map itself
  const [, bump] = useState(0); // re-draw when a request ends, so the debug line is current
  const [vb, setVb] = useState<VB | null>(null);
  const cur = useRef<VB | null>(null), Wref = useRef(0), fullRef = useRef<VB>([0, 0, 1000, 435]), zoomed = useRef(false), start = useRef<VB | null>(null);

  useEffect(() => { let on = true; loadMap().then((m) => { if (on) { bump((n) => n + 1); if (m) setMap(m); } }); return () => { on = false; }; }, []);
  useEffect(() => { // live numbers for the chosen period: load now, then refresh every minute
    let on = true;
    const r = rangeOf(period, custom);
    const go = () => getSignupMap(r).then((d) => { if (on) { bump((n) => n + 1); if (d) setData(d); } });
    go(); const t = setInterval(go, 60000);
    return () => { on = false; clearInterval(t); };
  }, [period, custom.from, custom.to]);
  useEffect(() => { // visitor counter: the first call counts this visit, the next ones (every minute) only keep "online now" fresh
    let on = true;
    const go = () => pingVisit().then((v) => { if (on && v) setVc(v); });
    go(); const t = setInterval(go, 60000);
    return () => { on = false; clearInterval(t); };
  }, []);

  const aspect = map ? map.w / map.h : 2.3;
  const full: VB = useMemo(() => [0, 0, map?.w || 1000, map?.h || 435], [map]);
  fullRef.current = full; Wref.current = W;
  const target: VB = useMemo(() => box || (map && sel && map.c[sel] ? zoomBox(map.c[sel].b, aspect) : full), [box, map, sel, aspect, full]);
  const tKey = target.map((v) => v.toFixed(1)).join();
  useEffect(() => { // glide from the current view to the new one
    if (!map) return;
    const from = cur.current || target, t0 = Date.now();
    let raf = 0;
    const step = () => {
      const k = Math.min(1, (Date.now() - t0) / 450), e = 1 - Math.pow(1 - k, 3);
      const v = from.map((a, i) => a + (target[i] - a) * e) as VB;
      cur.current = v; setVb(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [map, tKey]);

  const select = (cc: string | null) => { setBox(null); setSel(cc); };
  const zoomBy = (f: number) => {
    const c = cur.current || fullRef.current, F = fullRef.current, w = c[2] / f, h = c[3] / f;
    if (w >= F[2] - 0.5) { select(null); return; } // zoomed all the way out
    const nw = Math.max(w, F[2] / 14), nh = nw / (c[2] / c[3]);
    const x = Math.min(Math.max(c[0] + (c[2] - nw) / 2, F[0]), F[0] + F[2] - nw), y = Math.min(Math.max(c[1] + (c[3] - nh) / 2, F[1]), F[1] + F[3] - nh);
    setBox([x, y, nw, nh]);
  };
  const responder = useMemo(() => PanResponder.create({ // drag the map, but only once it is zoomed in (so the page can still scroll with a finger)
    onMoveShouldSetPanResponder: (_, g) => zoomed.current && Math.abs(g.dx) + Math.abs(g.dy) > 6,
    onPanResponderGrant: () => { start.current = cur.current ? ([...cur.current] as VB) : null; },
    onPanResponderMove: (_, g) => {
      const s = start.current, F = fullRef.current; if (!s || !Wref.current) return;
      const k = s[2] / Wref.current, x = Math.min(Math.max(s[0] - g.dx * k, F[0]), F[0] + F[2] - s[2]), y = Math.min(Math.max(s[1] - g.dy * k, F[1]), F[1] + F[3] - s[3]);
      const nb: VB = [x, y, s[2], s[3]]; cur.current = nb; setVb(nb);
    },
    onPanResponderRelease: () => { if (cur.current) setBox([...cur.current] as VB); },
  }), []);

  const dbg = DEBUG ? <Text style={{ color: '#B4235A', fontSize: 11, fontFamily: 'monospace' as any }}>{`map debug: map file: ${mapDiag} | numbers: ${getSignupMapDiag()}`}</Text> : null;
  if (!map || !data) return dbg ? <View style={{ gap: 6, backgroundColor: '#FFF', padding: 14, borderRadius: 14 }}><Text style={{ color: INK, fontSize: 15, fontWeight: '700' }}>Our community around the world</Text>{dbg}</View> : null; // server or map file not reachable: show nothing rather than a broken box (add ?mapdebug to the address to see why)

  const v = vb || target, unit = v[2] / 1000; // one on-screen pixel stays the same size at every zoom
  zoomed.current = v[2] < full[2] * 0.96;
  const wide = W0 >= 760;
  const counts: Record<string, number> = {};
  for (const c of data.countries) counts[c.cc] = c.n;
  const max = Math.max(5, ...data.countries.map((c) => c.n));
  const nameOf = (cc: string) => { const s = data.countries.find((c) => c.cc === cc)?.name; return s && s !== cc ? s : map.c[cc]?.n || cc; }; // the server's short name ("United States") first
  const H = W ? W / aspect : 0;
  const selN = sel ? counts[sel] || 0 : 0;
  const cities = sel ? data.places.filter((p) => p.cc === sel) : [];
  const recentAll = (data.recent || []).filter((m) => !sel || m.cc === sel);
  const recent = showAll ? recentAll : recentAll.slice(0, 5);
  const visitors = vc?.visitors ?? data.visitors, online = vc?.online ?? data.online;

  // City names on the country map: biggest city first; a name goes to the right of its dot, or to the left, or is left out when both would cover another name (every city is also in the list).
  const labels: { key: number; x: number; y: number; end: boolean; text: string }[] = [];
  if (sel) {
    const boxes: number[][] = [], hit = (a: number[], b: number[]) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
    cities.slice(0, 12).forEach((p, i) => {
      if (!p.city) return;
      const [x, y] = project(map.p, p.lon, p.lat), text = p.city + (p.n > 1 ? ' · ' + p.n : ''), w = text.length * 6.4 * unit, t = y - 9 * unit, b = y + 4 * unit;
      const right = [x + 9 * unit, t, x + 9 * unit + w, b], left = [x - 9 * unit - w, t, x - 9 * unit, b];
      if (!boxes.some((q) => hit(right, q))) { boxes.push(right); labels.push({ key: i, x: right[0], y: y + 3.5 * unit, end: false, text }); }
      else if (!boxes.some((q) => hit(left, q))) { boxes.push(left); labels.push({ key: i, x: left[2], y: y + 3.5 * unit, end: true, text }); }
    });
  }

  // ── Header ──
  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: wide ? 20 : 12 }}>
      <View style={{ width: wide ? 78 : 52, height: wide ? 78 : 52, borderRadius: 40, alignItems: 'center', justifyContent: 'center', backgroundImage: 'linear-gradient(145deg,#5B93FF 0%,#1F3FD8 100%)', boxShadow: '0 10px 26px rgba(31,75,255,0.45), inset 0 1px 0 rgba(255,255,255,0.5)' } as any}>
        <Ico n="people" s={wide ? 38 : 26} />
      </View>
      {wide ? <View style={{ width: 2, height: 66, backgroundColor: '#9FB3E6', opacity: 0.7 }} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: INK, fontSize: wide ? 38 : 22, fontWeight: '800', letterSpacing: -0.8, lineHeight: wide ? 44 : 27 }}>{sel ? nameOf(sel) : 'Our community around the world'}</Text>
        <Text style={{ color: '#34457A', fontSize: wide ? 18 : 13, marginTop: 4 }}>
          {sel ? `${selN} ${selN === 1 ? 'member' : 'members'}${cities.length ? ` in ${cities.length} ${cities.length === 1 ? 'city' : 'cities'}` : ''}` : "Together, we're part of a global community, connected across countries and continents."}
        </Text>
      </View>
      {sel ? (
        <Pressable onPress={() => select(null)} accessibilityRole="button" style={{ paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999, backgroundColor: BLUE }}>
          <Text style={{ color: '#FFFFFF', fontSize: 13.5, fontWeight: '800' }}>‹ World</Text>
        </Pressable>
      ) : null}
    </View>
  );

  // ── Counters + period filter ──
  const filters = (
    <View style={{ zIndex: 30 }}>
      <View style={[glass, { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, padding: 7, borderRadius: 26 }]}>
        {PERIODS.map(([k, label]) => {
          const on = period === k;
          return (
            <Pressable key={k} onPress={() => { setPeriod(k); setPicker(false); }} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ paddingVertical: 10, paddingHorizontal: wide ? 18 : 13, borderRadius: 999, backgroundColor: on ? BLUE : 'transparent', boxShadow: on ? '0 6px 16px rgba(31,75,255,0.4)' : undefined } as any}>
              <Text style={{ color: on ? '#FFFFFF' : INK, fontSize: wide ? 15.5 : 13.5, fontWeight: on ? '800' : '600' }}>{label}</Text>
            </Pressable>
          );
        })}
        <Pressable onPress={() => { setDraft(custom); setPicker((o) => !o); }} accessibilityRole="button" accessibilityLabel="Choose dates" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 13, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: period === 'custom' ? 2 : 0, borderColor: BLUE }}>
          <Ico n="calendar" s={22} c={BLUE} w={2} />
          <Ico n="chev" s={16} c={INK} />
        </Pressable>
      </View>
      {picker ? (
        <View style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, width: 260, padding: 14, gap: 8, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE, boxShadow: '0 18px 44px rgba(20,40,110,0.28)', zIndex: 40 } as any}>
          <Text style={{ color: INK, fontSize: 13, fontWeight: '800' }}>From</Text>
          <input type="date" value={draft.from} max={draft.to || undefined} onChange={(e: any) => setDraft({ ...draft, from: e.target.value })} style={inputCss} />
          <Text style={{ color: INK, fontSize: 13, fontWeight: '800', marginTop: 4 }}>To</Text>
          <input type="date" value={draft.to} min={draft.from || undefined} onChange={(e: any) => setDraft({ ...draft, to: e.target.value })} style={inputCss} />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <Pressable onPress={() => { setCustom({ from: '', to: '' }); setPeriod('all'); setPicker(false); }} accessibilityRole="button" style={{ flex: 1, paddingVertical: 9, borderRadius: 999, alignItems: 'center', borderWidth: 1, borderColor: LINE }}><Text style={{ color: MUTED, fontWeight: '700', fontSize: 13.5 }}>Clear</Text></Pressable>
            <Pressable onPress={() => { if (!draft.from && !draft.to) return; setCustom(draft); setPeriod('custom'); setPicker(false); }} accessibilityRole="button" style={{ flex: 1, paddingVertical: 9, borderRadius: 999, alignItems: 'center', backgroundColor: BLUE }}><Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13.5 }}>Apply</Text></Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );

  const statsRow = (
    <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: wide ? 'center' : 'stretch', justifyContent: 'space-between', gap: 16, zIndex: 30 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: wide ? 22 : 10, flexShrink: 1 }}>
        <StatCard kind="members" value={fmt(data.total)} label={data.total === 1 ? 'Total Member' : 'Total Members'} pct={data.growth?.members} wide={wide} />
        <StatCard kind="countries" value={fmt(data.countries.length)} label={data.countries.length === 1 ? 'Country' : 'Countries'} pct={data.growth?.countries} wide={wide} />
      </View>
      {filters}
    </View>
  );

  // ── Latest members ──
  const side = (
    <View style={[glass, { width: wide ? 350 : '100%', borderRadius: 24, padding: wide ? 22 : 16 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Ico n="bolt" s={26} c={BLUE} />
        <Text style={{ color: INK, fontSize: wide ? 22 : 19, fontWeight: '800' }}>{sel ? 'Members from ' + nameOf(sel) : 'Latest Members'}</Text>
      </View>
      <Text style={{ color: MUTED, fontSize: 15, marginTop: 4, marginBottom: 10 }}>{sel ? 'Newest members from this country.' : 'New members appear here as they join.'}</Text>
      {recent.length ? recent.map((m, i) => (
        <Pressable key={i} onPress={() => select(m.cc)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 11, borderTopWidth: 1, borderTopColor: LINE }}>
          <Flag cc={m.cc} w={42} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: INK, fontSize: 16.5, fontWeight: '700' }}>{m.name}</Text>
            <Text numberOfLines={1} style={{ color: MUTED, fontSize: 13.5 }}>{nameOf(m.cc)}</Text>
          </View>
          <Text style={{ color: MUTED, fontSize: 14.5 }}>{ago(m.t)}</Text>
        </Pressable>
      )) : <Text style={{ color: MUTED, fontSize: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: LINE }}>{sel ? 'No recent members to list for this country.' : 'No members in this period yet.'}</Text>}
      {recentAll.length > 5 ? (
        <Pressable onPress={() => setShowAll((a) => !a)} accessibilityRole="button" style={{ marginTop: 12, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 12, paddingHorizontal: 26, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1.5, borderColor: '#BFD0FF', boxShadow: '0 6px 16px rgba(31,75,255,0.12)' } as any}>
          <Ico n="people" s={20} c={BLUE} />
          <Text style={{ color: BLUE, fontSize: 15.5, fontWeight: '800' }}>{showAll ? 'Show Less' : 'View All Members'}</Text>
          {showAll ? null : <Ico n="right" s={18} c={BLUE} w={2.4} />}
        </Pressable>
      ) : null}
      {sel && cities.length ? (
        <View style={{ marginTop: 16, gap: 8 }}>
          <Text style={{ color: INK, fontSize: 15, fontWeight: '800' }}>Cities</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {cities.slice(0, 10).map((p, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, backgroundColor: '#FFE3E8' }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: DOT }} />
                <Text style={{ color: INK, fontSize: 12.5, fontWeight: '600' }}>{(p.city || 'Unknown city') + (p.n > 1 ? '  ' + p.n : '')}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );

  // ── Dark "Community Reach" map card ──
  const pill: any = { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999, backgroundColor: 'rgba(10,26,74,0.85)', borderWidth: 1, borderColor: 'rgba(120,160,255,0.35)', backdropFilter: 'blur(8px)' };
  const mapView = (
    <View style={{ flex: wide ? 1 : undefined, minWidth: 0, width: wide ? undefined : '100%', borderRadius: 26, overflow: 'hidden', padding: wide ? 22 : 14, gap: 10, borderWidth: 1, borderColor: 'rgba(120,160,255,0.3)', backgroundImage: `radial-gradient(120% 90% at 50% 0%, #10306F 0%, ${NAVY} 70%)`, boxShadow: '0 20px 50px rgba(8,25,80,0.45)' } as any}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Ico n="pin" s={32} c="#FFFFFF" hole="#2B4EFF" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: '#FFFFFF', fontSize: wide ? 22 : 18, fontWeight: '800' }}>Community Reach</Text>
          <Text numberOfLines={2} style={{ color: '#C9D6F5', fontSize: wide ? 14.5 : 12.5 }}>Explore where our members are from around the world.</Text>
        </View>
      </View>
      <View style={{ flex: wide ? 1 : undefined, justifyContent: 'center' }}>
        <View onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))} {...responder.panHandlers} style={{ width: '100%' }}>
          {W > 0 ? (
            <Svg width={W} height={H} viewBox={v.join(' ')}>
              <Rect x={v[0] - 3000} y={v[1] - 3000} width={7000} height={7000} fill="#000000" fillOpacity={0.001} onPress={() => select(null)} />
              {Object.entries(map.c).map(([cc, c]) => {
                const n = counts[cc] || 0, on = sel === cc, i = tone(cc);
                return <Path key={cc} d={c.d} fill={VIVID[i]} fillOpacity={sel && !on ? 0.4 : n ? 0.82 + 0.18 * (Math.log(1 + n) / Math.log(1 + max)) : 0.66} stroke={on ? '#FFFFFF' : '#0B2260'} strokeOpacity={on ? 1 : 0.55} strokeWidth={(on ? 1.8 : 0.7) * unit} onPress={n ? () => select(on ? null : cc) : undefined} />;
              })}
              {data.places.map((p, i) => {
                const [x, y] = project(map.p, p.lon, p.lat), r = (3.6 + Math.min(6, 2 * Math.log2(p.n))) * unit * (sel ? 1.25 : 1);
                return (
                  <G key={i} onPress={() => select(p.cc)}>
                    <Circle cx={x} cy={y} r={r * 2.6} fill={DOT} fillOpacity={0.28} />
                    <Circle cx={x} cy={y} r={r} fill={DOT} stroke="#FFFFFF" strokeWidth={1.4 * unit} />
                  </G>
                );
              })}
              {labels.map((l) => (
                <G key={'t' + l.key}>
                  <SvgText x={l.x} y={l.y} textAnchor={l.end ? 'end' : 'start'} fontSize={11 * unit} fontWeight="700" fill={NAVY} stroke={NAVY} strokeWidth={3.6 * unit} strokeLinejoin="round">{l.text}</SvgText>
                  <SvgText x={l.x} y={l.y} textAnchor={l.end ? 'end' : 'start'} fontSize={11 * unit} fontWeight="700" fill="#FFFFFF">{l.text}</SvgText>
                </G>
              ))}
            </Svg>
          ) : <View style={{ height: 160 }} />}
          {!data.countries.length ? (
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 14, alignItems: 'center' }}>
              <Text style={{ color: '#C9D6F5', fontSize: 13, fontWeight: '600' }}>New members appear here as they join</Text>
            </View>
          ) : null}
        </View>
        <View style={[glass, { position: 'absolute', top: 0, right: 0, width: 48, paddingVertical: 4, alignItems: 'center', borderRadius: 24, gap: 0, backgroundColor: 'rgba(255,255,255,0.94)' }] as any}>
          <RoundBtn n="plus" onPress={() => zoomBy(1.7)} label="Zoom in" />
          <View style={{ width: 26, height: 1, backgroundColor: LINE }} />
          <RoundBtn n="minus" onPress={() => zoomBy(1 / 1.7)} label="Zoom out" />
          <View style={{ width: 26, height: 1, backgroundColor: LINE }} />
          <RoundBtn n="locate" onPress={() => select(null)} label="Show the whole world" />
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <View style={pill}>
          <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 4, borderColor: '#2B4EFF', backgroundColor: '#FFFFFF' }} />
          <Text style={{ color: '#FFFFFF', fontSize: 14.5, fontWeight: '600' }}>Members by Country</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {typeof visitors === 'number' ? <View style={[pill, { paddingVertical: 7, paddingHorizontal: 12 }]}><Text style={{ color: '#C9D6F5', fontSize: 12.5, fontWeight: '600' }}>Visitors  <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>{fmt(visitors)}</Text></Text></View> : null}
          {typeof online === 'number' ? <View style={[pill, { paddingVertical: 7, paddingHorizontal: 12 }]}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#35E08A' }} /><Text style={{ color: '#C9D6F5', fontSize: 12.5, fontWeight: '600' }}>Online now  <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>{fmt(online)}</Text></Text></View> : null}
        </View>
      </View>
    </View>
  );

  const g = wide ? 520 : 280;
  return (
    <View
      onLayout={(e) => setW0(Math.round(e.nativeEvent.layout.width))}
      accessibilityLabel={`${data.total} members in ${data.countries.length} countries`}
      style={{ borderRadius: 30, overflow: 'hidden', padding: wide ? 28 : 14, gap: wide ? 22 : 14, borderWidth: 1, borderColor: '#C9DBFF', backgroundColor: '#D6E5FF', backgroundImage: HERO_BG ? `url(${HERO_BG})` : 'linear-gradient(135deg,#EAF2FF 0%,#D3E3FF 45%,#B5CFFF 100%)', backgroundSize: 'cover', backgroundPosition: 'center' } as any}
    >
      {!HERO_BG ? (
        <>
          <View pointerEvents="none" style={{ position: 'absolute', top: -g * 0.33, right: -g * 0.2, width: g, height: g, borderRadius: g / 2, opacity: 0.92, backgroundImage: 'radial-gradient(circle at 32% 32%, #8CC0FF 0%, #2F66E8 36%, #0E2A8F 68%, #061744 100%)' } as any} />
          <View pointerEvents="none" style={{ position: 'absolute', top: -g * 0.33, right: -g * 0.2, width: g, height: g, borderRadius: g / 2, opacity: 0.4, backgroundImage: 'radial-gradient(rgba(255,255,255,0.8) 1.3px, transparent 1.7px)', backgroundSize: '11px 11px' } as any} />
        </>
      ) : null}
      {W0 > 0 ? (
        <>
          {header}
          {statsRow}
          {wide ? (
            <View style={{ flexDirection: 'row', gap: 22, alignItems: 'stretch' }}>{side}{mapView}</View>
          ) : (
            <View style={{ gap: 14 }}>{mapView}{side}</View>
          )}
          {dbg}
        </>
      ) : null}
    </View>
  );
}

export default function SignupMap() {
  return Platform.OS === 'web' ? <Inner /> : null;
}
