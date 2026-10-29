import type { PropFirm } from './propFirms';
// Major forex brokers, in the order the site owner lists them. Edit this list to change the page: name + website. The number is the line number, not a ranking.
const LIST: [string, string][] = [
  ['Pepperstone', 'https://pepperstone.com'], ['IC Markets', 'https://www.icmarkets.com'], ['IG', 'https://www.ig.com'], ['OANDA', 'https://www.oanda.com'],
  ['FOREX.com', 'https://www.forex.com'], ['Interactive Brokers', 'https://www.interactivebrokers.com'], ['Saxo', 'https://www.home.saxo'], ['CMC Markets', 'https://www.cmcmarkets.com'],
  ['Swissquote', 'https://www.swissquote.com'], ['Plus500', 'https://www.plus500.com'], ['eToro', 'https://www.etoro.com'], ['AvaTrade', 'https://www.avatrade.com'],
  ['XTB', 'https://www.xtb.com'], ['FxPro', 'https://www.fxpro.com'], ['XM', 'https://www.xm.com'], ['Exness', 'https://www.exness.com'],
  ['HFM / HF Markets', 'https://www.hfm.com'], ['FP Markets', 'https://www.fpmarkets.com'], ['Vantage', 'https://www.vantagemarkets.com'], ['Tickmill', 'https://www.tickmill.com'],
  ['Admirals', 'https://admiralmarkets.com'], ['Eightcap', 'https://www.eightcap.com'], ['ACY Securities', 'https://www.acy.com'], ['FXCM', 'https://www.fxcm.com'],
  ['Capital.com', 'https://capital.com'], ['RoboForex', 'https://roboforex.com'], ['IronFX', 'https://www.ironfx.com'], ['Trade Nation', 'https://www.tradenation.com'],
  ['MultiBank Group', 'https://multibankfx.com'], ['City Index', 'https://www.cityindex.com'], ['tastyfx', 'https://www.tastyfx.com'], ['Charles Schwab', 'https://www.schwab.com'],
  ['Fusion Markets', 'https://fusionmarkets.com'], ['Dukascopy', 'https://www.dukascopy.com'], ['TMGM', 'https://www.tmgm.com'], ['FBS', 'https://fbs.com'],
  ['Just2Trade', 'https://just2trade.com'], ['Trading.com', 'https://www.trading.com'], ['ADSS', 'https://www.adss.com'], ['Evest', 'https://www.evest.com'],
  ['CFI', 'https://www.cfigroup.com'], ['EC Markets', 'https://www.ecmarkets.com'],
];
export const BROKERS: PropFirm[] = LIST.map(([name, url], i) => ({ rank: i + 1, name, url }));
