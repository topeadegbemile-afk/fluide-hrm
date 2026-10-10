import { Router } from "express";

import {
  clockIn,
  clockOut,
  getAll,
  getMyHistory,
  getOne,
  getToday,
  update,
} from "../controllers/attendance.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validation.middleware.js";
import {
  clockInSchema,
  clockOutSchema,
  updateAttendanceSchema,
} from "../validators/attendance.validator.js";

const router = Router();

router.post("/clock-in", authenticate, validate(clockInSchema), clockIn);
router.post("/clock-out", authenticate, validate(clockOutSchema), clockOut);
router.get("/today", authenticate, getToday);
router.get("/my-history", authenticate, getMyHistory);
router.get("/", authenticate, getAll);
router.get("/:id", authenticate, getOne);
router.patch("/:id", authenticate, validate(updateAttendanceSchema), update);

export default router;
