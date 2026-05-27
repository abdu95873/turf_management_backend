"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDailySlots = generateDailySlots;
exports.generateSlotsRange = generateSlotsRange;
const Slot_1 = require("../models/Slot");
const Resource_1 = require("../models/Resource");
const time_1 = require("../utils/time");
async function generateDailySlots(input) {
    const { resourceId, date, startTime, endTime, durationMinutes } = input;
    const startMinutes = (0, time_1.toMinutes)(startTime);
    const endMinutes = (0, time_1.toMinutes)(endTime);
    if (endMinutes <= startMinutes || durationMinutes <= 0) {
        throw new Error("Invalid slot range or duration");
    }
    const resource = await Resource_1.ResourceModel.findById(resourceId).select("pricePerHour");
    const slotPrice = resource?.pricePerHour;
    const bulk = [];
    for (let current = startMinutes; current + durationMinutes <= endMinutes; current += durationMinutes) {
        const slotStart = `${Math.floor(current / 60).toString().padStart(2, "0")}:${(current % 60)
            .toString()
            .padStart(2, "0")}`;
        const slotEnd = (0, time_1.addMinutes)(slotStart, durationMinutes);
        bulk.push({
            updateOne: {
                filter: { resourceId, date, startTime: slotStart },
                update: {
                    $setOnInsert: {
                        resourceId,
                        date,
                        startTime: slotStart,
                        endTime: slotEnd,
                        pricePerHour: slotPrice,
                        status: "available",
                        generatedByRule: true,
                    },
                },
                upsert: true,
            },
        });
    }
    if (bulk.length === 0) {
        return 0;
    }
    const result = await Slot_1.SlotModel.bulkWrite(bulk, { ordered: false });
    return result.upsertedCount ?? 0;
}
function listDatesInclusive(startDate, endDate) {
    const dates = [];
    const current = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    if (Number.isNaN(current.getTime()) || Number.isNaN(end.getTime())) {
        throw new Error("Invalid start or end date");
    }
    if (end < current) {
        throw new Error("End date must be same or after start date");
    }
    const maxDays = 90;
    while (current <= end) {
        dates.push(current.toISOString().slice(0, 10));
        if (dates.length > maxDays) {
            throw new Error("Cannot generate slots for more than 90 days at once");
        }
        current.setDate(current.getDate() + 1);
    }
    return dates;
}
async function generateSlotsRange(input) {
    const dates = listDatesInclusive(input.startDate, input.endDate);
    let createdCount = 0;
    for (const date of dates) {
        createdCount += await generateDailySlots({
            resourceId: input.resourceId,
            date,
            startTime: input.startTime,
            endTime: input.endTime,
            durationMinutes: input.durationMinutes,
        });
    }
    return { createdCount, daysProcessed: dates.length };
}
