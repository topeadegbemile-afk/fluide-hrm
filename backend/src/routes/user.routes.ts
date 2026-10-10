import { Router } from "express";

import { authenticate } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { validate } from "../middleware/validation.middleware.js";

import {
  assignRole,
  create,
  deactivate,
  getAll,
  getAvailableEmployeesController,
  getOne,
  reactivate,
  remove,
  update,
} from "../controllers/user.controller.js";

import {
  assignRoleSchema,
  createUserSchema,
  updateUserSchema,
} from "../validators/user.validator.js";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  requirePermission("user:read"),
  getAll,
);

router.get(
  "/available-employees",
  requirePermission("user:create"),
  getAvailableEmployeesController,
);

router.get(
  "/:id",
  requirePermission("user:read"),
  getOne,
);

router.post(
  "/",
  requirePermission("user:create"),
  validate(createUserSchema),
  create,
);

router.put(
  "/:id",
  requirePermission("user:update"),
  validate(updateUserSchema),
  update,
);

router.delete(
  "/:id",
  requirePermission("user:delete"),
  remove,
);

router.patch(
  "/:id/assign-role",
  requirePermission("user:update"),
  validate(assignRoleSchema),
  assignRole,
);

router.patch(
  "/:id/deactivate",
  requirePermission("user:update"),
  deactivate,
);

router.patch(
  "/:id/reactivate",
  requirePermission("user:update"),
  reactivate,
);

export default router;