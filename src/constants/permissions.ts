export const PERMISSIONS = {
  BOOKING_CREATE: "booking:create",
  BOOKING_VIEW: "booking:view",
  BOOKING_UPDATE_STATUS: "booking:update-status",
  SLOT_MANAGE: "slot:manage",
  RESOURCE_MANAGE: "resource:manage",
  PRICE_MANAGE: "price:manage",
  TURF_DELETE: "turf:delete",
  REFUND_MANAGE: "refund:manage",
  ADMIN_ALL: "admin:all",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
