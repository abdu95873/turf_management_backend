"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManualPaymentTransactionModel = void 0;
const mongoose_1 = require("mongoose");
const manualPaymentTransactionSchema = new mongoose_1.Schema({
    bookingId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Booking", required: true, index: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    paymentMethodCode: { type: String, required: true, trim: true, lowercase: true, index: true },
    paymentMethodLabel: { type: String, required: true, trim: true },
    transactionId: { type: String, trim: true, index: true },
    note: { type: String, trim: true, maxlength: 300 },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    recordedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
    source: { type: String, enum: ["customer", "dashboard", "dashboard_confirm"], default: "customer" },
    reviewedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    reviewNote: { type: String, trim: true, maxlength: 300 },
}, { timestamps: true });
manualPaymentTransactionSchema.index({ bookingId: 1, createdAt: 1 });
manualPaymentTransactionSchema.index({ transactionId: 1, paymentMethodCode: 1 }, {
    unique: true,
    partialFilterExpression: { transactionId: { $type: "string", $ne: "" }, status: { $in: ["pending", "approved"] } },
});
exports.ManualPaymentTransactionModel = (0, mongoose_1.model)("ManualPaymentTransaction", manualPaymentTransactionSchema);
