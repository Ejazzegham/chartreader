// Visitor counter for the home page. Counts people who open the website, not accounts.
// A browser gets a random id (kept in its localStorage). The server keeps only a short one-way hash of it, never an IP address or anything personal:
//   visitors = different browsers ever seen, visits = times the site was opened (once per browser session), online = seen in the last 5 minutes.
// It lives in its own small file (<db>.visits.json) and is written every 30 s, so a busy home page never slows the main database down.
const fs = require('fs'), crypto = require('crypto');
module.exports = function makeVisits({ file }) {
  let st = { total: 0, unique: 0, ids: {} };
  try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); if (j && typeof j.total === 'number') st = { total: j.total, unique: j.unique || 0, ids: j.ids || {} }; } catch {}
  const online = new Map(), perIp = new Map(); let dirty = false, idCount = Object.keys(st.ids).length;
  const hash = (id) => crypto.createHash('sha256').update('chart-reader-visitor:' + id).digest('hex').slice(0, 12);
  const flush = () => { if (!dirty) return; try { const t = file + '.tmp'; fs.writeFileSync(t, JSON.stringify(st)); fs.renameSync(t, file); dirty = false; } catch {} };
  setInterval(flush, 30000).unref(); process.on('exit', flush);

  function counts() {
    const cut = Date.now() - 5 * 60e3; for (const [k, t] of online) if (t < cut) online.delete(k);
    return { visitors: st.unique, visits: st.total, online: online.size };
  }
  // beat = true: the page is still open (keeps "online" fresh). beat = false: a new visit. A new visit is limited per IP address so the number cannot be pumped up.
  function hit(vid, beat, ip) {
    vid = String(vid || '');
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(vid)) return counts();
    const hr = Math.floor(Date.now() / 36e5) + '|' + (beat ? 'b|' : 'v|') + ip, n = (perIp.get(hr) || 0) + 1; perIp.set(hr, n);
    if (perIp.size > 8000) perIp.delete(perIp.keys().next().value);
    if (n > (beat ? 400 : 30)) return counts(); // over the limit for this address: ignored, so the numbers cannot be pumped up
    const k = hash(vid); online.set(k, Date.now());
    if (!beat) {
      st.total++; dirty = true;
      if (!st.ids[k]) { st.unique++; if (idCount < 400000) { st.ids[k] = 1; idCount++; } } // past 400k ids the count keeps growing but can no longer tell repeat browsers apart
    }
    return counts();
  }
  return { hit, counts };
};
