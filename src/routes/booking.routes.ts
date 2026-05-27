import { Router } from "express";
import {
  cancelMyBooking,
  createBooking,
  listMyBookings,
} from "../controllers/booking.controller";
import { PERMISSIONS } from "../constants/permissions";
import { requireAuth } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";

const router = Router();

router.post("/", requireAuth, requirePermission(PERMISSIONS.BOOKING_CREATE), createBooking);
router.get("/me", requireAuth, requirePermission(PERMISSIONS.BOOKING_VIEW), listMyBookings);
router.patch(
  "/me/:bookingId/cancel",
  requireAuth,
  requirePermission(PERMISSIONS.BOOKING_CREATE),
  cancelMyBooking
);

export default router;
