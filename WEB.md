# Chart Reader as a website

The same app now also runs in a browser (Chrome, Safari, Edge, Firefox). The phone app is unchanged.

**Desktop website (browser window 900 px or wider)**
- Before login: a front page with the brand, a live candle chart, the six main features, the prices, and the login form next to it.
- After login: a left sidebar with the whole menu (Trade, Pro tools, More) and your account, the page in the middle (up to 980 px wide), and from 1240 px a **Market watch** panel on the right (live prices, news warning, forex sessions).
- Pop-ups open as centred dialogs.

**Phone or tablet browser (under 900 px):** the phone layout with the bottom bar, full width (centred, at most 640 px on a tablet).
The layout rules are in `src/win.web.ts`; the sidebar and panel are in `src/Desktop.web.tsx`; the landing page is `src/Landing.tsx`.

## 1. Update your server first (needed for the website)

Copy the new `server/proxy.js` and the updated `server/server.js` to the machine that runs your server, then restart it.

- `server/proxy.js` (new): browsers block most sites (CORS), so the backup prices (Yahoo), the economic calendar and the headlines
  go through your server at `/proxy?u=...`. It only reads a short list of known sites over https, caches for 20 s, and limits each visitor to 120 requests a minute.
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
