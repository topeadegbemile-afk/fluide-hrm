import { Request, Response } from "express";

import {
  createEmployee,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
} from "../services/employee.service.js";
import {
  getEmployeePersonalInformation,
  getEmployeePersonalInformationReviews,
  getOwnPersonalInformation,
  updateEmployeePersonalInformation as saveEmployeePersonalInformation,
  updateOwnPersonalInformation,
  reviewEmployeePersonalInformation as reviewEmployeeInformation,
} from "../services/employee-personal-information.service.js";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { createEmployeeSchema } from "../validators/employee.validator.js";
import { employeePersonalInformationAdminEditSchema } from "../validators/employee-personal-information.validator.js";
import { employeePersonalInformationReviewSchema } from "../validators/employee-personal-information.validator.js";
import { prisma } from "../config/database.js";
import { mayAccessEmployeePhoto, mayUploadEmployeePhoto, readProfilePhoto, saveProfilePhoto } from "../services/profile-photo.service.js";

export async function getMyPersonalInformation(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const information = await getOwnPersonalInformation(req.user!.id);
    res.status(200).json({
      success: true,
      message: "Personal information retrieved successfully",
      data: information,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve personal information";
    res.status(message.includes("not linked") ? 403 : 500).json({
      success: false,
      message,
      error: message.includes("not linked") ? "EMPLOYEE_PROFILE_REQUIRED" : "INTERNAL_SERVER_ERROR",
    });
  }
}

export async function getEmployeeProfilePhoto(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const employeeId = getRouteParamId(req.params.id);
    await mayAccessEmployeePhoto(req.user!.id, employeeId);
    const photo = await readProfilePhoto(employeeId);
    res.setHeader("Content-Type", photo.mimeType);
    res.setHeader("Content-Length", String(photo.bytes.length));
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.status(200).send(photo.bytes);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve profile photo";
    const status = message.includes("permission") ? 403 : message.includes("not found") || message.includes("ENOENT") ? 404 : 500;
    res.status(status).json({ success: false, message, error: "PROFILE_PHOTO_FETCH_FAILED" });
  }
}

export async function uploadEmployeeProfilePhoto(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!Buffer.isBuffer(req.body)) {
    res.status(400).json({ success: false, message: "Choose an image to upload", error: "PROFILE_PHOTO_REQUIRED" });
    return;
  }
  try {
    const employeeId = getRouteParamId(req.params.id);
    await mayUploadEmployeePhoto(req.user!.id, employeeId);
    const employee = await saveProfilePhoto(employeeId, req.body, String(req.headers["content-type"] ?? ""));
    res.status(200).json({ success: true, message: "Profile photo updated", data: employee });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload profile photo";
    const status = message.includes("permission") ? 403 : message === "Employee not found" ? 404 : 400;
    res.status(status).json({ success: false, message, error: "PROFILE_PHOTO_UPLOAD_FAILED" });
  }
}

export async function getEmployeePersonalInformationById(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const employeeId = getRouteParamId(req.params.id);
    const information = await getEmployeePersonalInformation(employeeId);
    res.status(200).json({
      success: true,
      message: "Employee personal information retrieved successfully",
      data: information,
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Unable to retrieve employee personal information",
      error: "INTERNAL_SERVER_ERROR",
    });
  }
}

export async function updateEmployeePersonalInformation(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const employeeId = getRouteParamId(req.params.id);
    const parsed = employeePersonalInformationAdminEditSchema.parse(req.body);
    const information = await saveEmployeePersonalInformation(employeeId, parsed);
    res.status(200).json({ success: true, message: "Employee personal information updated successfully", data: information });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update employee personal information";
    const status = message === "Employee not found" ? 404 : error instanceof Error && error.name === "ZodError" ? 400 : 500;
    res.status(status).json({ success: false, message, error: status === 404 ? "EMPLOYEE_NOT_FOUND" : "EMPLOYEE_PERSONAL_INFORMATION_UPDATE_FAILED" });
  }
}

export async function getEmployeePersonalInformationReviewQueue(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const records = await getEmployeePersonalInformationReviews();
    res.status(200).json({ success: true, message: "Employee information awaiting review", data: records });
  } catch {
    res.status(500).json({ success: false, message: "Unable to load employee information review queue", error: "EMPLOYEE_INFORMATION_REVIEW_FETCH_FAILED" });
  }
}

export async function reviewEmployeePersonalInformation(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const employeeId = getRouteParamId(req.params.id);
    const parsed = employeePersonalInformationReviewSchema.parse(req.body);
    const result = await reviewEmployeeInformation(employeeId, req.user!.id, parsed.status, parsed.comment);
    res.status(200).json({ success: true, message: `Employee information ${parsed.status.toLowerCase()}`, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to review employee information";
    const status = message === "Employee information not found" ? 404 : message.includes("already been reviewed") ? 409 : error instanceof Error && error.name === "ZodError" ? 400 : 500;
    res.status(status).json({ success: false, message, error: "EMPLOYEE_INFORMATION_REVIEW_FAILED" });
  }
}

export async function updateMyPersonalInformation(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const information = await updateOwnPersonalInformation(req.user!.id, req.body);
    res.status(200).json({
      success: true,
      message: "Personal information saved successfully",
      data: information,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save personal information";
    res.status(message.includes("not linked") ? 403 : 500).json({
      success: false,
      message,
      error: message.includes("not linked") ? "EMPLOYEE_PROFILE_REQUIRED" : "INTERNAL_SERVER_ERROR",
    });
  }
}

function getRouteParamId(id: string | string[] | undefined): string {
  if (Array.isArray(id)) {
    return id[0] ?? "";
  }

  return id ?? "";
}

/**
 * POST /api/v1/employees
 */
export async function create(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const employee = await createEmployee(req.body);

    res.status(201).json({
      success: true,
      message: "Employee created successfully",
      data: employee,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to create employee";

    const statusCode =
      message.includes("already exists")
        ? 409
        : message.includes("not found")
          ? 404
          : message.includes("inactive")
            ? 400
            : 500;

    res.status(statusCode).json({
      success: false,
      message,
      error:
        statusCode === 500
          ? "INTERNAL_SERVER_ERROR"
          : "EMPLOYEE_CREATION_ERROR",
    });
  }
}

/**
 * POST /api/v1/employees/bulk
 * Creates valid rows and returns row-specific errors for rejected rows.
 */
export async function bulkCreate(req: Request, res: Response): Promise<void> {
  const created: Array<{ row: number; id: string; employeeNumber: string }> = [];
  const failures: Array<{ row: number; employeeNumber: string; message: string }> = [];

  for (const [index, data] of req.body.employees.entries()) {
    const row = index + 2;
    const parsed = createEmployeeSchema.safeParse(data);
    if (!parsed.success) {
      failures.push({
        row,
        employeeNumber: data && typeof data === "object" && "employeeNumber" in data && typeof data.employeeNumber === "string" ? data.employeeNumber : "",
        message: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
      });
      continue;
    }
    try {
      const employee = await createEmployee(parsed.data);
      const personalData = {
        taxId: parsed.data.taxId ?? "",
        personalEmail: parsed.data.personalEmail ?? "",
        bankName: parsed.data.bankName ?? "",
        accountName: parsed.data.accountName ?? "",
        accountNumber: parsed.data.accountNumber ?? "",
      };
      if (Object.values(personalData).some(Boolean)) {
        await prisma.employeePersonalInformation.upsert({
          where: { employeeId: employee.id },
          create: { employeeId: employee.id, data: personalData, reviewStatus: "APPROVED", reviewedAt: new Date() },
          update: { data: personalData },
        });
      }
      created.push({ row, id: employee.id, employeeNumber: employee.employeeNumber });
    } catch (error) {
      failures.push({
        row,
        employeeNumber: parsed.data.employeeNumber,
        message: error instanceof Error ? error.message : "Unable to create this employee",
      });
    }
  }

  res.status(200).json({
    success: true,
    message: `Created ${created.length} employee record${created.length === 1 ? "" : "s"}`,
    data: { created: created.length, failed: failures.length, failures },
  });
}

async function mayManageEmployeeRecords(userId: string): Promise<boolean> {
  const role = await prisma.userRole.findFirst({
    where: {
      userId,
      OR: [
        { role: { name: "SUPER_ADMIN" } },
        { role: { rolePermissions: { some: { permission: { name: "employee:update" } } } } },
      ],
    },
    select: { id: true },
  });
  return role !== null;
}

async function mayReviewEmployeeInformation(userId: string): Promise<boolean> {
  const role = await prisma.userRole.findFirst({
    where: { userId, role: { name: { in: ["SUPER_ADMIN", "HR"] } } },
    select: { id: true },
  });
  return role !== null;
}

/**
 * GET /api/v1/employees
 */
export async function getAll(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const employees = await getEmployees();
    const canSeeCompensation = await mayManageEmployeeRecords(req.user!.id);
    const canReviewPersonalInformation = await mayReviewEmployeeInformation(req.user!.id);
    const data = employees.map((employee) => {
      const { grossSalary, lastSalary, reviewDate, personalInformation, ...profile } = employee;
      return {
        ...profile,
        ...(canSeeCompensation ? { grossSalary, lastSalary, reviewDate } : {}),
        ...(canSeeCompensation && personalInformation
          ? { personalInformation: canReviewPersonalInformation ? personalInformation : { ...personalInformation, proposedData: null, reviewBaseData: null } }
          : {}),
      };
    });

    res.status(200).json({
      success: true,
      message: "Employees retrieved successfully",
      data,
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Unable to retrieve employees",
      error: "INTERNAL_SERVER_ERROR",
    });
  }
}

/**
 * GET /api/v1/employees/:id
 */
export async function getOne(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const employeeId = getRouteParamId(req.params.id);
    const employee = await getEmployeeById(employeeId);
    const canSeeCompensation = await mayManageEmployeeRecords(req.user!.id);
    const data = canSeeCompensation ? employee : (({ grossSalary, lastSalary, reviewDate, ...record }) => record)(employee);

    res.status(200).json({
      success: true,
      message: "Employee retrieved successfully",
      data,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to retrieve employee";

    const statusCode =
      message === "Employee not found"
        ? 404
        : 500;

    res.status(statusCode).json({
      success: false,
      message,
      error:
        statusCode === 404
          ? "EMPLOYEE_NOT_FOUND"
          : "INTERNAL_SERVER_ERROR",
    });
  }
}

/**
 * PATCH /api/v1/employees/:id
 */
export async function update(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const employeeId = getRouteParamId(req.params.id);
    const employee = await updateEmployee(employeeId, req.body);

    res.status(200).json({
      success: true,
      message: "Employee updated successfully",
      data: employee,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to update employee";

    const statusCode =
      message === "Employee not found"
        ? 404
        : message.includes("already exists")
          ? 409
          : message.includes("not found")
            ? 404
            : message.includes("inactive")
              ? 400
              : 500;

    res.status(statusCode).json({
      success: false,
      message,
      error:
        statusCode === 500
          ? "INTERNAL_SERVER_ERROR"
          : "EMPLOYEE_UPDATE_ERROR",
    });
  }
}

/**
 * DELETE /api/v1/employees/:id
 */
export async function remove(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const employeeId = getRouteParamId(req.params.id);
    const result = await deleteEmployee(employeeId);

    res.status(200).json({
      success: true,
      message: "Employee deleted successfully",
      data: result,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to delete employee";

    const statusCode =
      message === "Employee not found"
        ? 404
        : 500;

    res.status(statusCode).json({
      success: false,
      message,
      error:
        statusCode === 404
          ? "EMPLOYEE_NOT_FOUND"
          : "INTERNAL_SERVER_ERROR",
    });
  }
}
