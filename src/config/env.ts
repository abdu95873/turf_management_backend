import dotenv from "dotenv";

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  PORT: Number(process.env.PORT ?? 5000),
  MONGODB_URI: required("MONGODB_URI"),
  JWT_SECRET: required("JWT_SECRET"),
  JWT_REFRESH_SECRET: required("JWT_REFRESH_SECRET", process.env.JWT_SECRET),
  ACCESS_TOKEN_EXPIRES_IN: process.env.ACCESS_TOKEN_EXPIRES_IN ?? "15m",
  REFRESH_TOKEN_EXPIRES_IN_DAYS: Number(process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS ?? 30),
  EMAIL_VERIFY_TOKEN_EXPIRES_HOURS: Number(process.env.EMAIL_VERIFY_TOKEN_EXPIRES_HOURS ?? 24),
  EMAIL_PROVIDER: process.env.EMAIL_PROVIDER ?? "devlog",
  EMAIL_FROM: process.env.EMAIL_FROM ?? "no-reply@turf-management.local",
  APP_BASE_URL: process.env.APP_BASE_URL ?? "http://localhost:3000",
  SMTP_HOST: process.env.SMTP_HOST ?? "",
  SMTP_PORT: Number(process.env.SMTP_PORT ?? 587),
  SMTP_SECURE: process.env.SMTP_SECURE === "true",
  SMTP_USER: process.env.SMTP_USER ?? "",
  SMTP_PASS: process.env.SMTP_PASS ?? "",
  APP_TIMEZONE: process.env.APP_TIMEZONE ?? "Asia/Dhaka",
};
