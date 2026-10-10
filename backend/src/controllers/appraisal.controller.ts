import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import {
  createAppraisalCycle,
  createPerformanceReview,
  getAppraisalCycleById,
  getAppraisalCycles,
  getPerformanceReviewById,
  getPerformanceReviews,
  updatePerformanceReview,
  updatePerformanceReviewStatus,
} from "../services/appraisal.service.js";

export async function createCycle(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
        error: "AUTHENTICATION_REQUIRED",
      });
      return;
    }

    const cycle = await createAppraisalCycle(req.user.id, req.body);

    res.status(201).json({
      success: true,
      message: "Appraisal cycle created successfully",
      data: cycle,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create appraisal cycle";
    const statusCode =
      message.includes("permission") ? 403 : message === "Appraisal cycle not found" ? 404 : 500;

    res.status(statusCode).json({
      success: false,
      message,
      error: "APPRAISAL_CYCLE_CREATE_FAILED",
    });
  }
}

export async function getCycles(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
        error: "AUTHENTICATION_REQUIRED",
      });
      return;
    }

    const cycles = await getAppraisalCycles(req.user.id);

    res.status(200).json({
      success: true,
      message: "Appraisal cycles retrieved successfully",
      data: cycles,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve appraisal cycles";
    res.status(500).json({
      success: false,
      message,
      error: "APPRAISAL_CYCLES_FETCH_FAILED",
    });
  }
}

export async function getCycleById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
        error: "AUTHENTICATION_REQUIRED",
      });
      return;
    }

    const cycle = await getAppraisalCycleById(req.user.id, req.params.id as string);

    res.status(200).json({
      success: true,
      message: "Appraisal cycle retrieved successfully",
      data: cycle,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve appraisal cycle";
    const statusCode =
      message === "Appraisal cycle not found" ? 404 : message === "You do not have access to this appraisal cycle" ? 403 : 500;

    res.status(statusCode).json({
      success: false,
      message,
      error: "APPRAISAL_CYCLE_FETCH_FAILED",
    });
  }
}

export async function createReview(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
        error: "AUTHENTICATION_REQUIRED",
      });
      return;
    }

    const review = await createPerformanceReview(req.user.id, req.body);

    res.status(201).json({
      success: true,
      message: "Performance review created successfully",
      data: review,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create performance review";
    const statusCode =
      message.includes("permission")
        ? 403
        : message.includes("not found")
          ? 404
          : message.includes("already exists")
            ? 409
            : 500;

    res.status(statusCode).json({
      success: false,
      message,
      error: "APPRAISAL_CREATE_FAILED",
    });
  }
}

export async function getReviews(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
        error: "AUTHENTICATION_REQUIRED",
      });
      return;
    }

    const reviews = await getPerformanceReviews(req.user.id, typeof req.query.employeeId === "string" ? req.query.employeeId : undefined);

    res.status(200).json({
      success: true,
      message: "Performance reviews retrieved successfully",
      data: reviews,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve performance reviews";
    res.status(500).json({
      success: false,
      message,
      error: "APPRAISAL_FETCH_FAILED",
    });
  }
}

export async function getReviewById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
        error: "AUTHENTICATION_REQUIRED",
      });
      return;
    }

    const review = await getPerformanceReviewById(req.user.id, req.params.id as string);

    res.status(200).json({
      success: true,
      message: "Performance review retrieved successfully",
      data: review,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve performance review";
    const statusCode =
      message === "Performance review not found"
        ? 404
        : message === "You do not have access to this performance review"
          ? 403
          : 500;

    res.status(statusCode).json({
      success: false,
      message,
      error: "APPRAISAL_FETCH_FAILED",
    });
  }
}

export async function updateReview(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
        error: "AUTHENTICATION_REQUIRED",
      });
      return;
    }

    const review = await updatePerformanceReview(req.user.id, req.params.id as string, req.body);

    res.status(200).json({
      success: true,
      message: "Performance review updated successfully",
      data: review,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update performance review";
    const statusCode =
      message === "Performance review not found"
        ? 404
        : message.includes("permission")
          ? 403
          : message.includes("Only draft reviews")
            ? 409
            : 500;

    res.status(statusCode).json({
      success: false,
      message,
      error: "APPRAISAL_UPDATE_FAILED",
    });
  }
}

export async function updateReviewStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
        error: "AUTHENTICATION_REQUIRED",
      });
      return;
    }

    const review = await updatePerformanceReviewStatus(req.user.id, req.params.id as string, req.body);

    res.status(200).json({
      success: true,
      message: "Performance review status updated successfully",
      data: review,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update performance review status";
    const statusCode =
      message === "Performance review not found"
        ? 404
        : message.includes("permission")
          ? 403
          : message.includes("Only draft reviews")
            ? 409
            : 500;

    res.status(statusCode).json({
      success: false,
      message,
      error: "APPRAISAL_STATUS_UPDATE_FAILED",
    });
  }
}
