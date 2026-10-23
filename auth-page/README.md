# Chart Reader - email pages (reset password, verify email, change / restore email)

One static page that opens from the emails. No build step, no server.

## Put it online with Firebase Hosting (free, same project as the app)
Run in the PROJECT folder (the one that contains `firebase.json`):

    npm install -g firebase-tools
    firebase login
    firebase deploy --only hosting

Your page is then at **https://chart-reader-45c13.web.app**. Open it: it must say "This link does not work" (there is no code in the address - that is correct).
If the deploy says Hosting is not set up: Firebase console > Build > **Hosting** > Get started (only once), then run the deploy again.

## Tell Firebase to use it
Firebase console > Authentication > Templates > for Email address verification, Password reset and Email address change: pencil > **Customize action URL** > `https://chart-reader-45c13.web.app` > Save.
(web.app is already an authorized domain. Own domain: Hosting > Add custom domain, then add it under Authentication > Settings > Authorized domains.)

Server setting for the branded emails: `AUTH_PAGE_URL=https://chart-reader-45c13.web.app` (see `server/BRANDED_EMAILS.md`).

## Netlify instead (optional)
Drag this folder onto Netlify (Deploy manually). `netlify.toml` here has the same security settings. Use that address in place of the web.app one above.

## Notes
- Firebase version is pinned in `action.js` (`10.14.1`). Its Firebase keys are the same public ones as `src/firebase.ts`.
- "Open the app" uses the app link `chartreader://` (`scheme` in `app.json`, needs the new build).
- Pages: English, plus Urdu when the email language is `ur`. Copy the `ur` block in `action.js` for another language.
