import { z } from "zod";

const money = z.string().trim().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/, "Enter a valid amount with up to two decimal places");

const payItem = z.object({
  name: z.string().trim().min(1).max(80),
  amount: money,
});

export const payrollConfigurationSchema = z.object({
  grossSalary: money,
  currency: z.string().trim().regex(/^[A-Z]{3}$/, "Choose a valid three-letter currency code"),
  additions: z.array(payItem).max(30),
  deductions: z.array(payItem).max(30),
  isEnabled: z.boolean(),
});

export const payrollCurrencySchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Enter a valid three-letter currency code"),
});

export const monthlyPayrollDeductionsSchema = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose a valid payroll month"),
  deductions: z.array(payItem).max(30),
});

export const payrollStandardsSchema = z.object({
  components: z.array(z.object({ name: z.string().trim().min(1).max(80), percentage: z.number().min(0).max(100) })).min(1).max(30),
}).superRefine(({ components }, ctx) => {
  if (Math.round(components.reduce((sum, component) => sum + component.percentage, 0) * 100) !== 10000) ctx.addIssue({ code: "custom", message: "Component percentages must total 100%" });
  if (new Set(components.map((component) => component.name.toLowerCase())).size !== components.length) ctx.addIssue({ code: "custom", message: "Component names must be unique" });
});

export const generatePayrollSchema = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose a valid payroll month"),
});

export type PayrollConfigurationInput = z.infer<typeof payrollConfigurationSchema>;
export type PayrollStandardsInput = z.infer<typeof payrollStandardsSchema>;
export type MonthlyPayrollDeductionsInput = z.infer<typeof monthlyPayrollDeductionsSchema>;
