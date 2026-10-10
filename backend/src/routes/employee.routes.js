import { Router } from "express";
import { create, getAll, getOne, update, remove, } from "../controllers/employee.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requirePermission, } from "../middleware/rbac.middleware.js";
import { validate } from "../middleware/validation.middleware.js";
import { createEmployeeSchema, updateEmployeeSchema, } from "../validators/employee.validator.js";
const router = Router();
/**
 * Create employee
 */
router.post("/", authenticate, requirePermission("employee:create"), validate(createEmployeeSchema), create);
/**
 * Get all employees
 */
router.get("/", authenticate, requirePermission("employee:read"), getAll);
/**
 * Get employee by ID
 */
router.get("/:id", authenticate, requirePermission("employee:read"), getOne);
/**
 * Update employee
 */
router.patch("/:id", authenticate, requirePermission("employee:update"), validate(updateEmployeeSchema), update);
/**
 * Delete employee
 */
router.delete("/:id", authenticate, requirePermission("employee:delete"), remove);
export default router;
