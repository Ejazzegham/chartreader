# Chart Reader as a website

The same app now also runs in a browser (Chrome, Safari, Edge, Firefox). The phone app is unchanged.

**Desktop website (browser window 900 px or wider)**
- Before login: a front page with the brand, a live candle chart, the six main features, the prices, and the login form next to it.
- After login, a trading dashboard:
  - **Left sidebar:** the whole menu (Analysis opens its method list), a Pro card, and your account.
  - **Top bar:** search for any market (press Ctrl+K), live status, notifications, PRO badge, your account.
  - **Home dashboard:** hero (Analyze / Plan / Execute), **Choose Analysis Method** tiles (ICT, SMC, Top-Down, Scanner, VSA, Candlestick), **Select Market** with **Watchlist / Forex / Crypto / Deriv** tabs and symbol cards, the chart panel (timeframes 1m to 1D; **Pro chart** = TradingView with its drawing tools, **Quick** = the app's own candle chart, which also works for Deriv), and Today's Analysis, Quick Tools and Risk Management cards. "Open ICT analysis" jumps to the full Analysis page with that pair and method.
  - **Right panel (from 1240 px):** Market Watch table (Forex / Crypto / Deriv, star to keep a market in your watchlist), Forex Sessions with local times, the news warning and a daily reminder.
- **Every other page** (Analysis, Markets, Journal, Risk & TP Planner, History, Forex Market Hours, Performance, Trade Checklist, News, Settings, How to use, About, and the method pages) has the same style as the dashboard: a header with a small title line, a big title, a subtitle and a chart picture; rounder cards; section titles with an icon circle; and the same sidebar, top bar and right panel.
- Pages that are a stack of cards (Settings, Forex Market Hours, Performance, Trade Checklist, Risk planner, How to use, About) are laid out in **two balanced columns**; the Markets list is two columns of rows. This is done by `Cols` in `src/ui.tsx`; inside a column every part sizes itself to the column.
- Pop-ups open as centred dialogs.

**Phone or tablet browser (under 900 px):** the phone layout with the bottom bar, full width (centred, at most 640 px on a tablet).
The layout rules are in `src/win.web.ts`; the sidebar, top bar and right panel are in `src/Desktop.web.tsx`; the home dashboard is `src/DesktopHome.web.tsx`; what the dashboard is showing (pair, method, timeframe, market) is in `src/dash.ts`; the landing page is `src/Landing.tsx`.

## 1. Update your server first (needed for the website)

Copy the new `server/proxy.js` and the updated `server/server.js` to the machine that runs your server, then restart it.

- `server/proxy.js` (new): browsers block most sites (CORS), so the backup prices (Yahoo), the economic calendar and the headlines
  go through your server at `/proxy?u=...`. It only reads a short list of known sites over https, caches for 20 s, and limits each visitor to 240 requests a minute.
- `server/server.js`: now answers the browser's pre-check (it allows the `ngrok-skip-browser-warning` header and `GET`/`POST`) and calls the proxy.
- The server address in `src/license.ts` (`SERVER`) must be **https** (an http address is blocked on an https website). Visitors can also change it in Settings > Server address.

## 2. Build the website

```
npm install
npm run build:web        # creates the folder dist/
```

Test it on your computer: `npm run web` (development) or `npm run serve:web` (the built site).

## 3. Put it online

Upload the `dist` folder to any static host. Ready-made settings are included:

- **Vercel**: import the project, it reads `vercel.json` (build `npx expo export --platform web`, output `dist`).
- **Netlify**: import the project, it reads `netlify.toml`. Or drag the `dist` folder into netlify.com/drop.
- **Firebase Hosting / Cloudflare Pages / GitHub Pages**: publish `dist`; send every address to `index.html`.

The site must be served over **https** (the app's PIN hashing and the licence device id use the browser's crypto, which needs a secure page; `localhost` is fine for testing).

## 4. Firebase and Google settings (one time)

- Firebase console > Authentication > Settings > **Authorized domains**: add your website's domain.
- If the Firebase **Web API key** is restricted in Google Cloud (Credentials), add your website's address under "HTTP referrers".

## Real volume for VSA (app, website and server)

VSA reads real traded volume, not spread. Crypto: Binance spot volume. Forex, gold, silver, DXY: volume of the matching CME / COMEX / ICE futures contract (spot forex has no central exchange). Deriv synthetic indices have no market volume, so VSA reads spread there and says so. The VSA screen names the volume source. Details: `src/realvol.ts` and CHANGES.md.

**Copy to your server and restart it:** `server/alerts.js`, `server/proxy.js`, `server/build-analysis.js` and the whole `server/analysis/` folder (new: `realvol.js`, `net.js`; changed: `fallback.js`, `vsa.js`). Without it the website and app use real volume, but the server's background alerts still score VSA from spread.

## What is different in the browser

| Phone | Website |
|---|---|
| Secure store (Keychain / Keystore) | The same values are kept in this browser's localStorage (`sec_...` keys), private to the site |
| Pop-ups are drawn over the whole phone | Pop-ups are centred dialogs inside the website; Escape closes them |
| Bottom bar + slide-out menu | Left sidebar on a wide screen (bottom bar on a phone browser) |
| Alert / Share dialogs | Browser confirm box; Share uses the browser share sheet, else copies to the clipboard |
| TradingView chart in a WebView | TradingView chart in an iframe (the pair cannot follow the chart's own symbol box, a browser cannot read inside another site) |
| Pinch zoom, touch-and-hold crosshair | Mouse wheel zooms around the pointer, hovering shows the crosshair, drag pans |
| Alarm sound + vibration | Alarm sound plays from the page (after the first click), desktop notification for price alerts (asked when you set the first alert) |
| Push alerts while the app is closed | Not available in a browser (alerts work while the page is open) |
| Fingerprint / face unlock | Not available (the PIN still works) |
| Yahoo / news / headlines read directly | Read through your server's `/proxy` |

## Tests

- `npm`-free unit tests: `npx tsx --tsconfig tests/tsconfig.json tests/proxy.test.ts` (and the other `tests/*.test.ts`).
- Browser test (needs `pip install playwright && playwright install chromium`):
  `npm run build:web`, serve `dist` on port 8099, then `python3 tests/web/smoke.py`. It logs in with a faked Firebase and server, and checks the column, saved login,
  pop-up, confirm box, proxy, chart and mouse-wheel zoom.


## Keeping the website in step with the app (v2.11)

The website and the phone app are ONE codebase. Web-only files end in `.web.tsx` / `.web.ts` or are named in WEB.md above (Desktop, DesktopHome, Frame, Landing, LiveCandles, dash, dialog, net, win, secureStore, Modal). Everything else is the app's own code.
When the app changes, copy the new `src/` over and re-apply only these web hooks: App.tsx (Frame + DesktopShell), screens/Home.tsx (DesktopHome wrapper), ChartZoom.tsx (wheel + hover), markets.ts (dialog + IS_WEB), fallback.ts (xfetch), and the imports `Modal`, `showAlert`, `shareText`, `useWindowDimensions`, `secureStore` instead of the react-native / expo ones. Then run: `npx tsc --noEmit`, the tests, `npx expo export --platform web`, and `python3 tests/web/smoke.py` (serve `dist` on port 8099 first).
Server: `server/server.js` needs the CORS headers and `await proxy(req, res)` line (see CHANGES.md).


## Server address, rewrites and the device rule (v2.17)

- The website calls `/srv/...` and `/mailer` on its own address. `vercel.json` (Vercel) and `netlify.toml` (Netlify) pass them to the server (`https://mockup-borrowing-overprice.ngrok-free.dev`, the SERVER constant in `src/license.ts`) and to the Netlify email function. Keep the three in step if the server address changes.
- The server decides who may be signed in: one phone + one computer per email (see CHANGES.md). Deploy the new `server/` folder for it to work.
