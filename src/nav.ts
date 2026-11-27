// One list for every page. Items with group 'hidden' are not in the menu: ICT Lab, Top-Down and Scanner now live inside the Analysis tab (index 1); their old slots just forward there. The tab index is the position in this list (App.tsx keeps the same order).
export type NavItem = { key: string; icon: string; group: 'main' | 'pro' | 'hidden'; desc: string };
export const NAV: NavItem[] = [
  { key: 'tabHome', icon: 'home', group: 'main', desc: 'navDescHome' },
  { key: 'tabScalp', icon: 'analytics', group: 'main', desc: 'navDescScalp' },
  { key: 'tabMarkets', icon: 'pulse', group: 'main', desc: 'navDescMarkets' },
  { key: 'tabJournal', icon: 'book', group: 'main', desc: 'navDescJournal' },
  { key: 'tabTools', icon: 'calculator', group: 'main', desc: 'navDescRisk' },
  { key: 'tabHistory', icon: 'time', group: 'main', desc: 'navDescHistory' },
  { key: 'tabSettings', icon: 'settings', group: 'main', desc: 'navDescSettings' },
  { key: 'tabIct', icon: 'git-network', group: 'hidden', desc: 'navDescIct' },
  { key: 'tabKillzones', icon: 'globe', group: 'pro', desc: 'navDescKz' },
  { key: 'tabEdge', icon: 'stats-chart', group: 'pro', desc: 'navDescEdge' }, // tab 9: Trade Edge = Trade Checklist + Performance on one page
  { key: 'tabTopDown', icon: 'layers', group: 'hidden', desc: 'navDescTopDown' },
  { key: 'tabChecklist', icon: 'shield-checkmark', group: 'hidden', desc: 'navDescChecklist' }, // tab 11: merged into Trade Edge (tab 9); this slot forwards there
  { key: 'tabScanner', icon: 'radio', group: 'hidden', desc: 'navDescScanner' },
  { key: 'tabNews', icon: 'newspaper', group: 'pro', desc: 'navDescNews' },
  { key: 'tabHelp', icon: 'help-circle', group: 'main', desc: 'navDescHelp' }, // tab 14: Help & About = How to use + About us on one page
  { key: 'tabAbout', icon: 'information-circle', group: 'hidden', desc: 'navDescAbout' }, // tab 15: merged into Help & About (tab 14); this slot forwards there
  { key: 'tabManual', icon: 'swap-vertical', group: 'hidden', desc: 'navDescManual' }, // Manual Trade: opened from Home (and from a pair's chart in Markets), not part of the menu
  { key: 'tabPropFirms', icon: 'briefcase', group: 'pro', desc: 'navDescPropFirms' }, // tab 17: added last so the older tab numbers stay the same
  { key: 'tabBrokers', icon: 'business', group: 'pro', desc: 'navDescBrokers' }, // tab 18: added last so older tab numbers stay the same
  { key: 'tabCrypto', icon: 'logo-bitcoin', group: 'pro', desc: 'navDescCrypto' }, // tab 19: added last so older tab numbers stay the same
  { key: 'tabCommunity', icon: 'people', group: 'main', desc: 'navDescCommunity' }, // tab 20: added last so older tab numbers stay the same
  { key: 'tabTradeHistory', icon: 'receipt', group: 'hidden', desc: 'navDescTradeHistory' }, // tab 21: Trade History as a page (website). Not in the menus (the "Trade History" entry opens it); the phone keeps its pop-up window
  { key: 'tabTradingView', icon: 'stats-chart', group: 'main', desc: 'navDescTradingView' }, // tab 22: the TradingView page, next to Markets in the website's top bar. Added last so older tab numbers stay the same
];
