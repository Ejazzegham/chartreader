import type { PropFirm } from './propFirms';
// Crypto exchanges: centralized (CEX) and decentralized (DEX), in the order the site owner lists them. Edit these lists to change the page: name, website, one short "known for" line.
// The number is the line number, not a ranking.
const make = (l: [string, string, string][]): PropFirm[] => l.map(([name, url, note], i) => ({ rank: i + 1, name, url, note }));

export const CEX: PropFirm[] = make([
  ['Binance', 'https://www.binance.com', 'Largest global liquidity and trading volume; spot, futures, earn and Web3 tools.'],
  ['Coinbase', 'https://www.coinbase.com', 'Beginner-friendly, publicly listed, strong regulatory focus; popular in the U.S.'],
  ['Kraken', 'https://www.kraken.com', 'Security, compliance, and broad spot and futures trading.'],
  ['OKX', 'https://www.okx.com', 'Advanced trading, derivatives, APIs, and an integrated Web3 wallet.'],
  ['Bybit', 'https://www.bybit.com', 'Major derivatives and perpetuals exchange with a fast trading interface.'],
  ['Bitget', 'https://www.bitget.com', 'Copy trading, derivatives, and broad token coverage.'],
  ['Gate', 'https://www.gate.com', 'Very large token and trading-pair catalog.'],
  ['KuCoin', 'https://www.kucoin.com', 'Altcoin discovery, trading bots, and extensive listings.'],
  ['MEXC', 'https://www.mexc.com', 'New listings, large altcoin selection, and promotional low fees.'],
  ['Crypto.com', 'https://crypto.com', 'Mobile-first app, cards, rewards, and spot trading.'],
  ['Gemini', 'https://www.gemini.com', 'U.S.-focused, compliance-oriented exchange.'],
  ['Bitstamp', 'https://www.bitstamp.net', 'Long-established, regulation-focused exchange; now part of Robinhood.'],
  ['HTX', 'https://www.htx.com', 'Major global exchange, formerly Huobi.'],
  ['Upbit', 'https://upbit.com', 'South Korea’s leading exchange, primarily KRW markets.'],
  ['Bithumb', 'https://www.bithumb.com', 'Major South Korean exchange.'],
  ['Coinone', 'https://coinone.co.kr', 'South Korean exchange.'],
  ['Bitfinex', 'https://www.bitfinex.com', 'Advanced professional trading and deep order books.'],
  ['Poloniex', 'https://poloniex.com', 'Established altcoin exchange.'],
  ['LBank', 'https://www.lbank.com', 'Altcoin listings and global spot trading.'],
  ['Bitrue', 'https://www.bitrue.com', 'Altcoins, yield products, and XRP-focused markets.'],
  ['CoinEx', 'https://www.coinex.com', 'Global spot exchange with broad pair coverage.'],
  ['Pionex', 'https://www.pionex.com', 'Built-in trading bots and automated strategies.'],
  ['BingX', 'https://bingx.com', 'Copy trading and derivatives.'],
  ['BitMart', 'https://www.bitmart.com', 'Large token listings and global spot trading.'],
  ['XT', 'https://www.xt.com', 'Broad altcoin and derivatives markets.'],
  ['Toobit', 'https://www.toobit.com', 'Emerging derivatives-focused exchange.'],
  ['WhiteBIT', 'https://whitebit.com', 'European-focused exchange with spot and futures.'],
  ['Phemex', 'https://phemex.com', 'Derivatives and spot trading.'],
  ['Deribit', 'https://www.deribit.com', 'Leading crypto options and futures exchange.'],
  ['Hyperliquid', 'https://hyperliquid.xyz', 'On-chain perpetuals DEX with strong derivatives activity.'],
]);

export const DEX: PropFirm[] = make([
  ['Uniswap', 'https://app.uniswap.org', 'Largest Ethereum-based automated market maker.'],
  ['PancakeSwap', 'https://pancakeswap.finance', 'BNB Chain DEX and multichain swaps.'],
  ['Curve', 'https://curve.fi', 'Stablecoin and like-asset swaps.'],
  ['Raydium', 'https://raydium.io', 'Solana DEX and liquidity protocol.'],
  ['Jupiter', 'https://jup.ag', 'Solana swap aggregator.'],
  ['1inch', 'https://app.1inch.io', 'Multi-chain DEX aggregator.'],
  ['dYdX', 'https://dydx.trade', 'Decentralized perpetuals trading.'],
  ['GMX', 'https://gmx.io', 'Decentralized spot and perpetual trading.'],
  ['SushiSwap', 'https://www.sushi.com', 'Multichain DEX and DeFi platform.'],
  ['Orca', 'https://www.orca.so', 'Solana DEX with concentrated liquidity.'],
]);
