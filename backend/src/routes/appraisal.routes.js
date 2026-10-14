import { Router } from "express";
import {
  createCycle,
  createReview,
  deleteReview,
  getCycleById,
  getCycles,
  getReviewById,
  getReviews,
  updateReview,
  updateReviewStatus,
} from "../controllers/appraisal.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validation.middleware.js";
import {
  createAppraisalCycleSchema,
  createPerformanceReviewSchema,
  updatePerformanceReviewSchema,
  updatePerformanceReviewStatusSchema,
} from "../validators/appraisal.validator.js";

const router = Router();

router.post("/cycles", authenticate, validate(createAppraisalCycleSchema), createCycle);
router.get("/cycles", authenticate, getCycles);
router.get("/cycles/:id", authenticate, getCycleById);

router.post("/reviews", authenticate, validate(createPerformanceReviewSchema), createReview);
router.get("/reviews", authenticate, getReviews);
router.get("/reviews/:id", authenticate, getReviewById);
router.patch("/reviews/:id", authenticate, validate(updatePerformanceReviewSchema), updateReview);
router.patch("/reviews/:id/status", authenticate, validate(updatePerformanceReviewStatusSchema), updateReviewStatus);
router.delete("/reviews/:id", authenticate, deleteReview);

export default router;
