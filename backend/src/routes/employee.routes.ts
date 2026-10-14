import { Router } from "express";

import {
  create,
  bulkCreate,
  getAll,
  getOne,
  update,
  remove,
  getMyPersonalInformation,
  updateMyPersonalInformation,
  getEmployeePersonalInformationById,
  getEmployeePersonalInformationReviewQueue,
  updateEmployeePersonalInformation,
  reviewEmployeePersonalInformation,
  getEmployeeProfilePhoto,
  uploadEmployeeProfilePhoto,
} from "../controllers/employee.controller.js";
import express from "express";

import { authenticate } from "../middleware/auth.middleware.js";

import {
  requirePermission,
  requireRole,
} from "../middleware/rbac.middleware.js";

import { validate } from "../middleware/validation.middleware.js";

import {
  createEmployeeSchema,
  bulkCreateEmployeesSchema,
  updateEmployeeSchema,
} from "../validators/employee.validator.js";
import { employeePersonalInformationAdminEditSchema, employeePersonalInformationReviewSchema, employeePersonalInformationSchema } from "../validators/employee-personal-information.validator.js";

const router = Router();

router.get("/:id/profile-photo", authenticate, getEmployeeProfilePhoto);
router.post("/:id/profile-photo", authenticate, express.raw({ type: "image/*", limit: 500 * 1024 }), uploadEmployeeProfilePhoto);
router.get("/me/personal-information", authenticate, getMyPersonalInformation);
router.put(
  "/me/personal-information",
  authenticate,
  validate(employeePersonalInformationSchema),
  updateMyPersonalInformation,
);
router.get(
  "/personal-information/reviews",
  authenticate,
  requireRole("SUPER_ADMIN", "HR"),
  getEmployeePersonalInformationReviewQueue,
);
router.patch(
  "/:id/personal-information/review",
  authenticate,
  requireRole("SUPER_ADMIN", "HR"),
  validate(employeePersonalInformationReviewSchema),
  reviewEmployeePersonalInformation,
);
router.get(
  "/:id/personal-information",
  authenticate,
  requirePermission("employee:update"),
  getEmployeePersonalInformationById,
);
router.put(
  "/:id/personal-information",
  authenticate,
  requirePermission("employee:update"),
  validate(employeePersonalInformationAdminEditSchema),
  updateEmployeePersonalInformation,
);

/**
 * Create employee
 */
router.post(
  "/bulk",
  authenticate,
  requirePermission("employee:create"),
  validate(bulkCreateEmployeesSchema),
  bulkCreate,
);

router.post(
  "/",
  authenticate,
  requirePermission("employee:create"),
  validate(createEmployeeSchema),
  create
);

/**
 * Get all employees
 */
router.get(
  "/",
  authenticate,
  requirePermission("employee:read"),
  getAll
);

/**
 * Get employee by ID
 */
router.get(
  "/:id",
  authenticate,
  requirePermission("employee:read"),
  getOne
);

/**
 * Update employee
 */
router.patch(
  "/:id",
  authenticate,
  requirePermission("employee:update"),
  validate(updateEmployeeSchema),
  update
);

/**
 * Delete employee
 */
router.delete(
  "/:id",
  authenticate,
  requirePermission("employee:delete"),
  remove
);

export default router;
