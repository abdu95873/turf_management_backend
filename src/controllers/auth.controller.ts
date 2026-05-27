import type { Request, Response } from "express";
import { z } from "zod";
import { env } from "../config/env";
import { ROLES } from "../constants/roles";
import { RefreshTokenModel } from "../models/RefreshToken";
import { UserModel } from "../models/User";
import { sendVerificationEmail } from "../services/email.service";
import { sha256, randomToken } from "../utils/crypto";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt";
import { comparePassword, hashPassword } from "../utils/password";

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum([ROLES.USER, ROLES.OWNER]).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const googleSchema = z.object({
  googleId: z.string().min(3),
  email: z.string().email(),
  name: z.string().min(2),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(20),
});

const logoutSchema = z.object({
  refreshToken: z.string().min(20),
});

const verifyEmailSchema = z.object({
  token: z.string().min(10),
});

function buildAuthPayload(user: { id: string; role: typeof ROLES[keyof typeof ROLES] }) {
  const accessToken = signAccessToken({ userId: user.id, role: user.role });
  const refreshToken = signRefreshToken({ userId: user.id, role: user.role });
  return { accessToken, refreshToken };
}

async function persistRefreshToken(userId: string, refreshToken: string): Promise<void> {
  await RefreshTokenModel.create({
    userId,
    tokenHash: sha256(refreshToken),
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000),
  });
}

export async function register(req: Request, res: Response): Promise<void> {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  const email = parsed.data.email.toLowerCase();
  const exists = await UserModel.findOne({ email });
  if (exists) {
    res.status(409).json({ message: "Email already in use" });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await UserModel.create({
    name: parsed.data.name,
    email,
    passwordHash,
    role: parsed.data.role ?? ROLES.USER,
    authProvider: "local",
  });

  const { accessToken, refreshToken } = buildAuthPayload({ id: user.id, role: user.role });
  await persistRefreshToken(user.id, refreshToken);
  res.status(201).json({
    accessToken,
    refreshToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  const email = parsed.data.email.toLowerCase();
  const user = await UserModel.findOne({ email, isActive: true });
  if (!user || !user.passwordHash) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }

  const matched = await comparePassword(parsed.data.password, user.passwordHash);
  if (!matched) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }

  const { accessToken, refreshToken } = buildAuthPayload({ id: user.id, role: user.role });
  await persistRefreshToken(user.id, refreshToken);
  res.json({
    accessToken,
    refreshToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}

export async function googleAuthPlaceholder(req: Request, res: Response): Promise<void> {
  const parsed = googleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  // Placeholder: integrate real Google token verification in Phase 2.
  let user = await UserModel.findOne({ $or: [{ googleId: parsed.data.googleId }, { email: parsed.data.email }] });

  if (!user) {
    user = await UserModel.create({
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      googleId: parsed.data.googleId,
      authProvider: "google",
      role: ROLES.USER,
    });
  } else if (!user.googleId) {
    user.googleId = parsed.data.googleId;
    user.authProvider = "google";
    await user.save();
  }

  const { accessToken, refreshToken } = buildAuthPayload({ id: user.id, role: user.role });
  await persistRefreshToken(user.id, refreshToken);
  res.json({
    accessToken,
    refreshToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    warning: "Google token verification is not implemented yet.",
  });
}

export async function refreshAccessToken(req: Request, res: Response): Promise<void> {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  const incomingToken = parsed.data.refreshToken;
  const tokenHash = sha256(incomingToken);

  const tokenDoc = await RefreshTokenModel.findOne({ tokenHash, revokedAt: null });
  if (!tokenDoc) {
    res.status(401).json({ message: "Invalid refresh token" });
    return;
  }

  if (tokenDoc.expiresAt.getTime() < Date.now()) {
    res.status(401).json({ message: "Refresh token expired" });
    return;
  }

  try {
    const payload = verifyRefreshToken(incomingToken);
    const user = await UserModel.findOne({ _id: payload.sub, isActive: true });
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
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch {
    res.status(401).json({ message: "Invalid refresh token" });
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  const parsed = logoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  const tokenHash = sha256(parsed.data.refreshToken);
  await RefreshTokenModel.findOneAndUpdate(
    { tokenHash, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );

  res.json({ message: "Logged out successfully" });
}

export async function sendEmailVerificationToken(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const user = await UserModel.findById(req.user.id);
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  if (user.emailVerified) {
    res.json({ message: "Email already verified" });
    return;
  }

  const token = randomToken(24);
  user.emailVerificationTokenHash = sha256(token);
  user.emailVerificationExpiresAt = new Date(
    Date.now() + env.EMAIL_VERIFY_TOKEN_EXPIRES_HOURS * 60 * 60 * 1000
  );
  await user.save();

  await sendVerificationEmail({
    to: user.email,
    name: user.name,
    verificationToken: token,
  });

  res.json({
    message: "Verification email sent",
  });
}

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  const parsed = verifyEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  const tokenHash = sha256(parsed.data.token);
  const user = await UserModel.findOne({
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
