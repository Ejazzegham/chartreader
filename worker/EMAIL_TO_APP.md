# Emails to the support address show up in the admin panel (Chats tab)

The server has an endpoint, `POST /inbound/email`, that turns an email into a chat message:
- sender has an account in the app -> it joins that user's chat (the admin can answer in the app, the user gets a notification)
- sender has no account -> it appears as an "EMAIL ONLY" conversation (answer it by email)
- the admin gets a push notification for every new email

It is OFF until you set a secret when you start the server:

    set INBOUND_SECRET=choose-a-long-random-text
    node server.js

(PowerShell: `$env:INBOUND_SECRET="..."`.)

## Gmail (Google Apps Script, free)
1. Open https://script.google.com with the Gmail account that is the support address (`SUPPORT_EMAIL` in `src/license.ts`). New project, paste:

```js
const URL = 'https://YOUR-SERVER-ADDRESS/inbound/email';   // same address as the app's server address
const SECRET = 'the same text as INBOUND_SECRET';

function forwardSupportMail() {
  const props = PropertiesService.getScriptProperties();
  const done = JSON.parse(props.getProperty('done') || '[]');
  const me = Session.getActiveUser().getEmail();
  GmailApp.search('in:inbox newer_than:1d').forEach(function (th) {
    th.getMessages().forEach(function (m) {
      const id = m.getId();
      if (done.indexOf(id) >= 0 || m.getFrom().indexOf(me) >= 0) return;   // already sent, or written by you
      const r = UrlFetchApp.fetch(URL, {
        method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        headers: { 'x-inbound-secret': SECRET },
        payload: JSON.stringify({ from: m.getFrom(), subject: m.getSubject(), text: m.getPlainBody().slice(0, 4000), messageId: id }),
      });
      if (r.getResponseCode() === 200) done.push(id);
    });
  });
  props.setProperty('done', JSON.stringify(done.slice(-300)));
}
```
2. Run `forwardSupportMail` once and accept the permissions.
3. Triggers (clock icon) -> Add trigger -> `forwardSupportMail`, time-driven, every 5 minutes.

Notes
- A Cloudflare quick tunnel gets a NEW address every time it restarts. Change `URL` in the script when that happens (a named tunnel or a fixed domain avoids this).
- The server ignores a message it already has (same message id), so running the script twice is harmless.
- Another mail service (Cloudflare Email Routing worker, Mailgun, SendGrid inbound) works too: it only has to POST `{ from, subject, text, messageId }` with the header `x-inbound-secret`.
