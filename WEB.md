# Chart Reader as a website

The same app now also runs in a browser (Chrome, Safari, Edge, Firefox). The phone app is unchanged.
On a wide screen it shows in a centred phone-width column (520 px); on a phone browser it fills the screen.

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
| Pop-ups are drawn over the whole phone | Pop-ups are drawn inside the app column; Escape closes them |
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
