// Chat attachments (photos and videos) for the support chat. Zero dependencies.
//  upload(req, session)  POST /support/upload   raw bytes in the body (not JSON), returns { media: { id, kind, mime, size } }
//  take(pid, id)         called when a message is sent: the file must belong to the sender and not be used yet
//  serve(req, res, id)   GET /media/<id>        with Range support, so a phone's video player can seek and start fast
// The kind of a file is decided by its FIRST BYTES, never by what the phone says it is, so an HTML / SVG / script file can not be
// stored under a photo name. Files are stored under a random 128-bit name: the link only works for someone who was shown it in the chat.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const MB = 1048576;
const MAX_IMAGE = Number(process.env.CHAT_MAX_IMAGE_MB || 8) * MB, MAX_VIDEO = Number(process.env.CHAT_MAX_VIDEO_MB || 25) * MB;
const PER_HOUR = Number(process.env.CHAT_UPLOADS_PER_HOUR || 12), BYTES_PER_HOUR = Number(process.env.CHAT_UPLOAD_MB_PER_HOUR || 120) * MB;
const ID = /^[a-f0-9]{32}$/;
const err = (status, message) => Object.assign(new Error(message), { status });

// What is this file? Look at its first bytes.
function sniff(b) {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { kind: 'image', mime: 'image/jpeg', ext: 'jpg' };
  if (b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { kind: 'image', mime: 'image/png', ext: 'png' };
  if (b.slice(0, 4).toString('latin1') === 'GIF8') return { kind: 'image', mime: 'image/gif', ext: 'gif' };
  if (b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP') return { kind: 'image', mime: 'image/webp', ext: 'webp' };
  if (b.slice(4, 8).toString('latin1') === 'ftyp') { // mp4 / mov / 3gp all start with an "ftyp" box
    const brand = b.slice(8, 12).toString('latin1');
    return brand === 'qt  ' ? { kind: 'video', mime: 'video/quicktime', ext: 'mov' } : { kind: 'video', mime: 'video/mp4', ext: 'mp4' };
  }
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { kind: 'video', mime: 'video/webm', ext: 'webm' };
  return null;
}

module.exports = function media({ db, save, dir, now = Date.now }) {
  db.media ||= {};
  fs.mkdirSync(dir, { recursive: true });
  const fileOf = (r) => path.join(dir, r.id + '.' + r.ext);
  const pub = (r) => ({ id: r.id, kind: r.kind, mime: r.mime, size: r.size });
  const unlink = (r) => { try { fs.unlinkSync(fileOf(r)); } catch { /* already gone */ } };

  async function upload(req, s) {
    const t = now(), k = s.admin ? 5 : 1;
    const mine = Object.values(db.media).filter((r) => r.pid === s.pid && t - r.at < 36e5);
    if (mine.length >= PER_HOUR * k) throw err(429, 'Too many files in the last hour. Please wait a little.');
    if (mine.reduce((n, r) => n + r.size, 0) >= BYTES_PER_HOUR * k) throw err(429, 'Too much uploaded in the last hour. Please wait a little.');
    const declared = Number(req.headers['content-length'] || 0);
    if (declared > MAX_VIDEO) { req.resume(); throw err(413, 'This file is too large (videos up to ' + Math.round(MAX_VIDEO / MB) + ' MB, photos up to ' + Math.round(MAX_IMAGE / MB) + ' MB).'); }

    const id = crypto.randomBytes(16).toString('hex'), tmp = path.join(dir, id + '.part');
    const out = fs.createWriteStream(tmp);
    let size = 0, head = Buffer.alloc(0), info = null, fail = '';
    // A refused file is still read to its end (and thrown away) instead of cutting the connection, so the phone receives the reason as a normal answer.
    try {
      for await (const c of req) {
        size += c.length;
        if (fail) { if (size > MAX_VIDEO + 16 * MB) break; continue; }
        if (size > MAX_VIDEO) { fail = 'big'; continue; }
        if (!info && head.length < 16) { head = Buffer.concat([head, c]); if (head.length >= 16) { info = sniff(head); if (!info) { fail = 'type'; continue; } } }
        if (!out.write(c)) await new Promise((ok) => out.once('drain', ok));
      }
      if (!info && !fail) { info = sniff(head); if (!info) fail = 'type'; } // a very small file arrives in one piece
    } catch { fail = 'abort'; }
    await new Promise((ok) => out.end(ok));
    const drop = () => { try { fs.unlinkSync(tmp); } catch { /* nothing to remove */ } };
    if (fail === 'big') { drop(); throw err(413, 'This file is too large (videos up to ' + Math.round(MAX_VIDEO / MB) + ' MB, photos up to ' + Math.round(MAX_IMAGE / MB) + ' MB).'); }
    if (fail === 'abort') { drop(); throw err(400, 'The upload was interrupted. Try again.'); }
    if (fail || !info) { drop(); throw err(415, 'Only photos (JPG, PNG, WebP, GIF) and videos (MP4, MOV, WebM) can be sent.'); }
    if (info.kind === 'image' && size > MAX_IMAGE) { drop(); throw err(413, 'This photo is too large (up to ' + Math.round(MAX_IMAGE / MB) + ' MB).'); }
    const r = { id, pid: s.pid, kind: info.kind, mime: info.mime, ext: info.ext, size, at: t, used: false };
    fs.renameSync(tmp, fileOf(r));
    db.media[id] = r; save();
    return { media: pub(r) };
  }

  // A message is being sent with this file attached. It must be the sender's own, fresh upload.
  function take(pid, id) {
    if (!id) return null;
    const r = db.media[String(id)];
    if (!r || r.pid !== pid || r.used) throw new Error('The attachment was not found. Attach it again.');
    r.used = true; return pub(r);
  }
  const drop = (id) => { const r = db.media[id]; if (r) { unlink(r); delete db.media[id]; } }; // the message that showed it was removed

  function serve(req, res, id) {
    const r = ID.test(id) ? db.media[id] : null;
    const head = { 'access-control-allow-origin': '*', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'" };
    let st; try { st = r && fs.statSync(fileOf(r)); } catch { st = null; }
    if (!r || !st) { res.writeHead(404, { ...head, 'content-type': 'text/plain' }); return res.end('Not found'); }
    let start = 0, end = st.size - 1, code = 200;
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (m && (m[1] || m[2])) {
      if (m[1] === '') { start = Math.max(0, st.size - Number(m[2])); }
      else { start = Number(m[1]); if (m[2]) end = Math.min(end, Number(m[2])); }
      if (start > end || start >= st.size) { res.writeHead(416, { ...head, 'content-range': 'bytes */' + st.size }); return res.end(); }
      code = 206;
    }
    res.writeHead(code, { ...head, 'content-type': r.mime, 'accept-ranges': 'bytes', 'content-length': end - start + 1, 'cache-control': 'private, max-age=31536000, immutable', 'content-disposition': 'inline',
      ...(code === 206 ? { 'content-range': `bytes ${start}-${end}/${st.size}` } : {}) });
    if (req.method === 'HEAD') return res.end();
    const rs = fs.createReadStream(fileOf(r), { start, end });
    rs.on('error', () => res.destroy());
    res.on('close', () => rs.destroy());
    rs.pipe(res);
  }

  // Files that were uploaded but never sent in a message are removed after a day.
  function sweep() {
    const t = now(); let n = 0;
    for (const r of Object.values(db.media)) if (!r.used && t - r.at > 864e5) { unlink(r); delete db.media[r.id]; n++; }
    try { for (const f of fs.readdirSync(dir)) if (f.endsWith('.part') && t - fs.statSync(path.join(dir, f)).mtimeMs > 36e5) fs.unlinkSync(path.join(dir, f)); } catch { /* folder is being changed */ }
    if (n) save();
    return n;
  }
  sweep(); setInterval(sweep, 36e5).unref();
  return { upload, take, drop, serve, sweep, sniff, MAX_IMAGE, MAX_VIDEO };
};
module.exports.sniff = sniff;
