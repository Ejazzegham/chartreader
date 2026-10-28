Settings page update - copy these 6 files over the same paths in your project (backup first):

  src/screens/Settings.tsx   new page (hero, profile, billing, trading, appearance, language, alerts, security, support)
  src/store.tsx              Settings type + DEFAULTS: added defTf and defMarket (2 lines)
  src/screens/Scanner.tsx    start timeframe = Settings default timeframe
  src/screens/Insight.tsx    same
  src/screens/CRAnalysis.tsx same
  src/screens/ICTLab.tsx     same

Then run: npm run web   (or: npm run build:web)
