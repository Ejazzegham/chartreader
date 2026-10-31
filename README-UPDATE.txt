Chart Reader updates (copy into your project, keep the same folder paths, replace existing files)

-- Demo Trade page: full demo account (new) --
src/demoAccount.ts                      NEW  account maths: balance stats, win/loss, profit factor, drawdown, streaks
src/useDemoAcct.ts                      NEW  saves account name, starting balance, leverage, reset point on this device
src/DemoAccountPanel.tsx                NEW  KPI strip + tabbed panel (Overview, Performance, By Symbol, Settings)
src/screens/ManualTradeDesk.web.tsx     UPDATED  uses the account settings, adds the strip and the panel
tests/demoaccount.test.ts               NEW  unit tests

-- Prop Firms page --
src/PropFirmsBody.tsx, src/PropFirmsTabs.tsx (new), src/propFirms.ts, src/DirectoryBody.tsx, src/PropFirmsHome.web.tsx

-- Forex Market Hours page --
src/ForexHoursBody.tsx

Then run: npx tsc --noEmit  and  npm run build:web
