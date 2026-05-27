"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventModel = void 0;
const mongoose_1 = require("mongoose");
const eventSchema = new mongoose_1.Schema({
    title: { type: String, required: true, trim: true },
    badge: { type: String, default: "Open", trim: true },
    image: { type: String, default: "" },
    dateLabel: { type: String, required: true, trim: true },
    format: { type: String, default: "", trim: true },
    prizePool: { type: String, default: "", trim: true },
    venue: { type: String, default: "", trim: true },
    filled: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 24, min: 1 },
    status: { type: String, enum: ["draft", "published", "completed"], default: "draft", index: true },
    isPublished: { type: Boolean, default: false, index: true },
    ownerId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", index: true },
}, { timestamps: true });
exports.EventModel = (0, mongoose_1.model)("Event", eventSchema);
