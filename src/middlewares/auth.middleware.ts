import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { ROLES, type Role } from "../constants/roles";

interface AuthTokenPayload {
  sub: string;
  role: Role;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Missing bearer token" });
    return;
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload;
    req.user = {
      id: payload.sub,
      role: payload.role ?? ROLES.USER,
    };
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}
