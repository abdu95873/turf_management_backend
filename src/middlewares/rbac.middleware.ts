import type { NextFunction, Request, Response } from "express";
import { PERMISSIONS, type Permission } from "../constants/permissions";
import { ROLE_PERMISSIONS } from "../constants/rolePermissions";

export function requireRoles(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    next();
  };
}

export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const userPermissions = ROLE_PERMISSIONS[req.user.role];
    const allowed =
      userPermissions.includes(PERMISSIONS.ADMIN_ALL) || userPermissions.includes(permission);

    if (!allowed) {
      res.status(403).json({ message: "Insufficient permissions" });
      return;
    }

    next();
  };
}
