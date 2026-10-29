// Prop firms, in the order the site owner ranks them (rank 1 first). Edit this list to change the page: name + website.
export type PropFirm = { rank: number; name: string; url: string };
const LIST: [string, string][] = [
  ['FTMO', 'https://ftmo.com'], ['The5ers', 'https://the5ers.com'], ['FXIFY', 'https://fxify.com'], ['FundedNext', 'https://fundednext.com'],
  ['FundingPips', 'https://fundingpips.com'], ['Alpha Capital Group', 'https://alphacapitalgroup.uk'], ['City Traders Imperium', 'https://citytradersimperium.com'],
  ['Funded Trading Plus', 'https://fundedtradingplus.com'], ['Maven Trading', 'https://maventrading.com'], ['Audacity Capital', 'https://audacitycapital.co.uk'],
  ['Blueberry Funded', 'https://blueberryfunded.com'], ['ThinkCapital', 'https://thinkcapital.com'], ['The Trading Pit', 'https://thetradingpit.com'],
  ['Instant Funding', 'https://instantfunding.io'], ['BrightFunded', 'https://brightfunded.com'], ['E8 Markets', 'https://e8markets.com'],
  ['AquaFunded', 'https://aquafunded.com'], ['Atmos Funded', 'https://atmosfunded.com'], ['BEM Funding', 'https://bemfunding.com'],
  ['Blue Guardian', 'https://blueguardian.com'], ['DNA Funded', 'https://dnafunded.com'], ['Hola Prime', 'https://holaprime.com'],
  ['Goat Funded Trader', 'https://goatfundedtrader.com'], ['QT Funded', 'https://qtfunded.com'], ['SabioTrade', 'https://sabiotrade.com'],
  ['iFunds', 'https://ifunds.io'], ['Evercrest Funding', 'https://evercrestfunding.com'], ['Fury Funded Traders', 'https://furyfundedtraders.com'],
  ['Moneta Funded', 'https://monetafunded.com'], ['Orion Funded', 'https://orionfunded.com'], ['TopOne Trader', 'https://toponetrader.com'],
  ['Olbios Markets', 'https://olbiosmarkets.com'], ['Upcomers', 'https://www.upcomers.com'], ['NP Financials', 'https://npfinancials.com.au'], ['Fidelcrest', 'https://fidelcrest.com'],
];
export const PROP_FIRMS: PropFirm[] = LIST.map(([name, url], i) => ({ rank: i + 1, name, url }));
/** website text without https:// and www. */
export const domainOf = (url: string) => url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
/** filter by name or website; empty search returns everything */
export const searchFirms = (q: string, list: PropFirm[] = PROP_FIRMS) => { const s = q.trim().toLowerCase(); return s ? list.filter((f) => f.name.toLowerCase().includes(s) || domainOf(f.url).includes(s)) : list; };
