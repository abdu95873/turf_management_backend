"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendVerificationEmail = sendVerificationEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_1 = require("../config/env");
class SmtpEmailProvider {
    constructor() {
        this.transporter = nodemailer_1.default.createTransport({
            host: env_1.env.SMTP_HOST,
            port: env_1.env.SMTP_PORT,
            secure: env_1.env.SMTP_SECURE,
            auth: env_1.env.SMTP_USER && env_1.env.SMTP_PASS
                ? {
                    user: env_1.env.SMTP_USER,
                    pass: env_1.env.SMTP_PASS,
                }
                : undefined,
        });
    }
    async sendVerificationEmail(input) {
        const verificationUrl = `${env_1.env.APP_BASE_URL}/verify-email?token=${encodeURIComponent(input.verificationToken)}`;
        await this.transporter.sendMail({
            from: env_1.env.EMAIL_FROM,
            to: input.to,
            subject: "Verify your Turf Management account",
            text: `Hello ${input.name},\n\nPlease verify your email:\n${verificationUrl}\n\nThis link will expire soon.`,
            html: `
        <p>Hello ${input.name},</p>
        <p>Please verify your email by clicking the link below:</p>
        <p><a href="${verificationUrl}">${verificationUrl}</a></p>
        <p>This link will expire soon.</p>
      `,
        });
    }
}
class DevLogEmailProvider {
    async sendVerificationEmail(input) {
        const verificationUrl = `${env_1.env.APP_BASE_URL}/verify-email?token=${encodeURIComponent(input.verificationToken)}`;
        console.log(`[DEV EMAIL] to=${input.to} subject="Verify your Turf Management account" link=${verificationUrl}`);
    }
}
function getProvider() {
    if (env_1.env.EMAIL_PROVIDER === "smtp") {
        return new SmtpEmailProvider();
    }
    return new DevLogEmailProvider();
}
const provider = getProvider();
async function sendVerificationEmail(input) {
    await provider.sendVerificationEmail(input);
}
