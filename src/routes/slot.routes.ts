import { Router } from "express";
import { generateSlots, listSlots } from "../controllers/slot.controller";
import { PERMISSIONS } from "../constants/permissions";
import { requireAuth } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";

const router = Router();

router.get("/", listSlots);
router.post("/generate", requireAuth, requirePermission(PERMISSIONS.SLOT_MANAGE), generateSlots);

export default router;
