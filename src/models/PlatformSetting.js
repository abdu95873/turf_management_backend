"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformSettingModel = void 0;
const mongoose_1 = require("mongoose");
const platformSettingSchema = new mongoose_1.Schema({
    key: { type: String, required: true, unique: true, index: true },
    commissionRate: { type: Number, default: 10, min: 0, max: 100 },
}, { timestamps: true });
exports.PlatformSettingModel = (0, mongoose_1.model)("PlatformSetting", platformSettingSchema);
