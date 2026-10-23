"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QUALITY = void 0;
// One place for every knob that decides WHICH setups the app calls a trade and HOW the entry is placed.
// No imports, so the server scanner and the backtest use exactly the same numbers.
//
//   minScore    a setup under this score is shown as "wait", never as a trade
//   tp1R        first target distance in R (risk units). Close to the entry = it is reached far more often.
//               After TP1 the stop moves to break-even, so a trade that reached TP1 cannot lose any more.
//   fillDepth   a limit order sits this share of the zone height inside the NEAR edge of the zone (not in the middle),
//               capped at fillCapAtr, so price only has to touch the zone to fill it
//   maxDistAtr  a zone farther than this from the price is not offered as a trade at all (it rarely fills)
//   nearAtr     a limit order is only a trade while the zone is at most this far from the price
//   adxMin      under this ADX the market is ranging and zone trades fail more often
//   requireHtf  the higher timeframe trend must agree (it is built from the candles when the screen does not pass one)
exports.QUALITY = {
    minScore: 75,
    tp1R: 1.0,
    fillDepth: 0.25,
    fillCapAtr: 0.3,
    maxDistAtr: 3,
    nearAtr: 1.0,
    adxMin: 20,
    requireHtf: true,
};
