import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { LinearGradient } from './FlatGradient';

import { useApp } from './store';
import { Icon, HeroBanner } from './ui';
import { MDEFS, MDef, MethodIcon } from './MethodArt';
import MarketsPanel from './MarketsPanel';
import { useRealWindow, WidthCtx } from './win';
import { usePal, useSetup, Panel, Footer, useGo, Btn } from './DesktopHome.web';
import { Sessions, SectionHead } from './AnalysisHome.web';

// The website's method page. Every analysis method opens inside this one layout, designed like the "Choose Your Analysis Method" mockup:
//   hero + the 14 method cards (the open one is highlighted)  ->  method header with Save Chart / Share / Full Screen  ->  the method workspace
//   on the left, Markets + Forex Sessions + Confluence Checklist on the right  ->  learning banner  ->  footer.
// The method workspaces themselves (ICT, SMC, Scanner...) are passed in as children and keep all their logic.
type Props = {
  m?: MDef; visible: boolean; symId: string; sym: string;
  onOpenMethod: (d: MDef) => void; onPair: (id: string) => void;
  top?: React.ReactNode; controls?: React.ReactNode; children: React.ReactNode;
};

const GAP = 14;



function Hero({ w }: { w: number }) {
  return <HeroBanner icon="analytics" title="Choose Your Analysis Method" subtitle={`Explore ${MDEFS.length} powerful analysis methods to get deeper market insights and identify high-probability setups.`} />;
}

function MethodGrid({ w, cur, onOpen }: { w: number; cur?: string; onOpen: (d: MDef) => void }) {
  const P = usePal();
  const [gw, setGw] = useState(0);
  const cols = w >= 1240 ? 7 : w >= 1000 ? 5 : w >= 760 ? 4 : w >= 520 ? 3 : 2;
  const cw = gw ? Math.floor((gw - GAP * (cols - 1)) / cols) : 0;
  return (
    <View onLayout={(e) => setGw(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
      {cw > 0 && MDEFS.map((d) => {
        const on = d.k === cur;
        return (
          <Pressable key={d.k} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${d.label}. ${d.desc}`} onPress={() => onOpen(d)}
            style={((s: any) => ({ width: cw, minHeight: 148, padding: 14, gap: 10, borderRadius: 14, borderWidth: on ? 1.6 : 1, borderColor: on ? P.blue : s.hovered ? P.blue + '66' : P.border, backgroundColor: on ? P.soft : P.card, cursor: 'pointer', shadowColor: P.shadow, shadowOpacity: on || s.hovered ? 0.14 : 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 5 } })) as any}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <MethodIcon def={d} size={42} />
              <Icon name="chevron-forward" size={15} color={on ? P.blue : P.body} />
            </View>
            <Text style={{ color: P.head, fontSize: 13.5, fontWeight: '800', lineHeight: 18 }} numberOfLines={2}>{d.label}</Text>
            <Text style={{ color: P.body, fontSize: 11.5, lineHeight: 16 }} numberOfLines={3}>{d.desc}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Confluence checklist for the open pair (the combined engine's checks)
function Checklist({ symId }: { symId: string }) {
  const P = usePal(), th = P.th;
  const s = useSetup(symId, '900', 'mp-check');
  const rows = s.cb?.checks ?? [];
  return (
    <Panel style={{ padding: 20, gap: 12 }}>
      <SectionHead icon="shield-checkmark" title="Confluence Checklist" />
      {!s.ready && <Text style={{ color: P.body, fontSize: 12.5 }}>Reading the market…</Text>}
      {s.ready && rows.length === 0 && <Text style={{ color: P.body, fontSize: 12.5, lineHeight: 18 }}>No combined setup on this pair right now. The checklist fills in when one forms.</Text>}
      {rows.slice(0, 8).map((r, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: (r.ok ? th.buy : th.sell) + '22', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={r.ok ? 'checkmark' : 'close'} size={13} color={r.ok ? th.buy : th.sell} />
          </View>
          <Text style={{ flex: 1, color: P.head, fontSize: 12.5, lineHeight: 17 }}>{r.text}</Text>
        </View>
      ))}
    </Panel>
  );
}

function ActionBtn({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  const P = usePal();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={((s: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 7, height: 36, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: P.border, backgroundColor: s.hovered ? P.alt : P.card, cursor: 'pointer' })) as any}>
      <Icon name={icon} size={15} color={P.blue} />
      <Text style={{ color: P.head, fontSize: 12.5, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

// Largest drawn chart inside the workspace -> PNG download
async function saveChartPng(root: any, name: string): Promise<boolean> {
  const el: HTMLElement | null = root && root.querySelectorAll ? root : null;
  if (!el) return false;
  const nodes = Array.from(el.querySelectorAll('canvas, svg')) as (HTMLCanvasElement | SVGSVGElement)[];
  let best: HTMLCanvasElement | SVGSVGElement | null = null, area = 0;
  for (const n of nodes) { const r = n.getBoundingClientRect(), a = r.width * r.height; if (r.width > 300 && r.height > 160 && a > area) { best = n; area = a; } }
  if (!best) return false;
  const r = best.getBoundingClientRect(), sc = 2;
  const out = document.createElement('canvas'); out.width = Math.round(r.width * sc); out.height = Math.round(r.height * sc);
  const ctx = out.getContext('2d'); if (!ctx) return false;
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, out.width, out.height);
  if (best instanceof HTMLCanvasElement) ctx.drawImage(best, 0, 0, out.width, out.height);
  else {
    const clone = best.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); clone.setAttribute('width', String(r.width)); clone.setAttribute('height', String(r.height));
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' }));
    const ok = await new Promise<boolean>((res) => { const im = new Image(); im.onload = () => { ctx.drawImage(im, 0, 0, out.width, out.height); res(true); }; im.onerror = () => res(false); im.src = url; });
    URL.revokeObjectURL(url);
    if (!ok) return false;
  }
  const a = document.createElement('a'); a.download = `${name}.png`; a.href = out.toDataURL('image/png'); document.body.appendChild(a); a.click(); a.remove();
  return true;
}

export default function MethodPage({ m, visible, symId, sym, onOpenMethod, onPair, top, controls, children }: Props) {
  const P = usePal(), th = P.th, go = useGo(), { toast } = useApp();
  const w = useRealWindow().width;
  const scroller = useRef<ScrollView>(null), work = useRef<View>(null);
  const [bw, setBw] = useState(0), [fs, setFs] = useState(false);
  const two = w >= 1180;

  useEffect(() => { scroller.current?.scrollTo({ y: 0, animated: false }); }, [m?.k]);
  useEffect(() => {
    const f = () => setFs(!!(document as any).fullscreenElement);
    document.addEventListener('fullscreenchange', f); return () => document.removeEventListener('fullscreenchange', f);
  }, []);

  const save = async () => {
    const ok = await saveChartPng(work.current, `${(m?.label ?? 'analysis').replace(/\W+/g, '-')}-${sym.replace(/\W+/g, '')}`).catch(() => false);
    toast(ok ? 'Chart saved as an image.' : 'This chart cannot be saved as an image from here.', ok ? 'good' : 'info');
  };
  const share = async () => {
    const text = `${m?.label ?? 'Analysis'} · ${sym} on Chart Reader`, url = window.location.href;
    try {
      if ((navigator as any).share) await (navigator as any).share({ title: 'Chart Reader', text, url });
      else { await navigator.clipboard.writeText(`${text} ${url}`); toast('Link copied.', 'good'); }
    } catch { /* the person closed the share sheet */ }
  };
  const full = () => {
    const el: any = work.current;
    if (!el) return;
    if ((document as any).fullscreenElement) (document as any).exitFullscreen?.();
    else el.requestFullscreen?.().catch(() => toast('Full screen is not available in this browser.', 'info'));
  };

  const header = (
    <Panel style={{ padding: 18, gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        {m && <MethodIcon def={m} size={46} />}
        <View style={{ flex: 1, minWidth: 220 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ color: P.head, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 }}>{m?.label}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 22, borderRadius: 11, backgroundColor: th.buy + '1F' }}>
              <Icon name="star" size={10} color={th.buy} /><Text style={{ color: th.buy, fontSize: 11.5, fontWeight: '700' }}>Active</Text>
            </View>
          </View>
          <Text style={{ color: P.body, fontSize: 12.5, lineHeight: 18, marginTop: 2 }}>{m?.desc}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <ActionBtn icon="download-outline" label="Save Chart" onPress={save} />
          <ActionBtn icon="share-social-outline" label="Share" onPress={share} />
          <ActionBtn icon={fs ? 'contract-outline' : 'expand-outline'} label={fs ? 'Exit Full Screen' : 'Full Screen'} onPress={full} />
        </View>
      </View>
      {controls}
    </Panel>
  );

  const left = (
    <View ref={work} style={{ flex: 1, minWidth: 0, gap: 18, ...(fs ? { backgroundColor: P.alt, padding: 20, overflow: 'auto' } : null) } as any}>
      {header}
      {/* the open method's workspace: it sizes itself to this column */}
      <View onLayout={(e) => setBw(Math.round(e.nativeEvent.layout.width))} style={{ gap: 18 }}>
        <WidthCtx.Provider value={bw > 0 ? bw : null}>{children}</WidthCtx.Provider>
      </View>
    </View>
  );

  return (
    <ScrollView ref={scroller} style={{ flex: 1, backgroundColor: P.alt, display: visible ? 'flex' : 'none' } as any} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
      <LinearGradient pointerEvents="none" colors={P.dark ? [P.bg, P.bg] : ['#E7F0FF', '#F5F8FE']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 330 }} />
      <View style={{ width: '100%', maxWidth: 1280, alignSelf: 'center', paddingHorizontal: 32, paddingTop: 24, paddingBottom: 30, gap: 22 }}>
        {top}
        <Hero w={w} />
        <MethodGrid w={w} cur={m?.k} onOpen={onOpenMethod} />
        <View style={{ flexDirection: two ? 'row' : 'column', gap: 22, alignItems: 'flex-start' }}>
          {left}
          <View style={{ width: two ? 340 : '100%', gap: 18 }}>
            <MarketsPanel height={460} onPick={onPair} selected={symId} />
            <Sessions go={(t) => go(t)} style={{ flex: 0, minWidth: 0, padding: 20 }} />
            <Checklist symId={symId} />
          </View>
        </View>
        <Panel style={{ flexDirection: w >= 760 ? 'row' : 'column', alignItems: w >= 760 ? 'center' : 'flex-start', gap: 16, padding: 18, backgroundColor: '#0B2A74', borderColor: '#0B2A74' }}>
          <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFFFFF22', alignItems: 'center', justifyContent: 'center' }}><Icon name="school" size={22} color="#FFFFFF" /></View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>Learn & Improve Your Trading</Text>
            <Text style={{ color: '#DCE6FFCC', fontSize: 12.5, marginTop: 2 }}>Access tutorials, trading guides and detailed analysis to enhance your skills and make better trading decisions.</Text>
          </View>
          <Btn label="Visit Learning Center" onPress={() => go(14)} />
        </Panel>
      </View>
      <Footer w={w} go={go} />
    </ScrollView>
  );
}
