"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookNonceModel = void 0;
const mongoose_1 = require("mongoose");
const webhookNonceSchema = new mongoose_1.Schema({
    provider: { type: String, enum: ["bkash", "sslcommerz"], required: true, index: true },
    nonce: { type: String, required: true },
    expiresAt: { type: Date, required: true },
}, { timestamps: true });
webhookNonceSchema.index({ provider: 1, nonce: 1 }, { unique: true });
webhookNonceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
exports.WebhookNonceModel = (0, mongoose_1.model)("WebhookNonce", webhookNonceSchema);
