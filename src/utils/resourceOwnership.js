"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyResourceOwnership = verifyResourceOwnership;
const roles_1 = require("../constants/roles");
const Resource_1 = require("../models/Resource");
const User_1 = require("../models/User");
async function verifyResourceOwnership(req, resourceId) {
    const resource = await Resource_1.ResourceModel.findById(resourceId);
    if (!resource) {
        return { ok: false, status: 404, message: "Resource not found" };
    }
    if (req.user.role === roles_1.ROLES.ADMIN) {
        return { ok: true, resource };
    }
    if (req.user.role === roles_1.ROLES.OWNER) {
        if (String(resource.ownerId) !== req.user.id) {
            return { ok: false, status: 403, message: "You do not own this resource" };
        }
        return { ok: true, resource };
    }
    if (req.user.role === roles_1.ROLES.STAFF) {
        const staffUser = await User_1.UserModel.findById(req.user.id);
        if (!staffUser?.ownerId || String(resource.ownerId) !== String(staffUser.ownerId)) {
            return { ok: false, status: 403, message: "You do not have access to this resource" };
        }
        return { ok: true, resource };
    }
    return { ok: false, status: 403, message: "Insufficient permissions" };
}
