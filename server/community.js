// Community: members discuss, ask questions and share their trade ideas / analyses. Everything lives in its own small file (<db>.community.json),
// written a few seconds after a change, so a busy community never slows the main database down.
//
// Rules the server enforces (the app only shows the messages):
//   - every call needs a logged-in session. Authors are shown as "First L." with their country, never with an email address.
//   - length limits, a limit on links, and no paid-signal / Telegram / WhatsApp / guaranteed-profit promotion (the usual spam of trading forums).
//   - a shared trade idea must be consistent: a buy has its stop below the entry and its targets above (a sell is the opposite).
//   - rate limits per member, no duplicate posts, nobody likes their own post.
//   - three different members reporting a post or comment hides it until an admin looks at it (admins see hidden items and can restore or delete them).
const fs = require('fs');

const KINDS = ['analysis', 'discussion', 'question'];
const LIM = { title: 120, body: 3000, comment: 1000 };
const SPAM = [
  /\b(guaranteed|assured|sure[- ]?shot)\b.{0,30}\b(profits?|returns?|wins?|signals?)\b/i,
  /\brisk[- ]?free\b.{0,30}\b(profits?|trades?|returns?)\b/i,
  /\b(t\.me|telegram\.me|wa\.me|chat\.whatsapp\.com|discord\.gg)\b/i,
  /\b(dm|inbox|message|whatsapp|telegram)\s+me\b.{0,40}\b(signals?|vip|profits?|account|mentorship|course)\b/i,
  /\b(vip|paid|premium)\s+(signals?|group|channel)\b/i,
  /\b(join|buy|get|subscribe)\b.{0,25}\b(my|our)\b.{0,25}\b(signals?|vip|group|channel|course|mentorship|ea|robot)\b/i,
  /\bmanaged\s+accounts?\b/i,
];
const SPAM_MSG = 'Promotion of paid signals, Telegram / WhatsApp groups, managed accounts or guaranteed profits is not allowed in the community.';

const err = (status, message) => Object.assign(new Error(message), { status });
// Text from a member: no control or direction-changing characters, tidy line breaks, cut to the limit.
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
const links = (s) => (s.match(/https?:\/\/|www\./gi) || []).length;
const num = (x) => Number(x);
const initial = (w) => (Array.from(w)[0] || '').toUpperCase();

module.exports = function makeCommunity({ file, people, isAdmin, notify }) {
  let st = { seq: 0, posts: {}, comments: {} };
  try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); if (j && j.posts && j.comments) st = { seq: j.seq || 0, posts: j.posts, comments: j.comments }; } catch {}
  let dirty = false;
  const flush = () => { if (!dirty) return; try { const t = file + '.tmp'; fs.writeFileSync(t, JSON.stringify(st)); fs.renameSync(t, file); dirty = false; } catch {} };
  const touch = () => { dirty = true; };
  setInterval(flush, 5000).unref(); process.on('exit', flush);

  // ---- who is writing: "First L." + country (from the signup map lookup) + admin badge
  const tail = (pid) => String(pid).replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase();
  function shortName(full) {
    const w = String(full || '').replace(/[<>]/g, '').trim().split(/\s+/).filter(Boolean); if (!w.length) return '';
    const first = initial(w[0]) + Array.from(w[0]).slice(1).join('').toLowerCase();
    return Array.from(first).slice(0, 14).join('') + (w.length > 1 ? ' ' + initial(w[w.length - 1]) + '.' : '');
  }
  function who(pid) {
    const p = people[pid];
    if (!p || p.deleted) return { name: 'Former member', cc: '', role: 'member', joined: 0 };
    return { name: shortName(p.name) || 'Trader ' + tail(pid), cc: (p.geo && p.geo.cc) || '', role: isAdmin(pid) ? 'admin' : 'member', joined: p.created || 0 };
  }

  // ---- rate limits (in memory): at most `max` actions in the last `ms`
  const hits = new Map();
  function allow(key, max, ms) {
    const now = Date.now(), a = (hits.get(key) || []).filter((t) => now - t < ms);
    if (a.length >= max) { hits.set(key, a); return false; }
    a.push(now); hits.set(key, a);
    if (hits.size > 20000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > 864e5) hits.delete(k);
    return true;
  }
  const H = 36e5, D = 864e5;

  function screen(text) {
    if (links(text) > 2) throw err(400, 'Please use at most two links.');
    if (SPAM.some((r) => r.test(text))) throw err(400, SPAM_MSG);
  }

  // ---- shapes sent to the app
  const postView = (p, me, adm) => ({
    id: p.id, kind: p.kind, title: p.title, body: p.body, symbol: p.symbol || null, analysis: p.analysis || null,
    created: p.created, edited: p.edited || 0, pinned: !!p.pinned, hidden: !!p.hidden, reports: adm ? p.reports.length : 0,
    author: who(p.pid), mine: p.pid === me, likes: p.likes.length, liked: p.likes.includes(me), comments: p.nc || 0,
  });
  const commentView = (c, me, adm) => ({
    id: c.id, postId: c.postId, body: c.body, created: c.created, hidden: !!c.hidden, reports: adm ? c.reports.length : 0,
    author: who(c.pid), mine: c.pid === me, likes: c.likes.length, liked: c.likes.includes(me),
  });
  const visible = (x, adm) => !x.removed && (adm || !x.hidden);

  // ---- trade idea attached to a post
  function cleanAnalysis(a) {
    if (!a || typeof a !== 'object') return null;
    const side = a.side === 'sell' ? 'sell' : a.side === 'buy' ? 'buy' : '';
    const entry = num(a.entry), sl = num(a.sl), tps = (Array.isArray(a.tps) ? a.tps : []).map(num).filter((x) => Number.isFinite(x)).slice(0, 3);
    if (!side || !(entry > 0) || !(sl > 0) || !tps.length || tps.some((x) => !(x > 0))) throw err(400, 'Enter a direction, an entry, a stop loss and at least one take profit.');
    const ok = side === 'buy' ? sl < entry && tps.every((x) => x > entry) : sl > entry && tps.every((x) => x < entry);
    if (!ok) throw err(400, 'The levels do not match the direction: a buy needs the stop below the entry and the targets above it (a sell is the opposite).');
    const r = (x) => Math.round(x * 1e8) / 1e8;
    const out = { side, entry: r(entry), sl: r(sl), tps: tps.map(r), tf: clean(a.tf, 6), dec: Math.min(8, Math.max(0, parseInt(a.dec, 10) || 0)) };
    if (a.grade) out.grade = clean(a.grade, 4);
    if (Number.isFinite(num(a.score))) out.score = Math.min(100, Math.max(0, Math.round(num(a.score))));
    if (a.source) out.source = clean(a.source, 40);
    return out;
  }
  function cleanSymbol(s) {
    if (!s || typeof s !== 'object') return null;
    const id = String(s.id || '').trim();
    if (!/^[A-Za-z0-9_.\-]{1,30}$/.test(id)) return null;
    return { id, name: clean(s.name, 40) || id };
  }

  // ---- calls
  function feed(b, s) {
    const me = s.pid, adm = !!s.admin;
    let list = Object.values(st.posts).filter((p) => visible(p, adm));
    const kind = KINDS.includes(b.kind) ? b.kind : '';
    if (kind) list = list.filter((p) => p.kind === kind);
    const sym = String(b.symbol || '').slice(0, 30); if (sym) list = list.filter((p) => p.symbol && p.symbol.id === sym);
    if (b.mine) list = list.filter((p) => p.pid === me);
    const q = clean(b.q, 60).toLowerCase(); if (q) list = list.filter((p) => (p.title + ' ' + p.body + ' ' + (p.symbol ? p.symbol.name : '')).toLowerCase().includes(q));
    const score = (p) => p.likes.length * 2 + (p.nc || 0) * 3;
    list.sort(b.sort === 'top' ? (a, c) => score(c) - score(a) || c.created - a.created : (a, c) => c.created - a.created);
    list = [...list.filter((p) => p.pinned), ...list.filter((p) => !p.pinned)];
    const offset = Math.max(0, parseInt(b.offset, 10) || 0), limit = Math.min(30, Math.max(1, parseInt(b.limit, 10) || 15));
    const out = { posts: list.slice(offset, offset + limit).map((p) => postView(p, me, adm)), more: list.length > offset + limit, me: { ...who(me), admin: adm } };
    if (offset === 0) { // the side panel: numbers, trending pairs and the most helpful members of the last 30 days
      const all = Object.values(st.posts).filter((p) => visible(p, false)), now = Date.now();
      out.stats = { posts: all.length, today: all.filter((p) => now - p.created < D).length, comments: Object.values(st.comments).filter((c) => visible(c, false)).length };
      const tr = {}; for (const p of all) if (p.symbol && now - p.created < 14 * D) { const e = (tr[p.symbol.id] ||= { id: p.symbol.id, name: p.symbol.name, n: 0 }); e.n++; }
      out.trending = Object.values(tr).sort((a, c) => c.n - a.n).slice(0, 6);
      const tp = {}; for (const p of all) if (now - p.created < 30 * D) { const e = (tp[p.pid] ||= { pid: p.pid, posts: 0, likes: 0 }); e.posts++; e.likes += p.likes.length; }
      out.top = Object.values(tp).sort((a, c) => (c.likes * 2 + c.posts) - (a.likes * 2 + a.posts)).slice(0, 5).map((e) => ({ ...who(e.pid), posts: e.posts, likes: e.likes }));
    }
    return out;
  }

  function create(b, s) {
    const kind = KINDS.includes(b.kind) ? b.kind : 'discussion';
    const title = clean(b.title, LIM.title), body = clean(b.body, LIM.body);
    if (title.length < 4) throw err(400, 'Add a short title (at least 4 characters).');
    const analysis = kind === 'analysis' ? cleanAnalysis(b.analysis) : null, symbol = cleanSymbol(b.symbol);
    if (kind === 'analysis' && !symbol) throw err(400, 'Choose the pair this analysis is about.');
    if (kind === 'analysis' && !analysis && body.length < 20) throw err(400, 'Add your trade levels, or explain your analysis in a few sentences.');
    if (kind !== 'analysis' && body.length < 10) throw err(400, 'Write a little more (at least 10 characters).');
    screen(title + '\n' + body);
    const mine = Object.values(st.posts).filter((p) => p.pid === s.pid && Date.now() - p.created < D);
    if (mine.some((p) => p.title === title && p.body === body)) throw err(400, 'You already posted this.');
    if (!allow('post-h:' + s.pid, 5, H) || !allow('post-d:' + s.pid, 20, D)) throw err(429, 'You are posting very fast. Please wait a little before the next post.');
    const id = ++st.seq;
    const p = { id, pid: s.pid, kind, title, body, symbol, analysis, created: Date.now(), edited: 0, likes: [], reports: [], nc: 0, pinned: 0, hidden: 0 };
    st.posts[id] = p;
    const ids = Object.keys(st.posts); // keep the file small: the oldest posts (not pinned) go when there are very many
    if (ids.length > 8000) for (const k of ids.map(Number).sort((a, c) => a - c).slice(0, ids.length - 8000)) if (!st.posts[k].pinned) { dropPost(k); }
    touch();
    return { post: postView(p, s.pid, !!s.admin) };
  }

  function dropPost(id) { delete st.posts[id]; for (const [k, c] of Object.entries(st.comments)) if (c.postId === id) delete st.comments[k]; }
  const getPost = (id) => { const p = st.posts[parseInt(id, 10)]; if (!p) throw err(404, 'This post is no longer available.'); return p; };

  function edit(b, s) {
    const p = getPost(b.id); if (p.pid !== s.pid) throw err(403, 'You can only edit your own posts.');
    const title = clean(b.title, LIM.title), body = clean(b.body, LIM.body);
    if (title.length < 4) throw err(400, 'Add a short title (at least 4 characters).');
    if (p.kind !== 'analysis' && body.length < 10) throw err(400, 'Write a little more (at least 10 characters).');
    screen(title + '\n' + body);
    p.title = title; p.body = body; p.edited = Date.now(); touch();
    return { post: postView(p, s.pid, !!s.admin) };
  }

  function remove(b, s) {
    const p = getPost(b.id); if (p.pid !== s.pid && !s.admin) throw err(403, 'You can only delete your own posts.');
    dropPost(p.id); touch(); return { ok: true };
  }

  function like(b, s) {
    if (!allow('like:' + s.pid, 300, H)) throw err(429, 'Too many likes in a short time.');
    const t = b.type === 'comment' ? st.comments[parseInt(b.id, 10)] : st.posts[parseInt(b.id, 10)];
    if (!t || !visible(t, !!s.admin)) throw err(404, 'This item is no longer available.');
    if (t.pid === s.pid) throw err(400, 'You cannot like your own ' + (b.type === 'comment' ? 'comment.' : 'post.'));
    const i = t.likes.indexOf(s.pid); if (i >= 0) t.likes.splice(i, 1); else t.likes.push(s.pid);
    touch(); return { liked: i < 0, likes: t.likes.length };
  }

  function comments(b, s) {
    const p = getPost(b.postId), adm = !!s.admin; if (!visible(p, adm)) throw err(404, 'This post is no longer available.');
    const list = Object.values(st.comments).filter((c) => c.postId === p.id && visible(c, adm)).sort((a, c) => a.created - c.created).slice(0, 300);
    return { comments: list.map((c) => commentView(c, s.pid, adm)) };
  }

  function comment(b, s) {
    const p = getPost(b.postId); if (!visible(p, !!s.admin)) throw err(404, 'This post is no longer available.');
    const body = clean(b.body, LIM.comment);
    if (body.length < 2) throw err(400, 'Write a comment first.');
    screen(body);
    const mine = Object.values(st.comments).filter((c) => c.pid === s.pid && c.postId === p.id && Date.now() - c.created < D);
    if (mine.some((c) => c.body === body)) throw err(400, 'You already wrote this comment.');
    if (!allow('cm-h:' + s.pid, 20, H) || !allow('cm-d:' + s.pid, 100, D)) throw err(429, 'You are commenting very fast. Please wait a little.');
    const id = ++st.seq, c = { id, postId: p.id, pid: s.pid, body, created: Date.now(), likes: [], reports: [], hidden: 0 };
    st.comments[id] = c; p.nc = (p.nc || 0) + 1; touch();
    if (p.pid !== s.pid && notify) { try { notify(p.pid, 'New comment on your post', who(s.pid).name + ': ' + body.slice(0, 90), { type: 'community', postId: p.id }); } catch {} }
    return { comment: commentView(c, s.pid, !!s.admin), comments: p.nc };
  }

  function removeComment(b, s) {
    const c = st.comments[parseInt(b.id, 10)]; if (!c) throw err(404, 'This comment is no longer available.');
    if (c.pid !== s.pid && !s.admin) throw err(403, 'You can only delete your own comments.');
    delete st.comments[c.id]; const p = st.posts[c.postId]; if (p) p.nc = Math.max(0, (p.nc || 1) - 1); touch();
    return { ok: true, comments: p ? p.nc : 0 };
  }

  function report(b, s) {
    if (!allow('report:' + s.pid, 20, D)) throw err(429, 'You have sent many reports today. Thank you, our team will look at them.');
    const t = b.type === 'comment' ? st.comments[parseInt(b.id, 10)] : st.posts[parseInt(b.id, 10)];
    if (!t) throw err(404, 'This item is no longer available.');
    if (t.pid === s.pid) throw err(400, 'You cannot report your own content.');
    if (!t.reports.includes(s.pid)) t.reports.push(s.pid);
    if (t.reports.length >= 3) t.hidden = 1; // three different members: hidden until an admin decides
    touch(); return { ok: true };
  }

  function adminCall(u, b, s) {
    if (!s.admin) throw err(403, 'Admins only.');
    if (u === '/community/admin/pin') { const p = getPost(b.id); p.pinned = b.pinned ? Date.now() : 0; touch(); return { post: postView(p, s.pid, true) }; }
    if (u === '/community/admin/hide') { // hide, or restore after a review (restoring also clears the reports)
      const t = b.type === 'comment' ? st.comments[parseInt(b.id, 10)] : st.posts[parseInt(b.id, 10)]; if (!t) throw err(404, 'Not found.');
      t.hidden = b.hidden ? 1 : 0; if (!b.hidden) t.reports = []; touch(); return { ok: true, hidden: !!t.hidden };
    }
    throw err(404, 'Unknown call.');
  }

  // Routes: returns { status, body } for /community/*, null for anything else.
  async function handle(u, b, s) {
    if (!u.startsWith('/community/')) return null;
    try {
      let body;
      if (u === '/community/feed') body = feed(b, s);
      else if (u === '/community/post') body = create(b, s);
      else if (u === '/community/post/edit') body = edit(b, s);
      else if (u === '/community/post/delete') body = remove(b, s);
      else if (u === '/community/like') body = like(b, s);
      else if (u === '/community/comments') body = comments(b, s);
      else if (u === '/community/comment') body = comment(b, s);
      else if (u === '/community/comment/delete') body = removeComment(b, s);
      else if (u === '/community/report') body = report(b, s);
      else if (u.startsWith('/community/admin/')) body = adminCall(u, b, s);
      else return { status: 404, body: { error: 'Unknown call.' } };
      return { status: 200, body };
    } catch (e) { return { status: e.status || 500, body: { error: e.status ? e.message : 'Something went wrong. Please try again.' } }; }
  }
  return { handle, flush };
};
