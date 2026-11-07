import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import Svg, { Path, Circle, G, Rect, Text as SvgText } from 'react-native-svg';
import { HERO_BG, HERO_BRASS } from './ui';
import { getSignupMap, getSignupMapDiag, SignupMapData } from './license';
import { MapData, VB, project, zoomBox } from './mapMath';

// "Traders joining from around the world": a world map shaded by country, with a dot for every city members joined from.
// Tap a country (or a name in the list) to open the map of that country with its cities named. Numbers come from the server (GET /public/signups,
// counts only, no personal data); the country shapes are public/world-map.json (made by scripts/build-world-map.js). Website only.

const BASE = '#1A2B52', LOW = '#2A4A86', HIGH = '#6F98E6', PANEL = '#0B1731', EDGE = '#1C2E56', SOFT = '#B4C0D8', DOT = '#FFD98A';
const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) => { const x = hex(a), y = hex(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };

let mapCache: MapData | null = null, mapDiag = 'not asked yet';
async function loadMap(): Promise<MapData | null> {
  if (mapCache) return mapCache;
  try { const r = await fetch('/world-map.json'); if (!r.ok) { mapDiag = '/world-map.json answered HTTP ' + r.status + ' (the file is missing from the deployed site)'; return null; } const j = await r.json(); if (j && j.c && j.p) { mapCache = j; mapDiag = 'ok'; } else mapDiag = '/world-map.json is not the map file'; } catch (e: any) { mapDiag = '/world-map.json failed: ' + String(e?.message || e).slice(0, 80); }
  return mapCache;
}
// Open the website with ?mapdebug at the end of the address to see why the map is not showing.
const DEBUG = typeof location !== 'undefined' && /mapdebug/.test(location.search + location.hash);

function Inner() {
  const [map, setMap] = useState<MapData | null>(mapCache);
  const [data, setData] = useState<SignupMapData | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [W, setW] = useState(0);
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

  const dbg = DEBUG ? <Text style={{ color: '#FFD98A', fontSize: 11, fontFamily: 'monospace' as any }}>{`map debug: map file: ${mapDiag} | numbers: ${getSignupMapDiag()}`}</Text> : null;
  if (!map || !data) return dbg ? <View style={{ gap: 6 }}><Text style={{ color: '#FFFFFF', fontSize: 14.5, fontWeight: '600' }}>Traders joining from around the world</Text>{dbg}</View> : null; // the server or the map file is not reachable: show nothing rather than a broken box (add ?mapdebug to the address to see why)

  const v = vb || target, unit = v[2] / 1000; // one on-screen pixel stays the same size at every zoom
  const counts: Record<string, number> = {};
  for (const c of data.countries) counts[c.cc] = c.n;
  const max = Math.max(5, ...data.countries.map((c) => c.n));
  const nameOf = (cc: string) => { const s = data.countries.find((c) => c.cc === cc)?.name; return s && s !== cc ? s : map.c[cc]?.n || cc; }; // the server's short name ("United States") first
  const H = W ? W / aspect : 0;
  const selN = sel ? counts[sel] || 0 : 0;
  const cities = sel ? data.places.filter((p) => p.cc === sel) : [];
  const top = data.countries.slice(0, 6);
  // City names on the country map: biggest city first; a name goes to the right of its dot, or to the left, or is left out when both would cover another name (every city is also in the list below the map).
  const labels: { key: number; x: number; y: number; end: boolean; text: string }[] = [];
  if (sel) {
    const boxes: number[][] = [], hit = (a: number[], b: number[]) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
    cities.slice(0, 12).forEach((p, i) => {
      if (!p.city) return;
      const [x, y] = project(map.p, p.lon, p.lat), text = p.city + (p.n > 1 ? ' · ' + p.n : ''), w = text.length * 6.4 * unit, top = y - 9 * unit, bot = y + 4 * unit;
      const right = [x + 9 * unit, top, x + 9 * unit + w, bot], left = [x - 9 * unit - w, top, x - 9 * unit, bot];
      if (!boxes.some((q) => hit(right, q))) { boxes.push(right); labels.push({ key: i, x: right[0], y: y + 3.5 * unit, end: false, text }); }
      else if (!boxes.some((q) => hit(left, q))) { boxes.push(left); labels.push({ key: i, x: left[2], y: y + 3.5 * unit, end: true, text }); }
    });
  }

  return (
    <View style={{ gap: 12 }} accessibilityLabel={`Map of ${data.total} members in ${data.countries.length} countries`}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 14.5, fontWeight: '600' }}>{sel ? nameOf(sel) : 'Traders joining from around the world'}</Text>
          <Text style={{ color: SOFT, fontSize: 12.5, marginTop: 2 }}>
            {sel ? `${selN} ${selN === 1 ? 'member' : 'members'}${cities.length ? ` in ${cities.length} ${cities.length === 1 ? 'city' : 'cities'}` : ''}` : `${data.total} members${data.countries.length ? ` · ${data.countries.length} ${data.countries.length === 1 ? 'country' : 'countries'}` : ''}`}
          </Text>
        </View>
        {sel ? (
          <Pressable onPress={() => setSel(null)} accessibilityRole="button" style={{ paddingVertical: 5, paddingHorizontal: 11, borderRadius: 999, borderWidth: 1, borderColor: HERO_BRASS }}>
            <Text style={{ color: HERO_BRASS, fontSize: 12, fontWeight: '600' }}>‹ World</Text>
          </Pressable>
        ) : null}
      </View>

      <View onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))} style={{ borderRadius: 14, overflow: 'hidden', backgroundColor: PANEL, borderWidth: 1, borderColor: EDGE }}>
        {W > 0 ? (
          <Svg width={W} height={H} viewBox={v.join(' ')}>
            <Rect x={v[0] - 3000} y={v[1] - 3000} width={7000} height={7000} fill={PANEL} onPress={() => setSel(null)} />
            {Object.entries(map.c).map(([cc, c]) => {
              const n = counts[cc] || 0, on = sel === cc;
              const fill = on ? '#4A73C4' : n ? mix(LOW, HIGH, Math.log(1 + n) / Math.log(1 + max)) : BASE; // more members = lighter blue; the gold dots are the cities
              return <Path key={cc} d={c.d} fill={fill} fillOpacity={sel && !on ? 0.55 : 1} stroke={on ? HERO_BRASS : PANEL} strokeWidth={(on ? 1.4 : 0.9) * unit} onPress={n ? () => setSel(on ? null : cc) : undefined} />;
            })}
            {data.places.map((p, i) => {
              const [x, y] = project(map.p, p.lon, p.lat), r = (3.6 + Math.min(6, 2 * Math.log2(p.n))) * unit * (sel ? 1.25 : 1);
              return (
                <G key={i} onPress={() => setSel(p.cc)}>
                  <Circle cx={x} cy={y} r={r * 2.4} fill={DOT} fillOpacity={0.2} />
                  <Circle cx={x} cy={y} r={r} fill={DOT} stroke={HERO_BG} strokeWidth={0.8 * unit} />
                </G>
              );
            })}
            {labels.map((l) => (
              <G key={'t' + l.key}>
                <SvgText x={l.x} y={l.y} textAnchor={l.end ? 'end' : 'start'} fontSize={11 * unit} fontWeight="600" fill={PANEL} stroke={PANEL} strokeWidth={3 * unit} strokeLinejoin="round">{l.text}</SvgText>
                <SvgText x={l.x} y={l.y} textAnchor={l.end ? 'end' : 'start'} fontSize={11 * unit} fontWeight="600" fill="#FFFFFF">{l.text}</SvgText>
              </G>
            ))}
          </Svg>
        ) : <View style={{ height: 160 }} />}
        {!data.countries.length ? (
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 14, alignItems: 'center' }}>
            <Text style={{ color: SOFT, fontSize: 12.5 }}>New members appear here as they join</Text>
          </View>
        ) : null}
      </View>

      {dbg}
      {sel ? (
        cities.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {cities.slice(0, 10).map((p, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: '#FFFFFF14' }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: DOT }} />
                <Text style={{ color: '#FFFFFF', fontSize: 12.5 }}>{(p.city || 'Unknown city') + (p.n > 1 ? '  ' + p.n : '')}</Text>
              </View>
            ))}
          </View>
        ) : <Text style={{ color: SOFT, fontSize: 12.5 }}>City details are not available for this country yet.</Text>
      ) : top.length ? (
        <View style={{ gap: 7 }}>
          {top.map((c) => (
            <Pressable key={c.cc} onPress={() => setSel(c.cc)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 12.5, width: 150 }}>{nameOf(c.cc)}</Text>
              <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: '#FFFFFF14', overflow: 'hidden' }}>
                <View style={{ width: `${Math.max(4, Math.round((c.n / top[0].n) * 100))}%`, height: 5, backgroundColor: HERO_BRASS }} />
              </View>
              <Text style={{ color: SOFT, fontSize: 12.5, width: 36, textAlign: 'right' }}>{c.n}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function SignupMap() {
  return Platform.OS === 'web' ? <Inner /> : null;
}
