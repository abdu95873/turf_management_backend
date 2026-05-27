"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserModel = void 0;
const mongoose_1 = require("mongoose");
const roles_1 = require("../constants/roles");
const userSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    passwordHash: { type: String },
    authProvider: {
        type: String,
        enum: ["local", "google"],
        default: "local",
        index: true,
    },
    googleId: { type: String, sparse: true, unique: true, index: true },
    emailVerified: { type: Boolean, default: false, index: true },
    emailVerificationTokenHash: { type: String, index: true },
    emailVerificationExpiresAt: { type: Date },
    role: {
        type: String,
        enum: Object.values(roles_1.ROLES),
        default: roles_1.ROLES.USER,
        index: true,
    },
    ownerId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });
exports.UserModel = (0, mongoose_1.model)("User", userSchema);
