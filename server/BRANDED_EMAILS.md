# Emails in the Chart Reader design (reset password, confirm email, change email)

The app asks THIS server to send the email. If the server is not set up (or cannot be reached within 8 seconds) the app falls back to Firebase's own plain email, so the person always gets an email. Check `GET /health`: it shows `"brandedMail": true` when everything below is in place.

## What you need (all free to start)
1. **The email page** (folder `auth-page/`) deployed: `firebase deploy --only hosting` (see `auth-page/README.md`). The link in the email opens it, and the logo in the email comes from it (`/logo.png`).
2. **An email service** - pick one:
   - **Brevo** (brevo.com, free ~300 emails a day): Senders > add and verify the address you want to send from. No domain needed. Then SMTP & API > API keys > create a key.
   - **Resend** (resend.com): needs a domain you own (add the DNS records they show). Then API Keys > create.
   Mail sent "from" a plain `@gmail.com` address often lands in spam. An address on your own domain is much better.
3. **A Firebase service account key** (lets the server ask Firebase for the one-time link; Firebase sends nothing itself): Firebase console > Project settings > **Service accounts** > Generate new private key. Save the JSON file NEXT TO the server, never inside the app, never on GitHub.

## Start the server with these settings
PowerShell:

    $env:FIREBASE_PROJECT_ID="chart-reader-45c13"
    $env:FIREBASE_SERVICE_ACCOUNT_FILE="C:\path\to\service-account.json"
    $env:AUTH_PAGE_URL="https://chart-reader-45c13.web.app"
    $env:MAIL_FROM="Chart Reader <no-reply@your-domain.com>"
    $env:BREVO_API_KEY="xkeysib-..."        # or  $env:RESEND_API_KEY="re_..."
    node server.js

## Try it
Forgot password in the app > the email arrives in the new design > the button opens your email page > new password > "Open the app".

## The three templates (`server/emails/`)
Same `{{ .ConfirmationURL }}` style placeholders as Firebase / Supabase templates. Edit the HTML freely (keep the placeholders). Placeholders: `.ConfirmationURL` `.Email` `.NewEmail` `.Token` `.SiteURL`.

| File | Used by the app now? |
|---|---|
| `reset-password.html` | Yes: Forgot password |
| `confirm-signup.html` | Yes: after sign up, and "Send again" in Settings |
| `change-email.html` | Yes: Edit profile > Email (goes to the NEW address) |

## Limits built in
Reset: 3 per mailbox per hour, 20 per IP per hour. Verify / change email: 6 per account per hour. The reset answer is always the same, so nobody can find out which emails have an account. Changing an email needs a login from the last 5 minutes (the app re-asks the password first).
