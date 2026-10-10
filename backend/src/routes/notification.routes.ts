import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { validate } from "../middleware/validation.middleware.js";
import {
  create,
  getAll,
  remove,
  update,
} from "../controllers/notification.controller.js";
import { createNotificationSchema, updateNotificationSchema } from "../validators/notification.validator.js";

const router = Router();

router.use(authenticate);
router.get("/", requirePermission("notification:read"), getAll);
router.post("/", requirePermission("notification:create"), validate(createNotificationSchema), create);
router.patch("/:id", requirePermission("notification:read"), validate(updateNotificationSchema), update);
router.delete("/:id", requirePermission("notification:read"), remove);

export default router;
