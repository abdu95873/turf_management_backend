"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toMinutes = toMinutes;
exports.fromMinutes = fromMinutes;
exports.addMinutes = addMinutes;
exports.getTodayDateInTimezone = getTodayDateInTimezone;
exports.getCurrentMinutesInTimezone = getCurrentMinutesInTimezone;
exports.isSlotPast = isSlotPast;
function toMinutes(hhmm) {
    const [hh, mm] = hhmm.split(":").map(Number);
    return hh * 60 + mm;
}
function fromMinutes(totalMinutes) {
    const hh = Math.floor(totalMinutes / 60)
        .toString()
        .padStart(2, "0");
    const mm = (totalMinutes % 60).toString().padStart(2, "0");
    return `${hh}:${mm}`;
}
function addMinutes(time, duration) {
    return fromMinutes(toMinutes(time) + duration);
}
function getTodayDateInTimezone(timezone) {
    return new Date().toLocaleDateString("en-CA", { timeZone: timezone });
}
function getCurrentMinutesInTimezone(timezone) {
    const str = new Date().toLocaleTimeString("en-GB", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
    return toMinutes(str);
}
function isSlotPast(date, startTime, timezone) {
    if (!date || !startTime) {
        return false;
    }
    const today = getTodayDateInTimezone(timezone);
    if (date < today) {
        return true;
    }
    if (date > today) {
        return false;
    }
    return toMinutes(startTime) <= getCurrentMinutesInTimezone(timezone);
}
