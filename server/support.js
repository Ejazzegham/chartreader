// Support chat: one thread per user. The user writes in the app (Help screen); the admin reads and answers in the admin panel.
// Email: a mail-forwarding script posts every email sent to the support address to /inbound/email (see EMAIL_TO_APP.md), and it lands in the same thread.
const MAX_MSGS = 300, MAX_LEN = 2000;
const clean = (v) => String(v || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, MAX_LEN);

// `media` (server/media.js) is optional: without it the chat is text only.
const label = (m) => (m.kind === 'video' ? '🎥 Video' : '📷 Photo');

module.exports = function support({ db, save, notifyAdmins = async () => {}, notifyUser = async () => {}, media = null, now = Date.now }) {
  db.support ||= {}; db.seenMail ||= [];
  const thread = (key, pid, email) => (db.support[key] ||= { key, pid: pid || '', email: email || '', msgs: [], seq: 0, ur: 0, ar: 0 });
  const add = (th, from, text, via, att) => {
    const m = { id: ++th.seq, from, text, at: now(), via }; if (att) m.media = att;
    th.msgs.push(m);
    if (th.msgs.length > MAX_MSGS) { const cut = th.msgs.length - MAX_MSGS; if (media) th.msgs.slice(0, cut).forEach((o) => o.media && media.drop(o.media.id)); th.msgs = th.msgs.slice(-MAX_MSGS); }
    return m;
  };
  const attach = (pid, id) => (id ? (media ? media.take(pid, id) : (() => { throw new Error('Attachments are not available.'); })()) : null);
  const preview = (text, att) => text || (att ? label(att) : '');
  const unreadForAdmin = (th) => th.msgs.filter((m) => m.from === 'user' && m.id > th.ar).length;

  function userSend(s, text, mediaId) {
    const x = clean(text); if (!x && !mediaId) throw new Error('Write your message first.');
    const th = thread(s.pid, s.pid, s.email); th.email = s.email;
    if (th.msgs.filter((m) => m.from === 'user' && now() - m.at < 3600e3).length >= 30) throw new Error('Too many messages in the last hour. Please wait a little.');
    const att = attach(s.pid, mediaId);
    const m = add(th, 'user', x, 'app', att); th.ur = th.seq; // sending also means the user has seen everything so far
    save(); notifyAdmins('New message', `${s.email}: ${preview(x, att).slice(0, 120)}`).catch(() => {});
    return { message: m };
  }
  function userPull(s, since) {
    const th = db.support[s.pid]; if (!th) return { msgs: [], unread: 0, seq: 0 };
    return { msgs: th.msgs.filter((m) => m.id > (Number(since) || 0)), unread: th.msgs.filter((m) => m.from === 'admin' && m.id > th.ur).length, seq: th.seq };
  }
  function userRead(s) { const th = db.support[s.pid]; if (th && th.ur !== th.seq) { th.ur = th.seq; save(); } return { ok: true }; }

  function adminList() {
    const threads = Object.values(db.support).filter((th) => th.msgs.length).map((th) => {
      const p = th.pid ? db.people[th.pid] : null, last = th.msgs[th.msgs.length - 1];
      return { key: th.key, email: th.email || p?.email || '?', name: p?.name || '', guest: !th.pid, unread: unreadForAdmin(th), last: { from: last.from, text: preview(last.text, last.media).slice(0, 140), at: last.at } };
    }).sort((a, b) => (b.unread ? 1 : 0) - (a.unread ? 1 : 0) || b.last.at - a.last.at);
    return { threads, unread: threads.reduce((n, x) => n + x.unread, 0) };
  }
  const unreadTotal = () => Object.values(db.support).reduce((n, th) => n + unreadForAdmin(th), 0);
  function adminThread(key) {
    const th = db.support[String(key)]; if (!th) throw new Error('No such conversation.');
    if (th.ar !== th.seq) { th.ar = th.seq; save(); } // opening it = read
    const p = th.pid ? db.people[th.pid] : null;
    return { key: th.key, email: th.email || p?.email || '?', name: p?.name || '', phone: p?.phone || '', guest: !th.pid, msgs: th.msgs };
  }
  async function adminReply(key, text, mediaId, adminPid) {
    const th = db.support[String(key)], x = clean(text); if (!th) throw new Error('No such conversation.');
    if (!th.pid) throw new Error('This person has no account in the app. Reply to ' + th.email + ' by email.');
    if (!x && !mediaId) throw new Error('Write your reply first.');
    const att = attach(adminPid, mediaId);
    const m = add(th, 'admin', x, 'app', att); th.ar = th.seq; save();
    await notifyUser(th.pid, 'Support replied', preview(x, att).slice(0, 140)).catch(() => {});
    return { message: m };
  }

  // an email arrived at the support address
  function inbound(b) {
    const email = String(b.from || '').trim().toLowerCase().replace(/^.*<([^>]+)>.*$/, '$1');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Bad sender');
    const mid = String(b.messageId || '').slice(0, 200);
    if (mid && db.seenMail.includes(mid)) return { ok: true, duplicate: true };
    const body = clean((b.subject ? String(b.subject).slice(0, 150) + '\n' : '') + String(b.text || '')); if (!body) throw new Error('Empty message');
    const pid = db.emails && db.emails[email] && db.people[db.emails[email]] ? db.emails[email] : '';
    const th = thread(pid || 'g:' + email, pid, email);
    add(th, 'user', body, 'email');
    if (mid) db.seenMail = [...db.seenMail, mid].slice(-500);
    save(); notifyAdmins('New email', `${email}: ${body.slice(0, 120)}`).catch(() => {});
    return { ok: true };
  }
  return { userSend, userPull, userRead, adminList, adminThread, adminReply, unreadTotal, inbound };
};
