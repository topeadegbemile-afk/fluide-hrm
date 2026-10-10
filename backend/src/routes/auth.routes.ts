import { Router } from "express";

import {
  login,
  refresh,
  logout,
  getCurrentUser,
  setPassword,
} from "../controllers/auth.controller.js";

import { authenticate } from "../middleware/auth.middleware.js";

import { validate } from "../middleware/validation.middleware.js";

import {
  loginSchema,
  refreshTokenSchema,
  setInitialPasswordSchema,
} from "../validators/auth.validator.js";

const router = Router();

router.post("/set-password", validate(setInitialPasswordSchema), setPassword);

/**
 * Login
 */
router.post(
  "/login",
  validate(loginSchema),
  login
);

/**
 * Refresh access token
 */
router.post(
  "/refresh",
  validate(refreshTokenSchema),
  refresh
);

/**
 * Logout
 */
router.post(
  "/logout",
  validate(refreshTokenSchema),
  logout
);

/**
 * Current authenticated user
 */
router.get(
  "/me",
  authenticate,
  getCurrentUser
);

export default router;
