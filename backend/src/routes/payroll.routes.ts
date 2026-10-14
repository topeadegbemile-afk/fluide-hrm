import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { requirePermission, requireRole } from "../middleware/rbac.middleware.js";
import { validate } from "../middleware/validation.middleware.js";
import {
  generatePayslips,
  listEmployees,
  listOwnPayslips,
  listPayslips,
  updateConfiguration,
  listStandards,
  updateStandards,
  listCurrencies,
  createCurrency,
  updateMonthlyDeductions,
} from "../controllers/payroll.controller.js";
import { generatePayrollSchema, monthlyPayrollDeductionsSchema, payrollConfigurationSchema, payrollCurrencySchema, payrollStandardsSchema } from "../validators/payroll.validator.js";

const router = Router();
router.use(authenticate);
router.get("/me", listOwnPayslips);
router.get("/manage/employees", requireRole("SUPER_ADMIN", "HR"), requirePermission("payroll:manage"), listEmployees);
router.get("/manage/standards", requireRole("SUPER_ADMIN", "HR"), requirePermission("payroll:manage"), listStandards);
router.put("/manage/standards", requireRole("SUPER_ADMIN", "HR"), requirePermission("payroll:manage"), validate(payrollStandardsSchema), updateStandards);
router.get("/manage/currencies", requireRole("SUPER_ADMIN", "HR"), requirePermission("payroll:manage"), listCurrencies);
router.post("/manage/currencies", requireRole("SUPER_ADMIN", "HR"), requirePermission("payroll:manage"), validate(payrollCurrencySchema), createCurrency);
router.put("/manage/employees/:employeeId", requireRole("SUPER_ADMIN", "HR"), requirePermission("payroll:manage"), validate(payrollConfigurationSchema), updateConfiguration);
router.put("/manage/employees/:employeeId/monthly-deductions", requireRole("SUPER_ADMIN", "HR"), requirePermission("payroll:manage"), validate(monthlyPayrollDeductionsSchema), updateMonthlyDeductions);
router.get("/manage/payslips", requireRole("SUPER_ADMIN", "HR"), requirePermission("payroll:manage"), listPayslips);
router.post("/manage/generate", requireRole("SUPER_ADMIN", "HR"), requirePermission("payroll:manage"), validate(generatePayrollSchema), generatePayslips);

export default router;
