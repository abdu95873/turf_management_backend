"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdempotencyRecordModel = void 0;
const mongoose_1 = require("mongoose");
const idempotencyRecordSchema = new mongoose_1.Schema({
    key: { type: String, required: true, unique: true, index: true },
    scope: { type: String, required: true, index: true },
    requestHash: { type: String, required: true },
    statusCode: { type: Number, required: true },
    responseBody: { type: Object, required: true },
    expiresAt: { type: Date, required: true },
}, { timestamps: true });
idempotencyRecordSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
exports.IdempotencyRecordModel = (0, mongoose_1.model)("IdempotencyRecord", idempotencyRecordSchema);
