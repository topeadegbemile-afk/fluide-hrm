import { Router } from "express";

import {
  approve,
  cancel,
  create,
  getAll,
  getBalance,
  getHistory,
  getOne,
  remove,
  reject,
  update,
} from "../controllers/leave.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/rbac.middleware.js";
import { validate } from "../middleware/validation.middleware.js";
import {
  approveLeaveSchema,
  createLeaveSchema,
  rejectLeaveSchema,
  updateLeaveSchema,
} from "../validators/leave.validator.js";

const router = Router();

router.post("/", authenticate, validate(createLeaveSchema), create);
router.get("/balance", authenticate, getBalance);
router.get("/history", authenticate, getHistory);
router.get("/", authenticate, getAll);
router.get("/:id", authenticate, getOne);
router.patch("/:id", authenticate, requireRole("SUPER_ADMIN", "HR"), validate(updateLeaveSchema), update);
router.delete("/:id", authenticate, requireRole("SUPER_ADMIN", "HR"), remove);
router.patch("/:id/approve", authenticate, validate(approveLeaveSchema), approve);
router.patch("/:id/reject", authenticate, validate(rejectLeaveSchema), reject);
router.patch("/:id/cancel", authenticate, cancel);

export default router;
