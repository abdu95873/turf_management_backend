"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentModel = void 0;
const mongoose_1 = require("mongoose");
const paymentSchema = new mongoose_1.Schema({
    bookingId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Booking", required: true, unique: true, index: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    provider: { type: String, enum: ["bkash", "sslcommerz", "manual"], required: true, index: true },
    status: { type: String, enum: ["initiated", "paid", "failed", "refunded"], default: "initiated", index: true },
    transactionId: { type: String, index: true },
    providerPaymentId: { type: String, index: true },
    gatewayPayload: { type: Object },
}, { timestamps: true });
exports.PaymentModel = (0, mongoose_1.model)("Payment", paymentSchema);
