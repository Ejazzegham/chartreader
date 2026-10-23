// Payments. A payment is never accepted by the server on its own: the user sends a CLAIM (TxID + the wallet it was sent FROM) and the ADMIN approves it.
//  - one TxID can be claimed once, ever. Whoever claims it first owns it; nobody else can use it.
//  - the sender wallet is tied to the account that claimed it. A wallet that belongs to another account is refused.
//  - when the chain can be read, the transaction must really exist, go to OUR address, be big enough and come from the wallet the user typed.
//  - days are added only when the admin approves (the admin may change the days). A rejected claim frees the wallet again.
const WALLET = { TRON: /^T[1-9A-HJ-NP-Za-km-z]{33}$/, BSC: /^0x[0-9a-fA-F]{40}$/ };
const TXID = { TRON: /^[0-9a-f]{64}$/, BSC: /^0x[0-9a-f]{64}$/ };
const MIN_USD = 7.9;
const daysFor = (usd) => { const months = Math.floor((usd + 0.1) / 20); return months * 30 + Math.floor((usd + 0.1 - months * 20) / 8) * 7; };
const normTx = (network, v) => { const x = String(v || '').trim().toLowerCase(); return network === 'BSC' && /^[0-9a-f]{64}$/.test(x) ? '0x' + x : x; };

// lookup(network, txid) -> { found, usd, from }  (may throw when the chain API is down)   notify(pid, title, body) -> Promise
module.exports = function payments({ db, save, lookup, notify = async () => {}, notifyAdmins = async () => {}, now = Date.now, DAY = 864e5, MAX_OPEN = 5 }) {
  db.pays ||= {}; db.wallets ||= {};
  const tries = new Map(); // pid -> times of recent claims (stops one user from hammering the chain API)

  const existing = (txid) => {
    const o = db.pays[txid] || (db.tx && db.tx[txid]);
    if (!o) return null;
    if (typeof o === 'string') return { pid: o, status: 'approved' };
    return { ...o, status: o.status || (o.pending ? 'checking' : 'approved') };
  };

  async function submit(s, b) {
    const network = b.network === 'TRON' ? 'TRON' : 'BSC', txid = normTx(network, b.txid), t = now();
    if (!TXID[network].test(txid)) throw new Error(network === 'TRON' ? 'A TRON TxID has 64 letters and numbers.' : 'A BSC TxID starts with 0x and has 64 letters and numbers after it.');
    let wallet = String(b.wallet || '').trim();
    if (!WALLET[network].test(wallet)) throw new Error('Enter the wallet address you sent the payment FROM (' + (network === 'TRON' ? 'starts with T' : 'starts with 0x') + ').');
    if (network === 'BSC') wallet = wallet.toLowerCase();
    const plan = b.plan === 'weekly' ? 'weekly' : 'monthly';

    const old = existing(txid);
    if (old) {
      const stale = old.status === 'checking' && t - (old.at || 0) > 120e3;
      if (!(stale || (old.status === 'rejected' && old.pid === s.pid))) {
        throw new Error(old.status === 'checking' ? 'This payment is being checked. Wait a moment.' : 'This transaction was already submitted. A transaction can be used only once, by the account whose wallet sent it.');
      }
    }
    const owner = db.wallets[wallet];
    if (owner && owner !== s.pid) throw new Error('This wallet is already linked to another account. Pay from your own wallet. If this is a mistake, contact support.');
    if (Object.values(db.pays).filter((x) => x.pid === s.pid && x.status === 'review').length >= MAX_OPEN) throw new Error('You already have ' + MAX_OPEN + ' payments waiting for review. Wait for the admin to answer them first.');
    const recent = (tries.get(s.pid) || []).filter((x) => t - x < 3600e3);
    if (recent.length >= 12) throw new Error('Too many attempts. Try again in an hour or contact support.');
    tries.set(s.pid, [...recent, t]);

    const prev = db.pays[txid];
    db.pays[txid] = { pid: s.pid, email: s.email, network, wallet, plan, at: t, status: 'checking' }; // reserved BEFORE the slow lookup, so two quick taps cannot both be accepted
    const release = () => { if (prev) db.pays[txid] = prev; else delete db.pays[txid]; };
    let chain = null;
    try { chain = await lookup(network, txid); } catch { chain = null; } // chain API down: the admin decides without the check (shown as "not verified")
    if (chain && !chain.found) { release(); throw new Error('No matching USDT payment to our address was found yet. Wait 1-2 minutes after sending and try again.'); }
    if (chain) {
      const from = String(chain.from || ''), same = network === 'BSC' ? from.toLowerCase() === wallet : from === wallet;
      if (!same) { release(); throw new Error('This transaction was not sent from the wallet you entered. You can only claim a payment your own wallet sent.'); }
      if (!(chain.usd >= MIN_USD)) { release(); throw new Error('The payment is smaller than the cheapest plan.'); }
    }
    db.pays[txid] = { pid: s.pid, email: s.email, network, wallet, plan, at: t, status: 'review', usd: chain ? chain.usd : 0, suggest: chain ? daysFor(chain.usd) : 0, verified: !!chain, from: chain ? String(chain.from) : '' };
    db.wallets[wallet] = s.pid; save();
    notifyAdmins('Payment to review', `${s.email} sent a ${plan} payment${chain ? ' of $' + chain.usd : ''}. Open Admin > Pay.`).catch(() => {});
    return { status: 'review', txid };
  }

  const mine = (pid) => Object.entries(db.pays).filter(([, r]) => r.pid === pid && r.status !== 'checking').sort((a, b) => b[1].at - a[1].at).slice(0, 20)
    .map(([txid, r]) => ({ txid, network: r.network, status: r.status, usd: r.usd || 0, days: r.days || 0, at: r.at, plan: r.plan, note: r.note || '' }));

  function listForAdmin() {
    const rows = Object.entries(db.pays).filter(([, r]) => r.status !== 'checking').map(([txid, r]) => ({ txid, pid: r.pid, email: r.email || db.people[r.pid]?.email || '?', network: r.network, wallet: r.wallet || '', plan: r.plan || '', usd: r.usd || 0, suggest: r.suggest || 0, days: r.days || 0, at: r.at || 0, status: r.status, verified: !!r.verified, from: r.from || '', note: r.note || '', decidedAt: r.decidedAt || 0 }));
    for (const [txid, v] of Object.entries(db.tx || {})) { // payments accepted before approvals existed
      if (db.pays[txid] || (typeof v === 'object' && v.pending)) continue;
      rows.push(typeof v === 'string'
        ? { txid, pid: v, email: db.people[v]?.email || '?', network: '?', wallet: '', plan: '', usd: 0, suggest: 0, days: 0, at: 0, status: 'approved', verified: true, from: '', note: '', decidedAt: 0 }
        : { txid, pid: v.pid, email: v.email || db.people[v.pid]?.email || '?', network: v.network || '?', wallet: '', plan: '', usd: v.usd || 0, suggest: 0, days: v.days || 0, at: v.at || 0, status: 'approved', verified: true, from: '', note: '', decidedAt: v.at || 0 });
    }
    return rows.sort((a, b) => (a.status === 'review' ? 0 : 1) - (b.status === 'review' ? 0 : 1) || b.at - a.at);
  }
  const pendingCount = () => Object.values(db.pays).filter((r) => r.status === 'review').length;

  async function decide(adminEmail, b) {
    const rec = db.pays[String(b.txid || '')];
    if (!rec || rec.status !== 'review') throw new Error('This payment is not waiting for a decision (it may already be decided).');
    const t = now();
    if (b.action === 'approve') {
      const days = Math.round(Number(b.days) || rec.suggest || 0);
      if (!(days >= 1 && days <= 400)) throw new Error('Enter how many days to give (1 to 400).');
      const p = db.people[rec.pid]; if (!p) throw new Error('This user no longer exists.');
      p.paidUntil = Math.max(t, p.paidUntil || 0) + days * DAY;
      Object.assign(rec, { status: 'approved', days, decidedAt: t, by: adminEmail });
      save();
      await notify(rec.pid, 'Payment approved', `Your subscription was extended by ${days} days. Thank you!`).catch(() => {});
      return { ok: true, status: 'approved', days, paidUntil: p.paidUntil };
    }
    if (b.action === 'reject') {
      Object.assign(rec, { status: 'rejected', note: String(b.note || '').slice(0, 200), decidedAt: t, by: adminEmail });
      const still = Object.values(db.pays).some((x) => x !== rec && x.pid === rec.pid && x.wallet === rec.wallet && x.status !== 'rejected');
      if (db.wallets[rec.wallet] === rec.pid && !still) delete db.wallets[rec.wallet]; // a rejected claim must not lock the real owner of that wallet out
      save();
      await notify(rec.pid, 'Payment not approved', rec.note || 'The admin could not confirm this payment. Open Help to contact support.').catch(() => {});
      return { ok: true, status: 'rejected' };
    }
    throw new Error('Unknown action');
  }
  return { submit, mine, listForAdmin, pendingCount, decide, daysFor, _normTx: normTx };
};
