import { prisma } from "../config/database.js";
import type { ApproveLeaveInput, CreateLeaveInput, RejectLeaveInput, UpdateLeaveInput } from "../validators/leave.validator.js";

function getEmployeeForUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { employee: true },
  });
}

function hasRole(roles: string[], ...names: string[]) {
  return names.some((name) => roles.includes(name));
}

async function getUserRoles(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userRoles: {
        include: { role: true },
      },
    },
  });

  return user?.userRoles.map((userRole) => userRole.role.name) ?? [];
}

function computeLeaveDays(startDate: Date, endDate: Date) {
  const diffDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(1, diffDays + 1);
}

export async function createLeaveRequest(userId: string, data: CreateLeaveInput) {
  const user = await getEmployeeForUser(userId);

  if (!user?.employee) {
    throw new Error("Employee profile is required to request leave");
  }

  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  const days = computeLeaveDays(startDate, endDate);

  const overlapping = await prisma.leave.findMany({
    where: {
      employeeId: user.employee.id,
      status: {
        in: ["PENDING", "APPROVED"],
      },
      OR: [
        {
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
      ],
    },
  });

  if (overlapping.length > 0) {
    throw new Error("You already have approved or pending leave overlapping this period");
  }

  if (days <= 0) {
    throw new Error("Leave duration must be at least 1 day");
  }

  const leave = await prisma.leave.create({
    data: {
      employeeId: user.employee.id,
      leaveType: data.leaveType,
      startDate,
      endDate,
      days,
      reason: data.reason,
      status: "PENDING",
    },
    include: {
      employee: {
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });
  const [manager, approvers] = await Promise.all([
    prisma.employee.findUnique({ where: { id: user.employee.id }, select: { manager: { select: { userId: true } } } }),
    prisma.user.findMany({
      where: { userRoles: { some: { role: { name: { in: ["SUPER_ADMIN", "HR"] } } } } },
      select: { id: true },
    }),
  ]);
  const recipientIds = [...new Set([
    ...(manager?.manager?.userId ? [manager.manager.userId] : []),
    ...approvers.map((approver) => approver.id),
  ].filter((id) => id !== userId))];
  if (recipientIds.length) {
    await prisma.notification.createMany({
      data: recipientIds.map((recipientId) => ({
        userId: recipientId,
        title: "Leave request needs review",
        message: `${leave.employee.firstName} ${leave.employee.lastName} submitted a ${leave.leaveType.toLowerCase()} leave request.`,
        type: "INFO" as const,
        metadata: { destination: "/leaves", requestType: "leave", requestId: leave.id },
      })),
    });
  }
  return leave;
}

export async function getLeaveRequests(userId: string) {
  const roles = await getUserRoles(userId);
  const employee = await getEmployeeForUser(userId);

  if (hasRole(roles, "SUPER_ADMIN", "HR", "MANAGER")) {
    return prisma.leave.findMany({
      orderBy: { requestedAt: "desc" },
      include: {
        employee: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        approver: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  if (!employee?.employee) {
    throw new Error("Employee profile is required to view leave requests");
  }

  return prisma.leave.findMany({
    where: { employeeId: employee.employee.id },
    orderBy: { requestedAt: "desc" },
    include: {
      employee: {
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      approver: {
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });
}

export async function getLeaveById(userId: string, leaveId: string) {
  const roles = await getUserRoles(userId);
  const employee = await getEmployeeForUser(userId);
  const leave = await prisma.leave.findUnique({
    where: { id: leaveId },
    include: {
      employee: {
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      approver: {
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  if (!leave) {
    throw new Error("Leave request not found");
  }

  if (hasRole(roles, "SUPER_ADMIN", "HR", "MANAGER") || leave.employeeId === employee?.employee?.id) {
    return leave;
  }

  throw new Error("You do not have access to this leave request");
}

function assertLeaveAdministrator(roles: string[]) {
  if (!hasRole(roles, "SUPER_ADMIN", "HR")) {
    throw new Error("You do not have permission to manage leave requests");
  }
}

export async function updateLeaveRequest(userId: string, leaveId: string, data: UpdateLeaveInput) {
  assertLeaveAdministrator(await getUserRoles(userId));
  const leave = await prisma.leave.findUnique({ where: { id: leaveId } });
  if (!leave) throw new Error("Leave request not found");

  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  const days = computeLeaveDays(startDate, endDate);
  if (days <= 0) throw new Error("Leave duration must be at least 1 day");

  if (leave.status === "PENDING" || leave.status === "APPROVED") {
    const overlapping = await prisma.leave.findFirst({
      where: {
        id: { not: leaveId },
        employeeId: leave.employeeId,
        status: { in: ["PENDING", "APPROVED"] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: { id: true },
    });
    if (overlapping) throw new Error("These dates overlap another pending or approved leave request");
  }

  return prisma.leave.update({
    where: { id: leaveId },
    data: { leaveType: data.leaveType, startDate, endDate, days, reason: data.reason },
    include: {
      employee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true, email: true } },
      approver: { select: { id: true, employeeNumber: true, firstName: true, lastName: true, email: true } },
    },
  });
}

export async function deleteLeaveRequest(userId: string, leaveId: string) {
  assertLeaveAdministrator(await getUserRoles(userId));
  const leave = await prisma.leave.findUnique({ where: { id: leaveId }, select: { id: true } });
  if (!leave) throw new Error("Leave request not found");

  await prisma.$transaction(async (tx) => {
    await tx.notification.deleteMany({ where: { metadata: { path: ["requestId"], equals: leaveId } } });
    await tx.leave.delete({ where: { id: leaveId } });
  });
  return { id: leaveId, deleted: true };
}

export async function approveLeaveRequest(userId: string, leaveId: string, data: ApproveLeaveInput) {
  const roles = await getUserRoles(userId);

  if (!hasRole(roles, "SUPER_ADMIN", "HR", "MANAGER")) {
    throw new Error("You do not have permission to approve leave requests");
  }

  const leave = await prisma.leave.findUnique({ where: { id: leaveId } });

  if (!leave) {
    throw new Error("Leave request not found");
  }

  if (leave.status !== "PENDING") {
    throw new Error("Only pending leave requests can be approved");
  }

  const approverEmployee = await getEmployeeForUser(userId);

  return prisma.leave.update({
    where: { id: leaveId },
    data: {
      status: "APPROVED",
      approvalComment: data.approvalComment ?? null,
      rejectionReason: null,
      reviewedAt: new Date(),
      approverId: approverEmployee?.employee?.id ?? null,
    },
    include: {
      employee: {
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      approver: {
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });
}

export async function rejectLeaveRequest(userId: string, leaveId: string, data: RejectLeaveInput) {
  const roles = await getUserRoles(userId);

  if (!hasRole(roles, "SUPER_ADMIN", "HR", "MANAGER")) {
    throw new Error("You do not have permission to reject leave requests");
  }

  const leave = await prisma.leave.findUnique({ where: { id: leaveId } });

  if (!leave) {
    throw new Error("Leave request not found");
  }

  if (leave.status !== "PENDING") {
    throw new Error("Only pending leave requests can be rejected");
  }

  const approverEmployee = await getEmployeeForUser(userId);

  return prisma.leave.update({
    where: { id: leaveId },
    data: {
      status: "REJECTED",
      rejectionReason: data.rejectionReason,
      approvalComment: null,
      reviewedAt: new Date(),
      approverId: approverEmployee?.employee?.id ?? null,
    },
    include: {
      employee: {
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      approver: {
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });
}

export async function cancelLeaveRequest(userId: string, leaveId: string) {
  const employee = await getEmployeeForUser(userId);
  if (!employee?.employee) {
    throw new Error("Employee profile is required to cancel leave");
  }

  const leave = await prisma.leave.findUnique({ where: { id: leaveId } });

  if (!leave) {
    throw new Error("Leave request not found");
  }

  if (leave.employeeId !== employee.employee.id) {
    throw new Error("You can only cancel your own leave requests");
  }

  if (leave.status !== "PENDING") {
    throw new Error("Only pending leave requests can be cancelled");
  }

  return prisma.leave.update({
    where: { id: leaveId },
    data: { status: "CANCELLED" },
    include: {
      employee: {
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });
}

export async function getLeaveBalance(userId: string) {
  const employee = await getEmployeeForUser(userId);
  if (!employee?.employee) {
    throw new Error("Employee profile is required to view leave balance");
  }

  const balance = await prisma.leaveBalance.findUnique({
    where: { employeeId: employee.employee.id },
  });

  if (!balance) {
    return {
      employeeId: employee.employee.id,
      annualDays: 21,
      sickDays: 12,
      carriedForwardDays: 0,
      usedDays: 0,
    };
  }

  return balance;
}

export async function getLeaveHistory(userId: string) {
  const employee = await getEmployeeForUser(userId);
  if (!employee?.employee) {
    throw new Error("Employee profile is required to view leave history");
  }

  return prisma.leave.findMany({
    where: { employeeId: employee.employee.id },
    orderBy: { requestedAt: "desc" },
  });
}
