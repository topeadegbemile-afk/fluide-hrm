import { Router } from "express";
import {
  create,
  getAll,
  getOne,
  remove,
  update,
} from "../controllers/celebration.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { validate } from "../middleware/validation.middleware.js";
import {
  createCelebrationSchema,
  updateCelebrationSchema,
} from "../validators/celebration.validator.js";

const router = Router();

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
