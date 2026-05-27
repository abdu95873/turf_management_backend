"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activeUserFilter = activeUserFilter;
/** Treat missing isActive as active (legacy users). */
function activeUserFilter(extra = {}) {
    return { ...extra, isActive: { $ne: false } };
}
