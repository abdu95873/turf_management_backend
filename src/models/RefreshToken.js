"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefreshTokenModel = void 0;
const mongoose_1 = require("mongoose");
const refreshTokenSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null, index: true },
}, { timestamps: true });
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
exports.RefreshTokenModel = (0, mongoose_1.model)("RefreshToken", refreshTokenSchema);
