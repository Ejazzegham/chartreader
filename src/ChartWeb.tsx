import React, { useState } from 'react';
import { View, Text, ActivityIndicator, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { useApp } from './store';
import { Btn, Body } from './ui';

// Keeps the pinch for the chart: the page itself must never zoom or bounce.
const VIEWPORT_JS = `(function(){try{var m=document.querySelector('meta[name=viewport]');if(!m){m=document.createElement('meta');m.name='viewport';(document.head||document.documentElement).appendChild(m);}m.content='width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no';}catch(e){}})();true;`;

const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';

// Runs inside the chart page. It watches the chart's symbol box (TradingView-style toolbars, same-origin frames included)
// and tells the app whenever the pair changes. If the page looks different it simply finds nothing and does nothing.
const SYM_JS = `(function(){
  if (window.__symWatch) return; window.__symWatch = true;
  var last = '';
  function docs(){ var a = [document], f = document.querySelectorAll('iframe'); for (var i = 0; i < f.length; i++) { try { if (f[i].contentDocument) a.push(f[i].contentDocument); } catch (e) {} } return a; }
  function clean(x){ return (x || '').replace(/\\s+/g, ' ').trim(); }
  function read(){
    var d = docs(), i, el, v;
    for (i = 0; i < d.length; i++) { el = d[i].querySelector('#header-toolbar-symbol-search .js-button-text') || d[i].querySelector('#header-toolbar-symbol-search'); v = el && clean(el.textContent); if (v) return v; }
    for (i = 0; i < d.length; i++) { el = d[i].querySelector('[data-name="legend-source-title"]'); v = el && clean(el.textContent); if (v) return v; }
    try { v = new URLSearchParams(location.search).get('symbol'); if (v) return v; } catch (e) {}
    return '';
  }
  setInterval(function(){
    var v = read();
    if (v && v.length < 48 && v !== last) { last = v; window.ReactNativeWebView.postMessage(JSON.stringify({ t: 'sym', v: v })); }
  }, 900);
})(); true;`;

// Real TradingView / Deriv charts inside the app. Pass either a page url or an html string.
// onSymbol (page url charts only) is called with the pair name whenever the user picks another pair inside the chart.
// fallbackHtml: shown automatically if the page url cannot be reached (for example Deriv's chart site not resolving on this network).
// onAnalysis: lets the error card jump to the app's own Analysis View, which only needs the live price feed.
// onTouching: true while a finger is on the chart. The page around the chart uses it to stop scrolling, so two-finger pinch (zoom in / out) and one-finger drag always go to the chart.
export default function ChartWeb({ uri, html, height, onSymbol, fallbackHtml, onAnalysis, onTouching }: { uri?: string; html?: string; height?: number; onSymbol?: (raw: string) => void; fallbackHtml?: string; onAnalysis?: () => void; onTouching?: (on: boolean) => void }) {
  const { th, t } = useApp();
  const [err, setErr] = useState('');
  const [n, setN] = useState(0);
  const [fb, setFb] = useState(false);
  const netErr = /ERR_NAME_NOT_RESOLVED|ERR_INTERNET|ERR_CONNECTION|ERR_TIMED_OUT|ERR_NETWORK|ERR_PROXY|ERR_TUNNEL|ERR_ADDRESS/i.test(err);
  const fail = (msg: string) => { if (fallbackHtml && !fb) { setFb(true); setN((x) => x + 1); } else setErr(msg); };
  const box = { height, flex: height ? undefined : 1, backgroundColor: th.bg, borderRadius: 8, overflow: 'hidden' as const };
  if (err) {
    return (
      <View style={{ ...box, padding: 16, gap: 12, justifyContent: 'center' }}>
        <Body color={th.sell}>{netErr ? t('chartNet') : err}</Body>
        {netErr && <Body color={th.dim}>{err}</Body>}
        <Btn ghost label={t('retry')} onPress={() => { setErr(''); setFb(false); setN(n + 1); }} />
        {!!onAnalysis && <Btn label={t('useAnalysis')} onPress={onAnalysis} />}
        {!!uri && <Btn ghost label={t('openBrowser')} onPress={() => Linking.openURL(uri).catch(() => {})} />}
      </View>
    );
  }
  return (
    <View
      style={box}
      onTouchStart={onTouching ? () => onTouching(true) : undefined}
      onTouchEnd={onTouching ? (e: any) => { if (!e.nativeEvent.touches?.length) onTouching(false); } : undefined}
      onTouchCancel={onTouching ? () => onTouching(false) : undefined}
    >
      {fb && <View style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: th.gold + '22' }}><Text style={{ color: th.gold, fontSize: 11.5, fontWeight: '700' }}>{t('chartFallback')}</Text></View>}
      <WebView
        key={n}
        source={fb && fallbackHtml ? { html: fallbackHtml, baseUrl: 'https://www.tradingview.com' } : html ? { html, baseUrl: 'https://www.tradingview.com' } : { uri: uri ?? 'about:blank' }}
        originWhitelist={['*']} javaScriptEnabled domStorageEnabled thirdPartyCookiesEnabled sharedCookiesEnabled
        nestedScrollEnabled setSupportMultipleWindows={false} userAgent={UA} startInLoadingState
        scalesPageToFit={false} bounces={false} overScrollMode="never" androidLayerType="hardware" setBuiltInZoomControls={false} setDisplayZoomControls={false}
        injectedJavaScriptBeforeContentLoaded={VIEWPORT_JS}
        injectedJavaScript={uri && onSymbol && !fb ? SYM_JS : undefined}
        onMessage={(e: any) => { try { const m = JSON.parse(e.nativeEvent.data); if (m?.t === 'sym' && typeof m.v === 'string') onSymbol?.(m.v); } catch {} }}
        onError={(e: any) => fail(e?.nativeEvent?.description || t('chartFail'))}
        onHttpError={(e: any) => fail(`HTTP ${e?.nativeEvent?.statusCode ?? ''}`)}
        renderLoading={() => <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: th.bg }}><ActivityIndicator color={th.accent} /></View>}
        style={{ backgroundColor: th.bg }}
      />
    </View>
  );
}
