# Chart Reader

Live charts for forex, metals, crypto and Deriv indices. Open a pair and tap **Analysis of this chart**: Gemini reads the pair's live candles and gives entry, stop loss, 3 take profits, support/resistance and cautions.

Built with Expo and Expo Go. New accounts get a 3-day free trial; after that the analysis buttons unlock with a weekly or monthly plan (charts stay viewable).

## What is inside
- Welcome, Log in, Sign up (Firebase Auth, email + password, password reset) and 4-digit PIN screens (the PIN hash lives only on the phone)
- Home dashboard (market pulse + forex sessions), Trade journal, Risk calculator, History (saved chart analyses), Settings
- Live Markets: forex, metals, crypto and Deriv synthetic indices (Volatility, Boom/Crash, Step) from one free Deriv public feed, no API key
  - category tabs, search, star watchlist, LIVE status, daily change %, sparklines
  - tap any market: live candlestick chart (1m, 5m, 15m, 1h, 4h, 1D), high/low, price alerts
  - EMA 20 / EMA 50 overlays, RSI 14 and a Buy / Sell / Wait technical signal
  - "Analysis of this chart": sends the live candles to Gemini and draws entry, stop loss and take profits on the chart
  - forex session tracker (Sydney, Tokyo, London, New York) with weekend-closed state
- Home: equity curve and max drawdown from your trade journal
- Backup feed: if Deriv is unreachable, forex, metals and crypto fall back to Yahoo Finance data (delayed). Deriv synthetic indices work only on Deriv.
- Floating bottom bar with a lamp that follows the open page, plus a right-hand menu for every page
- 6 themes (3 light, 3 dark) and 6 languages (English, Urdu, Hindi, Dutch, Arabic, Spanish; Urdu and Arabic are right-to-left)

## Setup
1. Install Node.js (LTS) from nodejs.org
2. In this folder run:
   npm install
   npx expo install --fix
3. Get a free key at https://aistudio.google.com/apikey
4. npx expo start   (scan the QR code with Expo Go on your phone)
5. Sign in with the admin email (confirm it once), open Admin panel > Setup and save the Gemini key on the server. Then open any pair in Markets and tap Analysis of this chart.

## Build an Android APK (free EAS tier)
   npm install -g eas-cli
   eas login
   eas build -p android --profile preview

## Charts (v1.3)
- Tap a market, then pick the chart: **TradingView** (TradingView advanced chart with drawing tools, indicators and timeframes), **Deriv** (charts.deriv.com) or **Quick** (built-in candles with EMA, RSI, signal and analysis levels).
- Markets now loads Deriv's full live symbol list (Volatility, Crash/Boom, Step, Jump and more), grouped by submarket, and subscribes only to what is on screen.
- Markets > Connection check tells you which service (Deriv, TradingView, Deriv Charts, backup feed) your phone cannot reach.
- Install the new dependency: `npx expo install react-native-webview` (already listed in package.json).

## Deriv connection (v1.4)
- Deriv's current official public feed is `wss://api.derivws.com/trading/v1/options/ws/public` (no key). The app tries it first, then the legacy `ws.derivws.com` and `ws.binaryws.com`, and rotates automatically if one is unreachable or silent.
- Markets > Connection check tests all three feeds plus TradingView, Deriv Charts and the backup feed from your phone.
- Star any market (Markets list, market screen, or watchlist tile) to add it to the live watchlist strip on Markets and to the Market pulse card on Home. Tapping a favorite opens its chart.

## Active pair follows the chart (v1.5)
- The market screen header (name, code, star, price, daily %) always belongs to the pair the chart is showing.
- **Deriv** tab: pick the pair with the chart's own search box; the header, price and star switch to it. The chart is not reloaded.
- **TradingView** and **Quick** tabs: tap the pair name at the top (chevron) to open the pair picker. TradingView's built-in search box is turned off in the TradingView tab (`allow_symbol_change: false` in src/tv.ts) because the free widget cannot tell the app which pair was chosen.
- The star always applies to the pair shown at the top and syncs with the Markets watchlist and the Home market pulse.
- If a chart shows a pair that is not in the markets list, the header stays put and a "Chart shows: ..." line names it (the star and price need a known market).

## Watchlist fix, trade plan (v1.6)
- The **My chart** tab is removed (TradingView, Deriv, Quick remain).
- Watchlist fix: the Watchlist tab now lists every starred pair, including pairs that are not in the built-in list (for example `stpRNG3` picked inside the Deriv chart). Such pairs get a readable name (Step Index 300) and the right category. Step, Jump and more Boom/Crash indices are now built in.
- New **Trade plan and analysis** panel at the bottom of every market screen. Enter higher price, lower price, entry, stop loss and take profit (or tap **Auto-fill best levels**). The app scores the plan from 0 to 100 using: trend (EMA 20/50 + slope), momentum (RSI 14, MACD), market structure (swing highs/lows, HH/HL vs LH/LL), volatility (ATR 14), support/resistance from swing pivots, risk:reward, stop placement, blocked targets, entry position inside your range, and a quick history test of the same stop/target distance on the loaded candles. Your levels are drawn on the Quick chart.
- **Review of my plan** sends the candles and your levels to Gemini for a second opinion and better levels (needs the free Gemini key).
- The score rates how well your levels fit the chart. It is not a win probability.

## v2.0 Premium (ICT, 3-step take profit, right sidebar)
- **Right sidebar**: tap the grid button (top right of every page) to open it. It lists all pages plus the new Pro tools, with your profile and quick stats. Settings > Navigation: "Bottom bar" keeps the bottom bar too, "Sidebar only" hides it.
- **3-step take profit everywhere**: every analysis now gives TP1, TP2 and TP3 (nearest to farthest) with a suggested close split of 50% / 30% / 20%, and the reminder to move the stop to break-even after TP1. Screenshot analysis, live market analysis, Trade plan (TP1/TP2/TP3 inputs, blended risk:reward) and the Risk & TP planner (profit per TP, if all hit, break-even case) all use it. If the analysis returns fewer than 3 targets, the missing ones are extended from the risk distance (1.5R / 2.5R / 4R).
- **ICT refinement**: screenshot analysis now follows ICT steps (structure BOS/CHoCH, liquidity sweep, order blocks, FVG, premium/discount, OTE 62-79%) and moves the entry to the refined level (order block mean threshold or FVG midpoint inside OTE). Result shows grade A+ to C, confluence score and checklist; the chart draws OTE, EQ 50%, sweep, MSS and the refined entry.
- **ICT Lab** (new page): runs the same ICT method on live candles on the phone (order blocks, FVGs, equal highs/lows, sweeps, dealing range, OTE, killzone) and builds one refined setup with confluence grade. Buttons: send to Risk planner, or refine with Gemini.
- **Killzones** (new page): live UTC clock, current and next killzone (London, NY AM, Silver Bullet, NY PM), 24h timeline in your local time.
- **Performance** (new page): profit factor, expectancy, streaks, buy vs sell, result by symbol, ICT grade counts.
- **Premium look**: Royal Gold theme (default for new installs), gradient buttons, pill segments, section headers, PRO badges.
- Translations: new labels are English, Urdu has the navigation names. Add more in PRO_EN / PRO_UR in src/i18n.ts.
- ICT levels are calculated from candles with fixed rules. They are study tools, not signals or financial advice.

## Notes
- Live data comes from wss://ws.derivws.com (Deriv public API). Symbols Deriv does not offer are hidden automatically.
- Price alerts fire while the app is open and connected (not in the background).
- New live-market labels are English for now; other languages fall back to English. Add translations in MARKETS_EN in src/i18n.ts.
- If Google renames the model, change MODELS at the top of App.tsx.
- Levels are estimated from the picture and can be off. Not financial advice.


## Update: methods, zoom, logo

- **No "AI" wording anywhere in the app.** Buttons now read "Analysis of this chart", "Review of my plan", "Better entry", "Refine with all methods". The Gemini key is still needed for those buttons, so Settings still says where to get it.
- **ICT Lab has 5 views**: Combined, ICT, SMC, VSA and Patterns. Each draws its own overlay on the chart and gives its own entry, stop loss and 3 take profits.
  - **SMC**: swing and internal BOS / CHoCH, decisional order block, supply / demand bases, breaker blocks, inducement.
  - **VSA**: climaxes, springs, upthrusts, no demand / no supply, strength / weakness. Deriv and forex feeds carry no volume, so VSA then reads spread and close position only and says so. Volume bars are drawn when a feed has real volume.
  - **Patterns**: double top / bottom, head and shoulders (and inverse), triangles, wedges, rectangle, each with neckline, measured target, entry and stop.
  - **Combined**: ICT and SMC zones give the location (overlap is best), VSA and the pattern confirm or veto, and can snap the entry to a tighter level.
- **Zoom in / out** on the Quick chart and every ICT Lab chart: + / - buttons, left / right, reset, pinch with two fingers, drag sideways to pan.
- **Logo** added: app icon, adaptive icon, splash, favicon, login and PIN screens, and the side menu.
- Corner radius reduced across the app.

## Subscription, trial and admin (v2.2)
0. **Firebase Auth (v2.3)**: in the Firebase console create a project, enable Authentication > Sign-in method > Email/Password, add a Web app, and paste its config into `src/firebase.ts`. Run `npm install` (adds the `firebase` package; `metro.config.js` is required for it to work in Expo).
1. Run the license server (Node 18+, no npm install needed), behind https:
   `cd server && FIREBASE_PROJECT_ID=your-project-id ADMIN_PASSCODE=choose-a-long-secret GEMINI_API_KEY=... TRUST_PROXY=1 node server.js`
   The server now reads the user's email from a verified Firebase ID token instead of trusting the app. Optional: `REQUIRE_VERIFIED_EMAIL=1` to accept only confirmed emails.
2. Set `SERVER` in `src/license.ts` to that URL.
3. **Admin account**: `bahutechnology@gmail.com` is the built-in admin email (add more with `ADMIN_EMAILS=a@x.com,b@x.com`).
   Sign up in the app with that email, open Settings > **Admin sign-in**, enter your `ADMIN_PASSCODE`. The email alone is not enough, so nobody else can take the admin account by typing your address. The passcode is kept in the phone's secure store, so the admin stays signed in, and it works on any phone you own.
4. Admin sees in Settings: Gemini key + model (stored on the server, used for all users), a dashboard (users, paid, trial, expired, new in 24h, payments, latest users) and **Grant access** (add or remove days for any email).
5. Free for 3 days. After that analysis stops, charts stay free. Plans: weekly $8, monthly $20 (USDT on TRON/TRC20 or BSC/BEP20). The server checks the TxID on-chain, so activation is automatic.
6. One trial per email or device. Each user has a daily analysis cap (`DAILY_AI_LIMIT`, default 60) so one account cannot drain your Gemini quota. Wrong admin passcodes are rate limited (5 tries, then 15 minutes).

## Changes in v2.3 (Firebase Auth)
- Login and sign-up now use Firebase Auth. Your own server is kept: trials, USDT payments, admin, Gemini proxy and database are unchanged. Existing users keep their trial/subscription because they are still matched by email.
- The app sends the Firebase ID token to `/register`; the server verifies Google's signature (no SDK, still zero dependencies). A request with only an email is rejected.
- Accounts created on an older version are upgraded automatically the first time the user logs in with their old password.
- New: "Forgot password?" on the login screen. Login now works on a new phone too.

## Changes in v2.2.1 (audit)
- Fixed: anyone who registered the admin email first became admin. Admin now needs the secret passcode.
- Fixed: users behind the same mobile network shared one trial / one paid plan (matched by IP). Now matched by email and device only, with a limit of new trials per IP per day.
- Fixed: a new account on the same phone inherited the old account's history, journal, subscription and admin rights. All are wiped.
- Fixed: expired trial is also checked on the phone; model name is controlled by the server (admin's choice applies to everyone).
- Added: PIN lockout after 5 wrong tries, request size limit, atomic database writes, random token secret, history capped at 100 items, clear error when the server URL is not set, dark splash/adaptive icon background, production build profile.


## Admin panel (v2.4)
- Admin is now automatic: sign in with an email listed in `ADMINS` (default `bahutechnology@gmail.com`, more via `ADMIN_EMAILS`). The email is read from the verified Firebase token. **Create that account first**, before anyone else can.
- Extra safety (optional): set `ADMIN_PASSCODE` on the server. Then Settings shows **Admin sign-in** and the passcode is also required.
- Admin never needs a subscription (status `admin`, no daily limit).
- Settings > **Open admin panel**: Overview (users, paid, trial, expired, new 24h, payments, revenue), Users (all subscribers, search + filter), Payments (email, USDT amount, network, days, date, TxID), Grant (add/remove days).
- If the app cannot reach the server, Settings shows the exact error. Set `SERVER` in `src/license.ts` to your https server URL.

## v2.4.0 UI update
- Bottom bar and sidebar respect the phone's navigation buttons (react-native-safe-area-context).
- Sidebar is smaller and compact; "Powered by Bahu Technology" footer (opens https://bahutechnology.vercel.app/) in the sidebar and Settings.
- "Quick" chart is now **Analysis View**.
- MT5-style timeframes: M1 M3 M5 M15 M30 H1 H2 H4 D1 (scrollable strip, also in Trade plan and ICT Lab).
- Candle timer: live countdown to the close of the running candle, under the price tag on the chart.

## v2.5.0
- Auto-fill levels button is hidden once the 3-day demo ends (only trial, paid and admin users see it). It never fails silently now: if candles are still loading it says how many arrived.
- Profile photo: Settings > tap the round photo. Gallery or camera, crop, replace, remove. Stored on the phone only.
- Animated splash screen (white, logo, loading bar, Powered by Bahu Technology).
- Over-the-air updates (expo-updates): after ONE new build, JS-only changes can be pushed with `eas update --channel preview` without a new APK.

## Server address inside the app
Settings > **Server address** (visible to the admin, or to anyone who sees a license-server error). Paste the new https address and tap Save and connect. Kept on the phone; "Use the built-in address" resets it. No app update or rebuild is needed when a tunnel or host address changes.

## v2.6 - Scalping and Top-Down
- **Scalp** (ICT Lab > Scalp chip, best on M1 to M5): EMA 9/21/50 ribbon with three models (EMA pullback, micro breakout, range fade), RSI(7), volatility and session filters, tight stop (0.5 to 1.8 ATR), TPs at 1R / 1.5R / 2.2R, 8-point confluence score.
- **Top-Down** (sidebar > Pro tools > Top-Down): 4H direction (EMA 200 + structure), key levels, supply and demand -> 1H trend, BOS/CHoCH, order block, FVG, liquidity -> 15m confirmation (candle, structure shift, RSI 14, MACD). Gives a READY / WATCH / NO TRADE verdict, a limit or market plan and a 10-point checklist.
- JS-only change: `version` stays 2.5.0, so `eas update --channel preview` reaches the installed APK.

## Update notes (premium update)
- Android adaptive icon background is now white (`app.json`), logo enlarged to fill the tile.
- Premium animated splash (`src/Splash.tsx`), shown for 6.5 s (`SPLASH_MS` in `App.tsx`; keep it between 5000 and 8000).
- Scalping is now its own menu (`src/screens/Scalping.tsx`, tab 1) and replaces Analyze in the bottom bar; the screenshot Analyze screen was removed and no longer lives inside ICT Lab.
- New Pre-Trade Checklist (`src/screens/Checklist.tsx`, tab 11): discipline score, custom rules, daily streak.
- Top-Down is on the Home Pro Tools grid and accepts any three timeframes (M1 to D1) with Swing / Intraday / Scalp / Fast presets.
- All "NEW" labels removed. Home Pro Tools is now a 2-column premium grid.
- Existing tab indexes (0-10) are unchanged; new screens were appended.
- Multi-symbol Scanner (`src/screens/Scanner.tsx`, tab 12): scans Watchlist / Forex / Metals / Crypto / Synthetic on any timeframe, ranks by combined score, shows scalp triggers and news flags, sends levels to the Risk planner.
- News calendar + warnings (`src/news.ts`, `src/NewsBanner.tsx`, `src/screens/News.tsx`, tab 13). Feed: Forex Factory weekly JSON (`nfs.faireconomy.media`), cached 45 min. High impact = red from 30 min before to 15 min after, amber up to 2 h before. Banner appears on Home, Scanner, Scalping, Top-Down and ICT Lab.

## v2.7 - Premium redesign, CRT, all crypto, news, indicators
- **New look**: floating pill bottom bar, softer rounded cards, gradient glow headers, rebuilt Home (hero card, horizontal market pulse, Scalping feature card and a clean 2-column Pro Tools grid), rebuilt Markets list with coin badges.
- **CRT scalping** (`src/crt.ts`, Scalping screen): builds the higher-timeframe range candle (M1/M3 -> M15, M5 -> H1, M15/M30 -> H4, H1+ -> D1), waits for the sweep, then a market-structure shift, and only then marks the setup TRIGGERED. Before the shift it is ARMED (never graded above B, entry = the shift level). Entry on the displacement gap or 50-62% retrace, stop beyond the sweep, TPs at the range midpoint, the opposite side and the 1.272 extension. Merged with the EMA / breakout / range-fade models (agreement raises the score, disagreement lowers it).
- **Sharper analysis** (`refine.ts`): the Combined entry now also checks ADX trend strength, MACD momentum, RSI stretch, Supertrend, EMA 200 side, RSI divergence, Fibonacci golden pocket and strong levels blocking TP1.
- **All crypto pairs** (`src/crypto.ts`): every Binance spot pair (USDT, USDC, FDUSD, BTC, ETH, BNB, EUR, TRY), live prices, 24h change, live candles, quote filter and search. No key. Deriv's own crypto symbols stay under "Deriv crypto".
- **News**: Calendar (existing) + Forex, Crypto (Fear & Greed, 24h movers) and Deriv headline tabs (`src/headlines.ts`, free RSS / JSON feeds, cached).
- **Passwords**: dedicated Forgot password screen (email link, 45 s resend timer) and Settings > Change password (asks for the current one first).
- **Chart** (`src/IndicatorChart.tsx`, Analysis View): 21 indicators (EMA 20/50/200, SMA, Bollinger, Ichimoku, Supertrend, Parabolic SAR, VWAP, auto Fibonacci, auto Support/Resistance, RSI, MACD, Stochastic, ADX, CCI, Williams %R, ATR, Volume, OBV), candle / Heikin Ashi / line, Hide all / Show all, Select all / Clear / Reset; choices are remembered. The TradingView tab has indicator chips too (RSI, MACD, Bollinger, ...).
- JS-only update: `app.json` version is unchanged, so `eas update --channel preview` reaches installed APKs.
- Tests: `tests/` holds logic tests (run with `npx tsx --tsconfig tests/tsconfig.json tests/all.ts`).
- v2.7.1: smaller corner radii app-wide; chart toolbar fits narrow phones (wraps if needed).
- v2.8: **Candlestick method** (`src/candles.ts`), based on the TrendSpider candlestick guide. 20+ patterns (hammer, inverted hammer, hanging man, shooting star, dragonfly / gravestone / long-legged / neutral doji, bullish and bearish engulfing, piercing line, dark cloud cover, harami, tweezers, morning / evening star and doji star, abandoned baby, three white soldiers / black crows, advance block, marubozu). Each is read in context (trend before it, support / resistance, RSI, volume when the feed has it), must be CONFIRMED by the next candle before it is graded above B, and gets entry (above the confirmation candle), stop (beyond the pattern + cushion) and 3 targets. Shown as a new "Candles" tab in ICT Lab (with a Pattern guide), as chart markers (Indicators > Candle patterns), as a Candle read card in Scalping, and as a CDL vote in the Combined entry.

## v2.9 - Trade desk, candlestick scalping, Orbit dock
- **Journal is now a trade desk.** You no longer type anything. Scalping, ICT Lab (every view), Top-Down, Scanner and Markets analysis save their setups automatically (`src/signalLog.ts`, `logSignal` in `src/store.tsx`). Each one shows pair, side, method, grade, entry, stop, TP1 to TP3 and the live distance to entry. Tap **Take trade** or **Cancel**.
  - **Take trade** opens a sheet: Limit at entry or Market now, risk in money (balance x risk %), position size, blended reward:risk, and warnings (daily loss limit used, too many trades, high-impact news, setup still armed, grade C).
  - **Live** tab: the app follows the live price (`src/Tracker.tsx`, even while another page is open). A limit order fills by itself, each take profit closes 50 / 30 / 20 %, the stop moves to break-even after TP1, and the trade closes on the stop or TP3. Floating result in $ and R, a stop-to-TP3 ladder with the live price, Close now and Stop to BE buttons.
  - Banners slide in for: price at the entry zone, order filled, TP hit, stop hit, break-even. Phone vibrates on TP and stop.
  - **Closed** tab: finished trades are written to the journal with R, $, method, grade and time in trade. Tap a trade to tag it (Followed plan, Early exit, Late entry, FOMO, Moved stop) and add a note. Manual entry still exists. Export CSV shares the whole journal.
  - **Insights** tab: profit factor, average R, 5-week daily calendar, results by method and by pair, equity curve.
  - Settings button (top right of the equity card): starting balance, risk %, daily loss limit, max trades at once, auto-log on/off, minimum score (40 to 80).
  - Setups are merged when they are the same pair, timeframe, method and side with nearly the same entry. Untaken setups are removed when price hits the stop or TP1 first, or after 24 h.
  - This is paper trading on live prices. It does not place real orders.
- **Scalping: candlesticks.** Candle pattern markers on the chart (toggle Patterns), a Scalp setup / Candlestick setup switch that drives the signal card, the chart levels and the Journal, Heikin Ashi chart style, last-6-candles list and the full Pattern guide.
- **Orbit dock** (`src/Dock.tsx`): floating glass bar with one glowing orb that glides to the open page, the icon morphs while it moves, a round notch is cut into the bar, a light runs along the top edge. The Journal tab shows how many setups are waiting and a green dot while trades are running.
- **Home**: new Trade desk card (setups waiting, trades running with floating result, today's result).
- Tests: `npx tsx --tsconfig tests/tsconfig.json tests/trades.test.ts`.
- JS-only update (`app.json` version unchanged): `eas update --channel preview` reaches installed APKs. No new packages.

## v3.0 - Lamp dock, premium charts, timeframe picker, discipline guard
- **Lamp dock** (`src/Dock.tsx`): slim pill bar. A lamp sits on the top edge of the open page and throws a cone of light onto its icon; it slides and fades when you change page, the active icon switches to its filled version and pops. Dark themes: panel-coloured bar, accent-coloured light. Light themes: deep bar tinted by the theme's text colour, second accent as the light. Journal tab shows the number of waiting setups, plus a green dot while trades run.
- **Chart zoom** (`src/ChartZoom.tsx`, maths in `src/zoomMath.ts`, tested in `tests/zoom.test.ts`), used by every chart (Analysis View, Scalping, ICT Lab, Top-Down):
  - pinch zooms around the point between your fingers (the candle under them stays put)
  - drag to pan, a flick keeps gliding (inertia)
  - pan up to 40% past the newest candle, so the last candle is not glued to the price axis
  - touch and hold for ~0.4 s: crosshair with price tag, time tag and an O / H / L / C / change card; drag to read any candle. On the Analysis View the card has an **Alert** button that sets a price alert at the crosshair price.
  - bar under the chart: minimap (drag the thumb or tap the track), zoom -/+, presets 30 / 60 / 120 / All, and a **Latest** button that lights up when you are away from the newest candle.
- **Timeframe picker** (`src/Timeframe.tsx`): any list of timeframes now shows a grid button with the current one, plus a quick row of pinned timeframes (default M1 M5 M15 H1 H4 D1) that scrolls to the active one. The grid button opens a sheet grouped as Minutes / Hours / Days with candles-per-day hints; tap the star to pin or unpin. Pins are shared by every page and remembered. Other chip lists (markets, impact, currencies) keep the simple strip.
- **Discipline guard** (`guard()` in `src/trades.ts`, banner in `src/Guard.tsx`): daily loss limit reached, 30 minute cooldown after two losses in a row (with a countdown), too many trades at once, three losses in a day. Shows on Home, Scalping and Journal, and in the Take trade sheet.
- **Premium polish everywhere** (shared components): glass edge on cards, glossy buttons, segmented controls with a sliding thumb, a LIVE / SYNC / OFFLINE feed pill in every page header, pages fade and rise in when opened.
- **Two new themes**: Graphite (dark, silver light, close to the reference) and Cloud (light, grey). Settings > Theme.
- No new packages and `app.json` version unchanged, so `eas update --channel preview` reaches installed APKs.

## v2.7 changes
- **Screenshot analysis removed.** Gemini is used for "Analysis of this chart" (live candles of the open pair), the plan review in the Trade plan panel and the ICT Lab refine button. Every chart analysis is saved in History.
- **Admin has no passcode.** An admin is an email on the server's admin list (`ADMIN_EMAILS`) that has been confirmed. Open it from the sidebar (Admin panel), the Home card, or Settings. Gemini key and model live in Admin panel > Setup.
- **Nothing pre-filled in the trade desk.** Balance, risk %, daily loss limit and max trades start empty (Journal > options button). Home shows `RUNNING 0` until you set a limit.
"# charreader" 
