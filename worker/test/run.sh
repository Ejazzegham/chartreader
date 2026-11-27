#!/bin/sh
# Starts the Worker locally (workerd), runs the end-to-end test, stops the Worker.
cd "$(dirname "$0")/.."
pkill -x workerd 2>/dev/null; pkill -f "wrangler.*dev" 2>/dev/null; sleep 1
rm -rf /tmp/wstate; printf 'IMPORT_SECRET=test-secret\nFIREBASE_JWK_URL=http://localhost:9911/\n' > .dev.vars
npx wrangler dev --port 8799 --local --persist-to /tmp/wstate > /tmp/wr.log 2>&1 &
WP=$!
for i in $(seq 1 30); do curl -s -m 2 localhost:8799/__ping >/dev/null && break; sleep 1; done
node test/e2e.js | tail -4
echo '--- background alarm log ---'
grep -a -E 'alerts |tick|Deriv|prices|scan' /tmp/wr.log | sed 's/\x1b\[[0-9;]*m//g' | cut -c1-160 | sort | uniq -c | head -12
pkill -x workerd 2>/dev/null; pkill -f "wrangler.*dev" 2>/dev/null; true
