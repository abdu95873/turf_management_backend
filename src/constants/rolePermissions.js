"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_PERMISSIONS = void 0;
const permissions_1 = require("./permissions");
const roles_1 = require("./roles");
exports.ROLE_PERMISSIONS = {
    [roles_1.ROLES.USER]: [permissions_1.PERMISSIONS.BOOKING_CREATE, permissions_1.PERMISSIONS.BOOKING_VIEW],
    [roles_1.ROLES.OWNER]: [
        permissions_1.PERMISSIONS.BOOKING_VIEW,
        permissions_1.PERMISSIONS.BOOKING_UPDATE_STATUS,
        permissions_1.PERMISSIONS.SLOT_MANAGE,
        permissions_1.PERMISSIONS.RESOURCE_MANAGE,
        permissions_1.PERMISSIONS.PRICE_MANAGE,
        permissions_1.PERMISSIONS.REFUND_MANAGE,
    ],
    [roles_1.ROLES.STAFF]: [
        permissions_1.PERMISSIONS.BOOKING_VIEW,
        permissions_1.PERMISSIONS.SLOT_MANAGE,
        permissions_1.PERMISSIONS.BOOKING_UPDATE_STATUS,
        permissions_1.PERMISSIONS.REFUND_MANAGE,
    ],
    [roles_1.ROLES.ADMIN]: [permissions_1.PERMISSIONS.ADMIN_ALL],
};
