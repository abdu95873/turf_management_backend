"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResourceModel = void 0;
const mongoose_1 = require("mongoose");
const resourceSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ["turf", "pool", "sports"], required: true, index: true },
    ownerId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    staffIds: [{ type: mongoose_1.Schema.Types.ObjectId, ref: "User" }],
    locationName: { type: String, required: true },
    location: {
        type: {
            type: String,
            enum: ["Point"],
            default: "Point",
        },
        coordinates: {
            type: [Number],
            required: true,
        },
    },
    facilities: [{ type: String }],
    images: [{ type: String }],
    pricePerHour: { type: Number, required: true, min: 0 },
    minimumBookingAmount: { type: Number, min: 0, default: 0 },
    commissionRate: { type: Number, min: 0, max: 100, default: null },
    isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true });
resourceSchema.index({ location: "2dsphere" });
exports.ResourceModel = (0, mongoose_1.model)("Resource", resourceSchema);
