# Latest: the other website pages in the same style as the dashboard

- **Shared components restyled for the website only** (`src/ui.tsx`, the phone look is unchanged): `PageHero` becomes the dashboard header (small title line, big title, subtitle, chart picture), `Card` radius 14, `IconTile` / `Chip` rounder, `SectionHeader` and `SectionTitle` with an icon circle and bolder text. Every page that uses them (all of them) follows.
- **`Cols` (new, `src/ui.tsx`)**: puts a page's cards in two balanced columns on a wide website page (a plain stack on the phone and on narrow pages). It places cards left / right in turn, measures them, then fills the shorter column first, and keeps that placement so cards do not jump. Inside a column every part uses the column width (`WidthCtx` in `src/win.web.ts`, `src/win.ts`). Used on Settings, Killzones, Performance, Trade Checklist, Risk planner, How to use and About.
- **Markets**: the market rows are two columns (headings span both). **Risk planner**: a "Your plan" card on the right until you press Calculate.
- Tests: `tests/web/smoke.py` now also checks that Markets and Settings are two columns and that pages share the header (26 browser checks pass), plus the 17 unit test files, the type-check and the Android bundle build. The phone layout was re-checked at 390 px (unchanged).

# Earlier: trading dashboard for the desktop website (Forex, Crypto, Deriv)

- **Home on the website is now a dashboard** (`src/DesktopHome.web.tsx`; the phone keeps its Home screen, `src/screens/Home.tsx` picks which one): hero "Analyze / Plan / Execute" with real counts (analysis methods, live markets, 24/7 Crypto & Deriv, 3 take profits), **Choose Analysis Method** tiles, **Select Market** with Watchlist / Forex / Crypto / Deriv tabs, symbol search and symbol cards with live price and change, a chart panel (1m 5m 15m 1h 4h 1D; Pro chart = TradingView, Quick = the app's own candle chart, used for Deriv too), then Today's Analysis (bullish / bearish / neutral from the app's signal), Quick Tools (Scanner, Planner, Killzones, News) and Risk Management. "Open ICT analysis" opens the Analysis page with that pair and method.
- **Shell (`src/Desktop.web.tsx`)**: new sidebar (Analysis expands into its methods, Pro card, account), a **top bar** with market search (Ctrl+K), live status, notifications, PRO badge and account, and a right **Market Watch** panel (Forex / Crypto / Deriv table with stars, Forex Sessions in local time, news warning, daily reminder). Page headers no longer repeat the status chips on desktop (`src/ui.tsx`).
- **`src/dash.ts`**: shared state for what the dashboard shows (pair, method, timeframe, market tab) and the market lists; the search bar, the right panel and the dashboard all use it.
- Page width on big monitors is now up to 1120 px (`src/win.web.ts`).
- Tests: `tests/layout.test.ts` updated; `tests/web/smoke.py` now also checks the dashboard (market tabs, method tile, Ctrl+K search, sidebar Analysis menu, market watch + sessions). All pass, plus the 17 unit test files, the type-check and the Android bundle build.
- Not tested here: live prices and the real TradingView chart (the test machine had no internet; prices show a dash and the Pro chart area stays empty there). The new dashboard text is English only.

# Earlier: a real desktop website layout (not just the phone app in a column)

- **Desktop (browser 900 px or wider):** left sidebar menu (`src/Desktop.web.tsx`), the page in the middle (wider, up to 980 px), and from 1240 px a **Market watch** panel on the right (live prices, news banner, forex sessions). The bottom bar and the slide-out menu are not used there.
- **Landing page + login (`src/Landing.tsx`, `src/LiveCandles.tsx`, `src/AuthFlow.tsx`):** on a wide screen the welcome / login / sign-up screens show the brand, the headline, a live candle chart, six feature cards, "3-day free trial, Weekly $8, Monthly $20", with the form on the right.
- **Layout rules (`src/win.web.ts`):** under 900 px = phone layout (bottom bar, full width, centred and at most 640 px); 900 px and up = desktop. `useWindowDimensions()` now returns the width of the PAGE area, so every screen and chart sizes itself to it. `useLayout()` gives `mode`, `sidebar`, `rail`, `content`. On the phone app `src/win.ts` keeps the normal window size, so nothing changes there.
- `src/ui.tsx`: on desktop the page header shows only the status chips (the sidebar has the menu and the name), the page container is centred up to the page width, and the top glow band is skipped. The Analysis page now uses the shared `AppHeader` (it had its own copy with a menu button).
- `src/Modal.web.tsx`: on desktop pop-ups are centred dialogs over a dim backdrop. `src/Splash.tsx` and `src/Glass.tsx` use the real window size (the splash keeps a centred phone-sized column).
- Tests: `tests/layout.test.ts` (layout rules at 14 widths) and an updated `tests/web/smoke.py` (desktop: landing, login, sidebar, market watch, centred dialog, confirm box, proxy, chart, wheel zoom; phone browser: phone layout). All pass, plus the 17 unit test files, the type-check and an Android bundle build.
- Not tested here: the live Deriv feed and the real TradingView chart (no internet on the test machine), real Firebase and your real server (faked).

# Earlier: the app also runs as a website (see WEB.md)

- Same code, built with `npm run build:web` (Expo web). Phone app unchanged. Hosting files added: `vercel.json`, `netlify.toml`. Full guide: `WEB.md`.
- **Secure storage**: `expo-secure-store` has nothing on the web, so login, licence and PIN counters use `src/secureStore.ts` (phone: the real secure store) and `src/secureStore.web.ts` (browser: localStorage).
- **Desktop layout**: `src/Frame.web.tsx` keeps the phone layout in a centred 520 px column; `src/win.web.ts` caps the width every screen sees.
- **Pop-ups**: `src/Modal.web.tsx` draws pop-ups inside the column (fade/slide, Escape closes). Phone uses the normal Modal (`src/Modal.tsx`).
- **Alerts / share / notifications**: new `src/dialog.ts` (`showAlert`, `shareText`, `notify`). react-native-web ignores `Alert` and `Share`, so confirm questions (delete account, new account, close trade) would have done nothing.
- **TradingView / Deriv chart**: `src/ChartWeb.web.tsx` shows it in an iframe instead of the phone-only WebView.
- **Blocked sites (CORS)**: new `src/net.ts` (`xfetch`) sends Yahoo backup prices, the economic calendar and headlines through the server's new `/proxy` (`server/proxy.js`: allow-list of sites, https only, 20 s cache, 120 requests per minute per visitor). Server CORS now allows the `ngrok-skip-browser-warning` header and GET.
- **Mouse**: wheel zoom, hover crosshair on the candle charts (`src/ChartZoom.tsx`); alarm sound plays from `public/alarm.wav` in a browser; the connection tester treats a reply from a site as reachable.
- Push to a phone is skipped on the web (`src/push.ts`).
- `package.json`: added `react-dom`, `react-native-web`, `@expo/metro-runtime`, `@types/react-dom` and the scripts `web`, `build:web`, `serve:web`. `package-lock.json` updated (3 Expo patch versions moved up: expo-constants 57.0.21, @expo/image-utils 0.11.6, @expo/require-utils 57.0.6). `app.json` got a `web` section.
- Tests: `tests/proxy.test.ts` (12 checks on the proxy), `tests/web/smoke.py` (real browser: login, column, saved login, pop-up, confirm box, proxy, chart, wheel zoom). All pass. The unit tests, type-check and a phone (Android) JS bundle build still pass.
- Not tested: the live Deriv feed and the real TradingView chart inside the browser (the test machine had no internet), and the real Firebase / your real server (they were faked).

# Latest: new start screen (live candle chart, logo, slogan, flowing lines)

- `src/Splash.tsx` is rebuilt. White screen like the phone's own splash, so nothing jumps. Your logo starts exactly where the phone draws it, then glides up.
- **Slogan** under the logo: "Read the Market. Trade with Precision." (letters tighten in, a thin blue line grows under it).
- **Endless live candle chart** below the logo: candles form tick by tick and slide left, price rises and falls in smooth waves. It has volume bars, an EMA line, a price axis and a live price tag. No pair name or numbers header.
- **10 flowing lines on each side of the logo** (logo area only): light streaks travel left to right, colours shift slowly between teal, blue and violet.
- Progress line with a status text (Loading market structure, Reading price action, Detecting liquidity & imbalance, Ready), then "Powered by Bahu Technology".
- New file `src/splashMath.ts` holds all the drawing maths (no phone code), so it can be tested in Node. New test `tests/splash.test.ts` (no NaN over 20 s of frames on 4 screen sizes, about 30 candles on screen, price goes up and down, 10 lines per side). It passes.
- `SPLASH_MS` in `App.tsx` is now 3600 (was 2200) so the whole intro plays. Change it back if you want a shorter start.
- No new package (uses react-native-svg, expo-linear-gradient and react-native-safe-area-context, which are already in package.json) and `app.json` is untouched, so `eas update` works.
- Old splash saved as `src/Splash.flat-backup.txt` (rename it to `Splash.tsx` to go back).
- Checked: the new files type-check with the real react-native / react-native-svg types, and the unit test passes. Not run on a phone yet, so look at it once on a device.

# Latest: SMC method rebuilt from "Smart Money Concepts (SMC): The Complete A to Z Guide"

The old SMC engine (src/smc.ts) was a short version: swing + internal structure, one decisional order block, supply/demand bases, breakers and an inducement flag, scored out of 100 with fixed weights. It now follows the PDF section by section.

1. **Structure** (guide 3.1-3.2). Swing and internal pivots (N = 5 and 2, configurable 2-5). BOS / CHoCH need a candle BODY close; a wick through a level is a sweep. Every break is checked for displacement (body at least 1.5x the average body, closing in the outer 30%). Strong / weak swing points are reported.
2. **Liquidity** (3.4). Swing highs/lows, equal highs/lows (EQH/EQL), previous day and previous week high/low (UTC days), inducement. A sweep = price trades through a level and closes back inside within 1-3 candles; no close back = a break, not a sweep.
3. **Imbalance** (3.5). Fair value gaps with the CE midpoint, and inverse FVGs (body closes through the whole gap).
4. **Order blocks** (3.6-3.7). Extreme OB (origin of the leg) and decisional OB (right before the displacement), each checked for: broke structure, displacement, took liquidity, unmitigated. Failed blocks become a breaker (a high/low was swept first) or a mitigation block (no sweep). Supply/demand bases are labelled DBR / RBD / RBR / DBD.
5. **Premium / discount and OTE** (3.8). Dealing range, 50% equilibrium, OTE 62-79% with the 70.5% sweet spot.
6. **POI score 0-8** (3.9). The 8 checks from the guide, shown on every setup. Trade at 6 or more (`minPoi`).
7. **Top-down bias** (section 4). The direction comes from the higher timeframe; a neutral higher timeframe = no trade. When the screen has no higher-timeframe candles the engine groups the chart candles x4 and says so on screen. The Scanner and the server scanner already pass real higher-timeframe candles.
8. **Entry models** (section 6): sweep + CHoCH + POI retest, BOS + pullback, inducement, breaker, Wyckoff spring / upthrust. Entry at the middle of the POI (mean threshold / CE, `entryAt: 'edge'` for the near edge). Stop beyond the swept extreme or the far side of the POI (whichever the structure says), targets at liquidity, main target (TP2) at least 1:2.
9. **Pre-trade checklist** (section 12): bias, premium/discount, POI score, liquidity swept, inducement, structure shift with displacement, stop, reward:risk. If any answer is "no" the setup is capped at 69 (grade B), so the scanner gate (70+) and the single-method list ignore it. This is the rule "if any answer is no, there is no trade".
10. **Written if-then plan** (section 5) and a "wait for" line are shown in ICT Lab > SMC, with the POI score card and the higher-timeframe bias, OTE and sweep rows. ICT Lab > SMC now loads real higher-timeframe candles like the ICT tab does.

Files: `src/smc.ts` (rewritten, same exports plus new fields), `src/refine.ts` (passes the higher timeframe to SMC, finds the inducement check by key), `src/screens/ICTLab.tsx`, `server/analysis/smc.js` and `refine.js` (rebuilt with `npm run build:server`), `tests/smc.test.ts` (new, 22 checks incl. a textbook long and its mirror, wick vs body, EQH, neutral bias, 600 random markets).
- All 13 test files pass. Not run on a phone or with real market data. The ICT Lab edit was only syntax-checked, not rendered.
- The rules are strict on purpose: on 600 random markets only 23 of 338 SMC setups passed every rule. Use `node server/backtest.js` on real candles before trusting it.
- Not done: Asian / London session highs and lows as liquidity (ICT module has them), lower-timeframe OB refinement, lot size and daily loss limits (Risk page).

---

# Latest: Scanner scans the whole market and shows a setup from ANY method at 70+

- **Whole market.** The scanner used to stop after 14 pairs. It now scans every pair of the selected market (Forex, Synthetic, Watchlist: all of them; Crypto: the 60 most traded USDT pairs, because Binance has hundreds). Six pairs are fetched at a time and the progress bar shows how far it is. The server scanner takes up to 100 pairs (was 14).
- **Any method.** New `src/methodSetups.ts` collects each method's own trade: ICT, SMC, Candlestick, Scalping (own score), VSA (strength of the volume read, exists only after the 4-stage reversal is confirmed), Chart pattern (pattern quality) and the Combined entry. Every setup scoring 70 or more is listed with its entry, stop and TP1-TP3, whether or not the other methods agree. The same trade found by several methods is shown once with "same trade also found by: ...".
- Each setup says what to do now (enter now, wait for the reaction, limit order), when to cancel it, and why. Setups already over (stop hit, TP1 reached) or more than 8 ATR away are dropped. Each has its own Take / Skip buttons.
- Row header shows the best setup of that pair, its score and the method (ENTRY NOW or NEAR ENTRY replaces the method name when the combined setup also passed the alert gate).
- Notifications are unchanged: only the combined setup that passes the entry gate (3+ methods agree, none against, price in or near the zone, no news) rings or sends a push. A single-method setup is listed but stays silent.
- Tests: `tests/methodsetups.test.ts` (valid stop and targets, score 70-100, sorted, not over). On 1500 synthetic markets: 123 setups from 117 markets (only 5 combined setups scored 70+ before).

---

# Latest: no more expo-notifications errors in Expo Go

- Expo Go on Android (SDK 53 and newer) removed remote push, and importing `expo-notifications` there printed "Android Push notifications ... was removed from Expo Go" on every start. `src/push.ts` now detects Expo Go (`inExpoGo`) and does not load the module at all, so the error is gone and the app runs normally. Settings > Background alerts explains that push needs the installed APK or a development build. In-app alerts still work in Expo Go.
- Push notifications (app closed) can only be tested on a real build: `eas build --profile preview --platform android`.

---

# Latest: no setups on closed markets, strict entry gate for every alert

Problem: on Saturday the Scanner still listed EUR/USD and other forex entries, because it analysed Friday's last candles as if they were live. `fxWeekendClosed` existed in `markets.ts` but nothing used it. Alerts also rang for any setup scoring over the slider level, even when price was far from the entry.

1. **Market-open check** (`src/session.ts`, new). Two independent tests, both must pass:
   - Weekly schedule: forex, gold, silver and DXY close Friday 17:00 New York time and reopen Sunday 17:00 (21:00 UTC in US summer time, 22:00 UTC in winter, follows the daylight-saving rule already in `ict.ts`). Stock indices are closed on Saturday and Sunday. Crypto and Synthetic indices are 24/7.
   - Fresh data: the newest candle must be recent for the chosen timeframe (older than 2 candles + 2 min, minimum 10 min = stale). This also catches holidays, a dead feed and the exchange's own "closed" flag.
   A closed market is not analysed at all (no download either). The Scanner shows one "Market closed" card with the reopen time, nothing is saved to the Journal and nothing rings. Analysis screens also stop auto-saving signals to the Journal while the market is closed (`src/signalLog.ts`).
2. **Entry gate** (`src/verdict.ts`, new). A setup can still be listed, but it only rings (toast, in-app alarm, push) when ALL of these are true:
   - score is 70% or more (the slider can raise this, never lower it; the lowest slider step is now 70)
   - an ICT or SMC zone gives the entry location
   - at least 3 of the 5 methods (ICT, SMC, VSA, chart pattern, candlestick) agree, and at least one is a confirmation method (VSA, pattern or candle)
   - no method points the other way, and the higher timeframe is not against the trade
   - timing: **Entry now** = price is in the zone and just rejected it. **Near entry** = price is still approaching the zone and is within 1 ATR of it. A zone that price already touched and left, or one more than 1 ATR away, does not alert
   - first target is at least 1:1.4 (1:1.2 from the current price when entering now)
   - no high-impact news for the pair, and not in the last hour before the weekly close or the first hour after the weekly open (thin liquidity, gaps)
3. **Why no alert.** Open a Scanner row: it lists the methods that agree (for example 3/5) and, when there is no alert, each rule that blocked it. Rows show ENTRY NOW, NEAR ENTRY or WATCH.
4. **Server pushes use the same rules.** `server/alerts.js` skips closed markets and stale candles and runs the same gate (`server/analysis/verdict.js` and `session.js`, rebuilt). Push text says "enter now" or "near entry" and how many methods agree. A near-entry push can be followed by an entry-now push for the same setup; the same level is not repeated for 4 hours. The server has no news calendar, so the news rule only applies on the phone. The minimum probability the server accepts is now 70.
5. Journal: the Scanner now only saves setups that passed the gate.
- Tests: `tests/gate.test.ts` (schedule in summer and winter, stale candles, thin hours, 1500 synthetic markets where every alert must satisfy every rule, and a real alert with each rule broken one at a time). The server scanner was also run end to end with a fake feed: fresh candles push once, 3-hour-old candles and stale EUR/USD stay silent. All 11 test files pass.
- Not tested on a phone or on real market data (none available here), and `Scanner.tsx` was only checked without the real React Native types. The gate is deliberately strict: on synthetic data only 1 in about 1500 series produced an alert, so expect few alerts on real markets. Use `node server/backtest.js` to see how setups of each score actually performed before you trust any level.
- After pulling this: `npm run build:server` (already run here), then a normal app update. Nothing new to install.

---

# Latest: professional trade buttons, no repeated setups, trade chart in Manage, VSA reversal entry

1. **Buttons.** New `ActionBtn` (`src/ui.tsx`): Manage (neutral), Break-even (amber, turns green "BE set" when done) and Close all (solid red) sit on one row with an icon over a one-line label, so "Break-even" and "Close all" no longer wrap. The shared `Btn` also never wraps its label now (it shrinks slightly) and has new tones: `tone="danger"`, `"warn"`, `"good"`. This fixes buttons on every screen. Sheets keep clear of the Android navigation bar.
2. **No repeated setups.** A setup is not shown, logged or alarmed again when: a trade is already running or waiting on that pair in that direction (any method); you already took that setup (hidden 24 h, even after it closes); or you skipped it (6 h). Applies to Scanner rows and counts, Take/Skip bars on every analysis screen, the Journal list, the in-app alarm, and the background push (the app sends the server a `mute` list, see `server/alerts.js`). Files: `src/trades.ts` (`liveSame`, `wasTaken`, `muteKeys`), `src/store.tsx`, `src/TakeSkip.tsx`, `src/screens/Scanner.tsx`.
3. **Manage shows the chart.** `src/TradeChart.tsx` draws the candles of the trade's timeframe with the entry zone, entry (fill), stop, TP1 to TP3, shaded loss and profit areas, the candle where the trade opened, a break-even stop line and the live price. Under it, "Why this entry" names the method, how that method is entered, and the reasons saved with the setup. Setups now carry `why`, `zone` and `level`. Setups saved before this update show the chart and levels but no reason lines.
4. **VSA reversal entry** (`src/vsa.ts`, rebuilt for the server in `server/analysis/vsa.js`). Rule for every setup: low-volume breakout, then retest, then enter only on the confirmation candle. Detects buying climax, selling climax, no supply, no demand, shakeout and upthrust, then tracks four stages (pattern, low-volume breakout, retest, confirmation). A trade setup exists ONLY at stage 4. A breakout on heavy volume is rejected; a close back through the level cancels it; a breakout with no retest is not chased. The VSA tab has a new stage card (`src/VsaCard.tsx`) and the chart marks P / B / R / C candles and the key level. Without a volume feed it falls back to spread (lower confidence, said on screen).
- Tests: `tests/vsa.test.ts` (buy and mirrored sell, heavy-volume breakout rejected) and 9 new checks in `tests/trades.test.ts`. All pass here.
- Not run on a phone or on real market data (none available here). The UI files were syntax-checked, not rendered. After pulling this, run `npm run build:server` only if you change `src` again (the server copy is already rebuilt).

---

# Latest: deeper analysis review, real entry plan, higher-timeframe filter, backtester

Problems found in the old analysis and what changed:
1. Stale setups. A zone could be shown (and alarmed) after price had already run past TP1, or when it was 6 to 12 ATR away. Now `src/entry.ts` classifies every setup: enter-now (price reacted from the zone), wait-trigger, limit, far, late, invalid. Late, invalid and zones over 8 ATR away are dropped, so no more alarms for trades that are over.
2. No entry instructions. Every setup now carries the entry label, the trigger to wait for, a cancel rule (stop closed through, TP1 first, or 20 candles) and the risk:reward if you enter at the current price. Shown in the Scanner row and in the combo notes.
3. No higher-timeframe check. `analyzeAll(c, now, { htf })` adds +6 when the higher timeframe agrees and -14 (and caps the grade at B) when it is against. The Scanner and the server scanner fetch the higher timeframe themselves (M15 uses H1, H1 uses H4, and so on, see HTF_OF in entry.ts).
4. Inflated scores. Checks that nearly always passed (structure side, TP1 ratio) gave free points in ICT and SMC; weights were re-balanced toward the checks that separate good setups (sweep, OTE, overlap, inducement, decisional block). A very wide stop (over 3.5 ATR) or TP1 under 1.2R now lowers the score.
5. Killzones ignored US daylight saving, so they were one hour wrong for about 8 months a year. They now follow New York time (see nyOffsetHours in ict.ts).
6. New `server/backtest.js`: replays real candles candle by candle (no look-ahead), simulates the entry plan and the 50/30/20 exits, and prints win rate and average R per score bucket, status and higher-timeframe agreement. Run: `node server/backtest.js frxEURUSD,frxXAUUSD 900`. Use it to choose the minimum score you trust. The score is a ranking, NOT a measured probability, until you check it with this tool.
- After changing any file in src, run `npm run build:server` again so the server scanner uses the same code.
- Tested here only on synthetic candles (no market data available): no crashes, geometry always valid, random data gives about zero average R as it should. Not tested on real markets or on a phone.

---

# Latest: 3D splash screen

- `src/Splash.tsx` keeps your design (white screen, logo, candles, title, progress, "Powered by") and makes it 3D with React Native's own transforms. No new package.
- The logo is extruded: 12 dark copies sit behind it and slide as it turns, so it has real thickness. It starts flat (no jump from the phone's splash) and then swings gently left and right.
- Candle bars are 3D blocks (front, side, top). Two tilted orbit rings with a moving dot circle the logo. The title letters are extruded and the loading bar has a lip.
- Old flat version saved as `src/Splash.flat-backup.txt` (rename to `Splash.tsx` to go back).
- Not run on a device. Settings at the top of the file: `LAYERS`, `LAYER_STEP`, `SWING_DEG`.

---

# Latest: alarms when the app is closed (background alerts)

The app cannot run while it is closed or the phone is locked, so the SERVER now does the watching and sends a push notification.
- Price alerts you set are copied to the server (`src/remote.ts`). The server checks prices every 10 s and pushes when one is reached.
- Scanner: with "Auto rescan every 90 sec" and "Alarm for strong setup" on, the server runs the same scan every 90 s (same analysis code, built into `server/analysis`) and pushes each new setup at or above your chosen probability. The same setup is not repeated for 4 hours.
- New files: `server/alerts.js`, `server/build-analysis.js`, `src/push.ts`, `src/remote.ts`, `src/tpconst.ts`. Settings > Background alerts has the Enable and Test buttons.
- Needs: Node 22+ on the server, `npm run build:server`, and a NEW app build (new native module expo-notifications) with Firebase FCM set up. Not run on a device.

---

# Latest: Analysis View chart pinch zoom with fingers

- Cause: the page's vertical ScrollView took the touch before the candle chart could see the two-finger pinch, so the chart only zoomed with the + / - buttons.
- Fix: new `src/scrollLock.ts`. `Screen` (`src/ui.tsx`) and the pair sheet (`src/MarketWidgets.tsx`) stop scrolling while a finger is on a candle chart, and `useZoom` (`src/ChartZoom.tsx`) turns the lock on at touch start and off when the last finger lifts (also on cancel and unmount). This covers the Analysis View, method charts and the pair screen chart.
- Side effect: dragging up/down starting on the chart no longer scrolls the page. Scroll from outside the chart.
- Not run on a device.

---

# Latest: full project check, dead files actually removed

- The project zip still contained the legacy files the notes below say were removed. Deleted now: `src/AlertCenter.tsx`, `src/ChartView.tsx`, `src/ResultView.tsx`, `src/TradeDecision.tsx`, `src/screens/Analyze.tsx`, `src/alarm.ts`, `src/analysisAssets.ts`, `assets/analysis/` (29 images) and `README.txt`. None was imported by the app.
- Removed unused imports in `MarketWidgets`, `MethodArt`, `TradePlan`, `Checklist`, `Home`, `ICTLab`, `Journal`, `News`, `Settings`, `store`.
- Checked: every relative import resolves, nothing left unreachable from `index.ts`, no type errors in app code, `server/server.js` parses, all 8 test files pass.
- Known gap: the take-profit alarm. `store.tsx` raises alarms (`raiseAlarm`) but no screen shows them and no sound plays, because `startAlarm` in `src/native.ts` is not called anywhere. `expo-audio` is also not in `package.json`. Both need a decision before the alarm can work.

---

# Latest: type errors cleared, Analysis header order, notification header spacing

- Removed five unused legacy files that caused the ~40 type errors: `src/AlertCenter.tsx`, `src/TradeDecision.tsx`, `src/ChartView.tsx`, `src/ResultView.tsx`, `src/screens/Analyze.tsx`. Nothing imported them.
- Analysis (`src/screens/Analysis.tsx`): the selected-method heading (back button, icon, name) is now first; the Choose Analysis Method and Select Market boxes are below it.
- Notifications (`src/NotificationCenter.tsx`): back button and Clear all moved down from the status bar (top padding uses max of safe-area inset, status bar height, 24, plus 14).
- Trade history (`src/TradeHistory.tsx`): header moved down from the status bar, same fix as notifications.
- Removed more unused files: `src/alarm.ts` (replaced by `native.ts`), `src/analysisAssets.ts`, `assets/analysis/` (images only it used) and the stale `README.txt`.
- Not type-checked with the real packages or run on a device.

---

# Latest: TradingView tab and chart pinch zoom

- The tab is now named in full, **TradingView** (no more "TV"), and rebuilt as a professional panel (`src/TradingViewPanel.tsx`): header with the exact TradingView symbol, timeframe strip (M1 to D1), chart styles (Candles, Hollow, Heikin Ashi, Bars, Line, Area), indicators grouped into Trend / Momentum / Volatility / Volume with a count and Clear all, refresh, full screen and an "open on tradingview.com" link.
- Two-finger pinch zooms every web chart in and out, and one finger drags it. While a finger is on a TradingView or Deriv chart the page around it stops scrolling (`onTouching` in `src/ChartWeb.tsx`), and the chart page cannot zoom itself (`user-scalable=no`). The built-in candle charts (Analysis View, method charts) already pinch zoom around your fingers.

# v2.11.0: glass themes only, new pair screen

## What changed
- **Themes** (`src/theme.ts`): Dark Blue and Light are removed. Only the four glass themes remain (Glass Night, Glass Frost, Glass Aurora, Glass Rose). Anyone who had Dark Blue (or an older dark theme) saved is moved to Glass Night, anyone who had Light is moved to Glass Frost. New installs start in Glass Frost. Settings > Theme now shows the four themes in a 2 x 2 grid.
- **Pair screen** (`SymbolSheet` in `src/MarketWidgets.tsx`, opens from Markets and Home): it was a plain flat page because the pop-up did not draw the glass backdrop. It now matches the rest of the app:
  - glass backdrop and glass header (back, coin badge, pair name with switcher, star)
  - hero card with live dot, big price, up/down change pill and a mini price line
  - chart inside a framed glass card, indicator chips in their own card, Full screen button
  - Signal / RSI / High / Low as icon stat tiles under a section header
  - AI analysis button with a glowing result card and a bias badge
  - price alerts card with Above / Below buttons and tidy alert rows
  - the pair picker and the full screen chart use the same glass look
- `Coin` badge moved from Markets to `src/MarketWidgets.tsx` so both screens share it.

## Notes
- JavaScript only: `eas update` is enough.
- Typecheck: no new errors (the same 40 old ones in unused files).
- Not run on a device.

---

# v2.10.0: take profit split, break-even, notification bell

## What changed
- **Take profit split** (`src/screens/Journal.tsx` Take sheet, `src/trades.ts`): when you tap Take you now set how much to close at TP1, TP2 and TP3 (default 50 / 30 / 20, quick buttons 50/30/20, 40/30/30, 34/33/33, 100/0/0). The three boxes must add up to 100% or Take trade stays disabled. Under each box the app shows the lots that share is worth.
  - **Close automatically** (on by default): each share is closed by itself at its take profit price. The last share finishes the trade and it goes to the journal and Trade history. Switch it off and nothing closes by itself: the alarm rings as before and Manage offers a "Close as planned" button with your percentage.
  - The running trade card shows the plan (TP1 50% ...), a green tick on every share already taken, and an AUTO badge.
- **Break-even** (same sheet): the switch "Break-even after TP1" moves the stop to your entry by itself the moment TP1 is reached. Running trades now also have a **Break-even** button right on the card (before it was hidden inside Manage). The stop is only moved when price is already in profit, otherwise a message explains why.
- **Notification bell** (`src/NotificationCenter.tsx`, `BellButton` in `src/ui.tsx`): the bell no longer jumps to News. It opens the list of every notification (orders filled, take profits, auto closes, stops, break-even moves, scanner setups, trades you closed), newest first. The red number counts the new ones and disappears once you have opened the list. Each line has an X, and **Clear all** empties the list (asks first). The list is kept on the phone (60 lines max) and is emptied when you log out.
- **How to use** (6 languages): the Journal card explains the split and break-even, and a new Notifications (bell) card was added.
- Everything new is translated into English, Urdu, Hindi, Dutch, Arabic and Spanish (`src/strings29.ts`).

## Notes
- JavaScript only: `eas update` is enough.
- New test file `tests/plan.test.ts` (16 checks: auto split, last share finishing the trade, gaps through all targets, alarm-only mode, break-even after TP1, sell side). Run with `npx tsx tests/plan.test.ts`. The existing trade tests still pass.
- Trades you took before this update have no split saved, so they behave exactly as before (alarm only).
- Not run on a device.

---

# v2.9.0: slimmer sidebar, clear menu button, full how-to-use guide, Trade history

## What changed
- **Sidebar slimmer** (`src/RightSidebar.tsx`): panel is now at most 284 px (and never more than 76% of the screen) instead of 332 px / 86%. Rows are 48 px with a 34 px icon tile and 14 px names, the header and footer are tighter, the page list is easier to scan.
- **Menu button** (`src/ui.tsx` `MenuButton`, used by every page header and the Analysis header): the candle logo is gone. It is now a three-line menu icon in a bordered tile, so it reads as a control that opens the sidebar.
- **How to use** (`src/guideContent.ts`, `src/screens/Guide.tsx`): new section "All features and how to use them" with 14 cards (menu, Home, Analysis, Scanner and alarms, Markets, Journal, Trade history, Risk planner, History, Killzones, Performance, Checklist, News, Settings). Written in English, Urdu, Hindi, Dutch, Arabic and Spanish.
- **Trade history** (`src/TradeHistory.tsx`): a full window with net result, win rate, trades, best, worst and average R, filters (period, wins/losses, buy/sell), market search, trades grouped by day with a daily total, tap a trade for details, delete, and CSV export. Buttons to open it: sidebar, Home, Journal > Closed. Labels are translated into all six languages (`HIST_STR`).

## Notes
- JavaScript only: `eas update` is enough.
- Typecheck: no new errors. The 40 existing errors come from old unused files (AlertCenter, ChartView, ResultView, TradeDecision, Analyze) and are unchanged.
- Not run on a device.

---

# Round 10: premium sidebar, cloud backup that survives a reinstall, edit profile, delete account

## What changed
- **Sidebar redone** (`src/RightSidebar.tsx`): wider panel, bigger rows (58 px) with a clear icon tile, the page name in 15.5 px full-contrast text and a one-line explanation under it, so nobody has to guess what a page does. The open page gets a gradient tile and an accent outline. Section titles are larger with a divider line, the profile header shows the real plan (PRO / TRIAL / EXPIRED / ADMIN) and opens Settings when tapped, and Log out is a clearly visible red button.
- **Paper-trading history survives an uninstall** (`src/store.tsx`, `src/license.ts`, `server/server.js`): the journal, setups, paper balance and desk rules, analysis history, theme / language and profile photo are backed up to your server a couple of seconds after every change (and when the app goes to the background or you log out). After a reinstall, log in with the same email and everything comes back. Details:
  - Nothing is pushed until the first restore of a login has finished, so an empty fresh install can never overwrite the real backup.
  - If the phone already has data, the two are merged by id (nothing is lost either way).
  - The backup is tied to the person (Firebase uid, then email), not to the phone, so it also works on a new phone and after an email change.
  - The backup is erased only by **Delete account**.
- **Edit profile** (`src/EditProfile.tsx`, opened from Settings > Account > Edit profile): change name and phone number (phone is saved on the server and comes back after a reinstall), change email (needs the current password; Firebase sends a confirmation link to the new address and the email changes after the link is tapped, the same account and all its data stay), see the backup status and **Back up now**.
- **Delete account** (same screen, red section): asks for the password and a final confirmation, erases the backup, name and phone on the server, deletes the Firebase login and clears the phone. The trial / plan record stays on the server (marked deleted) so a new trial cannot be farmed by deleting and signing up again.
- **Server** (`server/server.js`): new endpoints `/sync/get`, `/sync/put`, `/profile/put`, `/account/delete`. Backups are one small file per person in `<DB_FILE>.sync/` (4 MB limit each). A person is now found by Firebase uid first, then email, then device.

## Notes
- **You must restart / redeploy `server/server.js`** for the backup, phone and delete features to work. Until then the app still works normally and the Edit profile screen shows "Could not reach the server" for the backup. Back up the `.sync` folder together with `db.json`.
- JavaScript only for the app: `eas update` is enough.
- Phone number is stored as a profile detail (no SMS verification, which would need Firebase phone auth and a new build).
- Not run on a device. All 101 source files parse, no undefined names, and the server endpoints were tested locally with a fake session (save, read, bad phone, bad payload).

---

# Round 9: one corner size, two more glass themes, Journal tab bar, premium charts, new timeframe bar

## What changed
- **One corner radius everywhere** (all screens, `src/theme.ts`): every card, panel, banner, button, input, chip, tile, bottom sheet and logo now uses radius 8 (was 12 / 18 / 22). The tokens in `R` are all 8. Circles (dots, avatars, count badges, round icon buttons) stay round.
- **Two new glass themes** (`src/theme.ts`, picker in Settings > Appearance): **Glass Aurora** (dark: deep ocean teal with emerald, sky and violet light, sky-blue accent) and **Glass Rose** (light: blush, lilac and sky light, orchid accent). The theme picker preview now shows the real gradient. Names are in `th_glassAurora` / `th_glassRose`.
- **Journal tab bar redone** (`src/screens/Journal.tsx`): Signals / Live / Closed / Insights are now icon-over-label tabs in one bar. The open tab is the accent gradient, every tab uses the same accent (no more green and violet mix), counts are small corner badges, and Live shows a status dot while a trade is running.
- **Charts** (`src/MethodChart.tsx`, `src/IndicatorChart.tsx`, `src/ChartView.tsx`): the **entry line is now the accent blue instead of black** (also in Trade Plan lines, AI levels and the screenshot overlay). Price tags on the right axis are rounded and pick a readable text colour (`ink()` in `theme.ts`), candles have softly rounded bodies, the grid is a quiet dotted grid, the plot has a faint accent wash, and method charts shade the **reward zone (entry to last target, green)** and **risk zone (entry to stop, red)**.
- **Timeframe bar redone** (`src/Timeframe.tsx`): one dock with the pinned timeframes (a thin divider between minutes / hours / days), a clear active gradient chip, and a **More** button. A one-line caption under it explains the chosen timeframe (for example "15 minutes · 96 candles / day · Intraday entries"). The picker sheet shows big tiles with the full name and what each timeframe is good for, a star to pin, and **Reset pinned timeframes**.

## Notes
- JavaScript only: `eas update` is enough (no new native package).
- Not run on a device. All 100 source files parse and no undefined names were found. Please check Glass Aurora and Glass Rose on a real phone, the Journal bar with 3-digit counts, and a method chart with an open plan (entry, stop, targets).

---

# Round 8: no capsule in the bottom bar, one corner size, hero on every page, new Settings and Home, fingerprint lock

## What changed
- **Bottom bar**: the tinted capsule behind the open tab is gone (`src/Dock.tsx`). The open tab is shown by the light beam, a brighter icon and a bold name.
- **One corner size for every box** (`src/theme.ts`, all screens): every card, panel and banner now uses the same radius as the big box on the Analysis page (18). Tiles, buttons, inputs and chips that sit inside a box use 12. The two numbers live in `R.box` and `R.inner`; the shared `Card`, `Btn`, `Field`, `Segment` and the Analysis page itself were moved to them too.
- **Hero heading on every page** (`src/ui.tsx`): `Screen` now draws the same top row as the Analysis page (logo / menu, Chart Reader, PRO, LIVE, alerts bell) and a hero banner under it (accent gradient, page icon, title, one-line help, candles on the right). Each page passes its own icon. The Analysis page is unchanged.
- **Settings page rebuilt** (`src/screens/Settings.tsx`): profile card with status badges, Edit photo and Log out buttons; Subscription card with a clear status header; Appearance with theme preview tiles and language chips; Security as one list with icon rows (Fingerprint lock, PIN lock, Lock app now, Change password opens in place); Server and admin kept for admin.
- **Home page** (`src/screens/Home.tsx`): quick-action row (Analysis, Scanner, Scalping, Top-Down, Planner, Journal, Killzones, News), **Top movers** (gainers and losers from live prices of the majors plus your watch list), **Recent setups**, **Performance snapshot** (trades, profit factor, average and best trade from the Journal) and a **Trading tip of the day**. Existing cards (trade desk, market pulse, equity curve, sessions, quick start) stay.
- **Fingerprint lock** (`src/PinScreen.tsx`, Settings > Security): turn it on with a switch (it asks for your fingerprint once to confirm). The lock screen asks for the fingerprint as soon as it opens, has a fingerprint key next to the keypad, and works with or without a PIN. The phone's own PIN / pattern is the fallback. It locks again after 2 minutes in the background, and Settings has **Lock app now**.

## Notes
- **Fingerprint needs one new build** (`eas build`): it uses the native package `expo-local-authentication` (added to `package.json` and `app.json`; run `npm install` first). Everything else in this round is JavaScript and goes out with `eas update`. On the old APK the fingerprint switch shows a message instead of crashing.
- Not run on a device. All files parse with no undefined names; please check both themes, a glass theme, and the Home page with an empty journal.

---

# Round 7: two glass themes, two separate boxes, lot system per market, DXY + gold + silver in Forex

## What changed
- **Two new glass themes: Glass Night and Glass Frost** (`src/theme.ts`, `src/Glass.tsx`, picker in Settings > Appearance). Translucent panels over a gradient backdrop with soft colour glows, a bright top edge on cards, and see-through borders. Bottom sheets and pop-ups stay solid (`th.solid`) so text is always readable. No native blur module is used, so `eas update` is enough; a real blur (`expo-blur`) would need a new build.
- **Open any analysis: two separate boxes** (`src/screens/Analysis.tsx`). Box 1 is **Choose Analysis Method**, box 2 is **Select Market** with **Watch list first**, then Crypto, Forex, Deriv. The Metals chip is gone.
- **Lot system per market** (`src/lots.ts`, take-trade sheet in `src/screens/Journal.tsx`):
  - **Forex** (including gold, silver, DXY): 1.00 lot is a fixed contract (100,000 units, gold 100 oz, silver 5,000 oz, DXY $1,000 per 1.00 move). Min 0.01, step 0.01, max 100. The sheet shows the pip value.
  - **Crypto**: 1.00 lot = 1 coin. The smallest lot follows the price (BTC 0.001, ETH 0.01, XRP 100), about $30-$100 per minimum lot.
  - **Deriv**: 1.00 lot = $1 per index point, with each index's own minimum / step / maximum: Volatility 10 and 25 min 0.50, Volatility 50 min 4.00, Volatility 75 min 0.001 (max 20), Volatility 75 (1s) 0.005, Boom / Crash 500, 600, 900, 1000 min 0.20, Boom / Crash 300 min 1.00, Step min 0.10 in steps of 0.10. Other Deriv indices use 0.01 / 0.01 / 100.
  - The sheet now shows a one-line contract explanation, quick-pick sizes for that market, the right minimum / step errors, and warns when even the minimum lot risks more than your rule. The last-used size is remembered per market.
  - 12 new checks in `tests/lots.test.ts`.
- **Forex now holds DXY, Gold and Silver; the Metals category is removed** (Markets page, Scanner, Analysis, and the Deriv catalogue mapping). DXY, Gold and Silver are listed first. Anyone with Gold or Silver in the watch list keeps them.
- **DXY feed**: Deriv does not list DXY, so its price and candles come from the Yahoo source (price every 15 s, candles every 10 s, delayed). The Markets page "backup feed" notice appears for it.

## Notes
- The Deriv minimum lots come from a third-party MT5 reference. Deriv can change them: confirm in your own account (MT5: Ctrl+U). They are in one table, `DERIV_LOTS` in `src/lots.ts`.
- DXY contract size ($1,000 per 1.00 index move) is an assumption; brokers differ. Change `lotUnits` if yours differs.
- Dark Blue and Glass Night accent was darkened a little (`#4A82FF`) so white text on the solid active chips is easier to read.
- Not run on a device. All 85 source files parse; lots, trades, momentum and zoom tests pass. (`gemini` and `headlines` tests need the native packages and fail the same way on the original upload.)

---

# Round 6: Analysis page tidy-up, named bottom bar, softer corners, lighter dark theme

## What changed
- **Settings card removed from the Analysis page** (`src/MethodArt.tsx`). Settings is still in the bottom bar and the side menu. The Scanner Setup card (auto rescan, alarm, probability) is unchanged: it lives inside the Scanner method.
- **Open any analysis: all methods and all categories sit in one box at the top** (`src/screens/Analysis.tsx`). The box has an ANALYSIS row (every method) and a CATEGORY row (Crypto, Forex, Deriv, Metals, Watch list). The open one is filled with the accent colour.
- **Bottom bar now shows names** under the icons (`src/Dock.tsx`), and the open tab gets a tinted pill behind its icon, a brighter icon and a bold label.
- **Smaller corners everywhere**: 106 hard-coded radii were reduced (cards 10 -> 6, big banners and tiles 14-18 -> 7-9, pills -> 6-8). Circles, dots and count badges were left round. The shared tokens `R` in `src/theme.ts` were reduced too.
- **Dark theme lifted** (`src/theme.ts`): background `#01040F` -> `#111C38`, cards `#0A1E4A` -> `#1B2B52`, brighter text, accent and buy / sell colours. Light theme untouched.
- **Active states are clearer**: selected chips (pairs, timeframes, styles, tags, zoom buttons) are now filled with the accent colour with white text instead of a faint tint.

## Notes
- Not run on a device. All 84 source files parse; please check both themes, the bottom-bar labels (longer words in other languages shrink to fit) and an open method page.
- JavaScript only: `eas update` is enough.

---

# Round 5: Analysis page v2 (second mockup), new icons, three new tools

## What changed
- **Analysis page rebuilt to the new mockup** (`src/screens/Analysis.tsx`): Chart Reader header (PRO, LIVE, bell), "Smarter Analysis / Better Trading" banner with candlesticks, **Choose Your Analysis Method** with a search box and 14 cards (Recommended badge on Combined), **Live Markets** strip and **Recent Analysis** strip. One column on phones, two on tablets.
- **Old image icons and hero pictures removed** (`assets/analysis/` and `src/analysisAssets.ts` deleted). New icons are glossy gradient tiles with white glyphs, one colour per method (`src/MethodArt.tsx`). No image files, so the app is smaller and recolours cleanly.
- **Trade Score is real.** The rings show the live score of each method for the pair chosen in Live Markets (M15). Where a method has no setup right now it shows "--", never a made-up number. Top-Down and Scanner show the last saved score. Live Markets prices come from the live feed, Recent Analysis from your saved setups; tapping a recent card reopens that method on that pair.
- **New tools** (`src/screens/Insight.tsx`): **Liquidity Map** (nearest pools above/below, equal highs/lows, latest sweep, pool list), **Entry Finder** (best entry with Take / Skip, fresh order-block and FVG zones with confluence, retracement levels) and **Momentum & Volume** (RSI, MACD, ADX, stochastic, volatility, volume, bias and score). Momentum is in `src/momentum.ts` with tests (`tests/momentum.test.ts`).
- **Trade Planner and Settings cards** open the existing Risk planner and Settings pages.
- **Scanner Setup** (auto rescan, alarm, probability filter) moved into the Scanner workspace.
- Bottom bar untouched.

## Notes
- The tap on the logo tile opens the side menu (the mockup has no menu button). The bell opens News and shows a red dot when an alarm is waiting.
- Light and dark both use the two-theme palette from Round 4, so the accent is blue-violet rather than the mockup's pure purple.
- Not run on a device. A phone-width preview of the layout was checked in light and dark; please check the real app, especially the banner and the method cards.

---

# Round 4: two-colour theme, new Analysis page

## What changed
- **Only two themes now: Dark Blue and Light** (`src/theme.ts`). Taken from your design: deep navy with a blue-to-violet accent, and a white / pale-blue light mode. Buy / sell / gold / violet stay as trading colours. Anyone who had an old theme is moved to the matching dark or light one automatically. The bottom bar was not touched: it already reads every colour from the theme.
- **Analysis page rebuilt from your design** (`src/screens/Analysis.tsx`): header (logo, Market Analysis, PRO, LIVE), hero picture with "Analyze Smarter", the three pills, a **Markets** card (Crypto, Forex, Deriv, Metals, Watch list), **Choose Analysis Method** (Combined, Top-Down, ICT, SMC, Scalping, Candle Stick, Pattern, VSA) and the **Scanner** card with Scanner Setup.
- **Hero + icons from your files** (`assets/analysis/`): dark and light hero, and the dark / light icon sets, resized to 256 px (the 1024 px originals were about 11 MB, now about 1.7 MB). The picture follows the theme.
- **How it works:** tap a market to choose what the scanner scans and which pairs you can pick; tap a method to open it (pair picker, chart, result, Take / Skip). A back button and a method strip let you move around. Start Scanning opens the scanner.
- **Scanner Setup is live:** auto rescan every 90 s, alarm when a scan finds setups at or above your level (toast + the store's alarm), and the probability filter (60 / 70 / 75 / 80) hides weaker setups and says how many are hidden. Settings are remembered. "Probability" here is the setup's confluence score, not a measured win rate.
- `TakeSkip` was updated to the new lots-based `takeSignal(id, mode, price, lots, perPt)`; it was out of date after the lots change.

## Notes
- Your working copy already had changes that were not part of my earlier rounds (lot sizing, TradeSheet, alarm sound, fingerprint lock, `asym`). I kept them all. `asym` now opens the Analysis page on that pair.
- The alarm ring screen is not mounted anywhere in the code I was given, so for now the scanner alarm shows as a toast; the store call is ready for it.
- The Analysis header keeps a small menu button (the design has none) so the side menu stays reachable.
- `app.json` is untouched, so `eas update` still works. The native splash colour stays as it was until your next build.
- Not run on a device: please check both themes, Markets tiles, each method, Start Scanning, and the Scanner Setup toggles.

---

# Round 3: Analysis tab, no BUY + SELL on one pair, Take / Skip

## What changed
- **Scalping tab is now "Analysis"** (same slot, tab 1). A method list at the top: Combined, Top-Down, Scanner, ICT, SMC, VSA, Candlestick, Patterns, Scalping. One pair picker is shared by every method. ICT Lab, Top-Down and Scanner are no longer separate pages (their old slots forward to Analysis, so old buttons keep working). Each method keeps its own state while you switch.
- **BUY and SELL on the same pair at the same time: fixed at the cause.** Two things produced it: (1) Scalping saved the scalp setup AND the candlestick setup together, ICT Lab saved the open method AND the chart analysis together, and the duplicate check only compared setups with the same side, so opposite sides were both kept; (2) nothing stopped you taking the other side while a trade was running. Now: a running or waiting trade blocks the opposite side (it cannot be logged or taken), a newer analysis replaces older untouched setups that point the other way, only the open method logs, and old saved lists are cleaned on start. Rules live in `src/trades.ts` (`liveOpposite`, `dropOpposite`, `reconcile`) with 12 new checks in `tests/trades.test.ts`.
- **Take / Skip under every analysis result** (`src/TakeSkip.tsx`): all methods, Top-Down, Scanner rows, the AI chart analysis in ICT and in Markets. Take opens the same sheet as the Journal (limit or market, risk, size, warnings). Skip hides that setup for 6 hours and has Undo. If the pair already has a trade the other way, the bar says why it is blocked.

## Deploy
JavaScript only: `eas update` is enough. `app.json` untouched.

## Not verified
No device and no `node_modules` here, so I could not run the app. Syntax of every edited file parses and the trade logic tests pass, but please tap through: Analysis (each method), Take then Journal, Skip + Undo, and try a SELL on a pair that has a running BUY.

## Notes
- Non-English labels for the renamed tab: only English and Urdu were changed; other languages fall back to English.
- The last block in `tests/trades.test.ts` (after `process.exit`) never ran in the original; left as is.

---

# Chart Reader: audit round 2 (bug fixes + premium polish)

## Deploy notes
- **Server:** replace `server/server.js` and restart it. Keep your live `db.json`. Old users get their email filled in automatically on start.
- **App:** everything below is JavaScript only, so `eas update` is enough. `app.json` was NOT touched (changing the version would change the runtime and stop updates reaching your current build).
- Optional server settings: `TRIALS_PER_IP_DAY` (default 5). On Pakistani mobile networks many phones share one IP, so raise it if real users see "Too many new accounts from this network".

## Bugs fixed
- **Admin panel showed "?" / missing users.** Older accounts had their email stored only in a lookup table, and the list used the email as its key, so several "?" rows collided and were dropped. The server now fills the email in, sends a unique id per user, and the list uses it.
- **A user whose record was missing on the server crashed the request** (400 "Cannot read properties of undefined"). It now answers "Session expired, please log in again".
- **Server calls could hang forever** when the tunnel or your PC was off (login, payment, admin). They now stop after 25 s with a clear message. The news "fear and greed" call also got a time limit.
- **`TRUST_PROXY=0` was treated as ON.** Only 1 / true / yes turn it on now.
- **Deleting data had no confirmation:** clear history, delete one analysis, delete a journal trade, clear all setups, remove PIN. All ask first now.
- **"AI" wording** was still shown in 7 error messages (app and server). Replaced with "analysis".
- Admin panel used a fixed top gap that could sit under the status bar on some phones. It now follows the safe area.

## Premium design pass (shared, so every page benefits)
- New surface and divider colours per theme (`panel2`, `hair`) plus shared spacing / radius / type scale in `src/theme.ts`. Corner radius stays small, as you asked.
- Cards: softer, more even shadows. Inputs: focus ring in the accent colour. Buttons: danger style, accessibility labels. Section headings: accent tick. Numbers use fixed-width digits so they do not jump.
- Settings is grouped into Account, Subscription, Appearance, Security and Server & admin.
- History and Analyze got proper empty / upload cards. Login and sign-up forms sit on a card and move above the keyboard on iPhone.
- New reusable pieces in `src/ui.tsx`: `Group`, `Divider`, `EmptyState`, `confirmAction`.

## Not changed (your call)
- A payment TxID is public on the blockchain, so anyone who sees your wallet's incoming transfers could submit someone else's TxID first. Fix later by asking for a unique amount per user or checking the sender address.
- One free trial per person is enforced by email and phone (device id), not by IP, because mobile carriers share IPs between strangers. Reinstalling the app on a new phone with a new email can still get a new trial (limited per IP per day).
- The sidebar shows "v2.7" but `app.json` says 2.6.0. Left alone for the runtime reason above.
- Not tested on a real phone (no device here). Type-check is clean and all test files pass (90 checks). Please tap through Settings, History, Analyze and login once after `eas update`.

---

# Chart Reader: audit and fixes

Everything below was found by reading the whole project (server, store, all screens, data feeds), type-checking it,
and running the logic tests. The server fixes were tested against the original with a mock Firebase.

## Must do when you deploy
1. **Replace `server/server.js`** and restart. Do NOT copy `db.json` over your live one (it is not in this zip on purpose).
2. **Confirm your admin email.** The server now only gives admin rights to an email Firebase has *confirmed*, or when `ADMIN_PASSCODE` is set and entered.
   Open the app > Settings > "Confirm your email" > send email, tap the link, then "I confirmed it, check again".
   (Better: also set `ADMIN_PASSCODE` on the server.)
3. If the server is behind a tunnel or proxy (ngrok, Cloudflare), set `TRUST_PROXY=1`. Without it every user looks like the same IP and only 5 new accounts per day can sign up in total.
4. Your uploaded `db.json` contained user emails and the token-signing secret. If that zip was shared anywhere: stop the server, delete the `"secret"` and `"sessions"` keys in db.json, start it again. Users just reconnect.
5. `app.json` no longer allows plain-http traffic. That is a native setting: it takes effect on your next `eas build`. All the JS fixes can go out with `eas update`.

## Security (server)
- **Admin takeover (critical):** anyone could sign up in Firebase with your admin email (Firebase does not check ownership) and get admin: user list, grants, your Gemini key. Fixed.
- **License hijack:** a second Firebase login with the same email could take over someone else's paid license. The first login now owns the record; another login must confirm the email.
- Admin rights end immediately if an email is removed from the admin list (old sessions kept admin forever).
- Payment race: two quick taps with the same TxID could credit twice. Fixed.
- Failed or timed-out AI calls no longer use up the user's daily allowance; every outgoing call has a time limit.
- `/health` now works (README.txt tells you to test it, it returned 401). Upload bodies are read safely. Google certificate refresh is rate-limited.

## Bugs
- **The Analyze (screenshot) screen was not reachable**, so History stayed empty. It is back as page 15, with a card on Home. Other tab numbers did not move.
- **Gemini calls ignored the server address set in Settings** (they used the hard-coded one), so changing the tunnel address broke analysis.
- Server error messages ("Free trial ended", "Daily limit reached") never reached the user; they saw "HTTP 402".
- A bad AI answer (missing fields, text instead of numbers) could crash the screen or the chart overlay. All AI output is now checked and repaired, with clear error messages.
- One damaged saved value could stop the journal from loading, and the next save then overwrote the real journal. Each value now loads on its own.
- Wrong PIN counter reset when the app was restarted; it is now remembered. The PIN is asked again after 2 minutes in the background (shown over the app, nothing is lost).
- Headline colours: "Bank of England..." was red (matched "ban"), "Surprise" matched "rise". Whole words only now.
- Feed links can only open http(s). Backup price feed and connection check had no time limit and could hang forever.
- Risk calculator accepted zero or negative balance / risk and gave negative position sizes.
- Fast taps could lose a History item; a second tap on Analyze started a second (billed) analysis.
- Hot reload crashed Firebase init in development. Duplicate news downloads fixed.

## Improvements
- Email confirmation is sent at sign-up, with a reminder card and resend button in Settings.
- Screenshots over 1600 px are shrunk before upload (much faster on mobile data, same reading quality).
- Splash screen 6.5 s -> 3.5 s (`SPLASH_MS` in App.tsx, change it back if you prefer).
- `.easignore` now keeps `server/`, `db.json` and `.env` out of app builds. Admin grant form validates input.
- New tests: `tests/gemini.test.ts` (20 checks), `tests/headlines.test.ts` (12). Run with `TSX_TSCONFIG_PATH=tests/tsconfig.json npx tsx tests/<file>`.

## Not changed (your call)
- `package.json` uses `"latest"` / `"*"` for most packages, so a fresh `npm install` can pull breaking majors. After your next good build, pin the versions (`npx expo install --fix`, then commit the lock file).
- The server address is a free ngrok URL. Use a fixed domain before real launch.
- TRON payment check only looks at the last 200 incoming USDT transfers; very old TxIDs would not be found.
- `src/crypto.ts` is the Binance feed; renaming it to `binance.ts` would avoid confusion with `expo-crypto`.
- About 200 labels per non-English language are still English (they fall back automatically).
- Not verified: I could not run the app on a phone or install packages here, so the UI changes are type-checked but not tapped through. Please test Home > Analyze, sign-up, PIN lock and Settings once.

## v2.7
- **Screenshot analysis removed** (Analyze page, `analyze()` in src/gemini.ts, chart overlay and result view). Gemini now only reads live candles ("Analysis of this chart", plan review, ICT Lab refine). History shows saved chart analyses; old screenshot entries are dropped on load.
- **Admin passcode removed.** Server: admin = email in the admin list + confirmed by Firebase. `ADMIN_PASSCODE`, the reset/change endpoints and the `--reset-admin-passcode` command are gone (a leftover `adminPass` key in db.json is ignored and can be deleted).
- **Easier admin access:** Admin panel card on Home, "Admin panel" / "Unlock admin" in the sidebar, one card in Settings. The app re-checks by itself when you come back from the mailbox after tapping the confirmation link. Gemini key and model moved to Admin panel > Setup.
- **No pre-filled trade desk numbers.** Balance, risk %, daily loss limit and max open trades start empty (they used to be $10,000 / 1% / 3% / 3, which is why Home showed "RUNNING 0/3"). Limits only apply once you set them; taking a trade asks for balance and risk first. Old pre-filled numbers saved by earlier versions are cleared; numbers you typed yourself are kept. Risk calculator risk % and the manual journal size also start empty.
- Earlier in v2.6.1 (still in): black screen on opening a pair (hook order bug in `SymbolSheet`), error screen instead of a black screen, token refresh bug that kept admin locked after confirming the email, full-width themed bottom bar.

---

# v2.12: ICT method rebuilt from the "ICT Trading: A to Z" guide, flat splash screen

## ICT analysis now follows the guide step by step (src/ict.ts)
- **Higher-timeframe bias** (guide step 1): structure, premium / discount, a recent sweep with displacement and a reaction from an HTF gap or block vote for bullish, bearish or **none (no bias, no trade)**. The ICT tab loads the bias timeframe by itself (M1-M5 use H1, M15-H1 use H4, H2-H4 use D1) and has an Auto / H1 / H4 / D1 chooser.
- **Draw on liquidity**, equal highs / lows, and the **named levels**: previous day high / low, Asian range (8 PM to midnight New York), London range (2 to 5 AM), midnight open.
- **Sweep** = price trades beyond a marked level and closes back inside within 1 to 3 candles (first time only). **Displacement** = body at least 1.5x the average body (and 0.8 ATR), closes near its extreme, leaves a gap. **MSS** = after the sweep a candle closes beyond the last opposing swing with displacement; a break without displacement is shown as weak and does not count.
- **Zones**: fair value gaps (CE), order blocks (mean threshold), **breaker blocks and Unicorn** (breaker + gap). OTE is measured on the leg from the swept extreme (62-79%, 70.5% sweet spot).
- **Stop beyond the swept extreme**, targets at the next unswept liquidity (including PDH / PDL / Asian / London), minimum reward:risk 1:2 on target 2, stop wider than 3.5 ATR or a major news release fails the risk check.
- **The 8 pre-trade questions** from the guide (section 9) are the checklist. Verdict is **TRADE READY** only when all 8 are yes, otherwise WAIT (and it names the missing step) or NO TRADE. Only ready ICT trades go to the Journal automatically, and the scanner / method list only counts ICT setups that are ready.
- **Models named like the guide**: ICT 2022 (sweep + MSS + gap), Silver Bullet, Judas swing, Order block / Breaker entry, Unicorn.
- **Killzones** updated to the guide: Asia 8 PM-12 AM, London 2-5 AM, NY AM 7-10 AM, London Close 10 AM-12 PM, NY PM 1:30-4 PM, Silver Bullets 3-4 AM, 10-11 AM, 2-3 PM (New York time, daylight saving handled). The narrowest window wins.
- **Adjustable rules** (guide section 12): swing size, displacement multiple, equal-level tolerance, sweep window, minimum R:R, widest stop. ICT tab > "ICT rules". They apply to the ICT tab only; Combined and the scanner use the defaults.
- **ICT guide: A to Z** inside the ICT tab: 12 lessons, the 8-step process, entry models, risk, psychology, mistakes and the glossary, in our own words with credit to Michael J. Huddleston.
- Chart: sweep marker, MSS line, midnight open, breakers / Unicorn, named liquidity labels.
- Not included (needs data the app does not have): SMT divergence between correlated markets, weekly levels, NWOG / NDOG.
- Scores are stricter than before (they now follow the 8 questions), so fewer ICT setups reach 70. That is intended: "if any answer is no, there is no trade".

## Splash screen
- The 3D logo, orbit rings, candle blocks and the duplicate "CHART READER" text are gone. The logo image already contains the name, so the new screen is: white background, the logo exactly where the phone's own splash draws it (no jump), a thin progress line and "Powered by Bahu Technology". Stays 2.2 s (`SPLASH_MS` in App.tsx), then fades out.
- JavaScript only: it can go out with `eas update` (no new build, `app.json` untouched).

## Tests
- New `tests/ict.test.ts` (killzones, a textbook long through all 8 questions, not-ready cases, 300 fuzz runs). All test files pass. Not tapped through on a phone: please open Analysis > ICT once after `eas update`.
