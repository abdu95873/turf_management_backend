import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import type { Role } from "../constants/roles";
import { randomToken } from "./crypto";

interface SignTokenInput {
  userId: string;
  role: Role;
}

export function signAccessToken(input: SignTokenInput): string {
  const options: SignOptions = {
    subject: input.userId,
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as SignOptions["expiresIn"],
  };
  return jwt.sign({ role: input.role }, env.JWT_SECRET, {
    ...options,
  });
}

export function signRefreshToken(input: SignTokenInput): string {
  const options: SignOptions = {
    subject: input.userId,
    expiresIn: `${env.REFRESH_TOKEN_EXPIRES_IN_DAYS}d` as SignOptions["expiresIn"],
    jwtid: randomToken(16),
  };
  return jwt.sign({ role: input.role }, env.JWT_REFRESH_SECRET, {
    ...options,
  });
}

interface RefreshTokenPayload {
  role: Role;
  iat: number;
  exp: number;
  sub: string;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}
