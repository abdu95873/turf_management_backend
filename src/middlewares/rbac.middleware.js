"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRoles = requireRoles;
exports.requirePermission = requirePermission;
const permissions_1 = require("../constants/permissions");
const rolePermissions_1 = require("../constants/rolePermissions");
function requireRoles(...roles) {
    return (req, res, next) => {
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
function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const userPermissions = rolePermissions_1.ROLE_PERMISSIONS[req.user.role];
        const allowed = userPermissions.includes(permissions_1.PERMISSIONS.ADMIN_ALL) || userPermissions.includes(permission);
        if (!allowed) {
            res.status(403).json({ message: "Insufficient permissions" });
            return;
        }
        next();
    };
}
