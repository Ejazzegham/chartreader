// The trial clock: moving the phone's date back must not give free days; the server's clock wins whenever it answers.
// Run: npx tsx --tsconfig tests/tsconfig.json tests/license.test.ts
import { trustedNow, syncClock } from '../src/license';
declare const process: any;
let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };

const real = Date.now; let phone = 1_800_000_000_000;
Date.now = () => phone;

const a = trustedNow();
ok(a === phone, 'starts at the phone time');
phone += 60_000; ok(trustedNow() === phone, 'moves forward with the phone');
const high = trustedNow();
phone -= 3 * 864e5; // the user sets the date back 3 days
ok(trustedNow() === high, 'phone date moved back: time does not go backwards');
phone = high + 5_000; ok(trustedNow() === phone, 'and it moves forward again once real time catches up');

const serverNow = phone + 2 * 864e5; // server says it is 2 days later than the phone thinks
syncClock(serverNow); ok(trustedNow() >= serverNow && trustedNow() < serverNow + 1000, 'server clock is adopted when it answers');
phone += 10_000; ok(trustedNow() === serverNow + 10_000, 'phone keeps counting from the server time');
syncClock(phone - 5 * 864e5); ok(trustedNow() < serverNow, 'a server time earlier than a wrong future phone clock corrects it (no permanent early lock-out)');
const before = trustedNow(); syncClock(undefined); syncClock(5); ok(trustedNow() === before, 'missing or junk server time is ignored');

Date.now = real;
console.log(fails ? fails + ' FAILED' : 'license clock test passed');
process.exit(fails ? 1 : 0);
