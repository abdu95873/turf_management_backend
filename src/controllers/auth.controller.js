"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.googleAuthPlaceholder = googleAuthPlaceholder;
exports.refreshAccessToken = refreshAccessToken;
exports.logout = logout;
exports.sendEmailVerificationToken = sendEmailVerificationToken;
exports.verifyEmail = verifyEmail;
exports.getMe = getMe;
const zod_1 = require("zod");
const env_1 = require("../config/env");
const roles_1 = require("../constants/roles");
const RefreshToken_1 = require("../models/RefreshToken");
const User_1 = require("../models/User");
const email_service_1 = require("../services/email.service");
const crypto_1 = require("../utils/crypto");
const jwt_1 = require("../utils/jwt");
const password_1 = require("../utils/password");
const userQuery_1 = require("../utils/userQuery");
const registerSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    role: zod_1.z.enum([roles_1.ROLES.USER, roles_1.ROLES.OWNER]).optional(),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
});
const googleSchema = zod_1.z.object({
    googleId: zod_1.z.string().min(3),
    email: zod_1.z.string().email(),
    name: zod_1.z.string().min(2),
});
const refreshSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(20),
});
const logoutSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(20),
});
const verifyEmailSchema = zod_1.z.object({
    token: zod_1.z.string().min(10),
});
function serializeAuthUser(user) {
    const payload = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
    };
    if (user.ownerId) {
        payload.ownerId = String(user.ownerId);
    }
    return payload;
}
function buildAuthPayload(user) {
    const accessToken = (0, jwt_1.signAccessToken)({ userId: user.id, role: user.role });
    const refreshToken = (0, jwt_1.signRefreshToken)({ userId: user.id, role: user.role });
    return { accessToken, refreshToken };
}
async function persistRefreshToken(userId, refreshToken) {
    await RefreshToken_1.RefreshTokenModel.create({
        userId,
        tokenHash: (0, crypto_1.sha256)(refreshToken),
        expiresAt: new Date(Date.now() + env_1.env.REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000),
    });
}
async function register(req, res) {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.flatten() });
        return;
    }
    const email = parsed.data.email.trim().toLowerCase();
    const exists = await User_1.UserModel.findOne({ email });
    if (exists) {
        res.status(409).json({ message: "Email already in use" });
        return;
    }
    const passwordHash = await (0, password_1.hashPassword)(parsed.data.password);
    const user = await User_1.UserModel.create({
        name: parsed.data.name,
        email,
        passwordHash,
        role: parsed.data.role ?? roles_1.ROLES.USER,
        authProvider: "local",
    });
    const { accessToken, refreshToken } = buildAuthPayload({ id: user.id, role: user.role });
    await persistRefreshToken(user.id, refreshToken);
    res.status(201).json({
        accessToken,
        refreshToken,
        user: serializeAuthUser(user),
    });
}
async function login(req, res) {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.flatten() });
        return;
    }
    const email = parsed.data.email.trim().toLowerCase();
    const user = await User_1.UserModel.findOne((0, userQuery_1.activeUserFilter)({ email }));
    if (!user || !user.passwordHash) {
        res.status(401).json({ message: "Invalid credentials" });
        return;
    }
    const matched = await (0, password_1.comparePassword)(parsed.data.password, user.passwordHash);
    if (!matched) {
        res.status(401).json({ message: "Invalid credentials" });
        return;
    }
    const { accessToken, refreshToken } = buildAuthPayload({ id: user.id, role: user.role });
    await persistRefreshToken(user.id, refreshToken);
    res.json({
        accessToken,
        refreshToken,
        user: serializeAuthUser(user),
    });
}
async function googleAuthPlaceholder(req, res) {
    const parsed = googleSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.flatten() });
        return;
    }
    // Placeholder: integrate real Google token verification in Phase 2.
    let user = await User_1.UserModel.findOne({ $or: [{ googleId: parsed.data.googleId }, { email: parsed.data.email }] });
    if (!user) {
        user = await User_1.UserModel.create({
            name: parsed.data.name,
            email: parsed.data.email.toLowerCase(),
            googleId: parsed.data.googleId,
            authProvider: "google",
            role: roles_1.ROLES.USER,
        });
    }
    else if (!user.googleId) {
        user.googleId = parsed.data.googleId;
        user.authProvider = "google";
        await user.save();
    }
    const { accessToken, refreshToken } = buildAuthPayload({ id: user.id, role: user.role });
    await persistRefreshToken(user.id, refreshToken);
    res.json({
        accessToken,
        refreshToken,
        user: serializeAuthUser(user),
        warning: "Google token verification is not implemented yet.",
    });
}
async function refreshAccessToken(req, res) {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.flatten() });
        return;
    }
    const incomingToken = parsed.data.refreshToken;
    const tokenHash = (0, crypto_1.sha256)(incomingToken);
    const tokenDoc = await RefreshToken_1.RefreshTokenModel.findOne({ tokenHash, revokedAt: null });
    if (!tokenDoc) {
        res.status(401).json({ message: "Invalid refresh token" });
        return;
    }
    if (tokenDoc.expiresAt.getTime() < Date.now()) {
        res.status(401).json({ message: "Refresh token expired" });
        return;
    }
    try {
        const payload = (0, jwt_1.verifyRefreshToken)(incomingToken);
        const user = await User_1.UserModel.findOne((0, userQuery_1.activeUserFilter)({ _id: payload.sub }));
        if (!user) {
            res.status(401).json({ message: "User not found or inactive" });
            return;
        }
        tokenDoc.revokedAt = new Date();
        await tokenDoc.save();
        const { accessToken, refreshToken } = buildAuthPayload({ id: user.id, role: user.role });
        await persistRefreshToken(user.id, refreshToken);
        res.json({
            accessToken,
            refreshToken,
            user: serializeAuthUser(user),
        });
    }
    catch {
        res.status(401).json({ message: "Invalid refresh token" });
    }
}
async function logout(req, res) {
    const parsed = logoutSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.flatten() });
        return;
    }
    const tokenHash = (0, crypto_1.sha256)(parsed.data.refreshToken);
    await RefreshToken_1.RefreshTokenModel.findOneAndUpdate({ tokenHash, revokedAt: null }, { $set: { revokedAt: new Date() } });
    res.json({ message: "Logged out successfully" });
}
async function sendEmailVerificationToken(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const user = await User_1.UserModel.findById(req.user.id);
    if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
    }
    if (user.emailVerified) {
        res.json({ message: "Email already verified" });
        return;
    }
    const token = (0, crypto_1.randomToken)(24);
    user.emailVerificationTokenHash = (0, crypto_1.sha256)(token);
    user.emailVerificationExpiresAt = new Date(Date.now() + env_1.env.EMAIL_VERIFY_TOKEN_EXPIRES_HOURS * 60 * 60 * 1000);
    await user.save();
    await (0, email_service_1.sendVerificationEmail)({
        to: user.email,
        name: user.name,
        verificationToken: token,
    });
    res.json({
        message: "Verification email sent",
    });
}
async function getMe(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const user = await User_1.UserModel.findOne((0, userQuery_1.activeUserFilter)({ _id: req.user.id })).select("name email role ownerId");
    if (!user) {
        res.status(401).json({ message: "User not found or inactive" });
        return;
    }
    res.json({
        user: serializeAuthUser(user),
    });
}
async function verifyEmail(req, res) {
    const parsed = verifyEmailSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.flatten() });
        return;
    }
    const tokenHash = (0, crypto_1.sha256)(parsed.data.token);
    const user = await User_1.UserModel.findOne({
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpiresAt: { $gt: new Date() },
    });
    if (!user) {
        res.status(400).json({ message: "Invalid or expired verification token" });
        return;
    }
    user.emailVerified = true;
    user.emailVerificationTokenHash = undefined;
    user.emailVerificationExpiresAt = undefined;
    await user.save();
    res.json({ message: "Email verified successfully" });
}
