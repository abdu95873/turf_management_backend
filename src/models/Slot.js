"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlotModel = void 0;
const mongoose_1 = require("mongoose");
const slotSchema = new mongoose_1.Schema({
    resourceId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Resource", required: true, index: true },
    date: { type: String, required: true, index: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    pricePerHour: { type: Number, min: 0 },
    status: {
        type: String,
        enum: ["available", "booked", "blocked"],
        default: "available",
        index: true,
    },
    blockedReason: { type: String },
    packageId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Package" },
    generatedByRule: { type: Boolean, default: false },
}, { timestamps: true });
slotSchema.index({ resourceId: 1, date: 1, startTime: 1 }, { unique: true });
slotSchema.index({ resourceId: 1, date: 1, status: 1 });
exports.SlotModel = (0, mongoose_1.model)("Slot", slotSchema);
