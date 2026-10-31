// Prop firms, in the order the site owner ranks them (rank 1 first). Edit this list to change the page: name + website.
export type PropFirm = { rank: number; name: string; url: string; note?: string };
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
/** filter by name, website or the short note; empty search returns everything */
export const searchFirms = (q: string, list: PropFirm[] = PROP_FIRMS) => { const s = q.trim().toLowerCase(); return s ? list.filter((f) => f.name.toLowerCase().includes(s) || domainOf(f.url).includes(s) || (f.note ?? '').toLowerCase().includes(s)) : list; };

// ---------- Featured, Compare and Guide data (edit here) ----------
/** Fields shown in the Compare table. Leave a field out and the page shows "Check website". Fill these from each firm's official site. */
export type FirmDetail = { tagline?: string; badge?: string; split?: string; maxFunding?: string; challenge?: string; drawdown?: string; platforms?: string; payouts?: string; fee?: string };
export const DETAILS: Record<string, FirmDetail> = {
  // Example: FTMO: { tagline: 'Two-step challenge', badge: 'Editor’s pick', split: '80-90%', platforms: 'MT4, MT5, cTrader' },
};
/** Featured firms, in display order (names must match the list above). */
export const FEATURED_NAMES = ['FTMO', 'The5ers', 'FXIFY', 'FundedNext', 'FundingPips', 'Alpha Capital Group'];
export const featuredFirms = () => FEATURED_NAMES.map((n) => PROP_FIRMS.find((f) => f.name === n)).filter(Boolean) as PropFirm[];
export const COMPARE_ROWS: { key: keyof FirmDetail | 'rank' | 'site'; label: string }[] = [
  { key: 'rank', label: 'Chart Reader rank' }, { key: 'site', label: 'Website' }, { key: 'challenge', label: 'Challenge types' }, { key: 'split', label: 'Profit split' },
  { key: 'maxFunding', label: 'Max funding' }, { key: 'drawdown', label: 'Drawdown rules' }, { key: 'platforms', label: 'Platforms' }, { key: 'payouts', label: 'Payouts' }, { key: 'fee', label: 'Challenge fee' },
];
export const MAX_COMPARE = 4;
/** toggle a firm in the compare selection (max 4) */
export const toggleCompare = (sel: string[], name: string) => (sel.includes(name) ? sel.filter((n) => n !== name) : sel.length >= MAX_COMPARE ? sel : [...sel, name]);

export type Guide = { id: string; tag: string; title: string; sub: string; icon: string; sections: { h: string; p: string }[]; top?: number };
export const GUIDES: Guide[] = [
  { id: 'choose', tag: 'Start here', title: 'How to Choose a Prop Firm', sub: 'Five checks before you pay for any challenge.', icon: 'compass-outline', sections: [
    { h: 'Read the rules first', p: 'Profit target, daily drawdown, overall drawdown, minimum trading days, time limits and banned strategies decide whether a challenge fits your style. A rule you break by accident ends the account.' },
    { h: 'Compare the real cost', p: 'Look at the challenge fee, whether it is refunded after your first payout, and what a retry costs. The cheapest first attempt is not always the cheapest way to get funded.' },
    { h: 'Check platforms and markets', p: 'Confirm your platform (MT4, MT5, cTrader or the firm’s own), your pairs, metals, indices and crypto, and what spreads and commissions apply on the evaluation account.' },
    { h: 'Understand payouts', p: 'Check the profit split, how often you can withdraw, how long payouts take, and which methods are supported. Read recent trader reviews about real payout experience.' },
    { h: 'Test support and reputation', p: 'Ask support a question before paying, see who runs the firm, and read recent independent reviews. Be careful with firms that only show screenshots of payouts.' },
  ] },
  { id: 'drawdown', tag: 'Rules', title: 'Drawdown Rules Explained', sub: 'Daily, overall, static and trailing drawdown in plain words.', icon: 'trending-down-outline', sections: [
    { h: 'Daily drawdown', p: 'The most you may lose in one day, measured from the day’s starting balance or equity. Firms differ on the reset time and on whether open floating loss counts.' },
    { h: 'Overall (max) drawdown', p: 'The most the account may fall below its start. Breaking it usually closes the account for good.' },
    { h: 'Static vs trailing', p: 'A static limit stays at a fixed level. A trailing limit moves up as your balance or equity grows, so it is stricter. Know which one your challenge uses before you size a trade.' },
    { h: 'Balance vs equity', p: 'Some firms measure drawdown on equity, which includes open trades. A trade that dips deep and recovers can still break an equity-based limit.' },
  ] },
  { id: 'types', tag: 'Basics', title: 'Challenge Types: 1-Step, 2-Step and Instant', sub: 'How each evaluation model works and who it suits.', icon: 'layers-outline', sections: [
    { h: '2-step evaluation', p: 'You pass two phases, each with its own profit target, then get the funded account. Targets are usually lower per phase and rules looser than 1-step.' },
    { h: '1-step evaluation', p: 'One phase with a single target, often with tighter drawdown rules. Faster to finish, less room for error.' },
    { h: 'Instant funding', p: 'You trade a funded account straight away with a smaller account size or stricter limits, often at a higher fee. No evaluation phase.' },
    { h: 'Which to pick', p: 'Pick the model whose targets and drawdown match how you really trade, not the one with the biggest account size.' },
  ] },
  { id: 'payouts', tag: 'Money', title: 'How Prop Firm Payouts Work', sub: 'Profit split, schedules, and what to verify.', icon: 'cash-outline', sections: [
    { h: 'Profit split', p: 'The share of profit you keep, for example a split quoted as a percentage. Some firms raise it as you scale.' },
    { h: 'Payout schedule', p: 'Firms set the first-payout wait and how often you can withdraw (weekly, biweekly, monthly or on demand). Read the minimum days and minimum profit rules.' },
    { h: 'Fee refunds', p: 'Some firms refund the challenge fee with your first payout. Confirm the exact condition on the firm’s site.' },
    { h: 'Verify before trusting', p: 'Look for recent, independent payout evidence, not only the firm’s own marketing.' },
  ] },
  { id: 'redflags', tag: 'Safety', title: 'Red Flags Before You Pay', sub: 'Warning signs worth a second look.', icon: 'warning-outline', sections: [
    { h: 'Vague or changing rules', p: 'Rules that are hard to find, contradict each other, or change after you buy.' },
    { h: 'Pressure and hype', p: 'Countdown timers, huge discounts that never end, or promises of guaranteed income.' },
    { h: 'Unclear company details', p: 'No clear company name, address or team, or support that will not answer plain questions.' },
    { h: 'Payout complaints', p: 'Many recent, specific complaints about delayed or denied payouts from independent sources.' },
  ] },
  { id: 'top10', tag: 'Shortlist', title: 'Chart Reader Top 10', sub: 'The ten highest-ranked firms in our list.', icon: 'trophy-outline', top: 10, sections: [
    { h: 'How to use this list', p: 'These are the first ten firms in our ranked order. Open each official website, read the current rules and fees, then use the Compare tab to line up your shortlist.' },
  ] },
];
