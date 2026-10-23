// Chart Reader: the page Firebase opens from the emails (reset password, verify email, change / restore email).
// Firebase console > Authentication > Templates > (pencil) > Customize action URL  ->  https://chart-reader-45c13.web.app  (Firebase Hosting, see README.md)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { initializeAuth, inMemoryPersistence, verifyPasswordResetCode, confirmPasswordReset, applyActionCode, checkActionCode } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

// Same public identifiers as src/firebase.ts in the app (they are not secrets).
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDRDshttLnPV6pR3eB1hMejbJW2eg2Qwjc',
  authDomain: 'chart-reader-45c13.firebaseapp.com',
  projectId: 'chart-reader-45c13',
  appId: '1:745148948540:web:9b8dde9a83f93277dd6339',
};
const APP_LINK = 'chartreader://'; // app.json "scheme"

// No popup / redirect sign-in is used here, so no iframe or Google script is needed: only the email-link calls.
const auth = initializeAuth(initializeApp(FIREBASE_CONFIG), { persistence: inMemoryPersistence });

const TEXT = {
  en: {
    title: 'Chart Reader', checking: 'Checking your link…',
    resetTitle: 'Choose a new password', resetFor: 'New password for', newPw: 'New password (6+ characters)', againPw: 'Repeat new password', show: 'Show', hide: 'Hide', save: 'Save new password', saving: 'Saving…',
    resetDoneTitle: 'Password changed', resetDone: 'Open the app and log in with your new password.',
    verifyTitle: 'Email verified', verifyDone: 'Your email address is confirmed. You can go back to the app.',
    changedTitle: 'Email changed', changedDone: 'Your new email address is confirmed. Log in to the app with it.',
    recoverTitle: 'Email restored', recoverDone: 'Your email address was changed back. If you did not ask for the change, reset your password in the app.',
    openApp: 'Open the app', badTitle: 'This link does not work', bad: 'It has expired or was already used. Go back to the app and ask for a new one.',
    short: 'Use at least 6 characters.', mismatch: 'The two passwords are not the same.', weak: 'That password is too weak. Try a longer one.', network: 'No internet connection. Try again.', other: 'Something went wrong. Try again.',
  },
  ur: {
    title: 'Chart Reader', checking: 'لنک چیک ہو رہا ہے…',
    resetTitle: 'نیا پاسورڈ منتخب کریں', resetFor: 'نیا پاسورڈ برائے', newPw: 'نیا پاسورڈ (کم از کم 6 حروف)', againPw: 'نیا پاسورڈ دوبارہ لکھیں', show: 'دکھائیں', hide: 'چھپائیں', save: 'نیا پاسورڈ محفوظ کریں', saving: 'محفوظ ہو رہا ہے…',
    resetDoneTitle: 'پاسورڈ تبدیل ہو گیا', resetDone: 'ایپ کھولیں اور نئے پاسورڈ کے ساتھ لاگ اِن کریں۔',
    verifyTitle: 'ای میل کی تصدیق ہو گئی', verifyDone: 'آپ کی ای میل کی تصدیق ہو گئی ہے۔ اب آپ ایپ پر واپس جا سکتے ہیں۔',
    changedTitle: 'ای میل تبدیل ہو گئی', changedDone: 'آپ کی نئی ای میل کی تصدیق ہو گئی ہے۔ ایپ میں اسی کے ساتھ لاگ اِن کریں۔',
    recoverTitle: 'ای میل بحال ہو گئی', recoverDone: 'آپ کی ای میل واپس پرانی کر دی گئی ہے۔ اگر یہ تبدیلی آپ نے نہیں کروائی تھی تو ایپ میں پاسورڈ ری سیٹ کریں۔',
    openApp: 'ایپ کھولیں', badTitle: 'یہ لنک کام نہیں کر رہا', bad: 'یہ لنک ختم ہو چکا ہے یا پہلے استعمال ہو چکا ہے۔ ایپ میں جا کر نیا لنک منگوائیں۔',
    short: 'کم از کم 6 حروف استعمال کریں۔', mismatch: 'دونوں پاسورڈ ایک جیسے نہیں ہیں۔', weak: 'یہ پاسورڈ کمزور ہے۔ لمبا پاسورڈ رکھیں۔', network: 'انٹرنیٹ نہیں ہے۔ دوبارہ کوشش کریں۔', other: 'کوئی مسئلہ پیش آیا۔ دوبارہ کوشش کریں۔',
  },
};
const params = new URLSearchParams(location.search);
const lang = (params.get('lang') || navigator.language || 'en').slice(0, 2).toLowerCase();
const T = { ...TEXT.en, ...(TEXT[lang] || {}) };
document.documentElement.lang = TEXT[lang] ? lang : 'en';
if (lang === 'ur' || lang === 'ar') document.documentElement.dir = 'rtl';

const card = document.getElementById('card');
// Everything is built with textContent (never innerHTML): the email address and the link values are untrusted text.
const el = (tag, attrs = {}, text) => { const n = document.createElement(tag); Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v)); if (text !== undefined) n.textContent = text; return n; };
const show = (...nodes) => { card.replaceChildren(...nodes); };
const result = (ok, title, text, extra) => show(el('div', { class: 'badge ' + (ok ? 'ok' : 'bad'), 'aria-hidden': 'true' }, ok ? '✓' : '!'), el('h1', {}, title), el('p', { class: 'muted center' }, text), ...(extra || []), el('a', { class: 'btn', href: APP_LINK }, T.openApp));
const badLink = () => result(false, T.badTitle, T.bad);
const errText = (e) => (e?.code === 'auth/weak-password' ? T.weak : e?.code === 'auth/network-request-failed' ? T.network : T.other);
const isDeadLink = (e) => ['auth/expired-action-code', 'auth/invalid-action-code', 'auth/user-disabled', 'auth/user-not-found'].includes(e?.code);

function resetForm(email, code) {
  const pw = el('input', { type: 'password', id: 'pw', autocomplete: 'new-password', autocapitalize: 'none', spellcheck: 'false' });
  const again = el('input', { type: 'password', id: 'again', autocomplete: 'new-password', autocapitalize: 'none', spellcheck: 'false' });
  const eye = el('button', { type: 'button', class: 'eye' }, T.show);
  eye.onclick = () => { const on = pw.type === 'password'; pw.type = again.type = on ? 'text' : 'password'; eye.textContent = on ? T.hide : T.show; };
  const msg = el('p', { class: 'msg', role: 'alert' });
  const btn = el('button', { type: 'button', class: 'btn' }, T.save);
  const submit = async () => {
    msg.textContent = '';
    if (pw.value.length < 6) { msg.textContent = T.short; pw.focus(); return; }
    if (pw.value !== again.value) { msg.textContent = T.mismatch; again.focus(); return; }
    btn.disabled = true; btn.textContent = T.saving;
    try { await confirmPasswordReset(auth, code, pw.value); result(true, T.resetDoneTitle, T.resetDone); }
    catch (e) { if (isDeadLink(e)) { badLink(); return; } msg.textContent = errText(e); btn.disabled = false; btn.textContent = T.save; }
  };
  btn.onclick = submit;
  [pw, again].forEach((i) => i.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') submit(); }));
  const who = el('p', { class: 'muted center' }, T.resetFor + ' '); who.appendChild(el('span', { class: 'email' }, email));
  show(el('h1', {}, T.resetTitle), who, el('label', { for: 'pw' }, T.newPw), wrap(pw, eye), el('label', { for: 'again' }, T.againPw), wrap(again), msg, btn);
  pw.focus();
}
function wrap(...kids) { const d = el('div', { class: 'row' }); kids.forEach((k) => d.appendChild(k)); return d; }

(async () => {
  const mode = params.get('mode'), code = params.get('oobCode');
  history.replaceState(null, '', location.pathname); // the one-time code does not stay in the address bar / history
  if (!mode || !code) return badLink();
  try {
    if (mode === 'resetPassword') resetForm(await verifyPasswordResetCode(auth, code), code);
    else if (mode === 'verifyEmail') { await applyActionCode(auth, code); result(true, T.verifyTitle, T.verifyDone); }
    else if (mode === 'verifyAndChangeEmail') { const info = await checkActionCode(auth, code); await applyActionCode(auth, code); result(true, T.changedTitle, T.changedDone, info?.data?.email ? [el('p', { class: 'email center' }, info.data.email)] : []); }
    else if (mode === 'recoverEmail') { const info = await checkActionCode(auth, code); await applyActionCode(auth, code); result(true, T.recoverTitle, T.recoverDone, info?.data?.email ? [el('p', { class: 'email center' }, info.data.email)] : []); }
    else badLink();
  } catch (e) { if (isDeadLink(e)) badLink(); else result(false, T.badTitle, errText(e)); }
})();
