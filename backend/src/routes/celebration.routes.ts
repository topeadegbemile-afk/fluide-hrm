import { Router } from "express";
import { z } from "zod";
import {
  birthdays,
  create,
  getAll,
  getOne,
  remove,
  update,
  wishBirthday,
} from "../controllers/celebration.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { validate } from "../middleware/validation.middleware.js";
import {
  createCelebrationSchema,
  updateCelebrationSchema,
} from "../validators/celebration.validator.js";

const router = Router();

router.get("/birthdays/upcoming", authenticate, requirePermission("celebration:read"), birthdays);
router.post("/:id/wishes", authenticate, requirePermission("celebration:read"), validate(z.object({ message: z.string().trim().min(2).max(500), celebrationType: z.enum(["BIRTHDAY", "WORK_ANNIVERSARY"]).default("BIRTHDAY") })), wishBirthday);

router.post(
  "/",
  authenticate,
  requirePermission("celebration:create"),
  validate(createCelebrationSchema),
  create
);

router.get("/", authenticate, requirePermission("celebration:read"), getAll);
router.get("/:id", authenticate, requirePermission("celebration:read"), getOne);
router.patch(
  "/:id",
  authenticate,
  requirePermission("celebration:create"),
  validate(updateCelebrationSchema),
  update
);
router.delete(
  "/:id",
  authenticate,
  requirePermission("celebration:create"),
  remove
);

export default router;
