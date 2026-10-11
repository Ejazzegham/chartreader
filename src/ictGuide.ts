// "ICT Trading: A to Z" lessons shown inside the ICT method (src/screens/ICTLab.tsx).
// Own wording of the publicly taught ICT concepts (ICT = Inner Circle Trader, Michael J. Huddleston). Educational only, not financial advice.

export type IctLesson = { id: string; icon: string; title: string; blocks: { h?: string; p?: string; list?: string[] }[] };

export const ICT_GUIDE_INTRO = 'Educational content only. Not financial advice. Trading carries a high risk of loss. ICT concepts are interpretive: two traders can mark the same chart differently, and most retail traders lose money. An edge comes from strict rules, small risk and hundreds of reviewed trades, not from knowing the words. Test on a demo account first.';

export const ICT_LESSONS: IctLesson[] = [
  {
    id: 'what', icon: 'help-circle-outline', title: '1. What ICT is (and is not)',
    blocks: [
      { p: 'ICT means Inner Circle Trader, the teaching brand of Michael J. Huddleston. It is a discretionary price-action method, closely related to Smart Money Concepts (SMC).' },
      { p: 'Core idea: price is delivered by an algorithm (ICT calls it IPDA) that keeps doing two things. It seeks liquidity (clusters of resting stop orders above highs and below lows) and it rebalances inefficiencies (gaps left by fast one-sided moves).' },
      { h: 'The four questions', list: ['Where is price likely going?', 'Is it the right time?', 'Has liquidity been taken?', 'Where is the lowest-risk entry?'] },
    ],
  },
  {
    id: 'steps', icon: 'list-outline', title: '2. The whole method in 8 steps',
    blocks: [
      { list: [
        '1. Read the higher-timeframe (HTF) bias: bullish or bearish.',
        '2. Find the draw on liquidity: the level price is most likely heading to.',
        '3. Mark the liquidity pools and PD arrays (zones).',
        '4. Wait for the right time: a killzone.',
        '5. Wait for a liquidity sweep against your bias.',
        '6. Confirm with a market structure shift (MSS) and displacement.',
        '7. Enter on the pullback into a fair value gap, order block or OTE zone.',
        '8. Risk a small fixed percent, target the next liquidity pool, manage the trade, journal it.',
      ] },
      { p: 'The ICT tab runs exactly these steps on the live candles and shows each one as a yes / no question. Only when all 8 are "yes" does it say TRADE.' },
    ],
  },
  {
    id: 'structure', icon: 'trending-up-outline', title: '3. Market structure',
    blocks: [
      { list: [
        'Swing high / swing low: a candle high (low) with lower highs (higher lows) on both sides.',
        'Bullish structure: higher highs and higher lows. Bearish: lower highs and lower lows.',
        'BOS (break of structure): price closes beyond a swing point in the trend direction. It is a continuation.',
        'MSS / CHoCH (market structure shift): price breaks the swing point that was holding the opposite trend, usually with displacement. It is the first sign of a reversal.',
        'Displacement: a strong, fast, one-directional move of large-bodied candles that leaves gaps behind. It shows real participation. A break without displacement is weak.',
      ] },
    ],
  },
  {
    id: 'liquidity', icon: 'water-outline', title: '4. Liquidity',
    blocks: [
      { p: 'Liquidity means resting orders, mostly stop losses and breakout orders.' },
      { list: [
        'Buy-side liquidity (BSL): above swing highs, equal highs and previous day / week highs. Stops of short sellers and breakout buy orders sit here.',
        'Sell-side liquidity (SSL): below swing lows, equal lows and previous day / week lows.',
        'Equal highs / lows (EQH / EQL): two or more touches at nearly the same level. Very obvious targets.',
        'Key levels: previous day high / low (PDH / PDL), previous week high / low, Asian range high / low, London high / low, session opens.',
        'Liquidity sweep (stop run): price pokes through a level, takes the orders, then reverses. It is the trigger event for most ICT setups.',
        'Inducement: a minor, obvious level that lures traders in before the real move.',
      ] },
      { p: 'Rule: price moves from one liquidity pool to another. Internal liquidity (small highs and lows inside the range) is often taken first. External liquidity (the range high or low) is the bigger target.' },
    ],
  },
  {
    id: 'pd', icon: 'swap-vertical-outline', title: '5. Premium, discount and OTE',
    blocks: [
      { p: 'Take the current dealing range (a swing low to a swing high that matters) and draw the 50% line, the equilibrium.' },
      { list: ['Above 50% is premium: look to sell.', 'Below 50% is discount: look to buy.', 'OTE (optimal trade entry): the 62% to 79% retracement of the leg, with 70.5% as the sweet spot.'] },
      { p: 'Buying in premium or selling in discount goes against this logic and is a common mistake.' },
    ],
  },
  {
    id: 'arrays', icon: 'cube-outline', title: '6. PD arrays (where you enter)',
    blocks: [
      { list: [
        'Fair Value Gap (FVG): a three-candle pattern where the wicks of candle 1 and candle 3 do not overlap. Bullish: candle 1 high is below candle 3 low. Bearish: candle 1 low is above candle 3 high. Price tends to return into it. The midpoint is the consequent encroachment (CE).',
        'Order Block (OB): the last opposite candle before a displacement. Bullish OB = last down candle before a strong move up that breaks structure. Entry is usually the candle open or its 50% (mean threshold).',
        'Breaker Block: a failed order block. If a bullish OB is broken with displacement (often after a high was swept) it becomes a bearish breaker and acts as resistance when retested from below. Mirror for bullish.',
        'Unicorn: a breaker block that overlaps a fair value gap. Considered a higher-quality entry zone.',
        'Mitigation block, rejection block, liquidity void, balanced price range (BPR): related zones, study them on your charts.',
        'HTF arrays: weekly and daily gaps, order blocks and old highs / lows act as magnets and reaction zones for lower-timeframe trades.',
      ] },
      { p: 'A zone is stronger when it sits in the right half of the range (discount for longs), formed with displacement, and agrees with the HTF bias.' },
    ],
  },
  {
    id: 'time', icon: 'time-outline', title: '7. Time and price: killzones',
    blocks: [
      { p: 'ICT uses New York time (Eastern Time, with daylight saving). Time matters because liquidity is raided at specific moments. The app converts all windows to your phone time on the Killzones page.' },
      { list: [
        'Asian: 8:00 PM to 12:00 AM. Usually a quiet range that builds liquidity.',
        'London: 2:00 AM to 5:00 AM. Often forms the high or low of the day.',
        'New York AM: 7:00 AM to 10:00 AM. The most popular window (8:30 data, 9:30 stock open).',
        'London Close: 10:00 AM to 12:00 PM. Frequent retracements or reversals.',
        'New York PM: about 1:30 PM to 4:00 PM.',
        'Silver Bullet (one hour each): 3 to 4 AM, 10 to 11 AM and 2 to 3 PM New York time.',
      ] },
      { p: 'The midnight open (12:00 AM New York) and the 8:30 AM open are reference prices. On a bullish day look to buy below them; on a bearish day look to sell above them. Many ICT traders find Tuesday to Thursday the cleanest. Monday often builds the weekly range, and late Friday tends to be low quality.' },
      { h: 'Power of 3 (AMD)', p: 'Each day, week and session tends to move in three phases: Accumulation (range building, often Asia), Manipulation (a fake move against the real direction that sweeps liquidity, the Judas swing at the London or New York open) and Distribution (the real move toward the target liquidity).' },
    ],
  },
  {
    id: 'daily', icon: 'calendar-outline', title: '8. Your daily process',
    blocks: [
      { list: [
        'Step 1 Bias (weekly, daily, 4H): mark the previous week and day highs / lows and the big gaps and blocks. Is price in premium or discount? Which untouched liquidity is nearest above and below? That is the draw on liquidity. If the picture is mixed: no bias, no trade. Bias is a probability, not a prediction.',
        'Step 2 Levels (1H and 15m): PDH / PDL, Asian high / low, midnight open, equal highs / lows, untouched gaps and blocks in the direction of the draw.',
        'Step 3 Killzone: do nothing outside your chosen window. Pick one or two and master them.',
        'Step 4 Sweep: price takes a marked level against your bias, best of all into an HTF array.',
        'Step 5 MSS + displacement (5m or 1m): after the sweep price breaks a recent short-term swing point in your direction with a displacement candle. No MSS, no trade.',
        'Step 6 Entry zone: the gap left by the displacement, or the order block / breaker at the origin of the move. Best in discount (longs) or premium (shorts), inside OTE, supported by more than one tool.',
        'Step 7 Enter: aggressive = limit at the start of the gap or the block open. Standard = limit at the gap midpoint (CE). Conservative = wait for a lower-timeframe reaction inside the zone. If price runs away without retracing, do not chase.',
        'Step 8 Stop loss: beyond the swept extreme (the manipulation low for longs, high for shorts) or beyond the origin of the zone, plus a small buffer for spread. If the stop is too far for your risk, reduce the size or skip.',
        'Step 9 Targets: TP1 nearest internal liquidity (or 1R to 2R), take partial profit and move the stop to break-even. TP2 external liquidity (PDH / PDL, Asian high / low, equal highs / lows). Minimum reward-to-risk 1:2.',
        'Step 10 Manage: never move the stop further away. Trail behind new swing points. Close if the setup is invalidated (price closes beyond the displacement origin) or the killzone ends with no progress.',
        'Step 11 Journal: screenshot, bias, setup type, time, entry, stop, target, result in R, mistakes. Review every week.',
      ] },
    ],
  },
  {
    id: 'models', icon: 'git-network-outline', title: '9. Entry models',
    blocks: [
      { list: [
        'Liquidity sweep + MSS + FVG (the core model, ICT 2022 style): HTF bullish and price in discount, then killzone, then sell-side sweep, then MSS up with displacement, then retrace into the gap or block, stop under the sweep low, target buy-side liquidity. Shorts are the exact mirror.',
        'Silver Bullet: trade only inside the one-hour windows. Identify the draw, wait for a sweep or MSS, enter on the first gap retracement, target the next opposing liquidity. One clean trade per window.',
        'Order block / breaker entry: after a sweep and MSS, enter at the block (or the breaker if the block failed) using its 50% mean threshold, stop beyond the block.',
        'Unicorn: a breaker block overlapping a gap after the MSS. Enter at the overlap, stop beyond the breaker.',
        'Judas swing at the open: at the London or New York open expect a false move against the daily bias. Enter when it reverses with an MSS, target the other side of the range.',
        'SMT divergence (a filter): compare correlated markets (ES and NQ, EURUSD and GBPUSD, the dollar index). If one makes a new high or low and the other fails to, a reversal gains confidence. Use it as a filter, never alone.',
      ] },
      { p: 'The app builds models 1 to 5 from the candles. SMT divergence needs a second market, so check it yourself.' },
    ],
  },
  {
    id: 'risk', icon: 'shield-checkmark-outline', title: '10. Risk management',
    blocks: [
      { list: [
        'Risk 0.25% to 1% of the account per trade. Beginners: 0.5% or less.',
        'Daily loss limit about 2%, weekly about 4% to 5%. Stop trading when it is hit.',
        'Maximum 1 to 2 trades per session. Stop for the day after 2 losses in a row.',
        'Position size = (account x risk %) divided by (stop distance x value per point or pip). Example: $10,000 account, 1% risk = $100. EURUSD with a 20-pip stop and about $10 per pip per lot: 100 / (20 x 10) = 0.5 lot.',
        'Check spreads, commissions and slippage. Avoid major news (CPI, NFP, FOMC) unless you have a plan for it.',
        'Never average down, never remove a stop, never revenge trade.',
      ] },
      { p: 'The Risk page does the position-size maths for you. Tap "Send to Risk planner" under any setup.' },
    ],
  },
  {
    id: 'mind', icon: 'school-outline', title: '11. Psychology and training path',
    blocks: [
      { p: 'Expect to lose roughly 40% to 60% of trades even with a good model. The edge comes from reward-to-risk and discipline.' },
      { list: [
        '1. Learn the terms (about 2 weeks).',
        '2. Mark charts in replay mode daily (about 4 weeks).',
        '3. Backtest at least 100 trades in a spreadsheet.',
        '4. Demo trade for 1 to 3 months with the full rules.',
        '5. Go live at the smallest size.',
        '6. Scale slowly, only after consistent results.',
        'Pick one market (for example EURUSD, NQ or ES) and one model first. Use a fixed top-down: 4H / 1H for bias, 15m for zones, 5m / 1m for entry.',
      ] },
    ],
  },
  {
    id: 'mistakes', icon: 'warning-outline', title: '12. Common mistakes',
    blocks: [
      { list: ['Trading every gap or order block without a bias.', 'Entering before a sweep or MSS.', 'Ignoring premium and discount.', 'Trading outside killzones, or on every candle.', 'Using too many timeframes with no plan.', 'Moving stops, overtrading, oversizing.', 'Skipping the journal.'] },
    ],
  },
];

export const ICT_GLOSSARY: [string, string][] = [
  ['AMD', 'Accumulation, Manipulation, Distribution (Power of 3).'],
  ['BPR', 'Balanced Price Range: overlapping opposite fair value gaps.'],
  ['BSL / SSL', 'Buy-side / sell-side liquidity.'],
  ['CE', 'Consequent encroachment: the 50% level of a fair value gap.'],
  ['CHoCH / MSS', 'Change of character / market structure shift.'],
  ['Displacement', 'Strong impulsive move that shows intent.'],
  ['Draw on liquidity', 'The level price is attracted to.'],
  ['EQH / EQL', 'Equal highs / equal lows.'],
  ['FVG', 'Fair value gap: a three-candle imbalance.'],
  ['HTF / LTF', 'Higher / lower timeframe.'],
  ['Inducement', 'A minor level that baits traders.'],
  ['IPDA', 'Interbank Price Delivery Algorithm, ICT\'s model of how price is delivered.'],
  ['Judas swing', 'A false move at the session open.'],
  ['Killzone', 'A high-probability time window.'],
  ['Liquidity sweep', 'Price takes stops beyond a level, then reverses.'],
  ['Mean threshold', 'The 50% level of an order block or candle.'],
  ['NWOG / NDOG', 'New week / new day opening gap.'],
  ['OB', 'Order block.'],
  ['OTE', 'Optimal trade entry: 62% to 79% retracement.'],
  ['PD array', 'Premium / discount array: a zone where price may react.'],
  ['PDH / PDL', 'Previous day high / low.'],
  ['Silver Bullet', 'One-hour fair value gap trading windows.'],
  ['SMT', 'Smart money divergence between correlated markets.'],
  ['Unicorn', 'A breaker overlapping a fair value gap.'],
  ['Void', 'Liquidity void: an area with little two-sided trading.'],
];
