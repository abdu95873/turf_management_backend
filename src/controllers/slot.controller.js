"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSlots = generateSlots;
exports.listSlots = listSlots;
exports.blockSlot = blockSlot;
exports.updateSlot = updateSlot;
exports.deleteSlot = deleteSlot;
const zod_1 = require("zod");
const Slot_1 = require("../models/Slot");
const slot_service_1 = require("../services/slot.service");
const env_1 = require("../config/env");
const time_1 = require("../utils/time");
const resourceOwnership_1 = require("../utils/resourceOwnership");
const generateSchema = zod_1.z
    .object({
    resourceId: zod_1.z.string(),
    date: zod_1.z.string().optional(),
    startDate: zod_1.z.string().optional(),
    endDate: zod_1.z.string().optional(),
    startTime: zod_1.z.string(),
    endTime: zod_1.z.string(),
    durationMinutes: zod_1.z.number().min(15).max(240),
})
    .superRefine((data, ctx) => {
    const hasSingleDate = Boolean(data.date);
    const hasRange = Boolean(data.startDate && data.endDate);
    if (!hasSingleDate && !hasRange) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "Provide date or both startDate and endDate",
            path: ["date"],
        });
    }
    if (hasSingleDate && hasRange) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "Use either date or a startDate/endDate range, not both",
            path: ["startDate"],
        });
    }
});
const blockSlotSchema = zod_1.z.object({
    slotId: zod_1.z.string(),
    reason: zod_1.z.string().min(2).max(100).optional(),
});
const updateSlotSchema = zod_1.z.object({
    startTime: zod_1.z.string(),
    endTime: zod_1.z.string(),
    status: zod_1.z.enum(["available", "blocked"]).optional(),
    pricePerHour: zod_1.z.number().nonnegative().optional(),
});
async function generateSlots(req, res) {
    const parsed = generateSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.flatten() });
        return;
    }
    const ownership = await (0, resourceOwnership_1.verifyResourceOwnership)(req, parsed.data.resourceId);
    if (!ownership.ok) {
        res.status(ownership.status).json({ message: ownership.message });
        return;
    }
    try {
        if (parsed.data.date) {
            const createdCount = await (0, slot_service_1.generateDailySlots)({
                resourceId: parsed.data.resourceId,
                date: parsed.data.date,
                startTime: parsed.data.startTime,
                endTime: parsed.data.endTime,
                durationMinutes: parsed.data.durationMinutes,
            });
            res.status(201).json({ createdCount, daysProcessed: 1 });
            return;
        }
        const result = await (0, slot_service_1.generateSlotsRange)({
            resourceId: parsed.data.resourceId,
            startDate: parsed.data.startDate,
            endDate: parsed.data.endDate,
            startTime: parsed.data.startTime,
            endTime: parsed.data.endTime,
            durationMinutes: parsed.data.durationMinutes,
        });
        res.status(201).json(result);
    }
    catch (error) {
        res.status(400).json({ message: error instanceof Error ? error.message : "Failed to generate slots" });
    }
}
async function listSlots(req, res) {
    const resourceId = String(req.query.resourceId ?? "");
    const date = String(req.query.date ?? "");
    if (!resourceId || !date) {
        res.status(400).json({ message: "resourceId and date are required" });
        return;
    }
    const slots = await Slot_1.SlotModel.find({ resourceId, date }).sort({ startTime: 1 });
    const timezone = env_1.env.APP_TIMEZONE;
    const visibleSlots = slots.filter((slot) => !(0, time_1.isSlotPast)(date, slot.startTime, timezone));
    res.json(visibleSlots);
}
async function blockSlot(req, res) {
    const parsed = blockSlotSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.flatten() });
        return;
    }
    const slot = await Slot_1.SlotModel.findById(parsed.data.slotId);
    if (!slot) {
        res.status(404).json({ message: "Slot not found or already booked" });
        return;
    }
    const ownership = await (0, resourceOwnership_1.verifyResourceOwnership)(req, String(slot.resourceId));
    if (!ownership.ok) {
        res.status(ownership.status).json({ message: ownership.message });
        return;
    }
    const updated = await Slot_1.SlotModel.findOneAndUpdate({ _id: parsed.data.slotId, status: { $in: ["available", "blocked"] } }, {
        $set: {
            status: "blocked",
            blockedReason: parsed.data.reason ?? "Blocked by owner/staff",
        },
    }, { new: true });
    if (!updated) {
        res.status(404).json({ message: "Slot not found or already booked" });
        return;
    }
    res.json(updated);
}
async function updateSlot(req, res) {
    const parsed = updateSlotSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.flatten() });
        return;
    }
    const slot = await Slot_1.SlotModel.findById(req.params.slotId);
    if (!slot) {
        res.status(404).json({ message: "Slot not found" });
        return;
    }
    const ownership = await (0, resourceOwnership_1.verifyResourceOwnership)(req, String(slot.resourceId));
    if (!ownership.ok) {
        res.status(ownership.status).json({ message: ownership.message });
        return;
    }
    if (slot.status === "booked") {
        res.status(400).json({ message: "Booked slot cannot be edited" });
        return;
    }
    slot.startTime = parsed.data.startTime;
    slot.endTime = parsed.data.endTime;
    if (parsed.data.status) {
        slot.status = parsed.data.status;
        if (parsed.data.status !== "blocked") {
            slot.blockedReason = undefined;
        }
    }
    if (typeof parsed.data.pricePerHour === "number") {
        slot.pricePerHour = parsed.data.pricePerHour;
    }
    try {
        await slot.save();
    }
    catch {
        res.status(409).json({ message: "Slot time conflict for this date/resource" });
        return;
    }
    res.json({ message: "Slot updated", slot });
}
async function deleteSlot(req, res) {
    const slot = await Slot_1.SlotModel.findById(req.params.slotId);
    if (!slot) {
        res.status(404).json({ message: "Slot not found" });
        return;
    }
    const ownership = await (0, resourceOwnership_1.verifyResourceOwnership)(req, String(slot.resourceId));
    if (!ownership.ok) {
        res.status(ownership.status).json({ message: ownership.message });
        return;
    }
    if (slot.status === "booked") {
        res.status(400).json({ message: "Booked slot cannot be deleted" });
        return;
    }
    await Slot_1.SlotModel.deleteOne({ _id: slot._id });
    res.json({ message: "Slot deleted successfully" });
}
