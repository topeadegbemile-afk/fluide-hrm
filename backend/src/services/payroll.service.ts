import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../config/database.js";
import { sendPayslipEmail } from "./email.service.js";
import type { PayrollConfigurationInput, PayrollStandardsInput } from "../validators/payroll.validator.js";
import type { MonthlyPayrollDeductionsInput } from "../validators/payroll.validator.js";

const defaultStandards = [{ name: "Basic Salary", percentage: 26 }, { name: "Housing Allowance", percentage: 34 }, { name: "Transport Allowance", percentage: 25 }, { name: "Feeding Allowance", percentage: 10 }, { name: "Other Allowance", percentage: 5 }];
const defaultCurrencies = ["NGN", "USD", "GBP", "SEK"];

async function ensurePayrollCurrencies() {
  await prisma.payrollCurrencyOption.createMany({ data: defaultCurrencies.map((code) => ({ code })), skipDuplicates: true });
}

export async function getPayrollCurrencies() {
  await ensurePayrollCurrencies();
  const currencies = await prisma.payrollCurrencyOption.findMany({ orderBy: { createdAt: "asc" }, select: { code: true } });
  return currencies.map(({ code }) => code);
}

export async function addPayrollCurrency(code: string) {
  await ensurePayrollCurrencies();
  const normalizedCode = code.toUpperCase();
  try { new Intl.NumberFormat("en", { style: "currency", currency: normalizedCode }); }
  catch { throw new Error("Enter a supported ISO currency code"); }
  await prisma.payrollCurrencyOption.upsert({ where: { code: normalizedCode }, create: { code: normalizedCode }, update: {} });
  return getPayrollCurrencies();
}

async function ensurePayrollStandards() {
  if (await prisma.payrollStandardComponent.count() === 0) await prisma.payrollStandardComponent.createMany({ data: defaultStandards.map((item, sortOrder) => ({ ...item, sortOrder })) });
  return prisma.payrollStandardComponent.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function getPayrollStandards() {
  return (await ensurePayrollStandards()).map((item) => ({ name: item.name, percentage: Number(item.percentage) }));
}

export async function savePayrollStandards(data: PayrollStandardsInput) {
  await prisma.$transaction(async (tx) => {
    await tx.payrollStandardComponent.deleteMany();
    await tx.payrollStandardComponent.createMany({ data: data.components.map((item, sortOrder) => ({ ...item, sortOrder })) });
    const configurations = await tx.payrollConfiguration.findMany({ include: { employee: { select: { id: true, grossSalary: true } } } });
    for (const config of configurations) {
      if (!config.employee.grossSalary) continue;
      const grossCents = cents(config.employee.grossSalary);
      let assigned = 0;
      const benefits = data.components.map((item, index) => {
        const componentCents = index === data.components.length - 1 ? grossCents - assigned : Math.round(grossCents * item.percentage / 100);
        assigned += componentCents;
        return { name: item.name, amount: amount(componentCents) };
      });
      await tx.payrollConfiguration.update({ where: { id: config.id }, data: { basicSalary: benefits[0].amount, benefits: benefits.slice(1) as Prisma.InputJsonValue } });
    }
  });
  return getPayrollStandards();
}

type PayItem = { name: string; amount: string };
type PayslipEmailData = {
  id: string;
  employeeName: string;
  employeeNumber: string;
  recipientEmail: string;
  recipientEmails: string[];
  period: string;
  currency: string;
  basicSalary: string;
  benefits: PayItem[];
  grossPay: string;
  deductions: PayItem[];
  totalDeductions: string;
  netPay: string;
};

function cents(value: string | Prisma.Decimal) {
  return Math.round(Number(value) * 100);
}

function amount(value: number) {
  return (value / 100).toFixed(2);
}

function total(items: PayItem[]) {
  return items.reduce((sum, item) => sum + cents(item.amount), 0);
}

function serializablePayslip<T extends {
  basicSalary: Prisma.Decimal;
  grossPay: Prisma.Decimal;
  totalDeductions: Prisma.Decimal;
  netPay: Prisma.Decimal;
}>(payslip: T) {
  return {
    ...payslip,
    basicSalary: payslip.basicSalary.toFixed(2),
    grossPay: payslip.grossPay.toFixed(2),
    totalDeductions: payslip.totalDeductions.toFixed(2),
    netPay: payslip.netPay.toFixed(2),
  };
}

function emailData(payslip: {
  id: string;
  employeeName: string;
  employeeNumber: string;
  recipientEmail: string;
  recipientEmails: string[];
  period: string;
  currency: string;
  basicSalary: Prisma.Decimal;
  benefits: Prisma.JsonValue;
  grossPay: Prisma.Decimal;
  deductions: Prisma.JsonValue;
  totalDeductions: Prisma.Decimal;
  netPay: Prisma.Decimal;
}): PayslipEmailData {
  return {
    id: payslip.id,
    employeeName: payslip.employeeName,
    employeeNumber: payslip.employeeNumber,
    recipientEmail: payslip.recipientEmail,
    recipientEmails: payslip.recipientEmails?.length ? payslip.recipientEmails : [payslip.recipientEmail],
    period: payslip.period,
    currency: payslip.currency,
    basicSalary: payslip.basicSalary.toFixed(2),
    benefits: payslip.benefits as PayItem[],
    grossPay: payslip.grossPay.toFixed(2),
    deductions: payslip.deductions as PayItem[],
    totalDeductions: payslip.totalDeductions.toFixed(2),
    netPay: payslip.netPay.toFixed(2),
  };
}

export async function getPayrollEmployees(period: string) {
  await ensurePayrollStandards();
  const employees = await prisma.employee.findMany({
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      email: true,
      employmentStatus: true,
      user: { select: { email: true } },
      grossSalary: true,
      payrollConfiguration: true,
    },
  });
  const monthlyDeductions = await prisma.monthlyPayrollDeduction.findMany({ where: { period }, select: { employeeId: true, deductions: true } });
  const monthlyDeductionsByEmployee = new Map(monthlyDeductions.map((item) => [item.employeeId, item.deductions as PayItem[]]));

  return employees.map(({ payrollConfiguration, ...employee }) => ({
    ...employee,
    grossSalary: employee.grossSalary?.toFixed(2) ?? null,
    monthlyDeductions: monthlyDeductionsByEmployee.get(employee.id) ?? [],
    payrollConfiguration: payrollConfiguration ? {
      id: payrollConfiguration.id,
      basicSalary: payrollConfiguration.basicSalary.toFixed(2),
      benefits: [...payrollConfiguration.benefits as PayItem[], ...payrollConfiguration.customAdditions as PayItem[]],
      additions: payrollConfiguration.customAdditions as PayItem[],
      deductions: payrollConfiguration.deductions as PayItem[],
      currency: payrollConfiguration.currency,
      isEnabled: payrollConfiguration.isEnabled,
      updatedAt: payrollConfiguration.updatedAt,
    } : null,
  }));
}

export async function saveMonthlyPayrollDeductions(employeeId: string, data: MonthlyPayrollDeductionsInput) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } });
  if (!employee) throw new Error("Employee not found");
  if (data.period > new Date().toISOString().slice(0, 7)) throw new Error("Monthly deductions cannot be set for a future month");
  const existingPayslip = await prisma.payrollPayslip.findUnique({ where: { employeeId_period: { employeeId, period: data.period } }, select: { id: true } });
  if (existingPayslip) throw new Error("Payslip already generated for this month; monthly deductions are locked");
  return prisma.monthlyPayrollDeduction.upsert({
    where: { employeeId_period: { employeeId, period: data.period } },
    create: { employeeId, period: data.period, deductions: data.deductions as Prisma.InputJsonValue },
    update: { deductions: data.deductions as Prisma.InputJsonValue },
  });
}

export async function savePayrollConfiguration(employeeId: string, userId: string, data: PayrollConfigurationInput) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } });
  if (!employee) throw new Error("Employee not found");
  await ensurePayrollCurrencies();
  const currency = await prisma.payrollCurrencyOption.findUnique({ where: { code: data.currency } });
  if (!currency) throw new Error("Add this currency to payroll currencies before assigning it");
  const standards = await ensurePayrollStandards();
  const grossCents = cents(data.grossSalary);
  let assigned = 0;
  const componentAmounts = standards.map((standard, index) => {
    const value = index === standards.length - 1 ? grossCents - assigned : Math.round(grossCents * Number(standard.percentage) / 100);
    assigned += value;
    return { name: standard.name, amount: amount(value) };
  });
  const basic = componentAmounts[0];
  const benefits = componentAmounts.slice(1);
  const deductions = data.deductions;
  const customAdditions = data.additions;
  const grossPayCents = grossCents + total(customAdditions);
  if (total(deductions) > grossPayCents) throw new Error("Deductions cannot exceed gross salary and additions");

  const configuration = await prisma.payrollConfiguration.upsert({
    where: { employeeId },
    create: {
      employeeId,
      basicSalary: basic.amount,
      benefits: benefits as Prisma.InputJsonValue,
      customAdditions: customAdditions as Prisma.InputJsonValue,
      deductions: deductions as Prisma.InputJsonValue,
      currency: data.currency,
      isEnabled: data.isEnabled,
      updatedById: userId,
    },
    update: {
      basicSalary: basic.amount,
      benefits: benefits as Prisma.InputJsonValue,
      customAdditions: customAdditions as Prisma.InputJsonValue,
      deductions: deductions as Prisma.InputJsonValue,
      currency: data.currency,
      isEnabled: data.isEnabled,
      updatedById: userId,
    },
  });
  await prisma.employee.update({ where: { id: employeeId }, data: { grossSalary: data.grossSalary } });

  return {
    id: configuration.id,
    employeeId: configuration.employeeId,
    basicSalary: configuration.basicSalary.toFixed(2),
    benefits: configuration.benefits as PayItem[],
    additions: configuration.customAdditions as PayItem[],
    deductions: configuration.deductions as PayItem[],
    currency: configuration.currency,
    isEnabled: configuration.isEnabled,
    updatedAt: configuration.updatedAt,
  };
}

export async function getPayrollPayslips(period: string) {
  const payslips = await prisma.payrollPayslip.findMany({
    where: { period },
    orderBy: [{ employeeName: "asc" }, { employeeNumber: "asc" }],
  });
  return payslips.map(serializablePayslip);
}

export async function getOwnPayrollPayslips(userId: string) {
  let employee = await prisma.employee.findUnique({ where: { userId }, select: { id: true } });
  if (!employee) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) throw new Error("User account not found");
    const candidate = await prisma.employee.findFirst({ where: { email: user.email, userId: null }, select: { id: true } });
    if (candidate) {
      const linked = await prisma.employee.updateMany({ where: { id: candidate.id, userId: null }, data: { userId } });
      if (linked.count === 1) employee = candidate;
      else employee = await prisma.employee.findUnique({ where: { userId }, select: { id: true } });
    }
  }
  if (!employee) throw new Error("No employee record matches this account email. Ask your administrator to link your employee profile.");
  const payslips = await prisma.payrollPayslip.findMany({
    where: { employeeId: employee.id },
    orderBy: { period: "desc" },
  });
  const profile = await prisma.employee.findUnique({
    where: { id: employee.id },
    select: {
      employeeNumber: true,
      firstName: true,
      lastName: true,
      dateJoined: true,
      office: { select: { name: true } },
      personalInformation: { select: { data: true } },
    },
  });
  const personal = profile?.personalInformation?.data && typeof profile.personalInformation.data === "object" && !Array.isArray(profile.personalInformation.data)
    ? profile.personalInformation.data as Record<string, unknown>
    : {};
  const employeeDetails = {
    employeeId: profile?.employeeNumber ?? "",
    employeeName: profile ? `${profile.firstName} ${profile.lastName}` : "",
    location: profile?.office?.name ?? "",
    hireDate: profile?.dateJoined.toISOString() ?? null,
    pensionProvider: typeof personal.pensionProvider === "string" ? personal.pensionProvider : "",
    pensionNumber: typeof personal.pensionNumber === "string" ? personal.pensionNumber : "",
    taxId: typeof personal.taxId === "string" ? personal.taxId : "",
    nhfNumber: typeof personal.nhfNumber === "string" ? personal.nhfNumber : "",
    bankName: typeof personal.bankName === "string" ? personal.bankName : "",
    accountName: typeof personal.accountName === "string" ? personal.accountName : "",
    accountNumber: typeof personal.accountNumber === "string" ? personal.accountNumber : "",
  };
  return payslips.map((payslip) => ({ ...serializablePayslip(payslip), employeeDetails }));
}

async function sendPayslip(payslip: PayslipEmailData) {
  const claim = await prisma.payrollPayslip.updateMany({
    where: {
      id: payslip.id,
      emailedAt: null,
      OR: [{ emailSendingAt: null }, { emailSendingAt: { lt: new Date(Date.now() - 15 * 60 * 1000) } }],
    },
    data: { emailSendingAt: new Date(), emailAttempts: { increment: 1 } },
  });
  if (claim.count === 0) return null;

  try {
    await sendPayslipEmail(payslip);
    await prisma.payrollPayslip.update({
      where: { id: payslip.id },
      data: { emailedAt: new Date(), emailSendingAt: null, emailError: null },
    });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email delivery failed";
    await prisma.payrollPayslip.update({
      where: { id: payslip.id },
      data: { emailSendingAt: null, emailError: message.slice(0, 500) },
    });
    return false;
  }
}

async function generateMonthlyPayslipsRun(period: string) {
  const currentPeriod = new Date().toISOString().slice(0, 7);
  if (period > currentPeriod) throw new Error("Payslips cannot be generated for a future month");

  const employees = await prisma.employee.findMany({
    where: {
      employmentStatus: { in: ["ACTIVE", "PROBATION", "ON_LEAVE"] },
      payrollConfiguration: { is: { isEnabled: true } },
    },
    include: {
      user: { select: { email: true } },
      personalInformation: { select: { data: true } },
      payrollConfiguration: true,
    },
  });

  let created = 0;
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const employee of employees) {
    const config = employee.payrollConfiguration;
    if (!config) continue;
    let payslip = await prisma.payrollPayslip.findUnique({
      where: { employeeId_period: { employeeId: employee.id, period } },
    });

    if (!payslip) {
      const benefits = [...config.benefits as PayItem[], ...config.customAdditions as PayItem[]];
      const monthlyAdjustment = await prisma.monthlyPayrollDeduction.findUnique({ where: { employeeId_period: { employeeId: employee.id, period } } });
      const recurringDeductions = config.deductions as PayItem[];
      const monthDeductions = monthlyAdjustment?.deductions as PayItem[] | undefined;
      const deductions = [...recurringDeductions, ...(monthDeductions ?? [])];
      const basicCents = cents(config.basicSalary);
      const grossCents = basicCents + total(benefits);
      const deductionCents = total(deductions);
      if (deductionCents > grossCents) {
        failed += 1;
        continue;
      }
      const personal = employee.personalInformation?.data && typeof employee.personalInformation.data === "object" && !Array.isArray(employee.personalInformation.data)
        ? employee.personalInformation.data as Record<string, unknown>
        : {};
      const personalEmail = typeof personal.personalEmail === "string" ? personal.personalEmail.trim() : "";
      const officialEmail = employee.email?.trim() || employee.user?.email?.trim() || "";
      const recipientEmails = [...new Set([officialEmail, personalEmail].filter((email) => email.length > 0).map((email) => email.toLowerCase()))];
      const recipientEmail = officialEmail || personalEmail;
      if (recipientEmails.length === 0) {
        skipped += 1;
        continue;
      }
      try {
        payslip = await prisma.payrollPayslip.create({
          data: {
            employeeId: employee.id,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            employeeNumber: employee.employeeNumber,
            recipientEmail,
            recipientEmails,
            period,
            currency: config.currency,
            basicSalary: amount(basicCents),
            benefits: benefits as Prisma.InputJsonValue,
            grossPay: amount(grossCents),
            deductions: deductions as Prisma.InputJsonValue,
            totalDeductions: amount(deductionCents),
            netPay: amount(grossCents - deductionCents),
          },
        });
        created += 1;
        try {
          await prisma.notification.create({
            data: {
              employeeId: employee.id,
              title: "Your monthly payslip is ready",
              message: `Your payslip for ${period} is available in Payroll.`,
              type: "SUCCESS",
              metadata: { destination: "/payroll", period, payslipId: payslip.id },
            },
          });
        } catch (error) {
          console.error(`Could not notify employee ${employee.employeeNumber} about payslip ${period}`, error);
        }
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
        payslip = await prisma.payrollPayslip.findUnique({
          where: { employeeId_period: { employeeId: employee.id, period } },
        });
      }
    }

    if (!payslip) {
      failed += 1;
      continue;
    }
    if (!payslip.emailedAt) {
      const personal = employee.personalInformation?.data && typeof employee.personalInformation.data === "object" && !Array.isArray(employee.personalInformation.data)
        ? employee.personalInformation.data as Record<string, unknown>
        : {};
      const personalEmail = typeof personal.personalEmail === "string" ? personal.personalEmail.trim() : "";
      const officialEmail = employee.email?.trim() || employee.user?.email?.trim() || "";
      const recipientEmails = [...new Set([officialEmail, personalEmail].filter((email) => email.length > 0).map((email) => email.toLowerCase()))];
      if (recipientEmails.length > 0 && (recipientEmails.length !== payslip.recipientEmails.length || recipientEmails.some((email) => !payslip.recipientEmails.includes(email)))) {
        payslip = await prisma.payrollPayslip.update({
          where: { id: payslip.id },
          data: { recipientEmail: officialEmail || personalEmail, recipientEmails },
        });
      }
    }
    if (payslip.emailedAt) {
      skipped += 1;
      continue;
    }
    if (!payslip.recipientEmails.length && !payslip.recipientEmail) {
      skipped += 1;
      continue;
    }
    const delivered = await sendPayslip(emailData(payslip));
    if (delivered === true) sent += 1;
    else if (delivered === false) failed += 1;
    else skipped += 1;
  }

  const unconfigured = await prisma.employee.count({
    where: {
      employmentStatus: { in: ["ACTIVE", "PROBATION", "ON_LEAVE"] },
      payrollConfiguration: { is: null },
    },
  });
  return { period, eligible: employees.length, unconfigured, created, sent, failed, skipped };
}

type PayrollRunResult = Awaited<ReturnType<typeof generateMonthlyPayslipsRun>>;
const activePayrollRuns = new Map<string, Promise<PayrollRunResult>>();

export function generateMonthlyPayslips(period: string) {
  const active = activePayrollRuns.get(period);
  if (active) return active;
  const run = generateMonthlyPayslipsRun(period).finally(() => activePayrollRuns.delete(period));
  activePayrollRuns.set(period, run);
  return run;
}
