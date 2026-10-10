import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import {
  approveLeaveRequest,
  cancelLeaveRequest,
  createLeaveRequest,
  getLeaveBalance,
  getLeaveById,
  getLeaveHistory,
  getLeaveRequests,
  rejectLeaveRequest,
} from "../services/leave.service.js";

export async function create(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required", error: "AUTHENTICATION_REQUIRED" });
      return;
    }

    const leave = await createLeaveRequest(req.user.id, req.body);

    res.status(201).json({
      success: true,
      message: "Leave request submitted successfully",
      data: leave,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create leave request";
    const statusCode =
      message.includes("Employee profile") || message.includes("duration")
        ? 400
        : message.includes("overlapping")
          ? 409
          : 500;

    res.status(statusCode).json({
      success: false,
      message,
      error: statusCode === 500 ? "LEAVE_CREATE_FAILED" : "LEAVE_REQUEST_ERROR",
    });
  }
}

export async function getAll(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required", error: "AUTHENTICATION_REQUIRED" });
      return;
    }

    const leaveRequests = await getLeaveRequests(req.user.id);

    res.status(200).json({
      success: true,
      message: "Leave requests retrieved successfully",
      data: leaveRequests,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve leave requests";
    res.status(500).json({
      success: false,
      message,
      error: "LEAVE_FETCH_FAILED",
    });
  }
}

export async function getOne(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required", error: "AUTHENTICATION_REQUIRED" });
      return;
    }

    const leave = await getLeaveById(req.user.id, req.params.id as string);

    res.status(200).json({
      success: true,
      message: "Leave request retrieved successfully",
      data: leave,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve leave request";
    const statusCode =
      message === "Leave request not found"
        ? 404
        : message === "You do not have access to this leave request"
          ? 403
          : 500;

    res.status(statusCode).json({
      success: false,
      message,
      error: statusCode === 500 ? "LEAVE_FETCH_FAILED" : "LEAVE_ACCESS_ERROR",
    });
  }
}

export async function approve(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required", error: "AUTHENTICATION_REQUIRED" });
      return;
    }

    const leave = await approveLeaveRequest(req.user.id, req.params.id as string, req.body);

    res.status(200).json({
      success: true,
      message: "Leave request approved successfully",
      data: leave,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to approve leave request";
    const statusCode =
      message === "Leave request not found"
        ? 404
        : message.includes("permission")
          ? 403
          : message.includes("Only pending")
            ? 409
            : 500;

    res.status(statusCode).json({
      success: false,
      message,
      error: statusCode === 500 ? "LEAVE_APPROVAL_FAILED" : "LEAVE_APPROVAL_ERROR",
    });
  }
}

export async function reject(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required", error: "AUTHENTICATION_REQUIRED" });
      return;
    }

    const leave = await rejectLeaveRequest(req.user.id, req.params.id as string, req.body);

    res.status(200).json({
      success: true,
      message: "Leave request rejected successfully",
      data: leave,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reject leave request";
    const statusCode =
      message === "Leave request not found"
        ? 404
        : message.includes("permission")
          ? 403
          : message.includes("Only pending")
            ? 409
            : 500;

    res.status(statusCode).json({
      success: false,
      message,
      error: statusCode === 500 ? "LEAVE_REJECTION_FAILED" : "LEAVE_REJECTION_ERROR",
    });
  }
}

export async function cancel(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required", error: "AUTHENTICATION_REQUIRED" });
      return;
    }

    const leave = await cancelLeaveRequest(req.user.id, req.params.id as string);

    res.status(200).json({
      success: true,
      message: "Leave request cancelled successfully",
      data: leave,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to cancel leave request";
    const statusCode =
      message === "Leave request not found"
        ? 404
        : message.includes("only cancel") || message.includes("Only pending")
          ? 409
          : 500;

    res.status(statusCode).json({
      success: false,
      message,
      error: statusCode === 500 ? "LEAVE_CANCELLATION_FAILED" : "LEAVE_CANCELLATION_ERROR",
    });
  }
}

export async function getBalance(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required", error: "AUTHENTICATION_REQUIRED" });
      return;
    }

    const balance = await getLeaveBalance(req.user.id);

    res.status(200).json({
      success: true,
      message: "Leave balance retrieved successfully",
      data: balance,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve leave balance";
    res.status(500).json({
      success: false,
      message,
      error: "LEAVE_BALANCE_FETCH_FAILED",
    });
  }
}

export async function getHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required", error: "AUTHENTICATION_REQUIRED" });
      return;
    }

    const history = await getLeaveHistory(req.user.id);

    res.status(200).json({
      success: true,
      message: "Leave history retrieved successfully",
      data: history,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve leave history";
    res.status(500).json({
      success: false,
      message,
      error: "LEAVE_HISTORY_FETCH_FAILED",
    });
  }
}
