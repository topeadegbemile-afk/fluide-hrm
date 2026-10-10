import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../config/database.js";
import type { EmployeePersonalInformationInput } from "../validators/employee-personal-information.validator.js";

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
        { userRoles: { some: { role: { rolePermissions: { some: { permission: { name: "employee:update" } } } } } } },
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
      title: "Staff information updated",
      message: `${employeeName} updated their ${sections.join(", ").toLowerCase()}.`,
      type: "INFO" as const,
      metadata: {
        employeeId: employee.id,
        employeeName,
        sections,
      },
    })),
  });
}

export async function getOwnPersonalInformation(userId: string) {
  const employeeId = await getLinkedEmployeeId(userId);
  const information = await prisma.employeePersonalInformation.findUnique({
    where: { employeeId },
    select: { data: true, updatedAt: true },
  });

  return information ?? null;
}

export async function getEmployeePersonalInformation(employeeId: string) {
  const information = await prisma.employeePersonalInformation.findUnique({
    where: { employeeId },
    select: { data: true, updatedAt: true },
  });

  return information ?? null;
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
    select: { data: true },
  });
  const previous = existing?.data && typeof existing.data === "object" && !Array.isArray(existing.data)
    ? existing.data as Record<string, unknown>
    : {};
  const sectionLabels: Record<keyof EmployeePersonalInformationInput, string> = {
    spouse: "spouse details",
    beneficiaries: "beneficiaries",
    dependants: "dependants",
    interests: "interests",
    qualifications: "qualifications",
    guarantors: "guarantor details",
  };
  const changedSections = (Object.keys(sectionLabels) as (keyof EmployeePersonalInformationInput)[])
    .filter((key) => JSON.stringify(previous[key] ?? null) !== JSON.stringify(data[key]) && (containsInformation(data[key]) || containsInformation(previous[key])))
    .map((key) => sectionLabels[key]);

  const information = await prisma.employeePersonalInformation.upsert({
    where: { employeeId: employee.id },
    create: {
      employeeId: employee.id,
      data: data as Prisma.InputJsonValue,
    },
    update: {
      data: data as Prisma.InputJsonValue,
    },
    select: { data: true, updatedAt: true },
  });

  try {
    await notifyPeopleAdmins(userId, employee, changedSections);
  } catch (error) {
    console.error("Failed to notify admins about staff profile information", error);
  }

  return information;
}
