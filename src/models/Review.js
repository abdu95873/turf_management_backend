"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewModel = void 0;
const mongoose_1 = require("mongoose");
const reviewSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    resourceId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Resource", required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 1000 },
}, { timestamps: true });
reviewSchema.index({ userId: 1, resourceId: 1 }, { unique: true });
exports.ReviewModel = (0, mongoose_1.model)("Review", reviewSchema);
