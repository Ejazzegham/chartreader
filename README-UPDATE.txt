Chart Reader updates (copy into your project, keep the same folder paths, replace existing files)

src/PropFirmsBody.tsx        Prop Firms: Featured / Directory / Compare / Guide tabs
src/PropFirmsTabs.tsx        NEW - Featured, Compare and Guide tab content
src/propFirms.ts             Prop firm list + DETAILS, FEATURED_NAMES, GUIDES data
src/DirectoryBody.tsx        Exports shared pieces, optional noChoose / noPodium flags
src/PropFirmsHome.web.tsx    Website hero updated for the four tabs
src/ForexHoursBody.tsx       Forex Market Hours: BabyPips-style session table, UTC table, overlap table, FAQ

Then run: npx tsc --noEmit  and  npm run build:web
