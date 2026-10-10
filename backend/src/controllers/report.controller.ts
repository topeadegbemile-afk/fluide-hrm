import type { Request, Response } from "express";
import {
  getAttendanceSummary,
  getDashboardStatistics,
  getEmployeeReport,
} from "../services/report.service.js";
import { reportQuerySchema } from "../validators/report.validator.js";

function parseQuery(req: Request, res: Response) {
  const result = reportQuerySchema.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({
      success: false,
      message: "Invalid report filters",
      error: "VALIDATION_ERROR",
      details: result.error.flatten(),
    });
    return undefined;
  }
  return result.data;
}

export async function getDashboard(req: Request, res: Response): Promise<void> {
  try {
    const query = parseQuery(req, res);
    if (!query) return;
    const data = await getDashboardStatistics(query);
    res.status(200).json({ success: true, message: "Dashboard statistics retrieved successfully", data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve dashboard statistics";
    res.status(500).json({ success: false, message, error: "DASHBOARD_FETCH_FAILED" });
  }
}

export async function getEmployeesReport(req: Request, res: Response): Promise<void> {
  try {
    const query = parseQuery(req, res);
    if (!query) return;
    const data = await getEmployeeReport(query);
    res.status(200).json({ success: true, message: "Employee report retrieved successfully", data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve employee report";
    res.status(500).json({ success: false, message, error: "EMPLOYEE_REPORT_FETCH_FAILED" });
  }
}

export async function getAttendanceReport(req: Request, res: Response): Promise<void> {
  try {
    const query = parseQuery(req, res);
    if (!query) return;
    const data = await getAttendanceSummary(query);
    res.status(200).json({ success: true, message: "Attendance report retrieved successfully", data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve attendance report";
    res.status(500).json({ success: false, message, error: "ATTENDANCE_REPORT_FETCH_FAILED" });
  }
}
