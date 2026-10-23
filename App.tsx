import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider, useApp } from './src/store';
import AuthFlow from './src/AuthFlow';
import PinScreen from './src/PinScreen';
import Paywall from './src/Paywall';
import Home from './src/screens/Home';
import Markets from './src/screens/Markets';
import Journal from './src/screens/Journal';
import Risk from './src/screens/Risk';
import History from './src/screens/History';
import Settings from './src/screens/Settings';
import Killzones from './src/screens/Killzones';
import Performance from './src/screens/Performance';
import Analysis from './src/screens/Analysis';
import Checklist from './src/screens/Checklist';
import News from './src/screens/News';
import Guide from './src/screens/Guide';
import About from './src/screens/About';
import ManualTrade from './src/screens/ManualTrade';
import RightSidebar from './src/RightSidebar';
import TradeHistory from './src/TradeHistory';
import NotificationCenter from './src/NotificationCenter';
import AdminPanel from './src/screens/AdminPanel';
import Help from './src/Help';
import Dock from './src/Dock';
import { Tracker, Toasts } from './src/Tracker';
import { NAV } from './src/nav';
import AnimatedSplash from './src/Splash';
import ErrorBoundary from './src/ErrorBoundary';
import GlassBackdrop from './src/Glass';
import Frame from './src/Frame';
import { useDesktop, DesktopShell } from './src/Desktop';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync().catch(() => {}); // keep the phone's splash up until our animated one is drawn

const SPLASH_MS = 3600; // minimum time the start screen stays up so the whole intro plays (it leaves as soon as the app is ready after that)
// ICT Lab, Top-Down and Scanner moved into the Analysis tab. Their old slots keep the tab numbers stable and forward to the right method.
const Go = (method: string, slot: number) => function Go() {
  const { tab, setTab, setAmethod } = useApp();
  useEffect(() => { if (tab === slot) { setAmethod(method); setTab(1); } }, [tab]);
  return null;
};
const COMPS = [Home, Analysis, Markets, Journal, Risk, History, Settings, Go('ict', 7), Killzones, Performance, Go('topdown', 10), Checklist, Go('scanner', 12), News, Guide, About, ManualTrade]; // same order as NAV in src/nav.ts
const TABS = NAV.map((n, i) => ({ key: n.key, icon: n.icon, Comp: COMPS[i] }));

// Every page stays mounted (so charts keep their state). The one you open fades and rises in.
function Page({ active, children }: { active: boolean; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => { if (active) { v.setValue(0); Animated.timing(v, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(); } }, [active]);
  return <Animated.View style={{ flex: 1, display: active ? 'flex' : 'none', opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }), transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>{children}</Animated.View>;
}

function Root() {
  const { th, rtl, ready, loggedIn, locked, covered, tab, enter, adminOpen, setAdminOpen, lic, live } = useApp();
  const [minTime, setMinTime] = useState(false); // start screen: shown for at least SPLASH_MS
  const [gone, setGone] = useState(false);
  const desk = useDesktop(); // website on a wide screen: sidebar + page + market watch instead of the bottom bar
  useEffect(() => { const id = setTimeout(() => setMinTime(true), SPLASH_MS); return () => clearTimeout(id); }, []);
  const splash = !gone && <AnimatedSplash done={ready && minTime} duration={SPLASH_MS} onGone={() => setGone(true)} />;

  // One stable tree: the splash stays mounted on top (same position) while the app underneath finishes loading.
  return (
    <View style={{ flex: 1, backgroundColor: ready ? th.bg : '#FFFFFF', direction: rtl ? 'rtl' : 'ltr' }}>
      <StatusBar style={gone ? (th.dark ? 'light' : 'dark') : 'dark'} />
      {ready && <GlassBackdrop />}
      {ready && (!loggedIn ? (
        <AuthFlow />
      ) : locked ? (
        <PinScreen mode="unlock" onDone={enter} />
      ) : !live ? (
        // Trial or plan ended (or access not confirmed yet): the whole app is locked. Only the payment page can be reached. It opens the app again by itself once access is valid.
        <Paywall />
      ) : (
        <View style={{ flex: 1 }}>
          {desk ? (
            <DesktopShell>
              {TABS.map(({ key, Comp }, i) => (
                <Page key={key} active={tab === i}><Comp /></Page>
              ))}
            </DesktopShell>
          ) : (
            <>
              <View style={{ flex: 1 }}>
                {TABS.map(({ key, Comp }, i) => (
                  <Page key={key} active={tab === i}><Comp /></Page>
                ))}
              </View>
              <Dock />
              <RightSidebar />
            </>
          )}
          <TradeHistory />
          <NotificationCenter />
          <Tracker />
          {lic.admin && <AdminPanel visible={adminOpen} onClose={() => setAdminOpen(false)} />}
          <Toasts />
          {covered && <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}><PinScreen mode="unlock" onDone={enter} /></View>}
        </View>
      ))}
      {ready && loggedIn && !locked && <Help />}{/* the Help screen is outside the locked / unlocked branches, so it opens from the lock page too */}
      {splash}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Frame>
        <Provider>
          <ErrorBoundary>
            <Root />
          </ErrorBoundary>
        </Provider>
      </Frame>
    </SafeAreaProvider>
  );
}
