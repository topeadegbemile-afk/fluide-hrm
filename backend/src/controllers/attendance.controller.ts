import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import {
  clockInAttendance,
  clockOutAttendance,
  getAttendanceById,
  getAttendanceList,
  getMyAttendanceHistory,
  getTodayAttendance,
  updateAttendance,
} from "../services/attendance.service.js";

export async function clockIn(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
        error: "AUTHENTICATION_REQUIRED",
      });
      return;
    }

    const attendance = await clockInAttendance(req.user.id, req.body);

    res.status(201).json({
      success: true,
      message: "Clock-in recorded successfully",
      data: attendance,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to clock in";
    const statusCode =
      message === "Employee profile is required for attendance access"
        ? 403
        : message === "You have already clocked in for today"
          ? 409
          : 500;

    res.status(statusCode).json({
      success: false,
      message,
      error: statusCode === 500 ? "ATTENDANCE_CLOCK_IN_FAILED" : "ATTENDANCE_CLOCK_IN_ERROR",
    });
  }
}

export async function clockOut(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
        error: "AUTHENTICATION_REQUIRED",
      });
      return;
    }

    const attendance = await clockOutAttendance(req.user.id, req.body);

    res.status(200).json({
      success: true,
      message: "Clock-out recorded successfully",
      data: attendance,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to clock out";
    const statusCode =
      message === "Employee profile is required for attendance access"
        ? 403
        : message === "You must clock in before clocking out"
          ? 409
          : message === "You have already clocked out for today"
            ? 409
            : 500;

    res.status(statusCode).json({
      success: false,
      message,
      error: statusCode === 500 ? "ATTENDANCE_CLOCK_OUT_FAILED" : "ATTENDANCE_CLOCK_OUT_ERROR",
    });
  }
}

export async function getToday(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
        error: "AUTHENTICATION_REQUIRED",
      });
      return;
    }

    const attendance = await getTodayAttendance(req.user.id);

    res.status(200).json({
      success: true,
      message: "Today's attendance retrieved successfully",
      data: attendance,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve today's attendance";
    const statusCode = message === "Employee profile is required for attendance access" ? 403 : 500;

    res.status(statusCode).json({
      success: false,
      message,
      error: "ATTENDANCE_FETCH_FAILED",
    });
  }
}

export async function getMyHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
        error: "AUTHENTICATION_REQUIRED",
      });
      return;
    }

    const history = await getMyAttendanceHistory(req.user.id);

    res.status(200).json({
      success: true,
      message: "Attendance history retrieved successfully",
      data: history,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve attendance history";
    const statusCode = message === "Employee profile is required for attendance access" ? 403 : 500;

    res.status(statusCode).json({
      success: false,
      message,
      error: "ATTENDANCE_HISTORY_FETCH_FAILED",
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

    const attendance = await getAttendanceList(req.user.id);

    res.status(200).json({
      success: true,
      message: "Attendance records retrieved successfully",
      data: attendance,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve attendance records";

    res.status(500).json({
      success: false,
      message,
      error: "ATTENDANCE_FETCH_FAILED",
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

    const attendance = await getAttendanceById(req.user.id, req.params.id as string);

    res.status(200).json({
      success: true,
      message: "Attendance record retrieved successfully",
      data: attendance,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve attendance record";
    const statusCode =
      message === "Attendance record not found"
        ? 404
        : message === "You do not have access to this attendance record"
          ? 403
          : 500;

    res.status(statusCode).json({
      success: false,
      message,
      error: "ATTENDANCE_FETCH_FAILED",
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

    const attendance = await updateAttendance(req.user.id, req.params.id as string, req.body);

    res.status(200).json({
      success: true,
      message: "Attendance updated successfully",
      data: attendance,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update attendance";
    const statusCode =
      message === "Attendance record not found"
        ? 404
        : message === "You do not have permission to update this attendance record"
          ? 403
          : 500;

    res.status(statusCode).json({
      success: false,
      message,
      error: "ATTENDANCE_UPDATE_FAILED",
    });
  }
}
