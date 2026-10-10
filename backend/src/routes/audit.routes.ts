import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { getAll } from "../controllers/audit.controller.js";

const router = Router();

router.use(authenticate);
router.get("/", requirePermission("audit:read"), getAll);

export default router;
