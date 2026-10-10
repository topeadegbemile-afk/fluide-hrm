import { prisma } from "../config/database.js";
import type {
  ClockInInput,
  ClockOutInput,
  UpdateAttendanceInput,
} from "../validators/attendance.validator.js";

async function getUserRoles(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userRoles: {
        include: {
          role: true,
        },
      },
    },
  });

  return user?.userRoles.map((userRole) => userRole.role.name) ?? [];
}

function isHrOrManager(roles: string[]) {
  return roles.includes("SUPER_ADMIN") || roles.includes("HR") || roles.includes("MANAGER");
}

function getDayRange(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

function computeClockInStatus(date: Date) {
  return date.getHours() >= 9 ? "LATE" : "PRESENT";
}

function computeClockOutStatus(clockIn: Date, clockOut: Date) {
  const hoursWorked = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);

  if (hoursWorked < 4) {
    return "HALF_DAY";
  }

  return clockIn.getHours() >= 9 ? "LATE" : "PRESENT";
}

async function getEmployeeForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      employee: true,
    },
  });

  if (!user?.employee) {
    throw new Error("Employee profile is required for attendance access");
  }

  return user.employee;
}

export async function clockInAttendance(userId: string, data: ClockInInput) {
  const employee = await getEmployeeForUser(userId);
  const now = new Date();
  const { start, end } = getDayRange(now);

  const existing = await prisma.attendance.findFirst({
    where: {
      employeeId: employee.id,
      attendanceDate: {
        gte: start,
        lt: end,
      },
    },
  });

  if (existing) {
    if (existing.clockIn) {
      throw new Error("You have already clocked in for today");
    }

    return prisma.attendance.update({
      where: { id: existing.id },
      data: {
        clockIn: now,
        status: computeClockInStatus(now),
        notes: data.notes ?? existing.notes,
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
  }

  return prisma.attendance.create({
    data: {
      employeeId: employee.id,
      attendanceDate: start,
      clockIn: now,
      status: computeClockInStatus(now),
      notes: data.notes,
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
}

export async function clockOutAttendance(userId: string, data: ClockOutInput) {
  const employee = await getEmployeeForUser(userId);
  const now = new Date();
  const { start, end } = getDayRange(now);

  const attendance = await prisma.attendance.findFirst({
    where: {
      employeeId: employee.id,
      attendanceDate: {
        gte: start,
        lt: end,
      },
    },
  });

  if (!attendance) {
    throw new Error("You must clock in before clocking out");
  }

  if (!attendance.clockIn) {
    throw new Error("You must clock in before clocking out");
  }

  if (attendance.clockOut) {
    throw new Error("You have already clocked out for today");
  }

  const status = computeClockOutStatus(attendance.clockIn, now);

  return prisma.attendance.update({
    where: { id: attendance.id },
    data: {
      clockOut: now,
      status,
      notes: data.notes ?? attendance.notes,
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
}

export async function getTodayAttendance(userId: string) {
  const roles = await getUserRoles(userId);
  const userEmployee = await getEmployeeForUser(userId).catch(() => null);
  const now = new Date();
  const { start, end } = getDayRange(now);

  const where = {
    attendanceDate: {
      gte: start,
      lt: end,
    },
    ...(isHrOrManager(roles) || userEmployee === null ? {} : { employeeId: userEmployee?.id }),
  };

  return prisma.attendance.findMany({
    where,
    include: {
      employee: {
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          email: true,
          department: true,
          position: true,
        },
      },
    },
    orderBy: { clockIn: "asc" },
  });
}

export async function getMyAttendanceHistory(userId: string) {
  const employee = await getEmployeeForUser(userId);

  return prisma.attendance.findMany({
    where: {
      employeeId: employee.id,
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
    orderBy: {
      attendanceDate: "desc",
    },
  });
}

export async function getAttendanceList(userId: string) {
  const roles = await getUserRoles(userId);
  const userEmployee = await getEmployeeForUser(userId).catch(() => null);

  if (isHrOrManager(roles)) {
    return prisma.attendance.findMany({
      include: {
        employee: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            email: true,
            department: true,
            position: true,
          },
        },
      },
      orderBy: {
        attendanceDate: "desc",
      },
    });
  }

  if (!userEmployee) {
    return [];
  }

  return prisma.attendance.findMany({
    where: {
      employeeId: userEmployee.id,
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
    orderBy: {
      attendanceDate: "desc",
    },
  });
}

export async function getAttendanceById(userId: string, id: string) {
  const roles = await getUserRoles(userId);
  const userEmployee = await getEmployeeForUser(userId).catch(() => null);

  const attendance = await prisma.attendance.findUnique({
    where: { id },
    include: {
      employee: {
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          email: true,
          department: true,
          position: true,
        },
      },
    },
  });

  if (!attendance) {
    throw new Error("Attendance record not found");
  }

  const canAccess =
    isHrOrManager(roles) ||
    attendance.employeeId === userEmployee?.id;

  if (!canAccess) {
    throw new Error("You do not have access to this attendance record");
  }

  return attendance;
}

export async function updateAttendance(userId: string, id: string, data: UpdateAttendanceInput) {
  const roles = await getUserRoles(userId);
  const userEmployee = await getEmployeeForUser(userId).catch(() => null);

  const attendance = await prisma.attendance.findUnique({
    where: { id },
  });

  if (!attendance) {
    throw new Error("Attendance record not found");
  }

  if (!isHrOrManager(roles) && attendance.employeeId !== userEmployee?.id) {
    throw new Error("You do not have permission to update this attendance record");
  }

  const nextClockIn = data.clockIn ? new Date(data.clockIn) : attendance.clockIn;
  const nextClockOut = data.clockOut ? new Date(data.clockOut) : attendance.clockOut;

  const status =
    data.status ??
    (nextClockIn && nextClockOut
      ? computeClockOutStatus(nextClockIn, nextClockOut)
      : attendance.status);

  return prisma.attendance.update({
    where: { id },
    data: {
      ...(data.clockIn !== undefined ? { clockIn: new Date(data.clockIn) } : {}),
      ...(data.clockOut !== undefined ? { clockOut: new Date(data.clockOut) } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.clockIn !== undefined || data.clockOut !== undefined ? { status } : {}),
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
}
