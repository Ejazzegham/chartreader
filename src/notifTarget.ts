// Where a notification should take the person when it is tapped (on the phone's notification, or on a line of the bell list).
// Pure function, tested in tests/notiftarget.test.ts.
//   'help'   : the Help chat (support replies, payment answers)
//   'symbol' : the Analysis tab on that pair (a reached price level, a scanner setup)
//   'admin'  : the admin panel (admin accounts: a new support message or a payment waiting for review)
//   'bell'   : no specific place is known, so the list of notifications opens
// `data` is what the server put into the push (type, sym or symId), or the type / sym saved on a bell line.
export type NotifData = { type?: unknown; sym?: unknown; symId?: unknown } | null | undefined;
export type NotifTarget = { kind: 'help' } | { kind: 'admin' } | { kind: 'symbol'; sym: string } | { kind: 'bell' };

const SYM_OK = /^[A-Za-z0-9_.:-]{1,40}$/; // same idea as the server's symbol check: only plain ids are accepted

export function notifTarget(d: NotifData): NotifTarget {
  const type = typeof d?.type === 'string' ? d.type : '';
  if (type === 'support') return { kind: 'help' };
  if (type === 'admin') return { kind: 'admin' };
  const raw = typeof d?.sym === 'string' && d.sym ? d.sym : typeof d?.symId === 'string' ? d.symId : '';
  if ((type === 'price' || type === 'setup' || type === 'trade' || type === 'level') && SYM_OK.test(raw)) return { kind: 'symbol', sym: raw };
  return { kind: 'bell' };
}

// A bell line can be tapped when it leads somewhere more specific than the list itself.
export const hasTarget = (d: NotifData) => notifTarget(d).kind !== 'bell';

// Older bell lines were saved without their pair (and a few lines still are, for example news). Find the pair in the line's own text:
// "EURUSD BUY 82%: ..." -> frxEURUSD. Names are compared without spaces or slashes, longest name first, and a name must be at least 5 characters
// so a short word cannot match by accident. Returns '' when no pair is named.
export function guessSym(text: unknown, syms: { id: string; name: string }[]): string {
  const norm = (x: string) => x.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const hay = norm(typeof text === 'string' ? text : '');
  if (!hay) return '';
  const list = syms.map((s) => ({ id: s.id, n: norm(s.name) })).filter((s) => s.n.length >= 5).sort((a, b) => b.n.length - a.n.length);
  return list.find((s) => hay.includes(s.n))?.id ?? '';
}
