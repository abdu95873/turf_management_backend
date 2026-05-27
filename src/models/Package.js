"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackageModel = void 0;
const mongoose_1 = require("mongoose");
const packageSchema = new mongoose_1.Schema({
    resourceId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Resource", required: true, index: true },
    sportType: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    durationMinutes: { type: Number, required: true, min: 15 },
    pricePerSlot: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true });
exports.PackageModel = (0, mongoose_1.model)("Package", packageSchema);
