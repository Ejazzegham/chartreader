import { parseRss, tone } from '../src/headlines';
const x = `<rss><channel><item><title><![CDATA[Bitcoin surges past $100k as ETF inflows jump - CoinDesk]]></title><link>https://a.com/1</link><pubDate>Sat, 03 Oct 2026 10:00:00 GMT</pubDate><description>&lt;p&gt;Big &amp;amp; bold&lt;/p&gt;</description><source url="x">CoinDesk</source></item><item><title>Short</title></item></channel></rss>`;
console.log(parseRss(x, 'Google News'), tone('Exchange hack drains $50M'));
