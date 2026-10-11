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
  { key: 'tabKillzones', icon: 'alarm', group: 'pro', desc: 'navDescKz' },
  { key: 'tabPerf', icon: 'stats-chart', group: 'pro', desc: 'navDescPerf' },
  { key: 'tabTopDown', icon: 'layers', group: 'hidden', desc: 'navDescTopDown' },
  { key: 'tabChecklist', icon: 'shield-checkmark', group: 'pro', desc: 'navDescChecklist' },
  { key: 'tabScanner', icon: 'radio', group: 'hidden', desc: 'navDescScanner' },
  { key: 'tabNews', icon: 'newspaper', group: 'pro', desc: 'navDescNews' },
  { key: 'tabGuide', icon: 'help-circle', group: 'main', desc: 'navDescGuide' },
  { key: 'tabAbout', icon: 'information-circle', group: 'main', desc: 'navDescAbout' },
];
