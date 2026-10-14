import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../config/database.js";
import type { EmployeePersonalInformationAdminEditInput, EmployeePersonalInformationInput } from "../validators/employee-personal-information.validator.js";
import { sendEmployeeInformationReviewEmail } from "./email.service.js";

async function getLinkedEmployeeId(userId: string): Promise<string> {
  const employee = await prisma.employee.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!employee) {
    throw new Error("An employee profile is not linked to this account");
  }

  return employee.id;
}

function containsInformation(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.some(containsInformation);
  if (value && typeof value === "object") return Object.values(value).some(containsInformation);
  return value !== null && value !== undefined;
}

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function notifyPeopleAdmins(
  submittingUserId: string,
  employee: { id: string; firstName: string; lastName: string },
  sections: string[],
) {
  if (sections.length === 0) return;

  const admins = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      id: { not: submittingUserId },
      AND: [
        {
          userRoles: {
            some: { role: { name: { in: ["SUPER_ADMIN", "HR"] } } },
          },
        },
        { userRoles: { some: { role: { rolePermissions: { some: { permission: { name: "notification:read" } } } } } } },
      ],
    },
    select: { id: true },
  });

  if (admins.length === 0) return;

  const employeeName = `${employee.firstName} ${employee.lastName}`;
  await prisma.notification.createMany({
    data: admins.map(({ id }) => ({
      userId: id,
      title: "Staff information submitted for review",
      message: `${employeeName} submitted ${sections.join(", ").toLowerCase()} for HR review.`,
      type: "INFO" as const,
      metadata: {
        employeeId: employee.id,
        employeeName,
        sections,
        destination: `/employees?section=pending-reviews&employeeId=${employee.id}`,
      },
    })),
  });
}

export async function getOwnPersonalInformation(userId: string) {
  const employeeId = await getLinkedEmployeeId(userId);
  const information = await prisma.employeePersonalInformation.findUnique({
    where: { employeeId },
    select: { data: true, proposedData: true, updatedAt: true, reviewStatus: true, reviewComment: true, reviewedAt: true, submittedAt: true },
  });

  if (!information) return null;
  return { ...information, currentData: information.data, data: information.proposedData ?? information.data };
}

export async function getEmployeePersonalInformation(employeeId: string) {
  const information = await prisma.employeePersonalInformation.findUnique({
    where: { employeeId },
    select: { data: true, updatedAt: true, reviewStatus: true, reviewComment: true, reviewedAt: true, submittedAt: true },
  });

  return information ?? null;
}

export async function getEmployeePersonalInformationReviews() {
  return prisma.employeePersonalInformation.findMany({
    where: { reviewStatus: "PENDING" },
    include: { employee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true, email: true, department: { select: { name: true } } } } },
    orderBy: { submittedAt: "asc" },
  });
}

export async function reviewEmployeePersonalInformation(employeeId: string, reviewerId: string, status: "APPROVED" | "REJECTED", comment?: string) {
  const record = await prisma.employeePersonalInformation.findUnique({
    where: { employeeId },
    include: { employee: { select: { id: true, userId: true, firstName: true, lastName: true, email: true, employeeNumber: true } } },
  });
  if (!record) throw new Error("Employee information not found");
  if (record.reviewStatus !== "PENDING") throw new Error("This employee information has already been reviewed");
  const currentData = jsonObject(record.data);
  const proposal = jsonObject(record.proposedData ?? record.data);
  const submittedBaseline = jsonObject(record.reviewBaseData ?? record.data);
  const submittedChanges = Object.fromEntries(Object.entries(proposal).filter(([key, value]) =>
    JSON.stringify(submittedBaseline[key] ?? null) !== JSON.stringify(value ?? null),
  ));
  const approvedData = { ...currentData, ...submittedChanges };
  const changed = await prisma.employeePersonalInformation.updateMany({
    where: { employeeId, reviewStatus: "PENDING" },
    data: {
      ...(status === "APPROVED" ? { data: approvedData as Prisma.InputJsonValue, proposedData: Prisma.DbNull, reviewBaseData: Prisma.DbNull } : {}),
      reviewStatus: status,
      reviewComment: comment?.trim() || null,
      reviewedAt: new Date(),
    },
  });
  if (changed.count !== 1) throw new Error("This employee information has already been reviewed");
  const updated = await prisma.employeePersonalInformation.findUniqueOrThrow({
    where: { employeeId },
    include: { employee: { select: { id: true, userId: true, firstName: true, lastName: true, email: true, employeeNumber: true } } },
  });
  let bellNotificationSent = false;
  if (record.employee.userId) {
    try {
      await prisma.notification.create({
        data: {
          userId: record.employee.userId,
          title: status === "APPROVED" ? "Employee information approved" : "Employee information needs updates",
          message: status === "APPROVED"
            ? "HR approved your submitted employee information."
            : `HR returned your employee information for updates.${comment?.trim() ? ` Comment: ${comment.trim()}` : ""}`,
          type: status === "APPROVED" ? "SUCCESS" : "WARNING",
          metadata: { employeeId, reviewStatus: status, destination: "/my-information" },
        },
      });
      bellNotificationSent = true;
    } catch (error) {
      console.error("Failed to create employee information review notification", error);
    }
  }
  let emailSent = false;
  if (record.employee.email) {
    try {
      await sendEmployeeInformationReviewEmail({ email: record.employee.email, firstName: record.employee.firstName, status, comment });
      emailSent = true;
    } catch (error) {
      console.error(`Failed to email ${status.toLowerCase()} employee information review`, error);
    }
  }
  return { ...updated, emailSent, bellNotificationSent, reviewedBy: reviewerId };
}

export async function updateEmployeePersonalInformation(employeeId: string, data: EmployeePersonalInformationAdminEditInput) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } });
  if (!employee) throw new Error("Employee not found");
  const existing = await prisma.employeePersonalInformation.findUnique({ where: { employeeId }, select: { data: true } });
  const previous = existing?.data && typeof existing.data === "object" && !Array.isArray(existing.data)
    ? existing.data as Record<string, unknown>
    : {};
  const information = await prisma.employeePersonalInformation.upsert({
    where: { employeeId },
    create: { employeeId, data: { ...data } as Prisma.InputJsonValue, reviewStatus: "APPROVED", reviewedAt: new Date(), proposedData: Prisma.DbNull, reviewBaseData: Prisma.DbNull },
    update: { data: { ...previous, ...data } as Prisma.InputJsonValue },
    select: { data: true, updatedAt: true },
  });
  return information;
}

export async function updateOwnPersonalInformation(
  userId: string,
  data: EmployeePersonalInformationInput,
) {
  const employee = await prisma.employee.findUnique({
    where: { userId },
    select: { id: true, firstName: true, lastName: true },
  });

  if (!employee) {
    throw new Error("An employee profile is not linked to this account");
  }

  const existing = await prisma.employeePersonalInformation.findUnique({
    where: { employeeId: employee.id },
    select: { data: true, proposedData: true, reviewBaseData: true, updatedAt: true, reviewStatus: true, reviewComment: true, reviewedAt: true, submittedAt: true },
  });
  const baseline = existing?.proposedData ?? existing?.data;
  const previous = baseline && typeof baseline === "object" && !Array.isArray(baseline)
    ? baseline as Record<string, unknown>
    : {};
  if (existing && JSON.stringify(previous) === JSON.stringify(data)) return existing;
  const sectionLabels: Record<keyof EmployeePersonalInformationInput, string> = {
    taxId: "tax and bank details",
    personalEmail: "tax and bank details",
    bankName: "tax and bank details",
    accountName: "tax and bank details",
    accountNumber: "tax and bank details",
    pensionProvider: "pension and housing fund details",
    pensionNumber: "pension and housing fund details",
    nhfNumber: "pension and housing fund details",
    spouse: "spouse details",
    beneficiaries: "beneficiaries",
    dependants: "dependants",
    interests: "interests",
    qualifications: "qualifications",
    guarantors: "guarantor details",
  };
  const changedSections = [...new Set((Object.keys(sectionLabels) as (keyof EmployeePersonalInformationInput)[])
    .filter((key) => JSON.stringify(previous[key] ?? null) !== JSON.stringify(data[key]) && (containsInformation(data[key]) || containsInformation(previous[key])))
    .map((key) => sectionLabels[key]))];

  const information = await prisma.employeePersonalInformation.upsert({
    where: { employeeId: employee.id },
    create: {
      employeeId: employee.id,
      data: {} as Prisma.InputJsonValue,
      proposedData: data as Prisma.InputJsonValue,
      reviewBaseData: {} as Prisma.InputJsonValue,
    },
    update: {
      proposedData: data as Prisma.InputJsonValue,
      reviewBaseData: (existing?.reviewStatus === "PENDING" ? existing.reviewBaseData ?? existing.data : existing?.data ?? {}) as Prisma.InputJsonValue,
      reviewStatus: "PENDING",
      reviewComment: null,
      reviewedAt: null,
      submittedAt: new Date(),
    },
    select: { data: true, updatedAt: true, reviewStatus: true, reviewComment: true, reviewedAt: true, submittedAt: true },
  });

  try {
    await notifyPeopleAdmins(userId, employee, changedSections.length ? changedSections : ["employee information"]);
  } catch (error) {
    console.error("Failed to notify admins about staff profile information", error);
  }

  return information;
}
