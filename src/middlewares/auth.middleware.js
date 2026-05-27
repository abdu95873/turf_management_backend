"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const roles_1 = require("../constants/roles");
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        res.status(401).json({ message: "Missing bearer token" });
        return;
    }
    const token = authHeader.replace("Bearer ", "");
    try {
        const payload = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
        req.user = {
            id: payload.sub,
            role: payload.role ?? roles_1.ROLES.USER,
        };
        next();
    }
    catch {
        res.status(401).json({ message: "Invalid or expired token" });
    }
}
