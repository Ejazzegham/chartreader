# Chart Reader API — runs on Cloudflare, no server of your own

This folder replaces the old `server/` folder. It is the same server code (same routes, same data), running as a
Cloudflare **Worker + Durable Object**. There is no computer to keep switched on, no ngrok, no pm2.
Free plan, no credit card needed.

## What runs where
| Job | Where |
|---|---|
| Login check (Firebase token), trial, plans, payments claim, admin | Worker (Durable Object) |
| Cloud backup, profile, support chat + photos/videos, community, visitor counter, signup map | Worker (Durable Object storage) |
| Gemini key (never in the app), chat translation | Worker |
| `/proxy` for the website (Yahoo, news calendar) | Worker |
| Background price alerts + scanner → push notifications | Worker **alarm** (every 10 s while someone has alerts on) + a cron safety check every 5 min |
| Branded account emails | Your existing Netlify function (`/mailer`), or Firebase's own email |

## Deploy (about 10 minutes, once)
1. Make a free account at https://dash.cloudflare.com (no card).
2. In this folder:
   ```
   npm install
   npx wrangler login
   npx wrangler secret put IMPORT_SECRET        # type any long random text; used only for step 4
   npx wrangler deploy
   ```
   `deploy` prints your address, like `https://chart-reader-api.YOUR-NAME.workers.dev`.
3. Open `src/license.ts` in the website project and put that address in `SERVER`. Rebuild / redeploy the website (and the app).
4. **Copy your old data in (one time, BEFORE anyone uses the new address):**
   ```
   node scripts/import-data.js ../server https://chart-reader-api.YOUR-NAME.workers.dev <the IMPORT_SECRET from step 2>
   ```
   (`../server` = your old server folder with `db.json`, `db.json.sync/`, `db.json.media/` ...). This keeps all users, trials,
   paid plans, backups, chat history, the Gemini key and the admin settings. The import refuses to run once the server has started.
5. Check `https://chart-reader-api.YOUR-NAME.workers.dev/health` — it should show `"geminiKey": true`.
6. Switch the old server off.

### Optional settings (`npx wrangler secret put NAME`, or `vars` in `wrangler.jsonc`)
`ADMIN_EMAILS` (extra admins), `EXPO_ACCESS_TOKEN` (if you use one for push), `DAILY_AI_LIMIT`, `GEMINI_API_KEY` (the admin panel can also set the key).

## Test it on your computer (no account needed)
`sh test/run.sh [old-server-folder]` starts the Worker locally, imports the old data, fakes Google's login keys and runs the whole
flow (register, trial, backup, chat photo, community, alerts, admin, background alarm).

## Limits to know about (free plan)
- Chat **photos up to 6 MB, videos up to 12 MB** (a Worker holds a file in memory while saving it; change `CHAT_MAX_*_MB`).
- Cloudflare free Durable Objects: 100,000 requests/day. Fine for hundreds of daily users; if you grow, the paid plan is $5/month.
- Everything is handled by ONE Durable Object (like the old single server). Very large user numbers would need it split — not needed now.
