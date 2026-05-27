"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signAccessToken = signAccessToken;
exports.signRefreshToken = signRefreshToken;
exports.verifyRefreshToken = verifyRefreshToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const crypto_1 = require("./crypto");
function signAccessToken(input) {
    const options = {
        subject: input.userId,
        expiresIn: env_1.env.ACCESS_TOKEN_EXPIRES_IN,
    };
    return jsonwebtoken_1.default.sign({ role: input.role }, env_1.env.JWT_SECRET, {
        ...options,
    });
}
function signRefreshToken(input) {
    const options = {
        subject: input.userId,
        expiresIn: `${env_1.env.REFRESH_TOKEN_EXPIRES_IN_DAYS}d`,
        jwtid: (0, crypto_1.randomToken)(16),
    };
    return jsonwebtoken_1.default.sign({ role: input.role }, env_1.env.JWT_REFRESH_SECRET, {
        ...options,
    });
}
function verifyRefreshToken(token) {
    return jsonwebtoken_1.default.verify(token, env_1.env.JWT_REFRESH_SECRET);
}
