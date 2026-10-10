import { Router } from "express";

import {
  approve,
  cancel,
  create,
  getAll,
  getBalance,
  getHistory,
  getOne,
  reject,
} from "../controllers/leave.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validation.middleware.js";
import {
  approveLeaveSchema,
  createLeaveSchema,
  rejectLeaveSchema,
} from "../validators/leave.validator.js";

const router = Router();

router.post("/", authenticate, validate(createLeaveSchema), create);
router.get("/balance", authenticate, getBalance);
router.get("/history", authenticate, getHistory);
router.get("/", authenticate, getAll);
router.get("/:id", authenticate, getOne);
router.patch("/:id/approve", authenticate, validate(approveLeaveSchema), approve);
router.patch("/:id/reject", authenticate, validate(rejectLeaveSchema), reject);
router.patch("/:id/cancel", authenticate, cancel);

export default router;
