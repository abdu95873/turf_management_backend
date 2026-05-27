"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function required(name, fallback) {
    const value = process.env[name] ?? fallback;
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}
exports.env = {
    PORT: Number(process.env.PORT ?? 5000),
    MONGODB_URI: required("MONGODB_URI"),
    JWT_SECRET: required("JWT_SECRET"),
    JWT_REFRESH_SECRET: required("JWT_REFRESH_SECRET", process.env.JWT_SECRET),
    ACCESS_TOKEN_EXPIRES_IN: process.env.ACCESS_TOKEN_EXPIRES_IN ?? "15m",
    REFRESH_TOKEN_EXPIRES_IN_DAYS: Number(process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS ?? 30),
    EMAIL_VERIFY_TOKEN_EXPIRES_HOURS: Number(process.env.EMAIL_VERIFY_TOKEN_EXPIRES_HOURS ?? 24),
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER ?? "devlog",
    EMAIL_FROM: process.env.EMAIL_FROM ?? "no-reply@turf-management.local",
    APP_BASE_URL: process.env.APP_BASE_URL ?? "http://localhost:5173",
    SMTP_HOST: process.env.SMTP_HOST ?? "",
    SMTP_PORT: Number(process.env.SMTP_PORT ?? 587),
    SMTP_SECURE: process.env.SMTP_SECURE === "true",
    SMTP_USER: process.env.SMTP_USER ?? "",
    SMTP_PASS: process.env.SMTP_PASS ?? "",
    PAYMENT_PROVIDER_DEFAULT: process.env.PAYMENT_PROVIDER_DEFAULT ?? "sslcommerz",
    SSLCOMMERZ_SANDBOX_MODE: process.env.SSLCOMMERZ_SANDBOX_MODE === "true",
    SSLCOMMERZ_STORE_ID: process.env.SSLCOMMERZ_STORE_ID ?? "",
    SSLCOMMERZ_STORE_PASSWORD: process.env.SSLCOMMERZ_STORE_PASSWORD ?? "",
    SSLCOMMERZ_API_URL: process.env.SSLCOMMERZ_API_URL ?? "https://sandbox.sslcommerz.com",
    SSLCOMMERZ_WEBHOOK_SECRET: process.env.SSLCOMMERZ_WEBHOOK_SECRET ?? "",
    BACKEND_BASE_URL: process.env.BACKEND_BASE_URL ?? "http://localhost:5000",
    IDEMPOTENCY_TTL_HOURS: Number(process.env.IDEMPOTENCY_TTL_HOURS ?? 24),
    WEBHOOK_NONCE_TTL_MINUTES: Number(process.env.WEBHOOK_NONCE_TTL_MINUTES ?? 15),
    APP_TIMEZONE: process.env.APP_TIMEZONE ?? "Asia/Dhaka",
};
