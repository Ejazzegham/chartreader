"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.catFromId = exports.maxCandleAge = exports.fxMinutesToClose = exports.fxMinutesSinceOpen = exports.fxClosedAt = exports.fxWeekBoundsUtc = void 0;
exports.scheduleState = scheduleState;
exports.marketState = marketState;
exports.thinLiquidity = thinLiquidity;
const ict_1 = require("./ict");
const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// The forex week runs from Sunday 17:00 to Friday 17:00 New York time.
// That is 21:00 UTC in US summer time and 22:00 UTC in winter.
const fxWeekBoundsUtc = (d) => { const h = 22 - (0, ict_1.nyOffsetHours)(d); return { closeHour: h, openHour: h }; };
exports.fxWeekBoundsUtc = fxWeekBoundsUtc;
const fxClosedAt = (d) => {
    const day = d.getUTCDay(), h = d.getUTCHours() + d.getUTCMinutes() / 60, { closeHour, openHour } = (0, exports.fxWeekBoundsUtc)(d);
    return day === 6 || (day === 5 && h >= closeHour) || (day === 0 && h < openHour);
};
exports.fxClosedAt = fxClosedAt;
// Minutes since the forex week opened on Sunday (null at any other time) and minutes left before it closes on Friday.
const fxMinutesSinceOpen = (d) => {
    const { openHour } = (0, exports.fxWeekBoundsUtc)(d);
    return d.getUTCDay() === 0 && d.getUTCHours() >= openHour ? (d.getUTCHours() - openHour) * 60 + d.getUTCMinutes() : null;
};
exports.fxMinutesSinceOpen = fxMinutesSinceOpen;
const fxMinutesToClose = (d) => {
    const { closeHour } = (0, exports.fxWeekBoundsUtc)(d);
    if (d.getUTCDay() !== 5)
        return null;
    const m = closeHour * 60 - (d.getUTCHours() * 60 + d.getUTCMinutes());
    return m >= 0 ? m : null;
};
exports.fxMinutesToClose = fxMinutesToClose;
const reopenText = (d) => { const { openHour } = (0, exports.fxWeekBoundsUtc)(d); return `Sunday ${String(openHour).padStart(2, '0')}:00 UTC`; };
// Indices (Deriv stock indices) trade on weekdays only.
const indicesClosedAt = (d) => { const day = d.getUTCDay(); return day === 6 || day === 0 || (day === 5 && d.getUTCHours() + d.getUTCMinutes() / 60 >= 22 - (0, ict_1.nyOffsetHours)(d)); };
// The newest candle may be at most this old (seconds) before the feed is called stale.
const maxCandleAge = (gran) => Math.max(2 * gran + 120, 600);
exports.maxCandleAge = maxCandleAge;
// Which asset class a symbol id belongs to, from the id alone (the server has no symbol list).
const catFromId = (id, cat) => {
    if (cat === 'forex' || cat === 'crypto' || cat === 'deriv' || cat === 'indices')
        return cat;
    if (id.startsWith('frx'))
        return 'forex';
    if (id.startsWith('cry') || /^bn/i.test(id))
        return 'crypto';
    return 'deriv';
};
exports.catFromId = catFromId;
// Schedule only (no candles needed): used where only the symbol is known.
function scheduleState(id, cat, now) {
    const k = (0, exports.catFromId)(id, cat);
    if (k === 'forex' && (0, exports.fxClosedAt)(now))
        return { open: false, reason: `Forex and metals are closed for the weekend (${DAY[now.getUTCDay()]}).`, reopens: reopenText(now) };
    if (k === 'indices' && indicesClosedAt(now))
        return { open: false, reason: 'Stock indices are closed (weekend).', reopens: 'Monday' };
    return { open: true, reason: '' };
}
// Full check: schedule, the exchange's own "closed" flag (when the feed gives one) and fresh candles.
function marketState(c, gran, id, cat, now, flaggedClosed = false) {
    const s = scheduleState(id, cat, now);
    if (!s.open)
        return s;
    if (flaggedClosed)
        return { open: false, reason: 'The exchange reports this market as closed right now.' };
    if (!c.length)
        return { open: false, reason: 'No candles received.' };
    const age = now.getTime() / 1000 - c[c.length - 1].t;
    if (age > (0, exports.maxCandleAge)(gran)) {
        const h = age / 3600;
        return { open: false, reason: `No new candles for ${h >= 1 ? h.toFixed(h >= 10 ? 0 : 1) + ' h' : Math.round(age / 60) + ' min'}: the market is closed or the feed is not live.` };
    }
    return { open: true, reason: '' };
}
// Quiet windows around the weekly close / open: thin liquidity, gaps and wide spreads. No new alerts then.
function thinLiquidity(id, cat, now) {
    if ((0, exports.catFromId)(id, cat) !== 'forex')
        return null;
    const toClose = (0, exports.fxMinutesToClose)(now), since = (0, exports.fxMinutesSinceOpen)(now);
    if (toClose !== null && toClose <= 60)
        return 'Less than 1 hour before the weekly close: thin market, no new alerts.';
    if (since !== null && since <= 60)
        return 'The market just reopened: gaps and wide spreads, no alerts for the first hour.';
    return null;
}
