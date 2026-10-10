import { prisma } from "../config/database.js";
import type { ReportQueryInput } from "../validators/report.validator.js";

export async function getDashboardStatistics(query: ReportQueryInput = {}) {
  const employeeWhere = {
    ...(query.departmentId ? { departmentId: query.departmentId } : {}),
    ...(query.employeeId ? { id: query.employeeId } : {}),
  };
  const attendanceWhere = {
    ...(query.employeeId || query.departmentId
      ? {
          employee: {
            ...(query.employeeId ? { id: query.employeeId } : {}),
            ...(query.departmentId ? { departmentId: query.departmentId } : {}),
          },
        }
      : {}),
    ...(query.startDate || query.endDate
      ? {
          attendanceDate: {
            ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
            ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
          },
        }
      : {}),
  };
  const leaveWhere = {
    ...(query.employeeId ? { employeeId: query.employeeId } : {}),
    ...(query.startDate || query.endDate
      ? {
          startDate: {
            ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
            ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
          },
        }
      : {}),
  };
  const [employees, departments, leaves, pendingLeaves, attendance, appraisals, celebrations] = await Promise.all([
    prisma.employee.count({ where: employeeWhere }),
    prisma.department.count(query.departmentId ? { where: { id: query.departmentId } } : undefined),
    prisma.leave.count({ where: leaveWhere }),
    prisma.leave.count({ where: { ...leaveWhere, status: "PENDING" } }),
    prisma.attendance.count({ where: attendanceWhere }),
    prisma.performanceReview.count({
      where: query.employeeId ? { employeeId: query.employeeId } : undefined,
    }),
    prisma.celebration.count(),
  ]);

  return {
    employees,
    departments,
    leaveRequests: leaves,
    pendingLeaveRequests: pendingLeaves,
    attendanceRecords: attendance,
    appraisals,
    celebrations,
    generatedAt: new Date().toISOString(),
  };
}

export async function getEmployeeReport(query: ReportQueryInput = {}) {
  const employees = await prisma.employee.findMany({
    where: {
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.employeeId ? { id: query.employeeId } : {}),
    },
    include: {
      department: true,
      position: true,
      manager: true,
    },
    orderBy: { firstName: "asc" },
  });

  return employees;
}

export async function getAttendanceSummary(query: ReportQueryInput = {}) {
  const attendance = await prisma.attendance.findMany({
    where: {
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.departmentId ? { employee: { departmentId: query.departmentId } } : {}),
      ...(query.startDate ? { attendanceDate: { gte: new Date(query.startDate) } } : {}),
      ...(query.endDate ? { attendanceDate: { lte: new Date(query.endDate) } } : {}),
    },
    include: { employee: true },
  });

  return attendance;
}
