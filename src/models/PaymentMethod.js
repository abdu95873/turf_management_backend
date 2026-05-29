"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentMethodModel = void 0;
const mongoose_1 = require("mongoose");
const paymentMethodSchema = new mongoose_1.Schema({
    code: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    label: { type: String, required: true, trim: true },
    requiresTransactionId: { type: Boolean, default: true },
    active: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
}, { timestamps: true });
exports.PaymentMethodModel = (0, mongoose_1.model)("PaymentMethod", paymentMethodSchema);
