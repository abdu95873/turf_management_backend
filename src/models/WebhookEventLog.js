"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookEventLogModel = void 0;
const mongoose_1 = require("mongoose");
const webhookEventLogSchema = new mongoose_1.Schema({
    provider: { type: String, enum: ["bkash", "sslcommerz"], required: true, index: true },
    eventType: { type: String, required: true, index: true },
    eventId: { type: String, required: true, unique: true, index: true },
    signatureValid: { type: Boolean, required: true },
    nonceUsed: { type: String },
    processingStatus: { type: String, enum: ["accepted", "duplicate", "rejected", "failed"], required: true, index: true },
    message: { type: String },
    payload: { type: Object },
}, { timestamps: true });
exports.WebhookEventLogModel = (0, mongoose_1.model)("WebhookEventLog", webhookEventLogSchema);
