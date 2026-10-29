import React, { useState } from 'react';
import { View } from 'react-native';
import DirectoryBody, { DirectoryCfg, Chip, usePal } from './DirectoryBody';
import { CEX, DEX } from './cryptoExchanges';

// Crypto Exchanges: two lists (src/cryptoExchanges.ts) on the shared directory page, chosen with a switch at the top. Not ranked: the number is only the list order.
const RISK = 'Crypto assets are very volatile and you can lose all the money you put in. The numbers show the order of this list and are not a ranking or a recommendation, and the short descriptions are summaries that can go out of date. Availability, fees and rules differ by country and change over time, so confirm every detail on the official website. Type the address yourself or use the links here: fake copies of exchange sites exist. Links open external sites that we do not control.';
const CFGS: Record<'cex' | 'dex', DirectoryCfg> = {
  cex: {
    items: CEX, ranked: false, noun: 'exchange', nouns: 'exchanges', icon: 'logo-bitcoin', listTitle: 'Centralized Exchanges',
    intro: `A centralized exchange (CEX) is a company that holds your coins, matches buyers and sellers, and lets you deposit and withdraw. Below are ${CEX.length} major exchanges with a short note on what each is known for and a direct link to its official website. Check that an exchange is available in your country before you sign up.`,
    chooseTitle: 'How to Choose an Exchange', chooseSub: 'Four checks to make before you deposit.',
    checks: [
      { icon: 'lock-closed-outline', title: 'Check security', body: 'Look for two-factor login, withdrawal protections, published proof of reserves and a clear record of how past incidents were handled.' },
      { icon: 'shield-checkmark-outline', title: 'Check regulation and access', body: 'Confirm the exchange is licensed or allowed where you live, and read its rules on identity checks and withdrawals.' },
      { icon: 'pricetag-outline', title: 'Compare fees and liquidity', body: 'Maker and taker fees, spreads, deposit and withdrawal fees and order-book depth all affect what you really pay.' },
      { icon: 'apps-outline', title: 'Match products and listings', body: 'Make sure it offers the coins, futures, options or tools you need, and which payment methods it supports.' },
    ],
    disclaimer: RISK,
  },
  dex: {
    items: DEX, ranked: false, noun: 'DEX', nouns: 'DEXs', icon: 'swap-horizontal-outline', listTitle: 'Decentralized Exchanges',
    intro: `A decentralized exchange (DEX) runs on smart contracts, so you trade straight from your own wallet without handing coins to a company. Below are ${DEX.length} leading DEXs with a short note on each and a link to its official site. You pay network fees and carry smart-contract risk yourself.`,
    chooseTitle: 'How to Use a DEX Safely', chooseSub: 'Four checks to make before you connect a wallet.',
    checks: [
      { icon: 'link-outline', title: 'Verify the address', body: 'Use the official link, never a search ad or a link from a message. Fake DEX sites copy real ones to drain wallets.' },
      { icon: 'git-network-outline', title: 'Match chain and wallet', body: 'Each DEX works on certain blockchains. Pick the right network and keep a small amount in the wallet you connect.' },
      { icon: 'trending-down-outline', title: 'Watch liquidity and slippage', body: 'Thin pools move the price against you. Check the price impact and set a slippage limit before you confirm.' },
      { icon: 'key-outline', title: 'Limit approvals', body: 'Approve only the amount you need and review old token approvals from time to time. Contracts can have bugs, and losses are rarely recoverable.' },
    ],
    disclaimer: RISK,
  },
};

export default function CryptoBody({ w }: { w: number }) {
  const P = usePal();
  const [kind, setKind] = useState<'cex' | 'dex'>('cex');
  return (
    <View style={{ gap: 20 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole={'radiogroup' as any}>
        <Chip P={P} label={`Centralized exchanges · ${CEX.length}`} on={kind === 'cex'} onPress={() => setKind('cex')} />
        <Chip P={P} label={`Decentralized exchanges · ${DEX.length}`} on={kind === 'dex'} onPress={() => setKind('dex')} />
      </View>
      <DirectoryBody key={kind} w={w} cfg={CFGS[kind]} />
    </View>
  );
}
