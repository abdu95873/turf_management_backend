import { Router } from "express";
import { createResource, listResources } from "../controllers/resource.controller";
import { PERMISSIONS } from "../constants/permissions";
import { requireAuth } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";

const router = Router();

router.get("/", listResources);
router.post("/", requireAuth, requirePermission(PERMISSIONS.RESOURCE_MANAGE), createResource);

export default router;
