import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { getManagementSummary, getOrganizationTree } from "../services/organogram.service.js";

export async function getTree(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
        error: "AUTHENTICATION_REQUIRED",
      });
      return;
    }

    const tree = await getOrganizationTree();

    res.status(200).json({
      success: true,
      message: "Organization tree retrieved successfully",
      data: tree,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve organization tree";
    res.status(500).json({
      success: false,
      message,
      error: "ORGANOGRAM_FETCH_FAILED",
    });
  }
}

export async function getSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
        error: "AUTHENTICATION_REQUIRED",
      });
      return;
    }

    const summary = await getManagementSummary();

    res.status(200).json({
      success: true,
      message: "Organization summary retrieved successfully",
      data: summary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve organization summary";
    res.status(500).json({
      success: false,
      message,
      error: "ORGANOGRAM_SUMMARY_FAILED",
    });
  }
}
