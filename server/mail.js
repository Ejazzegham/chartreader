// Branded emails (server/emails/*.html) sent through an email service over HTTPS. Zero dependencies.
// Set ONE of:  RESEND_API_KEY (resend.com)  or  BREVO_API_KEY (brevo.com)    and   MAIL_FROM="Chart Reader <no-reply@your-domain.com>"
// Templates use the same {{ .Placeholder }} style as the FitLife Pro ones: .ConfirmationURL .Email .NewEmail .Token .SiteURL
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, 'emails');

const SUBJECT = {
  'confirm-signup': 'Confirm your Chart Reader account',
  'reset-password': 'Reset your Chart Reader password',
  'change-email': 'Confirm your new Chart Reader email address',
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Fills the placeholders. Every value is HTML-escaped (an email address or a name can never inject markup).
function render(name, vars = {}) {
  if (!SUBJECT[name]) throw new Error('Unknown email template');
  const html = fs.readFileSync(path.join(DIR, name + '.html'), 'utf8').replace(/\{\{\s*\.(\w+)\s*\}\}/g, (_, k) => esc(vars[k]));
  const text = `${SUBJECT[name]}\n\n` + (vars.Token ? `Your code: ${vars.Token}\n` : vars.ConfirmationURL ? `${vars.ConfirmationURL}\n` : '') + '\nIf you did not request this, ignore this email.';
  return { subject: SUBJECT[name], html, text };
}

const from = () => String(process.env.MAIL_FROM || '').trim();
const parseFrom = (f) => { const m = f.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/); return m ? { name: m[1].trim() || 'Chart Reader', email: m[2].trim() } : { name: 'Chart Reader', email: f }; };
const provider = () => (!from() ? '' : process.env.RESEND_API_KEY ? 'resend' : process.env.BREVO_API_KEY ? 'brevo' : '');
const configured = () => !!provider();

async function send(to, name, vars) {
  const p = provider();
  if (!p) throw Object.assign(new Error('MAIL_NOT_SET_UP'), { notSetUp: true });
  const m = render(name, { ...vars, Email: vars.Email ?? to });
  const j = (u, headers, body) => fetch(u, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  const r = p === 'resend'
    ? await j('https://api.resend.com/emails', { authorization: 'Bearer ' + process.env.RESEND_API_KEY }, { from: from(), to: [to], subject: m.subject, html: m.html, text: m.text })
    : await j('https://api.brevo.com/v3/smtp/email', { 'api-key': process.env.BREVO_API_KEY }, { sender: parseFrom(from()), to: [{ email: to }], subject: m.subject, htmlContent: m.html, textContent: m.text });
  if (!r.ok) throw new Error('The email service refused the message (' + r.status + ')');
  return true;
}
module.exports = { render, send, configured, SUBJECT };
