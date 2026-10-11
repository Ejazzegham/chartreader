import { tone, safeHttpUrl, parseRss } from '../src/headlines';
let fails = 0;
const ok = (c: unknown, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };

ok(tone('Bank of England holds rates steady') === 'flat', '"Bank" is not the word "ban"');
ok(tone('Surprise rate cut from the ECB') === 'flat', '"Surprise" is not the word "rise"');
ok(tone('Bitcoin surges past $100k') === 'up', 'surges is up');
ok(tone('Gold prices rise as dollar slips') === 'up', 'rise is up');
ok(tone('Exchange hacked, millions stolen') === 'down', 'hacked is down');
ok(tone('Stocks plunge after the warning') === 'down', 'plunge is down');
ok(tone('Markets rally but regulator warns of a crash') === 'flat', 'mixed headline is flat');
ok(tone('Bangladesh central bank issues note') === 'flat', 'Bangladesh is not "ban"');
ok(tone('Enterprise adoption grows') === 'up', 'adoption is up');

ok(safeHttpUrl('https://example.com/a?b=1') === 'https://example.com/a?b=1', 'https link kept');
ok(safeHttpUrl('javascript:alert(1)') === '' && safeHttpUrl('tel:+123') === '' && safeHttpUrl('intent://x#Intent;end') === '' && safeHttpUrl('') === '', 'non-web links removed');

const xml = '<rss><channel><item><title>Fed holds rates, gold climbs higher</title><link>https://a.com/1</link><pubDate>Mon, 05 Oct 2026 10:00:00 GMT</pubDate></item><item><title>Evil story that links elsewhere</title><link>tel:+1900</link></item></channel></rss>';
const items = parseRss(xml, 'T');
ok(items.length === 2 && items[0].link === 'https://a.com/1' && items[1].link === '', 'feed items get safe links');
console.log(fails ? 'SOME FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
