import nodemailer from "nodemailer";
import { env } from "../config/env";

interface SendVerificationEmailInput {
  to: string;
  name: string;
  verificationToken: string;
}

interface EmailProvider {
  sendVerificationEmail(input: SendVerificationEmailInput): Promise<void>;
}

class SmtpEmailProvider implements EmailProvider {
  private transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth:
      env.SMTP_USER && env.SMTP_PASS
        ? {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
          }
        : undefined,
  });

  async sendVerificationEmail(input: SendVerificationEmailInput): Promise<void> {
    const verificationUrl = `${env.APP_BASE_URL}/verify-email?token=${encodeURIComponent(
      input.verificationToken
    )}`;

    await this.transporter.sendMail({
      from: env.EMAIL_FROM,
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

class DevLogEmailProvider implements EmailProvider {
  async sendVerificationEmail(input: SendVerificationEmailInput): Promise<void> {
    const verificationUrl = `${env.APP_BASE_URL}/verify-email?token=${encodeURIComponent(
      input.verificationToken
    )}`;
    console.log(
      `[DEV EMAIL] to=${input.to} subject="Verify your Turf Management account" link=${verificationUrl}`
    );
  }
}

function getProvider(): EmailProvider {
  if (env.EMAIL_PROVIDER === "smtp") {
    return new SmtpEmailProvider();
  }
  return new DevLogEmailProvider();
}

const provider = getProvider();

export async function sendVerificationEmail(input: SendVerificationEmailInput): Promise<void> {
  await provider.sendVerificationEmail(input);
}
