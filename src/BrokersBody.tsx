import React from 'react';
import DirectoryBody, { DirectoryCfg } from './DirectoryBody';
import { BROKERS } from './brokers';

// Forex Brokers: the list in src/brokers.ts shown by the shared directory page (src/DirectoryBody.tsx). Not ranked: the number is only the list order.
const CFG: DirectoryCfg = {
  items: BROKERS, ranked: false, noun: 'broker', nouns: 'brokers', icon: 'business-outline', listTitle: 'Forex Brokers',
  intro: `A forex broker gives you access to the currency market through a trading platform. Below are ${BROKERS.length} major brokers, each with a direct link to its official website. Check that a broker is licensed and available in your country before you open an account.`,
  chooseTitle: 'How to Choose a Forex Broker', chooseSub: 'Four checks to make before you fund an account.',
  checks: [
    { icon: 'shield-checkmark-outline', title: 'Check regulation', body: 'Look for a licence from a strong regulator, find the licence number on the broker’s site, and confirm which entity serves your country.' },
    { icon: 'pricetag-outline', title: 'Compare total costs', body: 'Spreads, commissions, swaps and fees for deposits, withdrawals and inactivity all add up. Compare them for the pairs you trade.' },
    { icon: 'desktop-outline', title: 'Test platform and execution', body: 'Open a demo account first. Check the platforms offered (MT4, MT5, cTrader or its own), order speed and the markets you need.' },
    { icon: 'wallet-outline', title: 'Review funding and support', body: 'Check deposit and withdrawal methods and times, account protections, and how quickly support answers a real question.' },
  ],
  disclaimer: 'The numbers show the order of this list and are not a ranking or a recommendation. Forex and CFD trading carries a high risk of losing money, and many retail accounts lose. Brokers differ by country, licence, fees and rules, which change over time, so confirm every detail on the broker’s official website. Links open external sites that we do not control.',
};
export default function BrokersBody({ w }: { w: number }) { return <DirectoryBody w={w} cfg={CFG} />; }
