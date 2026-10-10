import { Router } from "express";
import { getSummary, getTree } from "../controllers/organogram.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/rbac.middleware.js";

const router = Router();

router.get("/tree", authenticate, requirePermission("employee:read"), getTree);
router.get("/summary", authenticate, requirePermission("employee:read"), getSummary);

export default router;
