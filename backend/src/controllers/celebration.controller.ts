import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import {
  createCelebration,
  deleteCelebration,
  getCelebrationById,
  getCelebrations,
  updateCelebration,
} from "../services/celebration.service.js";

export async function create(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
        error: "AUTHENTICATION_REQUIRED",
      });
      return;
    }

    const celebration = await createCelebration(req.user.id, req.body);

    res.status(201).json({
      success: true,
      message: "Celebration created successfully",
      data: celebration,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create celebration";
    const statusCode = message.includes("permission") ? 403 : 500;

    res.status(statusCode).json({
      success: false,
      message,
      error: "CELEBRATION_CREATE_FAILED",
    });
  }
}

export async function getAll(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
        error: "AUTHENTICATION_REQUIRED",
      });
      return;
    }

    const celebrations = await getCelebrations();

    res.status(200).json({
      success: true,
      message: "Celebrations retrieved successfully",
      data: celebrations,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve celebrations";
    res.status(500).json({
      success: false,
      message,
      error: "CELEBRATIONS_FETCH_FAILED",
    });
  }
}

export async function getOne(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
        error: "AUTHENTICATION_REQUIRED",
      });
      return;
    }

    const celebration = await getCelebrationById(req.params.id as string);

    res.status(200).json({
      success: true,
      message: "Celebration retrieved successfully",
      data: celebration,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve celebration";
    const statusCode = message === "Celebration not found" ? 404 : 500;

    res.status(statusCode).json({
      success: false,
      message,
      error: "CELEBRATION_FETCH_FAILED",
    });
  }
}

export async function update(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
        error: "AUTHENTICATION_REQUIRED",
      });
      return;
    }

    const celebration = await updateCelebration(req.user.id, req.params.id as string, req.body);

    res.status(200).json({
      success: true,
      message: "Celebration updated successfully",
      data: celebration,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update celebration";
    const statusCode =
      message === "Celebration not found"
        ? 404
        : message.includes("permission")
          ? 403
          : 500;

    res.status(statusCode).json({
      success: false,
      message,
      error: "CELEBRATION_UPDATE_FAILED",
    });
  }
}

export async function remove(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
        error: "AUTHENTICATION_REQUIRED",
      });
      return;
    }

    const result = await deleteCelebration(req.user.id, req.params.id as string);

    res.status(200).json({
      success: true,
      message: "Celebration deleted successfully",
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete celebration";
    const statusCode =
      message === "Celebration not found"
        ? 404
        : message.includes("permission")
          ? 403
          : 500;

    res.status(statusCode).json({
      success: false,
      message,
      error: "CELEBRATION_DELETE_FAILED",
    });
  }
}
