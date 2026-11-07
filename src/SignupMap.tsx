import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Platform, Image } from 'react-native';
import Svg, { Path, Circle, G, Rect, Text as SvgText } from 'react-native-svg';
import { Icon } from './ui';
import { getSignupMap, getSignupMapDiag, pingVisit, SignupMapData, VisitCounts } from './license';
import { MapData, VB, project, zoomBox } from './mapMath';

// "Our community around the world": a light, colourful card. Left: the newest members (first name + last initial) with their country flag, and the top
// countries. Right: the world map, every country in its own colour, brighter where members joined, a dot for every city. Tap a country (or a name / flag)
// to open the map of that country with its cities named. Above: the visitor counter (visitors, online now) and the member counts.
// Numbers come from the server (GET /public/signups, POST /public/visit); country shapes from public/world-map.json; flags from public/flags/xx.svg.
// On a narrow container (phone, the front page column) the map comes first and the lists stack under it. Website only.

const OCEAN = '#DCEBFF', INK = '#14213D', MUTED = '#5B6B8C', LINE = '#DFE7F5', DOT = '#FF4D6D';
const PASTEL = ['#FFD9B3', '#FBF0A6', '#C5EFC9', '#B3ECF2', '#BBD3FF', '#D3C8FF', '#F6CBF7', '#FFC4C4'];
const VIVID = ['#FF9F43', '#F2C811', '#4CC777', '#22B8CF', '#4D8DFF', '#8B6CFF', '#D95CE6', '#FF6B6B'];
const tone = (cc: string) => (cc.charCodeAt(0) * 31 + cc.charCodeAt(1)) % 8;
const card: any = { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: LINE, padding: 14 };
const fmt = (n: number) => n.toLocaleString('en-US');
const ago = (t: number) => {
  if (!t) return '';
  const m = Math.max(1, Math.round((Date.now() - t) / 60000)); if (m < 60) return m + 'm ago';
  const h = Math.round(m / 60); if (h < 24) return h + 'h ago';
  const d = Math.round(h / 24); if (d < 31) return d + 'd ago';
  const mo = Math.round(d / 30); return mo < 12 ? mo + 'mo ago' : Math.round(mo / 12) + 'y ago';
};

let mapCache: MapData | null = null, mapDiag = 'not asked yet';
async function loadMap(): Promise<MapData | null> {
  if (mapCache) return mapCache;
  try { const r = await fetch('/world-map.json'); if (!r.ok) { mapDiag = '/world-map.json answered HTTP ' + r.status + ' (the file is missing from the deployed site)'; return null; } const j = await r.json(); if (j && j.c && j.p) { mapCache = j; mapDiag = 'ok'; } else mapDiag = '/world-map.json is not the map file'; } catch (e: any) { mapDiag = '/world-map.json failed: ' + String(e?.message || e).slice(0, 80); }
  return mapCache;
}
// Open the website with ?mapdebug at the end of the address to see why the map is not showing.
const DEBUG = typeof location !== 'undefined' && /mapdebug/.test(location.search + location.hash);

function Flag({ cc, w = 26 }: { cc: string; w?: number }) {
  const [bad, setBad] = useState(false), h = Math.round((w * 2) / 3);
  if (bad) return <View style={{ width: w, height: h, borderRadius: 3, backgroundColor: '#E3E9F5' }} />;
  return <Image source={{ uri: '/flags/' + cc.toLowerCase() + '.svg' }} onError={() => setBad(true)} resizeMode="cover" style={{ width: w, height: h, borderRadius: 3, borderWidth: 1, borderColor: '#00000018' }} />;
}

function Stat({ icon, color, bg, value, label, live }: { icon: string; color: string; bg: string; value: string; label: string; live?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: bg, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 13 }}>
      {live ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color, borderWidth: 2, borderColor: color + '55' }} /> : <Icon name={icon} size={18} color={color} />}
      <View>
        <Text style={{ color, fontSize: 17, fontWeight: '800', lineHeight: 20 }}>{value}</Text>
        <Text style={{ color, opacity: 0.8, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.3 }}>{label}</Text>
      </View>
    </View>
  );
}

function Inner() {
  const [map, setMap] = useState<MapData | null>(mapCache);
  const [data, setData] = useState<SignupMapData | null>(null);
  const [vc, setVc] = useState<VisitCounts | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [W0, setW0] = useState(0); // width of the whole card: decides one column or two
  const [W, setW] = useState(0); // width of the map itself
  const [, bump] = useState(0); // re-draw when a request ends, so the debug line is current
  const [vb, setVb] = useState<VB | null>(null);
  const cur = useRef<VB | null>(null);

  useEffect(() => { let on = true; loadMap().then((m) => { if (on) { bump((n) => n + 1); if (m) setMap(m); } }); return () => { on = false; }; }, []);
  useEffect(() => { // live numbers: load now, then refresh every minute
    let on = true;
    const go = () => getSignupMap().then((d) => { if (on) { bump((n) => n + 1); if (d) setData(d); } });
    go(); const t = setInterval(go, 60000);
    return () => { on = false; clearInterval(t); };
  }, []);
  useEffect(() => { // visitor counter: the first call counts this visit, the next ones (every minute) only keep "online now" fresh
    let on = true;
    const go = () => pingVisit().then((v) => { if (on && v) setVc(v); });
    go(); const t = setInterval(go, 60000);
    return () => { on = false; clearInterval(t); };
  }, []);

  const aspect = map ? map.w / map.h : 2.3;
  const full: VB = useMemo(() => [0, 0, map?.w || 1000, map?.h || 435], [map]);
  const target: VB = useMemo(() => (map && sel && map.c[sel] ? zoomBox(map.c[sel].b, aspect) : full), [map, sel, aspect, full]);
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

  const dbg = DEBUG ? <Text style={{ color: '#B4235A', fontSize: 11, fontFamily: 'monospace' as any }}>{`map debug: map file: ${mapDiag} | numbers: ${getSignupMapDiag()}`}</Text> : null;
  if (!map || !data) return dbg ? <View style={{ gap: 6, backgroundColor: '#FFF', padding: 14, borderRadius: 14 }}><Text style={{ color: INK, fontSize: 15, fontWeight: '700' }}>Our community around the world</Text>{dbg}</View> : null; // server or map file not reachable: show nothing rather than a broken box (add ?mapdebug to the address to see why)

  const v = vb || target, unit = v[2] / 1000; // one on-screen pixel stays the same size at every zoom
  const wide = W0 >= 640;
  const counts: Record<string, number> = {};
  for (const c of data.countries) counts[c.cc] = c.n;
  const max = Math.max(5, ...data.countries.map((c) => c.n));
  const nameOf = (cc: string) => { const s = data.countries.find((c) => c.cc === cc)?.name; return s && s !== cc ? s : map.c[cc]?.n || cc; }; // the server's short name ("United States") first
  const H = W ? W / aspect : 0;
  const selN = sel ? counts[sel] || 0 : 0;
  const cities = sel ? data.places.filter((p) => p.cc === sel) : [];
  const top = data.countries.slice(0, 8);
  const recent = (data.recent || []).filter((m) => !sel || m.cc === sel).slice(0, sel ? 8 : 7);
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

  const mapView = (
    <View style={{ flex: wide ? 1 : undefined, minWidth: 0, width: wide ? undefined : '100%' }}>
      <View onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))} style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: OCEAN, borderWidth: 1, borderColor: '#C9DDF7' }}>
        {W > 0 ? (
          <Svg width={W} height={H} viewBox={v.join(' ')}>
            <Rect x={v[0] - 3000} y={v[1] - 3000} width={7000} height={7000} fill={OCEAN} onPress={() => setSel(null)} />
            {Object.entries(map.c).map(([cc, c]) => {
              const n = counts[cc] || 0, on = sel === cc, i = tone(cc);
              return <Path key={cc} d={c.d} fill={n ? VIVID[i] : PASTEL[i]} fillOpacity={sel && !on ? 0.5 : n ? 0.55 + 0.45 * (Math.log(1 + n) / Math.log(1 + max)) : 1} stroke={on ? INK : '#FFFFFF'} strokeWidth={(on ? 1.6 : 0.9) * unit} onPress={n ? () => setSel(on ? null : cc) : undefined} />;
            })}
            {data.places.map((p, i) => {
              const [x, y] = project(map.p, p.lon, p.lat), r = (3.6 + Math.min(6, 2 * Math.log2(p.n))) * unit * (sel ? 1.25 : 1);
              return (
                <G key={i} onPress={() => setSel(p.cc)}>
                  <Circle cx={x} cy={y} r={r * 2.5} fill={DOT} fillOpacity={0.22} />
                  <Circle cx={x} cy={y} r={r} fill={DOT} stroke="#FFFFFF" strokeWidth={1.3 * unit} />
                </G>
              );
            })}
            {labels.map((l) => (
              <G key={'t' + l.key}>
                <SvgText x={l.x} y={l.y} textAnchor={l.end ? 'end' : 'start'} fontSize={11 * unit} fontWeight="700" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth={3.4 * unit} strokeLinejoin="round">{l.text}</SvgText>
                <SvgText x={l.x} y={l.y} textAnchor={l.end ? 'end' : 'start'} fontSize={11 * unit} fontWeight="700" fill={INK}>{l.text}</SvgText>
              </G>
            ))}
          </Svg>
        ) : <View style={{ height: 160 }} />}
        {!data.countries.length ? (
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 14, alignItems: 'center' }}>
            <Text style={{ color: MUTED, fontSize: 12.5, fontWeight: '600' }}>New members appear here as they join</Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  const side = (
    <View style={{ width: wide ? 290 : '100%', gap: 12 }}>
      <View style={card}>
        <Text style={{ color: INK, fontSize: 14, fontWeight: '800', marginBottom: 6 }}>{sel ? 'Members from ' + nameOf(sel) : 'Latest members'}</Text>
        {recent.length ? recent.map((m, i) => (
          <Pressable key={i} onPress={() => setSel(m.cc)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 7, borderTopWidth: i ? 1 : 0, borderTopColor: LINE }}>
            <Flag cc={m.cc} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ color: INK, fontSize: 13.5, fontWeight: '700' }}>{m.name}</Text>
              <Text numberOfLines={1} style={{ color: MUTED, fontSize: 11.5 }}>{nameOf(m.cc)}</Text>
            </View>
            <Text style={{ color: MUTED, fontSize: 11 }}>{ago(m.t)}</Text>
          </Pressable>
        )) : <Text style={{ color: MUTED, fontSize: 12.5, paddingVertical: 6 }}>{sel ? 'No recent members to list for this country.' : 'New members appear here as they join.'}</Text>}
      </View>
      {sel ? (
        cities.length ? (
          <View style={card}>
            <Text style={{ color: INK, fontSize: 14, fontWeight: '800', marginBottom: 8 }}>Cities</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {cities.slice(0, 10).map((p, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, backgroundColor: '#FFE3E8' }}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: DOT }} />
                  <Text style={{ color: INK, fontSize: 12.5, fontWeight: '600' }}>{(p.city || 'Unknown city') + (p.n > 1 ? '  ' + p.n : '')}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null
      ) : top.length ? (
        <View style={card}>
          <Text style={{ color: INK, fontSize: 14, fontWeight: '800', marginBottom: 8 }}>Top countries</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {top.map((c) => (
              <Pressable key={c.cc} onPress={() => setSel(c.cc)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 5, paddingLeft: 7, paddingRight: 5, borderRadius: 999, backgroundColor: PASTEL[tone(c.cc)] + 'AA' }}>
                <Flag cc={c.cc} w={20} />
                <Text numberOfLines={1} style={{ color: INK, fontSize: 12, fontWeight: '600', maxWidth: 110 }}>{nameOf(c.cc)}</Text>
                <View style={{ backgroundColor: VIVID[tone(c.cc)], borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 }}><Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>{c.n}</Text></View>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );

  return (
    <View
      onLayout={(e) => setW0(Math.round(e.nativeEvent.layout.width))}
      accessibilityLabel={`${data.total} members in ${data.countries.length} countries`}
      style={{ borderRadius: 22, padding: wide ? 22 : 14, gap: 14, borderWidth: 1, borderColor: '#D9E4F7', backgroundColor: '#EEF4FF', backgroundImage: 'linear-gradient(135deg, #E6F0FF 0%, #F1E8FF 52%, #FFEDE6 100%)' } as any}
    >
      {W0 > 0 ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: INK, fontSize: wide ? 20 : 17, fontWeight: '800', letterSpacing: -0.3 }}>{sel ? nameOf(sel) : 'Our community around the world'}</Text>
              <Text style={{ color: MUTED, fontSize: 12.5, marginTop: 2 }}>
                {sel ? `${selN} ${selN === 1 ? 'member' : 'members'}${cities.length ? ` in ${cities.length} ${cities.length === 1 ? 'city' : 'cities'}` : ''}` : 'Traders joining Chart Reader from every corner of the world'}
              </Text>
            </View>
            {sel ? (
              <Pressable onPress={() => setSel(null)} accessibilityRole="button" style={{ paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#4D8DFF' }}>
                <Text style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '800' }}>‹ World</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {typeof visitors === 'number' ? <Stat icon="eye-outline" color="#1F6FE0" bg="#DCEAFF" value={fmt(visitors)} label="VISITORS" /> : null}
            {typeof online === 'number' ? <Stat icon="pulse" live color="#12A150" bg="#D7F5E3" value={fmt(online)} label="ONLINE NOW" /> : null}
            <Stat icon="people-outline" color="#7C4DDB" bg="#EADFFF" value={fmt(data.total)} label="MEMBERS" />
            <Stat icon="globe-outline" color="#D96A00" bg="#FFE6CC" value={fmt(data.countries.length)} label={data.countries.length === 1 ? 'COUNTRY' : 'COUNTRIES'} />
          </View>

          {wide ? (
            <View style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>{side}{mapView}</View>
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
