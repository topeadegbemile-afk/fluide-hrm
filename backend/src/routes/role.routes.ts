import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { validate } from "../middleware/validation.middleware.js";
import {
  assignPermission,
  create,
  getAllPermissions,
  getAll,
  getOne,
  remove,
  update,
} from "../controllers/role.controller.js";
import { assignPermissionSchema, createRoleSchema, updateRoleSchema } from "../validators/role.validator.js";

const router = Router();

router.use(authenticate);
router.get("/permissions", requirePermission("permission:read"), getAllPermissions);
router.get("/", requirePermission("role:read"), getAll);
router.get("/:id", requirePermission("role:read"), getOne);
router.post("/", requirePermission("role:create"), validate(createRoleSchema), create);
router.put("/:id", requirePermission("role:update"), validate(updateRoleSchema), update);
router.delete("/:id", requirePermission("role:delete"), remove);
router.patch("/:id/assign-permission", requirePermission("permission:assign"), validate(assignPermissionSchema), assignPermission);

export default router;
