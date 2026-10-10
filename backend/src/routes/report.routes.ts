import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import {
  getAttendanceReport,
  getDashboard,
  getEmployeesReport,
} from "../controllers/report.controller.js";

const router = Router();

router.use(authenticate);
router.get("/dashboard", requirePermission("dashboard:read"), getDashboard);
router.get("/employees", requirePermission("report:read"), getEmployeesReport);
router.get("/attendance", requirePermission("report:read"), getAttendanceReport);
router.get("/", requirePermission("report:read"), getDashboard);

export default router;
