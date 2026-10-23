# Keeping the scanner running while the app is closed

A phone cannot scan in the background (Android stops apps). The scanning is done by THIS server, which sends a push notification to the phone.
So the server must be running 24/7 and reachable at the same address the app uses.

## What must be true
1. Server running: `FIREBASE_PROJECT_ID=chart-reader-45c13 ADMIN_EMAILS=you@x.com node server.js` (Node 22 or newer). Keep `DB_FILE` on a disk that survives restarts.
2. The address in the app never changes. A Cloudflare QUICK tunnel (`trycloudflare.com`) gets a NEW address every time it restarts, so the phone then talks to a dead address and no notification comes. Use a named Cloudflare tunnel (free, fixed hostname) or a small always-on host (VPS, Render, Railway, Fly).
3. The server process restarts by itself: `npm i -g pm2 && pm2 start server.js --name chart-reader && pm2 save && pm2 startup` (a PC that sleeps stops scanning: switch off sleep, or use a VPS).
4. In the app: Analysis > "Scan for me, even when the app is closed" ON, notifications allowed for the app, then tap "Send a test notification", close the app, and wait.
5. Server log shows `background alerts on: ... scanner every 90s`. A line `push NOT delivered` names the reason when a push fails.

## What you get
When a setup passes the TRADE rule and its price is at, or within 1 ATR of, the POI, the phone shows the pair, side, score, entry, stop and TP1. Tapping the notification opens that pair in Analysis. The same setup does not ring again for 15 minutes (`RESEND_MS` in `alerts.js`).

## Timers (all can be changed with environment variables)
| What | Default | Variable |
|---|---|---|
| Scanner (setups) and the optional silent analysis | 90 s | `SCAN_MS` |
| Price alerts | 10 s | `PRICE_CHECK_MS` |
| Daily high / low breaks, all pairs | 60 s | `DAYLEVEL_CHECK_MS` |
| News check (alert 15 min before a high-impact release) | 60 s | `NEWS_CHECK_MS` |
| Retry of a push that failed | 30 s, 6 times | - |
