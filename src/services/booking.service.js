"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBookingAtomic = createBookingAtomic;
const mongoose_1 = __importDefault(require("mongoose"));
const Booking_1 = require("../models/Booking");
const Package_1 = require("../models/Package");
const PlatformSetting_1 = require("../models/PlatformSetting");
const Resource_1 = require("../models/Resource");
const Slot_1 = require("../models/Slot");
const time_1 = require("../utils/time");
const env_1 = require("../config/env");
async function createBookingAtomic(input) {
    const session = await mongoose_1.default.startSession();
    try {
        return await session.withTransaction(async () => {
            const existing = await Booking_1.BookingModel.findOne({
                idempotencyKey: input.idempotencyKey,
            }).session(session);
            if (existing) {
                return existing;
            }
            const slot = await Slot_1.SlotModel.findOne({ _id: input.slotId, status: "available" }).session(session);
            if (!slot) {
                throw new Error("Slot unavailable or already booked");
            }
            if ((0, time_1.isSlotPast)(slot.date, slot.startTime, env_1.env.APP_TIMEZONE)) {
                throw new Error("This time slot has already passed");
            }
            await Slot_1.SlotModel.findOneAndUpdate({ _id: input.slotId, status: "available" }, { $set: { status: "booked" } }, { new: true, session });
            const resource = await Resource_1.ResourceModel.findById(slot.resourceId).session(session);
            if (!resource) {
                throw new Error("Resource not found");
            }
            let amount = slot.pricePerHour ?? resource.pricePerHour;
            if (slot.packageId) {
                const pkg = await Package_1.PackageModel.findById(slot.packageId).session(session);
                if (pkg) {
                    amount = pkg.pricePerSlot;
                }
            }
            const minimumAmount = resource.minimumBookingAmount ?? 0;
            if (minimumAmount > 0 && amount < minimumAmount) {
                throw new Error(`Booking amount must be at least ${minimumAmount} BDT`);
            }
            const settings = await PlatformSetting_1.PlatformSettingModel.findOne({ key: "default" }).session(session);
            const globalRate = settings?.commissionRate ?? 10;
            const rate = resource.commissionRate != null ? resource.commissionRate : globalRate;
            const commission = Math.round((amount * rate) / 100);
            const booking = await Booking_1.BookingModel.create([
                {
                    userId: input.userId,
                    resourceId: slot.resourceId,
                    slotId: slot._id,
                    bookingDate: slot.date,
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                    amount,
                    commission,
                    bookingStatus: "pending",
                    paymentStatus: "manual_pending",
                    idempotencyKey: input.idempotencyKey,
                },
            ], { session });
            return booking[0];
        });
    }
    finally {
        await session.endSession();
    }
}
