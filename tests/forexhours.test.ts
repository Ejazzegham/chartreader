import { FX_SESSIONS, sessionState, sessionWindows, volumeAt, timelineDay, overlapsAround, offsetMin, zonedToUtc, fmtClock, weekOpenAfter, weekCloseAfter, utcLabel } from '../src/forexHours';

let fails = 0;
const ok = (c: unknown, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const at = (iso: string) => new Date(iso);
const S = (k: string) => FX_SESSIONS.find((s) => s.key === k)!;
const open = (k: string, iso: string) => sessionState(S(k), at(iso)).open;

// ---------- time zones (daylight saving comes from Intl)
ok(offsetMin('America/New_York', at('2026-07-08T12:00:00Z').getTime()) === -240 && offsetMin('America/New_York', at('2026-12-08T12:00:00Z').getTime()) === -300, 'New York is UTC-4 in summer and UTC-5 in winter');
ok(offsetMin('Europe/London', at('2026-07-08T12:00:00Z').getTime()) === 60 && offsetMin('Europe/London', at('2026-12-08T12:00:00Z').getTime()) === 0, 'London is UTC+1 in summer and UTC+0 in winter');
ok(offsetMin('Australia/Sydney', at('2026-07-08T12:00:00Z').getTime()) === 600 && offsetMin('Australia/Sydney', at('2026-12-08T12:00:00Z').getTime()) === 660, 'Sydney is UTC+10 in July and UTC+11 in December');
ok(offsetMin('Asia/Karachi', at('2026-07-08T12:00:00Z').getTime()) === 300, 'Karachi is UTC+5');
ok(zonedToUtc('America/New_York', 2026, 7, 8, 8, 0) === at('2026-07-08T12:00:00Z').getTime(), '8:00 in New York in July is 12:00 UTC');
ok(zonedToUtc('America/New_York', 2026, 12, 8, 8, 0) === at('2026-12-08T13:00:00Z').getTime(), '8:00 in New York in December is 13:00 UTC');
ok(fmtClock(at('2026-07-08T13:05:00Z').getTime(), 'UTC', false) === '1:05 pm' && fmtClock(at('2026-07-08T00:05:00Z').getTime(), 'UTC', false) === '12:05 am' && fmtClock(at('2026-07-08T00:05:00Z').getTime(), 'UTC', true) === '00:05', '12 hour and 24 hour clock text (midnight is 12:05 am / 00:05)');
ok(utcLabel(at('2026-07-08T12:00:00Z').getTime(), 'Asia/Karachi') === 'UTC +5' && utcLabel(at('2026-07-08T12:00:00Z').getTime(), 'America/New_York') === 'UTC -4', 'UTC offset label');

// ---------- which sessions are open (Wednesday 8 July 2026, northern summer)
ok(open('sydney', '2026-07-08T00:01:00Z') && open('tokyo', '2026-07-08T00:01:00Z') && !open('london', '2026-07-08T00:01:00Z') && !open('newyork', '2026-07-08T00:01:00Z'), '00:01 UTC (July): Sydney and Tokyo are open');
ok(open('london', '2026-07-08T07:30:00Z') && open('tokyo', '2026-07-08T07:30:00Z') && !open('sydney', '2026-07-08T07:30:00Z'), '07:30 UTC (July): London opened at 8:00 BST, Tokyo is still open, Sydney is closed');
ok(open('london', '2026-07-08T13:00:00Z') && open('newyork', '2026-07-08T13:00:00Z'), '13:00 UTC (July): London and New York overlap');
ok(!open('london', '2026-07-08T16:00:00Z') && open('newyork', '2026-07-08T16:00:00Z'), '16:00 UTC (July): London has closed (17:00 BST), New York is still open');
ok(open('london', '2026-12-08T16:30:00Z') && !open('london', '2026-12-08T17:00:00Z'), 'December: London stays open until 17:00 UTC');
ok(!open('newyork', '2026-07-08T21:00:00Z') && !open('newyork', '2026-12-08T22:00:00Z'), 'New York is closed after 5 PM local');
// weekend
ok(!['sydney', 'tokyo', 'london', 'newyork'].some((k) => open(k, '2026-07-11T10:00:00Z')), 'Saturday: every session is closed');
ok(!open('tokyo', '2026-07-12T00:30:00Z'), 'Sunday morning in Tokyo: closed (no weekend sessions)');
ok(!open('london', '2026-07-10T21:30:00Z'), 'Friday after the weekly close: London is closed');

// ---------- countdowns
const sy = sessionState(S('sydney'), at('2026-07-08T00:01:00Z'));
ok(sy.open && Math.round(sy.minsLeft) === 359, 'Sydney at 00:01 UTC closes in 5h 59m (06:00 UTC)');
const lo = sessionState(S('london'), at('2026-07-08T05:00:00Z'));
ok(!lo.open && Math.round(lo.minsLeft) === 120, 'London at 05:00 UTC opens in 2h (07:00 UTC in July)');
const fri = sessionState(S('tokyo'), at('2026-07-10T12:00:00Z'));
ok(!fri.open && fri.nextOpen !== null && fri.nextOpen > at('2026-07-12T00:00:00Z').getTime(), 'Tokyo on Friday noon UTC opens again after the weekend');
const sun = sessionState(S('sydney'), at('2026-07-12T12:00:00Z'));
ok(!sun.open && sun.nextOpen === at('2026-07-12T21:00:00Z').getTime(), 'Sydney on Sunday opens with the forex week (Sunday 17:00 New York = 21:00 UTC in July)');
const sunW = sessionState(S('sydney'), at('2026-12-13T12:00:00Z'));
ok(!sunW.open && sunW.nextOpen === at('2026-12-13T22:00:00Z').getTime(), 'Sydney on a winter Sunday opens at 22:00 UTC (the week opens after Sydney\'s own 7 AM)');

// ---------- forex week
ok(weekOpenAfter(at('2026-07-08T12:00:00Z').getTime()) === at('2026-07-12T21:00:00Z').getTime(), 'next weekly open: Sunday 21:00 UTC in July');
ok(weekCloseAfter(at('2026-07-08T12:00:00Z').getTime()) === at('2026-07-10T21:00:00Z').getTime(), 'next weekly close: Friday 21:00 UTC in July');
ok(weekCloseAfter(at('2026-12-08T12:00:00Z').getTime()) === at('2026-12-11T22:00:00Z').getTime(), 'next weekly close: Friday 22:00 UTC in December');

// ---------- volume
ok(volumeAt(at('2026-07-08T13:30:00Z').getTime()) === 'high', 'London + New York overlap is high volume');
ok(volumeAt(at('2026-07-08T03:00:00Z').getTime()) === 'medium', 'Sydney + Tokyo is medium volume');
ok(volumeAt(at('2026-07-08T22:00:00Z').getTime()) === 'low', '22:00 UTC (July): only Sydney is open, low volume');
ok(volumeAt(at('2026-07-11T10:00:00Z').getTime()) === 'closed', 'Saturday is closed');

// ---------- overlaps
const ov = overlapsAround(at('2026-07-08T05:00:00Z'));
const ln = ov.find((o) => o.a.key === 'london' && o.b.key === 'newyork');
ok(ov.length === 3 && !!ln && ln.start === at('2026-07-08T12:00:00Z').getTime() && ln.end === at('2026-07-08T16:00:00Z').getTime(), 'London / New York overlap is 12:00 to 16:00 UTC in July (4 hours)');
const ln2 = overlapsAround(at('2026-12-08T05:00:00Z')).find((o) => o.a.key === 'london' && o.b.key === 'newyork')!;
ok(ln2.start === at('2026-12-08T13:00:00Z').getTime() && ln2.end === at('2026-12-08T17:00:00Z').getTime(), 'London / New York overlap is 13:00 to 17:00 UTC in December');

// ---------- timeline in a chosen zone
const tl = timelineDay('UTC', at('2026-07-08T12:00:00Z'));
const lon = tl.lanes.find((l) => l.s.key === 'london')!.segs[0];
ok(Math.abs(lon.from - 7 / 24) < 1e-9 && Math.abs(lon.to - 16 / 24) < 1e-9, 'London bar on a UTC timeline runs 07:00 to 16:00 in July');
ok(tl.lanes.find((l) => l.s.key === 'sydney')!.segs.length === 2, 'Sydney crosses midnight UTC, so it shows as two bars');
ok(Math.abs(tl.nowPos - 0.5) < 1e-9 && tl.vol.length === 48, 'now marker at the middle of the day, 48 volume cells');
const tk = timelineDay('Asia/Karachi', at('2026-07-08T12:00:00Z'));
ok(Math.abs(tk.lanes.find((l) => l.s.key === 'london')!.segs[0].from - 12 / 24) < 1e-9, 'London opens at 12:00 on a Karachi timeline in July (07:00 UTC + 5)');
const dst = timelineDay('America/New_York', at('2026-11-01T12:00:00Z'));
ok(dst.hours === 25, 'the day the US clocks go back has 25 hours on a New York timeline');

if (fails) { console.log(fails + ' FAILED'); process.exit(1); } else console.log('all forex hours tests passed');
