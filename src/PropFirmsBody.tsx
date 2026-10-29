import React from 'react';
import DirectoryBody, { DirectoryCfg } from './DirectoryBody';
import { PROP_FIRMS } from './propFirms';

// Prop Firms: the ranked list (src/propFirms.ts) shown by the shared directory page (src/DirectoryBody.tsx).
const CFG: DirectoryCfg = {
  items: PROP_FIRMS, ranked: true, noun: 'prop firm', nouns: 'firms', icon: 'trophy-outline', listTitle: 'Prop Firms',
  intro: `A proprietary (prop) trading firm gives you a funded account after you pass its evaluation. Below are ${PROP_FIRMS.length} prop firms in ranked order, each with a direct link to its official website. Always read a firm’s current rules and fees on its own site before you pay.`,
  chooseTitle: 'How to Choose a Prop Firm', chooseSub: 'Four checks to make before you buy a challenge.',
  checks: [
    { icon: 'document-text-outline', title: 'Read the rules first', body: 'Profit target, daily and overall drawdown, time limits and banned strategies decide whether a challenge suits your style.' },
    { icon: 'cash-outline', title: 'Compare fees and payouts', body: 'Look at the challenge fee, any refund, the profit split, and how often and how fast payouts are made.' },
    { icon: 'desktop-outline', title: 'Check platforms and markets', body: 'Make sure your platform, pairs, metals, indices and crypto are offered, and what spreads and commissions apply.' },
    { icon: 'chatbubbles-outline', title: 'Test support and reputation', body: 'Read recent trader reviews, ask support a question before paying, and check who runs the firm.' },
  ],
  disclaimer: 'Rankings show the order chosen by Chart Reader and are not financial advice or a guarantee of any firm’s service or payouts. Prop firms charge fees, and trading carries a high risk of loss. Rules, prices and availability change, so confirm every detail on the firm’s official website. Links open external sites that we do not control.',
};
export default function PropFirmsBody({ w }: { w: number }) { return <DirectoryBody w={w} cfg={CFG} />; }
