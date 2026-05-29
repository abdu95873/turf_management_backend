"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingModel = void 0;
const mongoose_1 = require("mongoose");
const bookingSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    isWalkIn: { type: Boolean, default: false, index: true },
    guestName: { type: String, trim: true, maxlength: 80 },
    guestPhone: { type: String, trim: true, maxlength: 20 },
    resourceId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Resource", required: true, index: true },
    slotId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Slot", required: true, unique: true, index: true },
    bookingDate: { type: String, required: true, index: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    commission: { type: Number, default: 0, min: 0 },
    bookingStatus: {
        type: String,
        enum: ["pending", "confirmed", "cancelled", "refunded", "no_show"],
        default: "pending",
        index: true,
    },
    paymentStatus: {
        type: String,
        enum: ["pending", "paid", "failed", "refunded", "manual_pending", "partial_paid", "awaiting_approval"],
        default: "manual_pending",
        index: true,
    },
    paymentMethod: {
        type: String,
        enum: ["manual", "bkash", "sslcommerz"],
        default: "manual",
        index: true,
    },
    manualTransactionId: { type: String, trim: true, index: true },
    manualPaymentNote: { type: String, trim: true, maxlength: 300 },
    manualSubmittedAt: { type: Date },
    manualReviewNote: { type: String, trim: true, maxlength: 300 },
    idempotencyKey: { type: String, required: true, unique: true, index: true },
}, { timestamps: true });
bookingSchema.index({ userId: 1, createdAt: -1 });
exports.BookingModel = (0, mongoose_1.model)("Booking", bookingSchema);
