import { prisma } from "../config/database.js";

const COMPANY_TIME_ZONE = "Africa/Lagos";

function companyDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: COMPANY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

function birthdayIsOn(employeeDob: Date, month: number, day: number) {
  return employeeDob.getUTCMonth() + 1 === month && employeeDob.getUTCDate() === day;
}

export async function notifyTodaysEmployeeCelebrations() {
  const today = companyDateParts();
  const year = Number(today.year);
  const month = Number(today.month);
  const day = Number(today.day);
  const employees = await prisma.employee.findMany({
    where: {
      userId: { not: null },
      employmentStatus: { notIn: ["RESIGNED", "TERMINATED"] },
    },
    select: { id: true, firstName: true, lastName: true, dateOfBirth: true, dateJoined: true, birthdayNotificationYear: true, workAnniversaryNotificationYear: true },
  });
  const celebrations = employees.flatMap((employee) => {
    const todaysBirthday = employee.dateOfBirth && birthdayIsOn(employee.dateOfBirth, month, day) && (employee.birthdayNotificationYear ?? 0) < year;
    const yearsOfService = year - employee.dateJoined.getUTCFullYear();
    const todaysAnniversary = birthdayIsOn(employee.dateJoined, month, day) && yearsOfService >= 1 && (employee.workAnniversaryNotificationYear ?? 0) < year;
    return [
      ...(todaysBirthday ? [{ employee, type: "BIRTHDAY" as const, yearsOfService: null }] : []),
      ...(todaysAnniversary ? [{ employee, type: "WORK_ANNIVERSARY" as const, yearsOfService }] : []),
    ];
  });
  if (!celebrations.length) return { employeesNotified: 0 };

  const recipients = await prisma.employee.findMany({
    where: { userId: { not: null }, employmentStatus: { notIn: ["RESIGNED", "TERMINATED"] } },
    select: { id: true },
  });
  let employeesNotified = 0;
  for (const celebration of celebrations) {
    const { employee, type, yearsOfService } = celebration;
    const isBirthday = type === "BIRTHDAY";
    await prisma.$transaction(async (tx) => {
      const pendingRecipients = recipients;
      if (pendingRecipients.length) {
        await tx.notification.createMany({
          data: pendingRecipients.map((recipient) => ({
            employeeId: recipient.id,
            title: isBirthday ? `Today is ${employee.firstName}'s birthday!` : `${employee.firstName} is celebrating a work anniversary!`,
            message: isBirthday
              ? `Send ${employee.firstName} ${employee.lastName} your birthday wishes.`
              : `Celebrate ${yearsOfService} ${yearsOfService === 1 ? "year" : "years"} at Fluidé Homes with ${employee.firstName} ${employee.lastName}.`,
            type: "ANNOUNCEMENT" as const,
            metadata: { destination: "/celebrations", employeeId: employee.id, celebrationType: type, celebrationYear: year, yearsOfService },
          })),
        });
      }
      await tx.employee.update({
        where: { id: employee.id },
        data: isBirthday ? { birthdayNotificationYear: year } : { workAnniversaryNotificationYear: year },
      });
    });
    employeesNotified += 1;
  }
  return { employeesNotified, celebrationsNotified: celebrations.length };
}

export async function getUpcomingEmployeeCelebrations() {
  const todayParts = companyDateParts();
  const today = new Date(Date.UTC(Number(todayParts.year), Number(todayParts.month) - 1, Number(todayParts.day)));
  const employees = await prisma.employee.findMany({
    where: {
      userId: { not: null },
      employmentStatus: { notIn: ["RESIGNED", "TERMINATED"] },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      dateJoined: true,
      birthdayWishesReceived: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, celebrationType: true, message: true, createdAt: true, sender: { select: { id: true, firstName: true, lastName: true } } },
      },
    },
  });
  const nextDates = employees.flatMap((employee) => {
    const celebrations = [
      ...(employee.dateOfBirth ? [{ date: employee.dateOfBirth, type: "BIRTHDAY" as const, yearsOfService: null }] : []),
      ...(employee.dateJoined.getUTCFullYear() < today.getUTCFullYear() ? [{ date: employee.dateJoined, type: "WORK_ANNIVERSARY" as const, yearsOfService: today.getUTCFullYear() - employee.dateJoined.getUTCFullYear() }] : []),
    ];
    return celebrations.flatMap(({ date, type, yearsOfService }) => {
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    let nextDate = new Date(Date.UTC(today.getUTCFullYear(), month, day));
    if (nextDate < today) nextDate = new Date(Date.UTC(today.getUTCFullYear() + 1, month, day));
    let nextYearsOfService = type === "WORK_ANNIVERSARY" ? nextDate.getUTCFullYear() - employee.dateJoined.getUTCFullYear() : null;
    if (type === "WORK_ANNIVERSARY" && nextYearsOfService! < 1) {
      nextDate = new Date(Date.UTC(nextDate.getUTCFullYear() + 1, month, day));
      nextYearsOfService = nextDate.getUTCFullYear() - employee.dateJoined.getUTCFullYear();
    }
    const daysUntil = Math.round((nextDate.getTime() - today.getTime()) / 86_400_000);
    if (daysUntil > 30) return [];
    return [{
      id: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      celebrationType: type,
      celebrationDate: nextDate.toISOString(),
      daysUntil,
      yearsOfService: type === "WORK_ANNIVERSARY" ? nextYearsOfService : yearsOfService,
      wishes: employee.birthdayWishesReceived.filter((wish) => wish.celebrationType === type),
    }];
    });
  });
  return nextDates.sort((a, b) => a.daysUntil - b.daysUntil || a.firstName.localeCompare(b.firstName));
}

export async function sendBirthdayWish(userId: string, recipientId: string, message: string, celebrationType: "BIRTHDAY" | "WORK_ANNIVERSARY" = "BIRTHDAY") {
  const [sender, recipient] = await Promise.all([
    prisma.employee.findUnique({ where: { userId }, select: { id: true, firstName: true, lastName: true } }),
    prisma.employee.findFirst({ where: { id: recipientId, userId: { not: null } }, select: { id: true, userId: true, firstName: true, lastName: true } }),
  ]);
  if (!sender) throw new Error("Your employee profile is not linked to this account");
  if (!recipient) throw new Error("Employee not found");
  if (sender.id === recipient.id) throw new Error("You cannot send yourself a birthday wish");

  return prisma.$transaction(async (tx) => {
    const wish = await tx.birthdayWish.create({ data: { senderId: sender.id, recipientId, message, celebrationType } });
    await tx.notification.create({
      data: {
        employeeId: recipient.id,
        title: celebrationType === "BIRTHDAY" ? "You received a birthday wish" : "You received an anniversary wish",
        message: `${sender.firstName} ${sender.lastName} sent you a ${celebrationType === "BIRTHDAY" ? "birthday" : "work anniversary"} wish.`,
        type: "INFO",
        metadata: { destination: "/celebrations", employeeId: recipient.id, celebrationType, wishId: wish.id },
      },
    });
    return wish;
  });
}
